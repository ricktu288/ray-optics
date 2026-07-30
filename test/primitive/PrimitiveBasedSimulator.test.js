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
import { prepareCurve } from '../../src/core/primitive/curveGeometry';
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

  it('fills regions selected by the temporary membership result', () => {
    const simulator = createSimulator('primitiveCpu', false);
    const geometry = prepareCurve({
      kind: 'circle',
      params: {
        center: { x: 5, y: 6 },
        radius: 2
      }
    }, {
      numericEpsilon: FLOAT32_EPSILON
    }).geometry;
    simulator.processedScene = {
      curves: [{
        geometry,
        ownerKind: 'region',
        ownerId: 0
      }],
      temporaryFirstRayMembership: {
        testRays: [{
          originX: 0,
          originY: 0,
          directionX: 1,
          directionY: 0
        }, {
          originX: 2,
          originY: 0,
          directionX: 0,
          directionY: 1
        }],
        membership: {
          regionMask: Uint8Array.of(1)
        }
      }
    };
    const ctx = {
      save: jest.fn(),
      restore: jest.fn(),
      setLineDash: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      arc: jest.fn(),
      closePath: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn()
    };
    const drawRay = jest.fn();

    simulator.drawTemporaryFirstRayMembership({
      ctx,
      lengthScale: 1,
      rgbaToCssColor: jest.fn(() => 'rgba(0, 0, 255, 0.2)'),
      drawRay
    });

    expect(ctx.fill).toHaveBeenCalledWith('evenodd');
    expect(ctx.arc).toHaveBeenCalledTimes(1);
    expect(drawRay).toHaveBeenCalledTimes(2);
  });
});
