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
  const activeOffsets = [offset, offset + rayCapacity];
  offset += rayCapacity * 2;
  const activeOffset = activeOffsets[0];
  const blockOffset = offset;
  offset += blockCount;
  return Object.freeze({
    rayCapacity,
    workgroupSize,
    blockCount,
    activeOffset,
    activeOffsets: Object.freeze(activeOffsets),
    blockOffset,
    wordLength: offset,
    byteLength: alignTo4(offset * 4),
  });
}

export function createMegakernelQueueBuffer(device, layout, sourceRayCount) {
  const data = new Uint32Array(layout.wordLength);
  data[0] = sourceRayCount;
  data[1] = layout.rayCapacity;
  data[4] = 0;
  data[5] = sourceRayCount;
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

export function createMegakernelQueueUniformData(
  layout,
  direction,
  rayBase,
  membershipBase,
  membershipStride
) {
  return new Uint32Array([
    layout.rayCapacity,
    layout.activeOffsets[direction],
    layout.blockOffset,
    layout.blockCount,
    rayBase,
    membershipBase,
    membershipStride,
    direction === 0 ? 0 : 4,
    direction * 3,
    0,
    0,
    0,
  ]);
}

/**
 * Systematically samples and stable-compacts current-generation output slots
 * without copying ray payloads. Physical holes have zero weight, while a ray
 * below the configured target power contributes its power divided by that
 * target. The retained representative is amplified before the next trace.
 */
export function createMegakernelCollectorShader(workgroupSize) {
  return `
struct Ray { origin:vec2f,direction:vec2f,powers:vec2f,
  wavelength:f32,flags:u32 };
struct QueueConfig { rayCapacity:u32,activeOffset:u32,blockOffset:u32,
  blockCount:u32,rayBase:u32,membershipBase:u32,membershipStride:u32,
  countWord:u32,dispatchWord:u32,rayPowerCutoff:f32,
  padding1:u32,padding2:u32 };
@group(0) @binding(0) var<storage,read_write> rays:array<Ray>;
@group(0) @binding(1) var<storage,read_write> queue:array<atomic<u32>>;
@group(0) @binding(2) var<uniform> config:QueueConfig;
@group(0) @binding(3) var<storage,read_write>
  dispatchArguments:array<atomic<u32>>;
@group(0) @binding(4) var<storage,read> memberships:array<u32>;
var<workgroup> weights:array<f32,${workgroupSize}>;
var<workgroup> destinations:array<u32,${workgroupSize}>;

fn outputGeneration()->u32 { return atomicLoad(&queue[21])+1u; }
fn samplingPhase(generation:u32)->f32 {
  var value=generation*747796405u+2891336453u;
  value=((value>>((value>>28u)+4u))^value)*277803737u;
  value=(value>>22u)^value;
  return f32(value>>8u)*(1.0/16777216.0);
}
fn rayWeight(index:u32,generation:u32)->f32 {
  if(index>=config.rayCapacity){return 0.0;}
  let storedGeneration=memberships[config.membershipBase+
    index*config.membershipStride+config.membershipStride-1u];
  if(storedGeneration!=generation||(rays[config.rayBase+index].flags&1u)==0u){
    return 0.0;
  }
  if(!(config.rayPowerCutoff>0.0)){return 1.0;}
  let power=rays[config.rayBase+index].powers.x+
    rays[config.rayBase+index].powers.y;
  if(!(power>0.0)){return 0.0;}
  return min(1.0,power/config.rayPowerCutoff);
}

@compute @workgroup_size(${workgroupSize})
fn weightMain(@builtin(workgroup_id) group:vec3u,
  @builtin(local_invocation_id) local:vec3u) {
  let index=group.x*${workgroupSize}u+local.x;
  weights[local.x]=rayWeight(index,outputGeneration());
  workgroupBarrier();
  if(local.x==0u&&group.x<config.blockCount){
    var total=0.0;
    for(var lane=0u;lane<${workgroupSize}u;lane++){total+=weights[lane];}
    atomicStore(&queue[config.blockOffset+group.x],bitcast<u32>(total));
  }
}

@compute @workgroup_size(1)
fn prefixMain(@builtin(global_invocation_id) id:vec3u) {
  if(id.x!=0u){return;}
  var cumulative=0.0;
  let activeBlocks=min(atomicLoad(
    &queue[${MEGAKERNEL_COLLECTOR_BLOCK_COUNT_WORD}]),config.blockCount);
  for(var block=0u;block<activeBlocks;block++){
    let offset=config.blockOffset+block;
    let blockWeight=bitcast<f32>(atomicLoad(&queue[offset]));
    atomicStore(&queue[offset],bitcast<u32>(cumulative));
    cumulative+=blockWeight;
  }
  let count=u32(floor(cumulative+samplingPhase(outputGeneration())));
  atomicStore(&queue[config.countWord],count);atomicMax(&queue[5],count);
  let payload=max(1u,atomicLoad(&queue[15]));
  atomicStore(&dispatchArguments[config.dispatchWord],
    (count+payload-1u)/payload);
  atomicAdd(&queue[11],1u);
  atomicAdd(&queue[21],1u);
}

@compute @workgroup_size(${workgroupSize})
fn fillMain(@builtin(workgroup_id) group:vec3u,
  @builtin(local_invocation_id) local:vec3u) {
  let index=group.x*${workgroupSize}u+local.x;
  let generation=atomicLoad(&queue[21]);
  let weight=rayWeight(index,generation);
  weights[local.x]=weight;workgroupBarrier();
  if(local.x==0u&&group.x<config.blockCount){
    var cumulative=bitcast<f32>(
      atomicLoad(&queue[config.blockOffset+group.x]));
    let phase=samplingPhase(generation);
    for(var lane=0u;lane<${workgroupSize}u;lane++){
      let before=u32(floor(cumulative+phase));
      cumulative+=weights[lane];
      let after=u32(floor(cumulative+phase));
      destinations[lane]=select(0xffffffffu,after-1u,after>before);
    }
  }
  workgroupBarrier();
  let destination=destinations[local.x];
  if(destination!=0xffffffffu){
    if(weight<1.0){
      let rayIndex=config.rayBase+index;
      rays[rayIndex].powers=rays[rayIndex].powers/weight;
    }
    atomicStore(&queue[config.activeOffset+destination],index);
  }
}
`;
}

function alignTo4(value) {
  return Math.ceil(value / 4) * 4;
}
