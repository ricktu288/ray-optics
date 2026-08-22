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

import { DEFAULT_BVH_OPTIONS } from '../primitive/bvh.js';
import {
  DEFAULT_AMBIGUOUS_RAY_WARNING_SAFETY_FACTOR
} from './ambiguousRayWarning.js';
// Read-only trace tables share one packed scene binding. The tracing
// megakernel uses seven storage bindings, while its combined source-emission
// and initial-membership pipeline uses eight: the WebGPU guaranteed default.
export const WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE = 8;

export const DEFAULT_PRIMITIVE_NUMERICAL_TOLERANCES = Object.freeze({
  curveEndpoint: 0,
  interactionMerging: 1e-6,
  interactionNormal: 1e-6,
  forwardDistance: 1e-6,
});

const COMMON_BVH_CONFIG = Object.freeze({
  lineLeafSize: DEFAULT_BVH_OPTIONS.lineLeafSize,
  arcLeafSize: DEFAULT_BVH_OPTIONS.arcLeafSize,
  cubicBezierLeafSize: DEFAULT_BVH_OPTIONS.cubicBezierLeafSize,
  directPrimitiveThreshold: DEFAULT_BVH_OPTIONS.directPrimitiveThreshold,
  consecutiveLocalityFactor: DEFAULT_BVH_OPTIONS.consecutiveLocalityFactor,
  maxGroupExtent: DEFAULT_BVH_OPTIONS.maxGroupExtent,
  drawBounds: false,
});

export const DEFAULT_PRIMITIVE_SIMULATOR_CONFIG = Object.freeze({
  logDebugInfo: false,
  bvh: COMMON_BVH_CONFIG,
  numericalTolerances: DEFAULT_PRIMITIVE_NUMERICAL_TOLERANCES,
});

const COMMON_PRIMITIVE_ENGINE_CONFIG = Object.freeze({
  ambiguousRayWarningSafetyFactor:
    DEFAULT_AMBIGUOUS_RAY_WARNING_SAFETY_FACTOR,
});

/**
 * Default global tuning values for each primitive-based simulation engine.
 * Stored user preferences contain only values which override these defaults.
 */
export const DEFAULT_SIMULATION_ENGINE_CONFIGS = Object.freeze({
  primitiveCpu: Object.freeze({
    ...COMMON_PRIMITIVE_ENGINE_CONFIG,
    timeBudgetMs: 200,
    maxLocalIterations: 256,
  }),
  webgpu: Object.freeze({
    ...COMMON_PRIMITIVE_ENGINE_CONFIG,
    workgroupSize: 64,
    maxBatchRayEvents: 1048576,
    maxReadyGeometryRecords: 2097152,
    atomicFixedPointScale: 1048576,
    maxBvhDepth: 16,
    maxLocalIterations: 256,
    maxPingPongsPerSubmission: 2,
  }),
});

/**
 * Resolve one engine's defaults with its stored global overrides.
 *
 * @param {string} engineKind - Simulation engine kind.
 * @param {Object<string, Object>} [storedConfigs={}] - Per-engine overrides.
 * @returns {Object} Resolved configuration for the engine.
 */
export function resolveSimulationEngineConfig(engineKind, storedConfigs = {}) {
  const defaults = DEFAULT_SIMULATION_ENGINE_CONFIGS[engineKind] ?? {};
  const overrides = storedConfigs?.[engineKind];
  return resolveKnownOverrides(defaults, overrides);
}

/**
 * Resolve preprocessing and diagnostic settings shared by all primitive
 * engines. They live outside engine-specific configuration so automatic
 * selection never changes the BVH construction policy.
 */
export function resolvePrimitiveSimulatorConfig(storedConfigs = {}) {
  const overrides = storedConfigs?.primitive;
  const resolvedOverrides =
    overrides && typeof overrides === 'object' ? overrides : {};
  const bvhOverrides =
    resolvedOverrides.bvh && typeof resolvedOverrides.bvh === 'object'
      ? resolvedOverrides.bvh
      : {};
  const numericalToleranceOverrides =
    resolvedOverrides.numericalTolerances &&
      typeof resolvedOverrides.numericalTolerances === 'object'
      ? resolvedOverrides.numericalTolerances
      : {};
  return {
    ...resolveKnownOverrides(
      DEFAULT_PRIMITIVE_SIMULATOR_CONFIG,
      resolvedOverrides
    ),
    bvh: resolveKnownOverrides(
      DEFAULT_PRIMITIVE_SIMULATOR_CONFIG.bvh,
      bvhOverrides
    ),
    numericalTolerances: resolveKnownOverrides(
      DEFAULT_PRIMITIVE_SIMULATOR_CONFIG.numericalTolerances,
      numericalToleranceOverrides
    ),
  };
}

function resolveKnownOverrides(defaults, overrides) {
  const resolved = { ...defaults };
  if (!overrides || typeof overrides !== 'object') return resolved;
  for (const name of Object.keys(defaults)) {
    if (overrides[name] !== undefined) resolved[name] = overrides[name];
  }
  return resolved;
}
