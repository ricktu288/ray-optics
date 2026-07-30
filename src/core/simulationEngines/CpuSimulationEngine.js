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
import { traverseBvhForInteraction } from '../primitive/bvhTraversal.js';
import {
  createInteractionCandidate,
  createInteractionCandidateContext,
  finalizeInteractionCandidate,
  INTERSECTION_CONFLICT_NORMAL
} from '../primitive/interactionCandidate.js';
import {
  validateNumericEpsilon
} from '../primitive/numeric.js';
import {
  drawTemporaryFirstRay
} from './temporaryFirstRayIntersection.js';

const CONFLICT_NAMES = [
  'none',
  'merge',
  'region-boundary orientation',
  'normal'
];

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
    return drawTemporaryFirstRay({
      preparedScene,
      viewport,
      colorMode,
      beginRenderer: options => this.beginRenderer(options),
      findCandidate: (description, ray, maximumDistance) =>
        findFirstRayInteractionCandidate(
          description,
          ray,
          this.numericEpsilon,
          maximumDistance,
          description.cpuBvhTraversalDiagnostics
        ),
      conflictNames: CONFLICT_NAMES,
      normalConflictType: INTERSECTION_CONFLICT_NORMAL
    });
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

function findFirstRayInteractionCandidate(
  description,
  ray,
  numericEpsilon,
  maximumDistance,
  traversalDiagnostics
) {
  const context = createInteractionCandidateContext(
    description,
    numericEpsilon,
    maximumDistance
  );
  const candidate = createInteractionCandidate(
    description.regions.length,
    maximumDistance
  );

  traverseBvhForInteraction(
    description,
    ray,
    candidate,
    context,
    traversalDiagnostics
  );
  return finalizeInteractionCandidate(candidate, context, ray);
}

export default CpuSimulationEngine;
