/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

// Initial automatic selection uses a fixed shipped crossover. The simulator
// can subsequently compare both engines and remember the measured winner.
export const DEFAULT_WEBGPU_WORKLOAD_THRESHOLD = 1024;

export function summarizePrimitiveWorkload(primitives) {
  let primitiveCurveCount = 0;
  let initialRayCount = 0;
  let hasGrinRegion = false;
  for (const primitive of primitives) {
    switch (primitive?.kind) {
      case 'source':
        initialRayCount += nonnegativeCount(primitive.rayCount);
        break;
      case 'surface':
      case 'detector':
        primitiveCurveCount++;
        break;
      case 'region':
        primitiveCurveCount += Array.isArray(primitive.curves)
          ? primitive.curves.length
          : 0;
        hasGrinRegion ||= Number(primitive.stepSize) > 0;
        break;
      default:
        break;
    }
  }
  return Object.freeze({
    primitiveCurveCount,
    initialRayCount,
    hasGrinRegion,
  });
}

export function getPrimitiveEngineWorkloadScore(workload) {
  const primitiveCurveCount = Math.max(
    0,
    Number(workload?.primitiveCurveCount) || 0
  );
  const initialRayCount = Math.max(
    0,
    Number(workload?.initialRayCount) || 0
  );
  return initialRayCount * Math.sqrt(primitiveCurveCount);
}

export function selectPrimitiveEngineKind({
  preference = 'automatic',
  workload,
  isAvailable = () => true,
}) {
  if (preference !== 'automatic') return preference;
  if (workload?.hasGrinRegion && isAvailable('webgpu')) return 'webgpu';
  const webGpuScore = getPrimitiveEngineWorkloadScore(workload);
  return webGpuScore >= DEFAULT_WEBGPU_WORKLOAD_THRESHOLD &&
    isAvailable('webgpu')
    ? 'webgpu'
    : 'primitiveCpu';
}

function nonnegativeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}
