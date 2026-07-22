/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  collectNodeLabels,
  collectParameterNames,
  validateDagShape,
} from "./dag-util.js";
import { estimateDagRanges } from "./range-estimator.js";

export const DEFAULT_WGSL_WORKGROUP_SIZE = 128;

export function generateDagWgslFunction(dag, options = {}) {
  validateDagShape(dag);
  const functionName = validateWgslIdentifier(options.functionName ?? "evaluateDag", "functionName");
  const parameterContract = validateParameterContract(dag, options.parameters);
  const parameters = parameterContract.map((parameter) => parameter.name);
  const parameterRanges = Object.fromEntries(parameterContract.map((parameter) => [parameter.name, parameter.range]));
  const rangeResult = estimateDagRanges(dag, parameterRanges);
  const labels = validateLabelContract(dag, options.labels);
  const parameterIndexes = new Map(parameters.map((name, index) => [name, index]));
  const labelIds = collectNodeLabels(dag);
  const states = [];

  const body = [];
  for (const node of dag.nodes) {
    const state = generateNode(node, parameterIndexes, states, rangeResult.nodeRanges);
    states[node.id] = state;
    body.push(`  var v${node.id}: ${state.type} = ${state.expression};`);
  }
  body.push(`  return array<W, ${labels.length}>(${labels.map((label) => finalOutput(states[labelIds.get(label)], labelIds.get(label))).join(", ")});`);

  return {
    code: `${functionSignature(functionName, parameters.length, labels.length)} {
${body.join("\n")}
}
`,
    parameters,
    parameterRanges,
    nodeRanges: rangeResult.nodeRanges,
    labels,
    parameterCount: parameters.length,
    outputCount: labels.length,
    functionName,
  };
}

function generateNode(node, parameterIndexes, states, nodeRanges) {
  const range = nodeRanges[node.id];
  const raw = !range.maybeInvalid;
  if (node.kind === "number") return generateNumber(node.value, raw);
  if (node.kind === "constant") return generateConstant(node.name);
  if (node.kind === "parameter") {
    return { type: "f32", expression: `input[${parameterIndexes.get(node.name)}]` };
  }
  if (node.kind === "unary") return raw
    ? { type: "f32", expression: generateRawUnary(node.op, node.args[0]) }
    : { type: "W", expression: generateWrappedUnary(node.op, node.args[0], states) };
  if (node.kind === "binary") return raw
    ? { type: "f32", expression: generateRawBinary(node.op, node.args[0], node.args[1]) }
    : { type: "W", expression: generateWrappedBinary(node.op, node.args[0], node.args[1], states) };
  if (node.kind === "call") return generateCall(node.name, node.args, states, nodeRanges, raw);
  throw new TypeError(`Unknown DAG node kind: ${JSON.stringify(node.kind)}`);
}

function generateNumber(value, raw) {
  if (!Number.isFinite(value)) return { type: "W", expression: "invalid_value()" };
  const literal = wgslFloat(value);
  return raw ? { type: "f32", expression: literal } : { type: "W", expression: `wrap(${literal})` };
}

function generateConstant(name) {
  if (name === "pi") return { type: "f32", expression: "PI" };
  if (name === "e") return { type: "f32", expression: "E" };
  throw new TypeError(`Unknown constant: ${JSON.stringify(name)}`);
}

function generateRawUnary(op, arg) {
  if (op === "-") return `(-v${arg})`;
  throw new TypeError(`Unknown unary operator: ${JSON.stringify(op)}`);
}

function generateWrappedUnary(op, arg, states) {
  if (op === "-") return `w_neg(${asW(arg, states)})`;
  throw new TypeError(`Unknown unary operator: ${JSON.stringify(op)}`);
}

function generateRawBinary(op, left, right) {
  if (op === "+") return `(v${left} + v${right})`;
  if (op === "-") return `(v${left} - v${right})`;
  if (op === "*") return `(v${left} * v${right})`;
  if (op === "/") return `(v${left} / v${right})`;
  if (op === "^") return `pow(v${left}, v${right})`;
  throw new TypeError(`Unknown binary operator: ${JSON.stringify(op)}`);
}

function generateWrappedBinary(op, left, right, states) {
  if (op === "+") return `w_add(${asW(left, states)}, ${asW(right, states)})`;
  if (op === "-") return `w_sub(${asW(left, states)}, ${asW(right, states)})`;
  if (op === "*") return `w_mul(${asW(left, states)}, ${asW(right, states)})`;
  if (op === "/") return `w_div(${asW(left, states)}, ${asW(right, states)})`;
  if (op === "^") return `w_pow(${asW(left, states)}, ${asW(right, states)})`;
  throw new TypeError(`Unknown binary operator: ${JSON.stringify(op)}`);
}

function generateCall(name, args, states, nodeRanges, raw) {
  if (name === "guardNonzero" && rangeExcludesZero(nodeRanges[args[0]])) return aliasState(args[1], states);
  if (name === "guardNonNegative" && rangeIsNonNegative(nodeRanges[args[0]])) return aliasState(args[1], states);
  if (name === "guardNotInteger" && rangeHasNoIntegers(nodeRanges[args[0]])) return aliasState(args[1], states);
  if (name === "guardValid" && !nodeRanges[args[0]].maybeInvalid) return aliasState(args[1], states);
  if (name === "fallback" && !nodeRanges[args[0]].maybeInvalid) return aliasState(args[0], states);
  if (name === "fallback") return { type: "W", expression: generateWrappedCall(name, args, states) };

  if (raw) return { type: "f32", expression: generateRawCall(name, args) };
  return { type: "W", expression: generateWrappedCall(name, args, states) };
}

function generateRawCall(name, args) {
  const values = args.map((id) => `v${id}`);
  if (name === "sqrt") return `sqrt(${values[0]})`;
  if (name === "sin") return `sin(${values[0]})`;
  if (name === "cos") return `cos(${values[0]})`;
  if (name === "tan") return `tan(${values[0]})`;
  if (name === "sec") return `(1.0 / cos(${values[0]}))`;
  if (name === "csc") return `(1.0 / sin(${values[0]}))`;
  if (name === "cot") return `(1.0 / tan(${values[0]}))`;
  if (name === "sinh") return `sinh(${values[0]})`;
  if (name === "cosh") return `cosh(${values[0]})`;
  if (name === "tanh") return `tanh(${values[0]})`;
  if (name === "log") return `log(${values[0]})`;
  if (name === "exp") return `exp(${values[0]})`;
  if (name === "asin") return `asin(${values[0]})`;
  if (name === "acos") return `acos(${values[0]})`;
  if (name === "atan") return `atan(${values[0]})`;
  if (name === "atan2") return `atan2(${values[0]}, ${values[1]})`;
  if (name === "asinh") return `asinh(${values[0]})`;
  if (name === "acosh") return `acosh(${values[0]})`;
  if (name === "atanh") return `atanh(${values[0]})`;
  if (name === "floor") return `floor(${values[0]})`;
  if (name === "round") return `floor(${values[0]} + 0.5)`;
  if (name === "ceil") return `ceil(${values[0]})`;
  if (name === "fix") return `trunc(${values[0]})`;
  if (name === "abs") return `abs(${values[0]})`;
  if (name === "sign") return `sign(${values[0]})`;
  if (name === "max") return generateMinMax("max", values);
  if (name === "min") return generateMinMax("min", values);
  throw new TypeError(`Unknown raw function: ${JSON.stringify(name)}`);
}

function generateWrappedCall(name, args, states) {
  const values = args.map((id) => asW(id, states));
  if (name === "sqrt") return `w_sqrt(${values[0]})`;
  if (name === "sin") return `w_unary_builtin(${values[0]}, 0u)`;
  if (name === "cos") return `w_unary_builtin(${values[0]}, 1u)`;
  if (name === "tan") return `w_tan(${values[0]})`;
  if (name === "sec") return `w_div(wrap(1.0), w_unary_builtin(${values[0]}, 1u))`;
  if (name === "csc") return `w_div(wrap(1.0), w_unary_builtin(${values[0]}, 0u))`;
  if (name === "cot") return `w_div(wrap(1.0), w_tan(${values[0]}))`;
  if (name === "sinh") return `w_sinh(${values[0]})`;
  if (name === "cosh") return `w_cosh(${values[0]})`;
  if (name === "tanh") return `w_tanh(${values[0]})`;
  if (name === "log") return `w_log(${values[0]})`;
  if (name === "exp") return `w_exp(${values[0]})`;
  if (name === "asin") return `w_asin(${values[0]})`;
  if (name === "acos") return `w_acos(${values[0]})`;
  if (name === "atan") return `w_unary_builtin(${values[0]}, 2u)`;
  if (name === "atan2") return `w_atan2(${values[0]}, ${values[1]})`;
  if (name === "asinh") return `w_asinh(${values[0]})`;
  if (name === "acosh") return `w_acosh(${values[0]})`;
  if (name === "atanh") return `w_atanh(${values[0]})`;
  if (name === "floor") return `w_rounding(${values[0]}, 0u)`;
  if (name === "round") return `w_rounding(${values[0]}, 1u)`;
  if (name === "ceil") return `w_rounding(${values[0]}, 2u)`;
  if (name === "fix") return `w_rounding(${values[0]}, 3u)`;
  if (name === "abs") return `w_abs(${values[0]})`;
  if (name === "sign") return `w_sign(${values[0]})`;
  if (name === "max") return generateMinMax("w_max", values);
  if (name === "min") return generateMinMax("w_min", values);
  if (name === "guardNonzero") return `w_guard_nonzero(${values[0]}, ${values[1]})`;
  if (name === "guardNonNegative") return `w_guard_non_negative(${values[0]}, ${values[1]})`;
  if (name === "guardNotInteger") return `w_guard_not_integer(${values[0]}, ${values[1]})`;
  if (name === "guardValid") return `w_guard_valid(${values[0]}, ${values[1]})`;
  if (name === "fallback") return `w_fallback(${values[0]}, ${values[1]})`;
  throw new TypeError(`Unknown function: ${JSON.stringify(name)}`);
}

function asW(id, states) {
  return states[id].type === "W" ? `v${id}` : `wrap(v${id})`;
}

function aliasState(id, states) {
  return { type: states[id].type, expression: `v${id}` };
}

function finalOutput(state, id) {
  return state.type === "W" ? `v${id}` : `wrap(v${id})`;
}

function rangeExcludesZero(info) {
  return info.intervals.length > 0 && !info.maybeInvalid && info.intervals.every(([lo, hi]) => lo > 0 || hi < 0);
}

function rangeIsNonNegative(info) {
  return info.intervals.length > 0 && !info.maybeInvalid && info.intervals.every(([lo]) => lo >= 0);
}

function rangeHasNoIntegers(info) {
  return info.intervals.length > 0 && !info.maybeInvalid && info.intervals.every(([lo, hi]) => Math.ceil(lo) > Math.floor(hi));
}

function generateMinMax(functionName, values) {
  if (values.length === 0) throw new TypeError(`${functionName} requires at least one argument`);
  return values.slice(1).reduce((expr, value) => `${functionName}(${expr}, ${value})`, values[0]);
}

function wgslFloat(value) {
  if (!Number.isFinite(value)) throw new TypeError(`Expected finite number literal, got ${value}`);
  if (Object.is(value, -0)) return "-0.0";
  const text = String(Math.fround(value));
  return /[.eE]/.test(text) ? text : `${text}.0`;
}

function validateParameterContract(dag, parameters) {
  if (!Array.isArray(parameters)) throw new TypeError("WGSL parameters must be an explicit ordered array");
  const names = parameters.map((parameter, index) => validateParameterEntry(parameter, index));
  validateUniqueStrings(names, "WGSL parameter");
  const dagParameters = collectParameterNames(dag);
  const parameterIndexes = new Map(names.map((name, index) => [name, index]));
  for (const name of dagParameters) {
    if (!parameterIndexes.has(name)) {
      throw new TypeError(`Missing WGSL parameter: ${JSON.stringify(name)}`);
    }
  }
  for (const name of names) {
    if (!dagParameters.has(name)) {
      throw new TypeError(`Unknown WGSL parameter: ${JSON.stringify(name)}`);
    }
  }
  return parameters.map((parameter) => ({
    name: parameter.name,
    range: parameter.range.map(([lo, hi]) => [lo, hi]),
  }));
}

function validateParameterEntry(parameter, index) {
  if (!parameter || typeof parameter !== "object" || Array.isArray(parameter)) {
    throw new TypeError(`WGSL parameter ${index} must be { name, range }`);
  }
  if (typeof parameter.name !== "string" || parameter.name.length === 0) {
    throw new TypeError(`WGSL parameter ${index} name must be a non-empty string`);
  }
  if (!Array.isArray(parameter.range) || parameter.range.length === 0) {
    throw new TypeError(`WGSL parameter ${JSON.stringify(parameter.name)} range must be a non-empty interval array`);
  }
  for (const [rangeIndex, interval] of parameter.range.entries()) {
    if (!Array.isArray(interval) || interval.length !== 2) {
      throw new TypeError(`WGSL parameter ${JSON.stringify(parameter.name)} range ${rangeIndex} must be [min, max]`);
    }
    const [lo, hi] = interval;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      throw new TypeError(`WGSL parameter ${JSON.stringify(parameter.name)} range ${rangeIndex} must use finite numbers`);
    }
    if (lo > hi) {
      throw new TypeError(`WGSL parameter ${JSON.stringify(parameter.name)} range ${rangeIndex} has min greater than max`);
    }
  }
  return parameter.name;
}

function validateLabelContract(dag, labels) {
  if (!Array.isArray(labels)) throw new TypeError("WGSL labels must be an explicit ordered array");
  if (labels.length === 0) throw new TypeError("WGSL labels must contain at least one output label");
  validateUniqueStrings(labels, "WGSL label");
  const labelIds = collectNodeLabels(dag);
  for (const label of labels) {
    if (!labelIds.has(label)) {
      throw new TypeError(`Unknown WGSL label: ${JSON.stringify(label)}`);
    }
  }
  return [...labels];
}

function validateUniqueStrings(values, name) {
  const seen = new Set();
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) {
      throw new TypeError(`${name} must be a non-empty string`);
    }
    if (seen.has(value)) throw new TypeError(`Duplicate ${name}: ${JSON.stringify(value)}`);
    seen.add(value);
  }
}

function functionSignature(functionName, parameterCount, outputCount) {
  if (parameterCount === 0) return `fn ${functionName}() -> array<W, ${outputCount}>`;
  return `fn ${functionName}(input: array<f32, ${parameterCount}>) -> array<W, ${outputCount}>`;
}

function validateWgslIdentifier(value, name) {
  if (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value) || WGSL_RESERVED_WORDS.has(value)) {
    throw new TypeError(`${name} must be a WGSL identifier`);
  }
  return value;
}

const WGSL_RESERVED_WORDS = new Set([
  "alias",
  "break",
  "case",
  "const",
  "const_assert",
  "continue",
  "continuing",
  "default",
  "diagnostic",
  "discard",
  "else",
  "enable",
  "false",
  "fn",
  "for",
  "if",
  "let",
  "loop",
  "override",
  "requires",
  "return",
  "struct",
  "switch",
  "true",
  "var",
  "while",
]);

export const WGSL_RUNTIME_CODE = `
const F32_MAX: f32 = 3.402823e38;
const EXP_MAX: f32 = 88.0;
const EXP_MIN: f32 = -104.0;
const PI: f32 = 3.141592653589793;
const E: f32 = 2.718281828459045;

struct W {
  value: f32,
  invalid: bool,
}

fn wrap(value: f32) -> W {
  return W(value, value != value || abs(value) > F32_MAX);
}

fn invalid_value() -> W {
  return W(0.0, true);
}

fn invalid2(a: W, b: W) -> bool {
  return a.invalid || b.invalid;
}

fn same_sign(a: f32, b: f32) -> bool {
  return (a >= 0.0 && b >= 0.0) || (a < 0.0 && b < 0.0);
}

fn is_integer_exact(value: f32) -> bool {
  return floor(value) == value;
}

fn is_odd_integer_exact(value: f32) -> bool {
  let half = floor(abs(value) * 0.5);
  return abs(abs(value) - half * 2.0 - 1.0) == 0.0;
}

fn w_neg(a: W) -> W {
  if (a.invalid) {
    return invalid_value();
  }
  return wrap(-a.value);
}

fn w_add(a: W, b: W) -> W {
  if (invalid2(a, b)) {
    return invalid_value();
  }
  let av = abs(a.value);
  let bv = abs(b.value);
  if (same_sign(a.value, b.value) && av > F32_MAX - bv) {
    return invalid_value();
  }
  return wrap(a.value + b.value);
}

fn w_sub(a: W, b: W) -> W {
  return w_add(a, w_neg(b));
}

fn w_mul(a: W, b: W) -> W {
  if (invalid2(a, b)) {
    return invalid_value();
  }
  let av = abs(a.value);
  let bv = abs(b.value);
  if (av == 0.0 || bv == 0.0) {
    return wrap(0.0);
  }
  if (av > F32_MAX / bv) {
    return invalid_value();
  }
  return wrap(a.value * b.value);
}

fn w_div(a: W, b: W) -> W {
  if (invalid2(a, b)) {
    return invalid_value();
  }
  if (b.value == 0.0) {
    if (a.value == 0.0) {
      return invalid_value();
    }
    return invalid_value();
  }
  if (abs(a.value) > F32_MAX * abs(b.value)) {
    return invalid_value();
  }
  return wrap(a.value / b.value);
}

fn w_pow(a: W, b: W) -> W {
  if (invalid2(a, b)) {
    return invalid_value();
  }
  if (a.value == 0.0 && b.value < 0.0) {
    return invalid_value();
  }
  if (a.value < 0.0 && !is_integer_exact(b.value)) {
    return invalid_value();
  }
  if (a.value == 0.0 && b.value == 0.0) {
    return wrap(1.0);
  }
  let log_mag = log(max(abs(a.value), 1e-30));
  if (log_mag * b.value > EXP_MAX) {
    return invalid_value();
  }
  let mag = pow(abs(a.value), b.value);
  let sign = select(1.0, -1.0, a.value < 0.0 && is_odd_integer_exact(b.value));
  return wrap(sign * mag);
}

fn w_unary_builtin(a: W, which: u32) -> W {
  if (a.invalid) {
    return invalid_value();
  }
  if (which == 0u) {
    return wrap(sin(a.value));
  }
  if (which == 1u) {
    return wrap(cos(a.value));
  }
  return wrap(atan(a.value));
}

fn w_tan(a: W) -> W {
  if (a.invalid) {
    return invalid_value();
  }
  let c = cos(a.value);
  if (abs(c) < 1e-6) {
    return invalid_value();
  }
  return wrap(tan(a.value));
}

fn w_sqrt(a: W) -> W {
  if (a.invalid || a.value < 0.0) {
    return invalid_value();
  }
  return wrap(sqrt(a.value));
}

fn w_log(a: W) -> W {
  if (a.invalid || a.value <= 0.0) {
    return invalid_value();
  }
  return wrap(log(a.value));
}

fn w_exp(a: W) -> W {
  if (a.invalid) {
    return invalid_value();
  }
  if (a.value > EXP_MAX) {
    return invalid_value();
  }
  if (a.value < EXP_MIN) {
    return wrap(0.0);
  }
  return wrap(exp(a.value));
}

fn w_sinh(a: W) -> W {
  if (a.invalid) {
    return invalid_value();
  }
  if (abs(a.value) > EXP_MAX) {
    return invalid_value();
  }
  return wrap((exp(a.value) - exp(-a.value)) * 0.5);
}

fn w_cosh(a: W) -> W {
  if (a.invalid) {
    return invalid_value();
  }
  if (abs(a.value) > EXP_MAX) {
    return invalid_value();
  }
  return wrap((exp(a.value) + exp(-a.value)) * 0.5);
}

fn w_tanh(a: W) -> W {
  if (a.invalid) {
    return invalid_value();
  }
  if (a.value > 20.0) {
    return wrap(1.0);
  }
  if (a.value < -20.0) {
    return wrap(-1.0);
  }
  let p = exp(a.value);
  let n = exp(-a.value);
  return wrap((p - n) / (p + n));
}

fn w_asin(a: W) -> W {
  if (a.invalid || abs(a.value) > 1.0) {
    return invalid_value();
  }
  return wrap(asin(a.value));
}

fn w_acos(a: W) -> W {
  if (a.invalid || abs(a.value) > 1.0) {
    return invalid_value();
  }
  return wrap(acos(a.value));
}

fn w_atan2(a: W, b: W) -> W {
  if (invalid2(a, b)) {
    return invalid_value();
  }
  return wrap(atan2(a.value, b.value));
}

fn w_asinh(a: W) -> W {
  if (a.invalid) {
    return invalid_value();
  }
  return w_log(w_add(a, w_sqrt(w_add(w_mul(a, a), wrap(1.0)))));
}

fn w_acosh(a: W) -> W {
  if (a.invalid || a.value < 1.0) {
    return invalid_value();
  }
  return w_log(w_add(a, w_mul(w_sqrt(w_sub(a, wrap(1.0))), w_sqrt(w_add(a, wrap(1.0))))));
}

fn w_atanh(a: W) -> W {
  if (a.invalid || abs(a.value) >= 1.0) {
    return invalid_value();
  }
  return w_mul(wrap(0.5), w_log(w_div(w_add(wrap(1.0), a), w_sub(wrap(1.0), a))));
}

fn w_rounding(a: W, which: u32) -> W {
  if (a.invalid) {
    return invalid_value();
  }
  if (which == 0u) {
    return wrap(floor(a.value));
  }
  if (which == 1u) {
    return wrap(floor(a.value + 0.5));
  }
  if (which == 2u) {
    return wrap(ceil(a.value));
  }
  return wrap(trunc(a.value));
}

fn w_abs(a: W) -> W {
  if (a.invalid) {
    return invalid_value();
  }
  return wrap(abs(a.value));
}

fn w_sign(a: W) -> W {
  if (a.invalid) {
    return invalid_value();
  }
  if (a.value > 0.0) {
    return wrap(1.0);
  }
  if (a.value < 0.0) {
    return wrap(-1.0);
  }
  return wrap(0.0);
}

fn w_max(a: W, b: W) -> W {
  if (invalid2(a, b)) {
    return invalid_value();
  }
  return wrap(max(a.value, b.value));
}

fn w_min(a: W, b: W) -> W {
  if (invalid2(a, b)) {
    return invalid_value();
  }
  return wrap(min(a.value, b.value));
}

fn w_guard_nonzero(test: W, value: W) -> W {
  if (test.invalid || value.invalid || test.value == 0.0) {
    return invalid_value();
  }
  return value;
}

fn w_guard_non_negative(test: W, value: W) -> W {
  if (test.invalid || value.invalid || test.value < 0.0) {
    return invalid_value();
  }
  return value;
}

fn w_guard_not_integer(test: W, value: W) -> W {
  if (test.invalid || value.invalid || is_integer_exact(test.value)) {
    return invalid_value();
  }
  return value;
}

fn w_guard_valid(test: W, value: W) -> W {
  if (test.invalid || value.invalid) {
    return invalid_value();
  }
  return value;
}

fn w_fallback(value: W, fallback: W) -> W {
  if (value.invalid) {
    return fallback;
  }
  return value;
}
`;
