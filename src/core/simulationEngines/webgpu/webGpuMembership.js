/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { getIntersectionTolerancePolicy } from '../../primitive/numeric.js';

const BUFFER_USAGE_COPY_SRC = 0x0004;
const BUFFER_USAGE_COPY_DST = 0x0008;
const BUFFER_USAGE_UNIFORM = 0x0040;
const BUFFER_USAGE_STORAGE = 0x0080;
const SHADER_STAGE_COMPUTE = 0x0004;

/**
 * Resolve the even-odd region mask of every emitted source ray.  This is a
 * separate pass because all later ping-pongs can copy and update the compact
 * bit mask without repeating the global point-in-region query.
 */
export class WebGpuInitialMembershipStage {
  constructor(device, {
    description,
    staticStorage,
    rayBuffer,
    rayCapacity,
    workgroupSize,
  }) {
    this.device = device;
    this.description = description;
    this.staticStorage = staticStorage;
    this.rayBuffer = rayBuffer;
    this.rayCapacity = rayCapacity;
    this.workgroupSize = workgroupSize;
    this.regionWordCount = Math.ceil(description.regions.length / 32);
    this.membershipBuffer = null;
    this.uniformBuffer = null;
    this.pipeline = null;
    this.bindGroup = null;
  }

  async initialize() {
    this.membershipBuffer = this.device.createBuffer({
      label: 'WebGPU initial region membership',
      size: this.rayCapacity * Math.max(1, this.regionWordCount) * 4,
      usage: BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_SRC |
        BUFFER_USAGE_COPY_DST,
    });
    if (this.regionWordCount === 0) return;
    const generated = createWebGpuInitialMembershipShader(
      this.description, this.workgroupSize
    );
    if (!generated.supported) {
      throw new TypeError(
        'Unsupported WebGPU membership curve kinds: ' +
        generated.unsupported.join(', ')
      );
    }
    const uniformData = new ArrayBuffer(32);
    const view = new DataView(uniformData);
    view.setUint32(0, Math.min(
      this.description.sources.reduce(
        (sum, source) => sum + source.rayCount, 0
      ),
      this.rayCapacity
    ), true);
    view.setUint32(4, this.rayCapacity, true);
    view.setInt32(8, this.description.bvh.root, true);
    view.setUint32(12, this.description.curves.length, true);
    view.setUint32(16, this.description.regions.length, true);
    view.setUint32(20, this.regionWordCount, true);
    view.setFloat32(
      24,
      Math.fround(this.description.numericalTolerances?.forwardDistance ?? 0),
      true
    );
    this.uniformBuffer = createInitializedBuffer(
      this.device,
      uniformData,
      BUFFER_USAGE_UNIFORM | BUFFER_USAGE_COPY_DST,
      'WebGPU initial membership uniforms'
    );

    this.device.pushErrorScope?.('validation');
    try {
      const module = this.device.createShaderModule({
        label: 'WebGPU initial region membership',
        code: generated.code,
      });
      await validateShaderModule(module, 'initial region membership');
      const bindGroupLayout = this.device.createBindGroupLayout({
        label: 'WebGPU initial region membership layout',
        entries: [
          storageLayoutEntry(0),
          readOnlyStorageLayoutEntry(1),
          readOnlyStorageLayoutEntry(2),
          readOnlyStorageLayoutEntry(3),
          readOnlyStorageLayoutEntry(4),
          storageLayoutEntry(5),
          uniformLayoutEntry(6),
        ],
      });
      const descriptor = {
        label: 'WebGPU initial region membership',
        layout: this.device.createPipelineLayout({
          label: 'WebGPU initial region membership pipeline layout',
          bindGroupLayouts: [bindGroupLayout],
        }),
        compute: { module, entryPoint: 'initialMembershipMain' },
      };
      this.pipeline = this.device.createComputePipelineAsync
        ? await this.device.createComputePipelineAsync(descriptor)
        : this.device.createComputePipeline(descriptor);
      const buffers = this.staticStorage.buffers;
      this.bindGroup = this.device.createBindGroup({
        label: 'WebGPU initial region membership bindings',
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.rayBuffer } },
          { binding: 1, resource: { buffer: buffers.curveDescriptors } },
          { binding: 2, resource: { buffer: buffers.curveGeometry } },
          { binding: 3, resource: { buffer: buffers.bvhNodes } },
          { binding: 4, resource: { buffer: buffers.bvhCurveIds } },
          { binding: 5, resource: { buffer: this.membershipBuffer } },
          { binding: 6, resource: { buffer: this.uniformBuffer } },
        ],
      });
    } finally {
      const validationError = await this.device.popErrorScope?.();
      if (validationError) throw validationError;
    }
  }

  encode(commandEncoder) {
    if (!this.pipeline) return;
    const pass = commandEncoder.beginComputePass({
      label: 'WebGPU initial region membership',
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.rayCapacity / this.workgroupSize));
    pass.end();
  }

  updateSourceRayCount(rayCount) {
    if (!this.uniformBuffer) return;
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      new Uint32Array([Math.min(rayCount, this.rayCapacity)])
    );
  }

  destroy() {
    this.membershipBuffer?.destroy?.();
    this.uniformBuffer?.destroy?.();
    this.membershipBuffer = null;
    this.uniformBuffer = null;
    this.pipeline = null;
    this.bindGroup = null;
  }
}

export function createWebGpuInitialMembershipShader(
  description,
  workgroupSize
) {
  const regionCurves = description.curves.filter(
    curve => curve.ownerKind === 'region'
  );
  const kinds = new Set(regionCurves.map(curve => curve.geometry.kind));
  const supportedKinds = new Set([
    'lineSegment', 'smoothLineSegment', 'circle', 'circularArc',
    'cubicBezier'
  ]);
  const unsupported = [...kinds].filter(kind => !supportedKinds.has(kind));
  if (unsupported.length > 0) {
    return { supported: false, unsupported, code: null };
  }
  const regionWordCount = Math.ceil(description.regions.length / 32);
  if (regionWordCount === 0) {
    return { supported: true, unsupported: [], code: null };
  }
  const tolerance = getIntersectionTolerancePolicy(description.numericEpsilon);
  const maximumDepth = description.bvh.nodes.reduce(
    (value, node) => Math.max(value, node.depth ?? 0), 0
  );
  const stackSize = Math.max(4, 4 * (maximumDepth + 1));
  const cases = [];
  if (kinds.has('lineSegment') || kinds.has('smoothLineSegment')) {
    cases.push('case 0u, 1u: { countLine(curve, ray, &crossing); }');
  }
  if (kinds.has('circularArc')) {
    cases.push('case 2u: { countArc(curve, ray, &crossing); }');
  }
  if (kinds.has('circle')) {
    cases.push('case 3u: { countCircle(curve, ray, &crossing); }');
  }
  if (kinds.has('cubicBezier')) {
    cases.push('case 4u: { countCubic(curve, ray, &crossing); }');
  }

  return {
    supported: true,
    unsupported: [],
    code: membershipShaderCode({
      kinds,
      cases,
      tolerance,
      regionWordCount,
      stackSize,
      workgroupSize,
    }),
  };
}

function membershipShaderCode({
  kinds,
  cases,
  tolerance,
  regionWordCount,
  stackSize,
  workgroupSize,
}) {
  return `
const F32_MAX:f32=3.402823e38;
const PARAMETER_TOLERANCE:f32=${wgslFloat(tolerance.parameter)};
const TANGENT_TOLERANCE:f32=${wgslFloat(tolerance.tangent)};
const CUBIC_VALUE_TOLERANCE:f32=${wgslFloat(tolerance.cubicValue)};
const BVH_INVALID_REFERENCE:u32=0xffffffffu;
const BVH_LEAF_REFERENCE_BIT:u32=0x80000000u;
const BVH_LEAF_START_MASK:u32=0x00ffffffu;
const BVH_NODE_INDEX_MASK:u32=0x0fffffffu;
const GOLDEN_ANGLE_COS:f32=-0.737368878;
const GOLDEN_ANGLE_SIN:f32=0.675490294;

struct Ray { origin:vec2f, direction:vec2f, powers:vec2f,
  wavelength:f32, flags:u32 };
struct CurveDescriptor { kind:u32, ownerKind:u32, ownerId:u32,
  flags:u32, geometryOffset:u32, geometryCount:u32,
  filterWavelength:f32, filterBandwidth:f32 };
struct BvhNode { minX:vec4f,minY:vec4f,maxX:vec4f,maxY:vec4f,
  refs:vec4u };
struct MembershipUniforms { rayCount:u32, rayCapacity:u32, bvhRoot:i32,
  curveCount:u32, regionCount:u32, regionWordCount:u32,
  originTolerance:f32, padding:f32 };
struct Crossing { count:u32, ambiguous:u32, nearest:f32, padding:f32 };
struct Attempt { mask:array<u32,${regionWordCount}>, ambiguous:u32,
  nearest:f32 };

@group(0) @binding(0) var<storage,read_write> rays:array<Ray>;
@group(0) @binding(1) var<storage,read> curves:array<CurveDescriptor>;
@group(0) @binding(2) var<storage,read> geometry:array<f32>;
@group(0) @binding(3) var<storage,read> bvhNodes:array<BvhNode>;
@group(0) @binding(4) var<storage,read> bvhCurveIds:array<u32>;
@group(0) @binding(5) var<storage,read_write> memberships:array<u32>;
@group(0) @binding(6) var<uniform> membershipUniforms:MembershipUniforms;

fn cross2(a:vec2f,b:vec2f)->f32 { return a.x*b.y-a.y*b.x; }
fn finiteValue(value:f32)->bool {
  return value==value && abs(value)<=F32_MAX;
}
fn boundsNear(ray:Ray,bounds:vec4f,minimum:f32)->f32 {
  var nearValue=-F32_MAX; var farValue=F32_MAX;
  if (ray.direction.x==0.0) {
    if (ray.origin.x<bounds.x || ray.origin.x>bounds.z) { return F32_MAX; }
  } else {
    let values=(bounds.xz-vec2f(ray.origin.x))/ray.direction.x;
    nearValue=max(nearValue,min(values.x,values.y));
    farValue=min(farValue,max(values.x,values.y));
  }
  if (ray.direction.y==0.0) {
    if (ray.origin.y<bounds.y || ray.origin.y>bounds.w) { return F32_MAX; }
  } else {
    let values=(bounds.yw-vec2f(ray.origin.y))/ray.direction.y;
    nearValue=max(nearValue,min(values.x,values.y));
    farValue=min(farValue,max(values.x,values.y));
  }
  return select(F32_MAX,max(nearValue,minimum),
    nearValue<=farValue && farValue>minimum);
}
fn boundsNear4(ray:Ray,node:BvhNode,minimum:f32)->vec4f {
  var nearValue=vec4f(-F32_MAX);var farValue=vec4f(F32_MAX);
  if(ray.direction.x==0.0){
    let inside=(vec4f(ray.origin.x)>=node.minX)&
      (vec4f(ray.origin.x)<=node.maxX);
    farValue=select(vec4f(-F32_MAX),farValue,inside);
  }else{
    let first=(node.minX-vec4f(ray.origin.x))/ray.direction.x;
    let second=(node.maxX-vec4f(ray.origin.x))/ray.direction.x;
    nearValue=max(nearValue,min(first,second));
    farValue=min(farValue,max(first,second));
  }
  if(ray.direction.y==0.0){
    let inside=(vec4f(ray.origin.y)>=node.minY)&
      (vec4f(ray.origin.y)<=node.maxY);
    farValue=select(vec4f(-F32_MAX),farValue,inside);
  }else{
    let first=(node.minY-vec4f(ray.origin.y))/ray.direction.y;
    let second=(node.maxY-vec4f(ray.origin.y))/ray.direction.y;
    nearValue=max(nearValue,min(first,second));
    farValue=min(farValue,max(first,second));
  }
  let valid=(nearValue<=farValue)&(farValue>vec4f(minimum));
  return select(vec4f(F32_MAX),max(nearValue,vec4f(minimum)),valid);
}
fn nearTangency(direction:vec2f,normal:vec2f)->bool {
  let directionLengthSquared=dot(direction,direction);
  let normalLengthSquared=dot(normal,normal);
  if (!(directionLengthSquared>0.0) || !(normalLengthSquared>0.0)) {
    return true;
  }
  let product=dot(direction,normal);
  return product*product<=TANGENT_TOLERANCE*TANGENT_TOLERANCE*
    directionLengthSquared*normalLengthSquared;
}
fn recordCrossing(
  s:f32,u:f32,hasEndpoints:bool,originTolerance:f32,
  direction:vec2f,normal:vec2f,result:ptr<function,Crossing>
) {
  if (!finiteValue(s) || abs(s)<=originTolerance || s<0.0) { return; }
  (*result).nearest=min((*result).nearest,s);
  if (hasEndpoints && (u<=PARAMETER_TOLERANCE ||
      u>=1.0-PARAMETER_TOLERANCE)) {
    (*result).ambiguous=1u; return;
  }
  if (nearTangency(direction,normal)) {
    (*result).ambiguous=1u; return;
  }
  (*result).count+=1u;
}
${quadraticCode(tolerance.parameter)}
${kinds.has('lineSegment') || kinds.has('smoothLineSegment')
    ? membershipLineCode()
    : ''}
${kinds.has('circle') ? membershipCircleCode() : ''}
${kinds.has('circularArc') ? membershipArcCode() : ''}
${kinds.has('cubicBezier')
    ? membershipCubicCode(tolerance.rootRefinementSteps)
    : ''}

fn countPreparedCurve(curve:CurveDescriptor,ray:Ray)->Crossing {
  var crossing=Crossing(0u,0u,F32_MAX,0.0);
  switch curve.kind { ${cases.join('\n')} default:{} }
  return crossing;
}

fn membershipAttempt(ray:Ray)->Attempt {
  var result:Attempt;
  for (var word=0u;word<${regionWordCount}u;word++) { result.mask[word]=0u; }
  result.ambiguous=0u; result.nearest=F32_MAX;
  if (membershipUniforms.bvhRoot<0) { return result; }
  var stack:array<u32,${stackSize}>;var stackCount=1u;
  stack[0]=u32(membershipUniforms.bvhRoot);
  loop {
    if (stackCount==0u) { break; } stackCount-=1u;
    let reference=stack[stackCount];
    if((reference&BVH_LEAF_REFERENCE_BIT)!=0u){
      let start=reference&BVH_LEAF_START_MASK;
      let count=(reference>>24u)&0x7fu;
      for(var offset=0u;offset<count;offset++){
        let curveId=bvhCurveIds[start+offset];
        let curve=curves[curveId];
        if (curve.ownerKind!=1u || curve.ownerId>=membershipUniforms.regionCount) {
          continue;
        }
        let crossing=countPreparedCurve(curve,ray);
        result.nearest=min(result.nearest,crossing.nearest);
        if ((crossing.count&1u)!=0u) {
          let word=curve.ownerId>>5u; let bit=curve.ownerId&31u;
          result.mask[word]^=1u<<bit;
        }
        result.ambiguous|=crossing.ambiguous;
      }
      continue;
    }
    let node=bvhNodes[reference&BVH_NODE_INDEX_MASK];
    let nearValues=boundsNear4(ray,node,0.0);
    for(var child=0u;child<4u;child++){
      let childRef=node.refs[child];
      if(childRef==BVH_INVALID_REFERENCE||nearValues[child]==F32_MAX){continue;}
      if((childRef&BVH_LEAF_REFERENCE_BIT)==0u&&
          (((childRef>>28u)&7u)&2u)==0u){continue;}
      stack[stackCount]=childRef;stackCount+=1u;
    }
  }
  if (result.nearest==F32_MAX) {
    for (var word=0u;word<${regionWordCount}u;word++) { result.mask[word]=0u; }
    result.ambiguous=0u;
  }
  return result;
}

fn storeMembership(rayIndex:u32,mask:array<u32,${regionWordCount}>) {
  let base=rayIndex*${regionWordCount}u;
  for (var word=0u;word<${regionWordCount}u;word++) {
    memberships[base+word]=mask[word];
  }
}

@compute @workgroup_size(${workgroupSize})
fn initialMembershipMain(@builtin(global_invocation_id) invocation:vec3u) {
  let rayIndex=invocation.x;
  if (rayIndex>=membershipUniforms.rayCount ||
      rayIndex>=membershipUniforms.rayCapacity) { return; }
  var ray=rays[rayIndex]; var emptyMask:array<u32,${regionWordCount}>;
  if ((ray.flags&1u)==0u) { storeMembership(rayIndex,emptyMask); return; }
  for (var attempt=0u;attempt<4u;attempt++) {
    let result=membershipAttempt(ray);
    if (result.ambiguous==0u) {
      storeMembership(rayIndex,result.mask); return;
    }
    if (attempt==3u || result.nearest==F32_MAX || !(result.nearest>0.0)) {
      break;
    }
    ray.origin+=0.5*result.nearest*ray.direction;
    ray.direction=vec2f(
      GOLDEN_ANGLE_COS*ray.direction.x-GOLDEN_ANGLE_SIN*ray.direction.y,
      GOLDEN_ANGLE_SIN*ray.direction.x+GOLDEN_ANGLE_COS*ray.direction.y
    );
  }
  storeMembership(rayIndex,emptyMask);
  rays[rayIndex].powers=vec2f(0.0); rays[rayIndex].flags&=~1u;
}`;
}

function quadraticCode(rootTolerance) {
  return `fn quadratic(a0:f32,b0:f32,c0:f32)->vec3f {
  let scale=max(max(abs(a0),abs(b0)),abs(c0));
  if (!(scale>0.0) || !finiteValue(scale)) { return vec3f(0.0); }
  let a=a0/scale; let b=b0/scale; let c=c0/scale;
  if (a==0.0) { return select(vec3f(0.0),vec3f(-c/b,0.0,1.0),b!=0.0); }
  let product=4.0*a*c; var discriminant=b*b-product;
  let tolerance=${wgslFloat(rootTolerance)}*(abs(b*b)+abs(product)+1e-37);
  if (discriminant < -tolerance) { return vec3f(0.0); }
  if (abs(discriminant)<=tolerance) { discriminant=0.0; }
  let root=sqrt(discriminant);
  if (root==0.0) { return vec3f(-b/(2.0*a),0.0,1.0); }
  let q=-0.5*(b+select(-root,root,b>=0.0));
  if (q==0.0) { return vec3f(-b/(2.0*a),0.0,1.0); }
  let values=vec2f(q/a,c/q);
  return vec3f(min(values.x,values.y),max(values.x,values.y),2.0);
}`;
}

function membershipLineCode() {
  return `
fn countLine(curve:CurveDescriptor,ray:Ray,result:ptr<function,Crossing>) {
  let o=curve.geometryOffset; let curveOrigin=vec2f(geometry[o],geometry[o+1u]);
  let tangent=vec2f(geometry[o+2u],geometry[o+3u]);
  let inverseLength=geometry[o+4u]; let positionTolerance=geometry[o+5u];
  let endpointTolerance=geometry[o+6u]; let offset=curveOrigin-ray.origin;
  let denominator=cross2(ray.direction,tangent);
  let lineDistance=cross2(offset,tangent);
  if (abs(denominator)<=TANGENT_TOLERANCE) {
    if (abs(lineDistance)<=positionTolerance) { (*result).ambiguous=1u; }
    return;
  }
  let rawU=cross2(offset,ray.direction)*inverseLength/denominator;
  let parameterTolerance=max(PARAMETER_TOLERANCE,
    max(positionTolerance,endpointTolerance)*inverseLength);
  if (rawU < -parameterTolerance || rawU > 1.0+parameterTolerance) { return; }
  let distanceScale=abs(denominator);
  if (abs(lineDistance)<=max(positionTolerance,
      membershipUniforms.originTolerance)*distanceScale ||
      lineDistance*denominator<0.0) { return; }
  let s=lineDistance/denominator;
  if (!finiteValue(s)) { return; }
  (*result).nearest=s;
  if (rawU<=PARAMETER_TOLERANCE || rawU>=1.0-PARAMETER_TOLERANCE) {
    (*result).ambiguous=1u; return;
  }
  (*result).count=1u;
}`;
}

function membershipCircleCode() {
  return `
fn countCircle(curve:CurveDescriptor,ray:Ray,result:ptr<function,Crossing>) {
  let o=curve.geometryOffset; let inverseRadius=abs(geometry[o+2u]);
  let origin=(ray.origin-vec2f(geometry[o],geometry[o+1u]))*inverseRadius;
  let direction=ray.direction*inverseRadius;
  let roots=quadratic(dot(direction,direction),2.0*dot(origin,direction),
    dot(origin,origin)-1.0);
  let originTolerance=max(geometry[o+3u],membershipUniforms.originTolerance);
  for (var rootIndex=0u;rootIndex<u32(roots.z);rootIndex++) {
    let s=select(roots.x,roots.y,rootIndex==1u);
    let normal=origin+s*direction;
    recordCrossing(s,0.5,false,originTolerance,direction,normal,result);
  }
}`;
}

function membershipArcCode() {
  return `
fn countArc(curve:CurveDescriptor,ray:Ray,result:ptr<function,Crossing>) {
  let o=curve.geometryOffset; let curveOrigin=vec2f(geometry[o],geometry[o+1u]);
  let tangent=vec2f(geometry[o+2u],geometry[o+3u]);
  let inverseLength=geometry[o+4u]; let bulge=geometry[o+5u];
  let positionTolerance=geometry[o+6u]; let endpointTolerance=geometry[o+7u];
  let transverse=vec2f(-tangent.y,tangent.x); let relative=ray.origin-curveOrigin;
  let origin=vec2f(dot(relative,tangent),dot(relative,transverse))*inverseLength;
  let direction=vec2f(dot(ray.direction,tangent),
    dot(ray.direction,transverse))*inverseLength;
  let factor=(1.0-bulge)*(1.0+bulge);
  let roots=quadratic(2.0*bulge*dot(direction,direction),
    4.0*bulge*dot(origin,direction)-factor*direction.y,
    2.0*bulge*(dot(origin,origin)-0.25)-factor*origin.y);
  let parameterTolerance=max(PARAMETER_TOLERANCE,
    max(positionTolerance,endpointTolerance)*inverseLength);
  let originTolerance=max(positionTolerance,
    membershipUniforms.originTolerance);
  for (var rootIndex=0u;rootIndex<u32(roots.z);rootIndex++) {
    let s=select(roots.x,roots.y,rootIndex==1u);
    let point=origin+s*direction; let denominator=1.0-2.0*bulge*point.y;
    if (!(denominator>0.0)) { continue; }
    let rawU=0.5+point.x/denominator;
    if (rawU < -parameterTolerance || rawU > 1.0+parameterTolerance) {
      continue;
    }
    let normal=vec2f(-4.0*bulge*point.x,-(4.0*bulge*point.y-factor));
    recordCrossing(s,rawU,true,originTolerance,direction,normal,result);
  }
}`;
}

function membershipCubicCode(rootRefinementSteps) {
  return `
fn scalarCubic(values:array<f32,4>,u:f32)->f32 {
  let opposite=1.0-u;
  let first0=opposite*values[0]+u*values[1];
  let first1=opposite*values[1]+u*values[2];
  let first2=opposite*values[2]+u*values[3];
  let second0=opposite*first0+u*first1;
  let second1=opposite*first1+u*first2;
  return opposite*second0+u*second1;
}
fn cubicPoint(points:array<vec2f,4>,u:f32)->vec2f {
  let opposite=1.0-u;
  let first0=opposite*points[0]+u*points[1];
  let first1=opposite*points[1]+u*points[2];
  let first2=opposite*points[2]+u*points[3];
  return opposite*(opposite*first0+u*first1)+
    u*(opposite*first1+u*first2);
}
fn cubicTangent(points:array<vec2f,4>,u:f32)->vec2f {
  let opposite=1.0-u;
  return opposite*opposite*3.0*(points[1]-points[0])+
    2.0*opposite*u*3.0*(points[2]-points[1])+
    u*u*3.0*(points[3]-points[2]);
}
fn endpointParameterTolerance(distance:f32,derivativeLength:f32)->f32 {
  if (!(derivativeLength>0.0)) { return PARAMETER_TOLERANCE; }
  return max(PARAMETER_TOLERANCE,distance/derivativeLength);
}
fn refineCubicRoot(
  values:array<f32,4>,start:f32,end:f32,startValue:f32
)->f32 {
  var low=start; var high=end; var lowValue=startValue;
  for (var iteration=0u;iteration<${rootRefinementSteps}u;iteration++) {
    let midpoint=(low+high)*0.5; let value=scalarCubic(values,midpoint);
    if (value==0.0) { return midpoint; }
    if ((lowValue<0.0)==(value<0.0)) {
      low=midpoint; lowValue=value;
    } else { high=midpoint; }
  }
  return (low+high)*0.5;
}
fn addCubicCrossing(
  points:array<vec2f,4>,u:f32,origin:vec2f,direction:vec2f,
  directionLengthSquared:f32,originTolerance:f32,
  result:ptr<function,Crossing>
) {
  let point=cubicPoint(points,u);
  let projection=dot(point-origin,direction);
  if (!finiteValue(projection) ||
      abs(projection)<=originTolerance*directionLengthSquared ||
      projection<0.0) { return; }
  let s=projection/directionLengthSquared;
  (*result).nearest=min((*result).nearest,s);
  let tangent=cubicTangent(points,u);
  if (u<=PARAMETER_TOLERANCE || u>=1.0-PARAMETER_TOLERANCE ||
      nearTangency(direction,vec2f(-tangent.y,tangent.x))) {
    (*result).ambiguous=1u; return;
  }
  (*result).count+=1u;
}
fn countCubic(curve:CurveDescriptor,ray:Ray,result:ptr<function,Crossing>) {
  let o=curve.geometryOffset; let inverseScale=geometry[o+2u];
  let origin=(ray.origin-vec2f(geometry[o],geometry[o+1u]))*inverseScale;
  let direction=ray.direction*inverseScale;
  let directionLengthSquared=dot(direction,direction);
  if (!(directionLengthSquared>0.0) || !finiteValue(directionLengthSquared)) {
    (*result).ambiguous=1u; return;
  }
  let originShift=-dot(origin,direction)/directionLengthSquared;
  let nearOrigin=origin+originShift*direction;
  let points=array<vec2f,4>(
    vec2f(geometry[o+3u],geometry[o+4u]),
    vec2f(geometry[o+5u],geometry[o+6u]),
    vec2f(geometry[o+7u],geometry[o+8u]),
    vec2f(geometry[o+9u],geometry[o+10u]));
  var values:array<f32,4>; var maximumValue=1.175494351e-38;
  for (var valueIndex=0u;valueIndex<4u;valueIndex++) {
    values[valueIndex]=cross2(points[valueIndex]-nearOrigin,direction);
    maximumValue=max(maximumValue,abs(values[valueIndex]));
  }
  let directionLength=sqrt(directionLengthSquared);
  let positionTolerance=geometry[o+11u];
  let valueTolerance=max(positionTolerance*inverseScale*directionLength,
    CUBIC_VALUE_TOLERANCE*maximumValue);
  if (abs(values[0])<=valueTolerance && abs(values[1])<=valueTolerance &&
      abs(values[2])<=valueTolerance && abs(values[3])<=valueTolerance) {
    (*result).ambiguous=1u; return;
  }
  let derivative0=3.0*(values[1]-values[0]);
  let derivative1=3.0*(values[2]-values[1]);
  let derivative2=3.0*(values[3]-values[2]);
  let endpointDistance=max(positionTolerance,geometry[o+12u])*inverseScale;
  let parameterStart=-endpointParameterTolerance(endpointDistance,
    length(3.0*(points[1]-points[0])));
  let parameterEnd=1.0+endpointParameterTolerance(endpointDistance,
    length(3.0*(points[3]-points[2])));
  var partitions:array<f32,4>; var partitionCount=1u;
  partitions[0]=parameterStart;
  let roots=quadratic(derivative0-2.0*derivative1+derivative2,
    2.0*(derivative1-derivative0),derivative0);
  for (var rootIndex=0u;rootIndex<u32(roots.z);rootIndex++) {
    let root=select(roots.x,roots.y,rootIndex==1u);
    if (root>parameterStart && root<parameterEnd) {
      partitions[partitionCount]=root; partitionCount+=1u;
    }
  }
  partitions[partitionCount]=parameterEnd; partitionCount+=1u;
  for (var sortIndex=1u;sortIndex<partitionCount;sortIndex++) {
    var moveIndex=sortIndex;
    loop {
      if (moveIndex==0u || partitions[moveIndex-1u]<=partitions[moveIndex]) {
        break;
      }
      let temporary=partitions[moveIndex-1u];
      partitions[moveIndex-1u]=partitions[moveIndex];
      partitions[moveIndex]=temporary; moveIndex-=1u;
    }
  }
  var lastRoot=-F32_MAX;
  let originTolerance=max(positionTolerance,
    membershipUniforms.originTolerance);
  for (var partitionIndex=0u;partitionIndex<partitionCount;partitionIndex++) {
    let u=partitions[partitionIndex]; let value=scalarCubic(values,u);
    if (abs(value)<=valueTolerance && abs(u-lastRoot)>PARAMETER_TOLERANCE) {
      addCubicCrossing(points,u,origin,direction,directionLengthSquared,
        originTolerance,result); lastRoot=u;
    }
    if (partitionIndex+1u>=partitionCount) { continue; }
    let end=partitions[partitionIndex+1u];
    let endValue=scalarCubic(values,end);
    if ((value<0.0)!=(endValue<0.0)) {
      let root=refineCubicRoot(values,u,end,value);
      if (abs(root-lastRoot)>PARAMETER_TOLERANCE) {
        addCubicCrossing(points,root,origin,direction,directionLengthSquared,
          originTolerance,result); lastRoot=root;
      }
    }
  }
}`;
}

function wgslFloat(value) {
  return Number(value).toExponential(9);
}

function createInitializedBuffer(device, data, usage, label) {
  const bytes = data instanceof ArrayBuffer
    ? new Uint8Array(data)
    : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: Math.max(4, Math.ceil(bytes.byteLength / 4) * 4),
    usage,
  });
  if (bytes.byteLength > 0) device.queue.writeBuffer(buffer, 0, bytes);
  return buffer;
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
