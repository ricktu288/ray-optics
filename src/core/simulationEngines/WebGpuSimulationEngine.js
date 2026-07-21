/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const TRIANGLE_SHADER = `
  @vertex
  fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
    var positions = array<vec2f, 3>(
      vec2f(0.0, 0.6),
      vec2f(-0.6, -0.6),
      vec2f(0.6, -0.6)
    );
    return vec4f(positions[vertexIndex], 0.0, 1.0);
  }

  @fragment
  fn fragmentMain() -> @location(0) vec4f {
    return vec4f(0.2, 0.8, 1.0, 0.85);
  }
`;

class WebGpuSimulationRun {
  constructor(engine) {
    this.engine = engine;
    this.isCancelled = false;
    this.isComplete = false;
  }

  async advance() {
    if (this.isCancelled || this.isComplete) {
      return this.getCompleteUpdate();
    }

    await this.engine.drawTriangle();
    this.isComplete = true;
    return this.getCompleteUpdate();
  }

  getCompleteUpdate() {
    return {
      status: 'complete',
      progress: {
        processedRayCount: 0,
        totalTruncation: 0,
      },
      outputUpdated: !this.isCancelled,
      result: {
        detectors: [],
        processedRayCount: 0,
        totalTruncation: 0,
        brightnessScale: 0,
      },
    };
  }

  cancel() {
    this.isCancelled = true;
  }

  dispose() {
    this.cancel();
  }
}

/**
 * Temporary WebGPU simulation engine. The device may be supplied directly,
 * as a promise, or by a lazy function. The output adapter is platform-owned
 * and supplies texture views for both browser canvases and Node textures.
 */
class WebGpuSimulationEngine {
  constructor({ device, output, ownsDevice = false }) {
    this.kind = 'webgpu';
    this.deviceSource = device;
    this.devicePromise = null;
    this.output = output;
    this.ownsDevice = ownsDevice;
    this.device = null;
    this.pipeline = null;
    this.isInitialized = false;
    this.isDisposed = false;
  }

  async prepare(description) {
    return { description };
  }

  async createRun() {
    return new WebGpuSimulationRun(this);
  }

  async initialize() {
    if (this.isInitialized) return;
    if (this.isDisposed) return;
    if (!this.output) throw new Error('A WebGPU output adapter is required.');

    if (!this.devicePromise) {
      this.devicePromise = Promise.resolve(
        typeof this.deviceSource === 'function' ? this.deviceSource() : this.deviceSource
      );
    }
    const device = await this.devicePromise;
    if (this.isDisposed) {
      if (this.ownsDevice) device?.destroy?.();
      return;
    }
    if (!device) throw new Error('No WebGPU device is available.');
    if (!this.output.format) throw new Error('The WebGPU output format is unavailable.');

    this.device = device;
    await this.output.initialize?.(device);
    if (this.isDisposed) return;

    const shader = device.createShaderModule({ code: TRIANGLE_SHADER });
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: shader, entryPoint: 'vertexMain' },
      fragment: {
        module: shader,
        entryPoint: 'fragmentMain',
        targets: [{
          format: this.output.format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });
    this.isInitialized = true;
  }

  async drawTriangle() {
    await this.initialize();
    if (this.isDisposed) return;

    const view = await this.output.acquireView(this.device);
    if (!view) throw new Error('The WebGPU output did not provide a texture view.');

    const commandEncoder = this.device.createCommandEncoder();
    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(this.pipeline);
    pass.draw(3);
    pass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  dispose() {
    this.isDisposed = true;
    this.output?.dispose?.();
    if (this.ownsDevice) this.device?.destroy?.();
    this.device = null;
    this.deviceSource = null;
    this.pipeline = null;
  }
}

export default WebGpuSimulationEngine;
