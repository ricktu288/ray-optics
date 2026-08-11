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

const COMMON_BVH_CONFIG = Object.freeze({
  lineLeafSize: DEFAULT_BVH_OPTIONS.lineLeafSize,
  arcLeafSize: DEFAULT_BVH_OPTIONS.arcLeafSize,
  cubicBezierLeafSize: DEFAULT_BVH_OPTIONS.cubicBezierLeafSize,
  directPrimitiveThreshold: DEFAULT_BVH_OPTIONS.directPrimitiveThreshold,
  consecutiveLocalityFactor: DEFAULT_BVH_OPTIONS.consecutiveLocalityFactor,
  maxGroupExtent: DEFAULT_BVH_OPTIONS.maxGroupExtent,
  drawBounds: false,
});

const COMMON_PRIMITIVE_ENGINE_CONFIG = Object.freeze({
  logDebugInfo: false,
  ambiguousRayWarningSafetyFactor:
    DEFAULT_AMBIGUOUS_RAY_WARNING_SAFETY_FACTOR,
  bvh: COMMON_BVH_CONFIG,
});

// Provisional Intel Xe-LPG calibration from the standalone multi-bounce
// ray-cooperation benchmark's production-supported scalar/workgroup methods.
// Experimental subgroup results are excluded. These remain hidden tuning
// values until a per-adapter calibration path is available.
export const DEFAULT_WEBGPU_RAY_COOPERATION_CONFIG = Object.freeze({
  rayCooperationEnabled: true,
  rayCooperationSaturationRayCount: 8192,
  rayCooperationDirectMaxTestsPerLane: 512,
  rayCooperationMaximumLanesPerRay: 32,
  rayCooperationMaximumHaloFraction: 0.5,
});

/**
 * Default global tuning values for each primitive-based simulation engine.
 * Stored user preferences contain only values which override these defaults.
 */
export const DEFAULT_SIMULATION_ENGINE_CONFIGS = Object.freeze({
  primitiveCpu: Object.freeze({
    ...COMMON_PRIMITIVE_ENGINE_CONFIG,
    maxLocalIterations: 128,
  }),
  webgpu: Object.freeze({
    ...COMMON_PRIMITIVE_ENGINE_CONFIG,
    workgroupSize: 64,
    ...DEFAULT_WEBGPU_RAY_COOPERATION_CONFIG,
    maxBatchRayEvents: 1048576,
    maxReadyLineRecords: 1048576,
    maxReadyPointRecords: 1048576,
    maxLocalIterations: 128,
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
  const resolvedOverrides =
    overrides && typeof overrides === 'object' ? overrides : {};
  const bvhOverrides =
    resolvedOverrides.bvh && typeof resolvedOverrides.bvh === 'object'
      ? resolvedOverrides.bvh
      : {};
  return {
    ...defaults,
    ...resolvedOverrides,
    bvh: {
      ...(defaults.bvh ?? {}),
      ...bvhOverrides,
    },
  };
}
