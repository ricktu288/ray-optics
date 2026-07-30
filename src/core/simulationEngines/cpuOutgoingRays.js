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

import { createDagClosureEvaluator } from '../formula/dag-evaluator.js';
import {
  collectNodeLabels,
  collectReferencedParameterNames
} from '../formula/dag-util.js';

/**
 * Prepare CPU formula evaluators and reusable instance-input objects. This is
 * performed once per prepared scene, outside the ping-pong loop.
 *
 * @param {Object} description
 * @returns {Object}
 */
export function prepareCpuOutgoingRayData(description) {
  const bulkTypes = description.types.bulks.map(type => {
    const labels = collectNodeLabels(type.definition.dag);
    const grinLabels = ['n', 'alpha'];
    if (labels.has('n_x')) grinLabels.push('n_x');
    if (labels.has('n_y')) grinLabels.push('n_y');
    return {
      evaluateAlpha: createDagClosureEvaluator(
        type.definition.dag,
        { labels: ['alpha'] }
      ),
      evaluateIndex: createDagClosureEvaluator(
        type.definition.dag,
        { labels: ['n'] }
      ),
      evaluateIndexAndAlpha: createDagClosureEvaluator(
        type.definition.dag,
        { labels: ['n', 'alpha'] }
      ),
      evaluateGrin: createDagClosureEvaluator(
        type.definition.dag,
        { labels: grinLabels }
      )
    };
  });
  const surfaceTypes = description.types.surfaces.map(type => {
    const definition = type.definition;
    const outputLabels =
      createSurfaceOutputLabels(definition.outRayCount);
    const parameters = collectReferencedParameterNames(
      definition.dag,
      outputLabels
    );
    return {
      evaluate: createDagClosureEvaluator(
        definition.dag,
        { labels: outputLabels }
      ),
      needsRefractiveIndices:
        parameters.has('n_0') || parameters.has('n_1')
    };
  });
  const detectorTypes = description.types.detectors.map(type => {
    const definition = type.definition;
    const outputLabels =
      createDetectorOutputLabels(definition.writeCount);
    const parameters = collectReferencedParameterNames(
      definition.dag,
      outputLabels
    );
    return {
      evaluate: createDagClosureEvaluator(
        definition.dag,
        { labels: outputLabels }
      ),
      writeCount: definition.writeCount,
      needsRefractiveIndices:
        parameters.has('n_0') || parameters.has('n_1')
    };
  });

  return {
    bulkTypes,
    surfaceTypes,
    detectorTypes,
    regionInputs: description.regions.map(region => ({
      ...region.params,
      x: 0,
      y: 0,
      lambda: 0
    })),
    surfaceInputs: description.surfaces.map(surface => ({
      ...surface.params
    })),
    detectorInputs: description.detectors.map(detector => ({
      ...detector.params
    }))
  };
}

/**
 * Allocate one result array for each logical detector result.
 *
 * @param {Object} description
 * @returns {Float64Array[]}
 */
export function createCpuDetectorResults(description) {
  const resultSizes = [];
  for (const detector of description.detectors) {
    resultSizes[detector.resultId] = detector.resultSize;
  }
  return resultSizes.map(size => new Float64Array(size));
}

/**
 * Evaluate one indexed interaction and write every fixed outgoing-ray slot.
 *
 * @param {Object} options
 * @returns {number} Number of active outgoing slots written.
 */
export function writeCpuOutgoingRays({
  description,
  prepared,
  type,
  localInteractionIndex,
  sourceRay,
  hit,
  destinationRayBuffer,
  detectorResults
}) {
  switch (type.kind) {
    case 'grinStep':
      return writeGrinStep(
        description,
        prepared,
        type,
        localInteractionIndex,
        sourceRay,
        hit,
        destinationRayBuffer
      );
    case 'regionBoundary':
      return writeRegionBoundary(
        description,
        prepared,
        type,
        localInteractionIndex,
        sourceRay,
        hit,
        destinationRayBuffer
      );
    case 'surface':
      return writeSurfaceOutputs(
        description,
        prepared,
        type,
        localInteractionIndex,
        sourceRay,
        hit,
        destinationRayBuffer
      );
    case 'detector':
      return writeDetectorOutput(
        description,
        prepared,
        type,
        localInteractionIndex,
        sourceRay,
        hit,
        destinationRayBuffer,
        detectorResults
      );
    default:
      throw new TypeError(
        `Unsupported interaction kind: ${JSON.stringify(type.kind)}`
      );
  }
}

function writeGrinStep(
  description,
  prepared,
  type,
  localIndex,
  sourceRay,
  hit,
  destination
) {
  const point = getHitPoint(sourceRay, hit);
  const medium = evaluateEffectiveMedium(
    description,
    prepared,
    sourceRay.membership,
    null,
    point,
    sourceRay.wavelength,
    'grin'
  );
  const directionX = sourceRay.directionX;
  const directionY = sourceRay.directionY;
  const directionProduct = directionX * directionY;
  const steppedDirectionX = directionX + hit.s * (
    medium.nX * (1 - directionX * directionX) -
    medium.nY * directionProduct
  ) / medium.n;
  const steppedDirectionY = directionY + hit.s * (
    medium.nY * (1 - directionY * directionY) -
    medium.nX * directionProduct
  ) / medium.n;
  const steppedLength = Math.hypot(
    steppedDirectionX,
    steppedDirectionY
  );
  const absorption = Math.exp(-medium.alpha * hit.s);
  const output = createOutputRay({
    sourceRay,
    point,
    directionX: steppedDirectionX / steppedLength,
    directionY: steppedDirectionY / steppedLength,
    brightnessS: sourceRay.brightnessS * absorption,
    brightnessP: sourceRay.brightnessP * absorption,
    membership: sourceRay.membership
  });
  destination[
    type.destinationRayStarts[0] + localIndex
  ] = output;
  return isRayActive(output) ? 1 : 0;
}

function writeRegionBoundary(
  description,
  prepared,
  type,
  localIndex,
  sourceRay,
  hit,
  destination
) {
  const point = getHitPoint(sourceRay, hit);
  const incidentMedium = evaluateEffectiveMedium(
    description,
    prepared,
    sourceRay.membership,
    null,
    point,
    sourceRay.wavelength,
    'indexAndAlpha'
  );
  const transmittedMedium = evaluateEffectiveMedium(
    description,
    prepared,
    sourceRay.membership,
    hit.regionCrossingMask,
    point,
    sourceRay.wavelength,
    'index'
  );
  const absorption = Math.exp(-incidentMedium.alpha * hit.s);
  const brightnessS = sourceRay.brightnessS * absorption;
  const brightnessP = sourceRay.brightnessP * absorption;
  const relativeIndex = incidentMedium.n / transmittedMedium.n;
  const cosIncident = -(
    sourceRay.directionX * hit.normalX +
    sourceRay.directionY * hit.normalY
  );
  const radicand = 1 - relativeIndex * relativeIndex * (
    1 - cosIncident * cosIncident
  );
  const reflectedDirectionX =
    sourceRay.directionX + 2 * cosIncident * hit.normalX;
  const reflectedDirectionY =
    sourceRay.directionY + 2 * cosIncident * hit.normalY;

  if (!Number.isFinite(radicand)) {
    for (let outRayIndex = 0;
      outRayIndex < type.outRayCount;
      outRayIndex++) {
      destination[
        type.destinationRayStarts[outRayIndex] + localIndex
      ] = createInactiveRay(sourceRay, point);
    }
    return 0;
  }

  if (radicand < 0) {
    const reflected = createOutputRay({
      sourceRay,
      point,
      directionX: reflectedDirectionX,
      directionY: reflectedDirectionY,
      brightnessS,
      brightnessP,
      membership: sourceRay.membership
    });
    destination[
      type.destinationRayStarts[0] + localIndex
    ] = reflected;
    if (type.outRayCount > 1) {
      destination[
        type.destinationRayStarts[1] + localIndex
      ] = createInactiveRay(sourceRay, point);
    }
    return isRayActive(reflected) ? 1 : 0;
  }

  const cosTransmitted = Math.sqrt(radicand);
  const transmittedDirectionX =
    relativeIndex * sourceRay.directionX +
    (relativeIndex * cosIncident - cosTransmitted) * hit.normalX;
  const transmittedDirectionY =
    relativeIndex * sourceRay.directionY +
    (relativeIndex * cosIncident - cosTransmitted) * hit.normalY;
  let reflectedFractionS = 0;
  let reflectedFractionP = 0;
  if (type.fresnel) {
    reflectedFractionS = square(
      (relativeIndex * cosIncident - cosTransmitted) /
      (relativeIndex * cosIncident + cosTransmitted)
    );
    reflectedFractionP = square(
      (relativeIndex * cosTransmitted - cosIncident) /
      (relativeIndex * cosTransmitted + cosIncident)
    );
  }
  const transmitted = createOutputRay({
    sourceRay,
    point,
    directionX: transmittedDirectionX,
    directionY: transmittedDirectionY,
    brightnessS: brightnessS * (1 - reflectedFractionS),
    brightnessP: brightnessP * (1 - reflectedFractionP),
    membership: sourceRay.membership
  });
  applyMembershipCrossings(
    transmitted.membership,
    hit.regionCrossingMask
  );
  destination[
    type.destinationRayStarts[0] + localIndex
  ] = transmitted;
  let activeCount = isRayActive(transmitted) ? 1 : 0;
  if (type.outRayCount > 1) {
    const reflected = createOutputRay({
      sourceRay,
      point,
      directionX: reflectedDirectionX,
      directionY: reflectedDirectionY,
      brightnessS: brightnessS * reflectedFractionS,
      brightnessP: brightnessP * reflectedFractionP,
      membership: sourceRay.membership
    });
    destination[
      type.destinationRayStarts[1] + localIndex
    ] = reflected;
    if (isRayActive(reflected)) activeCount++;
  }
  return activeCount;
}

function writeSurfaceOutputs(
  description,
  prepared,
  type,
  localIndex,
  sourceRay,
  hit,
  destination
) {
  const curve = description.curves[hit.curveId];
  const surface = description.surfaces[curve.ownerId];
  const surfaceType = prepared.surfaceTypes[surface.surfaceTypeId];
  const input = prepared.surfaceInputs[curve.ownerId];
  const point = getHitPoint(sourceRay, hit);
  const frame = setCommonInteractionInputs(
    input,
    sourceRay,
    hit,
    point
  );
  const incidentMedium = evaluateEffectiveMedium(
    description,
    prepared,
    sourceRay.membership,
    null,
    point,
    sourceRay.wavelength,
    surfaceType.needsRefractiveIndices
      ? 'indexAndAlpha'
      : 'alpha'
  );
  const absorption = Math.exp(-incidentMedium.alpha * hit.s);
  input.P_0s = sourceRay.brightnessS * absorption;
  input.P_0p = sourceRay.brightnessP * absorption;
  if (surfaceType.needsRefractiveIndices) {
    input.n_0 = incidentMedium.n;
    input.n_1 = evaluateEffectiveMedium(
      description,
      prepared,
      sourceRay.membership,
      hit.regionCrossingMask,
      point,
      sourceRay.wavelength,
      'index'
    ).n;
  }
  const evaluated = surfaceType.evaluate(input);
  let activeCount = 0;
  for (let outRayIndex = 0;
    outRayIndex < type.outRayCount;
    outRayIndex++) {
    const labelIndex = outRayIndex + 1;
    const localDirectionX = evaluated[`d_${labelIndex}x`];
    const localDirectionY = evaluated[`d_${labelIndex}y`];
    const directionX =
      localDirectionX * frame.localXAxisX +
      localDirectionY * hit.normalX;
    const directionY =
      localDirectionX * frame.localXAxisY +
      localDirectionY * hit.normalY;
    const crossesBoundary = outputCrossesBoundary(
      curve.geometry,
      sourceRay,
      hit,
      directionX,
      directionY
    );
    const output = createOutputRay({
      sourceRay,
      point,
      directionX,
      directionY,
      brightnessS: evaluated[`P_${labelIndex}s`],
      brightnessP: evaluated[`P_${labelIndex}p`],
      membership: sourceRay.membership
    });
    if (crossesBoundary) {
      applyMembershipCrossings(
        output.membership,
        hit.regionCrossingMask
      );
    }
    destination[
      type.destinationRayStarts[outRayIndex] + localIndex
    ] = output;
    if (isRayActive(output)) activeCount++;
  }
  return activeCount;
}

function writeDetectorOutput(
  description,
  prepared,
  type,
  localIndex,
  sourceRay,
  hit,
  destination,
  detectorResults
) {
  const curve = description.curves[hit.curveId];
  const detector = description.detectors[curve.ownerId];
  const detectorType =
    prepared.detectorTypes[detector.detectorTypeId];
  const input = prepared.detectorInputs[curve.ownerId];
  const point = getHitPoint(sourceRay, hit);
  setCommonInteractionInputs(input, sourceRay, hit, point);
  const incidentMedium = evaluateEffectiveMedium(
    description,
    prepared,
    sourceRay.membership,
    null,
    point,
    sourceRay.wavelength,
    detectorType.needsRefractiveIndices
      ? 'indexAndAlpha'
      : 'alpha'
  );
  const absorption = Math.exp(-incidentMedium.alpha * hit.s);
  input.P_0s = sourceRay.brightnessS * absorption;
  input.P_0p = sourceRay.brightnessP * absorption;
  if (detectorType.needsRefractiveIndices) {
    input.n_0 = incidentMedium.n;
    input.n_1 = evaluateEffectiveMedium(
      description,
      prepared,
      sourceRay.membership,
      hit.regionCrossingMask,
      point,
      sourceRay.wavelength,
      'index'
    ).n;
  }
  const evaluated = detectorType.evaluate(input);
  const result = detectorResults[detector.resultId];
  for (let writeIndex = 1;
    writeIndex <= detectorType.writeCount;
    writeIndex++) {
    const key = evaluated[`k_${writeIndex}`];
    const value = evaluated[`v_${writeIndex}`];
    if (
      Number.isInteger(key) &&
      key >= 0 &&
      key < result.length &&
      Number.isFinite(value)
    ) {
      result[key] += value;
    }
  }
  const output = createOutputRay({
    sourceRay,
    point,
    directionX: sourceRay.directionX,
    directionY: sourceRay.directionY,
    brightnessS: input.P_0s,
    brightnessP: input.P_0p,
    membership: sourceRay.membership
  });
  destination[
    type.destinationRayStarts[0] + localIndex
  ] = output;
  return isRayActive(output) ? 1 : 0;
}

function setCommonInteractionInputs(
  input,
  sourceRay,
  hit,
  point
) {
  const localXAxisX = hit.normalY;
  const localXAxisY = -hit.normalX;
  input.d_0x =
    sourceRay.directionX * localXAxisX +
    sourceRay.directionY * localXAxisY;
  input.d_0y =
    sourceRay.directionX * hit.normalX +
    sourceRay.directionY * hit.normalY;
  input.P_0s = sourceRay.brightnessS;
  input.P_0p = sourceRay.brightnessP;
  input.lambda = sourceRay.wavelength;
  input.x = point.x;
  input.y = point.y;
  input.u = hit.u;
  input.sigma = hit.sigma;
  return {
    localXAxisX,
    localXAxisY
  };
}

function evaluateEffectiveMedium(
  description,
  prepared,
  membership,
  crossingMask,
  point,
  wavelength,
  evaluationKind
) {
  let n = 1;
  let nX = 0;
  let nY = 0;
  let alpha = 0;
  for (let regionId = 0;
    regionId < membership.length;
    regionId++) {
    const isMember = Boolean(membership[regionId]) !== Boolean(
      crossingMask?.[regionId]
    );
    if (!isMember) continue;
    const region = description.regions[regionId];
    const input = prepared.regionInputs[regionId];
    input.x = point.x;
    input.y = point.y;
    input.lambda = wavelength;
    const bulkType = prepared.bulkTypes[region.bulkTypeId];
    const evaluated = selectBulkEvaluator(
      bulkType,
      evaluationKind
    )(input);
    if (evaluationKind !== 'alpha') {
      const regionN = evaluated.n;
      const previousN = n;
      if (evaluationKind === 'grin') {
        nX = nX * regionN + previousN * (evaluated.n_x ?? 0);
        nY = nY * regionN + previousN * (evaluated.n_y ?? 0);
      }
      n = previousN * regionN;
    }
    if (evaluationKind !== 'index') {
      alpha += evaluated.alpha;
    }
  }
  return { n, nX, nY, alpha };
}

function selectBulkEvaluator(bulkType, evaluationKind) {
  switch (evaluationKind) {
    case 'alpha':
      return bulkType.evaluateAlpha;
    case 'index':
      return bulkType.evaluateIndex;
    case 'indexAndAlpha':
      return bulkType.evaluateIndexAndAlpha;
    case 'grin':
      return bulkType.evaluateGrin;
    default:
      throw new TypeError(
        `Unsupported bulk evaluation kind: ${JSON.stringify(evaluationKind)}`
      );
  }
}

function createOutputRay({
  sourceRay,
  point,
  directionX,
  directionY,
  brightnessS,
  brightnessP,
  membership
}) {
  const valid =
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(directionX) &&
    Number.isFinite(directionY) &&
    directionX * directionX + directionY * directionY > 0 &&
    Number.isFinite(brightnessS) &&
    brightnessS >= 0 &&
    Number.isFinite(brightnessP) &&
    brightnessP >= 0;
  return {
    originX: point.x,
    originY: point.y,
    directionX: valid ? directionX : 0,
    directionY: valid ? directionY : 0,
    brightnessS: valid ? brightnessS : 0,
    brightnessP: valid ? brightnessP : 0,
    wavelength: sourceRay.wavelength,
    membership: Uint8Array.from(membership)
  };
}

function createInactiveRay(sourceRay, point) {
  return createOutputRay({
    sourceRay,
    point,
    directionX: 0,
    directionY: 0,
    brightnessS: 0,
    brightnessP: 0,
    membership: sourceRay.membership
  });
}

function applyMembershipCrossings(membership, crossingMask) {
  for (let regionId = 0;
    regionId < membership.length;
    regionId++) {
    if (crossingMask[regionId]) membership[regionId] ^= 1;
  }
}

function getHitPoint(ray, hit) {
  return {
    x: ray.originX + hit.s * ray.directionX,
    y: ray.originY + hit.s * ray.directionY
  };
}

function outputCrossesBoundary(
  geometry,
  sourceRay,
  hit,
  outputDirectionX,
  outputDirectionY
) {
  if (geometry?.kind !== 'smoothLineSegment') {
    return (
      outputDirectionX * hit.normalX +
      outputDirectionY * hit.normalY
    ) < 0;
  }
  const frontNormalX = -geometry.tangentY;
  const frontNormalY = geometry.tangentX;
  const incidence =
    sourceRay.directionX * frontNormalX +
    sourceRay.directionY * frontNormalY;
  const orientation = incidence < 0 ? 1 : -1;
  return orientation * (
    outputDirectionX * frontNormalX +
    outputDirectionY * frontNormalY
  ) < 0;
}

function createSurfaceOutputLabels(outRayCount) {
  const labels = [];
  for (let outRayIndex = 1;
    outRayIndex <= outRayCount;
    outRayIndex++) {
    labels.push(
      `d_${outRayIndex}x`,
      `d_${outRayIndex}y`,
      `P_${outRayIndex}s`,
      `P_${outRayIndex}p`
    );
  }
  return labels;
}

function createDetectorOutputLabels(writeCount) {
  const labels = [];
  for (let writeIndex = 1;
    writeIndex <= writeCount;
    writeIndex++) {
    labels.push(`k_${writeIndex}`, `v_${writeIndex}`);
  }
  return labels;
}

function isRayActive(ray) {
  return ray.brightnessS !== 0 || ray.brightnessP !== 0;
}

function square(value) {
  return value * value;
}
