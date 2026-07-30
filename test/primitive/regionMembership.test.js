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

import { buildBvh } from '../../src/core/primitive/bvh';
import {
  attachCpuBvhTraversalDiagnostics,
  BVH_NODE_PRUNED,
  BVH_NODE_UNVISITED
} from '../../src/core/primitive/bvhTraversal';
import { prepareCurve } from '../../src/core/primitive/curveGeometry';
import {
  createRegionMembershipResult,
  traverseBvhForRegionMembership
} from '../../src/core/primitive/regionMembership';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric';

function lineCurve(
  curveId,
  ownerKind,
  ownerId,
  x1,
  y1,
  x2,
  y2
) {
  const prepared = prepareCurve({
    kind: 'lineSegment',
    params: {
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 }
    }
  }, {
    numericEpsilon: FLOAT32_EPSILON
  });
  return {
    curveId,
    ownerKind,
    ownerId,
    geometry: prepared.geometry,
    bounds: prepared.bounds
  };
}

function createDescription() {
  const curves = [
    lineCurve(0, 'region', 0, 0, 0, 10, 0),
    lineCurve(1, 'region', 0, 10, 0, 10, 10),
    lineCurve(2, 'region', 0, 10, 10, 0, 10),
    lineCurve(3, 'region', 0, 0, 10, 0, 0),
    lineCurve(4, 'surface', 0, 6, 2, 6, 8)
  ];
  const builtBvh = buildBvh(curves, {
    lineLeafSize: 1,
    numericEpsilon: FLOAT32_EPSILON
  });
  return {
    numericalTolerances: {},
    regions: [{}],
    curves,
    bvh: {
      root: builtBvh.root,
      nodes: builtBvh.nodes,
      curveIds: Uint32Array.from(
        builtBvh.entries.map(entry => entry.curveId)
      )
    }
  };
}

function cast(description, originX, originY, directionX, directionY) {
  const result = createRegionMembershipResult(
    description.regions.length
  );
  const diagnostics = attachCpuBvhTraversalDiagnostics(description);
  traverseBvhForRegionMembership(
    description,
    { originX, originY, directionX, directionY },
    result,
    FLOAT32_EPSILON,
    diagnostics
  );
  return { result, diagnostics };
}

describe('region-membership BVH traversal', () => {
  it('uses crossing parity and never distance-prunes region nodes', () => {
    const description = createDescription();

    const inside = cast(description, 5, 5, 1, 0);
    const outside = cast(description, -5, 5, 1, 0);

    expect(Array.from(inside.result.regionMask)).toEqual([1]);
    expect(Array.from(outside.result.regionMask)).toEqual([0]);
    expect(inside.result.nearestForwardS).toBe(5);
    expect(inside.result.ambiguousCurveId).toBe(-1);
    expect(Array.from(inside.diagnostics.nodeStates))
      .not.toContain(BVH_NODE_PRUNED);
    expect(Array.from(outside.diagnostics.nodeStates))
      .not.toContain(BVH_NODE_PRUNED);
  });

  it('treats no forward boundary as outside and ignores the origin boundary', () => {
    const description = createDescription();

    const noForwardBoundary = cast(description, -5, 5, -1, 0);
    const fromBoundaryIntoRegion = cast(description, 0, 5, 1, 0);

    expect(noForwardBoundary.result).toMatchObject({
      nearestForwardS: Infinity,
      ambiguousCurveId: -1
    });
    expect(Array.from(noForwardBoundary.result.regionMask)).toEqual([0]);
    expect(Array.from(fromBoundaryIntoRegion.result.regionMask))
      .toEqual([1]);
    expect(fromBoundaryIntoRegion.result.ambiguousCurveId).toBe(-1);
  });

  it('does not enter nodes containing no region boundaries', () => {
    const description = createDescription();
    const { diagnostics } = cast(description, 5, 5, 1, 0);
    const surfaceLeafIndex = description.bvh.nodes.findIndex(node =>
      node.count > 0 &&
      Array.from(
        description.bvh.curveIds.slice(
          node.start,
          node.start + node.count
        )
      ).includes(4)
    );

    expect(surfaceLeafIndex).toBeGreaterThanOrEqual(0);
    expect(diagnostics.nodeStates[surfaceLeafIndex])
      .toBe(BVH_NODE_UNVISITED);
    expect(diagnostics.testedCurves[4]).toBe(0);
  });

  it('marks an endpoint crossing as ambiguous without retrying', () => {
    const description = createDescription();

    const { result } = cast(description, 5, 5, 1, 1);

    expect(result.ambiguousCurveId).toBeGreaterThanOrEqual(0);
    expect(Array.from(result.ambiguousRegionMask)).toEqual([1]);
  });
});
