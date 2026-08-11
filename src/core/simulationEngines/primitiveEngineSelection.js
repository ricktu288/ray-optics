/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

// Temporary Intel Xe-LPG calibration from the standalone multi-bounce
// benchmark. Engine selection intentionally uses only information available
// immediately after collecting primitive records.
export const DEFAULT_WEBGPU_WORKLOAD_THRESHOLD = 1024;

export function summarizePrimitiveWorkload(primitives) {
  let primitiveCurveCount = 0;
  let initialRayCount = 0;
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
        break;
      default:
        break;
    }
  }
  return Object.freeze({ primitiveCurveCount, initialRayCount });
}

export function selectPrimitiveEngineKind({
  preference = 'automatic',
  workload,
  isAvailable = () => true,
  webGpuWorkloadThreshold = DEFAULT_WEBGPU_WORKLOAD_THRESHOLD,
}) {
  if (preference !== 'automatic') return preference;
  const { primitiveCurveCount, initialRayCount } = workload;
  const webGpuScore = primitiveCurveCount > 0
    ? initialRayCount * Math.sqrt(primitiveCurveCount)
    : 0;
  return webGpuScore >= webGpuWorkloadThreshold && isAvailable('webgpu')
    ? 'webgpu'
    : 'primitiveCpu';
}

function nonnegativeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}
