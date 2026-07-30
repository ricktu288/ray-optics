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

import CpuSimulationEngine from '../../src/core/simulationEngines/CpuSimulationEngine';
import { parseFormula } from '../../src/core/formula/formula-parser';
import {
  attachCpuBvhTraversalDiagnostics
} from '../../src/core/primitive/bvhTraversal';
import { preprocessPrimitives } from '../../src/core/primitive/preprocess';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric';

const bulkType = {
  name: 'Test bulk',
  paramNames: [],
  dag: parseFormula('n = 1.5; alpha = 0;', ['x', 'y', 'lambda'])
};

function createProcessedScene(curves, directionX = 1, directionY = 0) {
  const sourceType = {
    name: 'Test source',
    paramNames: [],
    dag: parseFormula(
      `
        x = 5;
        y = 5;
        d_x = ${directionX};
        d_y = ${directionY};
        P_s = 0.5;
        P_p = 0.5;
        lambda = 540;
      `,
      ['i', 'N']
    )
  };
  return preprocessPrimitives([
    {
      kind: 'source',
      sourceType,
      params: {},
      rayCount: 1
    },
    {
      kind: 'region',
      curves,
      bulkType,
      params: {},
      stepSize: 1,
      partialReflect: true
    }
  ], {
    numericEpsilon: FLOAT32_EPSILON
  }).processedScene;
}

function rectangleCurves() {
  return [
    {
      kind: 'lineSegment',
      params: {
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 }
      }
    },
    {
      kind: 'lineSegment',
      params: {
        start: { x: 10, y: 0 },
        end: { x: 10, y: 10 }
      }
    },
    {
      kind: 'lineSegment',
      params: {
        start: { x: 10, y: 10 },
        end: { x: 0, y: 10 }
      }
    },
    {
      kind: 'lineSegment',
      params: {
        start: { x: 0, y: 10 },
        end: { x: 0, y: 0 }
      }
    }
  ];
}

describe('CpuSimulationEngine temporary first-ray membership', () => {
  it('keeps the scene reference and stores the containing regions', async () => {
    const processedScene = createProcessedScene(rectangleCurves());
    const diagnostics = attachCpuBvhTraversalDiagnostics(processedScene);
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);

    const membership = engine.runFirstRayMembership({ preparedScene });

    expect(preparedScene.description).toBe(processedScene);
    expect(Array.from(membership.regionMask)).toEqual([1]);
    expect(membership.ambiguousCurveId).toBe(-1);
    expect(membership.discardRay).toBe(false);
    expect(processedScene.temporaryFirstRayMembership).toEqual({
      testRays: [expect.objectContaining({
        originX: 5,
        originY: 5,
        directionX: 1,
        directionY: 0
      })],
      membership
    });
    expect(Array.from(diagnostics.testedCurves)).toContain(1);
    expect(log).toHaveBeenCalledWith(
      '[Primitive CPU membership] ray origin is inside regions: %s',
      '0'
    );
    log.mockRestore();
  });

  it('warns on an ambiguous cast and retries from half the nearest distance', async () => {
    const processedScene = createProcessedScene(
      rectangleCurves(),
      1,
      1
    );
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);

    const membership = engine.runFirstRayMembership({ preparedScene });

    expect(membership.ambiguousCurveId).toBe(-1);
    expect(membership.discardRay).toBe(false);
    const { testRays } =
      processedScene.temporaryFirstRayMembership;
    expect(testRays).toHaveLength(2);
    expect(testRays[0]).toMatchObject({
      originX: 5,
      originY: 5
    });
    expect(testRays[1]).toMatchObject({
      originX: 7.5,
      originY: 7.5
    });
    expect(warn).toHaveBeenCalledWith(
      '[Primitive CPU membership] Ambiguous crossing for regions %s at curve %d on attempt %d.',
      '0',
      expect.any(Number),
      1
    );
    expect(warn).not.toHaveBeenCalledWith(
      '[Primitive CPU membership] Membership remains ambiguous after %d attempts; ray discarded.',
      expect.any(Number)
    );
    expect(engine.beginRenderer).toHaveBeenCalledTimes(1);
    log.mockRestore();
    warn.mockRestore();
  });
});
