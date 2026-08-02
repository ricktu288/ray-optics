/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { collectParameterNames } from '../formula/dag-util.js';

export const WEBGPU_RAY_STRIDE = 32;
export const WEBGPU_HIT_STRIDE = 32;
export const WEBGPU_PIXEL_STRIDE = 16;

/**
 * Describe the concrete buffers and ordered passes used by a prepared WebGPU
 * scene.  Keeping this as plain data makes the same decisions inspectable in
 * Node and keeps pipeline-cache keys independent of runtime instance values.
 */
export function createWebGpuExecutionPlan(description, parameterRanges) {
  const regionWordCount = Math.ceil(description.regions.length / 32);
  const curveKindMask = createCurveKindMask(description.curves);
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
    pass('clear', [], ['runControl', 'detectorResults', 'pixelAccumulation']),
    pass('sourceEmission', ['sourceDescriptors', 'instanceParameters'],
      ['rayPing'], ['source']),
  ];
  if (description.regions.length > 0) {
    passes.push(pass('initialMembership',
      ['rayPing', 'bvhNodes', 'bvhCurveIds', 'curveGeometry'],
      ['membershipPing']));
  }
  passes.push(
    pass('trace', [
      'rayCurrent', 'membershipCurrent', 'bvhNodes', 'bvhCurveIds',
      'curveGeometry', 'regionDescriptors'
    ], ['hits', 'crossingScratch', 'interactionTypeCounts']),
    pass('prepareRenderGeometry', ['rayCurrent', 'hits'],
      ['readyLines', 'readyPoints']),
    pass('interactionPrefixScan', ['interactionTypeCounts'],
      ['interactionTypeStates', 'runControl']),
    pass('interactionIndexFill', ['hits', 'interactionTypeStates'],
      ['interactionRayIndices']),
  );
  if (description.regions.length > 0) {
    passes.push(pass('grinOutgoing', [
      'interactionRayIndices', 'rayCurrent', 'hits', 'membershipCurrent',
      'regionDescriptors', 'instanceParameters'
    ], ['rayNext', 'membershipNext'], ['all-present-bulk-grin']));
    for (const partialReflect of [false, true]) {
      if (!description.regions.some(
        region => region.partialReflect === partialReflect
      )) continue;
      passes.push(pass(
        `regionBoundaryOutgoing:${partialReflect
          ? 'partialReflect' : 'noPartialReflect'}`,
        [
        'interactionRayIndices', 'rayCurrent', 'hits', 'membershipCurrent',
        'regionDescriptors', 'instanceParameters'
        ],
        ['rayNext', 'membershipNext'],
        ['all-present-bulk-n-only']
      ));
    }
  }
  for (const dependency of surfaceDependencies) {
    passes.push(pass(`surfaceOutgoing:${dependency.typeId}`, [
      'interactionRayIndices', 'rayCurrent', 'hits', 'membershipCurrent',
      'surfaceDescriptors', 'regionDescriptors', 'instanceParameters'
    ], ['rayNext', 'membershipNext'], dependency.compiledDags));
  }
  for (let typeId = 0;
    typeId < description.types.detectors.length;
    typeId++) {
    passes.push(pass(`detectorOutgoing:${typeId}`, [
      'interactionRayIndices', 'rayCurrent', 'hits', 'membershipCurrent',
      'detectorDescriptors', 'instanceParameters'
    ], ['rayNext', 'membershipNext', 'detectorResults'], ['detector']));
  }
  passes.push(
    pass('rasterAtomic', ['readyLines', 'readyPoints'],
      ['pixelAccumulation']),
    pass('toneMap', ['pixelAccumulation'], ['outputTexture'])
  );

  return {
    typeSignature: description.typeSignature,
    curveKindMask,
    regionWordCount,
    surfaceDependencies,
    buffers: {
      instanceParameters: { stride: 4, static: true },
      sourceDescriptors: { stride: 16, static: true },
      sourceDispatchEntries: { stride: 8, static: true },
      interactionTypeDescriptors: { stride: 16, static: true },
      surfaceDescriptors: { stride: 16, static: true },
      regionDescriptors: { stride: 32, static: true },
      detectorDescriptors: { stride: 32, static: true },
      curveDescriptors: { stride: 32, static: true },
      curveGeometry: { stride: 4, static: true },
      bvhNodes: { stride: 32, static: true },
      bvhCurveIds: { stride: 4, static: true },
      runControl: { stride: 64, dynamic: true },
      rayPing: { stride: WEBGPU_RAY_STRIDE, dynamic: true },
      rayPong: { stride: WEBGPU_RAY_STRIDE, dynamic: true },
      membershipPing: { stride: regionWordCount * 4, dynamic: true },
      membershipPong: { stride: regionWordCount * 4, dynamic: true },
      hits: { stride: WEBGPU_HIT_STRIDE, dynamic: true },
      interactionTypeByRay: { stride: 4, dynamic: true },
      interactionTypeCounts: { stride: 4, dynamic: true },
      interactionTypeStates: { stride: 16, dynamic: true },
      interactionRayIndices: { stride: 4, dynamic: true },
      crossingScratch: { stride: regionWordCount * 8, dynamic: true },
      readyLines: { stride: 64, dynamic: true, batching: 'submission' },
      readyPoints: { stride: 32, dynamic: true, batching: 'submission' },
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
      regionWordCount,
      guards: collectGuardSignatures(parameterRanges),
      surfaceDependencies: surfaceDependencies.map(value =>
        value.consumesRefractiveIndices),
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
