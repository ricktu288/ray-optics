/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { parseFormula } from '../../src/core/formula/formula-parser.js';
import { createCanvas } from 'canvas';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric.js';
import { preprocessPrimitives } from '../../src/core/primitive/preprocess.js';
import WebGpuSimulationEngine from '../../src/core/simulationEngines/WebGpuSimulationEngine.js';
import {
  applyWebGpuAnalyticCoverage,
  calculateWebGpuArrowCoverage,
  calculateWebGpuLineCoverage,
  encodeWebGpuColorContribution,
  toneMapWebGpuColorContribution,
  WebGpuReadyRayRenderer
} from '../../src/core/simulationEngines/webGpuRayRenderer.js';
import {
  WEBGPU_HIT_STRIDE,
  WEBGPU_PIXEL_STRIDE,
  WEBGPU_RAY_STRIDE,
} from '../../src/core/simulationEngines/webGpuExecutionPlan.js';
import {
  WebGpuBatchController,
  createWebGpuRunControlData,
  packWebGpuScene
} from '../../src/core/simulationEngines/webGpuStorage.js';
import {
  WebGpuComputeBackend,
  decodeWebGpuRunState,
  createWebGpuSourceShader
} from '../../src/core/simulationEngines/webGpuComputeBackend.js';
import {
  createWebGpuInteractionIndexShader
} from '../../src/core/simulationEngines/webGpuInteractionIndex.js';
import {
  createWebGpuInitialMembershipShader
} from '../../src/core/simulationEngines/webGpuMembership.js';
import {
  createWebGpuGrinOutgoingShader,
  createWebGpuRegionBoundaryOutgoingShader,
  createWebGpuSurfaceOutgoingShader,
  createWebGpuDetectorOutgoingShader
} from '../../src/core/simulationEngines/webGpuOutgoing.js';
import {
  createWebGpuRawTraceShader
} from '../../src/core/simulationEngines/webGpuTrace.js';

const sourceType = {
  name: 'WebGPU test source',
  paramNames: ['wavelength', 'power', 'position'],
  dag: parseFormula(`
    x = position;
    y = 0;
    d_x = 1;
    d_y = 0;
    P_s = power;
    P_p = 0;
    lambda = wavelength;
  `, ['i', 'N', 'wavelength', 'power', 'position'])
};

const bulkType = {
  name: 'WebGPU test bulk',
  paramNames: [],
  dag: parseFormula('n = 1.5; alpha = 0;', ['x', 'y', 'lambda'])
};

const mirrorSurfaceType = {
  name: 'WebGPU test mirror',
  paramNames: [],
  outRayCount: 1,
  mergesWithBoundary: false,
  dag: parseFormula(`
    d_1x = d_0x; d_1y = -d_0y;
    P_1s = P_0s; P_1p = P_0p;
  `, ['d_0x', 'd_0y', 'P_0s', 'P_0p'])
};

function process(primitives) {
  return preprocessPrimitives(primitives, {
    numericEpsilon: FLOAT32_EPSILON
  }).processedScene;
}

function source(wavelength = 540, position = 0, power = 1) {
  return {
    kind: 'source',
    sourceType,
    params: { wavelength, power, position },
    rayCount: 1
  };
}

function rectangularRegion() {
  const point = (x, y) => ({ x, y });
  return {
    kind: 'region',
    bulkType,
    params: {},
    stepSize: 0,
    partialReflect: false,
    curves: [
      { kind: 'lineSegment', params: { start: point(-1, -1), end: point(1, -1) } },
      { kind: 'lineSegment', params: { start: point(1, -1), end: point(1, 1) } },
      { kind: 'lineSegment', params: { start: point(1, 1), end: point(-1, 1) } },
      { kind: 'lineSegment', params: { start: point(-1, 1), end: point(-1, -1) } },
    ],
  };
}

async function finish(run) {
  let update;
  do {
    update = await run.advance();
  } while (update.status !== 'complete');
  return update;
}

describe('WebGpuSimulationEngine staged execution', () => {
  it('runs in Node without a native GPU and reports the compatibility mode', async () => {
    const engine = new WebGpuSimulationEngine();
    const preparedScene = await engine.prepare(process([source()]));
    const run = await engine.createRun({
      preparedScene,
      viewport: { origin: { x: 0, y: 0 }, scale: 1, lengthScale: 1 },
      colorMode: 'default',
      rendering: { mode: 'rays' }
    });

    const update = await finish(run);

    expect(update.executionMode).toBe('node-reference');
    expect(update.result.processedRayCount).toBe(1);
    expect(engine.applyLegacyPowerSubsampling).toBe(false);
  });

  it('applies maximum ray depth in the Node-compatible WebGPU run',
    async () => {
      const engine = new WebGpuSimulationEngine();
      const preparedScene = await engine.prepare(process([
        source(),
        rectangularRegion()
      ]));
      const run = await engine.createRun({
        preparedScene,
        maxRayDepth: 0,
        rendering: { mode: 'rays' }
      });

      const update = await finish(run);

      expect(update.status).toBe('complete');
      expect(run.referenceRun.passIndex).toBe(0);
      expect(update.result.processedRayCount).toBe(1);
      expect(update.result.totalTruncation).toBeCloseTo(1);
    });

  it('renders one ray into a Node Canvas 2D output', async () => {
    const canvas = createCanvas(16, 12);
    const ctx = canvas.getContext('2d');
    const engine = new WebGpuSimulationEngine({ ctxMain: ctx });
    const preparedScene = await engine.prepare(process([source()]));
    const run = await engine.createRun({
      preparedScene,
      viewport: {
        origin: { x: 0, y: 5.5 },
        scale: 1,
        lengthScale: 1
      },
      colorMode: 'default',
      rendering: {
        mode: 'rays',
        getThemeRayColor: (_type, alpha) => [1, 1, 0.5, alpha],
        getThemeRayDash: () => []
      }
    });

    await finish(run);
    const pixel = Array.from(ctx.getImageData(8, 5, 1, 1).data);

    expect(pixel[0]).toBeGreaterThanOrEqual(250);
    expect(pixel[1]).toBeGreaterThanOrEqual(250);
    expect(pixel[2]).toBeGreaterThanOrEqual(125);
    expect(pixel[2]).toBeLessThanOrEqual(130);
    expect(pixel[3]).toBeGreaterThanOrEqual(250);
  });

  it('retains the old frame until a replacement frame is ready',
    async () => {
      const canvas = createCanvas(16, 12);
      const ctx = canvas.getContext('2d');
      const engine = new WebGpuSimulationEngine({ ctxMain: ctx });
      const preparedScene = await engine.prepare(process([source()]));
      const options = {
        preparedScene,
        viewport: { origin: { x: 0, y: 5.5 }, scale: 1, lengthScale: 1 },
        colorMode: 'default',
        rendering: {
          mode: 'rays',
          getThemeRayColor: (_type, alpha) => [1, 1, 0.5, alpha],
          getThemeRayDash: () => []
        }
      };
      await finish(await engine.createRun(options));
      expect(ctx.getImageData(8, 5, 1, 1).data[3]).toBeGreaterThan(0);

      const replacement = await engine.createRun(options);

      expect(ctx.getImageData(8, 5, 1, 1).data[3]).toBeGreaterThan(0);
      await finish(replacement);
      expect(ctx.getImageData(8, 5, 1, 1).data[3]).toBeGreaterThan(0);
    });

  it('keeps ready records owned by the run that produced them', async () => {
    const engine = new WebGpuSimulationEngine();
    const preparedScene = await engine.prepare(process([source()]));
    const first = await engine.createRun({
      preparedScene,
      rendering: { mode: 'rays' }
    });
    const firstCollector = first.canvasRenderer;
    const second = await engine.createRun({
      preparedScene,
      rendering: { mode: 'rays' }
    });
    const marker = { kind: 'line' };
    second.canvasRenderer.records.push(marker);

    expect(firstCollector).not.toBe(second.canvasRenderer);
    expect(firstCollector.takeNewRecords()).toEqual([]);
    expect(second.canvasRenderer.takeNewRecords()).toEqual([marker]);
  });

  it('presents a pending GPU clear at the first pause without geometry',
    async () => {
      const engine = new WebGpuSimulationEngine();
      const draw = jest.fn(async () => {});
      engine.isInitialized = true;
      engine.rasterizer = { clear: jest.fn(() => false), draw };
      const preparedScene = await engine.prepare(process([source()]));
      const run = await engine.createRun({
        preparedScene,
        rendering: { mode: 'rays' }
      });

      expect(draw).not.toHaveBeenCalled();
      await run.advance({ itemBudget: 1 });

      expect(draw).toHaveBeenCalledTimes(1);
      expect(draw.mock.calls[0][0]).toEqual([]);
      expect(run.clearPending).toBe(false);
    });

  it('discards source wavelengths outside the scene-derived UV-IR range', async () => {
    const engine = new WebGpuSimulationEngine();
    const preparedScene = await engine.prepare(process([source(900)]), {
      violetWavelength: 420,
      redWavelength: 620
    });
    const run = await engine.createRun({
      preparedScene,
      rendering: { mode: 'rays' }
    });

    const update = await finish(run);

    expect(update.result.processedRayCount).toBe(0);
  });

  it('applies rayPowerCutoff in the default color mode without the 0.01 rule', async () => {
    const canvas = createCanvas(16, 12);
    const ctx = canvas.getContext('2d');
    const engine = new WebGpuSimulationEngine({ ctxMain: ctx });
    const preparedScene = await engine.prepare(
      process([source(540, 0, 4e-4)])
    );
    const run = await engine.createRun({
      preparedScene,
      viewport: {
        origin: { x: 0, y: 5.5 },
        scale: 1,
        lengthScale: 1
      },
      colorMode: 'default',
      rayPowerCutoff: 1e-3,
      rendering: {
        mode: 'rays',
        getThemeRayColor: (_type, alpha) => [1, 1, 0.5, alpha],
        getThemeRayDash: () => []
      }
    });

    const update = await finish(run);
    const pixel = Array.from(ctx.getImageData(8, 5, 1, 1).data);

    expect(pixel).toEqual([0, 0, 0, 0]);
    expect(update.result.totalTruncation).toBeCloseTo(4e-4);
    expect(engine.applyLegacyPowerSubsampling).toBe(false);
  });

  it('packs authored runtime parameters as saturated f32 values', async () => {
    const engine = new WebGpuSimulationEngine();
    const prepared = await engine.prepare(process([source(540, 1.00000006)]));

    expect(prepared.description).toBe(prepared.originalDescription);
    expect(prepared.runtimeDescription.sources[0].params.position)
      .toBe(Math.fround(1.00000006));
  });

  it('rejects source coordinates outside the safe GPU spatial domain',
    async () => {
      const engine = new WebGpuSimulationEngine();

      await expect(engine.prepare(process([
        source(540, 2 ** 63)
      ]))).rejects.toThrow(/source type 0 x output.*spatial limit/);
    });

  it('records the agreed ray, hit, membership and pixel storage layout', async () => {
    const engine = new WebGpuSimulationEngine();
    const prepared = await engine.prepare(process([source()]));
    const plan = prepared.executionPlan;

    expect(plan.buffers.rayPing.stride).toBe(WEBGPU_RAY_STRIDE);
    expect(plan.buffers.hits.stride).toBe(WEBGPU_HIT_STRIDE);
    expect(plan.buffers.pixelAccumulation.stride).toBe(WEBGPU_PIXEL_STRIDE);
    expect(plan.buffers.pixelAccumulation.fields).toEqual([
      'atomic<u32> r', 'atomic<u32> g', 'atomic<u32> b',
      'atomic<u32> overflow'
    ]);
    expect(plan.passes.map(pass => pass.name)).toEqual([
      'clear',
      'sourceEmission',
      'trace',
      'prepareRenderGeometry',
      'interactionPrefixScan',
      'interactionIndexFill',
      'rasterAtomic',
      'toneMap'
    ]);
  });

  it('packs source descriptors and instance parameters for GPU bindings', () => {
    const packed = packWebGpuScene(process([
      source(500, 1.25, 0.5),
      source(600, 2.5, 0.25)
    ]));
    const descriptors = new DataView(packed.sourceDescriptors);

    expect(packed.counts).toMatchObject({ sources: 2, sourceRays: 2 });
    expect(descriptors.getUint32(0, true)).toBe(0);
    expect(descriptors.getUint32(4, true)).toBe(0);
    expect(descriptors.getUint32(8, true)).toBe(0);
    expect(descriptors.getUint32(12, true)).toBe(1);
    expect(descriptors.getUint32(20, true)).toBe(3);
    expect(descriptors.getUint32(24, true)).toBe(1);
    expect(Array.from(packed.instanceParameters)).toEqual([
      500, 0.5, 1.25,
      600, 0.25, 2.5
    ]);
    expect(packed.sourceTypeRanges).toEqual([{
      typeId: 0,
      descriptorIndices: [0, 1],
      dispatchEntryOffset: 0,
      dispatchEntryCount: 2,
      rayCount: 2
    }]);
    expect(Array.from(packed.sourceDispatchEntries)).toEqual([
      0, 0,
      1, 1
    ]);
    expect(packed.counts.interactionTypes).toBe(3);
    expect(Array.from(packed.interactionTypeDescriptors)).toEqual([
      0, 0xffffffff, 1, 0,
      1, 0xffffffff, 1, 0,
      1, 0xffffffff, 2, 1,
    ]);
  });

  it('builds a typed native source-emission shader from the cached DAG',
    async () => {
      const engine = new WebGpuSimulationEngine();
      const prepared = await engine.prepare(process([source()]));
      const shader = createWebGpuSourceShader({
        description: prepared.runtimeDescription,
        dagPrograms: prepared.dagPrograms,
        typeId: 0,
        workgroupSize: 64,
      });

      expect(shader).toContain('fn source_0(');
      expect(shader).toContain('@compute @workgroup_size(64)');
      expect(shader).toContain('sourceMain(');
      expect(shader).toContain(
        'instanceParameters[source.parameterOffset + 0u]'
      );
      expect(shader).toContain(
        'output[6].value < sourceUniforms.wavelengthMin'
      );
      expect(shader).not.toContain('surface_0');
    });

  it('allocates and encodes the native source-emission compute stage',
    async () => {
      const engine = new WebGpuSimulationEngine();
      const prepared = await engine.prepare(process([source()]));
      const dispatchWorkgroups = jest.fn();
      const computePass = {
        setPipeline: jest.fn(),
        setBindGroup: jest.fn(),
        dispatchWorkgroups,
        end: jest.fn(),
      };
      const device = createComputeTestDevice();
      const backend = new WebGpuComputeBackend(device, prepared, {
        workgroupSize: 64,
        maxBatchRayEvents: 1024,
      });

      await backend.initialize();
      const beginComputePass = jest.fn(() => computePass);
      backend.encodeInitialTrace({ beginComputePass, clearBuffer: jest.fn() });

      expect(device.createComputePipelineAsync).toHaveBeenCalledTimes(5);
      expect(device.createBindGroup).toHaveBeenCalledTimes(6);
      expect(beginComputePass).toHaveBeenCalledTimes(5);
      expect(dispatchWorkgroups).toHaveBeenCalledTimes(5);
      expect(dispatchWorkgroups).toHaveBeenNthCalledWith(1, 1);
      expect(dispatchWorkgroups).toHaveBeenNthCalledWith(2, 1);
      expect(backend.sourceStage.rayBuffer.descriptor.size)
        .toBe(WEBGPU_RAY_STRIDE);
      const createdBuffers = device.createBuffer.mock.calls.map(
        ([descriptor]) => descriptor
      );
      expect(createdBuffers.find(
        descriptor => descriptor.label === 'WebGPU scene curveDescriptors'
      ).size).toBe(32);
      expect(createdBuffers.find(
        descriptor => descriptor.label === 'WebGPU scene bvhNodes'
      ).size).toBe(32);
      backend.destroy();
    });

  it('reuses compiled pipelines for a parameter-only scene update',
    async () => {
      const engine = new WebGpuSimulationEngine();
      const first = await engine.prepare(process([source(540, 0)]));
      const second = await engine.prepare(process([source(540, 2)]));
      const device = createComputeTestDevice();
      const backend = new WebGpuComputeBackend(device, first, {
        workgroupSize: 64,
        maxBatchRayEvents: 1024,
        maxReadyLineRecords: 1024,
        maxReadyPointRecords: 1024,
      });
      await backend.initialize();
      const pipelineCount = device.createComputePipelineAsync.mock.calls.length;

      expect(backend.canUpdatePreparedScene(second)).toBe(true);
      backend.updatePreparedScene(second);

      expect(device.createComputePipelineAsync).toHaveBeenCalledTimes(
        pipelineCount
      );
      expect(backend.preparedScene).toBe(second);
      backend.destroy();
    });

  it('builds the capacity-gated interaction scan and index-fill shader',
    () => {
      const shader = createWebGpuInteractionIndexShader(64);

      expect(shader).toContain('@compute @workgroup_size(1)');
      expect(shader).toContain('fn prefixMain(');
      expect(shader).toContain('@compute @workgroup_size(64)');
      expect(shader).toContain('fn fillMain(');
      expect(shader).toContain('fn advanceMain(');
      expect(shader).toContain(
        'atomicStore(&runControl[0], atomicLoad(&runControl[4]))'
      );
      expect(shader).toContain('atomicStore(&runControl[8], 1u)');
      expect(shader).toContain('interactionRayIndices[outputIndex] = rayIndex');
    });

  it('builds and schedules initial region membership before raw tracing',
    async () => {
      const engine = new WebGpuSimulationEngine();
      const prepared = await engine.prepare(process([
        source(), rectangularRegion()
      ]));
      const generated = createWebGpuInitialMembershipShader(
        prepared.runtimeDescription, 64
      );

      expect(generated.supported).toBe(true);
      expect(generated.code).toContain('fn membershipAttempt(');
      expect(generated.code).toContain('fn countLine(');
      expect(generated.code).toContain('GOLDEN_ANGLE_COS');
      expect(generated.code).toContain('rays[rayIndex].powers=vec2f(0.0)');

      const dispatchWorkgroups = jest.fn();
      const computePass = {
        setPipeline: jest.fn(), setBindGroup: jest.fn(),
        dispatchWorkgroups, end: jest.fn(),
      };
      const device = createComputeTestDevice();
      const backend = new WebGpuComputeBackend(device, prepared, {
        workgroupSize: 64,
        maxBatchRayEvents: 1024,
      });
      await backend.initialize();
      const beginComputePass = jest.fn(() => computePass);
      backend.encodeInitialTrace({ beginComputePass, clearBuffer: jest.fn() });

      expect(backend.membershipStage).not.toBeNull();
      expect(backend.membershipStage.regionWordCount).toBe(1);
      expect(beginComputePass).toHaveBeenCalledTimes(7);
      expect(dispatchWorkgroups).toHaveBeenCalledTimes(8);
      expect(device.createComputePipelineAsync).toHaveBeenCalledTimes(8);
      expect(device.createBindGroup).toHaveBeenCalledTimes(11);
      expect(backend.outgoingStage.rayNextBuffer.descriptor.size)
        .toBe(WEBGPU_RAY_STRIDE);
      backend.destroy();
    });

  it('embeds every bulk GRIN DAG in the typed GRIN outgoing pass', async () => {
    const engine = new WebGpuSimulationEngine();
    const prepared = await engine.prepare(process([
      source(), rectangularRegion()
    ]));
    const shader = createWebGpuGrinOutgoingShader({
      description: prepared.runtimeDescription,
      dagPrograms: prepared.dagPrograms,
      workgroupSize: 64,
    });

    expect(shader).toContain('fn bulk_grin_0(');
    expect(shader).toContain('fn evaluateEffectiveGrin(');
    expect(shader).toContain('medium.nX*evaluated.n');
    expect(shader).toContain('let absorption=exp(-medium.alpha*hit.s)');
    expect(shader).toContain('@compute @workgroup_size(64)');

    const boundaryShader = createWebGpuRegionBoundaryOutgoingShader({
      description: prepared.runtimeDescription,
      dagPrograms: prepared.dagPrograms,
      workgroupSize: 64,
    });
    expect(boundaryShader).toContain('fn bulk_n_0(');
    expect(boundaryShader).toContain('fn evaluateEffectiveIndex(');
    expect(boundaryShader).toContain('fn processRegionBoundary(');
    expect(boundaryShader).toContain('regionBoundaryPartialReflectionMain(');
    expect(boundaryShader).toContain('value^=crossings');
    expect(boundaryShader).toContain('var isMember=');
  });

  it('specializes a surface outgoing pass without unused bulk DAGs',
    async () => {
      const engine = new WebGpuSimulationEngine();
      const prepared = await engine.prepare(process([
        source(),
        {
          kind: 'surface', surfaceType: mirrorSurfaceType, params: {},
          twoSided: true,
          curve: {
            kind: 'lineSegment',
            params: { start: { x: 2, y: -1 }, end: { x: 2, y: 1 } }
          }
        }
      ]));
      const generated = createWebGpuSurfaceOutgoingShader({
        description: prepared.runtimeDescription,
        dagPrograms: prepared.dagPrograms,
        typeId: 0,
        workgroupSize: 64,
      });

      expect(generated.needsBulk).toBe(false);
      expect(generated.code).toContain('fn surface_0(');
      expect(generated.code).toContain('fn surfaceOutgoingMain(');
      expect(generated.code).toContain('fn surfaceCrossesBoundary(');
      expect(generated.code).not.toContain('fn bulk_n_');
      expect(generated.code).not.toContain('@binding(14)');
    });

  it('adds bulk index DAGs only for a surface consuming n_0 or n_1',
    async () => {
      const indexSurfaceType = {
        ...mirrorSurfaceType,
        name: 'Index-consuming surface',
        dag: parseFormula(`
          d_1x = d_0x; d_1y = d_0y * n_0 / n_1;
          P_1s = P_0s; P_1p = P_0p;
        `, ['d_0x', 'd_0y', 'P_0s', 'P_0p', 'n_0', 'n_1'])
      };
      const engine = new WebGpuSimulationEngine();
      const prepared = await engine.prepare(process([
        source(), rectangularRegion(),
        {
          kind: 'surface', surfaceType: indexSurfaceType, params: {},
          twoSided: true,
          curve: {
            kind: 'lineSegment',
            params: { start: { x: 0, y: -2 }, end: { x: 0, y: 2 } }
          }
        }
      ]));
      const generated = createWebGpuSurfaceOutgoingShader({
        description: prepared.runtimeDescription,
        dagPrograms: prepared.dagPrograms,
        typeId: 0,
        workgroupSize: 64,
      });

      expect(generated.needsBulk).toBe(true);
      expect(generated.code).toContain('fn bulk_n_0(');
      expect(generated.code).toContain('fn evaluateSurfaceIndex(');
      expect(generated.code).toContain('@binding(14)');
    });

  it('uses signed fixed-point detector accumulation with overflow flags',
    async () => {
      const detectorType = {
        name: 'Signed detector', paramNames: [], writeCount: 1,
        dag: parseFormula(
          'k_1 = 0; v_1 = sigma * (P_0s + P_0p);',
          ['sigma', 'P_0s', 'P_0p']
        )
      };
      const engine = new WebGpuSimulationEngine();
      const prepared = await engine.prepare(process([
        source(), {
          kind: 'detector', detectorType, params: {}, resultSize: 1,
          resultBinding: {}, twoSided: true,
          curve: {
            kind: 'lineSegment',
            params: { start: { x: 2, y: -1 }, end: { x: 2, y: 1 } }
          }
        }
      ]));
      const shader = createWebGpuDetectorOutgoingShader({
        description: prepared.runtimeDescription,
        dagPrograms: prepared.dagPrograms,
        typeId: 0,
        workgroupSize: 64,
      });

      expect(shader).toContain('value:atomic<i32>');
      expect(shader).toContain('overflow:atomic<u32>');
      expect(shader).toContain('atomicAdd(&detectorResults');
      expect(shader).toContain('additionOverflow=');
    });

  it('specializes raw BVH trace code to the curve kinds in the scene', () => {
    const trace = createWebGpuRawTraceShader({
      numericEpsilon: FLOAT32_EPSILON,
      curves: [
        { geometry: { kind: 'lineSegment' } },
        { geometry: { kind: 'circle' } },
      ],
      bvh: { nodes: [{ depth: 0 }] },
    }, 64);

    expect(trace.supported).toBe(true);
    expect(trace.code).toContain('fn intersectLine(');
    expect(trace.code).toContain('fn intersectCircle(');
    expect(trace.code).toContain('fn curveNormal(');
    expect(trace.code).toContain('fn mergeCandidate(');
    expect(trace.code).toContain('fn classifyCandidate(');
    expect(trace.code).toContain('atomicAdd(&interactionTypeCounts');
    expect(trace.code).toContain('rayIndex>=atomicLoad(&runControl[0])');
    expect(trace.code).toContain('frontSideOnly=curve.ownerKind!=1u');
    expect(trace.code).not.toContain('fn intersectArc(');
    expect(trace.code).toContain('@compute @workgroup_size(64)');

    expect(createWebGpuRawTraceShader({
      numericEpsilon: FLOAT32_EPSILON,
      curves: [{ geometry: { kind: 'unsupportedCurve' } }],
      bvh: { nodes: [{ depth: 0 }] },
    }, 64)).toMatchObject({
      supported: false,
      unsupported: ['unsupportedCurve'],
      code: null,
    });

    const cubic = createWebGpuRawTraceShader({
      numericEpsilon: FLOAT32_EPSILON,
      curves: [{ geometry: { kind: 'cubicBezier' } }],
      bvh: { nodes: [{ depth: 0 }] },
    }, 64);
    expect(cubic.supported).toBe(true);
    expect(cubic.code).toContain('fn intersectCubic(');
    expect(cubic.code).toContain('fn refineCubicRoot(');

    const empty = createWebGpuRawTraceShader({
      numericEpsilon: FLOAT32_EPSILON,
      curves: [],
      bvh: { nodes: [] },
    }, 64);
    expect(empty.supported).toBe(true);
    expect(empty.code).toContain('fn rawTraceMain(');
  });

  it('batches multiple small ping-pongs until an item capacity is reached', () => {
    const controller = new WebGpuBatchController({
      maxBatchRayEvents: 100,
      maxReadyLineRecords: 300,
      maxReadyPointRecords: 100,
      maxPingPongsPerSubmission: 8,
    });

    expect(controller.canAppendPingPong({ rayCount: 20 })).toBe(true);
    controller.appendPingPong({
      rayCount: 20, lineRecords: 40, pointRecords: 2
    });
    expect(controller.canAppendPingPong({ rayCount: 30 })).toBe(true);
    controller.appendPingPong({
      rayCount: 30, lineRecords: 60, pointRecords: 3
    });
    expect(controller.canAppendPingPong({ rayCount: 60 })).toBe(false);
    expect(controller.snapshot()).toEqual({
      rayEvents: 50,
      readyLineRecords: 100,
      readyPointRecords: 5,
      pingPongs: 2,
      stopReason: 'ray-event limit'
    });
  });

  it('initializes the 64-byte GPU run-control block', () => {
    const control = createWebGpuRunControlData({
      currentRayCount: 12,
      rayCapacity: 64,
      readyLineCapacity: 128,
      readyPointCapacity: 32,
    });

    expect(control.byteLength).toBe(64);
    expect(Array.from(control.slice(0, 10))).toEqual([
      12, 64, 128, 32, 0, 0, 0, 0, 0, 0
    ]);
  });

  it('decodes signed detector values and their overflow flags', () => {
    const data = new ArrayBuffer(64 + 3 * 8);
    const view = new DataView(data);
    view.setUint32(0, 7, true);
    view.setUint32(4, 32, true);
    view.setUint32(44, 3, true);
    view.setInt32(64, 1572864, true);
    view.setInt32(72, -524288, true);
    view.setUint32(76, 1, true);
    view.setInt32(80, 2097152, true);
    const state = decodeWebGpuRunState(data, {
      detectors: [
        { resultId: 0, resultSize: 2 },
        { resultId: 1, resultSize: 1 },
      ],
    });

    expect(state.currentRayCount).toBe(7);
    expect(state.rayCapacity).toBe(32);
    expect(state.pingPongIndex).toBe(3);
    expect(Array.from(state.detectors[0].values)).toEqual([1.5, -0.5]);
    expect(Array.from(state.detectors[0].overflow)).toEqual([0, 1]);
    expect(Array.from(state.detectors[1].values)).toEqual([2]);
    expect(state.detectorOverflow).toBe(true);
  });

  it.each(['linear', 'linearRGB', 'reinhard'])(
    'matches FloatColorRenderer preprocessing for one %s contribution',
    mode => {
      const color = [1, 1, 0.5, 0.25];
      const encoded = encodeWebGpuColorContribution(color, mode, false);
      const mapped = toneMapWebGpuColorContribution(
        encoded.slice(0, 3), mode, false
      );
      const r = color[0] * color[3];
      const g = color[1] * color[3];
      const b = color[2] * color[3];
      const maximum = Math.max(r, g, b);
      const linear = [r, g, b].map(value =>
        value ** 2.2 * maximum /
          Math.max(r ** 2.2, g ** 2.2, b ** 2.2)
      );
      let expected;
      if (mode === 'reinhard') {
        const luminance =
          linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
        expected = linear.map(value =>
          (value / (1 + luminance)) ** (1 / 2.2)
        );
      } else {
        const divisor = mode === 'linear' && maximum > 1 ? maximum : 1;
        expected = linear.map(value =>
          (value / divisor) ** (1 / 2.2)
        );
      }
      expect(mapped.slice(0, 3)).toEqual(expected);
    }
  );

  it('preserves a single default theme color through log accumulation', () => {
    const color = [1, 1, 0.5, 1];
    const encoded = encodeWebGpuColorContribution(
      color, 'default', false
    );
    const mapped = toneMapWebGpuColorContribution(
      encoded.slice(0, 3), 'default', false
    );

    expect(mapped[0]).toBeCloseTo(1, 5);
    expect(mapped[1]).toBeCloseTo(1, 5);
    expect(mapped[2]).toBeCloseTo(0.5, 5);
  });

  it('applies legacy analytic coverage in alpha space', () => {
    const encoded = encodeWebGpuColorContribution(
      [1, 1, 0.5, 0.5], 'default', false
    );
    const covered = applyWebGpuAnalyticCoverage(
      encoded, 0.5, 'default', false
    );
    const mapped = toneMapWebGpuColorContribution(
      covered.slice(0, 3), 'default', false
    );

    expect(mapped[0]).toBeCloseTo(0.25, 10);
    expect(mapped[1]).toBeCloseTo(0.25, 10);
    expect(mapped[2]).toBeCloseTo(0.125, 10);
    expect(mapped[3]).toBeCloseTo(0.25, 10);
  });

  it('uses hard longitudinal edges for colorized intensity', () => {
    expect(calculateWebGpuLineCoverage(0.49, 1, 'colorizedIntensity'))
      .toBe(1);
    expect(calculateWebGpuLineCoverage(0.51, 1, 'colorizedIntensity'))
      .toBe(0);
    expect(calculateWebGpuLineCoverage(0.51, 1, 'linear'))
      .toBeCloseTo(0.49);
  });

  it('records the legacy split-shaft trapezoid for ray arrows', () => {
    const renderer = new WebGpuReadyRayRenderer({
      origin: { x: 0, y: 0 },
      scale: 2,
      lengthScale: 1,
    });

    renderer.drawSegment({
      p1: { x: 0, y: 0 },
      p2: { x: 100, y: 0 },
    }, [1, 1, 1, 1], true, [3, 2], 1);
    const records = renderer.takeNewRecords();

    expect(records.map(record => record.kind))
      .toEqual(['line', 'arrow', 'line']);
    expect(records[0].p1).toEqual({ x: 64.5, y: 0 });
    expect(records[1]).toMatchObject({
      p0: { x: 64.5, y: 0 },
      p1: { x: 69.5, y: 0 },
      width: 10,
      endWidth: 2,
      dashOn: 0,
      dashOff: 0,
    });
    expect(records[2].p0).toEqual({ x: 69.5, y: 0 });
    expect(records[0]).toMatchObject({ dashOn: 6, dashOff: 4 });
    expect(records[2]).toMatchObject({ dashOn: 6, dashOff: 4 });
  });

  it('anti-aliases only the two sloped arrow sides', () => {
    expect(calculateWebGpuArrowCoverage(2, 5, 10, 10, 2, 'linear'))
      .toBe(1);
    expect(calculateWebGpuArrowCoverage(3.2, 5, 10, 10, 2, 'linear'))
      .toBeGreaterThan(0);
    expect(calculateWebGpuArrowCoverage(3.2, 5, 10, 10, 2,
      'colorizedIntensity')).toBe(0);
    expect(calculateWebGpuArrowCoverage(0, -0.01, 10, 10, 2, 'linear'))
      .toBe(0);
  });

  it('uses the colorized-intensity map and its transparent alpha behavior',
    () => {
    const encoded = encodeWebGpuColorContribution(
      [1, 1, 0.5, 1], 'colorizedIntensity', false
    );
    const mapped = toneMapWebGpuColorContribution(
      encoded.slice(0, 3), 'colorizedIntensity', false
    );

    expect(mapped).toEqual([0.8, 0.8, 0, 0]);
  });
});

function createComputeTestDevice() {
  return {
    limits: { maxStorageBufferBindingSize: 1 << 20 },
    queue: { writeBuffer: jest.fn(), submit: jest.fn() },
    createBuffer: jest.fn(descriptor => ({
      descriptor,
      destroy: jest.fn(),
    })),
    pushErrorScope: jest.fn(),
    popErrorScope: jest.fn(async () => null),
    createShaderModule: jest.fn(() => ({
      getCompilationInfo: async () => ({ messages: [] })
    })),
    createComputePipelineAsync: jest.fn(async () => ({
      getBindGroupLayout: jest.fn(() => ({}))
    })),
    createBindGroupLayout: jest.fn(descriptor => ({ descriptor })),
    createPipelineLayout: jest.fn(descriptor => ({ descriptor })),
    createBindGroup: jest.fn(descriptor => ({ descriptor })),
  };
}
