/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

const BUFFER_USAGE_COPY_SRC = 0x0004;
const BUFFER_USAGE_COPY_DST = 0x0008;
const BUFFER_USAGE_STORAGE = 0x0080;

export const MEGAKERNEL_CONTROL_WORDS = 32;
export const MEGAKERNEL_COLLECTOR_BLOCK_COUNT_WORD = 20;

/** Queue metadata shared by the two ray-buffer directions. */
export function createMegakernelQueueLayout(rayCapacity, workgroupSize) {
  const blockCount = Math.ceil(rayCapacity / workgroupSize);
  let offset = MEGAKERNEL_CONTROL_WORDS;
  const activeOffset = offset;
  offset += rayCapacity;
  const blockOffset = offset;
  offset += blockCount;
  return Object.freeze({
    rayCapacity,
    workgroupSize,
    blockCount,
    activeOffset,
    blockOffset,
    wordLength: offset,
    byteLength: alignTo4(offset * 4),
  });
}

export function createMegakernelQueueBuffer(device, layout, sourceRayCount) {
  const data = new Uint32Array(layout.wordLength);
  data[0] = sourceRayCount;
  data[1] = layout.rayCapacity;
  data[4] = sourceRayCount;
  data[5] = sourceRayCount;
  data[12] = Math.ceil(sourceRayCount / layout.workgroupSize);
  data[13] = 1;
  data[14] = 1;
  for (let index = 0; index < sourceRayCount; index++) {
    data[layout.activeOffset + index] = index;
  }
  const buffer = device.createBuffer({
    label: 'WebGPU megakernel queue metadata',
    size: layout.byteLength,
    usage: BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_SRC |
      BUFFER_USAGE_COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

export function createMegakernelQueueUniformData(layout, rayBase = 0) {
  return new Uint32Array([
    layout.rayCapacity,
    layout.activeOffset,
    layout.blockOffset,
    layout.blockCount,
    rayBase,
    0,
    0,
    0,
  ]);
}

export function createMegakernelRayFlagClearUniformData(
  rayCapacity,
  rayBase = 0
) {
  return new Uint32Array([rayCapacity, rayBase, 0, 0]);
}

/** Clears only stale activity flags before a ray-buffer half is reused. */
export function createMegakernelRayFlagClearShader(workgroupSize) {
  return `
struct Ray { origin:vec2f,direction:vec2f,powers:vec2f,
  wavelength:f32,flags:u32 };
struct ClearConfig { rayCapacity:u32,rayBase:u32,padding0:u32,padding1:u32 };
@group(0) @binding(0) var<storage,read_write> rays:array<Ray>;
@group(0) @binding(1) var<uniform> config:ClearConfig;

@compute @workgroup_size(${workgroupSize})
fn clearMain(@builtin(global_invocation_id) invocation:vec3u) {
  if(invocation.x<config.rayCapacity){
    rays[config.rayBase+invocation.x].flags=0u;
  }
}
`;
}

/**
 * Stable-compacts isActive output slots without copying ray payloads. Each block
 * is counted, a single small prefix pass assigns block starts, and the fill
 * pass preserves physical (therefore slot-major) order.
 */
export function createMegakernelCollectorShader(workgroupSize) {
  return `
struct Ray { origin:vec2f,direction:vec2f,powers:vec2f,
  wavelength:f32,flags:u32 };
struct QueueConfig { rayCapacity:u32,activeOffset:u32,blockOffset:u32,
  blockCount:u32,rayBase:u32,padding0:u32,padding1:u32,padding2:u32 };
@group(0) @binding(0) var<storage,read> rays:array<Ray>;
@group(0) @binding(1) var<storage,read_write> queue:array<atomic<u32>>;
@group(0) @binding(2) var<uniform> config:QueueConfig;
@group(0) @binding(3) var<storage,read_write>
  dispatchArguments:array<atomic<u32>>;
var<workgroup> flags:array<u32,${workgroupSize}>;
var<workgroup> destinations:array<u32,${workgroupSize}>;

@compute @workgroup_size(${workgroupSize})
fn countMain(@builtin(workgroup_id) group:vec3u,
  @builtin(local_invocation_id) local:vec3u) {
  let index=group.x*${workgroupSize}u+local.x;
  flags[local.x]=select(0u,1u,index<config.rayCapacity&&
    (rays[config.rayBase+index].flags&1u)!=0u);
  workgroupBarrier();
  if(local.x!=0u||group.x>=config.blockCount){return;}
  var count=0u;
  for(var lane=0u;lane<${workgroupSize}u;lane++){count+=flags[lane];}
  atomicStore(&queue[config.blockOffset+group.x],count);
  atomicMax(&queue[${MEGAKERNEL_COLLECTOR_BLOCK_COUNT_WORD}],group.x+1u);
}

@compute @workgroup_size(1)
fn prefixMain(@builtin(global_invocation_id) id:vec3u) {
  if(id.x!=0u){return;}
  var count=0u;
  let activeBlocks=min(atomicLoad(
    &queue[${MEGAKERNEL_COLLECTOR_BLOCK_COUNT_WORD}]),config.blockCount);
  for(var block=0u;block<activeBlocks;block++){
    let offset=config.blockOffset+block;
    let blockCount=atomicLoad(&queue[offset]);
    atomicStore(&queue[offset],count);count+=blockCount;
  }
  atomicStore(&queue[0],count);atomicMax(&queue[5],count);
  let payload=max(1u,atomicLoad(&queue[15]));
  atomicStore(&dispatchArguments[0],(count+payload-1u)/payload);
  atomicStore(&dispatchArguments[1],1u);
  atomicStore(&dispatchArguments[2],1u);
  atomicAdd(&queue[11],1u);
}

@compute @workgroup_size(${workgroupSize})
fn fillMain(@builtin(workgroup_id) group:vec3u,
  @builtin(local_invocation_id) local:vec3u) {
  let index=group.x*${workgroupSize}u+local.x;
  let isActive=select(0u,1u,index<config.rayCapacity&&
    (rays[config.rayBase+index].flags&1u)!=0u);
  flags[local.x]=isActive;workgroupBarrier();
  if(local.x==0u&&group.x<config.blockCount){
    var cursor=atomicLoad(&queue[config.blockOffset+group.x]);
    for(var lane=0u;lane<${workgroupSize}u;lane++){
      destinations[lane]=cursor;cursor+=flags[lane];
    }
  }
  workgroupBarrier();
  if(isActive!=0u){
    atomicStore(&queue[config.activeOffset+destinations[local.x]],index);
  }
}
`;
}

function alignTo4(value) {
  return Math.ceil(value / 4) * 4;
}
