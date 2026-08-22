/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { collectParameterNames } from '../../formula/dag-util.js';

export const WEBGPU_RAY_STRIDE = 32;
export const WEBGPU_HIT_STRIDE = 32;
export const WEBGPU_PIXEL_STRIDE = 16;

/**
 * Describe the concrete buffers and ordered passes used by a prepared
 * WebGPU megakernel scene. Keeping this as plain data also provides a cache
 * key independent of runtime instance values and rendering uniforms.
 */
export function createWebGpuExecutionPlan(
  description,
  parameterRanges,
  { maxBvhDepth = 16 } = {}
) {
  const regionWordCount = Math.ceil(description.regions.length / 32);
  const curveKindMask = createCurveKindMask(description.curves);
  const maximumBvhDepth = description.bvh.nodes.reduce(
    (maximum, node) => Math.max(maximum, node.depth ?? 0),
    0
  );
  if (maximumBvhDepth > maxBvhDepth) {
    throw new RangeError(
      `The scene BVH depth ${maximumBvhDepth} exceeds the configured ` +
      `WebGPU maxBvhDepth ${maxBvhDepth}. Increase maxBvhDepth for this ` +
      'scene or use the CPU engine.'
    );
  }
  const regionBoundaryVariants = [false, true].filter(partialReflect =>
    description.regions.some(region =>
      region.partialReflect === partialReflect
    )
  );
  const surfaceDependencies = description.types.surfaces.map((type, typeId) => {
    const parameters = collectParameterNames(type.definition.dag);
    const consumesRefractiveIndices =
      parameters.has('n_0') || parameters.has('n_1');
    return {
      typeId,
      consumesRefractiveIndices,
      compiledDags: consumesRefractiveIndices
        ? ['surface', 'all-present-bulk-n-only']
        : ['surface'],
    };
  });

  const passes = [
    pass('clear', [], ['queueControl', 'detectorResults', 'readyGeometry']),
    pass('sourceAndMembershipMegakernel', [
      'sourceDescriptors', 'instanceParameters', 'bvhNodes', 'bvhCurveIds',
      'curveDescriptors', 'curveGeometry'
    ], ['rayPing', 'membershipPing'], ['all-present-sources']),
    pass('tracingMegakernel', [
      'activeRayIndices', 'rayCurrent', 'membershipCurrent',
      'instanceParameters', 'surfaceDescriptors', 'regionDescriptors',
      'detectorDescriptors', 'curveDescriptors', 'curveGeometry',
      'bvhNodes', 'bvhCurveIds'
    ], [
      'rayNext', 'membershipNext', 'detectorResults', 'readyGeometry'
    ], ['all-present-interaction-dags', 'selected-render-mode']),
    pass('stableRayBlockCount', ['rayNext'], ['rayBlockOffsets']),
    pass('stableRayBlockPrefix', ['rayBlockOffsets'], [
      'rayBlockOffsets', 'queueControl', 'dispatchArguments'
    ]),
    pass('stableRayIndexFill', ['rayNext', 'rayBlockOffsets'], [
      'activeRayIndices'
    ]),
    pass('rasterAtomic', ['readyGeometry'], ['pixelAccumulation']),
    pass('toneMap', ['pixelAccumulation'], ['outputTexture'])
  ];

  return {
    typeSignature: description.typeSignature,
    curveKindMask,
    maximumBvhDepth,
    maxBvhDepth,
    regionWordCount,
    surfaceDependencies,
    buffers: {
      instanceParameters: { stride: 4, static: true },
      sourceDescriptors: { stride: 16, static: true },
      surfaceDescriptors: { stride: 16, static: true },
      regionDescriptors: { stride: 32, static: true },
      detectorDescriptors: { stride: 32, static: true },
      curveDescriptors: { stride: 32, static: true },
      curveGeometry: { stride: 4, static: true },
      bvhNodes: { stride: 80, static: true },
      bvhCurveIds: { stride: 4, static: true },
      queueControl: { stride: 4, dynamic: true },
      activeRayIndices: { stride: 4, dynamic: true, order: 'stable' },
      rayBlockOffsets: { stride: 4, dynamic: true },
      dispatchArguments: { stride: 4, dynamic: true },
      rayPing: { stride: WEBGPU_RAY_STRIDE, dynamic: true },
      rayPong: { stride: WEBGPU_RAY_STRIDE, dynamic: true },
      membershipPing: { stride: regionWordCount * 4, dynamic: true },
      membershipPong: { stride: regionWordCount * 4, dynamic: true },
      readyGeometry: { stride: 64, dynamic: true, order: 'atomic' },
      pixelAccumulation: {
        stride: WEBGPU_PIXEL_STRIDE,
        fields: ['atomic<u32> r', 'atomic<u32> g', 'atomic<u32> b',
          'atomic<u32> overflow'],
      },
    },
    passes,
    specializationSignature: JSON.stringify({
      typeSignature: description.typeSignature,
      curveKindMask,
      maxBvhDepth,
      regionWordCount,
      regionBoundaryVariants,
      guards: collectGuardSignatures(parameterRanges),
      surfaceDependencies: surfaceDependencies.map(value =>
        value.consumesRefractiveIndices),
    }),
    // Every interaction type is embedded in one tracing module. A
    // guard/topology change in any included DAG therefore
    // invalidates every lazily compiled render-mode variant of that module.
    megakernelSignature: JSON.stringify({
      typeSignature: description.typeSignature,
      curveKindMask,
      maxBvhDepth,
      regionWordCount,
      regionBoundaryVariants,
      guards: collectGuardSignatures(parameterRanges),
      sourceOutputCount: 1,
      surfaceOutputCounts: description.types.surfaces.map(
        type => type.definition.outRayCount
      ),
      detectorWriteCounts: description.types.detectors.map(
        type => type.definition.writeCount
      ),
    }),
  };
}

function pass(name, reads, writes, compiledDags = []) {
  return { name, reads, writes, compiledDags };
}

function createCurveKindMask(curves) {
  const kinds = [...new Set(curves.map(curve => curve.geometry.kind))].sort();
  return kinds.join('|');
}

function collectGuardSignatures(parameterRanges) {
  const result = {};
  for (const category of [
    'sources', 'surfaces', 'bulks', 'detectors', 'internalSurfaces'
  ]) {
    result[category] = (parameterRanges[category] ?? []).map(type =>
      type.guardSignature);
  }
  return result;
}
