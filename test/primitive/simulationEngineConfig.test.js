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
  resolveSimulationEngineConfig
} from '../../src/core/simulationEngines/config';

describe('simulation engine configuration', () => {
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

  it.each(['primitiveCpu', 'webgpu'])(
    'provides the minimum active ray brightness to %s',
    engineKind => {
      expect(
        DEFAULT_SIMULATION_ENGINE_CONFIGS[engineKind].minimumRayBrightness
      ).toBe(1e-6);
    }
  );
});
