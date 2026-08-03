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

export class WebGpuRawTraceStage {
  constructor(device, {
    description,
    staticStorage,
    rayBuffer,
    membershipBuffer,
    interactionBuffers,
    interactionTypeLayout,
    rayCapacity,
    workgroupSize,
  }) {
    this.device = device;
    this.description = description;
    this.staticStorage = staticStorage;
    this.rayBuffer = rayBuffer;
    this.membershipBuffer = membershipBuffer;
    this.interactionBuffers = interactionBuffers;
    this.interactionTypeLayout = interactionTypeLayout;
    this.rayCapacity = rayCapacity;
    this.workgroupSize = workgroupSize;
    this.hitBuffer = null;
    this.crossingBuffer = null;
    this.uniformBuffer = null;
    this.pipeline = null;
    this.bindGroup = null;
    this.alternateBindGroup = null;
  }

  async initialize() {
    const generated = createWebGpuRawTraceShader(
      this.description, this.workgroupSize
    );
    if (!generated.supported) {
      throw new TypeError(
        `Unsupported WebGPU trace curve kinds: ${generated.unsupported.join(', ')}`
      );
    }
    this.hitBuffer = this.device.createBuffer({
      label: 'WebGPU provisional hits',
      size: this.rayCapacity * 32,
      usage: BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_SRC |
        BUFFER_USAGE_COPY_DST,
    });
    const regionWordCount = Math.ceil(this.description.regions.length / 32);
    this.crossingBuffer = this.device.createBuffer({
      label: 'WebGPU merged region crossings',
      size: this.rayCapacity * Math.max(1, regionWordCount) * 8,
      usage: BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_SRC |
        BUFFER_USAGE_COPY_DST,
    });
    const tolerance = getIntersectionTolerancePolicy(
      this.description.numericEpsilon
    );
    const uniformData = new ArrayBuffer(64);
    const uniformView = new DataView(uniformData);
    uniformView.setUint32(0, Math.min(
      this.description.sources.reduce(
        (sum, source) => sum + source.rayCount, 0
      ),
      this.rayCapacity
    ), true);
    uniformView.setUint32(4, this.rayCapacity, true);
    uniformView.setInt32(8, this.description.bvh.root, true);
    uniformView.setUint32(12, this.description.curves.length, true);
    uniformView.setUint32(16, this.description.regions.length, true);
    uniformView.setUint32(20, regionWordCount, true);
    uniformView.setUint32(
      24, this.interactionTypeLayout.surfaceTypeOffset, true
    );
    uniformView.setUint32(
      28, this.interactionTypeLayout.detectorTypeOffset, true
    );
    uniformView.setFloat32(
      32,
      Math.fround(this.description.numericalTolerances?.forwardDistance ?? 0),
      true
    );
    uniformView.setFloat32(
      36,
      Math.fround(this.description.numericalTolerances?.interactionMerging ?? 0),
      true
    );
    const configuredNormal = this.description.numericalTolerances
      ?.interactionNormal ?? 0;
    const normalTolerance = Math.min(
      Math.PI, Math.max(configuredNormal, tolerance.interactionNormal)
    );
    uniformView.setFloat32(
      40, Math.fround(4 * Math.sin(normalTolerance * 0.5) ** 2), true
    );
    uniformView.setFloat32(44, Math.fround(tolerance.mergingDistance), true);
    uniformView.setFloat32(48, 0, true);
    this.uniformBuffer = createInitializedBuffer(
      this.device, uniformData,
      BUFFER_USAGE_UNIFORM | BUFFER_USAGE_COPY_DST,
      'WebGPU raw trace uniforms'
    );
    this.device.pushErrorScope?.('validation');
    try {
      const module = this.device.createShaderModule({
        label: 'WebGPU raw BVH trace', code: generated.code
      });
      await validateShaderModule(module, 'raw BVH trace');
      const bindGroupLayout = this.device.createBindGroupLayout({
        label: 'WebGPU raw BVH trace layout',
        entries: [
          readOnlyStorageLayoutEntry(0),
          readOnlyStorageLayoutEntry(1),
          readOnlyStorageLayoutEntry(2),
          readOnlyStorageLayoutEntry(3),
          readOnlyStorageLayoutEntry(4),
          readOnlyStorageLayoutEntry(5),
          readOnlyStorageLayoutEntry(6),
          readOnlyStorageLayoutEntry(7),
          readOnlyStorageLayoutEntry(8),
          storageLayoutEntry(9),
          storageLayoutEntry(10),
          storageLayoutEntry(11),
          storageLayoutEntry(12),
          storageLayoutEntry(13),
          uniformLayoutEntry(14),
        ],
      });
      const descriptor = {
        label: 'WebGPU raw BVH trace',
        layout: this.device.createPipelineLayout({
          label: 'WebGPU raw BVH trace pipeline layout',
          bindGroupLayouts: [bindGroupLayout],
        }),
        compute: { module, entryPoint: 'rawTraceMain' },
      };
      this.pipeline = this.device.createComputePipelineAsync
        ? await this.device.createComputePipelineAsync(descriptor)
        : this.device.createComputePipeline(descriptor);
      const buffers = this.staticStorage.buffers;
      this.bindGroup = this.device.createBindGroup({
        label: 'WebGPU raw BVH trace bindings',
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.rayBuffer } },
          { binding: 1, resource: { buffer: buffers.curveDescriptors } },
          { binding: 2, resource: { buffer: buffers.curveGeometry } },
          { binding: 3, resource: { buffer: buffers.bvhNodes } },
          { binding: 4, resource: { buffer: buffers.bvhCurveIds } },
          { binding: 5, resource: { buffer: this.membershipBuffer } },
          { binding: 6, resource: { buffer: buffers.regionDescriptors } },
          { binding: 7, resource: { buffer: buffers.surfaceDescriptors } },
          { binding: 8, resource: { buffer: buffers.detectorDescriptors } },
          { binding: 9, resource: { buffer: this.hitBuffer } },
          { binding: 10, resource: { buffer: this.crossingBuffer } },
          { binding: 11, resource: {
            buffer: this.interactionBuffers.interactionTypeByRay
          } },
          { binding: 12, resource: {
            buffer: this.interactionBuffers.interactionTypeCounts
          } },
          { binding: 13, resource: {
            buffer: this.interactionBuffers.runControl
          } },
          { binding: 14, resource: { buffer: this.uniformBuffer } },
        ],
      });
    } finally {
      const validationError = await this.device.popErrorScope?.();
      if (validationError) throw validationError;
    }
  }

  setAlternateInputBuffers(rayBuffer, membershipBuffer) {
    const buffers = this.staticStorage.buffers;
    this.alternateBindGroup = this.device.createBindGroup({
      label: 'WebGPU raw BVH trace alternate bindings',
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: rayBuffer } },
        { binding: 1, resource: { buffer: buffers.curveDescriptors } },
        { binding: 2, resource: { buffer: buffers.curveGeometry } },
        { binding: 3, resource: { buffer: buffers.bvhNodes } },
        { binding: 4, resource: { buffer: buffers.bvhCurveIds } },
        { binding: 5, resource: { buffer: membershipBuffer } },
        { binding: 6, resource: { buffer: buffers.regionDescriptors } },
        { binding: 7, resource: { buffer: buffers.surfaceDescriptors } },
        { binding: 8, resource: { buffer: buffers.detectorDescriptors } },
        { binding: 9, resource: { buffer: this.hitBuffer } },
        { binding: 10, resource: { buffer: this.crossingBuffer } },
        { binding: 11, resource: {
          buffer: this.interactionBuffers.interactionTypeByRay
        } },
        { binding: 12, resource: {
          buffer: this.interactionBuffers.interactionTypeCounts
        } },
        { binding: 13, resource: {
          buffer: this.interactionBuffers.runControl
        } },
        { binding: 14, resource: { buffer: this.uniformBuffer } },
      ],
    });
  }

  configureRun(options) {
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      48,
      new Float32Array([Math.fround(options.rayPowerCutoff ?? 1e-6)])
    );
  }

  updateSourceRayCount(rayCount) {
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      new Uint32Array([Math.min(rayCount, this.rayCapacity)])
    );
  }

  encode(commandEncoder, direction = 0) {
    const pass = commandEncoder.beginComputePass({ label: 'WebGPU raw trace' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, direction === 0
      ? this.bindGroup
      : this.alternateBindGroup);
    pass.dispatchWorkgroupsIndirect(
      this.interactionBuffers.dispatchIndirect, 0
    );
    pass.end();
  }

  destroy() {
    this.hitBuffer?.destroy?.();
    this.crossingBuffer?.destroy?.();
    this.uniformBuffer?.destroy?.();
    this.hitBuffer = null;
    this.crossingBuffer = null;
    this.uniformBuffer = null;
    this.pipeline = null;
    this.bindGroup = null;
    this.alternateBindGroup = null;
  }
}

/**
 * Generate native BVH tracing, coincident-hit merging, region-crossing and
 * typed-interaction classification. Geometry functions are specialized to
 * the curve kinds present in the prepared scene.
 */
export function createWebGpuRawTraceShader(description, workgroupSize) {
  const kinds = new Set(description.curves.map(curve => curve.geometry.kind));
  const unsupported = [...kinds].filter(kind => ![
    'lineSegment', 'smoothLineSegment', 'circle', 'circularArc',
    'cubicBezier'
  ].includes(kind));
  if (unsupported.length > 0) {
    return { supported: false, unsupported, code: null };
  }
  const tolerance = getIntersectionTolerancePolicy(description.numericEpsilon);
  const maximumDepth = description.bvh.nodes.reduce(
    (value, node) => Math.max(value, node.depth ?? 0), 0
  );
  const stackSize = Math.max(1, maximumDepth + 1);
  const cases = [];
  if (kinds.has('lineSegment') || kinds.has('smoothLineSegment')) {
    cases.push('case 0u, 1u: { intersectLine(curve, ray, &hit); }');
  }
  if (kinds.has('circularArc')) {
    cases.push('case 2u: { intersectArc(curve, ray, &hit); }');
  }
  if (kinds.has('circle')) {
    cases.push('case 3u: { intersectCircle(curve, ray, &hit); }');
  }
  if (kinds.has('cubicBezier')) {
    cases.push('case 4u: { intersectCubic(curve, ray, &hit); }');
  }
  return {
    supported: true,
    unsupported: [],
    code: `
const F32_MAX: f32 = 3.402823e38;
const PARAMETER_TOLERANCE: f32 = ${wgslFloat(tolerance.parameter)};
const TANGENT_TOLERANCE: f32 = ${wgslFloat(tolerance.tangent)};

struct Ray { origin: vec2f, direction: vec2f, powers: vec2f,
  wavelength: f32, flags: u32 };
struct CurveDescriptor { kind: u32, ownerKind: u32, ownerId: u32,
  flags: u32, geometryOffset: u32, geometryCount: u32,
  filterWavelength: f32, filterBandwidth: f32 };
struct BvhNode { bounds: vec4f, first: i32, second: i32,
  ownerKindMask: u32, flags: u32 };
struct RegionDescriptor { typeId:u32, parameterOffset:u32, parameterCount:u32,
  flags:u32, stepSize:f32, padding0:u32, padding1:u32, padding2:u32 };
struct InstanceDescriptor { typeId:u32, parameterOffset:u32,
  parameterCount:u32, extra:u32 };
struct DetectorDescriptor { typeId:u32, parameterOffset:u32,
  parameterCount:u32, resultId:u32, resultSize:u32, resultOffset:u32,
  padding0:u32, padding1:u32 };
struct Hit { s: f32, u: f32, normal: vec2f, curveId: i32, sigma: f32,
  conflict: u32, interactionType: u32 };
struct TraceUniforms { rayCount: u32, rayCapacity: u32, bvhRoot: i32,
  curveCount: u32, regionCount:u32, regionWordCount:u32,
  surfaceTypeOffset:u32, detectorTypeOffset:u32, forwardDistance:f32,
  interactionMerging:f32, maximumNormalChordDistanceSquared:f32,
  mergingDistanceFactor:f32,rayPowerCutoff:f32,
  padding0:u32,padding1:u32,padding2:u32 };

@group(0) @binding(0) var<storage, read> rays: array<Ray>;
@group(0) @binding(1) var<storage, read> curves: array<CurveDescriptor>;
@group(0) @binding(2) var<storage, read> geometry: array<f32>;
@group(0) @binding(3) var<storage, read> bvhNodes: array<BvhNode>;
@group(0) @binding(4) var<storage, read> bvhCurveIds: array<u32>;
@group(0) @binding(5) var<storage, read> memberships:array<u32>;
@group(0) @binding(6) var<storage, read> regions:array<RegionDescriptor>;
@group(0) @binding(7) var<storage, read> surfaces:array<InstanceDescriptor>;
@group(0) @binding(8) var<storage, read> detectors:array<DetectorDescriptor>;
@group(0) @binding(9) var<storage, read_write> hits: array<Hit>;
@group(0) @binding(10) var<storage, read_write> crossings:array<u32>;
@group(0) @binding(11) var<storage, read_write>
  interactionTypeByRay:array<u32>;
@group(0) @binding(12) var<storage, read_write>
  interactionTypeCounts:array<atomic<u32>>;
@group(0) @binding(13) var<storage, read_write>
  runControl:array<atomic<u32>>;
@group(0) @binding(14) var<uniform> traceUniforms: TraceUniforms;

fn cross2(a: vec2f, b: vec2f) -> f32 { return a.x*b.y-a.y*b.x; }
fn finiteValue(value: f32) -> bool {
  return value == value && abs(value) <= F32_MAX;
}
fn updateHit(s: f32, u: f32, minimum: f32, hit: ptr<function, Hit>) {
  if (finiteValue(s) && s > minimum && s < (*hit).s) {
    (*hit).s = s; (*hit).u = u;
  }
}
fn passesFilter(curve: CurveDescriptor, wavelength: f32) -> bool {
  if ((curve.flags & 4u) == 0u) { return true; }
  let inside = abs(wavelength-curve.filterWavelength)<=curve.filterBandwidth;
  return select(inside, !inside, (curve.flags & 8u) != 0u);
}
fn boundsNear(ray: Ray, bounds: vec4f, minimum: f32) -> f32 {
  var nearValue = -F32_MAX; var farValue = F32_MAX;
  if (ray.direction.x == 0.0) {
    if (ray.origin.x < bounds.x || ray.origin.x > bounds.z) { return F32_MAX; }
  } else {
    let values=(bounds.xz-vec2f(ray.origin.x))/ray.direction.x;
    nearValue=max(nearValue,min(values.x,values.y));
    farValue=min(farValue,max(values.x,values.y));
  }
  if (ray.direction.y == 0.0) {
    if (ray.origin.y < bounds.y || ray.origin.y > bounds.w) { return F32_MAX; }
  } else {
    let values=(bounds.yw-vec2f(ray.origin.y))/ray.direction.y;
    nearValue=max(nearValue,min(values.x,values.y));
    farValue=min(farValue,max(values.x,values.y));
  }
  return select(F32_MAX,max(nearValue,minimum),
    nearValue<=farValue && farValue>minimum);
}
${kinds.has('lineSegment') || kinds.has('smoothLineSegment') ? `
fn intersectLine(curve: CurveDescriptor, ray: Ray, hit: ptr<function, Hit>) {
  let o=curve.geometryOffset; let curveOrigin=vec2f(geometry[o],geometry[o+1u]);
  let tangent=vec2f(geometry[o+2u],geometry[o+3u]);
  let inverseLength=geometry[o+4u]; let positionTolerance=geometry[o+5u];
  let endpointTolerance=geometry[o+6u]; let offset=curveOrigin-ray.origin;
  let denominator=cross2(ray.direction,tangent);
  if (abs(denominator)<=TANGENT_TOLERANCE) { return; }
  let rawU=cross2(offset,ray.direction)*inverseLength/denominator;
  let parameterTolerance=max(PARAMETER_TOLERANCE,
    max(positionTolerance,endpointTolerance)*inverseLength);
  if (rawU < -parameterTolerance || rawU > 1.0+parameterTolerance) { return; }
  updateHit(cross2(offset,tangent)/denominator,rawU,
    max(positionTolerance,traceUniforms.forwardDistance),hit);
}` : ''}
${quadraticCode(tolerance.parameter)}
${kinds.has('circle') ? `
fn intersectCircle(curve: CurveDescriptor, ray: Ray, hit: ptr<function, Hit>) {
  let o=curve.geometryOffset; let center=vec2f(geometry[o],geometry[o+1u]);
  let inverseRadius=abs(geometry[o+2u]);
  let minimum=max(geometry[o+3u],traceUniforms.forwardDistance);
  let origin=(ray.origin-center)*inverseRadius;
  let direction=ray.direction*inverseRadius;
  let roots=quadratic(dot(direction,direction),2.0*dot(origin,direction),
    dot(origin,origin)-1.0);
  if (roots.z>0.5) { updateHit(roots.x,0.5,minimum,hit); }
  if (roots.z>1.5) { updateHit(roots.y,0.5,minimum,hit); }
}` : ''}
${kinds.has('circularArc') ? arcCode() : ''}
${kinds.has('cubicBezier')
    ? cubicCode(tolerance.rootRefinementSteps)
    : ''}
${normalCode(kinds)}
${mergeCode()}

fn intersectPreparedCurve(
  curveId:u32,ray:Ray,candidate:Hit,maximumDistance:f32,rayIndex:u32
)->Hit {
  let curve=curves[curveId];
  if (!passesFilter(curve,ray.wavelength)) { return candidate; }
  var hit=Hit(F32_MAX,0.0,vec2f(0.0),-1,0.0,0u,0xffffffffu);
  switch curve.kind { ${cases.join('\n')} default: {} }
  if (hit.s==F32_MAX) { return candidate; }
  let normalResult=curveNormal(curve,ray,hit);
  if (normalResult.w==0.0) { return candidate; }
  hit.normal=normalResult.xy; hit.sigma=normalResult.z;
  let frontSideOnly=curve.ownerKind!=1u && (curve.flags&2u)==0u;
  if (frontSideOnly && hit.sigma!=1.0) { return candidate; }
  hit.curveId=i32(curveId);
  return mergeCandidate(
    candidate,hit,curveId,ray,maximumDistance,rayIndex
  );
}

@compute @workgroup_size(${workgroupSize})
fn rawTraceMain(@builtin(global_invocation_id) invocation: vec3u) {
  let rayIndex=invocation.x;
  if (rayIndex>=atomicLoad(&runControl[0]) ||
      rayIndex>=traceUniforms.rayCapacity) { return; }
  let ray=rays[rayIndex]; clearCrossings(rayIndex);
  var hit=Hit(F32_MAX,0.0,vec2f(0.0),-1,0.0,0u,0xffffffffu);
  if ((ray.flags&1u)==0u) {
    hits[rayIndex]=hit; interactionTypeByRay[rayIndex]=0xffffffffu; return;
  }
  atomicAdd(&runControl[16],1u);
  let power=ray.powers.x+ray.powers.y;
  if(power<traceUniforms.rayPowerCutoff){
    hit.s=0.0;hits[rayIndex]=hit;
    interactionTypeByRay[rayIndex]=0xffffffffu;
    atomicAdd(&runControl[17],u32(round(min(
      power*1048576.0,4294967040.0))));
    return;
  }
  let maximumDistance=getMaximumDistance(rayIndex); hit.s=maximumDistance;
  if (traceUniforms.bvhRoot<0) {
    finishCandidate(rayIndex,&hit); return;
  }
  var stack: array<i32,${stackSize}>; var stackCount=1u;
  stack[0]=traceUniforms.bvhRoot;
  loop {
    if (stackCount==0u) { break; } stackCount-=1u;
    let nodeIndex=stack[stackCount]; let node=bvhNodes[u32(nodeIndex)];
    if (boundsNear(ray,node.bounds,traceUniforms.forwardDistance)>hit.s) {
      continue;
    }
    if ((node.flags&1u)!=0u) {
      for (var offset=0;offset<node.second;offset++) {
        hit=intersectPreparedCurve(bvhCurveIds[u32(node.first+offset)],ray,
          hit,maximumDistance,rayIndex);
      }
    } else {
      let leftNear=boundsNear(ray,bvhNodes[u32(node.first)].bounds,
        traceUniforms.forwardDistance);
      let rightNear=boundsNear(ray,bvhNodes[u32(node.second)].bounds,
        traceUniforms.forwardDistance);
      if (leftNear<=hit.s && rightNear<=hit.s &&
          stackCount+2u<=${stackSize}u) {
        if (leftNear<=rightNear) {
          stack[stackCount]=node.second; stack[stackCount+1u]=node.first;
        } else {
          stack[stackCount]=node.first; stack[stackCount+1u]=node.second;
        }
        stackCount+=2u;
      } else if (leftNear<=hit.s && stackCount<${stackSize}u) {
        stack[stackCount]=node.first; stackCount+=1u;
      } else if (rightNear<=hit.s && stackCount<${stackSize}u) {
        stack[stackCount]=node.second; stackCount+=1u;
      }
    }
  }
  finishCandidate(rayIndex,&hit);
}`
  };
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
  let root=sqrt(discriminant); if (root==0.0) { return vec3f(-b/(2.0*a),0.0,1.0); }
  let q=-0.5*(b+select(-root,root,b>=0.0));
  if (q==0.0) { return vec3f(-b/(2.0*a),0.0,1.0); }
  let values=vec2f(q/a,c/q); return vec3f(min(values.x,values.y),max(values.x,values.y),2.0);
}`;
}

function arcCode() {
  return `
fn intersectArc(curve: CurveDescriptor, ray: Ray, hit: ptr<function, Hit>) {
  let o=curve.geometryOffset; let curveOrigin=vec2f(geometry[o],geometry[o+1u]);
  let tangent=vec2f(geometry[o+2u],geometry[o+3u]);
  let inverseLength=geometry[o+4u]; let bulge=geometry[o+5u];
  let positionTolerance=geometry[o+6u]; let endpointTolerance=geometry[o+7u];
  let normal=vec2f(-tangent.y,tangent.x); let relative=ray.origin-curveOrigin;
  let localOrigin=vec2f(dot(relative,tangent),dot(relative,normal))*inverseLength;
  let localDirection=vec2f(dot(ray.direction,tangent),dot(ray.direction,normal))*inverseLength;
  let factor=(1.0-bulge)*(1.0+bulge);
  let roots=quadratic(
    2.0*bulge*dot(localDirection,localDirection),
    4.0*bulge*dot(localOrigin,localDirection)-factor*localDirection.y,
    2.0*bulge*(dot(localOrigin,localOrigin)-0.25)-factor*localOrigin.y
  );
  let parameterTolerance=max(PARAMETER_TOLERANCE,
    max(positionTolerance,endpointTolerance)*inverseLength);
  for (var rootIndex=0u;rootIndex<u32(roots.z);rootIndex++) {
    let root=select(roots.x,roots.y,rootIndex==1u);
    let point=localOrigin+root*localDirection;
    let denominator=1.0-2.0*bulge*point.y;
    if (!(denominator>0.0)) { continue; }
    let rawU=0.5+point.x/denominator;
    if (rawU>=-parameterTolerance && rawU<=1.0+parameterTolerance) {
      updateHit(root,rawU,max(positionTolerance,traceUniforms.forwardDistance),
        hit);
    }
  }
}`;
}

function cubicCode(rootRefinementSteps) {
  return `
fn scalarCubic(values: array<f32,4>, u: f32) -> f32 {
  let opposite=1.0-u;
  let first0=opposite*values[0]+u*values[1];
  let first1=opposite*values[1]+u*values[2];
  let first2=opposite*values[2]+u*values[3];
  let second0=opposite*first0+u*first1;
  let second1=opposite*first1+u*first2;
  return opposite*second0+u*second1;
}

fn cubicPoint(points: array<vec2f,4>, u: f32) -> vec2f {
  let opposite=1.0-u;
  let first0=opposite*points[0]+u*points[1];
  let first1=opposite*points[1]+u*points[2];
  let first2=opposite*points[2]+u*points[3];
  return opposite*(opposite*first0+u*first1)+
    u*(opposite*first1+u*first2);
}
fn endpointParameterTolerance(
  distanceTolerance:f32, derivativeLength:f32
) -> f32 {
  if (!(derivativeLength>0.0)) { return PARAMETER_TOLERANCE; }
  return max(PARAMETER_TOLERANCE,distanceTolerance/derivativeLength);
}
fn refineCubicRoot(
  values:array<f32,4>, start:f32, end:f32, startValue:f32
) -> f32 {
  var low=start; var high=end; var lowValue=startValue;
  for (var iteration=0u;iteration<${rootRefinementSteps}u;iteration++) {
    let midpoint=(low+high)*0.5;
    let midpointValue=scalarCubic(values,midpoint);
    if (midpointValue==0.0) { return midpoint; }
    if ((lowValue<0.0)==(midpointValue<0.0)) {
      low=midpoint; lowValue=midpointValue;
    } else { high=midpoint; }
  }
  return (low+high)*0.5;
}
fn updateCubicHit(
  points:array<vec2f,4>, u:f32, originShift:f32,
  nearOrigin:vec2f, direction:vec2f, directionLengthSquared:f32,
  minimum:f32, hit:ptr<function,Hit>
) {
  let point=cubicPoint(points,u);
  let s=originShift+dot(point-nearOrigin,direction)/directionLengthSquared;
  updateHit(s,u,minimum,hit);
}
fn intersectCubic(curve:CurveDescriptor,ray:Ray,hit:ptr<function,Hit>) {
  let o=curve.geometryOffset; let inverseScale=geometry[o+2u];
  let origin=(ray.origin-vec2f(geometry[o],geometry[o+1u]))*inverseScale;
  let direction=ray.direction*inverseScale;
  let directionLengthSquared=dot(direction,direction);
  if (!(directionLengthSquared>0.0) || !finiteValue(directionLengthSquared)) { return; }
  let originShift=-dot(origin,direction)/directionLengthSquared;
  let nearOrigin=origin+originShift*direction;
  let points=array<vec2f,4>(
    vec2f(geometry[o+3u],geometry[o+4u]),
    vec2f(geometry[o+5u],geometry[o+6u]),
    vec2f(geometry[o+7u],geometry[o+8u]),
    vec2f(geometry[o+9u],geometry[o+10u])
  );
  var values:array<f32,4>;
  var maximumValue=1.175494351e-38;
  for (var valueIndex=0u;valueIndex<4u;valueIndex++) {
    values[valueIndex]=cross2(points[valueIndex]-nearOrigin,direction);
    maximumValue=max(maximumValue,abs(values[valueIndex]));
  }
  let directionLength=sqrt(directionLengthSquared);
  let positionTolerance=geometry[o+11u];
  let valueTolerance=max(positionTolerance*inverseScale*directionLength,
    ${wgslFloat(64 * 2 ** -23 / (1 - 64 * 2 ** -23))}*maximumValue);
  if (abs(values[0])<=valueTolerance && abs(values[1])<=valueTolerance &&
      abs(values[2])<=valueTolerance && abs(values[3])<=valueTolerance) { return; }
  let derivative0=3.0*(values[1]-values[0]);
  let derivative1=3.0*(values[2]-values[1]);
  let derivative2=3.0*(values[3]-values[2]);
  let endpointDistance=max(positionTolerance,geometry[o+12u])*inverseScale;
  let parameterStart=-endpointParameterTolerance(
    endpointDistance,length(3.0*(points[1]-points[0])));
  let parameterEnd=1.0+endpointParameterTolerance(
    endpointDistance,length(3.0*(points[3]-points[2])));
  var partitions:array<f32,4>; var partitionCount=1u;
  partitions[0]=parameterStart;
  let derivativeRoots=quadratic(derivative0-2.0*derivative1+derivative2,
    2.0*(derivative1-derivative0),derivative0);
  for (var rootIndex=0u;rootIndex<u32(derivativeRoots.z);rootIndex++) {
    let root=select(derivativeRoots.x,derivativeRoots.y,rootIndex==1u);
    if (root>parameterStart && root<parameterEnd) {
      partitions[partitionCount]=root; partitionCount+=1u;
    }
  }
  partitions[partitionCount]=parameterEnd; partitionCount+=1u;
  for (var sortIndex=1u;sortIndex<partitionCount;sortIndex++) {
    var moveIndex=sortIndex;
    loop {
      if (moveIndex==0u || partitions[moveIndex-1u]<=partitions[moveIndex]) { break; }
      let temporary=partitions[moveIndex-1u];
      partitions[moveIndex-1u]=partitions[moveIndex];
      partitions[moveIndex]=temporary; moveIndex-=1u;
    }
  }
  for (var partitionIndex=0u;partitionIndex<partitionCount;partitionIndex++) {
    let u=partitions[partitionIndex]; let value=scalarCubic(values,u);
    if (abs(value)<=valueTolerance) {
      updateCubicHit(points,u,originShift,nearOrigin,direction,
        directionLengthSquared,max(positionTolerance,
          traceUniforms.forwardDistance),hit);
    }
    if (partitionIndex+1u>=partitionCount) { continue; }
    let end=partitions[partitionIndex+1u]; let endValue=scalarCubic(values,end);
    if ((value<0.0)!=(endValue<0.0)) {
      let root=refineCubicRoot(values,u,end,value);
      updateCubicHit(points,root,originShift,nearOrigin,direction,
        directionLengthSquared,max(positionTolerance,
          traceUniforms.forwardDistance),hit);
    }
  }
}`;
}

function normalCode(kinds) {
  const cases = [];
  if (kinds.has('lineSegment')) {
    cases.push(`case 0u: {
      frontNormal=vec2f(-geometry[o+3u],geometry[o+2u]);
      normalizeResult=false;
    }`);
  }
  if (kinds.has('smoothLineSegment')) {
    cases.push(`case 1u: {
      frontNormal=(1.0-hit.u)*vec2f(geometry[o+7u],geometry[o+8u])+
        hit.u*vec2f(geometry[o+9u],geometry[o+10u]);
    }`);
  }
  if (kinds.has('circle')) {
    cases.push(`case 3u: {
      let inverseRadius=abs(geometry[o+2u]);
      let orientation=sign(geometry[o+2u]);
      let point=ray.origin+hit.s*ray.direction-
        vec2f(geometry[o],geometry[o+1u]);
      frontNormal=orientation*point*inverseRadius;
    }`);
  }
  if (kinds.has('circularArc')) {
    cases.push(`case 2u: {
      let tangent=vec2f(geometry[o+2u],geometry[o+3u]);
      let transverse=vec2f(-tangent.y,tangent.x); let bulge=geometry[o+5u];
      var curvature:f32; var height:f32;
      if (abs(bulge)<=1.0) {
        let denominator=1.0+bulge*bulge;
        curvature=4.0*bulge*bulge/denominator;
        height=-bulge/denominator;
      } else {
        let inverseBulge=1.0/bulge;
        let denominator=1.0+inverseBulge*inverseBulge;
        curvature=4.0/denominator; height=-inverseBulge/denominator;
      }
      let product=hit.u*(1.0-hit.u); let weight=1.0-curvature*product;
      let localPoint=vec2f((hit.u-0.5)/weight,2.0*height*product/weight);
      let factor=(1.0-bulge)*(1.0+bulge);
      let localNormal=vec2f(-4.0*bulge*localPoint.x,
        -(4.0*bulge*localPoint.y-factor));
      frontNormal=tangent*localNormal.x+transverse*localNormal.y;
    }`);
  }
  if (kinds.has('cubicBezier')) {
    cases.push(`case 4u: {
      let point0=vec2f(geometry[o+3u],geometry[o+4u]);
      let point1=vec2f(geometry[o+5u],geometry[o+6u]);
      let point2=vec2f(geometry[o+7u],geometry[o+8u]);
      let point3=vec2f(geometry[o+9u],geometry[o+10u]);
      let derivative0=3.0*(point1-point0);
      let derivative1=3.0*(point2-point1);
      let derivative2=3.0*(point3-point2);
      let opposite=1.0-hit.u;
      let tangent=opposite*opposite*derivative0+
        2.0*opposite*hit.u*derivative1+hit.u*hit.u*derivative2;
      frontNormal=vec2f(-tangent.y,tangent.x);
    }`);
  }
  return `
fn curveNormal(curve:CurveDescriptor,ray:Ray,hit:Hit)->vec4f {
  let o=curve.geometryOffset; var frontNormal=vec2f(0.0);
  var normalizeResult=true;
  switch curve.kind { ${cases.join('\n')} default:{ return vec4f(0.0); } }
  if (normalizeResult) {
    let normalLength=length(frontNormal);
    if (!(normalLength>TANGENT_TOLERANCE)) { return vec4f(0.0); }
    frontNormal/=normalLength;
  }
  let sigma=select(-1.0,1.0,dot(ray.direction,frontNormal)<0.0);
  return vec4f(sigma*frontNormal,sigma,1.0);
}`;
}

function mergeCode() {
  return `
fn curvePositionTolerance(curve:CurveDescriptor)->f32 {
  let o=curve.geometryOffset;
  switch curve.kind {
    case 0u,1u:{ return geometry[o+5u]; }
    case 2u:{ return geometry[o+6u]; }
    case 3u:{ return geometry[o+3u]; }
    case 4u:{ return geometry[o+11u]; }
    default:{ return 0.0; }
  }
}
fn curveEndpointTolerance(curve:CurveDescriptor)->f32 {
  let o=curve.geometryOffset;
  switch curve.kind {
    case 0u,1u:{ return max(geometry[o+5u],geometry[o+6u]); }
    case 2u:{ return max(geometry[o+6u],geometry[o+7u]); }
    case 4u:{ return max(geometry[o+11u],geometry[o+12u]); }
    default:{ return curvePositionTolerance(curve); }
  }
}
fn curveEndpoint(curve:CurveDescriptor,endIndex:u32)->vec2f {
  let o=curve.geometryOffset; let atEnd=endIndex==1u;
  switch curve.kind {
    case 0u,1u:{
      let origin=vec2f(geometry[o],geometry[o+1u]);
      return origin+select(0.0,1.0/geometry[o+4u],atEnd)*
        vec2f(geometry[o+2u],geometry[o+3u]);
    }
    case 2u:{
      let origin=vec2f(geometry[o],geometry[o+1u]);
      let halfChord=0.5/geometry[o+4u];
      return origin+select(-halfChord,halfChord,atEnd)*
        vec2f(geometry[o+2u],geometry[o+3u]);
    }
    case 4u:{
      let local=select(vec2f(geometry[o+3u],geometry[o+4u]),
        vec2f(geometry[o+9u],geometry[o+10u]),atEnd);
      return vec2f(geometry[o],geometry[o+1u])+local/geometry[o+2u];
    }
    default:{ return vec2f(F32_MAX); }
  }
}
fn hitAtEndpoint(curve:CurveDescriptor,hit:Hit,ray:Ray)->bool {
  if (curve.kind==3u) { return false; }
  if (hit.u==0.0 || hit.u==1.0) { return true; }
  let point=ray.origin+hit.s*ray.direction;
  let tolerance=curveEndpointTolerance(curve);
  return distance(point,curveEndpoint(curve,0u))<=tolerance ||
    distance(point,curveEndpoint(curve,1u))<=tolerance;
}
fn crossingBase(rayIndex:u32)->u32 {
  return rayIndex*traceUniforms.regionWordCount*2u;
}
fn clearCrossings(rayIndex:u32) {
  let base=crossingBase(rayIndex);
  for (var wordIndex=0u;wordIndex<traceUniforms.regionWordCount;wordIndex++) {
    crossings[base+wordIndex]=0u;
    crossings[base+traceUniforms.regionWordCount+wordIndex]=0u;
  }
}
fn crossingIndex(rayIndex:u32,regionId:u32,sigma:f32)->u32 {
  let sideOffset=select(traceUniforms.regionWordCount,0u,sigma>0.0);
  return crossingBase(rayIndex)+sideOffset+(regionId>>5u);
}
fn hasRegionCrossing(
  rayIndex:u32,regionId:u32,sigma:f32
)->bool {
  let value=crossings[crossingIndex(rayIndex,regionId,sigma)];
  return (value&(1u<<(regionId&31u)))!=0u;
}
fn setRegionCrossing(rayIndex:u32,regionId:u32,sigma:f32) {
  let index=crossingIndex(rayIndex,regionId,sigma);
  crossings[index]|=1u<<(regionId&31u);
}
fn initializeCandidate(hit:Hit,curve:CurveDescriptor,rayIndex:u32)->Hit {
  clearCrossings(rayIndex);
  if (curve.ownerKind==1u) {
    setRegionCrossing(rayIndex,curve.ownerId,hit.sigma);
  }
  return hit;
}
fn mergingTolerance(first:Hit,second:Hit,secondCurve:CurveDescriptor)->f32 {
  var firstTolerance=0.0;
  if (first.curveId>=0) {
    firstTolerance=curvePositionTolerance(curves[u32(first.curveId)]);
  }
  let distanceScale=max(max(abs(first.s),abs(second.s)),1.175494351e-38);
  return max(traceUniforms.interactionMerging,
    firstTolerance+curvePositionTolerance(secondCurve)+
      traceUniforms.mergingDistanceFactor*distanceScale);
}
fn ownerPriority(ownerKind:u32)->u32 { return 2u-ownerKind; }
fn hitsCompatible(
  first:Hit,firstCurve:CurveDescriptor,second:Hit,
  secondCurve:CurveDescriptor,ray:Ray
)->bool {
  if (hitAtEndpoint(firstCurve,first,ray) ||
      hitAtEndpoint(secondCurve,second,ray)) { return true; }
  if (firstCurve.ownerKind==1u) { return (secondCurve.flags&1u)!=0u; }
  if (secondCurve.ownerKind==1u) { return (firstCurve.flags&1u)!=0u; }
  return false;
}
fn mergeCandidate(
  candidate0:Hit,hit:Hit,curveId:u32,ray:Ray,
  maximumDistance:f32,rayIndex:u32
)->Hit {
  var candidate=candidate0; let curve=curves[curveId];
  if (hit.s>maximumDistance) {
    if (candidate.curveId>=0) { return candidate; }
    let tolerance=mergingTolerance(candidate,hit,curve);
    if (hit.s>candidate.s+tolerance) { return candidate; }
  }
  if (candidate.curveId<0) {
    return initializeCandidate(hit,curve,rayIndex);
  }
  let tolerance=mergingTolerance(candidate,hit,curve);
  if (hit.s<candidate.s-tolerance) {
    return initializeCandidate(hit,curve,rayIndex);
  }
  if (hit.s>candidate.s+tolerance || candidate.conflict==3u) {
    return candidate;
  }
  let normalDifference=candidate.normal-hit.normal;
  if (dot(normalDifference,normalDifference)>
      traceUniforms.maximumNormalChordDistanceSquared) {
    candidate.conflict=3u; return candidate;
  }
  if (curve.ownerKind==1u) {
    if (hasRegionCrossing(rayIndex,curve.ownerId,hit.sigma) &&
        hit.u>0.1 && hit.u<0.9) {
      candidate.conflict=max(candidate.conflict,2u);
    }
    setRegionCrossing(rayIndex,curve.ownerId,hit.sigma);
  }
  let candidateCurve=curves[u32(candidate.curveId)];
  let newPriority=ownerPriority(curve.ownerKind);
  let candidatePriority=ownerPriority(candidateCurve.ownerKind);
  let shouldReplace=newPriority>candidatePriority ||
    (newPriority==candidatePriority && curveId<u32(candidate.curveId));
  if (!hitsCompatible(candidate,candidateCurve,hit,curve,ray)) {
    candidate.conflict=max(candidate.conflict,1u);
  }
  if (shouldReplace) {
    candidate.s=hit.s; candidate.u=hit.u; candidate.curveId=i32(curveId);
    candidate.sigma=hit.sigma;
  }
  return candidate;
}
fn getMaximumDistance(rayIndex:u32)->f32 {
  var maximumDistance=F32_MAX;
  let membershipBase=rayIndex*traceUniforms.regionWordCount;
  for (var regionId=0u;regionId<traceUniforms.regionCount;regionId++) {
    let member=(memberships[membershipBase+(regionId>>5u)]&
      (1u<<(regionId&31u)))!=0u;
    let stepSize=regions[regionId].stepSize;
    if (member && stepSize>0.0) {
      maximumDistance=min(maximumDistance,stepSize);
    }
  }
  return maximumDistance;
}
fn hasPartialReflection(rayIndex:u32)->bool {
  let base=crossingBase(rayIndex);
  for (var regionId=0u;regionId<traceUniforms.regionCount;regionId++) {
    let word=regionId>>5u; let bit=1u<<(regionId&31u);
    let crossed=((crossings[base+word]^
      crossings[base+traceUniforms.regionWordCount+word])&bit)!=0u;
    if (crossed && (regions[regionId].flags&1u)!=0u) { return true; }
  }
  return false;
}
fn classifyCandidate(rayIndex:u32,hit:Hit)->u32 {
  if (hit.curveId==-1) {
    return select(0xffffffffu,0u,hit.s>0.0 && hit.s<F32_MAX);
  }
  if (hit.curveId<0) { return 0xffffffffu; }
  let curve=curves[u32(hit.curveId)];
  switch curve.ownerKind {
    case 0u:{
      return traceUniforms.surfaceTypeOffset+surfaces[curve.ownerId].typeId;
    }
    case 1u:{ return select(1u,2u,hasPartialReflection(rayIndex)); }
    case 2u:{
      return traceUniforms.detectorTypeOffset+detectors[curve.ownerId].typeId;
    }
    default:{ return 0xffffffffu; }
  }
}
fn finishCandidate(rayIndex:u32,hit:ptr<function,Hit>) {
  if ((*hit).conflict==3u) { (*hit).curveId=-2; }
  let interactionType=classifyCandidate(rayIndex,*hit);
  (*hit).interactionType=interactionType;
  hits[rayIndex]=*hit; interactionTypeByRay[rayIndex]=interactionType;
}`;
}

function wgslFloat(value) { return Number(value).toExponential(9); }

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
