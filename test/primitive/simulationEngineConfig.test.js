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
  DEFAULT_SIMULATION_ENGINE_CONFIGS,
  WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE,
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
      .toBe(128);
    expect(DEFAULT_SIMULATION_ENGINE_CONFIGS.webgpu.maxLocalIterations)
      .toBe(128);
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

  it.each(['primitiveCpu', 'webgpu'])(
    'provides the direct primitive threshold to %s',
    engineKind => {
      expect(
        DEFAULT_SIMULATION_ENGINE_CONFIGS[engineKind].bvh
          .directPrimitiveThreshold
      ).toBe(32);
    }
  );

  it('resolves a stored direct primitive threshold override', () => {
    const resolved = resolveSimulationEngineConfig('primitiveCpu', {
      primitiveCpu: {
        bvh: {
          directPrimitiveThreshold: 0
        }
      }
    });

    expect(resolved.bvh.directPrimitiveThreshold).toBe(0);
    expect(resolved.bvh.lineLeafSize).toBe(4);
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
