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
import {
  createCpuDetectorResults,
  prepareCpuOutgoingRayData,
  writeCpuOutgoingRays
} from '../../src/core/simulationEngines/cpuOutgoingRays.js';

const sourceRay = {
  originX: 0,
  originY: 0,
  directionX: 1,
  directionY: 0,
  brightnessS: 1,
  brightnessP: 0.5,
  wavelength: 540,
  membership: Uint8Array.of(1)
};

function bulkType(dag = parseFormula(
  'n = n_value; alpha = alpha_value',
  ['n_value', 'alpha_value']
)) {
  return {
    definition: {
      name: 'Bulk',
      paramNames: ['n_value', 'alpha_value'],
      dag
    }
  };
}

function baseDescription() {
  return {
    types: {
      bulks: [bulkType()],
      surfaces: [],
      detectors: []
    },
    regions: [{
      bulkTypeId: 0,
      params: {
        n_value: 1.5,
        alpha_value: 0
      },
      partialReflect: true
    }],
    surfaces: [],
    detectors: [],
    curves: []
  };
}

function hit(overrides = {}) {
  return {
    s: 1,
    u: 0.5,
    sigma: 1,
    normalX: -1,
    normalY: 0,
    curveId: 0,
    regionCrossingMask: Uint8Array.of(1),
    ...overrides
  };
}

describe('CPU outgoing-ray calculations', () => {
  it('evaluates n_0 and n_1 only for surface DAGs which use them', () => {
    const description = baseDescription();
    const refractiveSurface = {
      definition: {
        name: 'Refractive inputs',
        paramNames: [],
        outRayCount: 2,
        dag: parseFormula(
          `
            d_1x = d_0x;
            d_1y = -d_0y;
            P_1s = P_0s * n_0;
            P_1p = 0;
            d_2x = d_0x;
            d_2y = d_0y;
            P_2s = P_0s * n_1;
            P_2p = 0;
          `,
          ['d_0x', 'd_0y', 'P_0s', 'n_0', 'n_1']
        )
      }
    };
    const plainSurface = {
      definition: {
        name: 'Plain',
        paramNames: [],
        outRayCount: 1,
        dag: parseFormula(
          `
            unused = n_0;
            d_1x=d_0x;
            d_1y=-d_0y;
            P_1s=P_0s;
            P_1p=P_0p;
          `,
          ['d_0x', 'd_0y', 'P_0s', 'P_0p', 'n_0']
        )
      }
    };
    description.types.surfaces = [
      refractiveSurface,
      plainSurface
    ];
    description.surfaces = [{
      surfaceTypeId: 0,
      params: {}
    }];
    description.curves = [{
      ownerKind: 'surface',
      ownerId: 0
    }];
    const prepared = prepareCpuOutgoingRayData(description);
    const destination = new Array(2);

    expect(prepared.surfaceTypes.map(type =>
      type.needsRefractiveIndices
    )).toEqual([true, false]);

    const activeCount = writeCpuOutgoingRays({
      description,
      prepared,
      type: {
        kind: 'surface',
        typeId: 0,
        outRayCount: 2,
        interactionCount: 1,
        destinationRayStart: 0
      },
      localInteractionIndex: 0,
      sourceRay,
      hit: hit(),
      destinationRayBuffer: destination,
      detectorResults: []
    });

    expect(activeCount).toBe(2);
    expect(destination[0]).toMatchObject({
      directionX: -1,
      directionY: 0,
      brightnessS: 1.5,
      brightnessP: 0,
      membership: Uint8Array.of(1)
    });
    expect(destination[1]).toMatchObject({
      directionX: 1,
      directionY: 0,
      brightnessS: 1,
      brightnessP: 0,
      membership: Uint8Array.of(0)
    });
  });

  it('does not evaluate the bulk index branch for a plain surface', () => {
    const description = baseDescription();
    description.types.bulks = [bulkType(parseFormula(
      'n = sqrt(-1); alpha = 0',
      []
    ))];
    description.regions[0].params = {};
    description.types.surfaces = [{
      definition: {
        name: 'Plain mirror',
        paramNames: [],
        outRayCount: 1,
        dag: parseFormula(
          'd_1x=d_0x; d_1y=-d_0y; P_1s=P_0s; P_1p=P_0p',
          ['d_0x', 'd_0y', 'P_0s', 'P_0p']
        )
      }
    }];
    description.surfaces = [{
      surfaceTypeId: 0,
      params: {}
    }];
    description.curves = [{
      ownerKind: 'surface',
      ownerId: 0
    }];
    const prepared = prepareCpuOutgoingRayData(description);
    const destination = new Array(1);

    const activeCount = writeCpuOutgoingRays({
      description,
      prepared,
      type: {
        kind: 'surface',
        typeId: 0,
        outRayCount: 1,
        interactionCount: 1,
        destinationRayStart: 0
      },
      localInteractionIndex: 0,
      sourceRay,
      hit: hit(),
      destinationRayBuffer: destination,
      detectorResults: []
    });

    expect(activeCount).toBe(1);
    expect(destination[0]).toMatchObject({
      brightnessS: 1,
      brightnessP: 0.5
    });
  });

  it('writes transmitted then reflected Fresnel outputs', () => {
    const description = baseDescription();
    const prepared = prepareCpuOutgoingRayData(description);
    const destination = new Array(2);

    const activeCount = writeCpuOutgoingRays({
      description,
      prepared,
      type: {
        kind: 'regionBoundary',
        fresnel: true,
        outRayCount: 2,
        interactionCount: 1,
        destinationRayStart: 0
      },
      localInteractionIndex: 0,
      sourceRay,
      hit: hit(),
      destinationRayBuffer: destination,
      detectorResults: []
    });

    expect(activeCount).toBe(2);
    expect(destination[0]).toMatchObject({
      directionX: 1,
      directionY: 0,
      membership: Uint8Array.of(0)
    });
    expect(destination[0].brightnessS).toBeCloseTo(0.96);
    expect(destination[0].brightnessP).toBeCloseTo(0.48);
    expect(destination[1]).toMatchObject({
      directionX: -1,
      directionY: 0,
      membership: Uint8Array.of(1)
    });
    expect(destination[1].brightnessS).toBeCloseTo(0.04);
    expect(destination[1].brightnessP).toBeCloseTo(0.02);
  });

  it('uses every active bulk region for a GRIN step', () => {
    const description = baseDescription();
    description.types.bulks = [bulkType(parseFormula(
      'n = 1; alpha = 0; n_x = 0; n_y = 0.1',
      []
    ))];
    description.regions[0].params = {};
    const prepared = prepareCpuOutgoingRayData(description);
    const destination = new Array(1);

    writeCpuOutgoingRays({
      description,
      prepared,
      type: {
        kind: 'grinStep',
        outRayCount: 1,
        interactionCount: 1,
        destinationRayStart: 0
      },
      localInteractionIndex: 0,
      sourceRay,
      hit: hit({ curveId: -1 }),
      destinationRayBuffer: destination,
      detectorResults: []
    });

    expect(destination[0]).toMatchObject({
      originX: 1,
      originY: 0,
      membership: Uint8Array.of(1)
    });
    expect(destination[0].directionX).toBeCloseTo(
      1 / Math.hypot(1, 0.1)
    );
    expect(destination[0].directionY).toBeCloseTo(
      0.1 / Math.hypot(1, 0.1)
    );
  });

  it('accumulates detector writes and continues the ray', () => {
    const description = baseDescription();
    description.types.detectors = [{
      definition: {
        name: 'Detector',
        paramNames: [],
        writeCount: 1,
        dag: parseFormula(
          'k_1 = 1; v_1 = P_0s + P_0p',
          ['P_0s', 'P_0p']
        )
      }
    }];
    description.detectors = [{
      detectorTypeId: 0,
      params: {},
      resultId: 0,
      resultSize: 3
    }];
    description.curves = [{
      ownerKind: 'detector',
      ownerId: 0
    }];
    const prepared = prepareCpuOutgoingRayData(description);
    const detectorResults =
      createCpuDetectorResults(description);
    const destination = new Array(1);

    writeCpuOutgoingRays({
      description,
      prepared,
      type: {
        kind: 'detector',
        typeId: 0,
        outRayCount: 1,
        interactionCount: 1,
        destinationRayStart: 0
      },
      localInteractionIndex: 0,
      sourceRay,
      hit: hit({
        regionCrossingMask: Uint8Array.of(0)
      }),
      destinationRayBuffer: destination,
      detectorResults
    });

    expect(Array.from(detectorResults[0])).toEqual([0, 1.5, 0]);
    expect(destination[0]).toMatchObject({
      originX: 1,
      directionX: 1,
      brightnessS: 1,
      brightnessP: 0.5,
      membership: Uint8Array.of(1)
    });
  });
});
