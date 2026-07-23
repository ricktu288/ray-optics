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

const TWO_PI = Math.PI * 2;
const ROOT_EPSILON = 1e-12;
const SCENE_EPSILON_RATIO = 1e-9;
const MORTON_COORDINATE_MAX = 0x7fff;

export const DEFAULT_BVH_OPTIONS = Object.freeze({
  maxLeafSize: 4,
  maxGroupExtent: 100,
  consecutiveLocalityFactor: 2
});

/**
 * Calculate the axis-aligned bounding box of a primitive curve.
 * @param {PrimitiveCurve} curve - The primitive curve.
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}} The curve bounds.
 */
export function getCurveBounds(curve) {
  switch (curve.kind) {
    case 'lineSegment':
      return boundsFromPoints([curve.params.start, curve.params.end]);
    case 'circularArc':
      return getCircularArcBounds(curve.params);
    case 'cubicBezier':
      return getCubicBezierBounds(curve.params);
    case 'circle':
      return getCircleBounds(curve.params);
    default:
      throw new TypeError(`Unsupported primitive curve kind: ${JSON.stringify(curve.kind)}`);
  }
}

/**
 * Build a BVH for primitive-curve entries.
 *
 * Spatially consecutive entries are first grouped without regard to their
 * originating scene object. Each group is built directly from index order,
 * while the group roots are arranged by Morton order. A group ends when two
 * adjacent curve bounds are no longer local or when its bounds exceed the
 * configured maximum extent.
 *
 * @param {Array<{curve: PrimitiveCurve}>} curveEntries - Entries containing primitive curves.
 * @param {Object} [options]
 * @param {number} [options.maxLeafSize=4] - Maximum number of curves in a leaf.
 * @param {number} [options.maxGroupExtent=100] - Maximum group width or height in scene coordinates.
 * @param {number} [options.consecutiveLocalityFactor=2] - Maximum adjacent AABB gap, relative to the larger curve extent.
 * @returns {{root: number, nodes: Array<Object>, entries: Array<Object>}} The BVH.
 */
export function buildBvh(curveEntries, {
  maxLeafSize = DEFAULT_BVH_OPTIONS.maxLeafSize,
  maxGroupExtent = DEFAULT_BVH_OPTIONS.maxGroupExtent,
  consecutiveLocalityFactor = DEFAULT_BVH_OPTIONS.consecutiveLocalityFactor
} = {}) {
  if (!Array.isArray(curveEntries)) {
    throw new TypeError('curveEntries must be an array.');
  }
  if (!Number.isInteger(maxLeafSize) || maxLeafSize < 1) {
    throw new RangeError('maxLeafSize must be a positive integer.');
  }
  if (!Number.isFinite(maxGroupExtent) || maxGroupExtent <= 0) {
    throw new RangeError('maxGroupExtent must be positive and finite.');
  }
  if (!Number.isFinite(consecutiveLocalityFactor) || consecutiveLocalityFactor < 0) {
    throw new RangeError('consecutiveLocalityFactor must be nonnegative and finite.');
  }

  const items = curveEntries.map(entry => {
    const bounds = getCurveBounds(entry.curve);
    return {
      ...entry,
      bounds,
      centroidX: (bounds.minX + bounds.maxX) * 0.5,
      centroidY: (bounds.minY + bounds.maxY) * 0.5
    };
  });
  const nodes = [];
  const orderedEntries = [];

  if (items.length === 0) {
    return {
      root: -1,
      nodes,
      entries: orderedEntries
    };
  }

  const addLeaf = (startIndex, endIndex) => {
    const nodeIndex = nodes.length;
    const start = orderedEntries.length;
    for (let index = startIndex; index < endIndex; index++) {
      const { centroidX, centroidY, ...entry } = items[index];
      orderedEntries.push(entry);
    }
    nodes.push({
      bounds: getItemRangeBounds(items, startIndex, endIndex),
      depth: 0,
      start,
      count: endIndex - startIndex,
      left: -1,
      right: -1
    });
    return nodeIndex;
  };

  const addParent = (left, right) => {
    const nodeIndex = nodes.length;
    nodes.push({
      bounds: combineBounds(nodes[left].bounds, nodes[right].bounds),
      depth: 0,
      start: -1,
      count: 0,
      left,
      right
    });
    return nodeIndex;
  };

  const buildBalancedRootRange = (roots, startIndex, endIndex) => {
    if (endIndex - startIndex === 1) {
      return roots[startIndex];
    }
    const midpoint = startIndex + Math.floor((endIndex - startIndex) * 0.5);
    const left = buildBalancedRootRange(roots, startIndex, midpoint);
    const right = buildBalancedRootRange(roots, midpoint, endIndex);
    return addParent(left, right);
  };

  const buildIndexGroup = (startIndex, endIndex) => {
    const leafRoots = [];
    for (let index = startIndex; index < endIndex; index += maxLeafSize) {
      leafRoots.push(addLeaf(index, Math.min(index + maxLeafSize, endIndex)));
    }
    return buildBalancedRootRange(leafRoots, 0, leafRoots.length);
  };

  const sceneBounds = getItemRangeBounds(items, 0, items.length);
  const sceneExtent = getBoundsExtent(sceneBounds) || 1;
  const sceneEpsilon = sceneExtent * SCENE_EPSILON_RATIO;
  const groupRoots = [];
  let groupStart = 0;
  let groupBounds = items[0].bounds;

  for (let index = 1; index < items.length; index++) {
    const candidateBounds = combineBounds(groupBounds, items[index].bounds);
    if (
      !boundsAreLocallyConsecutive(
        items[index - 1].bounds,
        items[index].bounds,
        consecutiveLocalityFactor,
        sceneEpsilon
      ) ||
      getBoundsExtent(candidateBounds) > maxGroupExtent
    ) {
      groupRoots.push(buildIndexGroup(groupStart, index));
      groupStart = index;
      groupBounds = items[index].bounds;
    } else {
      groupBounds = candidateBounds;
    }
  }
  groupRoots.push(buildIndexGroup(groupStart, items.length));

  const root = buildMortonRootHierarchy(groupRoots, nodes, addParent);
  assignNodeDepths(root, nodes);

  return {
    root,
    nodes,
    entries: orderedEntries
  };
}

function buildMortonRootHierarchy(roots, nodes, addParent) {
  if (roots.length === 1) {
    return roots[0];
  }

  const items = roots.map((root, order) => {
    const bounds = nodes[root].bounds;
    return {
      root,
      order,
      centroidX: (bounds.minX + bounds.maxX) * 0.5,
      centroidY: (bounds.minY + bounds.maxY) * 0.5,
      mortonCode: 0
    };
  });
  assignMortonCodes(items);
  items.sort((a, b) => a.mortonCode - b.mortonCode || a.order - b.order);

  const buildRange = (startIndex, endIndex) => {
    if (endIndex - startIndex === 1) {
      return items[startIndex].root;
    }
    const midpoint = findMortonBoundary(items, startIndex, endIndex);
    const left = buildRange(startIndex, midpoint);
    const right = buildRange(midpoint, endIndex);
    return addParent(left, right);
  };
  return buildRange(0, items.length);
}

function assignMortonCodes(items) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    minX = Math.min(minX, item.centroidX);
    minY = Math.min(minY, item.centroidY);
    maxX = Math.max(maxX, item.centroidX);
    maxY = Math.max(maxY, item.centroidY);
  }
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;

  for (const item of items) {
    const x = Math.max(0, Math.min(
      MORTON_COORDINATE_MAX,
      Math.floor((item.centroidX - minX) / width * MORTON_COORDINATE_MAX)
    ));
    const y = Math.max(0, Math.min(
      MORTON_COORDINATE_MAX,
      Math.floor((item.centroidY - minY) / height * MORTON_COORDINATE_MAX)
    ));
    item.mortonCode = (expandMortonBits(x) | expandMortonBits(y) << 1) >>> 0;
  }
}

function expandMortonBits(value) {
  let expanded = value & MORTON_COORDINATE_MAX;
  expanded = (expanded | expanded << 8) & 0x00ff00ff;
  expanded = (expanded | expanded << 4) & 0x0f0f0f0f;
  expanded = (expanded | expanded << 2) & 0x33333333;
  expanded = (expanded | expanded << 1) & 0x55555555;
  return expanded;
}

function findMortonBoundary(items, startIndex, endIndex) {
  const firstCode = items[startIndex].mortonCode;
  const lastCode = items[endIndex - 1].mortonCode;
  if (firstCode === lastCode) {
    return startIndex + Math.floor((endIndex - startIndex) * 0.5);
  }

  const commonPrefixLength = Math.clz32(firstCode ^ lastCode);
  let splitIndex = startIndex;
  let step = endIndex - startIndex;
  do {
    step = Math.floor((step + 1) * 0.5);
    const candidateIndex = splitIndex + step;
    if (candidateIndex < endIndex - 1) {
      const candidatePrefixLength = Math.clz32(
        firstCode ^ items[candidateIndex].mortonCode
      );
      if (candidatePrefixLength > commonPrefixLength) {
        splitIndex = candidateIndex;
      }
    }
  } while (step > 1);
  return splitIndex + 1;
}

function boundsAreLocallyConsecutive(
  previousBounds,
  nextBounds,
  localityFactor,
  sceneEpsilon
) {
  const localScale = Math.max(
    getBoundsExtent(previousBounds),
    getBoundsExtent(nextBounds),
    sceneEpsilon
  );
  const maximumGap = localityFactor * localScale;
  return getBoundsGapSquared(previousBounds, nextBounds) <= maximumGap * maximumGap;
}

function getBoundsGapSquared(a, b) {
  const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
  const dy = Math.max(0, a.minY - b.maxY, b.minY - a.maxY);
  return dx * dx + dy * dy;
}

function getBoundsExtent(bounds) {
  return Math.max(
    bounds.maxX - bounds.minX,
    bounds.maxY - bounds.minY
  );
}

function getItemRangeBounds(items, startIndex, endIndex) {
  let bounds = items[startIndex].bounds;
  for (let index = startIndex + 1; index < endIndex; index++) {
    bounds = combineBounds(bounds, items[index].bounds);
  }
  return bounds;
}

function combineBounds(a, b) {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  };
}

function assignNodeDepths(root, nodes) {
  const stack = [{ nodeIndex: root, depth: 0 }];
  while (stack.length > 0) {
    const { nodeIndex, depth } = stack.pop();
    const node = nodes[nodeIndex];
    node.depth = depth;
    if (node.count === 0) {
      stack.push(
        { nodeIndex: node.right, depth: depth + 1 },
        { nodeIndex: node.left, depth: depth + 1 }
      );
    }
  }
}

function getCircularArcBounds({ start, end, bulge }) {
  if (bulge === 0) {
    return boundsFromPoints([start, end]);
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const chordLength = Math.hypot(dx, dy);

  const midpointX = (start.x + end.x) * 0.5;
  const midpointY = (start.y + end.y) * 0.5;
  const centerOffset = chordLength * (1 - bulge * bulge) / (4 * bulge);
  const center = {
    x: midpointX - dy / chordLength * centerOffset,
    y: midpointY + dx / chordLength * centerOffset
  };
  const radius = chordLength * (1 + bulge * bulge) / (4 * Math.abs(bulge));
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const sweep = 4 * Math.atan(bulge);
  const points = [start, end];

  for (const angle of [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]) {
    if (angleIsOnSweep(angle, startAngle, sweep)) {
      points.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle)
      });
    }
  }
  return boundsFromPoints(points);
}

function getCubicBezierBounds({ start, control1, control2, end }) {
  const points = [start, control1, control2, end];

  const candidates = [0, 1];
  candidates.push(...getCubicDerivativeRoots(start.x, control1.x, control2.x, end.x));
  candidates.push(...getCubicDerivativeRoots(start.y, control1.y, control2.y, end.y));

  return boundsFromPoints(candidates.map(t => evaluateCubicBezier(points, t)));
}

function getCircleBounds({ center, radius }) {
  const absoluteRadius = Math.abs(radius);
  return {
    minX: center.x - absoluteRadius,
    minY: center.y - absoluteRadius,
    maxX: center.x + absoluteRadius,
    maxY: center.y + absoluteRadius
  };
}

function getCubicDerivativeRoots(p0, p1, p2, p3) {
  const a = 3 * (-p0 + 3 * p1 - 3 * p2 + p3);
  const b = 6 * (p0 - 2 * p1 + p2);
  const c = 3 * (p1 - p0);

  if (Math.abs(a) <= ROOT_EPSILON) {
    if (Math.abs(b) <= ROOT_EPSILON) {
      return [];
    }
    return keepInteriorRoots([-c / b]);
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return [];
  }
  if (discriminant === 0) {
    return keepInteriorRoots([-b / (2 * a)]);
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  return keepInteriorRoots([
    (-b - sqrtDiscriminant) / (2 * a),
    (-b + sqrtDiscriminant) / (2 * a)
  ]);
}

function keepInteriorRoots(roots) {
  return roots.filter(root => root > 0 && root < 1 && Number.isFinite(root));
}

function evaluateCubicBezier([p0, p1, p2, p3], t) {
  const oneMinusT = 1 - t;
  const weight0 = oneMinusT * oneMinusT * oneMinusT;
  const weight1 = 3 * oneMinusT * oneMinusT * t;
  const weight2 = 3 * oneMinusT * t * t;
  const weight3 = t * t * t;
  return {
    x: weight0 * p0.x + weight1 * p1.x + weight2 * p2.x + weight3 * p3.x,
    y: weight0 * p0.y + weight1 * p1.y + weight2 * p2.y + weight3 * p3.y
  };
}

function angleIsOnSweep(angle, startAngle, sweep) {
  if (sweep >= 0) {
    return normalizeAngle(angle - startAngle) <= sweep + ROOT_EPSILON;
  }
  return normalizeAngle(startAngle - angle) <= -sweep + ROOT_EPSILON;
}

function normalizeAngle(angle) {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

function boundsFromPoints(points) {
  const bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  };
  for (const point of points) {
    bounds.minX = Math.min(bounds.minX, point.x);
    bounds.minY = Math.min(bounds.minY, point.y);
    bounds.maxX = Math.max(bounds.maxX, point.x);
    bounds.maxY = Math.max(bounds.maxY, point.y);
  }
  return bounds;
}
