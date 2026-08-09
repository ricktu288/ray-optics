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

import { updateInteractionCandidate } from './interactionCandidate.js';

export const BVH_NODE_UNVISITED = 0;
export const BVH_NODE_MISSED = 1;
export const BVH_NODE_PRUNED = 2;
export const BVH_NODE_TRAVERSED = 3;

/**
 * Attach CPU-only traversal diagnostics to the host-created scene description.
 * The CPU engine mutates these arrays through the same object reference.
 *
 * @param {Object} description
 * @returns {Object} The attached diagnostics.
 */
export function attachCpuBvhTraversalDiagnostics(description) {
  const diagnostics = {
    nodeStates: new Uint8Array(description.bvh.nodes.length),
    testedCurves: new Uint8Array(description.curves.length)
  };
  description.cpuBvhTraversalDiagnostics = diagnostics;
  return diagnostics;
}

/**
 * Traverse the prepared curve BVH using an explicit stack and update an
 * interaction candidate for every curve in a reached leaf.
 *
 * Each stack item is stored as two consecutive numbers: node index followed
 * by the ray's entry distance into that node. The farther child is pushed
 * first so the nearer child is popped first. When the farther child is later
 * popped, a candidate found in the nearer subtree can prune it immediately.
 *
 * @param {Object} description
 * @param {Object} ray
 * @param {Object} candidate
 * @param {Object} candidateContext
 * @param {{nodeStates: Uint8Array, testedCurves: Uint8Array}} [diagnostics] - Optional CPU-only state accumulated across traversals.
 */
export function traverseBvhForInteraction(
  description,
  ray,
  candidate,
  candidateContext,
  diagnostics
) {
  const { root, nodes, curveIds } = description.bvh;
  if (root < 0) return;

  const rootNear = intersectRayBounds(
    ray,
    nodes[root].bounds,
    candidateContext.forwardDistance
  );
  if (!Number.isFinite(rootNear)) {
    markBvhNodeState(diagnostics, root, BVH_NODE_MISSED);
    return;
  }

  const stack = [root, rootNear];
  while (stack.length > 0) {
    const near = stack.pop();
    const nodeIndex = stack.pop();
    if (near > candidate.s) {
      markBvhNodeState(diagnostics, nodeIndex, BVH_NODE_PRUNED);
      continue;
    }
    markBvhNodeState(diagnostics, nodeIndex, BVH_NODE_TRAVERSED);

    const node = nodes[nodeIndex];
    if (node.count > 0) {
      for (let offset = 0; offset < node.count; offset++) {
        const curveId = curveIds[node.start + offset];
        if (diagnostics) diagnostics.testedCurves[curveId] = 1;
        updateInteractionCandidate(
          candidate,
          candidateContext,
          curveId,
          ray
        );
      }
      continue;
    }

    const childStackStart = stack.length;
    for (const childIndex of node.children) {
      const childNear = testChildBounds(
        nodes,
        childIndex,
        ray,
        candidateContext.forwardDistance,
        diagnostics
      );
      if (!Number.isFinite(childNear) || childNear > candidate.s) continue;
      const previousEnd = stack.length;
      stack.length = previousEnd + 2;
      let position = previousEnd;
      while (position > childStackStart && stack[position - 1] <= childNear) {
        stack[position] = stack[position - 2];
        stack[position + 1] = stack[position - 1];
        position -= 2;
      }
      stack[position] = childIndex;
      stack[position + 1] = childNear;
    }
  }
}

function testChildBounds(
  nodes,
  nodeIndex,
  ray,
  minDistance,
  diagnostics
) {
  const near = intersectRayBounds(
    ray,
    nodes[nodeIndex].bounds,
    minDistance
  );
  if (!Number.isFinite(near)) {
    markBvhNodeState(diagnostics, nodeIndex, BVH_NODE_MISSED);
  }
  return near;
}

export function intersectRayBounds(ray, bounds, minDistance) {
  let near = -Infinity;
  let far = Infinity;

  if (ray.directionX === 0) {
    if (ray.originX < bounds.minX || ray.originX > bounds.maxX) {
      return Infinity;
    }
  } else {
    const inverseDirectionX = 1 / ray.directionX;
    const firstX = (bounds.minX - ray.originX) * inverseDirectionX;
    const secondX = (bounds.maxX - ray.originX) * inverseDirectionX;
    near = Math.max(near, Math.min(firstX, secondX));
    far = Math.min(far, Math.max(firstX, secondX));
    if (near > far) return Infinity;
  }

  if (ray.directionY === 0) {
    if (ray.originY < bounds.minY || ray.originY > bounds.maxY) {
      return Infinity;
    }
  } else {
    const inverseDirectionY = 1 / ray.directionY;
    const firstY = (bounds.minY - ray.originY) * inverseDirectionY;
    const secondY = (bounds.maxY - ray.originY) * inverseDirectionY;
    near = Math.max(near, Math.min(firstY, secondY));
    far = Math.min(far, Math.max(firstY, secondY));
  }

  return near <= far && far > minDistance
    ? Math.max(near, minDistance)
    : Infinity;
}

export function markBvhNodeState(diagnostics, nodeIndex, state) {
  if (
    diagnostics &&
    state > diagnostics.nodeStates[nodeIndex]
  ) {
    diagnostics.nodeStates[nodeIndex] = state;
  }
}
