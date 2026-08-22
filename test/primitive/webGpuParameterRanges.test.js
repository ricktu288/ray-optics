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

import { parseFormula } from '../../src/core/formula/formula-parser.js';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric.js';
import { preprocessPrimitives } from '../../src/core/primitive/preprocess.js';
import WebGpuSimulationEngine from '../../src/core/simulationEngines/webgpu/WebGpuSimulationEngine.js';
import {
  WEBGPU_F32_MAX,
  WEBGPU_F32_MIN_NORMAL,
  WEBGPU_MAX_POLARIZED_POWER,
  WEBGPU_SPATIAL_MAX,
  deriveWebGpuWavelengthRange,
  estimateWebGpuParameterRanges
} from '../../src/core/simulationEngines/webgpu/webGpuParameterRanges.js';

function line(startX, startY, endX, endY) {
  return {
    kind: 'lineSegment',
    params: {
      start: { x: startX, y: startY },
      end: { x: endX, y: endY }
    }
  };
}

function process(primitives) {
  return preprocessPrimitives(primitives, {
    numericEpsilon: FLOAT32_EPSILON
  }).processedScene;
}

function rangesByName(typeEntry) {
  return Object.fromEntries(
    typeEntry.parameters.map(parameter => [parameter.name, parameter.range])
  );
}

describe('WebGPU scene parameter range estimation', () => {
  it('uses actual packed instance values and envelopes excessive singleton unions', () => {
    const sourceType = {
      name: 'Parameterized source',
      paramNames: ['gain', 'offset'],
      dag: parseFormula(
        'x = gain; y = 0; unused = offset; d_x = 1; d_y = 0; P_s = 1; P_p = 0; lambda = 540;',
        ['gain', 'offset', 'i', 'N']
      )
    };
    const makeSource = (gain, offset, rayCount) => ({
      kind: 'source',
      sourceType,
      params: { gain, offset },
      rayCount
    });
    const description = process([
      makeSource(1, -Infinity, 1),
      makeSource(1.2, Infinity, 3),
      makeSource(2, WEBGPU_F32_MAX * 2, 5),
      makeSource(3, -WEBGPU_F32_MAX * 2, 7)
    ]);

    const estimated = estimateWebGpuParameterRanges(description, {
      intervalLimit: 3
    });
    const ranges = rangesByName(estimated.sources[0]);

    expect(estimated.sources[0].parameters.map(item => item.name))
      .toEqual(['gain', 'offset']);
    expect(ranges.gain).toEqual([[1, 3]]);
    expect(ranges.offset).toEqual([
      [-WEBGPU_F32_MAX, -WEBGPU_F32_MAX],
      [WEBGPU_F32_MAX, WEBGPU_F32_MAX]
    ]);
  });

  it('lists source invocation ranges when i and N are referenced', () => {
    const sourceType = {
      name: 'Indexed source',
      paramNames: [],
      dag: parseFormula(
        'x = i + N; y = 0; d_x = 1; d_y = 0; P_s = 1; P_p = 0; lambda = 540;',
        ['i', 'N']
      )
    };
    const description = process([1, 4, 9].map(rayCount => ({
      kind: 'source',
      sourceType,
      params: {},
      rayCount
    })));

    const ranges = rangesByName(
      estimateWebGpuParameterRanges(description).sources[0]
    );

    expect(ranges.i).toEqual([[0, 8]]);
    expect(ranges.N).toEqual([[1, 1], [4, 4], [9, 9]]);
  });

  it('covers every reserved surface and detector input', () => {
    const detectorParameters = [
      'd_0x', 'd_0y', 'P_0s', 'P_0p', 'lambda',
      'x', 'y', 'u', 'sigma'
    ];
    const surfaceParameters = [...detectorParameters, 'n_0', 'n_1'];
    const surfaceType = {
      name: 'All-input surface',
      paramNames: ['gain'],
      outRayCount: 1,
      mergesWithBoundary: false,
      dag: parseFormula(
        `d_1x = gain + ${surfaceParameters.join(' + ')}; d_1y = 1; P_1s = 0; P_1p = 0;`,
        ['gain', ...surfaceParameters]
      )
    };
    const detectorType = {
      name: 'All-input detector',
      paramNames: [],
      writeCount: 1,
      dag: parseFormula(
        `k_1 = 0; v_1 = ${detectorParameters.join(' + ')};`,
        detectorParameters
      )
    };
    const description = process([
      {
        kind: 'surface',
        curve: line(-10, 2, -8, 2),
        twoSided: false,
        surfaceType,
        params: { gain: 2 }
      },
      {
        kind: 'surface',
        curve: line(8, 4, 10, 4),
        twoSided: true,
        surfaceType,
        params: { gain: 3 }
      },
      {
        kind: 'detector',
        curve: line(20, -2, 22, -2),
        twoSided: false,
        detectorType,
        params: {},
        resultSize: 1,
        result: { values: null }
      }
    ]);

    const estimated = estimateWebGpuParameterRanges(description);
    const surface = rangesByName(estimated.surfaces[0]);
    const detector = rangesByName(estimated.detectors[0]);

    expect(Object.keys(surface)).toEqual(['gain', ...surfaceParameters]);
    expect(surface.gain).toEqual([[2, 2], [3, 3]]);
    expect(surface.d_0x).toEqual([[-1, 1]]);
    expect(surface.d_0y).toEqual([[-1, -WEBGPU_F32_MIN_NORMAL]]);
    expect(surface.P_0s).toEqual([[0, WEBGPU_MAX_POLARIZED_POWER]]);
    expect(surface.P_0p).toEqual([[0, WEBGPU_MAX_POLARIZED_POWER]]);
    expect(Math.fround(
      WEBGPU_MAX_POLARIZED_POWER + WEBGPU_MAX_POLARIZED_POWER
    )).toBe(WEBGPU_F32_MAX);
    expect(surface.lambda).toEqual([[380, 700]]);
    expect(surface.x).toHaveLength(2);
    expect(surface.x[0][0]).toBeLessThan(-10);
    expect(surface.x[1][1]).toBeGreaterThan(10);
    expect(surface.y[0][0]).toBeLessThan(2);
    expect(surface.y[1][1]).toBeGreaterThan(4);
    expect(surface.u[0][0]).toBeLessThan(0);
    expect(surface.u[0][1]).toBeGreaterThan(1);
    expect(surface.sigma).toEqual([[-1, -1], [1, 1]]);
    expect(surface.n_0).toEqual([[1, 1]]);
    expect(surface.n_1).toEqual([[1, 1]]);

    expect(detector.sigma).toEqual([[1, 1]]);
    expect(detector).not.toHaveProperty('n_0');
    expect(detector).not.toHaveProperty('n_1');
    expect(detector.x[0][0]).toBeLessThan(20);
    expect(detector.x[0][1]).toBeGreaterThan(22);
  });

  it('derives bulk x and y unions from every region using the bulk type', () => {
    const bulkType = {
      name: 'Spatial bulk',
      paramNames: ['base'],
      dag: parseFormula(
        'n = base + x + y + lambda; alpha = 0;',
        ['base', 'x', 'y', 'lambda']
      )
    };
    const makeRegion = (curve, base) => ({
      kind: 'region',
      curves: [curve],
      bulkType,
      params: { base },
      stepSize: 0,
      partialReflect: false
    });
    const description = process([
      makeRegion(line(-20, -5, -10, -5), 1),
      makeRegion(line(30, 7, 40, 7), 1.5)
    ]);

    const bulk = rangesByName(
      estimateWebGpuParameterRanges(description, {
        violetWavelength: 400,
        redWavelength: 700
      }).bulks[0]
    );

    expect(bulk.base).toEqual([[1, 1], [1.5, 1.5]]);
    expect(bulk.x).toHaveLength(2);
    expect(bulk.x[0][0]).toBeLessThan(-20);
    expect(bulk.x[0][1]).toBeGreaterThan(-10);
    expect(bulk.x[1][0]).toBeLessThan(30);
    expect(bulk.x[1][1]).toBeGreaterThan(40);
    expect(bulk.y).toHaveLength(2);
    expect(bulk.lambda).toEqual([[340, 820]]);
  });

  it('derives effective surface indices from every possible region overlap', () => {
    const bulkType = {
      name: 'Constant index',
      paramNames: ['index'],
      dag: parseFormula(
        'n = index; alpha = 0;',
        ['index', 'x', 'y', 'lambda']
      )
    };
    const surfaceType = {
      name: 'Index-aware surface',
      paramNames: [],
      outRayCount: 1,
      mergesWithBoundary: true,
      dag: parseFormula(
        'd_1x = n_0 + n_1; d_1y = 1; P_1s = 0; P_1p = 0;',
        ['n_0', 'n_1']
      )
    };
    const region = (index, curve) => ({
      kind: 'region',
      curves: [curve],
      bulkType,
      params: { index },
      stepSize: 0,
      partialReflect: false
    });
    const description = process([
      region(2, line(-5, 0, 5, 0)),
      region(3, line(-4, 0, 4, 0)),
      region(11, line(100, 100, 110, 100)),
      {
        kind: 'surface',
        curve: line(-1, 0, 1, 0),
        twoSided: true,
        surfaceType,
        params: {}
      }
    ]);

    const estimated = estimateWebGpuParameterRanges(description);
    const surfaceEntry = estimated.surfaces[0];
    const surface = rangesByName(surfaceEntry);

    expect(surface.n_0).toEqual([[1, 1], [2, 2], [3, 3], [6, 6]]);
    expect(surface.n_1).toEqual([[1, 1], [2, 2], [3, 3], [6, 6]]);
    expect(surfaceEntry.parameters.find(item => item.name === 'n_0'))
      .not.toHaveProperty('requiresFiniteGuard');
    expect(estimated.regionRefractiveIndices.map(info => info.intervals))
      .toEqual([[[2, 2]], [[3, 3]], [[11, 11]]]);
  });

  it('clamps non-finite overlap products and records the required guard', () => {
    const bulkType = {
      name: 'Large index',
      paramNames: ['index'],
      dag: parseFormula('n = index; alpha = 0;', ['index'])
    };
    const surfaceType = {
      name: 'Guarded surface',
      paramNames: [],
      outRayCount: 1,
      mergesWithBoundary: true,
      dag: parseFormula(
        'd_1x = n_0; d_1y = n_1; P_1s = 0; P_1p = 0;',
        ['n_0', 'n_1']
      )
    };
    const primitives = [0, 1].map(() => ({
      kind: 'region',
      curves: [line(-5, 0, 5, 0)],
      bulkType,
      params: { index: 2e20 },
      stepSize: 0,
      partialReflect: false
    }));
    primitives.push({
      kind: 'surface',
      curve: line(-1, 0, 1, 0),
      twoSided: true,
      surfaceType,
      params: {}
    });

    const estimated = estimateWebGpuParameterRanges(process(primitives));
    const n0 = estimated.surfaces[0].parameters.find(
      parameter => parameter.name === 'n_0'
    );

    expect(n0.range.at(-1)[1]).toBe(WEBGPU_F32_MAX);
    expect(n0.maybeInvalid).toBe(true);
    expect(n0.requiresFiniteGuard).toBe(true);
  });

  it('records a guard when one region can itself exceed finite f32', () => {
    const bulkType = {
      name: 'Overflowing index',
      paramNames: ['factor'],
      dag: parseFormula('n = factor * factor; alpha = 0;', ['factor'])
    };
    const surfaceType = {
      name: 'Adjacent surface',
      paramNames: [],
      outRayCount: 1,
      mergesWithBoundary: true,
      dag: parseFormula(
        'd_1x = n_0; d_1y = n_1; P_1s = 0; P_1p = 0;',
        ['n_0', 'n_1']
      )
    };
    const estimated = estimateWebGpuParameterRanges(process([{
      kind: 'region',
      curves: [line(-5, 0, 5, 0)],
      bulkType,
      params: { factor: 2e20 },
      stepSize: 0,
      partialReflect: false
    }, {
      kind: 'surface',
      curve: line(-1, 0, 1, 0),
      twoSided: true,
      surfaceType,
      params: {}
    }]));
    const n0 = estimated.surfaces[0].parameters.find(
      parameter => parameter.name === 'n_0'
    );

    expect(estimated.regionRefractiveIndices[0].maybeInvalid).toBe(true);
    expect(estimated.regionRefractiveIndices[0].intervals[0][1])
      .toBe(WEBGPU_F32_MAX);
    expect(n0.range[0]).toEqual([1, 1]);
    expect(n0.range.at(-1)[1]).toBe(WEBGPU_F32_MAX);
    expect(n0.requiresFiniteGuard).toBe(true);
  });

  it('adds only the internal boundary types required by present regions', () => {
    const bulkType = {
      name: 'Boundary medium',
      paramNames: ['index'],
      dag: parseFormula('n = index; alpha = 0;', ['index'])
    };
    const makeRegion = (partialReflect, y) => ({
      kind: 'region',
      curves: [line(-5, y, 5, y)],
      bulkType,
      params: { index: partialReflect ? 1.5 : 2 },
      stepSize: 0,
      partialReflect
    });

    const noRegions = estimateWebGpuParameterRanges(process([]));
    expect(noRegions.internalSurfaces).toEqual([]);

    const refractionOnly = estimateWebGpuParameterRanges(process([
      makeRegion(false, 0)
    ]));
    expect(refractionOnly.internalSurfaces.map(type => type.key)).toEqual([
      'regionBoundaryRefraction'
    ]);

    const both = estimateWebGpuParameterRanges(process([
      makeRegion(false, 0),
      makeRegion(true, 1)
    ]));
    expect(both.internalSurfaces.map(type => type.key)).toEqual([
      'regionBoundaryRefraction',
      'regionBoundaryPartialReflection'
    ]);
    expect(both.types.filter(type => type.internal))
      .toEqual(both.internalSurfaces);
    expect(new Set(both.types.map(type => type.key)).size)
      .toBe(both.types.length);
    expect(both.internalSurfaces.map(type => type.outRayCount))
      .toEqual([1, 2]);
    expect(both.internalSurfaces[0].parameters.map(item => item.name))
      .toEqual(['d_0x', 'd_0y', 'P_0s', 'P_0p', 'n_0', 'n_1']);
  });

  it('rejects geometry beyond the GPU-only safe spatial domain', () => {
    const maximumCoordinateDifference = 2 * WEBGPU_SPATIAL_MAX;
    expect(Math.fround(
      maximumCoordinateDifference * maximumCoordinateDifference * 2
    )).toBeLessThan(WEBGPU_F32_MAX);

    const surfaceType = {
      name: 'Mirror',
      paramNames: [],
      outRayCount: 1,
      mergesWithBoundary: false,
      dag: parseFormula(
        'd_1x = d_0x; d_1y = -d_0y; P_1s = P_0s; P_1p = P_0p;',
        ['d_0x', 'd_0y', 'P_0s', 'P_0p']
      )
    };
    const description = process([{
      kind: 'surface',
      curve: line(
        WEBGPU_SPATIAL_MAX * 2,
        0,
        WEBGPU_SPATIAL_MAX * 2.1,
        0
      ),
      twoSided: true,
      surfaceType,
      params: {}
    }]);

    expect(() => estimateWebGpuParameterRanges(description))
      .toThrow(/WebGPU spatial limit/);
  });

  it('prepares ranges without emitting WGSL during WebGPU prepare', async () => {
    const description = process([]);
    const engine = new WebGpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON,
      device: null,
      output: null
    });

    const prepared = await engine.prepare(description, {
      violetWavelength: 400,
      redWavelength: 700
    });

    expect(prepared.description).toBe(description);
    expect(prepared.parameterRanges.wavelengthRange).toEqual([[340, 820]]);
    expect(prepared.parameterRanges).not.toHaveProperty('nodeRanges');
  });

  it('requests recompilation only when a type guard signature changes', async () => {
    const sourceType = {
      name: 'Range-sensitive source',
      paramNames: ['divisor'],
      dag: parseFormula(
        'x = 1 / divisor; y = 0; d_x = 1; d_y = 0; P_s = 1; P_p = 0; lambda = 540;',
        ['divisor']
      )
    };
    const description = divisor => process([{
      kind: 'source',
      sourceType,
      params: { divisor },
      rayCount: 1
    }]);
    const engine = new WebGpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON,
      device: null,
      output: null
    });
    const initial = await engine.prepare(description(1));
    const safeRangeChange = await engine.prepare(description(2));
    const guardChange = await engine.prepare(description(0));
    const unchangedGuard = await engine.prepare(description(0));

    expect(initial.parameterRanges.sources[0]).toMatchObject({
      recompilationNeeded: true,
      recompilationReason: 'initial specialization'
    });
    expect(safeRangeChange.parameterRanges.sources[0])
      .toMatchObject({ recompilationNeeded: false });
    expect(guardChange.parameterRanges.sources[0]).toMatchObject({
      recompilationNeeded: true,
      recompilationReason: 'range guards changed'
    });
    expect(unchangedGuard.parameterRanges.sources[0])
      .toMatchObject({ recompilationNeeded: false });
    expect(guardChange.parameterRanges.sources[0].specialization)
      .toHaveProperty('rangeResult.nodeRanges');
    expect(guardChange.parameterRanges.sources[0].specialization)
      .not.toHaveProperty('code');
  });

  it('tracks internal boundary finite-index guard changes independently', async () => {
    const bulkType = {
      name: 'Variable overlap index',
      paramNames: ['index'],
      dag: parseFormula('n = index; alpha = 0;', ['index'])
    };
    const description = index => process([0, 1].map(() => ({
      kind: 'region',
      curves: [line(-5, 0, 5, 0)],
      bulkType,
      params: { index },
      stepSize: 0,
      partialReflect: false
    })));
    const engine = new WebGpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON,
      device: null,
      output: null
    });

    await engine.prepare(description(2));
    const overflow = await engine.prepare(description(2e20));
    const bulk = overflow.parameterRanges.bulks[0];
    const internal = overflow.parameterRanges.internalSurfaces[0];

    expect(bulk.recompilationNeeded).toBe(false);
    expect(internal.recompilationNeeded).toBe(true);
    expect(internal.recompilationReason).toBe('range guards changed');
    expect(internal.specialization.guardProfile)
      .toEqual({ finiteRefractiveIndex: true });
  });

  it('records newly present and removed type keys', async () => {
    const sourceType = {
      name: 'Transient source',
      paramNames: [],
      dag: parseFormula(
        'x = 0; y = 0; d_x = 1; d_y = 0; P_s = 1; P_p = 0; lambda = 540;',
        []
      )
    };
    const engine = new WebGpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON,
      device: null,
      output: null
    });

    await engine.prepare(process([]));
    const added = await engine.prepare(process([{
      kind: 'source',
      sourceType,
      params: {},
      rayCount: 1
    }]));
    const removed = await engine.prepare(process([]));

    expect(added.parameterRanges.sources[0]).toMatchObject({
      recompilationNeeded: true,
      recompilationReason: 'new type'
    });
    expect(removed.parameterRanges.removedTypeKeys)
      .toEqual(['source:0']);
    expect(removed.parameterRanges.anyRecompilationNeeded).toBe(true);
  });
});

describe('WebGPU wavelength range', () => {
  it('maps the scene violet/red anchors to UV and infrared', () => {
    expect(deriveWebGpuWavelengthRange()).toEqual([[380, 700]]);
    expect(deriveWebGpuWavelengthRange({
      violetWavelength: 400,
      redWavelength: 700
    })).toEqual([[340, 820]]);
  });

  it('rejects invalid scene wavelength anchors', () => {
    expect(() => deriveWebGpuWavelengthRange({
      violetWavelength: 700,
      redWavelength: 400
    })).toThrow(/redWavelength greater/);
  });
});
