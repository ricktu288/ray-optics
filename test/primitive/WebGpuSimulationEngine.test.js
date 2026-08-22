/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { parseFormula } from '../../src/core/formula/formula-parser.js';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric.js';
import { preprocessPrimitives } from '../../src/core/primitive/preprocess.js';
import WebGpuSimulationEngine, { createNormalConflictWarning } from
  '../../src/core/simulationEngines/webgpu/WebGpuSimulationEngine.js';
import { createWebGpuMegakernelShader } from
  '../../src/core/simulationEngines/webgpu/webGpuMegakernelShader.js';
import { createMegakernelInitialShader } from
  '../../src/core/simulationEngines/webgpu/webGpuMegakernelInitial.js';
import {
  createMegakernelCollectorShader,
  createMegakernelQueueLayout,
} from
  '../../src/core/simulationEngines/webgpu/webGpuMegakernelQueue.js';
import { WebGpuMegakernelBackend } from
  '../../src/core/simulationEngines/webgpu/webGpuMegakernelBackend.js';
import {
  WEBGPU_MEGAKERNEL_RUN_CONTROL_SIZE,
  WebGpuMegakernelStaticSceneStorage,
  decodeWebGpuMegakernelRunState,
} from '../../src/core/simulationEngines/webgpu/webGpuMegakernelStorage.js';
import { createWebGpuTraceSceneData } from
  '../../src/core/simulationEngines/webgpu/webGpuTraceScene.js';
import { createWebGpuInitialMembershipShader } from
  '../../src/core/simulationEngines/webgpu/webGpuMembership.js';
import {
  WebGpuReadyRayRenderer,
  calculateWebGpuArrowCoverage,
  calculateWebGpuDashCoverage,
  calculateWebGpuLineCoverage,
  calculateWebGpuPointCoverage,
  applyWebGpuAnalyticCoverage,
  toneMapWebGpuColorContribution,
} from
  '../../src/core/simulationEngines/webgpu/webGpuRayRenderer.js';
import {
  createRenderUniformData,
  createWebGpuRenderPreparationShader,
} from
  '../../src/core/simulationEngines/webgpu/webGpuRenderPreparation.js';
import { DEFAULT_SIMULATION_ENGINE_CONFIGS } from
  '../../src/core/simulationEngines/config.js';

const sourceType = {
  name: 'Megakernel test source',
  paramNames: ['position'],
  dag: parseFormula(
    'x=position;y=0;d_x=1;d_y=0;P_s=1;P_p=0;lambda=540;',
    ['i', 'N', 'position']
  )
};

const splitterType = {
  name: 'Megakernel test splitter',
  paramNames: [],
  outRayCount: 2,
  mergesWithBoundary: false,
  dag: parseFormula(`
    d_1x=d_0x;d_1y=-d_0y;P_1s=P_0s*0.5;P_1p=P_0p*0.5;
    d_2x=d_0x;d_2y=d_0y;P_2s=P_0s*0.5;P_2p=P_0p*0.5;
  `, ['d_0x', 'd_0y', 'P_0s', 'P_0p'])
};

const bulkType = {
  name: 'Megakernel test bulk',
  paramNames: [],
  dag: parseFormula('n=1.5;alpha=0;', ['x', 'y', 'lambda'])
};

function process(primitives) {
  return preprocessPrimitives(primitives, {
    numericEpsilon: FLOAT32_EPSILON
  }).processedScene;
}

function scene() {
  return process([
    {
      kind: 'source', sourceType, params: { position: 0 }, rayCount: 8
    },
    {
      kind: 'surface', surfaceType: splitterType, params: {}, twoSided: true,
      curve: {
        kind: 'lineSegment',
        params: { start: { x: 2, y: -1 }, end: { x: 2, y: 1 } }
      }
    }
  ]);
}

async function prepare() {
  return new WebGpuSimulationEngine().prepare(scene());
}

describe('WebGpuSimulationEngine', () => {
  it('preserves subpixel ready-geometry widths before triangle generation',
    () => {
      const renderer = new WebGpuReadyRayRenderer({
        ctx: null,
        origin: { x: 0, y: 0 },
        scale: 0.25,
        lengthScale: 1,
      });
      renderer.drawSegment(
        { p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 } },
        [1, 1, 1, 0.5],
        false,
        [],
        1
      );

      expect(renderer.takeNewRecords()[0].width).toBe(0.25);
      expect(createWebGpuRenderPreparationShader(64))
        .toContain('vec4f(max(0.0,width),dash,max(0.0,endWidth))');
    });

  it('caps analytic coverage for subpixel lines, arrows, points, and dashes',
    () => {
      expect(calculateWebGpuLineCoverage(0, 0.25, 'default'))
        .toBeCloseTo(0.25);
      expect(calculateWebGpuLineCoverage(0.5, 0.25, 'default'))
        .toBeCloseTo(0.125);
      expect(calculateWebGpuArrowCoverage(
        0, 0.5, 1, 0.25, 0.25, 'default'
      )).toBeCloseTo(0.25);
      expect(calculateWebGpuPointCoverage(
        0, 0, 0.25, 'default'
      )).toBeCloseTo(0.25 * 0.25);
      expect(calculateWebGpuDashCoverage(
        0.125, 0.25, 1, 'default'
      )).toBeCloseTo(0.25);
      expect(calculateWebGpuDashCoverage(
        0.75, 0.25, 1, 'default'
      )).toBeCloseTo(0);
    });

  it('presents simulated colors with density-normalized hue and opacity', () => {
    expect(toneMapWebGpuColorContribution(
      [0.25, 0.5, 0.125], 'default', true
    )).toEqual([0.25, 0.5, 0.125, 0.5]);
    expect(toneMapWebGpuColorContribution(
      [1, 2, 0.5], 'default', true
    )).toEqual([0.5, 1, 0.25, 1]);
  });

  it('applies simulated-color antialiasing in linear intensity space', () => {
    const contribution = [0.25, 0.5, 0.125, 1];
    expect(applyWebGpuAnalyticCoverage(
      contribution, 0.25, 'default', true
    )).toEqual([0.0625, 0.125, 0.03125, 1]);
  });

  it('tone maps black with the Reinhard mode without a zero division', () => {
    expect(toneMapWebGpuColorContribution(
      [0, 0, 0], 'reinhard', false
    )).toEqual([0, 0, 0, 0]);
  });

  it('uses the same spectral boundaries as canvas color simulation', () => {
    expect(createWebGpuRenderPreparationShader(64)).toContain(
      'if(mode==5u){return vec4f(raw,1.0);}'
    );
    const defaults = createRenderUniformData({
      preparedScene: {
        parameterRanges: { wavelengthRange: [[380, 700]] },
        violetWavelength: 420,
        redWavelength: 620
      },
      rendering: {}
    }, 1);
    expect(Array.from(defaults.slice(12, 20))).toEqual([
      380, 420, 460, 500, 540, 580, 620, 700
    ]);

    const uniforms = createRenderUniformData({
      preparedScene: {
        parameterRanges: { wavelengthRange: [[800, 1400]] },
        violetWavelength: 900,
        redWavelength: 1300
      },
      rendering: {}
    }, 1);
    expect(uniforms[17]).toBeCloseTo(1220);
  });

  it('packs the common hierarchy as 80-byte float BVH4 nodes', async () => {
    const prepared = await prepare();
    const packed = prepared.packedStorage;
    const references = new Uint32Array(packed.bvhNodes, 64, 4);

    expect(prepared.executionPlan.buffers.bvhNodes.stride).toBe(80);
    expect(packed.counts.bvhNodes).toBe(1);
    expect(packed.bvhNodes.byteLength).toBe(80);
    expect(references[0] >>> 31).toBe(1);
    expect(Array.from(references.slice(1))).toEqual([
      0xffffffff, 0xffffffff, 0xffffffff
    ]);
  });

  it('requires WebGPU rather than falling back to CPU execution', async () => {
    const engine = new WebGpuSimulationEngine();
    const preparedScene = await engine.prepare(scene());
    await expect(engine.createRun({ preparedScene })).rejects.toThrow(
      /requires a WebGPU device/
    );
  });

  it('initializes without a rasterizer when no output is requested', async () => {
    const device = {
      limits: { maxStorageBuffersPerShaderStage: 8 }
    };
    const engine = new WebGpuSimulationEngine({ device });

    await engine.initialize();

    expect(engine.device).toBe(device);
    expect(engine.rasterizer).toBeNull();
    expect(engine.executionMode).toBe('webgpu-headless');
  });

  it('combines every source type with initial membership in one shader',
    async () => {
      const prepared = await prepare();
      const generated = createMegakernelInitialShader({
        description: prepared.runtimeDescription,
        dagPrograms: prepared.dagPrograms,
        workgroupSize: 64
      });

      expect(generated.supported).toBe(true);
      expect(generated.code).toContain('fn emitSource(');
      expect(generated.code).toContain('fn membershipAttempt(');
      expect(generated.code).toContain('fn initialMain(');
      expect(generated.code).toContain('switch source.typeId');
      expect(generated.code.match(/var<storage/g)).toHaveLength(8);
    });

  it('reconstructs line hits from the nearby ray frame', async () => {
    const prepared = await prepare();
    const generated = createWebGpuMegakernelShader({
      description: prepared.runtimeDescription,
      dagPrograms: prepared.dagPrograms,
      workgroupSize: 64,
      maxLocalIterations: 8,
      renderVariant: 'rays'
    });

    expect(generated.supported).toBe(true);
    expect(generated.code).toContain(
      'let point=ray.origin+s*ray.direction;'
    );
  });

  it('constructs circle hits in the local ray frame',
    async () => {
      const prepared = process([
        {
          kind: 'source', sourceType, params: { position: 59.5 }, rayCount: 1
        },
        {
          kind: 'surface', surfaceType: splitterType, params: {},
          twoSided: true,
          curve: {
            kind: 'circle',
            params: { center: { x: 642, y: 280 }, radius: 20 }
          }
        }
      ]);
      const generated = createWebGpuMegakernelShader({
        description: prepared,
        dagPrograms: (await new WebGpuSimulationEngine().prepare(prepared))
          .dagPrograms,
        workgroupSize: 64,
        maxLocalIterations: 8,
        renderVariant: 'rays'
      });

      expect(generated.supported).toBe(true);
      expect(generated.code).toContain(
        'let localPoint=surfaceOffset*transverse+alongDistance*unitDirection;'
      );
      expect(generated.code).not.toContain('fn refineCircleRoot(');
      expect(generated.code).toContain('candidate.point=hit.point;');
    });

  it('refines circular-arc roots in tracing and initial membership',
    async () => {
      const curve = {
        kind: 'circularArc',
        params: {
          start: { x: 642, y: 260 },
          end: { x: 642, y: 300 },
          bulge: 1
        }
      };
      const traced = process([
        {
          kind: 'source', sourceType, params: { position: 59.5 }, rayCount: 1
        },
        {
          kind: 'surface', surfaceType: splitterType, params: {},
          twoSided: true, curve
        }
      ]);
      const prepared = await new WebGpuSimulationEngine().prepare(traced);
      const traceShader = createWebGpuMegakernelShader({
        description: traced,
        dagPrograms: prepared.dagPrograms,
        workgroupSize: 64,
        maxLocalIterations: 8,
        renderVariant: 'rays'
      });
      const membershipScene = process([{
        kind: 'region', curves: [curve], bulkType, params: {}, stepSize: 1,
        partialReflect: true
      }]);
      const membershipShader = createWebGpuInitialMembershipShader(
        membershipScene,
        64
      );

      expect(traceShader.supported).toBe(true);
      expect(traceShader.code).toContain('fn refineArcRoot(');
      expect(traceShader.code).toContain(
        'let root=refineArcRoot(localOrigin,localDirection,bulge,factor,provisional);'
      );
      expect(traceShader.code).toContain(
        'let surfaceLocal=projectArcLocalPoint(point,bulge);'
      );
      expect(traceShader.code).toContain('var point=hit.point;');
      expect(membershipShader.supported).toBe(true);
      expect(membershipShader.code).toContain('fn refineArcRoot(');
      expect(membershipShader.code).toContain(
        'let s=refineArcRoot(origin,direction,bulge,factor,provisional);'
      );
    });

  it('compiles only the requested rendering-mode family into a megakernel',
    async () => {
      const prepared = await prepare();
      const generate = renderVariant => createWebGpuMegakernelShader({
        description: prepared.runtimeDescription,
        dagPrograms: prepared.dagPrograms,
        workgroupSize: 64,
        maxLocalIterations: 8,
        renderVariant
      });
      const rays = generate('rays');
      const images = generate('images');
      const observer = generate('observer');
      const headless = generate('none');

      expect(rays.supported).toBe(true);
      expect(rays.maximumOutputs).toBe(2);
      expect(rays.code).toContain('fn megakernelMain(');
      expect(rays.code).toContain('fn surface_0(');
      expect(rays.code).toContain('fn recordOutput(slot:u32)');
      expect(rays.code.match(/var<storage/g)).toHaveLength(7);
      expect(rays.code).toContain('var<storage,read> traceScene:TraceScene');
      expect(rays.code).not.toContain('traceScene.traceScene');
      expect(rays.code).toContain(
        'atomicMax(&drawArguments[megaUniforms.extentWord],collectorBlocks)'
      );
      expect(rays.code).toContain(
        'if(capacityStalled){isActive=false;capacityStopped=true;}'
      );
      expect(rays.code).toContain(
        'if(iteration==0u){atomicStore(&control[8],1u);}'
      );
      expect(rays.code).toContain('let renderActive=isActive&&!capacityStalled');
      expect(rays.code).not.toContain(
        'if(power<traceUniforms.rayPowerCutoff)'
      );
      expect(rays.code).toContain(
        'traceUniforms.truncateWeakRays!=0u'
      );
      expect(rays.code).toContain(
        'recordTruncation(ray.powers.x+ray.powers.y)'
      );
      expect(rays.code).toContain(
        'recordNormalConflict(\n        rayIndex,hit,ray.powers.x+ray.powers.y)'
      );
      expect(rays.code).toContain('recordTruncation(power)');
      expect(rays.code).not.toContain('sharedRays');
      expect(rays.code).not.toContain('fn lineIntersection(');
      expect(images.code).toContain('var<workgroup> sharedRays');
      expect(images.code).toContain('workgroupBarrier()');
      expect(images.code).toContain('fn renderImageNeighbor(');
      expect(images.code).not.toContain('fn observerPoint(');
      expect(observer.code).toContain('fn renderObserverNeighbor(');
      expect(observer.code).toContain('fn observerPoint(');
      expect(headless.supported).toBe(true);
      expect(headless.code).not.toContain('fn renderIndependent(');
      expect(headless.code).not.toContain('fn renderImageNeighbor(');
      expect(headless.code).not.toContain('fn renderObserverNeighbor(');
    });

  it('decodes the first WebGPU normal-conflict diagnostic', () => {
    const data = new ArrayBuffer(WEBGPU_MEGAKERNEL_RUN_CONTROL_SIZE);
    const control = new Uint32Array(data);
    control[18] = 1;
    control[22] = 3;
    control[23] = 7;
    control[24] = 4;
    control[25] = 9;
    control[26] = Math.round(0.25 * 1048576);

    const decoded = decodeWebGpuMegakernelRunState(data, scene());

    expect(decoded).toEqual(expect.objectContaining({
      warningFlags: 1,
      warningConflictCount: 3,
      warningRayIndex: 7,
      warningCurveId: 4,
      warningConflictingCurveId: 9,
      ambiguousPower: 0.25,
    }));
    expect(createNormalConflictWarning(
      decoded,
      scene(),
      FLOAT32_EPSILON
    )).toEqual(expect.objectContaining({
      rayIndex: 7,
      curveId: 4,
      conflictingCurveId: 9,
      ambiguousPower: 0.25,
      tolerance: expect.objectContaining({
        kind: 'interactionNormal',
        unit: 'radians',
      }),
    }));
    expect(createNormalConflictWarning(
      { ...decoded, ambiguousPower: 1e-8 },
      scene(),
      FLOAT32_EPSILON
    )).toBeNull();
  });

  it('uses power prefixes for a stable systematically sampled queue', () => {
    const code = createMegakernelCollectorShader(64);

    expect(code).toContain('fn weightMain(');
    expect(code).toContain('fn prefixMain(');
    expect(code).toContain('fn fillMain(');
    expect(code).toContain('fn rayWeight(power:f32)->f32');
    expect(code).toContain('power/config.rayPowerCutoff');
    expect(code).toContain(
      'config.truncateWeakRays!=0u&&power<config.rayPowerCutoff'
    );
    expect(code).toContain('atomicAdd(&queue[17]');
    expect(code).toContain('cumulative+=weights[lane]');
    expect(code).toContain('rays[rayIndex].powers=rays[rayIndex].powers/weight');
    expect(code).toContain(
      'queue[config.activeOffset+destination]'
    );
    expect(code).toContain('dispatchArguments:array<atomic<u32>>');
    expect(code).toContain(
      'activeBlocks=min(atomicLoad(\n    &queue[20]),config.blockCount)'
    );
    expect(code).not.toContain('atomicAdd(&queue[config.activeOffset');
    expect(code).toContain(
      'fn nextSamplingGeneration()->u32 { return atomicLoad(&queue[11])+1u; }'
    );
    expect(code).toContain(
      'samplingPhase(nextSamplingGeneration())'
    );
    expect(code).toContain(
      'let currentOutputGeneration=atomicLoad(&queue[21]);'
    );
    expect(code).toContain(
      'let currentSamplingGeneration=atomicLoad(&queue[11]);'
    );
    expect(code).toContain(
      'activeRayPower(index,currentOutputGeneration)'
    );
    expect(code).toContain(
      'samplingPhase(currentSamplingGeneration)'
    );
    expect(code).not.toContain('samplingPhase(outputGeneration())');
    expect(code).toContain('atomicAdd(&queue[21],1u)');
    const layout = createMegakernelQueueLayout(1024, 64);
    expect(layout.activeOffsets).toEqual([32, 1056]);
  });

  it('bounds collector scans with tracing high-water dispatch arguments', () => {
    const backend = new WebGpuMegakernelBackend(null, {}, {});
    backend.drawIndirectBuffer = {};
    backend.collectorBindGroups = [{}];
    backend.collectorPipelines = { weight: {}, prefix: {}, fill: {} };
    const encodedPasses = [];
    const commandEncoder = { beginComputePass: jest.fn(() => {
      const pass = { setPipeline: jest.fn(), setBindGroup: jest.fn(),
        dispatchWorkgroups: jest.fn(),
        dispatchWorkgroupsIndirect: jest.fn(), end: jest.fn() };
      encodedPasses.push(pass);
      return pass;
    }) };

    backend.encodeCollector(commandEncoder, 0);

    expect(encodedPasses[0].dispatchWorkgroupsIndirect)
      .toHaveBeenCalledWith(backend.drawIndirectBuffer, 16);
    expect(encodedPasses[1].dispatchWorkgroups).toHaveBeenCalledWith(1);
    expect(encodedPasses[2].dispatchWorkgroupsIndirect)
      .toHaveBeenCalledWith(backend.drawIndirectBuffer, 16);

    backend.encodeCollector(commandEncoder, 1);
    expect(encodedPasses[3].dispatchWorkgroupsIndirect)
      .toHaveBeenCalledWith(backend.drawIndirectBuffer, 28);
    expect(encodedPasses[4].dispatchWorkgroups).toHaveBeenCalledWith(1);
    expect(encodedPasses[5].dispatchWorkgroupsIndirect)
      .toHaveBeenCalledWith(backend.drawIndirectBuffer, 28);
  });

  it('traces with generation-tagged outputs and no ray clear pass', () => {
    const backend = new WebGpuMegakernelBackend(null, {}, {});
    backend.queueLayout = { blockOffset: 32, blockCount: 16 };
    backend.drawIndirectBuffer = {};
    backend.queueBuffer = {};
    backend.dispatchIndirectBuffer = {};
    backend.currentStage = { pipeline: {}, bindGroups: [{}, {}] };
    const passes = [];
    const commandEncoder = {
      clearBuffer: jest.fn(),
      beginComputePass: jest.fn(() => {
        const pass = { setPipeline: jest.fn(), setBindGroup: jest.fn(),
          dispatchWorkgroupsIndirect: jest.fn(), end: jest.fn() };
        passes.push(pass);
        return pass;
      }),
    };

    backend.encodeMegakernel(commandEncoder, 0);

    expect(commandEncoder.clearBuffer)
      .toHaveBeenCalledWith(backend.drawIndirectBuffer, 28, 4);
    expect(commandEncoder.clearBuffer.mock.calls.some(
      ([buffer]) => buffer === backend.rayBuffer
    )).toBe(false);
    expect(passes[0].dispatchWorkgroupsIndirect)
      .toHaveBeenCalledWith(backend.dispatchIndirectBuffer, 0);
  });

  it('does not clear the full ray buffer when starting a frame', () => {
    const backend = new WebGpuMegakernelBackend(null, {
      packedStorage: { counts: { sourceRays: 0 } }
    }, {});
    backend.detectorResultBuffer = {};
    backend.rayBuffer = {};
    const commandEncoder = { clearBuffer: jest.fn() };

    backend.encodeInitial(commandEncoder);

    expect(commandEncoder.clearBuffer)
      .toHaveBeenCalledTimes(1);
    expect(commandEncoder.clearBuffer)
      .toHaveBeenCalledWith(backend.detectorResultBuffer);
  });

  it('preserves the GPU generation counter across frame resets', () => {
    const writeBuffer = jest.fn();
    const backend = new WebGpuMegakernelBackend({ queue: { writeBuffer } }, {
      packedStorage: { counts: { sourceRays: 0 } }
    }, { maxReadyGeometryRecords: 2 });
    backend.rayCapacity = 1024;
    backend.currentPayloadSize = 64;
    backend.queueBuffer = {};
    backend.drawIndirectBuffer = {};
    backend.queueLayout = createMegakernelQueueLayout(1024, 64);

    backend.resetRunControl();

    expect(writeBuffer.mock.calls[0][2]).toHaveLength(21);
  });

  it('preserves packed trace-scene offsets when a source is removed', () => {
    const writeBuffer = jest.fn();
    const device = {
      createBuffer: jest.fn(options => ({ ...options })),
      queue: { writeBuffer },
    };
    const packedScene = instanceParameters => ({
      instanceParameters: Float32Array.from(instanceParameters),
      sourceDescriptors: new ArrayBuffer(16),
      surfaceDescriptors: Uint32Array.from([11, 12, 13, 14]),
      regionDescriptors: new ArrayBuffer(0),
      detectorDescriptors: new ArrayBuffer(0),
      curveDescriptors: new ArrayBuffer(32),
      curveGeometry: new Float32Array(0),
      bvhNodes: new ArrayBuffer(80),
      bvhCurveIds: new Uint32Array(0),
    });
    const storage = new WebGpuMegakernelStaticSceneStorage(
      device,
      packedScene([1, 2])
    );
    writeBuffer.mockClear();

    storage.update(packedScene([1]));

    const traceWrite = writeBuffer.mock.calls.find(
      ([buffer]) => buffer === storage.buffers.traceScene
    );
    const traceData = traceWrite[2];
    // Removing a source must not compact the reserved parameter array or shift
    // the following surface descriptor to the replacement scene's offset.
    const surfaceOffset = storage.capacities.bvhNodes +
      storage.capacities.instanceParameters;
    expect(new Uint32Array(
      traceData.buffer,
      traceData.byteOffset + surfaceOffset,
      4
    )).toEqual(Uint32Array.from([11, 12, 13, 14]));
  });

  it('reserves static scene capacity for several same-signature additions',
    () => {
      const writeBuffer = jest.fn();
      const device = {
        createBuffer: jest.fn(options => ({ ...options })),
        queue: { writeBuffer },
        limits: {
          maxStorageBufferBindingSize: 128 * 1024 * 1024,
          maxBufferSize: 128 * 1024 * 1024,
        },
      };
      const packedScene = mirrorCount => ({
        instanceParameters: new Float32Array(0),
        sourceDescriptors: new ArrayBuffer(16),
        surfaceDescriptors: new ArrayBuffer(mirrorCount * 16),
        regionDescriptors: new ArrayBuffer(0),
        detectorDescriptors: new ArrayBuffer(0),
        curveDescriptors: new ArrayBuffer(mirrorCount * 32),
        curveGeometry: new Float32Array(mirrorCount * 8),
        bvhNodes: new ArrayBuffer(80),
        bvhCurveIds: new Uint32Array(mirrorCount),
      });
      const storage = new WebGpuMegakernelStaticSceneStorage(
        device,
        packedScene(1)
      );

      expect(storage.canUpdate(packedScene(4))).toBe(true);
      expect(() => storage.update(packedScene(4))).not.toThrow();
      expect(storage.capacities.surfaceDescriptors).toBeGreaterThanOrEqual(64);
      expect(storage.capacities.curveDescriptors).toBeGreaterThanOrEqual(128);
      expect(storage.capacities.curveGeometry).toBeGreaterThanOrEqual(128);
    });

  it('compiles reused megakernels against immutable trace-scene capacities',
    async () => {
      const prepared = await prepare();
      const capacities = {
        bvhNodes: 160,
        instanceParameters: 8,
        surfaceDescriptors: 32,
        regionDescriptors: 32,
        detectorDescriptors: 32,
        curveDescriptors: 64,
        curveGeometry: 64,
        bvhCurveIds: 8,
      };
      const generated = createWebGpuMegakernelShader({
        description: prepared.runtimeDescription,
        dagPrograms: prepared.dagPrograms,
        workgroupSize: 64,
        maxLocalIterations: 8,
        renderVariant: 'rays',
        traceSceneFieldCapacities: capacities,
      });

      expect(generated.supported).toBe(true);
      expect(generated.code).toContain('bvhNodes:array<BvhNode,2>');
      expect(generated.code).toContain(
        'instanceParameters:array<f32,2>'
      );
      expect(generated.code).toContain(
        'surfaces:array<InstanceDescriptor,2>'
      );
      expect(generated.code).toContain(
        'curves:array<CurveDescriptor,2>'
      );
  });

  it('passes the configured ray-power policy to tracing and both collectors',
    async () => {
      const writeBuffer = jest.fn();
      const backend = new WebGpuMegakernelBackend({ queue: { writeBuffer } },
        {}, { workgroupSize: 64 });
      backend.traceUniformBuffer = {};
      backend.renderUniformBuffer = {};
      backend.queueBuffer = {};
      backend.collectorUniformBuffers = [{}, {}];
      backend.renderPreparationStage = { geometryCapacity: 1 };
      backend.megakernelStages.set('rays', {});
      backend.writeMegakernelUniforms = jest.fn();

      await backend.configureRun({
        colorMode: 'linear',
        rayPowerCutoff: 0.002,
        rayPowerSampling: false,
        preparedScene: {
          parameterRanges: { wavelengthRange: [[380, 700]] }
        },
        rendering: { mode: 'rays' }
      });

      const collectorWrites = writeBuffer.mock.calls.filter(
        ([buffer, offset]) =>
          backend.collectorUniformBuffers.includes(buffer) && offset === 36
      );
      expect(collectorWrites).toHaveLength(2);
      expect(Array.from(collectorWrites[0][2]))
        .toEqual([Math.fround(0.002)]);
      const collectorModeWrites = writeBuffer.mock.calls.filter(
        ([buffer, offset]) =>
          backend.collectorUniformBuffers.includes(buffer) && offset === 40
      );
      expect(collectorModeWrites).toHaveLength(2);
      expect(Array.from(collectorModeWrites[0][2])).toEqual([1]);
      expect(writeBuffer).toHaveBeenCalledWith(
        backend.traceUniformBuffer,
        52,
        expect.any(Uint32Array)
      );
    });

  it('uses fixed default-color ray-power options', async () => {
    const writeBuffer = jest.fn();
    const backend = new WebGpuMegakernelBackend({ queue: { writeBuffer } },
      {}, { workgroupSize: 64 });
    backend.traceUniformBuffer = {};
    backend.renderUniformBuffer = {};
    backend.queueBuffer = {};
    backend.collectorUniformBuffers = [{}, {}];
    backend.renderPreparationStage = { geometryCapacity: 1 };
    backend.megakernelStages.set('rays', {});
    backend.writeMegakernelUniforms = jest.fn();

    await backend.configureRun({
      colorMode: 'default',
      rayPowerCutoff: 0.1,
      rayPowerSampling: false,
      preparedScene: {
        parameterRanges: { wavelengthRange: [[380, 700]] }
      },
      rendering: { mode: 'rays' }
    });

    const cutoffWrite = writeBuffer.mock.calls.find(
      ([buffer, offset]) => buffer === backend.traceUniformBuffer &&
        offset === 48
    );
    const samplingWrite = writeBuffer.mock.calls.find(
      ([buffer, offset]) => buffer === backend.traceUniformBuffer &&
        offset === 52
    );
    expect(Array.from(cutoffWrite[2])).toEqual([Math.fround(0.01)]);
    expect(Array.from(samplingWrite[2])).toEqual([0]);
  });

  it('alternates several ping-pongs in one command submission', () => {
    const backend = new WebGpuMegakernelBackend(null, {}, {
      maxPingPongsPerSubmission: 4
    });
    backend.encodeMegakernel = jest.fn();
    backend.encodeCollector = jest.fn();
    const commandEncoder = {};

    backend.encodePingPongBatch(commandEncoder, 1);

    expect(backend.encodeMegakernel.mock.calls.map(call => call[1]))
      .toEqual([1, 0, 1, 0]);
    expect(backend.encodeCollector.mock.calls.map(call => call[1]))
      .toEqual([0, 1, 0, 1]);
  });

  it('submits compute, readback, raster, and presentation together', async () => {
    const submit = jest.fn();
    const encoder = { finish: jest.fn(() => ({})) };
    const engine = new WebGpuSimulationEngine();
    engine.device = {
      createCommandEncoder: jest.fn(() => encoder),
      queue: { submit },
    };
    engine.computeBackend = {
      canEmitAllSources: true,
      renderPreparationStage: { geometryBuffer: {}, drawIndirectBuffer: {} },
      resetRunControl: jest.fn(),
      encodeReadyGeometryReset: jest.fn(),
      encodeInitial: jest.fn(),
      encodeStateReadback: jest.fn(() => async () => ({})),
    };
    engine.rasterizer = {
      prepareGpuGeometryIndirect: jest.fn(async () => ({})),
      encodeGpuGeometryIndirect: jest.fn(),
      waitForSubmittedWork: jest.fn(async () => {}),
    };

    const batch = await engine.startNativeRun({ rendering: {} });
    await Promise.all([batch.statePromise, batch.presentationPromise]);

    expect(submit).toHaveBeenCalledTimes(1);
    expect(engine.computeBackend.encodeStateReadback).toHaveBeenCalled();
    expect(engine.rasterizer.encodeGpuGeometryIndirect).toHaveBeenCalled();
  });

  it('submits compute and readback without a raster pass when headless',
    async () => {
      const submit = jest.fn();
      const encoder = { finish: jest.fn(() => ({})) };
      const engine = new WebGpuSimulationEngine();
      engine.device = {
        createCommandEncoder: jest.fn(() => encoder),
        queue: { submit },
      };
      engine.computeBackend = {
        canEmitAllSources: true,
        resetRunControl: jest.fn(),
        encodeReadyGeometryReset: jest.fn(),
        encodeInitial: jest.fn(),
        encodeStateReadback: jest.fn(() => async () => ({})),
      };

      const batch = await engine.startNativeRun({ rendering: {} });
      const [state, presented] = await Promise.all([
        batch.statePromise,
        batch.presentationPromise,
      ]);

      expect(state).toEqual({});
      expect(presented).toBe(false);
      expect(submit).toHaveBeenCalledTimes(1);
      expect(engine.computeBackend.encodeStateReadback).toHaveBeenCalled();
    });

  it('throws when the buffer cannot complete the first tracing step',
    async () => {
      const engine = new WebGpuSimulationEngine();
      engine.initialize = jest.fn(async () => {});
      engine.device = {};
      engine.ensureComputeBackend = jest.fn(async () => true);
      engine.computeBackend = {
        configureRun: jest.fn(async () => {}),
        renderPreparationStage: { geometryCapacity: 1 }
      };
      engine.startNativeRun = jest.fn(async () => ({
        statePromise: Promise.resolve({
          currentRayCount: 8,
          readyGeometryCount: 0,
          resizeNeeded: true,
          requiredRayCapacity: 16,
        }),
        presentationPromise: Promise.resolve(false),
      }));

      const run = await engine.createRun({ preparedScene: {} });

      await expect(run.advance()).rejects.toThrow(
        /approximately 16 rays.*Increase the ray buffer capacity/
      );
    });

  it('throws instead of presenting incomplete ready geometry', async () => {
    const engine = new WebGpuSimulationEngine();
    engine.initialize = jest.fn(async () => {});
    engine.device = {};
    engine.ensureComputeBackend = jest.fn(async () => true);
    engine.computeBackend = {
      configureRun: jest.fn(async () => {}),
      renderPreparationStage: { geometryCapacity: 1 }
    };
    engine.startNativeRun = jest.fn(async () => ({
      statePromise: Promise.resolve({
        currentRayCount: 8,
        readyGeometryCount: 2,
        resizeNeeded: false,
        readyGeometryOverflow: true,
      }),
      presentationPromise: Promise.resolve(false),
    }));

    const run = await engine.createRun({ preparedScene: {} });

    await expect(run.advance()).rejects.toThrow(
      /ready-geometry buffer.*without omitting light geometry/
    );
  });

  it('throws instead of publishing overflowed detector values', async () => {
    const engine = new WebGpuSimulationEngine();
    engine.initialize = jest.fn(async () => {});
    engine.device = {};
    engine.ensureComputeBackend = jest.fn(async () => true);
    engine.computeBackend = {
      configureRun: jest.fn(async () => {}),
      renderPreparationStage: { geometryCapacity: 1 }
    };
    engine.startNativeRun = jest.fn(async () => ({
      statePromise: Promise.resolve({
        currentRayCount: 8,
        readyGeometryCount: 0,
        resizeNeeded: false,
        readyGeometryOverflow: false,
        detectorOverflow: true,
      }),
      presentationPromise: Promise.resolve(false),
    }));

    const run = await engine.createRun({ preparedScene: {} });

    await expect(run.advance()).rejects.toThrow(
      /detector accumulation overflowed.*detector values would be invalid/
    );
  });

  it('validates the ping-pong batch size', () => {
    expect(() => new WebGpuSimulationEngine({
      config: { maxPingPongsPerSubmission: 0 }
    })).toThrow(/maxPingPongsPerSubmission/);
  });

  it('accepts and validates the atomic fixed-point scale', () => {
    const engine = new WebGpuSimulationEngine({
      config: { atomicFixedPointScale: 4096 }
    });
    expect(engine.runConfig.atomicFixedPointScale).toBe(4096);
    expect(() => new WebGpuSimulationEngine({
      config: { atomicFixedPointScale: 0 }
    })).toThrow(/atomicFixedPointScale/);
    expect(() => new WebGpuSimulationEngine({
      config: { atomicFixedPointScale: 16777217 }
    })).toThrow(/atomicFixedPointScale/);
  });

  it('decodes fixed-point diagnostics with the configured scale', () => {
    const data = new ArrayBuffer(WEBGPU_MEGAKERNEL_RUN_CONTROL_SIZE);
    const control = new Uint32Array(data);
    control[17] = 2048;
    control[26] = 1024;
    const decoded = decodeWebGpuMegakernelRunState(data, scene(), 4096);
    expect(decoded.totalTruncation).toBe(0.5);
    expect(decoded.ambiguousPower).toBe(0.25);
  });

  it('keys recompilation on the whole embedded scene specialization',
    async () => {
      const prepared = await prepare();

      expect(prepared.executionPlan.megakernelSignature).toContain(
        prepared.executionPlan.typeSignature
      );
      expect(prepared.executionPlan.megakernelSignature).toContain(
        'surfaceOutputCounts'
      );
      expect(prepared.executionPlan.megakernelSignature).toContain('guards');
    });

  it('uses configured BVH depth capacity instead of exact depth as a key',
    async () => {
      const description = scene();
      const first = await new WebGpuSimulationEngine({
        config: { maxBvhDepth: 16 }
      }).prepare(description);
      const deeperDescription = {
        ...description,
        bvh: {
          ...description.bvh,
          nodes: description.bvh.nodes.map((node, index) => ({
            ...node,
            depth: index === 0 ? 10 : node.depth,
          })),
        },
      };
      const second = await new WebGpuSimulationEngine({
        config: { maxBvhDepth: 16 }
      }).prepare(deeperDescription);

      expect(first.executionPlan.maximumBvhDepth).not.toBe(
        second.executionPlan.maximumBvhDepth
      );
      expect(first.executionPlan.megakernelSignature).toBe(
        second.executionPlan.megakernelSignature
      );
      expect(second.executionPlan.maxBvhDepth).toBe(16);
    });

  it('rejects a BVH deeper than the configured WebGPU stack capacity',
    async () => {
      const description = scene();
      const deeperDescription = {
        ...description,
        bvh: {
          ...description.bvh,
          nodes: description.bvh.nodes.map((node, index) => ({
            ...node,
            depth: index === 0 ? 17 : node.depth,
          })),
        },
      };
      const engine = new WebGpuSimulationEngine({
        config: { maxBvhDepth: 16 }
      });

      await expect(engine.prepare(deeperDescription)).rejects.toThrow(
        /BVH depth 17.*maxBvhDepth 16/
      );
    });

  it('validates the configured WebGPU BVH depth capacity', () => {
    expect(() => new WebGpuSimulationEngine({
      config: { maxBvhDepth: 0 }
    })).toThrow(/maxBvhDepth/);
  });
});
