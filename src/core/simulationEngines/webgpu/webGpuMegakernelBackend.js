/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { getIntersectionTolerancePolicy } from '../../primitive/numeric.js';
import { getEffectiveRayPowerOptions } from '../rayPower.js';
import { WEBGPU_RAY_STRIDE } from './webGpuExecutionPlan.js';
import {
  WEBGPU_MEGAKERNEL_RUN_CONTROL_SIZE,
  WebGpuMegakernelStaticSceneStorage,
  decodeWebGpuMegakernelRunState
} from './webGpuMegakernelStorage.js';
import {
  createMegakernelInitialConfigData,
  createMegakernelInitialShader,
  createMegakernelInitialUniformData,
  createUniformBuffer,
} from './webGpuMegakernelInitial.js';
import {
  MEGAKERNEL_COLLECTOR_BLOCK_COUNT_WORD,
  createMegakernelCollectorShader,
  createMegakernelQueueBuffer,
  createMegakernelQueueLayout,
  createMegakernelQueueUniformData,
} from './webGpuMegakernelQueue.js';
import { createWebGpuMegakernelShader } from './webGpuMegakernelShader.js';
import {
  createRenderUniformData
} from './webGpuRenderPreparation.js';

const BUFFER_USAGE_MAP_READ = 0x0001;
const BUFFER_USAGE_COPY_SRC = 0x0004;
const BUFFER_USAGE_COPY_DST = 0x0008;
const BUFFER_USAGE_UNIFORM = 0x0040;
const BUFFER_USAGE_STORAGE = 0x0080;
const BUFFER_USAGE_INDIRECT = 0x0100;
const RAY_EXTENT_DISPATCH_WORD = 4;
const INDIRECT_ARGUMENT_WORDS = 3;

function rayExtentDispatchIndirectOffset(direction) {
  return (RAY_EXTENT_DISPATCH_WORD +
    direction * INDIRECT_ARGUMENT_WORDS) * 4;
}

export class WebGpuMegakernelBackend {
  constructor(device, preparedScene, config) {
    this.device = device;
    this.preparedScene = preparedScene;
    this.config = config;
    this.staticStorage = null;
    this.rayCapacity = 0;
    this.regionWordCount = 0;
    this.membershipStride = 0;
    this.rayBuffer = null;
    this.membershipBuffer = null;
    this.queueBuffer = null;
    this.dispatchIndirectBuffer = null;
    this.queueLayout = null;
    this.detectorResultBuffer = null;
    this.geometryBuffer = null;
    this.drawIndirectBuffer = null;
    this.traceUniformBuffer = null;
    this.megaUniformBuffers = [];
    this.renderUniformBuffer = null;
    this.initialMembershipUniformBuffer = null;
    this.initialConfigBuffer = null;
    this.collectorUniformBuffers = [];
    this.initialPipeline = null;
    this.initialBindGroup = null;
    this.collectorPipelines = null;
    this.collectorBindGroups = [];
    this.megakernelStages = new Map();
    this.currentStage = null;
    this.currentRenderVariant = 'rays';
    this.currentPayloadSize = config.workgroupSize;
    this.maxRayDepth = 0xffffffff;
    this.canEmitAllSources = false;
    this.renderPreparationStage = null;
  }

  async initialize() {
    const scene = this.preparedScene;
    this.staticStorage = new WebGpuMegakernelStaticSceneStorage(
      this.device,
      scene.packedStorage
    );
    this.regionWordCount = Math.max(1, scene.packedStorage.counts.regionWords);
    this.membershipStride = this.regionWordCount + 1;
    const maximumBinding = this.device.limits?.maxStorageBufferBindingSize ??
      this.config.maxBatchRayEvents * WEBGPU_RAY_STRIDE * 2;
    const rayLimit = Math.floor(maximumBinding / (WEBGPU_RAY_STRIDE * 2));
    const membershipLimit = Math.floor(maximumBinding /
      (this.membershipStride * 4 * 2));
    this.rayCapacity = Math.max(1, Math.min(
      this.config.maxBatchRayEvents,
      rayLimit,
      membershipLimit
    ));
    const sourceRayCount = scene.packedStorage.counts.sourceRays;
    this.canEmitAllSources = sourceRayCount <= this.rayCapacity;
    this.queueLayout = createMegakernelQueueLayout(
      this.rayCapacity,
      this.config.workgroupSize
    );
    this.createDynamicBuffers(sourceRayCount);
    try {
      await this.initializeInitialPipeline();
      await this.initializeCollector();
    } catch (error) {
      this.destroy();
      throw error;
    }
    this.renderPreparationStage = {
      geometryBuffer: this.geometryBuffer,
      drawIndirectBuffer: this.drawIndirectBuffer,
      geometryCapacity: this.config.maxReadyGeometryRecords,
    };
  }

  createDynamicBuffers(sourceRayCount) {
    const storage = BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_SRC |
      BUFFER_USAGE_COPY_DST;
    this.rayBuffer = this.device.createBuffer({
      label: 'WebGPU megakernel ping-pong rays',
      size: this.rayCapacity * WEBGPU_RAY_STRIDE * 2,
      usage: storage,
    });
    this.membershipBuffer = this.device.createBuffer({
      label: 'WebGPU megakernel ping-pong memberships',
      size: this.rayCapacity * this.membershipStride * 4 * 2,
      usage: storage,
    });
    this.queueBuffer = createMegakernelQueueBuffer(
      this.device,
      this.queueLayout,
      Math.min(sourceRayCount, this.rayCapacity)
    );
    this.dispatchIndirectBuffer = this.device.createBuffer({
      label: 'WebGPU megakernel per-half trace dispatch arguments',
      size: INDIRECT_ARGUMENT_WORDS * 4 * 2,
      usage: BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_DST |
        BUFFER_USAGE_INDIRECT,
    });
    this.detectorResultBuffer = this.device.createBuffer({
      label: 'WebGPU megakernel detector results',
      size: Math.max(8,
        this.preparedScene.packedStorage.counts.detectorResultValues * 8),
      usage: storage,
    });
    const geometryCapacity = this.config.maxReadyGeometryRecords;
    this.geometryBuffer = this.device.createBuffer({
      label: 'WebGPU megakernel ready geometry',
      size: Math.max(1, geometryCapacity) * 64,
      usage: storage,
    });
    this.drawIndirectBuffer = this.device.createBuffer({
      label: 'WebGPU megakernel draw and ray extent arguments',
      size: rayExtentDispatchIndirectOffset(1) + 12,
      usage: BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_DST |
        BUFFER_USAGE_INDIRECT,
    });
    this.device.queue.writeBuffer(
      this.drawIndirectBuffer,
      0,
      // Draw arguments followed by per-half collector extents.
      new Uint32Array([
        6, 0, 0, 0,
        0, 1, 1, 0, 1, 1,
      ])
    );
    this.traceUniformBuffer = createUniformBuffer(
      this.device,
      createTraceUniformData(this.preparedScene.runtimeDescription,
        this.preparedScene.packedStorage.interactionTypeLayout,
        this.rayCapacity),
      'WebGPU megakernel trace uniforms'
    );
    this.megaUniformBuffers = Array.from({ length: 2 }, (_value, direction) =>
      this.device.createBuffer({
        label: `WebGPU megakernel direction ${direction} uniforms`,
        size: 64,
        usage: BUFFER_USAGE_UNIFORM | BUFFER_USAGE_COPY_DST,
      })
    );
    this.renderUniformBuffer = this.device.createBuffer({
      label: 'WebGPU megakernel rendering uniforms',
      size: 16 * 16,
      usage: BUFFER_USAGE_UNIFORM | BUFFER_USAGE_COPY_DST,
    });
  }

  async initializeInitialPipeline() {
    const description = this.preparedScene.runtimeDescription;
    const generated = createMegakernelInitialShader({
      description,
      dagPrograms: this.preparedScene.dagPrograms,
      workgroupSize: this.config.workgroupSize,
      maxBvhDepth: this.config.maxBvhDepth,
    });
    if (!generated.supported) {
      throw new TypeError('Unsupported megakernel membership geometry: ' +
        generated.unsupported.join(', '));
    }
    const module = this.device.createShaderModule({
      label: 'WebGPU source and membership megakernel',
      code: generated.code,
    });
    await validateShaderModule(module, 'source and membership megakernel');
    const bindGroupLayout = this.device.createBindGroupLayout({
      label: 'WebGPU source and membership megakernel layout',
      entries: [
        ...Array.from({ length: 6 }, (_v, binding) =>
          storageLayoutEntry(binding, true)),
        storageLayoutEntry(6),
        storageLayoutEntry(7),
        uniformLayoutEntry(8),
        uniformLayoutEntry(9),
      ],
    });
    this.initialPipeline = await createComputePipeline(this.device, {
      label: 'WebGPU source and membership megakernel',
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      compute: { module, entryPoint: 'initialMain' },
    });
    this.initialMembershipUniformBuffer = createUniformBuffer(
      this.device,
      createMegakernelInitialUniformData(description, this.rayCapacity),
      'WebGPU megakernel initial membership uniforms'
    );
    this.initialConfigBuffer = createUniformBuffer(
      this.device,
      createMegakernelInitialConfigData({
        description,
        rayCapacity: this.rayCapacity,
        membershipStride: this.membershipStride,
        wavelengthRange:
          this.preparedScene.parameterRanges.wavelengthRange[0],
        keepNonVisibleLight: this.preparedScene.keepNonVisibleLight,
      }),
      'WebGPU megakernel initial source uniforms'
    );
    const buffers = this.staticStorage.buffers;
    this.initialBindGroup = this.device.createBindGroup({
      label: 'WebGPU source and membership megakernel bindings',
      layout: this.initialPipeline.getBindGroupLayout(0),
      entries: [
        entry(0, buffers.sourceDescriptors),
        entry(1, buffers.instanceParameters),
        entry(2, buffers.curveDescriptors),
        entry(3, buffers.curveGeometry),
        entry(4, buffers.bvhNodes),
        entry(5, buffers.bvhCurveIds),
        entry(6, this.rayBuffer),
        entry(7, this.membershipBuffer),
        entry(8, this.initialMembershipUniformBuffer),
        entry(9, this.initialConfigBuffer),
      ],
    });
  }

  async initializeCollector() {
    const module = this.device.createShaderModule({
      label: 'WebGPU megakernel stable queue collector',
      code: createMegakernelCollectorShader(
        this.config.workgroupSize,
        this.config.atomicFixedPointScale
      ),
    });
    await validateShaderModule(module, 'megakernel queue collector');
    const bindGroupLayout = this.device.createBindGroupLayout({
      label: 'WebGPU megakernel queue collector layout',
      entries: [
        storageLayoutEntry(0),
        storageLayoutEntry(1),
        uniformLayoutEntry(2),
        storageLayoutEntry(3),
        storageLayoutEntry(4, true),
      ],
    });
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });
    this.collectorPipelines = {
      weight: await createComputePipeline(this.device, {
        label: 'WebGPU megakernel queue weights', layout: pipelineLayout,
        compute: { module, entryPoint: 'weightMain' },
      }),
      prefix: await createComputePipeline(this.device, {
        label: 'WebGPU megakernel queue prefix', layout: pipelineLayout,
        compute: { module, entryPoint: 'prefixMain' },
      }),
      fill: await createComputePipeline(this.device, {
        label: 'WebGPU megakernel queue fill', layout: pipelineLayout,
        compute: { module, entryPoint: 'fillMain' },
      }),
    };
    this.collectorUniformBuffers = Array.from(
      { length: 2 },
      (_value, direction) => createUniformBuffer(
        this.device,
        createMegakernelQueueUniformData(
          this.queueLayout,
          direction,
          direction * this.rayCapacity,
          direction * this.rayCapacity * this.membershipStride,
          this.membershipStride
        ),
        `WebGPU megakernel collector direction ${direction} uniforms`
      )
    );
    this.rebuildCollectorBindGroups();
  }

  rebuildCollectorBindGroups() {
    this.collectorBindGroups = this.collectorUniformBuffers.map(
      (uniformBuffer, direction) => this.device.createBindGroup({
        label: `WebGPU megakernel collector direction ${direction} bindings`,
        layout: this.collectorPipelines.prefix.getBindGroupLayout(0),
        entries: [
          entry(0, this.rayBuffer),
          entry(1, this.queueBuffer),
          entry(2, uniformBuffer),
          entry(3, this.dispatchIndirectBuffer),
          entry(4, this.membershipBuffer),
        ],
      })
    );
  }

  async configureRun(options) {
    this.currentRenderVariant = normalizeRenderVariant(
      options.rendering?.mode
    );
    this.maxRayDepth = normalizeDepth(options.maxRayDepth);
    const rayPowerOptions = getEffectiveRayPowerOptions(options);
    this.device.queue.writeBuffer(
      this.traceUniformBuffer,
      48,
      new Float32Array([Math.fround(rayPowerOptions.rayPowerCutoff)])
    );
    const rayPowerCutoff = Math.fround(rayPowerOptions.rayPowerCutoff);
    const truncateWeakRays = rayPowerOptions.rayPowerSampling ? 0 : 1;
    this.device.queue.writeBuffer(
      this.traceUniformBuffer,
      13 * 4,
      new Uint32Array([truncateWeakRays])
    );
    for (const uniformBuffer of this.collectorUniformBuffers) {
      this.device.queue.writeBuffer(
        uniformBuffer,
        9 * 4,
        new Float32Array([rayPowerCutoff])
      );
      this.device.queue.writeBuffer(
        uniformBuffer,
        10 * 4,
        new Uint32Array([truncateWeakRays])
      );
    }
    this.device.queue.writeBuffer(
      this.renderUniformBuffer,
      0,
      createRenderUniformData(
        options,
        this.renderPreparationStage.geometryCapacity
      )
    );
    const neighborMode = this.currentRenderVariant === 'images' ||
      this.currentRenderVariant === 'observer';
    this.currentPayloadSize = this.config.workgroupSize -
      (neighborMode ? 2 : 0);
    if (this.currentPayloadSize <= 0) {
      throw new RangeError('The tracing workgroup has no productive ray slot.');
    }
    if (!this.preparedScene.packedStorage) {
      this.currentStage = this.megakernelStages.get(this.currentRenderVariant);
      this.device.queue.writeBuffer(
        this.queueBuffer,
        15 * 4,
        new Uint32Array([this.currentPayloadSize])
      );
      this.writeMegakernelUniforms();
      return;
    }
    await this.prepareBatch(
      Math.min(
        this.preparedScene.packedStorage.counts.sourceRays,
        this.rayCapacity
      ),
      0
    );
  }

  async prepareBatch(activeRayCount, direction = 0) {
    const stageKey = this.currentRenderVariant;
    let stage = this.megakernelStages.get(stageKey);
    if (!stage) {
      stage = await this.createMegakernelStage(this.currentRenderVariant);
      this.megakernelStages.set(stageKey, stage);
    }
    this.currentStage = stage;
    this.device.queue.writeBuffer(
      this.queueBuffer,
      15 * 4,
      new Uint32Array([this.currentPayloadSize])
    );
    this.device.queue.writeBuffer(
      this.dispatchIndirectBuffer,
      direction * INDIRECT_ARGUMENT_WORDS * 4,
      new Uint32Array([
        Math.ceil(activeRayCount / this.currentPayloadSize), 1, 1
      ])
    );
    this.writeMegakernelUniforms();
  }

  async createMegakernelStage(renderVariant) {
    const generated = createWebGpuMegakernelShader({
      description: this.preparedScene.runtimeDescription,
      dagPrograms: this.preparedScene.dagPrograms,
      workgroupSize: this.config.workgroupSize,
      maxLocalIterations: this.config.maxLocalIterations,
      atomicFixedPointScale: this.config.atomicFixedPointScale,
      renderVariant,
      maxBvhDepth: this.config.maxBvhDepth,
      // staticStorage owns the immutable packed-field offsets for the life of
      // this backend. A stage may be compiled only after one or more compatible
      // scene uploads, so deriving its struct from the current scene would not
      // necessarily match the buffer it is bound to.
      traceSceneFieldCapacities: this.staticStorage.capacities,
    });
    if (!generated.supported) {
      throw new TypeError('Unsupported megakernel trace geometry: ' +
        generated.unsupported.join(', '));
    }
    const module = this.device.createShaderModule({
      label: `WebGPU ${renderVariant} tracing megakernel`,
      code: generated.code,
    });
    await validateShaderModule(module, `${renderVariant} tracing megakernel`);
    const bindGroupLayout = this.device.createBindGroupLayout({
      label: `WebGPU ${renderVariant} tracing megakernel layout`,
      entries: [
        storageLayoutEntry(0, true),
        ...Array.from({ length: 6 }, (_v, index) =>
          storageLayoutEntry(index + 1)),
        uniformLayoutEntry(7),
        uniformLayoutEntry(8),
        uniformLayoutEntry(9),
      ],
    });
    const pipeline = await createComputePipeline(this.device, {
      label: `WebGPU ${renderVariant} tracing megakernel`,
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      compute: { module, entryPoint: 'megakernelMain' },
    });
    const buffers = this.staticStorage.buffers;
    const bindGroups = this.megaUniformBuffers.map(
      (uniformBuffer, direction) => this.device.createBindGroup({
        label: `WebGPU ${renderVariant} direction ${direction} bindings`,
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          entry(0, buffers.traceScene),
          entry(1, this.rayBuffer),
          entry(2, this.membershipBuffer),
          entry(3, this.queueBuffer),
          entry(4, this.detectorResultBuffer),
          entry(5, this.geometryBuffer),
          entry(6, this.drawIndirectBuffer),
          entry(7, this.traceUniformBuffer),
          entry(8, uniformBuffer),
          entry(9, this.renderUniformBuffer),
        ],
      })
    );
    return {
      pipeline,
      bindGroups,
      code: generated.code,
      maximumOutputs: generated.maximumOutputs,
    };
  }

  writeMegakernelUniforms() {
    const membershipSpan = this.rayCapacity * this.membershipStride;
    for (let direction = 0; direction < 2; direction++) {
      const outputDirection = direction ^ 1;
      this.device.queue.writeBuffer(
        this.megaUniformBuffers[direction],
        0,
        new Uint32Array([
          this.rayCapacity,
          this.queueLayout.activeOffsets[direction],
          direction === 0 ? 0 : 4,
          this.maxRayDepth,
          this.currentStage.maximumOutputs ?? 1,
          this.preparedScene.packedStorage.counts.regions,
          this.regionWordCount,
          this.membershipStride,
          renderVariantId(this.currentRenderVariant),
          this.currentPayloadSize,
          direction * this.rayCapacity,
          outputDirection * this.rayCapacity,
          direction * membershipSpan,
          outputDirection * membershipSpan,
          this.queueLayout.blockOffset,
          RAY_EXTENT_DISPATCH_WORD +
            outputDirection * INDIRECT_ARGUMENT_WORDS,
        ])
      );
    }
  }

  resetRunControl() {
    const count = Math.min(
      this.preparedScene.packedStorage.counts.sourceRays,
      this.rayCapacity
    );
    // Word 21 is a persistent output generation. Do not reset it between
    // compatible scene updates, or stale slots from the preceding frame could
    // look current when the ping-pong index restarts at zero.
    const data = new Uint32Array(21);
    data[0] = count;
    data[1] = this.rayCapacity;
    data[2] = this.config.maxReadyGeometryRecords;
    data[4] = 0;
    data[5] = count;
    data[15] = this.currentPayloadSize;
    this.device.queue.writeBuffer(this.queueBuffer, 0, data);
    this.device.queue.writeBuffer(
      this.queueBuffer,
      22 * 4,
      new Uint32Array(5)
    );
    this.device.queue.writeBuffer(
      this.dispatchIndirectBuffer,
      0,
      new Uint32Array([
        Math.ceil(count / this.currentPayloadSize),
        1,
        1,
        0,
        1,
        1,
      ])
    );
    const active = new Uint32Array(count);
    for (let index = 0; index < count; index++) active[index] = index;
    if (count > 0) {
      this.device.queue.writeBuffer(
        this.queueBuffer,
        this.queueLayout.activeOffset * 4,
        active
      );
    }
  }

  encodeInitial(commandEncoder) {
    commandEncoder.clearBuffer(this.detectorResultBuffer);
    const sourceRayCount = this.preparedScene.packedStorage.counts.sourceRays;
    if (sourceRayCount > 0) {
      const pass = commandEncoder.beginComputePass({
        label: 'WebGPU initial source and membership megakernel',
      });
      pass.setPipeline(this.initialPipeline);
      pass.setBindGroup(0, this.initialBindGroup);
      pass.dispatchWorkgroups(Math.ceil(
        sourceRayCount / this.config.workgroupSize
      ));
      pass.end();
      this.encodePingPongBatch(commandEncoder, 0);
    }
  }

  encodeContinuation(commandEncoder, direction) {
    this.encodePingPongBatch(commandEncoder, direction);
  }

  encodePingPongBatch(commandEncoder, startDirection) {
    for (let offset = 0;
      offset < this.config.maxPingPongsPerSubmission;
      offset++) {
      const direction = (startDirection + offset) & 1;
      this.encodeMegakernel(commandEncoder, direction);
      this.encodeCollector(commandEncoder, direction ^ 1);
    }
  }

  encodeMegakernel(commandEncoder, direction) {
    const outputDirection = direction ^ 1;
    const extentOffset = rayExtentDispatchIndirectOffset(outputDirection);
    commandEncoder.clearBuffer(
      this.drawIndirectBuffer, extentOffset, 4
    );
    commandEncoder.clearBuffer(
      this.queueBuffer, MEGAKERNEL_COLLECTOR_BLOCK_COUNT_WORD * 4, 4
    );
    const pass = commandEncoder.beginComputePass({
      label: `WebGPU ${this.currentRenderVariant} tracing megakernel`,
    });
    pass.setPipeline(this.currentStage.pipeline);
    pass.setBindGroup(0, this.currentStage.bindGroups[direction]);
    pass.dispatchWorkgroupsIndirect(
      this.dispatchIndirectBuffer,
      direction * INDIRECT_ARGUMENT_WORDS * 4
    );
    pass.end();
  }

  encodeCollector(commandEncoder, outputDirection) {
    const bindGroup = this.collectorBindGroups[outputDirection];
    const extentOffset = rayExtentDispatchIndirectOffset(outputDirection);
    let pass = commandEncoder.beginComputePass({
      label: 'WebGPU megakernel ray sampling weights',
    });
    pass.setPipeline(this.collectorPipelines.weight);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroupsIndirect(
      this.drawIndirectBuffer, extentOffset
    );
    pass.end();
    pass = commandEncoder.beginComputePass({
      label: 'WebGPU megakernel active queue prefix',
    });
    pass.setPipeline(this.collectorPipelines.prefix);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
    pass = commandEncoder.beginComputePass({
      label: 'WebGPU megakernel active queue fill',
    });
    pass.setPipeline(this.collectorPipelines.fill);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroupsIndirect(
      this.drawIndirectBuffer, extentOffset
    );
    pass.end();
  }

  encodeReadyGeometryReset(commandEncoder) {
    commandEncoder.clearBuffer(this.queueBuffer, 6 * 4, 4);
    commandEncoder.clearBuffer(this.queueBuffer, 19 * 4, 4);
    commandEncoder.clearBuffer(this.drawIndirectBuffer, 4, 4);
  }

  encodeStateReadback(commandEncoder) {
    const detectorValues =
      this.preparedScene.packedStorage.counts.detectorResultValues;
    const detectorBytes = detectorValues * 8;
    const controlBytes = WEBGPU_MEGAKERNEL_RUN_CONTROL_SIZE;
    const readback = this.device.createBuffer({
      label: 'WebGPU megakernel state readback',
      size: Math.max(4, controlBytes + detectorBytes),
      usage: BUFFER_USAGE_MAP_READ | BUFFER_USAGE_COPY_DST,
    });
    commandEncoder.copyBufferToBuffer(
      this.queueBuffer, 0, readback, 0, controlBytes
    );
    if (detectorBytes > 0) {
      commandEncoder.copyBufferToBuffer(
        this.detectorResultBuffer,
        0,
        readback,
        controlBytes,
        detectorBytes
      );
    }
    return async () => {
      await readback.mapAsync(1);
      const data = readback.getMappedRange().slice(0);
      readback.unmap();
      readback.destroy?.();
      return decodeWebGpuMegakernelRunState(
        data,
        this.preparedScene.runtimeDescription,
        this.config.atomicFixedPointScale
      );
    };
  }

  canUpdatePreparedScene(next) {
    return this.preparedScene.executionPlan.megakernelSignature ===
      next.executionPlan.megakernelSignature &&
      this.staticStorage?.canUpdate(next.packedStorage) &&
      next.packedStorage.counts.sourceRays <= this.rayCapacity;
  }

  updatePreparedScene(next) {
    if (!this.canUpdatePreparedScene(next)) {
      throw new Error('The prepared scene requires megakernel rebuilding.');
    }
    this.staticStorage.update(next.packedStorage);
    this.preparedScene = next;
    this.canEmitAllSources = true;
    this.device.queue.writeBuffer(
      this.traceUniformBuffer,
      0,
      createTraceUniformData(
        next.runtimeDescription,
        next.packedStorage.interactionTypeLayout,
        this.rayCapacity
      )
    );
    this.device.queue.writeBuffer(
      this.initialMembershipUniformBuffer,
      0,
      createMegakernelInitialUniformData(next.runtimeDescription,
        this.rayCapacity)
    );
    this.device.queue.writeBuffer(
      this.initialConfigBuffer,
      0,
      createMegakernelInitialConfigData({
        description: next.runtimeDescription,
        rayCapacity: this.rayCapacity,
        membershipStride: this.membershipStride,
        wavelengthRange: next.parameterRanges.wavelengthRange[0],
        keepNonVisibleLight: next.keepNonVisibleLight,
      })
    );
  }

  destroy() {
    this.staticStorage?.destroy();
    for (const buffer of [
      ...this.megaUniformBuffers,
      ...this.collectorUniformBuffers,
    ]) buffer.destroy?.();
    this.megaUniformBuffers = [];
    this.collectorUniformBuffers = [];
    this.collectorBindGroups = [];
    for (const name of [
      'rayBuffer', 'membershipBuffer', 'queueBuffer',
      'dispatchIndirectBuffer',
      'detectorResultBuffer', 'geometryBuffer', 'drawIndirectBuffer',
      'traceUniformBuffer', 'renderUniformBuffer',
      'initialMembershipUniformBuffer', 'initialConfigBuffer',
    ]) {
      this[name]?.destroy?.();
      this[name] = null;
    }
    this.megakernelStages.clear();
    this.currentStage = null;
    this.initialPipeline = null;
    this.collectorPipelines = null;
  }
}

function createTraceUniformData(
  description,
  layout,
  rayCapacity
) {
  const tolerance = getIntersectionTolerancePolicy(description.numericEpsilon);
  const data = new ArrayBuffer(64);
  const view = new DataView(data);
  view.setUint32(0, Math.min(description.sources.reduce(
    (sum, source) => sum + source.rayCount, 0
  ), rayCapacity), true);
  view.setUint32(4, rayCapacity, true);
  view.setInt32(8, description.bvh.root, true);
  view.setUint32(12, description.curves.length, true);
  view.setUint32(16, description.regions.length, true);
  view.setUint32(20, Math.ceil(description.regions.length / 32), true);
  view.setUint32(24, layout.surfaceTypeOffset, true);
  view.setUint32(28, layout.detectorTypeOffset, true);
  view.setFloat32(32, Math.fround(
    description.numericalTolerances?.forwardDistance ?? 0
  ), true);
  view.setFloat32(36, Math.fround(
    description.numericalTolerances?.interactionMerging ?? 0
  ), true);
  const normal = Math.min(Math.PI, Math.max(
    description.numericalTolerances?.interactionNormal ?? 0,
    tolerance.interactionNormal
  ));
  view.setFloat32(40, Math.fround(4 * Math.sin(normal * 0.5) ** 2), true);
  view.setFloat32(44, Math.fround(tolerance.mergingDistance), true);
  return data;
}

function normalizeRenderVariant(mode) {
  if (mode === 'none') return mode;
  if (mode === 'extended' || mode === 'images' || mode === 'observer') {
    return mode;
  }
  return 'rays';
}

function renderVariantId(mode) {
  if (mode === 'none') return 4;
  if (mode === 'extended') return 1;
  if (mode === 'images') return 2;
  if (mode === 'observer') return 3;
  return 0;
}

function normalizeDepth(value) {
  if (!Number.isFinite(value)) return 0x1fffffff;
  return Math.min(0x1fffffff, Math.max(0, Math.floor(value)));
}

function entry(binding, buffer) {
  return { binding, resource: { buffer } };
}

function storageLayoutEntry(binding, readOnly = false) {
  return {
    binding,
    visibility: 0x0004,
    buffer: { type: readOnly ? 'read-only-storage' : 'storage' },
  };
}

function uniformLayoutEntry(binding) {
  return {
    binding,
    visibility: 0x0004,
    buffer: { type: 'uniform' },
  };
}

function createComputePipeline(device, descriptor) {
  return device.createComputePipelineAsync
    ? device.createComputePipelineAsync(descriptor)
    : Promise.resolve(device.createComputePipeline(descriptor));
}

async function validateShaderModule(module, label) {
  if (!module.getCompilationInfo) return;
  const info = await module.getCompilationInfo();
  const errors = info.messages.filter(message => message.type === 'error');
  if (errors.length === 0) return;
  throw new Error('WebGPU shader compilation failed:\n' + errors.map(
    message => `${label}:${message.lineNum ?? 0}:${message.linePos ?? 0} ` +
      message.message
  ).join('\n'));
}
