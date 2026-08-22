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

import { buildBvh } from '../../src/core/primitive/bvh.js';
import { traverseBvhForInteraction } from '../../src/core/primitive/bvhTraversal.js';
import { prepareCurve } from '../../src/core/primitive/curveGeometry.js';
import {
  createInteractionCandidate,
  createInteractionCandidateContext,
  finalizeInteractionCandidate
} from '../../src/core/primitive/interactionCandidate.js';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric.js';

function createVerticalSurface(curveId, x) {
  const prepared = prepareCurve({
    kind: 'lineSegment',
    params: {
      start: { x, y: -1 },
      end: { x, y: 1 }
    }
  }, {
    numericEpsilon: FLOAT32_EPSILON
  });
  return {
    curveId,
    bounds: prepared.bounds,
    geometry: prepared.geometry,
    ownerKind: 'surface',
    ownerId: curveId,
    twoSided: true,
    mergesWithBoundary: false,
    filter: null
  };
}

describe('interaction BVH traversal', () => {
  it('prunes against the initial candidate distance before finding a curve', () => {
    const curves = [createVerticalSurface(0, 10)];
    const builtBvh = buildBvh(curves, {
      numericEpsilon: FLOAT32_EPSILON
    });
    const description = {
      numericalTolerances: {},
      curves,
      regions: [],
      bvh: {
        root: builtBvh.root,
        nodes: builtBvh.nodes,
        curveIds: Uint32Array.of(0)
      }
    };
    const context = createInteractionCandidateContext(
      description,
      FLOAT32_EPSILON
    );
    const candidate = createInteractionCandidate(0, 5);

    traverseBvhForInteraction(
      description,
      {
        originX: 0,
        originY: 0,
        directionX: 1,
        directionY: 0,
        wavelength: 540
      },
      candidate,
      context
    );

    expect(candidate).toMatchObject({ s: 5, curveId: -1 });
  });

  it('visits the nearer child first and prunes a separated farther child', () => {
    const curves = [
      createVerticalSurface(0, 2),
      createVerticalSurface(1, 10)
    ];
    const builtBvh = buildBvh(curves, {
      lineLeafSize: 1,
      numericEpsilon: FLOAT32_EPSILON
    });
    const description = {
      numericalTolerances: {},
      curves,
      regions: [],
      bvh: {
        root: builtBvh.root,
        nodes: builtBvh.nodes,
        curveIds: Uint32Array.from(
          builtBvh.entries.map(entry => entry.curveId)
        )
      }
    };
    const ray = {
      originX: 0,
      originY: 0,
      directionX: 1,
      directionY: 0,
      wavelength: 540
    };
    const context = createInteractionCandidateContext(
      description,
      FLOAT32_EPSILON
    );
    const candidate = createInteractionCandidate(0);
    traverseBvhForInteraction(
      description,
      ray,
      candidate,
      context
    );

    expect(finalizeInteractionCandidate(candidate, context, ray))
      .toBe(candidate);
    expect(candidate).toMatchObject({ s: 2, curveId: 0 });
  });
});
