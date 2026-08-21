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

import CanvasRenderer from '../../CanvasRenderer.js';
import FloatColorRenderer from '../../FloatColorRenderer.js';
import { createDagEvaluator } from '../../formula/dag-evaluator.js';
import {
  createInteractionCandidate,
  createInteractionCandidateContext,
  finalizeInteractionCandidate,
  INTERSECTION_CONFLICT_NONE,
  INTERSECTION_CONFLICT_NORMAL,
  INTERSECTION_TOLERANCE_MERGING,
  INTERSECTION_TOLERANCE_NONE,
  INTERSECTION_TOLERANCE_NORMAL,
  INTERSECTION_TOLERANCE_NORMAL_CONSTRUCTION
} from '../../primitive/interactionCandidate.js';
import {
  createRegionMembershipResult,
  traverseBvhForRegionMembership
} from '../../primitive/regionMembership.js';
import {
  traverseBvhForInteraction
} from '../../primitive/bvhTraversal.js';
import {
  validateNumericEpsilon
} from '../../primitive/numeric.js';
import {
  beginCpuRayRendering,
  createCpuRayRenderState,
  finishCpuRayRendering,
  renderCpuRay
} from './cpuRayRenderer.js';
import {
  createInteractionTypeLayout,
  getInteractionTypeIndex
} from '../interactionIndexBuffers.js';
import {
  createCpuDetectorResults,
  prepareCpuOutgoingRayData,
  writeCpuOutgoingRays
} from './cpuOutgoingRays.js';
import {
  normalizeRayPowerCutoffMode,
  RAY_POWER_CUTOFF_MODE_TRUNCATE,
  collectRayPowerQueue
} from '../stableRayPowerSampling.js';
import {
  deriveWebGpuWavelengthRange
} from '../webgpu/webGpuParameterRanges.js';
import {
  DEFAULT_AMBIGUOUS_RAY_WARNING_SAFETY_FACTOR,
  estimateAmbiguousRayWarningPowerThreshold
} from '../ambiguousRayWarning.js';

const MAX_MEMBERSHIP_ATTEMPTS = 4;
const GOLDEN_ANGLE_COS = -0.737368878;
const GOLDEN_ANGLE_SIN = 0.675490294;
const DEFAULT_COLOR_MINIMUM_RAY_POWER = 0.01;
const DEFAULT_RAY_POWER_CUTOFF = 1e-6;
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

export class CpuSimulationRun {
  constructor(engine, options) {
    this.engine = engine;
    this.options = options;
    const rayPowerCutoff =
      options.rayPowerCutoff ?? DEFAULT_RAY_POWER_CUTOFF;
    if (
      typeof rayPowerCutoff !== 'number' ||
      Number.isNaN(rayPowerCutoff) ||
      rayPowerCutoff < 0
    ) {
      throw new RangeError(
        'rayPowerCutoff must be a nonnegative number.'
      );
    }
    this.rayPowerCutoff = (options.colorMode ?? 'default') === 'default'
      ? Math.max(DEFAULT_COLOR_MINIMUM_RAY_POWER, rayPowerCutoff)
      : rayPowerCutoff;
    this.rayPowerCutoffMode = normalizeRayPowerCutoffMode(
      options.rayPowerCutoffMode
    );
    this.maxRayDepth = normalizeMaxRayDepth(options.maxRayDepth);
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
    this.samplingGeneration = 0;
    this.passIndex = 0;
    this.processedRayCount = 0;
    this.totalTruncation = 0;
    this.hasRenderedOutput = false;
    this.warningState = {
      totalPower: 0,
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
      colorMode: options.colorMode ?? 'default',
      rendering: this.rendering
    });
    beginCpuRayRendering(this.engine.ctxMain, this.rendering);
  }

  get currentRayBuffer() {
    return this.rayBuffers[this.currentRayBufferIndex];
  }

  get nextRayBuffer() {
    return this.rayBuffers[1 - this.currentRayBufferIndex];
  }

  async advance({
    timeBudgetMs = Infinity,
    itemBudget = Infinity
  } = {}) {
    if (this.isCancelled || this.isComplete) {
      return this.getUpdate();
    }

    const startTime = getCurrentTime();
    let processedItemCount = 0;
    do {
      this.advanceOneWorkItem();
      processedItemCount++;
    } while (
      !this.isCancelled &&
      !this.isComplete &&
      processedItemCount < Math.max(1, itemBudget) &&
      (
        !Number.isFinite(timeBudgetMs) ||
        getCurrentTime() - startTime < Math.max(0, timeBudgetMs)
      )
    );
    if (
      !this.isComplete &&
      this.phase === 'megakernel' &&
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
      case 'megakernel':
        this.advanceMegakernel();
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
        this.summary.regionCount,
        this.options.preparedScene.wavelengthRange
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
      if (this.engine.logExecutionDebugInfo !== false) {
        logInitialRayBuffer(this.currentRayBuffer, this.summary);
      }
      this.beginMegakernelCycle();
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
      ray.powerS = 0;
      ray.powerP = 0;
      this.summary.membershipDiscardedRayCount++;
      return;
    }
    ray.membership.set(this.membershipScratch.regionMask);
  }

  beginMegakernelCycle() {
    this.phase = 'megakernel';
    this.megakernelIteration = 0;
    this.megakernelRayIndex = 0;
    this.megakernelLanes = this.currentRayBuffer.map(ray => ({
      ray,
      depth: ray.depth ?? 0,
      active: isRayActive(ray)
    }));
    this.megakernelOutputs = this.currentRayBuffer.map(() => []);
    this.hitBuffer = new Array(this.currentRayBuffer.length);
    this.renderState = createCpuRayRenderState();
  }

  advanceMegakernel() {
    if (this.megakernelRayIndex >= this.megakernelLanes.length) {
      const hasContinuation = this.megakernelLanes.some(lane => lane.active);
      if (
        hasContinuation &&
        this.megakernelIteration + 1 < this.engine.maxLocalIterations
      ) {
        this.megakernelIteration++;
        this.megakernelRayIndex = 0;
        this.renderState = createCpuRayRenderState();
        return;
      }
      this.finishMegakernelCycle();
      return;
    }

    const rayIndex = this.megakernelRayIndex++;
    const lane = this.megakernelLanes[rayIndex];
    if (!lane.active) {
      renderCpuRay({
        ray: lane.ray,
        hit: createInteractionCandidate(this.summary.regionCount, 0),
        renderer: this.engine.canvasRenderer,
        ctxMain: this.engine.ctxMain,
        rendering: this.rendering,
        lengthScale: this.options.viewport?.lengthScale ?? 1,
        state: this.renderState,
        firstPass: lane.depth === 0
      });
      return;
    }

    const power = lane.ray.powerS + lane.ray.powerP;
    if (
      this.rayPowerCutoffMode === RAY_POWER_CUTOFF_MODE_TRUNCATE &&
      this.rayPowerCutoff > 0 &&
      power < this.rayPowerCutoff
    ) {
      this.totalTruncation += power;
      this.summary.weakRayCount++;
      lane.active = false;
      this.renderState.lastRay = null;
      this.renderState.lastIntersection = null;
      return;
    }

    const hit = this.traceRay(lane.ray, rayIndex);
    this.hitBuffer[rayIndex] = hit;
    this.hasRenderedOutput = renderCpuRay({
      ray: lane.ray,
      hit,
      renderer: this.engine.canvasRenderer,
      ctxMain: this.engine.ctxMain,
      rendering: this.rendering,
      lengthScale: this.options.viewport?.lengthScale ?? 1,
      state: this.renderState,
      firstPass: lane.depth === 0
    }) || this.hasRenderedOutput;

    const typeIndex = getInteractionTypeIndex(
      this.options.preparedScene.description,
      this.options.preparedScene.interactionTypeLayout,
      hit
    );
    if (typeIndex < 0) {
      if (hit.curveId === TERMINATE_HIT_CURVE_ID) {
        this.totalTruncation += power;
      }
      lane.active = false;
      return;
    }
    if (lane.depth >= this.maxRayDepth) {
      this.totalTruncation += lane.ray.powerS + lane.ray.powerP;
      lane.active = false;
      return;
    }

    const outputs = this.createLocalOutgoingRays(
      typeIndex,
      lane.ray,
      hit,
      lane.depth + 1
    );
    const continuation = outputs.shift();
    if (continuation) {
      lane.ray = continuation;
      lane.depth++;
      lane.active = true;
    } else {
      lane.active = false;
    }
    this.megakernelOutputs[rayIndex].push(...outputs);
  }

  traceRay(ray, rayIndex) {
    const description = this.options.preparedScene.description;
    const regionCount = this.summary.regionCount;
    const maximumDistance = getSmallestPositiveStepSize(
      description,
      ray.membership
    );
    const candidate = createInteractionCandidate(
      regionCount,
      maximumDistance
    );
    this.interactionContext.maximumDistance = maximumDistance;
    traverseBvhForInteraction(
      description,
      ray,
      candidate,
      this.interactionContext,
      description.cpuBvhTraversalDiagnostics
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
      const tolerance = candidate.conflictToleranceKind ===
        INTERSECTION_TOLERANCE_NONE
        ? {
          kind: INTERSECTION_TOLERANCE_NORMAL_CONSTRUCTION,
          value: this.interactionContext.tolerancePolicy.tangent
        }
        : {
          kind: candidate.conflictToleranceKind,
          value: candidate.conflictTolerance
        };
      this.recordWarning(
        warningType,
        candidate.curveId,
        candidate.conflictCurveId,
        ray.powerS + ray.powerP,
        tolerance,
        rayIndex
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
    this.processedRayCount++;
    return candidate;
  }

  createLocalOutgoingRays(typeIndex, sourceRay, hit, depth) {
    const baseType =
      this.options.preparedScene.interactionTypeLayout.types[typeIndex];
    const type = {
      ...baseType,
      interactionCount: 1,
      destinationRayStart: 0
    };
    const outputs = new Array(type.outRayCount);
    writeCpuOutgoingRays({
      description: this.options.preparedScene.description,
      prepared: this.options.preparedScene.outgoingRayData,
      type,
      localInteractionIndex: 0,
      sourceRay,
      hit,
      destinationRayBuffer: outputs,
      detectorResults: this.detectorResults
    });
    return outputs.filter(isRayActive).map(ray => {
      ray.depth = depth;
      return ray;
    });
  }

  finishMegakernelCycle() {
    for (let rayIndex = 0;
      rayIndex < this.megakernelLanes.length;
      rayIndex++) {
      const lane = this.megakernelLanes[rayIndex];
      if (lane.active) this.megakernelOutputs[rayIndex].push(lane.ray);
    }
    const outputSlots = [];
    const maximumSlotCount = this.megakernelOutputs.reduce(
      (maximum, outputs) => Math.max(maximum, outputs.length),
      0
    );
    for (let slot = 0; slot < maximumSlotCount; slot++) {
      for (const outputs of this.megakernelOutputs) {
        if (outputs[slot]) outputSlots.push(outputs[slot]);
      }
    }
    const sampled = collectRayPowerQueue(
      outputSlots,
      this.rayPowerCutoff,
      ++this.samplingGeneration,
      this.rayPowerCutoffMode
    );
    this.summary.weakRayCount += sampled.weakRayCount;
    this.totalTruncation += sampled.weakRayPower;
    const destination = this.nextRayBuffer;
    destination.length = 0;
    for (const ray of sampled.rays) destination.push(ray);
    this.currentRayBufferIndex = 1 - this.currentRayBufferIndex;
    this.nextRayBuffer.length = 0;
    this.passIndex++;

    if (
      this.currentRayBuffer.length === 0 ||
      this.processedRayCount >= (this.options.rayCountLimit ?? Infinity)
    ) {
      this.completeSimulation();
      return;
    }
    this.beginMegakernelCycle();
  }

  recordWarning(
    type,
    curveId,
    conflictingCurveId,
    power,
    tolerance,
    rayIndex = 0
  ) {
    this.warningState.totalPower += power;
    if (this.warningState.first) return;
    this.warningState.first = {
      type,
      rayIndex,
      curveId,
      conflictingCurveId,
      tolerance: serializeWarningTolerance(tolerance)
    };
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
    const warningPower = this.warningState.totalPower;
    const warningThreshold = estimateAmbiguousRayWarningPowerThreshold({
      numericEpsilon: this.engine.numericEpsilon,
      processedRayCount: this.processedRayCount,
      description: this.options.preparedScene.description,
      safetyFactor: this.engine.ambiguousRayWarningSafetyFactor
    });
    const warning = this.warningState.first &&
      warningPower > warningThreshold
      ? {
        ...this.warningState.first,
        ambiguousPower: warningPower
      }
      : null;
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
        warning,
        warningPower,
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

export function normalizeMaxRayDepth(value) {
  if (!Number.isFinite(value)) return Infinity;
  return Math.max(0, Math.floor(value));
}

function serializeWarningTolerance(tolerance) {
  switch (tolerance.kind) {
    case INTERSECTION_TOLERANCE_MERGING:
      return {
        kind: 'interactionMerging',
        unit: 'sceneUnits',
        value: tolerance.value
      };
    case INTERSECTION_TOLERANCE_NORMAL:
      return {
        kind: 'interactionNormal',
        unit: 'radians',
        value: tolerance.value
      };
    case INTERSECTION_TOLERANCE_NORMAL_CONSTRUCTION:
      return {
        kind: 'normalConstruction',
        unit: 'normalizedMagnitude',
        value: tolerance.value
      };
    default:
      throw new TypeError(
        `Unsupported warning tolerance kind: ${tolerance.kind}`
      );
  }
}

/**
 * CPU primitive simulation engine using the same stable outgoing-ray queue
 * semantics as the WebGPU megakernel implementation.
 */
class CpuSimulationEngine {
  constructor({
    // JavaScript Number arithmetic is binary64. Keep binary64 as the CPU
    // default so this backend can diagnose failures caused by WebGPU f32
    // precision; tests may still supply a different epsilon explicitly.
    numericEpsilon = Number.EPSILON,
    ctxMain = null,
    glMain = null,
    ctxVirtual = null,
    config = {}
  } = {}) {
    this.kind = 'primitiveCpu';
    this.numericEpsilon = validateNumericEpsilon(numericEpsilon);
    this.ctxMain = ctxMain;
    this.glMain = glMain;
    this.ctxVirtual = ctxVirtual;
    this.canvasRenderer = null;
    this.configure(config);
    this.logExecutionDebugInfo = true;
  }

  configure(config = {}) {
    const timeBudgetMs = config.timeBudgetMs ?? 200;
    if (!Number.isFinite(timeBudgetMs) || timeBudgetMs <= 0) {
      throw new RangeError('timeBudgetMs must be positive and finite.');
    }
    this.timeBudgetMs = timeBudgetMs;
    const maxLocalIterations = config.maxLocalIterations ?? 256;
    if (
      !Number.isSafeInteger(maxLocalIterations) ||
      maxLocalIterations <= 0
    ) {
      throw new RangeError(
        'maxLocalIterations must be a positive safe integer.'
      );
    }
    this.maxLocalIterations = maxLocalIterations;
    const ambiguousRayWarningSafetyFactor =
      config.ambiguousRayWarningSafetyFactor ??
      DEFAULT_AMBIGUOUS_RAY_WARNING_SAFETY_FACTOR;
    if (!Number.isFinite(ambiguousRayWarningSafetyFactor) ||
        ambiguousRayWarningSafetyFactor < 0) {
      throw new RangeError(
        'ambiguousRayWarningSafetyFactor must be finite and nonnegative.'
      );
    }
    this.ambiguousRayWarningSafetyFactor =
      ambiguousRayWarningSafetyFactor;
  }

  async prepare(description, {
    violetWavelength,
    redWavelength,
    logDebugInfo = false
  } = {}) {
    const [wavelengthRange] = deriveWebGpuWavelengthRange({
      violetWavelength,
      redWavelength
    });
    return {
      description,
      wavelengthRange,
      logDebugInfo: Boolean(logDebugInfo),
      interactionTypeLayout:
        createInteractionTypeLayout(description),
      outgoingRayData:
        prepareCpuOutgoingRayData(description),
      sourceEvaluators: description.types.sources.map(type =>
        createDagEvaluator(type.definition.dag, {
          labels: SOURCE_OUTPUT_LABELS
        })
      )
    };
  }

  async createRun(options = {}) {
    return new CpuSimulationRun(this, options);
  }

  beginRenderer({ origin, scale, lengthScale, colorMode }) {
    if (!this.ctxMain && !this.glMain) {
      this.canvasRenderer?.destroy?.();
      this.canvasRenderer = null;
      return null;
    }

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

function createInitialRay(output, regionCount, wavelengthRange) {
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
    Number.isFinite(output.lambda) &&
    output.lambda >= wavelengthRange[0] &&
    output.lambda <= wavelengthRange[1];
  const powerS = valid ? output.P_s : 0;
  const powerP = valid ? output.P_p : 0;
  return {
    ray: {
      originX: output.x,
      originY: output.y,
      directionX: output.d_x,
      directionY: output.d_y,
      powerS,
      powerP,
      wavelength: output.lambda,
      membership: new Uint8Array(regionCount),
      depth: 0
    },
    invalid: !valid
  };
}

function isRayActive(ray) {
  return ray.powerS !== 0 || ray.powerP !== 0;
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
    `P=(${formatNumber(ray.powerS)},${formatNumber(ray.powerP)}) ` +
    `lambda=${formatNumber(ray.wavelength)} ` +
    `regions=[${regionIds.join(',')}]`
  );
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
