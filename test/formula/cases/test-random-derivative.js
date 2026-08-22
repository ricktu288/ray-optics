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
import { generateDagJsEvaluator } from "../../../src/core/formula/dag-js-generator.js";
import { parseFormula } from "../../../src/core/formula/formula-parser.js";

const rng = createRng(0x5eed1234);
const parameters = ["x", "y"];
const h = 1e-5;
let checked = 0;

for (let index = 0; index < 80; index += 1) {
  const expression = randomExpression(3);
  const parameter = choose(parameters);
  const point = randomPoint();
  const dag = parseFormula(expression, parameters, { outputLabel: "f" });
  const result = appendPartialDerivatives(dag, {
    sourceLabel: "f",
    partials: [{ parameter, label: "dfdp" }],
  });
  assert.deepEqual(result.errors, [], expression);

  const evaluate = loadGeneratedJsEvaluator(result.dag).evaluate;
  const center = evaluate(point);
  const left = evaluate({ ...point, [parameter]: point[parameter] - h });
  const right = evaluate({ ...point, [parameter]: point[parameter] + h });
  const symbolic = center.dfdp;
  const numerical = (right.f - left.f) / (2 * h);

  if (!isComparable(symbolic, numerical, left.f, right.f)) continue;

  const tolerance = 2e-4 * Math.max(1, Math.abs(symbolic), Math.abs(numerical));
  assert.ok(
    Math.abs(symbolic - numerical) <= tolerance,
    [
      `expression: ${expression}`,
      `parameter: ${parameter}`,
      `point: ${JSON.stringify(point)}`,
      `symbolic: ${symbolic}`,
      `numerical: ${numerical}`,
      `tolerance: ${tolerance}`,
    ].join("\n"),
  );
  checked += 1;
}

function loadGeneratedJsEvaluator(dag, options) {
  const generated = generateDagJsEvaluator(dag, options);
  return {
    ...generated,
    evaluate: new Function(`${generated.code}\nreturn ${generated.functionName};`)(),
  };
}

assert.ok(checked >= 40, `expected at least 40 stable random checks, got ${checked}`);

console.log(`random derivative tests passed (${checked} checks)`);

function randomExpression(depth) {
  if (depth <= 0) return randomLeaf();

  const choice = randomInt(12);
  if (choice === 0) return `sin(${randomExpression(depth - 1)})`;
  if (choice === 1) return `cos(${randomExpression(depth - 1)})`;
  if (choice === 2) return `exp((${randomExpression(depth - 1)}) / 5)`;
  if (choice === 3) return `log(abs(${randomExpression(depth - 1)}) + 1)`;
  if (choice === 4) return `abs(${randomExpression(depth - 1)})`;
  if (choice === 5) return `floor(${randomExpression(depth - 1)})`;
  if (choice === 6) return `max(${randomExpression(depth - 1)}, ${randomExpression(depth - 1)})`;
  if (choice === 7) return `min(${randomExpression(depth - 1)}, ${randomExpression(depth - 1)})`;
  if (choice === 8) return `((${randomExpression(depth - 1)}) + (${randomExpression(depth - 1)}))`;
  if (choice === 9) return `((${randomExpression(depth - 1)}) - (${randomExpression(depth - 1)}))`;
  if (choice === 10) return `((${randomExpression(depth - 1)}) * (${randomExpression(depth - 1)}))`;
  return `((${randomExpression(depth - 1)}) / (abs(${randomExpression(depth - 1)}) + 1))`;
}

function randomLeaf() {
  const choice = randomInt(5);
  if (choice === 0) return "x";
  if (choice === 1) return "y";
  return String([1, 2, 3][randomInt(3)]);
}

function randomPoint() {
  return {
    x: randomCoordinate(),
    y: randomCoordinate(),
  };
}

function randomCoordinate() {
  const value = -2 + 4 * rng();
  if (Math.abs(value) < 0.2) return value < 0 ? value - 0.2 : value + 0.2;
  return value;
}

function isComparable(...values) {
  return values.every((value) => Number.isFinite(value));
}

function choose(items) {
  return items[randomInt(items.length)];
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
