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
import { DEFAULT_BVH_OPTIONS } from './primitive/bvh.js';
import {
  attachCpuBvhTraversalDiagnostics,
  BVH_NODE_MISSED,
  BVH_NODE_PRUNED,
  BVH_NODE_TRAVERSED
} from './primitive/bvhTraversal.js';
import {
  drawPreparedCurve
} from './primitive/drawPreparedCurve.js';
import {
  createPreprocessingSummary,
  preprocessPrimitives
} from './primitive/preprocess.js';
import {
  formatPrimitiveCurveReference
} from './primitive/diagnosticReference.js';
import {
  DEFAULT_WEBGPU_WORKLOAD_THRESHOLD,
  getPrimitiveEngineWorkloadScore,
  selectPrimitiveEngineKind,
  summarizePrimitiveWorkload
} from './simulationEngines/primitiveEngineSelection.js';

const UV_WAVELENGTH = 380;
const VIOLET_WAVELENGTH = 420;
const BLUE_WAVELENGTH = 460;
const CYAN_WAVELENGTH = 500;
const GREEN_WAVELENGTH = 540;
const YELLOW_WAVELENGTH = 580;
const RED_WAVELENGTH = 620;
const INFRARED_WAVELENGTH = 700;
const BVH_MISSED_COLOR = 'rgba(255, 51, 51, 0.45)';
const BVH_PRUNED_COLOR = 'rgba(191, 64, 255, 0.7)';
const BVH_TRAVERSED_COLOR = 'rgba(38, 230, 89, 0.55)';
const BVH_TESTED_CURVE_COLOR = [1, 0.6, 0.05, 0.95];
const AUTOMATIC_COMPARISON_MIN_RUNTIME_MS = 50;
const AUTOMATIC_CPU_PREFERENCE_RUNTIME_MS = 20;
const AUTOMATIC_COMPARISON_PAUSE_MS = 50;
const DEFAULT_COLOR_MINIMUM_RAY_POWER = 0.01;

function formatPrimitiveEngineWarning(warning) {
  const tolerance = warning.tolerance;
  if (!tolerance) return null;
  const kind = i18next.t(
    `simulator:generalWarnings.primitiveToleranceKinds.${tolerance.kind}`
  );
  const unit = i18next.t(
    `simulator:generalWarnings.primitiveToleranceUnits.${tolerance.unit}`
  );
  const conflict = i18next.t(
    'simulator:generalWarnings.primitiveInteractionConflict', {
      rayIndex: warning.rayIndex,
      curveId: formatWarningCurveId(warning.curveId),
      conflictingCurveId: formatWarningCurveId(
        warning.conflictingCurveId
      ),
      toleranceKind: kind,
      tolerance: formatToleranceValue(tolerance.value),
      toleranceUnit: unit
    }
  );
  if (!Number.isFinite(warning.ambiguousPower)) return conflict;
  return conflict + ' ' + i18next.t(
    'simulator:generalWarnings.primitiveAmbiguousPower', {
      power: formatToleranceValue(warning.ambiguousPower)
    }
  );
}

function formatWarningCurveId(curveId) {
  return Number.isSafeInteger(curveId) && curveId >= 0
    ? formatPrimitiveCurveReference(curveId)
    : String(curveId)
}

function formatToleranceValue(value) {
  return Number.isFinite(value) ? value.toExponential(6) : 'n/a';
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
   * @param {boolean} [options.logDebugInfo=false]
   * @param {boolean} [options.drawBvh=false]
   * @param {Object} [options.bvhOptions]
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
    logDebugInfo = false,
    drawBvh = false,
    bvhOptions = {},
  }) {
    this.scene = scene;
    this.ctxBelowLight = ctxBelowLight;
    this.ctxAboveLight = ctxAboveLight;
    this.ctxGrid = ctxGrid;
    this.ctxVirtual = ctxVirtual;
    this.enableTimer = enableTimer;
    this.rayCountLimit = rayCountLimit;
    this.tempCanvasFactory = tempCanvasFactory;
    this.logDebugInfo = logDebugInfo;
    this.drawBvh = drawBvh;
    this.bvhOptions = bvhOptions;

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
      numericalTolerances: this.scene.numericalTolerances,
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

  logEngineSelectionDecision(decision) {
    if (!this.logDebugInfo) return;
    console.log(
      '[Primitive engine selection] decision\n' +
      `  Preference: ${decision.preference}\n` +
      `  Workload: ${formatDecisionNumber(
        decision.workload.initialRayCount
      )} initial rays, ${formatDecisionNumber(
        decision.workload.primitiveCurveCount
      )} primitive curves, GRIN ${
        decision.workload.hasGrinRegion ? 'yes' : 'no'
      }\n` +
      `  Score: ${formatDecisionNumber(decision.workloadScore)}\n` +
      `  Crossover: ${formatDecisionNumber(decision.crossover)}\n` +
      `  Score / crossover: ${formatDecisionNumber(
        decision.crossoverRatio
      )}\n` +
      '  Formula choice (only without a previous winner): ' +
      `${decision.formulaEngineKind}\n` +
      `  Available: CPU ${decision.cpuAvailable ? 'yes' : 'no'}, ` +
      `WebGPU ${decision.webGpuAvailable ? 'yes' : 'no'}\n` +
      `  Previous comparison winner: ${
        decision.learnedEngineKind ?? 'none'
      }\n` +
      `  Comparison eligible: ${decision.comparisonEligible ? 'yes' : 'no'}\n` +
      `  Selected: ${decision.selectedEngineKind} (${decision.reason})`
    );
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
    if (this.logDebugInfo &&
        (this.comparisonTimer !== null || this.silentActiveRun ||
          this.comparisonRunPromise)) {
      console.log(
        '[Primitive engine comparison] cancelled by scene update\n' +
        `  New scene revision: ${this.runGeneration}`
      );
    }
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
    const numericalTolerances = this.scene.numericalTolerances ?? {};
    const isDefaultColorMode =
      (this.scene.colorMode ?? 'default') === 'default';
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
        colorMode: this.scene.colorMode,
        rayPowerCutoff: isDefaultColorMode
          ? Math.max(
            DEFAULT_COLOR_MINIMUM_RAY_POWER,
            numericalTolerances.rayPowerCutoff ?? 0
          )
          : numericalTolerances.rayPowerCutoff,
        rayPowerCutoffMode: isDefaultColorMode
          ? 'stableSampling'
          : numericalTolerances.rayPowerCutoffMode,
        maxRayDepth: this.scene.maxRayDepth,
        mode: this.scene.mode,
        simulateColors: this.scene.simulateColors,
        showRayArrows: this.scene.showRayArrows,
        observer: this.scene.observer,
        numericalTolerances: { ...numericalTolerances },
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
    this.preprocessCollectedPrimitives(null);
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
      logDebugInfo: this.logDebugInfo
    });
    if (!isCurrent()) return { completed: false, job, durationMs: 0 };

    const run = await job.engine.createRun({
      preparedScene,
      isCurrent,
      viewport: job.viewport,
      colorMode: job.sceneOptions.colorMode,
      rayPowerCutoff: job.sceneOptions.rayPowerCutoff,
      rayPowerCutoffMode: job.sceneOptions.rayPowerCutoffMode,
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
    if (!silent && this.drawBvh && job.engineKind === 'primitiveCpu') {
      this.drawBvhTraversalDiagnostics(this.canvasRendererAboveLight);
      this.drawExternalHighlightPrimitiveCurves(
        this.canvasRendererAboveLight
      );
    }
    return { completed: true, job, durationMs };
  }

  scheduleAutomaticComparison(job, firstDurationMs) {
    // A forced engine preference cannot produce or consume an automatic
    // comparison result. Avoid adding a misleading challenger decision to
    // the debug log for every completed foreground run in that mode.
    if (this.enginePreference !== 'automatic') return;
    const challengerKind = job.engineKind === 'webgpu'
      ? 'primitiveCpu'
      : 'webgpu';
    const cpuAvailable = this.isEngineAvailable('primitiveCpu');
    const webGpuAvailable = this.isEngineAvailable('webgpu');
    const comparisonEligible = this.enginePreference === 'automatic' &&
      cpuAvailable && webGpuAvailable;
    const cpuTrialRequired = comparisonEligible &&
      challengerKind === 'primitiveCpu';
    const logDecision = (decision, extraLines = []) => {
      if (!this.logDebugInfo) return;
      console.log(
        '[Primitive engine comparison] foreground result\n' +
        `  Scene revision: ${job.generation}\n` +
        `  Engine preference: ${this.enginePreference}\n` +
        `  Foreground engine: ${job.engineKind}\n` +
        `  Foreground duration: ${formatMilliseconds(firstDurationMs)} ms\n` +
        `  Available: CPU ${cpuAvailable ? 'yes' : 'no'}, ` +
        `WebGPU ${webGpuAvailable ? 'yes' : 'no'}\n` +
        `  Job automatic-comparison flag: ${
          job.comparisonEligible ? 'yes' : 'no'
        }\n` +
        `  CPU trial required after WebGPU: ${
          cpuTrialRequired ? 'yes' : 'no'
        }\n` +
        `  Non-CPU challenger threshold: ${
          AUTOMATIC_COMPARISON_MIN_RUNTIME_MS
        } ms\n` +
        `  CPU preference threshold: <${
          AUTOMATIC_CPU_PREFERENCE_RUNTIME_MS
        } ms\n` +
        '  Timing scope: engine advance calls; preparation and pauses excluded\n' +
        `  Decision: ${decision}` +
        (extraLines.length ? `\n  ${extraLines.join('\n  ')}` : '')
      );
    };
    if (job.generation !== this.runGeneration) {
      logDecision('skip-stale-revision');
      return;
    }
    if (job.fallback) {
      logDecision('skip-webgpu-fallback');
      return;
    }
    if (!cpuAvailable) {
      logDecision('skip-cpu-unavailable');
      return;
    }
    if (!webGpuAvailable) {
      logDecision('skip-webgpu-unavailable');
      return;
    }
    if (challengerKind === 'primitiveCpu') {
      // In Automatic mode CPU is always tried after WebGPU, even when the
      // WebGPU foreground run is below the normal comparison threshold.
    } else {
      if (!(firstDurationMs > AUTOMATIC_COMPARISON_MIN_RUNTIME_MS)) {
        logDecision('skip-fast-foreground');
        return;
      }
    }
    logDecision('schedule-challenger', [
      `Challenger: ${challengerKind}`,
      `Pause before start: ${AUTOMATIC_COMPARISON_PAUSE_MS} ms`,
    ]);
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
      if (this.logDebugInfo) {
        console.log(
          '[Primitive engine comparison] challenger started\n' +
          `  Scene revision: ${firstJob.generation}\n` +
          `  Foreground: ${firstJob.engineKind} ` +
          `(${formatMilliseconds(firstDurationMs)} ms)\n` +
          `  Challenger: ${challengerKind}`
        );
      }
      const engine = this.getBenchmarkEngine(challengerKind);
      this.resizeBenchmarkEngineOutput(engine);
      const preprocessing = preprocessPrimitives(firstJob.primitives, {
        lengthScale: firstJob.sceneOptions.lengthScale,
        numericalTolerances: firstJob.sceneOptions.numericalTolerances,
        numericEpsilon: engine.numericEpsilon,
        bvhOptions: {
          ...this.bvhOptions,
          maxGroupExtent:
            (this.bvhOptions.maxGroupExtent ??
              DEFAULT_BVH_OPTIONS.maxGroupExtent) *
            firstJob.sceneOptions.lengthScale
        },
        logDebugInfo: false,
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
      if (this.logDebugInfo) {
        console.log(
          '[Primitive engine comparison] decision\n' +
          `  Scene revision: ${firstJob.generation}\n` +
          `  Foreground: ${firstJob.engineKind} ` +
          `(${formatMilliseconds(firstDurationMs)} ms)\n` +
          `  Challenger: ${challengerKind} ` +
          `(${formatMilliseconds(result.durationMs)} ms)\n` +
          `  Challenger completed: ${result.completed ? 'yes' : 'no'}\n` +
          `  Challenger stopped as slower: ${result.slower ? 'yes' : 'no'}\n` +
          `  CPU under ${AUTOMATIC_CPU_PREFERENCE_RUNTIME_MS} ms ` +
          `preference applied: ${
            cpuPreferredForResponsiveness ? 'yes' : 'no'
          }\n` +
          `  Winner for next scene update: ${this.automaticEngineWinner}`
        );
      }
    } catch (error) {
      if (firstJob.generation !== this.runGeneration) return;
      // A silent comparison must not become a user-visible simulation error.
      // Keep the successful foreground engine when the challenger is unusable.
      this.automaticEngineWinner = firstJob.engineKind;
      if (this.logDebugInfo) {
        console.warn(
          '[Primitive engine comparison] challenger failed\n' +
          `  Scene revision: ${firstJob.generation}\n` +
          `  Foreground: ${firstJob.engineKind} ` +
          `(${formatMilliseconds(firstDurationMs)} ms)\n` +
          `  Challenger: ${challengerKind}\n` +
          `  Winner for next scene update: ${firstJob.engineKind}\n` +
          `  Error: ${error?.message ?? String(error)}`
        );
      }
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
    const previousProcessedScene = this.processedScene;
    const collectionStartTime = this.logDebugInfo
      ? (typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now())
      : null;
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
    const collectionTime = this.logDebugInfo
      ? (
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now()
      ) - collectionStartTime
      : null;

    this.primitives = primitives;
    this.workload = summarizePrimitiveWorkload(primitives);
    const selectionDecision = this.getEngineSelectionDecision(this.workload);
    this.logEngineSelectionDecision(selectionDecision);
    this.activateEngine(selectionDecision.selectedEngineKind, {
      fallback: false,
      deferPresentation: true,
    });
    this.preprocessCollectedPrimitives(
      collectionTime,
      previousProcessedScene
    );
  }

  preprocessCollectedPrimitives(
    collectionTime,
    previousProcessedScene = this.processedScene
  ) {
    const {
      processedScene,
      detectorResultBindings,
      timings
    } = preprocessPrimitives(this.primitives, {
      lengthScale: this.scene.lengthScale,
      numericalTolerances: this.scene.numericalTolerances,
      numericEpsilon: this.engine.numericEpsilon,
      bvhOptions: {
        ...this.bvhOptions,
        maxGroupExtent:
          (this.bvhOptions.maxGroupExtent ?? DEFAULT_BVH_OPTIONS.maxGroupExtent) *
          this.scene.lengthScale
      },
      logDebugInfo: this.logDebugInfo
    });
    if (this.logDebugInfo) {
      const summary = createPreprocessingSummary(
        processedScene,
        previousProcessedScene
      );
      console.log(
        '[Primitive preprocessing] summary:\n' +
        '  Timing (ms): collect %s, normalize %s, finalize types %s, build BVH %s, assemble %s, total %s\n' +
        '  BVH: %d curves, %d nodes (%d branches, %d leaves), maximum depth %d\n' +
        '  Registered types changed: %s\n' +
        '  Source types (%s): %s\n' +
        '  Surface types (%s): %s\n' +
        '  Bulk types (%s): %s\n' +
        '  Detector types (%s): %s',
        formatMilliseconds(collectionTime),
        formatMilliseconds(timings.normalizePrimitives),
        formatMilliseconds(timings.finalizeTypeTables),
        formatMilliseconds(timings.buildBvh),
        formatMilliseconds(timings.assembleProcessedScene),
        formatMilliseconds(collectionTime + timings.total),
        summary.bvh.curveCount,
        summary.bvh.nodeCount,
        summary.bvh.branchCount,
        summary.bvh.leafCount,
        summary.bvh.maxDepth,
        formatChangeStatus(summary.types.changed),
        formatChangeStatus(summary.types.sources.changed),
        formatRegisteredTypes(summary.types.sources),
        formatChangeStatus(summary.types.surfaces.changed),
        formatRegisteredTypes(summary.types.surfaces),
        formatChangeStatus(summary.types.bulks.changed),
        formatRegisteredTypes(summary.types.bulks),
        formatChangeStatus(summary.types.detectors.changed),
        formatRegisteredTypes(summary.types.detectors)
      );
    }
    this.processedScene = processedScene;
    if (this.drawBvh && this.engine.kind === 'primitiveCpu') {
      attachCpuBvhTraversalDiagnostics(processedScene);
    }
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

  drawBvhTraversalDiagnostics(canvasRenderer) {
    const diagnostics =
      this.processedScene?.cpuBvhTraversalDiagnostics;
    const nodes = this.processedScene?.bvh.nodes;
    if (!canvasRenderer?.ctx || !diagnostics || !nodes?.length) return;

    const ctx = canvasRenderer.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);

    for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
      const node = nodes[nodeIndex];
      switch (diagnostics.nodeStates[nodeIndex]) {
        case BVH_NODE_MISSED:
          ctx.strokeStyle = BVH_MISSED_COLOR;
          break;
        case BVH_NODE_PRUNED:
          ctx.strokeStyle = BVH_PRUNED_COLOR;
          break;
        case BVH_NODE_TRAVERSED:
          ctx.strokeStyle = BVH_TRAVERSED_COLOR;
          break;
        default:
          continue;
      }
      ctx.lineWidth =
        Math.max(0.5, 2.5 / (node.depth + 1)) * canvasRenderer.lengthScale;
      const { minX, minY, maxX, maxY } = node.bounds;
      ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    }

    ctx.restore();

    for (let curveId = 0;
      curveId < diagnostics.testedCurves.length;
      curveId++) {
      if (!diagnostics.testedCurves[curveId]) continue;
      drawPreparedCurve(
        canvasRenderer,
        this.processedScene.curves[curveId].geometry,
        BVH_TESTED_CURVE_COLOR,
        2
      );
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

function formatChangeStatus(changed) {
  if (changed === null) return 'not compared';
  return changed ? 'yes' : 'no';
}

function formatMilliseconds(duration) {
  return Number.isFinite(duration) ? duration.toFixed(3) : 'n/a';
}

function formatDecisionNumber(value) {
  if (!Number.isFinite(value)) return 'n/a';
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toPrecision(8)));
}

function formatRegisteredTypes(categorySummary) {
  if (categorySummary.registered.length === 0) {
    return 'none';
  }
  return categorySummary.registered
    .map(({ id, name, objectCount }) =>
      `${id}: ${name} (${objectCount} object${objectCount === 1 ? '' : 's'})`
    )
    .join(', ');
}

export default PrimitiveBasedSimulator;
