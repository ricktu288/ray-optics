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
  createInteractionCandidate,
  createInteractionCandidateContext,
  finalizeInteractionCandidate,
  INTERSECTION_CONFLICT_NONE,
  INTERSECTION_CONFLICT_NORMAL
} from '../primitive/interactionCandidate.js';
import {
  createRegionMembershipResult,
  traverseBvhForRegionMembership
} from '../primitive/regionMembership.js';
import {
  traverseBvhForInteraction
} from '../primitive/bvhTraversal.js';
import {
  validateNumericEpsilon
} from '../primitive/numeric.js';
import {
  DEFAULT_SIMULATION_ENGINE_CONFIGS
} from './config.js';
import {
  beginCpuRayRendering,
  createCpuRayRenderState,
  finishCpuRayRendering,
  renderCpuRay
} from './cpuRayRenderer.js';
import {
  allocateInteractionIndexBuffers,
  createInteractionIndexBuffers,
  createInteractionTypeLayout,
  getInteractionTypeIndex,
  resetInteractionIndexBuffers
} from './interactionIndexBuffers.js';
import {
  createCpuDetectorResults,
  prepareCpuOutgoingRayData,
  writeCpuOutgoingRays
} from './cpuOutgoingRays.js';

const MAX_MEMBERSHIP_ATTEMPTS = 4;
const GOLDEN_ANGLE_COS = -0.737368878;
const GOLDEN_ANGLE_SIN = 0.675490294;
const LEGACY_MINIMUM_RAY_BRIGHTNESS = 0.01;
export const NO_HIT_CURVE_ID = -1;
export const TERMINATE_HIT_CURVE_ID = -2;
const SOURCE_OUTPUT_LABELS = [
  'x',
  'y',
  'd_x',
  'd_y',
  'P_s',
  'P_p',
  'lambda'
];

class CpuSimulationRun {
  constructor(engine, options) {
    this.engine = engine;
    this.options = options;
    this.isCancelled = false;
    this.isComplete = false;
    this.phase = 'populate';
    this.rayBuffers = [[], []];
    this.currentRayBufferIndex = 0;
    this.hitBuffer = [];
    this.sourceIndex = 0;
    this.sourceRayIndex = 0;
    this.sourceInputs = null;
    this.membershipRayIndex = 0;
    this.intersectionRayIndex = 0;
    this.interactionIndexRayIndex = 0;
    this.interactionIndexWriteOffsets = null;
    this.interactionIndexBuffers = createInteractionIndexBuffers(
      options.preparedScene.interactionTypeLayout
    );
    this.destinationRayCount = 0;
    this.outgoingTypeIndex = 0;
    this.outgoingInteractionIndex = 0;
    this.outgoingActiveRayCount = 0;
    this.legacySubsamplingIndex = 0;
    this.renderRayIndex = 0;
    this.passIndex = 0;
    this.renderGroupStarts = [0];
    this.renderGroupStartIndex = 0;
    this.processedRayCount = 0;
    this.totalTruncation = 0;
    this.hasRenderedOutput = false;
    this.warningState = {
      totalBrightness: 0,
      first: null
    };
    this.rendering = createRenderingOptions(options);
    this.renderState = createCpuRayRenderState();
    this.detectorResults = createCpuDetectorResults(
      options.preparedScene.description
    );
    this.membershipScratch = createRegionMembershipResult(
      options.preparedScene.description.regions.length
    );
    this.interactionContext = createInteractionCandidateContext(
      options.preparedScene.description,
      engine.numericEpsilon
    );
    this.summary = {
      sourceCount: options.preparedScene.description.sources.length,
      raySlotCount: 0,
      activeSourceRayCount: 0,
      inactiveSourceRayCount: 0,
      invalidSourceRayCount: 0,
      membershipRetryCount: 0,
      membershipDiscardedRayCount: 0,
      activeRayCount: 0,
      weakRayCount: 0,
      finiteHitCount: 0,
      grinStepCount: 0,
      escapingRayCount: 0,
      normalConflictCount: 0,
      regionCount: options.preparedScene.description.regions.length
    };
    this.engine.beginRenderer({
      origin: options.viewport?.origin || { x: 0, y: 0 },
      scale: options.viewport?.scale ?? 1,
      lengthScale: options.viewport?.lengthScale ?? 1,
      colorMode: options.colorMode ?? 'default'
    });
    beginCpuRayRendering(this.engine.ctxMain, this.rendering);
  }

  get currentRayBuffer() {
    return this.rayBuffers[this.currentRayBufferIndex];
  }

  get nextRayBuffer() {
    return this.rayBuffers[1 - this.currentRayBufferIndex];
  }

  async advance({ timeBudgetMs = Infinity } = {}) {
    if (this.isCancelled || this.isComplete) {
      return this.getUpdate();
    }

    const startTime = getCurrentTime();
    do {
      this.advanceOneWorkItem();
    } while (
      !this.isCancelled &&
      !this.isComplete &&
      (
        !Number.isFinite(timeBudgetMs) ||
        getCurrentTime() - startTime < Math.max(0, timeBudgetMs)
      )
    );
    if (
      !this.isComplete &&
      this.phase === 'render' &&
      this.options.colorMode !== 'default'
    ) {
      this.engine.canvasRenderer?.flush?.();
    }
    return this.getUpdate();
  }

  advanceOneWorkItem() {
    switch (this.phase) {
      case 'populate':
        this.populateNextRay();
        break;
      case 'membership':
        this.populateNextMembership();
        break;
      case 'intersection':
        this.populateNextHit();
        break;
      case 'interactionIndexCount':
        this.countNextInteractionIndex();
        break;
      case 'interactionIndexFill':
        this.fillNextInteractionIndex();
        break;
      case 'render':
        this.renderNextRay();
        break;
      case 'outgoing':
        this.writeNextOutgoingInteraction();
        break;
      default:
        throw new Error(`Unknown CPU simulation phase: ${this.phase}`);
    }
  }

  populateNextRay() {
    const { description, sourceEvaluators } = this.options.preparedScene;
    while (this.sourceIndex < description.sources.length) {
      const source = description.sources[this.sourceIndex];
      if (this.sourceRayIndex >= source.rayCount) {
        this.sourceIndex++;
        this.sourceRayIndex = 0;
        this.sourceInputs = null;
        continue;
      }

      if (!this.sourceInputs) {
        this.sourceInputs = {
          ...source.params,
          N: source.rayCount
        };
      }
      this.sourceInputs.i = this.sourceRayIndex;
      const output =
        sourceEvaluators[source.sourceTypeId](this.sourceInputs);
      const { ray, invalid } = createInitialRay(
        output,
        this.summary.regionCount
      );
      const active = isRayActive(ray);
      this.currentRayBuffer.push(ray);
      this.summary.raySlotCount++;
      if (active) {
        this.summary.activeSourceRayCount++;
      } else {
        this.summary.inactiveSourceRayCount++;
      }
      if (invalid) this.summary.invalidSourceRayCount++;
      this.sourceRayIndex++;
      return;
    }

    this.phase = 'membership';
  }

  populateNextMembership() {
    if (this.membershipRayIndex >= this.currentRayBuffer.length) {
      this.summary.activeRayCount =
        this.summary.activeSourceRayCount -
        this.summary.membershipDiscardedRayCount;
      logInitialRayBuffer(this.currentRayBuffer, this.summary);
      this.phase = 'intersection';
      return;
    }

    const ray = this.currentRayBuffer[this.membershipRayIndex++];
    if (!isRayActive(ray)) return;

    const membership = resolveInitialMembership(
      this.options.preparedScene.description,
      ray,
      this.membershipScratch,
      this.engine.numericEpsilon
    );
    this.summary.membershipRetryCount += membership.attemptCount - 1;
    if (!membership.resolved) {
      ray.brightnessS = 0;
      ray.brightnessP = 0;
      this.summary.membershipDiscardedRayCount++;
      return;
    }
    ray.membership.set(this.membershipScratch.regionMask);
  }

  populateNextHit() {
    if (this.intersectionRayIndex >= this.currentRayBuffer.length) {
      this.phase = 'interactionIndexCount';
      return;
    }

    const ray = this.currentRayBuffer[this.intersectionRayIndex++];
    const regionCount = this.summary.regionCount;
    if (!isRayActive(ray)) {
      this.hitBuffer.push(createInteractionCandidate(regionCount, 0));
      return;
    }

    const brightness = ray.brightnessS + ray.brightnessP;
    const minimumBrightness = this.engine.minimumRayBrightness;
    if (brightness < minimumBrightness) {
      this.hitBuffer.push(createInteractionCandidate(regionCount, 0));
      this.totalTruncation += brightness;
      this.summary.weakRayCount++;
      this.processedRayCount++;
      return;
    }

    const maximumDistance = getSmallestPositiveStepSize(
      this.options.preparedScene.description,
      ray.membership
    );
    const candidate = createInteractionCandidate(
      regionCount,
      maximumDistance
    );
    this.interactionContext.maximumDistance = maximumDistance;
    traverseBvhForInteraction(
      this.options.preparedScene.description,
      ray,
      candidate,
      this.interactionContext,
      this.options.preparedScene.description
        .cpuBvhTraversalDiagnostics
    );
    const finalizedCandidate = finalizeInteractionCandidate(
      candidate,
      this.interactionContext,
      ray
    );
    let warningType = candidate.conflictType;
    if (
      candidate.curveId >= 0 &&
      !finalizedCandidate &&
      warningType === INTERSECTION_CONFLICT_NONE
    ) {
      warningType = INTERSECTION_CONFLICT_NORMAL;
    }
    if (warningType !== INTERSECTION_CONFLICT_NONE) {
      this.recordWarning(
        warningType,
        candidate.curveId,
        candidate.conflictCurveId,
        brightness
      );
    }
    if (
      candidate.conflictType === INTERSECTION_CONFLICT_NORMAL ||
      (candidate.curveId >= 0 && !finalizedCandidate)
    ) {
      candidate.curveId = TERMINATE_HIT_CURVE_ID;
      this.summary.normalConflictCount++;
    } else if (candidate.curveId >= 0) {
      this.summary.finiteHitCount++;
    } else if (Number.isFinite(maximumDistance)) {
      this.summary.grinStepCount++;
    } else {
      this.summary.escapingRayCount++;
    }
    this.hitBuffer.push(candidate);
    this.processedRayCount++;
  }

  countNextInteractionIndex() {
    if (
      this.interactionIndexRayIndex >=
      this.hitBuffer.length
    ) {
      this.destinationRayCount =
        allocateInteractionIndexBuffers(
          this.interactionIndexBuffers
        );
      this.interactionIndexWriteOffsets =
        new Uint32Array(this.interactionIndexBuffers.length);
      this.interactionIndexRayIndex = 0;
      this.phase = 'interactionIndexFill';
      return;
    }

    const typeIndex = getInteractionTypeIndex(
      this.options.preparedScene.description,
      this.options.preparedScene.interactionTypeLayout,
      this.hitBuffer[this.interactionIndexRayIndex++]
    );
    if (typeIndex >= 0) {
      this.interactionIndexBuffers[typeIndex]
        .interactionCount++;
    }
  }

  fillNextInteractionIndex() {
    if (
      this.interactionIndexRayIndex >=
      this.hitBuffer.length
    ) {
      logInteractionIndexBuffers(
        this.interactionIndexBuffers,
        this.destinationRayCount
      );
      this.phase = 'render';
      return;
    }

    const sourceRayIndex = this.interactionIndexRayIndex++;
    const typeIndex = getInteractionTypeIndex(
      this.options.preparedScene.description,
      this.options.preparedScene.interactionTypeLayout,
      this.hitBuffer[sourceRayIndex]
    );
    if (typeIndex < 0) return;
    const writeIndex =
      this.interactionIndexWriteOffsets[typeIndex]++;
    this.interactionIndexBuffers[typeIndex]
      .sourceRayIndices[writeIndex] = sourceRayIndex;
  }

  recordWarning(type, curveId, conflictingCurveId, brightness) {
    this.warningState.totalBrightness += brightness;
    if (this.warningState.first) return;
    this.warningState.first = {
      type,
      rayIndex: this.intersectionRayIndex - 1,
      curveId,
      conflictingCurveId
    };
  }

  renderNextRay() {
    if (this.renderRayIndex >= this.currentRayBuffer.length) {
      if (this.destinationRayCount === 0) {
        this.completeSimulation();
        return;
      }
      const destination = this.nextRayBuffer;
      destination.length = 0;
      destination.length = this.destinationRayCount;
      this.outgoingTypeIndex = 0;
      this.outgoingInteractionIndex = 0;
      this.outgoingActiveRayCount = 0;
      this.phase = 'outgoing';
      return;
    }

    const rayIndex = this.renderRayIndex++;
    if (
      this.renderGroupStartIndex < this.renderGroupStarts.length &&
      rayIndex === this.renderGroupStarts[this.renderGroupStartIndex]
    ) {
      if (rayIndex > 0) {
        this.renderState = createCpuRayRenderState();
      }
      this.renderGroupStartIndex++;
    }
    this.hasRenderedOutput = renderCpuRay({
      ray: this.currentRayBuffer[rayIndex],
      hit: this.hitBuffer[rayIndex],
      renderer: this.engine.canvasRenderer,
      ctxMain: this.engine.ctxMain,
      rendering: this.rendering,
      lengthScale: this.options.viewport?.lengthScale ?? 1,
      state: this.renderState,
      firstPass: this.passIndex === 0
    }) || this.hasRenderedOutput;
  }

  writeNextOutgoingInteraction() {
    while (
      this.outgoingTypeIndex <
      this.interactionIndexBuffers.length
    ) {
      const type =
        this.interactionIndexBuffers[this.outgoingTypeIndex];
      if (
        this.outgoingInteractionIndex >=
        type.interactionCount
      ) {
        this.outgoingTypeIndex++;
        this.outgoingInteractionIndex = 0;
        continue;
      }

      const localInteractionIndex =
        this.outgoingInteractionIndex++;
      const sourceRayIndex =
        type.sourceRayIndices[localInteractionIndex];
      const activeCount = writeCpuOutgoingRays({
        description: this.options.preparedScene.description,
        prepared: this.options.preparedScene.outgoingRayData,
        type,
        localInteractionIndex,
        sourceRay: this.currentRayBuffer[sourceRayIndex],
        hit: this.hitBuffer[sourceRayIndex],
        destinationRayBuffer: this.nextRayBuffer,
        detectorResults: this.detectorResults
      });
      this.outgoingActiveRayCount +=
        (this.options.colorMode ?? 'default') === 'default' &&
        type.outRayCount >= 2
          ? this.applyLegacyOutgoingSubsampling(
            type,
            localInteractionIndex,
            this.legacySubsamplingIndex++
          )
          : activeCount;
      return;
    }

    this.finishOutgoingPass();
  }

  applyLegacyOutgoingSubsampling(
    type,
    localInteractionIndex,
    samplingIndex
  ) {
    let activeCount = 0;
    for (let outRayIndex = 0;
      outRayIndex < type.outRayCount;
      outRayIndex++) {
      const ray = this.nextRayBuffer[
        type.destinationRayStart +
        outRayIndex * type.interactionCount +
        localInteractionIndex
      ];
      if (!isRayActive(ray)) continue;
      const brightness = ray.brightnessS + ray.brightnessP;
      if (brightness <= LEGACY_MINIMUM_RAY_BRIGHTNESS) {
        this.totalTruncation += brightness;
        const amplification = Math.floor(
          LEGACY_MINIMUM_RAY_BRIGHTNESS / brightness
        ) + 1;
        if (samplingIndex % amplification !== 0) {
          ray.brightnessS = 0;
          ray.brightnessP = 0;
          continue;
        }
        ray.brightnessS *= amplification;
        ray.brightnessP *= amplification;
      }
      activeCount++;
    }
    return activeCount;
  }

  finishOutgoingPass() {
    if (
      this.outgoingActiveRayCount === 0 ||
      this.processedRayCount >=
        (this.options.rayCountLimit ?? Infinity)
    ) {
      this.completeSimulation();
      return;
    }

    this.renderGroupStarts =
      getDestinationRayGroupStarts(
        this.interactionIndexBuffers
      );
    this.currentRayBufferIndex =
      1 - this.currentRayBufferIndex;
    this.nextRayBuffer.length = 0;
    this.hitBuffer = [];
    this.intersectionRayIndex = 0;
    this.interactionIndexRayIndex = 0;
    this.interactionIndexWriteOffsets = null;
    resetInteractionIndexBuffers(
      this.interactionIndexBuffers
    );
    this.destinationRayCount = 0;
    this.renderRayIndex = 0;
    this.renderGroupStartIndex = 0;
    this.renderState = createCpuRayRenderState();
    this.passIndex++;
    this.phase = 'intersection';
  }

  completeSimulation() {
    finishCpuRayRendering({
      renderer: this.engine.canvasRenderer,
      ctxMain: this.engine.ctxMain,
      rendering: this.rendering,
      colorMode: this.options.colorMode ?? 'default'
    });
    this.phase = 'complete';
    this.isComplete = true;
  }

  getUpdate() {
    return {
      status:
        this.isCancelled || this.isComplete
          ? 'complete'
          : 'running',
      progress: {
        processedRayCount: this.processedRayCount,
        totalTruncation: this.totalTruncation,
      },
      outputUpdated: this.hasRenderedOutput && !this.isCancelled,
      result: {
        detectors: this.detectorResults,
        processedRayCount: this.processedRayCount,
        totalTruncation: this.totalTruncation,
        warning: this.warningState.first,
        warningBrightness: this.warningState.totalBrightness,
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
 * CPU primitive simulation engine using the same staged, typed interaction
 * layout intended for the WebGPU implementation.
 */
class CpuSimulationEngine {
  constructor({
    numericEpsilon,
    minimumRayBrightness =
      DEFAULT_SIMULATION_ENGINE_CONFIGS.primitiveCpu
        .minimumRayBrightness,
    ctxMain = null,
    glMain = null,
    ctxVirtual = null
  } = {}) {
    this.kind = 'primitiveCpu';
    this.numericEpsilon = validateNumericEpsilon(numericEpsilon);
    if (
      !Number.isFinite(minimumRayBrightness) ||
      minimumRayBrightness < 0
    ) {
      throw new RangeError(
        'minimumRayBrightness must be a nonnegative finite number.'
      );
    }
    this.minimumRayBrightness = minimumRayBrightness;
    this.ctxMain = ctxMain;
    this.glMain = glMain;
    this.ctxVirtual = ctxVirtual;
    this.canvasRenderer = null;
  }

  async prepare(description) {
    return {
      description,
      interactionTypeLayout:
        createInteractionTypeLayout(description),
      outgoingRayData:
        prepareCpuOutgoingRayData(description),
      sourceEvaluators: description.types.sources.map(type =>
        createDagClosureEvaluator(type.definition.dag, {
          labels: SOURCE_OUTPUT_LABELS
        })
      )
    };
  }

  async createRun(options = {}) {
    return new CpuSimulationRun(this, options);
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

function createInitialRay(output, regionCount) {
  const directionLengthSquared =
    output.d_x * output.d_x + output.d_y * output.d_y;
  const valid =
    Number.isFinite(output.x) &&
    Number.isFinite(output.y) &&
    Number.isFinite(directionLengthSquared) &&
    directionLengthSquared > 0 &&
    Number.isFinite(output.P_s) &&
    output.P_s >= 0 &&
    Number.isFinite(output.P_p) &&
    output.P_p >= 0 &&
    Number.isFinite(output.lambda);
  const brightnessS = valid ? output.P_s : 0;
  const brightnessP = valid ? output.P_p : 0;
  return {
    ray: {
      originX: output.x,
      originY: output.y,
      directionX: output.d_x,
      directionY: output.d_y,
      brightnessS,
      brightnessP,
      wavelength: output.lambda,
      membership: new Uint8Array(regionCount)
    },
    invalid: !valid
  };
}

function isRayActive(ray) {
  return ray.brightnessS !== 0 || ray.brightnessP !== 0;
}

function getSmallestPositiveStepSize(description, membership) {
  let stepSize = Infinity;
  for (let regionId = 0; regionId < membership.length; regionId++) {
    if (!membership[regionId]) continue;
    const regionStepSize = description.regions[regionId].stepSize;
    if (regionStepSize > 0 && regionStepSize < stepSize) {
      stepSize = regionStepSize;
    }
  }
  return stepSize;
}

function createRenderingOptions(options) {
  const rendering = options.rendering ?? {};
  return {
    mode: rendering.mode ?? 'rays',
    simulateColors: Boolean(rendering.simulateColors),
    showRayArrows: Boolean(rendering.showRayArrows),
    observer: rendering.observer ?? null,
    colorMode: options.colorMode ?? 'default',
    wavelengthToColor:
      rendering.wavelengthToColor ??
      ((_wavelength, brightness) => [1, 1, 1, brightness]),
    getThemeRayColor:
      rendering.getThemeRayColor ??
      ((_rayType, alpha) => [1, 1, 1, alpha]),
    getThemeRayDash:
      rendering.getThemeRayDash ??
      (() => []),
    getThemeImageColor:
      rendering.getThemeImageColor ??
      ((_imageType, alpha) => [1, 1, 1, alpha]),
    getThemeImageSize:
      rendering.getThemeImageSize ??
      (() => 5)
  };
}

function resolveInitialMembership(
  description,
  ray,
  result,
  numericEpsilon,
) {
  let testRay = ray;
  for (let attempt = 0; attempt < MAX_MEMBERSHIP_ATTEMPTS; attempt++) {
    traverseBvhForRegionMembership(
      description,
      testRay,
      result,
      numericEpsilon,
      description.cpuBvhTraversalDiagnostics
    );
    if (result.ambiguousCurveId < 0) {
      return {
        resolved: true,
        attemptCount: attempt + 1
      };
    }
    if (
      attempt + 1 >= MAX_MEMBERSHIP_ATTEMPTS ||
      !Number.isFinite(result.nearestForwardS) ||
      !(result.nearestForwardS > 0)
    ) {
      return {
        resolved: false,
        attemptCount: attempt + 1
      };
    }

    const nextDirectionX =
      GOLDEN_ANGLE_COS * testRay.directionX -
      GOLDEN_ANGLE_SIN * testRay.directionY;
    const nextDirectionY =
      GOLDEN_ANGLE_SIN * testRay.directionX +
      GOLDEN_ANGLE_COS * testRay.directionY;
    testRay = {
      originX:
        testRay.originX +
        0.5 * result.nearestForwardS * testRay.directionX,
      originY:
        testRay.originY +
        0.5 * result.nearestForwardS * testRay.directionY,
      directionX: nextDirectionX,
      directionY: nextDirectionY
    };
  }
  return {
    resolved: false,
    attemptCount: MAX_MEMBERSHIP_ATTEMPTS
  };
}

function logInitialRayBuffer(rayBuffer, summary) {
  console.log(
    '[Primitive CPU initialization] sources=%d slots=%d active=%d inactive=%d invalid=%d membershipRetries=%d membershipDiscarded=%d regions=%d',
    summary.sourceCount,
    summary.raySlotCount,
    summary.activeRayCount,
    summary.inactiveSourceRayCount,
    summary.invalidSourceRayCount,
    summary.membershipRetryCount,
    summary.membershipDiscardedRayCount,
    summary.regionCount
  );
  const lastStart = Math.max(0, rayBuffer.length - 5);
  console.log(
    '[Primitive CPU initial rays]\n' +
    `  first:${formatCompactRayRange(
      rayBuffer,
      0,
      Math.min(5, rayBuffer.length)
    )}\n` +
    `  last:${formatCompactRayRange(
      rayBuffer,
      lastStart,
      rayBuffer.length
    )}`
  );
}

function formatCompactRayRange(rayBuffer, start, end) {
  const rays = [];
  for (let rayIndex = start; rayIndex < end; rayIndex++) {
    rays.push(formatCompactRay(rayBuffer[rayIndex], rayIndex));
  }
  return rays.length > 0
    ? `\n    ${rays.join('\n    ')}`
    : ' none';
}

function formatCompactRay(ray, rayIndex) {
  const regionIds = [];
  for (let regionId = 0; regionId < ray.membership.length; regionId++) {
    if (ray.membership[regionId]) regionIds.push(regionId);
  }
  return (
    `#${rayIndex} ` +
    `o=(${formatNumber(ray.originX)},${formatNumber(ray.originY)}) ` +
    `d=(${formatNumber(ray.directionX)},${formatNumber(ray.directionY)}) ` +
    `P=(${formatNumber(ray.brightnessS)},${formatNumber(ray.brightnessP)}) ` +
    `lambda=${formatNumber(ray.wavelength)} ` +
    `regions=[${regionIds.join(',')}]`
  );
}

function logInteractionIndexBuffers(
  buffers,
  destinationRayCount
) {
  const interactionCount = buffers.reduce(
    (count, buffer) => count + buffer.interactionCount,
    0
  );
  const activeTypeCount = buffers.reduce(
    (count, buffer) =>
      count + (buffer.interactionCount > 0 ? 1 : 0),
    0
  );
  const lines = [
    '[Primitive CPU interaction indices] ' +
    `types=${buffers.length} activeTypes=${activeTypeCount} ` +
    `interactions=${interactionCount} ` +
    `destinationSlots=${destinationRayCount}`
  ];
  for (const buffer of buffers) {
    const label = formatInteractionTypeLabel(buffer);
    if (buffer.interactionCount === 0) {
      lines.push(
        `  ${label} hits=0 out=${buffer.outRayCount}`
      );
      continue;
    }
    for (let outRayIndex = 0;
      outRayIndex < buffer.outRayCount;
      outRayIndex++) {
      lines.push(
        `  ${label} out#${outRayIndex} ` +
        formatCompactInteractionIndices(buffer, outRayIndex)
      );
    }
  }
  console.log(lines.join('\n'));
}

function formatInteractionTypeLabel(buffer) {
  switch (buffer.kind) {
    case 'grinStep':
      return 'grinStep';
    case 'regionBoundary':
      return buffer.fresnel
        ? 'regionBoundary[fresnel]'
        : 'regionBoundary[noFresnel]';
    case 'surface':
      return `surface[${buffer.typeId}] ${JSON.stringify(buffer.name)}`;
    case 'detector':
      return `detector[${buffer.typeId}] ${JSON.stringify(buffer.name)}`;
    default:
      throw new TypeError(
        `Unsupported interaction kind: ${JSON.stringify(buffer.kind)}`
      );
  }
}

function formatCompactInteractionIndices(buffer, outRayIndex) {
  const sourceIndices = buffer.sourceRayIndices;
  const count = sourceIndices.length;
  const localIndices = [];
  const firstEnd = Math.min(5, count);
  for (let index = 0; index < firstEnd; index++) {
    localIndices.push(index);
  }
  const lastStart = Math.max(firstEnd, count - 5);
  for (let index = lastStart; index < count; index++) {
    localIndices.push(index);
  }
  const pairs = localIndices.map(index =>
    `${sourceIndices[index]}->` +
    `${buffer.destinationRayStart +
      outRayIndex * buffer.interactionCount + index}`
  );
  if (lastStart > firstEnd) pairs.splice(5, 0, '...');
  return `hits=${count} [${pairs.join(' ')}]`;
}

function getDestinationRayGroupStarts(buffers) {
  const starts = [];
  for (const buffer of buffers) {
    if (buffer.interactionCount === 0) continue;
    for (let outRayIndex = 0;
      outRayIndex < buffer.outRayCount;
      outRayIndex++) {
      starts.push(
        buffer.destinationRayStart +
        outRayIndex * buffer.interactionCount
      );
    }
  }
  return starts;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  return Number.parseFloat(value.toPrecision(7)).toString();
}

function getCurrentTime() {
  return typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export default CpuSimulationEngine;
