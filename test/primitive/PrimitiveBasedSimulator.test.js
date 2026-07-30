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

import PrimitiveBasedSimulator from '../../src/core/PrimitiveBasedSimulator';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric';

function createScene() {
  return {
    lengthScale: 1,
    numericalTolerances: {},
    opticalObjs: []
  };
}

function createSimulator(engineKind, drawBvh) {
  return new PrimitiveBasedSimulator({
    scene: createScene(),
    engine: {
      kind: engineKind,
      numericEpsilon: FLOAT32_EPSILON
    },
    drawBvh
  });
}

describe('PrimitiveBasedSimulator BVH diagnostics', () => {
  it('attaches diagnostics to the CPU scene object when visualization is enabled', () => {
    const simulator = createSimulator('primitiveCpu', true);

    simulator.collectAndPreprocessPrimitives();

    expect(simulator.processedScene.cpuBvhTraversalDiagnostics)
      .toMatchObject({
        nodeStates: expect.any(Uint8Array),
        testedCurves: expect.any(Uint8Array)
      });
  });

  it.each([
    ['primitiveCpu', false],
    ['webgpu', true]
  ])(
    'does not attach shared diagnostics for %s with drawBvh=%s',
    (engineKind, drawBvh) => {
      const simulator = createSimulator(engineKind, drawBvh);

      simulator.collectAndPreprocessPrimitives();

      expect(simulator.processedScene.cpuBvhTraversalDiagnostics)
        .toBeUndefined();
    }
  );

  it('publishes completed detector arrays through their result bindings', async () => {
    const simulator = createSimulator('primitiveCpu', false);
    const result = { values: null };
    simulator.detectorResultBindings = [{
      resultId: 0,
      result,
      resultSize: 2
    }];
    simulator.scene.origin = { x: 0, y: 0 };
    simulator.scene.scale = 1;
    simulator.scene.colorMode = 'default';
    simulator.scene.mode = 'rays';
    simulator.scene.simulateColors = false;
    simulator.scene.showRayArrows = false;
    simulator.scene.observer = null;
    const run = {
      advance: jest.fn(async () => ({
        status: 'complete',
        progress: {
          processedRayCount: 1,
          totalTruncation: 0
        },
        result: {
          detectors: [Float64Array.of(2, 3)],
          brightnessScale: 0
        }
      })),
      dispose: jest.fn()
    };
    simulator.engine.prepare = jest.fn(async description => ({
      description
    }));
    simulator.engine.createRun = jest.fn(async () => run);

    await simulator.runEngine(0);

    expect(result.values).toEqual(Float64Array.of(2, 3));
    expect(run.dispose).toHaveBeenCalled();
  });
});
