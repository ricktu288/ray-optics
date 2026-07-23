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

import { preprocessPrimitives } from '../../src/core/primitive/preprocess.js';

function line(startX, startY, endX, endY) {
  return {
    kind: 'lineSegment',
    params: {
      start: { x: startX, y: startY },
      end: { x: endX, y: endY }
    }
  };
}

function dag(label = 'output') {
  return {
    root: 0,
    nodes: [{
      id: 0,
      kind: 'number',
      value: 1,
      raw: '1',
      label
    }]
  };
}

function surface(type, curve, params = {}) {
  return {
    kind: 'surface',
    curve,
    twoSided: true,
    surfaceType: type,
    params
  };
}

describe('primitive preprocessing', () => {
  it('deduplicates structural types while preserving engine-neutral parameters', () => {
    const firstType = {
      name: 'Adjustable',
      paramNames: ['gain', 'bias'],
      dag: dag('P_1s'),
      outRayCount: 1
    };
    const equivalentType = {
      outRayCount: 1,
      dag: dag('P_1s'),
      paramNames: ['gain', 'bias'],
      name: 'Adjustable'
    };
    const differentlyNamedType = {
      ...equivalentType,
      name: 'Other adjustable'
    };
    const primitives = [
      surface(firstType, line(0, 0, 1, 0), { bias: 3, gain: 2, ignored: 100 }),
      surface(equivalentType, line(2, 0, 3, 0), { gain: 4, bias: 5 }),
      surface(differentlyNamedType, line(4, 0, 5, 0), { gain: 6, bias: 7 })
    ];

    const { processedScene } = preprocessPrimitives(primitives);

    expect(processedScene.types.surfaces).toHaveLength(2);
    expect(processedScene.surfaces[0].surfaceTypeId)
      .toBe(processedScene.surfaces[1].surfaceTypeId);
    expect(processedScene.surfaces[2].surfaceTypeId)
      .not.toBe(processedScene.surfaces[0].surfaceTypeId);
    expect(processedScene.surfaces.map(item => item.params)).toEqual([
      { bias: 3, gain: 2, ignored: 100 },
      { gain: 4, bias: 5 },
      { gain: 6, bias: 7 }
    ]);
    expect(processedScene.surfaces[0].params).toBe(primitives[0].params);
    expect(Object.isFrozen(processedScene.types.surfaces[0].definition)).toBe(true);

    const reversed = preprocessPrimitives([...primitives].reverse()).processedScene;
    expect(reversed.typeSignature).toBe(processedScene.typeSignature);
    expect(reversed.types.surfaces).toEqual(processedScene.types.surfaces);

    const changedParams = preprocessPrimitives([
      surface(firstType, line(0, 0, 10, 0), { gain: 200, bias: 300 })
    ]).processedScene;
    const changedType = preprocessPrimitives([
      surface({
        ...firstType,
        outRayCount: 2
      }, line(0, 0, 1, 0), { gain: 2, bias: 3 })
    ]).processedScene;
    const firstTypeOnly = preprocessPrimitives([
      surface(firstType, line(0, 0, 1, 0), { gain: 2, bias: 3 })
    ]).processedScene;
    expect(changedParams.typeSignature).toBe(firstTypeOnly.typeSignature);
    expect(changedType.typeSignature).not.toBe(firstTypeOnly.typeSignature);
  });

  it('creates owner tables, a stable curve table, and BVH curve IDs', () => {
    const surfaceType = {
      name: 'Surface',
      paramNames: [],
      dag: dag('P_1s'),
      outRayCount: 1
    };
    const bulkType = {
      name: 'Bulk',
      paramNames: ['n'],
      dag: dag('n')
    };
    const detectorType = {
      name: 'Detector',
      paramNames: ['scale'],
      dag: dag('amount'),
      writeCount: 1
    };
    const result = { values: null };
    const primitives = [
      {
        ...surface(surfaceType, line(0, 0, 1, 0)),
        filter: {
          wavelength: 540,
          bandwidth: 10,
          invert: false
        }
      },
      {
        kind: 'region',
        curves: [
          line(2, 0, 3, 0),
          {
            kind: 'circularArc',
            params: {
              start: { x: 3, y: 0 },
              end: { x: 2, y: 0 },
              bulge: 1
            }
          }
        ],
        bulkType,
        params: { n: 1.5 },
        stepSize: 0,
        partialReflect: true
      },
      {
        kind: 'detector',
        curve: line(4, 0, 5, 0),
        twoSided: false,
        detectorType,
        params: { scale: 2 },
        resultSize: 8,
        result
      }
    ];

    const { processedScene } = preprocessPrimitives(primitives);

    expect(processedScene.surfaces).toHaveLength(1);
    expect(processedScene.regions).toEqual([{
      bulkTypeId: 0,
      params: { n: 1.5 },
      stepSize: 0,
      partialReflect: true
    }]);
    expect(processedScene.detectors).toEqual([{
      detectorTypeId: 0,
      params: { scale: 2 },
      resultId: 0,
      resultSize: 8
    }]);
    expect(processedScene.curves.map(curve => [curve.ownerKind, curve.ownerId]))
      .toEqual([
        ['surface', 0],
        ['region', 0],
        ['region', 0],
        ['detector', 0]
      ]);
    expect(processedScene.curves[0].curve).toBe(primitives[0].curve);
    expect(processedScene.curves[0].filter).toBe(primitives[0].filter);
    expect(processedScene.curves[3].twoSided).toBe(false);
    expect(Array.from(processedScene.bvh.curveIds).sort((a, b) => a - b))
      .toEqual([0, 1, 2, 3]);
    expect(processedScene.bvh.nodes[processedScene.bvh.root].depth).toBe(0);
  });

  it('allocates shared detector results separately from the transferable scene', () => {
    const detectorType = {
      name: 'Detector',
      paramNames: [],
      dag: dag('amount'),
      writeCount: 1
    };
    const sharedResult = { values: null };
    const separateResult = { values: null };
    const makeDetector = (x, result, resultSize) => ({
      kind: 'detector',
      curve: line(x, 0, x + 1, 0),
      twoSided: true,
      detectorType,
      params: {},
      resultSize,
      result
    });

    const {
      processedScene,
      detectorResultBindings
    } = preprocessPrimitives([
      makeDetector(0, sharedResult, 4),
      makeDetector(2, sharedResult, 4),
      makeDetector(4, separateResult, 3)
    ]);

    expect(processedScene.detectors.map(detector => [
      detector.resultId,
      detector.resultSize
    ])).toEqual([
      [0, 4],
      [0, 4],
      [1, 3]
    ]);
    expect(detectorResultBindings).toEqual([
      { resultId: 0, result: sharedResult, resultSize: 4 },
      { resultId: 1, result: separateResult, resultSize: 3 }
    ]);
    expect(processedScene.detectors[0].result).toBeUndefined();
  });

  it('packs sources independently and rejects inconsistent shared result sizes', () => {
    const sourceType = {
      name: 'Source',
      paramNames: ['x', 'power'],
      dag: dag('P_s')
    };
    const { processedScene } = preprocessPrimitives([{
      kind: 'source',
      sourceType,
      params: { power: 0.5, x: 12 },
      rayCount: 20
    }]);

    expect(processedScene.sources).toEqual([{
      sourceTypeId: 0,
      params: { power: 0.5, x: 12 },
      rayCount: 20
    }]);

    const detectorType = {
      name: 'Detector',
      paramNames: [],
      dag: dag('amount')
    };
    const result = { values: null };
    const detector = resultSize => ({
      kind: 'detector',
      curve: line(resultSize, 0, resultSize + 1, 0),
      twoSided: true,
      detectorType,
      params: {},
      resultSize,
      result
    });
    expect(() => preprocessPrimitives([detector(2), detector(3)]))
      .toThrow(/same result holder/);
  });
});
