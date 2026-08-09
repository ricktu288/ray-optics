/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import {
  createWebGpuBvhPartitionRootIndices
} from './webGpuStorage.js';

const TRACE_SCENE_FIELDS = Object.freeze([
  ['bvhNodes', 'BvhNode', 80],
  ['instanceParameters', 'f32', 4],
  ['surfaceDescriptors', 'InstanceDescriptor', 16],
  ['regionDescriptors', 'RegionDescriptor', 32],
  ['detectorDescriptors', 'DetectorDescriptor', 32],
  ['curveDescriptors', 'CurveDescriptor', 32],
  ['curveGeometry', 'f32', 4],
  ['bvhCurveIds', 'u32', 4],
  ['bvhPartitionRoots', 'BvhPartitionRoot', 32],
]);

/**
 * Pack the immutable tables needed while tracing into one storage binding.
 * BvhNode is first because its vec4 member gives it 16-byte alignment; every
 * following table has four-byte alignment and every table has a fixed stride.
 */
export function createWebGpuTraceSceneData(packedScene, fieldCapacities = null) {
  const byteLengths = TRACE_SCENE_FIELDS.map(([name, _type, minimumSize]) => {
    const byteLength = Math.max(
      minimumSize,
      packedScene[name]?.byteLength ?? 0
    );
    const capacity = fieldCapacities?.[name] ?? byteLength;
    if (byteLength > capacity) {
      throw new RangeError(
        `Packed WebGPU trace-scene field ${name} does not fit its layout.`
      );
    }
    return capacity;
  });
  const byteLength = alignTo16(byteLengths.reduce((sum, size) => sum + size, 0));
  const data = new Uint8Array(byteLength);
  let offset = 0;
  TRACE_SCENE_FIELDS.forEach(([name], index) => {
    const value = packedScene[name] ?? new Uint8Array(0);
    const bytes = value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    data.set(bytes, offset);
    offset += byteLengths[index];
  });
  return data;
}

/** Build the fixed-size WGSL struct matching createWebGpuTraceSceneData. */
export function createWebGpuTraceSceneDeclaration(description, binding) {
  const counts = traceSceneCounts(description);
  const fields = TRACE_SCENE_FIELDS.map(([name, type]) => {
    const count = Math.max(1, counts[name]);
    return `  ${traceSceneFieldName(name)}:array<${type},${count}>,`;
  }).join('\n');
  return `struct TraceScene {\n${fields}\n};\n` +
    `@group(0) @binding(${binding}) var<storage,read> traceScene:TraceScene;`;
}

/** Redirect the familiar table expressions to fields of TraceScene. */
export function useWebGpuTraceScene(code) {
  const names = [
    'bvhNodes', 'instanceParameters', 'surfaces', 'regions', 'detectors',
    'curves', 'geometry', 'bvhCurveIds', 'bvhPartitionRoots',
  ];
  let result = code;
  for (const name of names) {
    const existing = `__packed_trace_scene_${name}__[`;
    result = result.replaceAll(`traceScene.${name}[`, existing);
    result = result.replaceAll(`${name}[`, `traceScene.${name}[`);
    result = result.replaceAll(existing, `traceScene.${name}[`);
  }
  return result;
}

function traceSceneFieldName(name) {
  switch (name) {
    case 'surfaceDescriptors': return 'surfaces';
    case 'regionDescriptors': return 'regions';
    case 'detectorDescriptors': return 'detectors';
    case 'curveDescriptors': return 'curves';
    case 'curveGeometry': return 'geometry';
    default: return name;
  }
}

function traceSceneCounts(description) {
  const typeParameterCount = (instances, types, typeIdName) =>
    (instances ?? []).reduce((sum, instance) => sum +
      (types?.[instance[typeIdName]]?.definition.paramNames.length ?? 0), 0);
  const types = description.types ?? {};
  const instanceParameters =
    typeParameterCount(
      description.sources, types.sources, 'sourceTypeId'
    ) +
    typeParameterCount(
      description.surfaces, types.surfaces, 'surfaceTypeId'
    ) +
    typeParameterCount(
      description.regions, types.bulks, 'bulkTypeId'
    ) +
    typeParameterCount(
      description.detectors, types.detectors, 'detectorTypeId'
    );
  const geometryCounts = {
    lineSegment: 8,
    smoothLineSegment: 12,
    circularArc: 8,
    circle: 4,
    cubicBezier: 16,
  };
  return {
    bvhNodes: Math.max(1, description.bvh.nodes.filter(
      node => node.count === 0
    ).length),
    bvhPartitionRoots: Math.max(
      1,
      createWebGpuBvhPartitionRootIndices(description.bvh).length
    ),
    instanceParameters,
    surfaceDescriptors: description.surfaces?.length ?? 0,
    regionDescriptors: description.regions?.length ?? 0,
    detectorDescriptors: description.detectors?.length ?? 0,
    curveDescriptors: description.curves.length,
    curveGeometry: description.curves.reduce((sum, curve) =>
      sum + geometryCounts[curve.geometry.kind], 0),
    bvhCurveIds: description.bvh.curveIds?.length ?? 0,
  };
}

function alignTo16(value) {
  return Math.ceil(value / 16) * 16;
}
