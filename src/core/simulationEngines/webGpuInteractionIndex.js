/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import {
  WEBGPU_RUN_CONTROL_SIZE,
  createWebGpuRunControlData
} from './webGpuStorage.js';

const BUFFER_USAGE_COPY_SRC = 0x0004;
const BUFFER_USAGE_COPY_DST = 0x0008;
const BUFFER_USAGE_UNIFORM = 0x0040;
const BUFFER_USAGE_STORAGE = 0x0080;

/**
 * GPU count/scan/fill resources shared by every ping-pong.  The prefix scan
 * is intentionally one invocation: registered interaction-type counts are
 * tiny compared with ray counts, and a serial scan avoids another hierarchy
 * of temporary buffers and submissions.
 */
export class WebGpuInteractionIndexStage {
  constructor(device, {
    staticStorage,
    packedScene,
    rayCapacity,
    workgroupSize,
    readyLineCapacity,
    readyPointCapacity,
  }) {
    this.device = device;
    this.staticStorage = staticStorage;
    this.packedScene = packedScene;
    this.rayCapacity = rayCapacity;
    this.workgroupSize = workgroupSize;
    this.readyLineCapacity = readyLineCapacity;
    this.readyPointCapacity = readyPointCapacity;
    this.buffers = Object.create(null);
    this.prefixPipeline = null;
    this.fillPipeline = null;
    this.advancePipeline = null;
    this.prefixBindGroup = null;
    this.fillBindGroup = null;
    this.advanceBindGroup = null;
  }

  async initialize() {
    const typeCount = this.packedScene.counts.interactionTypes;
    this.buffers.runControl = createInitializedBuffer(
      this.device,
      createWebGpuRunControlData({
        currentRayCount: Math.min(
          this.packedScene.counts.sourceRays,
          this.rayCapacity
        ),
        rayCapacity: this.rayCapacity,
        readyLineCapacity: this.readyLineCapacity,
        readyPointCapacity: this.readyPointCapacity,
      }),
      BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_SRC | BUFFER_USAGE_COPY_DST,
      'WebGPU run control'
    );
    this.buffers.interactionTypeCounts = createZeroBuffer(
      this.device, Math.max(1, typeCount) * 4,
      'WebGPU interaction type counts'
    );
    this.buffers.interactionTypeStates = createZeroBuffer(
      this.device, Math.max(1, typeCount) * 16,
      'WebGPU interaction type states'
    );
    this.buffers.interactionTypeByRay = createZeroBuffer(
      this.device, this.rayCapacity * 4,
      'WebGPU interaction type by ray'
    );
    this.buffers.interactionRayIndices = createZeroBuffer(
      this.device, this.rayCapacity * 4,
      'WebGPU interaction ray indices'
    );
    this.buffers.uniforms = createInitializedBuffer(
      this.device,
      new Uint32Array([
        typeCount,
        this.rayCapacity,
        this.rayCapacity,
        0,
      ]),
      BUFFER_USAGE_UNIFORM | BUFFER_USAGE_COPY_DST,
      'WebGPU interaction index uniforms'
    );

    this.device.pushErrorScope?.('validation');
    try {
      const module = this.device.createShaderModule({
        label: 'WebGPU interaction index',
        code: createWebGpuInteractionIndexShader(this.workgroupSize),
      });
      await validateShaderModule(module, 'interaction index');
      this.prefixPipeline = await createComputePipeline(this.device, {
        label: 'WebGPU interaction prefix scan',
        layout: 'auto',
        compute: { module, entryPoint: 'prefixMain' },
      });
      this.fillPipeline = await createComputePipeline(this.device, {
        label: 'WebGPU interaction index fill',
        layout: 'auto',
        compute: { module, entryPoint: 'fillMain' },
      });
      this.advancePipeline = await createComputePipeline(this.device, {
        label: 'WebGPU ping-pong advance',
        layout: 'auto',
        compute: { module, entryPoint: 'advanceMain' },
      });
      this.rebuildBindGroups();
    } catch (error) {
      this.destroy();
      throw error;
    } finally {
      const validationError = await this.device.popErrorScope?.();
      if (validationError) throw validationError;
    }
  }

  rebuildBindGroups() {
    const common = [
      { binding: 0, resource: {
        buffer: this.staticStorage.buffers.interactionTypeDescriptors
      } },
      { binding: 1, resource: {
        buffer: this.buffers.interactionTypeCounts
      } },
      { binding: 2, resource: {
        buffer: this.buffers.interactionTypeStates
      } },
      { binding: 3, resource: { buffer: this.buffers.runControl } },
      { binding: 4, resource: { buffer: this.buffers.uniforms } },
    ];
    this.prefixBindGroup = this.device.createBindGroup({
      label: 'WebGPU interaction prefix bindings',
      layout: this.prefixPipeline.getBindGroupLayout(0),
      entries: common,
    });
    this.fillBindGroup = this.device.createBindGroup({
      label: 'WebGPU interaction fill bindings',
      layout: this.fillPipeline.getBindGroupLayout(0),
      entries: [
        ...common,
        { binding: 5, resource: {
          buffer: this.buffers.interactionTypeByRay
        } },
        { binding: 6, resource: {
          buffer: this.buffers.interactionRayIndices
        } },
      ],
    });
    this.advanceBindGroup = this.device.createBindGroup({
      label: 'WebGPU ping-pong advance bindings',
      layout: this.advancePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 3, resource: { buffer: this.buffers.runControl } },
      ],
    });
  }

  encodeReset(commandEncoder) {
    commandEncoder.clearBuffer(this.buffers.interactionTypeCounts);
    commandEncoder.clearBuffer(this.buffers.interactionTypeStates);
  }

  encodePrefixAndFill(commandEncoder) {
    let pass = commandEncoder.beginComputePass({
      label: 'WebGPU interaction prefix scan',
    });
    pass.setPipeline(this.prefixPipeline);
    pass.setBindGroup(0, this.prefixBindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();

    pass = commandEncoder.beginComputePass({
      label: 'WebGPU interaction index fill',
    });
    pass.setPipeline(this.fillPipeline);
    pass.setBindGroup(0, this.fillBindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.rayCapacity / this.workgroupSize));
    pass.end();
  }

  encodeAdvance(commandEncoder) {
    const pass = commandEncoder.beginComputePass({
      label: 'WebGPU ping-pong advance',
    });
    pass.setPipeline(this.advancePipeline);
    pass.setBindGroup(0, this.advanceBindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
  }

  destroy() {
    for (const buffer of Object.values(this.buffers)) buffer.destroy?.();
    this.buffers = Object.create(null);
    this.prefixPipeline = null;
    this.fillPipeline = null;
    this.advancePipeline = null;
    this.prefixBindGroup = null;
    this.fillBindGroup = null;
    this.advanceBindGroup = null;
  }
}

export function createWebGpuInteractionIndexShader(workgroupSize) {
  if (!Number.isSafeInteger(workgroupSize) || workgroupSize <= 0) {
    throw new RangeError('WebGPU workgroupSize must be a positive integer.');
  }
  return `
struct InteractionTypeDescriptor {
  kind: u32,
  typeId: u32,
  outRayCount: u32,
  flags: u32,
};

struct InteractionTypeState {
  interactionCount: u32,
  sourceIndexStart: u32,
  destinationRayStart: u32,
  cursor: atomic<u32>,
};

struct IndexUniforms {
  typeCount: u32,
  rayCapacity: u32,
  indexCapacity: u32,
  _padding: u32,
};

@group(0) @binding(0) var<storage, read>
  typeDescriptors: array<InteractionTypeDescriptor>;
@group(0) @binding(1) var<storage, read_write>
  typeCounts: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write>
  typeStates: array<InteractionTypeState>;
@group(0) @binding(3) var<storage, read_write>
  runControl: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> indexUniforms: IndexUniforms;
@group(0) @binding(5) var<storage, read>
  interactionTypeByRay: array<u32>;
@group(0) @binding(6) var<storage, read_write>
  interactionRayIndices: array<u32>;

@compute @workgroup_size(1)
fn prefixMain(@builtin(global_invocation_id) invocation: vec3u) {
  if (invocation.x != 0u) { return; }
  var sourceIndexStart = 0u;
  var destinationRayStart = 0u;
  var overflow = false;
  for (var typeIndex = 0u;
       typeIndex < indexUniforms.typeCount;
       typeIndex++) {
    let interactionCount = atomicLoad(&typeCounts[typeIndex]);
    let outRayCount = typeDescriptors[typeIndex].outRayCount;
    typeStates[typeIndex].interactionCount = interactionCount;
    typeStates[typeIndex].sourceIndexStart = sourceIndexStart;
    typeStates[typeIndex].destinationRayStart = destinationRayStart;
    atomicStore(&typeStates[typeIndex].cursor, 0u);
    sourceIndexStart += interactionCount;
    if (outRayCount != 0u &&
        interactionCount > (0xffffffffu - destinationRayStart) /
          outRayCount) {
      destinationRayStart = 0xffffffffu;
      overflow = true;
    } else if (!overflow) {
      destinationRayStart += interactionCount * outRayCount;
    }
  }
  atomicStore(&runControl[4], destinationRayStart);
  atomicMax(&runControl[5], destinationRayStart);
  if (overflow || destinationRayStart > indexUniforms.rayCapacity ||
      sourceIndexStart > indexUniforms.indexCapacity) {
    atomicStore(&runControl[8], 1u);
  }
}

@compute @workgroup_size(${workgroupSize})
fn fillMain(@builtin(global_invocation_id) invocation: vec3u) {
  if (atomicLoad(&runControl[8]) != 0u) { return; }
  let rayIndex = invocation.x;
  let currentRayCount = atomicLoad(&runControl[0]);
  if (rayIndex >= currentRayCount || rayIndex >= indexUniforms.rayCapacity) {
    return;
  }
  let typeIndex = interactionTypeByRay[rayIndex];
  if (typeIndex >= indexUniforms.typeCount) { return; }
  if (atomicLoad(&typeCounts[typeIndex]) == 0u ||
      typeDescriptors[typeIndex].outRayCount == 0u) { return; }
  let localIndex = atomicAdd(&typeStates[typeIndex].cursor, 1u);
  if (localIndex >= typeStates[typeIndex].interactionCount) { return; }
  let outputIndex = typeStates[typeIndex].sourceIndexStart + localIndex;
  if (outputIndex < indexUniforms.indexCapacity) {
    interactionRayIndices[outputIndex] = rayIndex;
  }
}

@compute @workgroup_size(1)
fn advanceMain(@builtin(global_invocation_id) invocation: vec3u) {
  if (invocation.x != 0u) { return; }
  atomicStore(&runControl[0], atomicLoad(&runControl[4]));
  atomicStore(&runControl[4], 0u);
  atomicAdd(&runControl[11], 1u);
}
`;
}

function createZeroBuffer(device, size, label) {
  return createInitializedBuffer(
    device,
    new Uint8Array(size),
    BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_SRC | BUFFER_USAGE_COPY_DST,
    label
  );
}

function createInitializedBuffer(device, data, usage, label) {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: Math.max(4, Math.ceil(bytes.byteLength / 4) * 4),
    usage,
  });
  if (bytes.byteLength > 0) device.queue.writeBuffer(buffer, 0, bytes);
  return buffer;
}

function createComputePipeline(device, descriptor) {
  return device.createComputePipelineAsync
    ? device.createComputePipelineAsync(descriptor)
    : Promise.resolve(device.createComputePipeline(descriptor));
}

async function validateShaderModule(module, label) {
  if (!module.getCompilationInfo) return;
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter(message => message.type === 'error');
  if (errors.length === 0) return;
  throw new Error('WebGPU shader compilation failed:\n' + errors.map(
    message => `${label}:${message.lineNum ?? 0}:${message.linePos ?? 0} ` +
      message.message
  ).join('\n'));
}

export { WEBGPU_RUN_CONTROL_SIZE };
