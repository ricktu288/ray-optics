/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { WEBGPU_RUN_CONTROL_SIZE } from './webGpuStorage.js';
import { createWebGpuTraceSceneData } from './webGpuTraceScene.js';

const BUFFER_USAGE_COPY_DST = 0x0008;
const BUFFER_USAGE_STORAGE = 0x0080;
const DETECTOR_FIXED_POINT_SCALE = 1048576;

const STATIC_STORAGE_FIELDS = Object.freeze([
  'instanceParameters',
  'sourceDescriptors',
  'surfaceDescriptors',
  'regionDescriptors',
  'detectorDescriptors',
  'curveDescriptors',
  'curveGeometry',
  'bvhNodes',
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
  bvhCurveIds: 4,
});

/** GPU copies of the immutable packed scene tables used by both megakernels. */
export class WebGpuMegakernelStaticSceneStorage {
  constructor(device, packedScene) {
    this.device = device;
    this.buffers = Object.create(null);
    this.capacities = Object.create(null);
    for (const name of STATIC_STORAGE_FIELDS) {
      const byteLength = packedScene[name].byteLength;
      this.capacities[name] = Math.max(
        STATIC_STORAGE_MINIMUM_SIZES[name],
        alignTo4(byteLength)
      );
      this.buffers[name] = createInitializedBuffer(
        device,
        packedScene[name],
        `WebGPU megakernel scene ${name}`,
        STATIC_STORAGE_MINIMUM_SIZES[name]
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
      16
    );
  }

  canUpdate(packedScene) {
    return STATIC_STORAGE_FIELDS.every(name =>
      packedScene[name].byteLength <= this.capacities[name]
    );
  }

  update(packedScene) {
    if (!this.canUpdate(packedScene)) {
      throw new RangeError('Updated megakernel static scene storage does not fit.');
    }
    for (const name of STATIC_STORAGE_FIELDS) {
      const data = packedScene[name];
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

export function decodeWebGpuMegakernelRunState(data, description) {
  const bytes = data instanceof ArrayBuffer
    ? data
    : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  if (bytes.byteLength < WEBGPU_RUN_CONTROL_SIZE) {
    throw new RangeError('WebGPU megakernel run-state readback is truncated.');
  }
  const control = new Uint32Array(bytes, 0, WEBGPU_RUN_CONTROL_SIZE / 4);
  const currentDirection = control[11] & 1;
  const currentCountWord = currentDirection === 0 ? 0 : 4;
  const nextCountWord = currentDirection === 0 ? 4 : 0;
  const detectorLayout = createDetectorResultLayout(description);
  const requiredByteLength = WEBGPU_RUN_CONTROL_SIZE +
    detectorLayout.valueCount * 8;
  if (bytes.byteLength < requiredByteLength) {
    throw new RangeError('WebGPU megakernel detector readback is truncated.');
  }
  const view = new DataView(bytes);
  const decodedDetectors = detectorLayout.results.map(({ offset, size }) => {
    const values = new Float64Array(size);
    const overflow = new Uint8Array(size);
    for (let index = 0; index < size; index++) {
      const byteOffset = WEBGPU_RUN_CONTROL_SIZE + (offset + index) * 8;
      values[index] = view.getInt32(byteOffset, true) /
        DETECTOR_FIXED_POINT_SCALE;
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
    totalTruncation: control[17] / DETECTOR_FIXED_POINT_SCALE,
    warningFlags: control[18],
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

function createInitializedBuffer(device, data, label, minimumSize) {
  const bytes = toBytes(data);
  const buffer = device.createBuffer({
    label,
    size: Math.max(minimumSize, alignTo4(bytes.byteLength)),
    usage: BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_DST,
  });
  if (bytes.byteLength > 0) device.queue.writeBuffer(buffer, 0, bytes);
  return buffer;
}

function toBytes(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

function alignTo4(value) {
  return Math.ceil(value / 4) * 4;
}
