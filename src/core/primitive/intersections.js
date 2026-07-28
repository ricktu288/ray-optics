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

import {
  evaluatePreparedCurve,
  solveQuadraticRoots
} from './curveGeometry.js';
import {
  getRoundingErrorFactor,
  validateNumericEpsilon
} from './numeric.js';

const PARAMETER_ERROR_OPERATION_COUNT = 32;
const TANGENT_ERROR_OPERATION_COUNT = 32;
const CUBIC_VALUE_ERROR_OPERATION_COUNT = 64;
const ENDPOINT_ERROR_OPERATION_COUNT = 32;

const RAY_CAST_DIRECTIONS = Object.freeze([
  Object.freeze({ directionX: 0.9238795042037964, directionY: 0.3826834261417389 }),
  Object.freeze({ directionX: 0.525731086730957, directionY: 0.8506507873535156 }),
  Object.freeze({ directionX: -0.2669335901737213, directionY: 0.9637149572372437 }),
  Object.freeze({ directionX: 0.7986354827880859, directionY: -0.6018150448799133 }),
  Object.freeze({ directionX: -0.6626200675964355, directionY: -0.7489557266235352 })
]);

/**
 * Geometry-owned data for one isolated curve hit. `normalX` and `normalY`
 * form the adjusted incident-side optical normal. `sigma` records which side
 * of the geometrically oriented curve the ray approaches from; for a smooth
 * line segment this is deliberately independent of its interpolated normal.
 *
 * @typedef {Object} CurveIntersection
 * @property {number} s - Distance along the normalized incoming ray.
 * @property {number} u - Native curve parameter, or 0.5 for a circle.
 * @property {number} normalX - Adjusted incident-side unit normal x component.
 * @property {number} normalY - Adjusted incident-side unit normal y component.
 * @property {number} sigma - Geometric side of the oriented curve, either 1 or -1.
 */

/**
 * Find the nearest accepted intersection with one prepared curve.
 *
 * @param {Object} geometry
 * @param {{originX: number, originY: number, directionX: number, directionY: number}} ray
 * @param {Object} [options]
 * @param {number} options.numericEpsilon - Relative arithmetic epsilon selected by the engine.
 * @param {number} [options.minDistance]
 * @param {number} [options.maxDistance=Infinity]
 * @param {boolean} [options.includeTangents=false]
 * @param {boolean} [options.includeEndpointCaps=true]
 * @param {Object} [out]
 * @returns {CurveIntersection|null}
 */
export function intersectCurve(geometry, ray, options = {}, out = {}) {
  const result = intersectCurveAll(geometry, ray, options);
  if (result.hits.length === 0) return null;
  copyHit(result.hits[0], out);
  return out;
}

/**
 * Find all accepted intersections with one prepared curve, ordered by ray
 * distance and then native curve parameter.
 *
 * `result.ambiguous` reports a non-isolated or singular geometric case. The
 * ordinary hits remain available so a caller can choose deterministic
 * continuation behavior.
 *
 * @param {Object} geometry
 * @param {{originX: number, originY: number, directionX: number, directionY: number}} ray
 * @param {Object} [options]
 * @param {number} options.numericEpsilon - Relative arithmetic epsilon selected by the engine.
 * @param {number} [options.minDistance]
 * @param {number} [options.maxDistance=Infinity]
 * @param {boolean} [options.includeTangents=false]
 * @param {boolean} [options.includeEndpointCaps=true]
 * @param {{hits: Object[], ambiguous: boolean}} [result]
 * @returns {{hits: Object[], ambiguous: boolean}}
 */
export function intersectCurveAll(
  geometry,
  ray,
  {
    numericEpsilon,
    minDistance = geometry.positionTolerance,
    maxDistance = Infinity,
    includeTangents = false,
    includeEndpointCaps = true
  } = {},
  result = { hits: [], ambiguous: false }
) {
  result.hits.length = 0;
  result.ambiguous = false;
  const tolerances = createIntersectionTolerances(numericEpsilon);

  switch (geometry.kind) {
    case 'lineSegment':
    case 'smoothLineSegment':
      intersectLineSegment(
        geometry,
        ray,
        result,
        tolerances,
        includeEndpointCaps
      );
      break;
    case 'circularArc':
      intersectCircularArc(geometry, ray, result, tolerances);
      break;
    case 'cubicBezier':
      intersectCubicBezier(geometry, ray, result, tolerances);
      break;
    case 'circle':
      intersectCircle(geometry, ray, result, tolerances);
      break;
    default:
      throw new TypeError(
        `Unsupported prepared curve kind: ${JSON.stringify(geometry.kind)}`
      );
  }

  const needsEndpointCaps =
    geometry.kind === 'circularArc'
      ? result.hits.length < 2
      : geometry.kind === 'cubicBezier'
        ? result.hits.length < 3
        : false;
  if (includeEndpointCaps && needsEndpointCaps) {
    addEndpointCap(geometry, ray, 0, result, tolerances);
    addEndpointCap(geometry, ray, 1, result, tolerances);
  }

  const filteredHits = [];
  for (const hit of result.hits) {
    if (
      !Number.isFinite(hit.s) ||
      hit.s <= minDistance ||
      hit.s > maxDistance
    ) {
      continue;
    }
    if (hit.tangent && !includeTangents) continue;
    addDistinctHit(
      filteredHits,
      hit,
      geometry.positionTolerance,
      tolerances.parameter
    );
  }
  filteredHits.sort((a, b) => a.s - b.s || a.u - b.u);
  result.hits.length = 0;
  result.hits.push(...filteredHits);
  return result;
}

/**
 * Intersect a processed curve after applying its wavelength and sidedness
 * policy.
 *
 * @param {Object} processedCurve
 * @param {Object} ray
 * @param {number} wavelength
 * @param {Object} [options]
 * @param {Object} [out]
 * @returns {Object|null}
 */
export function intersectProcessedCurve(
  processedCurve,
  ray,
  wavelength,
  options = {},
  out = {}
) {
  if (!wavelengthPassesFilter(processedCurve.filter, wavelength)) return null;

  const result = intersectCurveAll(processedCurve.geometry, ray, options);
  for (const hit of result.hits) {
    if (processedCurve.ownerKind !== 'region' &&
        !processedCurve.twoSided &&
        hit.sigma !== 1) {
      continue;
    }
    copyHit(hit, out);
    return out;
  }
  return null;
}

/**
 * Count forward crossings of one curve for an even-odd region ray cast.
 *
 * Endpoint, tangent, origin, and singular contacts are reported as ambiguous
 * so the region classifier can retry with another deterministic direction.
 *
 * @param {Object} geometry
 * @param {Object} ray
 * @param {Object} [options]
 * @returns {{count: number, ambiguous: boolean}}
 */
export function countCurveRayCrossings(geometry, ray, options = {}) {
  const positionTolerance =
    options.positionTolerance ?? geometry.positionTolerance;
  const result = intersectCurveAll(geometry, ray, {
    numericEpsilon: options.numericEpsilon,
    minDistance: -positionTolerance,
    maxDistance: options.maxDistance ?? Infinity,
    includeTangents: true,
    includeEndpointCaps: true
  });

  let count = 0;
  let ambiguous = result.ambiguous;
  for (const hit of result.hits) {
    if (Math.abs(hit.s) <= positionTolerance) {
      ambiguous = true;
      continue;
    }
    if (hit.s < 0) continue;
    if (hit.tangent) {
      ambiguous = true;
      continue;
    }
    if (geometry.kind !== 'circle' && isEndpointParameter(hit.u)) {
      ambiguous = true;
      continue;
    }
    count++;
  }
  return { count, ambiguous };
}

/**
 * Classify a point against a collection of prepared curves using deterministic
 * retry directions.
 *
 * @param {Object[]} geometries
 * @param {{x: number, y: number}} point
 * @param {Object} [options]
 * @returns {'inside'|'outside'|'boundary'}
 */
export function classifyPointInRegion(geometries, point, options = {}) {
  for (const direction of RAY_CAST_DIRECTIONS) {
    const ray = {
      originX: point.x,
      originY: point.y,
      ...direction
    };
    let crossings = 0;
    let ambiguous = false;
    for (const geometry of geometries) {
      const curveResult = countCurveRayCrossings(geometry, ray, options);
      if (curveResult.ambiguous) {
        ambiguous = true;
        break;
      }
      crossings += curveResult.count;
    }
    if (!ambiguous) {
      return crossings % 2 === 1 ? 'inside' : 'outside';
    }
  }
  return 'boundary';
}

function intersectLineSegment(
  geometry,
  ray,
  result,
  tolerances,
  includeEndpointCaps
) {
  const offsetX = geometry.originX - ray.originX;
  const offsetY = geometry.originY - ray.originY;
  const denominator = cross(
    ray.directionX,
    ray.directionY,
    geometry.tangentX,
    geometry.tangentY
  );
  const lineDistance = cross(
    offsetX,
    offsetY,
    geometry.tangentX,
    geometry.tangentY
  );
  if (Math.abs(denominator) <= tolerances.tangent) {
    if (Math.abs(lineDistance) <= geometry.positionTolerance) {
      result.ambiguous = true;
    }
    if (includeEndpointCaps) {
      addEndpointCap(geometry, ray, 0, result, tolerances);
      addEndpointCap(geometry, ray, 1, result, tolerances);
    }
    return;
  }

  const s = lineDistance / denominator;
  let u = cross(
    offsetX,
    offsetY,
    ray.directionX,
    ray.directionY
  ) * geometry.invLength / denominator;
  if (u < 0 || u > 1) {
    if (includeEndpointCaps) {
      addEndpointCap(
        geometry,
        ray,
        u < 0 ? 0 : 1,
        result,
        tolerances
      );
    }
    return;
  }
  u = clampUnitParameter(u);
  const frontNormal = getPreparedFrontNormal(geometry, u, tolerances);
  if (!frontNormal) {
    result.ambiguous = true;
    return;
  }
  addOrientedCandidate(
    result,
    ray,
    s,
    u,
    frontNormal.x,
    frontNormal.y,
    tolerances,
    0,
    -geometry.tangentY,
    geometry.tangentX
  );
}

function intersectCircle(geometry, ray, result, tolerances) {
  const inverseRadius = Math.abs(geometry.signedInvRadius);
  const originX = (ray.originX - geometry.centerX) * inverseRadius;
  const originY = (ray.originY - geometry.centerY) * inverseRadius;
  const directionX = ray.directionX * inverseRadius;
  const directionY = ray.directionY * inverseRadius;
  const roots = solveQuadraticRoots(
    directionX * directionX + directionY * directionY,
    2 * (originX * directionX + originY * directionY),
    originX * originX + originY * originY - 1,
    tolerances.numericEpsilon
  );
  const orientation = Math.sign(geometry.signedInvRadius);
  for (const s of roots) {
    const hitX = originX + s * directionX;
    const hitY = originY + s * directionY;
    addOrientedCandidate(
      result,
      ray,
      s,
      0.5,
      orientation * hitX,
      orientation * hitY,
      tolerances
    );
  }
}

function intersectCircularArc(geometry, ray, result, tolerances) {
  const { tangentX: ex, tangentY: ey, bulge: b } = geometry;
  const nx = -ey;
  const ny = ex;
  const relativeX = ray.originX - geometry.originX;
  const relativeY = ray.originY - geometry.originY;
  const x0 = (relativeX * ex + relativeY * ey) * geometry.invChordLength;
  const y0 = (relativeX * nx + relativeY * ny) * geometry.invChordLength;
  const dx = (
    ray.directionX * ex + ray.directionY * ey
  ) * geometry.invChordLength;
  const dy = (
    ray.directionX * nx + ray.directionY * ny
  ) * geometry.invChordLength;
  const oneMinusBSquared = (1 - b) * (1 + b);
  const roots = solveQuadraticRoots(
    2 * b * (dx * dx + dy * dy),
    4 * b * (x0 * dx + y0 * dy) - oneMinusBSquared * dy,
    2 * b * (x0 * x0 + y0 * y0 - 0.25) - oneMinusBSquared * y0,
    tolerances.numericEpsilon
  );

  for (const s of roots) {
    const x = x0 + s * dx;
    const y = y0 + s * dy;
    const denominator = 1 - 2 * b * y;
    if (!(denominator > 0)) continue;
    let u = 0.5 + x / denominator;
    if (u < 0 || u > 1) continue;
    u = clampUnitParameter(u);

    const gradientX = 4 * b * x;
    const gradientY = 4 * b * y - oneMinusBSquared;
    const frontLocalX = -gradientX;
    const frontLocalY = -gradientY;
    addOrientedCandidate(
      result,
      ray,
      s,
      u,
      ex * frontLocalX + nx * frontLocalY,
      ey * frontLocalX + ny * frontLocalY,
      tolerances
    );
  }
}

function intersectCubicBezier(geometry, ray, result, tolerances) {
  const originX = (ray.originX - geometry.originX) * geometry.invScale;
  const originY = (ray.originY - geometry.originY) * geometry.invScale;
  const directionX = ray.directionX * geometry.invScale;
  const directionY = ray.directionY * geometry.invScale;
  const directionLengthSquared =
    directionX * directionX + directionY * directionY;
  const originShift = -(
    originX * directionX + originY * directionY
  ) / directionLengthSquared;
  const nearOriginX = originX + originShift * directionX;
  const nearOriginY = originY + originShift * directionY;

  const g = [
    cross(
      geometry.startX - nearOriginX,
      geometry.startY - nearOriginY,
      directionX,
      directionY
    ),
    cross(
      geometry.control1X - nearOriginX,
      geometry.control1Y - nearOriginY,
      directionX,
      directionY
    ),
    cross(
      geometry.control2X - nearOriginX,
      geometry.control2Y - nearOriginY,
      directionX,
      directionY
    ),
    cross(
      geometry.endX - nearOriginX,
      geometry.endY - nearOriginY,
      directionX,
      directionY
    )
  ];
  const directionLength = Math.sqrt(directionLengthSquared);
  const valueTolerance = Math.max(
    geometry.positionTolerance * geometry.invScale * directionLength,
    tolerances.cubicValue *
      Math.max(...g.map(Math.abs), Number.MIN_VALUE)
  );
  if (g.every(value => Math.abs(value) <= valueTolerance)) {
    result.ambiguous = true;
    return;
  }

  const derivative0 = 3 * (g[1] - g[0]);
  const derivative1 = 3 * (g[2] - g[1]);
  const derivative2 = 3 * (g[3] - g[2]);
  const partitions = [0];
  for (const root of solveQuadraticRoots(
    derivative0 - 2 * derivative1 + derivative2,
    2 * (derivative1 - derivative0),
    derivative0,
    tolerances.numericEpsilon
  )) {
    if (root > 0 && root < 1) partitions.push(root);
  }
  partitions.push(1);
  partitions.sort((a, b) => a - b);

  const roots = [];
  for (const partition of partitions) {
    const value = evaluateScalarCubic(g, partition);
    if (Math.abs(value) <= valueTolerance) {
      addDistinctNumber(roots, partition, tolerances.parameter);
    }
  }
  for (let index = 0; index + 1 < partitions.length; index++) {
    const start = partitions[index];
    const end = partitions[index + 1];
    const startValue = evaluateScalarCubic(g, start);
    const endValue = evaluateScalarCubic(g, end);
    if (startValue * endValue < 0) {
      addDistinctNumber(
        roots,
        refineScalarCubicRoot(
          g,
          start,
          end,
          startValue,
          tolerances.rootRefinementSteps
        ),
        tolerances.parameter
      );
    }
  }
  roots.sort((a, b) => a - b);

  for (const u of roots) {
    const point = evaluateCubicLocal(geometry, u);
    const s = originShift + (
      (point.x - nearOriginX) * directionX +
      (point.y - nearOriginY) * directionY
    ) / directionLengthSquared;
    const tangent = getCubicTangent(geometry, u, tolerances);
    if (!tangent) {
      result.ambiguous = true;
      continue;
    }
    addOrientedCandidate(
      result,
      ray,
      s,
      clampUnitParameter(u),
      -tangent.y,
      tangent.x,
      tolerances
    );
  }
}

function addEndpointCap(geometry, ray, u, result, tolerances) {
  const endpoint = evaluatePreparedCurve(geometry, u);
  const offsetX = endpoint.x - ray.originX;
  const offsetY = endpoint.y - ray.originY;
  const directionLengthSquared =
    ray.directionX * ray.directionX + ray.directionY * ray.directionY;
  const directionLength = Math.sqrt(directionLengthSquared);
  if (!(directionLength > tolerances.tangent)) {
    result.ambiguous = true;
    return;
  }
  const s = (
    offsetX * ray.directionX + offsetY * ray.directionY
  ) / directionLengthSquared;
  const distanceToEndpoint = Math.hypot(offsetX, offsetY);
  const arithmeticScale = Math.max(
    Math.abs(endpoint.x),
    Math.abs(endpoint.y),
    Math.abs(ray.originX),
    Math.abs(ray.originY),
    distanceToEndpoint,
    Number.MIN_VALUE
  );
  const derivedEndpointTolerance =
    geometry.positionTolerance + tolerances.endpoint * arithmeticScale;
  const endpointTolerance = Math.max(
    geometry.endpointTolerance ?? 0,
    derivedEndpointTolerance
  );
  const perpendicularDistance = Math.abs(cross(
    offsetX,
    offsetY,
    ray.directionX,
    ray.directionY
  )) / directionLength;
  if (perpendicularDistance > endpointTolerance) {
    return;
  }

  const frontNormal = getPreparedFrontNormal(geometry, u, tolerances);
  if (!frontNormal) {
    result.ambiguous = true;
    return;
  }
  addOrientedCandidate(
    result,
    ray,
    s,
    u,
    frontNormal.x,
    frontNormal.y,
    tolerances,
    endpointTolerance,
    geometry.kind === 'smoothLineSegment'
      ? -geometry.tangentY
      : frontNormal.x,
    geometry.kind === 'smoothLineSegment'
      ? geometry.tangentX
      : frontNormal.y
  );
}

function getPreparedFrontNormal(geometry, u, tolerances) {
  switch (geometry.kind) {
    case 'lineSegment':
      return {
        x: -geometry.tangentY,
        y: geometry.tangentX
      };

    case 'smoothLineSegment': {
      const oneMinusU = 1 - u;
      return normalizeVector(
        oneMinusU * geometry.startNormalX + u * geometry.endNormalX,
        oneMinusU * geometry.startNormalY + u * geometry.endNormalY,
        tolerances.tangent
      );
    }

    case 'circularArc': {
      const localPoint = evaluateArcLocal(geometry.bulge, u);
      const oneMinusBSquared =
        (1 - geometry.bulge) * (1 + geometry.bulge);
      const localX = -4 * geometry.bulge * localPoint.x;
      const localY = -(
        4 * geometry.bulge * localPoint.y - oneMinusBSquared
      );
      const nx = -geometry.tangentY;
      const ny = geometry.tangentX;
      return normalizeVector(
        geometry.tangentX * localX + nx * localY,
        geometry.tangentY * localX + ny * localY,
        tolerances.tangent
      );
    }

    case 'cubicBezier': {
      const tangent = getCubicTangent(geometry, u, tolerances);
      return tangent && normalizeVector(
        -tangent.y,
        tangent.x,
        tolerances.tangent
      );
    }

    default:
      return null;
  }
}

function getCubicTangent(geometry, u, tolerances) {
  const oneMinusU = 1 - u;
  const d0x = 3 * (geometry.control1X - geometry.startX);
  const d0y = 3 * (geometry.control1Y - geometry.startY);
  const d1x = 3 * (geometry.control2X - geometry.control1X);
  const d1y = 3 * (geometry.control2Y - geometry.control1Y);
  const d2x = 3 * (geometry.endX - geometry.control2X);
  const d2y = 3 * (geometry.endY - geometry.control2Y);
  const tangentX =
    oneMinusU * oneMinusU * d0x +
    2 * oneMinusU * u * d1x +
    u * u * d2x;
  const tangentY =
    oneMinusU * oneMinusU * d0y +
    2 * oneMinusU * u * d1y +
    u * u * d2y;
  const tangent = normalizeVector(tangentX, tangentY, tolerances.tangent);
  if (tangent) return tangent;

  const secondStartX = 2 * (d1x - d0x);
  const secondStartY = 2 * (d1y - d0y);
  const secondEndX = 2 * (d2x - d1x);
  const secondEndY = 2 * (d2y - d1y);
  if (u <= tolerances.parameter) {
    return normalizeVector(
      secondStartX,
      secondStartY,
      tolerances.tangent
    ) ??
      normalizeVector(
        secondEndX - secondStartX,
        secondEndY - secondStartY,
        tolerances.tangent
      );
  }
  if (u >= 1 - tolerances.parameter) {
    return normalizeVector(
      -secondEndX,
      -secondEndY,
      tolerances.tangent
    ) ??
      normalizeVector(
        secondEndX - secondStartX,
        secondEndY - secondStartY,
        tolerances.tangent
      );
  }

  const secondX = oneMinusU * secondStartX + u * secondEndX;
  const secondY = oneMinusU * secondStartY + u * secondEndY;
  if (normalizeVector(secondX, secondY, tolerances.tangent)) {
    return null;
  }
  return normalizeVector(
    secondEndX - secondStartX,
    secondEndY - secondStartY,
    tolerances.tangent
  );
}

function addOrientedCandidate(
  result,
  ray,
  s,
  u,
  frontNormalX,
  frontNormalY,
  tolerances,
  mergeTolerance = 0,
  geometricFrontNormalX = frontNormalX,
  geometricFrontNormalY = frontNormalY
) {
  const frontNormal = normalizeVector(
    frontNormalX,
    frontNormalY,
    tolerances.tangent
  );
  if (!frontNormal) {
    result.ambiguous = true;
    return;
  }
  const geometricFrontNormal = normalizeVector(
    geometricFrontNormalX,
    geometricFrontNormalY,
    tolerances.tangent
  );
  if (!geometricFrontNormal) {
    result.ambiguous = true;
    return;
  }
  const geometricIncidence =
    ray.directionX * geometricFrontNormal.x +
    ray.directionY * geometricFrontNormal.y;
  const opticalIncidence =
    ray.directionX * frontNormal.x + ray.directionY * frontNormal.y;
  const tangent = Math.abs(geometricIncidence) <= tolerances.tangent;
  const sigma = geometricIncidence < 0 ? 1 : -1;
  const opticalSigma = opticalIncidence < 0 ? 1 : -1;
  result.hits.push({
    s,
    u,
    normalX: opticalSigma * frontNormal.x,
    normalY: opticalSigma * frontNormal.y,
    sigma,
    tangent,
    mergeTolerance
  });
}

function addDistinctHit(hits, hit, positionTolerance, parameterTolerance) {
  const duplicate = hits.find(existing => {
    const distancesOverlap = Math.abs(existing.s - hit.s) <= Math.max(
      positionTolerance,
      existing.mergeTolerance,
      hit.mergeTolerance
    );
    if (!distancesOverlap) return false;
    if (
      isEndpointParameter(existing.u) ||
      isEndpointParameter(hit.u)
    ) {
      return true;
    }
    return Math.abs(existing.u - hit.u) <= parameterTolerance;
  });
  if (!duplicate) {
    hits.push(hit);
    return;
  }
  if (
    isEndpointParameter(hit.u) &&
    !isEndpointParameter(duplicate.u)
  ) {
    duplicate.s = hit.s;
    duplicate.u = hit.u;
    duplicate.normalX = hit.normalX;
    duplicate.normalY = hit.normalY;
    duplicate.sigma = hit.sigma;
    duplicate.tangent = hit.tangent;
  }
  duplicate.mergeTolerance = Math.max(
    duplicate.mergeTolerance,
    hit.mergeTolerance
  );
}

function evaluateScalarCubic(values, u) {
  const oneMinusU = 1 - u;
  const first0 = oneMinusU * values[0] + u * values[1];
  const first1 = oneMinusU * values[1] + u * values[2];
  const first2 = oneMinusU * values[2] + u * values[3];
  const second0 = oneMinusU * first0 + u * first1;
  const second1 = oneMinusU * first1 + u * first2;
  return oneMinusU * second0 + u * second1;
}

function refineScalarCubicRoot(
  values,
  start,
  end,
  startValue,
  refinementSteps
) {
  let low = start;
  let high = end;
  let lowValue = startValue;
  for (let iteration = 0; iteration < refinementSteps; iteration++) {
    const midpoint = (low + high) * 0.5;
    const midpointValue = evaluateScalarCubic(values, midpoint);
    if (midpointValue === 0) return midpoint;
    if ((lowValue < 0) === (midpointValue < 0)) {
      low = midpoint;
      lowValue = midpointValue;
    } else {
      high = midpoint;
    }
  }
  return (low + high) * 0.5;
}

function evaluateCubicLocal(geometry, u) {
  const oneMinusU = 1 - u;
  const x01 = oneMinusU * geometry.startX + u * geometry.control1X;
  const y01 = oneMinusU * geometry.startY + u * geometry.control1Y;
  const x12 = oneMinusU * geometry.control1X + u * geometry.control2X;
  const y12 = oneMinusU * geometry.control1Y + u * geometry.control2Y;
  const x23 = oneMinusU * geometry.control2X + u * geometry.endX;
  const y23 = oneMinusU * geometry.control2Y + u * geometry.endY;
  const x012 = oneMinusU * x01 + u * x12;
  const y012 = oneMinusU * y01 + u * y12;
  const x123 = oneMinusU * x12 + u * x23;
  const y123 = oneMinusU * y12 + u * y23;
  return {
    x: oneMinusU * x012 + u * x123,
    y: oneMinusU * y012 + u * y123
  };
}

function evaluateArcLocal(b, u) {
  let k;
  let h;
  if (Math.abs(b) <= 1) {
    const denominator = 1 + b * b;
    k = 4 * b * b / denominator;
    h = -b / denominator;
  } else {
    const inverseB = 1 / b;
    const denominator = 1 + inverseB * inverseB;
    k = 4 / denominator;
    h = -inverseB / denominator;
  }
  const product = u * (1 - u);
  const weight = 1 - k * product;
  return {
    x: (u - 0.5) / weight,
    y: 2 * h * product / weight
  };
}

function wavelengthPassesFilter(filter, wavelength) {
  if (!filter) return true;
  const inInterval =
    Math.abs(wavelength - filter.wavelength) <= filter.bandwidth;
  return filter.invert ? !inInterval : inInterval;
}

function normalizeVector(x, y, tolerance) {
  const length = Math.hypot(x, y);
  if (!(length > tolerance)) return null;
  return { x: x / length, y: y / length };
}

function createIntersectionTolerances(numericEpsilon) {
  validateNumericEpsilon(numericEpsilon);
  const parameter = getRoundingErrorFactor(
    PARAMETER_ERROR_OPERATION_COUNT,
    numericEpsilon
  );
  return {
    numericEpsilon,
    parameter,
    tangent: getRoundingErrorFactor(
      TANGENT_ERROR_OPERATION_COUNT,
      numericEpsilon
    ),
    cubicValue: getRoundingErrorFactor(
      CUBIC_VALUE_ERROR_OPERATION_COUNT,
      numericEpsilon
    ),
    endpoint: getRoundingErrorFactor(
      ENDPOINT_ERROR_OPERATION_COUNT,
      numericEpsilon
    ),
    rootRefinementSteps: Math.max(
      1,
      Math.ceil(-Math.log2(parameter)) + 1
    )
  };
}

function clampUnitParameter(u) {
  return Math.max(0, Math.min(1, u));
}

function isEndpointParameter(u) {
  return u === 0 || u === 1;
}

function addDistinctNumber(values, value, tolerance) {
  if (!values.some(existing => Math.abs(existing - value) <= tolerance)) {
    values.push(value);
  }
}

function copyHit(source, target) {
  target.s = source.s;
  target.u = source.u;
  target.normalX = source.normalX;
  target.normalY = source.normalY;
  target.sigma = source.sigma;
  return target;
}

function cross(ax, ay, bx, by) {
  return ax * by - ay * bx;
}
