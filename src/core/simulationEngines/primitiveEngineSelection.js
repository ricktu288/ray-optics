/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import { getCurveBounds } from '../primitive/bvh.js';

// Temporary Intel Xe-LPG calibration from the standalone multi-bounce
// ray-cooperation benchmark and the small end-to-end scene calibration.
// Engine selection intentionally uses only information available immediately
// after collecting primitive records.
export const DEFAULT_WEBGPU_WORKLOAD_THRESHOLD = 1024;
export const DEFAULT_ENGINE_SELECTION_CORRECTIONS = Object.freeze({
  outgoingCoefficient: 0,
  defaultRenderCoefficient: 0.25,
  nonDefaultRenderCoefficient: 0.25,
  grinStepCoefficient: 0.05,
});

export function summarizePrimitiveWorkload(primitives, {
  lengthScale = 1,
} = {}) {
  let primitiveCurveCount = 0;
  let initialRayCount = 0;
  let additionalOutgoingRaySlotCount = 0;
  let grinStepFactor = 0;
  for (const primitive of primitives) {
    switch (primitive?.kind) {
      case 'source':
        initialRayCount += nonnegativeCount(primitive.rayCount);
        break;
      case 'surface':
        additionalOutgoingRaySlotCount += Math.max(
          0,
          nonnegativeCount(primitive.surfaceType?.outRayCount) - 1
        );
        primitiveCurveCount++;
        break;
      case 'detector':
        primitiveCurveCount++;
        break;
      case 'region':
        {
          const curveCount = Array.isArray(primitive.curves)
            ? primitive.curves.length
            : 0;
          primitiveCurveCount += curveCount;
          if (primitive.partialReflect) {
            additionalOutgoingRaySlotCount += curveCount;
          }
          const stepSize = Number(primitive.stepSize);
          if (Number.isFinite(stepSize) && stepSize > 0) {
            grinStepFactor += estimateRegionTraversalLength(
              primitive.curves,
              lengthScale
            ) / stepSize;
          }
        }
        break;
      default:
        break;
    }
  }
  return Object.freeze({
    primitiveCurveCount,
    initialRayCount,
    additionalOutgoingRaySlotCount,
    grinStepFactor,
  });
}

export function selectPrimitiveEngineKind({
  preference = 'automatic',
  workload,
  isAvailable = () => true,
  webGpuWorkloadThreshold = DEFAULT_WEBGPU_WORKLOAD_THRESHOLD,
  outgoingCoefficient =
    DEFAULT_ENGINE_SELECTION_CORRECTIONS.outgoingCoefficient,
  defaultRenderCoefficient =
    DEFAULT_ENGINE_SELECTION_CORRECTIONS.defaultRenderCoefficient,
  nonDefaultRenderCoefficient =
    DEFAULT_ENGINE_SELECTION_CORRECTIONS.nonDefaultRenderCoefficient,
  grinStepCoefficient =
    DEFAULT_ENGINE_SELECTION_CORRECTIONS.grinStepCoefficient,
  colorMode = 'default',
}) {
  if (preference !== 'automatic') return preference;
  const {
    primitiveCurveCount,
    initialRayCount,
    additionalOutgoingRaySlotCount = 0,
    grinStepFactor = 0,
  } = workload;
  const renderCoefficient = colorMode === 'default'
    ? defaultRenderCoefficient
    : nonDefaultRenderCoefficient;
  const webGpuScore = initialRayCount * (
    Math.sqrt(Math.max(1, primitiveCurveCount)) +
    outgoingCoefficient * additionalOutgoingRaySlotCount +
    renderCoefficient +
    grinStepCoefficient * grinStepFactor
  );
  return webGpuScore >= webGpuWorkloadThreshold && isAvailable('webgpu')
    ? 'webgpu'
    : 'primitiveCpu';
}

function normalizedLengthScale(value) {
  const scale = Number(value);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function estimateRegionTraversalLength(curves, lengthScale) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const curve of curves ?? []) {
    try {
      const bounds = getCurveBounds(curve, {
        numericEpsilon: Number.EPSILON,
      });
      minX = Math.min(minX, bounds.minX);
      minY = Math.min(minY, bounds.minY);
      maxX = Math.max(maxX, bounds.maxX);
      maxY = Math.max(maxY, bounds.maxY);
    } catch (_) {
      // Invalid curves are discarded during preprocessing. Keep selection
      // robust and fall back to one scene length unit if none remain.
    }
  }
  const minimumExtent = Math.min(maxX - minX, maxY - minY);
  return Number.isFinite(minimumExtent) && minimumExtent > 0
    ? minimumExtent
    : normalizedLengthScale(lengthScale);
}

function nonnegativeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}
