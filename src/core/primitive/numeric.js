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

/**
 * Relative spacing of IEEE 754 binary32 values around 1.
 */
export const FLOAT32_EPSILON = 2 ** -23;

/**
 * Require an engine-supplied relative arithmetic epsilon.
 *
 * @param {number} numericEpsilon
 * @param {string} [name='numericEpsilon']
 * @returns {number}
 */
export function validateNumericEpsilon(
  numericEpsilon,
  name = 'numericEpsilon'
) {
  if (!Number.isFinite(numericEpsilon) || numericEpsilon <= 0) {
    throw new RangeError(`${name} must be positive and finite.`);
  }
  return numericEpsilon;
}

/**
 * Return the standard accumulated relative rounding-error bound for a
 * sequence of elementary operations.
 *
 * @param {number} operationCount - Positive integer upper bound on the number of rounded operations.
 * @param {number} numericEpsilon - Relative arithmetic epsilon selected by the engine.
 * @returns {number}
 */
export function getRoundingErrorFactor(operationCount, numericEpsilon) {
  validateNumericEpsilon(numericEpsilon);
  if (!Number.isInteger(operationCount) || operationCount <= 0) {
    throw new RangeError('operationCount must be a positive integer.');
  }
  const accumulatedEpsilon = operationCount * numericEpsilon;
  if (!(accumulatedEpsilon < 1)) {
    throw new RangeError(
      'operationCount * numericEpsilon must be less than 1.'
    );
  }
  return accumulatedEpsilon / (1 - accumulatedEpsilon);
}
