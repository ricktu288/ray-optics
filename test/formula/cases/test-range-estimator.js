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
import { parseFormula } from "../../../src/core/formula/formula-parser.js";
import { estimateDagRanges, F32_MAX } from "../../../src/core/formula/range-estimator.js";

function rootRange(expression, parameters, parameterRanges) {
  const dag = parseFormula(expression, parameters, { outputLabel: "f" });
  return estimateDagRanges(dag, parameterRanges).nodeRanges[dag.root];
}

function assertCovers(range, value) {
  assert.equal(
    range.intervals.some(([lo, hi]) => lo <= value && value <= hi),
    true,
    `${JSON.stringify(range)} should cover ${value}`,
  );
}

function assertDoesNotCover(range, value) {
  assert.equal(
    range.intervals.some(([lo, hi]) => lo <= value && value <= hi),
    false,
    `${JSON.stringify(range)} should not cover ${value}`,
  );
}

{
  const range = rootRange("x + 1", ["x"], { x: [[2, 2]] });
  assert.equal(range.maybeInvalid, false);
  assert.deepEqual(range.intervals, [[3, 3]]);
}

{
  const range = rootRange("x / y", ["x", "y"], { x: [[1, 2]], y: [[-1, 1]] });
  assert.equal(range.maybeInvalid, true);
  assertCovers(range, -2);
  assertCovers(range, 2);
}

{
  const range = rootRange("sqrt(x)", ["x"], { x: [[-1, 4]] });
  assert.equal(range.maybeInvalid, true);
  assertCovers(range, 0);
  assertCovers(range, 2);
}

{
  const range = rootRange("fallback(guardNonzero(x, 10), 42)", ["x"], { x: [[0, 1]] });
  assert.equal(range.maybeInvalid, false);
  assertCovers(range, 10);
  assertCovers(range, 42);
}

{
  const range = rootRange("exp(x)", ["x"], { x: [[1000, 1000]] });
  assert.equal(range.maybeInvalid, true);
  assertCovers(range, F32_MAX);
}

{
  const range = rootRange("sin(x)", ["x"], { x: [[0, Math.PI * 2]] });
  assert.equal(range.maybeInvalid, false);
  assertCovers(range, -1);
  assertCovers(range, 1);
}

{
  const range = rootRange("max(a, b)", ["a", "b"], { a: [[0, 0], [1, 1]], b: [[0, 0]] });
  assert.equal(range.maybeInvalid, false);
  assert.deepEqual(range.intervals, [[0, 0], [1, 1]]);
}

{
  const range = rootRange("min(a, b)", ["a", "b"], { a: [[0, 0]], b: [[0, 0], [1, 1]] });
  assert.equal(range.maybeInvalid, false);
  assert.deepEqual(range.intervals, [[0, 0]]);
}

{
  const range = rootRange("atan2(y, x)", ["x", "y"], { x: [[-1, 1]], y: [[0.001, 1]] });
  assert.equal(range.maybeInvalid, false);
  assertCovers(range, Math.atan2(0.001, 1));
  assertCovers(range, Math.atan2(1, -1));
  assertDoesNotCover(range, -0.1);
  assertDoesNotCover(range, Math.PI);
}

{
  const range = rootRange("atan2(y, x)", ["x", "y"], { x: [[0, 1]], y: [[-1, 1]] });
  assert.equal(range.maybeInvalid, true);
  assertCovers(range, -Math.PI / 2);
  assertCovers(range, Math.PI / 2);
  assertDoesNotCover(range, Math.PI);
}

{
  const range = rootRange("atan2(y, x)", ["x", "y"], { x: [[-1, -0.5]], y: [[-1, 1]] });
  assert.equal(range.maybeInvalid, false);
  assert.equal(range.intervals.length, 2);
  assertCovers(range, Math.PI);
  assertCovers(range, -Math.PI + 0.5);
  assertDoesNotCover(range, 0);
}

assert.throws(
  () => rootRange("x", ["x"], { x: [[0, Infinity]] }),
  /finite numbers/,
);

console.log("range estimator tests passed");
