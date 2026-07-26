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
          outRayCount: 1
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
});
