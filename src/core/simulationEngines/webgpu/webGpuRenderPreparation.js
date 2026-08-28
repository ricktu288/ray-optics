/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

const BUFFER_USAGE_COPY_SRC = 0x0004;
const BUFFER_USAGE_COPY_DST = 0x0008;
const BUFFER_USAGE_UNIFORM = 0x0040;
const BUFFER_USAGE_STORAGE = 0x0080;
const BUFFER_USAGE_INDIRECT = 0x0100;

export const WEBGPU_READY_GEOMETRY_STRIDE = 64;

export class WebGpuRenderPreparationStage {
  constructor(device, {
    rayBuffer,
    alternateRayBuffer,
    hitBuffer,
    runControl,
    dispatchIndirect,
    rayCapacity,
    geometryCapacity,
    workgroupSize,
  }) {
    this.device = device;
    this.rayBuffers = [rayBuffer, alternateRayBuffer];
    this.hitBuffer = hitBuffer;
    this.runControl = runControl;
    this.dispatchIndirect = dispatchIndirect;
    this.rayCapacity = rayCapacity;
    this.geometryCapacity = geometryCapacity;
    this.workgroupSize = workgroupSize;
    this.geometryBuffer = null;
    this.drawIndirectBuffer = null;
    this.uniformBuffer = null;
    this.pipeline = null;
    this.bindGroups = [];
  }

  async initialize() {
    this.geometryBuffer = this.device.createBuffer({
      label: 'WebGPU ready ray geometry',
      size: Math.max(1, this.geometryCapacity) *
        WEBGPU_READY_GEOMETRY_STRIDE,
      usage: BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_SRC |
        BUFFER_USAGE_COPY_DST,
    });
    this.drawIndirectBuffer = this.device.createBuffer({
      label: 'WebGPU ready geometry draw arguments',
      size: 16,
      usage: BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_DST |
        BUFFER_USAGE_INDIRECT,
    });
    this.device.queue.writeBuffer(
      this.drawIndirectBuffer,
      0,
      new Uint32Array([6, 0, 0, 0])
    );
    this.uniformBuffer = this.device.createBuffer({
      label: 'WebGPU render preparation uniforms',
      size: 16 * 16,
      usage: BUFFER_USAGE_UNIFORM | BUFFER_USAGE_COPY_DST,
    });
    const module = this.device.createShaderModule({
      label: 'WebGPU render preparation',
      code: createWebGpuRenderPreparationShader(this.workgroupSize),
    });
    await validateShaderModule(module, 'render preparation');
    this.pipeline = this.device.createComputePipelineAsync
      ? await this.device.createComputePipelineAsync({
        label: 'WebGPU render preparation',
        layout: 'auto',
        compute: { module, entryPoint: 'prepareMain' },
      })
      : this.device.createComputePipeline({
        label: 'WebGPU render preparation',
        layout: 'auto',
        compute: { module, entryPoint: 'prepareMain' },
      });
    const layout = this.pipeline.getBindGroupLayout(0);
    this.bindGroups = this.rayBuffers.map((buffer, direction) =>
      this.device.createBindGroup({
        label: `WebGPU render preparation bindings ${direction}`,
        layout,
        entries: [
          { binding: 0, resource: { buffer } },
          { binding: 1, resource: { buffer: this.hitBuffer } },
          { binding: 2, resource: { buffer: this.geometryBuffer } },
          { binding: 3, resource: { buffer: this.runControl } },
          { binding: 4, resource: { buffer: this.uniformBuffer } },
          { binding: 5, resource: { buffer: this.drawIndirectBuffer } },
        ],
      })
    );
  }

  configure(options) {
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      createRenderUniformData(options, this.geometryCapacity)
    );
  }

  encode(commandEncoder, direction) {
    const pass = commandEncoder.beginComputePass({
      label: 'WebGPU prepare render geometry',
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroups[direction]);
    pass.dispatchWorkgroupsIndirect(this.dispatchIndirect, 0);
    pass.end();
  }

  destroy() {
    this.geometryBuffer?.destroy?.();
    this.drawIndirectBuffer?.destroy?.();
    this.uniformBuffer?.destroy?.();
    this.geometryBuffer = null;
    this.drawIndirectBuffer = null;
    this.uniformBuffer = null;
    this.pipeline = null;
    this.bindGroups.length = 0;
  }
}

export function createRenderUniformData(options, geometryCapacity) {
  const rendering = options.rendering ?? {};
  const data = new Float32Array(16 * 4);
  const set = (slot, values) => data.set(values, slot * 4);
  set(0, [
    renderModeId(rendering.mode),
    rendering.simulateColors ? 1 : 0,
    rendering.showRayArrows ? 1 : 0,
    colorModeId(options.colorMode, rendering.simulateColors),
  ]);
  set(1, [
    options.viewport?.scale ?? 1,
    options.viewport?.lengthScale ?? 1,
    geometryCapacity,
    options.preparedScene.keepNonVisibleLight ? 1 : 0,
  ]);
  const observer = rendering.observer;
  set(2, [
    observer?.c?.x ?? 0,
    observer?.c?.y ?? 0,
    observer?.r ?? 0,
    observer ? 1 : 0,
  ]);
  const violet = options.preparedScene.violetWavelength ?? 420;
  const red = options.preparedScene.redWavelength ?? 620;
  const scale = (red - violet) / (620 - 420);
  const scaled = value => violet + (value - 420) * scale;
  set(3, [scaled(380), violet, scaled(460), scaled(500)]);
  set(4, [scaled(540), scaled(580), red, scaled(700)]);
  set(5, color(rendering.getThemeRayColor, 'ray'));
  set(6, color(rendering.getThemeRayColor, 'extendedRay'));
  set(7, color(rendering.getThemeRayColor, 'forwardExtendedRay'));
  set(8, color(rendering.getThemeRayColor, 'observedRay'));
  set(9, color(rendering.getThemeImageColor, 'realImage'));
  set(10, color(rendering.getThemeImageColor, 'virtualImage'));
  set(11, color(rendering.getThemeImageColor, 'virtualObject'));
  const rayDash = dash(rendering.getThemeRayDash,
    rendering.simulateColors ? 'colorRay' : 'ray');
  const extendedDash = dash(rendering.getThemeRayDash,
    rendering.simulateColors ? 'colorExtendedRay' : 'extendedRay');
  const forwardDash = dash(rendering.getThemeRayDash,
    rendering.simulateColors
      ? 'colorForwardExtendedRay'
      : 'forwardExtendedRay');
  const observedDash = dash(rendering.getThemeRayDash,
    rendering.simulateColors ? 'colorObservedRay' : 'observedRay');
  set(12, [...rayDash, ...extendedDash]);
  set(13, [...forwardDash, ...observedDash]);
  set(14, [
    size(rendering.getThemeImageSize,
      rendering.simulateColors ? 'colorRealImage' : 'realImage'),
    size(rendering.getThemeImageSize,
      rendering.simulateColors ? 'colorVirtualImage' : 'virtualImage'),
    size(rendering.getThemeImageSize,
      rendering.simulateColors ? 'colorVirtualObject' : 'virtualObject'),
    0,
  ]);
  return data;
}

function color(callback, name) {
  const value = callback?.(name, 1) ?? [1, 1, 1, 1];
  return [value[0] ?? 1, value[1] ?? 1, value[2] ?? 1, value[3] ?? 1];
}

function dash(callback, name) {
  const value = callback?.(name) ?? [];
  return [value[0] ?? 0, value[1] ?? 0];
}

function size(callback, name) {
  return callback?.(name) ?? 5;
}

function renderModeId(mode) {
  if (mode === 'extended') return 1;
  if (mode === 'images') return 2;
  if (mode === 'observer') return 3;
  return 0;
}

function colorModeId(mode, simulateColors) {
  if (mode === 'default' && simulateColors) return 5;
  if (mode === 'linear') return 1;
  if (mode === 'linearRGB') return 2;
  if (mode === 'reinhard') return 3;
  if (mode === 'colorizedIntensity') return 4;
  return 0;
}

export function createWebGpuRenderPreparationShader(workgroupSize) {
  return `
const F32_MAX:f32=3.402823e38;
struct Ray { origin:vec2f,direction:vec2f,powers:vec2f,
  wavelength:f32,flags:u32 };
struct Hit { s:f32,u:f32,point:vec2f,normal:vec2f,curveId:i32,sigma:f32,
  conflict:u32,interactionType:u32 };
struct ReadyGeometry { p0p1:vec4f,color:vec4f,style:vec4f,extra:vec4f };
struct Config { values:array<vec4f,16> };
@group(0) @binding(0) var<storage,read> rays:array<Ray>;
@group(0) @binding(1) var<storage,read> hits:array<Hit>;
@group(0) @binding(2) var<storage,read_write> geometry:array<ReadyGeometry>;
@group(0) @binding(3) var<storage,read_write> control:array<atomic<u32>>;
@group(0) @binding(4) var<uniform> config:Config;
@group(0) @binding(5) var<storage,read_write> drawArguments:array<atomic<u32>>;

fn finite2(value:vec2f)->bool {
  return all(value==value)&&all(abs(value)<vec2f(F32_MAX*0.5));
}
fn spectralColor(wavelength:f32)->vec3f {
  let a=config.values[3]; let b=config.values[4]; var rgb=vec3f(0.0);
  let keepNonVisibleLight=config.values[1].w>0.5;
  if((keepNonVisibleLight&&wavelength<a.y)||
    (wavelength>=a.x&&wavelength<a.y)){rgb=vec3f(0.5,0.0,1.0);}
  else if(wavelength>=a.y&&wavelength<a.z){
    rgb=vec3f(-0.5*(wavelength-a.z)/(a.z-a.y),0.0,1.0);}
  else if(wavelength>=a.z&&wavelength<a.w){
    rgb=vec3f(0.0,(wavelength-a.z)/(a.w-a.z),1.0);}
  else if(wavelength>=a.w&&wavelength<b.x){
    rgb=vec3f(0.0,1.0,-(wavelength-b.x)/(b.x-a.w));}
  else if(wavelength>=b.x&&wavelength<b.y){
    rgb=vec3f((wavelength-b.x)/(b.y-b.x),1.0,0.0);}
  else if(wavelength>=b.y&&wavelength<b.z){
    rgb=vec3f(1.0,-(wavelength-b.z)/(b.z-b.y),0.0);}
  else if(wavelength>=b.z&&(keepNonVisibleLight||wavelength<=b.w)){
    rgb=vec3f(1.0,0.0,0.0);}
  let fadeLimit=select(0.0,0.25,keepNonVisibleLight);
  var intensity=1.0;
  if(wavelength>b.w||wavelength<a.x){intensity=fadeLimit;}
  else if(wavelength>b.z){
    intensity=select((b.w-wavelength)/(b.w-b.z),
      1.0-(1.0-fadeLimit)*(wavelength-b.z)/(b.w-b.z),
      keepNonVisibleLight);}
  else if(wavelength<a.y){
    intensity=select((wavelength-a.x)/(a.y-a.x),
      1.0-(1.0-fadeLimit)*(a.y-wavelength)/(a.y-a.x),
      keepNonVisibleLight);}
  return rgb*intensity;
}
fn encodeColor(theme:vec4f,ray:Ray,powerScale:f32)->vec4f {
  let power=(ray.powers.x+ray.powers.y)*powerScale;
  let simulate=config.values[0].y>0.5;
  let mode=u32(config.values[0].w);
  let raw=select(theme.rgb,spectralColor(ray.wavelength),simulate)*power;
  if(mode==5u){return vec4f(raw,1.0);}
  if(mode==0u){
    let alpha=clamp(power,0.0,1.0-1e-7);
    let density=-log(1.0-alpha);
    return vec4f(theme.rgb*density,density);
  }
  let maximum=max(max(raw.r,raw.g),raw.b);
  if(!(maximum>0.0)){return vec4f(0.0);}
  if(mode==4u){return vec4f(maximum,maximum,maximum,1.0);}
  let gamma=pow(max(raw,vec3f(0.0)),vec3f(2.2));
  return vec4f(gamma*maximum/max(max(gamma.r,gamma.g),gamma.b),1.0);
}
fn pushRecord(p0:vec2f,p1:vec2f,color:vec4f,width:f32,dash:vec2f,
              kind:f32,pointSize:f32,endWidth:f32){
  let index=atomicAdd(&control[6],1u);
  let capacity=u32(config.values[1].z);
  if(index>=capacity){atomicStore(&control[19],1u);return;}
  geometry[index]=ReadyGeometry(vec4f(p0,p1),color,
    vec4f(max(0.0,width),dash,max(0.0,endWidth)),
    vec4f(kind,pointSize,0.0,0.0));
  atomicAdd(&drawArguments[1],1u);
}
fn pushLine(p0:vec2f,p1:vec2f,color:vec4f,dash:vec2f){
  pushRecord(p0,p1,color,config.values[1].y*config.values[1].x,
    dash*(config.values[1].y*config.values[1].x),0.0,0.0,
    config.values[1].y*config.values[1].x);
}
fn pushRay(p0:vec2f,direction:vec2f,color:vec4f,dash:vec2f,arrows:bool){
  let unit=normalize(direction);
  let end=p0+unit*(2e6/max(config.values[1].x,1e-12));
  let arrowSize=5.0*config.values[1].y;
  let baseWidth=config.values[1].y;
  if(!arrows||arrowSize<baseWidth*1.2){pushLine(p0,end,color,dash);return;}
  let front=p0+unit*(150.0*config.values[1].y);
  let back=front+unit*arrowSize;
  pushLine(p0,front,color,dash);
  pushRecord(front,back,color,arrowSize*config.values[1].x,vec2f(0.0),
    2.0,0.0,baseWidth*config.values[1].x);
  pushLine(back,end,color,dash);
}
fn pushVisibleSegment(p0:vec2f,p1:vec2f,color:vec4f,dash:vec2f,
                      arrows:bool){
  let delta=p1-p0;let lengthValue=length(delta);
  if(!(lengthValue>0.0)){return;}
  let arrowSize=min(lengthValue*0.15,5.0*config.values[1].y);
  let baseWidth=config.values[1].y;
  if(!arrows||arrowSize<baseWidth*1.2){pushLine(p0,p1,color,dash);return;}
  let unit=delta/lengthValue;let center=p0+delta*0.67;
  let front=center-unit*arrowSize*0.5;let back=center+unit*arrowSize*0.5;
  pushLine(p0,front,color,dash);
  pushRecord(front,back,color,arrowSize*config.values[1].x,vec2f(0.0),
    2.0,0.0,baseWidth*config.values[1].x);
  pushLine(back,p1,color,dash);
}
fn lineIntersection(a:Ray,b:Ray)->vec2f {
  let denominator=a.direction.x*b.direction.y-b.direction.x*a.direction.y;
  if(abs(denominator)<1e-20){return vec2f(F32_MAX);}
  let offset=b.origin-a.origin;
  let t=(offset.x*b.direction.y-offset.y*b.direction.x)/denominator;
  return a.origin+t*a.direction;
}
fn observerPoint(ray:Ray,hit:Hit)->vec3f {
  let observer=config.values[2];let d=normalize(ray.direction);
  let projected=dot(observer.xy-ray.origin,d);
  let perpendicular=ray.origin+d*projected-observer.xy;
  let inside=observer.z*observer.z-dot(perpendicular,perpendicular);
  if(inside<0.0){return vec3f(0.0);}
  let t=projected-sqrt(inside);
  let finiteEnd=hit.s<F32_MAX*0.5;
  var segmentLength=hit.s*length(ray.direction);
  if(hit.curveId>=0){segmentLength=distance(ray.origin,hit.point);}
  let onRay=t>=0.0&&(!finiteEnd||t<=segmentLength);
  return vec3f(ray.origin+d*t,select(0.0,1.0,onRay));
}
fn imagePoint(ray:Ray,previous:Ray,hit:Hit,intersection:vec2f,
              includeVirtualObject:bool){
  let imageVector=intersection-ray.origin;
  var endVector=ray.direction;
  if(hit.s<F32_MAX*0.5){
    endVector=select(hit.s*ray.direction,hit.point-ray.origin,hit.curveId>=0);
  }
  let position=dot(imageVector,endVector);
  let segmentLengthSquared=select(F32_MAX,dot(endVector,endVector),
    hit.s<F32_MAX*0.5);
  var theme=config.values[11];var size=config.values[14].z;
  if(position<0.0){theme=config.values[10];size=config.values[14].y;}
  else if(position<segmentLengthSquared){
    theme=config.values[9];size=config.values[14].x;
  }else if(!includeVirtualObject){return;}
  let nearbyPower=select(
    0.5*((ray.powers.x+ray.powers.y)+(previous.powers.x+previous.powers.y)),
    0.5*(ray.powers.x+ray.powers.y),config.values[0].y>0.5);
  var color=encodeColor(theme,ray,nearbyPower/
    max(ray.powers.x+ray.powers.y,1e-30));
  pushRecord(intersection,intersection,color,1.0,vec2f(0.0),1.0,
    size*config.values[1].y*config.values[1].x,1.0);
}
@compute @workgroup_size(${workgroupSize})
fn prepareMain(@builtin(global_invocation_id) invocation:vec3u){
  let rayIndex=invocation.x;let count=atomicLoad(&control[0]);
  if(rayIndex>=count){return;} let ray=rays[rayIndex];let hit=hits[rayIndex];
  if((ray.flags&1u)==0u||!(hit.s>0.0)){return;}
  let mode=u32(config.values[0].x);let finiteEnd=hit.s<F32_MAX*0.5;
  var end=hit.point;if(hit.curveId<0){end=ray.origin+hit.s*ray.direction;}
  if(mode<=1u){
    let color=encodeColor(config.values[5],ray,1.0);
    let dash=config.values[12].xy;
    if(finiteEnd){pushVisibleSegment(ray.origin,end,color,dash,
      config.values[0].z>0.5);}
    else{pushRay(ray.origin,ray.direction,color,dash,
      config.values[0].z>0.5);}
    if(mode==1u&&atomicLoad(&control[11])>0u){
      pushRay(ray.origin,-ray.direction,encodeColor(config.values[6],ray,1.0),
        config.values[12].zw,false);
      if(finiteEnd){pushRay(end,ray.direction,
        encodeColor(config.values[7],ray,1.0),config.values[13].xy,false);}
    }
    return;
  }
  if(rayIndex<1u||(ray.flags&4u)!=0u||
      (rays[rayIndex-1u].flags&1u)==0u){return;}
  let previous=rays[rayIndex-1u];
  let intersection=lineIntersection(ray,previous);
  var nearby=false;
  if(rayIndex>=2u&&(previous.flags&4u)==0u&&
      (rays[rayIndex-2u].flags&1u)!=0u){
    let previousIntersection=lineIntersection(previous,rays[rayIndex-2u]);
    nearby=finite2(intersection)&&finite2(previousIntersection)&&
      dot(previousIntersection-intersection,previousIntersection-intersection)<
      25.0*config.values[1].y*config.values[1].y;
  }
  if(mode==2u){if(nearby){imagePoint(ray,previous,hit,intersection,true);}return;}
  if(config.values[2].w<0.5){return;}
  let observed=observerPoint(ray,hit);if(observed.z<0.5){return;}
  let extensionColor=encodeColor(config.values[8],ray,1.0);
  if(!nearby){
    if(rayIndex>=2u){pushRay(observed.xy,ray.origin-observed.xy,extensionColor,
      config.values[13].zw,false);} return;
  }
  let rayPower=max(ray.powers.x+ray.powers.y,1e-30);
  let nearbyPower=0.5*(rayPower+previous.powers.x+previous.powers.y);
  let observedColor=encodeColor(config.values[8],ray,nearbyPower/rayPower);
  let toward=dot(intersection-observed.xy,ray.origin-observed.xy)>=0.0;
  let away=dot(observed.xy-ray.origin,observed.xy-ray.origin)>
    1e-5*config.values[1].y*config.values[1].y;
  if(!toward||!away){pushRay(observed.xy,ray.origin-observed.xy,observedColor,
    config.values[13].zw,false);return;}
  imagePoint(ray,previous,hit,intersection,false);
  pushLine(observed.xy,intersection,observedColor,config.values[13].zw);
}`;
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
