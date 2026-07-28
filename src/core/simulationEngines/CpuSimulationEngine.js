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
      if (candidate.primaryCurveId !== null) {
        drawPrimitiveCurve(
          renderer,
          description.curves[candidate.primaryCurveId].geometry,
          SELECTED_CURVE_COLOR,
          3
        );
      }
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
      if (candidate.primaryCurveId !== null) {
        console.log(
          '[Primitive CPU candidate] curve %d (%s), owner=%s:%d, s=%s, u=%s, sigma=%s, regions=%s%s',
          candidate.primaryCurveId,
          description.curves[candidate.primaryCurveId].geometry.kind,
          candidate.primaryKind,
          candidate.primaryOwnerId,
          candidate.distance,
          candidate.u,
          candidate.sigma,
          formatRegionIds(candidate.regionCrossingMask),
          candidate.discardRay ? ' [discard ray]' : ''
        );
      } else {
        console.log(
          '[Primitive CPU candidate] region boundary, s=%s, regions=%s%s',
          candidate.distance,
          formatRegionIds(candidate.regionCrossingMask),
          candidate.discardRay ? ' [discard ray]' : ''
        );
      }
      if (candidate.undefinedBehavior) {
        console.warn(
          '[Primitive CPU candidate] undefined behavior%s',
          candidate.discardRay ? ' [discard ray]' : ''
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
 * repeated same-orientation hit with `0.1 < u < 0.9` is reported as undefined
 * behavior because idempotence is expected only near a boundary-piece
 * endpoint.
 *
 * @typedef {Object} InteractionCandidate
 * @property {number} distance
 * @property {number} normalX
 * @property {number} normalY
 * @property {number|null} u - Native parameter of the selected primary surface or detector, or null for a boundary-only event.
 * @property {number|null} sigma - Side of the selected primary surface or detector, or null for a boundary-only event.
 * @property {'surface'|'detector'|null} primaryKind
 * @property {number|null} primaryOwnerId
 * @property {number|null} primaryCurveId
 * @property {Uint8Array} positiveRegionCrossings
 * @property {Uint8Array} negativeRegionCrossings
 * @property {Uint8Array} regionCrossingMask
 * @property {boolean} undefinedBehavior
 * @property {boolean} discardRay
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
      candidate = createInteractionCandidate(
        description.regions.length,
        curve,
        hit
      );
      addOwnerToCandidate(candidate, description, curveId, curve, hit, ray);
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
      candidate = createInteractionCandidate(
        description.regions.length,
        curve,
        hit
      );
      addOwnerToCandidate(candidate, description, curveId, curve, hit, ray);
      continue;
    }
    if (hit.s > candidate.distance + mergingTolerance) continue;

    if (!normalsAreConsistent(
      candidate,
      hit,
      maximumNormalChordDistanceSquared
    )) {
      candidate.discardRay = true;
      candidate.undefinedBehavior = true;
      continue;
    }
    addOwnerToCandidate(candidate, description, curveId, curve, hit, ray);
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

function createInteractionCandidate(regionCount, curve, hit) {
  return {
    distance: hit.s,
    distancePositionTolerance: curve.geometry.positionTolerance,
    normalX: hit.normalX,
    normalY: hit.normalY,
    u: null,
    sigma: null,
    primaryKind: null,
    primaryOwnerId: null,
    primaryCurveId: null,
    primaryAtEndpoint: false,
    hasRegionBoundary: false,
    positiveRegionCrossings: new Uint8Array(regionCount),
    negativeRegionCrossings: new Uint8Array(regionCount),
    regionCrossingMask: new Uint8Array(regionCount),
    undefinedBehavior: false,
    discardRay: false,
  };
}

function addOwnerToCandidate(
  candidate,
  description,
  curveId,
  curve,
  hit,
  ray
) {
  if (curve.ownerKind === 'region') {
    candidate.hasRegionBoundary = true;
    const crossings = hit.sigma > 0
      ? candidate.positiveRegionCrossings
      : candidate.negativeRegionCrossings;
    if (
      crossings[curve.ownerId] &&
      hit.u > 0.1 &&
      hit.u < 0.9
    ) {
      candidate.undefinedBehavior = true;
    }
    crossings[curve.ownerId] = 1;
    if (candidate.primaryKind) {
      checkPrimaryRegionCompatibility(candidate, description);
    }
    return;
  }

  const atEndpoint = isHitAtEndpoint(curve.geometry, hit, ray);
  if (!candidate.primaryKind) {
    setPrimaryCandidate(
      candidate,
      curveId,
      curve,
      hit,
      atEndpoint
    );
    if (candidate.hasRegionBoundary) {
      checkPrimaryRegionCompatibility(candidate, description);
    }
    return;
  }

  if (!candidate.primaryAtEndpoint && !atEndpoint) {
    candidate.undefinedBehavior = true;
  }

  const shouldReplacePrimary =
    candidate.primaryKind === 'detector' &&
      curve.ownerKind === 'surface' ||
    candidate.primaryKind === curve.ownerKind &&
      curveId < candidate.primaryCurveId;
  if (shouldReplacePrimary) {
    setPrimaryCandidate(
      candidate,
      curveId,
      curve,
      hit,
      atEndpoint
    );
  }
  if (candidate.hasRegionBoundary) {
    checkPrimaryRegionCompatibility(candidate, description);
  }
}

function setPrimaryCandidate(candidate, curveId, curve, hit, atEndpoint) {
  candidate.primaryKind = curve.ownerKind;
  candidate.primaryOwnerId = curve.ownerId;
  candidate.primaryCurveId = curveId;
  candidate.primaryAtEndpoint = atEndpoint;
  candidate.normalX = hit.normalX;
  candidate.normalY = hit.normalY;
  candidate.u = hit.u;
  candidate.sigma = hit.sigma;
}

function checkPrimaryRegionCompatibility(candidate, description) {
  if (candidate.primaryKind === 'detector') {
    candidate.undefinedBehavior = true;
    return;
  }
  const surface = description.surfaces[candidate.primaryOwnerId];
  const surfaceType =
    description.types.surfaces[surface.surfaceTypeId].definition;
  if (!surfaceType.mergesWithGlass) {
    candidate.undefinedBehavior = true;
  }
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
    x: ray.originX + hit.s * ray.directionX,
    y: ray.originY + hit.s * ray.directionY
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
