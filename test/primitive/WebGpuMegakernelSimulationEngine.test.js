/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { parseFormula } from '../../src/core/formula/formula-parser.js';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric.js';
import { preprocessPrimitives } from '../../src/core/primitive/preprocess.js';
import WebGpuMegakernelSimulationEngine from
  '../../src/core/simulationEngines/webgpuMegakernel/WebGpuMegakernelSimulationEngine.js';
import { createWebGpuMegakernelShader } from
  '../../src/core/simulationEngines/webgpuMegakernel/webGpuMegakernelShader.js';
import { createMegakernelInitialShader } from
  '../../src/core/simulationEngines/webgpuMegakernel/webGpuMegakernelInitial.js';
import {
  createMegakernelCollectorShader,
  createMegakernelQueueLayout,
} from
  '../../src/core/simulationEngines/webgpuMegakernel/webGpuMegakernelQueue.js';
import { WebGpuMegakernelBackend } from
  '../../src/core/simulationEngines/webgpuMegakernel/webGpuMegakernelBackend.js';

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
  return new WebGpuMegakernelSimulationEngine().prepare(scene());
}

describe('WebGpuMegakernelSimulationEngine', () => {
  it('requires WebGPU rather than falling back to CPU execution', async () => {
    const engine = new WebGpuMegakernelSimulationEngine();
    const preparedScene = await engine.prepare(scene());
    await expect(engine.createRun({ preparedScene })).rejects.toThrow(
      /requires a WebGPU device and output/
    );
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

      expect(rays.supported).toBe(true);
      expect(rays.maximumOutputs).toBe(2);
      expect(rays.code).toContain('fn megakernelMain(');
      expect(rays.code).toContain('fn surface_0(');
      expect(rays.code).toContain('fn recordOutput(slot:u32)');
      expect(rays.code).toContain(
        'atomicMax(&drawArguments[megaUniforms.extentWord],collectorBlocks)'
      );
      expect(rays.code).not.toContain('sharedRays');
      expect(rays.code).not.toContain('fn lineIntersection(');
      expect(images.code).toContain('var<workgroup> sharedRays');
      expect(images.code).toContain('workgroupBarrier()');
      expect(images.code).toContain('fn renderImageNeighbor(');
      expect(images.code).not.toContain('fn observerPoint(');
      expect(observer.code).toContain('fn renderObserverNeighbor(');
      expect(observer.code).toContain('fn observerPoint(');
    });

  it('uses block prefixes for a stable physical-order queue', () => {
    const code = createMegakernelCollectorShader(64);

    expect(code).not.toContain('fn countMain(');
    expect(code).toContain('fn prefixMain(');
    expect(code).toContain('fn fillMain(');
    expect(code).toContain('generation==atomicLoad(&queue[21])');
    expect(code).toContain('destinations[lane]=cursor');
    expect(code).toContain(
      'queue[config.activeOffset+destinations[local.x]]'
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
    backend.collectorPipelines = { prefix: {}, fill: {} };
    const encodedPasses = [];
    const commandEncoder = { beginComputePass: jest.fn(() => {
      const pass = { setPipeline: jest.fn(), setBindGroup: jest.fn(),
        dispatchWorkgroups: jest.fn(),
        dispatchWorkgroupsIndirect: jest.fn(), end: jest.fn() };
      encodedPasses.push(pass);
      return pass;
    }) };

    backend.encodeCollector(commandEncoder, 0);

    expect(encodedPasses[0].dispatchWorkgroups).toHaveBeenCalledWith(1);
    expect(encodedPasses[1].dispatchWorkgroupsIndirect)
      .toHaveBeenCalledWith(backend.drawIndirectBuffer, 16);

    backend.encodeCollector(commandEncoder, 1);
    expect(encodedPasses[2].dispatchWorkgroups).toHaveBeenCalledWith(1);
    expect(encodedPasses[3].dispatchWorkgroupsIndirect)
      .toHaveBeenCalledWith(backend.drawIndirectBuffer, 28);
  });

  it('traces with generation-tagged counts and no ray clear pass', () => {
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
    expect(commandEncoder.clearBuffer)
      .toHaveBeenCalledWith(backend.queueBuffer, 128, 64);
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
    const engine = new WebGpuMegakernelSimulationEngine();
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

  it('validates the ping-pong batch size', () => {
    expect(() => new WebGpuMegakernelSimulationEngine({
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
