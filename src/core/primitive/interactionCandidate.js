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

import { evaluatePreparedCurve } from './curveGeometry.js';
import {
  ensureCurveIntersectionNormal,
  intersectCurve
} from './nearestIntersection.js';
import {
  getIntersectionTolerancePolicy,
  validateNumericEpsilon
} from './numeric.js';

const ORIENTATION_DIAGNOSTIC_U_MIN = 0.1;
const ORIENTATION_DIAGNOSTIC_U_MAX = 0.9;

export const INTERSECTION_CONFLICT_NONE = 0;
export const INTERSECTION_CONFLICT_MERGE = 1;
export const INTERSECTION_CONFLICT_ORIENTATION = 2;
export const INTERSECTION_CONFLICT_NORMAL = 3;

export const INTERSECTION_TOLERANCE_NONE = 0;
export const INTERSECTION_TOLERANCE_MERGING = 1;
export const INTERSECTION_TOLERANCE_NORMAL = 2;
export const INTERSECTION_TOLERANCE_NORMAL_CONSTRUCTION = 3;

/**
 * @typedef {Object} InteractionCandidate
 * @property {number} s
 * @property {number} normalX
 * @property {number} normalY
 * @property {number} u
 * @property {number} sigma
 * @property {number} curveId
 * @property {number} positionTolerance
 * @property {Uint8Array} positiveRegionCrossings
 * @property {Uint8Array} negativeRegionCrossings
 * @property {Uint8Array} regionCrossingMask
 * @property {number} conflictType
 * @property {number} conflictCurveId
 * @property {number} conflictToleranceKind
 * @property {number} conflictTolerance
 */

/**
 * Create the reusable state updated once for every curve visited by a linear
 * loop or acceleration-structure traversal.
 *
 * @param {number} regionCount
 * @param {number} [maximumDistance=Infinity] - Initial search limit.
 * @returns {InteractionCandidate}
 */
export function createInteractionCandidate(
  regionCount,
  maximumDistance = Infinity
) {
  return {
    s: maximumDistance,
    positionTolerance: 0,
    normalX: 0,
    normalY: 0,
    u: 0,
    sigma: 0,
    curveId: -1,
    positiveRegionCrossings: new Uint8Array(regionCount),
    negativeRegionCrossings: new Uint8Array(regionCount),
    regionCrossingMask: new Uint8Array(regionCount),
    conflictType: INTERSECTION_CONFLICT_NONE,
    conflictCurveId: -1,
    conflictToleranceKind: INTERSECTION_TOLERANCE_NONE,
    conflictTolerance: 0
  };
}

/**
 * Prepare constants shared by every candidate update for one ray.
 *
 * @param {Object} description
 * @param {number} numericEpsilon
 * @param {number} [maximumDistance=Infinity]
 * @returns {Object}
 */
export function createInteractionCandidateContext(
  description,
  numericEpsilon,
  maximumDistance = Infinity
) {
  validateNumericEpsilon(numericEpsilon);
  const configuredTolerances = description.numericalTolerances ?? {};
  const tolerancePolicy = getIntersectionTolerancePolicy(numericEpsilon);
  const normalTolerance = Math.min(Math.PI, Math.max(
    configuredTolerances.interactionNormal ?? 0,
    tolerancePolicy.interactionNormal
  ));
  return {
    description,
    numericEpsilon,
    tolerancePolicy,
    maximumDistance,
    forwardDistance: configuredTolerances.forwardDistance ?? 0,
    interactionMerging: configuredTolerances.interactionMerging ?? 0,
    normalTolerance,
    maximumNormalChordDistanceSquared:
      4 * Math.sin(normalTolerance * 0.5) ** 2,
    hitScratch: {
      s: Infinity,
      u: 0,
      normalX: 0,
      normalY: 0,
      sigma: 0
    }
  };
}

/**
 * Test one curve and update the nearest interaction candidate. This is the
 * traversal-independent update operation used by both a loop and a BVH.
 *
 * @param {InteractionCandidate} candidate
 * @param {Object} context
 * @param {number} curveId
 * @param {Object} ray
 */
export function updateInteractionCandidate(
  candidate,
  context,
  curveId,
  ray
) {
  const { description, numericEpsilon } = context;
  const curve = description.curves[curveId];
  if (!wavelengthPassesFilter(curve.filter, ray.wavelength)) return;

  const hit = context.hitScratch;
  if (!intersectCurve(
    curve.geometry,
    ray,
    {
      numericEpsilon,
      tolerancePolicy: context.tolerancePolicy,
      minDistance: Math.max(
        curve.geometry.positionTolerance,
        context.forwardDistance
      )
    },
    hit
  )) {
    return;
  }

  if (hit.s > context.maximumDistance) {
    if (candidate.curveId >= 0) return;
    const mergingTolerance = getMergingDistanceTolerance(
      candidate.positionTolerance,
      curve.geometry,
      candidate.s,
      hit.s,
      context.interactionMerging,
      context.tolerancePolicy.mergingDistance
    );
    if (hit.s > candidate.s + mergingTolerance) return;
  }

  const frontSideOnly =
    curve.ownerKind !== 'region' && !curve.twoSided;
  if (
    frontSideOnly &&
    (
      !ensureCurveIntersectionNormal(
        curve.geometry,
        ray,
        hit,
        { numericEpsilon, tolerancePolicy: context.tolerancePolicy }
      ) ||
      hit.sigma !== 1
    )
  ) {
    return;
  }

  if (candidate.curveId < 0) {
    initializeInteractionCandidate(
      candidate,
      context,
      curveId,
      curve,
      hit,
      ray
    );
    return;
  }

  const mergingTolerance = getMergingDistanceTolerance(
    candidate.positionTolerance,
    curve.geometry,
    candidate.s,
    hit.s,
    context.interactionMerging,
    context.tolerancePolicy.mergingDistance
  );
  if (hit.s < candidate.s - mergingTolerance) {
    initializeInteractionCandidate(
      candidate,
      context,
      curveId,
      curve,
      hit,
      ray
    );
    return;
  }
  if (
    hit.s > candidate.s + mergingTolerance ||
    candidate.conflictType === INTERSECTION_CONFLICT_NORMAL
  ) {
    return;
  }

  if (
    !ensureCurveIntersectionNormal(
      context.description.curves[candidate.curveId].geometry,
      ray,
      candidate,
      { numericEpsilon, tolerancePolicy: context.tolerancePolicy }
    ) ||
    !ensureCurveIntersectionNormal(
      curve.geometry,
      ray,
      hit,
      { numericEpsilon, tolerancePolicy: context.tolerancePolicy }
    )
  ) {
    return;
  }
  mergeHitIntoCandidate(
    candidate,
    context,
    curveId,
    curve,
    hit,
    ray,
    mergingTolerance
  );
}

/**
 * Finish lazily populated fields after traversal.
 *
 * @param {InteractionCandidate} candidate
 * @param {Object} context
 * @param {Object} ray
 * @returns {InteractionCandidate|null}
 */
export function finalizeInteractionCandidate(candidate, context, ray) {
  if (candidate.curveId < 0) return null;
  const geometry = context.description.curves[candidate.curveId].geometry;
  if (!ensureCurveIntersectionNormal(
    geometry,
    ray,
    candidate,
    {
      numericEpsilon: context.numericEpsilon,
      tolerancePolicy: context.tolerancePolicy
    }
  )) return null;
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

function initializeInteractionCandidate(
  candidate,
  context,
  curveId,
  curve,
  hit,
  ray
) {
  if (
    curve.ownerKind === 'region' &&
    !ensureCurveIntersectionNormal(
      curve.geometry,
      ray,
      hit,
      {
        numericEpsilon: context.numericEpsilon,
        tolerancePolicy: context.tolerancePolicy
      }
    )
  ) {
    return;
  }

  candidate.s = hit.s;
  candidate.positionTolerance = curve.geometry.positionTolerance;
  candidate.normalX = hit.normalX;
  candidate.normalY = hit.normalY;
  candidate.u = hit.u;
  candidate.sigma = hit.sigma;
  candidate.curveId = curveId;
  candidate.positiveRegionCrossings.fill(0);
  candidate.negativeRegionCrossings.fill(0);
  candidate.regionCrossingMask.fill(0);
  candidate.conflictType = INTERSECTION_CONFLICT_NONE;
  candidate.conflictCurveId = -1;
  candidate.conflictToleranceKind = INTERSECTION_TOLERANCE_NONE;
  candidate.conflictTolerance = 0;

  if (curve.ownerKind === 'region') {
    getRegionCrossings(candidate, candidate.sigma)[curve.ownerId] = 1;
  }
}

function mergeHitIntoCandidate(
  candidate,
  context,
  curveId,
  curve,
  hit,
  ray,
  mergingTolerance
) {
  const normalChordDistanceSquared = getNormalChordDistanceSquared(
    candidate,
    hit
  );
  if (
    normalChordDistanceSquared >
    context.maximumNormalChordDistanceSquared
  ) {
    recordConflict(
      candidate,
      INTERSECTION_CONFLICT_NORMAL,
      curveId,
      INTERSECTION_TOLERANCE_NORMAL,
      context.normalTolerance
    );
    return;
  }

  if (curve.ownerKind === 'region') {
    const crossings = getRegionCrossings(candidate, hit.sigma);
    if (
      crossings[curve.ownerId] &&
      hit.u > ORIENTATION_DIAGNOSTIC_U_MIN &&
      hit.u < ORIENTATION_DIAGNOSTIC_U_MAX
    ) {
      recordConflict(
        candidate,
        INTERSECTION_CONFLICT_ORIENTATION,
        curveId,
        INTERSECTION_TOLERANCE_MERGING,
        mergingTolerance
      );
    }
    crossings[curve.ownerId] = 1;
  }

  const currentCurve = context.description.curves[candidate.curveId];
  const shouldReplace = shouldReplaceRepresentative(
    candidate.curveId,
    currentCurve,
    curveId,
    curve
  );
  if (!areHitsCompatible(
    candidate,
    currentCurve,
    hit,
    curve,
    ray
  )) {
    recordConflict(
      candidate,
      INTERSECTION_CONFLICT_MERGE,
      shouldReplace ? candidate.curveId : curveId,
      INTERSECTION_TOLERANCE_MERGING,
      mergingTolerance
    );
  }

  if (shouldReplace) {
    candidate.s = hit.s;
    candidate.positionTolerance = curve.geometry.positionTolerance;
    candidate.curveId = curveId;
    candidate.u = hit.u;
    candidate.sigma = hit.sigma;
  }
}

function wavelengthPassesFilter(filter, wavelength) {
  if (!filter) return true;
  const inInterval =
    Math.abs(wavelength - filter.wavelength) <= filter.bandwidth;
  return filter.invert ? !inInterval : inInterval;
}

function getRegionCrossings(candidate, sigma) {
  return sigma > 0
    ? candidate.positiveRegionCrossings
    : candidate.negativeRegionCrossings;
}

function recordConflict(
  candidate,
  conflictType,
  curveId,
  toleranceKind,
  tolerance
) {
  if (conflictType < candidate.conflictType) return;
  candidate.conflictType = conflictType;
  candidate.conflictCurveId = curveId;
  candidate.conflictToleranceKind = toleranceKind;
  candidate.conflictTolerance = tolerance;
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
    return newCurve.mergesWithBoundary;
  }
  if (newCurve.ownerKind === 'region') {
    return currentCurve.mergesWithBoundary;
  }
  return false;
}

function getMergingDistanceTolerance(
  firstPositionTolerance,
  secondGeometry,
  firstDistance,
  secondDistance,
  configuredTolerance,
  relativeErrorFactor
) {
  const distanceScale = Math.max(
    Math.abs(firstDistance),
    Math.abs(secondDistance),
    Number.MIN_VALUE
  );
  return Math.max(
    configuredTolerance,
    firstPositionTolerance + secondGeometry.positionTolerance +
      relativeErrorFactor * distanceScale
  );
}

function getNormalChordDistanceSquared(candidate, hit) {
  const normalDifferenceX = candidate.normalX - hit.normalX;
  const normalDifferenceY = candidate.normalY - hit.normalY;
  return (
    normalDifferenceX * normalDifferenceX +
    normalDifferenceY * normalDifferenceY
  );
}

function isHitAtEndpoint(geometry, hit, ray) {
  if (geometry.kind === 'circle') return false;
  if (hit.u === 0 || hit.u === 1) return true;
  const hitX = ray.originX + hit.s * ray.directionX;
  const hitY = ray.originY + hit.s * ray.directionY;
  const endpointTolerance = Math.max(
    geometry.positionTolerance,
    geometry.endpointTolerance ?? 0
  );
  for (const endpointU of [0, 1]) {
    const endpoint = evaluatePreparedCurve(geometry, endpointU);
    if (
      Math.hypot(hitX - endpoint.x, hitY - endpoint.y) <=
      endpointTolerance
    ) {
      return true;
    }
  }
  return false;
}
