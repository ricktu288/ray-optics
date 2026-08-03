/*
 * Diagnostic benchmark for comparing ray-optics' staged CPU and WebGPU
 * execution at small ray counts and large ray depths.
 *
 * Run with:
 *   node --experimental-default-type=module scripts/benchmarkWebGpuPingPong.mjs
 */

import { performance } from 'node:perf_hooks';
import { createCanvas } from 'canvas';
import { create, globals } from 'webgpu';

import { parseFormula } from '../src/core/formula/formula-parser.js';
import { FLOAT32_EPSILON } from '../src/core/primitive/numeric.js';
import { preprocessPrimitives } from '../src/core/primitive/preprocess.js';
import CpuSimulationEngine from '../src/core/simulationEngines/cpu/CpuSimulationEngine.js';
import WebGpuSimulationEngine from '../src/core/simulationEngines/webgpu/WebGpuSimulationEngine.js';

Object.assign(globalThis, globals);

const options = parseOptions(process.argv.slice(2));
const gpu = create([]);
const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
if (!adapter) throw new Error('No WebGPU adapter is available.');

const adapterInfo = adapter.info ?? {};
console.log('adapter=' + JSON.stringify({
  vendor: adapterInfo.vendor,
  architecture: adapterInfo.architecture,
  device: adapterInfo.device,
  description: adapterInfo.description,
  isFallbackAdapter: adapterInfo.isFallbackAdapter,
}));
if (adapterInfo.isFallbackAdapter || adapterInfo.architecture === 'software') {
  throw new Error('Refusing to benchmark a WebGPU CPU/software fallback.');
}

const device = await adapter.requestDevice({
  requiredLimits: {
    maxStorageBuffersPerShaderStage: 14,
    maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
    maxBufferSize: adapter.limits.maxBufferSize,
  },
});

console.log([
  'engine', 'rays', 'depth', 'maxPingPongsPerSubmission',
  'advanceCalls', 'medianMs', 'medianCreateRunMs', 'medianAdvanceMs',
  'samplesMs'
].join(','));

for (const rayCount of options.rayCounts) {
  const processedScene = createMirrorCavityScene(rayCount);
  const cpuCanvas = createCanvas(options.outputSize, options.outputSize);
  const cpuVirtualCanvas = createCanvas(options.outputSize, options.outputSize);
  const cpu = new CpuSimulationEngine({
    ctxMain: cpuCanvas.getContext('2d'),
    ctxVirtual: cpuVirtualCanvas.getContext('2d'),
  });
  cpu.logExecutionDebugInfo = false;
  const preparedCpu = await cpu.prepare(processedScene);
  await measureCpu(cpu, preparedCpu, rayCount);
  cpu.dispose();

  for (const maxPingPongsPerSubmission of options.pingPongCounts) {
    const output = createTextureOutput(device, options.outputSize);
    const engine = new WebGpuSimulationEngine({
      device,
      output,
      config: {
        workgroupSize: 64,
        maxItemsPerAdvance: options.capacity,
        maxBatchRayEvents: options.capacity,
        maxReadyLineRecords: options.capacity,
        maxReadyPointRecords: 1,
        maxPingPongsPerSubmission,
      },
    });
    const prepared = await engine.prepare(processedScene);

    // Compile and allocate outside the measured interval.
    await runToCompletion(engine, prepared, Math.min(4, options.depth));
    await device.queue.onSubmittedWorkDone();

    const samples = [];
    const createRunSamples = [];
    const advanceSamples = [];
    let advanceCalls = 0;
    for (let repeat = 0; repeat < options.repeats; repeat++) {
      await device.queue.onSubmittedWorkDone();
      const start = performance.now();
      const result = await runToCompletion(engine, prepared, options.depth);
      await device.queue.onSubmittedWorkDone();
      samples.push(performance.now() - start);
      createRunSamples.push(result.createRunMs);
      advanceSamples.push(result.advanceMs);
      advanceCalls = result.advanceCalls;
    }
    printResult({
      engine: 'webgpu',
      rayCount,
      depth: options.depth,
      maxPingPongsPerSubmission,
      advanceCalls,
      samples,
      createRunSamples,
      advanceSamples,
    });
    engine.dispose();
  }
}

device.destroy?.();

async function measureCpu(engine, preparedScene, rayCount) {
  await runToCompletion(engine, preparedScene, Math.min(4, options.depth));
  const samples = [];
  const createRunSamples = [];
  const advanceSamples = [];
  let advanceCalls = 0;
  for (let repeat = 0; repeat < options.repeats; repeat++) {
    const start = performance.now();
    const result = await runToCompletion(engine, preparedScene, options.depth);
    samples.push(performance.now() - start);
    createRunSamples.push(result.createRunMs);
    advanceSamples.push(result.advanceMs);
    advanceCalls = result.advanceCalls;
  }
  printResult({
    engine: 'cpu',
    rayCount,
    depth: options.depth,
    maxPingPongsPerSubmission: 0,
    advanceCalls,
    samples,
    createRunSamples,
    advanceSamples,
  });
}

async function runToCompletion(engine, preparedScene, depth) {
  const createStart = performance.now();
  const run = await engine.createRun({
    preparedScene,
    maxRayDepth: depth,
    rayPowerCutoff: 0,
    viewport: { origin: { x: 16, y: 16 }, scale: 2, lengthScale: 1 },
    colorMode: 'default',
    rendering: { mode: 'rays', simulateColors: false, showRayArrows: false },
  });
  const createRunMs = performance.now() - createStart;
  const advanceStart = performance.now();
  let advanceCalls = 0;
  let update;
  do {
    update = await run.advance({ timeBudgetMs: Infinity });
    advanceCalls++;
  } while (update.status !== 'complete');
  return {
    advanceCalls,
    update,
    createRunMs,
    advanceMs: performance.now() - advanceStart,
  };
}

function printResult({
  engine,
  rayCount,
  depth,
  maxPingPongsPerSubmission,
  advanceCalls,
  samples,
  createRunSamples,
  advanceSamples,
}) {
  const medianMs = median(samples);
  console.log([
    engine,
    rayCount,
    depth,
    maxPingPongsPerSubmission,
    advanceCalls,
    medianMs.toFixed(3),
    median(createRunSamples).toFixed(3),
    median(advanceSamples).toFixed(3),
    samples.map(value => value.toFixed(3)).join('|'),
  ].join(','));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function createTextureOutput(gpuDevice, size) {
  let texture = null;
  return {
    format: 'rgba8unorm',
    getSize: () => ({ width: size, height: size }),
    initialize() {
      texture = gpuDevice.createTexture({
        size: [size, size],
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

function createMirrorCavityScene(rayCount) {
  const sourceType = {
    name: 'Benchmark source',
    paramNames: [],
    dag: parseFormula(`
      x = 5; y = 0;
      d_x = 1; d_y = 0;
      P_s = 1; P_p = 0;
      lambda = 540;
    `, ['i', 'N']),
  };
  const mirrorType = {
    name: 'Benchmark mirror',
    paramNames: [],
    outRayCount: 1,
    mergesWithBoundary: false,
    dag: parseFormula(`
      d_1x = d_0x; d_1y = -d_0y;
      P_1s = P_0s; P_1p = P_0p;
    `, ['d_0x', 'd_0y', 'P_0s', 'P_0p']),
  };
  const mirror = x => ({
    kind: 'surface',
    surfaceType: mirrorType,
    params: {},
    twoSided: true,
    curve: {
      kind: 'lineSegment',
      params: { start: { x, y: -10 }, end: { x, y: 10 } },
    },
  });
  return preprocessPrimitives([
    { kind: 'source', sourceType, params: {}, rayCount },
    mirror(0),
    mirror(10),
  ], { numericEpsilon: FLOAT32_EPSILON }).processedScene;
}

function parseOptions(argv) {
  const result = {
    depth: 128,
    repeats: 3,
    outputSize: 32,
    capacity: 262144,
    rayCounts: [1, 64, 1024],
    pingPongCounts: [1, 8, 128],
  };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    const value = argv[++index];
    if (argument === '--depth') result.depth = positiveInteger(value, argument);
    else if (argument === '--repeats') result.repeats = positiveInteger(value, argument);
    else if (argument === '--output-size') result.outputSize = positiveInteger(value, argument);
    else if (argument === '--capacity') result.capacity = positiveInteger(value, argument);
    else if (argument === '--rays') result.rayCounts = integerList(value, argument);
    else if (argument === '--ping-pongs') {
      result.pingPongCounts = integerList(value, argument);
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  return result;
}

function integerList(value, label) {
  return String(value).split(',').map(item => positiveInteger(item, label));
}

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} requires a positive integer.`);
  }
  return parsed;
}
