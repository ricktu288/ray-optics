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

import { prepareCurve } from './curveGeometry.js';

const SCENE_EPSILON_RATIO = 1e-9;
const MORTON_COORDINATE_MAX = 0x7fff;
const LEAF_WEIGHT_EPSILON = 1e-12;

export const DEFAULT_BVH_OPTIONS = Object.freeze({
  lineLeafSize: 4,
  arcLeafSize: 2,
  cubicBezierLeafSize: 1,
  maxGroupExtent: 100,
  consecutiveLocalityFactor: 2
});

/**
 * @typedef {Object} BvhCurveEntry
 * @property {Object} [geometry] - Prepared curve geometry.
 * @property {Object} [bounds] - Prepared curve bounds.
 * @property {PrimitiveCurve} [curve] - Raw primitive curve.
 */

/**
 * Calculate the axis-aligned bounding box of a primitive curve.
 * @param {PrimitiveCurve} curve - The primitive curve.
 * @param {Object} options
 * @param {number} options.numericEpsilon - Relative arithmetic epsilon selected by the engine.
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}} The curve bounds.
 */
export function getCurveBounds(curve, { numericEpsilon }) {
  return prepareCurve(curve, { numericEpsilon }).bounds;
}

/**
 * Build a BVH for primitive-curve entries.
 *
 * Spatially consecutive entries are first grouped without regard to their
 * originating scene object. The groups are arranged by Morton order without
 * changing the order inside each group, then flattened into one sequence. That
 * sequence is packed into leaves using the configured leaf size for each curve
 * kind, and the leaves are connected by a balanced hierarchy. A group ends
 * when two adjacent curve bounds are no longer local or when its bounds exceed
 * the configured maximum extent.
 *
 * Prepared entries provide `geometry` and `bounds`, avoiding duplicate curve
 * preparation. Raw `curve` entries remain accepted by this standalone builder.
 *
 * @param {BvhCurveEntry[]} curveEntries
 * @param {Object} [options]
 * @param {number} [options.lineLeafSize=4] - Target number of line segments in a homogeneous leaf.
 * @param {number} [options.arcLeafSize=2] - Target number of circular arcs or circles in a homogeneous leaf.
 * @param {number} [options.cubicBezierLeafSize=1] - Target number of cubic Bézier curves in a homogeneous leaf.
 * @param {number} [options.maxGroupExtent=100] - Maximum group width or height in scene coordinates.
 * @param {number} [options.consecutiveLocalityFactor=2] - Maximum adjacent AABB gap, relative to the larger curve extent.
 * @param {number} [options.numericEpsilon] - Relative arithmetic epsilon required when an entry contains an unprepared `curve`.
 * @returns {{root: number, nodes: Array<Object>, entries: Array<Object>}} The BVH.
 */
export function buildBvh(curveEntries, {
  lineLeafSize = DEFAULT_BVH_OPTIONS.lineLeafSize,
  arcLeafSize = DEFAULT_BVH_OPTIONS.arcLeafSize,
  cubicBezierLeafSize = DEFAULT_BVH_OPTIONS.cubicBezierLeafSize,
  maxGroupExtent = DEFAULT_BVH_OPTIONS.maxGroupExtent,
  consecutiveLocalityFactor = DEFAULT_BVH_OPTIONS.consecutiveLocalityFactor,
  numericEpsilon
} = {}) {
  if (!Array.isArray(curveEntries)) {
    throw new TypeError('curveEntries must be an array.');
  }
  validateLeafSize(lineLeafSize, 'lineLeafSize');
  validateLeafSize(arcLeafSize, 'arcLeafSize');
  validateLeafSize(cubicBezierLeafSize, 'cubicBezierLeafSize');
  if (!Number.isFinite(maxGroupExtent) || maxGroupExtent <= 0) {
    throw new RangeError('maxGroupExtent must be positive and finite.');
  }
  if (!Number.isFinite(consecutiveLocalityFactor) || consecutiveLocalityFactor < 0) {
    throw new RangeError('consecutiveLocalityFactor must be nonnegative and finite.');
  }

  let items = curveEntries.map(entry => {
    const prepared = entry.geometry && entry.bounds
      ? { geometry: entry.geometry, bounds: entry.bounds }
      : prepareCurve(entry.curve, { numericEpsilon });
    return {
      ...entry,
      geometry: prepared.geometry,
      bounds: prepared.bounds,
      leafWeight: getCurveLeafWeight(
        prepared.geometry.kind,
        lineLeafSize,
        arcLeafSize,
        cubicBezierLeafSize
      )
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

  const addLeaf = (startIndex, endIndex, bounds) => {
    const nodeIndex = nodes.length;
    const start = orderedEntries.length;
    for (let index = startIndex; index < endIndex; index++) {
      const { leafWeight, ...entry } = items[index];
      orderedEntries.push(entry);
    }
    nodes.push({
      bounds,
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

  const sceneBounds = getItemRangeBounds(items, 0, items.length);
  const sceneExtent = getBoundsExtent(sceneBounds) || 1;
  const sceneEpsilon = sceneExtent * SCENE_EPSILON_RATIO;
  const groups = [];
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
      groups.push(createCurveGroup(
        groupStart,
        index,
        groupBounds,
        groups.length
      ));
      groupStart = index;
      groupBounds = items[index].bounds;
    } else {
      groupBounds = candidateBounds;
    }
  }
  groups.push(createCurveGroup(
    groupStart,
    items.length,
    groupBounds,
    groups.length
  ));

  sortByMortonCode(groups);
  const spatiallyOrderedItems = [];
  for (const group of groups) {
    for (let index = group.start; index < group.end; index++) {
      spatiallyOrderedItems.push(items[index]);
    }
  }
  items = spatiallyOrderedItems;

  const leafRoots = [];
  let leafStart = 0;
  let accumulatedLeafWeight = 0;
  let leafBounds = null;
  for (let index = 0; index < items.length; index++) {
    const nextLeafWeight = items[index].leafWeight;
    if (
      index > leafStart &&
      accumulatedLeafWeight + nextLeafWeight > 1 + LEAF_WEIGHT_EPSILON
    ) {
      leafRoots.push(addLeaf(leafStart, index, leafBounds));
      leafStart = index;
      accumulatedLeafWeight = 0;
      leafBounds = null;
    }
    accumulatedLeafWeight += nextLeafWeight;
    leafBounds = leafBounds
      ? combineBounds(leafBounds, items[index].bounds)
      : items[index].bounds;
  }
  leafRoots.push(addLeaf(leafStart, items.length, leafBounds));

  const root = buildBalancedRootRange(leafRoots, 0, leafRoots.length);
  assignNodeDepths(root, nodes);

  return {
    root,
    nodes,
    entries: orderedEntries
  };
}

function createCurveGroup(start, end, bounds, order) {
  return {
    start,
    end,
    order,
    centroidX: (bounds.minX + bounds.maxX) * 0.5,
    centroidY: (bounds.minY + bounds.maxY) * 0.5,
    mortonCode: 0
  };
}

function sortByMortonCode(items) {
  if (items.length <= 1) return;
  assignMortonCodes(items);
  items.sort((a, b) => a.mortonCode - b.mortonCode || a.order - b.order);
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

function validateLeafSize(value, name) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
}

function getCurveLeafWeight(
  kind,
  lineLeafSize,
  arcLeafSize,
  cubicBezierLeafSize
) {
  switch (kind) {
    case 'lineSegment':
      return 1 / lineLeafSize;
    case 'circularArc':
    case 'circle':
      return 1 / arcLeafSize;
    case 'cubicBezier':
      return 1 / cubicBezierLeafSize;
    default:
      throw new TypeError(`Unsupported primitive curve kind: ${JSON.stringify(kind)}`);
  }
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
