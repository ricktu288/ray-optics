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

/**
 * Build a closure-based DAG evaluator.
 *
 * @param {{nodes: Array<object>}} dag - DAG to evaluate.
 * @param {Object} [options={}] - Evaluator options.
 * @param {string[]} [options.labels] - Optional ordered output labels.
 * @returns {Function} Function that accepts parameter values and returns labeled node values.
 */
export function createDagClosureEvaluator(dag, options = {}) {
  validateDagShape(dag);
  const labels = selectOutputLabels(dag, options.labels);
  const evaluators = dag.nodes.map((node) => createNodeEvaluator(node));

  return function interpretDag(params = {}) {
    const values = new Array(evaluators.length);
    for (let index = 0; index < evaluators.length; index += 1) {
      values[index] = finiteOrNaN(evaluators[index](values, params));
    }

    const output = Object.create(null);
    for (const [label, id] of labels) output[label] = values[id];
    return output;
  };
}

function finiteOrNaN(value) {
  return Number.isFinite(value) ? value : NaN;
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

function createNodeEvaluator(node) {
  if (node.kind === "number") return () => node.value;
  if (node.kind === "constant") return () => constantValue(node.name);
  if (node.kind === "parameter") return (_values, params) => Number(params[node.name]);
  if (node.kind === "unary") {
    const [arg] = node.args;
    return (values) => evaluateUnary(node.op, values[arg]);
  }
  if (node.kind === "binary") {
    const [left, right] = node.args;
    return (values) => evaluateBinary(node.op, values[left], values[right]);
  }
  if (node.kind === "call") {
    return (values) => evaluateCall(node.name, node.args.map((id) => values[id]));
  }
  throw new TypeError(`Unknown DAG node kind: ${JSON.stringify(node.kind)}`);
}

function evaluateUnary(op, arg) {
  if (op === "-") return -arg;
  throw new TypeError(`Unknown unary operator: ${JSON.stringify(op)}`);
}

function evaluateBinary(op, left, right) {
  if (op === "+") return left + right;
  if (op === "-") return left - right;
  if (op === "*") return left * right;
  if (op === "/") return left / right;
  if (op === "^") return left ** right;
  throw new TypeError(`Unknown binary operator: ${JSON.stringify(op)}`);
}

function evaluateCall(name, args) {
  if (name === "sqrt") return Math.sqrt(args[0]);
  if (name === "sin") return Math.sin(args[0]);
  if (name === "cos") return Math.cos(args[0]);
  if (name === "tan") return Math.tan(args[0]);
  if (name === "sec") return 1 / Math.cos(args[0]);
  if (name === "csc") return 1 / Math.sin(args[0]);
  if (name === "cot") return 1 / Math.tan(args[0]);
  if (name === "sinh") return Math.sinh(args[0]);
  if (name === "cosh") return Math.cosh(args[0]);
  if (name === "tanh") return Math.tanh(args[0]);
  if (name === "log") return Math.log(args[0]);
  if (name === "exp") return Math.exp(args[0]);
  if (name === "asin") return Math.asin(args[0]);
  if (name === "acos") return Math.acos(args[0]);
  if (name === "atan") return Math.atan(args[0]);
  if (name === "atan2") return Math.atan2(args[0], args[1]);
  if (name === "asinh") return Math.asinh(args[0]);
  if (name === "acosh") return Math.acosh(args[0]);
  if (name === "atanh") return Math.atanh(args[0]);
  if (name === "floor") return Math.floor(args[0]);
  if (name === "round") return Math.round(args[0]);
  if (name === "ceil") return Math.ceil(args[0]);
  if (name === "fix") return Math.trunc(args[0]);
  if (name === "abs") return Math.abs(args[0]);
  if (name === "sign") return Math.sign(args[0]);
  if (name === "max") return Math.max(...args);
  if (name === "min") return Math.min(...args);
  if (name === "guardNonzero") return evaluateGuardNonzero(args[0], args[1]);
  if (name === "guardNonNegative") return evaluateGuardNonNegative(args[0], args[1]);
  if (name === "guardNotInteger") return evaluateGuardNotInteger(args[0], args[1]);
  if (name === "guardValid") return evaluateGuardValid(args[0], args[1]);
  if (name === "fallback") return Number.isFinite(args[0]) ? args[0] : args[1];
  throw new TypeError(`Unknown function: ${JSON.stringify(name)}`);
}

function evaluateGuardNonzero(test, value) {
  if (!Number.isFinite(test) || !Number.isFinite(value)) return NaN;
  return test !== 0 ? value : NaN;
}

function evaluateGuardNonNegative(test, value) {
  if (!Number.isFinite(test) || !Number.isFinite(value)) return NaN;
  return test >= 0 ? value : NaN;
}

function evaluateGuardNotInteger(test, value) {
  if (!Number.isFinite(test) || !Number.isFinite(value)) return NaN;
  return !Number.isInteger(test) ? value : NaN;
}

function evaluateGuardValid(test, value) {
  if (!Number.isFinite(test) || !Number.isFinite(value)) return NaN;
  return value;
}

function constantValue(name) {
  if (name === "pi") return Math.PI;
  if (name === "e") return Math.E;
  throw new TypeError(`Unknown constant: ${JSON.stringify(name)}`);
}
