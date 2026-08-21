/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { getIntersectionTolerancePolicy } from '../../primitive/numeric.js';
import { createWebGpuRawTraceShader } from './webGpuTrace.js';
import {
  createWebGpuTraceSceneDeclaration,
  useWebGpuTraceScene,
} from './webGpuTraceScene.js';
import {
  createWebGpuRenderPreparationShader
} from './webGpuRenderPreparation.js';

/**
 * Build one scene-specialized tracing megakernel. The generated shader keeps
 * the continuation ray in function memory, evaluates all interaction kinds in
 * one invocation, and writes only branches or a suspended continuation.
 */
export function createWebGpuMegakernelShader({
  description,
  dagPrograms,
  workgroupSize,
  maxLocalIterations,
  renderVariant,
  acceleration = 'bvh4',
  lanesPerRay = 1,
  atomicFixedPointScale = 1048576,
}) {
  const trace = createWebGpuRawTraceShader(description, workgroupSize);
  if (!trace.supported) return trace;
  const regionWords = Math.max(1, Math.ceil(description.regions.length / 32));
  const maximumBvhDepth = description.bvh.nodes.reduce(
    (maximum, node) => Math.max(maximum, node.depth ?? 0), 0
  );
  const stackSize = Math.max(4, 4 * (maximumBvhDepth + 1));
  const traceGeometry = extractTraceGeometry(trace.code);
  const renderHelpers = extractRenderHelpers(
    createWebGpuRenderPreparationShader(workgroupSize),
    renderVariant
  );
  const programCode = collectProgramCode(dagPrograms);
  const bulkIndexCases = createBulkIndexCases(description, dagPrograms);
  const bulkGrinCases = createBulkGrinCases(description, dagPrograms);
  const surfaceCases = createSurfaceCases(description, dagPrograms, regionWords);
  const detectorCases = createDetectorCases(description, dagPrograms);
  const surfaceOutputCountCases = description.types.surfaces.map(
    (type, typeId) => `case ${typeId}u:{return ${
      type.definition.outRayCount}u;}`
  ).join('\n');
  const maximumOutputs = Math.max(
    description.regions.some(region => region.partialReflect) ? 2 : 1,
    ...description.types.surfaces.map(type => type.definition.outRayCount)
  );
  const neighborMode = renderVariant === 'images' ||
    renderVariant === 'observer';
  const code = `${dagPrograms.runtimeCode}\n${programCode}\n
const PARAMETER_TOLERANCE:f32=${wgslFloat(
  getIntersectionTolerancePolicy(description.numericEpsilon).parameter
)};
const TANGENT_TOLERANCE:f32=${wgslFloat(
  getIntersectionTolerancePolicy(description.numericEpsilon).tangent
)};
const FIXED_SCALE:f32=${atomicFixedPointScale}.0;
const I32_MAX_VALUE:i32=2147483647;
const I32_MIN_VALUE:i32=-2147483647-1;
const I32_MAX_F32:f32=2147483520.0;
const I32_MIN_F32:f32=-2147483648.0;
const REGION_WORDS:u32=${regionWords}u;
const MAXIMUM_OUTPUTS:u32=${maximumOutputs}u;
const BVH_INVALID_REFERENCE:u32=0xffffffffu;
const BVH_LEAF_REFERENCE_BIT:u32=0x80000000u;
const BVH_LEAF_START_MASK:u32=0x00ffffffu;
const BVH_NODE_INDEX_MASK:u32=0x0fffffffu;

struct Ray { origin:vec2f,direction:vec2f,powers:vec2f,
  wavelength:f32,flags:u32 };
struct CurveDescriptor { kind:u32,ownerKind:u32,ownerId:u32,flags:u32,
  geometryOffset:u32,geometryCount:u32,filterWavelength:f32,
  filterBandwidth:f32 };
struct BvhNode { minX:vec4f,minY:vec4f,maxX:vec4f,maxY:vec4f,
  refs:vec4u };
struct BvhPartitionRoot { minimum:vec2f,maximum:vec2f,reference:u32,
  padding0:u32,padding1:u32,padding2:u32 };
struct RegionDescriptor { typeId:u32,parameterOffset:u32,parameterCount:u32,
  flags:u32,stepSize:f32,padding0:u32,padding1:u32,padding2:u32 };
struct InstanceDescriptor { typeId:u32,parameterOffset:u32,
  parameterCount:u32,extra:u32 };
struct DetectorDescriptor { typeId:u32,parameterOffset:u32,
  parameterCount:u32,resultId:u32,resultSize:u32,resultOffset:u32,
  padding0:u32,padding1:u32 };
struct DetectorResultCell { value:atomic<i32>,overflow:atomic<u32> };
struct Hit { s:f32,u:f32,point:vec2f,normal:vec2f,curveId:i32,sigma:f32,
  conflict:u32,interactionType:u32,conflictCurveId:i32,
  conflictingCurveId:i32 };
struct TraceUniforms { rayCount:u32,rayCapacity:u32,bvhRoot:i32,
  curveCount:u32,regionCount:u32,regionWordCount:u32,
  surfaceTypeOffset:u32,detectorTypeOffset:u32,forwardDistance:f32,
  interactionMerging:f32,maximumNormalChordDistanceSquared:f32,
  mergingDistanceFactor:f32,rayPowerCutoff:f32,
  truncateWeakRays:u32,bvhPartitionCount:u32,padding2:u32 };
struct MegaUniforms { rayCapacity:u32,inputActiveOffset:u32,
  inputCountWord:u32,maxRayDepth:u32,maximumOutputs:u32,regionCount:u32,
  regionWordCount:u32,membershipStride:u32,renderVariant:u32,payloadSize:u32,
  inputRayBase:u32,outputRayBase:u32,inputMembershipBase:u32,
  outputMembershipBase:u32,blockOffset:u32,extentWord:u32 };
struct Config { values:array<vec4f,16> };
struct ReadyGeometry { p0p1:vec4f,color:vec4f,style:vec4f,extra:vec4f };
struct IndexResult { n:f32,invalid:bool };
struct BulkResult { n:f32,nX:f32,nY:f32,alpha:f32,invalid:bool };
alias Membership=array<u32,${regionWords}>;
alias CrossingMask=array<u32,${regionWords}>;

${createWebGpuTraceSceneDeclaration(description, 0)}
@group(0) @binding(1) var<storage,read_write> rayStorage:array<Ray>;
@group(0) @binding(2) var<storage,read_write> membershipStorage:array<u32>;
@group(0) @binding(3) var<storage,read_write> control:array<atomic<u32>>;
@group(0) @binding(4) var<storage,read_write>
  detectorResults:array<DetectorResultCell>;
@group(0) @binding(5) var<storage,read_write> readyGeometry:
  array<ReadyGeometry>;
@group(0) @binding(6) var<storage,read_write>
  drawArguments:array<atomic<u32>>;
@group(0) @binding(7) var<uniform> traceUniforms:TraceUniforms;
@group(0) @binding(8) var<uniform> megaUniforms:MegaUniforms;
@group(0) @binding(9) var<uniform> config:Config;

${traceGeometry}
${createTraceStateCode(description, regionWords, stackSize)}
${createOutgoingCommonCode(regionWords, bulkIndexCases, bulkGrinCases,
  surfaceOutputCountCases)}
${renderHelpers}
${createWorkgroupDeclarations({
  workgroupSize, lanesPerRay, regionWords, neighborMode
})}
${createRenderFunctions(renderVariant)}

fn recordOutput(slot:u32) {
  let generation=atomicLoad(&control[21])+1u;
  membershipStorage[megaUniforms.outputMembershipBase+
    slot*megaUniforms.membershipStride+megaUniforms.regionWordCount]=generation;
  let collectorBlocks=slot/${workgroupSize}u+1u;
  atomicMax(&control[20],collectorBlocks);
  atomicMax(&drawArguments[megaUniforms.extentWord],collectorBlocks);
}

fn recordTruncation(power:f32) {
  atomicAdd(&control[17],u32(ceil(min(
    power*FIXED_SCALE,4294967040.0))));
}

fn recordNormalConflict(rayIndex:u32,hit:Hit,power:f32) {
  recordTruncation(power);
  atomicAdd(&control[26],u32(ceil(min(
    power*FIXED_SCALE,4294967040.0))));
  let ticket=atomicAdd(&control[22],1u);
  if(ticket==0u){
    atomicStore(&control[23],rayIndex);
    atomicStore(&control[24],bitcast<u32>(hit.conflictCurveId));
    atomicStore(&control[25],bitcast<u32>(hit.conflictingCurveId));
  }
  atomicOr(&control[18],1u);
}

fn acceptChild(child:Ray,toggle:bool,incident:ptr<function,Membership>,
  front:ptr<function,CrossingMask>,back:ptr<function,CrossingMask>,
  continuation:ptr<function,Ray>,continuationMembership:ptr<function,Membership>,
  hasContinuation:ptr<function,bool>,logicalIndex:u32,startRayCount:u32,
  depth:u32,slotCount:ptr<function,u32>,isDummy:bool) {
  if((child.flags&1u)==0u){return;}
  if(!(*hasContinuation)){
    (*continuation)=child;copyMembershipValue(incident,continuationMembership,
      toggle,front,back);
    (*hasContinuation)=true;return;
  }
  if(isDummy){return;}
  let slot=logicalIndex+(*slotCount)*startRayCount;
  if(slot>=megaUniforms.rayCapacity){atomicStore(&control[8],1u);return;}
  var outputChild=child;
  outputChild.flags=(outputChild.flags&7u)|(min(depth,536870911u)<<3u);
  rayStorage[megaUniforms.outputRayBase+slot]=outputChild;
  storeMembership(slot,incident,toggle,front,back);
  recordOutput(slot);
  (*slotCount)=(*slotCount)+1u;
}

fn processInteraction(source:Ray,hit:Hit,incident:ptr<function,Membership>,
  front:ptr<function,CrossingMask>,back:ptr<function,CrossingMask>,
  rayIndex:u32,logicalIndex:u32,startRayCount:u32,depth:u32,
  slotCount:ptr<function,u32>,isDummy:bool,
  continuation:ptr<function,Ray>,nextMembership:ptr<function,Membership>)->bool {
  var hasContinuation=false;
  var point=hit.point;
  if(hit.curveId==-1){
    point=source.origin+hit.s*source.direction;
    let medium=evaluateEffectiveGrin(incident,point,source.wavelength);
    let product=source.direction.x*source.direction.y;
    let stepped=source.direction+hit.s*vec2f(
      medium.nX*(1.0-source.direction.x*source.direction.x)-
        medium.nY*product,
      medium.nY*(1.0-source.direction.y*source.direction.y)-
        medium.nX*product)/medium.n;
    let steppedLength=length(stepped);
    let powers=source.powers*exp(-medium.alpha*hit.s);
    let invalid=medium.invalid||!finiteNumber(steppedLength)||
      !(steppedLength>0.0)||any(powers<vec2f(0.0))||
      !finiteNumber(powers.x)||!finiteNumber(powers.y);
    let isActive=!invalid&&(powers.x!=0.0||powers.y!=0.0);
    let child=Ray(point,select(stepped/steppedLength,vec2f(0.0),invalid),
      select(powers,vec2f(0.0),invalid),source.wavelength,
      select(select(0u,1u,isActive),2u,invalid));
    acceptChild(child,false,incident,front,back,continuation,nextMembership,
      &hasContinuation,logicalIndex,startRayCount,depth,slotCount,isDummy);
    return hasContinuation;
  }
  if(hit.curveId<0){return false;}
  let curve=curves[u32(hit.curveId)];
  if(curve.ownerKind==1u){
    let partial=hasPartialReflection(front,back);
    let incidentIndex=evaluateEffectiveIndex(incident,front,back,point,
      source.wavelength,false);
    let transmittedIndex=evaluateEffectiveIndex(incident,front,back,point,
      source.wavelength,true);
    let relative=incidentIndex.n/transmittedIndex.n;
    let cosIncident=-dot(source.direction,hit.normal);
    let radicand=1.0-relative*relative*(1.0-cosIncident*cosIncident);
    let reflected=source.direction+2.0*cosIncident*hit.normal;
    if(!incidentIndex.invalid&&!transmittedIndex.invalid&&finiteNumber(radicand)){
      if(radicand<0.0){
        acceptChild(makeChild(source,point,reflected,source.powers),false,
          incident,front,back,continuation,nextMembership,&hasContinuation,logicalIndex,
          startRayCount,depth,slotCount,isDummy);
      }else{
        let cosTransmitted=sqrt(radicand);
        let transmitted=relative*source.direction+
          (relative*cosIncident-cosTransmitted)*hit.normal;
        var fractions=vec2f(0.0);
        if(partial){
          let s=(relative*cosIncident-cosTransmitted)/
            (relative*cosIncident+cosTransmitted);
          let p=(relative*cosTransmitted-cosIncident)/
            (relative*cosTransmitted+cosIncident);
          fractions=vec2f(s*s,p*p);
        }
        acceptChild(makeChild(source,point,transmitted,
          source.powers*(vec2f(1.0)-fractions)),true,incident,front,back,continuation,
          nextMembership,&hasContinuation,logicalIndex,startRayCount,depth,
          slotCount,isDummy);
        if(partial){acceptChild(makeChild(source,point,reflected,
          source.powers*fractions),false,incident,front,back,continuation,nextMembership,
          &hasContinuation,logicalIndex,startRayCount,depth,slotCount,isDummy);}
      }
    }
    return hasContinuation;
  }
  let localXAxis=vec2f(hit.normal.y,-hit.normal.x);
  let localDirection=vec2f(dot(source.direction,localXAxis),
    dot(source.direction,hit.normal));
  if(curve.ownerKind==0u){
    let surface=surfaces[curve.ownerId];
    let incidentIndex=evaluateEffectiveIndex(incident,front,back,point,
      source.wavelength,false);
    let transmittedIndex=evaluateEffectiveIndex(incident,front,back,point,
      source.wavelength,true);
    switch surface.typeId { ${surfaceCases} default:{} }
    return hasContinuation;
  }
  if(curve.ownerKind==2u){
    let detector=detectors[curve.ownerId];
    if(!isDummy){switch detector.typeId { ${detectorCases} default:{} }}
    acceptChild(makeChild(source,point,source.direction,source.powers),false,
      incident,front,back,continuation,nextMembership,&hasContinuation,logicalIndex,
      startRayCount,depth,slotCount,isDummy);
  }
  return hasContinuation;
}

${createMegakernelMain({
  workgroupSize,
  maxLocalIterations,
  renderVariant,
  neighborMode,
  regionWords,
  stackSize,
  acceleration,
  lanesPerRay,
})}
`;
  return {
    supported: true,
    unsupported: [],
    maximumOutputs,
    code: useWebGpuTraceScene(code),
  };
}

function createMegakernelMain(options) {
  if (options.lanesPerRay > 1) {
    return createCooperativeMegakernelMain(options);
  }
  const {
    workgroupSize,
    maxLocalIterations,
    renderVariant,
    neighborMode,
    acceleration,
  } = options;
  const trace = acceleration === 'direct'
    ? 'traceDirectLane(ray,&membership,0u,1u,&front,&back)'
    : 'traceOne(ray,&membership,&front,&back)';
  const mapping = neighborMode ? `
  let base=workgroup.x*${workgroupSize - 2}u;
  let haloValid=workgroup.x>0u||local.x>=2u;
  let logicalIndex=base+local.x-2u;
  let real=local.x>=2u&&logicalIndex<startRayCount;
  let valid=haloValid&&logicalIndex<startRayCount;
  let isDummy=valid&&!real;` : `
  let logicalIndex=invocation.x;
  let real=logicalIndex<startRayCount;
  let valid=real;
  let isDummy=false;`;
  const render = createRenderInvocation(renderVariant, neighborMode,
    workgroupSize);
  return `
@compute @workgroup_size(${workgroupSize})
fn megakernelMain(@builtin(global_invocation_id) invocation:vec3u,
  @builtin(workgroup_id) workgroup:vec3u,
  @builtin(local_invocation_id) local:vec3u) {
  let startRayCount=atomicLoad(&control[megaUniforms.inputCountWord]);${mapping}
  var ray=Ray(vec2f(0.0),vec2f(0.0),vec2f(0.0),0.0,0u);
  var rayIndex=0u;var depth=0u;var membership:Membership;
  var isActive=false;var capacityStopped=false;var slotCount=0u;
  if(valid){
    rayIndex=atomicLoad(&control[
      megaUniforms.inputActiveOffset+logicalIndex]);
    if(rayIndex<megaUniforms.rayCapacity){
      ray=rayStorage[megaUniforms.inputRayBase+rayIndex];depth=ray.flags>>3u;
      loadMembership(rayIndex,&membership);isActive=(ray.flags&1u)!=0u;
    }
  }
  let maximumSlots=select(0u,
    1u+(megaUniforms.rayCapacity-1u-logicalIndex)/max(1u,startRayCount),real);
  for(var iteration=0u;iteration<${maxLocalIterations}u;iteration++){
    if(isActive&&traceUniforms.truncateWeakRays!=0u&&
      traceUniforms.rayPowerCutoff>0.0&&
      ray.powers.x+ray.powers.y<traceUniforms.rayPowerCutoff){
      if(real){recordTruncation(ray.powers.x+ray.powers.y);}isActive=false;
    }
    var hit=Hit(0.0,0.0,vec2f(0.0),vec2f(0.0),
      -1,0.0,0u,0xffffffffu,-1,-1);
    var segmentRay=ray;var front:CrossingMask;var back:CrossingMask;
    if(isActive){
      if(real){atomicAdd(&control[16],1u);}
      hit=${trace};
    }
    var capacityStalled=false;
    if(isActive&&hit.conflict!=3u&&depth<megaUniforms.maxRayDepth&&
      hit.s>0.0&&hit.s<F32_MAX){
      let required=interactionOutputCount(hit,&front,&back);
      if(real&&slotCount+required>maximumSlots){
        capacityStalled=true;
        atomicMax(&control[5],(slotCount+required)*startRayCount);
        if(iteration==0u){atomicStore(&control[8],1u);}
      }
    }
    let renderActive=isActive&&!capacityStalled;
    ${render}
    if(capacityStalled){isActive=false;capacityStopped=true;}
    if(isActive){
      if(hit.conflict==3u){if(real){recordNormalConflict(
        rayIndex,hit,ray.powers.x+ray.powers.y);}
        isActive=false;}
      else if(depth>=megaUniforms.maxRayDepth){
        if(real){recordTruncation(ray.powers.x+ray.powers.y);}isActive=false;}
      else if(hit.s<=0.0||hit.s>=F32_MAX){isActive=false;}
      else{
        var continuation=ray;var nextMembership:Membership;
        let continues=processInteraction(ray,hit,&membership,&front,&back,
          rayIndex,logicalIndex,startRayCount,depth+1u,&slotCount,isDummy,
          &continuation,&nextMembership);
        isActive=continues;
        if(continues){ray=continuation;membership=nextMembership;depth+=1u;}
      }
    }
  }
  if((isActive||capacityStopped)&&real){writeSuspended(
    ray,&membership,logicalIndex,startRayCount,depth,&slotCount);}
}`;
}

function createCooperativeMegakernelMain({
  workgroupSize,
  maxLocalIterations,
  renderVariant,
  neighborMode,
  regionWords,
  acceleration,
  lanesPerRay,
}) {
  if (workgroupSize % lanesPerRay !== 0) {
    throw new RangeError('Cooperative lanes must divide the workgroup size.');
  }
  const raySlots = workgroupSize / lanesPerRay;
  const payload = raySlots - (neighborMode ? 2 : 0);
  if (payload <= 0) {
    throw new RangeError('Cooperative image tracing needs a productive ray slot.');
  }
  const trace = acceleration === 'direct'
    ? `traceDirectLane(ray,&membership,lane,${lanesPerRay}u,&localFront,
        &localBack)`
    : `traceBvhLane(ray,&membership,lane,${lanesPerRay}u,&localFront,
        &localBack)`;
  const mapping = neighborMode ? `
  let rayBase=workgroup.x*${payload}u;
  let haloValid=workgroup.x>0u||raySlot>=2u;
  let logicalIndex=rayBase+raySlot-2u;
  let real=raySlot>=2u&&logicalIndex<startRayCount;
  let valid=haloValid&&logicalIndex<startRayCount;
  let isDummy=valid&&!real;` : `
  let logicalIndex=workgroup.x*${raySlots}u+raySlot;
  let real=logicalIndex<startRayCount;
  let valid=real;
  let isDummy=false;`;
  const render = createCooperativeRenderInvocation({
    renderVariant,
    neighborMode,
    raySlots,
  });
  return `
@compute @workgroup_size(${workgroupSize})
fn megakernelMain(@builtin(workgroup_id) workgroup:vec3u,
  @builtin(local_invocation_id) local:vec3u) {
  let startRayCount=atomicLoad(&control[megaUniforms.inputCountWord]);
  let lane=local.x%${lanesPerRay}u;
  let raySlot=local.x/${lanesPerRay}u;
  let leader=lane==0u;${mapping}
  var ray=Ray(vec2f(0.0),vec2f(0.0),vec2f(0.0),0.0,0u);
  var rayIndex=0u;var depth=0u;var membership:Membership;
  var isActive=false;var capacityStopped=false;var slotCount=0u;
  for(var word=0u;word<REGION_WORDS;word++){membership[word]=0u;}
  if(valid){
    rayIndex=atomicLoad(&control[
      megaUniforms.inputActiveOffset+logicalIndex]);
    if(rayIndex<megaUniforms.rayCapacity){
      ray=rayStorage[megaUniforms.inputRayBase+rayIndex];depth=ray.flags>>3u;
      loadMembership(rayIndex,&membership);isActive=(ray.flags&1u)!=0u;
    }
  }
  let maximumSlots=select(0u,
    1u+(megaUniforms.rayCapacity-1u-logicalIndex)/max(1u,startRayCount),real);
  for(var iteration=0u;iteration<${maxLocalIterations}u;iteration++){
    if(isActive&&traceUniforms.truncateWeakRays!=0u&&
      traceUniforms.rayPowerCutoff>0.0&&
      ray.powers.x+ray.powers.y<traceUniforms.rayPowerCutoff){
      if(leader&&real){recordTruncation(ray.powers.x+ray.powers.y);}
      isActive=false;
    }
    var localFront:CrossingMask;var localBack:CrossingMask;
    clearCrossings(&localFront,&localBack);
    var localHit=Hit(0.0,0.0,vec2f(0.0),vec2f(0.0),
      -1,0.0,0u,0xffffffffu,-1,-1);
    let segmentRay=ray;
    if(isActive){localHit=${trace};}
    cooperativeHits[local.x]=localHit;
    workgroupBarrier();
    let firstLane=local.x-lane;
    if(leader){
      var merged=Hit(maximumDistance(&membership),0.0,
        vec2f(0.0),vec2f(0.0),-1,0.0,0u,0xffffffffu,-1,-1);
      if(isActive){
        for(var other=0u;other<${lanesPerRay}u;other++){
          merged=mergeRepresentative(merged,cooperativeHits[firstLane+other],ray);
        }
      }
      cooperativeHits[firstLane]=merged;
      atomicStore(&cooperativeConflict[raySlot],merged.conflict);
      for(var word=0u;word<REGION_WORDS;word++){
        let sharedIndex=raySlot*REGION_WORDS+word;
        atomicStore(&cooperativeFront[sharedIndex],0u);
        atomicStore(&cooperativeBack[sharedIndex],0u);
      }
    }
    workgroupBarrier();
    var hit=cooperativeHits[firstLane];
    if(isActive&&belongsToRepresentative(localHit,hit)){
      for(var word=0u;word<REGION_WORDS;word++){
        let sharedIndex=raySlot*REGION_WORDS+word;
        let oldFront=atomicOr(&cooperativeFront[sharedIndex],localFront[word]);
        let oldBack=atomicOr(&cooperativeBack[sharedIndex],localBack[word]);
        if((oldFront&localFront[word])!=0u||(oldBack&localBack[word])!=0u){
          atomicMax(&cooperativeConflict[raySlot],2u);
        }
      }
    }
    workgroupBarrier();
    var front:CrossingMask;var back:CrossingMask;
    clearCrossings(&front,&back);
    if(leader){
      hit.conflict=max(hit.conflict,atomicLoad(&cooperativeConflict[raySlot]));
      for(var word=0u;word<REGION_WORDS;word++){
        let sharedIndex=raySlot*REGION_WORDS+word;
        front[word]=atomicLoad(&cooperativeFront[sharedIndex]);
        back[word]=atomicLoad(&cooperativeBack[sharedIndex]);
      }
      cooperativeHits[firstLane]=hit;
      if(real&&isActive){atomicAdd(&control[16],1u);}
    }
    var capacityStalled=false;
    if(leader&&isActive&&hit.conflict!=3u&&depth<megaUniforms.maxRayDepth&&
      hit.s>0.0&&hit.s<F32_MAX){
      let required=interactionOutputCount(hit,&front,&back);
      if(real&&slotCount+required>maximumSlots){
        capacityStalled=true;
        atomicMax(&control[5],(slotCount+required)*startRayCount);
        if(iteration==0u){atomicStore(&control[8],1u);}
      }
    }
    let renderActive=isActive&&!capacityStalled;
    ${render}
    if(leader){
      if(capacityStalled){isActive=false;capacityStopped=true;}
      if(isActive){
        if(hit.conflict==3u){if(real){recordNormalConflict(
          rayIndex,hit,ray.powers.x+ray.powers.y);}
          isActive=false;}
        else if(depth>=megaUniforms.maxRayDepth){
          if(real){recordTruncation(ray.powers.x+ray.powers.y);}isActive=false;}
        else if(hit.s<=0.0||hit.s>=F32_MAX){isActive=false;}
        else{
          var continuation=ray;var nextMembership:Membership;
          let continues=processInteraction(ray,hit,&membership,&front,&back,
            rayIndex,logicalIndex,startRayCount,depth+1u,&slotCount,isDummy,
            &continuation,&nextMembership);
          isActive=continues;
          if(continues){ray=continuation;membership=nextMembership;depth+=1u;}
        }
      }
      cooperativeRays[raySlot]=ray;
      cooperativeState[raySlot]=vec4u(
        select(0u,1u,isActive),select(0u,1u,capacityStopped),slotCount,depth);
      for(var word=0u;word<REGION_WORDS;word++){
        cooperativeMembership[raySlot*REGION_WORDS+word]=membership[word];
      }
    }
    workgroupBarrier();
    ray=cooperativeRays[raySlot];
    let state=cooperativeState[raySlot];
    isActive=state.x!=0u;capacityStopped=state.y!=0u;
    slotCount=state.z;depth=state.w;
    for(var word=0u;word<REGION_WORDS;word++){
      membership[word]=cooperativeMembership[raySlot*REGION_WORDS+word];
    }
    workgroupBarrier();
  }
  if(leader&&(isActive||capacityStopped)&&real){writeSuspended(
    ray,&membership,logicalIndex,startRayCount,depth,&slotCount);}
}`;
}

function createCooperativeRenderInvocation({
  renderVariant,
  neighborMode,
  raySlots,
}) {
  if (renderVariant === 'none') return '';
  if (!neighborMode) {
    return `if(leader&&real&&renderActive&&hit.s>0.0){
      renderIndependent(segmentRay,hit,depth);}`;
  }
  const modeCode = renderVariant === 'images'
    ? `renderImageNeighbor(bank+raySlot);`
    : `renderObserverNeighbor(bank+raySlot,logicalIndex);`;
  return `
    let bank=(iteration&1u)*${raySlots}u;
    if(leader){
      sharedRays[bank+raySlot]=Ray(
        vec2f(0.0),vec2f(0.0),vec2f(0.0),0.0,0u);
      sharedHits[bank+raySlot]=Hit(0.0,0.0,vec2f(0.0),vec2f(0.0),
        -1,0.0,0u,0xffffffffu,-1,-1);
      if(renderActive){sharedRays[bank+raySlot]=segmentRay;
        sharedHits[bank+raySlot]=hit;}
    }
    workgroupBarrier();
    if(leader&&real&&raySlot>=2u){${modeCode}}
    workgroupBarrier();`;
}

function createWorkgroupDeclarations({
  workgroupSize,
  lanesPerRay,
  regionWords,
  neighborMode,
}) {
  if (lanesPerRay === 1) {
    return neighborMode ? `
var<workgroup> sharedRays:array<Ray,${workgroupSize * 2}>;
var<workgroup> sharedHits:array<Hit,${workgroupSize * 2}>;
` : '';
  }
  const raySlots = workgroupSize / lanesPerRay;
  return `
var<workgroup> cooperativeHits:array<Hit,${workgroupSize}>;
var<workgroup> cooperativeRays:array<Ray,${raySlots}>;
var<workgroup> cooperativeState:array<vec4u,${raySlots}>;
var<workgroup> cooperativeMembership:array<u32,${raySlots * regionWords}>;
var<workgroup> cooperativeFront:array<atomic<u32>,${raySlots * regionWords}>;
var<workgroup> cooperativeBack:array<atomic<u32>,${raySlots * regionWords}>;
var<workgroup> cooperativeConflict:array<atomic<u32>,${raySlots}>;
${neighborMode ? `
var<workgroup> sharedRays:array<Ray,${raySlots * 2}>;
var<workgroup> sharedHits:array<Hit,${raySlots * 2}>;` : ''}
`;
}

function createRenderInvocation(variant, neighborMode, workgroupSize) {
  if (variant === 'none') return '';
  if (!neighborMode) {
    return `if(real&&renderActive&&hit.s>0.0){
      renderIndependent(segmentRay,hit,depth);}`;
  }
  const modeCode = variant === 'images' ? `
    if(real&&local.x>=2u){renderImageNeighbor(bank+local.x);}` : `
    if(real&&local.x>=2u){renderObserverNeighbor(bank+local.x,logicalIndex);}`;
  return `
    let bank=(iteration&1u)*${workgroupSize}u;
    sharedRays[bank+local.x]=Ray(vec2f(0.0),vec2f(0.0),vec2f(0.0),0.0,0u);
    sharedHits[bank+local.x]=Hit(0.0,0.0,vec2f(0.0),vec2f(0.0),
      -1,0.0,0u,0xffffffffu,-1,-1);
    if(renderActive){sharedRays[bank+local.x]=segmentRay;
      sharedHits[bank+local.x]=hit;}
    workgroupBarrier();${modeCode}`;
}

function createTraceStateCode(description, regionWords, stackSize) {
  const kinds = new Set(description.curves.map(curve => curve.geometry.kind));
  const cases = [];
  if (kinds.has('lineSegment') || kinds.has('smoothLineSegment')) {
    cases.push('case 0u,1u:{intersectLine(curve,ray,&hit);}');
  }
  if (kinds.has('circularArc')) {
    cases.push('case 2u:{intersectArc(curve,ray,&hit);}');
  }
  if (kinds.has('circle')) {
    cases.push('case 3u:{intersectCircle(curve,ray,&hit);}');
  }
  if (kinds.has('cubicBezier')) {
    cases.push('case 4u:{intersectCubic(curve,ray,&hit);}');
  }
  return `
fn loadMembership(index:u32,value:ptr<function,Membership>){
  for(var word=0u;word<REGION_WORDS;word++){
    (*value)[word]=membershipStorage[megaUniforms.inputMembershipBase+
      index*megaUniforms.membershipStride+word];
  }
}
fn storeMembership(index:u32,value:ptr<function,Membership>,toggle:bool,
  front:ptr<function,CrossingMask>,back:ptr<function,CrossingMask>){
  for(var word=0u;word<REGION_WORDS;word++){
    var result=(*value)[word];
    if(toggle){result^=(*front)[word]^(*back)[word];}
    membershipStorage[megaUniforms.outputMembershipBase+
      index*megaUniforms.membershipStride+word]=result;
  }
}
fn copyMembershipValue(source:ptr<function,Membership>,
  destination:ptr<function,Membership>,toggle:bool,
  front:ptr<function,CrossingMask>,back:ptr<function,CrossingMask>){
  for(var word=0u;word<REGION_WORDS;word++){
    var value=(*source)[word];
    if(toggle){value^=(*front)[word]^(*back)[word];}
    (*destination)[word]=value;
  }
}
fn clearCrossings(front:ptr<function,CrossingMask>,
  back:ptr<function,CrossingMask>){
  for(var word=0u;word<REGION_WORDS;word++){
    (*front)[word]=0u;(*back)[word]=0u;
  }
}
fn crossingPresent(mask:ptr<function,CrossingMask>,regionId:u32)->bool{
  return ((*mask)[regionId>>5u]&(1u<<(regionId&31u)))!=0u;
}
fn setCrossing(front:ptr<function,CrossingMask>,
  back:ptr<function,CrossingMask>,regionId:u32,sigma:f32){
  let word=regionId>>5u;let bit=1u<<(regionId&31u);
  if(sigma>0.0){(*front)[word]|=bit;}else{(*back)[word]|=bit;}
}
fn initializeCandidate(hit:Hit,curve:CurveDescriptor,
  front:ptr<function,CrossingMask>,back:ptr<function,CrossingMask>)->Hit{
  clearCrossings(front,back);
  if(curve.ownerKind==1u){setCrossing(front,back,curve.ownerId,hit.sigma);}
  return hit;
}
fn mergingTolerance(first:Hit,second:Hit,curve:CurveDescriptor)->f32{
  var firstTolerance=0.0;
  if(first.curveId>=0){firstTolerance=curvePositionTolerance(
    curves[u32(first.curveId)]);}
  let scale=max(max(abs(first.s),abs(second.s)),1.175494351e-38);
  return max(traceUniforms.interactionMerging,firstTolerance+
    curvePositionTolerance(curve)+traceUniforms.mergingDistanceFactor*scale);
}
fn ownerPriority(kind:u32)->u32{return 2u-kind;}
fn hitsCompatible(first:Hit,firstCurve:CurveDescriptor,second:Hit,
  secondCurve:CurveDescriptor,ray:Ray)->bool{
  if(hitAtEndpoint(firstCurve,first,ray)||
      hitAtEndpoint(secondCurve,second,ray)){return true;}
  if(firstCurve.ownerKind==1u){return (secondCurve.flags&1u)!=0u;}
  if(secondCurve.ownerKind==1u){return (firstCurve.flags&1u)!=0u;}
  return false;
}
fn mergeLocal(candidate0:Hit,hit:Hit,curveId:u32,ray:Ray,
  maximumDistance:f32,front:ptr<function,CrossingMask>,
  back:ptr<function,CrossingMask>)->Hit{
  var candidate=candidate0;let curve=curves[curveId];
  if(hit.s>maximumDistance){
    if(candidate.curveId>=0){return candidate;}
    if(hit.s>candidate.s+mergingTolerance(candidate,hit,curve)){return candidate;}
  }
  if(candidate.curveId<0){return initializeCandidate(hit,curve,front,back);}
  let tolerance=mergingTolerance(candidate,hit,curve);
  if(hit.s<candidate.s-tolerance){return initializeCandidate(hit,curve,front,back);}
  if(hit.s>candidate.s+tolerance||candidate.conflict==3u){return candidate;}
  let normalDifference=candidate.normal-hit.normal;
  if(dot(normalDifference,normalDifference)>
    traceUniforms.maximumNormalChordDistanceSquared){candidate.conflict=3u;
    candidate.conflictCurveId=candidate.curveId;
    candidate.conflictingCurveId=i32(curveId);return candidate;}
  if(curve.ownerKind==1u){
    var duplicate=false;
    if(hit.sigma>0.0){duplicate=crossingPresent(front,curve.ownerId);}
    else{duplicate=crossingPresent(back,curve.ownerId);}
    if(duplicate&&hit.u>0.1&&hit.u<0.9){
      candidate.conflict=max(candidate.conflict,2u);}
    setCrossing(front,back,curve.ownerId,hit.sigma);
  }
  let oldCurve=curves[u32(candidate.curveId)];
  let replace=ownerPriority(curve.ownerKind)>ownerPriority(oldCurve.ownerKind)||
    (ownerPriority(curve.ownerKind)==ownerPriority(oldCurve.ownerKind)&&
      curveId<u32(candidate.curveId));
  if(!hitsCompatible(candidate,oldCurve,hit,curve,ray)){
    candidate.conflict=max(candidate.conflict,1u);}
  if(replace){candidate.s=hit.s;candidate.u=hit.u;candidate.point=hit.point;
    candidate.curveId=i32(curveId);candidate.sigma=hit.sigma;}
  return candidate;
}
fn maximumDistance(membership:ptr<function,Membership>)->f32{
  var result=F32_MAX;
  for(var regionId=0u;regionId<traceUniforms.regionCount;regionId++){
    let member=((*membership)[regionId>>5u]&(1u<<(regionId&31u)))!=0u;
    let step=regions[regionId].stepSize;
    if(member&&step>0.0){result=min(result,step);}
  }
  return result;
}
fn intersectLocal(curveId:u32,ray:Ray,candidate:Hit,maximum:f32,
  front:ptr<function,CrossingMask>,back:ptr<function,CrossingMask>)->Hit{
  let curve=curves[curveId];if(!passesFilter(curve,ray.wavelength)){return candidate;}
  var hit=Hit(F32_MAX,0.0,vec2f(0.0),vec2f(0.0),
    -1,0.0,0u,0xffffffffu,-1,-1);
  switch curve.kind { ${cases.join('\n')} default:{} }
  if(hit.s==F32_MAX){return candidate;}
  let normal=curveNormal(curve,ray,hit);if(normal.w==0.0){return candidate;}
  hit.normal=normal.xy;hit.sigma=normal.z;
  if(curve.ownerKind!=1u&&(curve.flags&2u)==0u&&hit.sigma!=1.0){return candidate;}
  hit.curveId=i32(curveId);
  return mergeLocal(candidate,hit,curveId,ray,maximum,front,back);
}
fn traceOne(ray:Ray,membership:ptr<function,Membership>,
  front:ptr<function,CrossingMask>,back:ptr<function,CrossingMask>)->Hit{
  clearCrossings(front,back);let maximum=maximumDistance(membership);
  var hit=Hit(maximum,0.0,vec2f(0.0),vec2f(0.0),
    -1,0.0,0u,0xffffffffu,-1,-1);
  if(traceUniforms.bvhRoot<0){return hit;}
  var stackRefs:array<u32,${stackSize}>;
  var stackNear:array<f32,${stackSize}>;var stackCount=1u;
  stackRefs[0]=u32(traceUniforms.bvhRoot);stackNear[0]=0.0;
  loop{
    if(stackCount==0u){break;}stackCount-=1u;
    let reference=stackRefs[stackCount];
    if(stackNear[stackCount]>hit.s){continue;}
    if((reference&BVH_LEAF_REFERENCE_BIT)!=0u){
      let start=reference&BVH_LEAF_START_MASK;
      let count=(reference>>24u)&0x7fu;
      for(var offset=0u;offset<count;offset++){
        hit=intersectLocal(bvhCurveIds[start+offset],ray,hit,
          maximum,front,back);
      }
      continue;
    }
    let node=bvhNodes[reference&BVH_NODE_INDEX_MASK];
    let nearValues=boundsNear4(ray,node,traceUniforms.forwardDistance);
    var orderedRefs:array<u32,4>;var orderedNear:array<f32,4>;
    var orderedCount=0u;
    for(var child=0u;child<4u;child++){
      let childRef=node.refs[child];let childNear=nearValues[child];
      if(childRef==BVH_INVALID_REFERENCE||childNear==F32_MAX||
          childNear>hit.s){continue;}
      var position=orderedCount;
      loop{
        if(position==0u||orderedNear[position-1u]>childNear){break;}
        orderedNear[position]=orderedNear[position-1u];
        orderedRefs[position]=orderedRefs[position-1u];position-=1u;
      }
      orderedNear[position]=childNear;orderedRefs[position]=childRef;
      orderedCount+=1u;
    }
    for(var child=0u;child<orderedCount;child++){
      stackRefs[stackCount]=orderedRefs[child];
      stackNear[stackCount]=orderedNear[child];stackCount+=1u;
    }
  }
  return hit;
}
fn traceDirectLane(ray:Ray,membership:ptr<function,Membership>,lane:u32,
  laneCount:u32,front:ptr<function,CrossingMask>,
  back:ptr<function,CrossingMask>)->Hit{
  clearCrossings(front,back);let maximum=maximumDistance(membership);
  var hit=Hit(maximum,0.0,vec2f(0.0),vec2f(0.0),
    -1,0.0,0u,0xffffffffu,-1,-1);
  for(var curveId=lane;curveId<traceUniforms.curveCount;curveId+=laneCount){
    hit=intersectLocal(curveId,ray,hit,maximum,front,back);
  }
  return hit;
}
fn traceBvhReference(ray:Ray,reference0:u32,maximum:f32,hit0:Hit,
  front:ptr<function,CrossingMask>,back:ptr<function,CrossingMask>)->Hit{
  var hit=hit0;var stackRefs:array<u32,${stackSize}>;
  var stackNear:array<f32,${stackSize}>;var stackCount=1u;
  stackRefs[0]=reference0;stackNear[0]=0.0;
  loop{
    if(stackCount==0u){break;}stackCount-=1u;
    let reference=stackRefs[stackCount];
    if(stackNear[stackCount]>hit.s){continue;}
    if((reference&BVH_LEAF_REFERENCE_BIT)!=0u){
      let start=reference&BVH_LEAF_START_MASK;
      let count=(reference>>24u)&0x7fu;
      for(var offset=0u;offset<count;offset++){
        hit=intersectLocal(bvhCurveIds[start+offset],ray,hit,
          maximum,front,back);
      }
      continue;
    }
    let node=bvhNodes[reference&BVH_NODE_INDEX_MASK];
    let nearValues=boundsNear4(ray,node,traceUniforms.forwardDistance);
    for(var child=0u;child<4u;child++){
      let childRef=node.refs[child];let childNear=nearValues[child];
      if(childRef!=BVH_INVALID_REFERENCE&&childNear!=F32_MAX&&
          childNear<=hit.s){
        stackRefs[stackCount]=childRef;stackNear[stackCount]=childNear;
        stackCount+=1u;
      }
    }
  }
  return hit;
}
fn traceBvhLane(ray:Ray,membership:ptr<function,Membership>,lane:u32,
  laneCount:u32,front:ptr<function,CrossingMask>,
  back:ptr<function,CrossingMask>)->Hit{
  clearCrossings(front,back);let maximum=maximumDistance(membership);
  var hit=Hit(maximum,0.0,vec2f(0.0),vec2f(0.0),
    -1,0.0,0u,0xffffffffu,-1,-1);
  for(var rootIndex=lane;rootIndex<traceUniforms.bvhPartitionCount;
      rootIndex+=laneCount){
    let root=bvhPartitionRoots[rootIndex];
    let near=boundsNear(ray,vec4f(root.minimum,root.maximum),
      traceUniforms.forwardDistance);
    if(near!=F32_MAX&&near<=hit.s){
      hit=traceBvhReference(ray,root.reference,maximum,hit,front,back);
    }
  }
  return hit;
}
fn mergeRepresentative(candidate0:Hit,hit:Hit,ray:Ray)->Hit{
  var candidate=candidate0;
  if(hit.curveId<0){return candidate;}
  if(candidate.curveId<0){return hit;}
  let curve=curves[u32(hit.curveId)];
  let tolerance=mergingTolerance(candidate,hit,curve);
  if(hit.s<candidate.s-tolerance){return hit;}
  if(hit.s>candidate.s+tolerance||candidate.conflict==3u){return candidate;}
  if(hit.conflict>candidate.conflict){
    candidate.conflictCurveId=hit.conflictCurveId;
    candidate.conflictingCurveId=hit.conflictingCurveId;
  }
  candidate.conflict=max(candidate.conflict,hit.conflict);
  let difference=candidate.normal-hit.normal;
  if(dot(difference,difference)>
      traceUniforms.maximumNormalChordDistanceSquared){
    candidate.conflict=3u;candidate.conflictCurveId=candidate.curveId;
    candidate.conflictingCurveId=hit.curveId;return candidate;
  }
  let oldCurve=curves[u32(candidate.curveId)];
  if(!hitsCompatible(candidate,oldCurve,hit,curve,ray)){
    candidate.conflict=max(candidate.conflict,1u);
  }
  let replace=ownerPriority(curve.ownerKind)>ownerPriority(oldCurve.ownerKind)||
    (ownerPriority(curve.ownerKind)==ownerPriority(oldCurve.ownerKind)&&
      u32(hit.curveId)<u32(candidate.curveId));
  if(replace){candidate.s=hit.s;candidate.u=hit.u;candidate.point=hit.point;
    candidate.curveId=hit.curveId;candidate.sigma=hit.sigma;}
  return candidate;
}
fn belongsToRepresentative(hit:Hit,representative:Hit)->bool{
  if(hit.curveId<0||representative.curveId<0){return false;}
  return abs(hit.s-representative.s)<=mergingTolerance(
    representative,hit,curves[u32(hit.curveId)]);
}
`;
}

function createOutgoingCommonCode(regionWords, bulkIndexCases, bulkGrinCases,
  surfaceOutputCountCases) {
  return `
fn finiteNumber(value:f32)->bool{return value==value&&abs(value)<=F32_MAX;}
fn regionCrossed(front:ptr<function,CrossingMask>,
  back:ptr<function,CrossingMask>,regionId:u32)->bool{
  let word=regionId>>5u;let bit=1u<<(regionId&31u);
  return (((*front)[word]^(*back)[word])&bit)!=0u;
}
fn hasPartialReflection(front:ptr<function,CrossingMask>,
  back:ptr<function,CrossingMask>)->bool{
  for(var regionId=0u;regionId<traceUniforms.regionCount;regionId++){
    if(regionCrossed(front,back,regionId)&&(regions[regionId].flags&1u)!=0u){
      return true;}
  }return false;
}
fn interactionOutputCount(hit:Hit,front:ptr<function,CrossingMask>,
  back:ptr<function,CrossingMask>)->u32{
  if(hit.curveId==-1){return 1u;}if(hit.curveId<0){return 0u;}
  let curve=curves[u32(hit.curveId)];
  if(curve.ownerKind==1u){return select(1u,2u,
    hasPartialReflection(front,back));}
  if(curve.ownerKind==0u){
    switch surfaces[curve.ownerId].typeId { ${surfaceOutputCountCases}
      default:{return 0u;} }
  }
  return select(0u,1u,curve.ownerKind==2u);
}
fn evaluateBulkIndex(region:RegionDescriptor,point:vec2f,wavelength:f32)
  ->IndexResult{switch region.typeId { ${bulkIndexCases} default:{
    return IndexResult(0.0,true);} }}
fn evaluateBulkGrin(region:RegionDescriptor,point:vec2f,wavelength:f32)
  ->BulkResult{switch region.typeId { ${bulkGrinCases} default:{
    return BulkResult(0.0,0.0,0.0,0.0,true);} }}
fn evaluateEffectiveIndex(membership:ptr<function,Membership>,
  front:ptr<function,CrossingMask>,back:ptr<function,CrossingMask>,
  point:vec2f,wavelength:f32,toggle:bool)->IndexResult{
  var result=IndexResult(1.0,false);
  for(var regionId=0u;regionId<traceUniforms.regionCount;regionId++){
    var member=((*membership)[regionId>>5u]&(1u<<(regionId&31u)))!=0u;
    if(toggle&&regionCrossed(front,back,regionId)){member=!member;}
    if(!member){continue;}let evaluated=evaluateBulkIndex(
      regions[regionId],point,wavelength);let next=result.n*evaluated.n;
    result=IndexResult(next,result.invalid||evaluated.invalid||
      !finiteNumber(next));
  }return result;
}
fn evaluateEffectiveGrin(membership:ptr<function,Membership>,point:vec2f,
  wavelength:f32)->BulkResult{
  var result=BulkResult(1.0,0.0,0.0,0.0,false);
  for(var regionId=0u;regionId<traceUniforms.regionCount;regionId++){
    if(((*membership)[regionId>>5u]&(1u<<(regionId&31u)))==0u){continue;}
    let evaluated=evaluateBulkGrin(regions[regionId],point,wavelength);
    let oldN=result.n;let nextN=oldN*evaluated.n;
    let nextNX=result.nX*evaluated.n+oldN*evaluated.nX;
    let nextNY=result.nY*evaluated.n+oldN*evaluated.nY;
    result=BulkResult(nextN,nextNX,nextNY,result.alpha+evaluated.alpha,
      result.invalid||evaluated.invalid||!finiteNumber(nextN)||
      !finiteNumber(nextNX)||!finiteNumber(nextNY));
  }return result;
}
fn makeChild(source:Ray,point:vec2f,direction:vec2f,powers:vec2f)->Ray{
  let invalid=!finiteNumber(point.x)||!finiteNumber(point.y)||
    !finiteNumber(direction.x)||!finiteNumber(direction.y)||
    !(dot(direction,direction)>0.0)||!finiteNumber(powers.x)||
    !finiteNumber(powers.y)||any(powers<vec2f(0.0));
  let isActive=!invalid&&(powers.x!=0.0||powers.y!=0.0);
  return Ray(point,select(direction,vec2f(0.0),invalid),
    select(powers,vec2f(0.0),invalid),source.wavelength,
    select(select(0u,1u,isActive),2u,invalid));
}
fn surfaceCrossesBoundary(curve:CurveDescriptor,source:Ray,hit:Hit,
  direction:vec2f)->bool{
  if(curve.kind!=1u){return dot(direction,hit.normal)<0.0;}
  let o=curve.geometryOffset;let frontNormal=vec2f(-geometry[o+3u],geometry[o+2u]);
  let orientation=select(-1.0,1.0,dot(source.direction,frontNormal)<0.0);
  return orientation*dot(direction,frontNormal)<0.0;
}
fn accumulateDetector(detector:DetectorDescriptor,key:W,value:W){
  if(key.invalid||value.invalid||!finiteNumber(key.value)||
    !finiteNumber(value.value)||key.value!=floor(key.value)||key.value<0.0||
    key.value>=f32(detector.resultSize)){return;}
  let cell=detector.resultOffset+u32(key.value);let scaled=value.value*FIXED_SCALE;
  let conversion=!finiteNumber(scaled)||scaled>I32_MAX_F32||scaled<I32_MIN_F32;
  let amount=i32(clamp(scaled,I32_MIN_F32,I32_MAX_F32));
  let old=atomicAdd(&detectorResults[cell].value,amount);
  if(conversion||(amount>0&&old>I32_MAX_VALUE-amount)||
    (amount<0&&old<I32_MIN_VALUE-amount)){
    atomicStore(&detectorResults[cell].overflow,1u);}
}
fn writeSuspended(ray:Ray,membership:ptr<function,Membership>,logical:u32,
  count:u32,depth:u32,slotCount:ptr<function,u32>){
  let slot=logical+(*slotCount)*count;
  if(slot>=megaUniforms.rayCapacity){atomicStore(&control[8],1u);return;}
  var outputRay=ray;
  outputRay.flags=(outputRay.flags&7u)|(min(depth,536870911u)<<3u);
  rayStorage[megaUniforms.outputRayBase+slot]=outputRay;
  for(var word=0u;word<REGION_WORDS;word++){
    membershipStorage[megaUniforms.outputMembershipBase+
      slot*megaUniforms.membershipStride+word]=(*membership)[word];}
  recordOutput(slot);
  (*slotCount)=(*slotCount)+1u;
}
`;
}

function createRenderFunctions(variant) {
  if (variant === 'none') return '';
  if (variant === 'rays' || variant === 'extended') {
    const extended = variant === 'extended';
    return `
fn renderIndependent(ray:Ray,hit:Hit,depth:u32){
  let finiteEnd=hit.s<F32_MAX*0.5;var end=hit.point;
  if(hit.curveId<0){end=ray.origin+hit.s*ray.direction;}
  let color=encodeColor(config.values[5],ray,1.0);let dash=config.values[12].xy;
  if(finiteEnd){pushVisibleSegment(ray.origin,end,color,dash,
    config.values[0].z>0.5);}else{pushRay(ray.origin,ray.direction,color,dash,
      config.values[0].z>0.5);}
  ${extended ? `if(depth>0u){
    pushRay(ray.origin,-ray.direction,encodeColor(config.values[6],ray,1.0),
      config.values[12].zw,false);
    if(finiteEnd){pushRay(end,ray.direction,encodeColor(config.values[7],ray,1.0),
      config.values[13].xy,false);}
  }` : ''}
}`;
  }
  if (variant === 'images') {
    return `
fn renderImageNeighbor(index:u32){
  let ray=sharedRays[index];let hit=sharedHits[index];
  if((ray.flags&1u)==0u||(sharedRays[index-1u].flags&1u)==0u||
    (sharedRays[index-2u].flags&1u)==0u){return;}
  let previous=sharedRays[index-1u];let intersection=lineIntersection(ray,previous);
  let previousIntersection=lineIntersection(previous,sharedRays[index-2u]);
  if(finite2(intersection)&&finite2(previousIntersection)&&
    distance(intersection,previousIntersection)<5.0*config.values[1].y){
    imagePoint(ray,previous,hit,intersection,true);}
}`;
  }
  return `
fn renderObserverNeighbor(index:u32,logicalIndex:u32){
  let ray=sharedRays[index];let hit=sharedHits[index];
  if((ray.flags&1u)==0u||(sharedRays[index-1u].flags&1u)==0u){return;}
  let previous=sharedRays[index-1u];let intersection=lineIntersection(ray,previous);
  let observed=observerPoint(ray,hit);if(observed.z<0.5){return;}
  var nearby=false;
  if((sharedRays[index-2u].flags&1u)!=0u){
    let old=lineIntersection(previous,sharedRays[index-2u]);
    nearby=finite2(intersection)&&finite2(old)&&
      distance(old,intersection)<5.0*config.values[1].y;}
  let extensionColor=encodeColor(config.values[8],ray,1.0);
  if(!nearby){if(logicalIndex>=2u){pushRay(observed.xy,
      ray.origin-observed.xy,extensionColor,config.values[13].zw,false);}
    return;}
  let rayPower=max(ray.powers.x+ray.powers.y,1e-30);
  let nearbyPower=0.5*(rayPower+previous.powers.x+previous.powers.y);
  let color=encodeColor(config.values[8],ray,nearbyPower/rayPower);
  let toward=dot(intersection-observed.xy,ray.origin-observed.xy)>=0.0;
  let away=distance(observed.xy,ray.origin)>sqrt(1e-5)*config.values[1].y;
  if(!toward||!away){pushRay(observed.xy,ray.origin-observed.xy,color,
    config.values[13].zw,false);return;}
  pushLine(observed.xy,intersection,color,config.values[13].zw);
  imagePoint(ray,previous,hit,intersection,false);
}`;
}

function extractTraceGeometry(code) {
  const start = code.indexOf('fn cross2');
  const end = code.indexOf('fn curvePositionTolerance');
  if (start < 0 || end < 0) throw new Error('Unexpected trace WGSL structure.');
  return code.slice(start, end) + extractTraceCurveHelpers(code);
}

function extractTraceCurveHelpers(code) {
  const start = code.indexOf('fn curvePositionTolerance');
  const end = code.indexOf('fn crossingBase');
  return code.slice(start, end);
}

function extractRenderHelpers(code, variant) {
  if (variant === 'none') return '';
  const start = code.indexOf('fn finite2');
  const lineStart = code.indexOf('fn lineIntersection');
  const observerStart = code.indexOf('fn observerPoint');
  const imageStart = code.indexOf('fn imagePoint');
  const end = code.indexOf('@compute');
  if ([start, lineStart, observerStart, imageStart, end].some(value =>
    value < 0)) throw new Error('Unexpected render WGSL structure.');
  let selected = code.slice(start, lineStart);
  if (variant === 'images') {
    selected += code.slice(lineStart, observerStart) + code.slice(imageStart, end);
  } else if (variant === 'observer') {
    selected += code.slice(lineStart, end);
  }
  return selected.replaceAll('geometry[index]', 'readyGeometry[index]');
}

function collectProgramCode(programs) {
  return [
    ...programs.bulks.flatMap(value => [value.nOnly.code, value.grin.code]),
    ...programs.surfaces.map(value => value.code),
    ...programs.detectors.map(value => value.code),
  ].join('\n');
}

function createBulkIndexCases(description, programs) {
  return programs.bulks.map((value, typeId) => {
    const args = bulkArguments(description.types.bulks[typeId].definition,
      value.nOnly);
    return `case ${typeId}u:{let output=${dagCall(value.nOnly, args)};
      return IndexResult(output[0].value,output[0].invalid);}`;
  }).join('\n');
}

function createBulkGrinCases(description, programs) {
  return programs.bulks.map((value, typeId) => {
    const program = value.grin;
    const args = bulkArguments(description.types.bulks[typeId].definition,
      program);
    const labels = new Map(program.labels.map((label, index) => [label, index]));
    const output = label => labels.has(label)
      ? `output[${labels.get(label)}]`
      : 'W(0.0,false)';
    return `case ${typeId}u:{let output=${dagCall(program, args)};
      let n=${output('n')};let nx=${output('n_x')};let ny=${output('n_y')};
      let alpha=${output('alpha')};return BulkResult(n.value,nx.value,ny.value,
        alpha.value,n.invalid||nx.invalid||ny.invalid||alpha.invalid);}`;
  }).join('\n');
}

function bulkArguments(definition, program) {
  return program.parameters.map(name => {
    if (name === 'x') return 'point.x';
    if (name === 'y') return 'point.y';
    if (name === 'lambda') return 'wavelength';
    return `instanceParameters[region.parameterOffset+${
      definition.paramNames.indexOf(name)}u]`;
  });
}

function createSurfaceCases(description, programs) {
  return programs.surfaces.map((program, typeId) => {
    const definition = description.types.surfaces[typeId].definition;
    const common = {
      d_0x: 'localDirection.x', d_0y: 'localDirection.y',
      P_0s: 'source.powers.x', P_0p: 'source.powers.y',
      lambda: 'source.wavelength', x: 'point.x', y: 'point.y',
      u: 'hit.u', sigma: 'hit.sigma', n_0: 'incidentIndex.n',
      n_1: 'transmittedIndex.n',
    };
    const args = program.parameters.map(name => common[name] ??
      `instanceParameters[surface.parameterOffset+${
        definition.paramNames.indexOf(name)}u]`);
    const indexes = new Map(program.labels.map((label, index) => [label, index]));
    const outputs = Array.from({ length: definition.outRayCount }, (_v, index) => {
      const n = index + 1;
      const dx = indexes.get(`d_${n}x`);
      const dy = indexes.get(`d_${n}y`);
      const ps = indexes.get(`P_${n}s`);
      const pp = indexes.get(`P_${n}p`);
      return `{
        let localOutput=vec2f(evaluated[${dx}].value,evaluated[${dy}].value);
        let direction=localOutput.x*localXAxis+localOutput.y*hit.normal;
        let powers=vec2f(evaluated[${ps}].value,evaluated[${pp}].value);
        let invalid=mediumInvalid||evaluated[${dx}].invalid||
          evaluated[${dy}].invalid||evaluated[${ps}].invalid||
          evaluated[${pp}].invalid;
        var child=makeChild(source,point,direction,powers);
        if(invalid){child=Ray(point,vec2f(0.0),vec2f(0.0),
          source.wavelength,2u);}
        let toggle=!invalid&&surfaceCrossesBoundary(curve,source,hit,direction);
        acceptChild(child,toggle,incident,front,back,continuation,nextMembership,
          &hasContinuation,logicalIndex,startRayCount,depth,slotCount,isDummy);
      }`;
    }).join('\n');
    return `case ${typeId}u:{let mediumInvalid=incidentIndex.invalid||
      transmittedIndex.invalid;let evaluated=${dagCall(program, args)};
      ${outputs}break;}`;
  }).join('\n');
}

function createDetectorCases(description, programs) {
  return programs.detectors.map((program, typeId) => {
    const definition = description.types.detectors[typeId].definition;
    const common = {
      d_0x: 'localDirection.x', d_0y: 'localDirection.y',
      P_0s: 'source.powers.x', P_0p: 'source.powers.y',
      lambda: 'source.wavelength', x: 'point.x', y: 'point.y',
      u: 'hit.u', sigma: 'hit.sigma',
    };
    const args = program.parameters.map(name => common[name] ??
      `instanceParameters[detector.parameterOffset+${
        definition.paramNames.indexOf(name)}u]`);
    const indexes = new Map(program.labels.map((label, index) => [label, index]));
    const writes = Array.from({ length: definition.writeCount }, (_v, index) =>
      `accumulateDetector(detector,evaluated[${indexes.get(`k_${index + 1}`)}],` +
      `evaluated[${indexes.get(`v_${index + 1}`)}]);`
    ).join('\n');
    return `case ${typeId}u:{let evaluated=${dagCall(program, args)};
      ${writes}break;}`;
  }).join('\n');
}

function dagCall(program, args) {
  return args.length === 0
    ? `${program.functionName}()`
    : `${program.functionName}(array<f32,${args.length}>(${args.join(',')}))`;
}

function wgslFloat(value) {
  return Number(value).toExponential(9);
}
