/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { WEBGPU_RAY_STRIDE } from './webGpuExecutionPlan.js';

const BUFFER_USAGE_COPY_SRC = 0x0004;
const BUFFER_USAGE_COPY_DST = 0x0008;
const BUFFER_USAGE_UNIFORM = 0x0040;
const BUFFER_USAGE_STORAGE = 0x0080;
const SHADER_STAGE_COMPUTE = 0x0004;

/**
 * Destination buffers and typed outgoing compute passes for one ping-pong.
 * GRIN is implemented first; region, surface and detector pipelines share the
 * same slot-major destination and membership layout.
 */
export class WebGpuOutgoingStage {
  constructor(device, {
    description,
    dagPrograms,
    staticStorage,
    rayBuffer,
    membershipBuffer,
    hitBuffer,
    crossingBuffer,
    interactionBuffers,
    rayCapacity,
    workgroupSize,
  }) {
    this.device = device;
    this.description = description;
    this.dagPrograms = dagPrograms;
    this.staticStorage = staticStorage;
    this.rayBuffer = rayBuffer;
    this.membershipBuffer = membershipBuffer;
    this.hitBuffer = hitBuffer;
    this.crossingBuffer = crossingBuffer;
    this.interactionBuffers = interactionBuffers;
    this.rayCapacity = rayCapacity;
    this.workgroupSize = workgroupSize;
    this.regionWordCount = Math.ceil(description.regions.length / 32);
    this.rayNextBuffer = null;
    this.membershipNextBuffer = null;
    this.uniformBuffer = null;
    this.grinPipeline = null;
    this.grinBindGroup = null;
    this.grinReverseBindGroup = null;
    this.boundaryPipelines = [];
    this.boundaryBindGroup = null;
    this.boundaryReverseBindGroup = null;
    this.surfaceStages = [];
    this.surfaceBindGroups = new Map();
    this.surfaceReverseBindGroups = new Map();
    this.detectorStages = [];
    this.detectorBindGroup = null;
    this.detectorReverseBindGroup = null;
    this.detectorResultBuffer = null;
  }

  async initialize() {
    this.rayNextBuffer = this.device.createBuffer({
      label: 'WebGPU outgoing rays',
      size: this.rayCapacity * WEBGPU_RAY_STRIDE,
      usage: BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_SRC |
        BUFFER_USAGE_COPY_DST,
    });
    this.membershipNextBuffer = this.device.createBuffer({
      label: 'WebGPU outgoing region membership',
      size: this.rayCapacity * Math.max(1, this.regionWordCount) * 4,
      usage: BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_SRC |
        BUFFER_USAGE_COPY_DST,
    });
    this.uniformBuffer = createInitializedBuffer(
      this.device,
      new Uint32Array([
        this.rayCapacity,
        this.description.regions.length,
        this.regionWordCount,
        0,
      ]),
      BUFFER_USAGE_UNIFORM | BUFFER_USAGE_COPY_DST,
      'WebGPU outgoing uniforms'
    );
    this.detectorResultBuffer = this.device.createBuffer({
      label: 'WebGPU fixed-point detector results',
      size: Math.max(8, detectorResultValueCount(this.description) * 8),
      usage: BUFFER_USAGE_STORAGE | BUFFER_USAGE_COPY_SRC |
        BUFFER_USAGE_COPY_DST,
    });
    if (this.description.regions.length === 0) {
      await this.initializeSurfaces();
      await this.initializeDetectors();
      return;
    }

    const code = createWebGpuGrinOutgoingShader({
      description: this.description,
      dagPrograms: this.dagPrograms,
      workgroupSize: this.workgroupSize,
    });
    this.device.pushErrorScope?.('validation');
    try {
      const module = this.device.createShaderModule({
        label: 'WebGPU GRIN outgoing rays', code,
      });
      await validateShaderModule(module, 'GRIN outgoing rays');
      const bindGroupLayout = this.device.createBindGroupLayout({
        label: 'WebGPU GRIN outgoing layout',
        entries: [
          readOnlyStorageLayoutEntry(0),
          readOnlyStorageLayoutEntry(1),
          readOnlyStorageLayoutEntry(2),
          readOnlyStorageLayoutEntry(3),
          readOnlyStorageLayoutEntry(4),
          storageLayoutEntry(5),
          readOnlyStorageLayoutEntry(6),
          storageLayoutEntry(7),
          storageLayoutEntry(8),
          storageLayoutEntry(9),
          uniformLayoutEntry(10),
        ],
      });
      const descriptor = {
        label: 'WebGPU GRIN outgoing rays',
        layout: this.device.createPipelineLayout({
          label: 'WebGPU GRIN outgoing pipeline layout',
          bindGroupLayouts: [bindGroupLayout],
        }),
        compute: { module, entryPoint: 'grinOutgoingMain' },
      };
      this.grinPipeline = this.device.createComputePipelineAsync
        ? await this.device.createComputePipelineAsync(descriptor)
        : this.device.createComputePipeline(descriptor);
      const staticBuffers = this.staticStorage.buffers;
      const dynamic = this.interactionBuffers;
      this.grinBindGroup = this.device.createBindGroup({
        label: 'WebGPU GRIN outgoing bindings',
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.rayBuffer } },
          { binding: 1, resource: { buffer: this.hitBuffer } },
          { binding: 2, resource: { buffer: this.membershipBuffer } },
          { binding: 3, resource: { buffer: staticBuffers.regionDescriptors } },
          { binding: 4, resource: { buffer: staticBuffers.instanceParameters } },
          { binding: 5, resource: { buffer: dynamic.interactionTypeStates } },
          { binding: 6, resource: { buffer: dynamic.interactionRayIndices } },
          { binding: 7, resource: { buffer: dynamic.runControl } },
          { binding: 8, resource: { buffer: this.rayNextBuffer } },
          { binding: 9, resource: { buffer: this.membershipNextBuffer } },
          { binding: 10, resource: { buffer: this.uniformBuffer } },
        ],
      });
    } finally {
      const validationError = await this.device.popErrorScope?.();
      if (validationError) throw validationError;
    }
    await this.initializeRegionBoundary();
    await this.initializeSurfaces();
    await this.initializeDetectors();
  }

  async initializeRegionBoundary() {
    const code = createWebGpuRegionBoundaryOutgoingShader({
      description: this.description,
      dagPrograms: this.dagPrograms,
      workgroupSize: this.workgroupSize,
    });
    this.device.pushErrorScope?.('validation');
    try {
      const module = this.device.createShaderModule({
        label: 'WebGPU region-boundary outgoing rays', code,
      });
      await validateShaderModule(module, 'region-boundary outgoing rays');
      const bindGroupLayout = this.device.createBindGroupLayout({
        label: 'WebGPU region-boundary outgoing layout',
        entries: [
          readOnlyStorageLayoutEntry(0),
          readOnlyStorageLayoutEntry(1),
          readOnlyStorageLayoutEntry(2),
          readOnlyStorageLayoutEntry(3),
          readOnlyStorageLayoutEntry(4),
          readOnlyStorageLayoutEntry(5),
          storageLayoutEntry(6),
          readOnlyStorageLayoutEntry(7),
          storageLayoutEntry(8),
          storageLayoutEntry(9),
          storageLayoutEntry(10),
          uniformLayoutEntry(11),
        ],
      });
      const pipelineLayout = this.device.createPipelineLayout({
        label: 'WebGPU region-boundary outgoing pipeline layout',
        bindGroupLayouts: [bindGroupLayout],
      });
      const boundaryVariants = [
        ['regionBoundaryNoReflectionMain', false],
        ['regionBoundaryPartialReflectionMain', true],
      ].filter(([_entryPoint, partialReflect]) =>
        this.description.regions.some(
          region => region.partialReflect === partialReflect
        )
      );
      this.boundaryPipelines = await Promise.all(
        boundaryVariants.map(async ([entryPoint, partialReflect]) => {
        const descriptor = {
          label: `WebGPU region boundary ${partialReflect
            ? 'with' : 'without'} partial reflection`,
          layout: pipelineLayout,
          compute: { module, entryPoint },
        };
        const pipeline = this.device.createComputePipelineAsync
          ? await this.device.createComputePipelineAsync(descriptor)
          : this.device.createComputePipeline(descriptor);
        return { pipeline, partialReflect };
        })
      );
      const staticBuffers = this.staticStorage.buffers;
      const dynamic = this.interactionBuffers;
      this.boundaryBindGroup = this.device.createBindGroup({
        label: 'WebGPU region-boundary outgoing bindings',
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: this.rayBuffer } },
          { binding: 1, resource: { buffer: this.hitBuffer } },
          { binding: 2, resource: { buffer: this.membershipBuffer } },
          { binding: 3, resource: { buffer: this.crossingBuffer } },
          { binding: 4, resource: { buffer: staticBuffers.regionDescriptors } },
          { binding: 5, resource: { buffer: staticBuffers.instanceParameters } },
          { binding: 6, resource: { buffer: dynamic.interactionTypeStates } },
          { binding: 7, resource: { buffer: dynamic.interactionRayIndices } },
          { binding: 8, resource: { buffer: dynamic.runControl } },
          { binding: 9, resource: { buffer: this.rayNextBuffer } },
          { binding: 10, resource: { buffer: this.membershipNextBuffer } },
          { binding: 11, resource: { buffer: this.uniformBuffer } },
        ],
      });
    } finally {
      const validationError = await this.device.popErrorScope?.();
      if (validationError) throw validationError;
    }
  }

  async initializeSurfaces() {
    if (this.description.types.surfaces.length === 0) return;
    const layouts = new Map();
    const getLayout = needsBulk => {
      if (layouts.has(needsBulk)) return layouts.get(needsBulk);
      const entries = [
        readOnlyStorageLayoutEntry(0),
        readOnlyStorageLayoutEntry(1),
        readOnlyStorageLayoutEntry(2),
        readOnlyStorageLayoutEntry(3),
        readOnlyStorageLayoutEntry(4),
        readOnlyStorageLayoutEntry(5),
        readOnlyStorageLayoutEntry(6),
        readOnlyStorageLayoutEntry(7),
        storageLayoutEntry(8),
        readOnlyStorageLayoutEntry(9),
        storageLayoutEntry(10),
        storageLayoutEntry(11),
        storageLayoutEntry(12),
        uniformLayoutEntry(13),
      ];
      if (needsBulk) entries.push(readOnlyStorageLayoutEntry(14));
      const bindGroupLayout = this.device.createBindGroupLayout({
        label: `WebGPU surface outgoing ${needsBulk
          ? 'with bulk indices' : 'without bulk indices'} layout`,
        entries,
      });
      const value = {
        bindGroupLayout,
        pipelineLayout: this.device.createPipelineLayout({
          label: `WebGPU surface outgoing ${needsBulk
            ? 'with bulk indices' : 'without bulk indices'} pipeline layout`,
          bindGroupLayouts: [bindGroupLayout],
        }),
      };
      layouts.set(needsBulk, value);
      return value;
    };

    this.device.pushErrorScope?.('validation');
    try {
      for (let typeId = 0;
        typeId < this.description.types.surfaces.length;
        typeId++) {
        const generated = createWebGpuSurfaceOutgoingShader({
          description: this.description,
          dagPrograms: this.dagPrograms,
          typeId,
          surfaceTypeOffset: 3,
          workgroupSize: this.workgroupSize,
        });
        const module = this.device.createShaderModule({
          label: `WebGPU surface type ${typeId} outgoing`,
          code: generated.code,
        });
        await validateShaderModule(module, `surface type ${typeId} outgoing`);
        const layout = getLayout(generated.needsBulk);
        const descriptor = {
          label: `WebGPU surface type ${typeId} outgoing`,
          layout: layout.pipelineLayout,
          compute: { module, entryPoint: 'surfaceOutgoingMain' },
        };
        const pipeline = this.device.createComputePipelineAsync
          ? await this.device.createComputePipelineAsync(descriptor)
          : this.device.createComputePipeline(descriptor);
        this.surfaceStages.push({
          typeId,
          needsBulk: generated.needsBulk,
          pipeline,
        });
      }
      const staticBuffers = this.staticStorage.buffers;
      const dynamic = this.interactionBuffers;
      for (const [needsBulk, { bindGroupLayout }] of layouts) {
        const entries = [
          { binding: 0, resource: { buffer: this.rayBuffer } },
          { binding: 1, resource: { buffer: this.hitBuffer } },
          { binding: 2, resource: { buffer: this.membershipBuffer } },
          { binding: 3, resource: { buffer: this.crossingBuffer } },
          { binding: 4, resource: { buffer: staticBuffers.curveDescriptors } },
          { binding: 5, resource: { buffer: staticBuffers.curveGeometry } },
          { binding: 6, resource: { buffer: staticBuffers.surfaceDescriptors } },
          { binding: 7, resource: { buffer: staticBuffers.instanceParameters } },
          { binding: 8, resource: { buffer: dynamic.interactionTypeStates } },
          { binding: 9, resource: { buffer: dynamic.interactionRayIndices } },
          { binding: 10, resource: { buffer: dynamic.runControl } },
          { binding: 11, resource: { buffer: this.rayNextBuffer } },
          { binding: 12, resource: { buffer: this.membershipNextBuffer } },
          { binding: 13, resource: { buffer: this.uniformBuffer } },
        ];
        if (needsBulk) {
          entries.push({
            binding: 14,
            resource: { buffer: staticBuffers.regionDescriptors },
          });
        }
        this.surfaceBindGroups.set(needsBulk, this.device.createBindGroup({
          label: `WebGPU surface outgoing ${needsBulk
            ? 'with' : 'without'} bulk bindings`,
          layout: bindGroupLayout,
          entries,
        }));
      }
    } finally {
      const validationError = await this.device.popErrorScope?.();
      if (validationError) throw validationError;
    }
  }

  async initializeDetectors() {
    if (this.description.types.detectors.length === 0) return;
    const layout = this.device.createBindGroupLayout({
      label: 'WebGPU detector outgoing layout',
      entries: [
        readOnlyStorageLayoutEntry(0), readOnlyStorageLayoutEntry(1),
        readOnlyStorageLayoutEntry(2), readOnlyStorageLayoutEntry(3),
        readOnlyStorageLayoutEntry(4), readOnlyStorageLayoutEntry(5),
        storageLayoutEntry(6), readOnlyStorageLayoutEntry(7),
        storageLayoutEntry(8), storageLayoutEntry(9),
        storageLayoutEntry(10), storageLayoutEntry(11),
        uniformLayoutEntry(12),
      ],
    });
    const pipelineLayout = this.device.createPipelineLayout({
      label: 'WebGPU detector outgoing pipeline layout',
      bindGroupLayouts: [layout],
    });
    this.device.pushErrorScope?.('validation');
    try {
      for (let typeId = 0;
        typeId < this.description.types.detectors.length; typeId++) {
        const code = createWebGpuDetectorOutgoingShader({
          description: this.description,
          dagPrograms: this.dagPrograms,
          typeId,
          workgroupSize: this.workgroupSize,
        });
        const module = this.device.createShaderModule({
          label: `WebGPU detector type ${typeId} outgoing`, code,
        });
        await validateShaderModule(module, `detector type ${typeId} outgoing`);
        const descriptor = {
          label: `WebGPU detector type ${typeId} outgoing`,
          layout: pipelineLayout,
          compute: { module, entryPoint: 'detectorOutgoingMain' },
        };
        const pipeline = this.device.createComputePipelineAsync
          ? await this.device.createComputePipelineAsync(descriptor)
          : this.device.createComputePipeline(descriptor);
        this.detectorStages.push({ typeId, pipeline });
      }
      const staticBuffers = this.staticStorage.buffers;
      const dynamic = this.interactionBuffers;
      this.detectorBindGroup = this.device.createBindGroup({
        label: 'WebGPU detector outgoing bindings', layout,
        entries: [
          { binding: 0, resource: { buffer: this.rayBuffer } },
          { binding: 1, resource: { buffer: this.hitBuffer } },
          { binding: 2, resource: { buffer: this.membershipBuffer } },
          { binding: 3, resource: { buffer: staticBuffers.curveDescriptors } },
          { binding: 4, resource: { buffer: staticBuffers.detectorDescriptors } },
          { binding: 5, resource: { buffer: staticBuffers.instanceParameters } },
          { binding: 6, resource: { buffer: dynamic.interactionTypeStates } },
          { binding: 7, resource: { buffer: dynamic.interactionRayIndices } },
          { binding: 8, resource: { buffer: dynamic.runControl } },
          { binding: 9, resource: { buffer: this.rayNextBuffer } },
          { binding: 10, resource: { buffer: this.membershipNextBuffer } },
          { binding: 11, resource: { buffer: this.detectorResultBuffer } },
          { binding: 12, resource: { buffer: this.uniformBuffer } },
        ],
      });
    } finally {
      const validationError = await this.device.popErrorScope?.();
      if (validationError) throw validationError;
    }
  }

  setReverseDirectionBindings() {
    const staticBuffers = this.staticStorage.buffers;
    const dynamic = this.interactionBuffers;
    const inputRays = this.rayNextBuffer;
    const inputMemberships = this.membershipNextBuffer;
    const outputRays = this.rayBuffer;
    const outputMemberships = this.membershipBuffer;
    if (this.grinPipeline) {
      this.grinReverseBindGroup = this.device.createBindGroup({
        label: 'WebGPU GRIN outgoing reverse bindings',
        layout: this.grinPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: inputRays } },
          { binding: 1, resource: { buffer: this.hitBuffer } },
          { binding: 2, resource: { buffer: inputMemberships } },
          { binding: 3, resource: { buffer: staticBuffers.regionDescriptors } },
          { binding: 4, resource: { buffer: staticBuffers.instanceParameters } },
          { binding: 5, resource: { buffer: dynamic.interactionTypeStates } },
          { binding: 6, resource: { buffer: dynamic.interactionRayIndices } },
          { binding: 7, resource: { buffer: dynamic.runControl } },
          { binding: 8, resource: { buffer: outputRays } },
          { binding: 9, resource: { buffer: outputMemberships } },
          { binding: 10, resource: { buffer: this.uniformBuffer } },
        ],
      });
    }
    if (this.boundaryPipelines.length > 0) {
      this.boundaryReverseBindGroup = this.device.createBindGroup({
        label: 'WebGPU region-boundary outgoing reverse bindings',
        layout: this.boundaryPipelines[0].pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: inputRays } },
          { binding: 1, resource: { buffer: this.hitBuffer } },
          { binding: 2, resource: { buffer: inputMemberships } },
          { binding: 3, resource: { buffer: this.crossingBuffer } },
          { binding: 4, resource: { buffer: staticBuffers.regionDescriptors } },
          { binding: 5, resource: { buffer: staticBuffers.instanceParameters } },
          { binding: 6, resource: { buffer: dynamic.interactionTypeStates } },
          { binding: 7, resource: { buffer: dynamic.interactionRayIndices } },
          { binding: 8, resource: { buffer: dynamic.runControl } },
          { binding: 9, resource: { buffer: outputRays } },
          { binding: 10, resource: { buffer: outputMemberships } },
          { binding: 11, resource: { buffer: this.uniformBuffer } },
        ],
      });
    }
    for (const needsBulk of new Set(
      this.surfaceStages.map(stage => stage.needsBulk)
    )) {
      const stage = this.surfaceStages.find(
        candidate => candidate.needsBulk === needsBulk
      );
      const entries = [
        { binding: 0, resource: { buffer: inputRays } },
        { binding: 1, resource: { buffer: this.hitBuffer } },
        { binding: 2, resource: { buffer: inputMemberships } },
        { binding: 3, resource: { buffer: this.crossingBuffer } },
        { binding: 4, resource: { buffer: staticBuffers.curveDescriptors } },
        { binding: 5, resource: { buffer: staticBuffers.curveGeometry } },
        { binding: 6, resource: { buffer: staticBuffers.surfaceDescriptors } },
        { binding: 7, resource: { buffer: staticBuffers.instanceParameters } },
        { binding: 8, resource: { buffer: dynamic.interactionTypeStates } },
        { binding: 9, resource: { buffer: dynamic.interactionRayIndices } },
        { binding: 10, resource: { buffer: dynamic.runControl } },
        { binding: 11, resource: { buffer: outputRays } },
        { binding: 12, resource: { buffer: outputMemberships } },
        { binding: 13, resource: { buffer: this.uniformBuffer } },
      ];
      if (needsBulk) {
        entries.push({
          binding: 14,
          resource: { buffer: staticBuffers.regionDescriptors },
        });
      }
      this.surfaceReverseBindGroups.set(needsBulk,
        this.device.createBindGroup({
          label: `WebGPU surface outgoing reverse ${needsBulk
            ? 'with' : 'without'} bulk bindings`,
          layout: stage.pipeline.getBindGroupLayout(0),
          entries,
        })
      );
    }
    if (this.detectorStages.length > 0) {
      this.detectorReverseBindGroup = this.device.createBindGroup({
        label: 'WebGPU detector outgoing reverse bindings',
        layout: this.detectorStages[0].pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: inputRays } },
          { binding: 1, resource: { buffer: this.hitBuffer } },
          { binding: 2, resource: { buffer: inputMemberships } },
          { binding: 3, resource: { buffer: staticBuffers.curveDescriptors } },
          { binding: 4, resource: { buffer: staticBuffers.detectorDescriptors } },
          { binding: 5, resource: { buffer: staticBuffers.instanceParameters } },
          { binding: 6, resource: { buffer: dynamic.interactionTypeStates } },
          { binding: 7, resource: { buffer: dynamic.interactionRayIndices } },
          { binding: 8, resource: { buffer: dynamic.runControl } },
          { binding: 9, resource: { buffer: outputRays } },
          { binding: 10, resource: { buffer: outputMemberships } },
          { binding: 11, resource: { buffer: this.detectorResultBuffer } },
          { binding: 12, resource: { buffer: this.uniformBuffer } },
        ],
      });
    }
  }

  encode(commandEncoder, direction = 0) {
    if (!this.grinPipeline && this.boundaryPipelines.length === 0 &&
        this.surfaceStages.length === 0 && this.detectorStages.length === 0) return;
    const pass = commandEncoder.beginComputePass({
      label: 'WebGPU typed outgoing rays',
    });
    const dispatch = () => pass.dispatchWorkgroupsIndirect(
      this.interactionBuffers.dispatchIndirect, 0
    );
    if (this.grinPipeline) {
      pass.setPipeline(this.grinPipeline);
      pass.setBindGroup(0, direction === 0
        ? this.grinBindGroup
        : this.grinReverseBindGroup);
      dispatch();
    }
    for (const { pipeline } of this.boundaryPipelines) {
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, direction === 0
        ? this.boundaryBindGroup
        : this.boundaryReverseBindGroup);
      dispatch();
    }
    for (const stage of this.surfaceStages) {
      pass.setPipeline(stage.pipeline);
      pass.setBindGroup(0, (direction === 0
        ? this.surfaceBindGroups
        : this.surfaceReverseBindGroups).get(stage.needsBulk));
      dispatch();
    }
    for (const stage of this.detectorStages) {
      pass.setPipeline(stage.pipeline);
      pass.setBindGroup(0, direction === 0
        ? this.detectorBindGroup
        : this.detectorReverseBindGroup);
      dispatch();
    }
    pass.end();
  }

  destroy() {
    this.rayNextBuffer?.destroy?.();
    this.membershipNextBuffer?.destroy?.();
    this.uniformBuffer?.destroy?.();
    this.detectorResultBuffer?.destroy?.();
    this.rayNextBuffer = null;
    this.membershipNextBuffer = null;
    this.uniformBuffer = null;
    this.detectorResultBuffer = null;
    this.grinPipeline = null;
    this.grinBindGroup = null;
    this.grinReverseBindGroup = null;
    this.boundaryPipelines.length = 0;
    this.boundaryBindGroup = null;
    this.boundaryReverseBindGroup = null;
    this.surfaceStages.length = 0;
    this.surfaceBindGroups.clear();
    this.surfaceReverseBindGroups.clear();
    this.detectorStages.length = 0;
    this.detectorBindGroup = null;
    this.detectorReverseBindGroup = null;
  }
}

export function createWebGpuGrinOutgoingShader({
  description,
  dagPrograms,
  workgroupSize,
}) {
  const programs = dagPrograms.bulks.map(value => value.grin);
  const cases = programs.map((program, typeId) => {
    const definition = description.types.bulks[typeId].definition;
    const argumentsCode = program.parameters.map(name => {
      if (name === 'x') return 'point.x';
      if (name === 'y') return 'point.y';
      if (name === 'lambda') return 'wavelength';
      const parameterIndex = definition.paramNames.indexOf(name);
      if (parameterIndex < 0) {
        throw new Error(
          `Bulk type ${typeId} has no packed parameter ${JSON.stringify(name)}.`
        );
      }
      return `instanceParameters[region.parameterOffset + ` +
        `${parameterIndex}u]`;
    });
    const call = argumentsCode.length === 0
      ? `${program.functionName}()`
      : `${program.functionName}(array<f32, ${argumentsCode.length}>(` +
        `${argumentsCode.join(', ')}))`;
    const labelIndex = new Map(
      program.labels.map((label, index) => [label, index])
    );
    const output = label => labelIndex.has(label)
      ? `evaluated[${labelIndex.get(label)}u]`
      : 'W(0.0, false)';
    return `case ${typeId}u: {
      let evaluated=${call};
      let n=${output('n')}; let alpha=${output('alpha')};
      let nX=${output('n_x')}; let nY=${output('n_y')};
      return BulkResult(n.value,nX.value,nY.value,alpha.value,
        n.invalid||nX.invalid||nY.invalid||alpha.invalid);
    }`;
  });
  const programCode = programs.map(program => program.code).join('\n');

  return `${dagPrograms.runtimeCode}\n${programCode}\n
struct Ray { origin:vec2f, direction:vec2f, powers:vec2f,
  wavelength:f32, flags:u32 };
struct Hit { s:f32, u:f32, normal:vec2f, curveId:i32, sigma:f32,
  conflict:u32, interactionType:u32 };
struct RegionDescriptor { typeId:u32, parameterOffset:u32, parameterCount:u32,
  flags:u32, stepSize:f32, padding0:u32, padding1:u32, padding2:u32 };
struct InteractionTypeState { interactionCount:u32, sourceIndexStart:u32,
  destinationRayStart:u32, reserved:u32 };
struct OutgoingUniforms { rayCapacity:u32, regionCount:u32,
  regionWordCount:u32, padding:u32 };
struct BulkResult { n:f32, nX:f32, nY:f32, alpha:f32, invalid:bool };

@group(0) @binding(0) var<storage,read> rays:array<Ray>;
@group(0) @binding(1) var<storage,read> hits:array<Hit>;
@group(0) @binding(2) var<storage,read> memberships:array<u32>;
@group(0) @binding(3) var<storage,read> regions:array<RegionDescriptor>;
@group(0) @binding(4) var<storage,read> instanceParameters:array<f32>;
@group(0) @binding(5) var<storage,read_write>
  typeStates:array<InteractionTypeState>;
@group(0) @binding(6) var<storage,read> interactionRayIndices:array<u32>;
@group(0) @binding(7) var<storage,read_write> runControl:array<atomic<u32>>;
@group(0) @binding(8) var<storage,read_write> raysNext:array<Ray>;
@group(0) @binding(9) var<storage,read_write> membershipsNext:array<u32>;
@group(0) @binding(10) var<uniform> outgoingUniforms:OutgoingUniforms;

fn finiteNumber(value:f32)->bool {
  return value==value && abs(value)<=F32_MAX;
}
fn evaluateBulk(
  region:RegionDescriptor,point:vec2f,wavelength:f32
)->BulkResult {
  switch region.typeId { ${cases.join('\n')} default:{
    return BulkResult(0.0,0.0,0.0,0.0,true);
  } }
}
fn evaluateEffectiveGrin(
  rayIndex:u32,point:vec2f,wavelength:f32
)->BulkResult {
  var medium=BulkResult(1.0,0.0,0.0,0.0,false);
  let membershipBase=rayIndex*outgoingUniforms.regionWordCount;
  for (var regionId=0u;regionId<outgoingUniforms.regionCount;regionId++) {
    var isMember=(memberships[membershipBase+(regionId>>5u)]&
      (1u<<(regionId&31u)))!=0u;
    if (!isMember) { continue; }
    let evaluated=evaluateBulk(regions[regionId],point,wavelength);
    let previousN=medium.n;
    let nextNX=medium.nX*evaluated.n+previousN*evaluated.nX;
    let nextNY=medium.nY*evaluated.n+previousN*evaluated.nY;
    let nextN=previousN*evaluated.n;
    let nextAlpha=medium.alpha+evaluated.alpha;
    medium=BulkResult(nextN,nextNX,nextNY,nextAlpha,
      medium.invalid||evaluated.invalid||!finiteNumber(nextN)||
      !finiteNumber(nextNX)||!finiteNumber(nextNY)||
      !finiteNumber(nextAlpha));
  }
  return medium;
}
fn copyMembership(sourceRayIndex:u32,destinationRayIndex:u32) {
  let sourceBase=sourceRayIndex*outgoingUniforms.regionWordCount;
  let destinationBase=destinationRayIndex*outgoingUniforms.regionWordCount;
  for (var wordIndex=0u;wordIndex<outgoingUniforms.regionWordCount;wordIndex++) {
    membershipsNext[destinationBase+wordIndex]=memberships[sourceBase+wordIndex];
  }
}
fn writeInactive(
  source:Ray,point:vec2f,destinationRayIndex:u32,groupStart:bool
) {
  raysNext[destinationRayIndex]=Ray(
    point,vec2f(0.0),vec2f(0.0),source.wavelength,
    2u|select(0u,4u,groupStart)
  );
}

@compute @workgroup_size(${workgroupSize})
fn grinOutgoingMain(@builtin(global_invocation_id) invocation:vec3u) {
  if (atomicLoad(&runControl[8])!=0u) { return; }
  let localIndex=invocation.x;
  if (localIndex>=typeStates[0].interactionCount) { return; }
  let sourceRayIndex=interactionRayIndices[
    typeStates[0].sourceIndexStart+localIndex];
  let destinationRayIndex=typeStates[0].destinationRayStart+localIndex;
  if (sourceRayIndex>=outgoingUniforms.rayCapacity ||
      destinationRayIndex>=outgoingUniforms.rayCapacity) { return; }
  let source=rays[sourceRayIndex]; let hit=hits[sourceRayIndex];
  let point=source.origin+hit.s*source.direction;
  copyMembership(sourceRayIndex,destinationRayIndex);
  let medium=evaluateEffectiveGrin(sourceRayIndex,point,source.wavelength);
  let directionProduct=source.direction.x*source.direction.y;
  let stepped=source.direction+hit.s*vec2f(
    medium.nX*(1.0-source.direction.x*source.direction.x)-
      medium.nY*directionProduct,
    medium.nY*(1.0-source.direction.y*source.direction.y)-
      medium.nX*directionProduct)/medium.n;
  let steppedLength=length(stepped);
  let absorption=exp(-medium.alpha*hit.s);
  let powers=source.powers*absorption;
  let invalid=medium.invalid||!finiteNumber(point.x)||!finiteNumber(point.y)||
    !finiteNumber(stepped.x)||!finiteNumber(stepped.y)||
    !(steppedLength>0.0)||!finiteNumber(steppedLength)||
    !finiteNumber(powers.x)||!finiteNumber(powers.y)||
    powers.x<0.0||powers.y<0.0;
  if (invalid) {
    writeInactive(source,point,destinationRayIndex,localIndex==0u); return;
  }
  let isActive=powers.x!=0.0||powers.y!=0.0;
  raysNext[destinationRayIndex]=Ray(
    point,stepped/steppedLength,powers,source.wavelength,
    select(0u,1u,isActive)|select(0u,4u,localIndex==0u)
  );
}`;
}

export function createWebGpuRegionBoundaryOutgoingShader({
  description,
  dagPrograms,
  workgroupSize,
}) {
  const programs = dagPrograms.bulks.map(value => value.nOnly);
  const cases = programs.map((program, typeId) => {
    const definition = description.types.bulks[typeId].definition;
    const argumentsCode = program.parameters.map(name => {
      if (name === 'x') return 'point.x';
      if (name === 'y') return 'point.y';
      if (name === 'lambda') return 'wavelength';
      const parameterIndex = definition.paramNames.indexOf(name);
      if (parameterIndex < 0) {
        throw new Error(
          `Bulk type ${typeId} has no packed parameter ${JSON.stringify(name)}.`
        );
      }
      return `instanceParameters[region.parameterOffset + ` +
        `${parameterIndex}u]`;
    });
    const call = argumentsCode.length === 0
      ? `${program.functionName}()`
      : `${program.functionName}(array<f32, ${argumentsCode.length}>(` +
        `${argumentsCode.join(', ')}))`;
    return `case ${typeId}u: {
      let evaluated=${call};
      return IndexResult(evaluated[0].value,evaluated[0].invalid);
    }`;
  });
  const programCode = programs.map(program => program.code).join('\n');

  return `${dagPrograms.runtimeCode}\n${programCode}\n
struct Ray { origin:vec2f, direction:vec2f, powers:vec2f,
  wavelength:f32, flags:u32 };
struct Hit { s:f32, u:f32, normal:vec2f, curveId:i32, sigma:f32,
  conflict:u32, interactionType:u32 };
struct RegionDescriptor { typeId:u32, parameterOffset:u32, parameterCount:u32,
  flags:u32, stepSize:f32, padding0:u32, padding1:u32, padding2:u32 };
struct InteractionTypeState { interactionCount:u32, sourceIndexStart:u32,
  destinationRayStart:u32, reserved:u32 };
struct OutgoingUniforms { rayCapacity:u32, regionCount:u32,
  regionWordCount:u32, padding:u32 };
struct IndexResult { n:f32, invalid:bool };

@group(0) @binding(0) var<storage,read> rays:array<Ray>;
@group(0) @binding(1) var<storage,read> hits:array<Hit>;
@group(0) @binding(2) var<storage,read> memberships:array<u32>;
@group(0) @binding(3) var<storage,read> crossings:array<u32>;
@group(0) @binding(4) var<storage,read> regions:array<RegionDescriptor>;
@group(0) @binding(5) var<storage,read> instanceParameters:array<f32>;
@group(0) @binding(6) var<storage,read_write>
  typeStates:array<InteractionTypeState>;
@group(0) @binding(7) var<storage,read> interactionRayIndices:array<u32>;
@group(0) @binding(8) var<storage,read_write> runControl:array<atomic<u32>>;
@group(0) @binding(9) var<storage,read_write> raysNext:array<Ray>;
@group(0) @binding(10) var<storage,read_write> membershipsNext:array<u32>;
@group(0) @binding(11) var<uniform> outgoingUniforms:OutgoingUniforms;

fn finiteNumber(value:f32)->bool {
  return value==value && abs(value)<=F32_MAX;
}
fn crossingBase(rayIndex:u32)->u32 {
  return rayIndex*outgoingUniforms.regionWordCount*2u;
}
fn regionCrossed(rayIndex:u32,regionId:u32)->bool {
  let base=crossingBase(rayIndex); let word=regionId>>5u;
  let bit=1u<<(regionId&31u);
  return ((crossings[base+word]^
    crossings[base+outgoingUniforms.regionWordCount+word])&bit)!=0u;
}
fn evaluateBulkIndex(
  region:RegionDescriptor,point:vec2f,wavelength:f32
)->IndexResult {
  switch region.typeId { ${cases.join('\n')} default:{
    return IndexResult(0.0,true);
  } }
}
fn evaluateEffectiveIndex(
  rayIndex:u32,point:vec2f,wavelength:f32,toggleCrossings:bool
)->IndexResult {
  var effective=IndexResult(1.0,false);
  let membershipBase=rayIndex*outgoingUniforms.regionWordCount;
  for (var regionId=0u;regionId<outgoingUniforms.regionCount;regionId++) {
    var isMember=(memberships[membershipBase+(regionId>>5u)]&
      (1u<<(regionId&31u)))!=0u;
    if (toggleCrossings && regionCrossed(rayIndex,regionId)) {
      isMember=!isMember;
    }
    if (!isMember) { continue; }
    let evaluated=evaluateBulkIndex(regions[regionId],point,wavelength);
    let next=effective.n*evaluated.n;
    effective=IndexResult(next,effective.invalid||evaluated.invalid||
      !finiteNumber(next));
  }
  return effective;
}
fn copyMembership(
  sourceRayIndex:u32,destinationRayIndex:u32,toggleCrossings:bool
) {
  let sourceBase=sourceRayIndex*outgoingUniforms.regionWordCount;
  let destinationBase=destinationRayIndex*outgoingUniforms.regionWordCount;
  let crossingOffset=crossingBase(sourceRayIndex);
  for (var wordIndex=0u;wordIndex<outgoingUniforms.regionWordCount;wordIndex++) {
    var value=memberships[sourceBase+wordIndex];
    if (toggleCrossings) {
      value^=crossings[crossingOffset+wordIndex]^
        crossings[crossingOffset+outgoingUniforms.regionWordCount+wordIndex];
    }
    membershipsNext[destinationBase+wordIndex]=value;
  }
}
fn writeBoundaryRay(
  source:Ray,point:vec2f,direction:vec2f,powers:vec2f,
  sourceRayIndex:u32,destinationRayIndex:u32,toggleCrossings:bool,
  groupStart:bool
) {
  copyMembership(sourceRayIndex,destinationRayIndex,toggleCrossings);
  let invalid=!finiteNumber(point.x)||!finiteNumber(point.y)||
    !finiteNumber(direction.x)||!finiteNumber(direction.y)||
    !(dot(direction,direction)>0.0)||
    !finiteNumber(powers.x)||!finiteNumber(powers.y)||
    powers.x<0.0||powers.y<0.0;
  let rayPowers=select(powers,vec2f(0.0),invalid);
  let isActive=!invalid&&(rayPowers.x!=0.0||rayPowers.y!=0.0);
  raysNext[destinationRayIndex]=Ray(point,
    select(direction,vec2f(0.0),invalid),rayPowers,source.wavelength,
    select(select(0u,1u,isActive),2u,invalid)|
      select(0u,4u,groupStart));
}
fn writeInactiveBoundaryRay(
  source:Ray,point:vec2f,sourceRayIndex:u32,destinationRayIndex:u32,
  invalid:bool,groupStart:bool
) {
  copyMembership(sourceRayIndex,destinationRayIndex,false);
  raysNext[destinationRayIndex]=Ray(
    point,vec2f(0.0),vec2f(0.0),source.wavelength,
    select(0u,2u,invalid)|select(0u,4u,groupStart));
}
fn processRegionBoundary(localIndex:u32,typeIndex:u32,partialReflect:bool) {
  if (atomicLoad(&runControl[8])!=0u ||
      localIndex>=typeStates[typeIndex].interactionCount) { return; }
  let interactionCount=typeStates[typeIndex].interactionCount;
  let sourceRayIndex=interactionRayIndices[
    typeStates[typeIndex].sourceIndexStart+localIndex];
  let destinationStart=typeStates[typeIndex].destinationRayStart;
  let transmittedIndex=destinationStart+localIndex;
  if (sourceRayIndex>=outgoingUniforms.rayCapacity ||
      transmittedIndex>=outgoingUniforms.rayCapacity) { return; }
  let source=rays[sourceRayIndex]; let hit=hits[sourceRayIndex];
  let point=source.origin+hit.s*source.direction;
  let incident=evaluateEffectiveIndex(
    sourceRayIndex,point,source.wavelength,false);
  let transmitted=evaluateEffectiveIndex(
    sourceRayIndex,point,source.wavelength,true);
  let relativeIndex=incident.n/transmitted.n;
  let cosIncident=-dot(source.direction,hit.normal);
  let radicand=1.0-relativeIndex*relativeIndex*
    (1.0-cosIncident*cosIncident);
  let reflectedDirection=source.direction+2.0*cosIncident*hit.normal;
  if (incident.invalid||transmitted.invalid||!finiteNumber(radicand)) {
    writeInactiveBoundaryRay(
      source,point,sourceRayIndex,transmittedIndex,true,localIndex==0u);
    if (partialReflect) {
      let reflectedIndex=destinationStart+interactionCount+localIndex;
      if (reflectedIndex<outgoingUniforms.rayCapacity) {
        writeInactiveBoundaryRay(
          source,point,sourceRayIndex,reflectedIndex,true,localIndex==0u);
      }
    }
    return;
  }
  if (radicand<0.0) {
    writeBoundaryRay(source,point,reflectedDirection,source.powers,
      sourceRayIndex,transmittedIndex,false,localIndex==0u);
    if (partialReflect) {
      let reflectedIndex=destinationStart+interactionCount+localIndex;
      if (reflectedIndex<outgoingUniforms.rayCapacity) {
        writeInactiveBoundaryRay(
          source,point,sourceRayIndex,reflectedIndex,false,localIndex==0u);
      }
    }
    return;
  }
  let cosTransmitted=sqrt(radicand);
  let transmittedDirection=relativeIndex*source.direction+
    (relativeIndex*cosIncident-cosTransmitted)*hit.normal;
  var reflectedFractions=vec2f(0.0);
  if (partialReflect) {
    let sRatio=(relativeIndex*cosIncident-cosTransmitted)/
      (relativeIndex*cosIncident+cosTransmitted);
    let pRatio=(relativeIndex*cosTransmitted-cosIncident)/
      (relativeIndex*cosTransmitted+cosIncident);
    reflectedFractions=vec2f(sRatio*sRatio,pRatio*pRatio);
  }
  writeBoundaryRay(source,point,transmittedDirection,
    source.powers*(vec2f(1.0)-reflectedFractions),
    sourceRayIndex,transmittedIndex,true,localIndex==0u);
  if (partialReflect) {
    let reflectedIndex=destinationStart+interactionCount+localIndex;
    if (reflectedIndex<outgoingUniforms.rayCapacity) {
      writeBoundaryRay(source,point,reflectedDirection,
        source.powers*reflectedFractions,
        sourceRayIndex,reflectedIndex,false,localIndex==0u);
    }
  }
}

@compute @workgroup_size(${workgroupSize})
fn regionBoundaryNoReflectionMain(
  @builtin(global_invocation_id) invocation:vec3u
) { processRegionBoundary(invocation.x,1u,false); }

@compute @workgroup_size(${workgroupSize})
fn regionBoundaryPartialReflectionMain(
  @builtin(global_invocation_id) invocation:vec3u
) { processRegionBoundary(invocation.x,2u,true); }
`;
}

export function createWebGpuSurfaceOutgoingShader({
  description,
  dagPrograms,
  typeId,
  surfaceTypeOffset = 3,
  workgroupSize,
}) {
  const program = dagPrograms.surfaces[typeId];
  const definition = description.types.surfaces[typeId].definition;
  const needsBulk = program.parameters.includes('n_0') ||
    program.parameters.includes('n_1');
  const argumentCode = program.parameters.map(name => {
    const common = {
      d_0x: 'localDirection.x', d_0y: 'localDirection.y',
      P_0s: 'source.powers.x', P_0p: 'source.powers.y',
      lambda: 'source.wavelength', x: 'point.x', y: 'point.y',
      u: 'hit.u', sigma: 'hit.sigma', n_0: 'incidentIndex.n',
      n_1: 'transmittedIndex.n',
    };
    if (common[name]) return common[name];
    const parameterIndex = definition.paramNames.indexOf(name);
    if (parameterIndex < 0) {
      throw new Error(
        `Surface type ${typeId} has no packed parameter ${JSON.stringify(name)}.`
      );
    }
    return `instanceParameters[surface.parameterOffset+${parameterIndex}u]`;
  });
  const call = argumentCode.length === 0
    ? `${program.functionName}()`
    : `${program.functionName}(array<f32,${argumentCode.length}>(` +
      `${argumentCode.join(',')}))`;
  const labelIndexes = new Map(
    program.labels.map((label, index) => [label, index])
  );
  const outputBlocks = Array.from(
    { length: definition.outRayCount },
    (_unused, outputIndex) => {
      const labelIndex = outputIndex + 1;
      const dx = labelIndexes.get(`d_${labelIndex}x`);
      const dy = labelIndexes.get(`d_${labelIndex}y`);
      const ps = labelIndexes.get(`P_${labelIndex}s`);
      const pp = labelIndexes.get(`P_${labelIndex}p`);
      return `{
    let localOutput=vec2f(evaluated[${dx}].value,evaluated[${dy}].value);
    let direction=localOutput.x*localXAxis+localOutput.y*hit.normal;
    let powers=vec2f(evaluated[${ps}].value,evaluated[${pp}].value);
    let dagInvalid=evaluated[${dx}].invalid||evaluated[${dy}].invalid||
      evaluated[${ps}].invalid||evaluated[${pp}].invalid||mediumInvalid;
    let destinationRayIndex=typeStates[${surfaceTypeOffset + typeId}u]
      .destinationRayStart+${outputIndex}u*interactionCount+localIndex;
    if (destinationRayIndex<outgoingUniforms.rayCapacity) {
      writeSurfaceRay(source,point,direction,powers,dagInvalid,curve,hit,
        sourceRayIndex,destinationRayIndex,localIndex==0u);
    }
  }`;
    }
  ).join('\n');
  const bulk = needsBulk
    ? createSurfaceBulkIndexCode(description, dagPrograms)
    : { programs: '', declarations: '', functions: '', setup:
      'var incidentIndex=IndexResult(1.0,false);\n' +
      '  var transmittedIndex=IndexResult(1.0,false);' };

  return {
    needsBulk,
    code: `${dagPrograms.runtimeCode}\n${program.code}\n${bulk.programs}\n
struct Ray { origin:vec2f,direction:vec2f,powers:vec2f,
  wavelength:f32,flags:u32 };
struct Hit { s:f32,u:f32,normal:vec2f,curveId:i32,sigma:f32,
  conflict:u32,interactionType:u32 };
struct CurveDescriptor { kind:u32,ownerKind:u32,ownerId:u32,flags:u32,
  geometryOffset:u32,geometryCount:u32,filterWavelength:f32,
  filterBandwidth:f32 };
struct InstanceDescriptor { typeId:u32,parameterOffset:u32,
  parameterCount:u32,extra:u32 };
struct InteractionTypeState { interactionCount:u32,sourceIndexStart:u32,
  destinationRayStart:u32,reserved:u32 };
struct OutgoingUniforms { rayCapacity:u32,regionCount:u32,
  regionWordCount:u32,padding:u32 };
struct IndexResult { n:f32,invalid:bool };
${bulk.declarations}
@group(0) @binding(0) var<storage,read> rays:array<Ray>;
@group(0) @binding(1) var<storage,read> hits:array<Hit>;
@group(0) @binding(2) var<storage,read> memberships:array<u32>;
@group(0) @binding(3) var<storage,read> crossings:array<u32>;
@group(0) @binding(4) var<storage,read> curves:array<CurveDescriptor>;
@group(0) @binding(5) var<storage,read> geometry:array<f32>;
@group(0) @binding(6) var<storage,read> surfaces:array<InstanceDescriptor>;
@group(0) @binding(7) var<storage,read> instanceParameters:array<f32>;
@group(0) @binding(8) var<storage,read_write>
  typeStates:array<InteractionTypeState>;
@group(0) @binding(9) var<storage,read> interactionRayIndices:array<u32>;
@group(0) @binding(10) var<storage,read_write> runControl:array<atomic<u32>>;
@group(0) @binding(11) var<storage,read_write> raysNext:array<Ray>;
@group(0) @binding(12) var<storage,read_write> membershipsNext:array<u32>;
@group(0) @binding(13) var<uniform> outgoingUniforms:OutgoingUniforms;
${needsBulk ? '@group(0) @binding(14) var<storage,read> regions:array<RegionDescriptor>;' : ''}
fn finiteNumber(value:f32)->bool {
  return value==value&&abs(value)<=F32_MAX;
}
fn crossingBase(rayIndex:u32)->u32 {
  return rayIndex*outgoingUniforms.regionWordCount*2u;
}
${bulk.functions}
fn copySurfaceMembership(sourceIndex:u32,destinationIndex:u32,toggle:bool) {
  let sourceBase=sourceIndex*outgoingUniforms.regionWordCount;
  let destinationBase=destinationIndex*outgoingUniforms.regionWordCount;
  let crossingOffset=crossingBase(sourceIndex);
  for (var wordIndex=0u;wordIndex<outgoingUniforms.regionWordCount;wordIndex++) {
    var value=memberships[sourceBase+wordIndex];
    if (toggle) { value^=crossings[crossingOffset+wordIndex]^
      crossings[crossingOffset+outgoingUniforms.regionWordCount+wordIndex]; }
    membershipsNext[destinationBase+wordIndex]=value;
  }
}
fn surfaceCrossesBoundary(
  curve:CurveDescriptor,source:Ray,hit:Hit,direction:vec2f
)->bool {
  if (curve.kind!=1u) { return dot(direction,hit.normal)<0.0; }
  let o=curve.geometryOffset;
  let frontNormal=vec2f(-geometry[o+3u],geometry[o+2u]);
  let orientation=select(-1.0,1.0,dot(source.direction,frontNormal)<0.0);
  return orientation*dot(direction,frontNormal)<0.0;
}
fn writeSurfaceRay(
  source:Ray,point:vec2f,direction:vec2f,powers:vec2f,
  dagInvalid:bool,curve:CurveDescriptor,hit:Hit,
  sourceIndex:u32,destinationIndex:u32,groupStart:bool
) {
  let invalid=dagInvalid||!finiteNumber(point.x)||!finiteNumber(point.y)||
    !finiteNumber(direction.x)||!finiteNumber(direction.y)||
    !(dot(direction,direction)>0.0)||!finiteNumber(powers.x)||
    !finiteNumber(powers.y)||powers.x<0.0||powers.y<0.0;
  let toggle=!invalid&&surfaceCrossesBoundary(curve,source,hit,direction);
  copySurfaceMembership(sourceIndex,destinationIndex,toggle);
  let outputPowers=select(powers,vec2f(0.0),invalid);
  let isActive=!invalid&&(outputPowers.x!=0.0||outputPowers.y!=0.0);
  raysNext[destinationIndex]=Ray(point,select(direction,vec2f(0.0),invalid),
    outputPowers,source.wavelength,
    select(select(0u,1u,isActive),2u,invalid)|
      select(0u,4u,groupStart));
}
@compute @workgroup_size(${workgroupSize})
fn surfaceOutgoingMain(@builtin(global_invocation_id) invocation:vec3u) {
  if (atomicLoad(&runControl[8])!=0u) { return; }
  let localIndex=invocation.x;
  let interactionCount=typeStates[${surfaceTypeOffset + typeId}u]
    .interactionCount;
  if (localIndex>=interactionCount) { return; }
  let sourceRayIndex=interactionRayIndices[
    typeStates[${surfaceTypeOffset + typeId}u].sourceIndexStart+localIndex];
  if (sourceRayIndex>=outgoingUniforms.rayCapacity) { return; }
  let source=rays[sourceRayIndex]; let hit=hits[sourceRayIndex];
  let curve=curves[u32(hit.curveId)]; let surface=surfaces[curve.ownerId];
  let point=source.origin+hit.s*source.direction;
  let localXAxis=vec2f(hit.normal.y,-hit.normal.x);
  let localDirection=vec2f(dot(source.direction,localXAxis),
    dot(source.direction,hit.normal));
  ${bulk.setup}
  let mediumInvalid=incidentIndex.invalid||transmittedIndex.invalid;
  let evaluated=${call};
  ${outputBlocks}
}`,
  };
}

function createSurfaceBulkIndexCode(description, dagPrograms) {
  const programs = dagPrograms.bulks.map(value => value.nOnly);
  const cases = programs.map((program, typeId) => {
    const definition = description.types.bulks[typeId].definition;
    const args = program.parameters.map(name => {
      if (name === 'x') return 'point.x';
      if (name === 'y') return 'point.y';
      if (name === 'lambda') return 'wavelength';
      const index = definition.paramNames.indexOf(name);
      return `instanceParameters[region.parameterOffset+${index}u]`;
    });
    const call = args.length === 0 ? `${program.functionName}()` :
      `${program.functionName}(array<f32,${args.length}>(${args.join(',')}))`;
    return `case ${typeId}u:{ let output=${call};
      return IndexResult(output[0].value,output[0].invalid); }`;
  });
  return {
    programs: programs.map(value => value.code).join('\n'),
    declarations: `struct RegionDescriptor { typeId:u32,parameterOffset:u32,
      parameterCount:u32,flags:u32,stepSize:f32,padding0:u32,padding1:u32,
      padding2:u32 };`,
    functions: `
fn regionCrossed(rayIndex:u32,regionId:u32)->bool {
  let base=crossingBase(rayIndex); let word=regionId>>5u;
  let bit=1u<<(regionId&31u);
  return ((crossings[base+word]^crossings[base+
    outgoingUniforms.regionWordCount+word])&bit)!=0u;
}
fn evaluateSurfaceBulk(region:RegionDescriptor,point:vec2f,wavelength:f32)
  ->IndexResult {
  switch region.typeId { ${cases.join('\n')} default:{return IndexResult(0.0,true);} }
}
fn evaluateSurfaceIndex(rayIndex:u32,point:vec2f,wavelength:f32,toggle:bool)
  ->IndexResult {
  var result=IndexResult(1.0,false);
  let base=rayIndex*outgoingUniforms.regionWordCount;
  for(var regionId=0u;regionId<outgoingUniforms.regionCount;regionId++) {
    var isMember=(memberships[base+(regionId>>5u)]&
      (1u<<(regionId&31u)))!=0u;
    if(toggle&&regionCrossed(rayIndex,regionId)){isMember=!isMember;}
    if(!isMember){continue;}
    let evaluated=evaluateSurfaceBulk(regions[regionId],point,wavelength);
    let next=result.n*evaluated.n;
    result=IndexResult(next,result.invalid||evaluated.invalid||
      !finiteNumber(next));
  }
  return result;
}`,
    setup: `let incidentIndex=evaluateSurfaceIndex(
    sourceRayIndex,point,source.wavelength,false);
  let transmittedIndex=evaluateSurfaceIndex(
    sourceRayIndex,point,source.wavelength,true);`,
  };
}

export function createWebGpuDetectorOutgoingShader({
  description, dagPrograms, typeId, workgroupSize,
}) {
  const program = dagPrograms.detectors[typeId];
  const definition = description.types.detectors[typeId].definition;
  const detectorTypeOffset = 3 + description.types.surfaces.length;
  const common = {
    d_0x: 'localDirection.x', d_0y: 'localDirection.y',
    P_0s: 'source.powers.x', P_0p: 'source.powers.y',
    lambda: 'source.wavelength', x: 'point.x', y: 'point.y',
    u: 'hit.u', sigma: 'hit.sigma',
  };
  const args = program.parameters.map(name => {
    if (common[name]) return common[name];
    const index = definition.paramNames.indexOf(name);
    return `instanceParameters[detector.parameterOffset+${index}u]`;
  });
  const call = args.length === 0 ? `${program.functionName}()` :
    `${program.functionName}(array<f32,${args.length}>(${args.join(',')}))`;
  const indexes = new Map(program.labels.map((label, index) => [label, index]));
  const writes = Array.from({ length: definition.writeCount }, (_v, index) => {
    const key = indexes.get(`k_${index + 1}`);
    const value = indexes.get(`v_${index + 1}`);
    return `accumulateDetector(detector,evaluated[${key}],evaluated[${value}]);`;
  }).join('\n  ');
  return `${dagPrograms.runtimeCode}\n${program.code}\n
const FIXED_SCALE:f32=1048576.0;
const I32_MAX_VALUE:i32=2147483647;
const I32_MIN_VALUE:i32=-2147483647-1;
const I32_MAX_F32:f32=2147483520.0;
const I32_MIN_F32:f32=-2147483648.0;
struct Ray { origin:vec2f,direction:vec2f,powers:vec2f,
  wavelength:f32,flags:u32 };
struct Hit { s:f32,u:f32,normal:vec2f,curveId:i32,sigma:f32,
  conflict:u32,interactionType:u32 };
struct CurveDescriptor { kind:u32,ownerKind:u32,ownerId:u32,flags:u32,
  geometryOffset:u32,geometryCount:u32,filterWavelength:f32,
  filterBandwidth:f32 };
struct DetectorDescriptor { typeId:u32,parameterOffset:u32,parameterCount:u32,
  resultId:u32,resultSize:u32,resultOffset:u32,padding0:u32,padding1:u32 };
struct InteractionTypeState { interactionCount:u32,sourceIndexStart:u32,
  destinationRayStart:u32,reserved:u32 };
struct DetectorResultCell { value:atomic<i32>,overflow:atomic<u32> };
struct OutgoingUniforms { rayCapacity:u32,regionCount:u32,
  regionWordCount:u32,padding:u32 };
@group(0) @binding(0) var<storage,read> rays:array<Ray>;
@group(0) @binding(1) var<storage,read> hits:array<Hit>;
@group(0) @binding(2) var<storage,read> memberships:array<u32>;
@group(0) @binding(3) var<storage,read> curves:array<CurveDescriptor>;
@group(0) @binding(4) var<storage,read> detectors:array<DetectorDescriptor>;
@group(0) @binding(5) var<storage,read> instanceParameters:array<f32>;
@group(0) @binding(6) var<storage,read_write> typeStates:array<InteractionTypeState>;
@group(0) @binding(7) var<storage,read> interactionRayIndices:array<u32>;
@group(0) @binding(8) var<storage,read_write> runControl:array<atomic<u32>>;
@group(0) @binding(9) var<storage,read_write> raysNext:array<Ray>;
@group(0) @binding(10) var<storage,read_write> membershipsNext:array<u32>;
@group(0) @binding(11) var<storage,read_write>
  detectorResults:array<DetectorResultCell>;
@group(0) @binding(12) var<uniform> outgoingUniforms:OutgoingUniforms;
fn finiteNumber(value:f32)->bool{return value==value&&abs(value)<=F32_MAX;}
fn accumulateDetector(detector:DetectorDescriptor,key:W,value:W) {
  if(key.invalid||value.invalid||!finiteNumber(key.value)||
    !finiteNumber(value.value)||key.value!=floor(key.value)||key.value<0.0||
    key.value>=f32(detector.resultSize)){return;}
  let cellIndex=detector.resultOffset+u32(key.value);
  let scaled=value.value*FIXED_SCALE;
  let conversionOverflow=!finiteNumber(scaled)||scaled>I32_MAX_F32||
    scaled<I32_MIN_F32;
  let amount=i32(clamp(scaled,I32_MIN_F32,I32_MAX_F32));
  let oldValue=atomicAdd(&detectorResults[cellIndex].value,amount);
  let additionOverflow=(amount>0&&oldValue>I32_MAX_VALUE-amount)||
    (amount<0&&oldValue<I32_MIN_VALUE-amount);
  if(conversionOverflow||additionOverflow){
    atomicStore(&detectorResults[cellIndex].overflow,1u);
  }
}
fn copyDetectorMembership(sourceIndex:u32,destinationIndex:u32){
  let sourceBase=sourceIndex*outgoingUniforms.regionWordCount;
  let destinationBase=destinationIndex*outgoingUniforms.regionWordCount;
  for(var word=0u;word<outgoingUniforms.regionWordCount;word++){
    membershipsNext[destinationBase+word]=memberships[sourceBase+word];
  }
}
@compute @workgroup_size(${workgroupSize})
fn detectorOutgoingMain(@builtin(global_invocation_id) invocation:vec3u){
  if(atomicLoad(&runControl[8])!=0u){return;}
  let localIndex=invocation.x;
  let typeIndex=${detectorTypeOffset + typeId}u;
  if(localIndex>=typeStates[typeIndex].interactionCount){return;}
  let sourceIndex=interactionRayIndices[
    typeStates[typeIndex].sourceIndexStart+localIndex];
  let destinationIndex=typeStates[typeIndex].destinationRayStart+localIndex;
  if(sourceIndex>=outgoingUniforms.rayCapacity||
    destinationIndex>=outgoingUniforms.rayCapacity){return;}
  let source=rays[sourceIndex];let hit=hits[sourceIndex];
  let curve=curves[u32(hit.curveId)];let detector=detectors[curve.ownerId];
  let point=source.origin+hit.s*source.direction;
  let localXAxis=vec2f(hit.normal.y,-hit.normal.x);
  let localDirection=vec2f(dot(source.direction,localXAxis),
    dot(source.direction,hit.normal));
  let evaluated=${call};
  ${writes}
  copyDetectorMembership(sourceIndex,destinationIndex);
  let invalid=!finiteNumber(point.x)||!finiteNumber(point.y);
  raysNext[destinationIndex]=Ray(point,select(source.direction,vec2f(0.0),invalid),
    select(source.powers,vec2f(0.0),invalid),source.wavelength,
    select(source.flags&1u,2u,invalid)|select(0u,4u,localIndex==0u));
}`;
}

function detectorResultValueCount(description) {
  const sizes = new Map();
  for (const detector of description.detectors) {
    if (!sizes.has(detector.resultId)) {
      sizes.set(detector.resultId, detector.resultSize);
    }
  }
  let count = 0;
  for (const size of sizes.values()) count += size;
  return count;
}

function createInitializedBuffer(device, data, usage, label) {
  const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const buffer = device.createBuffer({
    label,
    size: Math.max(4, Math.ceil(bytes.byteLength / 4) * 4),
    usage,
  });
  if (bytes.byteLength > 0) device.queue.writeBuffer(buffer, 0, bytes);
  return buffer;
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

function readOnlyStorageLayoutEntry(binding) {
  return {
    binding,
    visibility: SHADER_STAGE_COMPUTE,
    buffer: { type: 'read-only-storage' },
  };
}

function storageLayoutEntry(binding) {
  return {
    binding,
    visibility: SHADER_STAGE_COMPUTE,
    buffer: { type: 'storage' },
  };
}

function uniformLayoutEntry(binding) {
  return {
    binding,
    visibility: SHADER_STAGE_COMPUTE,
    buffer: { type: 'uniform' },
  };
}
