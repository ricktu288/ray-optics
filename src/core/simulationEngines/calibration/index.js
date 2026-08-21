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
  SIGNIFICANT_RUNTIME_MS,
  estimateIntersectionCrossover,
  fitEngineSelectionCorrections,
  median,
  selectRayCooperationProfile,
} from './fitCalibration.js';
import {
  CALIBRATION_VIEWPORT,
  getEndToEndCalibrationProbes,
  getRayCooperationCalibrationProbes,
} from './probeScenes.js';

const REPORT_VERSION = 'simulation-engine-calibration-v1';
const REPORT_STORAGE_KEY = 'rayOpticsSimulationEngineCalibrationReport';
const DEFAULT_MEASURED_REPEATS = 2;
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
  onProgress = () => {},
  signal = null,
} = {}) {
  if (!Number.isSafeInteger(measuredRepeats) || measuredRepeats < 1) {
    throw new RangeError('measuredRepeats must be a positive safe integer.');
  }
  requireVisibleDocument();
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
  const endToEndProbes = getEndToEndCalibrationProbes();
  const allCpuProbes = [...cooperationProbes, ...endToEndProbes];
  const primitiveConfig = resolvePrimitiveSimulatorConfig(currentConfigs);
  const cpuConfig = resolveSimulationEngineConfig('primitiveCpu', currentConfigs);
  const webGpuConfig = resolveSimulationEngineConfig('webgpu', currentConfigs);
  const profiles = createRayCooperationProfiles(webGpuConfig);
  const totalProbeRuns = allCpuProbes.length +
    profiles.length * cooperationProbes.length + endToEndProbes.length;
  let completedProbeRuns = 0;
  let activeSimulator = null;
  let canvasSet = null;
  const report = createReport({
    measuredRepeats,
    profiles,
    cooperationProbes,
    endToEndProbes,
    primitiveConfig,
    cpuConfig,
    webGpuConfig,
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
    canvasSet = createCanvasSet(CALIBRATION_VIEWPORT);
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
        measuredRepeats,
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
    const cpuEndToEndEngine = createCpuEngine(canvasSet, cpuConfig, true);
    let cpuEndToEndPassResults;
    try {
      cpuEndToEndPassResults = await benchmarkProbePass({
        probes: endToEndProbes,
        engine: cpuEndToEndEngine,
        engineKind: 'primitiveCpu',
        rendered: true,
        primitiveConfig,
        canvasSet,
        measuredRepeats,
        signal: controller.signal,
        onSimulator: simulator => { activeSimulator = simulator; },
        onProbeStart: probe => progress('cpu', { probeId: probe.id }),
        onProbeComplete: () => {
          completedProbeRuns++;
          progress('cpu');
        },
      });
    } finally {
      cpuEndToEndEngine.dispose();
    }
    const cpuResults = [
      ...cpuCooperationPassResults,
      ...cpuEndToEndPassResults,
    ];
    report.results.push(...cpuResults);

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
          device,
          measuredRepeats,
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

    const selectedEngine = createWebGpuEngine(
      canvasSet,
      device,
      selectedProfile.config,
      true
    );
    let endToEndGpuResults;
    try {
      endToEndGpuResults = await benchmarkProbePass({
        probes: endToEndProbes,
        engine: selectedEngine,
        engineKind: 'webgpu',
        rendered: true,
        configurationId: selectedProfile.id,
        primitiveConfig,
        canvasSet,
        device,
        measuredRepeats,
        signal: controller.signal,
        onSimulator: simulator => { activeSimulator = simulator; },
        onProbeStart: probe => progress('endToEndWebGpu', {
          probeId: probe.id,
          configurationId: selectedProfile.id,
        }),
        onProbeComplete: () => {
          completedProbeRuns++;
          progress('endToEndWebGpu', {
            configurationId: selectedProfile.id,
          });
        },
      });
    } finally {
      selectedEngine.dispose();
    }
    report.results.push(...endToEndGpuResults);

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
    const corrections = fitEngineSelectionCorrections({
      cpuResults: cpuEndToEndPassResults,
      gpuResults: endToEndGpuResults,
      threshold: webGpuWorkloadThreshold,
      defaults: {
        outgoingCoefficient: defaultSelection.outgoingCoefficient,
        defaultRenderCoefficient: defaultSelection.defaultRenderCoefficient,
        nonDefaultRenderCoefficient:
          defaultSelection.nonDefaultRenderCoefficient,
        grinStepCoefficient: defaultSelection.grinStepCoefficient,
      },
    });
    const engineSelection = {
      webGpuWorkloadThreshold,
      ...corrections,
    };
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
  profiles,
  cooperationProbes,
  endToEndProbes,
  primitiveConfig,
  cpuConfig,
  webGpuConfig,
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
    timing: {
      measuredRepeats,
      warmupsPerProbeAndConfiguration: 1,
      warmupIncludedInFit: false,
      rayCooperationBoundary:
        'UI-thread simulator update without render output through simulationComplete and WebGPU queue synchronization',
      endToEndBoundary:
        'UI-thread updateSimulation(false, true, true) through simulationComplete and explicit Canvas/WebGL/WebGPU rendering synchronization',
    },
    probes: {
      rayCooperation: cooperationProbes.map(probe => probe.id),
      endToEnd: endToEndProbes.map(probe => probe.id),
    },
    executionOrder:
      'CPU for every probe; each WebGPU ray-cooperation profile for every ray-cooperation probe; selected WebGPU profile for every end-to-end probe',
    fixedConfiguration: {
      primitive: primitiveConfig,
      primitiveCpu: cpuConfig,
      webgpuBase: webGpuConfig,
    },
    fitting: {
      significantWrongChoiceRuntimeMs: SIGNIFICANT_RUNTIME_MS,
      selectorForm:
        'initial rays * (sqrt(max(1, curves)) + outgoing + color-mode render + GRIN stepping corrections)',
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
  device = null,
  measuredRepeats,
  signal,
  onSimulator,
  onProbeStart,
  onProbeComplete,
}) {
  const results = [];
  for (const probe of probes) {
    throwIfAborted(signal);
    onProbeStart(probe);
    const scene = await loadProbeScene(probe.scene);
    resizeCanvases(canvasSet, scene.width, scene.height);
    const simulator = createSimulator({
      scene,
      engine,
      primitiveConfig,
      canvasSet,
      rendered,
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
    for (let repeat = 0; repeat < measuredRepeats; repeat++) {
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

async function loadProbeScene(sceneJson) {
  const scene = new Scene();
  const width = Math.max(1, Math.round(sceneJson.width));
  const height = Math.max(1, Math.round(sceneJson.height));
  scene.setViewportSize(width, height);
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
}) {
  return new PrimitiveBasedSimulator({
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
