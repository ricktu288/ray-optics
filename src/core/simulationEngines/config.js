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
  minimumRayPower: 1e-6,
  bvh: COMMON_BVH_CONFIG,
});

/**
 * Default global tuning values for each primitive-based simulation engine.
 * Stored user preferences contain only values which override these defaults.
 */
export const DEFAULT_SIMULATION_ENGINE_CONFIGS = Object.freeze({
  primitiveCpu: Object.freeze({
    ...COMMON_PRIMITIVE_ENGINE_CONFIG,
  }),
  webgpu: Object.freeze({
    ...COMMON_PRIMITIVE_ENGINE_CONFIG,
    workgroupSize: 64,
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
