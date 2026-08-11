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

import path from 'path';
import {
  compareCSV,
  compareImages,
  disposeWebGpuTestDevice,
  runScene
} from './helpers/sceneTestHelper.js';

const runCooperationTests =
  process.env.WEBGPU_RAY_COOPERATION_TEST === 'true';
const describeWebGpuCooperation = runCooperationTests ? describe : describe.skip;

const scalarSettings = {
  rayCooperationEnabled: false,
};

const cooperativeSettings = {
  rayCooperationEnabled: true,
  rayCooperationSaturationRayCount: 1_000_000_000,
  rayCooperationMaximumLanesPerRay: 4,
};

async function expectEquivalent(scenePath, settings) {
  const scalar = await runScene(scenePath, false, {
    engine: 'webgpu',
    engineSettings: scalarSettings,
  });
  const cooperative = await runScene(scenePath, false, {
    engine: 'webgpu',
    engineSettings: { ...cooperativeSettings, ...settings },
  });

  expect(cooperative.simulatorError).toBe(scalar.simulatorError);
  expect(cooperative.simulatorWarning).toBe(scalar.simulatorWarning);

  if (scalar.detectorData || cooperative.detectorData) {
    expect(scalar.detectorData).toBeDefined();
    expect(cooperative.detectorData).toBeDefined();
    const comparison = compareCSV(
      cooperative.detectorData,
      scalar.detectorData,
      1e-6
    );
    expect(comparison).toEqual(expect.objectContaining({ match: true }));
  }

  if (scalar.imageBuffer || cooperative.imageBuffer) {
    expect(scalar.imageBuffer).toBeDefined();
    expect(cooperative.imageBuffer).toBeDefined();
    const comparison = await compareImages(
      cooperative.imageBuffer,
      scalar.imageBuffer,
      0.9999
    );
    expect(comparison).toEqual(expect.objectContaining({ match: true }));
  }
}

describeWebGpuCooperation('WebGPU cooperative ray regression', () => {
  afterAll(disposeWebGpuTestDevice);

  test('cooperative direct matches scalar traversal on a bounded scene', async () => {
    await expectEquivalent(
      path.join(__dirname, 'general/maxRayDepth.json'),
      {
        rayCooperationDirectMaxTestsPerLane: 1_000_000_000,
      }
    );
  }, 30000);

  test('cooperative BVH partitions match scalar traversal through a region', async () => {
    await expectEquivalent(
      path.join(__dirname, 'glass/Glass/partialReflect_off.json'),
      {
        rayCooperationDirectMaxTestsPerLane: 0,
      }
    );
  }, 30000);

  test('image mode remains equivalent with two halo ray slots', async () => {
    await expectEquivalent(
      path.join(__dirname, 'mirror/Mirror/img.json'),
      {
        rayCooperationDirectMaxTestsPerLane: 1_000_000_000,
      }
    );
  }, 30000);

  test('partitioned BVH preserves detector power after an odd curve count',
    async () => {
      const scenePath = path.join(
        __dirname,
        'glass/CustomGlass/equiv_circle.json'
      );
      const scalar = await runScene(scenePath, false, {
        engine: 'webgpu',
        engineSettings: scalarSettings,
      });
      const cooperative = await runScene(scenePath, false, {
        engine: 'webgpu',
        engineSettings: {
          ...cooperativeSettings,
          rayCooperationDirectMaxTestsPerLane: 0,
        },
      });
      const detectorValues = output => output.detectorData
        .trim()
        .split('\n')
        .slice(1)
        .map(line => Number(line.split(',')[1]));
      const scalarValues = detectorValues(scalar);
      const cooperativeValues = detectorValues(cooperative);
      const sum = values => values.reduce(
        (total, value) => total + value,
        0
      );

      expect(cooperativeValues.filter(value => value !== 0)).toHaveLength(
        scalarValues.filter(value => value !== 0).length
      );
      expect(sum(cooperativeValues)).toBeCloseTo(sum(scalarValues), 3);
    }, 30000);
});
