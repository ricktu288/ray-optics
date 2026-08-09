/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { clampWebGpuParameterToF32 } from './webGpuParameterRanges.js';
import { createInteractionTypeLayout } from '../interactionIndexBuffers.js';

export const WEBGPU_SOURCE_DESCRIPTOR_STRIDE = 16;
export const WEBGPU_INSTANCE_DESCRIPTOR_STRIDE = 16;
export const WEBGPU_REGION_DESCRIPTOR_STRIDE = 32;
export const WEBGPU_DETECTOR_DESCRIPTOR_STRIDE = 32;
export const WEBGPU_CURVE_DESCRIPTOR_STRIDE = 32;
export const WEBGPU_BVH_NODE_STRIDE = 80;
export const WEBGPU_BVH_PARTITION_ROOT_STRIDE = 32;
export const WEBGPU_BVH_PARTITION_TARGET = 32;
export const WEBGPU_RUN_CONTROL_SIZE = 80;

export const WEBGPU_CURVE_KINDS = Object.freeze({
  lineSegment: 0,
  smoothLineSegment: 1,
  circularArc: 2,
  circle: 3,
  cubicBezier: 4,
});

const OWNER_KINDS = Object.freeze({ surface: 0, region: 1, detector: 2 });
const CURVE_FLAG_MERGES_WITH_BOUNDARY = 1 << 0;
const CURVE_FLAG_TWO_SIDED = 1 << 1;
const CURVE_FLAG_HAS_FILTER = 1 << 2;
const CURVE_FLAG_FILTER_INVERTED = 1 << 3;
const BVH_LEAF_REFERENCE_BIT = 0x80000000;
const BVH_LEAF_START_MASK = 0x00ffffff;
const BVH_NODE_INDEX_MASK = 0x0fffffff;
const BVH_OWNER_KIND_SHIFT = 28;
const BVH_INVALID_REFERENCE = 0xffffffff;

/**
 * Convert an engine-independent processed scene to immutable GPU table data.
 * Every offset is expressed in the element unit used by its shader binding:
 * parameter and geometry offsets are f32 indices; descriptor offsets are
 * record indices.
 */
export function packWebGpuScene(description) {
  const parameterValues = [];
  const sourceDescriptors = packSources(description, parameterValues);
  const surfaceDescriptors = packOrdinaryInstances(
    description.surfaces,
    description.types.surfaces,
    'surfaceTypeId',
    parameterValues,
    'surface'
  );
  const regionDescriptors = packRegions(description, parameterValues);
  const packedDetectors = packDetectors(description, parameterValues);
  const geometryValues = [];
  const curveDescriptors = packCurves(description.curves, geometryValues);
  const bvhNodes = packBvhNodes(description.bvh.nodes);
  const bvhPartitionRoots = packBvhPartitionRoots(description.bvh);

  const sourceDispatch = createSourceDispatchData(
    description,
    sourceDescriptors.records
  );
  const interactionTypes = packInteractionTypes(description);
  return {
    counts: {
      sources: description.sources.length,
      sourceRays: description.sources.reduce(
        (sum, source) => sum + source.rayCount, 0
      ),
      surfaces: description.surfaces.length,
      regions: description.regions.length,
      detectors: description.detectors.length,
      detectorResultValues: packedDetectors.resultValueCount,
      curves: description.curves.length,
      bvhNodes: bvhNodes.byteLength / WEBGPU_BVH_NODE_STRIDE,
      bvhPartitionRoots: bvhPartitionRoots.byteLength /
        WEBGPU_BVH_PARTITION_ROOT_STRIDE,
      regionWords: Math.ceil(description.regions.length / 32),
      interactionTypes: interactionTypes.layout.types.length,
    },
    sourceTypeRanges: sourceDispatch.typeRanges,
    sourceDispatchEntries: sourceDispatch.entries,
    interactionTypeDescriptors: interactionTypes.data,
    interactionTypeLayout: interactionTypes.layout,
    instanceParameters: Float32Array.from(parameterValues),
    sourceDescriptors: sourceDescriptors.data,
    surfaceDescriptors,
    regionDescriptors,
    detectorDescriptors: packedDetectors.data,
    curveDescriptors,
    curveGeometry: Float32Array.from(geometryValues),
    bvhNodes,
    bvhPartitionRoots,
    bvhCurveIds: new Uint32Array(description.bvh.curveIds),
    bvhRoot: description.bvh.root,
  };
}

function packInteractionTypes(description) {
  const layout = createInteractionTypeLayout(description);
  const data = new Uint32Array(layout.types.length * 4);
  const kindIds = {
    grinStep: 0,
    regionBoundary: 1,
    surface: 2,
    detector: 3,
  };
  layout.types.forEach((type, index) => {
    const offset = index * 4;
    data[offset] = kindIds[type.kind];
    data[offset + 1] = type.typeId < 0 ? 0xffffffff : type.typeId;
    data[offset + 2] = type.outRayCount;
    data[offset + 3] = type.partialReflect ? 1 : 0;
  });
  return { layout, data };
}

export class WebGpuBatchController {
  constructor(config) {
    this.config = config;
    this.reset();
  }

  reset() {
    this.rayEvents = 0;
    this.readyLineRecords = 0;
    this.readyPointRecords = 0;
    this.pingPongs = 0;
    this.stopReason = null;
  }

  canAppendPingPong({
    rayCount,
    maximumLineRecords = rayCount * 3,
    maximumPointRecords = rayCount,
  }) {
    const reason = this.getLimitReason({
      rayCount,
      maximumLineRecords,
      maximumPointRecords,
    });
    if (reason && this.pingPongs > 0) {
      this.stopReason = reason;
      return false;
    }
    // One ping-pong is always permitted in an empty batch.  Large phases are
    // chunked internally; refusing it here would make forward progress
    // impossible.
    return true;
  }

  appendPingPong({ rayCount, lineRecords, pointRecords }) {
    this.rayEvents += rayCount;
    this.readyLineRecords += lineRecords;
    this.readyPointRecords += pointRecords;
    this.pingPongs++;
  }

  getLimitReason({ rayCount, maximumLineRecords, maximumPointRecords }) {
    if (this.pingPongs >= this.config.maxPingPongsPerSubmission) {
      return 'ping-pong limit';
    }
    if (this.rayEvents + rayCount > this.config.maxBatchRayEvents) {
      return 'ray-event limit';
    }
    if (
      this.readyLineRecords + maximumLineRecords >
      this.config.maxReadyLineRecords
    ) {
      return 'ready-line capacity';
    }
    if (
      this.readyPointRecords + maximumPointRecords >
      this.config.maxReadyPointRecords
    ) {
      return 'ready-point capacity';
    }
    return null;
  }

  snapshot() {
    return {
      rayEvents: this.rayEvents,
      readyLineRecords: this.readyLineRecords,
      readyPointRecords: this.readyPointRecords,
      pingPongs: this.pingPongs,
      stopReason: this.stopReason,
    };
  }
}

export function createWebGpuRunControlData({
  currentRayCount = 0,
  rayCapacity = 0,
  readyLineCapacity = 0,
  readyPointCapacity = 0,
  workgroupSize = 64,
} = {}) {
  const data = new Uint32Array(WEBGPU_RUN_CONTROL_SIZE / 4);
  data[0] = currentRayCount;
  data[1] = rayCapacity;
  data[2] = readyLineCapacity;
  data[3] = readyPointCapacity;
  // 4 nextRayCount, 5 requiredRayCapacity, 6 readyLineCount,
  // 7 readyPointCount, 8 resizeNeeded, 9 cancelRequested,
  // 10 phase, 11 pingPongIndex, 12-15 indirect arguments/scratch,
  // 16 processedRayCount, 17 totalTruncation with 20 fractional bits,
  // 18 warning flags, 19 ready-geometry overflow.
  data[12] = Math.ceil(currentRayCount / workgroupSize);
  data[13] = 1;
  data[14] = 1;
  return data;
}

function packSources(description, parameterValues) {
  const records = [];
  let rayStart = 0;
  for (const source of description.sources) {
    const type = description.types.sources[source.sourceTypeId].definition;
    const parameterOffset = appendParameters(
      parameterValues, source.params, type.paramNames, 'source'
    );
    records.push({
      typeId: source.sourceTypeId,
      parameterOffset,
      rayStart,
      rayCount: source.rayCount,
    });
    rayStart += source.rayCount;
  }
  const data = new ArrayBuffer(records.length * WEBGPU_SOURCE_DESCRIPTOR_STRIDE);
  const view = new DataView(data);
  records.forEach((record, index) => {
    const offset = index * WEBGPU_SOURCE_DESCRIPTOR_STRIDE;
    view.setUint32(offset, record.typeId, true);
    view.setUint32(offset + 4, record.parameterOffset, true);
    view.setUint32(offset + 8, record.rayStart, true);
    view.setUint32(offset + 12, record.rayCount, true);
  });
  return { data, records };
}

function packOrdinaryInstances(
  instances,
  types,
  typeIdName,
  parameterValues,
  label
) {
  const data = new ArrayBuffer(
    instances.length * WEBGPU_INSTANCE_DESCRIPTOR_STRIDE
  );
  const view = new DataView(data);
  instances.forEach((instance, index) => {
    const typeId = instance[typeIdName];
    const names = types[typeId].definition.paramNames;
    const parameterOffset = appendParameters(
      parameterValues, instance.params, names, label
    );
    const offset = index * WEBGPU_INSTANCE_DESCRIPTOR_STRIDE;
    view.setUint32(offset, typeId, true);
    view.setUint32(offset + 4, parameterOffset, true);
    view.setUint32(offset + 8, names.length, true);
    view.setUint32(offset + 12, 0, true);
  });
  return data;
}

function packRegions(description, parameterValues) {
  const data = new ArrayBuffer(
    description.regions.length * WEBGPU_REGION_DESCRIPTOR_STRIDE
  );
  const view = new DataView(data);
  description.regions.forEach((region, index) => {
    const names = description.types.bulks[region.bulkTypeId]
      .definition.paramNames;
    const parameterOffset = appendParameters(
      parameterValues, region.params, names, 'bulk'
    );
    const offset = index * WEBGPU_REGION_DESCRIPTOR_STRIDE;
    view.setUint32(offset, region.bulkTypeId, true);
    view.setUint32(offset + 4, parameterOffset, true);
    view.setUint32(offset + 8, names.length, true);
    view.setUint32(offset + 12, region.partialReflect ? 1 : 0, true);
    view.setFloat32(offset + 16, Math.fround(region.stepSize), true);
  });
  return data;
}

function packDetectors(description, parameterValues) {
  const data = new ArrayBuffer(
    description.detectors.length * WEBGPU_DETECTOR_DESCRIPTOR_STRIDE
  );
  const view = new DataView(data);
  const resultOffsets = new Map();
  let resultValueCount = 0;
  description.detectors.forEach((detector, index) => {
    if (!resultOffsets.has(detector.resultId)) {
      resultOffsets.set(detector.resultId, resultValueCount);
      resultValueCount += detector.resultSize;
    }
    const names = description.types.detectors[detector.detectorTypeId]
      .definition.paramNames;
    const parameterOffset = appendParameters(
      parameterValues, detector.params, names, 'detector'
    );
    const offset = index * WEBGPU_DETECTOR_DESCRIPTOR_STRIDE;
    view.setUint32(offset, detector.detectorTypeId, true);
    view.setUint32(offset + 4, parameterOffset, true);
    view.setUint32(offset + 8, names.length, true);
    view.setUint32(offset + 12, detector.resultId, true);
    view.setUint32(offset + 16, detector.resultSize, true);
    view.setUint32(offset + 20, resultOffsets.get(detector.resultId), true);
  });
  return { data, resultValueCount };
}

function packCurves(curves, geometryValues) {
  const data = new ArrayBuffer(curves.length * WEBGPU_CURVE_DESCRIPTOR_STRIDE);
  const view = new DataView(data);
  curves.forEach((curve, index) => {
    const geometryOffset = geometryValues.length;
    appendCurveGeometry(geometryValues, curve.geometry);
    let flags = curve.mergesWithBoundary
      ? CURVE_FLAG_MERGES_WITH_BOUNDARY
      : 0;
    if (curve.twoSided) flags |= CURVE_FLAG_TWO_SIDED;
    if (curve.filter) flags |= CURVE_FLAG_HAS_FILTER;
    if (curve.filter?.invert) flags |= CURVE_FLAG_FILTER_INVERTED;
    const offset = index * WEBGPU_CURVE_DESCRIPTOR_STRIDE;
    view.setUint32(offset, WEBGPU_CURVE_KINDS[curve.geometry.kind], true);
    view.setUint32(offset + 4, OWNER_KINDS[curve.ownerKind], true);
    view.setUint32(offset + 8, curve.ownerId, true);
    view.setUint32(offset + 12, flags, true);
    view.setUint32(offset + 16, geometryOffset, true);
    view.setUint32(offset + 20, geometryValues.length - geometryOffset, true);
    view.setFloat32(
      offset + 24,
      Math.fround(curve.filter?.wavelength ?? 0),
      true
    );
    view.setFloat32(
      offset + 28,
      Math.fround(curve.filter?.bandwidth ?? 0),
      true
    );
  });
  return data;
}

function packBvhNodes(nodes) {
  const branches = nodes.filter(node => node.count === 0);
  const packedBranches = branches.length > 0
    ? branches
    : nodes.length > 0
      ? [{ children: [0] }]
      : [];
  const data = new ArrayBuffer(
    packedBranches.length * WEBGPU_BVH_NODE_STRIDE
  );
  const view = new DataView(data);
  packedBranches.forEach((node, index) => {
    const offset = index * WEBGPU_BVH_NODE_STRIDE;
    for (let childOffset = 0; childOffset < 4; childOffset++) {
      const childIndex = node.children[childOffset];
      const child = childIndex === undefined ? null : nodes[childIndex];
      view.setFloat32(offset + childOffset * 4,
        Math.fround(child?.bounds.minX ?? 0), true);
      view.setFloat32(offset + 16 + childOffset * 4,
        Math.fround(child?.bounds.minY ?? 0), true);
      view.setFloat32(offset + 32 + childOffset * 4,
        Math.fround(child?.bounds.maxX ?? 0), true);
      view.setFloat32(offset + 48 + childOffset * 4,
        Math.fround(child?.bounds.maxY ?? 0), true);
      view.setUint32(
        offset + 64 + childOffset * 4,
        child ? packBvhChildReference(child, childIndex, branches.length)
          : BVH_INVALID_REFERENCE,
        true
      );
    }
  });
  return data;
}

/**
 * Expand the full BVH into a small logical frontier. Cooperative lanes share
 * this immutable list; the hierarchy and primitive ordering remain singular.
 */
function packBvhPartitionRoots(bvh) {
  const frontier = createWebGpuBvhPartitionRootIndices(bvh);
  if (frontier.length === 0) return new ArrayBuffer(0);
  const branchCount = bvh.nodes.filter(node => node.count === 0).length;
  const data = new ArrayBuffer(
    frontier.length * WEBGPU_BVH_PARTITION_ROOT_STRIDE
  );
  const view = new DataView(data);
  frontier.forEach((nodeIndex, index) => {
    const node = bvh.nodes[nodeIndex];
    const offset = index * WEBGPU_BVH_PARTITION_ROOT_STRIDE;
    writeBounds(view, offset, node.bounds);
    view.setUint32(
      offset + 16,
      packBvhChildReference(node, nodeIndex, branchCount),
      true
    );
  });
  return data;
}

export function createWebGpuBvhPartitionRootIndices(bvh) {
  if (bvh.root < 0 || bvh.nodes.length === 0) return [];
  const frontier = [bvh.root];
  while (frontier.length < WEBGPU_BVH_PARTITION_TARGET) {
    let splitPosition = -1;
    let splitArea = -1;
    for (let position = 0; position < frontier.length; position++) {
      const node = bvh.nodes[frontier[position]];
      if (!node || node.count > 0) continue;
      const width = node.bounds.maxX - node.bounds.minX;
      const height = node.bounds.maxY - node.bounds.minY;
      const area = width * height;
      if (area > splitArea) {
        splitArea = area;
        splitPosition = position;
      }
    }
    if (splitPosition < 0) break;
    const node = bvh.nodes[frontier[splitPosition]];
    frontier.splice(splitPosition, 1, ...node.children);
  }
  return frontier;
}

function packBvhChildReference(node, nodeIndex, branchCount) {
  if (node.count > 0) {
    if (node.start > BVH_LEAF_START_MASK || node.count > 0x7f) {
      throw new RangeError(
        'WebGPU BVH leaf exceeds the packed 24-bit start/7-bit count format.'
      );
    }
    return (
      BVH_LEAF_REFERENCE_BIT |
      node.count << 24 |
      node.start
    ) >>> 0;
  }
  if (nodeIndex >= branchCount || nodeIndex > BVH_NODE_INDEX_MASK) {
    throw new RangeError('WebGPU BVH branch index exceeds the packed format.');
  }
  return (
    (node.ownerKindMask & 0x7) << BVH_OWNER_KIND_SHIFT |
    nodeIndex
  ) >>> 0;
}

function appendParameters(target, params, names, label) {
  const offset = target.length;
  for (const name of names) {
    target.push(clampWebGpuParameterToF32(
      params[name], `${label} parameter ${JSON.stringify(name)}`
    ));
  }
  return offset;
}

function appendCurveGeometry(target, geometry) {
  const values = curveGeometryValues(geometry);
  target.push(...values.map(Math.fround));
  while (target.length % 4 !== 0) target.push(0);
}

function curveGeometryValues(geometry) {
  switch (geometry.kind) {
    case 'lineSegment':
      return lineValues(geometry);
    case 'smoothLineSegment':
      return [
        ...lineValues(geometry),
        geometry.startNormalX, geometry.startNormalY,
        geometry.endNormalX, geometry.endNormalY,
      ];
    case 'circularArc':
      return [
        geometry.originX, geometry.originY,
        geometry.tangentX, geometry.tangentY,
        geometry.invChordLength, geometry.bulge,
        geometry.positionTolerance, geometry.endpointTolerance,
      ];
    case 'circle':
      return [
        geometry.centerX, geometry.centerY, geometry.signedInvRadius,
        geometry.positionTolerance,
      ];
    case 'cubicBezier':
      return [
        geometry.originX, geometry.originY, geometry.invScale,
        geometry.startX, geometry.startY,
        geometry.control1X, geometry.control1Y,
        geometry.control2X, geometry.control2Y,
        geometry.endX, geometry.endY,
        geometry.positionTolerance, geometry.endpointTolerance,
      ];
    default:
      throw new TypeError(
        `Unsupported WebGPU curve kind ${JSON.stringify(geometry.kind)}.`
      );
  }
}

function lineValues(geometry) {
  return [
    geometry.originX, geometry.originY,
    geometry.tangentX, geometry.tangentY,
    geometry.invLength,
    geometry.positionTolerance, geometry.endpointTolerance,
  ];
}

function createSourceDispatchData(description, records) {
  const typeRanges = [];
  const entryValues = [];
  for (let typeId = 0;
    typeId < description.types.sources.length;
    typeId++) {
    const descriptorIndices = records.flatMap((record, index) =>
      record.typeId === typeId ? [index] : []
    );
    const dispatchEntryOffset = entryValues.length / 2;
    let typeRayStart = 0;
    for (const descriptorIndex of descriptorIndices) {
      entryValues.push(descriptorIndex, typeRayStart);
      typeRayStart += records[descriptorIndex].rayCount;
    }
    typeRanges.push({
      typeId,
      descriptorIndices,
      dispatchEntryOffset,
      dispatchEntryCount: descriptorIndices.length,
      rayCount: typeRayStart,
    });
  }
  return {
    typeRanges,
    entries: Uint32Array.from(entryValues),
  };
}

function writeBounds(view, offset, bounds) {
  view.setFloat32(offset, roundDownF32(bounds.minX), true);
  view.setFloat32(offset + 4, roundDownF32(bounds.minY), true);
  view.setFloat32(offset + 8, roundUpF32(bounds.maxX), true);
  view.setFloat32(offset + 12, roundUpF32(bounds.maxY), true);
}

function roundDownF32(value) {
  const rounded = Math.fround(value);
  if (rounded <= value) return rounded;
  return nextF32(rounded, -1);
}

function roundUpF32(value) {
  const rounded = Math.fround(value);
  if (rounded >= value) return rounded;
  return nextF32(rounded, 1);
}

function nextF32(value, direction) {
  if (value === 0) return direction < 0 ? -(2 ** -149) : 2 ** -149;
  const floats = new Float32Array([value]);
  const words = new Uint32Array(floats.buffer);
  words[0] += (value > 0 ? direction : -direction);
  return floats[0];
}
