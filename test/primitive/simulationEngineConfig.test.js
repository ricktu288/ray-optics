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
  DEFAULT_PRIMITIVE_SIMULATOR_CONFIG,
  DEFAULT_SIMULATION_ENGINE_CONFIGS,
  WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE,
  resolvePrimitiveSimulatorConfig,
  resolveSimulationEngineConfig
} from '../../src/core/simulationEngines/config';
import {
  estimateAmbiguousRayWarningPowerThreshold
} from '../../src/core/simulationEngines/ambiguousRayWarning';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric';
import {
  BVH_ARC_LEAF_SIZE,
  BVH_CONSECUTIVE_LOCALITY_FACTOR,
  BVH_CUBIC_BEZIER_LEAF_SIZE,
  BVH_DIRECT_PRIMITIVE_THRESHOLD,
  BVH_LINE_LEAF_SIZE,
  BVH_MAX_GROUP_EXTENT
} from '../../src/core/primitive/bvh';

describe('simulation engine configuration', () => {
  it('uses the megakernel WebGPU storage-buffer requirement', () => {
    expect(WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE).toBe(8);
  });

  it('uses the same default local interaction batch on CPU and WebGPU', () => {
    expect(DEFAULT_SIMULATION_ENGINE_CONFIGS.primitiveCpu.maxLocalIterations)
      .toBe(256);
    expect(DEFAULT_SIMULATION_ENGINE_CONFIGS.webgpu.maxLocalIterations)
      .toBe(256);
  });

  it('provides configurable scheduling, capacity, and atomic defaults', () => {
    expect(DEFAULT_SIMULATION_ENGINE_CONFIGS.primitiveCpu.timeBudgetMs)
      .toBe(200);
    const webgpu = DEFAULT_SIMULATION_ENGINE_CONFIGS.webgpu;
    expect(webgpu.maxBvhDepth).toBeUndefined();
    expect(webgpu.maxBatchRayEvents).toBe(1048576);
    expect(webgpu.maxReadyGeometryRecords).toBe(2097152);
    expect(webgpu.atomicFixedPointScale).toBe(1048576);
  });

  it('keeps ambiguous-power warning calibration hidden and shared', () => {
    expect(
      DEFAULT_SIMULATION_ENGINE_CONFIGS.primitiveCpu
        .ambiguousRayWarningSafetyFactor
    ).toBe(32);
    expect(
      DEFAULT_SIMULATION_ENGINE_CONFIGS.webgpu
        .ambiguousRayWarningSafetyFactor
    ).toBe(32);
  });

  it('estimates precision-dependent box-corner ambiguity power', () => {
    const description = { sources: [{ rayCount: 1000000 }] };
    const estimate = numericEpsilon =>
      estimateAmbiguousRayWarningPowerThreshold({
        numericEpsilon,
        processedRayCount: 8000000,
        description,
        safetyFactor: 32
      });

    expect(estimate(FLOAT32_EPSILON)).toBeCloseTo(0.000976566, 8);
    expect(estimate(Number.EPSILON)).toBeCloseTo(1.818989e-12, 17);
  });

  it('keeps the BVH construction policy in named builder constants', () => {
    expect(BVH_LINE_LEAF_SIZE).toBe(4);
    expect(BVH_ARC_LEAF_SIZE).toBe(2);
    expect(BVH_CUBIC_BEZIER_LEAF_SIZE).toBe(1);
    expect(BVH_DIRECT_PRIMITIVE_THRESHOLD).toBe(32);
    expect(BVH_MAX_GROUP_EXTENT).toBe(100);
    expect(BVH_CONSECUTIVE_LOCALITY_FACTOR).toBe(2);
    expect(DEFAULT_PRIMITIVE_SIMULATOR_CONFIG.bvh).toBeUndefined();
    expect(DEFAULT_SIMULATION_ENGINE_CONFIGS.primitiveCpu.bvh).toBeUndefined();
    expect(DEFAULT_SIMULATION_ENGINE_CONFIGS.webgpu.bvh).toBeUndefined();
  });

  it('keeps geometric tolerances in flexible simulator configuration', () => {
    expect(DEFAULT_PRIMITIVE_SIMULATOR_CONFIG.numericalTolerances)
      .toEqual({
        curveEndpoint: 0,
        interactionMerging: 1e-6,
        interactionNormal: 1e-6,
        forwardDistance: 1e-6
      });
    expect(resolvePrimitiveSimulatorConfig({
      primitive: {
        numericalTolerances: { interactionMerging: 0.002 }
      }
    }).numericalTolerances).toEqual({
      curveEndpoint: 0,
      interactionMerging: 0.002,
      interactionNormal: 1e-6,
      forwardDistance: 1e-6
    });
  });

  it('ignores removed primitive simulator settings', () => {
    const resolved = resolvePrimitiveSimulatorConfig({
      primitive: {
        bvh: { directPrimitiveThreshold: 0 },
        logDebugInfo: true
      }
    });

    expect(resolved.bvh).toBeUndefined();
    expect(resolved.logDebugInfo).toBeUndefined();
  });

  it('resolves engine tuning independently of shared preprocessing', () => {
    const resolved = resolveSimulationEngineConfig('primitiveCpu', {
      primitiveCpu: { maxLocalIterations: 7 }
    });
    expect(resolved.maxLocalIterations).toBe(7);
    expect(resolved.bvh).toBeUndefined();
  });

  it('does not pass undeclared settings through to an engine', () => {
    const resolved = resolveSimulationEngineConfig('webgpu', {
      webgpu: { unknownSetting: 7 }
    });
    expect(resolved.unknownSetting).toBeUndefined();
  });
});
