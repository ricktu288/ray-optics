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
    expect(webgpu.maxBvhDepth).toBe(16);
    expect(webgpu.maxBatchRayEvents).toBe(1048576);
    expect(webgpu.maxReadyLineRecords).toBe(1048576);
    expect(webgpu.maxReadyPointRecords).toBe(1048576);
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

  it('provides one shared BVH construction policy', () => {
    expect(DEFAULT_PRIMITIVE_SIMULATOR_CONFIG.bvh.directPrimitiveThreshold)
      .toBe(32);
    expect(DEFAULT_SIMULATION_ENGINE_CONFIGS.primitiveCpu.bvh).toBeUndefined();
    expect(DEFAULT_SIMULATION_ENGINE_CONFIGS.webgpu.bvh).toBeUndefined();
  });

  it('provides a single automatic engine-selection crossover', () => {
    expect(DEFAULT_PRIMITIVE_SIMULATOR_CONFIG.engineSelection).toEqual({
      webGpuWorkloadThreshold: 1024
    });
  });

  it('resolves a stored direct primitive threshold override', () => {
    const resolved = resolvePrimitiveSimulatorConfig({
      primitive: {
        bvh: {
          directPrimitiveThreshold: 0
        }
      }
    });

    expect(resolved.bvh.directPrimitiveThreshold).toBe(0);
    expect(resolved.bvh.lineLeafSize).toBe(4);
  });

  it('resolves stored automatic engine-selection overrides', () => {
    const resolved = resolvePrimitiveSimulatorConfig({
      primitive: {
        engineSelection: {
          webGpuWorkloadThreshold: 2048,
          outgoingCoefficient: 99
        }
      }
    });
    expect(resolved.engineSelection).toEqual({
      webGpuWorkloadThreshold: 2048
    });
  });

  it('resolves engine tuning independently of shared preprocessing', () => {
    const resolved = resolveSimulationEngineConfig('primitiveCpu', {
      primitiveCpu: { maxLocalIterations: 7 }
    });
    expect(resolved.maxLocalIterations).toBe(7);
    expect(resolved.bvh).toBeUndefined();
  });

  it('exposes the provisional WebGPU cooperation calibration as defaults',
    () => {
      const config = DEFAULT_SIMULATION_ENGINE_CONFIGS.webgpu;
      expect(config.rayCooperationSaturationRayCount).toBe(8192);
      expect(config.rayCooperationDirectMaxTestsPerLane).toBe(512);
      expect(config.rayCooperationMaximumLanesPerRay).toBe(32);
      expect(config.rayCooperationMaximumHaloFraction).toBe(0.5);
    });
});
