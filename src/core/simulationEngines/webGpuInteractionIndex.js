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
const BUFFER_USAGE_INDIRECT = 0x0100;

/**
 * GPU stable-partition resources shared by every ping-pong. Contiguous ray
 * blocks are counted and prefix-scanned by interaction type, then scattered
 * without changing their source order. The fixed-size per-block scans exploit
 * the long same-type runs common in optical scenes while keeping alternating
 * worst cases strictly bounded.
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
    this.typeCount = packedScene.counts.interactionTypes;
    this.blockCount = Math.ceil(rayCapacity / workgroupSize);
    this.buffers = Object.create(null);
    this.countPipeline = null;
    this.blockPrefixPipeline = null;
    this.prefixPipeline = null;
    this.fillPipeline = null;
    this.advancePipeline = null;
    this.countBindGroup = null;
    this.blockPrefixBindGroup = null;
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
        workgroupSize: this.workgroupSize,
      }),
      BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_SRC | BUFFER_USAGE_COPY_DST |
        BUFFER_USAGE_INDIRECT,
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
    this.buffers.interactionBlockOffsets = createZeroBuffer(
      this.device,
      Math.max(1, this.blockCount * Math.max(1, typeCount)) * 4,
      'WebGPU stable interaction block offsets'
    );
    this.buffers.dispatchIndirect = createInitializedBuffer(
      this.device,
      new Uint32Array([
        Math.ceil(Math.min(
          this.packedScene.counts.sourceRays,
          this.rayCapacity
        ) / this.workgroupSize),
        1,
        1,
      ]),
      BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_DST | BUFFER_USAGE_INDIRECT,
      'WebGPU ray dispatch arguments'
    );
    this.buffers.uniforms = createInitializedBuffer(
      this.device,
      new Uint32Array([
        typeCount,
        this.rayCapacity,
        this.rayCapacity,
        this.blockCount,
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
      this.countPipeline = await createComputePipeline(this.device, {
        label: 'WebGPU stable interaction block count',
        layout: 'auto',
        compute: { module, entryPoint: 'countMain' },
      });
      this.blockPrefixPipeline = await createComputePipeline(this.device, {
        label: 'WebGPU stable interaction block prefix',
        layout: 'auto',
        compute: { module, entryPoint: 'blockPrefixMain' },
      });
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
    this.countBindGroup = this.device.createBindGroup({
      label: 'WebGPU stable interaction count bindings',
      layout: this.countPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 3, resource: { buffer: this.buffers.runControl } },
        { binding: 4, resource: { buffer: this.buffers.uniforms } },
        { binding: 5, resource: {
          buffer: this.buffers.interactionTypeByRay
        } },
        { binding: 8, resource: {
          buffer: this.buffers.interactionBlockOffsets
        } },
      ],
    });
    this.blockPrefixBindGroup = this.device.createBindGroup({
      label: 'WebGPU stable interaction block-prefix bindings',
      layout: this.blockPrefixPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 1, resource: {
          buffer: this.buffers.interactionTypeCounts
        } },
        { binding: 3, resource: { buffer: this.buffers.runControl } },
        { binding: 4, resource: { buffer: this.buffers.uniforms } },
        { binding: 8, resource: {
          buffer: this.buffers.interactionBlockOffsets
        } },
      ],
    });
    this.prefixBindGroup = this.device.createBindGroup({
      label: 'WebGPU interaction prefix bindings',
      layout: this.prefixPipeline.getBindGroupLayout(0),
      entries: common,
    });
    this.fillBindGroup = this.device.createBindGroup({
      label: 'WebGPU interaction fill bindings',
      layout: this.fillPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 2, resource: {
          buffer: this.buffers.interactionTypeStates
        } },
        { binding: 3, resource: { buffer: this.buffers.runControl } },
        { binding: 4, resource: { buffer: this.buffers.uniforms } },
        { binding: 5, resource: {
          buffer: this.buffers.interactionTypeByRay
        } },
        { binding: 6, resource: {
          buffer: this.buffers.interactionRayIndices
        } },
        { binding: 8, resource: {
          buffer: this.buffers.interactionBlockOffsets
        } },
      ],
    });
    this.advanceBindGroup = this.device.createBindGroup({
      label: 'WebGPU ping-pong advance bindings',
      layout: this.advancePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 3, resource: { buffer: this.buffers.runControl } },
        { binding: 7, resource: { buffer: this.buffers.dispatchIndirect } },
      ],
    });
  }

  encodePrefixAndFill(commandEncoder) {
    let pass = commandEncoder.beginComputePass({
      label: 'WebGPU stable interaction block count',
    });
    pass.setPipeline(this.countPipeline);
    pass.setBindGroup(0, this.countBindGroup);
    pass.dispatchWorkgroupsIndirect(this.buffers.dispatchIndirect, 0);
    pass.end();

    pass = commandEncoder.beginComputePass({
      label: 'WebGPU stable interaction block prefix',
    });
    pass.setPipeline(this.blockPrefixPipeline);
    pass.setBindGroup(0, this.blockPrefixBindGroup);
    pass.dispatchWorkgroups(Math.max(1, this.typeCount));
    pass.end();

    pass = commandEncoder.beginComputePass({
      label: 'WebGPU interaction prefix scan',
    });
    pass.setPipeline(this.prefixPipeline);
    pass.setBindGroup(0, this.prefixBindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();

    pass = commandEncoder.beginComputePass({
      label: 'WebGPU stable interaction index fill',
    });
    pass.setPipeline(this.fillPipeline);
    pass.setBindGroup(0, this.fillBindGroup);
    pass.dispatchWorkgroupsIndirect(this.buffers.dispatchIndirect, 0);
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
    this.countPipeline = null;
    this.blockPrefixPipeline = null;
    this.prefixPipeline = null;
    this.fillPipeline = null;
    this.advancePipeline = null;
    this.countBindGroup = null;
    this.blockPrefixBindGroup = null;
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
  reserved: u32,
};

struct IndexUniforms {
  typeCount: u32,
  rayCapacity: u32,
  indexCapacity: u32,
  blockCount: u32,
};

@group(0) @binding(0) var<storage, read>
  typeDescriptors: array<InteractionTypeDescriptor>;
@group(0) @binding(1) var<storage, read_write>
  typeCounts: array<u32>;
@group(0) @binding(2) var<storage, read_write>
  typeStates: array<InteractionTypeState>;
@group(0) @binding(3) var<storage, read_write>
  runControl: array<atomic<u32>>;
@group(0) @binding(4) var<uniform> indexUniforms: IndexUniforms;
@group(0) @binding(5) var<storage, read>
  interactionTypeByRay: array<u32>;
@group(0) @binding(6) var<storage, read_write>
  interactionRayIndices: array<u32>;
@group(0) @binding(7) var<storage, read_write>
  dispatchArguments: array<atomic<u32>>;
@group(0) @binding(8) var<storage, read_write>
  interactionBlockOffsets: array<u32>;

var<workgroup> blockTypes: array<u32, ${workgroupSize}>;
var<workgroup> blockDestinations: array<u32, ${workgroupSize}>;

@compute @workgroup_size(${workgroupSize})
fn countMain(
  @builtin(workgroup_id) workgroup: vec3u,
  @builtin(local_invocation_id) local: vec3u
) {
  let blockIndex = workgroup.x;
  let rayIndex = blockIndex * ${workgroupSize}u + local.x;
  let currentRayCount = atomicLoad(&runControl[0]);
  var rayType = 0xffffffffu;
  if (rayIndex < currentRayCount && rayIndex < indexUniforms.rayCapacity) {
    rayType = interactionTypeByRay[rayIndex];
  }
  blockTypes[local.x] = rayType;
  workgroupBarrier();
  if (local.x != 0u || blockIndex >= indexUniforms.blockCount) { return; }
  for (var typeIndex = 0u;
       typeIndex < indexUniforms.typeCount;
       typeIndex++) {
    interactionBlockOffsets[
      blockIndex * indexUniforms.typeCount + typeIndex
    ] = 0u;
  }
  var index = 0u;
  while (index < ${workgroupSize}u) {
    let typeIndex = blockTypes[index];
    var runEnd = index + 1u;
    while (runEnd < ${workgroupSize}u &&
           blockTypes[runEnd] == typeIndex) {
      runEnd++;
    }
    if (typeIndex < indexUniforms.typeCount) {
      let offset = blockIndex * indexUniforms.typeCount + typeIndex;
      interactionBlockOffsets[offset] += runEnd - index;
    }
    index = runEnd;
  }
}

@compute @workgroup_size(1)
fn blockPrefixMain(@builtin(global_invocation_id) invocation: vec3u) {
  let typeIndex = invocation.x;
  if (typeIndex >= indexUniforms.typeCount) { return; }
  let activeBlockCount = min(
    indexUniforms.blockCount,
    (atomicLoad(&runControl[0]) + ${workgroupSize - 1}u) /
      ${workgroupSize}u
  );
  var count = 0u;
  for (var blockIndex = 0u;
       blockIndex < activeBlockCount;
       blockIndex++) {
    let offset = blockIndex * indexUniforms.typeCount + typeIndex;
    let blockCount = interactionBlockOffsets[offset];
    interactionBlockOffsets[offset] = count;
    count += blockCount;
  }
  typeCounts[typeIndex] = count;
}

@compute @workgroup_size(1)
fn prefixMain(@builtin(global_invocation_id) invocation: vec3u) {
  if (invocation.x != 0u) { return; }
  var sourceIndexStart = 0u;
  var destinationRayStart = 0u;
  var overflow = false;
  for (var typeIndex = 0u;
       typeIndex < indexUniforms.typeCount;
       typeIndex++) {
    let interactionCount = typeCounts[typeIndex];
    let outRayCount = typeDescriptors[typeIndex].outRayCount;
    typeStates[typeIndex].interactionCount = interactionCount;
    typeStates[typeIndex].sourceIndexStart = sourceIndexStart;
    typeStates[typeIndex].destinationRayStart = destinationRayStart;
    typeStates[typeIndex].reserved = 0u;
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
fn fillMain(
  @builtin(workgroup_id) workgroup: vec3u,
  @builtin(local_invocation_id) local: vec3u
) {
  let canFill = atomicLoad(&runControl[8]) == 0u;
  let blockIndex = workgroup.x;
  let rayIndex = blockIndex * ${workgroupSize}u + local.x;
  let currentRayCount = atomicLoad(&runControl[0]);
  var rayType = 0xffffffffu;
  if (canFill && rayIndex < currentRayCount &&
      rayIndex < indexUniforms.rayCapacity) {
    rayType = interactionTypeByRay[rayIndex];
  }
  blockTypes[local.x] = rayType;
  blockDestinations[local.x] = 0xffffffffu;
  workgroupBarrier();
  if (canFill && local.x == 0u &&
      blockIndex < indexUniforms.blockCount) {
    var index = 0u;
    while (index < ${workgroupSize}u) {
      let typeIndex = blockTypes[index];
      var runEnd = index + 1u;
      while (runEnd < ${workgroupSize}u &&
             blockTypes[runEnd] == typeIndex) {
        runEnd++;
      }
      if (typeIndex < indexUniforms.typeCount) {
        let offset = blockIndex * indexUniforms.typeCount + typeIndex;
        let blockCursor = interactionBlockOffsets[offset];
        let destinationStart = typeStates[typeIndex].sourceIndexStart;
        for (var runIndex = index; runIndex < runEnd; runIndex++) {
          blockDestinations[runIndex] =
            destinationStart + blockCursor + runIndex - index;
        }
        interactionBlockOffsets[offset] = blockCursor + runEnd - index;
      }
      index = runEnd;
    }
  }
  workgroupBarrier();
  let outputIndex = blockDestinations[local.x];
  if (outputIndex < indexUniforms.indexCapacity) {
    interactionRayIndices[outputIndex] = rayIndex;
  }
}

@compute @workgroup_size(1)
fn advanceMain(@builtin(global_invocation_id) invocation: vec3u) {
  if (invocation.x != 0u) { return; }
  let nextRayCount=atomicLoad(&runControl[4]);
  atomicStore(&runControl[0],nextRayCount);
  atomicStore(&runControl[4], 0u);
  atomicStore(&dispatchArguments[0],
    (nextRayCount+${workgroupSize - 1}u)/${workgroupSize}u);
  atomicStore(&dispatchArguments[1],1u);
  atomicStore(&dispatchArguments[2],1u);
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
