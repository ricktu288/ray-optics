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

import { prepareCurve } from '../../src/core/primitive/curveGeometry.js';
import {
  createInteractionCandidate,
  createInteractionCandidateContext,
  finalizeInteractionCandidate,
  updateInteractionCandidate
} from '../../src/core/primitive/interactionCandidate.js';
import {
  ensureCurveIntersectionNormal
} from '../../src/core/primitive/nearestIntersection.js';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric.js';

function createDescription(twoSided) {
  const geometry = prepareCurve({
    kind: 'lineSegment',
    params: {
      start: { x: 5, y: -1 },
      end: { x: 5, y: 1 }
    }
  }, {
    numericEpsilon: FLOAT32_EPSILON
  }).geometry;
  return {
    numericalTolerances: {},
    curves: [{
      geometry,
      ownerKind: 'surface',
      ownerId: 0,
      twoSided,
      filter: null
    }],
    regions: []
  };
}

const ray = {
  originX: 0,
  originY: 0,
  directionX: 1,
  directionY: 0,
  wavelength: 540
};

describe('interaction candidate updates', () => {
  it('uses the initial candidate distance as the first-hit limit', () => {
    const description = createDescription(true);
    const beforeSurfaceContext = createInteractionCandidateContext(
      description,
      FLOAT32_EPSILON,
      4
    );
    const atSurfaceContext = createInteractionCandidateContext(
      description,
      FLOAT32_EPSILON,
      5
    );
    const beforeSurface = createInteractionCandidate(0, 4);
    const atSurface = createInteractionCandidate(0, 5);

    updateInteractionCandidate(
      beforeSurface,
      beforeSurfaceContext,
      0,
      ray
    );
    updateInteractionCandidate(atSurface, atSurfaceContext, 0, ray);

    expect(beforeSurface).toMatchObject({
      s: 4,
      curveId: -1
    });
    expect(atSurface).toMatchObject({
      s: 5,
      curveId: 0
    });
  });

  it('merges a hit into an empty finite candidate at the step limit', () => {
    const description = createDescription(true);
    description.numericalTolerances.surfaceMerging = 0.001;
    description.curves[0].geometry = prepareCurve({
      kind: 'lineSegment',
      params: {
        start: { x: 5.0005, y: -1 },
        end: { x: 5.0005, y: 1 }
      }
    }, {
      numericEpsilon: FLOAT32_EPSILON
    }).geometry;
    const context = createInteractionCandidateContext(
      description,
      FLOAT32_EPSILON,
      5
    );
    const candidate = createInteractionCandidate(0, 5);

    updateInteractionCandidate(candidate, context, 0, ray);

    expect(candidate).toMatchObject({
      s: 5.0005,
      curveId: 0
    });
  });

  it('rejects merged hits beyond the original distance limit', () => {
    const description = createDescription(true);
    description.numericalTolerances.surfaceMerging = 0.001;
    description.curves.push({
      ...description.curves[0],
      geometry: prepareCurve({
        kind: 'lineSegment',
        params: {
          start: { x: 5.0005, y: -1 },
          end: { x: 5.0005, y: 1 }
        }
      }, {
        numericEpsilon: FLOAT32_EPSILON
      }).geometry,
      ownerId: 1
    });
    const maximumDistance = 5.00025;
    const context = createInteractionCandidateContext(
      description,
      FLOAT32_EPSILON,
      maximumDistance
    );
    const candidate = createInteractionCandidate(0, maximumDistance);

    updateInteractionCandidate(candidate, context, 0, ray);
    updateInteractionCandidate(candidate, context, 1, ray);

    expect(candidate).toMatchObject({
      s: 5,
      curveId: 0,
      conflictType: 0,
      conflictCurveId: -1
    });
  });

  it('populates a two-sided candidate normal only when requested', () => {
    const description = createDescription(true);
    const context = createInteractionCandidateContext(
      description,
      FLOAT32_EPSILON
    );
    const candidate = createInteractionCandidate(0);

    updateInteractionCandidate(candidate, context, 0, ray);

    expect(candidate).toMatchObject({
      s: 5,
      curveId: 0,
      normalX: 0,
      normalY: 0,
      sigma: 0
    });
    expect(ensureCurveIntersectionNormal(
      description.curves[candidate.curveId].geometry,
      ray,
      candidate,
      { numericEpsilon: FLOAT32_EPSILON }
    )).toBe(candidate);
    const resolvedNormal = {
      normalX: candidate.normalX,
      normalY: candidate.normalY,
      sigma: candidate.sigma
    };

    expect(ensureCurveIntersectionNormal(
      description.curves[candidate.curveId].geometry,
      ray,
      candidate,
      { numericEpsilon: FLOAT32_EPSILON }
    )).toBe(candidate);
    expect(candidate).toMatchObject(resolvedNormal);
    expect(finalizeInteractionCandidate(candidate, context, ray))
      .toBe(candidate);
  });

  it('resolves and filters a one-sided hit during its curve update', () => {
    const description = createDescription(false);
    const context = createInteractionCandidateContext(
      description,
      FLOAT32_EPSILON
    );
    const candidate = createInteractionCandidate(0);

    updateInteractionCandidate(candidate, context, 0, ray);

    expect(candidate).toMatchObject({
      s: 5,
      curveId: 0,
      normalX: -1,
      normalY: 0,
      sigma: 1
    });

    const rejectedCandidate = createInteractionCandidate(0);
    updateInteractionCandidate(rejectedCandidate, context, 0, {
      ...ray,
      originX: 10,
      directionX: -1
    });
    expect(rejectedCandidate.curveId).toBe(-1);
  });
});
