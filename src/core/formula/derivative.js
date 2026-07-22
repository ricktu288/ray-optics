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
  cloneNode,
  collectNodeLabels,
  findNodeByLabel,
  validateDagNodeLabel,
  validateDagShape,
} from "./dag-util.js";

class DagDerivativeError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "DagDerivativeError";
    Object.assign(this, details);
  }
}

class AppendingDerivativeBuilder {
  constructor(nodes) {
    this.nodes = nodes;
  }

  number(value, raw = String(value)) {
    return this.add({ kind: "number", value, raw });
  }

  unary(op, arg) {
    return this.add({ kind: "unary", op, args: [arg] });
  }

  binary(op, left, right) {
    return this.add({ kind: "binary", op, args: [left, right] });
  }

  addExpr(left, right) {
    if (this.isNumber(left, 0)) return right;
    if (this.isNumber(right, 0)) return left;
    return this.binary("+", left, right);
  }

  subtractExpr(left, right) {
    if (this.isNumber(right, 0)) return left;
    return this.binary("-", left, right);
  }

  multiplyExpr(left, right) {
    if (this.isNumber(left, 0) || this.isNumber(right, 0)) return this.number(0, "0");
    if (this.isNumber(left, 1)) return right;
    if (this.isNumber(right, 1)) return left;
    return this.binary("*", left, right);
  }

  divideExpr(left, right) {
    if (this.isNumber(left, 0)) return this.number(0, "0");
    if (this.isNumber(right, 1)) return left;
    return this.binary("/", left, right);
  }

  powerExpr(base, exponent) {
    if (this.isNumber(exponent, 1)) return base;
    return this.binary("^", base, exponent);
  }

  call(name, args) {
    return this.add({ kind: "call", name, args });
  }

  add(node) {
    const id = this.nodes.length;
    this.nodes.push({ id, ...node });
    return id;
  }

  isNumber(id, value) {
    const node = this.nodes[id];
    return node?.kind === "number" && Object.is(node.value, value);
  }
}

/**
 * Append labeled first partial derivative nodes to a formula DAG.
 *
 * The input DAG is not mutated. Existing node IDs are preserved, and derivative
 * nodes are appended without interning or post-pass deduplication.
 *
 * @param {Object} dag DAG containing the labeled source node.
 * @param {number} [dag.root] Root node ID.
 * @param {Object[]} dag.nodes DAG nodes.
 * @param {{
 *   sourceLabel: string,
 *   partials: Array<{parameter: string, label: string}>
 * }} options Derivative request.
 * @returns {Object} New DAG plus successful derivative nodes and skipped derivative errors.
 */
export function appendPartialDerivatives(dag, options) {
  validateDagShape(dag);
  if (!options || !Array.isArray(options.partials)) {
    throw new TypeError("options.partials must be an array");
  }

  validateDagNodeLabel(options.sourceLabel, "sourceLabel");
  const source = findNodeByLabel(dag, options.sourceLabel);
  const partials = options.partials.map((partial) => normalizePartial(partial));
  const nodes = dag.nodes.map(cloneNode);
  const usedLabels = new Set(collectNodeLabels(dag).keys());
  const derivatives = [];
  const errors = [];

  for (const partial of partials) {
    if (usedLabels.has(partial.label)) {
      throw new TypeError(`Derivative label already exists: ${JSON.stringify(partial.label)}`);
    }
    usedLabels.add(partial.label);
  }

  for (const partial of partials) {
    const builder = new AppendingDerivativeBuilder(nodes);
    const firstAppendedId = nodes.length;
    let node;
    try {
      node = derivativeOf(dag, builder, source, partial.parameter);
    } catch (error) {
      nodes.length = firstAppendedId;
      errors.push({
        parameter: partial.parameter,
        label: partial.label,
        sourceLabel: options.sourceLabel,
        source,
        message: error.message,
      });
      continue;
    }
    const prunedNode = pruneAppendedNodes(nodes, firstAppendedId, node);
    nodes[prunedNode] = { ...nodes[prunedNode], label: partial.label };
    derivatives.push({ parameter: partial.parameter, label: partial.label, sourceLabel: options.sourceLabel, source, node: prunedNode });
  }

  return {
    dag: {
      ...dag,
      nodes,
    },
    derivatives,
    errors,
  };
}

function derivativeOf(dag, builder, id, parameter) {
  const node = dag.nodes[id];

  if (node.kind === "number" || node.kind === "constant") return builder.number(0, "0");
  if (node.kind === "parameter") return builder.number(node.name === parameter ? 1 : 0, node.name === parameter ? "1" : "0");
  if (node.kind === "unary" && node.op === "-") return builder.unary("-", derivativeOf(dag, builder, node.args[0], parameter));

  if (node.kind === "binary") {
    const [left, right] = node.args;

    if (node.op === "+") {
      return builder.addExpr(
        derivativeOf(dag, builder, left, parameter),
        derivativeOf(dag, builder, right, parameter),
      );
    }
    if (node.op === "-") {
      return builder.subtractExpr(
        derivativeOf(dag, builder, left, parameter),
        derivativeOf(dag, builder, right, parameter),
      );
    }
    if (node.op === "*") {
      const dLeft = derivativeOf(dag, builder, left, parameter);
      const dRight = derivativeOf(dag, builder, right, parameter);
      return builder.addExpr(
        builder.multiplyExpr(dLeft, right),
        builder.multiplyExpr(left, dRight),
      );
    }
    if (node.op === "/") {
      const dLeft = derivativeOf(dag, builder, left, parameter);
      const dRight = derivativeOf(dag, builder, right, parameter);
      return builder.divideExpr(
        builder.subtractExpr(
          builder.multiplyExpr(dLeft, right),
          builder.multiplyExpr(left, dRight),
        ),
        builder.powerExpr(right, builder.number(2, "2")),
      );
    }
    if (node.op === "^") return derivativeOfPower(dag, builder, left, right, parameter);
  }

  if (node.kind === "call") {
    if (node.name === "max" || node.name === "min") {
      return derivativeOfMinMax(dag, builder, node.name, node.args, parameter);
    }

    const arg = node.args[0];
    const dArg = derivativeOf(dag, builder, arg, parameter);
    return derivativeOfCall(dag, builder, node.name, node.args, arg, dArg, parameter);
  }

  throw new DagDerivativeError(`Cannot differentiate node ${id}`);
}

function derivativeOfPower(dag, builder, base, exponent, parameter) {
  const exponentNode = dag.nodes[exponent];
  if (exponentNode.kind === "number") {
    const dBase = derivativeOf(dag, builder, base, parameter);
    return builder.multiplyExpr(
      builder.multiplyExpr(
        builder.number(exponentNode.value, String(exponentNode.value)),
        builder.powerExpr(base, builder.number(exponentNode.value - 1, String(exponentNode.value - 1))),
      ),
      dBase,
    );
  }

  const dBase = derivativeOf(dag, builder, base, parameter);
  const dExponent = derivativeOf(dag, builder, exponent, parameter);
  return builder.multiplyExpr(
    builder.powerExpr(base, exponent),
    builder.addExpr(
      builder.multiplyExpr(dExponent, builder.call("log", [base])),
      builder.multiplyExpr(exponent, builder.divideExpr(dBase, base)),
    ),
  );
}

function derivativeOfCall(dag, builder, name, args, arg, dArg, parameter) {
  if (name === "guardNonzero" || name === "guardNonNegative" || name === "guardNotInteger" || name === "guardValid") {
    if (args.length !== 2) {
      throw new DagDerivativeError(`${name}() must have exactly two arguments`);
    }
    return builder.call(name, [args[0], derivativeOf(dag, builder, args[1], parameter)]);
  }

  if (name === "abs") return builder.call("guardNonzero", [arg, builder.multiplyExpr(builder.call("sign", [arg]), dArg)]);
  if (name === "sign") return builder.call("guardNonzero", [arg, builder.number(0, "0")]);
  if (name === "floor" || name === "ceil" || name === "fix") return builder.call("guardNotInteger", [arg, builder.number(0, "0")]);
  if (name === "round") {
    const halfShifted = builder.addExpr(arg, builder.number(0.5, "0.5"));
    return builder.call("guardNotInteger", [halfShifted, builder.number(0, "0")]);
  }
  if (name === "sin") return builder.multiplyExpr(builder.call("cos", [arg]), dArg);
  if (name === "cos") return builder.multiplyExpr(builder.unary("-", builder.call("sin", [arg])), dArg);
  if (name === "tan") return builder.multiplyExpr(builder.powerExpr(builder.call("sec", [arg]), builder.number(2, "2")), dArg);
  if (name === "sec") return builder.multiplyExpr(builder.multiplyExpr(builder.call("sec", [arg]), builder.call("tan", [arg])), dArg);
  if (name === "csc") return builder.multiplyExpr(builder.unary("-", builder.multiplyExpr(builder.call("csc", [arg]), builder.call("cot", [arg]))), dArg);
  if (name === "cot") return builder.multiplyExpr(builder.unary("-", builder.powerExpr(builder.call("csc", [arg]), builder.number(2, "2"))), dArg);
  if (name === "sinh") return builder.multiplyExpr(builder.call("cosh", [arg]), dArg);
  if (name === "cosh") return builder.multiplyExpr(builder.call("sinh", [arg]), dArg);
  if (name === "tanh") {
    const sech = builder.divideExpr(
      builder.number(2, "2"),
      builder.addExpr(builder.call("exp", [arg]), builder.call("exp", [builder.unary("-", arg)])),
    );
    return builder.multiplyExpr(
      builder.powerExpr(sech, builder.number(2, "2")),
      dArg,
    );
  }
  if (name === "log") return builder.divideExpr(dArg, arg);
  if (name === "exp") return builder.multiplyExpr(builder.call("exp", [arg]), dArg);
  if (name === "sqrt") return builder.divideExpr(dArg, builder.multiplyExpr(builder.number(2, "2"), builder.call("sqrt", [arg])));
  if (name === "asin") return builder.divideExpr(dArg, builder.call("sqrt", [builder.subtractExpr(builder.number(1, "1"), builder.powerExpr(arg, builder.number(2, "2")))]));
  if (name === "acos") return builder.unary("-", builder.divideExpr(dArg, builder.call("sqrt", [builder.subtractExpr(builder.number(1, "1"), builder.powerExpr(arg, builder.number(2, "2")))])));
  if (name === "atan") return builder.divideExpr(dArg, builder.addExpr(builder.number(1, "1"), builder.powerExpr(arg, builder.number(2, "2"))));
  if (name === "asinh") return builder.divideExpr(dArg, builder.call("sqrt", [builder.addExpr(builder.powerExpr(arg, builder.number(2, "2")), builder.number(1, "1"))]));
  if (name === "acosh") return builder.divideExpr(dArg, builder.multiplyExpr(builder.call("sqrt", [builder.subtractExpr(arg, builder.number(1, "1"))]), builder.call("sqrt", [builder.addExpr(arg, builder.number(1, "1"))])));
  if (name === "atanh") return builder.divideExpr(dArg, builder.subtractExpr(builder.number(1, "1"), builder.powerExpr(arg, builder.number(2, "2"))));

  throw new DagDerivativeError(`Unsupported differentiable function ${JSON.stringify(name)}`);
}

function derivativeOfMinMax(dag, builder, name, args, parameter) {
  if (args.length === 0) throw new DagDerivativeError(`${name}() must have at least one argument`);

  let value = args[0];
  let derivative = derivativeOf(dag, builder, value, parameter);
  for (let index = 1; index < args.length; index += 1) {
    const right = args[index];
    const dRight = derivativeOf(dag, builder, right, parameter);
    derivative = derivativeOfMinMaxPair(builder, name, value, right, derivative, dRight);
    value = builder.call(name, [value, right]);
  }
  return derivative;
}

function derivativeOfMinMaxPair(builder, name, left, right, dLeft, dRight) {
  const diff = builder.subtractExpr(left, right);
  const sign = builder.call("sign", [diff]);
  const two = builder.number(2, "2");
  const leftWeight = builder.divideExpr(
    name === "max"
      ? builder.addExpr(builder.number(1, "1"), sign)
      : builder.subtractExpr(builder.number(1, "1"), sign),
    two,
  );
  const rightWeight = builder.divideExpr(
    name === "max"
      ? builder.subtractExpr(builder.number(1, "1"), sign)
      : builder.addExpr(builder.number(1, "1"), sign),
    two,
  );
  return builder.call(
    "guardNonzero",
    [
      diff,
      builder.addExpr(
        builder.multiplyExpr(leftWeight, dLeft),
        builder.multiplyExpr(rightWeight, dRight),
      ),
    ],
  );
}

function normalizePartial(partial) {
  if (typeof partial === "string") {
    throw new TypeError("partial entries must include both parameter and label");
  }
  if (!partial || typeof partial.parameter !== "string" || partial.parameter.length === 0) {
    throw new TypeError("partial.parameter must be a non-empty string");
  }
  validateDagNodeLabel(partial.label, "partial.label");
  return { parameter: partial.parameter, label: partial.label };
}

function pruneAppendedNodes(nodes, firstAppendedId, root) {
  const reachable = new Set();

  function visit(id) {
    if (id < firstAppendedId || reachable.has(id)) return;
    reachable.add(id);
    for (const childId of nodes[id].args ?? []) visit(childId);
  }

  visit(root);
  const remapped = new Map();
  const kept = [];
  for (let id = firstAppendedId; id < nodes.length; id += 1) {
    if (!reachable.has(id)) continue;
    remapped.set(id, firstAppendedId + kept.length);
    kept.push(nodes[id]);
  }

  nodes.length = firstAppendedId;
  for (const node of kept) {
    const id = remapped.get(node.id);
    nodes.push({
      ...node,
      id,
      args: node.args?.map((childId) => remapped.get(childId) ?? childId),
    });
  }
  return remapped.get(root) ?? root;
}

export { DagDerivativeError };
