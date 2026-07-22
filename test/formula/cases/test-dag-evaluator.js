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
import { appendPartialDerivatives } from "../../../src/core/formula/derivative.js";
import { createDagClosureEvaluator } from "../../../src/core/formula/dag-evaluator.js";
import { generateDagJsEvaluator } from "../../../src/core/formula/dag-js-generator.js";
import { generateDagWgslFunction } from "../../../src/core/formula/dag-wgsl-generator.js";
import { parseFormula } from "../../../src/core/formula/formula-parser.js";

function loadGeneratedJsEvaluator(dag, options) {
  const generated = generateDagJsEvaluator(dag, options);
  return {
    ...generated,
    evaluate: new Function(`${generated.code}\nreturn ${generated.functionName};`)(),
  };
}

function evaluateBoth(dag, params) {
  const interpret = createDagClosureEvaluator(dag);
  const generated = loadGeneratedJsEvaluator(dag).evaluate;
  return {
    interpreted: interpret(params),
    compiled: generated(params),
  };
}

function assertSameNumber(actual, expected) {
  if (Number.isNaN(expected)) {
    assert.equal(Number.isNaN(actual), true);
  } else {
    assert.equal(actual, expected);
  }
}

function assertSameOutputs(left, right) {
  assert.deepEqual(Object.keys(left).sort(), Object.keys(right).sort());
  for (const key of Object.keys(left)) assertSameNumber(left[key], right[key]);
}

{
  const dag = parseFormula("sin(x)^2 + cos(x)^2", ["x"], { outputLabel: "f" });
  const { interpreted, compiled } = evaluateBoth(dag, { x: 0.7 });

  assertSameOutputs(interpreted, compiled);
  assert.ok(Math.abs(compiled.f - 1) < 1e-12);
}

{
  const dag = parseFormula("atan2(y, x)", ["x", "y"], { outputLabel: "angle" });
  const { interpreted, compiled } = evaluateBoth(dag, { x: -1, y: 1 });

  assertSameOutputs(interpreted, compiled);
  assert.equal(compiled.angle, Math.atan2(1, -1));
}

{
  const dag = parseFormula("fallback(guardNonzero(x, 10), 42)", ["x"], { outputLabel: "value" });
  const compiled = loadGeneratedJsEvaluator(dag).evaluate;
  const interpreted = createDagClosureEvaluator(dag);

  assertSameOutputs(interpreted({ x: 0 }), compiled({ x: 0 }));
  assert.equal(compiled({ x: 0 }).value, 42);
  assert.equal(compiled({ x: 1 }).value, 10);
}

{
  const dag = parseFormula("fallback(guardNonNegative(x, 10), 42)", ["x"], { outputLabel: "value" });
  const compiled = loadGeneratedJsEvaluator(dag).evaluate;
  const interpreted = createDagClosureEvaluator(dag);

  assertSameOutputs(interpreted({ x: -1 }), compiled({ x: -1 }));
  assert.equal(compiled({ x: -1 }).value, 42);
  assert.equal(compiled({ x: 0 }).value, 10);
  assert.equal(compiled({ x: 1 }).value, 10);
}

{
  const dag = parseFormula("a = x + 1\nb = a^2", ["x"]);
  const { interpreted, compiled } = evaluateBoth(dag, { x: 2 });

  assertSameOutputs(interpreted, compiled);
  assert.equal(compiled.a, 3);
  assert.equal(compiled.b, 9);
}

{
  const dag = parseFormula("a = 1; b = a + 1", []);
  const interpreted = createDagClosureEvaluator(dag, { labels: ["b"] });
  const compiledResult = loadGeneratedJsEvaluator(dag, { labels: ["b"] });
  const compiled = compiledResult.evaluate;

  assert.deepEqual(compiledResult.labels, ["b"]);
  assert.equal(interpreted().b, 2);
  assert.equal(compiled().b, 2);
  assert.match(compiledResult.code, /output\["b"\] = v\d+;/);
  assert.doesNotMatch(compiledResult.code, /output\["a"\]/);
}

{
  const dag = parseFormula("x + 1", ["x"], { outputLabel: "__proto__" });
  const interpreted = createDagClosureEvaluator(dag)({ x: 2 });
  const compiled = loadGeneratedJsEvaluator(dag).evaluate({ x: 2 });
  assert.equal(Object.getPrototypeOf(interpreted), null);
  assert.equal(Object.getPrototypeOf(compiled), null);
  assert.equal(Object.hasOwn(interpreted, "__proto__"), true);
  assert.equal(Object.hasOwn(compiled, "__proto__"), true);
  assert.equal(interpreted.__proto__, 3);
  assert.equal(compiled.__proto__, 3);
}

{
  const dag = parseFormula("abs(x)", ["x"], { outputLabel: "f" });
  const result = appendPartialDerivatives(dag, {
    sourceLabel: "f",
    partials: [{ parameter: "x", label: "dfdx" }],
  });

  assertSameOutputs(
    createDagClosureEvaluator(result.dag)({ x: 2 }),
    loadGeneratedJsEvaluator(result.dag).evaluate({ x: 2 }),
  );
  assert.equal(loadGeneratedJsEvaluator(result.dag).evaluate({ x: 2 }).dfdx, 1);
  assert.equal(Number.isNaN(loadGeneratedJsEvaluator(result.dag).evaluate({ x: 0 }).dfdx), true);
}

{
  const dag = {
    root: 0,
    nodes: [
      { id: 0, kind: "parameter", name: "x" },
      { id: 1, kind: "number", value: 10, raw: "10" },
      { id: 2, kind: "call", name: "guardNonzero", args: [0, 1], label: "guarded" },
      { id: 3, kind: "number", value: 42, raw: "42" },
      { id: 4, kind: "call", name: "fallback", args: [2, 3], label: "fallback_value" },
      { id: 5, kind: "number", value: Infinity, raw: "Infinity" },
      { id: 6, kind: "call", name: "fallback", args: [5, 3], label: "infinity_fallback" },
      { id: 7, kind: "call", name: "guardValid", args: [5, 1], label: "infinity_is_invalid" },
      { id: 8, kind: "call", name: "guardValid", args: [0, 1], label: "x_is_valid" },
      { id: 9, kind: "binary", op: "/", args: [1, 0], label: "division_infinity_is_invalid" },
    ],
  };
  const compiled = loadGeneratedJsEvaluator(dag).evaluate;
  const interpreted = createDagClosureEvaluator(dag);

  const interpretedAtZero = interpreted({ x: 0 });
  const compiledAtZero = compiled({ x: 0 });
  for (const key of Object.keys(compiledAtZero)) {
    if (key === "division_infinity_is_invalid") continue;
    assertSameNumber(interpretedAtZero[key], compiledAtZero[key]);
  }
  assert.equal(Number.isNaN(compiled({ x: 0 }).guarded), true);
  assert.equal(compiled({ x: 0 }).fallback_value, 42);
  assert.equal(compiled({ x: 1 }).fallback_value, 10);
  assert.equal(compiled({ x: 0 }).infinity_fallback, 42);
  assert.equal(Number.isNaN(compiled({ x: 0 }).infinity_is_invalid), true);
  assert.equal(Number.isNaN(compiled({}).x_is_valid), true);
  assert.equal(compiled({ x: 0 }).x_is_valid, 10);
  assert.equal(Number.isNaN(compiled({ x: 0 }).division_infinity_is_invalid), true);
}

{
  const dag = parseFormula("fallback(guardNonNegative(x, exp(1000)), 7)", ["x"], { outputLabel: "value" });
  const compiled = loadGeneratedJsEvaluator(dag).evaluate;
  const interpreted = createDagClosureEvaluator(dag);

  assertSameOutputs(interpreted({ x: 1 }), compiled({ x: 1 }));
  assert.equal(compiled({ x: 1 }).value, 7);
}

{
  const dag = parseFormula("guardNonNegative(x, x)", ["x"], { outputLabel: "value" });
  const { code } = generateDagWgslFunction(dag, { parameters: [{ name: "x", range: [[-1, 1]] }], labels: ["value"] });

  assert.match(code, /w_guard_non_negative/);
  assert.doesNotMatch(code, /sat_by_sign|sat_by_positive/);
}

{
  const dag = parseFormula("$x + 1", ["$x"], { outputLabel: "$out" });
  const compiled = generateDagWgslFunction(dag, {
    functionName: "eval_dag",
    parameters: [{ name: "$x", range: [[4, 4]] }],
    labels: ["$out"],
  });

  assert.deepEqual(compiled.parameters, ["$x"]);
  assert.deepEqual(compiled.parameterRanges, { $x: [[4, 4]] });
  assert.deepEqual(compiled.labels, ["$out"]);
  assert.equal(compiled.parameterCount, 1);
  assert.equal(compiled.outputCount, 1);
  assert.match(compiled.code, /fn eval_dag\(input: array<f32, 1>\) -> array<W, 1>/);
  assert.match(compiled.code, /var v0: f32 = input\[0\];/);
  assert.match(compiled.code, /var v2: f32 = \(v0 \+ v1\);/);
  assert.match(compiled.code, /return array<W, 1>\(wrap\(v2\)\);/);
  assert.doesNotMatch(compiled.code, /\$x|\$out|@compute|@group|var<storage>/);
}

{
  const dag = parseFormula("x + y", ["x", "y"], { outputLabel: "f" });

  assert.throws(
    () => generateDagWgslFunction(dag, { parameters: [{ name: "x", range: [[0, 1]] }], labels: ["f"] }),
    /Missing WGSL parameter/,
  );
  assert.throws(
    () => generateDagWgslFunction(dag, { parameters: [{ name: "x", range: [[0, 1]] }, { name: "x", range: [[0, 1]] }, { name: "y", range: [[0, 1]] }], labels: ["f"] }),
    /Duplicate WGSL parameter/,
  );
  assert.throws(
    () => generateDagWgslFunction(dag, { parameters: [{ name: "x", range: [[0, 1]] }, { name: "y", range: [[0, 1]] }], labels: [] }),
    /at least one output/,
  );
  assert.throws(
    () => generateDagWgslFunction(dag, { parameters: [{ name: "x", range: [[0, 1]] }, { name: "y", range: [[0, 1]] }], labels: ["missing"] }),
    /Unknown WGSL label/,
  );
  assert.throws(
    () => generateDagWgslFunction(dag, { parameters: [{ name: "x", range: [[0, Infinity]] }, { name: "y", range: [[0, 1]] }], labels: ["f"] }),
    /finite numbers/,
  );
}

{
  const dag = parseFormula("1", [], { outputLabel: "one" });
  const compiled = generateDagWgslFunction(dag, {
    functionName: "const_dag",
    parameters: [],
    labels: ["one"],
  });

  assert.equal(compiled.parameterCount, 0);
  assert.match(compiled.code, /fn const_dag\(\) -> array<W, 1>/);
  assert.doesNotMatch(compiled.code, /input:/);
}

{
  const dag = parseFormula("guardNonNegative(x, x + 1)", ["x"], { outputLabel: "value" });
  const compiled = generateDagWgslFunction(dag, {
    parameters: [{ name: "x", range: [[0, 10]] }],
    labels: ["value"],
  });

  assert.doesNotMatch(compiled.code, /w_guard_non_negative/);
  assert.match(compiled.code, /var v3: f32 = v2;/);
  assert.match(compiled.code, /return array<W, 1>\(wrap\(v3\)\);/);
}

{
  const dag = parseFormula("fallback(x + 1, 42)", ["x"], { outputLabel: "value" });
  const compiled = generateDagWgslFunction(dag, {
    parameters: [{ name: "x", range: [[0, 10]] }],
    labels: ["value"],
  });

  assert.doesNotMatch(compiled.code, /w_fallback/);
  assert.match(compiled.code, /var v4: f32 = v2;/);
}

{
  const dag = parseFormula("fallback(guardNonzero(x, 10), 42)", ["x"], { outputLabel: "value" });
  const compiled = generateDagWgslFunction(dag, {
    parameters: [{ name: "x", range: [[0, 1]] }],
    labels: ["value"],
  });

  assert.match(compiled.code, /w_guard_nonzero/);
  assert.match(compiled.code, /w_fallback/);
}

{
  const dag = parseFormula("$x + 1", ["$x"], { outputLabel: "$out" });
  const params = { $x: 4 };
  const compiledResult = loadGeneratedJsEvaluator(dag);
  const compiled = compiledResult.evaluate;
  const interpreted = createDagClosureEvaluator(dag);

  assert.match(compiledResult.runtimeCode, /function guardNonzero/);
  assert.match(compiledResult.functionCode, /function evaluateDag\(params = Object\.create\(null\)\)/);
  assert.match(compiledResult.code, /output\["\$out"\] = v2;/);
  assert.equal(compiled(params).$out, 5);
  assert.equal(interpreted(params).$out, 5);
}

{
  const dag = parseFormula("x + y", ["x", "y"], { outputLabel: "f" });

  assert.throws(
    () => generateDagJsEvaluator(dag, { labels: ["missing"] }),
    /Unknown label/,
  );
  assert.throws(
    () => createDagClosureEvaluator(dag, { labels: ["f", "f"] }),
    /Duplicate label/,
  );
}

console.log("dag evaluator tests passed");
