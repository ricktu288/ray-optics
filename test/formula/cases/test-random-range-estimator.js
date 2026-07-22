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
import { createDagClosureEvaluator } from "../../../src/core/formula/dag-evaluator.js";
import { parseFormula } from "../../../src/core/formula/formula-parser.js";
import { estimateDagRanges } from "../../../src/core/formula/range-estimator.js";

const rng = createRng(0x7a6e9e57);
const parameters = ["x", "y"];
const samplesPerExpression = 30;
let checked = 0;

for (let index = 0; index < 100; index += 1) {
  const expression = randomExpression(3);
  const parameterRanges = randomParameterRanges();
  const dag = parseFormula(expression, parameters, { outputLabel: "f" });
  const range = estimateDagRanges(dag, parameterRanges).nodeRanges[dag.root];
  const evaluate = createDagClosureEvaluator(dag);

  for (let sample = 0; sample < samplesPerExpression; sample += 1) {
    const point = randomPoint(parameterRanges);
    const value = evaluate(point).f;
    if (Number.isNaN(value)) {
      assert.equal(range.maybeInvalid, true, failureMessage(expression, parameterRanges, point, range, value));
      continue;
    }

    assert.equal(
      covers(range, value),
      true,
      failureMessage(expression, parameterRanges, point, range, value),
    );
    checked += 1;
  }
}

assert.ok(checked >= 2500, `expected at least 2500 finite random range checks, got ${checked}`);

console.log(`random range estimator tests passed (${checked} checks)`);

function randomExpression(depth) {
  if (depth <= 0) return randomLeaf();

  const choice = randomInt(13);
  if (choice === 0) return `sin(${randomExpression(depth - 1)})`;
  if (choice === 1) return `cos(${randomExpression(depth - 1)})`;
  if (choice === 2) return `exp((${randomExpression(depth - 1)}) / 6)`;
  if (choice === 3) return `log(abs(${randomExpression(depth - 1)}) + 1)`;
  if (choice === 4) return `abs(${randomExpression(depth - 1)})`;
  if (choice === 5) return `floor(${randomExpression(depth - 1)})`;
  if (choice === 6) return `round(${randomExpression(depth - 1)})`;
  if (choice === 7) return `max(${randomExpression(depth - 1)}, ${randomExpression(depth - 1)})`;
  if (choice === 8) return `min(${randomExpression(depth - 1)}, ${randomExpression(depth - 1)})`;
  if (choice === 9) return `((${randomExpression(depth - 1)}) + (${randomExpression(depth - 1)}))`;
  if (choice === 10) return `((${randomExpression(depth - 1)}) - (${randomExpression(depth - 1)}))`;
  if (choice === 11) return `((${randomExpression(depth - 1)}) * (${randomExpression(depth - 1)}))`;
  return `((${randomExpression(depth - 1)}) / (abs(${randomExpression(depth - 1)}) + 1))`;
}

function randomLeaf() {
  const choice = randomInt(5);
  if (choice === 0) return "x";
  if (choice === 1) return "y";
  return String([-2, -1, 0, 1, 2][randomInt(5)]);
}

function randomParameterRanges() {
  return Object.fromEntries(parameters.map((parameter) => [parameter, randomIntervalUnion()]));
}

function randomIntervalUnion() {
  if (rng() < 0.35) {
    const left = sortedPair(randomCoordinate(), randomCoordinate());
    const right = sortedPair(randomCoordinate(), randomCoordinate());
    const gap = 0.15 + rng() * 0.5;
    return left[1] < right[0]
      ? [left, [Math.max(right[0], left[1] + gap), right[1]]].filter(([lo, hi]) => lo <= hi)
      : [right, [Math.max(left[0], right[1] + gap), left[1]]].filter(([lo, hi]) => lo <= hi);
  }
  return [sortedPair(randomCoordinate(), randomCoordinate())];
}

function randomPoint(parameterRanges) {
  return Object.fromEntries(parameters.map((parameter) => [parameter, randomValue(parameterRanges[parameter])]));
}

function randomValue(intervals) {
  const [lo, hi] = intervals[randomInt(intervals.length)];
  return Math.fround(lo + (hi - lo) * rng());
}

function randomCoordinate() {
  return Math.fround(-2 + 4 * rng());
}

function sortedPair(a, b) {
  return a <= b ? [a, b] : [b, a];
}

function covers(range, value) {
  return range.intervals.some(([lo, hi]) => lo <= value && value <= hi);
}

function failureMessage(expression, parameterRanges, point, range, value) {
  return [
    `expression: ${expression}`,
    `parameterRanges: ${JSON.stringify(parameterRanges)}`,
    `point: ${JSON.stringify(point)}`,
    `range: ${JSON.stringify(range)}`,
    `value: ${value}`,
  ].join("\n");
}

function randomInt(max) {
  return Math.floor(rng() * max);
}

function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
