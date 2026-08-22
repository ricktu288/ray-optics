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

import assert from "node:assert/strict";
import {
  isValidFormulaParameterName,
  parseFormula,
  FormulaParseError,
} from "../../../src/core/formula/formula-parser.js";

function parses(expression, parameters = []) {
  return parseFormula(expression, parameters);
}

function rejects(expression, parameters = [], messagePart) {
  assert.throws(
    () => parses(expression, parameters),
    (error) => error instanceof FormulaParseError && error.message.includes(messagePart),
    `${expression} should reject with ${messagePart}`,
  );
}

{
  const dag = parses("sin(x)^2 + cos(x)^2", ["x"]);
  assert.equal(dag.nodes[0].kind, "parameter");
  assert.equal(dag.nodes[0].name, "x");
  assert.equal(dag.nodes.filter((node) => node.kind === "parameter" && node.name === "x").length, 1);
  assert.equal(dag.nodes[dag.root].kind, "binary");
  assert.equal(dag.nodes[dag.root].op, "+");
}

{
  const dag = parses("-2^2");
  const root = dag.nodes[dag.root];
  assert.equal(root.kind, "unary");
  assert.equal(root.op, "-");
  assert.equal(dag.nodes[root.args[0]].op, "^");
}

{
  const dag = parses("2^-3");
  const root = dag.nodes[dag.root];
  assert.equal(root.op, "^");
  assert.equal(dag.nodes[root.args[1]].kind, "unary");
}

{
  const dag = parses("max(.5, 1., 6.02e23, min(a, i))", ["a", "i"]);
  assert.equal(dag.nodes[dag.root].kind, "call");
  assert.equal(dag.nodes[dag.root].name, "max");
  assert.equal(dag.nodes[dag.root].args.length, 4);
}

{
  const dag = parses("sqrt( x + pi ) / e", ["x"]);
  assert.equal(dag.nodes[dag.root].op, "/");
  assert.ok(dag.nodes.some((node) => node.kind === "constant" && node.name === "pi"));
  assert.ok(dag.nodes.some((node) => node.kind === "constant" && node.name === "e"));
}

{
  const dag = parses("atan2(y, x)", ["x", "y"]);
  assert.equal(dag.nodes[dag.root].kind, "call");
  assert.equal(dag.nodes[dag.root].name, "atan2");
  assert.equal(dag.nodes[dag.root].args.length, 2);
}

{
  const dag = parses("fallback(guardNonzero(x, 10), 42)", ["x"]);
  const root = dag.nodes[dag.root];
  assert.equal(root.kind, "call");
  assert.equal(root.name, "fallback");
  assert.equal(dag.nodes[root.args[0]].kind, "call");
  assert.equal(dag.nodes[root.args[0]].name, "guardNonzero");
}

{
  const dag = parses("guardNotInteger(x, guardNonNegative(y, guardValid(z, 1)))", ["x", "y", "z"]);
  const root = dag.nodes[dag.root];
  assert.equal(root.kind, "call");
  assert.equal(root.name, "guardNotInteger");
  assert.equal(dag.nodes[root.args[1]].name, "guardNonNegative");
  assert.equal(dag.nodes[dag.nodes[root.args[1]].args[1]].name, "guardValid");
}

{
  const dag = parseFormula("x + 1", ["x"], { outputLabel: "f" });
  assert.equal(dag.nodes[dag.root].label, "f");
}

{
  const dag = parses("a = 1; b = a + 1");
  assert.equal(dag.nodes[dag.root].label, "b");
  assert.equal(dag.nodes.find((node) => node.label === "a").kind, "number");
  assert.equal(dag.nodes.find((node) => node.label === "b").kind, "binary");
}

{
  const dag = parses("a = x + 1\nb = a^2\nb + 3", ["x"]);
  assert.equal(dag.nodes.find((node) => node.label === "a").kind, "binary");
  assert.equal(dag.nodes.find((node) => node.label === "b").op, "^");
  assert.equal(dag.nodes[dag.root].kind, "binary");
  assert.equal(dag.nodes[dag.root].label, undefined);
}

{
  const dag = parses("a = max(\n  x,\n  2\n)\na", ["x"]);
  assert.equal(dag.nodes.find((node) => node.label === "a").name, "max");
  assert.equal(dag.nodes[dag.root].label, "a");
}

{
  const dag = parses("a = 1; b = 1");
  assert.notEqual(dag.nodes.find((node) => node.label === "a").id, dag.nodes.find((node) => node.label === "b").id);
}

assert.equal(isValidFormulaParameterName("i"), true);
assert.equal(isValidFormulaParameterName("sqrt"), false);
assert.equal(isValidFormulaParameterName("pi"), false);
assert.equal(isValidFormulaParameterName("x_1"), true);

rejects("2x", ["x"], "Unexpected token");
rejects("sin(x, y)", ["x", "y"], "exactly one argument");
rejects("atan2(x)", ["x"], "exactly 2 arguments");
rejects("guardValid(x)", ["x"], "exactly 2 arguments");
rejects("guardFinite(x, y)", ["x", "y"], "Unknown function");
rejects("fallback(x, y, 1)", ["x", "y"], "exactly 2 arguments");
rejects("max()", [], "at least one argument");
rejects("foo(x)", ["x"], "Unknown function");
rejects("x", [], "Unknown parameter");
rejects("b = a + 1; a = 1", [], "Unknown parameter");
rejects("a = 1; a = 2", [], "Duplicate assignment name");
rejects("x = 1", ["x"], "must not clash with parameter name");
rejects("Infinity", [], "Unknown parameter");
rejects("NaN", [], "Unknown parameter");
rejects("1e", [], "Expected exponent digits");
rejects("2**3", [], "Unexpected token");

assert.throws(() => parseFormula("x", ["x", "x"]), /Duplicate parameter name/);
assert.equal(parseFormula("x", ["x"], { outputLabel: "x" }).nodes.at(-1).label, "x");
assert.equal(parseFormula("x", ["x"], { outputLabel: "sqrt" }).nodes.at(-1).label, "sqrt");
assert.throws(() => parseFormula("a = 1", [], { outputLabel: "f" }), /conflicts with assigned root label/);

console.log("parser tests passed");
