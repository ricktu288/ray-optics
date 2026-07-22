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

import { collectNodeLabels, validateDagShape } from "./dag-util.js";

export const JS_RUNTIME_CODE = `
function finiteOrNaN(value) {
  return Number.isFinite(value) ? value : NaN;
}

function guardNonzero(test, value) {
  if (!Number.isFinite(test) || !Number.isFinite(value)) return NaN;
  return test !== 0 ? value : NaN;
}

function guardNonNegative(test, value) {
  if (!Number.isFinite(test) || !Number.isFinite(value)) return NaN;
  return test >= 0 ? value : NaN;
}

function guardNotInteger(test, value) {
  if (!Number.isFinite(test) || !Number.isFinite(value)) return NaN;
  return !Number.isInteger(test) ? value : NaN;
}

function guardValid(test, value) {
  if (!Number.isFinite(test) || !Number.isFinite(value)) return NaN;
  return value;
}

function fallback(value, fallbackValue) {
  return Number.isFinite(value) ? value : fallbackValue;
}
`.trim();

/**
 * Generate JavaScript source for evaluating labeled DAG nodes.
 *
 * The returned source is not evaluated. Callers that trust the DAG may load it
 * with `new Function` or write it to a file.
 *
 * @param {{nodes: Array<object>}} dag - DAG to generate source for.
 * @param {Object} [options={}] - Generator options.
 * @param {string[]} [options.labels] - Optional ordered output labels.
 * @param {string} [options.functionName] - Generated evaluator function name.
 * @returns {Object} Generated source code and metadata.
 */
export function generateDagJsEvaluator(dag, options = {}) {
  validateDagShape(dag);
  const functionName = validateJsIdentifier(options.functionName ?? "evaluateDag", "functionName");
  const labels = selectOutputLabels(dag, options.labels);

  const body = [
    "  params = params ?? Object.create(null);",
    "  const output = Object.create(null);",
  ];

  for (const node of dag.nodes) {
    body.push(`  const v${node.id} = finiteOrNaN(${generatedNodeExpression(node)});`);
  }
  for (const [label, id] of labels) {
    body.push(`  output[${JSON.stringify(label)}] = v${id};`);
  }
  body.push("  return output;");

  const functionCode = `function ${functionName}(params = Object.create(null)) {
${body.join("\n")}
}`;
  return {
    code: `${JS_RUNTIME_CODE}\n\n${functionCode}\n`,
    runtimeCode: JS_RUNTIME_CODE,
    functionCode,
    labels: labels.map(([label]) => label),
    functionName,
  };
}

function selectOutputLabels(dag, labels) {
  const labelIds = collectNodeLabels(dag);
  if (labels === undefined) return [...labelIds.entries()];
  if (!Array.isArray(labels)) throw new TypeError("labels must be an array");
  const seen = new Set();
  return labels.map((label) => {
    if (typeof label !== "string" || label.length === 0) {
      throw new TypeError("labels must contain non-empty strings");
    }
    if (seen.has(label)) throw new TypeError(`Duplicate label: ${JSON.stringify(label)}`);
    seen.add(label);
    const id = labelIds.get(label);
    if (id === undefined) throw new TypeError(`Unknown label: ${JSON.stringify(label)}`);
    return [label, id];
  });
}

function generatedNodeExpression(node) {
  if (node.kind === "number") return numberLiteral(node.value);
  if (node.kind === "constant") return numberLiteral(constantValue(node.name));
  if (node.kind === "parameter") return `Number(params[${JSON.stringify(node.name)}])`;
  if (node.kind === "unary") return generatedUnaryExpression(node.op, node.args[0]);
  if (node.kind === "binary") return generatedBinaryExpression(node.op, node.args[0], node.args[1]);
  if (node.kind === "call") return generatedCallExpression(node.name, node.args);
  throw new TypeError(`Unknown DAG node kind: ${JSON.stringify(node.kind)}`);
}

function generatedUnaryExpression(op, arg) {
  if (op === "-") return `(-v${arg})`;
  throw new TypeError(`Unknown unary operator: ${JSON.stringify(op)}`);
}

function generatedBinaryExpression(op, left, right) {
  if (op === "+") return `(v${left} + v${right})`;
  if (op === "-") return `(v${left} - v${right})`;
  if (op === "*") return `(v${left} * v${right})`;
  if (op === "/") return `(v${left} / v${right})`;
  if (op === "^") return `(v${left} ** v${right})`;
  throw new TypeError(`Unknown binary operator: ${JSON.stringify(op)}`);
}

function generatedCallExpression(name, args) {
  const values = args.map((id) => `v${id}`);
  if (name === "sqrt") return `Math.sqrt(${values[0]})`;
  if (name === "sin") return `Math.sin(${values[0]})`;
  if (name === "cos") return `Math.cos(${values[0]})`;
  if (name === "tan") return `Math.tan(${values[0]})`;
  if (name === "sec") return `(1 / Math.cos(${values[0]}))`;
  if (name === "csc") return `(1 / Math.sin(${values[0]}))`;
  if (name === "cot") return `(1 / Math.tan(${values[0]}))`;
  if (name === "sinh") return `Math.sinh(${values[0]})`;
  if (name === "cosh") return `Math.cosh(${values[0]})`;
  if (name === "tanh") return `Math.tanh(${values[0]})`;
  if (name === "log") return `Math.log(${values[0]})`;
  if (name === "exp") return `Math.exp(${values[0]})`;
  if (name === "asin") return `Math.asin(${values[0]})`;
  if (name === "acos") return `Math.acos(${values[0]})`;
  if (name === "atan") return `Math.atan(${values[0]})`;
  if (name === "atan2") return `Math.atan2(${values[0]}, ${values[1]})`;
  if (name === "asinh") return `Math.asinh(${values[0]})`;
  if (name === "acosh") return `Math.acosh(${values[0]})`;
  if (name === "atanh") return `Math.atanh(${values[0]})`;
  if (name === "floor") return `Math.floor(${values[0]})`;
  if (name === "round") return `Math.round(${values[0]})`;
  if (name === "ceil") return `Math.ceil(${values[0]})`;
  if (name === "fix") return `Math.trunc(${values[0]})`;
  if (name === "abs") return `Math.abs(${values[0]})`;
  if (name === "sign") return `Math.sign(${values[0]})`;
  if (name === "max") return `Math.max(${values.join(", ")})`;
  if (name === "min") return `Math.min(${values.join(", ")})`;
  if (name === "guardNonzero") return `guardNonzero(${values[0]}, ${values[1]})`;
  if (name === "guardNonNegative") return `guardNonNegative(${values[0]}, ${values[1]})`;
  if (name === "guardNotInteger") return `guardNotInteger(${values[0]}, ${values[1]})`;
  if (name === "guardValid") return `guardValid(${values[0]}, ${values[1]})`;
  if (name === "fallback") return `fallback(${values[0]}, ${values[1]})`;
  throw new TypeError(`Unknown function: ${JSON.stringify(name)}`);
}

function constantValue(name) {
  if (name === "pi") return Math.PI;
  if (name === "e") return Math.E;
  throw new TypeError(`Unknown constant: ${JSON.stringify(name)}`);
}

function numberLiteral(value) {
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  return JSON.stringify(value);
}

function validateJsIdentifier(value, name) {
  if (typeof value !== "string" || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) || JS_RESERVED_WORDS.has(value)) {
    throw new TypeError(`${name} must be a JavaScript identifier`);
  }
  return value;
}

const JS_RESERVED_WORDS = new Set([
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);
