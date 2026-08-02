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

const PARAMETER_ERROR_OPERATION_COUNT = 32;
const TANGENT_ERROR_OPERATION_COUNT = 32;
const CUBIC_VALUE_ERROR_OPERATION_COUNT = 64;
const MERGING_DISTANCE_ERROR_OPERATION_COUNT = 64;
const INTERACTION_NORMAL_ERROR_OPERATION_COUNT = 64;
const intersectionTolerancePolicyCache = new Map();

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

/**
 * Return the immutable, epsilon-dependent portion of curve-intersection
 * tolerances. Runtime coordinate, curve, and ray scales are deliberately
 * applied by the intersection routines rather than stored here.
 *
 * Policies are cached by epsilon so direct callers and engine-owned contexts
 * share the same object instead of rebuilding it for every tested curve.
 *
 * @param {number} numericEpsilon
 * @returns {{numericEpsilon: number, parameter: number, tangent: number, cubicValue: number, mergingDistance: number, interactionNormal: number, rootRefinementSteps: number}}
 */
export function getIntersectionTolerancePolicy(numericEpsilon) {
  validateNumericEpsilon(numericEpsilon);
  const cached = intersectionTolerancePolicyCache.get(numericEpsilon);
  if (cached) return cached;

  const parameter = getRoundingErrorFactor(
    PARAMETER_ERROR_OPERATION_COUNT,
    numericEpsilon
  );
  const policy = Object.freeze({
    numericEpsilon,
    parameter,
    tangent: getRoundingErrorFactor(
      TANGENT_ERROR_OPERATION_COUNT,
      numericEpsilon
    ),
    cubicValue: getRoundingErrorFactor(
      CUBIC_VALUE_ERROR_OPERATION_COUNT,
      numericEpsilon
    ),
    mergingDistance: getRoundingErrorFactor(
      MERGING_DISTANCE_ERROR_OPERATION_COUNT,
      numericEpsilon
    ),
    interactionNormal: getRoundingErrorFactor(
      INTERACTION_NORMAL_ERROR_OPERATION_COUNT,
      numericEpsilon
    ),
    rootRefinementSteps: Math.max(
      1,
      Math.ceil(-Math.log2(parameter)) + 1
    )
  });
  intersectionTolerancePolicyCache.set(numericEpsilon, policy);
  return policy;
}
