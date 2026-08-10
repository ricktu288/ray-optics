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
  getIntersectionTolerancePolicy,
  validateNumericEpsilon
} from '../primitive/numeric.js';

// This is deliberately a hidden calibration value. It covers two endpoints,
// coordinate-to-parameter error, and ordinary variation in scene geometry.
export const DEFAULT_AMBIGUOUS_RAY_WARNING_SAFETY_FACTOR = 32;

/**
 * Estimate ambiguous power that can arise naturally from rays landing within
 * floating-point endpoint uncertainty. Sources are assumed to have total
 * power of order one, matching the default source normalization.
 */
export function estimateAmbiguousRayWarningPowerThreshold({
  numericEpsilon,
  processedRayCount,
  description,
  safetyFactor = DEFAULT_AMBIGUOUS_RAY_WARNING_SAFETY_FACTOR
}) {
  const epsilon = validateNumericEpsilon(numericEpsilon);
  if (!Number.isFinite(safetyFactor) || safetyFactor < 0) {
    throw new RangeError(
      'ambiguousRayWarningSafetyFactor must be finite and nonnegative.'
    );
  }
  const sources = Array.isArray(description?.sources)
    ? description.sources
    : [];
  const sourceCount = sources.length;
  if (sourceCount === 0 || safetyFactor === 0) return 0;
  const sourceRayCount = sources.reduce((sum, source) =>
    sum + Math.max(0, Number(source?.rayCount) || 0), 0);
  const processed = Number.isFinite(processedRayCount)
    ? Math.max(0, processedRayCount)
    : 0;
  const interactionPowerEstimate = sourceCount * Math.max(
    1,
    sourceRayCount > 0 ? processed / sourceRayCount : 1
  );
  return safetyFactor *
    getIntersectionTolerancePolicy(epsilon).parameter *
    interactionPowerEstimate;
}
