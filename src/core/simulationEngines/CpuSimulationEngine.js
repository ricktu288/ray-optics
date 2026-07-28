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
import { intersectCurveAll } from '../primitive/intersections.js';
import {
  getRoundingErrorFactor,
  validateNumericEpsilon
} from '../primitive/numeric.js';

const RAY_COLOR = [1, 0.75, 0.1, 0.8];
const OTHER_HIT_COLOR = [0.65, 0.65, 0.65, 0.65];
const MERGED_HIT_COLOR = [0.15, 0.75, 1, 1];
const NEAREST_HIT_COLOR = [1, 0.15, 0.1, 1];
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
 * Temporary CPU simulation engine. A run currently visualizes all curve
 * intersections of the first ray emitted by the first source, then completes
 * immediately.
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

    const candidates = [];
    const description = preparedScene.description;
    const curves = description.curves;
    const configuredTolerances = description.numericalTolerances ?? {};
    const normalTolerance = Math.min(Math.PI, Math.max(
      configuredTolerances.surfaceNormal ?? 0,
      getRoundingErrorFactor(NORMAL_ERROR_OPERATION_COUNT, this.numericEpsilon)
    ));
    const maximumNormalChordDistanceSquared =
      4 * Math.sin(normalTolerance * 0.5) ** 2;
    for (let curveId = 0; curveId < curves.length; curveId++) {
      const curve = curves[curveId];
      const minDistance = Math.max(
        curve.geometry.positionTolerance,
        configuredTolerances.forwardDistance ?? 0
      );
      const intersectionResult = intersectCurveAll(curve.geometry, ray, {
        numericEpsilon: this.numericEpsilon,
        minDistance
      });
      for (let candidateIndex = 0;
        candidateIndex < intersectionResult.hits.length;
        candidateIndex++) {
        candidates.push({
          curveId,
          curveKind: curve.geometry.kind,
          candidateIndex,
          hit: intersectionResult.hits[candidateIndex]
        });
      }
    }

    let nearestCandidate = null;
    for (const candidate of candidates) {
      if (!nearestCandidate || candidate.hit.s < nearestCandidate.hit.s) {
        nearestCandidate = candidate;
      }
    }
    if (nearestCandidate) {
      for (const candidate of candidates) {
        candidate.isMerged = candidate !== nearestCandidate &&
          candidate.curveId !== nearestCandidate.curveId &&
          hitsAreMerged(
            nearestCandidate,
            candidate,
            curves,
            configuredTolerances,
            this.numericEpsilon,
            maximumNormalChordDistanceSquared
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

    const normalLength = 12 * lengthScale;
    for (const candidate of candidates) {
      const { hit } = candidate;
      const point = {
        x: ray.originX + hit.s * ray.directionX,
        y: ray.originY + hit.s * ray.directionY
      };
      const isNearest = candidate === nearestCandidate;
      const color = isNearest
        ? NEAREST_HIT_COLOR
        : candidate.isMerged
          ? MERGED_HIT_COLOR
          : OTHER_HIT_COLOR;
      renderer.drawSegment({
        p1: point,
        p2: {
          x: point.x + hit.normalX * normalLength,
          y: point.y + hit.normalY * normalLength
        }
      }, color, true);
      renderer.drawPoint(point, color, isNearest ? 8 : 5);
      console.log(
        '[Primitive CPU intersection] curve %d (%s), candidate %d: s=%s, u=%s, sigma=%s%s',
        candidate.curveId,
        candidate.curveKind,
        candidate.candidateIndex,
        hit.s,
        hit.u,
        hit.sigma,
        isNearest ? ' [nearest]' : candidate.isMerged ? ' [merged]' : ''
      );
    }
    if (candidates.length === 0) {
      console.log('[Primitive CPU intersection] No potential hits.');
    }
    renderer.flush?.();
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

function hitsAreMerged(
  firstCandidate,
  secondCandidate,
  curves,
  configuredTolerances,
  numericEpsilon,
  maximumNormalChordDistanceSquared
) {
  const firstGeometry = curves[firstCandidate.curveId].geometry;
  const secondGeometry = curves[secondCandidate.curveId].geometry;
  const distanceScale = Math.max(
    Math.abs(firstCandidate.hit.s),
    Math.abs(secondCandidate.hit.s),
    Number.MIN_VALUE
  );
  const derivedDistanceTolerance =
    firstGeometry.positionTolerance +
    secondGeometry.positionTolerance +
    getRoundingErrorFactor(
      MERGING_DISTANCE_ERROR_OPERATION_COUNT,
      numericEpsilon
    ) * distanceScale;
  const distanceTolerance = Math.max(
    configuredTolerances.surfaceMerging ?? 0,
    derivedDistanceTolerance
  );
  if (
    Math.abs(firstCandidate.hit.s - secondCandidate.hit.s) >
    distanceTolerance
  ) {
    return false;
  }

  const firstHit = firstCandidate.hit;
  const secondHit = secondCandidate.hit;
  const normalDifferenceX = firstHit.normalX - secondHit.normalX;
  const normalDifferenceY = firstHit.normalY - secondHit.normalY;
  const normalChordDistanceSquared =
    normalDifferenceX * normalDifferenceX +
    normalDifferenceY * normalDifferenceY;
  return normalChordDistanceSquared <= maximumNormalChordDistanceSquared;
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
