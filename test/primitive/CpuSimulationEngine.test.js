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
import { preprocessPrimitives } from '../../src/core/primitive/preprocess';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric';

describe('CpuSimulationEngine temporary intersection visualization', () => {
  it('draws and logs every candidate hit of the first source ray', async () => {
    const sourceType = {
      name: 'Test source',
      paramNames: [],
      dag: parseFormula(
        `
          x = 0;
          y = 0;
          d_x = 1;
          d_y = 0;
          P_s = 0.5;
          P_p = 0.5;
          lambda = 540;
        `,
        ['i', 'N']
      )
    };
    const { processedScene } = preprocessPrimitives([
      {
        kind: 'source',
        sourceType,
        params: {},
        rayCount: 1
      },
      {
        kind: 'surface',
        surfaceType: {
          name: 'Test surface',
          paramNames: [],
          dag: parseFormula('P_1s = 0; P_1p = 0;', []),
          outRayCount: 1,
          mergesWithGlass: false
        },
        params: {},
        curve: {
          kind: 'lineSegment',
          params: {
            start: { x: 5, y: -2 },
            end: { x: 5, y: 2 }
          }
        },
        twoSided: true
      }
    ], {
      numericEpsilon: FLOAT32_EPSILON
    });
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    const renderer = {
      drawRay: jest.fn(),
      drawSegment: jest.fn(),
      drawPoint: jest.fn(),
      flush: jest.fn()
    };
    engine.beginRenderer = jest.fn(() => renderer);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);

    engine.drawFirstRayIntersections({ preparedScene });

    expect(renderer.drawRay).toHaveBeenCalledTimes(1);
    expect(renderer.drawSegment).toHaveBeenCalledTimes(1);
    expect(renderer.drawPoint).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('u=%s, sigma=%s%s'),
      0,
      'lineSegment',
      0,
      5,
      0.5,
      1,
      ' [nearest]'
    );
    log.mockRestore();
  });

  it('marks only distance- and normal-compatible co-hits as merged', async () => {
    const sourceType = {
      name: 'Test source',
      paramNames: [],
      dag: parseFormula(
        `
          x = 0;
          y = 0;
          d_x = 1;
          d_y = 0;
          P_s = 0.5;
          P_p = 0.5;
          lambda = 540;
        `,
        ['i', 'N']
      )
    };
    const surfaceType = {
      name: 'Test surface',
      paramNames: [],
      dag: parseFormula('P_1s = 0; P_1p = 0;', []),
      outRayCount: 1,
      mergesWithGlass: false
    };
    const verticalLine = x => ({
      kind: 'lineSegment',
      params: {
        start: { x, y: -2 },
        end: { x, y: 2 }
      }
    });
    const angledCenterX = 5.0000007;
    const tangentX = -Math.sin(0.1);
    const tangentY = Math.cos(0.1);
    const { processedScene } = preprocessPrimitives([
      {
        kind: 'source',
        sourceType,
        params: {},
        rayCount: 1
      },
      ...[
        verticalLine(5),
        verticalLine(5.0000005),
        {
          kind: 'lineSegment',
          params: {
            start: {
              x: angledCenterX - 2 * tangentX,
              y: -2 * tangentY
            },
            end: {
              x: angledCenterX + 2 * tangentX,
              y: 2 * tangentY
            }
          }
        }
      ].map(curve => ({
        kind: 'surface',
        surfaceType,
        params: {},
        curve,
        twoSided: true
      }))
    ], {
      numericEpsilon: FLOAT32_EPSILON,
      numericalTolerances: {
        surfaceMerging: 0.00001,
        surfaceNormal: 0.01
      }
    });
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    const renderer = {
      drawRay: jest.fn(),
      drawSegment: jest.fn(),
      drawPoint: jest.fn(),
      flush: jest.fn()
    };
    engine.beginRenderer = jest.fn(() => renderer);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);

    engine.drawFirstRayIntersections({ preparedScene });

    expect(renderer.drawPoint).toHaveBeenCalledTimes(3);
    expect(renderer.drawPoint.mock.calls[0][1]).toEqual([1, 0.15, 0.1, 1]);
    expect(renderer.drawPoint.mock.calls[1][1]).toEqual([0.15, 0.75, 1, 1]);
    expect(renderer.drawPoint.mock.calls[2][1]).toEqual([0.65, 0.65, 0.65, 0.65]);
    expect(log.mock.calls.map(call => call.at(-1))).toEqual([
      ' [nearest]',
      ' [merged]',
      ''
    ]);
    log.mockRestore();
  });

  it('uses the larger of the derived and configured forward distances', async () => {
    const sourceType = {
      name: 'Test source',
      paramNames: [],
      dag: parseFormula(
        'x = 0; y = 0; d_x = 1; d_y = 0; P_s = 1; P_p = 0; lambda = 540;',
        ['i', 'N']
      )
    };
    const surfaceType = {
      name: 'Test surface',
      paramNames: [],
      dag: parseFormula('P_1s = 0; P_1p = 0;', []),
      outRayCount: 1,
      mergesWithGlass: false
    };
    const makeSurface = x => ({
      kind: 'surface',
      surfaceType,
      params: {},
      curve: {
        kind: 'lineSegment',
        params: {
          start: { x, y: -1 },
          end: { x, y: 1 }
        }
      },
      twoSided: true
    });
    const { processedScene } = preprocessPrimitives([
      {
        kind: 'source',
        sourceType,
        params: {},
        rayCount: 1
      },
      makeSurface(0.05),
      makeSurface(1)
    ], {
      numericEpsilon: FLOAT32_EPSILON,
      numericalTolerances: {
        forwardDistance: 0.1
      }
    });
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    const renderer = {
      drawRay: jest.fn(),
      drawSegment: jest.fn(),
      drawPoint: jest.fn(),
      flush: jest.fn()
    };
    engine.beginRenderer = jest.fn(() => renderer);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);

    engine.drawFirstRayIntersections({ preparedScene });

    expect(renderer.drawPoint).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][4]).toBe(1);
    log.mockRestore();
  });
});
