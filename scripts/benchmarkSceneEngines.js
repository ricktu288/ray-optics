import seedrandom from 'seedrandom';
import {
  CpuSimulationEngine,
  FLOAT32_EPSILON,
  PrimitiveBasedSimulator,
  Scene,
  WebGpuSimulationEngine,
} from '../src/core/index.js';
import {
  resolvePrimitiveSimulatorConfig,
  resolveSimulationEngineConfig,
  WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE,
} from '../src/core/simulationEngines/config.js';
import { DEFAULT_WEBGPU_WORKLOAD_THRESHOLD } from
  '../src/core/simulationEngines/primitiveEngineSelection.js';

const REPORT_VERSION = 'real-scene-engine-benchmark-v4';
const STORAGE_KEY = 'rayOpticsRealSceneEngineBenchmarkReport';
const DEFAULT_MAX_RAY_DEPTH = 256;
const DEFAULT_RAY_COUNT_LIMIT = 10_000_000;
const ENGINE_SELECTION_THRESHOLD = DEFAULT_WEBGPU_WORKLOAD_THRESHOLD;
const SIGNIFICANT_RUNTIME_MS = 150;
const COEFFICIENT_GRID_MAX = 8;
const COEFFICIENT_GRID_STEP = 0.25;
const CALIBRATION_PROBE_TARGETS = [
  {
    id: 'non-default-outgoing',
    colorClass: 'non-default',
    term: 'outgoing',
    requiredCoefficient: 2,
  },
  {
    id: 'default-outgoing-and-render',
    colorClass: 'default',
    term: 'outgoing',
    requiredCoefficient: 5.5,
  },
  {
    id: 'non-default-render',
    colorClass: 'non-default',
    term: 'render',
    requiredCoefficient: 1,
  },
  {
    id: 'default-render-low',
    colorClass: 'default',
    term: 'render',
    requiredCoefficient: 0.75,
  },
  {
    id: 'default-render-high',
    colorClass: 'default',
    term: 'render',
    requiredCoefficient: 4,
  },
];
const params = new URLSearchParams(location.search);
const repeats = integerParameter('repeats', 3, 1, 9);
const timeoutMs = numberParameter('timeoutSeconds', 30, 1, 300) * 1000;
const calibrationCaseCount = integerParameter('calibrationCases', 5, 3, 64);
const randomSeed = params.get('seed') ?? 'real-scene-engine-benchmark-v1';
const selectedSceneIds = stringSetParameter('scene');
const selectedGroups = stringSetParameter('group');
const selectedSettingIds = stringSetParameter('setting');

const statusElement = document.querySelector('#status');
const summaryElement = document.querySelector('#summary');
const resultsElement = document.querySelector('#results');
const startButton = document.querySelector('#start');
const stopButton = document.querySelector('#stop');
const downloadJsonButton = document.querySelector('#downloadJson');
const downloadCsvButton = document.querySelector('#downloadCsv');
const canvases = Object.fromEntries([
  'canvasBelowLight', 'canvasLight', 'canvasLightWebGL',
  'canvasLightWebGPU', 'canvasAboveLight', 'canvasGrid'
].map(id => [id, document.getElementById(id)]));

let manifest = [];
let cases = [];
let currentReport = restoreReport();
let running = false;
let stopRequested = false;
let activeSimulator = null;
let sharedGpu = null;

const webGpuBaseConfig = resolveSimulationEngineConfig('webgpu');
const defaultSettingIds = new Set(['primitiveCpu', 'webgpu-production']);
const availableSettings = [
  {
    id: 'primitiveCpu',
    label: 'Primitive CPU',
    kind: 'primitiveCpu',
    purpose: 'Primitive-based JavaScript CPU baseline',
  },
  {
    id: 'webgpu-production',
    label: 'WebGPU production formula',
    kind: 'webgpu',
    purpose: 'Current cooperation and direct-versus-BVH formula',
    config: webGpuBaseConfig,
  },
  {
    id: 'webgpu-no-cooperation',
    label: 'WebGPU no cooperation',
    kind: 'webgpu',
    purpose: 'Isolates whether end-to-end rendering justifies ray cooperation',
    config: { ...webGpuBaseConfig, rayCooperationEnabled: false },
  },
];
const settings = availableSettings.filter(setting => selectedSettingIds
  ? selectedSettingIds.has(setting.id)
  : defaultSettingIds.has(setting.id)
);

startButton.addEventListener('click', runBenchmark);
stopButton.addEventListener('click', () => {
  stopRequested = true;
  stopButton.disabled = true;
  statusElement.textContent = 'Stopping after the current simulator update…';
  activeSimulator?.stopSimulation?.();
});
downloadJsonButton.addEventListener('click', () => downloadReport('json'));
downloadCsvButton.addEventListener('click', () => downloadReport('csv'));

if (currentReport) {
  enableDownloads();
  renderReport(currentReport);
  statusElement.textContent =
    `Restored a ${currentReport.runStatus ?? 'partial'} report with ` +
    `${currentReport.results?.length ?? 0} collected results. Loading scenes…`;
}

initialize().catch(showFatalError);

async function initialize() {
  const response = await fetch(
    './scene-engine-benchmark-manifest.json',
    { cache: 'no-store' }
  );
  if (!response.ok) throw new Error(`Scene manifest request failed: ${response.status}`);
  manifest = await response.json();
  manifest = manifest.filter(scene =>
    (!selectedSceneIds || selectedSceneIds.has(scene.id)) &&
    (!selectedGroups || selectedGroups.has(scene.group))
  );
  cases = manifest.flatMap(scene => [
    createCase(scene, 'authored'),
    ...(scene.hasDensityResponsiveSource
      ? [createCase(scene, '5x-linear')]
      : []),
  ]);
  if (!cases.length) throw new Error('No benchmark scenes matched the URL filters.');
  if (!settings.length) throw new Error('No benchmark settings matched the URL filters.');
  startButton.disabled = false;
  const webGpuCount = settings.filter(setting => setting.kind === 'webgpu').length;
  statusElement.textContent =
    `Ready: ${manifest.length} authored scenes, ${cases.length} cases, ` +
    `${settings.length} ordered passes (${webGpuCount} WebGPU settings).`;
  if (params.get('autorun') === '1') runBenchmark();
}

function createCase(scene, variant) {
  return {
    key: `${scene.group}/${scene.id}/${variant}`,
    sceneIndex: scene.index,
    sceneId: scene.id,
    group: scene.group,
    category: scene.category,
    url: scene.url,
    variant,
  };
}

async function runBenchmark() {
  if (running) return;
  running = true;
  stopRequested = false;
  startButton.disabled = true;
  stopButton.disabled = false;
  statusElement.className = '';
  const startedAt = performance.now();
  currentReport = createReport();
  window.__sceneEngineBenchmarkReport = currentReport;
  enableDownloads();
  persistReport();
  renderReport(currentReport);

  try {
    for (let settingIndex = 0; settingIndex < settings.length; settingIndex++) {
      const setting = settings[settingIndex];
      if (stopRequested) break;
      if (setting.id === 'webgpu-production') {
        initializeCalibrationSelection(currentReport);
      }
      currentReport.currentSetting = setting.id;
      persistReport();
      let environment;
      try {
        environment = await createEnvironment(setting);
      } catch (error) {
        appendUnavailableSetting(setting, error);
        continue;
      }

      try {
        const settingCases = orderCasesForSetting(setting, cases, currentReport);
        for (let caseIndex = 0; caseIndex < settingCases.length; caseIndex++) {
          if (stopRequested) break;
          const benchmarkCase = settingCases[caseIndex];
          const completed = currentReport.results.length;
          const total = cases.length * settings.length;
          statusElement.textContent =
            `${completed + 1}/${total}: ${setting.label} — ` +
            `${benchmarkCase.group}/${benchmarkCase.sceneId} ` +
            `(${benchmarkCase.variant})`;
          const result = await benchmarkCaseWithSetting(
            benchmarkCase,
            setting,
            environment
          );
          currentReport.results.push(result);
          updateEngineSelectionAnalysis(currentReport);
          currentReport.elapsedSeconds = (performance.now() - startedAt) / 1000;
          currentReport.completedResultCount = currentReport.results.length;
          currentReport.remainingEstimateSeconds = estimateRemainingSeconds(
            currentReport,
            cases.length * settings.length
          );
          persistReport();
          renderReport(currentReport);
          await nextFrame();
        }
      } finally {
        await environment.dispose();
      }
    }

    currentReport.elapsedSeconds = (performance.now() - startedAt) / 1000;
    currentReport.finishedAt = new Date().toISOString();
    currentReport.currentSetting = null;
    if (stopRequested) {
      currentReport.runStatus = 'stopped';
      statusElement.textContent = 'Stopped. The partial report is ready to download.';
    } else {
      currentReport.runStatus = 'complete';
      statusElement.textContent =
        `Done in ${formatDuration(currentReport.elapsedSeconds)}.`;
    }
  } catch (error) {
    console.error(error);
    currentReport.runStatus = 'failed';
    currentReport.error = error?.stack ?? String(error);
    currentReport.elapsedSeconds = (performance.now() - startedAt) / 1000;
    currentReport.finishedAt = new Date().toISOString();
    statusElement.className = 'error';
    statusElement.textContent = currentReport.error;
  } finally {
    activeSimulator = null;
    running = false;
    stopButton.disabled = true;
    startButton.disabled = false;
    persistReport();
    renderReport(currentReport);
    window.__sceneEngineBenchmarkDone = true;
    sharedGpu?.device?.destroy?.();
    sharedGpu = null;
  }
}

function createReport() {
  return {
    benchmark: REPORT_VERSION,
    runStatus: 'running',
    generatedAt: new Date().toISOString(),
    browser: navigator.userAgent,
    timing: {
      primary: 'end-to-end wall clock',
      warmupsPerCase: 1,
      measuredRepeatsPerCase: repeats,
      timeoutSeconds: timeoutMs / 1000,
      boundary: {
        starts: 'Immediately before updateSimulation(false, true, true)',
        ends: 'After simulation completion and explicit output synchronization',
        includes: [
          'scene primitive collection and preprocessing',
          'source generation and ray tracing',
          'all simulator rendering passes',
          'Canvas 2D getImageData synchronization for rendered layers',
          'WebGL finish',
          'WebGPU queue completion and canvas presentation submission',
        ],
        excludes: [
          'JSON fetch and scene construction',
          'first update warmup',
          'WebGPU adapter/device initialization',
          'shader and pipeline compilation performed by the warmup update',
        ],
      },
    },
    population: {
      authoredSceneCount: manifest.length,
      densityVariantCount: cases.length - manifest.length,
      caseCount: cases.length,
      densityVariantRule:
        'Add a 5x density, linear-color case for scenes containing AngleSource, Beam, or PointSource, including module definitions.',
      densityPropertyRule:
        'rayModeDensity for rays/extended; imageModeDensity for images/observer',
      defaultColorRayPowerCutoff: 0.01,
      randomSeed,
      backgroundImages: 'disabled; presentation-only and not timed',
      unauthoredMaxRayDepth: DEFAULT_MAX_RAY_DEPTH,
      rayCountLimit: DEFAULT_RAY_COUNT_LIMIT,
      cases: cases.map(({ url: _url, ...item }) => item),
    },
    executionOrder: settings.map(setting => setting.id),
    settings: Object.fromEntries(settings.map(setting => [setting.id, {
      label: setting.label,
      kind: setting.kind,
      purpose: setting.purpose,
      config: setting.config ?? null,
    }])),
    adapter: null,
    calibration: {
      requestedCaseCount: calibrationCaseCount,
      caseKeys: [],
      status: 'awaiting-primitive-cpu-pass',
      selectionUsesTimingData: false,
      selectedCasesRunFirstInProductionWebGpuPass: true,
      probeTargets: CALIBRATION_PROBE_TARGETS,
      selectionRule:
        'Choose coefficient-targeted probes from static expanded-primitive workloads; use farthest-point sampling only for extra requested cases.',
    },
    engineSelectionModel: null,
    results: [],
    completedResultCount: 0,
    totalResultCount: cases.length * settings.length,
  };
}

async function benchmarkCaseWithSetting(benchmarkCase, setting, environment) {
  const startedAt = performance.now();
  let simulator = null;
  try {
    const response = await fetch(benchmarkCase.url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Scene request failed: ${response.status}`);
    const authoredJson = await response.json();
    const prepared = prepareSceneJson(authoredJson, benchmarkCase.variant);
    resizeCanvases(prepared.width, prepared.height);
    const scene = await loadScene(prepared.sceneJson, prepared.width, prepared.height);
    simulator = environment.createSimulator(scene);
    activeSimulator = simulator;

    const warmup = await runSimulatorUpdate(simulator, environment, timeoutMs);
    if (warmup.status !== 'ok') {
      return resultRow({
        benchmarkCase, setting, prepared, simulator, status: 'warmup-' + warmup.status,
        error: warmup.error, warmupMs: warmup.elapsedMs,
        elapsedWallMs: performance.now() - startedAt,
      });
    }

    const samples = [];
    for (let index = 0; index < repeats; index++) {
      if (stopRequested) break;
      const sample = await runSimulatorUpdate(simulator, environment, timeoutMs);
      samples.push(sample);
      if (sample.status !== 'ok') break;
    }
    const successfulTimes = samples
      .filter(sample => sample.status === 'ok')
      .map(sample => sample.elapsedMs);
    const finalSample = samples.at(-1);
    return resultRow({
      benchmarkCase,
      setting,
      prepared,
      simulator,
      status: stopRequested && samples.length === 0
        ? 'stopped'
        : finalSample?.status ?? 'missing',
      error: finalSample?.error ?? null,
      warmupMs: warmup.elapsedMs,
      samplesMs: successfulTimes,
      medianMs: successfulTimes.length ? median(successfulTimes) : null,
      elapsedWallMs: performance.now() - startedAt,
    });
  } catch (error) {
    return resultRow({
      benchmarkCase,
      setting,
      prepared: null,
      simulator,
      status: 'error',
      error: error?.stack ?? String(error),
      elapsedWallMs: performance.now() - startedAt,
    });
  } finally {
    activeSimulator = null;
  }
}

function prepareSceneJson(authoredJson, variant) {
  const sceneJson = structuredClone(authoredJson);
  // Background bitmaps are presentation-only and intentionally excluded from
  // engine timing. Removing the reference also avoids waiting for image I/O
  // before Scene.loadJSON reports completion.
  delete sceneJson.backgroundImage;
  sceneJson.randomSeed = randomSeed;
  if (!Number.isFinite(sceneJson.maxRayDepth)) {
    sceneJson.maxRayDepth = DEFAULT_MAX_RAY_DEPTH;
  }
  const mode = sceneJson.mode ?? 'rays';
  const densityProperty = mode === 'rays' || mode === 'extended'
    ? 'rayModeDensity'
    : 'imageModeDensity';
  const baseDensity = finitePositiveOr(
    sceneJson[densityProperty],
    densityProperty === 'rayModeDensity' ? 0.1 : 1
  );
  if (variant === '5x-linear') {
    sceneJson[densityProperty] = baseDensity * 5;
    sceneJson.colorMode = 'linear';
  }
  const colorMode = sceneJson.colorMode ?? 'default';
  if (colorMode === 'default') {
    sceneJson.numericalTolerances = {
      ...(sceneJson.numericalTolerances ?? {}),
      rayPowerCutoff: 0.01,
    };
  }
  return {
    sceneJson,
    mode,
    densityProperty,
    baseDensity,
    effectiveDensity: variant === '5x-linear' ? baseDensity * 5 : baseDensity,
    colorMode,
    rayPowerCutoff: sceneJson.numericalTolerances?.rayPowerCutoff ?? 1e-6,
    maxRayDepth: sceneJson.maxRayDepth,
    width: positiveIntegerOr(authoredJson.width, 1500),
    height: positiveIntegerOr(authoredJson.height, 900),
  };
}

async function loadScene(sceneJson, width, height) {
  const scene = new Scene();
  scene.setViewportSize(width, height);
  await new Promise(resolve => {
    scene.loadJSON(JSON.stringify(sceneJson), (_needFullUpdate, completed) => {
      if (completed) resolve();
    });
  });
  if (scene.error) throw new Error(`Scene load failed: ${scene.error}`);
  // Loading constructs a deterministic RNG, but setting it explicitly makes
  // the benchmark contract independent of Scene's initialization history.
  scene.rng = new seedrandom(randomSeed);
  return scene;
}

async function createEnvironment(setting) {
  const contexts = canvasContexts();
  const primitiveConfig = resolvePrimitiveSimulatorConfig();
  if (setting.kind === 'primitiveCpu') {
    requireWebGl(contexts.gl);
    const engine = new CpuSimulationEngine({
      ctxMain: contexts.main,
      glMain: contexts.gl,
      ctxVirtual: contexts.virtual,
      config: resolveSimulationEngineConfig('primitiveCpu'),
    });
    return {
      kind: setting.kind,
      engine,
      ...contexts,
      createSimulator: scene => createPrimitiveSimulator(
        scene, engine, contexts, primitiveConfig
      ),
      dispose: async () => engine.dispose(),
    };
  }

  const gpu = await getSharedGpu();
  const output = createBrowserWebGpuOutput(canvases.canvasLightWebGPU);
  const engine = new WebGpuSimulationEngine({
    device: gpu.device,
    output,
    numericEpsilon: FLOAT32_EPSILON,
    ownsDevice: false,
    config: setting.config,
  });
  return {
    kind: setting.kind,
    engine,
    device: gpu.device,
    ...contexts,
    createSimulator: scene => createPrimitiveSimulator(
      scene, engine, contexts, primitiveConfig
    ),
    dispose: async () => {
      await gpu.device.queue.onSubmittedWorkDone();
      engine.dispose();
    },
  };
}

function createPrimitiveSimulator(scene, engine, contexts, primitiveConfig) {
  return new PrimitiveBasedSimulator({
    scene,
    engine,
    ctxBelowLight: contexts.below,
    ctxAboveLight: contexts.above,
    ctxGrid: contexts.grid,
    ctxVirtual: contexts.virtual,
    enableTimer: true,
    rayCountLimit: DEFAULT_RAY_COUNT_LIMIT,
    tempCanvasFactory: createTempCanvas,
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

function runSimulatorUpdate(simulator, environment, caseTimeoutMs) {
  return new Promise(resolve => {
    let settled = false;
    const start = performance.now();
    const finish = async (status, error = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        await synchronizeRendering(environment);
      } catch (flushError) {
        status = 'flush-error';
        error = flushError?.stack ?? String(flushError);
      }
      resolve({ status, error, elapsedMs: performance.now() - start });
    };
    simulator.eventListeners = {};
    simulator.on('simulationComplete', () => finish(
      simulator.error ? 'engine-error' : 'ok',
      simulator.error ?? null
    ));
    simulator.on('simulationStop', () => finish('stopped'));
    const timer = setTimeout(() => {
      simulator.stopSimulation?.();
      finish('timeout', `Exceeded ${caseTimeoutMs} ms`);
    }, caseTimeoutMs);
    try {
      simulator.updateSimulation(false, true, true);
    } catch (error) {
      finish('error', error?.stack ?? String(error));
    }
  });
}

async function synchronizeRendering(environment) {
  // Canvas 2D has no explicit flush in ordinary HTML canvases. A one-pixel
  // read synchronizes the command stream without copying the full viewport.
  const canvas2dContexts = [
    environment.below,
    environment.above,
    environment.grid,
    environment.virtual,
    ...(environment.kind === 'webgpu' ? [] : [environment.main]),
  ];
  for (const context of canvas2dContexts) {
    context?.getImageData?.(0, 0, 1, 1);
  }
  if (environment.kind !== 'webgpu') {
    environment.gl?.finish?.();
  }
  await environment.device?.queue?.onSubmittedWorkDone?.();
}

function resultRow({
  benchmarkCase,
  setting,
  prepared,
  simulator,
  status,
  error = null,
  warmupMs = null,
  samplesMs = [],
  medianMs = null,
  elapsedWallMs = null,
}) {
  const staticWorkload = summarizeSimulatorWorkload(simulator);
  return {
    setting: setting.id,
    engine: setting.kind,
    case: benchmarkCase.key,
    scene: benchmarkCase.sceneId,
    group: benchmarkCase.group,
    category: benchmarkCase.category,
    variant: benchmarkCase.variant,
    mode: prepared?.mode ?? null,
    densityProperty: prepared?.densityProperty ?? null,
    baseDensity: prepared?.baseDensity ?? null,
    effectiveDensity: prepared?.effectiveDensity ?? null,
    colorMode: prepared?.colorMode ?? null,
    rayPowerCutoff: prepared?.rayPowerCutoff ?? null,
    maxRayDepth: prepared?.maxRayDepth ?? null,
    viewportWidth: prepared?.width ?? null,
    viewportHeight: prepared?.height ?? null,
    status,
    warmupMs,
    samplesMs,
    medianMs,
    processedRayCount: simulator?.processedRayCount ?? null,
    staticWorkload,
    initialRayCount: staticWorkload?.initialRayCount ?? null,
    primitiveCurveCount: staticWorkload?.primitiveCurveCount ?? null,
    additionalOutgoingRaySlotCount:
      staticWorkload?.additionalOutgoingRaySlotCount ?? null,
    currentSelectionScore: staticWorkload?.intersectionScore ?? null,
    totalTruncation: simulator?.totalTruncation ?? null,
    elapsedWallMs,
    error: error ? String(error).slice(0, 4000) : null,
    completedAt: new Date().toISOString(),
  };
}

function summarizeSimulatorWorkload(simulator) {
  const workload = simulator?.workload;
  const primitives = simulator?.primitives;
  if (
    !workload ||
    !Number.isFinite(workload.initialRayCount) ||
    !Number.isFinite(workload.primitiveCurveCount) ||
    !Array.isArray(primitives)
  ) {
    return null;
  }

  let additionalOutgoingRaySlotCount = 0;
  const primitiveKindCounts = {
    source: 0,
    surface: 0,
    region: 0,
    detector: 0,
  };
  for (const primitive of primitives) {
    if (primitiveKindCounts[primitive?.kind] !== undefined) {
      primitiveKindCounts[primitive.kind]++;
    }
    if (primitive?.kind === 'surface') {
      additionalOutgoingRaySlotCount += Math.max(
        0,
        finiteNonnegativeOr(primitive.surfaceType?.outRayCount, 1) - 1
      );
    } else if (primitive?.kind === 'region' && primitive.partialReflect) {
      additionalOutgoingRaySlotCount += Array.isArray(primitive.curves)
        ? primitive.curves.length
        : 0;
    }
  }

  const initialRayCount = workload.initialRayCount;
  const primitiveCurveCount = workload.primitiveCurveCount;
  return {
    source: 'expanded primitive object list after module expansion',
    primitiveCount: primitives.length,
    primitiveKindCounts,
    initialRayCount,
    primitiveCurveCount,
    additionalOutgoingRaySlotCount,
    intersectionScore: primitiveCurveCount > 0
      ? initialRayCount * Math.sqrt(primitiveCurveCount)
      : 0,
    outgoingScoreBase: initialRayCount * additionalOutgoingRaySlotCount,
    renderScoreBase: initialRayCount,
  };
}

function initializeCalibrationSelection(report) {
  if (report.calibration?.caseKeys?.length) return;
  const candidates = report.results.filter(result =>
    result.setting === 'primitiveCpu' &&
    result.staticWorkload
  );
  const selected = selectCalibrationRows(candidates, calibrationCaseCount);
  report.calibration = {
    ...report.calibration,
    status: selected.length ? 'awaiting-webgpu-calibration-cases' : 'unavailable',
    availableCandidateCount: candidates.length,
    actualCaseCount: selected.length,
    caseKeys: selected.map(result => result.case),
  };
}

function orderCasesForSetting(setting, unorderedCases, report) {
  if (setting.id !== 'webgpu-production') return unorderedCases;
  const calibrationKeys = new Set(report.calibration?.caseKeys ?? []);
  if (!calibrationKeys.size) return unorderedCases;
  return [
    ...unorderedCases.filter(item => calibrationKeys.has(item.key)),
    ...unorderedCases.filter(item => !calibrationKeys.has(item.key)),
  ];
}

function selectCalibrationRows(rows, requestedCount) {
  if (rows.length <= requestedCount) return [...rows];
  const ordered = [...rows].sort((a, b) => a.case.localeCompare(b.case));
  const vectors = standardizeVectors(ordered.map(calibrationFeatureVector));
  const selectedIndices = [];
  const addIndex = index => {
    if (index >= 0 && !selectedIndices.includes(index)) selectedIndices.push(index);
  };

  for (const target of CALIBRATION_PROBE_TARGETS) {
    if (selectedIndices.length >= requestedCount) break;
    const targetIndex = closestProbeIndex(
      ordered,
      selectedIndices,
      target
    );
    addIndex(targetIndex);
  }

  while (selectedIndices.length < requestedCount) {
    let bestIndex = -1;
    let bestDistance = -1;
    for (let index = 0; index < ordered.length; index++) {
      if (selectedIndices.includes(index)) continue;
      const distance = Math.min(...selectedIndices.map(selectedIndex =>
        squaredDistance(vectors[index], vectors[selectedIndex])
      ));
      if (distance > bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    if (bestIndex < 0) break;
    selectedIndices.push(bestIndex);
  }
  return selectedIndices.map(index => ordered[index]);
}

function closestProbeIndex(rows, selectedIndices, target) {
  let bestIndex = -1;
  let bestDistance = Infinity;
  for (let index = 0; index < rows.length; index++) {
    if (selectedIndices.includes(index)) continue;
    const row = rows[index];
    if ((row.colorMode === 'default' ? 'default' : 'non-default') !==
      target.colorClass) continue;
    const workload = row.staticWorkload;
    if (workload.intersectionScore >= ENGINE_SELECTION_THRESHOLD) continue;
    const correctionBase = target.term === 'outgoing'
      ? workload.outgoingScoreBase
      : workload.renderScoreBase;
    if (
      correctionBase <= 0 ||
      (target.term === 'render' && workload.outgoingScoreBase !== 0)
    ) continue;
    const requiredCoefficient =
      (ENGINE_SELECTION_THRESHOLD - workload.intersectionScore) /
      correctionBase;
    if (!Number.isFinite(requiredCoefficient) || requiredCoefficient <= 0) {
      continue;
    }
    const distance = Math.abs(Math.log(
      requiredCoefficient / target.requiredCoefficient
    ));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function calibrationFeatureVector(row) {
  const workload = row.staticWorkload;
  return [
    Math.log1p(workload.intersectionScore),
    Math.log1p(workload.outgoingScoreBase),
    Math.log1p(workload.initialRayCount),
    row.colorMode === 'default' ? 0 : 1,
  ];
}

function standardizeVectors(vectors) {
  if (!vectors.length) return [];
  const means = vectors[0].map((_, column) =>
    vectors.reduce((sum, vector) => sum + vector[column], 0) / vectors.length
  );
  const scales = means.map((mean, column) => Math.sqrt(
    vectors.reduce((sum, vector) =>
      sum + (vector[column] - mean) ** 2, 0
    ) / vectors.length
  ) || 1);
  return vectors.map(vector => vector.map((value, column) =>
    (value - means[column]) / scales[column]
  ));
}

function squaredDistance(first, second) {
  return first.reduce((sum, value, index) =>
    sum + (value - second[index]) ** 2, 0
  );
}

function updateEngineSelectionAnalysis(report) {
  const calibrationKeys = report.calibration?.caseKeys ?? [];
  if (!calibrationKeys.length) return;
  const productionRows = new Map(report.results
    .filter(result => result.setting === 'webgpu-production')
    .map(result => [result.case, result]));
  const settledCalibrationCount = calibrationKeys.filter(caseKey =>
    productionRows.has(caseKey)
  ).length;
  report.calibration.completedWebGpuCaseCount = settledCalibrationCount;
  if (settledCalibrationCount < calibrationKeys.length) return;
  const calibrationSet = new Set(calibrationKeys);
  report.calibration.totalElapsedWallMs = report.results
    .filter(result =>
      calibrationSet.has(result.case) &&
      (result.setting === 'primitiveCpu' ||
        result.setting === 'webgpu-production')
    )
    .reduce((sum, result) => sum + (result.elapsedWallMs ?? 0), 0);

  const comparison = collectEngineComparisonPairs(report.results);
  const calibrationPairs = comparison.pairs.filter(pair =>
    calibrationSet.has(pair.case)
  );
  if (calibrationPairs.length < Math.min(6, calibrationKeys.length)) {
    report.calibration.status = 'insufficient-valid-pairs';
    report.calibration.validPairCount = calibrationPairs.length;
    return;
  }

  let coefficients = report.engineSelectionModel?.coefficients;
  if (!coefficients) {
    coefficients = fitCorrectionCoefficients(calibrationPairs);
  }
  const ratioSlope = report.engineSelectionModel?.ratioModel?.slope ??
    fitRatioSlope(calibrationPairs, coefficients);
  const heldOutPairs = comparison.pairs.filter(pair =>
    !calibrationSet.has(pair.case)
  );
  report.calibration.status = comparison.exclusions.some(exclusion =>
    calibrationSet.has(exclusion.case)
  ) ? 'ready-with-exclusions' : 'ready';
  report.calibration.validPairCount = calibrationPairs.length;
  report.engineSelectionModel = {
    status: 'ready',
    fittedAt: report.engineSelectionModel?.fittedAt ?? new Date().toISOString(),
    threshold: ENGINE_SELECTION_THRESHOLD,
    intersectionTermCalibration: {
      source: 'current hardcoded production selector',
      calibratedByThisRun: false,
      note:
        'The small end-to-end calibration fits only outgoing and render corrections.',
    },
    significantRuntimeMs: SIGNIFICANT_RUNTIME_MS,
    wrongChoiceDefinition:
      `Predicted engine is slower and its measured median runtime is greater than ${SIGNIFICANT_RUNTIME_MS} ms.`,
    predictorData:
      'Expanded primitive list and scene color mode only; execution counts are validation-only.',
    formula:
      'N * (sqrt(C) + outgoingCoefficient * B + renderCoefficient(colorMode))',
    variables: {
      N: 'initialRayCount',
      C: 'primitiveCurveCount',
      B: 'additionalOutgoingRaySlotCount',
    },
    coefficients,
    coefficientFit: {
      source: 'calibration cases only',
      gridMinimum: 0,
      gridMaximum: COEFFICIENT_GRID_MAX,
      gridStep: COEFFICIENT_GRID_STEP,
      objective:
        `Lexicographically minimize >${SIGNIFICANT_RUNTIME_MS} ms wrong choices, regret, all winner disagreements, then coefficient sum.`,
    },
    ratioModel: {
      formula: 'predicted CPU/WebGPU time ratio = exp(slope * ln(score / threshold))',
      slope: ratioSlope,
      source: 'calibration cases only',
    },
    validation: {
      processedRayCountRelativeTolerance: 0.03,
      exclusionCount: comparison.exclusions.length,
      exclusions: comparison.exclusions,
    },
    evaluation: {
      calibration: evaluateModelSubset(calibrationPairs, coefficients, ratioSlope),
      heldOut: evaluateModelSubset(heldOutPairs, coefficients, ratioSlope),
      allCompleted: evaluateModelSubset(comparison.pairs, coefficients, ratioSlope),
    },
  };
}

function collectEngineComparisonPairs(results) {
  const cpuRows = new Map(results
    .filter(result => result.setting === 'primitiveCpu')
    .map(result => [result.case, result]));
  const gpuRows = new Map(results
    .filter(result => result.setting === 'webgpu-production')
    .map(result => [result.case, result]));
  const pairs = [];
  const exclusions = [];
  for (const [caseKey, cpu] of cpuRows) {
    const gpu = gpuRows.get(caseKey);
    if (!gpu) continue;
    let reason = null;
    if (
      cpu.status !== 'ok' || gpu.status !== 'ok' ||
      !Number.isFinite(cpu.medianMs) || !Number.isFinite(gpu.medianMs)
    ) {
      reason = `status: primitiveCpu=${cpu.status}, webgpu=${gpu.status}`;
    } else if (
      cpu.colorMode !== gpu.colorMode ||
      cpu.rayPowerCutoff !== gpu.rayPowerCutoff
    ) {
      reason = 'color mode or ray-power cutoff differs between engines';
    } else if (!equivalentStaticWorkloads(cpu.staticWorkload, gpu.staticWorkload)) {
      reason = 'expanded primitive workload differs between engines';
    } else if (processedRayCountRelativeDifference(cpu, gpu) > 0.03) {
      reason = 'processed ray counts differ by more than 3%';
    }
    if (reason) {
      exclusions.push({ case: caseKey, reason });
      continue;
    }
    pairs.push({
      case: caseKey,
      colorMode: cpu.colorMode,
      cpuMs: cpu.medianMs,
      gpuMs: gpu.medianMs,
      workload: cpu.staticWorkload,
    });
  }
  return { pairs, exclusions };
}

function equivalentStaticWorkloads(first, second) {
  return first && second && [
    'initialRayCount',
    'primitiveCurveCount',
    'additionalOutgoingRaySlotCount',
  ].every(key => first[key] === second[key]);
}

function processedRayCountRelativeDifference(first, second) {
  if (
    !Number.isFinite(first.processedRayCount) ||
    !Number.isFinite(second.processedRayCount)
  ) return Infinity;
  return Math.abs(first.processedRayCount - second.processedRayCount) /
    Math.max(1, first.processedRayCount, second.processedRayCount);
}

function fitCorrectionCoefficients(pairs) {
  let best = null;
  const stepCount = Math.round(COEFFICIENT_GRID_MAX / COEFFICIENT_GRID_STEP);
  for (let outgoingIndex = 0; outgoingIndex <= stepCount; outgoingIndex++) {
    const outgoingCoefficient = outgoingIndex * COEFFICIENT_GRID_STEP;
    for (let defaultIndex = 0; defaultIndex <= stepCount; defaultIndex++) {
      const defaultRenderCoefficient = defaultIndex * COEFFICIENT_GRID_STEP;
      for (let nonDefaultIndex = 0; nonDefaultIndex <= stepCount; nonDefaultIndex++) {
        const nonDefaultRenderCoefficient =
          nonDefaultIndex * COEFFICIENT_GRID_STEP;
        const coefficients = {
          outgoingCoefficient,
          defaultRenderCoefficient,
          nonDefaultRenderCoefficient,
        };
        const metrics = selectionMetrics(pairs, coefficients);
        const objective = [
          metrics.wrongChoiceCount,
          metrics.totalRegretMs,
          metrics.winnerDisagreementCount,
          outgoingCoefficient + defaultRenderCoefficient +
            nonDefaultRenderCoefficient,
        ];
        if (!best || lexicographicallyLess(objective, best.objective)) {
          best = { coefficients, objective };
        }
      }
    }
  }
  return best.coefficients;
}

function correctedSelectionScore(pair, coefficients) {
  const workload = pair.workload;
  const renderCoefficient = pair.colorMode === 'default'
    ? coefficients.defaultRenderCoefficient
    : coefficients.nonDefaultRenderCoefficient;
  return workload.intersectionScore +
    coefficients.outgoingCoefficient * workload.outgoingScoreBase +
    renderCoefficient * workload.renderScoreBase;
}

function selectionMetrics(pairs, coefficients, includeCases = false) {
  let wrongChoiceCount = 0;
  let winnerDisagreementCount = 0;
  let totalRegretMs = 0;
  let selectedWebGpuCount = 0;
  const wrongCases = [];
  for (const pair of pairs) {
    const score = correctedSelectionScore(pair, coefficients);
    const selectsWebGpu = score >= ENGINE_SELECTION_THRESHOLD;
    const selectedMs = selectsWebGpu ? pair.gpuMs : pair.cpuMs;
    const bestMs = Math.min(pair.cpuMs, pair.gpuMs);
    const wrong = selectedMs > bestMs;
    if (selectsWebGpu) selectedWebGpuCount++;
    if (!wrong) continue;
    winnerDisagreementCount++;
    const regretMs = selectedMs - bestMs;
    totalRegretMs += regretMs;
    if (selectedMs > SIGNIFICANT_RUNTIME_MS) wrongChoiceCount++;
    if (includeCases) {
      wrongCases.push({
        case: pair.case,
        selectedEngine: selectsWebGpu ? 'webgpu' : 'primitiveCpu',
        selectedMs,
        bestMs,
        regretMs,
        countedWrongChoice: selectedMs > SIGNIFICANT_RUNTIME_MS,
      });
    }
  }
  wrongCases.sort((a, b) => b.regretMs - a.regretMs);
  return {
    pairCount: pairs.length,
    wrongChoiceCount,
    winnerDisagreementCount,
    totalRegretMs,
    selectedWebGpuCount,
    ...(includeCases ? { worstWrongChoices: wrongCases.slice(0, 12) } : {}),
  };
}

function fitRatioSlope(pairs, coefficients) {
  let numerator = 0;
  let denominator = 0;
  for (const pair of pairs) {
    const normalizedScore = Math.max(
      1e-12,
      correctedSelectionScore(pair, coefficients) / ENGINE_SELECTION_THRESHOLD
    );
    const x = Math.log(normalizedScore);
    const y = Math.log(Math.max(1e-12, pair.cpuMs / pair.gpuMs));
    numerator += x * y;
    denominator += x * x;
  }
  return denominator > 0 ? Math.max(0, numerator / denominator) : 0;
}

function evaluateModelSubset(pairs, coefficients, ratioSlope) {
  const corrected = selectionMetrics(pairs, coefficients, true);
  const currentFormula = selectionMetrics(pairs, {
    outgoingCoefficient: 0,
    defaultRenderCoefficient: 0,
    nonDefaultRenderCoefficient: 0,
  }, true);
  const ratioErrors = pairs.map(pair => {
    const normalizedScore = Math.max(
      1e-12,
      correctedSelectionScore(pair, coefficients) / ENGINE_SELECTION_THRESHOLD
    );
    const predictedRatio = Math.exp(Math.max(-20, Math.min(
      20,
      ratioSlope * Math.log(normalizedScore)
    )));
    const actualRatio = Math.max(1e-12, pair.cpuMs / pair.gpuMs);
    return {
      case: pair.case,
      predictedCpuToWebGpuRatio: predictedRatio,
      actualCpuToWebGpuRatio: actualRatio,
      multiplicativeError: Math.max(
        predictedRatio / actualRatio,
        actualRatio / predictedRatio
      ),
    };
  }).sort((a, b) => b.multiplicativeError - a.multiplicativeError);
  const errors = ratioErrors.map(item => item.multiplicativeError)
    .sort((a, b) => a - b);
  return {
    corrected,
    currentFormula,
    ratioPrediction: {
      medianMultiplicativeError: percentile(errors, 0.5),
      p90MultiplicativeError: percentile(errors, 0.9),
      maximumMultiplicativeError: errors.at(-1) ?? null,
      worstCases: ratioErrors.slice(0, 12),
    },
  };
}

function lexicographicallyLess(first, second) {
  for (let index = 0; index < first.length; index++) {
    if (first[index] < second[index] - 1e-9) return true;
    if (first[index] > second[index] + 1e-9) return false;
  }
  return false;
}

function percentile(sortedValues, fraction) {
  if (!sortedValues.length) return null;
  const position = (sortedValues.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] * (upper - position) +
    sortedValues[upper] * (position - lower);
}

function appendUnavailableSetting(setting, error) {
  for (const benchmarkCase of cases) {
    currentReport.results.push(resultRow({
      benchmarkCase,
      setting,
      prepared: null,
      simulator: null,
      status: 'unavailable',
      error: error?.stack ?? String(error),
    }));
  }
  currentReport.completedResultCount = currentReport.results.length;
  updateEngineSelectionAnalysis(currentReport);
  persistReport();
  renderReport(currentReport);
}

async function getSharedGpu() {
  if (sharedGpu) return sharedGpu;
  if (!navigator.gpu) throw new Error('WebGPU is unavailable in this browser.');
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
  });
  if (!adapter) throw new Error('No WebGPU adapter is available.');
  if (adapter.info?.isFallbackAdapter) {
    throw new Error('Refusing a fallback/software WebGPU adapter.');
  }
  const availableStorageBuffers = adapter.limits.maxStorageBuffersPerShaderStage;
  if (availableStorageBuffers < WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE) {
    throw new Error(
      `WebGPU exposes ${availableStorageBuffers} storage buffers per stage; ` +
      `${WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE} are required.`
    );
  }
  const device = await adapter.requestDevice({
    requiredLimits: {
      maxStorageBuffersPerShaderStage:
        WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE,
    },
  });
  device.addEventListener('uncapturederror', event => {
    console.error('Uncaptured WebGPU error:', event.error);
  });
  sharedGpu = { adapter, device };
  currentReport.adapter = {
    vendor: adapter.info?.vendor ?? null,
    architecture: adapter.info?.architecture ?? null,
    device: adapter.info?.device ?? null,
    description: adapter.info?.description ?? null,
    isFallbackAdapter: adapter.info?.isFallbackAdapter ?? false,
  };
  persistReport();
  return sharedGpu;
}

function createBrowserWebGpuOutput(canvas) {
  let context = null;
  const format = navigator.gpu.getPreferredCanvasFormat();
  return {
    format,
    getSize: () => ({ width: canvas.width, height: canvas.height }),
    initialize(device) {
      context = canvas.getContext('webgpu');
      if (!context) throw new Error('The WebGPU canvas context is unavailable.');
      context.configure({ device, format, alphaMode: 'premultiplied' });
    },
    acquireView: () => context.getCurrentTexture().createView(),
    dispose() {
      context?.unconfigure();
      context = null;
    },
  };
}

function canvasContexts() {
  const contextAttributes = {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
  };
  const gl = canvases.canvasLightWebGL.getContext('webgl', contextAttributes) ||
    canvases.canvasLightWebGL.getContext('experimental-webgl', contextAttributes);
  return {
    below: canvases.canvasBelowLight.getContext('2d'),
    main: canvases.canvasLight.getContext('2d'),
    above: canvases.canvasAboveLight.getContext('2d'),
    grid: canvases.canvasGrid.getContext('2d'),
    virtual: createTempCanvas(1, 1).getContext('2d'),
    gl,
  };
}

function requireWebGl(gl) {
  if (!gl || !gl.getExtension('OES_texture_float')) {
    throw new Error('WebGL with OES_texture_float is required for linear scenes.');
  }
}

function resizeCanvases(width, height) {
  for (const canvas of Object.values(canvases)) {
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }
}

function createTempCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function renderReport(report) {
  if (!report) return;
  const results = report.results ?? [];
  const successful = results.filter(result =>
    result.status === 'ok' && Number.isFinite(result.medianMs)
  );
  const aggregates = aggregateSettings(successful);
  summaryElement.innerHTML = '';
  const summary = document.createElement('p');
  summary.textContent =
    `${report.runStatus}: ${results.length}/${report.totalResultCount ?? '?'} ` +
    `results collected; ${successful.length} successful. ` +
    `Elapsed ${formatDuration(report.elapsedSeconds ?? 0)}` +
    (Number.isFinite(report.remainingEstimateSeconds)
      ? `; estimated remaining ${formatDuration(report.remainingEstimateSeconds)}`
      : '') + '.';
  summaryElement.append(summary);

  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Setting</th><th>Successful</th>' +
    '<th>Total median time</th><th>Mean time</th></tr></thead>';
  const body = document.createElement('tbody');
  for (const aggregate of aggregates) {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${escapeHtml(aggregate.label)}</td>` +
      `<td>${aggregate.count}</td>` +
      `<td>${formatMs(aggregate.totalMs)}</td>` +
      `<td>${formatMs(aggregate.totalMs / Math.max(1, aggregate.count))}</td>`;
    body.append(row);
  }
  table.append(body);
  summaryElement.append(table);

  if (report.calibration?.caseKeys?.length) {
    const calibrationSummary = document.createElement('p');
    const model = report.engineSelectionModel;
    if (model?.status === 'ready') {
      const coefficients = model.coefficients;
      const heldOut = model.evaluation.heldOut;
      calibrationSummary.textContent =
        `Static-only correction fitted from ${report.calibration.validPairCount}/` +
        `${report.calibration.caseKeys.length} calibration pairs in ` +
        `${formatDuration((report.calibration.totalElapsedWallMs ?? 0) / 1000)}: ` +
        `outgoing ` +
        `${coefficients.outgoingCoefficient}, default-render ` +
        `${coefficients.defaultRenderCoefficient}, non-default-render ` +
        `${coefficients.nonDefaultRenderCoefficient}. On ${heldOut.corrected.pairCount} ` +
        `completed held-out pairs: ${heldOut.corrected.wrongChoiceCount} ` +
        `wrong choices (selected runtime above ${model.significantRuntimeMs} ms), ` +
        `${heldOut.corrected.winnerDisagreementCount} raw winner disagreements, and ` +
        `${formatMs(heldOut.corrected.totalRegretMs)} total regret. The current ` +
        `intersection-only formula has ${heldOut.currentFormula.wrongChoiceCount} ` +
        `counted wrong choices. Median CPU/WebGPU ratio error is ` +
        `${formatFactor(heldOut.ratioPrediction.medianMultiplicativeError)}.`;
    } else {
      calibrationSummary.textContent =
        `Calibration: ${report.calibration.completedWebGpuCaseCount ?? 0}/` +
        `${report.calibration.caseKeys.length} selected WebGPU cases completed.`;
    }
    summaryElement.append(calibrationSummary);
  }

  const recent = results.slice(-30).reverse();
  resultsElement.innerHTML = '<thead><tr><th>Scene</th><th>Variant / setting</th>' +
    '<th>Status</th><th>Median</th><th>Rays</th></tr></thead>';
  const recentBody = document.createElement('tbody');
  for (const result of recent) {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${escapeHtml(`${result.group}/${result.scene}`)}</td>` +
      `<td>${escapeHtml(`${result.variant} / ${result.setting}`)}</td>` +
      `<td>${escapeHtml(result.status)}</td>` +
      `<td>${formatMs(result.medianMs)}</td>` +
      `<td>${Number.isFinite(result.processedRayCount)
        ? result.processedRayCount.toLocaleString()
        : ''}</td>`;
    recentBody.append(row);
  }
  resultsElement.append(recentBody);
}

function aggregateSettings(results) {
  return settings.map(setting => {
    const matching = results.filter(result => result.setting === setting.id);
    return {
      id: setting.id,
      label: setting.label,
      count: matching.length,
      totalMs: matching.reduce((sum, result) => sum + result.medianMs, 0),
    };
  });
}

function downloadReport(format) {
  if (!currentReport) return;
  currentReport.downloadedAt = new Date().toISOString();
  const isCsv = format === 'csv';
  const content = isCsv
    ? serializeCsv(currentReport.results ?? [])
    : JSON.stringify(currentReport, null, 2);
  const blob = new Blob([content], {
    type: isCsv ? 'text/csv;charset=utf-8' : 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `scene-engine-benchmark-${safeTimestamp()}${isCsv ? '.csv' : '.json'}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function serializeCsv(rows) {
  const columns = [
    'setting', 'engine', 'case', 'scene', 'group', 'category', 'variant',
    'mode', 'densityProperty', 'baseDensity', 'effectiveDensity', 'colorMode',
    'rayPowerCutoff', 'maxRayDepth', 'viewportWidth', 'viewportHeight',
    'status', 'warmupMs', 'samplesMs', 'medianMs', 'processedRayCount',
    'initialRayCount', 'primitiveCurveCount',
    'additionalOutgoingRaySlotCount', 'currentSelectionScore',
    'totalTruncation', 'elapsedWallMs', 'error', 'completedAt'
  ];
  return [
    columns.join(','),
    ...rows.map(row => columns.map(column => csvCell(row[column])).join(',')),
  ].join('\n') + '\n';
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function persistReport() {
  if (!currentReport) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentReport));
  } catch (error) {
    currentReport.persistenceError = error?.message ?? String(error);
  }
  window.__sceneEngineBenchmarkReport = currentReport;
}

function restoreReport() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const report = JSON.parse(value);
    return report?.benchmark === REPORT_VERSION ? report : null;
  } catch (_) {
    return null;
  }
}

function enableDownloads() {
  downloadJsonButton.disabled = false;
  downloadCsvButton.disabled = false;
}

function estimateRemainingSeconds(report, total) {
  const completed = report.results.length;
  if (!completed || !Number.isFinite(report.elapsedSeconds)) return null;
  return report.elapsedSeconds / completed * Math.max(0, total - completed);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function integerParameter(name, fallback, minimum, maximum) {
  const value = Number(params.get(name) ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function numberParameter(name, fallback, minimum, maximum) {
  const value = Number(params.get(name) ?? fallback);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be from ${minimum} to ${maximum}.`);
  }
  return value;
}

function stringSetParameter(name) {
  const text = params.get(name);
  return text ? new Set(text.split(',').filter(Boolean)) : null;
}

function finitePositiveOr(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function finiteNonnegativeOr(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function positiveIntegerOr(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function formatMs(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)} ms` : '';
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'unknown';
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(0)}s`;
}

function formatFactor(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)}×` : 'unavailable';
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function escapeHtml(value) {
  const element = document.createElement('span');
  element.textContent = String(value ?? '');
  return element.innerHTML;
}

function showFatalError(error) {
  console.error(error);
  statusElement.className = 'error';
  statusElement.textContent = error?.stack ?? String(error);
}
