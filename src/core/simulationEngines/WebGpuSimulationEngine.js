/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import { FLOAT32_EPSILON, validateNumericEpsilon } from '../primitive/numeric.js';
import CpuSimulationEngine, {
  CpuSimulationRun,
  normalizeMaxRayDepth
} from './CpuSimulationEngine.js';
import {
  WEBGPU_MAX_POLARIZED_POWER,
  clampWebGpuParameterToF32,
  estimateWebGpuParameterRanges,
  formatWebGpuParameterRangeSummary,
  recordWebGpuRecompilationNeeds
} from './webGpuParameterRanges.js';
import {
  createWebGpuExecutionPlan
} from './webGpuExecutionPlan.js';
import {
  createWebGpuDagPrograms
} from './webGpuDagPrograms.js';
import {
  packWebGpuScene
} from './webGpuStorage.js';
import { WebGpuComputeBackend } from './webGpuComputeBackend.js';
import {
  WebGpuAtomicRayRasterizer,
  WebGpuCanvasRayRasterizer,
  WebGpuReadyRayRenderer
} from './webGpuRayRenderer.js';
import {
  WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE
} from './config.js';

const DEFAULT_WEBGPU_RUN_CONFIG = Object.freeze({
  workgroupSize: 64,
  maxItemsPerAdvance: 262144,
  maxBatchRayEvents: 262144,
  maxReadyLineRecords: 262144,
  maxReadyPointRecords: 65536,
  maxPingPongsPerSubmission: 64,
});

/**
 * A resumable WebGPU run.  Optical event staging deliberately follows the
 * primitive CPU implementation: one source population, membership pass, one
 * trace event, typed interaction indexing, render preparation and typed
 * outgoing writes per ping/pong.  The ready geometry is consumed by the
 * raster-atomic WebGPU renderer when a device is available.
 *
 * The shared staged executor is also the Node compatibility implementation.
 * This makes end-to-end scene tests exercise the WebGPU contracts (f32 input
 * packing, wavelength rejection and no legacy 0.01 subsampling) on machines
 * where Node has no WebGPU implementation.  `executionMode` exposes which
 * path was used so tests cannot mistake this compatibility path for native
 * compute execution.
 */
class WebGpuSimulationRun {
  constructor(engine, options) {
    this.engine = engine;
    this.options = options;
    this.referenceRun = new CpuSimulationRun(engine, {
      ...options,
      preparedScene: {
        ...options.preparedScene,
        description: options.preparedScene.runtimeDescription
      }
    });
    // The engine installs a new ready-record collector for every run. Keep
    // this exact collector so a superseded run can never consume records from
    // its replacement after an asynchronous GPU readback resumes.
    this.canvasRenderer = engine.canvasRenderer;
    this.isCancelled = false;
    this.isComplete = false;
    this.nativeStatePromise = null;
    this.trackNativeStatePromise(options.nativeStatePromise ?? null);
    this.nativeState = null;
    this.nativeFinished = !this.nativeStatePromise;
    this.maxRayDepth = normalizeMaxRayDepth(options.maxRayDepth);
    this.detectorOverflowWarned = false;
    this.clearPending = Boolean(engine.rasterizer);
    this.hasPresentedRun = false;
  }

  async advance({
    itemBudget = this.engine.runConfig.maxItemsPerAdvance
  } = {}) {
    if (this.isCancelled || this.isComplete) return this.getUpdate();

    const update = await this.referenceRun.advance({
      // WebGPU pause boundaries are item/capacity based.  Command submission
      // overhead alone can exceed a short wall-clock budget, so this backend
      // deliberately does not apply a time limit.
      timeBudgetMs: Infinity,
      itemBudget: Math.min(
        validateItemBudget(itemBudget),
        this.engine.runConfig.maxItemsPerAdvance
      )
    });
    if (this.isCancelled) return this.getUpdate();
    const records = this.canvasRenderer?.takeNewRecords?.() ?? [];
    const presentation = {
      origin: this.options.viewport?.origin ?? { x: 0, y: 0 },
      scale: this.options.viewport?.scale ?? 1,
      colorMode: this.options.colorMode ?? 'default',
      simulateColors: this.options.rendering?.simulateColors ?? false,
    };
    if (this.engine.rasterizer && records.length > 0) {
      const presented = await this.engine.rasterizer.draw(records, presentation, {
        isCancelled: () => this.isCancelled,
        resetAccumulation: this.clearPending,
      });
      if (presented !== false) {
        this.clearPending = false;
      }
    } else if (
      this.engine.rasterizer &&
      (
        this.clearPending ||
        (update.status === 'complete' && !this.hasPresentedRun)
      )
    ) {
      // If this first advance produced no render geometry, its return is the
      // first natural pause at which to present the pending clear.  A first
      // advance that did render combines clearing and rasterization in one
      // submission instead.
      const presented = await this.engine.rasterizer.draw([], presentation, {
        isCancelled: () => this.isCancelled,
        resetAccumulation: this.clearPending,
      });
      if (presented !== false) {
        this.clearPending = false;
      }
    }
    // Presentation is deliberately submitted before waiting for the small
    // native state readback. This keeps dragging responsive even when the
    // preceding compute batch takes appreciable time.
    await this.advanceNativeCompute();
    if (records.length > 0 || update.status === 'complete') {
      this.hasPresentedRun = true;
    }
    this.isComplete = update.status === 'complete' && this.nativeFinished;
    this.lastUpdate = {
      ...update,
      status: this.isComplete ? 'complete' : 'running',
      executionMode: this.engine.executionMode,
      outputUpdated: update.outputUpdated || records.length > 0,
    };
    return this.lastUpdate;
  }

  async advanceNativeCompute() {
    if (!this.nativeStatePromise || this.isCancelled) return;
    const state = await this.nativeStatePromise;
    this.nativeStatePromise = null;
    this.nativeState = state;
    if (state.detectorOverflow && !this.detectorOverflowWarned) {
      console.warn(
        '[WebGPU detector results] Fixed-point accumulation overflowed; ' +
        'one or more affected detector values are invalid.'
      );
      this.detectorOverflowWarned = true;
    }
    if (this.isCancelled || state.currentRayCount === 0 ||
        state.resizeNeeded || state.pingPongIndex >= this.maxRayDepth) {
      this.nativeFinished = true;
      return;
    }
    const backend = this.engine.computeBackend;
    const encoder = this.engine.device.createCommandEncoder({
      label: 'WebGPU continued ray interactions',
    });
    backend.encodeContinuation(encoder, {
      pingPongCount: Math.min(
        backend.getPingPongCount(state.currentRayCount),
        this.maxRayDepth - state.pingPongIndex
      ),
      startDirection: state.pingPongIndex & 1,
    });
    const consumeState = backend.encodeStateReadback(encoder);
    this.engine.device.queue.submit([encoder.finish()]);
    this.trackNativeStatePromise(consumeState());
  }

  trackNativeStatePromise(promise) {
    this.nativeStatePromise = promise;
    // A replaced/cancelled run may never call advance again. Attach a handler
    // immediately so a later device-loss rejection is not reported as an
    // unhandled promise; an active run still observes the original rejection
    // when it awaits the promise above.
    promise?.catch?.(() => {});
  }

  getUpdate() {
    if (this.lastUpdate) return this.lastUpdate;
    const update = this.referenceRun.getUpdate();
    return { ...update, executionMode: this.engine.executionMode };
  }

  cancel() {
    this.isCancelled = true;
    this.referenceRun.cancel();
  }

  dispose() {
    this.cancel();
    this.referenceRun.dispose();
  }
}

/**
 * Primitive WebGPU engine.
 *
 * `device` may be a GPUDevice, a promise, or a lazy function.  Supplying a
 * 2D `ctxMain` enables the Node compatibility renderer and does not require a
 * GPU device.  Browser runs use the u32 raster-atomic accumulation buffer and
 * a separate tone-mapping pass.
 */
class WebGpuSimulationEngine {
  constructor({
    device = null,
    output = null,
    numericEpsilon = FLOAT32_EPSILON,
    ownsDevice = false,
    ctxMain = null,
    ctxVirtual = null,
    config = {},
  } = {}) {
    this.kind = 'webgpu';
    this.numericEpsilon = validateNumericEpsilon(numericEpsilon);
    this.deviceSource = device;
    this.devicePromise = null;
    this.output = output;
    this.ownsDevice = ownsDevice;
    this.ctxMain = ctxMain;
    this.ctxVirtual = ctxVirtual;
    this.runConfig = resolveWebGpuRunConfig(config);
    this.device = null;
    this.rasterizer = null;
    this.canvasRenderer = null;
    this.isInitialized = false;
    this.isDisposed = false;
    this.guardSignaturesByType = null;
    this.executionPlan = null;
    this.computeBackend = null;
    this.computePreparedScene = null;
    this.executionMode = 'node-reference';
    this.applyLegacyPowerSubsampling = false;
    this.applyRayPowerCutoffInDefaultMode = true;
    this.deferSimulationStartUntilPause = true;
    this.logExecutionDebugInfo = false;
  }

  async prepare(description, rangeOptions = {}) {
    const parameterRanges = estimateWebGpuParameterRanges(
      description,
      rangeOptions
    );
    this.guardSignaturesByType = recordWebGpuRecompilationNeeds(
      parameterRanges,
      this.guardSignaturesByType
    );
    const runtimeDescription = createF32RuntimeDescription(description);
    const referenceEngine = new CpuSimulationEngine({
      numericEpsilon: this.numericEpsilon
    });
    const prepared = await referenceEngine.prepare(runtimeDescription);
    prepared.sourceEvaluators = prepared.sourceEvaluators.map(evaluator =>
      createWebGpuSourceEvaluator(evaluator, parameterRanges.wavelengthRange)
    );
    this.executionPlan = createWebGpuExecutionPlan(
      runtimeDescription,
      parameterRanges
    );
    const dagPrograms = createWebGpuDagPrograms(
      runtimeDescription,
      parameterRanges
    );
    const packedStorage = packWebGpuScene(runtimeDescription);
    if (rangeOptions.logDebugInfo) {
      console.log(
        formatWebGpuParameterRangeSummary(parameterRanges) + '\n' +
        formatExecutionPlanSummary(this.executionPlan)
      );
    }
    return {
      ...prepared,
      description,
      runtimeDescription,
      parameterRanges,
      executionPlan: this.executionPlan,
      dagPrograms,
      packedStorage,
      originalDescription: description,
    };
  }

  async createRun(options = {}) {
    await this.initialize();
    if (this.isDisposed) throw new Error('The WebGPU engine was disposed.');
    // Match the tested scatter-plot scheduler: the first visual submission
    // clears accumulation and renders/presents the new records atomically.
    // Until that submission is ready, retain the preceding completed frame.
    let nativeStatePromise = null;
    if (this.device) {
      await this.ensureComputeBackend(options.preparedScene);
      nativeStatePromise = this.startNativeRun(options.maxRayDepth);
    }
    return new WebGpuSimulationRun(this, { ...options, nativeStatePromise });
  }

  beginRenderer({ origin, scale, lengthScale }) {
    this.canvasRenderer?.destroy?.();
    this.canvasRenderer = new WebGpuReadyRayRenderer({
      ctx: this.rasterizer ? null : this.ctxMain,
      origin,
      scale,
      lengthScale,
    });
    return this.canvasRenderer;
  }

  async initialize() {
    if (this.isInitialized) return;
    if (this.isDisposed) return;

    // Node scene tests normally have no native WebGPU implementation.  A 2D
    // output context is therefore a supported, explicit compatibility mode.
    if (!this.deviceSource || !this.output) {
      if (!this.ctxMain && this.output) {
        throw new Error('No WebGPU device is available.');
      }
      this.executionMode = 'node-reference';
      if (this.ctxMain) {
        this.rasterizer = new WebGpuCanvasRayRasterizer(this.ctxMain);
      }
      this.isInitialized = true;
      return;
    }

    if (!this.devicePromise) {
      this.devicePromise = Promise.resolve(
        typeof this.deviceSource === 'function'
          ? this.deviceSource()
          : this.deviceSource
      );
    }
    const device = await this.devicePromise;
    if (this.isDisposed) {
      if (this.ownsDevice) device?.destroy?.();
      return;
    }
    if (!device) throw new Error('No WebGPU device is available.');
    const storageBufferLimit =
      device.limits?.maxStorageBuffersPerShaderStage;
    if (
      Number.isFinite(storageBufferLimit) &&
      storageBufferLimit < WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE
    ) {
      throw new Error(
        `The WebGPU device exposes ${storageBufferLimit} storage buffers ` +
        'per shader stage, but this engine requires ' +
        `${WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE}. Request that limit ` +
        'through GPUDeviceDescriptor.requiredLimits.'
      );
    }
    if (!this.output.format) {
      throw new Error('The WebGPU output format is unavailable.');
    }
    this.device = device;
    await this.output.initialize?.(device);
    if (this.isDisposed) return;
    this.rasterizer = new WebGpuAtomicRayRasterizer(device, this.output);
    await this.rasterizer.initialize();
    this.executionMode = 'webgpu-raster-atomic';
    this.isInitialized = true;
  }

  async ensureComputeBackend(preparedScene) {
    if (this.computePreparedScene === preparedScene && this.computeBackend) {
      return;
    }
    if (this.computeBackend?.canUpdatePreparedScene(preparedScene)) {
      this.computeBackend.updatePreparedScene(preparedScene);
      this.computePreparedScene = preparedScene;
      return;
    }
    this.computeBackend?.destroy();
    this.computeBackend = null;
    this.computePreparedScene = null;
    const backend = new WebGpuComputeBackend(
      this.device,
      preparedScene,
      this.runConfig
    );
    await backend.initialize();
    if (this.isDisposed) {
      backend.destroy();
      return;
    }
    this.computeBackend = backend;
    this.computePreparedScene = preparedScene;
  }

  startNativeRun(maxRayDepthValue) {
    if (!this.computeBackend?.canEmitAllSources) return null;
    const maxRayDepth = normalizeMaxRayDepth(maxRayDepthValue);
    if (maxRayDepth === 0) return null;
    this.computeBackend.resetRunControl();
    const encoder = this.device.createCommandEncoder({
      label: 'WebGPU initial source emission and interactions',
    });
    this.computeBackend.encodeInitialTrace(encoder, {
      pingPongCount: Math.min(
        this.computeBackend.getInitialPingPongCount(),
        maxRayDepth
      )
    });
    const consumeState = this.computeBackend.encodeStateReadback(encoder);
    this.device.queue.submit([encoder.finish()]);
    return consumeState();
  }

  dispose() {
    this.isDisposed = true;
    this.canvasRenderer?.destroy?.();
    this.computeBackend?.destroy();
    this.rasterizer?.destroy?.();
    this.output?.dispose?.();
    if (this.ownsDevice) this.device?.destroy?.();
    this.canvasRenderer = null;
    this.rasterizer = null;
    this.computeBackend = null;
    this.computePreparedScene = null;
    this.device = null;
    this.deviceSource = null;
    this.executionPlan = null;
    this.guardSignaturesByType = null;
  }
}

function createWebGpuSourceEvaluator(evaluator, wavelengthRange) {
  const [minimumWavelength, maximumWavelength] = wavelengthRange[0];
  return params => {
    const output = evaluator(params);
    const result = Object.create(null);
    for (const [name, value] of Object.entries(output)) {
      result[name] = Math.fround(value);
    }
    if (
      !Number.isFinite(result.lambda) ||
      result.lambda < minimumWavelength ||
      result.lambda > maximumWavelength ||
      result.P_s > WEBGPU_MAX_POLARIZED_POWER ||
      result.P_p > WEBGPU_MAX_POLARIZED_POWER
    ) {
      result.P_s = 0;
      result.P_p = 0;
    }
    return result;
  };
}

function createF32RuntimeDescription(description) {
  return {
    ...description,
    sources: description.sources.map(instance => ({
      ...instance,
      params: packParams(instance.params, 'source parameter')
    })),
    surfaces: description.surfaces.map(instance => ({
      ...instance,
      params: packParams(instance.params, 'surface parameter')
    })),
    regions: description.regions.map(instance => ({
      ...instance,
      params: packParams(instance.params, 'bulk parameter'),
      stepSize: Math.fround(instance.stepSize),
    })),
    detectors: description.detectors.map(instance => ({
      ...instance,
      params: packParams(instance.params, 'detector parameter')
    })),
  };
}

function packParams(params, label) {
  return Object.fromEntries(Object.entries(params).map(([name, value]) => [
    name,
    clampWebGpuParameterToF32(value, `${label} ${JSON.stringify(name)}`)
  ]));
}

function formatExecutionPlanSummary(plan) {
  return '[WebGPU execution plan] ' +
    `curves=${plan.curveKindMask || 'none'} ` +
    `regionWords=${plan.regionWordCount} passes=${plan.passes.length}`;
}

function validateItemBudget(value) {
  if (value === Infinity) return value;
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError('itemBudget must be a positive integer or Infinity.');
  }
  return value;
}

function resolveWebGpuRunConfig(config) {
  const resolved = { ...DEFAULT_WEBGPU_RUN_CONFIG };
  for (const name of Object.keys(DEFAULT_WEBGPU_RUN_CONFIG)) {
    if (config[name] !== undefined) resolved[name] = config[name];
  }
  for (const name of [
    'workgroupSize',
    'maxItemsPerAdvance',
    'maxBatchRayEvents',
    'maxReadyLineRecords',
    'maxReadyPointRecords',
    'maxPingPongsPerSubmission'
  ]) {
    if (!Number.isSafeInteger(resolved[name]) || resolved[name] <= 0) {
      throw new RangeError(`${name} must be a positive safe integer.`);
    }
  }
  return Object.freeze(resolved);
}

export default WebGpuSimulationEngine;
