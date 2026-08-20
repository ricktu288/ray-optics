/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import CanvasRenderer from '../../CanvasRenderer.js';

const BUFFER_USAGE_COPY_DST = 0x0008;
const BUFFER_USAGE_UNIFORM = 0x0040;
const BUFFER_USAGE_STORAGE = 0x0080;
const TEXTURE_USAGE_RENDER_ATTACHMENT = 0x0010;
const FIXED_POINT_SCALE = 1048576;
const FLOATS_PER_RECORD = 16;

const RASTER_WGSL = `
struct Uniforms {
  viewport: vec4f,
  sizeAndCount: vec4f,
};

struct ReadyGeometry {
  p0p1: vec4f,
  color: vec4f,
  style: vec4f,
  extra: vec4f,
};

struct Pixel {
  r: atomic<u32>,
  g: atomic<u32>,
  b: atomic<u32>,
  overflow: atomic<u32>,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(flat) screenP0: vec2f,
  @location(1) @interpolate(flat) screenP1: vec2f,
  @location(2) @interpolate(flat) color: vec4f,
  @location(3) @interpolate(flat) style: vec4f,
  @location(4) @interpolate(flat) extra: vec2f,
};

struct FragmentInput {
  @location(0) @interpolate(flat) screenP0: vec2f,
  @location(1) @interpolate(flat) screenP1: vec2f,
  @location(2) @interpolate(flat) color: vec4f,
  @location(3) @interpolate(flat) style: vec4f,
  @location(4) @interpolate(flat) extra: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> geometry: array<ReadyGeometry>;
@group(0) @binding(2) var<storage, read_write> pixels: array<Pixel>;

fn toScreen(point: vec2f) -> vec2f {
  return point * uniforms.viewport.z + uniforms.viewport.xy;
}

fn toClip(point: vec2f) -> vec4f {
  let size = uniforms.sizeAndCount.xy;
  return vec4f(point.x / size.x * 2.0 - 1.0,
               1.0 - point.y / size.y * 2.0, 0.0, 1.0);
}

@vertex
fn vertexMain(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let item = geometry[instanceIndex];
  let p0 = toScreen(item.p0p1.xy);
  let p1 = toScreen(item.p0p1.zw);
  let geometryKind = item.extra.x;
  let isPoint = geometryKind > 0.5 && geometryKind < 1.5;
  var position: vec2f;
  if (isPoint) {
    let corner = array<vec2f, 6>(
      vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
      vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0)
    )[vertexIndex];
    // Keep a half-pixel fringe around subpixel points so the fragment shader
    // can integrate their fractional coverage instead of center-sampling them
    // into either zero or one whole pixel.
    position = p0 + corner * (0.5 * (item.extra.y + 1.0));
  } else {
    let delta = p1 - p0;
    let length = max(length(delta), 1e-20);
    let direction = delta / length;
    let side = vec2f(-direction.y, direction.x);
    let endIndex = select(0.0, 1.0,
      vertexIndex == 1u || vertexIndex == 2u || vertexIndex == 4u);
    let sideSign = select(-1.0, 1.0,
      vertexIndex == 2u || vertexIndex == 4u || vertexIndex == 5u);
    var halfWidth = 0.5 * item.style.x + 1.0;
    if (geometryKind > 1.5) {
      let sideSlope = 0.5 * (item.style.w - item.style.x) / length;
      let sideExpansion = sqrt(1.0 + sideSlope * sideSlope);
      halfWidth = 0.5 * mix(item.style.x, item.style.w, endIndex) +
        sideExpansion;
    }
    position = mix(p0, p1, endIndex) + side * sideSign * halfWidth;
  }
  var output: VertexOutput;
  output.position = toClip(position);
  output.screenP0 = p0;
  output.screenP1 = p1;
  output.color = item.color;
  output.style = item.style;
  output.extra = item.extra.xy;
  return output;
}

@fragment
fn fragmentMain(input: FragmentInput,
                @builtin(position) frag: vec4f) -> @location(0) vec4f {
  let size = vec2u(uniforms.sizeAndCount.xy);
  let pixelCoord = vec2u(frag.xy);
  if (pixelCoord.x >= size.x || pixelCoord.y >= size.y) { discard; }
  var coverage = 1.0;
  let colorMode = u32(uniforms.sizeAndCount.w);
  let geometryKind = input.extra.x;
  if (geometryKind > 0.5 && geometryKind < 1.5) {
    let pointSize = max(input.extra.y, 0.0);
    let relative = frag.xy - input.screenP0;
    if (colorMode == 4u) {
      coverage = select(0.0, 1.0,
        abs(relative.x) <= 0.5 * pointSize &&
        abs(relative.y) <= 0.5 * pointSize);
    } else {
      let maximumCoverage = min(1.0, pointSize);
      let xCoverage = clamp(
        0.5 * pointSize + 0.5 - abs(relative.x),
        0.0, maximumCoverage);
      let yCoverage = clamp(
        0.5 * pointSize + 0.5 - abs(relative.y),
        0.0, maximumCoverage);
      coverage = xCoverage * yCoverage;
    }
  } else {
    let delta = input.screenP1 - input.screenP0;
    let lineLength = max(length(delta), 1e-20);
    let direction = delta / lineLength;
    let relative = frag.xy - input.screenP0;
    let signedSide = dot(relative, vec2f(-direction.y, direction.x));
    // Analytic AA is intentionally only applied to the two longitudinal
    // sides.  Segment and arrow ends remain hard, matching the GPU contract.
    if (geometryKind > 1.5) {
      let along = dot(relative, direction);
      if (along < 0.0 || along > lineLength) { discard; }
      let sideSlope = 0.5 * (input.style.w - input.style.x) / lineLength;
      let halfWidth = 0.5 * mix(
        input.style.x, input.style.w, along / lineLength
      );
      let sideExpansion = sqrt(1.0 + sideSlope * sideSlope);
      let signedDistance = (abs(signedSide) - halfWidth) / sideExpansion;
      let maximumCoverage = min(
        1.0, max(0.0, 2.0 * halfWidth / sideExpansion));
      coverage = clamp(
        0.5 - signedDistance, 0.0, maximumCoverage);
    } else {
      let maximumCoverage = min(1.0, max(input.style.x, 0.0));
      coverage = clamp(
        0.5 * input.style.x + 0.5 - abs(signedSide),
        0.0, maximumCoverage
      );
    }
    if (colorMode == 4u) {
      // Colorized intensity is a measurement view rather than translucent
      // light.  Keep its two longitudinal edges hard.
      coverage = select(0.0, 1.0, coverage >= 0.5);
    }
    let dashOn = input.style.y;
    let dashOff = input.style.z;
    if (geometryKind < 0.5 && dashOn > 0.0 && dashOff > 0.0) {
      let along = clamp(dot(relative, direction), 0.0, lineLength);
      let period = dashOn + dashOff;
      let withinDash = along - floor(along / period) * period;
      if (colorMode == 4u) {
        if (withinDash >= dashOn) { discard; }
      } else {
        var signedDashDistance: f32;
        if (withinDash <= dashOn) {
          signedDashDistance = -min(withinDash, dashOn - withinDash);
        } else {
          signedDashDistance = min(
            withinDash - dashOn, period - withinDash);
        }
        let maximumDashCoverage = min(1.0, dashOn);
        coverage *= clamp(
          0.5 - signedDashDistance, 0.0, maximumDashCoverage);
      }
    }
  }
  if (coverage <= 0.0) { discard; }
  var value: vec3f;
  if (colorMode == 0u) {
    // Legacy theme colors are accumulated as optical density.  Applying
    // coverage directly to density would produce 1-(1-alpha)^coverage rather
    // than the canvas-like alpha*coverage edge.  Convert back to alpha,
    // apply coverage, and return to density before the atomic addition.
    let density = input.color.a;
    let alpha = 1.0 - exp(-density);
    let coveredDensity = -log(max(1.0 - alpha * coverage, 1e-7));
    let hue = select(vec3f(0.0), input.color.rgb / density, density > 0.0);
    value = hue * coveredDensity;
  } else if (colorMode == 5u) {
    // Canvas rasterization stores geometric coverage in pixel alpha.  Its
    // simulated-color post-pass then multiplies the recovered linear
    // wavelength intensity by that alpha.  Apply coverage in linear space to
    // match an isolated Canvas ray, including subpixel-width rays.
    value = input.color.rgb * coverage;
  } else {
    value = input.color.rgb * coverage;
  }
  value = max(value, vec3f(0.0));
  let amountf = round(min(value * ${FIXED_POINT_SCALE}.0,
                          vec3f(4294967040.0)));
  let amounts = vec3u(u32(amountf.r), u32(amountf.g), u32(amountf.b));
  let index = pixelCoord.y * size.x + pixelCoord.x;
  if (amounts.r > 0u) {
    let old = atomicAdd(&pixels[index].r, amounts.r);
    if (old > 4294967295u - amounts.r) {
      atomicStore(&pixels[index].overflow, 1u);
    }
  }
  if (amounts.g > 0u) {
    let old = atomicAdd(&pixels[index].g, amounts.g);
    if (old > 4294967295u - amounts.g) {
      atomicStore(&pixels[index].overflow, 1u);
    }
  }
  if (amounts.b > 0u) {
    let old = atomicAdd(&pixels[index].b, amounts.b);
    if (old > 4294967295u - amounts.b) {
      atomicStore(&pixels[index].overflow, 1u);
    }
  }
  return vec4f(0.0);
}
`;

const PRESENT_WGSL = `
struct Uniforms {
  viewport: vec4f,
  sizeAndCount: vec4f,
};
struct PresentOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> pixelWords: array<u32>;

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> PresentOutput {
  let positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var output: PresentOutput;
  output.position = vec4f(positions[index], 0.0, 1.0);
  output.uv = positions[index] * vec2f(0.5, -0.5) + vec2f(0.5);
  return output;
}

fn brightnessToColor(brightness: f32) -> vec4f {
  if (brightness > 100.0) {
    return vec4f(1.0, 0.0, 0.0, 1.0);
  }
  if (brightness > 10.0) {
    let t = (log2(brightness) - log2(10.0)) /
            (log2(100.0) - log2(10.0));
    return vec4f(mix(vec3f(1.0, 0.5, 0.0), vec3f(1.0, 0.0, 0.0), t), 1.0);
  }
  if (brightness > 1.0) {
    let t = (log2(brightness) - log2(1.0)) /
            (log2(10.0) - log2(1.0));
    return vec4f(mix(vec3f(1.0, 1.0, 0.0), vec3f(1.0, 0.5, 0.0), t), 1.0);
  }
  if (brightness > 0.1) {
    let t = (log2(brightness) - log2(0.1)) /
            (log2(1.0) - log2(0.1));
    return vec4f(mix(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 1.0, 0.0), t), 1.0);
  }
  if (brightness > 0.01) {
    let t = (log2(brightness) - log2(0.01)) /
            (log2(0.1) - log2(0.01));
    return vec4f(mix(vec3f(0.0, 1.0, 1.0), vec3f(0.0, 1.0, 0.0), t), 1.0);
  }
  if (brightness > 0.001) {
    let t = (log2(brightness) - log2(0.001)) /
            (log2(0.01) - log2(0.001));
    return vec4f(mix(vec3f(0.0, 0.0, 1.0), vec3f(0.0, 1.0, 1.0), t), 1.0);
  }
  if (brightness > 0.0001) {
    let t = (log2(brightness) - log2(0.0001)) /
            (log2(0.001) - log2(0.0001));
    return vec4f(mix(vec3f(0.3, 0.0, 0.3), vec3f(0.0, 0.0, 1.0), t), 1.0);
  }
  let t = (log2(max(brightness, 1e-7)) - log2(1e-7)) /
          (log2(0.0001) - log2(1e-7));
  return vec4f(mix(vec3f(0.0), vec3f(0.3, 0.0, 0.3), t), t);
}

fn toneMapAdditive(color: vec3f, mode: u32) -> vec4f {
  if (mode == 0u) {
    // Default/legacy colors are accumulated as optical density.  This is
    // exactly source-over/screen for a single color and intentionally only an
    // approximation when differently colored theme rays overlap.
    let density = max(max(color.r, color.g), color.b);
    let opacity = 1.0 - exp(-density);
    let mapped = select(vec3f(0.0), color / density * opacity, density > 0.0);
    return vec4f(mapped, clamp(opacity, 0.0, 1.0));
  }
  if (mode == 5u) {
    // Simulated wavelengths accumulate optical density per channel.  Match
    // CanvasRenderer.applyColorTransformation by storing the normalized hue
    // in RGB and the largest channel density in alpha.  Unlike Canvas, this
    // path avoids the intermediate u8 quantization.
    let factor = max(max(color.r, color.g), color.b);
    let opacity = clamp(factor, 0.0, 1.0);
    let mapped = select(vec3f(0.0), color / factor * opacity, factor > 0.0);
    return vec4f(mapped, opacity);
  }
  if (mode == 3u) {
    let luminance = dot(color, vec3f(0.2126, 0.7152, 0.0722));
    // This is algebraically the Reinhard luminance ratio, but unlike
    // (luminance / (1 + luminance)) / luminance it is defined at black.
    let rgb = pow(color / (1.0 + luminance), vec3f(1.0 / 2.2));
    let maximum = max(max(color.r, color.g), color.b);
    return vec4f(rgb, pow(maximum, 1.0 / 2.2));
  }
  if (mode == 4u) {
    let brightness = max(max(color.r, color.g), color.b);
    let mapped = brightnessToColor(brightness);
    return vec4f(mapped.rgb * 0.8, 0.0);
  }
  var value = max(color, vec3f(0.0));
  let maximum = max(max(value.r, value.g), value.b);
  if (mode == 1u) {
    if (maximum > 1.0) { value /= maximum; }
    return vec4f(pow(value, vec3f(1.0 / 2.2)),
                 pow(min(maximum, 1.0), 1.0 / 2.2));
  }
  return vec4f(pow(value, vec3f(1.0 / 2.2)),
               pow(maximum, 1.0 / 2.2));
}

@fragment
fn fragmentMain(input: PresentOutput) -> @location(0) vec4f {
  let size = vec2u(uniforms.sizeAndCount.xy);
  let coord = min(vec2u(input.uv * vec2f(size)), size - vec2u(1u));
  let index = coord.y * size.x + coord.x;
  let base = index * 4u;
  if (pixelWords[base + 3u] != 0u) {
    return vec4f(1.0);
  }
  let raw = vec3u(pixelWords[base], pixelWords[base + 1u],
                  pixelWords[base + 2u]);
  let color = vec3f(raw) / ${FIXED_POINT_SCALE}.0;
  let mode = u32(uniforms.sizeAndCount.w);
  return toneMapAdditive(color, mode);
}
`;

/**
 * Backend-neutral ready-geometry sink.  The CPU primitive event loop writes
 * the same lines and image points that the GPU pre-render pass will eventually
 * write.  In Node it delegates to CanvasRenderer; in browsers it retains
 * packed records for the raster-atomic passes below.
 */
export class WebGpuReadyRayRenderer {
  constructor({ ctx = null, origin, scale, lengthScale }) {
    this.origin = origin;
    this.scale = scale;
    this.lengthScale = lengthScale;
    this.canvasRenderer = ctx
      ? new CanvasRenderer(ctx, origin, scale, lengthScale, null, null)
      : null;
    this.records = [];
    this.flushedRecordCount = 0;
  }

  drawPoint(point, color = [1, 1, 1, 1], size = 5) {
    if (this.canvasRenderer) {
      this.canvasRenderer.drawPoint(point, color, size);
      return;
    }
    this.records.push(createRecord(
      point, point, color, 0, [], 'point',
      size * this.lengthScale * this.scale
    ));
  }

  drawLine(line, color, showArrow, dash, width = 1) {
    if (this.canvasRenderer) {
      this.canvasRenderer.drawLine(line, color, showArrow, dash, width);
      return;
    }
    const directionX = line.p2.x - line.p1.x;
    const directionY = line.p2.y - line.p1.y;
    const magnitude = Math.hypot(directionX, directionY);
    if (!(magnitude > 0)) return;
    const extent = 2 * (Math.abs(line.p1.x) + Math.abs(line.p1.y) + 1e6);
    const unitX = directionX / magnitude;
    const unitY = directionY / magnitude;
    this.pushSegment(
      { x: line.p1.x - unitX * extent, y: line.p1.y - unitY * extent },
      { x: line.p1.x + unitX * extent, y: line.p1.y + unitY * extent },
      color, dash, width
    );
  }

  drawRay(ray, color, showArrow, dash, width = 1) {
    if (this.canvasRenderer) {
      this.canvasRenderer.drawRay(ray, color, showArrow, dash, width);
      return;
    }
    const dx = ray.p2.x - ray.p1.x;
    const dy = ray.p2.y - ray.p1.y;
    const magnitude = Math.hypot(dx, dy);
    if (!(magnitude > 0)) return;
    const extent = 2e6 / Math.max(this.scale, 1e-12);
    const unitX = dx / magnitude;
    const unitY = dy / magnitude;
    const end = {
      x: ray.p1.x + dx / magnitude * extent,
      y: ray.p1.y + dy / magnitude * extent
    };
    const arrowSize = 5 * this.lengthScale;
    const baseWidth = width * this.lengthScale;
    if (!showArrow || arrowSize < baseWidth * 1.2) {
      this.pushSegment(ray.p1, end, color, dash, width);
      return;
    }
    const arrowDistance = 150 * this.lengthScale;
    const arrowFront = {
      x: ray.p1.x + unitX * arrowDistance,
      y: ray.p1.y + unitY * arrowDistance,
    };
    const arrowBack = {
      x: arrowFront.x + unitX * arrowSize,
      y: arrowFront.y + unitY * arrowSize,
    };
    this.pushSegment(ray.p1, arrowFront, color, dash, width);
    this.pushArrow(
      arrowFront, arrowBack, color, arrowSize, baseWidth
    );
    this.pushSegment(arrowBack, end, color, dash, width);
  }

  drawSegment(segment, color, showArrow, dash, width = 1) {
    if (this.canvasRenderer) {
      this.canvasRenderer.drawSegment(segment, color, showArrow, dash, width);
      return;
    }
    const dx = segment.p2.x - segment.p1.x;
    const dy = segment.p2.y - segment.p1.y;
    const length = Math.hypot(dx, dy);
    if (!(length > 0)) return;
    const arrowSize = Math.min(length * 0.15, 5 * this.lengthScale);
    const baseWidth = width * this.lengthScale;
    if (!showArrow || arrowSize < baseWidth * 1.2) {
      this.pushSegment(segment.p1, segment.p2, color, dash, width);
      return;
    }
    const unitX = dx / length;
    const unitY = dy / length;
    const arrowCenter = {
      x: segment.p1.x + dx * 0.67,
      y: segment.p1.y + dy * 0.67,
    };
    const arrowFront = {
      x: arrowCenter.x - unitX * arrowSize * 0.5,
      y: arrowCenter.y - unitY * arrowSize * 0.5,
    };
    const arrowBack = {
      x: arrowCenter.x + unitX * arrowSize * 0.5,
      y: arrowCenter.y + unitY * arrowSize * 0.5,
    };
    this.pushSegment(segment.p1, arrowFront, color, dash, width);
    this.pushArrow(
      arrowFront, arrowBack, color, arrowSize, baseWidth
    );
    this.pushSegment(arrowBack, segment.p2, color, dash, width);
  }

  pushSegment(p0, p1, color, dash, width) {
    this.records.push(createRecord(
      p0, p1, color,
      width * this.lengthScale * this.scale,
      (dash ?? []).map(value => value * this.lengthScale * this.scale),
      'line', 0
    ));
  }

  pushArrow(front, back, color, frontWidth, backWidth) {
    this.records.push(createRecord(
      front,
      back,
      color,
      frontWidth * this.scale,
      [],
      'arrow',
      0,
      backWidth * this.scale
    ));
  }

  applyColorTransformation() {}
  flush() {}
  destroy() {
    this.records.length = 0;
    this.canvasRenderer = null;
  }

  takeNewRecords() {
    const records = this.records.slice(this.flushedRecordCount);
    this.flushedRecordCount = this.records.length;
    return records;
  }
}

export class WebGpuAtomicRayRasterizer {
  constructor(device, output) {
    this.device = device;
    this.output = output;
    this.width = 0;
    this.height = 0;
    this.pixelBuffer = null;
    this.uniformBuffer = null;
    this.geometryBuffer = null;
    this.geometryCapacity = 0;
    this.bindGroup = null;
    this.presentBindGroup = null;
    this.dummyTexture = null;
    this.dummyView = null;
    this.rasterPipeline = null;
    this.presentPipeline = null;
  }

  async initialize() {
    this.device.pushErrorScope?.('validation');
    const rasterModule = this.device.createShaderModule({ code: RASTER_WGSL });
    const presentModule = this.device.createShaderModule({ code: PRESENT_WGSL });
    try {
      await validateShaderModule(rasterModule, 'raster-atomic');
      await validateShaderModule(presentModule, 'tone-map');
      const createPipeline = descriptor =>
        this.device.createRenderPipelineAsync
          ? this.device.createRenderPipelineAsync(descriptor)
          : Promise.resolve(this.device.createRenderPipeline(descriptor));
      this.rasterPipeline = await createPipeline({
        layout: 'auto',
        vertex: { module: rasterModule, entryPoint: 'vertexMain' },
        fragment: {
          module: rasterModule,
          entryPoint: 'fragmentMain',
          targets: [{ format: this.output.format, writeMask: 0 }],
        },
        primitive: { topology: 'triangle-list' },
      });
      this.presentPipeline = await createPipeline({
        layout: 'auto',
        vertex: { module: presentModule, entryPoint: 'vertexMain' },
        fragment: {
          module: presentModule,
          entryPoint: 'fragmentMain',
          targets: [{ format: this.output.format }],
        },
        primitive: { topology: 'triangle-list' },
      });
    } finally {
      const validationError = await this.device.popErrorScope?.();
      if (validationError) throw validationError;
    }
  }

  ensureSize(width, height) {
    width = Math.max(1, Math.trunc(width));
    height = Math.max(1, Math.trunc(height));
    if (width === this.width && height === this.height && this.pixelBuffer) {
      return;
    }
    this.width = width;
    this.height = height;
    this.pixelBuffer?.destroy?.();
    this.uniformBuffer?.destroy?.();
    this.dummyTexture?.destroy?.();
    this.pixelBuffer = this.device.createBuffer({
      size: width * height * 16,
      usage: BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_DST,
    });
    this.uniformBuffer = this.device.createBuffer({
      size: 32,
      usage: BUFFER_USAGE_UNIFORM | BUFFER_USAGE_COPY_DST,
    });
    this.dummyTexture = this.device.createTexture({
      size: [width, height],
      format: this.output.format,
      usage: TEXTURE_USAGE_RENDER_ATTACHMENT,
    });
    this.dummyView = this.dummyTexture.createView();
    this.device.queue.writeBuffer(
      this.pixelBuffer, 0, new Uint32Array(width * height * 4)
    );
    this.rebuildBindGroups();
  }

  ensureGeometryCapacity(recordCount) {
    const required = Math.max(1, recordCount) * FLOATS_PER_RECORD * 4;
    if (required <= this.geometryCapacity) return;
    this.geometryCapacity = nextPowerOfTwo(required);
    this.geometryBuffer?.destroy?.();
    this.geometryBuffer = this.device.createBuffer({
      size: this.geometryCapacity,
      usage: BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_DST,
    });
    this.rebuildBindGroups();
  }

  rebuildBindGroups() {
    if (!this.uniformBuffer || !this.pixelBuffer) return;
    this.presentBindGroup = this.device.createBindGroup({
      layout: this.presentPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.pixelBuffer } },
      ],
    });
    if (!this.geometryBuffer) return;
    this.bindGroup = this.device.createBindGroup({
      layout: this.rasterPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.geometryBuffer } },
        { binding: 2, resource: { buffer: this.pixelBuffer } },
      ],
    });
  }

  async draw(
    records,
    { origin, scale, colorMode, simulateColors = false },
    { isCancelled = null, resetAccumulation = false } = {}
  ) {
    if (isCancelled?.()) return false;
    const size = this.output.getSize?.() ?? this.output.size;
    const width = size?.width ?? 1;
    const height = size?.height ?? 1;
    this.ensureSize(width, height);
    this.ensureGeometryCapacity(records.length);
    if (records.length > 0) {
      const packed = packRecords(records, colorMode, simulateColors);
      this.device.queue.writeBuffer(this.geometryBuffer, 0, packed);
    }
    const uniforms = new Float32Array([
      origin.x, origin.y, scale, 0,
      this.width, this.height, records.length,
      colorModeId(colorMode, simulateColors)
    ]);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);
    const view = await this.output.acquireView(this.device);
    if (isCancelled?.()) return false;
    const encoder = this.device.createCommandEncoder();
    if (resetAccumulation) encoder.clearBuffer(this.pixelBuffer);
    if (records.length > 0) {
      const raster = encoder.beginRenderPass({
        colorAttachments: [{
          view: this.dummyView,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
      raster.setPipeline(this.rasterPipeline);
      raster.setBindGroup(0, this.bindGroup);
      raster.draw(6, records.length);
      raster.end();
    }
    const present = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    present.setPipeline(this.presentPipeline);
    present.setBindGroup(0, this.presentBindGroup);
    present.draw(3);
    present.end();
    this.device.queue.submit([encoder.finish()]);
    await waitForSubmittedWork(this.device);
    return !isCancelled?.();
  }

  async drawGpuGeometry(
    geometryBuffer,
    recordCount,
    { origin, scale, colorMode, simulateColors = false },
    { isCancelled = null, resetAccumulation = false } = {}
  ) {
    if (isCancelled?.()) return false;
    const size = this.output.getSize?.() ?? this.output.size;
    this.ensureSize(size?.width ?? 1, size?.height ?? 1);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([
      origin.x, origin.y, scale, 0,
      this.width, this.height, recordCount,
      colorModeId(colorMode, simulateColors)
    ]));
    const geometryBindGroup = this.device.createBindGroup({
      layout: this.rasterPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: geometryBuffer } },
        { binding: 2, resource: { buffer: this.pixelBuffer } },
      ],
    });
    const view = await this.output.acquireView(this.device);
    if (isCancelled?.()) return false;
    const encoder = this.device.createCommandEncoder({
      label: 'WebGPU raster native ready geometry',
    });
    if (resetAccumulation) encoder.clearBuffer(this.pixelBuffer);
    if (recordCount > 0) {
      const raster = encoder.beginRenderPass({
        colorAttachments: [{
          view: this.dummyView,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
      raster.setPipeline(this.rasterPipeline);
      raster.setBindGroup(0, geometryBindGroup);
      raster.draw(6, recordCount);
      raster.end();
    }
    const present = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    present.setPipeline(this.presentPipeline);
    present.setBindGroup(0, this.presentBindGroup);
    present.draw(3);
    present.end();
    this.device.queue.submit([encoder.finish()]);
    await waitForSubmittedWork(this.device);
    return !isCancelled?.();
  }

  async drawGpuGeometryIndirect(
    geometryBuffer,
    drawIndirectBuffer,
    { origin, scale, colorMode, simulateColors = false },
    { isCancelled = null, resetAccumulation = false } = {}
  ) {
    const prepared = await this.prepareGpuGeometryIndirect(
      geometryBuffer,
      { origin, scale, colorMode, simulateColors },
      { isCancelled }
    );
    if (!prepared) return false;
    const encoder = this.device.createCommandEncoder({
      label: 'WebGPU raster native ready geometry indirect',
    });
    this.encodeGpuGeometryIndirect(
      encoder,
      drawIndirectBuffer,
      prepared,
      { resetAccumulation }
    );
    this.device.queue.submit([encoder.finish()]);
    await waitForSubmittedWork(this.device);
    return !isCancelled?.();
  }

  async prepareGpuGeometryIndirect(
    geometryBuffer,
    { origin, scale, colorMode, simulateColors = false },
    { isCancelled = null } = {}
  ) {
    if (isCancelled?.()) return null;
    const size = this.output.getSize?.() ?? this.output.size;
    this.ensureSize(size?.width ?? 1, size?.height ?? 1);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([
      origin.x, origin.y, scale, 0,
      this.width, this.height, 0,
      colorModeId(colorMode, simulateColors)
    ]));
    const geometryBindGroup = this.device.createBindGroup({
      layout: this.rasterPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: geometryBuffer } },
        { binding: 2, resource: { buffer: this.pixelBuffer } },
      ],
    });
    const view = await this.output.acquireView(this.device);
    if (isCancelled?.()) return null;
    return { geometryBindGroup, view };
  }

  encodeGpuGeometryIndirect(
    encoder,
    drawIndirectBuffer,
    { geometryBindGroup, view },
    { resetAccumulation = false } = {}
  ) {
    if (resetAccumulation) encoder.clearBuffer(this.pixelBuffer);
    const raster = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.dummyView,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    raster.setPipeline(this.rasterPipeline);
    raster.setBindGroup(0, geometryBindGroup);
    raster.drawIndirect(drawIndirectBuffer, 0);
    raster.end();
    const present = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    present.setPipeline(this.presentPipeline);
    present.setBindGroup(0, this.presentBindGroup);
    present.draw(3);
    present.end();
  }

  waitForSubmittedWork() {
    return waitForSubmittedWork(this.device);
  }

  async clear({
    origin = { x: 0, y: 0 },
    scale = 1,
    colorMode = 'default',
    simulateColors = false,
  } = {}) {
    const size = this.output.getSize?.() ?? this.output.size;
    this.ensureSize(size?.width ?? 1, size?.height ?? 1);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([
      origin.x, origin.y, scale, 0,
      this.width, this.height, 0,
      colorModeId(colorMode, simulateColors)
    ]));
    const view = await this.output.acquireView(this.device);
    const encoder = this.device.createCommandEncoder({
      label: 'WebGPU clear and present light accumulation',
    });
    encoder.clearBuffer(this.pixelBuffer);
    const present = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    present.setPipeline(this.presentPipeline);
    present.setBindGroup(0, this.presentBindGroup);
    present.draw(3);
    present.end();
    this.device.queue.submit([encoder.finish()]);
    await waitForSubmittedWork(this.device);
    return true;
  }

  destroy() {
    this.pixelBuffer?.destroy?.();
    this.uniformBuffer?.destroy?.();
    this.geometryBuffer?.destroy?.();
    this.dummyTexture?.destroy?.();
    this.pixelBuffer = null;
    this.uniformBuffer = null;
    this.geometryBuffer = null;
    this.dummyTexture = null;
    this.dummyView = null;
  }
}

async function waitForSubmittedWork(device) {
  await device.queue.onSubmittedWorkDone?.();
}

/**
 * Node has no built-in WebGPU implementation on the supported test runtime.
 * This small rasterizer executes the same ready-record, fixed accumulation
 * and tone-map contract into Canvas ImageData.  It is intentionally aimed at
 * deterministic smoke tests, not as a high-throughput replacement backend.
 */
export class WebGpuCanvasRayRasterizer {
  constructor(ctx) {
    this.ctx = ctx;
    this.width = 0;
    this.height = 0;
    this.accumulation = null;
    this.overflow = null;
  }

  ensureSize() {
    const width = Math.max(1, this.ctx.canvas.width);
    const height = Math.max(1, this.ctx.canvas.height);
    if (width === this.width && height === this.height && this.accumulation) {
      return;
    }
    this.width = width;
    this.height = height;
    this.accumulation = new Float64Array(width * height * 3);
    this.overflow = new Uint8Array(width * height);
  }

  clear() {
    this.ensureSize();
    this.accumulation.fill(0);
    this.overflow.fill(0);
    this.ctx.clearRect(0, 0, this.width, this.height);
    // Canvas 2D clearing is immediately visible and needs no presentation.
    return true;
  }

  async draw(records, {
    origin,
    scale,
    colorMode,
    simulateColors = false
  }, { resetAccumulation = false } = {}) {
    this.ensureSize();
    if (resetAccumulation) {
      this.accumulation.fill(0);
      this.overflow.fill(0);
    }
    for (const record of records) {
      const contribution = encodeWebGpuColorContribution(
        record.color, colorMode, simulateColors
      );
      this.rasterRecord(
        record, contribution, origin, scale, colorMode, simulateColors
      );
    }
    const image = this.ctx.createImageData(this.width, this.height);
    for (let pixel = 0; pixel < this.width * this.height; pixel++) {
      const outputOffset = pixel * 4;
      if (this.overflow[pixel]) {
        image.data.set([255, 255, 255, 255], outputOffset);
        continue;
      }
      const inputOffset = pixel * 3;
      const mapped = toneMapWebGpuColorContribution([
        this.accumulation[inputOffset],
        this.accumulation[inputOffset + 1],
        this.accumulation[inputOffset + 2],
      ], colorMode, simulateColors);
      image.data[outputOffset] = toByte(mapped[0]);
      image.data[outputOffset + 1] = toByte(mapped[1]);
      image.data[outputOffset + 2] = toByte(mapped[2]);
      image.data[outputOffset + 3] = toByte(mapped[3]);
    }
    this.ctx.putImageData(image, 0, 0);
    return true;
  }

  rasterRecord(
    record,
    contribution,
    origin,
    scale,
    colorMode,
    simulateColors
  ) {
    const p0 = {
      x: record.p0.x * scale + origin.x,
      y: record.p0.y * scale + origin.y,
    };
    if (record.isPoint) {
      const half = 0.5 * (record.pointSize + 1);
      this.visitBounds(
        p0.x - half, p0.y - half, p0.x + half, p0.y + half,
        (x, y, pixel) => {
          const coverage = calculateWebGpuPointCoverage(
            x + 0.5 - p0.x,
            y + 0.5 - p0.y,
            record.pointSize,
            colorMode
          );
          if (coverage > 0) {
            this.add(
              pixel, contribution, coverage, colorMode, simulateColors
            );
          }
        }
      );
      return;
    }
    const p1 = {
      x: record.p1.x * scale + origin.x,
      y: record.p1.y * scale + origin.y,
    };
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const length = Math.hypot(dx, dy);
    if (!(length > 1e-20)) return;
    const ux = dx / length;
    const uy = dy / length;
    const extent = 0.5 * Math.max(record.width, record.endWidth) + 1;
    this.visitBounds(
      Math.min(p0.x, p1.x) - extent,
      Math.min(p0.y, p1.y) - extent,
      Math.max(p0.x, p1.x) + extent,
      Math.max(p0.y, p1.y) + extent,
      (x, y, pixel) => {
        const relativeX = x + 0.5 - p0.x;
        const relativeY = y + 0.5 - p0.y;
        const along = relativeX * ux + relativeY * uy;
        if (along < 0 || along > length) return;
        const signedSide = relativeX * -uy + relativeY * ux;
        let coverage = record.kind === 'arrow'
          ? calculateWebGpuArrowCoverage(
            signedSide,
            along,
            length,
            record.width,
            record.endWidth,
            colorMode
          )
          : calculateWebGpuLineCoverage(
            signedSide, record.width, colorMode
          );
        if (
          record.kind !== 'arrow' &&
          record.dashOn > 0 && record.dashOff > 0
        ) {
          coverage *= calculateWebGpuDashCoverage(
            along, record.dashOn, record.dashOff, colorMode
          );
        }
        if (coverage > 0) {
          this.add(
            pixel, contribution, coverage, colorMode, simulateColors
          );
        }
      }
    );
  }

  visitBounds(minX, minY, maxX, maxY, callback) {
    const startX = Math.max(0, Math.floor(minX));
    const startY = Math.max(0, Math.floor(minY));
    const endX = Math.min(this.width - 1, Math.ceil(maxX));
    const endY = Math.min(this.height - 1, Math.ceil(maxY));
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        callback(x, y, y * this.width + x);
      }
    }
  }

  add(pixel, contribution, coverage, colorMode, simulateColors) {
    const covered = applyWebGpuAnalyticCoverage(
      contribution, coverage, colorMode, simulateColors
    );
    const offset = pixel * 3;
    for (let channel = 0; channel < 3; channel++) {
      const next = this.accumulation[offset + channel] +
        covered[channel];
      if (next * FIXED_POINT_SCALE > 0xffffffff) {
        this.overflow[pixel] = 1;
      } else {
        this.accumulation[offset + channel] = next;
      }
    }
  }

  destroy() {
    this.accumulation = null;
    this.overflow = null;
    this.ctx = null;
  }
}

function createRecord(
  p0,
  p1,
  color,
  width,
  dash,
  kind,
  pointSize,
  endWidth = width
) {
  return {
    p0, p1,
    color: normalizeColor(color),
    width: Math.max(0, width ?? 1),
    endWidth: Math.max(0, endWidth ?? 1),
    dashOn: dash?.[0] ?? 0,
    dashOff: dash?.[1] ?? 0,
    kind,
    isPoint: kind === 'point',
    pointSize,
  };
}

function normalizeColor(color) {
  if (color?.r !== undefined) return [color.r, color.g, color.b, color.a];
  return [color?.[0] ?? 1, color?.[1] ?? 1, color?.[2] ?? 1,
    color?.[3] ?? 1];
}

function packRecords(records, colorMode, simulateColors) {
  const packed = new Float32Array(records.length * FLOATS_PER_RECORD);
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    const offset = index * FLOATS_PER_RECORD;
    packed.set([record.p0.x, record.p0.y, record.p1.x, record.p1.y], offset);
    packed.set(
      encodeWebGpuColorContribution(record.color, colorMode, simulateColors),
      offset + 4
    );
    packed.set([
      record.width, record.dashOn, record.dashOff, record.endWidth
    ], offset + 8);
    packed.set([
      geometryKindId(record.kind), record.pointSize, 0, 0
    ], offset + 12);
  }
  return packed;
}

function geometryKindId(kind) {
  if (kind === 'point') return 1;
  if (kind === 'arrow') return 2;
  return 0;
}

export function encodeWebGpuColorContribution(
  color,
  colorMode,
  simulateColors
) {
  if (colorMode !== 'default') {
    const r = color[0] * color[3];
    const g = color[1] * color[3];
    const b = color[2] * color[3];
    const maximum = Math.max(r, g, b);
    if (!(maximum > 0)) return [0, 0, 0, 0];
    if (colorMode === 'colorizedIntensity') {
      return [maximum, maximum, maximum, 1];
    }
    const rr = r ** 2.2;
    const gg = g ** 2.2;
    const bb = b ** 2.2;
    const ratio = maximum / Math.max(rr, gg, bb);
    return [rr * ratio, gg * ratio, bb * ratio, 1];
  }
  if (simulateColors) {
    return [
      -Math.log1p(-Math.min(Math.max(color[0], 0), 1 - 1e-7)),
      -Math.log1p(-Math.min(Math.max(color[1], 0), 1 - 1e-7)),
      -Math.log1p(-Math.min(Math.max(color[2], 0), 1 - 1e-7)),
      1
    ];
  }
  const alpha = Math.min(Math.max(color[3], 0), 1 - 1e-7);
  const density = -Math.log1p(-alpha);
  return [color[0] * density, color[1] * density,
    color[2] * density, density];
}

export function calculateWebGpuLineCoverage(
  signedSide,
  width,
  colorMode
) {
  if (colorMode === 'colorizedIntensity') {
    return Math.abs(signedSide) <= 0.5 * width ? 1 : 0;
  }
  const maximumCoverage = Math.min(1, Math.max(0, width));
  return Math.min(maximumCoverage, Math.max(
    0, 0.5 * width + 0.5 - Math.abs(signedSide)
  ));
}

export function calculateWebGpuArrowCoverage(
  signedSide,
  along,
  length,
  frontWidth,
  backWidth,
  colorMode
) {
  if (along < 0 || along > length || !(length > 0)) return 0;
  const sideSlope = 0.5 * (backWidth - frontWidth) / length;
  const halfWidth = 0.5 * (
    frontWidth + (backWidth - frontWidth) * along / length
  );
  const sideExpansion = Math.hypot(1, sideSlope);
  const signedDistance = (
    Math.abs(signedSide) - halfWidth
  ) / sideExpansion;
  if (colorMode === 'colorizedIntensity') {
    return signedDistance <= 0 ? 1 : 0;
  }
  const maximumCoverage = Math.min(
    1, Math.max(0, 2 * halfWidth / sideExpansion)
  );
  return Math.min(
    maximumCoverage, Math.max(0, 0.5 - signedDistance)
  );
}

export function calculateWebGpuPointCoverage(
  relativeX,
  relativeY,
  size,
  colorMode
) {
  const resolvedSize = Math.max(0, size);
  if (colorMode === 'colorizedIntensity') {
    return Math.abs(relativeX) <= 0.5 * resolvedSize &&
      Math.abs(relativeY) <= 0.5 * resolvedSize ? 1 : 0;
  }
  const maximumCoverage = Math.min(1, resolvedSize);
  const xCoverage = Math.min(maximumCoverage, Math.max(
    0, 0.5 * resolvedSize + 0.5 - Math.abs(relativeX)
  ));
  const yCoverage = Math.min(maximumCoverage, Math.max(
    0, 0.5 * resolvedSize + 0.5 - Math.abs(relativeY)
  ));
  return xCoverage * yCoverage;
}

export function calculateWebGpuDashCoverage(
  along,
  dashOn,
  dashOff,
  colorMode
) {
  if (!(dashOn > 0) || !(dashOff > 0)) return 1;
  const period = dashOn + dashOff;
  const withinDash = along - Math.floor(along / period) * period;
  if (colorMode === 'colorizedIntensity') {
    return withinDash < dashOn ? 1 : 0;
  }
  const signedDistance = withinDash <= dashOn
    ? -Math.min(withinDash, dashOn - withinDash)
    : Math.min(withinDash - dashOn, period - withinDash);
  const maximumCoverage = Math.min(1, dashOn);
  return Math.min(maximumCoverage, Math.max(
    0, 0.5 - signedDistance
  ));
}

export function applyWebGpuAnalyticCoverage(
  contribution,
  coverage,
  colorMode,
  simulateColors
) {
  if (colorMode === 'default' && !simulateColors) {
    const density = contribution[3];
    if (!(density > 0)) return [0, 0, 0, contribution[3]];
    const alpha = 1 - Math.exp(-density);
    const coveredDensity = -Math.log1p(-alpha * coverage);
    return [
      contribution[0] / density * coveredDensity,
      contribution[1] / density * coveredDensity,
      contribution[2] / density * coveredDensity,
      coveredDensity
    ];
  }
  if (colorMode === 'default' && simulateColors) {
    return [
      contribution[0] * coverage,
      contribution[1] * coverage,
      contribution[2] * coverage,
      contribution[3]
    ];
  }
  return [
    contribution[0] * coverage,
    contribution[1] * coverage,
    contribution[2] * coverage,
    contribution[3]
  ];
}

function colorModeId(mode, simulateColors) {
  if (mode === 'default' && simulateColors) return 5;
  switch (mode) {
    case 'default': return 0;
    case 'linear': return 1;
    case 'linearRGB': return 2;
    case 'reinhard': return 3;
    case 'colorizedIntensity': return 4;
    default: return 0;
  }
}

export function toneMapWebGpuColorContribution(
  color,
  mode,
  simulateColors
) {
  if (mode === 'default') {
    if (simulateColors) {
      const factor = Math.max(...color);
      const opacity = Math.min(Math.max(factor, 0), 1);
      const rgb = factor > 0
        ? color.map(value => value / factor * opacity)
        : [0, 0, 0];
      return [...rgb, opacity];
    }
    const density = Math.max(...color);
    const opacity = 1 - Math.exp(-density);
    const rgb = density > 0
      ? color.map(value => value / density * opacity)
      : [0, 0, 0];
    return [...rgb, opacity];
  }
  const maximum = Math.max(...color);
  if (mode === 'colorizedIntensity') {
    const mapped = brightnessToColorJs(maximum);
    return [mapped[0] * 0.8, mapped[1] * 0.8, mapped[2] * 0.8, 0];
  }
  if (mode === 'reinhard') {
    const luminance =
      color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
    const scale = 1 / (1 + luminance);
    return [
      (color[0] * scale) ** (1 / 2.2),
      (color[1] * scale) ** (1 / 2.2),
      (color[2] * scale) ** (1 / 2.2),
      maximum ** (1 / 2.2)
    ];
  }
  const divisor = mode === 'linear' && maximum > 1 ? maximum : 1;
  return [
    (color[0] / divisor) ** (1 / 2.2),
    (color[1] / divisor) ** (1 / 2.2),
    (color[2] / divisor) ** (1 / 2.2),
    Math.min(maximum, mode === 'linear' ? 1 : maximum) ** (1 / 2.2)
  ];
}

function brightnessToColorJs(brightness) {
  const interpolate = (left, right, t) => left.map(
    (value, index) => value + (right[index] - value) * t
  );
  if (brightness > 100) return [1, 0, 0, 1];
  const bands = [
    [10, 100, [1, 0.5, 0], [1, 0, 0]],
    [1, 10, [1, 1, 0], [1, 0.5, 0]],
    [0.1, 1, [0, 1, 0], [1, 1, 0]],
    [0.01, 0.1, [0, 1, 1], [0, 1, 0]],
    [0.001, 0.01, [0, 0, 1], [0, 1, 1]],
    [0.0001, 0.001, [0.3, 0, 0.3], [0, 0, 1]],
  ];
  for (const [minimum, maximum, left, right] of bands) {
    if (brightness > minimum) {
      const t = (Math.log2(brightness) - Math.log2(minimum)) /
        (Math.log2(maximum) - Math.log2(minimum));
      return [...interpolate(left, right, t), 1];
    }
  }
  const t = (Math.log2(Math.max(brightness, 1e-7)) - Math.log2(1e-7)) /
    (Math.log2(0.0001) - Math.log2(1e-7));
  return [...interpolate([0, 0, 0], [0.3, 0, 0.3], t), t];
}

function toByte(value) {
  return Math.round(Math.min(1, Math.max(0, value)) * 255);
}

function nextPowerOfTwo(value) {
  return 2 ** Math.ceil(Math.log2(Math.max(value, 4)));
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
