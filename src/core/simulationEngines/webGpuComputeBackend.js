/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { WEBGPU_RAY_STRIDE } from './webGpuExecutionPlan.js';
import { WEBGPU_RUN_CONTROL_SIZE } from './webGpuStorage.js';
import { WebGpuInteractionIndexStage } from './webGpuInteractionIndex.js';
import { WebGpuInitialMembershipStage } from './webGpuMembership.js';
import { WebGpuOutgoingStage } from './webGpuOutgoing.js';
import { WebGpuRawTraceStage } from './webGpuTrace.js';

const BUFFER_USAGE_MAP_READ = 0x0001;
const BUFFER_USAGE_COPY_SRC = 0x0004;
const BUFFER_USAGE_COPY_DST = 0x0008;
const BUFFER_USAGE_UNIFORM = 0x0040;
const BUFFER_USAGE_STORAGE = 0x0080;
const SHADER_STAGE_COMPUTE = 0x0004;
const DETECTOR_FIXED_POINT_SCALE = 1048576;

const STATIC_STORAGE_FIELDS = Object.freeze([
  'instanceParameters',
  'sourceDescriptors',
  'sourceDispatchEntries',
  'interactionTypeDescriptors',
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
  sourceDispatchEntries: 8,
  interactionTypeDescriptors: 16,
  surfaceDescriptors: 16,
  regionDescriptors: 32,
  detectorDescriptors: 32,
  curveDescriptors: 32,
  curveGeometry: 4,
  bvhNodes: 32,
  bvhCurveIds: 4,
});

/**
 * Immutable GPUBuffer copies of a processed scene's packed tables.  Empty
 * tables still receive a small valid buffer so pipeline layouts do not need
 * scene-dependent optional bindings.
 */
export class WebGpuStaticSceneStorage {
  constructor(device, packedScene) {
    this.device = device;
    this.buffers = Object.create(null);
    for (const name of STATIC_STORAGE_FIELDS) {
      this.buffers[name] = createInitializedBuffer(
        device,
        packedScene[name],
        BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_DST,
        `WebGPU scene ${name}`,
        STATIC_STORAGE_MINIMUM_SIZES[name]
      );
    }
  }

  destroy() {
    for (const buffer of Object.values(this.buffers)) buffer.destroy?.();
    this.buffers = Object.create(null);
  }
}

/**
 * The first native compute stage.  Each registered source type has a pipeline
 * containing exactly that type's range-specialized DAG.  Instances remain
 * data: updating authored parameters or counts does not alter shader code.
 */
export class WebGpuSourceComputeStage {
  constructor(device, {
    description,
    packedScene,
    dagPrograms,
    staticStorage,
    wavelengthRange,
    workgroupSize,
    rayCapacity,
  }) {
    this.device = device;
    this.description = description;
    this.packedScene = packedScene;
    this.dagPrograms = dagPrograms;
    this.staticStorage = staticStorage;
    this.wavelengthRange = wavelengthRange;
    this.workgroupSize = workgroupSize;
    this.rayCapacity = rayCapacity;
    this.rayBuffer = null;
    this.typeStages = [];
  }

  async initialize() {
    this.rayBuffer = this.device.createBuffer({
      label: 'WebGPU source rays',
      size: alignTo4(this.rayCapacity * WEBGPU_RAY_STRIDE),
      usage: BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_SRC |
        BUFFER_USAGE_COPY_DST,
    });

    try {
      for (const typeRange of this.packedScene.sourceTypeRanges) {
        if (typeRange.rayCount === 0) continue;
        this.typeStages.push(await this.createTypeStage(typeRange));
      }
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  async createTypeStage(typeRange) {
    const typeId = typeRange.typeId;
    const code = createWebGpuSourceShader({
      description: this.description,
      dagPrograms: this.dagPrograms,
      typeId,
      workgroupSize: this.workgroupSize,
    });
    this.device.pushErrorScope?.('validation');
    try {
      const module = this.device.createShaderModule({
        label: `WebGPU source type ${typeId}`,
        code,
      });
      await validateShaderModule(module, `source type ${typeId}`);
      const bindGroupLayout = this.device.createBindGroupLayout({
        label: `WebGPU source type ${typeId} layout`,
        entries: [
          readOnlyStorageLayoutEntry(0),
          readOnlyStorageLayoutEntry(1),
          readOnlyStorageLayoutEntry(2),
          storageLayoutEntry(3),
          uniformLayoutEntry(4),
        ],
      });
      const descriptor = {
        label: `WebGPU source type ${typeId}`,
        layout: this.device.createPipelineLayout({
          label: `WebGPU source type ${typeId} pipeline layout`,
          bindGroupLayouts: [bindGroupLayout],
        }),
        compute: { module, entryPoint: 'sourceMain' },
      };
      const pipeline = this.device.createComputePipelineAsync
        ? await this.device.createComputePipelineAsync(descriptor)
        : this.device.createComputePipeline(descriptor);
      const uniformData = createSourceUniformData({
        typeRange,
        rayCapacity: this.rayCapacity,
        wavelengthRange: this.wavelengthRange,
      });
      const uniformBuffer = createInitializedBuffer(
        this.device,
        uniformData,
        BUFFER_USAGE_UNIFORM | BUFFER_USAGE_COPY_DST,
        `WebGPU source type ${typeId} uniforms`
      );
      const buffers = this.staticStorage.buffers;
      const bindGroup = this.device.createBindGroup({
        label: `WebGPU source type ${typeId} bindings`,
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: buffers.sourceDescriptors } },
          { binding: 1, resource: { buffer: buffers.sourceDispatchEntries } },
          { binding: 2, resource: { buffer: buffers.instanceParameters } },
          { binding: 3, resource: { buffer: this.rayBuffer } },
          { binding: 4, resource: { buffer: uniformBuffer } },
        ],
      });
      return { typeId, typeRange, code, pipeline, bindGroup, uniformBuffer };
    } finally {
      const validationError = await this.device.popErrorScope?.();
      if (validationError) throw validationError;
    }
  }

  encode(commandEncoder) {
    if (this.typeStages.length === 0) return;
    const pass = commandEncoder.beginComputePass({
      label: 'WebGPU source emission',
    });
    for (const stage of this.typeStages) {
      pass.setPipeline(stage.pipeline);
      pass.setBindGroup(0, stage.bindGroup);
      pass.dispatchWorkgroups(Math.ceil(
        stage.typeRange.rayCount / this.workgroupSize
      ));
    }
    pass.end();
  }

  /** Test/debug readback. It is deliberately not used by normal execution. */
  async readRays() {
    if (this.packedScene.counts.sourceRays > this.rayCapacity) {
      throw new RangeError('Not all source rays fit in the current GPU batch.');
    }
    const byteLength = this.packedScene.counts.sourceRays * WEBGPU_RAY_STRIDE;
    if (byteLength === 0) return new ArrayBuffer(0);
    const readback = this.device.createBuffer({
      label: 'WebGPU source ray readback',
      size: byteLength,
      usage: BUFFER_USAGE_MAP_READ | BUFFER_USAGE_COPY_DST,
    });
    const encoder = this.device.createCommandEncoder();
    encoder.copyBufferToBuffer(this.rayBuffer, 0, readback, 0, byteLength);
    this.device.queue.submit([encoder.finish()]);
    await readback.mapAsync(1);
    const result = readback.getMappedRange().slice(0);
    readback.unmap();
    readback.destroy?.();
    return result;
  }

  destroy() {
    for (const stage of this.typeStages) stage.uniformBuffer?.destroy?.();
    this.typeStages.length = 0;
    this.rayBuffer?.destroy?.();
    this.rayBuffer = null;
  }
}

/**
 * Owns compute resources for one prepared scene.  Source emission is exposed
 * separately so subsequent membership/trace stages can be added without
 * changing its buffers or recompiling its DAGs.
 */
export class WebGpuComputeBackend {
  constructor(device, preparedScene, config) {
    this.device = device;
    this.preparedScene = preparedScene;
    this.config = config;
    this.staticStorage = null;
    this.sourceStage = null;
    this.membershipStage = null;
    this.interactionIndexStage = null;
    this.rawTraceStage = null;
    this.outgoingStage = null;
    this.canEmitAllSources = false;
  }

  async initialize() {
    this.staticStorage = new WebGpuStaticSceneStorage(
      this.device,
      this.preparedScene.packedStorage
    );
    const sourceRayCount = this.preparedScene.packedStorage.counts.sourceRays;
    const deviceRayLimit = Math.max(1, Math.floor(
      (this.device.limits?.maxStorageBufferBindingSize ??
        this.config.maxBatchRayEvents * WEBGPU_RAY_STRIDE) /
      WEBGPU_RAY_STRIDE
    ));
    const rayCapacity = Math.max(1, Math.min(
      Math.max(1, sourceRayCount),
      this.config.maxBatchRayEvents,
      deviceRayLimit
    ));
    this.canEmitAllSources = sourceRayCount <= rayCapacity;
    this.sourceStage = new WebGpuSourceComputeStage(this.device, {
      description: this.preparedScene.runtimeDescription,
      packedScene: this.preparedScene.packedStorage,
      dagPrograms: this.preparedScene.dagPrograms,
      staticStorage: this.staticStorage,
      wavelengthRange: this.preparedScene.parameterRanges.wavelengthRange[0],
      workgroupSize: this.config.workgroupSize,
      rayCapacity,
    });
    try {
      await this.sourceStage.initialize();
      this.membershipStage = new WebGpuInitialMembershipStage(this.device, {
        description: this.preparedScene.runtimeDescription,
        staticStorage: this.staticStorage,
        rayBuffer: this.sourceStage.rayBuffer,
        rayCapacity,
        workgroupSize: this.config.workgroupSize,
      });
      await this.membershipStage.initialize();
      this.interactionIndexStage = new WebGpuInteractionIndexStage(
        this.device,
        {
          staticStorage: this.staticStorage,
          packedScene: this.preparedScene.packedStorage,
          rayCapacity,
          workgroupSize: this.config.workgroupSize,
          readyLineCapacity: this.config.maxReadyLineRecords,
          readyPointCapacity: this.config.maxReadyPointRecords,
        }
      );
      await this.interactionIndexStage.initialize();
      this.rawTraceStage = new WebGpuRawTraceStage(this.device, {
        description: this.preparedScene.runtimeDescription,
        staticStorage: this.staticStorage,
        rayBuffer: this.sourceStage.rayBuffer,
        membershipBuffer: this.membershipStage.membershipBuffer,
        interactionBuffers: this.interactionIndexStage.buffers,
        interactionTypeLayout:
          this.preparedScene.packedStorage.interactionTypeLayout,
        rayCapacity,
        workgroupSize: this.config.workgroupSize,
      });
      await this.rawTraceStage.initialize();
      this.outgoingStage = new WebGpuOutgoingStage(this.device, {
        description: this.preparedScene.runtimeDescription,
        dagPrograms: this.preparedScene.dagPrograms,
        staticStorage: this.staticStorage,
        rayBuffer: this.sourceStage.rayBuffer,
        membershipBuffer: this.membershipStage.membershipBuffer,
        hitBuffer: this.rawTraceStage.hitBuffer,
        crossingBuffer: this.rawTraceStage.crossingBuffer,
        interactionBuffers: this.interactionIndexStage.buffers,
        rayCapacity,
        workgroupSize: this.config.workgroupSize,
      });
      await this.outgoingStage.initialize();
      this.rawTraceStage.setAlternateInputBuffers(
        this.outgoingStage.rayNextBuffer,
        this.outgoingStage.membershipNextBuffer
      );
      this.outgoingStage.setReverseDirectionBindings();
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  encodeSourceEmission(commandEncoder) {
    if (!this.canEmitAllSources) {
      throw new RangeError(
        'Source population exceeds one WebGPU ray batch; use chunked emission.'
      );
    }
    this.sourceStage.encode(commandEncoder);
  }

  encodeInitialTrace(commandEncoder, {
    pingPongCount = this.getInitialPingPongCount(),
  } = {}) {
    if (!Number.isSafeInteger(pingPongCount) || pingPongCount <= 0) {
      throw new RangeError('pingPongCount must be a positive safe integer.');
    }
    commandEncoder.clearBuffer(this.outgoingStage.detectorResultBuffer);
    this.encodeSourceEmission(commandEncoder);
    this.membershipStage?.encode(commandEncoder);
    this.encodePingPongs(commandEncoder, {
      pingPongCount,
      startDirection: 0,
    });
  }

  encodeContinuation(commandEncoder, {
    pingPongCount,
    startDirection,
  }) {
    this.encodePingPongs(commandEncoder, {
      pingPongCount,
      startDirection,
    });
  }

  encodePingPongs(commandEncoder, { pingPongCount, startDirection }) {
    if (!Number.isSafeInteger(pingPongCount) || pingPongCount <= 0) {
      throw new RangeError('pingPongCount must be a positive safe integer.');
    }
    if (startDirection !== 0 && startDirection !== 1) {
      throw new RangeError('startDirection must be zero or one.');
    }
    for (let pingPong = 0; pingPong < pingPongCount; pingPong++) {
      const direction = (startDirection + pingPong) & 1;
      this.interactionIndexStage.encodeReset(commandEncoder);
      this.rawTraceStage.encode(commandEncoder, direction);
      this.interactionIndexStage.encodePrefixAndFill(commandEncoder);
      this.outgoingStage.encode(commandEncoder, direction);
      this.interactionIndexStage.encodeAdvance(commandEncoder);
    }
  }

  getInitialPingPongCount() {
    const sourceRayCount = this.preparedScene.packedStorage.counts.sourceRays;
    if (sourceRayCount === 0) return 1;
    const rayCount = Math.min(sourceRayCount, this.sourceStage.rayCapacity);
    return this.getPingPongCount(rayCount);
  }

  getPingPongCount(rayCount) {
    if (!Number.isSafeInteger(rayCount) || rayCount <= 0) return 1;
    const limits = [this.config.maxPingPongsPerSubmission ?? 1];
    for (const itemLimit of [
      this.config.maxItemsPerAdvance,
      this.config.maxBatchRayEvents,
    ]) {
      if (Number.isSafeInteger(itemLimit) && itemLimit > 0) {
        limits.push(Math.max(1, Math.floor(itemLimit / rayCount)));
      }
    }
    return Math.max(1, Math.min(...limits));
  }

  encodeStateReadback(commandEncoder) {
    const detectorResultValues =
      this.preparedScene.packedStorage.counts.detectorResultValues;
    const detectorByteLength = detectorResultValues * 8;
    const byteLength = WEBGPU_RUN_CONTROL_SIZE + detectorByteLength;
    const readback = this.device.createBuffer({
      label: 'WebGPU run state readback',
      size: byteLength,
      usage: BUFFER_USAGE_MAP_READ | BUFFER_USAGE_COPY_DST,
    });
    commandEncoder.copyBufferToBuffer(
      this.interactionIndexStage.buffers.runControl,
      0,
      readback,
      0,
      WEBGPU_RUN_CONTROL_SIZE
    );
    if (detectorByteLength > 0) {
      commandEncoder.copyBufferToBuffer(
        this.outgoingStage.detectorResultBuffer,
        0,
        readback,
        WEBGPU_RUN_CONTROL_SIZE,
        detectorByteLength
      );
    }
    let consumed = false;
    return async () => {
      if (consumed) {
        throw new Error('WebGPU run-state readback was already consumed.');
      }
      consumed = true;
      try {
        await readback.mapAsync(1);
        return decodeWebGpuRunState(
          readback.getMappedRange(),
          this.preparedScene.runtimeDescription
        );
      } finally {
        readback.unmap?.();
        readback.destroy?.();
      }
    };
  }

  async readState() {
    const encoder = this.device.createCommandEncoder({
      label: 'WebGPU run state readback',
    });
    const consume = this.encodeStateReadback(encoder);
    this.device.queue.submit([encoder.finish()]);
    return consume();
  }

  destroy() {
    this.sourceStage?.destroy();
    this.membershipStage?.destroy();
    this.rawTraceStage?.destroy();
    this.outgoingStage?.destroy();
    this.interactionIndexStage?.destroy();
    this.staticStorage?.destroy();
    this.sourceStage = null;
    this.membershipStage = null;
    this.rawTraceStage = null;
    this.outgoingStage = null;
    this.interactionIndexStage = null;
    this.staticStorage = null;
  }
}

export function decodeWebGpuRunState(data, description) {
  const bytes = data instanceof ArrayBuffer
    ? data
    : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  if (bytes.byteLength < WEBGPU_RUN_CONTROL_SIZE) {
    throw new RangeError('WebGPU run-state readback is truncated.');
  }
  const control = new Uint32Array(bytes, 0, WEBGPU_RUN_CONTROL_SIZE / 4);
  const detectorLayout = createDetectorResultLayout(description);
  const requiredByteLength = WEBGPU_RUN_CONTROL_SIZE +
    detectorLayout.valueCount * 8;
  if (bytes.byteLength < requiredByteLength) {
    throw new RangeError('WebGPU detector-result readback is truncated.');
  }
  const view = new DataView(bytes);
  const detectors = detectorLayout.results.map(({ offset, size }) => {
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
    currentRayCount: control[0],
    rayCapacity: control[1],
    readyLineCapacity: control[2],
    readyPointCapacity: control[3],
    nextRayCount: control[4],
    requiredRayCapacity: control[5],
    readyLineCount: control[6],
    readyPointCount: control[7],
    resizeNeeded: control[8] !== 0,
    cancelRequested: control[9] !== 0,
    phase: control[10],
    pingPongIndex: control[11],
    detectors,
    detectorOverflow: detectors.some(result =>
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

export function createWebGpuSourceShader({
  description,
  dagPrograms,
  typeId,
  workgroupSize,
}) {
  if (!Number.isInteger(typeId) || !description.types.sources[typeId]) {
    throw new RangeError(`Unknown WebGPU source type ${typeId}.`);
  }
  if (!Number.isSafeInteger(workgroupSize) || workgroupSize <= 0) {
    throw new RangeError('WebGPU workgroupSize must be a positive integer.');
  }
  const definition = description.types.sources[typeId].definition;
  const program = dagPrograms.sources[typeId];
  const argumentsCode = program.parameters.map(name => {
    if (name === 'i') return 'f32(localRayIndex)';
    if (name === 'N') return 'f32(source.rayCount)';
    const parameterIndex = definition.paramNames.indexOf(name);
    if (parameterIndex < 0) {
      throw new Error(
        `Source type ${typeId} has no packed parameter ${JSON.stringify(name)}.`
      );
    }
    return `instanceParameters[source.parameterOffset + ${parameterIndex}u]`;
  });
  const call = argumentsCode.length === 0
    ? `${program.functionName}()`
    : `${program.functionName}(array<f32, ${argumentsCode.length}>(` +
      `${argumentsCode.join(', ')}))`;

  return `${dagPrograms.runtimeCode}\n${program.code}\n
struct SourceDescriptor {
  typeId: u32,
  parameterOffset: u32,
  rayStart: u32,
  rayCount: u32,
};

struct SourceDispatchEntry {
  descriptorIndex: u32,
  typeRayStart: u32,
};

struct Ray {
  origin: vec2f,
  direction: vec2f,
  powers: vec2f,
  wavelength: f32,
  flags: u32,
};

struct SourceUniforms {
  dispatchEntryOffset: u32,
  dispatchEntryCount: u32,
  rayCount: u32,
  rayCapacity: u32,
  wavelengthMin: f32,
  wavelengthMax: f32,
  _padding0: u32,
  _padding1: u32,
};

@group(0) @binding(0) var<storage, read>
  sourceDescriptors: array<SourceDescriptor>;
@group(0) @binding(1) var<storage, read>
  sourceDispatchEntries: array<SourceDispatchEntry>;
@group(0) @binding(2) var<storage, read>
  instanceParameters: array<f32>;
@group(0) @binding(3) var<storage, read_write> rays: array<Ray>;
@group(0) @binding(4) var<uniform> sourceUniforms: SourceUniforms;

fn outputInvalid(output: array<W, 7>) -> bool {
  var invalid = false;
  for (var outputIndex = 0u; outputIndex < 7u; outputIndex++) {
    let value = output[outputIndex].value;
    invalid = invalid || output[outputIndex].invalid ||
      value != value || abs(value) > F32_MAX;
  }
  return invalid;
}

@compute @workgroup_size(${workgroupSize})
fn sourceMain(@builtin(global_invocation_id) invocation: vec3u) {
  let typeRayIndex = invocation.x;
  if (typeRayIndex >= sourceUniforms.rayCount) {
    return;
  }

  var descriptorIndex = 0u;
  var localRayIndex = 0u;
  var found = false;
  for (var relativeEntry = 0u;
       relativeEntry < sourceUniforms.dispatchEntryCount;
       relativeEntry++) {
    let entry = sourceDispatchEntries[
      sourceUniforms.dispatchEntryOffset + relativeEntry
    ];
    let candidate = sourceDescriptors[entry.descriptorIndex];
    if (typeRayIndex >= entry.typeRayStart &&
        typeRayIndex - entry.typeRayStart < candidate.rayCount) {
      descriptorIndex = entry.descriptorIndex;
      localRayIndex = typeRayIndex - entry.typeRayStart;
      found = true;
      break;
    }
  }
  if (!found) {
    return;
  }

  let source = sourceDescriptors[descriptorIndex];
  let outputIndex = source.rayStart + localRayIndex;
  if (outputIndex >= sourceUniforms.rayCapacity) {
    return;
  }
  let output = ${call};
  let directionLengthSquared =
    output[2].value * output[2].value +
    output[3].value * output[3].value;
  let invalid = outputInvalid(output) ||
    !(directionLengthSquared > 0.0) ||
    directionLengthSquared != directionLengthSquared ||
    abs(directionLengthSquared) > F32_MAX ||
    output[4].value < 0.0 || output[5].value < 0.0 ||
    output[4].value > F32_MAX * 0.5 ||
    output[5].value > F32_MAX * 0.5 ||
    output[6].value < sourceUniforms.wavelengthMin ||
    output[6].value > sourceUniforms.wavelengthMax;
  let rayIsActive = !invalid &&
    (output[4].value != 0.0 || output[5].value != 0.0);
  let flags = select(0u, 1u, rayIsActive) | select(0u, 2u, invalid);
  rays[outputIndex] = Ray(
    vec2f(output[0].value, output[1].value),
    vec2f(output[2].value, output[3].value),
    select(vec2f(output[4].value, output[5].value), vec2f(0.0), invalid),
    output[6].value,
    flags
  );
}
`;
}

function createSourceUniformData({
  typeRange,
  rayCapacity,
  wavelengthRange,
}) {
  const data = new ArrayBuffer(32);
  const view = new DataView(data);
  view.setUint32(0, typeRange.dispatchEntryOffset, true);
  view.setUint32(4, typeRange.dispatchEntryCount, true);
  view.setUint32(8, typeRange.rayCount, true);
  view.setUint32(12, rayCapacity, true);
  view.setFloat32(16, Math.fround(wavelengthRange[0]), true);
  view.setFloat32(20, Math.fround(wavelengthRange[1]), true);
  return data;
}

function createInitializedBuffer(
  device,
  data,
  usage,
  label,
  minimumSize = 4
) {
  const bytes = toBytes(data);
  const buffer = device.createBuffer({
    label,
    size: alignTo4(Math.max(minimumSize, bytes.byteLength)),
    usage,
  });
  if (bytes.byteLength > 0) device.queue.writeBuffer(buffer, 0, bytes);
  return buffer;
}

function toBytes(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new TypeError('Packed WebGPU storage must be an ArrayBuffer view.');
}

function alignTo4(value) {
  return Math.ceil(value / 4) * 4;
}

async function validateShaderModule(module, label) {
  if (!module.getCompilationInfo) return;
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter(message => message.type === 'error');
  if (errors.length === 0) return;
  const details = errors.map(message => {
    const position = message.lineNum
      ? `:${message.lineNum}:${message.linePos ?? 0}`
      : '';
    return `${label}${position} ${message.message}`;
  }).join('\n');
  throw new Error(`WebGPU shader compilation failed:\n${details}`);
}

function readOnlyStorageLayoutEntry(binding) {
  return {
    binding,
    visibility: SHADER_STAGE_COMPUTE,
    buffer: { type: 'read-only-storage' },
  };
}

function storageLayoutEntry(binding) {
  return {
    binding,
    visibility: SHADER_STAGE_COMPUTE,
    buffer: { type: 'storage' },
  };
}

function uniformLayoutEntry(binding) {
  return {
    binding,
    visibility: SHADER_STAGE_COMPUTE,
    buffer: { type: 'uniform' },
  };
}
