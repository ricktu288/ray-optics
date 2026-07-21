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

import CanvasRenderer from '../CanvasRenderer.js';
import FloatColorRenderer from '../FloatColorRenderer.js';

class CpuSimulationRun {
  constructor(engine, options) {
    this.engine = engine;
    this.options = options;
    this.isCancelled = false;
    this.isComplete = false;
  }

  async advance() {
    if (this.isCancelled || this.isComplete) {
      return this.getCompleteUpdate();
    }

    this.engine.drawTriangle(this.options);
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
 * Temporary CPU simulation engine. A run currently draws one test triangle
 * and completes immediately.
 */
class CpuSimulationEngine {
  constructor({ ctxMain = null, glMain = null, ctxVirtual = null } = {}) {
    this.kind = 'primitiveCpu';
    this.ctxMain = ctxMain;
    this.glMain = glMain;
    this.ctxVirtual = ctxVirtual;
    this.canvasRenderer = null;
  }

  async prepare(description) {
    return { description };
  }

  async createRun(options = {}) {
    return new CpuSimulationRun(this, options);
  }

  drawTriangle({ viewport = {}, colorMode = 'default' } = {}) {
    if (colorMode === 'default') {
      this.drawCanvasTriangle(viewport);
      return;
    }

    this.drawFloatColorTriangle(viewport, colorMode);
  }

  drawCanvasTriangle(viewport) {
    this.canvasRenderer?.destroy?.();
    this.canvasRenderer = null;
    if (!this.ctxMain) return;

    const origin = viewport.origin || { x: 0, y: 0 };
    const scale = viewport.scale ?? 1;
    const lengthScale = viewport.lengthScale ?? 1;
    this.canvasRenderer = new CanvasRenderer(
      this.ctxMain,
      origin,
      scale,
      lengthScale,
      null,
      this.ctxVirtual
    );

    const ctx = this.canvasRenderer.ctx;
    const { width, height } = ctx.canvas;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255, 220, 64, 0.85)';
    ctx.beginPath();
    ctx.moveTo(width * 0.5, height * 0.3);
    ctx.lineTo(width * 0.3, height * 0.7);
    ctx.lineTo(width * 0.7, height * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawFloatColorTriangle(viewport, colorMode) {
    if (!this.glMain) {
      throw new Error('WebGL is unavailable.');
    }

    const origin = viewport.origin || { x: 0, y: 0 };
    const scale = viewport.scale ?? 1;
    const lengthScale = viewport.lengthScale ?? 1;
    const canReuseRenderer =
      this.canvasRenderer instanceof FloatColorRenderer &&
      this.canvasRenderer.colorMode === colorMode &&
      this.canvasRenderer.scale === scale &&
      this.canvasRenderer.lengthScale === lengthScale &&
      this.canvasRenderer.origin.x === origin.x &&
      this.canvasRenderer.origin.y === origin.y &&
      this.canvasRenderer.width === this.glMain.canvas.width &&
      this.canvasRenderer.height === this.glMain.canvas.height;

    if (canReuseRenderer) {
      this.canvasRenderer.begin();
    } else {
      this.canvasRenderer?.destroy?.();
      this.canvasRenderer = new FloatColorRenderer(
        this.glMain,
        origin,
        scale,
        lengthScale,
        null,
        null,
        colorMode
      );
    }

    const width = this.glMain.canvas.width;
    const height = this.glMain.canvas.height;
    const toScenePoint = (x, y) => ({
      x: (x - origin.x) / scale,
      y: (y - origin.y) / scale,
    });
    const top = { x: width * 0.5, y: height * 0.3 };
    const bottomLeft = { x: width * 0.3, y: height * 0.7 };
    const bottomRight = { x: width * 0.7, y: height * 0.7 };
    const color = [1, 0.7, 0.1, 1];
    const rowCount = Math.min(240, Math.max(1, Math.round(height * 0.4)));

    for (let row = 1; row <= rowCount; row++) {
      const t = row / rowCount;
      const y = top.y + (bottomLeft.y - top.y) * t;
      const leftX = top.x + (bottomLeft.x - top.x) * t;
      const rightX = top.x + (bottomRight.x - top.x) * t;
      this.canvasRenderer.drawSegment({
        p1: toScenePoint(leftX, y),
        p2: toScenePoint(rightX, y),
      }, color);
    }
    this.canvasRenderer.flush();
  }

  dispose() {
    this.canvasRenderer?.destroy?.();
    this.canvasRenderer = null;
  }
}

export default CpuSimulationEngine;
