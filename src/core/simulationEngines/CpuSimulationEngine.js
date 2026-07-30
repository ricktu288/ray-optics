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
import {
  createRegionMembershipResult,
  traverseBvhForRegionMembership
} from '../primitive/regionMembership.js';
import {
  validateNumericEpsilon
} from '../primitive/numeric.js';
import {
  runTemporaryFirstRayMembership
} from './temporaryFirstRayMembership.js';

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

    this.engine.runFirstRayMembership(this.options);
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
 * Temporary CPU simulation engine. A run currently determines the region
 * membership at the first source ray's origin, then completes immediately.
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

  runFirstRayMembership({
    preparedScene,
    viewport = {},
    colorMode = 'default'
  } = {}) {
    this.beginRenderer({
      origin: viewport.origin || { x: 0, y: 0 },
      scale: viewport.scale ?? 1,
      lengthScale: viewport.lengthScale ?? 1,
      colorMode
    });
    return runTemporaryFirstRayMembership({
      preparedScene,
      findMembership: (description, ray, result) =>
        findFirstRayRegionMembership(
          description,
          ray,
          this.numericEpsilon,
          description.cpuBvhTraversalDiagnostics,
          result
        )
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

function findFirstRayRegionMembership(
  description,
  ray,
  numericEpsilon,
  traversalDiagnostics,
  result = createRegionMembershipResult(description.regions.length)
) {
  return traverseBvhForRegionMembership(
    description,
    ray,
    result,
    numericEpsilon,
    traversalDiagnostics
  );
}

export default CpuSimulationEngine;
