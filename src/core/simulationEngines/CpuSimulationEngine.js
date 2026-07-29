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

import CanvasRenderer from '../CanvasRenderer.js';
import FloatColorRenderer from '../FloatColorRenderer.js';
import { createDagClosureEvaluator } from '../formula/dag-evaluator.js';
import { evaluatePreparedCurve } from '../primitive/curveGeometry.js';
import { intersectProcessedCurve } from '../primitive/intersections.js';
import {
  getRoundingErrorFactor,
  validateNumericEpsilon
} from '../primitive/numeric.js';

const RAY_COLOR = [1, 0.75, 0.1, 0.8];
const REGION_FILL_COLOR = [0.15, 0.65, 1, 0.18];
const REGION_OUTLINE_COLOR = [0.15, 0.65, 1, 0.45];
const SELECTED_CURVE_COLOR = [1, 0.2, 0.75, 1];
const HIT_COLOR = [1, 0.15, 0.1, 1];
const NORMAL_COLOR = [0.15, 0.75, 1, 1];
const MERGING_DISTANCE_ERROR_OPERATION_COUNT = 64;
const NORMAL_ERROR_OPERATION_COUNT = 64;
const CONFLICT_NONE = 0;
const CONFLICT_MERGE = 1;
const CONFLICT_ORIENTATION = 2;
const CONFLICT_NORMAL = 3;
const CONFLICT_NAMES = [
  'none',
  'merge',
  'region-boundary orientation',
  'normal'
];
const ORIENTATION_DIAGNOSTIC_U_MIN = 0.1;
const ORIENTATION_DIAGNOSTIC_U_MAX = 0.9;

class CpuSimulationRun {
  constructor(engine, options) {
    this.engine = engine;
    this.options = options;
    this.isCancelled = false;
    this.isComplete = false;
  }

  async advance() {
    if (this.isCancelled || this.isComplete) {
      return this.getCompleteUpdate();
    }

    this.engine.drawFirstRayIntersections(this.options);
    this.isComplete = true;
    return this.getCompleteUpdate();
  }

  getCompleteUpdate() {
    return {
      status: 'complete',
      progress: {
        processedRayCount: 0,
        totalTruncation: 0,
      },
      outputUpdated: !this.isCancelled,
      result: {
        detectors: [],
        processedRayCount: 0,
        totalTruncation: 0,
        brightnessScale: 0,
      },
    };
  }

  cancel() {
    this.isCancelled = true;
  }

  dispose() {
    this.cancel();
  }
}

/**
 * Temporary CPU simulation engine. A run currently finds and visualizes the
 * interaction candidate of the first ray emitted by the first source, then
 * completes immediately.
 */
class CpuSimulationEngine {
  constructor({
    numericEpsilon,
    ctxMain = null,
    glMain = null,
    ctxVirtual = null
  } = {}) {
    this.kind = 'primitiveCpu';
    this.numericEpsilon = validateNumericEpsilon(numericEpsilon);
    this.ctxMain = ctxMain;
    this.glMain = glMain;
    this.ctxVirtual = ctxVirtual;
    this.canvasRenderer = null;
  }

  async prepare(description) {
    return {
      description,
      sourceEvaluators: description.types.sources.map(type =>
        createDagClosureEvaluator(type.definition.dag)
      )
    };
  }

  async createRun(options = {}) {
    return new CpuSimulationRun(this, options);
  }

  drawFirstRayIntersections({
    preparedScene,
    viewport = {},
    colorMode = 'default'
  } = {}) {
    const origin = viewport.origin || { x: 0, y: 0 };
    const scale = viewport.scale ?? 1;
    const lengthScale = viewport.lengthScale ?? 1;
    const renderer = this.beginRenderer({
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
    const candidate = findFirstRayInteractionCandidate(
      description,
      ray,
      this.numericEpsilon
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
      const normalLength = 12 * lengthScale;
      const representativeCurve = description.curves[candidate.curveId];
      const discardRay = candidate.conflictType === CONFLICT_NORMAL;
      const point = {
        x: ray.originX + candidate.distance * ray.directionX,
        y: ray.originY + candidate.distance * ray.directionY
      };
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
        candidate.distance,
        candidate.u,
        candidate.sigma,
        formatRegionIds(candidate.regionCrossingMask),
        discardRay ? ' [discard ray]' : ''
      );
      if (candidate.conflictType !== CONFLICT_NONE) {
        console.warn(
          '[Primitive CPU candidate] %s conflict at curve %d%s',
          CONFLICT_NAMES[candidate.conflictType],
          candidate.conflictCurveId,
          discardRay ? ' [discard ray]' : ''
        );
      }
    } else {
      console.log('[Primitive CPU intersection] No potential hits.');
    }
    renderer.flush?.();
    return candidate;
  }

  beginRenderer({ origin, scale, lengthScale, colorMode }) {
    if (colorMode === 'default') {
      this.canvasRenderer?.destroy?.();
      this.canvasRenderer = null;
      if (!this.ctxMain) return null;
      this.canvasRenderer = new CanvasRenderer(
        this.ctxMain,
        origin,
        scale,
        lengthScale,
        null,
        this.ctxVirtual
      );
      return this.canvasRenderer;
    }

    if (!this.glMain) {
      throw new Error('WebGL is unavailable.');
    }

    const canReuseRenderer =
      this.canvasRenderer instanceof FloatColorRenderer &&
      this.canvasRenderer.colorMode === colorMode &&
      this.canvasRenderer.scale === scale &&
      this.canvasRenderer.lengthScale === lengthScale &&
      this.canvasRenderer.origin.x === origin.x &&
      this.canvasRenderer.origin.y === origin.y &&
      this.canvasRenderer.width === this.glMain.canvas.width &&
      this.canvasRenderer.height === this.glMain.canvas.height;

    if (canReuseRenderer) {
      this.canvasRenderer.begin();
    } else {
      this.canvasRenderer?.destroy?.();
      this.canvasRenderer = new FloatColorRenderer(
        this.glMain,
        origin,
        scale,
        lengthScale,
        null,
        null,
        colorMode
      );
    }
    return this.canvasRenderer;
  }

  dispose() {
    this.canvasRenderer?.destroy?.();
    this.canvasRenderer = null;
  }
}

/**
 * Temporary engine-local interaction candidate used by the first-ray demo.
 * Positive and negative region crossings are monotonic presence arrays:
 * repeated crossings of one orientation set the same entry again, while a
 * region changes parity only when exactly one orientation is present. A
 * repeated same-orientation hit with `0.1 < u < 0.9` produces an orientation
 * diagnostic because idempotence is expected only near a boundary-piece
 * endpoint.
 *
 * @typedef {Object} InteractionCandidate
 * @property {number} distance
 * @property {number} normalX
 * @property {number} normalY
 * @property {number} u - Native parameter of the representative curve hit.
 * @property {number} sigma - Geometric side of the representative curve hit.
 * @property {number} curveId - Representative curve ID.
 * @property {Uint8Array} positiveRegionCrossings
 * @property {Uint8Array} negativeRegionCrossings
 * @property {Uint8Array} regionCrossingMask
 * @property {number} conflictType - Two-bit conflict severity.
 * @property {number} conflictCurveId - One curve identifying the diagnostic location, or -1.
 */

function findFirstRayInteractionCandidate(description, ray, numericEpsilon) {
  const configuredTolerances = description.numericalTolerances ?? {};
  const normalTolerance = Math.min(Math.PI, Math.max(
    configuredTolerances.surfaceNormal ?? 0,
    getRoundingErrorFactor(NORMAL_ERROR_OPERATION_COUNT, numericEpsilon)
  ));
  const maximumNormalChordDistanceSquared =
    4 * Math.sin(normalTolerance * 0.5) ** 2;
  let candidate = null;

  for (let curveId = 0; curveId < description.curves.length; curveId++) {
    const curve = description.curves[curveId];
    const minDistance = Math.max(
      curve.geometry.positionTolerance,
      configuredTolerances.forwardDistance ?? 0
    );
    const hit = intersectProcessedCurve(
      curve,
      ray,
      ray.wavelength,
      {
        numericEpsilon,
        minDistance
      }
    );
    if (!hit) continue;

    if (!candidate) {
      candidate = createInteractionCandidate(description.regions.length);
      initializeInteractionCandidate(candidate, curveId, curve, hit);
      continue;
    }

    const mergingTolerance = getMergingDistanceTolerance(
      candidate.distancePositionTolerance,
      curve.geometry,
      candidate.distance,
      hit.s,
      configuredTolerances.surfaceMerging ?? 0,
      numericEpsilon
    );
    if (hit.s < candidate.distance - mergingTolerance) {
      initializeInteractionCandidate(candidate, curveId, curve, hit);
      continue;
    }
    if (hit.s > candidate.distance + mergingTolerance) continue;

    mergeHitIntoCandidate(
      candidate,
      description,
      curveId,
      curve,
      hit,
      ray,
      maximumNormalChordDistanceSquared
    );
  }

  if (!candidate) return null;
  for (let regionId = 0;
    regionId < candidate.regionCrossingMask.length;
    regionId++) {
    candidate.regionCrossingMask[regionId] =
      candidate.positiveRegionCrossings[regionId] !==
      candidate.negativeRegionCrossings[regionId]
        ? 1
        : 0;
  }
  return candidate;
}

function createInteractionCandidate(regionCount) {
  return {
    distance: Infinity,
    distancePositionTolerance: 0,
    normalX: 0,
    normalY: 0,
    u: 0,
    sigma: 0,
    curveId: -1,
    positiveRegionCrossings: new Uint8Array(regionCount),
    negativeRegionCrossings: new Uint8Array(regionCount),
    regionCrossingMask: new Uint8Array(regionCount),
    conflictType: CONFLICT_NONE,
    conflictCurveId: -1
  };
}

function initializeInteractionCandidate(
  candidate,
  curveId,
  curve,
  hit
) {
  copyRepresentativeHit(candidate, curveId, curve, hit);
  candidate.positiveRegionCrossings.fill(0);
  candidate.negativeRegionCrossings.fill(0);
  candidate.regionCrossingMask.fill(0);
  candidate.conflictType = CONFLICT_NONE;
  candidate.conflictCurveId = -1;

  if (curve.ownerKind === 'region') {
    getRegionCrossings(candidate, hit.sigma)[curve.ownerId] = 1;
  }
}

function mergeHitIntoCandidate(
  candidate,
  description,
  curveId,
  curve,
  hit,
  ray,
  maximumNormalChordDistanceSquared
) {
  if (candidate.conflictType === CONFLICT_NORMAL) {
    return;
  }

  if (!normalsAreConsistent(
    candidate,
    hit,
    maximumNormalChordDistanceSquared
  )) {
    recordConflict(candidate, CONFLICT_NORMAL, curveId);
    return;
  }

  if (curve.ownerKind === 'region') {
    const crossings = getRegionCrossings(candidate, hit.sigma);
    if (
      crossings[curve.ownerId] &&
      hit.u > ORIENTATION_DIAGNOSTIC_U_MIN &&
      hit.u < ORIENTATION_DIAGNOSTIC_U_MAX
    ) {
      recordConflict(candidate, CONFLICT_ORIENTATION, curveId);
    }
    crossings[curve.ownerId] = 1;
  }

  const currentCurve = description.curves[candidate.curveId];
  const shouldReplace = shouldReplaceRepresentative(
    candidate.curveId,
    currentCurve,
    curveId,
    curve
  );
  const compatible = areHitsCompatible(
    candidate,
    currentCurve,
    hit,
    curve,
    ray
  );

  if (!compatible) {
    recordConflict(
      candidate,
      CONFLICT_MERGE,
      shouldReplace ? candidate.curveId : curveId
    );
  }

  if (shouldReplace) {
    copyRepresentativeHit(candidate, curveId, curve, hit);
  }
}

function copyRepresentativeHit(candidate, curveId, curve, hit) {
  candidate.distance = hit.s;
  candidate.distancePositionTolerance = curve.geometry.positionTolerance;
  candidate.normalX = hit.normalX;
  candidate.normalY = hit.normalY;
  candidate.curveId = curveId;
  candidate.u = hit.u;
  candidate.sigma = hit.sigma;
}

function getRegionCrossings(candidate, sigma) {
  return sigma > 0
    ? candidate.positiveRegionCrossings
    : candidate.negativeRegionCrossings;
}

function recordConflict(candidate, conflictType, curveId) {
  if (conflictType < candidate.conflictType) {
    return;
  }
  candidate.conflictType = conflictType;
  candidate.conflictCurveId = curveId;
}

function shouldReplaceRepresentative(
  currentCurveId,
  currentCurve,
  newCurveId,
  newCurve
) {
  const currentPriority = getOwnerPriority(currentCurve.ownerKind);
  const newPriority = getOwnerPriority(newCurve.ownerKind);
  return newPriority > currentPriority ||
    newPriority === currentPriority && newCurveId < currentCurveId;
}

function getOwnerPriority(ownerKind) {
  switch (ownerKind) {
    case 'surface':
      return 2;
    case 'region':
      return 1;
    case 'detector':
      return 0;
    default:
      throw new TypeError(
        `Unsupported curve owner kind: ${JSON.stringify(ownerKind)}`
      );
  }
}

function areHitsCompatible(
  currentHit,
  currentCurve,
  newHit,
  newCurve,
  ray
) {
  if (
    isHitAtEndpoint(currentCurve.geometry, currentHit, ray) ||
    isHitAtEndpoint(newCurve.geometry, newHit, ray)
  ) {
    return true;
  }
  if (currentCurve.ownerKind === 'region') {
    return newCurve.mergesWithGlass;
  }
  if (newCurve.ownerKind === 'region') {
    return currentCurve.mergesWithGlass;
  }
  return false;
}

function getMergingDistanceTolerance(
  firstPositionTolerance,
  secondGeometry,
  firstDistance,
  secondDistance,
  configuredTolerance,
  numericEpsilon
) {
  const distanceScale = Math.max(
    Math.abs(firstDistance),
    Math.abs(secondDistance),
    Number.MIN_VALUE
  );
  const derivedDistanceTolerance =
    firstPositionTolerance + secondGeometry.positionTolerance +
    getRoundingErrorFactor(
      MERGING_DISTANCE_ERROR_OPERATION_COUNT,
      numericEpsilon
    ) * distanceScale;
  return Math.max(
    configuredTolerance,
    derivedDistanceTolerance
  );
}

function normalsAreConsistent(
  candidate,
  hit,
  maximumNormalChordDistanceSquared
) {
  const normalDifferenceX = candidate.normalX - hit.normalX;
  const normalDifferenceY = candidate.normalY - hit.normalY;
  const normalChordDistanceSquared =
    normalDifferenceX * normalDifferenceX +
    normalDifferenceY * normalDifferenceY;
  return normalChordDistanceSquared <= maximumNormalChordDistanceSquared;
}

function isHitAtEndpoint(geometry, hit, ray) {
  if (geometry.kind === 'circle') return false;
  if (hit.u === 0 || hit.u === 1) return true;
  const hitPoint = {
    x: ray.originX + (hit.s ?? hit.distance) * ray.directionX,
    y: ray.originY + (hit.s ?? hit.distance) * ray.directionY
  };
  const endpointTolerance = Math.max(
    geometry.positionTolerance,
    geometry.endpointTolerance ?? 0
  );
  for (const endpointU of [0, 1]) {
    const endpoint = evaluatePreparedCurve(geometry, endpointU);
    if (
      Math.hypot(
        hitPoint.x - endpoint.x,
        hitPoint.y - endpoint.y
      ) <= endpointTolerance
    ) {
      return true;
    }
  }
  return false;
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

export default CpuSimulationEngine;
