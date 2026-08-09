/*
 * Benchmark every gallery scene with the legacy, primitive CPU, and WebGPU
 * engines at several multiples of the scene's authored ray density.
 *
 * The parent process keeps one child per engine. A child can be killed when a
 * scene hangs without losing the complete benchmark. Every engine receives the
 * same finite max-ray-depth: the scene's authored cap when present, otherwise
 * the benchmark cap (256 by default). Segment counts are reported but are not
 * required to match exactly.
 *
 * The benchmark forces colorMode="linear" so the primitive engines apply the
 * scene's configured ray-power cutoff consistently. CPU and legacy rendering
 * outputs are omitted because Node has no headless WebGL dependency in this
 * project; WebGPU uses the engine's required 1x1 output and otherwise runs
 * unchanged.
 *
 * Typical use:
 *   node scripts/benchmarkGalleryEngines.mjs --output gallery-benchmark.csv
 *
 * Quick smoke test:
 *   node scripts/benchmarkGalleryEngines.mjs --skip-build --scene optical-cavity \
 *     --density-factors 0.1,1 --repeats 1
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import readline from 'node:readline';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const ENGINE_NAMES = ['legacy', 'primitiveCpu', 'webgpu'];
const RESULT_PREFIX = 'gallery-engine-benchmark';

async function runCoordinator() {
  const options = parseCoordinatorOptions(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(helpText());
    return;
  }

  const gallery = readGalleryCases();
  if (options.listScenes) {
    for (const item of gallery) console.log(`${item.category}/${item.id}`);
    return;
  }
  const cases = selectGalleryCases(gallery, options);
  if (cases.length === 0) throw new Error('No gallery scenes matched.');

  if (!options.skipBuild) buildNodeBundle();
  assertNodeBundleExists();

  const clients = new Map();
  const getClient = engineName => {
    let client = clients.get(engineName);
    if (!client?.isAlive()) {
      client?.close();
      client = new EngineWorkerClient(engineName);
      clients.set(engineName, client);
    }
    return client;
  };

  const rows = [];
  const calibrationReport = [];
  const totalCases = cases.length * options.densityFactors.length;
  let caseIndex = 0;

  try {
    for (const galleryCase of cases) {
      const sceneJson = JSON.parse(fs.readFileSync(galleryCase.path, 'utf8'));
      const baseDensity = getAuthoredDensity(sceneJson);
      const depthCandidates = limitDepthCandidates(
        options.depthCandidates,
        sceneJson.maxRayDepth
      );

      for (const densityFactor of options.densityFactors) {
        caseIndex++;
        const label = `${galleryCase.id}@${formatNumber(densityFactor)}x`;
        const payload = {
          scenePath: galleryCase.path,
          densityFactor,
          depthCandidates,
          randomSeed: options.randomSeed,
          rayCountLimit: options.rayCountLimit,
          webGpuConfig: options.webGpuConfig,
        };
        const calibration = {
          maxRayDepth: depthCandidates.at(-1),
          comparable: null,
          reason: Number.isFinite(sceneJson.maxRayDepth)
            ? 'authored-depth-cap'
            : 'benchmark-depth-cap',
          selectedCounts: null,
          table: [],
        };
        calibrationReport.push({
          scene: galleryCase.id,
          category: galleryCase.category,
          densityFactor,
          baseDensity,
          effectiveDensity: baseDensity * densityFactor,
          ...calibration,
          probes: {},
        });

        process.stderr.write(
          `[${caseIndex}/${totalCases}] benchmarking ${label} ` +
          `depth=${calibration.maxRayDepth} (${calibration.reason})\n`
        );
        const benchmarkByEngine = {};
        for (const engineName of ENGINE_NAMES) {
          benchmarkByEngine[engineName] = await requestWithRecovery({
            getClient,
            engineName,
            action: 'benchmark',
            payload: {
              ...payload,
              maxRayDepth: calibration.maxRayDepth,
              repeats: options.repeats,
              warmups: options.warmups,
            },
            timeoutMs: options.timeoutMs,
          });
        }
        const measuredCounts = Object.fromEntries(ENGINE_NAMES.map(name => [
          name,
          benchmarkByEngine[name]?.summary?.medianProcessedRayCount ?? null,
        ]));
        const measuredComparable = countsAgree(
          Object.values(measuredCounts),
          options.countTolerance,
          options.countAbsoluteTolerance
        );
        const legacyMedianMs =
          benchmarkByEngine.legacy?.summary?.medianMs ?? null;
        for (const engineName of ENGINE_NAMES) {
          rows.push(createCsvRow({
            galleryCase,
            densityFactor,
            baseDensity,
            calibration,
            engineName,
            benchmark: benchmarkByEngine[engineName],
            measuredCounts,
            measuredComparable,
            legacyMedianMs,
          }));
        }
      }
    }
  } finally {
    await Promise.all(Array.from(clients.values(), client => client.close()));
  }

  const csv = serializeCsv(rows);
  if (options.outputPath) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, csv);
    const calibrationPath = replaceExtension(
      options.outputPath,
      '.calibration.json'
    );
    fs.writeFileSync(
      calibrationPath,
      JSON.stringify(calibrationReport, null, 2) + '\n'
    );
    process.stderr.write(`Wrote ${options.outputPath}\n`);
    process.stderr.write(`Wrote ${calibrationPath}\n`);
  } else {
    process.stdout.write(csv);
  }
}

class EngineWorkerClient {
  constructor(engineName) {
    this.engineName = engineName;
    this.dead = false;
    this.nextRequestId = 1;
    this.pending = null;
    this.stderrTail = '';
    this.stdoutBuffer = '';
    this.child = spawn(
      process.execPath,
      [SCRIPT_PATH, '--worker', '--engine', engineName],
      {
        cwd: REPO_ROOT,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    this.child.stdout?.on('data', chunk => this.handleStdout(chunk));
    this.child.stderr?.on('data', chunk => {
      this.stderrTail = (this.stderrTail + chunk.toString()).slice(-16000);
    });
    this.child.on('error', error => this.handleExit(error));
    this.child.on('exit', (code, signal) => this.handleExit(new Error(
      `${engineName} worker exited with code ${code}, signal ${signal}`
    )));
  }

  isAlive() {
    return Boolean(!this.dead && this.child && this.child.exitCode === null);
  }

  request(action, payload, timeoutMs) {
    if (this.pending) {
      throw new Error(`${this.engineName} worker already has a request.`);
    }
    if (!this.isAlive()) {
      return Promise.reject(new Error(`${this.engineName} worker is not alive.`));
    }
    const requestId = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error(
          `${this.engineName} ${action} timed out after ${timeoutMs} ms.`
        );
        error.code = 'BENCHMARK_TIMEOUT';
        this.pending = null;
        this.dead = true;
        this.child.kill('SIGKILL');
        reject(error);
      }, timeoutMs);
      this.pending = { requestId, resolve, reject, timer };
      this.child.stdin.write(JSON.stringify({ requestId, action, payload }) + '\n');
    });
  }

  handleStdout(chunk) {
    this.stdoutBuffer += chunk.toString();
    while (true) {
      const newline = this.stdoutBuffer.indexOf('\n');
      if (newline < 0) return;
      const line = this.stdoutBuffer.slice(0, newline);
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (!line.startsWith(`${RESULT_PREFIX} `)) continue;
      try {
        this.handleMessage(JSON.parse(line.slice(RESULT_PREFIX.length + 1)));
      } catch (error) {
        this.handleExit(error);
      }
    }
  }

  handleMessage(message) {
    if (!this.pending || message?.requestId !== this.pending.requestId) return;
    const { resolve, reject, timer } = this.pending;
    clearTimeout(timer);
    this.pending = null;
    if (message.ok) {
      resolve(message.result);
    } else {
      const error = new Error(message.error?.message ?? 'Worker request failed.');
      error.stack = message.error?.stack ?? error.stack;
      reject(error);
    }
  }

  handleExit(error) {
    this.dead = true;
    if (!this.pending) return;
    const { reject, timer } = this.pending;
    clearTimeout(timer);
    this.pending = null;
    if (this.stderrTail) error.stderr = this.stderrTail;
    reject(error);
  }

  async close() {
    if (!this.child) return;
    const child = this.child;
    if (this.isAlive()) {
      try {
        await this.request('shutdown', {}, 5000);
      } catch {
        // The unconditional kill below also covers a failed shutdown request.
      }
    }
    child.stdin?.end();
    if (child.exitCode === null) child.kill('SIGTERM');
    this.child = null;
  }
}

async function requestWithRecovery({
  getClient,
  engineName,
  action,
  payload,
  timeoutMs,
}) {
  const startedAt = performance.now();
  try {
    return await getClient(engineName).request(action, payload, timeoutMs);
  } catch (error) {
    return {
      status: error.code === 'BENCHMARK_TIMEOUT' ? 'timeout' : 'worker-error',
      elapsedWallMs: performance.now() - startedAt,
      error: error.message,
      stderr: error.stderr ?? '',
    };
  }
}

async function runWorker() {
  const engineName = readRequiredWorkerEngine(process.argv.slice(2));
  const runtime = await createWorkerRuntime(engineName);
  const input = readline.createInterface({ input: process.stdin });
  input.on('line', async line => {
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      writeWorkerResponse({
        requestId: null,
        ok: false,
        error: { message: error.message, stack: error.stack },
      });
      return;
    }
    const { requestId, action, payload } = message ?? {};
    try {
      if (action === 'shutdown') {
        await runtime.dispose();
        writeWorkerResponse({ requestId, ok: true, result: { status: 'closed' } });
        input.close();
        return;
      }
      let result;
      if (action === 'calibrate') {
        result = await runtime.calibrate(payload);
      } else if (action === 'benchmark') {
        result = await runtime.benchmark(payload);
      } else {
        throw new Error(`Unknown worker action ${JSON.stringify(action)}.`);
      }
      writeWorkerResponse({ requestId, ok: true, result });
    } catch (error) {
      writeWorkerResponse({
        requestId,
        ok: false,
        error: { message: error.message, stack: error.stack },
      });
    }
  });
}

function writeWorkerResponse(response) {
  process.stdout.write(`${RESULT_PREFIX} ${JSON.stringify(response)}\n`);
}

async function createWorkerRuntime(engineName) {
  const require = createRequire(import.meta.url);
  const rayOptics = require(path.join(REPO_ROOT, 'dist-node/rayOptics.js'));
  const seedrandom = require('seedrandom');
  const { createCanvas } = require('canvas');
  let sharedEngine = null;
  let webGpuDevice = null;
  let adapterInfo = null;

  async function ensureEngine(webGpuConfig) {
    if (engineName === 'legacy') return null;
    if (sharedEngine) return sharedEngine;
    if (engineName === 'primitiveCpu') {
      sharedEngine = new rayOptics.CpuSimulationEngine();
      // Linear mode normally selects the WebGL renderer. The benchmark is
      // compute-focused and deliberately supplies no output surface.
      sharedEngine.beginRenderer = () => null;
      return sharedEngine;
    }

    const webGpu = await import('webgpu');
    Object.assign(globalThis, webGpu.globals);
    const gpu = webGpu.create([]);
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('No WebGPU adapter is available.');
    adapterInfo = normalizeAdapterInfo(adapter.info);
    if (adapterInfo.isFallbackAdapter || adapterInfo.architecture === 'software') {
      throw new Error(
        `Refusing software WebGPU adapter: ${adapterInfo.description || 'unknown'}`
      );
    }
    webGpuDevice = await adapter.requestDevice({
      requiredLimits: {
        maxStorageBuffersPerShaderStage: 8,
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxBufferSize: adapter.limits.maxBufferSize,
      },
    });
    sharedEngine = new rayOptics.WebGpuSimulationEngine({
      device: webGpuDevice,
      output: createMinimalWebGpuOutput(),
      numericEpsilon: rayOptics.FLOAT32_EPSILON,
      config: webGpuConfig,
    });
    return sharedEngine;
  }

  async function createSceneAndSimulator(payload, maxRayDepth) {
    const sceneJson = JSON.parse(fs.readFileSync(payload.scenePath, 'utf8'));
    sceneJson.colorMode = 'linear';
    sceneJson.randomSeed = payload.randomSeed;
    sceneJson.maxRayDepth = maxRayDepth;
    const densityProperty = usesRayModeDensity(sceneJson.mode)
      ? 'rayModeDensity'
      : 'imageModeDensity';
    const authoredDensity = finitePositiveOrDefault(
      sceneJson[densityProperty],
      densityProperty === 'rayModeDensity' ? 0.1 : 1
    );
    sceneJson[densityProperty] = authoredDensity * payload.densityFactor;

    const scene = new rayOptics.Scene();
    await loadSceneJson(scene, sceneJson);
    scene.rng = new seedrandom(payload.randomSeed);
    const engine = await ensureEngine(payload.webGpuConfig);
    if (engineName === 'legacy') {
      return {
        scene,
        simulator: new rayOptics.Simulator(
          scene,
          null,
          null,
          null,
          null,
          null,
          false,
          payload.rayCountLimit,
          null,
          null,
          (width, height) => createCanvas(width, height)
        ),
      };
    }
    return {
      scene,
      simulator: new rayOptics.PrimitiveBasedSimulator({
        scene,
        engine,
        enableTimer: false,
        rayCountLimit: payload.rayCountLimit,
        tempCanvasFactory: (width, height) => createCanvas(width, height),
        logDebugInfo: false,
      }),
    };
  }

  async function runOnce(payload, maxRayDepth) {
    const { scene, simulator } = await createSceneAndSimulator(
      payload,
      maxRayDepth
    );
    const startedAt = performance.now();
    const completion = await runSimulator(simulator);
    const elapsedMs = performance.now() - startedAt;
    return {
      status: simulator.error
        ? 'engine-error'
        : completion.stopped ? 'ray-limit' : 'ok',
      elapsedMs,
      processedRayCount: simulator.processedRayCount,
      totalTruncation: simulator.totalTruncation,
      error: simulator.error ?? null,
      warning: simulator.warning ?? null,
      effectiveDensity: scene.rayDensity,
      maxRayDepth,
    };
  }

  return {
    async calibrate(payload) {
      const probes = [];
      let previousProcessedRayCount = null;
      for (const maxRayDepth of payload.depthCandidates) {
        const result = await runOnce(payload, maxRayDepth);
        probes.push(result);
        if (result.status !== 'ok') break;
        // Processed counts are monotonic in a finite depth cap. Equality at
        // consecutive caps means this engine exhausted its rays naturally, so
        // deeper probes cannot add work and need not be run.
        if (result.processedRayCount === previousProcessedRayCount) break;
        previousProcessedRayCount = result.processedRayCount;
      }
      return { status: 'ok', engine: engineName, adapterInfo, probes };
    },

    async benchmark(payload) {
      for (let index = 0; index < payload.warmups; index++) {
        const warmup = await runOnce(payload, payload.maxRayDepth);
        if (warmup.status !== 'ok') {
          return {
            status: warmup.status,
            engine: engineName,
            adapterInfo,
            error: warmup.error ?? 'Warmup did not complete.',
            warmup,
          };
        }
      }
      const samples = [];
      for (let index = 0; index < payload.repeats; index++) {
        const sample = await runOnce(payload, payload.maxRayDepth);
        samples.push(sample);
        if (sample.status !== 'ok') break;
      }
      return {
        status: samples.every(sample => sample.status === 'ok')
          ? 'ok'
          : samples.at(-1)?.status ?? 'engine-error',
        engine: engineName,
        adapterInfo,
        samples,
        summary: summarizeSamples(samples),
      };
    },

    async dispose() {
      sharedEngine?.dispose?.();
      await webGpuDevice?.queue?.onSubmittedWorkDone?.();
      webGpuDevice?.destroy?.();
      sharedEngine = null;
      webGpuDevice = null;
    },
  };
}

function runSimulator(simulator) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = stopped => {
      if (settled) return;
      settled = true;
      resolve({ stopped });
    };
    simulator.eventListeners = {};
    simulator.on('simulationComplete', () => finish(false));
    simulator.on('simulationStop', () => finish(true));
    try {
      simulator.updateSimulation(false, true, true);
    } catch (error) {
      reject(error);
    }
  });
}

function chooseSharedDepth({
  depthCandidates,
  calibrationByEngine,
  relativeTolerance,
  absoluteTolerance,
}) {
  let best = null;
  let previousAcceptedCounts = null;
  let reason = 'no-matching-depth';
  const table = [];
  for (let index = 0; index < depthCandidates.length; index++) {
    const depth = depthCandidates[index];
    const counts = {};
    const statuses = {};
    for (const engineName of ENGINE_NAMES) {
      const response = calibrationByEngine[engineName];
      const probe = response?.probes?.find(item => item.maxRayDepth === depth);
      counts[engineName] = Number.isFinite(probe?.processedRayCount)
        ? probe.processedRayCount
        : null;
      statuses[engineName] = probe?.status ?? response?.status ?? 'missing';
    }
    const agreed = ENGINE_NAMES.every(name => statuses[name] === 'ok') &&
      countsAgree(
        Object.values(counts),
        relativeTolerance,
        absoluteTolerance
      );
    table.push({ depth, counts, statuses, agreed });
    if (!agreed) {
      if (best) reason = 'count-divergence';
      break;
    }
    best = { depth, counts };
    if (
      previousAcceptedCounts &&
      ENGINE_NAMES.every(name =>
        counts[name] === previousAcceptedCounts[name]
      )
    ) {
      reason = 'all-engines-stable';
      break;
    }
    previousAcceptedCounts = counts;
    reason = index === depthCandidates.length - 1
      ? 'depth-cap'
      : 'matched';
  }
  if (!best) {
    return {
      maxRayDepth: depthCandidates[0],
      comparable: false,
      reason,
      selectedCounts: null,
      table,
    };
  }
  return {
    maxRayDepth: best.depth,
    comparable: true,
    reason,
    selectedCounts: best.counts,
    table,
  };
}

function countsAgree(values, relativeTolerance, absoluteTolerance) {
  if (values.length !== ENGINE_NAMES.length ||
      values.some(value => !Number.isFinite(value))) return false;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return sorted.at(-1) - sorted[0] <=
    absoluteTolerance + relativeTolerance * Math.max(1, median);
}

function summarizeSamples(samples) {
  if (samples.length === 0) return null;
  const times = samples.map(sample => sample.elapsedMs).sort((a, b) => a - b);
  const counts = samples.map(sample => sample.processedRayCount)
    .sort((a, b) => a - b);
  const truncations = samples.map(sample => sample.totalTruncation)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  return {
    medianMs: median(times),
    minMs: times[0],
    maxMs: times.at(-1),
    medianProcessedRayCount: median(counts),
    minProcessedRayCount: counts[0],
    maxProcessedRayCount: counts.at(-1),
    medianTotalTruncation: truncations.length ? median(truncations) : null,
  };
}

function createCsvRow({
  galleryCase,
  densityFactor,
  baseDensity,
  calibration,
  engineName,
  benchmark,
  measuredCounts,
  measuredComparable,
  legacyMedianMs,
}) {
  const summary = benchmark?.summary ?? {};
  const adapter = benchmark?.adapterInfo ?? {};
  return {
    scene: galleryCase.id,
    category: galleryCase.category,
    densityFactor,
    baseDensity,
    effectiveDensity: baseDensity * densityFactor,
    colorMode: 'linear',
    maxRayDepth: calibration.maxRayDepth,
    calibrationReason: calibration.reason,
    calibrationComparable: calibration.comparable,
    measuredComparable,
    engine: engineName,
    status: benchmark?.status ?? 'missing',
    medianMs: summary.medianMs,
    minMs: summary.minMs,
    maxMs: summary.maxMs,
    medianProcessedRayCount: summary.medianProcessedRayCount,
    minProcessedRayCount: summary.minProcessedRayCount,
    maxProcessedRayCount: summary.maxProcessedRayCount,
    medianTotalTruncation: summary.medianTotalTruncation,
    segmentsPerSecond: Number.isFinite(summary.medianMs) &&
      summary.medianMs > 0 && Number.isFinite(summary.medianProcessedRayCount)
      ? summary.medianProcessedRayCount * 1000 / summary.medianMs
      : null,
    speedupVsLegacy: Number.isFinite(legacyMedianMs) &&
      Number.isFinite(summary.medianMs) && summary.medianMs > 0
      ? legacyMedianMs / summary.medianMs
      : null,
    legacyCount: measuredCounts.legacy,
    primitiveCpuCount: measuredCounts.primitiveCpu,
    webgpuCount: measuredCounts.webgpu,
    webgpuAdapter: adapter.description,
    webgpuFallback: adapter.isFallbackAdapter,
    error: formatBenchmarkError(benchmark),
  };
}

function serializeCsv(rows) {
  const columns = [
    'scene', 'category', 'densityFactor', 'baseDensity', 'effectiveDensity',
    'colorMode', 'maxRayDepth', 'calibrationReason',
    'calibrationComparable', 'measuredComparable', 'engine', 'status',
    'medianMs', 'minMs', 'maxMs', 'medianProcessedRayCount',
    'minProcessedRayCount', 'maxProcessedRayCount',
    'medianTotalTruncation', 'segmentsPerSecond', 'speedupVsLegacy',
    'legacyCount', 'primitiveCpuCount',
    'webgpuCount', 'webgpuAdapter', 'webgpuFallback', 'error',
  ];
  return [
    columns.join(','),
    ...rows.map(row => columns.map(column => csvCell(row[column])).join(',')),
  ].join('\n') + '\n';
}

function csvCell(value) {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function readGalleryCases() {
  const galleryList = JSON.parse(fs.readFileSync(
    path.join(REPO_ROOT, 'data/galleryList.json'),
    'utf8'
  ));
  return galleryList.flatMap(category => category.content.map(item => ({
    id: item.id,
    category: category.id,
    path: path.join(REPO_ROOT, 'data/galleryScenes', `${item.id}.json`),
  })));
}

function selectGalleryCases(gallery, options) {
  const sceneSet = options.scenes.length ? new Set(options.scenes) : null;
  const categorySet = options.categories.length
    ? new Set(options.categories)
    : null;
  return gallery.filter(item =>
    (!sceneSet || sceneSet.has(item.id)) &&
    (!categorySet || categorySet.has(item.category))
  );
}

function parseCoordinatorOptions(argv) {
  const result = {
    densityFactors: [0.01, 0.1, 1, 10],
    depthCandidates: [1, 2, 4, 8, 16, 32, 64, 128, 256],
    repeats: 3,
    warmups: 1,
    timeoutMs: 120000,
    rayCountLimit: 10000000,
    countTolerance: 0.03,
    countAbsoluteTolerance: 2,
    randomSeed: 'gallery-engine-benchmark-v1',
    webGpuConfig: {
      workgroupSize: 64,
      maxItemsPerAdvance: 1048576,
      maxBatchRayEvents: 1048576,
      maxReadyLineRecords: 1048576,
      maxReadyPointRecords: 1048576,
      maxPingPongsPerSubmission: 8,
    },
    scenes: [],
    categories: [],
    outputPath: null,
    skipBuild: false,
    listScenes: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') result.help = true;
    else if (argument === '--skip-build') result.skipBuild = true;
    else if (argument === '--list-scenes') result.listScenes = true;
    else if (argument === '--scene') {
      result.scenes.push(...commaList(requireValue(argv, ++index, argument)));
    } else if (argument === '--category') {
      result.categories.push(...commaList(requireValue(argv, ++index, argument)));
    } else if (argument === '--density-factors') {
      result.densityFactors = positiveNumberList(
        requireValue(argv, ++index, argument),
        argument
      );
    } else if (argument === '--depths') {
      result.depthCandidates = nonnegativeIntegerList(
        requireValue(argv, ++index, argument),
        argument
      );
    } else if (argument === '--repeats') {
      result.repeats = positiveInteger(requireValue(argv, ++index, argument), argument);
    } else if (argument === '--warmups') {
      result.warmups = nonnegativeInteger(requireValue(argv, ++index, argument), argument);
    } else if (argument === '--timeout-ms') {
      result.timeoutMs = positiveInteger(requireValue(argv, ++index, argument), argument);
    } else if (argument === '--ray-count-limit') {
      result.rayCountLimit = positiveInteger(requireValue(argv, ++index, argument), argument);
    } else if (argument === '--count-tolerance') {
      result.countTolerance = nonnegativeNumber(requireValue(argv, ++index, argument), argument);
    } else if (argument === '--count-absolute-tolerance') {
      result.countAbsoluteTolerance = nonnegativeInteger(
        requireValue(argv, ++index, argument),
        argument
      );
    } else if (argument === '--seed') {
      result.randomSeed = requireValue(argv, ++index, argument);
    } else if (argument === '--webgpu-config') {
      result.webGpuConfig = JSON.parse(requireValue(argv, ++index, argument));
    } else if (argument === '--output') {
      result.outputPath = path.resolve(
        process.cwd(),
        requireValue(argv, ++index, argument)
      );
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  result.depthCandidates = Array.from(new Set(result.depthCandidates))
    .sort((a, b) => a - b);
  return result;
}

function helpText() {
  return `Usage: node scripts/benchmarkGalleryEngines.mjs [options]\n\n` +
    `Options:\n` +
    `  --scene <id[,id...]>       Only benchmark selected gallery scenes\n` +
    `  --category <id[,id...]>    Only benchmark selected categories\n` +
    `  --density-factors <list>   Density multipliers (default 0.01,0.1,1,10)\n` +
    `  --depths <list>            Shared caps; deepest is used (default 256)\n` +
    `  --repeats <n>              Timed repeats per engine (default 3)\n` +
    `  --warmups <n>              Untimed repeats per engine (default 1)\n` +
    `  --timeout-ms <n>           Timeout per worker request (default 120000)\n` +
    `  --ray-count-limit <n>      Legacy/CPU safety limit (default 10000000)\n` +
    `  --count-tolerance <x>      Relative reported-count tolerance (default .03)\n` +
    `  --count-absolute-tolerance <n> Absolute count tolerance (default 2)\n` +
    `  --seed <text>              Deterministic scene RNG seed\n` +
    `  --webgpu-config <json>     Override the app-style WebGPU tuning values\n` +
    `  --output <csv>             Write CSV and companion calibration JSON\n` +
    `  --skip-build               Reuse the existing dist-node bundle\n` +
    `  --list-scenes              List gallery scene IDs and exit\n` +
    `  -h, --help                 Show this help\n`;
}

function buildNodeBundle() {
  const result = spawnSync('npm', ['run', 'build-node'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm run build-node exited with status ${result.status}.`);
  }
}

function assertNodeBundleExists() {
  const bundlePath = path.join(REPO_ROOT, 'dist-node/rayOptics.js');
  if (!fs.existsSync(bundlePath)) {
    throw new Error('dist-node/rayOptics.js is missing; rerun without --skip-build.');
  }
}

function formatBenchmarkError(benchmark) {
  const message = benchmark?.error ?? benchmark?.samples?.at(-1)?.error ?? '';
  const stderr = benchmark?.stderr?.trim() ?? '';
  return [message, stderr].filter(Boolean).join(' | ').slice(0, 2000);
}

function limitDepthCandidates(candidates, authoredMaxRayDepth) {
  if (!Number.isFinite(authoredMaxRayDepth)) return candidates;
  const authored = Math.max(0, Math.floor(authoredMaxRayDepth));
  const limited = candidates.filter(depth => depth <= authored);
  if (!limited.includes(authored)) limited.push(authored);
  return Array.from(new Set(limited)).sort((a, b) => a - b);
}

function getAuthoredDensity(sceneJson) {
  return usesRayModeDensity(sceneJson.mode)
    ? finitePositiveOrDefault(sceneJson.rayModeDensity, 0.1)
    : finitePositiveOrDefault(sceneJson.imageModeDensity, 1);
}

function usesRayModeDensity(mode) {
  return mode === undefined || mode === 'rays' || mode === 'extended';
}

function loadSceneJson(scene, sceneJson) {
  return new Promise(resolve => {
    scene.loadJSON(JSON.stringify(sceneJson), (_needFullUpdate, completed) => {
      if (completed) resolve();
    });
  });
}

function createMinimalWebGpuOutput() {
  let texture = null;
  return {
    format: 'rgba8unorm',
    getSize: () => ({ width: 1, height: 1 }),
    initialize(device) {
      texture = device.createTexture({
        size: [1, 1],
        format: this.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      });
    },
    acquireView: () => texture.createView(),
    dispose() {
      texture?.destroy();
      texture = null;
    },
  };
}

function normalizeAdapterInfo(info = {}) {
  return {
    vendor: info.vendor,
    architecture: info.architecture,
    device: info.device,
    description: info.description,
    isFallbackAdapter: info.isFallbackAdapter,
  };
}

function readRequiredWorkerEngine(argv) {
  const index = argv.indexOf('--engine');
  const engine = index >= 0 ? argv[index + 1] : null;
  if (!ENGINE_NAMES.includes(engine)) {
    throw new Error(`Worker requires --engine ${ENGINE_NAMES.join('|')}.`);
  }
  return engine;
}

function replaceExtension(filePath, extension) {
  return path.join(
    path.dirname(filePath),
    path.basename(filePath, path.extname(filePath)) + extension
  );
}

function median(sortedValues) {
  return sortedValues[Math.floor(sortedValues.length / 2)];
}

function finitePositiveOrDefault(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function formatNumber(value) {
  return Number(value).toLocaleString('en-US', { maximumSignificantDigits: 6 });
}

function requireValue(argv, index, option) {
  if (index >= argv.length) throw new Error(`${option} requires a value.`);
  return argv[index];
}

function commaList(value) {
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function positiveNumberList(value, label) {
  return commaList(value).map(item => positiveNumber(item, label));
}

function nonnegativeIntegerList(value, label) {
  return commaList(value).map(item => nonnegativeInteger(item, label));
}

function positiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${label} requires positive numbers.`);
  }
  return number;
}

function nonnegativeNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} requires a nonnegative number.`);
  }
  return number;
}

function positiveInteger(value, label) {
  const number = nonnegativeInteger(value, label);
  if (number === 0) throw new Error(`${label} requires a positive integer.`);
  return number;
}

function nonnegativeInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`${label} requires nonnegative integers.`);
  }
  return number;
}

if (process.argv.includes('--worker')) {
  await runWorker();
} else {
  await runCoordinator();
}
