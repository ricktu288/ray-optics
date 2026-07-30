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

describe('CpuSimulationEngine temporary first-ray intersection', () => {
  it('keeps the submitted scene reference and records traversal diagnostics', async () => {
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
    const diagnostics = attachCpuBvhTraversalDiagnostics(processedScene);
    const preparedScene = await engine.prepare(processedScene);

    const candidate = engine.drawFirstRayIntersections({ preparedScene });

    expect(preparedScene.description).toBe(processedScene);
    expect(renderer.drawRay).not.toHaveBeenCalled();
    expect(renderer.drawSegment).toHaveBeenCalledTimes(1);
    expect(renderer.drawSegment.mock.calls[0][0]).toEqual({
      p1: { x: 0, y: 0 },
      p2: { x: 10, y: 0 }
    });
    expect(renderer.drawPoint).not.toHaveBeenCalled();
    expect(Array.from(diagnostics.testedCurves)).toEqual([1]);
    expect(candidate).toMatchObject({
      s: 5,
      curveId: 0,
      u: 0.5,
      sigma: 1,
      conflictType: 0,
      conflictCurveId: -1
    });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('u=%s, sigma=%s, regions=%s%s'),
      0,
      'lineSegment',
      'surface',
      0,
      5,
      0.5,
      1,
      'none',
      ''
    );
    log.mockRestore();
  });

  it('reports conflicting primary surfaces and discards inconsistent normals', async () => {
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
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);

    const candidate = engine.drawFirstRayIntersections({ preparedScene });

    expect(renderer.drawPoint).not.toHaveBeenCalled();
    expect(renderer.drawSegment).toHaveBeenCalledTimes(1);
    expect(candidate).toMatchObject({
      curveId: 0,
      conflictType: 3,
      conflictCurveId: 2
    });
    expect(warn).toHaveBeenCalledWith(
      '[Primitive CPU candidate] %s conflict at curve %d%s',
      'normal',
      2,
      ' [discard ray]'
    );
    log.mockRestore();
    warn.mockRestore();
  });

  it('selects surfaces over regions and detectors and records merge conflicts', async () => {
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
      mergesWithGlass: true
    };
    const bulkType = {
      name: 'Test bulk',
      paramNames: [],
      dag: parseFormula('n = 1.5; alpha = 0;', ['x', 'y', 'lambda'])
    };
    const detectorType = {
      name: 'Test detector',
      paramNames: [],
      dag: parseFormula('k_1 = 0; v_1 = 0;', []),
      writeCount: 1
    };
    const curve = {
      kind: 'lineSegment',
      params: {
        start: { x: 5, y: -2 },
        end: { x: 5, y: 2 }
      }
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
        surfaceType,
        params: {},
        curve,
        twoSided: true
      },
      {
        kind: 'region',
        curves: [curve],
        bulkType,
        params: {},
        stepSize: 0,
        partialReflect: true
      },
      {
        kind: 'detector',
        curve,
        twoSided: true,
        detectorType,
        params: {},
        resultSize: 1,
        result: { values: null }
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
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);

    const candidate = engine.drawFirstRayIntersections({ preparedScene });

    expect(candidate).toMatchObject({
      curveId: 0,
      conflictType: 1,
      conflictCurveId: 2
    });
    expect(Array.from(candidate.regionCrossingMask)).toEqual([1]);
    expect(warn).toHaveBeenCalledWith(
      '[Primitive CPU candidate] %s conflict at curve %d%s',
      'merge',
      2,
      ''
    );
    log.mockRestore();
    warn.mockRestore();
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

    const candidate = engine.drawFirstRayIntersections({ preparedScene });

    expect(renderer.drawPoint).not.toHaveBeenCalled();
    expect(candidate.s).toBe(1);
    expect(candidate.curveId).toBe(1);
    log.mockRestore();
  });

  it('records same-orientation region crossings once and cancels opposite ones', async () => {
    const sourceType = {
      name: 'Test source',
      paramNames: [],
      dag: parseFormula(
        'x = 0; y = 0; d_x = 1; d_y = 0; P_s = 1; P_p = 0; lambda = 540;',
        ['i', 'N']
      )
    };
    const bulkType = {
      name: 'Test bulk',
      paramNames: [],
      dag: parseFormula('n = 1.5; alpha = 0;', ['x', 'y', 'lambda'])
    };
    const upwardLine = {
      kind: 'lineSegment',
      params: {
        start: { x: 5, y: -2 },
        end: { x: 5, y: 2 }
      }
    };
    const downwardLine = {
      kind: 'lineSegment',
      params: {
        start: { x: 5, y: 2 },
        end: { x: 5, y: -2 }
      }
    };
    const makeRegion = curves => ({
      kind: 'region',
      curves,
      bulkType,
      params: {},
      stepSize: 0,
      partialReflect: true
    });
    const { processedScene } = preprocessPrimitives([
      {
        kind: 'source',
        sourceType,
        params: {},
        rayCount: 1
      },
      makeRegion([upwardLine, upwardLine]),
      makeRegion([upwardLine, downwardLine])
    ], {
      numericEpsilon: FLOAT32_EPSILON
    });
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    const ctx = {
      save: jest.fn(),
      restore: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      fill: jest.fn()
    };
    const renderer = {
      ctx,
      rgbaToCssColor: jest.fn(() => 'rgba(38, 166, 255, 0.18)'),
      drawRay: jest.fn(),
      drawSegment: jest.fn(),
      drawPoint: jest.fn(),
      flush: jest.fn()
    };
    engine.beginRenderer = jest.fn(() => renderer);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);

    const candidate = engine.drawFirstRayIntersections({ preparedScene });

    expect(Array.from(candidate.positiveRegionCrossings)).toEqual([1, 1]);
    expect(Array.from(candidate.negativeRegionCrossings)).toEqual([0, 1]);
    expect(Array.from(candidate.regionCrossingMask)).toEqual([1, 0]);
    expect(candidate.curveId).toBe(0);
    expect(candidate.u).toBe(0.5);
    expect(candidate.sigma).toBe(1);
    expect(candidate.conflictType).toBe(2);
    expect(candidate.conflictCurveId).toBe(1);
    expect(renderer.drawPoint).not.toHaveBeenCalled();
    expect(renderer.drawSegment).toHaveBeenCalledTimes(1);
    expect(ctx.fill).not.toHaveBeenCalled();
    log.mockRestore();
    warn.mockRestore();
  });
});
