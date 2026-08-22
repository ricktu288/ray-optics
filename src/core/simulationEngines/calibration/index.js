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

import Scene from '../../Scene.js';
import PrimitiveBasedSimulator from '../../PrimitiveBasedSimulator.js';
import CpuSimulationEngine from '../cpu/CpuSimulationEngine.js';
import WebGpuSimulationEngine from '../webgpu/WebGpuSimulationEngine.js';
import { FLOAT32_EPSILON } from '../../primitive/numeric.js';
import {
  DEFAULT_PRIMITIVE_SIMULATOR_CONFIG,
  WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE,
  resolvePrimitiveSimulatorConfig,
  resolveSimulationEngineConfig,
} from '../config.js';
import {
  estimateIntersectionCrossover,
  median,
  selectRayCooperationProfile,
} from './fitCalibration.js';
import {
  CALIBRATION_HEADLESS_VIEWPORT,
  getRayCooperationCalibrationProbes,
} from './probeScenes.js';

const REPORT_VERSION = 'simulation-engine-calibration-v5';
const REPORT_STORAGE_KEY = 'rayOpticsSimulationEngineCalibrationReport';
const DEFAULT_MEASURED_REPEATS = 3;
const DEFAULT_MEASUREMENT_TIME_BUDGET_MS = 200;
const MAX_TIME_BUDGET_REPEATS = 100;
const CALIBRATION_RAY_COUNT_LIMIT = 10_000_000;

export class SimulationEngineCalibrationError extends Error {
  constructor(message, code = 'calibration-failed') {
    super(message);
    this.name = 'SimulationEngineCalibrationError';
    this.code = code;
  }
}

/**
 * Run the complete, browser-only device calibration. The UI supplies only
 * progress and cancellation plumbing and consumes the returned overrides, so
 * the benchmarking strategy can be replaced without changing preference or
 * modal code.
 */
export async function calibrateSimulationEngines({
  currentConfigs = {},
  measuredRepeats = DEFAULT_MEASURED_REPEATS,
  measurementTimeBudgetMs = DEFAULT_MEASUREMENT_TIME_BUDGET_MS,
  viewport = null,
  onProgress = () => {},
  signal = null,
} = {}) {
  if (!Number.isSafeInteger(measuredRepeats) || measuredRepeats < 1) {
    throw new RangeError('measuredRepeats must be a positive safe integer.');
  }
  if (!Number.isFinite(measurementTimeBudgetMs) ||
      measurementTimeBudgetMs < 0) {
    throw new RangeError(
      'measurementTimeBudgetMs must be a non-negative number.'
    );
  }
  requireVisibleDocument();
  const calibrationViewport = resolveCalibrationViewport(viewport);
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', forwardAbort, { once: true });
  const onVisibilityChange = () => {
    if (document.visibilityState !== 'visible') {
      controller.abort(new SimulationEngineCalibrationError(
        'Calibration was stopped because the page became hidden.',
        'page-hidden'
      ));
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  const cooperationProbes = getRayCooperationCalibrationProbes();
  const primitiveConfig = resolvePrimitiveSimulatorConfig(currentConfigs);
  const cpuConfig = resolveSimulationEngineConfig('primitiveCpu', currentConfigs);
  const webGpuConfig = resolveSimulationEngineConfig('webgpu', currentConfigs);
  const profiles = createRayCooperationProfiles(webGpuConfig);
  const totalProbeRuns = cooperationProbes.length * (profiles.length + 1);
  let completedProbeRuns = 0;
  let activeSimulator = null;
  let canvasSet = null;
  const report = createReport({
    measuredRepeats,
    measurementTimeBudgetMs,
    profiles,
    cooperationProbes,
    primitiveConfig,
    cpuConfig,
    webGpuConfig,
    viewport: calibrationViewport,
  });

  const progress = (phase, detail = {}) => onProgress({
    phase,
    completed: completedProbeRuns,
    total: totalProbeRuns,
    fraction: totalProbeRuns ? completedProbeRuns / totalProbeRuns : 0,
    ...detail,
  });

  let device = null;
  try {
    progress('preparing');
    const preparationStart = performance.now();
    canvasSet = createCanvasSet(CALIBRATION_HEADLESS_VIEWPORT);
    const deviceRequestStart = performance.now();
    const { adapter, device: requestedDevice } = await requestCalibrationDevice();
    device = requestedDevice;
    report.timing.deviceRequestMs = performance.now() - deviceRequestStart;
    report.timing.preparationMs = performance.now() - preparationStart;
    report.device = describeDevice(adapter, device);
    throwIfAborted(controller.signal);

    const cpuCooperationEngine = createCpuEngine(canvasSet, cpuConfig, false);
    let cpuCooperationPassResults;
    try {
      cpuCooperationPassResults = await benchmarkProbePass({
        probes: cooperationProbes,
        engine: cpuCooperationEngine,
        engineKind: 'primitiveCpu',
        rendered: false,
        primitiveConfig,
        canvasSet,
        viewport: calibrationViewport,
        measuredRepeats,
        measurementTimeBudgetMs,
        signal: controller.signal,
        onSimulator: simulator => { activeSimulator = simulator; },
        onProbeStart: probe => progress('cpu', { probeId: probe.id }),
        onProbeComplete: () => {
          completedProbeRuns++;
          progress('cpu');
        },
      });
    } finally {
      cpuCooperationEngine.dispose();
    }
    report.results.push(...cpuCooperationPassResults);

    const profileMeasurements = [];
    for (const profile of profiles) {
      throwIfAborted(controller.signal);
      const engine = createWebGpuEngine(
        canvasSet,
        device,
        profile.config,
        false
      );
      let results;
      try {
        results = await benchmarkProbePass({
          probes: cooperationProbes,
          engine,
          engineKind: 'webgpu',
          rendered: false,
          configurationId: profile.id,
          primitiveConfig,
          canvasSet,
          viewport: calibrationViewport,
          device,
          measuredRepeats,
          measurementTimeBudgetMs,
          signal: controller.signal,
          onSimulator: simulator => { activeSimulator = simulator; },
          onProbeStart: probe => progress('rayCooperation', {
            probeId: probe.id,
            configurationId: profile.id,
          }),
          onProbeComplete: () => {
            completedProbeRuns++;
            progress('rayCooperation', { configurationId: profile.id });
          },
        });
      } finally {
        engine.dispose();
      }
      report.results.push(...results);
      profileMeasurements.push({ ...profile, results });
    }

    const selectedProfile = selectRayCooperationProfile(profileMeasurements);
    report.rayCooperation.selectedProfileId = selectedProfile.id;
    report.rayCooperation.geometricMeanMs = Object.fromEntries(
      profileMeasurements.map(measurement => [
        measurement.id,
        geometricMean(measurement.results.map(result => result.medianMs)),
      ])
    );

    progress('fitting');
    const cooperationIds = new Set(cooperationProbes
      .map(probe => probe.id)
      .filter(id => id.startsWith('intersection-'))
    );
    const fittedCpuCooperationResults = cpuCooperationPassResults.filter(result =>
      cooperationIds.has(result.probeId)
    );
    const selectedCooperationResults = selectedProfile.results;
    const defaultSelection = DEFAULT_PRIMITIVE_SIMULATOR_CONFIG.engineSelection;
    const webGpuWorkloadThreshold = estimateIntersectionCrossover({
      cpuResults: fittedCpuCooperationResults,
      gpuResults: selectedCooperationResults,
      defaultThreshold: defaultSelection.webGpuWorkloadThreshold,
    });
    const engineSelection = { webGpuWorkloadThreshold };
    const rayCooperation = pickCalibratedRayCooperationSettings(
      selectedProfile.config
    );
    const overrides = {
      primitive: { engineSelection },
      webgpu: rayCooperation,
    };
    report.derivedParameters = overrides;
    report.status = 'complete';
    report.finishedAt = new Date().toISOString();
    report.elapsedMs = performance.now() - report.startedAtMonotonic;
    delete report.startedAtMonotonic;
    try {
      storeSimulationEngineCalibrationReport(report);
    } catch (storageError) {
      // Calibration remains useful when storage is unavailable (for example,
      // private browsing with a full quota). The UI still receives the report
      // and can download it during this session.
      report.storageError = storageError?.message ?? String(storageError);
    }
    progress('complete', { fraction: 1, completed: totalProbeRuns });
    return { overrides, report };
  } catch (error) {
    if (controller.signal.aborted) {
      throw calibrationAbortError(controller.signal.reason);
    }
    throw error;
  } finally {
    activeSimulator?.stopSimulation?.();
    device?.destroy?.();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

export function loadSimulationEngineCalibrationReport() {
  try {
    const value = localStorage.getItem(REPORT_STORAGE_KEY);
    if (!value) return null;
    const report = JSON.parse(value);
    return report?.benchmark === REPORT_VERSION && report.status === 'complete'
      ? report
      : null;
  } catch (_) {
    return null;
  }
}

export function storeSimulationEngineCalibrationReport(report) {
  if (report?.benchmark !== REPORT_VERSION || report.status !== 'complete') {
    throw new TypeError('Only a complete simulation-engine calibration report can be stored.');
  }
  localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(report));
}

function createReport({
  measuredRepeats,
  measurementTimeBudgetMs,
  profiles,
  cooperationProbes,
  primitiveConfig,
  cpuConfig,
  webGpuConfig,
  viewport,
}) {
  return {
    benchmark: REPORT_VERSION,
    status: 'running',
    generatedAt: new Date().toISOString(),
    startedAtMonotonic: performance.now(),
    browser: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      deviceMemoryGiB: navigator.deviceMemory ?? null,
      platform: navigator.userAgentData?.platform ?? navigator.platform ?? null,
    },
    viewport,
    timing: {
      measuredRepeats,
      measurementTimeBudgetMs,
      maximumTimeBudgetRepeats: MAX_TIME_BUDGET_REPEATS,
      samplingStrategy:
        'At least measuredRepeats samples, then more samples until the time budget or repeat cap is reached',
      warmupsPerProbeAndConfiguration: 1,
      warmupIncludedInFit: false,
      rayCooperationBoundary:
        'UI-thread simulator update without render output through simulationComplete and WebGPU queue synchronization',
    },
    probes: {
      rayCooperation: cooperationProbes.map(probe => probe.id),
    },
    executionOrder:
      'CPU and each WebGPU ray-cooperation profile for every ray-cooperation probe',
    fixedConfiguration: {
      primitive: primitiveConfig,
      primitiveCpu: cpuConfig,
      webgpuBase: webGpuConfig,
    },
    fitting: {
      selectorForm:
        'initial rays * sqrt(primitive curves)',
    },
    rayCooperation: {
      profiles: Object.fromEntries(profiles.map(profile => [
        profile.id,
        pickRayCooperationSettings(profile.config),
      ])),
      selectedProfileId: null,
      geometricMeanMs: {},
    },
    device: null,
    results: [],
    derivedParameters: null,
  };
}

function createRayCooperationProfiles(current) {
  const profile = (id, overrides) => ({
    id,
    config: { ...current, ...overrides },
  });
  const candidates = [
    profile('disabled', { rayCooperationEnabled: false }),
    profile('conservative', {
      rayCooperationEnabled: true,
      rayCooperationSaturationRayCount: 4096,
      rayCooperationDirectMaxTestsPerLane: 64,
      rayCooperationMaximumLanesPerRay: 8,
    }),
    profile('balanced', {
      rayCooperationEnabled: true,
      rayCooperationSaturationRayCount: 8192,
      rayCooperationDirectMaxTestsPerLane: 512,
      rayCooperationMaximumLanesPerRay: 32,
    }),
    profile('aggressive', {
      rayCooperationEnabled: true,
      rayCooperationSaturationRayCount: 16384,
      rayCooperationDirectMaxTestsPerLane: 1024,
      rayCooperationMaximumLanesPerRay: 32,
    }),
    profile('current', {}),
  ];
  const signatures = new Set();
  return candidates.filter(candidate => {
    const settings = pickCalibratedRayCooperationSettings(candidate.config);
    const signature = settings.rayCooperationEnabled
      ? JSON.stringify(settings)
      : 'disabled';
    if (signatures.has(signature)) return false;
    signatures.add(signature);
    return true;
  });
}

async function benchmarkProbePass({
  probes,
  engine,
  engineKind,
  rendered,
  configurationId = engineKind,
  primitiveConfig,
  canvasSet,
  viewport,
  device = null,
  measuredRepeats,
  measurementTimeBudgetMs,
  signal,
  onSimulator,
  onProbeStart,
  onProbeComplete,
}) {
  const results = [];
  for (const probe of probes) {
    throwIfAborted(signal);
    onProbeStart(probe);
    const renderViewport = rendered
      ? viewport
      : {
          cssWidth: CALIBRATION_HEADLESS_VIEWPORT.width,
          cssHeight: CALIBRATION_HEADLESS_VIEWPORT.height,
          devicePixelRatio: 1,
          pixelWidth: CALIBRATION_HEADLESS_VIEWPORT.width,
          pixelHeight: CALIBRATION_HEADLESS_VIEWPORT.height,
        };
    const scene = await loadProbeScene(probe.scene, renderViewport);
    resizeCanvases(
      canvasSet,
      renderViewport.pixelWidth,
      renderViewport.pixelHeight
    );
    const simulator = createSimulator({
      scene,
      engine,
      primitiveConfig,
      canvasSet,
      rendered,
      dpr: renderViewport.devicePixelRatio,
    });
    onSimulator(simulator);
    const warmupMs = await runSimulatorUpdate({
      simulator,
      engineKind,
      canvasSet,
      device,
      signal,
      rendered,
    });
    const samplesMs = [];
    const measurementStart = performance.now();
    while (samplesMs.length < measuredRepeats || (
      samplesMs.length < MAX_TIME_BUDGET_REPEATS &&
      performance.now() - measurementStart < measurementTimeBudgetMs
    )) {
      samplesMs.push(await runSimulatorUpdate({
        simulator,
        engineKind,
        canvasSet,
        device,
        signal,
        rendered,
      }));
    }
    results.push({
      probeId: probe.id,
      engine: engineKind,
      configurationId,
      timingScope: rendered ? 'end-to-end-rendering' : 'headless-tracing',
      colorMode: scene.colorMode,
      mode: scene.mode,
      viewport: {
        cssWidth: renderViewport.cssWidth,
        cssHeight: renderViewport.cssHeight,
        devicePixelRatio: renderViewport.devicePixelRatio,
        pixelWidth: renderViewport.pixelWidth,
        pixelHeight: renderViewport.pixelHeight,
      },
      warmupMs,
      samplesMs,
      medianMs: median(samplesMs),
      workload: { ...simulator.workload },
      processedRayCount: simulator.processedRayCount,
    });
    simulator.eventListeners = {};
    onProbeComplete(probe);
    await nextFrame();
  }
  return results;
}

async function loadProbeScene(sceneJson, viewport) {
  const scene = new Scene();
  scene.setViewportSize(viewport.cssWidth, viewport.cssHeight);
  await new Promise(resolve => {
    scene.loadJSON(JSON.stringify(sceneJson), (_needFullUpdate, completed) => {
      if (completed) resolve();
    });
  });
  if (scene.error) throw new Error(`Calibration scene failed to load: ${scene.error}`);
  return scene;
}

function createSimulator({
  scene,
  engine,
  primitiveConfig,
  canvasSet,
  rendered,
  dpr,
}) {
  const simulator = new PrimitiveBasedSimulator({
    scene,
    engine,
    ctxBelowLight: rendered ? canvasSet.below : null,
    ctxAboveLight: rendered ? canvasSet.above : null,
    ctxGrid: rendered ? canvasSet.grid : null,
    ctxVirtual: rendered ? canvasSet.virtual : null,
    enableTimer: true,
    rayCountLimit: CALIBRATION_RAY_COUNT_LIMIT,
    tempCanvasFactory: createCanvas,
    logDebugInfo: false,
    drawBvh: false,
    bvhOptions: {
      lineLeafSize: primitiveConfig.bvh.lineLeafSize,
      arcLeafSize: primitiveConfig.bvh.arcLeafSize,
      cubicBezierLeafSize: primitiveConfig.bvh.cubicBezierLeafSize,
      directPrimitiveThreshold: primitiveConfig.bvh.directPrimitiveThreshold,
      consecutiveLocalityFactor: primitiveConfig.bvh.consecutiveLocalityFactor,
      maxGroupExtent: primitiveConfig.bvh.maxGroupExtent,
    },
  });
  simulator.dpr = dpr;
  return simulator;
}

function runSimulatorUpdate({
  simulator,
  engineKind,
  canvasSet,
  device,
  signal,
  rendered,
}) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    let settled = false;
    const start = performance.now();
    const finish = async error => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      try {
        await synchronizeRendering({
          engineKind,
          canvasSet,
          device,
          rendered,
        });
      } catch (flushError) {
        error = error ?? flushError;
      }
      if (error) reject(error);
      else resolve(performance.now() - start);
    };
    const onAbort = () => {
      simulator.stopSimulation?.();
      finish(calibrationAbortError(signal.reason));
    };
    simulator.eventListeners = {};
    simulator.on('simulationComplete', () => finish(
      simulator.error ? new Error(simulator.error) : null
    ));
    simulator.on('simulationStop', () => finish(
      calibrationAbortError(signal?.reason)
    ));
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      simulator.updateSimulation(false, true, true);
    } catch (error) {
      finish(error);
    }
  });
}

async function synchronizeRendering({
  engineKind,
  canvasSet,
  device,
  rendered,
}) {
  if (rendered) {
    for (const context of [
      canvasSet.below,
      canvasSet.above,
      canvasSet.grid,
      canvasSet.virtual,
      ...(engineKind === 'webgpu' ? [] : [canvasSet.main]),
    ]) {
      context?.getImageData?.(0, 0, 1, 1);
    }
    if (engineKind !== 'webgpu') canvasSet.gl.finish();
  }
  await device?.queue?.onSubmittedWorkDone?.();
}

function createCanvasSet({ width, height }) {
  const belowCanvas = createCanvas(width, height);
  const mainCanvas = createCanvas(width, height);
  const webGlCanvas = createCanvas(width, height);
  const webGpuCanvas = createCanvas(width, height);
  const aboveCanvas = createCanvas(width, height);
  const gridCanvas = createCanvas(width, height);
  const virtualCanvas = createCanvas(width, height);
  const gl = webGlCanvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  }) || webGlCanvas.getContext('experimental-webgl');
  if (!gl) {
    throw new SimulationEngineCalibrationError(
      'WebGL is required to calibrate non-default CPU rendering.',
      'webgl-unavailable'
    );
  }
  return {
    canvases: [
      belowCanvas, mainCanvas, webGlCanvas, webGpuCanvas,
      aboveCanvas, gridCanvas, virtualCanvas,
    ],
    below: belowCanvas.getContext('2d'),
    main: mainCanvas.getContext('2d'),
    gl,
    webGpuCanvas,
    above: aboveCanvas.getContext('2d'),
    grid: gridCanvas.getContext('2d'),
    virtual: virtualCanvas.getContext('2d'),
  };
}

function resizeCanvases(canvasSet, width, height) {
  for (const canvas of canvasSet.canvases) {
    canvas.width = width;
    canvas.height = height;
  }
}

function createCanvas(width = 1, height = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function createCpuEngine(canvasSet, config, rendered) {
  return new CpuSimulationEngine({
    ctxMain: rendered ? canvasSet.main : null,
    glMain: rendered ? canvasSet.gl : null,
    ctxVirtual: rendered ? canvasSet.virtual : null,
    config,
  });
}

function createWebGpuEngine(canvasSet, device, config, rendered) {
  return new WebGpuSimulationEngine({
    device,
    output: rendered ? createWebGpuOutput(canvasSet.webGpuCanvas) : null,
    numericEpsilon: FLOAT32_EPSILON,
    ownsDevice: false,
    config,
  });
}

function createWebGpuOutput(canvas) {
  let context = null;
  return {
    format: navigator.gpu.getPreferredCanvasFormat(),
    getSize: () => ({ width: canvas.width, height: canvas.height }),
    initialize(device) {
      context = canvas.getContext('webgpu');
      if (!context) throw new Error('The WebGPU canvas context is unavailable.');
      context.configure({
        device,
        format: this.format,
        alphaMode: 'premultiplied',
      });
    },
    acquireView: () => context.getCurrentTexture().createView(),
    dispose() {
      context?.unconfigure?.();
      context = null;
    },
  };
}

async function requestCalibrationDevice() {
  if (!navigator.gpu) {
    throw new SimulationEngineCalibrationError(
      'WebGPU is not supported by this browser.',
      'webgpu-unavailable'
    );
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new SimulationEngineCalibrationError(
      'No WebGPU adapter is available.',
      'webgpu-unavailable'
    );
  }
  const storageLimit = adapter.limits.maxStorageBuffersPerShaderStage;
  if (storageLimit < WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE) {
    throw new SimulationEngineCalibrationError(
      `The WebGPU adapter exposes only ${storageLimit} storage buffers per shader stage.`,
      'webgpu-limits'
    );
  }
  const device = await adapter.requestDevice({
    requiredLimits: {
      maxStorageBuffersPerShaderStage:
        WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE,
    },
  });
  return { adapter, device };
}

function describeDevice(adapter, device) {
  const info = adapter.info ?? {};
  const infoKeys = [
    'vendor', 'architecture', 'device', 'description',
    'subgroupMinSize', 'subgroupMaxSize',
  ];
  const limitKeys = [
    'maxBufferSize',
    'maxStorageBufferBindingSize',
    'maxStorageBuffersPerShaderStage',
    'maxComputeInvocationsPerWorkgroup',
    'maxComputeWorkgroupSizeX',
    'maxComputeWorkgroupsPerDimension',
  ];
  return {
    adapter: Object.fromEntries(infoKeys.map(key => [key, info[key] ?? null])),
    limits: Object.fromEntries(limitKeys.map(key => [
      key,
      adapter.limits?.[key] ?? device.limits?.[key] ?? null,
    ])),
    features: [...(adapter.features ?? [])].sort(),
  };
}

function pickRayCooperationSettings(config) {
  return {
    rayCooperationEnabled: config.rayCooperationEnabled,
    rayCooperationSaturationRayCount:
      config.rayCooperationSaturationRayCount,
    rayCooperationDirectMaxTestsPerLane:
      config.rayCooperationDirectMaxTestsPerLane,
    rayCooperationMaximumLanesPerRay:
      config.rayCooperationMaximumLanesPerRay,
    rayCooperationMaximumHaloFraction:
      config.rayCooperationMaximumHaloFraction,
  };
}

function pickCalibratedRayCooperationSettings(config) {
  const settings = pickRayCooperationSettings(config);
  delete settings.rayCooperationMaximumHaloFraction;
  return settings;
}

function geometricMean(values) {
  const usable = values.filter(value => Number.isFinite(value) && value > 0);
  if (usable.length !== values.length || !usable.length) return null;
  return Math.exp(
    usable.reduce((sum, value) => sum + Math.log(value), 0) / usable.length
  );
}

function resolveCalibrationViewport(override) {
  const cssWidth = positiveFinite(
    override?.cssWidth ?? override?.width ?? window.innerWidth,
    1
  );
  const cssHeight = positiveFinite(
    override?.cssHeight ?? override?.height ?? window.innerHeight,
    1
  );
  const devicePixelRatio = positiveFinite(
    override?.devicePixelRatio ?? override?.dpr ?? window.devicePixelRatio,
    1
  );
  return Object.freeze({
    source: override ? 'caller-supplied' : 'current-browser-viewport',
    cssWidth,
    cssHeight,
    devicePixelRatio,
    pixelWidth: Math.max(1, Math.round(cssWidth * devicePixelRatio)),
    pixelHeight: Math.max(1, Math.round(cssHeight * devicePixelRatio)),
  });
}

function positiveFinite(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function requireVisibleDocument() {
  if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
    throw new SimulationEngineCalibrationError(
      'Keep this page visible while starting calibration.',
      'page-hidden'
    );
  }
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw calibrationAbortError(signal.reason);
}

function calibrationAbortError(reason) {
  if (reason instanceof SimulationEngineCalibrationError) return reason;
  return new SimulationEngineCalibrationError(
    reason?.message ?? 'Calibration was cancelled.',
    'cancelled'
  );
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

export {
  REPORT_STORAGE_KEY as SIMULATION_ENGINE_CALIBRATION_REPORT_STORAGE_KEY,
  REPORT_VERSION as SIMULATION_ENGINE_CALIBRATION_REPORT_VERSION,
};
