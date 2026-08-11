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
import { selectWebGpuRayCooperationStrategy } from
  '../../src/core/simulationEngines/webgpu/webGpuRayCooperation.js';
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

  it('generates cooperative direct and partitioned-BVH megakernels', async () => {
    const prepared = await prepare();
    const generate = (renderVariant, acceleration, lanesPerRay) =>
      createWebGpuMegakernelShader({
        description: prepared.runtimeDescription,
        dagPrograms: prepared.dagPrograms,
        workgroupSize: 64,
        maxLocalIterations: 8,
        renderVariant,
        acceleration,
        lanesPerRay,
      }).code;
    const direct = generate('rays', 'direct', 16);
    const scalarDirect = generate('rays', 'direct', 1);
    const bvh = generate('rays', 'bvh4', 4);
    const images = generate('images', 'direct', 16);

    expect(direct).toContain('traceDirectLane(ray,&membership,lane,16u');
    expect(scalarDirect).toContain(
      'traceDirectLane(ray,&membership,0u,1u,&front,&back)'
    );
    expect(bvh).toContain('traceBvhLane(ray,&membership,lane,4u');
    expect(bvh).toContain('bvhPartitionRoots[rootIndex]');
    expect(direct).toContain('var<workgroup> cooperativeHits');
    expect(images).toContain('let rayBase=workgroup.x*2u');
    expect(images).toContain('if(leader&&real&&raySlot>=2u)');
  });

  it('selects measured lane widths and accounts for image halos', () => {
    const config = DEFAULT_SIMULATION_ENGINE_CONFIGS.webgpu;
    const select = (activeRayCount, primitiveCount, neighborMode = false) =>
      selectWebGpuRayCooperationStrategy({
        activeRayCount,
        primitiveCount,
        workgroupSize: 64,
        neighborMode,
        config,
      });

    expect(select(16384, 4096)).toEqual({
      acceleration: 'bvh4', lanesPerRay: 1
    });
    expect(select(1024, 4096)).toEqual({
      acceleration: 'direct', lanesPerRay: 8
    });
    expect(select(4096, 4096)).toEqual({
      acceleration: 'bvh4', lanesPerRay: 2
    });
    expect(select(1, 1)).toEqual({
      acceleration: 'direct', lanesPerRay: 1
    });
    expect(select(3000, 16)).toEqual({
      acceleration: 'direct', lanesPerRay: 2
    });
    expect(select(256, 65536)).toEqual({
      acceleration: 'bvh4', lanesPerRay: 32
    });
    expect(select(256, 65536, true)).toEqual({
      acceleration: 'bvh4', lanesPerRay: 16
    });

    expect(selectWebGpuRayCooperationStrategy({
      activeRayCount: 256,
      primitiveCount: 65536,
      workgroupSize: 64,
      config: {
        ...config,
        rayCooperationMaximumLanesPerRay: 24,
      },
    })).toEqual({ acceleration: 'bvh4', lanesPerRay: 16 });
  });

  it('logs the selected ray cooperation in debug mode', async () => {
    const writeBuffer = jest.fn();
    const preparedScene = {
      logDebugInfo: true,
      packedStorage: { counts: { curves: 4096 } }
    };
    const config = DEFAULT_SIMULATION_ENGINE_CONFIGS.webgpu;
    const backend = new WebGpuMegakernelBackend({
      limits: { maxComputeWorkgroupStorageSize: 16384 },
      queue: { writeBuffer }
    }, preparedScene, config);
    backend.queueBuffer = {};
    backend.dispatchIndirectBuffer = {};
    backend.regionWordCount = 1;
    backend.megakernelStages.set('rays:direct:8', {});
    backend.writeMegakernelUniforms = jest.fn();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await backend.prepareBatch(1024);

      expect(log).toHaveBeenCalledWith(
        '[WebGPU ray cooperation] activeRays=%d lanesPerRay=%d acceleration=%s',
        1024,
        8,
        'direct'
      );
    } finally {
      log.mockRestore();
    }
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
    }, { maxReadyLineRecords: 1, maxReadyPointRecords: 1 });
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
    // bvhNodes occupy 80 bytes and the compiled parameter array occupies 8.
    // Removing a source must not shift the following surface descriptor to 84.
    expect(new Uint32Array(
      traceData.buffer,
      traceData.byteOffset + 88,
      4
    )).toEqual(Uint32Array.from([11, 12, 13, 14]));
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
        rayPowerCutoff: 0.002,
        rayPowerCutoffMode: 'truncate',
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
          readyLineCount: 0,
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

  it('validates the ping-pong batch size', () => {
    expect(() => new WebGpuSimulationEngine({
      config: { maxPingPongsPerSubmission: 0 }
    })).toThrow(/maxPingPongsPerSubmission/);
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
});
