/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { evaluatePreparedCurve } from '../primitive/curveGeometry.js';
import {
  BVH_NODE_MISSED,
  BVH_NODE_PRUNED,
  BVH_NODE_TESTED
} from '../primitive/bvhTraversal.js';

const RAY_COLOR = [1, 0.75, 0.1, 0.8];
const REGION_FILL_COLOR = [0.15, 0.65, 1, 0.18];
const REGION_OUTLINE_COLOR = [0.15, 0.65, 1, 0.45];
const SELECTED_CURVE_COLOR = [1, 0.2, 0.75, 1];
const HIT_COLOR = [1, 0.15, 0.1, 1];
const NORMAL_COLOR = [0.15, 0.75, 1, 1];
const TESTED_BOUNDS_COLOR = [0.15, 0.9, 0.35, 0.55];
const MISSED_BOUNDS_COLOR = [1, 0.2, 0.2, 0.45];
const PRUNED_BOUNDS_COLOR = [0.75, 0.25, 1, 0.7];
const TESTED_CURVE_COLOR = [1, 0.6, 0.05, 0.95];

/**
 * Temporary visual inspection path for the first source ray. This module is
 * deliberately separate from CPU candidate aggregation so it can be removed
 * when the real run and light-output paths replace it.
 *
 * @param {Object} options
 * @returns {Object|null|undefined} The temporary interaction candidate.
 */
export function drawTemporaryFirstRayVisualization({
  preparedScene,
  viewport = {},
  colorMode = 'default',
  beginRenderer,
  findCandidate,
  conflictNames,
  normalConflictType
}) {
  const origin = viewport.origin || { x: 0, y: 0 };
  const scale = viewport.scale ?? 1;
  const lengthScale = viewport.lengthScale ?? 1;
  const renderer = beginRenderer({
    origin,
    scale,
    lengthScale,
    colorMode
  });
  if (!renderer) return;

  const ray = createFirstRay(preparedScene);
  if (!ray) {
    console.log('[Primitive CPU intersection] The first source has no valid first ray.');
    renderer.flush?.();
    return;
  }

  const description = preparedScene.description;
  const traversalDiagnostics = {};
  const candidate = findCandidate(
    description,
    ray,
    traversalDiagnostics
  );

  if (candidate) {
    for (let regionId = 0;
      regionId < candidate.regionCrossingMask.length;
      regionId++) {
      if (!candidate.regionCrossingMask[regionId]) continue;
      drawFilledPrimitiveRegion(
        renderer,
        getRegionCurves(description, regionId),
        REGION_FILL_COLOR,
        REGION_OUTLINE_COLOR
      );
    }
  }

  drawTraversalDiagnostics(
    renderer,
    description,
    traversalDiagnostics
  );

  if (candidate) {
    drawPrimitiveCurve(
      renderer,
      description.curves[candidate.curveId].geometry,
      SELECTED_CURVE_COLOR,
      3
    );
  }

  renderer.drawRay({
    p1: { x: ray.originX, y: ray.originY },
    p2: {
      x: ray.originX + ray.directionX,
      y: ray.originY + ray.directionY
    }
  }, RAY_COLOR);

  if (candidate) {
    drawCandidate(
      renderer,
      description,
      ray,
      candidate,
      lengthScale,
      conflictNames,
      normalConflictType
    );
  } else {
    console.log('[Primitive CPU intersection] No potential hits.');
  }
  renderer.flush?.();
  return candidate;
}

function drawTraversalDiagnostics(renderer, description, diagnostics) {
  if (!diagnostics.nodeStates) return;
  const nodes = description.bvh.nodes;
  for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
    const state = diagnostics.nodeStates[nodeIndex];
    let color;
    switch (state) {
      case BVH_NODE_TESTED:
        color = TESTED_BOUNDS_COLOR;
        break;
      case BVH_NODE_MISSED:
        color = MISSED_BOUNDS_COLOR;
        break;
      case BVH_NODE_PRUNED:
        color = PRUNED_BOUNDS_COLOR;
        break;
      default:
        continue;
    }
    drawBounds(
      renderer,
      nodes[nodeIndex].bounds,
      color,
      Math.max(0.75, 2.5 / (nodes[nodeIndex].depth + 1))
    );
  }

  for (const curveId of diagnostics.testedCurveIds) {
    drawPrimitiveCurve(
      renderer,
      description.curves[curveId].geometry,
      TESTED_CURVE_COLOR,
      2
    );
  }
  console.log(
    '[Primitive CPU BVH] green=tested box, red=missed box, purple=distance-pruned box, orange=tested curve'
  );
}

function drawBounds(renderer, bounds, color, lineWidth) {
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY }
  ];
  for (let index = 0; index < corners.length; index++) {
    renderer.drawSegment({
      p1: corners[index],
      p2: corners[(index + 1) % corners.length]
    }, color, false, [], lineWidth);
  }
}

function drawCandidate(
  renderer,
  description,
  ray,
  candidate,
  lengthScale,
  conflictNames,
  normalConflictType
) {
  const representativeCurve = description.curves[candidate.curveId];
  const discardRay = candidate.conflictType === normalConflictType;
  const point = {
    x: ray.originX + candidate.s * ray.directionX,
    y: ray.originY + candidate.s * ray.directionY
  };
  const normalLength = 12 * lengthScale;
  renderer.drawSegment({
    p1: point,
    p2: {
      x: point.x + candidate.normalX * normalLength,
      y: point.y + candidate.normalY * normalLength
    }
  }, NORMAL_COLOR, true);
  renderer.drawPoint(point, HIT_COLOR, 8);
  console.log(
    '[Primitive CPU candidate] curve %d (%s), owner=%s:%d, s=%s, u=%s, sigma=%s, regions=%s%s',
    candidate.curveId,
    representativeCurve.geometry.kind,
    representativeCurve.ownerKind,
    representativeCurve.ownerId,
    candidate.s,
    candidate.u,
    candidate.sigma,
    formatRegionIds(candidate.regionCrossingMask),
    discardRay ? ' [discard ray]' : ''
  );
  if (candidate.conflictType !== 0) {
    console.warn(
      '[Primitive CPU candidate] %s conflict at curve %d%s',
      conflictNames[candidate.conflictType],
      candidate.conflictCurveId,
      discardRay ? ' [discard ray]' : ''
    );
  }
}

function getRegionCurves(description, regionId) {
  return description.curves
    .filter(curve =>
      curve.ownerKind === 'region' && curve.ownerId === regionId
    )
    .map(curve => curve.geometry);
}

function drawFilledPrimitiveRegion(
  renderer,
  geometries,
  fillColor,
  outlineColor
) {
  if (!renderer.ctx) {
    for (const geometry of geometries) {
      drawPrimitiveCurve(renderer, geometry, outlineColor, 1);
    }
    return;
  }

  const ctx = renderer.ctx;
  ctx.save();
  ctx.fillStyle = renderer.rgbaToCssColor(fillColor);
  ctx.beginPath();
  let previousPoint = null;
  for (const geometry of geometries) {
    const points = samplePreparedCurve(geometry);
    if (points.length === 0) continue;
    const start = points[0];
    const connectionTolerance = Math.max(
      geometry.positionTolerance,
      geometry.endpointTolerance ?? 0
    );
    if (
      !previousPoint ||
      Math.hypot(
        previousPoint.x - start.x,
        previousPoint.y - start.y
      ) > connectionTolerance
    ) {
      if (previousPoint) ctx.closePath();
      ctx.moveTo(start.x, start.y);
    } else {
      ctx.lineTo(start.x, start.y);
    }
    for (let pointIndex = 1; pointIndex < points.length; pointIndex++) {
      ctx.lineTo(points[pointIndex].x, points[pointIndex].y);
    }
    previousPoint = geometry.kind === 'circle'
      ? null
      : points[points.length - 1];
    if (geometry.kind === 'circle') ctx.closePath();
  }
  if (previousPoint) ctx.closePath();
  ctx.fill('evenodd');
  ctx.restore();
}

function drawPrimitiveCurve(renderer, geometry, color, lineWidth) {
  const points = samplePreparedCurve(geometry);
  for (let pointIndex = 1; pointIndex < points.length; pointIndex++) {
    renderer.drawSegment({
      p1: points[pointIndex - 1],
      p2: points[pointIndex]
    }, color, false, [], lineWidth);
  }
}

function samplePreparedCurve(geometry) {
  if (geometry.kind === 'circle') {
    const radius = 1 / Math.abs(geometry.signedInvRadius);
    const points = [];
    const sampleCount = 96;
    for (let index = 0; index <= sampleCount; index++) {
      const angle = 2 * Math.PI * index / sampleCount;
      points.push({
        x: geometry.centerX + radius * Math.cos(angle),
        y: geometry.centerY + radius * Math.sin(angle)
      });
    }
    return points;
  }

  let sampleCount;
  switch (geometry.kind) {
    case 'lineSegment':
    case 'smoothLineSegment':
      sampleCount = 1;
      break;
    case 'circularArc': {
      const sweep = 4 * Math.atan(Math.abs(geometry.bulge));
      sampleCount = Math.max(8, Math.ceil(sweep / (Math.PI / 32)));
      break;
    }
    case 'cubicBezier':
      sampleCount = 64;
      break;
    default:
      throw new TypeError(
        `Unsupported prepared curve kind: ${JSON.stringify(geometry.kind)}`
      );
  }
  const points = [];
  for (let index = 0; index <= sampleCount; index++) {
    points.push(evaluatePreparedCurve(geometry, index / sampleCount));
  }
  return points;
}

function formatRegionIds(regionCrossingMask) {
  const regionIds = [];
  for (let regionId = 0; regionId < regionCrossingMask.length; regionId++) {
    if (regionCrossingMask[regionId]) regionIds.push(regionId);
  }
  return regionIds.length > 0 ? regionIds.join(',') : 'none';
}

function createFirstRay(preparedScene) {
  const source = preparedScene?.description?.sources?.[0];
  if (!source || !(source.rayCount > 0)) return null;

  const evaluate = preparedScene.sourceEvaluators[source.sourceTypeId];
  const output = evaluate({
    ...source.params,
    i: 0,
    N: source.rayCount
  });
  const directionLength = Math.hypot(output.d_x, output.d_y);
  if (
    !Number.isFinite(output.x) ||
    !Number.isFinite(output.y) ||
    !(directionLength > 0) ||
    !Number.isFinite(directionLength)
  ) {
    return null;
  }

  return {
    originX: output.x,
    originY: output.y,
    directionX: output.d_x / directionLength,
    directionY: output.d_y / directionLength,
    brightnessS: output.P_s,
    brightnessP: output.P_p,
    wavelength: output.lambda
  };
}
