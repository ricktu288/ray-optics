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

import assert from 'node:assert/strict';
import { createDagClosureEvaluator } from '../../../src/core/formula/dag-evaluator.js';
import { parseFormula } from '../../../src/core/formula/formula-parser.js';
import { substituteDagParameters } from '../../../src/core/formula/substitution.js';

const original = parseFormula(
  'sum = x + y; product = x * y',
  ['x', 'y']
);
const shifted = substituteDagParameters(original, {
  x: parseFormula('x - x_0', ['x', 'x_0']),
  y: parseFormula('y - y_0', ['y', 'y_0'])
});
const evaluate = createDagClosureEvaluator(shifted);

assert.deepEqual(
  { ...evaluate({ x: 5, y: 7, x_0: 2, y_0: 3 }) },
  { sum: 7, product: 12 }
);
assert.equal(original.nodes.some(node => node.name === 'x_0'), false);
assert.throws(
  () => substituteDagParameters(original, {
    x: parseFormula('shift = x - x_0', ['x', 'x_0'])
  }),
  /must not contain labeled nodes/
);

console.log('substitution tests passed');
