/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { createWebGpuInitialMembershipShader } from './webGpuMembership.js';

const SHADER_STAGE_COMPUTE = 0x0004;
const BUFFER_USAGE_COPY_DST = 0x0008;
const BUFFER_USAGE_UNIFORM = 0x0040;

/** Build the source-emission and initial-membership megakernel. */
export function createMegakernelInitialShader({
  description,
  dagPrograms,
  workgroupSize,
}) {
  const membership = createWebGpuInitialMembershipShader(
    description,
    workgroupSize
  );
  if (!membership.supported) return membership;
  const regionWordCount = Math.max(1, Math.ceil(description.regions.length / 32));
  const membershipCode = membership.code
    ? extractMembershipCode(membership.code)
    : emptyMembershipCode(regionWordCount);
  const sourcePrograms = dagPrograms.sources.map(program => program.code)
    .join('\n');
  const sourceCases = description.types.sources.map((type, typeId) =>
    createSourceCase(type.definition, dagPrograms.sources[typeId], typeId)
  ).join('\n');
  return {
    supported: true,
    unsupported: [],
    code: `${dagPrograms.runtimeCode}\n${sourcePrograms}\n
struct Ray { origin:vec2f,direction:vec2f,powers:vec2f,
  wavelength:f32,flags:u32 };
struct SourceDescriptor { typeId:u32,parameterOffset:u32,rayStart:u32,
  rayCount:u32 };
struct CurveDescriptor { kind:u32,ownerKind:u32,ownerId:u32,flags:u32,
  geometryOffset:u32,geometryCount:u32,filterWavelength:f32,
  filterBandwidth:f32 };
struct BvhNode { bounds:vec4f,first:i32,second:i32,ownerKindMask:u32,
  flags:u32 };
struct MembershipUniforms { rayCount:u32,rayCapacity:u32,bvhRoot:i32,
  curveCount:u32,regionCount:u32,regionWordCount:u32,
  originTolerance:f32,padding:f32 };
struct Crossing { count:u32,ambiguous:u32,nearest:f32,padding:f32 };
struct Attempt { mask:array<u32,${regionWordCount}>,ambiguous:u32,
  nearest:f32 };
struct InitialConfig { sourceCount:u32,sourceRayCount:u32,rayCapacity:u32,
  regionWordCount:u32,wavelengthMin:f32,wavelengthMax:f32,
  padding0:u32,padding1:u32 };
@group(0) @binding(0) var<storage,read> sourceDescriptors:
  array<SourceDescriptor>;
@group(0) @binding(1) var<storage,read> instanceParameters:array<f32>;
@group(0) @binding(2) var<storage,read> curves:array<CurveDescriptor>;
@group(0) @binding(3) var<storage,read> geometry:array<f32>;
@group(0) @binding(4) var<storage,read> bvhNodes:array<BvhNode>;
@group(0) @binding(5) var<storage,read> bvhCurveIds:array<u32>;
@group(0) @binding(6) var<storage,read_write> rays:array<Ray>;
@group(0) @binding(7) var<storage,read_write> memberships:array<u32>;
@group(0) @binding(8) var<uniform> membershipUniforms:MembershipUniforms;
@group(0) @binding(9) var<uniform> initialConfig:InitialConfig;

fn sourceInvalid(output:array<W,7>)->bool {
  var invalid=false;
  for(var index=0u;index<7u;index++){
    invalid=invalid||output[index].invalid||output[index].value!=
      output[index].value||abs(output[index].value)>F32_MAX;
  }
  return invalid;
}
fn findSource(rayIndex:u32)->u32 {
  var low=0u;var high=initialConfig.sourceCount;
  while(low<high){
    let middle=low+(high-low)/2u;
    if(sourceDescriptors[middle].rayStart<=rayIndex){low=middle+1u;}
    else{high=middle;}
  }
  return select(0xffffffffu,low-1u,low>0u);
}
fn emitSource(rayIndex:u32)->Ray {
  let sourceIndex=findSource(rayIndex);
  if(sourceIndex>=initialConfig.sourceCount){
    return Ray(vec2f(0.0),vec2f(0.0),vec2f(0.0),0.0,2u);
  }
  let source=sourceDescriptors[sourceIndex];
  let localRayIndex=rayIndex-source.rayStart;
  switch source.typeId { ${sourceCases} default:{
    return Ray(vec2f(0.0),vec2f(0.0),vec2f(0.0),0.0,2u);
  } }
}
${membershipCode}

@compute @workgroup_size(${workgroupSize})
fn initialMain(@builtin(global_invocation_id) invocation:vec3u) {
  let rayIndex=invocation.x;
  if(rayIndex>=initialConfig.sourceRayCount||
    rayIndex>=initialConfig.rayCapacity){return;}
  var ray=emitSource(rayIndex);rays[rayIndex]=ray;
  var mask:array<u32,${regionWordCount}>;
  if((ray.flags&1u)==0u){storeMembership(rayIndex,mask);return;}
  for(var attempt=0u;attempt<4u;attempt++){
    let result=membershipAttempt(ray);
    if(result.ambiguous==0u){storeMembership(rayIndex,result.mask);return;}
    if(attempt==3u||result.nearest==F32_MAX||!(result.nearest>0.0)){break;}
    ray.origin+=0.5*result.nearest*ray.direction;
    ray.direction=vec2f(-0.737368878*ray.direction.x-
      0.675490294*ray.direction.y,0.675490294*ray.direction.x-
      0.737368878*ray.direction.y);
  }
  storeMembership(rayIndex,mask);rays[rayIndex].powers=vec2f(0.0);
  rays[rayIndex].flags=2u;
}`,
  };
}

export function createMegakernelInitialUniformData(description, rayCapacity) {
  const membership = new ArrayBuffer(32);
  const membershipView = new DataView(membership);
  membershipView.setUint32(0, Math.min(
    description.sources.reduce((sum, source) => sum + source.rayCount, 0),
    rayCapacity
  ), true);
  membershipView.setUint32(4, rayCapacity, true);
  membershipView.setInt32(8, description.bvh.root, true);
  membershipView.setUint32(12, description.curves.length, true);
  membershipView.setUint32(16, description.regions.length, true);
  membershipView.setUint32(20, Math.ceil(description.regions.length / 32), true);
  membershipView.setFloat32(24, Math.fround(
    description.numericalTolerances?.forwardDistance ?? 0
  ), true);
  return membership;
}

export function createMegakernelInitialConfigData({
  description,
  rayCapacity,
  wavelengthRange,
}) {
  const data = new ArrayBuffer(32);
  const view = new DataView(data);
  view.setUint32(0, description.sources.length, true);
  view.setUint32(4, description.sources.reduce(
    (sum, source) => sum + source.rayCount, 0
  ), true);
  view.setUint32(8, rayCapacity, true);
  view.setUint32(12, Math.ceil(description.regions.length / 32), true);
  view.setFloat32(16, wavelengthRange[0], true);
  view.setFloat32(20, wavelengthRange[1], true);
  return data;
}

function createSourceCase(definition, program, typeId) {
  const args = program.parameters.map(name => {
    if (name === 'i') return 'f32(localRayIndex)';
    if (name === 'N') return 'f32(source.rayCount)';
    const index = definition.paramNames.indexOf(name);
    if (index < 0) {
      throw new Error(`Source type ${typeId} has no parameter ${name}.`);
    }
    return `instanceParameters[source.parameterOffset+${index}u]`;
  });
  const call = args.length === 0
    ? `${program.functionName}()`
    : `${program.functionName}(array<f32,${args.length}>(${args.join(',')}))`;
  return `case ${typeId}u:{
    let output=${call};
    let direction=vec2f(output[2].value,output[3].value);
    let powers=vec2f(output[4].value,output[5].value);
    let lengthSquared=dot(direction,direction);
    let invalid=sourceInvalid(output)||!(lengthSquared>0.0)||
      powers.x<0.0||powers.y<0.0||
      output[6].value<initialConfig.wavelengthMin||
      output[6].value>initialConfig.wavelengthMax;
    let isActive=!invalid&&(powers.x!=0.0||powers.y!=0.0);
    return Ray(vec2f(output[0].value,output[1].value),
      select(direction,vec2f(0.0),invalid),
      select(powers,vec2f(0.0),invalid),output[6].value,
      select(select(0u,1u,isActive),2u,invalid));
  }`;
}

function extractMembershipCode(code) {
  const constantsStart = code.indexOf('const PARAMETER_TOLERANCE');
  const structsStart = code.indexOf('struct Ray');
  const helpersStart = code.indexOf('fn cross2');
  const mainStart = code.indexOf('@compute');
  if (constantsStart < 0 || structsStart < 0 || helpersStart < 0 ||
      mainStart < 0) {
    throw new Error('Unexpected initial-membership WGSL structure.');
  }
  return code.slice(constantsStart, structsStart) +
    code.slice(helpersStart, mainStart);
}

function emptyMembershipCode(regionWordCount) {
  return `
fn membershipAttempt(ray:Ray)->Attempt {
  var result:Attempt;
  for(var word=0u;word<${regionWordCount}u;word++){result.mask[word]=0u;}
  result.ambiguous=0u;result.nearest=F32_MAX;return result;
}
fn storeMembership(rayIndex:u32,mask:array<u32,${regionWordCount}>) { }
`;
}

export function createUniformBuffer(device, data, label) {
  const bytes = data instanceof ArrayBuffer
    ? new Uint8Array(data)
    : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: Math.max(4, Math.ceil(bytes.byteLength / 4) * 4),
    usage: BUFFER_USAGE_UNIFORM | BUFFER_USAGE_COPY_DST,
  });
  if (bytes.byteLength > 0) device.queue.writeBuffer(buffer, 0, bytes);
  return buffer;
}

export function storageLayoutEntry(binding, readOnly = false) {
  return {
    binding,
    visibility: SHADER_STAGE_COMPUTE,
    buffer: { type: readOnly ? 'read-only-storage' : 'storage' },
  };
}

export function uniformLayoutEntry(binding) {
  return {
    binding,
    visibility: SHADER_STAGE_COMPUTE,
    buffer: { type: 'uniform' },
  };
}
