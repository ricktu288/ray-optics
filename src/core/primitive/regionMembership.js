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

import { BVH_OWNER_KIND_MASKS } from './bvh.js';
import {
  BVH_NODE_MISSED,
  BVH_NODE_TRAVERSED,
  intersectRayBounds,
  markBvhNodeState
} from './bvhTraversal.js';
import { countCurveRayCrossings } from './curveRayCrossings.js';
import { getIntersectionTolerancePolicy } from './numeric.js';

/**
 * Create reusable output storage for one region-membership ray cast.
 *
 * @param {number} regionCount
 * @returns {Object}
 */
export function createRegionMembershipResult(regionCount) {
  return {
    regionMask: new Uint8Array(regionCount),
    ambiguousRegionMask: new Uint8Array(regionCount),
    ambiguousCurveId: -1,
    nearestForwardS: Infinity,
    discardRay: false
  };
}

/**
 * Determine region membership by counting every forward region-boundary
 * crossing reached through the BVH. Nodes without region boundaries are
 * ignored using their owner-kind mask.
 *
 * @param {Object} description
 * @param {Object} ray
 * @param {Object} result
 * @param {number} numericEpsilon
 * @param {Object} [diagnostics]
 * @returns {Object}
 */
export function traverseBvhForRegionMembership(
  description,
  ray,
  result,
  numericEpsilon,
  diagnostics
) {
  result.regionMask.fill(0);
  result.ambiguousRegionMask.fill(0);
  result.ambiguousCurveId = -1;
  result.nearestForwardS = Infinity;
  result.discardRay = false;

  const { root, nodes, curveIds } = description.bvh;
  if (
    root < 0 ||
    !(nodes[root].ownerKindMask & BVH_OWNER_KIND_MASKS.region)
  ) {
    return result;
  }

  const originTolerance =
    description.numericalTolerances?.forwardDistance ?? 0;
  const tolerancePolicy = getIntersectionTolerancePolicy(numericEpsilon);
  if (!Number.isFinite(intersectRayBounds(
    ray,
    nodes[root].bounds,
    0
  ))) {
    markBvhNodeState(diagnostics, root, BVH_NODE_MISSED);
    return result;
  }

  const crossing = {};
  const stack = [root];
  while (stack.length > 0) {
    const nodeIndex = stack.pop();
    const node = nodes[nodeIndex];
    markBvhNodeState(diagnostics, nodeIndex, BVH_NODE_TRAVERSED);

    if (node.count > 0) {
      for (let offset = 0; offset < node.count; offset++) {
        const curveId = curveIds[node.start + offset];
        const curve = description.curves[curveId];
        if (curve.ownerKind !== 'region') continue;
        if (diagnostics) diagnostics.testedCurves[curveId] = 1;

        countCurveRayCrossings(
          curve.geometry,
          ray,
          {
            numericEpsilon,
            tolerancePolicy,
            originTolerance: Math.max(
              curve.geometry.positionTolerance,
              originTolerance
            )
          },
          crossing
        );
        result.nearestForwardS = Math.min(
          result.nearestForwardS,
          crossing.nearestForwardS
        );
        if (crossing.count & 1) {
          result.regionMask[curve.ownerId] ^= 1;
        }
        if (crossing.ambiguous) {
          result.ambiguousRegionMask[curve.ownerId] = 1;
          if (result.ambiguousCurveId < 0) {
            result.ambiguousCurveId = curveId;
          }
        }
      }
      continue;
    }

    testAndPushRegionChild(
      description,
      ray,
      node.left,
      diagnostics,
      stack
    );
    testAndPushRegionChild(
      description,
      ray,
      node.right,
      diagnostics,
      stack
    );
  }
  if (!Number.isFinite(result.nearestForwardS)) {
    result.regionMask.fill(0);
    result.ambiguousRegionMask.fill(0);
    result.ambiguousCurveId = -1;
  }
  return result;
}

function testAndPushRegionChild(
  description,
  ray,
  nodeIndex,
  diagnostics,
  stack
) {
  const node = description.bvh.nodes[nodeIndex];
  if (!(node.ownerKindMask & BVH_OWNER_KIND_MASKS.region)) return;
  if (Number.isFinite(intersectRayBounds(
    ray,
    node.bounds,
    0
  ))) {
    stack.push(nodeIndex);
  } else {
    markBvhNodeState(diagnostics, nodeIndex, BVH_NODE_MISSED);
  }
}
