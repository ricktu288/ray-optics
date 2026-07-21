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

import CanvasRenderer from './CanvasRenderer.js';
import i18next from 'i18next';

const UV_WAVELENGTH = 380;
const VIOLET_WAVELENGTH = 420;
const BLUE_WAVELENGTH = 460;
const CYAN_WAVELENGTH = 500;
const GREEN_WAVELENGTH = 540;
const YELLOW_WAVELENGTH = 580;
const RED_WAVELENGTH = 620;
const INFRARED_WAVELENGTH = 700;

/**
 * Temporary simulator shell used to exercise the new constructor and backend
 * switching before the primitive-based simulation is implemented.
 */
class PrimitiveBasedSimulator {
  /**
   * @param {Object} options
   * @param {Scene} options.scene
   * @param {CpuSimulationEngine|WebGpuSimulationEngine} options.engine
   * @param {CanvasRenderingContext2D|null} [options.ctxBelowLight]
   * @param {CanvasRenderingContext2D|null} [options.ctxAboveLight]
   * @param {CanvasRenderingContext2D|null} [options.ctxGrid]
   * @param {CanvasRenderingContext2D|null} [options.ctxVirtual]
   * @param {boolean} [options.enableTimer=false]
   * @param {number} [options.rayCountLimit=Infinity]
   * @param {function|null} [options.tempCanvasFactory=null]
   */
  constructor({
    scene,
    engine,
    ctxBelowLight = null,
    ctxAboveLight = null,
    ctxGrid = null,
    ctxVirtual = null,
    enableTimer = false,
    rayCountLimit = Infinity,
    tempCanvasFactory = null,
  }) {
    this.scene = scene;
    this.engine = engine;
    this.ctxBelowLight = ctxBelowLight;
    this.ctxAboveLight = ctxAboveLight;
    this.ctxGrid = ctxGrid;
    this.ctxVirtual = ctxVirtual;
    this.enableTimer = enableTimer;
    this.rayCountLimit = rayCountLimit;
    this.tempCanvasFactory = tempCanvasFactory;

    this.scene.simulator = this;
    this.dpr = 1;
    this.manualLightRedraw = false;
    this.isLightLayerSynced = true;
    this.processedRayCount = 0;
    this.totalTruncation = 0;
    this.brightnessScale = 0;
    this.simulationStartTime = null;
    this.error = null;
    this.warning = null;
    this.eventListeners = {};

    this.canvasRendererBelowLight = null;
    this.canvasRendererAboveLight = null;
    this.canvasRendererGrid = null;

    this.activeRun = null;
    this.runGeneration = 0;
    this.isRunning = false;
  }

  on(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  }

  emit(eventName, data) {
    this.eventListeners[eventName]?.forEach(callback => callback(data));
  }

  updateSimulation(skipLight = false, skipGrid = false, forceRedraw = false) {
    this.emit('update', { skipLight, skipGrid, forceRedraw });

    if (!skipLight && this.manualLightRedraw && !forceRedraw) {
      this.isLightLayerSynced = false;
      this.emit('lightLayerSyncChange', { isSynced: false });
    }
    skipLight = skipLight || (this.manualLightRedraw && !forceRedraw);
    this.drawSceneLayers(skipGrid);

    if (skipLight) {
      this.emit('requestUpdateErrorAndWarning');
      return;
    }

    this.runGeneration++;
    const generation = this.runGeneration;
    this.processedRayCount = 0;
    this.totalTruncation = 0;
    this.brightnessScale = 0;
    this.simulationStartTime = new Date();
    this.error = null;
    this.warning = null;
    this.isRunning = true;
    this.isLightLayerSynced = true;
    this.emit('lightLayerSyncChange', { isSynced: true });
    this.emit('simulationStart', null);

    this.runEngine(generation)
      .then(() => this.completeRun(generation))
      .catch(err => {
        if (generation !== this.runGeneration) return;
        this.activeRun?.dispose?.();
        this.activeRun = null;
        this.error = this.engine.kind === 'webgpu'
          ? i18next.t('simulator:simulationEngineModal.webgpu.unavailable', { message: err.message })
          : i18next.t('simulator:settings.correctBrightness.error');
        this.completeRun(generation);
      });
  }

  async runEngine(generation) {
    this.activeRun?.cancel?.();
    this.activeRun?.dispose?.();

    // Primitive extraction and preprocessing will replace this empty,
    // structured-cloneable description in a later implementation step.
    const preparedScene = await this.engine.prepare({});
    if (generation !== this.runGeneration) return;

    const viewport = {
      origin: {
        x: this.scene.origin.x * this.dpr,
        y: this.scene.origin.y * this.dpr,
      },
      scale: this.scene.scale * this.dpr,
      lengthScale: this.scene.lengthScale,
    };
    const run = await this.engine.createRun({
      preparedScene,
      viewport,
      colorMode: this.scene.colorMode,
      rayCountLimit: this.rayCountLimit,
    });
    if (generation !== this.runGeneration) {
      run.cancel?.();
      run.dispose?.();
      return;
    }
    this.activeRun = run;

    let update;
    do {
      update = await run.advance({
        timeBudgetMs: this.enableTimer ? 16 : Infinity,
      });
      if (generation !== this.runGeneration) {
        run.cancel?.();
        return;
      }

      this.processedRayCount = update.progress?.processedRayCount ?? this.processedRayCount;
      this.totalTruncation = update.progress?.totalTruncation ?? this.totalTruncation;
      if (update.status !== 'complete' && this.enableTimer) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } while (update.status !== 'complete');

    this.brightnessScale = update.result?.brightnessScale ?? this.brightnessScale;
    run.dispose?.();
    if (this.activeRun === run) this.activeRun = null;
  }

  drawSceneLayers(skipGrid) {
    const origin = { x: this.scene.origin.x * this.dpr, y: this.scene.origin.y * this.dpr };
    const scale = this.scene.scale * this.dpr;

    if (this.ctxBelowLight) {
      this.canvasRendererBelowLight = new CanvasRenderer(
        this.ctxBelowLight,
        origin,
        scale,
        this.scene.lengthScale,
        this.scene.backgroundImage
      );
    }

    if (this.ctxAboveLight) {
      this.canvasRendererAboveLight = new CanvasRenderer(
        this.ctxAboveLight,
        origin,
        scale,
        this.scene.lengthScale
      );
    }

    if (!skipGrid && this.ctxGrid) {
      this.canvasRendererGrid = new CanvasRenderer(
        this.ctxGrid,
        origin,
        scale,
        this.scene.lengthScale
      );
      this.drawGrid();
    }

    const sortedObjs = this.scene.objs
      .map((obj, index) => ({ obj, index, zIndex: obj.getZIndex() }))
      .sort((a, b) => a.zIndex - b.zIndex);

    if (this.canvasRendererBelowLight) {
      for (const { obj, index } of sortedObjs) {
        const isHighlighted = this.scene.editor?.isObjHighlighted(index) || false;
        obj.draw(this.canvasRendererBelowLight, false, isHighlighted);
      }
    }

    if (this.canvasRendererAboveLight) {
      for (const { obj, index } of sortedObjs) {
        const isHighlighted = this.scene.editor?.isObjHighlighted(index) || false;
        obj.draw(this.canvasRendererAboveLight, true, isHighlighted);
      }
      this.drawExternalHighlightPoints(this.canvasRendererAboveLight);
      this.drawObserver();
    }
  }

  drawGrid() {
    if (!this.scene.showGrid) return;

    const ctx = this.ctxGrid;
    ctx.save();
    ctx.setTransform(this.scene.scale * this.dpr, 0, 0, this.scene.scale * this.dpr, 0, 0);
    let dashPattern = this.scene.theme.grid.dash.map(value => value * this.scene.lengthScale);
    const dashPeriod = dashPattern.reduce((a, b) => a + b, 0);
    ctx.strokeStyle = `rgba(${Math.round(this.scene.theme.grid.color.r * 255)}, ${Math.round(this.scene.theme.grid.color.g * 255)}, ${Math.round(this.scene.theme.grid.color.b * 255)}, ${this.scene.theme.grid.color.a})`;
    ctx.lineWidth = this.scene.theme.grid.width * this.scene.lengthScale;
    if (dashPeriod * this.scene.scale <= 2) dashPattern = [];
    ctx.setLineDash(dashPattern);
    ctx.beginPath();

    for (let x = this.scene.origin.x / this.scene.scale % this.scene.gridSize; x <= ctx.canvas.width / (this.scene.scale * this.dpr); x += this.scene.gridSize) {
      ctx.moveTo(x, this.scene.origin.y / this.scene.scale % this.scene.gridSize - this.scene.gridSize);
      ctx.lineTo(x, ctx.canvas.height / (this.scene.scale * this.dpr));
    }
    for (let y = this.scene.origin.y / this.scene.scale % this.scene.gridSize; y <= ctx.canvas.height / (this.scene.scale * this.dpr); y += this.scene.gridSize) {
      ctx.moveTo(this.scene.origin.x / this.scene.scale % this.scene.gridSize - this.scene.gridSize, y);
      ctx.lineTo(ctx.canvas.width / (this.scene.scale * this.dpr), y);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawObserver() {
    if (this.scene.mode !== 'observer' || !this.ctxAboveLight || !this.scene.observer) return;

    const ctx = this.ctxAboveLight;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.fillStyle = `rgb(${Math.round(this.scene.theme.observer.color.r * 255)}, ${Math.round(this.scene.theme.observer.color.g * 255)}, ${Math.round(this.scene.theme.observer.color.b * 255)})`;
    ctx.arc(this.scene.observer.c.x, this.scene.observer.c.y, this.scene.observer.r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawExternalHighlightPoints(canvasRenderer) {
    const points = this.scene.editor?.externalHighlightPoints;
    if (!points?.length) return;

    const ctx = canvasRenderer.ctx;
    const lengthScale = canvasRenderer.lengthScale;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5 * lengthScale;
    ctx.strokeStyle = this.scene.highlightColorCss;
    ctx.setLineDash([2.1 * lengthScale, 2.1 * lengthScale]);
    for (const point of points) {
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4 * lengthScale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  completeRun(generation) {
    if (generation !== this.runGeneration) return;
    this.isRunning = false;
    this.emit('requestUpdateErrorAndWarning');
    this.emit('simulationComplete', null);
  }

  manualRedrawLightLayer() {
    this.updateSimulation(false, true, true);
  }

  stopSimulation() {
    if (!this.isRunning) return;
    this.runGeneration++;
    this.activeRun?.cancel?.();
    this.activeRun?.dispose?.();
    this.activeRun = null;
    this.isRunning = false;
    this.emit('simulationStop', null);
  }

  destroy() {
    this.stopSimulation();
    this.engine.dispose?.();
    this.eventListeners = {};
  }

  createTempCanvas(width, height) {
    if (this.tempCanvasFactory) return this.tempCanvasFactory(width, height);
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
    return null;
  }

  wavelengthToColor(wavelength, brightness, transform) {
    let r;
    let g;
    let b;
    let spectralIntensity;

    const sceneViolet = Number.isFinite(this.scene.violetWavelength)
      ? this.scene.violetWavelength
      : VIOLET_WAVELENGTH;
    const sceneRed = Number.isFinite(this.scene.redWavelength)
      ? this.scene.redWavelength
      : RED_WAVELENGTH;
    const targetViolet = sceneRed > sceneViolet ? sceneViolet : VIOLET_WAVELENGTH;
    const targetRed = sceneRed > sceneViolet ? sceneRed : RED_WAVELENGTH;
    const wavelengthScale =
      (targetRed - targetViolet) / (RED_WAVELENGTH - VIOLET_WAVELENGTH);
    const scaleWavelength = value =>
      targetViolet + (value - VIOLET_WAVELENGTH) * wavelengthScale;

    const uvWavelength = scaleWavelength(UV_WAVELENGTH);
    const blueWavelength = scaleWavelength(BLUE_WAVELENGTH);
    const cyanWavelength = scaleWavelength(CYAN_WAVELENGTH);
    const greenWavelength = scaleWavelength(GREEN_WAVELENGTH);
    const yellowWavelength = scaleWavelength(YELLOW_WAVELENGTH);
    const infraredWavelength = scaleWavelength(INFRARED_WAVELENGTH);

    if (wavelength >= uvWavelength && wavelength < targetViolet) {
      r = 0.5;
      g = 0;
      b = 1;
    } else if (wavelength >= targetViolet && wavelength < blueWavelength) {
      r = -0.5 * (wavelength - blueWavelength) / (blueWavelength - targetViolet);
      g = 0;
      b = 1;
    } else if (wavelength >= blueWavelength && wavelength < cyanWavelength) {
      r = 0;
      g = (wavelength - blueWavelength) / (cyanWavelength - blueWavelength);
      b = 1;
    } else if (wavelength >= cyanWavelength && wavelength < greenWavelength) {
      r = 0;
      g = 1;
      b = -(wavelength - greenWavelength) / (greenWavelength - cyanWavelength);
    } else if (wavelength >= greenWavelength && wavelength < yellowWavelength) {
      r = (wavelength - greenWavelength) / (yellowWavelength - greenWavelength);
      g = 1;
      b = 0;
    } else if (wavelength >= yellowWavelength && wavelength < targetRed) {
      r = 1;
      g = -(wavelength - targetRed) / (targetRed - yellowWavelength);
      b = 0;
    } else if (wavelength >= targetRed && wavelength <= infraredWavelength) {
      r = 1;
      g = 0;
      b = 0;
    } else {
      r = 0;
      g = 0;
      b = 0;
    }

    if (wavelength > infraredWavelength || wavelength < uvWavelength) {
      spectralIntensity = 0;
    } else if (wavelength > targetRed) {
      spectralIntensity =
        (infraredWavelength - wavelength) / (infraredWavelength - targetRed);
    } else if (wavelength < targetViolet) {
      spectralIntensity =
        (wavelength - uvWavelength) / (targetViolet - uvWavelength);
    } else {
      spectralIntensity = 1;
    }

    r *= spectralIntensity * brightness;
    g *= spectralIntensity * brightness;
    b *= spectralIntensity * brightness;

    if (transform) {
      r = 1 - Math.exp(-r);
      g = 1 - Math.exp(-g);
      b = 1 - Math.exp(-b);
    }

    return [r, g, b, 1];
  }

  getThemeRayColor(rayType, alpha) {
    const color = this.scene.theme[rayType]?.color || this.scene.theme.ray.color;
    return [color.r, color.g, color.b, alpha];
  }

  getThemeRayDash(rayType) {
    return this.scene.theme[rayType]?.dash || this.scene.theme.ray.dash;
  }

  getThemeImageColor(imageType, alpha) {
    const color = this.scene.theme[imageType]?.color || this.scene.theme.realImage.color;

    // This avoids excessive accumulation for the default gray virtual-object
    // color when the floating-point light renderer is in use.
    if (
      imageType === 'virtualObject' &&
      color.r === 0.3 &&
      color.g === 0.3 &&
      color.b === 0.3 &&
      this.scene.colorMode !== 'default'
    ) {
      return [0.03, 0.03, 0.03, alpha];
    }

    return [color.r, color.g, color.b, alpha];
  }

  getThemeImageSize(imageType) {
    return this.scene.theme[imageType]?.size || this.scene.theme.realImage.size || 5;
  }
}

export default PrimitiveBasedSimulator;
