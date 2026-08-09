/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import { FLOAT32_EPSILON, validateNumericEpsilon } from '../../primitive/numeric.js';
import {
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
import { WebGpuMegakernelBackend } from './webGpuMegakernelBackend.js';
import {
  WebGpuAtomicRayRasterizer
} from './webGpuRayRenderer.js';
import {
  WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE
} from '../config.js';

const DEFAULT_WEBGPU_RUN_CONFIG = Object.freeze({
  workgroupSize: 64,
  maxItemsPerAdvance: 262144,
  maxBatchRayEvents: 262144,
  maxReadyLineRecords: 262144,
  maxReadyPointRecords: 65536,
  maxLocalIterations: 8,
  maxPingPongsPerSubmission: 4,
});

/**
 * A resumable megakernel WebGPU run. Source generation and membership are one
 * dispatch. Each trace invocation then keeps its current ray in local state
 * for several interactions, appends extra branches to a slot-major output
 * half, and resumes from a stable-compacted queue in the other half.
 *
 * A WebGPU run is GPU-authoritative. Environments without WebGPU must select
 * CpuSimulationEngine explicitly rather than silently executing another
 * backend through this class.
 */
class WebGpuSimulationRun {
  constructor(engine, options) {
    this.engine = engine;
    this.options = options;
    this.isCancelled = false;
    this.isComplete = false;
    this.statePromise = null;
    this.presentationPromise = null;
    this.trackNativeBatch(options.nativeBatch);
    this.nativeState = null;
    this.detectorOverflowWarned = false;
    this.geometryOverflowWarned = false;
    this.hasPresentedRun = false;
    this.lastUpdate = this.createUpdate('running', false);
  }

  async advance() {
    if (this.isStale() || this.isComplete) return this.getUpdate();
    const [state, presented] = await Promise.all([
      this.statePromise,
      this.presentationPromise,
    ]);
    this.statePromise = null;
    this.presentationPromise = null;
    if (this.isStale()) return this.getUpdate();
    this.nativeState = state;
    this.reportOverflow(state);
    if (state.resizeNeeded) {
      this.isComplete = true;
      const required = Number.isFinite(state.requiredRayCapacity)
        ? ` The interaction requires capacity for approximately ` +
          `${state.requiredRayCapacity} rays.`
        : '';
      throw new RangeError(
        'The WebGPU ray buffer is too small to complete the first tracing ' +
        `step.${required} Increase the ray buffer capacity or the minimum ` +
        'ray power threshold.'
      );
    }
    const geometryCapacity = this.engine.computeBackend
      .renderPreparationStage.geometryCapacity;
    const recordCount = Math.min(state.readyLineCount, geometryCapacity);
    if (presented !== false) {
      this.hasPresentedRun = true;
    }
    this.isComplete = state.currentRayCount === 0;
    if (!this.isComplete) await this.scheduleContinuation(state);
    this.lastUpdate = this.createUpdate(
      this.isComplete ? 'complete' : 'running',
      recordCount > 0 || this.hasPresentedRun
    );
    return this.lastUpdate;
  }

  reportOverflow(state) {
    if (state.detectorOverflow && !this.detectorOverflowWarned) {
      console.warn(
        '[WebGPU detector results] Fixed-point accumulation overflowed; ' +
        'one or more affected detector values are invalid.'
      );
      this.detectorOverflowWarned = true;
    }
    if (state.readyGeometryOverflow && !this.geometryOverflowWarned) {
      console.warn(
        '[WebGPU ready geometry] The submission exceeded its render-record ' +
        'capacity; some light geometry was omitted.'
      );
      this.geometryOverflowWarned = true;
    }
  }

  async scheduleContinuation(state) {
    const backend = this.engine.computeBackend;
    const isCancelled = () => this.isStale();
    const preparedPresentation = await this.engine.prepareNativeGeometry(
      this.options,
      { isCancelled }
    );
    if (!preparedPresentation || isCancelled()) return;
    const encoder = this.engine.device.createCommandEncoder({
      label: 'WebGPU continued megakernel tracing',
    });
    backend.encodeReadyGeometryReset(encoder);
    backend.encodeContinuation(encoder, state.pingPongIndex & 1);
    const consumeState = backend.encodeStateReadback(encoder);
    this.engine.encodeNativeGeometry(
      encoder,
      preparedPresentation,
      { resetAccumulation: false }
    );
    this.engine.device.queue.submit([encoder.finish()]);
    const completion = this.engine.rasterizer.waitForSubmittedWork();
    this.trackNativeBatch({
      statePromise: consumeState(),
      presentationPromise: completion.then(() => !isCancelled()),
    });
  }

  trackNativeBatch(batch) {
    this.statePromise = batch?.statePromise ?? null;
    this.presentationPromise = batch?.presentationPromise ?? null;
    // A replaced/cancelled run may never call advance again. Attach a handler
    // immediately so a later device-loss rejection is not reported as an
    // unhandled promise; an active run still observes the original rejection
    // when it awaits the promise above.
    this.statePromise?.catch?.(() => {});
    this.presentationPromise?.catch?.(() => {});
  }

  getUpdate() {
    return this.lastUpdate;
  }

  createUpdate(status, outputUpdated) {
    const state = this.nativeState;
    return {
      status,
      executionMode: this.engine.executionMode,
      progress: {
        processedRayCount: state?.processedRayCount ?? 0,
        totalTruncation: state?.totalTruncation ?? 0,
      },
      outputUpdated: outputUpdated && !this.isStale(),
      result: {
        detectors: state?.detectors ?? [],
        processedRayCount: state?.processedRayCount ?? 0,
        totalTruncation: state?.totalTruncation ?? 0,
        warning: null,
        warningPower: 0,
      },
    };
  }

  cancel() {
    this.isCancelled = true;
  }

  isStale() {
    return this.isCancelled || this.options.isCurrent?.() === false;
  }

  dispose() {
    this.cancel();
  }
}

/**
 * Primitive megakernel WebGPU engine.
 *
 * `device` may be a GPUDevice, a promise, or a lazy function. A device and an
 * output are required; CPU execution belongs to CpuSimulationEngine.
 */
class WebGpuSimulationEngine {
  constructor({
    device = null,
    output = null,
    numericEpsilon = FLOAT32_EPSILON,
    ownsDevice = false,
    config = {},
  } = {}) {
    this.kind = 'webgpu';
    this.numericEpsilon = validateNumericEpsilon(numericEpsilon);
    this.deviceSource = device;
    this.devicePromise = null;
    this.output = output;
    this.ownsDevice = ownsDevice;
    this.runConfig = resolveWebGpuRunConfig(config);
    this.device = null;
    this.rasterizer = null;
    this.isInitialized = false;
    this.isDisposed = false;
    this.guardSignaturesByType = null;
    this.executionPlan = null;
    this.computeBackend = null;
    this.computePreparedScene = null;
    this.pendingComputeBackend = null;
    this.pendingComputePreparedScene = null;
    this.computeBackendRequestToken = 0;
    this.executionMode = 'uninitialized';
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
      description,
      runtimeDescription,
      parameterRanges,
      executionPlan: this.executionPlan,
      dagPrograms,
      packedStorage,
      violetWavelength: rangeOptions.violetWavelength,
      redWavelength: rangeOptions.redWavelength,
      originalDescription: description,
    };
  }

  async createRun(options = {}) {
    const isCurrent = typeof options.isCurrent === 'function'
      ? options.isCurrent
      : () => true;
    await this.initialize();
    if (this.isDisposed) throw new Error('The WebGPU engine was disposed.');
    const run = new WebGpuSimulationRun(this, options);
    if (!isCurrent()) {
      run.cancel();
      return run;
    }
    // Match the tested scatter-plot scheduler: the first visual submission
    // clears accumulation and renders/presents the new records atomically.
    // Until that submission is ready, retain the preceding completed frame.
    if (this.device) {
      const backendReady = await this.ensureComputeBackend(
        options.preparedScene,
        isCurrent
      );
      if (!backendReady || !isCurrent()) {
        run.cancel();
        return run;
      }
      await this.computeBackend.configureRun(options);
      if (!isCurrent()) {
        run.cancel();
        return run;
      }
      const nativeBatch = await this.startNativeRun(options, {
        isCancelled: () => run.isStale(),
      });
      if (!nativeBatch) {
        run.cancel();
        return run;
      }
      run.trackNativeBatch(nativeBatch);
    }
    return run;
  }

  beginRenderer({ origin, scale, lengthScale }) {
    return null;
  }

  async initialize() {
    if (this.isInitialized) return;
    if (this.isDisposed) return;

    if (!this.deviceSource || !this.output) {
      throw new Error(
        'WebGpuSimulationEngine requires a WebGPU device and output. ' +
        'Use CpuSimulationEngine when WebGPU is unavailable.'
      );
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
    if (this.isDisposed) {
      this.rasterizer.destroy();
      this.rasterizer = null;
      return;
    }
    this.executionMode = 'webgpu-raster-atomic';
    this.isInitialized = true;
  }

  async ensureComputeBackend(preparedScene, isCurrent = () => true) {
    if (!isCurrent()) return false;
    const requestToken = ++this.computeBackendRequestToken;
    if (this.computePreparedScene === preparedScene && this.computeBackend) {
      this.discardPendingComputeBackend();
      return true;
    }
    if (this.computeBackend?.canUpdatePreparedScene(preparedScene)) {
      this.discardPendingComputeBackend();
      this.computeBackend.updatePreparedScene(preparedScene);
      this.computePreparedScene = preparedScene;
      return true;
    }
    if (this.pendingComputeBackend) {
      if (
        this.pendingComputePreparedScene === preparedScene ||
        this.pendingComputeBackend.canUpdatePreparedScene(preparedScene)
      ) {
        if (this.pendingComputePreparedScene !== preparedScene) {
          this.pendingComputeBackend.updatePreparedScene(preparedScene);
        }
        const previousBackend = this.computeBackend;
        this.computeBackend = this.pendingComputeBackend;
        this.computePreparedScene = preparedScene;
        this.pendingComputeBackend = null;
        this.pendingComputePreparedScene = null;
        previousBackend?.destroy();
        return true;
      }
      this.discardPendingComputeBackend();
    }
    const backend = new WebGpuMegakernelBackend(
      this.device,
      preparedScene,
      this.runConfig
    );
    try {
      await backend.initialize();
    } catch (error) {
      backend.destroy();
      if (requestToken !== this.computeBackendRequestToken || !isCurrent()) {
        return false;
      }
      throw error;
    }
    if (
      this.isDisposed ||
      requestToken !== this.computeBackendRequestToken
    ) {
      backend.destroy();
      return false;
    }
    if (!isCurrent()) {
      this.discardPendingComputeBackend();
      this.pendingComputeBackend = backend;
      this.pendingComputePreparedScene = preparedScene;
      return false;
    }
    const previousBackend = this.computeBackend;
    this.computeBackend = backend;
    this.computePreparedScene = preparedScene;
    previousBackend?.destroy();
    return true;
  }

  discardPendingComputeBackend() {
    this.pendingComputeBackend?.destroy();
    this.pendingComputeBackend = null;
    this.pendingComputePreparedScene = null;
  }

  async startNativeRun(options, { isCancelled = null } = {}) {
    if (isCancelled?.()) return null;
    if (!this.computeBackend?.canEmitAllSources) {
      throw new RangeError(
        'Source population exceeds the native WebGPU ray capacity.'
      );
    }
    const preparedPresentation = await this.prepareNativeGeometry(
      options,
      { isCancelled }
    );
    if (!preparedPresentation || isCancelled?.()) return null;
    this.computeBackend.resetRunControl();
    const encoder = this.device.createCommandEncoder({
      label: 'WebGPU initial source emission and interactions',
    });
    this.computeBackend.encodeReadyGeometryReset(encoder);
    this.computeBackend.encodeInitial(encoder);
    if (isCancelled?.()) return null;
    const consumeState = this.computeBackend.encodeStateReadback(encoder);
    this.encodeNativeGeometry(
      encoder,
      preparedPresentation,
      { resetAccumulation: true }
    );
    this.device.queue.submit([encoder.finish()]);
    const completion = this.rasterizer.waitForSubmittedWork();
    return {
      statePromise: consumeState(),
      presentationPromise: completion.then(() => !isCancelled?.()),
    };
  }

  prepareNativeGeometry(options, { isCancelled = null } = {}) {
    const stage = this.computeBackend.renderPreparationStage;
    return this.rasterizer.prepareGpuGeometryIndirect(
      stage.geometryBuffer,
      {
        origin: options.viewport?.origin ?? { x: 0, y: 0 },
        scale: options.viewport?.scale ?? 1,
        colorMode: options.colorMode ?? 'default',
        simulateColors: options.rendering?.simulateColors ?? false,
      },
      { isCancelled }
    );
  }

  encodeNativeGeometry(encoder, preparedPresentation, {
    resetAccumulation = false,
  } = {}) {
    const stage = this.computeBackend.renderPreparationStage;
    this.rasterizer.encodeGpuGeometryIndirect(
      encoder,
      stage.drawIndirectBuffer,
      preparedPresentation,
      { resetAccumulation }
    );
  }

  dispose() {
    this.isDisposed = true;
    this.computeBackendRequestToken++;
    this.discardPendingComputeBackend();
    this.computeBackend?.destroy();
    this.rasterizer?.destroy?.();
    this.output?.dispose?.();
    if (this.ownsDevice) this.device?.destroy?.();
    this.rasterizer = null;
    this.computeBackend = null;
    this.computePreparedScene = null;
    this.device = null;
    this.deviceSource = null;
    this.executionPlan = null;
    this.guardSignaturesByType = null;
  }
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
    'maxLocalIterations',
    'maxPingPongsPerSubmission'
  ]) {
    if (!Number.isSafeInteger(resolved[name]) || resolved[name] <= 0) {
      throw new RangeError(`${name} must be a positive safe integer.`);
    }
  }
  return Object.freeze(resolved);
}

export default WebGpuSimulationEngine;
