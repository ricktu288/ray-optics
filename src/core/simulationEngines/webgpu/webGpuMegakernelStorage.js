/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { createWebGpuTraceSceneData } from './webGpuTraceScene.js';

const BUFFER_USAGE_COPY_DST = 0x0008;
const BUFFER_USAGE_STORAGE = 0x0080;
export const WEBGPU_MEGAKERNEL_RUN_CONTROL_SIZE = 108;

const STATIC_STORAGE_FIELDS = Object.freeze([
  'instanceParameters',
  'sourceDescriptors',
  'surfaceDescriptors',
  'regionDescriptors',
  'detectorDescriptors',
  'curveDescriptors',
  'curveGeometry',
  'bvhNodes',
  'bvhPartitionRoots',
  'bvhCurveIds',
]);

const STATIC_STORAGE_MINIMUM_SIZES = Object.freeze({
  instanceParameters: 4,
  sourceDescriptors: 16,
  surfaceDescriptors: 16,
  regionDescriptors: 32,
  detectorDescriptors: 32,
  curveDescriptors: 32,
  curveGeometry: 4,
  bvhNodes: 80,
  bvhPartitionRoots: 32,
  bvhCurveIds: 4,
});

// Static scene tables are immutable during a trace, but interactive edits can
// append a few objects between traces. Reserving a modest initial number of
// elements prevents each same-signature addition from changing the WGSL array
// lengths and rebuilding the megakernel. Larger scenes retain proportional
// headroom so rebuild frequency remains logarithmic rather than linear.
const STATIC_STORAGE_INITIAL_CAPACITY_ELEMENTS = Object.freeze({
  instanceParameters: 64,
  sourceDescriptors: 8,
  surfaceDescriptors: 8,
  regionDescriptors: 8,
  detectorDescriptors: 8,
  curveDescriptors: 8,
  curveGeometry: 64,
  bvhNodes: 8,
  bvhPartitionRoots: 8,
  bvhCurveIds: 64,
});
const STATIC_STORAGE_GROWTH_FACTOR = 1.5;

/** GPU copies of the immutable packed scene tables used by both megakernels. */
export class WebGpuMegakernelStaticSceneStorage {
  constructor(device, packedScene) {
    this.device = device;
    this.buffers = Object.create(null);
    this.capacities = createStaticStorageCapacities(device, packedScene);
    for (const name of STATIC_STORAGE_FIELDS) {
      const data = packedScene[name] ?? new Uint8Array(0);
      this.buffers[name] = createInitializedBuffer(
        device,
        data,
        `WebGPU megakernel scene ${name}`,
        this.capacities[name]
      );
    }
    const traceScene = createWebGpuTraceSceneData(
      packedScene,
      this.capacities
    );
    this.capacities.traceScene = traceScene.byteLength;
    this.buffers.traceScene = createInitializedBuffer(
      device,
      traceScene,
      'WebGPU megakernel packed trace scene',
      this.capacities.traceScene
    );
  }

  canUpdate(packedScene) {
    return STATIC_STORAGE_FIELDS.every(name =>
      (packedScene[name]?.byteLength ?? 0) <= this.capacities[name]
    );
  }

  update(packedScene) {
    if (!this.canUpdate(packedScene)) {
      throw new RangeError('Updated megakernel static scene storage does not fit.');
    }
    for (const name of STATIC_STORAGE_FIELDS) {
      const data = packedScene[name] ?? new Uint8Array(0);
      if (data.byteLength > 0) {
        this.device.queue.writeBuffer(this.buffers[name], 0, toBytes(data));
      }
    }
    // The WGSL TraceScene struct was compiled with the original array sizes.
    // Keep those field offsets when a smaller compatible scene is uploaded;
    // compacting the replacement data would make every later field shift
    // while the shader continued reading the original offsets.
    const traceScene = createWebGpuTraceSceneData(
      packedScene,
      this.capacities
    );
    if (traceScene.byteLength > this.capacities.traceScene) {
      throw new RangeError(
        'Updated packed WebGPU megakernel trace scene does not fit.'
      );
    }
    this.device.queue.writeBuffer(this.buffers.traceScene, 0, traceScene);
  }

  destroy() {
    for (const buffer of Object.values(this.buffers)) buffer.destroy?.();
    this.buffers = Object.create(null);
    this.capacities = Object.create(null);
  }
}

export function decodeWebGpuMegakernelRunState(
  data,
  description,
  atomicFixedPointScale = 1048576
) {
  const bytes = data instanceof ArrayBuffer
    ? data
    : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  if (bytes.byteLength < WEBGPU_MEGAKERNEL_RUN_CONTROL_SIZE) {
    throw new RangeError('WebGPU megakernel run-state readback is truncated.');
  }
  const control = new Uint32Array(
    bytes,
    0,
    WEBGPU_MEGAKERNEL_RUN_CONTROL_SIZE / 4
  );
  const currentDirection = control[11] & 1;
  const currentCountWord = currentDirection === 0 ? 0 : 4;
  const nextCountWord = currentDirection === 0 ? 4 : 0;
  const detectorLayout = createDetectorResultLayout(description);
  const requiredByteLength = WEBGPU_MEGAKERNEL_RUN_CONTROL_SIZE +
    detectorLayout.valueCount * 8;
  if (bytes.byteLength < requiredByteLength) {
    throw new RangeError('WebGPU megakernel detector readback is truncated.');
  }
  const view = new DataView(bytes);
  const decodedDetectors = detectorLayout.results.map(({ offset, size }) => {
    const values = new Float64Array(size);
    const overflow = new Uint8Array(size);
    for (let index = 0; index < size; index++) {
      const byteOffset = WEBGPU_MEGAKERNEL_RUN_CONTROL_SIZE +
        (offset + index) * 8;
      values[index] = view.getInt32(byteOffset, true) /
        atomicFixedPointScale;
      overflow[index] = view.getUint32(byteOffset + 4, true) !== 0 ? 1 : 0;
    }
    return { values, overflow };
  });
  return {
    currentRayCount: control[currentCountWord],
    rayCapacity: control[1],
    readyLineCapacity: control[2],
    readyPointCapacity: control[3],
    nextRayCount: control[nextCountWord],
    requiredRayCapacity: control[5],
    readyLineCount: control[6],
    readyPointCount: control[7],
    resizeNeeded: control[8] !== 0,
    cancelRequested: control[9] !== 0,
    phase: control[10],
    pingPongIndex: control[11],
    processedRayCount: control[16],
    totalTruncation: control[17] / atomicFixedPointScale,
    warningFlags: control[18],
    warningConflictCount: control[22],
    warningRayIndex: control[23],
    warningCurveId: control[24],
    warningConflictingCurveId: control[25],
    ambiguousPower: control[26] / atomicFixedPointScale,
    readyGeometryOverflow: control[19] !== 0,
    detectors: decodedDetectors.map(result => result.values),
    detectorOverflow: decodedDetectors.some(result =>
      result.overflow.some(value => value !== 0)
    ),
  };
}

function createDetectorResultLayout(description) {
  const results = [];
  let valueCount = 0;
  for (const detector of description.detectors) {
    if (results[detector.resultId]) continue;
    results[detector.resultId] = {
      offset: valueCount,
      size: detector.resultSize,
    };
    valueCount += detector.resultSize;
  }
  return { results, valueCount };
}

function createInitializedBuffer(device, data, label, capacity) {
  const bytes = toBytes(data);
  if (bytes.byteLength > capacity) {
    throw new RangeError(`WebGPU buffer ${label} exceeds its capacity.`);
  }
  const buffer = device.createBuffer({
    label,
    size: capacity,
    usage: BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_DST,
  });
  if (bytes.byteLength > 0) device.queue.writeBuffer(buffer, 0, bytes);
  return buffer;
}

function toBytes(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

function createStaticStorageCapacities(device, packedScene) {
  const exact = Object.create(null);
  const grown = Object.create(null);
  for (const name of STATIC_STORAGE_FIELDS) {
    const elementSize = STATIC_STORAGE_MINIMUM_SIZES[name];
    const byteLength = packedScene[name]?.byteLength ?? 0;
    const elementCount = Math.ceil(byteLength / elementSize);
    exact[name] = Math.max(elementSize, elementCount * elementSize);
    grown[name] = Math.max(
      STATIC_STORAGE_INITIAL_CAPACITY_ELEMENTS[name],
      Math.ceil(elementCount * STATIC_STORAGE_GROWTH_FACTOR),
      1
    ) * elementSize;
  }

  const maximumBinding = Math.min(
    finiteLimit(device.limits?.maxStorageBufferBindingSize),
    finiteLimit(device.limits?.maxBufferSize)
  );
  const grownTraceScene = createWebGpuTraceSceneData(packedScene, grown);
  const exceedsDeviceLimit = grownTraceScene.byteLength > maximumBinding ||
    STATIC_STORAGE_FIELDS.some(name => grown[name] > maximumBinding);
  return exceedsDeviceLimit ? exact : grown;
}

function finiteLimit(value) {
  return Number.isFinite(value) ? value : Infinity;
}
