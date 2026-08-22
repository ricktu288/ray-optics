/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import {
  FLOAT32_EPSILON,
  getIntersectionTolerancePolicy,
  validateNumericEpsilon,
} from '../../primitive/numeric.js';
import {
  INTERSECTION_CONFLICT_NORMAL
} from '../../primitive/interactionCandidate.js';
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
  DEFAULT_WEBGPU_RAY_COOPERATION_CONFIG,
  WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE,
} from '../config.js';
import {
  DEFAULT_AMBIGUOUS_RAY_WARNING_SAFETY_FACTOR,
  estimateAmbiguousRayWarningPowerThreshold
} from '../ambiguousRayWarning.js';

const DEFAULT_WEBGPU_RUN_CONFIG = Object.freeze({
  workgroupSize: 64,
  ...DEFAULT_WEBGPU_RAY_COOPERATION_CONFIG,
  ambiguousRayWarningSafetyFactor:
    DEFAULT_AMBIGUOUS_RAY_WARNING_SAFETY_FACTOR,
  maxItemsPerAdvance: 262144,
  maxBatchRayEvents: 262144,
  maxReadyLineRecords: 262144,
  maxReadyPointRecords: 65536,
  atomicFixedPointScale: 1048576,
  maxBvhDepth: 16,
  maxLocalIterations: 256,
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
    this.backend = null;
    this.backendDebugInfo = null;
    this.lastSubmissionDebugInfo = null;
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
    const geometryCapacity = this.backend
      ?.renderPreparationStage.geometryCapacity ?? 0;
    const recordCount = this.engine.rasterizer
      ? Math.min(state.readyLineCount, geometryCapacity)
      : 0;
    if (presented !== false) {
      this.hasPresentedRun = true;
    }
    this.isComplete = state.currentRayCount === 0;
    if (!this.isComplete) await this.scheduleContinuation(state);
    this.lastUpdate = this.createUpdate(
      this.isComplete ? 'complete' : 'running',
      recordCount > 0 || this.hasPresentedRun
    );
    if (this.isComplete) this.logCompletedState(state);
    return this.lastUpdate;
  }

  logCompletedState(state) {
    const scene = this.options.preparedScene;
    if (!scene?.logDebugInfo) return;
    const sourceRayCount = scene?.packedStorage?.counts?.sourceRays ?? 0;
    const processedRayCount = state?.processedRayCount ?? 0;
    const allSourceRaysMissed = sourceRayCount > 0 &&
      processedRayCount === sourceRayCount;
    const debug = this.backendDebugInfo ?? {};
    const submission = this.lastSubmissionDebugInfo ?? {};
    console.log(
      '[WebGPU run result]\n' +
      `  Scene revision: ${formatDebugValue(this.options.sceneRevision)}\n` +
      `  Backend: ${formatDebugValue(debug.backendId)}, ` +
        `scene upload ${formatDebugValue(debug.sceneUploadVersion)}\n` +
      `  Last submission: ${formatDebugValue(submission.submissionId)} ` +
        `(${submission.kind ?? 'unknown'})\n` +
      `  Scene fingerprint: ${debug.sceneFingerprint ?? 'n/a'}\n` +
      `  BVH: root ${formatDebugValue(debug.bvhRoot)}, ` +
        `${formatDebugValue(debug.bvhNodeCount)} nodes, ` +
        `${formatDebugValue(debug.bvhPartitionRootCount)} partition roots, ` +
        `depth ${formatDebugValue(debug.maximumBvhDepth)} / ` +
        `${formatDebugValue(debug.maxBvhDepth)} capacity\n` +
      `  Rays: ${sourceRayCount} source, ${processedRayCount} processed, ` +
        `${state?.currentRayCount ?? 0} remaining\n` +
      `  Last batch geometry: ${state?.readyLineCount ?? 0} lines, ` +
        `${state?.readyPointCount ?? 0} points\n` +
      `  Every source ray ended at its first trace: ` +
        `${allSourceRaysMissed ? 'yes (possible all-miss failure)' : 'no'}`
    );
  }

  reportOverflow(state) {
    if (state.detectorOverflow && !this.detectorOverflowWarned) {
      console.warn(
        '[WebGPU detector results] Fixed-point accumulation overflowed; ' +
        'one or more affected detector values are invalid.'
      );
      this.detectorOverflowWarned = true;
    }
    if (
      this.engine.rasterizer &&
      state.readyGeometryOverflow &&
      !this.geometryOverflowWarned
    ) {
      console.warn(
        '[WebGPU ready geometry] The submission exceeded its render-record ' +
        'capacity; some light geometry was omitted.'
      );
      this.geometryOverflowWarned = true;
    }
  }

  async scheduleContinuation(state) {
    const backend = this.backend;
    if (!backend) return;
    const isCancelled = () => this.isStale();
    const direction = state.pingPongIndex & 1;
    await backend.prepareBatch(state.currentRayCount, direction);
    if (isCancelled()) return;
    const preparedPresentation = this.engine.rasterizer
      ? await this.engine.prepareNativeGeometry(
        this.options,
        { isCancelled, backend }
      )
      : null;
    if ((this.engine.rasterizer && !preparedPresentation) || isCancelled()) {
      return;
    }
    const encoder = this.engine.device.createCommandEncoder({
      label: 'WebGPU continued megakernel tracing',
    });
    backend.encodeReadyGeometryReset(encoder);
    backend.encodeContinuation(encoder, direction);
    const consumeState = backend.encodeStateReadback(encoder);
    if (this.engine.rasterizer) {
      this.engine.encodeNativeGeometry(
        encoder,
        preparedPresentation,
        { resetAccumulation: false, backend }
      );
    }
    this.engine.device.queue.submit([encoder.finish()]);
    const submissionDebugInfo = this.engine.createSubmissionDebugInfo(
      'continuation',
      backend
    );
    const presentationPromise = this.engine.rasterizer
      ? this.engine.rasterizer.waitForSubmittedWork()
        .then(() => !isCancelled())
      : Promise.resolve(false);
    this.trackNativeBatch({
      statePromise: consumeState(),
      presentationPromise,
      backend,
      backendDebugInfo: createBackendDebugInfo(backend),
      submissionDebugInfo,
    });
  }

  trackNativeBatch(batch) {
    this.statePromise = batch?.statePromise ?? null;
    this.presentationPromise = batch?.presentationPromise ?? null;
    if (batch?.backend) this.backend = batch.backend;
    if (batch?.backendDebugInfo) {
      this.backendDebugInfo = batch.backendDebugInfo;
    }
    if (batch?.submissionDebugInfo) {
      this.lastSubmissionDebugInfo = batch.submissionDebugInfo;
    }
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
        warning: createNormalConflictWarning(
          state,
          this.options.preparedScene?.runtimeDescription,
          this.engine.numericEpsilon,
          this.engine.runConfig.ambiguousRayWarningSafetyFactor
        ),
        warningPower: state?.ambiguousPower ?? 0,
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

export function createNormalConflictWarning(
  state,
  description,
  numericEpsilon,
  safetyFactor = DEFAULT_AMBIGUOUS_RAY_WARNING_SAFETY_FACTOR
) {
  if (!state || (state.warningFlags & 1) === 0) return null;
  const ambiguousPower = state.ambiguousPower ?? 0;
  const threshold = estimateAmbiguousRayWarningPowerThreshold({
    numericEpsilon,
    processedRayCount: state.processedRayCount,
    description,
    safetyFactor
  });
  if (!(ambiguousPower > threshold)) return null;
  const policy = getIntersectionTolerancePolicy(numericEpsilon);
  const configured = description?.numericalTolerances
    ?.interactionNormal ?? 0;
  return {
    type: INTERSECTION_CONFLICT_NORMAL,
    rayIndex: state.warningRayIndex,
    curveId: toSignedInt32(state.warningCurveId),
    conflictingCurveId: toSignedInt32(
      state.warningConflictingCurveId
    ),
    ambiguousPower,
    tolerance: {
      kind: 'interactionNormal',
      unit: 'radians',
      value: Math.min(
        Math.PI,
        Math.max(configured, policy.interactionNormal)
      ),
    },
  };
}

function toSignedInt32(value) {
  return Number.isFinite(value) ? value | 0 : -1;
}

/**
 * Primitive megakernel WebGPU engine.
 *
 * `device` may be a GPUDevice, a promise, or a lazy function. When `output` is
 * omitted, the engine runs compute and detector accumulation without creating
 * raster pipelines or presentation passes.
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
    this.nextBackendDebugId = 1;
    this.nextSubmissionDebugId = 1;
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
      parameterRanges,
      { maxBvhDepth: this.runConfig.maxBvhDepth }
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
      logDebugInfo: Boolean(rangeOptions.logDebugInfo),
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
        isCurrent,
        options.sceneRevision
      );
      if (!backendReady || !isCurrent()) {
        run.cancel();
        return run;
      }
      await this.computeBackend.configureRun({
        ...options,
        rendering: {
          ...options.rendering,
          mode: this.rasterizer ? options.rendering?.mode : 'none',
        },
      });
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

    if (!this.deviceSource) {
      throw new Error(
        'WebGpuSimulationEngine requires a WebGPU device. ' +
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
    this.device = device;
    if (this.output) {
      if (!this.output.format) {
        throw new Error('The WebGPU output format is unavailable.');
      }
      await this.output.initialize?.(device);
      if (this.isDisposed) return;
      this.rasterizer = new WebGpuAtomicRayRasterizer(
        device,
        this.output,
        this.runConfig.atomicFixedPointScale
      );
      await this.rasterizer.initialize();
      if (this.isDisposed) {
        this.rasterizer.destroy();
        this.rasterizer = null;
        return;
      }
    }
    this.executionMode = this.rasterizer
      ? 'webgpu-raster-atomic'
      : 'webgpu-headless';
    this.isInitialized = true;
  }

  async ensureComputeBackend(
    preparedScene,
    isCurrent = () => true,
    sceneRevision = null
  ) {
    if (!isCurrent()) return false;
    const requestToken = ++this.computeBackendRequestToken;
    if (this.computePreparedScene === preparedScene && this.computeBackend) {
      this.discardPendingComputeBackend();
      this.logBackendSelection('reuse-exact', preparedScene,
        this.computeBackend, sceneRevision);
      return true;
    }
    if (this.computeBackend?.canUpdatePreparedScene(preparedScene)) {
      this.discardPendingComputeBackend();
      this.computeBackend.updatePreparedScene(preparedScene);
      this.computePreparedScene = preparedScene;
      this.logBackendSelection('reuse-upload', preparedScene,
        this.computeBackend, sceneRevision);
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
        this.logBackendSelection('adopt-pending', preparedScene,
          this.computeBackend, sceneRevision);
        return true;
      }
      this.discardPendingComputeBackend();
    }
    const backend = new WebGpuMegakernelBackend(
      this.device,
      preparedScene,
      this.runConfig
    );
    backend.debugId = this.nextBackendDebugId++;
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
    this.logBackendSelection('rebuild', preparedScene, backend,
      sceneRevision);
    return true;
  }

  logBackendSelection(action, preparedScene, backend, sceneRevision = null) {
    if (!preparedScene?.logDebugInfo) return;
    const debug = createBackendDebugInfo(backend, preparedScene);
    console.log(
      '[WebGPU backend selection]\n' +
      `  Scene revision: ${formatDebugValue(sceneRevision)}\n` +
      `  Action: ${action}\n` +
      `  Backend: ${formatDebugValue(debug.backendId)}, ` +
        `scene upload ${formatDebugValue(debug.sceneUploadVersion)}\n` +
      `  Scene fingerprint: ${debug.sceneFingerprint}\n` +
      `  BVH: root ${formatDebugValue(debug.bvhRoot)}, ` +
        `${formatDebugValue(debug.bvhNodeCount)} nodes, ` +
        `${formatDebugValue(debug.bvhPartitionRootCount)} partition roots, ` +
        `depth ${formatDebugValue(debug.maximumBvhDepth)} / ` +
        `${formatDebugValue(debug.maxBvhDepth)} capacity`
    );
  }

  createSubmissionDebugInfo(kind, backend) {
    return {
      submissionId: this.nextSubmissionDebugId++,
      kind,
      backendId: backend?.debugId,
      sceneUploadVersion: backend?.sceneUploadVersion,
    };
  }

  discardPendingComputeBackend() {
    this.pendingComputeBackend?.destroy();
    this.pendingComputeBackend = null;
    this.pendingComputePreparedScene = null;
  }

  async startNativeRun(options, { isCancelled = null } = {}) {
    if (isCancelled?.()) return null;
    const backend = this.computeBackend;
    if (!backend?.canEmitAllSources) {
      throw new RangeError(
        'Source population exceeds the native WebGPU ray capacity.'
      );
    }
    const preparedPresentation = this.rasterizer
      ? await this.prepareNativeGeometry(options, { isCancelled, backend })
      : null;
    if ((this.rasterizer && !preparedPresentation) || isCancelled?.()) {
      return null;
    }
    backend.resetRunControl();
    const encoder = this.device.createCommandEncoder({
      label: 'WebGPU initial source emission and interactions',
    });
    backend.encodeReadyGeometryReset(encoder);
    backend.encodeInitial(encoder);
    if (isCancelled?.()) return null;
    const consumeState = backend.encodeStateReadback(encoder);
    if (this.rasterizer) {
      this.encodeNativeGeometry(
        encoder,
        preparedPresentation,
        { resetAccumulation: true, backend }
      );
    }
    this.device.queue.submit([encoder.finish()]);
    const submissionDebugInfo = this.createSubmissionDebugInfo(
      'initial',
      backend
    );
    const presentationPromise = this.rasterizer
      ? this.rasterizer.waitForSubmittedWork()
        .then(() => !isCancelled?.())
      : Promise.resolve(false);
    return {
      statePromise: consumeState(),
      presentationPromise,
      backend,
      backendDebugInfo: createBackendDebugInfo(
        backend,
        options.preparedScene
      ),
      submissionDebugInfo,
    };
  }

  prepareNativeGeometry(options, {
    isCancelled = null,
    backend = this.computeBackend,
  } = {}) {
    const stage = backend.renderPreparationStage;
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
    backend = this.computeBackend,
  } = {}) {
    const stage = backend.renderPreparationStage;
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
    `regionWords=${plan.regionWordCount} ` +
    `bvhDepth=${plan.maximumBvhDepth}/${plan.maxBvhDepth} ` +
    `passes=${plan.passes.length}`;
}

function createBackendDebugInfo(backend, preparedScene = null) {
  const scene = preparedScene ?? backend?.preparedScene;
  const packed = scene?.packedStorage;
  return {
    backendId: backend?.debugId,
    sceneUploadVersion: backend?.sceneUploadVersion,
    sceneFingerprint: createSceneFingerprint(packed),
    bvhRoot: scene?.runtimeDescription?.bvh?.root,
    bvhNodeCount: packed?.counts?.bvhNodes,
    bvhPartitionRootCount: packed?.counts?.bvhPartitionRoots,
    maximumBvhDepth: scene?.executionPlan?.maximumBvhDepth,
    maxBvhDepth: scene?.executionPlan?.maxBvhDepth,
  };
}

function createSceneFingerprint(packed) {
  if (!packed) return 'n/a';
  let hash = 2166136261;
  for (const name of [
    'curveGeometry', 'curveDescriptors', 'bvhNodes',
    'bvhPartitionRoots', 'bvhCurveIds'
  ]) {
    const value = packed[name];
    if (!value) continue;
    const bytes = value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    for (const byte of bytes) {
      hash ^= byte;
      hash = Math.imul(hash, 16777619);
    }
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function formatDebugValue(value) {
  return value === undefined || value === null ? 'n/a' : String(value);
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
    'atomicFixedPointScale',
    'maxBvhDepth',
    'maxLocalIterations',
    'maxPingPongsPerSubmission',
    'rayCooperationSaturationRayCount',
    'rayCooperationMaximumLanesPerRay',
  ]) {
    if (!Number.isSafeInteger(resolved[name]) || resolved[name] <= 0) {
      throw new RangeError(`${name} must be a positive safe integer.`);
    }
  }
  if (resolved.atomicFixedPointScale > 16777216) {
    throw new RangeError(
      'atomicFixedPointScale must not exceed 16777216.'
    );
  }
  if (!Number.isFinite(resolved.ambiguousRayWarningSafetyFactor) ||
      resolved.ambiguousRayWarningSafetyFactor < 0) {
    throw new RangeError(
      'ambiguousRayWarningSafetyFactor must be finite and nonnegative.'
    );
  }
  for (const name of ['rayCooperationDirectMaxTestsPerLane']) {
    if (!Number.isFinite(resolved[name]) || resolved[name] < 0) {
      throw new RangeError(`${name} must be finite and nonnegative.`);
    }
  }
  if (!Number.isFinite(resolved.rayCooperationMaximumHaloFraction) ||
      resolved.rayCooperationMaximumHaloFraction < 0 ||
      resolved.rayCooperationMaximumHaloFraction >= 1) {
    throw new RangeError(
      'rayCooperationMaximumHaloFraction must be in [0, 1).'
    );
  }
  if (typeof resolved.rayCooperationEnabled !== 'boolean') {
    throw new TypeError('rayCooperationEnabled must be boolean.');
  }
  return Object.freeze(resolved);
}

export default WebGpuSimulationEngine;
