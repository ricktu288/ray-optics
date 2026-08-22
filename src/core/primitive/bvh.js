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

export const BVH_LINE_LEAF_SIZE = 4;
export const BVH_ARC_LEAF_SIZE = 2;
export const BVH_CUBIC_BEZIER_LEAF_SIZE = 1;
export const BVH_DIRECT_PRIMITIVE_THRESHOLD = 32;
export const BVH_MAX_GROUP_EXTENT = 100;
export const BVH_CONSECUTIVE_LOCALITY_FACTOR = 2;

export const DEFAULT_BVH_OPTIONS = Object.freeze({
  lineLeafSize: BVH_LINE_LEAF_SIZE,
  arcLeafSize: BVH_ARC_LEAF_SIZE,
  cubicBezierLeafSize: BVH_CUBIC_BEZIER_LEAF_SIZE,
  directPrimitiveThreshold: BVH_DIRECT_PRIMITIVE_THRESHOLD,
  maxGroupExtent: BVH_MAX_GROUP_EXTENT,
  consecutiveLocalityFactor: BVH_CONSECUTIVE_LOCALITY_FACTOR
});

export const BVH_OWNER_KIND_MASKS = Object.freeze({
  surface: 1 << 0,
  region: 1 << 1,
  detector: 1 << 2
});

/**
 * @typedef {Object} BvhCurveEntry
 * @property {Object} [geometry] - Prepared curve geometry.
 * @property {Object} [bounds] - Prepared curve bounds.
 * @property {PrimitiveCurve} [curve] - Raw primitive curve.
 * @property {'surface'|'region'|'detector'} [ownerKind] - Curve owner kind used to build node masks.
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
 * Small input sets are built directly by recursive longest-axis weighted
 * median splits. Larger input sets are first divided into spatially
 * consecutive groups without regard to their originating scene object. Each
 * group is packed into leaves using the configured leaf size for each curve
 * kind, and the group roots are connected by a Morton hierarchy. A group ends
 * when adjacent curve bounds are no longer local or its bounds exceed the
 * configured maximum extent.
 *
 * Prepared entries provide `geometry` and `bounds`, avoiding duplicate curve
 * preparation. Raw `curve` entries remain accepted by this standalone builder.
 *
 * @param {BvhCurveEntry[]} curveEntries
 * @param {Object} [options]
 * @param {number} [options.lineLeafSize=4] - Target number of ordinary or smooth line segments in a homogeneous leaf.
 * @param {number} [options.arcLeafSize=2] - Target number of circular arcs or circles in a homogeneous leaf.
 * @param {number} [options.cubicBezierLeafSize=1] - Target number of cubic Bézier curves in a homogeneous leaf.
 * @param {number} [options.directPrimitiveThreshold=32] - Maximum primitive count for building the hierarchy directly.
 * @param {number} [options.maxGroupExtent=100] - Maximum group width or height in scene coordinates.
 * @param {number} [options.consecutiveLocalityFactor=2] - Maximum adjacent AABB gap, relative to the larger curve extent.
 * @param {number} [options.numericEpsilon] - Relative arithmetic epsilon required when an entry contains an unprepared `curve`.
 * @returns {{root: number, nodes: Array<Object>, entries: Array<Object>}} The BVH.
 */
export function buildBvh(curveEntries, {
  lineLeafSize = DEFAULT_BVH_OPTIONS.lineLeafSize,
  arcLeafSize = DEFAULT_BVH_OPTIONS.arcLeafSize,
  cubicBezierLeafSize = DEFAULT_BVH_OPTIONS.cubicBezierLeafSize,
  directPrimitiveThreshold = DEFAULT_BVH_OPTIONS.directPrimitiveThreshold,
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
  if (
    !Number.isInteger(directPrimitiveThreshold) ||
    directPrimitiveThreshold < 0
  ) {
    throw new RangeError('directPrimitiveThreshold must be a nonnegative integer.');
  }
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
    let ownerKindMask = 0;
    for (let index = startIndex; index < endIndex; index++) {
      const { leafWeight, ...entry } = items[index];
      orderedEntries.push(entry);
      ownerKindMask |= getOwnerKindMask(entry.ownerKind);
    }
    nodes.push({
      bounds,
      ownerKindMask,
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
      ownerKindMask:
        nodes[left].ownerKindMask | nodes[right].ownerKindMask,
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
    let leafStart = startIndex;
    let accumulatedLeafWeight = 0;
    let leafBounds = null;
    for (let index = startIndex; index < endIndex; index++) {
      const nextLeafWeight = items[index].leafWeight;
      if (
        index > leafStart &&
        accumulatedLeafWeight + nextLeafWeight >
          1 + LEAF_WEIGHT_EPSILON
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
    leafRoots.push(addLeaf(leafStart, endIndex, leafBounds));
    return buildBalancedRootRange(leafRoots, 0, leafRoots.length);
  };

  const buildDirectItemRange = (startIndex, endIndex) => {
    const bounds = getItemRangeBounds(items, startIndex, endIndex);
    let totalLeafWeight = 0;
    for (let index = startIndex; index < endIndex; index++) {
      totalLeafWeight += items[index].leafWeight;
    }
    if (totalLeafWeight <= 1 + LEAF_WEIGHT_EPSILON) {
      return addLeaf(startIndex, endIndex, bounds);
    }

    const sortByX =
      bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY;
    const sortedItems = items.slice(startIndex, endIndex).sort((a, b) => {
      const firstCentroid = sortByX
        ? a.bounds.minX + a.bounds.maxX
        : a.bounds.minY + a.bounds.maxY;
      const secondCentroid = sortByX
        ? b.bounds.minX + b.bounds.maxX
        : b.bounds.minY + b.bounds.maxY;
      return firstCentroid - secondCentroid;
    });
    items.splice(startIndex, sortedItems.length, ...sortedItems);

    const targetLeftWeight = totalLeafWeight * 0.5;
    let leftWeight = 0;
    let splitIndex = startIndex + 1;
    for (let index = startIndex; index < endIndex - 1; index++) {
      leftWeight += items[index].leafWeight;
      splitIndex = index + 1;
      if (leftWeight >= targetLeftWeight) break;
    }
    const left = buildDirectItemRange(startIndex, splitIndex);
    const right = buildDirectItemRange(splitIndex, endIndex);
    return addParent(left, right);
  };

  let root;
  if (items.length <= directPrimitiveThreshold) {
    root = buildDirectItemRange(0, items.length);
  } else {
    const sceneBounds = getItemRangeBounds(items, 0, items.length);
    const sceneExtent = getBoundsExtent(sceneBounds) || 1;
    const sceneEpsilon = sceneExtent * SCENE_EPSILON_RATIO;
    const groups = [];
    let groupStart = 0;
    let groupBounds = items[0].bounds;

    for (let index = 1; index < items.length; index++) {
      const candidateBounds = combineBounds(
        groupBounds,
        items[index].bounds
      );
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
    root = buildMortonGroupHierarchy(groups, buildIndexGroup, addParent);
  }
  const wideTree = collapseBinaryBvh(root, nodes);

  return {
    root: wideTree.root,
    nodes: wideTree.nodes,
    entries: orderedEntries
  };
}

/**
 * Collapse the temporary binary construction tree into the shared BVH4
 * representation. Branch nodes are stored before leaves so WebGPU can pack
 * the branch prefix directly while CPU diagnostics can still address leaves.
 */
function collapseBinaryBvh(binaryRoot, binaryNodes) {
  function convert(binaryIndex, depth) {
    const source = binaryNodes[binaryIndex];
    if (source.count > 0) {
      return {
        bounds: source.bounds,
        ownerKindMask: source.ownerKindMask,
        depth,
        start: source.start,
        count: source.count
      };
    }

    const frontier = [source.left, source.right];
    while (frontier.length < 4) {
      let expandAt = -1;
      let largestArea = -1;
      for (let position = 0; position < frontier.length; position++) {
        const candidate = binaryNodes[frontier[position]];
        if (candidate.count > 0) continue;
        const area =
          (candidate.bounds.maxX - candidate.bounds.minX) *
          (candidate.bounds.maxY - candidate.bounds.minY);
        if (area > largestArea) {
          largestArea = area;
          expandAt = position;
        }
      }
      if (expandAt < 0) break;
      const expanded = binaryNodes[frontier[expandAt]];
      frontier.splice(expandAt, 1, expanded.left, expanded.right);
    }

    return {
      bounds: source.bounds,
      ownerKindMask: source.ownerKindMask,
      depth,
      start: -1,
      count: 0,
      children: frontier.map(index => convert(index, depth + 1))
    };
  }

  const treeRoot = convert(binaryRoot, 0);
  const branches = [];
  const leaves = [];
  function collect(node) {
    if (node.count > 0) {
      leaves.push(node);
      return;
    }
    branches.push(node);
    for (const child of node.children) collect(child);
  }
  collect(treeRoot);
  const nodes = [...branches, ...leaves];
  nodes.forEach((node, index) => { node.nodeIndex = index; });
  for (const node of branches) {
    node.children = node.children.map(child => child.nodeIndex);
  }
  for (const node of nodes) delete node.nodeIndex;
  return { root: 0, nodes };
}

function buildMortonGroupHierarchy(groups, buildGroup, addParent) {
  sortByMortonCode(groups);

  const buildRange = (startIndex, endIndex) => {
    if (endIndex - startIndex === 1) {
      return buildGroup(groups[startIndex].start, groups[startIndex].end);
    }
    const midpoint = findMortonBoundary(groups, startIndex, endIndex);
    const left = buildRange(startIndex, midpoint);
    const right = buildRange(midpoint, endIndex);
    return addParent(left, right);
  };
  return buildRange(0, groups.length);
}

function getOwnerKindMask(ownerKind) {
  if (ownerKind === undefined) return 0;
  const mask = BVH_OWNER_KIND_MASKS[ownerKind];
  if (mask === undefined) {
    throw new TypeError(
      `Unsupported BVH curve owner kind: ${JSON.stringify(ownerKind)}`
    );
  }
  return mask;
}

function createCurveGroup(start, end, bounds, order) {
  return {
    start,
    end,
    bounds,
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
    case 'smoothLineSegment':
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
