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
import { BVH_MAX_GROUP_EXTENT } from './primitive/bvh.js';
import { drawPreparedCurve } from './primitive/drawPreparedCurve.js';
import { preprocessPrimitives } from './primitive/preprocess.js';
import {
  formatPrimitiveCurveReference
} from './primitive/diagnosticReference.js';
import {
  INTERSECTION_CONFLICT_MERGE,
  INTERSECTION_CONFLICT_NORMAL,
  INTERSECTION_CONFLICT_ORIENTATION
} from './primitive/interactionCandidate.js';
import {
  DEFAULT_WEBGPU_WORKLOAD_THRESHOLD,
  getPrimitiveEngineWorkloadScore,
  selectPrimitiveEngineKind,
  summarizePrimitiveWorkload
} from './simulationEngines/primitiveEngineSelection.js';
import {
  DEFAULT_PRIMITIVE_NUMERICAL_TOLERANCES
} from './simulationEngines/config.js';
import {
  getEffectiveRayPowerOptions
} from './simulationEngines/rayPower.js';

const UV_WAVELENGTH = 380;
const VIOLET_WAVELENGTH = 420;
const BLUE_WAVELENGTH = 460;
const CYAN_WAVELENGTH = 500;
const GREEN_WAVELENGTH = 540;
const YELLOW_WAVELENGTH = 580;
const RED_WAVELENGTH = 620;
const INFRARED_WAVELENGTH = 700;
const AUTOMATIC_COMPARISON_MIN_RUNTIME_MS = 50;
const AUTOMATIC_CPU_PREFERENCE_RUNTIME_MS = 20;
const AUTOMATIC_COMPARISON_PAUSE_MS = 50;

function formatPrimitiveEngineWarning(warning) {
  if (!warning.tolerance) return null;
  const warningKey = {
    [INTERSECTION_CONFLICT_MERGE]: 'primitiveMergeConflict',
    [INTERSECTION_CONFLICT_ORIENTATION]: 'primitiveOrientationConflict',
    [INTERSECTION_CONFLICT_NORMAL]: 'primitiveNormalConflict'
  }[warning.type];
  if (!warningKey) {
    throw new Error(
      `Unknown primitive interaction warning type: ${warning.type}`
    );
  }
  return i18next.t(
    `simulator:generalWarnings.${warningKey}`, {
      curveId: formatWarningCurveId(warning.curveId),
      conflictingCurveId: formatWarningCurveId(
        warning.conflictingCurveId
      )
    }
  );
}

function formatWarningCurveId(curveId) {
  return Number.isSafeInteger(curveId) && curveId >= 0
    ? formatPrimitiveCurveReference(curveId)
    : String(curveId)
}

/**
 * Primitive simulator coordinating shared preprocessing, rendering, and a
 * lazily instantiated registry of execution engines.
 */
class PrimitiveBasedSimulator {
  /**
   * @param {Object} options
   * @param {Scene} options.scene
   * @param {CpuSimulationEngine|WebGpuSimulationEngine} [options.engine]
   * @param {Object<string, Function|Object>} [options.engineProviders]
   * @param {'automatic'|'primitiveCpu'|'webgpu'|string} [options.enginePreference]
   * @param {Function} [options.engineSelector]
   * @param {CanvasRenderingContext2D|null} [options.ctxBelowLight]
   * @param {CanvasRenderingContext2D|null} [options.ctxAboveLight]
   * @param {CanvasRenderingContext2D|null} [options.ctxGrid]
   * @param {CanvasRenderingContext2D|null} [options.ctxVirtual]
   * @param {boolean} [options.enableTimer=false]
   * @param {number} [options.rayCountLimit=Infinity]
   * @param {function|null} [options.tempCanvasFactory=null]
   * @param {Object} [options.numericalTolerances]
   */
  constructor({
    scene,
    engine = null,
    engineProviders = null,
    enginePreference = 'automatic',
    engineSelector = selectPrimitiveEngineKind,
    ctxBelowLight = null,
    ctxAboveLight = null,
    ctxGrid = null,
    ctxVirtual = null,
    enableTimer = false,
    rayCountLimit = Infinity,
    tempCanvasFactory = null,
    numericalTolerances = DEFAULT_PRIMITIVE_NUMERICAL_TOLERANCES,
  }) {
    this.scene = scene;
    this.ctxBelowLight = ctxBelowLight;
    this.ctxAboveLight = ctxAboveLight;
    this.ctxGrid = ctxGrid;
    this.ctxVirtual = ctxVirtual;
    this.enableTimer = enableTimer;
    this.rayCountLimit = rayCountLimit;
    this.tempCanvasFactory = tempCanvasFactory;
    this.numericalTolerances = { ...numericalTolerances };

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
    this.preprocessingWarning = null;
    this.engineWarning = null;
    this.engineFallbackWarning = null;
    this.eventListeners = {};

    this.engineProviders = normalizeEngineProviders(engineProviders);
    if (typeof engineSelector !== 'function') {
      throw new TypeError('engineSelector must be a function.');
    }
    this.engineSelector = engineSelector;
    this.engines = new Map();
    if (engine) {
      this.engineProviders.set(engine.kind, {
        create: () => engine,
        isSupported: () => true
      });
      this.engines.set(engine.kind, engine);
      this.enginePreference = engine.kind;
    } else {
      this.enginePreference = enginePreference;
    }
    if (this.engineProviders.size === 0) {
      throw new TypeError('At least one primitive simulation engine is required.');
    }
    this.automaticEngineWinner = null;
    this.workload = summarizePrimitiveWorkload([]);
    const initialEngineKind = this.selectEngineKind(this.workload);
    this.engine = this.getEngine(initialEngineKind);
    this.engineFallbackActive = false;
    this.presentedEngineKind = initialEngineKind;
    this.presentedEngineFallback = false;
    this.canvasRendererBelowLight = null;
    this.canvasRendererAboveLight = null;
    this.canvasRendererGrid = null;

    this.activeRun = null;
    this.silentActiveRun = null;
    this.runGeneration = 0;
    this.runFrameRequest = null;
    this.pendingRunJob = null;
    this.runLoopActive = false;
    this.comparisonTimer = null;
    this.comparisonRunPromise = null;
    this.benchmarkEngines = new Map();
    this.isRunning = false;
    this.simulationStartPending = false;
    this.primitives = [];
    const initialPreprocessing = preprocessPrimitives([], {
      lengthScale: this.scene.lengthScale,
      numericalTolerances: this.numericalTolerances,
      numericEpsilon: this.engine.numericEpsilon
    });
    this.processedScene = initialPreprocessing.processedScene;
    this.detectorResultBindings = initialPreprocessing.detectorResultBindings;
    this.primitiveBvh = this.processedScene.bvh;
  }

  setEnginePreference(preference) {
    if (preference !== 'automatic' && !this.engineProviders.has(preference)) {
      throw new RangeError(`Unknown primitive engine preference: ${preference}`);
    }
    if (preference !== this.enginePreference) {
      this.automaticEngineWinner = null;
    }
    this.enginePreference = preference;
  }

  selectEngineKind(workload) {
    return this.getEngineSelectionDecision(workload).selectedEngineKind;
  }

  selectFormulaEngineKind(workload) {
    const selected = this.engineSelector({
      preference: this.enginePreference,
      workload,
      isAvailable: kind => this.isEngineAvailable(kind),
    });
    if (this.engineProviders.has(selected)) return selected;
    if (this.engineProviders.has('primitiveCpu')) return 'primitiveCpu';
    return this.engineProviders.keys().next().value;
  }

  isAutomaticComparisonEligible() {
    return this.enginePreference === 'automatic' &&
      this.isEngineAvailable('primitiveCpu') &&
      this.isEngineAvailable('webgpu');
  }

  getEngineSelectionDecision(workload) {
    const formulaEngineKind = this.selectFormulaEngineKind(workload);
    const workloadScore = getPrimitiveEngineWorkloadScore(workload);
    const crossover = DEFAULT_WEBGPU_WORKLOAD_THRESHOLD;
    const crossoverRatio = crossover > 0
      ? workloadScore / crossover
      : null;
    const comparisonEligible = this.isAutomaticComparisonEligible();
    const learnedEngineKind = this.enginePreference === 'automatic' &&
      this.isEngineAvailable(this.automaticEngineWinner)
      ? this.automaticEngineWinner
      : null;
    const grinWebGpuFirst = this.enginePreference === 'automatic' &&
      workload?.hasGrinRegion && formulaEngineKind === 'webgpu';
    const selectedEngineKind = grinWebGpuFirst
      ? formulaEngineKind
      : learnedEngineKind ?? formulaEngineKind;
    let reason = 'formula';
    if (grinWebGpuFirst) reason = 'grin-region';
    else if (learnedEngineKind) reason = 'previous-comparison-winner';
    else if (this.enginePreference !== 'automatic') reason = 'forced-preference';
    else if (!comparisonEligible) reason = 'comparison-unavailable';
    return {
      preference: this.enginePreference,
      workload: { ...workload },
      workloadScore,
      crossover,
      crossoverRatio,
      comparisonEligible,
      cpuAvailable: this.isEngineAvailable('primitiveCpu'),
      webGpuAvailable: this.isEngineAvailable('webgpu'),
      formulaEngineKind,
      learnedEngineKind: this.automaticEngineWinner ?? null,
      selectedEngineKind,
      reason,
    };
  }

  isEngineAvailable(kind) {
    const provider = this.engineProviders.get(kind);
    if (!provider) return false;
    try {
      return provider.isSupported?.() !== false;
    } catch (_) {
      return false;
    }
  }

  getEngine(kind) {
    let engine = this.engines.get(kind);
    if (engine) return engine;
    const provider = this.engineProviders.get(kind);
    if (!provider) throw new RangeError(`No primitive engine provider for ${kind}.`);
    engine = provider.create();
    if (!engine || typeof engine.then === 'function' || engine.kind !== kind) {
      throw new TypeError(
        `Primitive engine provider ${kind} must synchronously create that engine.`
      );
    }
    this.engines.set(kind, engine);
    return engine;
  }

  getBenchmarkEngine(kind) {
    let engine = this.benchmarkEngines.get(kind);
    if (engine) return engine;
    const provider = this.engineProviders.get(kind);
    if (!provider) throw new RangeError(`No primitive engine provider for ${kind}.`);
    engine = provider.create({ silent: true });
    if (!engine || typeof engine.then === 'function' || engine.kind !== kind) {
      throw new TypeError(
        `Primitive engine provider ${kind} must synchronously create that engine.`
      );
    }
    // A provider returning its foreground singleton cannot render a silent
    // comparison without corrupting the visible run.
    if (engine === this.engines.get(kind)) {
      throw new Error(`Primitive engine provider ${kind} has no silent engine.`);
    }
    this.benchmarkEngines.set(kind, engine);
    return engine;
  }

  activateEngine(kind, { fallback = false, deferPresentation = false } = {}) {
    this.engine = this.getEngine(kind);
    this.engineFallbackActive = fallback;
    if (!deferPresentation) this.presentEngine(kind, { fallback });
  }

  presentEngine(kind, { fallback = false } = {}) {
    const previousKind = this.presentedEngineKind;
    const previousFallback = this.presentedEngineFallback;
    this.presentedEngineKind = kind;
    this.presentedEngineFallback = fallback;
    if (previousKind !== kind || previousFallback !== fallback) {
      this.emit('engineChange', {
        kind,
        previousKind,
        fallback,
        preference: this.enginePreference,
        workload: this.workload
      });
    }
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
    if (skipLight) {
      this.drawSceneLayers(skipGrid);
      this.emit('requestUpdateErrorAndWarning');
      return;
    }

    const generation = ++this.runGeneration;
    this.cancelObsoleteWork();
    this.collectAndPreprocessPrimitives();
    this.drawSceneLayers(skipGrid);
    this.processedRayCount = 0;
    this.totalTruncation = 0;
    this.simulationStartTime = new Date();
    this.error = null;
    this.isRunning = true;
    this.simulationStartPending = Boolean(
      this.engine.deferSimulationStartUntilPause
    );
    this.isLightLayerSynced = true;
    this.emit('lightLayerSyncChange', { isSynced: true });
    if (!this.simulationStartPending) this.emit('simulationStart', null);
    this.scheduleRun(this.createRunJob(generation));
  }

  cancelObsoleteWork() {
    this.pendingRunJob = null;
    this.activeRun?.cancel?.();
    this.silentActiveRun?.cancel?.();
    if (this.comparisonTimer !== null) {
      clearTimeout(this.comparisonTimer);
      this.comparisonTimer = null;
    }
  }

  createRunJob(generation, overrides = {}) {
    const engine = overrides.engine ?? this.engine;
    const origin = this.scene.origin ?? { x: 0, y: 0 };
    const rayPowerOptions = getEffectiveRayPowerOptions(this.scene);
    return {
      generation,
      engine,
      engineKind: engine.kind,
      fallback: overrides.fallback ?? this.engineFallbackActive,
      processedScene: overrides.processedScene ?? this.processedScene,
      detectorResultBindings:
        overrides.detectorResultBindings ?? this.detectorResultBindings,
      primitives: overrides.primitives ?? this.primitives.slice(),
      workload: overrides.workload ?? this.workload,
      comparisonEligible: overrides.comparisonEligible ??
        this.isAutomaticComparisonEligible(),
      viewport: {
        origin: {
          x: (origin.x ?? 0) * this.dpr,
          y: (origin.y ?? 0) * this.dpr,
        },
        scale: (this.scene.scale ?? 1) * this.dpr,
        lengthScale: this.scene.lengthScale,
      },
      sceneOptions: {
        violetWavelength: this.scene.violetWavelength,
        redWavelength: this.scene.redWavelength,
        keepNonVisibleLight: this.scene.keepNonVisibleLight,
        colorMode: this.scene.colorMode,
        rayPowerCutoff: rayPowerOptions.rayPowerCutoff,
        rayPowerSampling: rayPowerOptions.rayPowerSampling,
        maxRayDepth: this.scene.maxRayDepth,
        mode: this.scene.mode,
        simulateColors: this.scene.simulateColors,
        showRayArrows: this.scene.showRayArrows,
        observer: this.scene.observer,
        numericalTolerances: { ...this.numericalTolerances },
        lengthScale: this.scene.lengthScale,
      },
    };
  }

  scheduleRun(job) {
    this.pendingRunJob = job;
    if (this.runLoopActive || this.runFrameRequest !== null) return;
    const launch = () => {
      this.runFrameRequest = null;
      this.runPendingRuns();
    };
    if (isWebGpuEngine(job.engine) &&
        typeof requestAnimationFrame === 'function') {
      this.runFrameRequest = requestAnimationFrame(launch);
    } else {
      this.runFrameRequest = true;
      Promise.resolve().then(launch);
    }
  }

  async runPendingRuns() {
    if (this.runLoopActive) return;
    this.runLoopActive = true;
    try {
      while (this.pendingRunJob) {
        const job = this.pendingRunJob;
        this.pendingRunJob = null;
        if (job.generation !== this.runGeneration) continue;
        // Engines and canvases are never shared by overlapping foreground
        // revisions. An update cancels the active revision and replaces the
        // one pending slot with its newest complete snapshot.
        await this.startEngineRun(job);
      }
    } finally {
      this.runLoopActive = false;
      if (this.pendingRunJob) {
        this.scheduleRun(this.pendingRunJob);
      }
    }
  }

  async startEngineRun(job) {
    if (typeof job === 'number') job = this.createRunJob(job);
    let result = null;
    try {
      result = await this.runEngine(job);
    } catch (error) {
      if (job.generation !== this.runGeneration) return;
      if (isWebGpuEngine(job.engine) &&
          this.engineProviders.has('primitiveCpu')) {
        try {
          result = await this.fallbackToCpu(job, error);
        } catch (fallbackError) {
          if (job.generation !== this.runGeneration) return;
          this.activeRun?.dispose?.();
          this.activeRun = null;
          this.error = fallbackError.message ||
            i18next.t('simulator:settings.correctBrightness.error');
        }
      } else {
        this.activeRun?.dispose?.();
        this.activeRun = null;
        this.error = error.message ||
          i18next.t('simulator:settings.correctBrightness.error');
      }
    }
    if (job.generation !== this.runGeneration) return;
    this.completeRun(job.generation);
    if (result?.completed) {
      this.scheduleAutomaticComparison(result.job, result.durationMs);
    }
  }

  async fallbackToCpu(job, webGpuError) {
    // Restart the complete simulation for this scene-update revision. Engine
    // selection never changes within a bounce or megakernel ping-pong.
    this.activeRun?.cancel?.();
    this.activeRun?.dispose?.();
    this.activeRun = null;
    this.engineFallbackWarning = i18next.t(
      'simulator:simulationEngineModal.webgpu.fallback',
      { message: webGpuError.message }
    );
    this.activateEngine('primitiveCpu', {
      fallback: true,
      deferPresentation: true,
    });
    this.preprocessCollectedPrimitives();
    this.refreshWarning();
    if (this.simulationStartPending) {
      this.simulationStartPending = false;
      this.emit('simulationStart', null);
    }
    const fallbackJob = this.createRunJob(job.generation, {
      engine: this.engine,
      fallback: true,
      processedScene: this.processedScene,
      detectorResultBindings: this.detectorResultBindings,
      comparisonEligible: false,
    });
    return this.runEngine(fallbackJob);
  }

  async runEngine(job, {
    silent = false,
    timeLimitMs = Infinity,
  } = {}) {
    if (typeof job === 'number') job = this.createRunJob(job);
    const activeRunKey = silent ? 'silentActiveRun' : 'activeRun';
    const previousRun = this[activeRunKey];
    this[activeRunKey] = null;
    previousRun?.cancel?.();
    previousRun?.dispose?.();

    const isCurrent = () => job.generation === this.runGeneration;
    const preparedScene = await job.engine.prepare(job.processedScene, {
      violetWavelength: job.sceneOptions.violetWavelength,
      redWavelength: job.sceneOptions.redWavelength,
      keepNonVisibleLight: job.sceneOptions.keepNonVisibleLight
    });
    if (!isCurrent()) return { completed: false, job, durationMs: 0 };

    const run = await job.engine.createRun({
      preparedScene,
      isCurrent,
      viewport: job.viewport,
      colorMode: job.sceneOptions.colorMode,
      rayPowerCutoff: job.sceneOptions.rayPowerCutoff,
      rayPowerSampling: job.sceneOptions.rayPowerSampling,
      rayCountLimit: this.rayCountLimit,
      maxRayDepth: job.sceneOptions.maxRayDepth,
      sceneRevision: job.generation,
      rendering: {
        mode: job.sceneOptions.mode,
        simulateColors: job.sceneOptions.simulateColors,
        showRayArrows: job.sceneOptions.showRayArrows,
        observer: job.sceneOptions.observer,
        wavelengthToColor: (wavelength, brightness, transform) =>
          this.wavelengthToColor(wavelength, brightness, transform),
        getThemeRayColor: (rayType, alpha) =>
          this.getThemeRayColor(rayType, alpha),
        getThemeRayDash: rayType => this.getThemeRayDash(rayType),
        getThemeImageColor: (imageType, alpha) =>
          this.getThemeImageColor(imageType, alpha),
        getThemeImageSize: imageType =>
          this.getThemeImageSize(imageType)
      },
    });
    if (!isCurrent()) {
      run.cancel?.();
      run.dispose?.();
      return { completed: false, job, durationMs: 0 };
    }
    this[activeRunKey] = run;

    let update;
    let durationMs = 0;
    try {
      do {
        const remainingMs = Math.max(1, timeLimitMs - durationMs);
        const advanceStart = monotonicNow();
        update = await run.advance({
          timeBudgetMs: silent
            ? Math.min(job.engine.timeBudgetMs ?? 200, remainingMs)
            : this.enableTimer
              ? (job.engine.timeBudgetMs ?? 200)
              : Infinity,
        });
        durationMs += monotonicNow() - advanceStart;
        if (!isCurrent()) {
          run.cancel?.();
          return { completed: false, job, durationMs };
        }

        if (silent) {
          if (update.status !== 'complete' && durationMs >= timeLimitMs) {
            run.cancel?.();
            return { completed: false, slower: true, job, durationMs };
          }
        } else {
          this.publishRunUpdate(update, job.detectorResultBindings);
          this.presentEngine(job.engineKind, { fallback: job.fallback });
          if (update.status !== 'complete') {
            if (this.simulationStartPending) {
              this.simulationStartPending = false;
              this.emit('simulationStart', null);
            }
            this.emit('simulationPause', null);
          }
          this.updateSimulation(true, true);
        }
        if (update.status !== 'complete' && (this.enableTimer || silent)) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } while (update.status !== 'complete');
    } finally {
      run.dispose?.();
      if (this[activeRunKey] === run) this[activeRunKey] = null;
    }
    return { completed: true, job, durationMs };
  }

  scheduleAutomaticComparison(job, firstDurationMs) {
    // A forced engine preference cannot produce or consume an automatic
    // comparison result.
    if (this.enginePreference !== 'automatic') return;
    const challengerKind = job.engineKind === 'webgpu'
      ? 'primitiveCpu'
      : 'webgpu';
    const cpuAvailable = this.isEngineAvailable('primitiveCpu');
    const webGpuAvailable = this.isEngineAvailable('webgpu');
    if (job.generation !== this.runGeneration || job.fallback) return;
    if (!cpuAvailable || !webGpuAvailable) return;
    if (challengerKind === 'primitiveCpu') {
      // In Automatic mode CPU is always tried after WebGPU, even when the
      // WebGPU foreground run is below the normal comparison threshold.
    } else {
      if (!(firstDurationMs > AUTOMATIC_COMPARISON_MIN_RUNTIME_MS)) {
        return;
      }
    }
    this.comparisonTimer = setTimeout(() => {
      this.comparisonTimer = null;
      this.queueAutomaticComparison(job, firstDurationMs, challengerKind);
    }, AUTOMATIC_COMPARISON_PAUSE_MS);
  }

  queueAutomaticComparison(firstJob, firstDurationMs, challengerKind) {
    const previous = this.comparisonRunPromise;
    const current = (async () => {
      try {
        await previous;
      } catch (_) {
        // runAutomaticComparison handles its own failures. Keep the queue
        // moving if an unexpected rejection escaped an older revision.
      }
      if (firstJob.generation !== this.runGeneration) return;
      await this.runAutomaticComparison(
        firstJob,
        firstDurationMs,
        challengerKind
      );
    })();
    this.comparisonRunPromise = current;
    current.finally(() => {
      if (this.comparisonRunPromise === current) {
        this.comparisonRunPromise = null;
      }
    });
  }

  async runAutomaticComparison(firstJob, firstDurationMs, challengerKind) {
    if (firstJob.generation !== this.runGeneration ||
        this.isRunning ||
        this.enginePreference !== 'automatic') return;
    try {
      const engine = this.getBenchmarkEngine(challengerKind);
      this.resizeBenchmarkEngineOutput(engine);
      const preprocessing = preprocessPrimitives(firstJob.primitives, {
        lengthScale: firstJob.sceneOptions.lengthScale,
        numericalTolerances: firstJob.sceneOptions.numericalTolerances,
        numericEpsilon: engine.numericEpsilon,
        bvhOptions: {
          maxGroupExtent:
            BVH_MAX_GROUP_EXTENT *
            firstJob.sceneOptions.lengthScale
        }
      });
      if (firstJob.generation !== this.runGeneration) return;
      const challengerJob = {
        ...firstJob,
        engine,
        engineKind: challengerKind,
        fallback: false,
        comparisonEligible: false,
        processedScene: preprocessing.processedScene,
        detectorResultBindings: preprocessing.detectorResultBindings,
      };
      const challengerTimeLimitMs = challengerKind === 'primitiveCpu'
        ? Math.max(
          firstDurationMs,
          AUTOMATIC_CPU_PREFERENCE_RUNTIME_MS
        )
        : firstDurationMs;
      const result = await this.runEngine(challengerJob, {
        silent: true,
        timeLimitMs: challengerTimeLimitMs,
      });
      if (firstJob.generation !== this.runGeneration) return;
      const cpuPreferredForResponsiveness =
        challengerKind === 'primitiveCpu' &&
        result.completed &&
        result.durationMs < AUTOMATIC_CPU_PREFERENCE_RUNTIME_MS;
      const challengerWon = result.completed &&
        (result.durationMs < firstDurationMs ||
          cpuPreferredForResponsiveness);
      this.automaticEngineWinner = challengerWon
        ? challengerKind
        : firstJob.engineKind;
    } catch (_) {
      if (firstJob.generation !== this.runGeneration) return;
      // A silent comparison must not become a user-visible simulation error.
      // Keep the successful foreground engine when the challenger is unusable.
      this.automaticEngineWinner = firstJob.engineKind;
    }
  }

  resizeBenchmarkEngineOutput(engine) {
    const referenceCanvas = this.ctxAboveLight?.canvas ??
      this.ctxBelowLight?.canvas;
    if (!referenceCanvas) return;
    const { width, height } = referenceCanvas;
    for (const canvas of [
      engine.ctxMain?.canvas,
      engine.glMain?.canvas,
      engine.ctxVirtual?.canvas,
    ]) {
      if (!canvas) continue;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
    }
    engine.output?.resize?.(width, height);
  }

  publishRunUpdate(update, detectorResultBindings = this.detectorResultBindings) {
    this.processedRayCount =
      update.progress?.processedRayCount ?? this.processedRayCount;
    this.totalTruncation =
      update.progress?.totalTruncation ?? this.totalTruncation;
    const detectorResults = update.result?.detectors ?? [];
    for (const binding of detectorResultBindings) {
      const values = detectorResults[binding.resultId];
      if (values) binding.result.values = values;
    }
    if (update.result?.warning) {
      this.engineWarning = update.result.warning;
      this.refreshWarning();
    }
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
      this.drawExternalHighlightPrimitiveCurves(
        this.canvasRendererAboveLight
      );
      this.drawExternalHighlightPoints(this.canvasRendererAboveLight);
      this.drawObserver();
    }
  }

  collectAndPreprocessPrimitives() {
    const primitives = [];
    let brightnessScale = 0;
    for (const obj of this.scene.opticalObjs) {
      const objPrimitives = obj.getPrimitives();
      if (Array.isArray(objPrimitives)) {
        primitives.push(...objPrimitives);
      }
      if (this.scene.colorMode !== 'default' || !obj.brightnessScale) {
        continue;
      }
      if (brightnessScale === 0) {
        brightnessScale = obj.brightnessScale;
      } else if (brightnessScale !== obj.brightnessScale) {
        brightnessScale = -1;
      }
    }
    this.brightnessScale = this.scene.colorMode === 'default'
      ? brightnessScale
      : 0;
    const hasDetector = primitives.some(
      primitive => primitive?.kind === 'detector'
    );
    this.preprocessingWarning = this.brightnessScale === -1 &&
      (hasDetector || this.scene.simulateColors)
      ? i18next.t('simulator:generalWarnings.brightnessInconsistent')
      : null;
    this.engineWarning = null;
    this.engineFallbackWarning = null;
    this.refreshWarning();

    this.primitives = primitives;
    this.workload = summarizePrimitiveWorkload(primitives);
    const selectionDecision = this.getEngineSelectionDecision(this.workload);
    this.activateEngine(selectionDecision.selectedEngineKind, {
      fallback: false,
      deferPresentation: true,
    });
    this.preprocessCollectedPrimitives();
  }

  preprocessCollectedPrimitives() {
    const {
      processedScene,
      detectorResultBindings
    } = preprocessPrimitives(this.primitives, {
      lengthScale: this.scene.lengthScale,
      numericalTolerances: this.numericalTolerances,
      numericEpsilon: this.engine.numericEpsilon,
      bvhOptions: {
        maxGroupExtent:
          BVH_MAX_GROUP_EXTENT *
          this.scene.lengthScale
      }
    });
    this.processedScene = processedScene;
    this.detectorResultBindings = detectorResultBindings;
    this.primitiveBvh = processedScene.bvh;
  }

  refreshWarning() {
    const warnings = [this.preprocessingWarning];
    if (this.engineFallbackWarning) {
      warnings.push(this.engineFallbackWarning);
    }
    if (this.engineWarning) {
      warnings.push(formatPrimitiveEngineWarning(this.engineWarning));
    }
    this.warning = warnings.filter(Boolean).join('<br>');
    if (!this.warning) this.warning = null;
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

  drawExternalHighlightPrimitiveCurves(canvasRenderer) {
    const curveIds =
      this.scene.editor?.externalHighlightPrimitiveCurveIds;
    if (!canvasRenderer?.ctx || !curveIds?.length) return;

    for (const curveId of curveIds) {
      const geometry = this.processedScene?.curves[curveId]?.geometry;
      if (!geometry) continue;
      drawPreparedCurve(
        canvasRenderer,
        geometry,
        this.scene.highlightColor,
        3
      );
    }
  }

  completeRun(generation) {
    if (generation !== this.runGeneration) return;
    this.isRunning = false;
    this.simulationStartPending = false;
    this.emit('requestUpdateErrorAndWarning');
    this.emit('simulationComplete', null);
  }

  manualRedrawLightLayer() {
    this.updateSimulation(false, true, true);
  }

  stopSimulation() {
    const wasRunning = this.isRunning;
    this.runGeneration++;
    this.pendingRunJob = null;
    if (
      this.runFrameRequest !== null &&
      this.runFrameRequest !== true &&
      typeof cancelAnimationFrame === 'function'
    ) cancelAnimationFrame(this.runFrameRequest);
    this.runFrameRequest = null;
    if (this.comparisonTimer !== null) clearTimeout(this.comparisonTimer);
    this.comparisonTimer = null;
    this.activeRun?.cancel?.();
    this.activeRun?.dispose?.();
    this.activeRun = null;
    this.silentActiveRun?.cancel?.();
    this.silentActiveRun?.dispose?.();
    this.silentActiveRun = null;
    this.isRunning = false;
    this.simulationStartPending = false;
    if (wasRunning) this.emit('simulationStop', null);
  }

  destroy() {
    this.stopSimulation();
    for (const engine of new Set(this.engines.values())) {
      engine.dispose?.();
    }
    for (const engine of new Set(this.benchmarkEngines.values())) {
      engine.dispose?.();
    }
    this.engines.clear();
    this.benchmarkEngines.clear();
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

    const keepNonVisibleLight = Boolean(
      this.scene.keepNonVisibleLight &&
      Number.isFinite(wavelength) &&
      wavelength > 0
    );

    if ((keepNonVisibleLight && wavelength < targetViolet) ||
        (wavelength >= uvWavelength && wavelength < targetViolet)) {
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
    } else if (wavelength >= targetRed &&
               (keepNonVisibleLight || wavelength <= infraredWavelength)) {
      r = 1;
      g = 0;
      b = 0;
    } else {
      r = 0;
      g = 0;
      b = 0;
    }

    const fadeLimit = keepNonVisibleLight ? 0.25 : 0;
    if (wavelength > infraredWavelength || wavelength < uvWavelength) {
      spectralIntensity = fadeLimit;
    } else if (wavelength > targetRed) {
      spectralIntensity = keepNonVisibleLight
        ? 1 - (1 - fadeLimit) *
          (wavelength - targetRed) / (infraredWavelength - targetRed)
        : (infraredWavelength - wavelength) /
          (infraredWavelength - targetRed);
    } else if (wavelength < targetViolet) {
      spectralIntensity = keepNonVisibleLight
        ? 1 - (1 - fadeLimit) *
          (targetViolet - wavelength) / (targetViolet - uvWavelength)
        : (wavelength - uvWavelength) /
          (targetViolet - uvWavelength);
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

function isWebGpuEngine(engine) {
  return engine?.kind === 'webgpu';
}

function monotonicNow() {
  return typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function normalizeEngineProviders(providers) {
  const result = new Map();
  const entries = providers instanceof Map
    ? providers.entries()
    : Object.entries(providers ?? {});
  for (const [kind, provider] of entries) {
    if (typeof provider === 'function') {
      result.set(kind, { create: provider, isSupported: () => true });
      continue;
    }
    if (provider && typeof provider.create === 'function') {
      result.set(kind, provider);
      continue;
    }
    throw new TypeError(`Primitive engine provider ${kind} requires create().`);
  }
  return result;
}

export default PrimitiveBasedSimulator;
