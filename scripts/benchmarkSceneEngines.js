import seedrandom from 'seedrandom';
import {
  CpuSimulationEngine,
  FLOAT32_EPSILON,
  PrimitiveBasedSimulator,
  Scene,
  Simulator,
  WebGpuSimulationEngine,
} from '../src/core/index.js';
import {
  DEFAULT_WEBGPU_RAY_COOPERATION_CONFIG,
  resolvePrimitiveSimulatorConfig,
  resolveSimulationEngineConfig,
  WEBGPU_MIN_STORAGE_BUFFERS_PER_SHADER_STAGE,
} from '../src/core/simulationEngines/config.js';

const REPORT_VERSION = 'real-scene-engine-benchmark-v2';
const STORAGE_KEY = 'rayOpticsRealSceneEngineBenchmarkReport';
const DEFAULT_MAX_RAY_DEPTH = 256;
const DEFAULT_RAY_COUNT_LIMIT = 10_000_000;
const params = new URLSearchParams(location.search);
const repeats = integerParameter('repeats', 1, 1, 9);
const timeoutMs = numberParameter('timeoutSeconds', 30, 1, 300) * 1000;
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
const settings = [
  {
    id: 'legacy',
    label: 'Legacy',
    kind: 'legacy',
    purpose: 'Existing object-oriented simulator baseline',
  },
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
  {
    id: 'webgpu-bvh-biased',
    label: 'WebGPU BVH-biased formula',
    kind: 'webgpu',
    purpose: 'Tests a 0.5× correction to the direct-intersection threshold',
    config: {
      ...webGpuBaseConfig,
      rayCooperationDirectMaxTestsPerLane: Math.max(
        0,
        DEFAULT_WEBGPU_RAY_COOPERATION_CONFIG
          .rayCooperationDirectMaxTestsPerLane / 2
      ),
    },
  },
].filter(setting =>
  !selectedSettingIds || selectedSettingIds.has(setting.id)
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
        for (let caseIndex = 0; caseIndex < cases.length; caseIndex++) {
          if (stopRequested) break;
          const benchmarkCase = cases[caseIndex];
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
    if (setting.kind === 'legacy') {
      simulator?.canvasRendererMain?.destroy?.();
      simulator?.canvasRendererBelowLight?.destroy?.();
      simulator?.canvasRendererAboveLight?.destroy?.();
    }
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
  return {
    sceneJson,
    mode,
    densityProperty,
    baseDensity,
    effectiveDensity: variant === '5x-linear' ? baseDensity * 5 : baseDensity,
    colorMode: sceneJson.colorMode ?? 'default',
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
  if (setting.kind === 'legacy') {
    requireWebGl(contexts.gl);
    return {
      kind: setting.kind,
      ...contexts,
      createSimulator: scene => new Simulator(
        scene,
        contexts.main,
        contexts.below,
        contexts.above,
        contexts.grid,
        contexts.virtual,
        true,
        DEFAULT_RAY_COUNT_LIMIT,
        contexts.gl,
        null,
        createTempCanvas
      ),
      dispose: async () => {},
    };
  }

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
  for (const context of [environment.below, environment.above]) {
    context?.getImageData?.(0, 0, 1, 1);
  }
  if (environment.kind !== 'webgpu') {
    if (environment.main) environment.main.getImageData(0, 0, 1, 1);
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
    maxRayDepth: prepared?.maxRayDepth ?? null,
    viewportWidth: prepared?.width ?? null,
    viewportHeight: prepared?.height ?? null,
    status,
    warmupMs,
    samplesMs,
    medianMs,
    processedRayCount: simulator?.processedRayCount ?? null,
    totalTruncation: simulator?.totalTruncation ?? null,
    elapsedWallMs,
    error: error ? String(error).slice(0, 4000) : null,
    completedAt: new Date().toISOString(),
  };
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
    'maxRayDepth', 'viewportWidth', 'viewportHeight', 'status', 'warmupMs',
    'medianMs', 'processedRayCount', 'totalTruncation', 'elapsedWallMs',
    'error', 'completedAt'
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
