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

import { solveQuadraticRoots } from './curveGeometry.js';
import {
  getIntersectionTolerancePolicy
} from './numeric.js';

/**
 * Find only the nearest geometric intersection with one prepared curve.
 * Normal data is deliberately calculated separately after the caller has
 * rejected intersections that are farther than its current candidate.
 *
 * @param {Object} geometry
 * @param {{originX: number, originY: number, directionX: number, directionY: number}} ray
 * @param {Object} [options]
 * @param {number} options.numericEpsilon
 * @param {Object} [options.tolerancePolicy]
 * @param {number} [options.minDistance]
 * @param {Object} [out]
 * @returns {{s: number, u: number, normalX: number, normalY: number, sigma: number}|null}
 */
export function intersectCurve(geometry, ray, options = {}, out = {}) {
  const minDistance = options.minDistance ?? geometry.positionTolerance;
  const tolerances = options.tolerancePolicy ??
    getIntersectionTolerancePolicy(options.numericEpsilon);
  out.s = Infinity;
  out.normalX = 0;
  out.normalY = 0;
  out.sigma = 0;

  switch (geometry.kind) {
    case 'lineSegment':
    case 'smoothLineSegment':
      intersectLineSegment(geometry, ray, minDistance, tolerances, out);
      break;
    case 'circularArc':
      intersectCircularArc(
        geometry,
        ray,
        minDistance,
        tolerances,
        out
      );
      break;
    case 'cubicBezier':
      intersectCubicBezier(
        geometry,
        ray,
        minDistance,
        tolerances,
        out
      );
      break;
    case 'circle':
      intersectCircle(geometry, ray, minDistance, tolerances, out);
      break;
    default:
      throw new TypeError(
        `Unsupported prepared curve kind: ${JSON.stringify(geometry.kind)}`
      );
  }

  return Number.isFinite(out.s) ? out : null;
}

/**
 * Populate the incident-facing unit normal and geometric orientation of a
 * curve intersection unless they have already been calculated.
 *
 * @param {Object} geometry
 * @param {Object} ray
 * @param {{s: number, u: number, normalX: number, normalY: number, sigma: number}} intersection
 * @param {Object} [options]
 * @param {number} options.numericEpsilon
 * @param {Object} [options.tolerancePolicy]
 * @returns {{s: number, u: number, normalX: number, normalY: number, sigma: number}|null}
 */
export function ensureCurveIntersectionNormal(
  geometry,
  ray,
  intersection,
  options = {}
) {
  if (intersection.normalX !== 0 || intersection.normalY !== 0) {
    return intersection;
  }
  const tolerancePolicy = options.tolerancePolicy ??
    getIntersectionTolerancePolicy(options.numericEpsilon);
  const normalTolerance = tolerancePolicy.tangent;
  let frontNormalX;
  let frontNormalY;

  switch (geometry.kind) {
    case 'lineSegment':
      frontNormalX = -geometry.tangentY;
      frontNormalY = geometry.tangentX;
      break;
    case 'smoothLineSegment': {
      const oneMinusU = 1 - intersection.u;
      frontNormalX =
        oneMinusU * geometry.startNormalX +
        intersection.u * geometry.endNormalX;
      frontNormalY =
        oneMinusU * geometry.startNormalY +
        intersection.u * geometry.endNormalY;
      break;
    }
    case 'circle': {
      const orientation = Math.sign(geometry.signedInvRadius);
      const inverseRadius = Math.abs(geometry.signedInvRadius);
      const hitX =
        ray.originX + intersection.s * ray.directionX - geometry.centerX;
      const hitY =
        ray.originY + intersection.s * ray.directionY - geometry.centerY;
      frontNormalX = orientation * hitX * inverseRadius;
      frontNormalY = orientation * hitY * inverseRadius;
      break;
    }
    case 'circularArc': {
      const { tangentX: ex, tangentY: ey, bulge: b } = geometry;
      const nx = -ey;
      const ny = ex;
      const localPoint = evaluateArcLocal(b, intersection.u);
      const oneMinusBSquared = (1 - b) * (1 + b);
      const frontLocalX = -4 * b * localPoint.x;
      const frontLocalY =
        -(4 * b * localPoint.y - oneMinusBSquared);
      frontNormalX = ex * frontLocalX + nx * frontLocalY;
      frontNormalY = ey * frontLocalX + ny * frontLocalY;
      break;
    }
    case 'cubicBezier': {
      const u = intersection.u;
      const oneMinusU = 1 - u;
      const d0x = 3 * (geometry.control1X - geometry.startX);
      const d0y = 3 * (geometry.control1Y - geometry.startY);
      const d1x = 3 * (geometry.control2X - geometry.control1X);
      const d1y = 3 * (geometry.control2Y - geometry.control1Y);
      const d2x = 3 * (geometry.endX - geometry.control2X);
      const d2y = 3 * (geometry.endY - geometry.control2Y);
      frontNormalX = -(
        oneMinusU * oneMinusU * d0y +
        2 * oneMinusU * u * d1y +
        u * u * d2y
      );
      frontNormalY =
        oneMinusU * oneMinusU * d0x +
        2 * oneMinusU * u * d1x +
        u * u * d2x;
      break;
    }
    default:
      throw new TypeError(
        `Unsupported prepared curve kind: ${JSON.stringify(geometry.kind)}`
      );
  }

  if (geometry.kind !== 'lineSegment') {
    const length = Math.sqrt(
      frontNormalX * frontNormalX + frontNormalY * frontNormalY
    );
    if (!(length > normalTolerance)) return null;
    frontNormalX /= length;
    frontNormalY /= length;
  }
  const incidence =
    ray.directionX * frontNormalX + ray.directionY * frontNormalY;
  const sigma = incidence < 0 ? 1 : -1;
  intersection.normalX = sigma * frontNormalX;
  intersection.normalY = sigma * frontNormalY;
  intersection.sigma = sigma;
  return intersection;
}

function intersectLineSegment(
  geometry,
  ray,
  minDistance,
  tolerances,
  out
) {
  const intersection = intersectSupportingLine(geometry, ray, tolerances);
  if (!intersection) return;
  updateNearestIntersection(
    intersection.s,
    intersection.u,
    minDistance,
    out
  );
}

function intersectSupportingLine(geometry, ray, tolerances) {
  const offsetX = geometry.originX - ray.originX;
  const offsetY = geometry.originY - ray.originY;
  const denominator = cross(
    ray.directionX,
    ray.directionY,
    geometry.tangentX,
    geometry.tangentY
  );
  if (Math.abs(denominator) <= tolerances.tangent) return null;

  const rawU = cross(
    offsetX,
    offsetY,
    ray.directionX,
    ray.directionY
  ) * geometry.invLength / denominator;
  const parameterTolerance = Math.max(
    tolerances.parameter,
    getEndpointDistanceTolerance(geometry) * geometry.invLength
  );
  if (rawU < -parameterTolerance || rawU > 1 + parameterTolerance) {
    return null;
  }

  const s = cross(
    offsetX,
    offsetY,
    geometry.tangentX,
    geometry.tangentY
  ) / denominator;
  return { s, u: rawU };
}

function intersectCircle(
  geometry,
  ray,
  minDistance,
  tolerances,
  out
) {
  const inverseRadius = Math.abs(geometry.signedInvRadius);
  const originX = (ray.originX - geometry.centerX) * inverseRadius;
  const originY = (ray.originY - geometry.centerY) * inverseRadius;
  const directionX = ray.directionX * inverseRadius;
  const directionY = ray.directionY * inverseRadius;
  for (const s of solveQuadraticRoots(
    directionX * directionX + directionY * directionY,
    2 * (originX * directionX + originY * directionY),
    originX * originX + originY * originY - 1,
    tolerances.numericEpsilon
  )) {
    updateNearestIntersection(s, 0.5, minDistance, out);
  }
}

function intersectCircularArc(
  geometry,
  ray,
  minDistance,
  tolerances,
  out
) {
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
  const parameterTolerance = Math.max(
    tolerances.parameter,
    getEndpointDistanceTolerance(geometry) * geometry.invChordLength
  );

  for (const rootS of solveQuadraticRoots(
    2 * b * (dx * dx + dy * dy),
    4 * b * (x0 * dx + y0 * dy) - oneMinusBSquared * dy,
    2 * b * (x0 * x0 + y0 * y0 - 0.25) - oneMinusBSquared * y0,
    tolerances.numericEpsilon
  )) {
    const rootX = x0 + rootS * dx;
    const rootY = y0 + rootS * dy;
    const denominator = 1 - 2 * b * rootY;
    if (!(denominator > 0)) continue;
    const rawU = 0.5 + rootX / denominator;
    if (rawU < -parameterTolerance || rawU > 1 + parameterTolerance) {
      continue;
    }

    updateNearestIntersection(rootS, rawU, minDistance, out);
  }
}

function intersectCubicBezier(
  geometry,
  ray,
  minDistance,
  tolerances,
  out
) {
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
  if (g.every(value => Math.abs(value) <= valueTolerance)) return;

  const derivative0 = 3 * (g[1] - g[0]);
  const derivative1 = 3 * (g[2] - g[1]);
  const derivative2 = 3 * (g[3] - g[2]);
  const normalizedEndpointTolerance =
    getEndpointDistanceTolerance(geometry) * geometry.invScale;
  const parameterStart = -getCubicEndpointParameterTolerance(
    normalizedEndpointTolerance,
    Math.hypot(
      3 * (geometry.control1X - geometry.startX),
      3 * (geometry.control1Y - geometry.startY)
    ),
    tolerances.parameter
  );
  const parameterEnd = 1 + getCubicEndpointParameterTolerance(
    normalizedEndpointTolerance,
    Math.hypot(
      3 * (geometry.endX - geometry.control2X),
      3 * (geometry.endY - geometry.control2Y)
    ),
    tolerances.parameter
  );
  const partitions = [parameterStart];
  for (const root of solveQuadraticRoots(
    derivative0 - 2 * derivative1 + derivative2,
    2 * (derivative1 - derivative0),
    derivative0,
    tolerances.numericEpsilon
  )) {
    if (root > parameterStart && root < parameterEnd) {
      partitions.push(root);
    }
  }
  partitions.push(parameterEnd);
  partitions.sort((a, b) => a - b);

  for (let index = 0; index < partitions.length; index++) {
    const u = partitions[index];
    const value = evaluateScalarCubic(g, u);
    if (Math.abs(value) <= valueTolerance) {
      updateCubicCandidate(
        geometry,
        ray,
        u,
        originShift,
        nearOriginX,
        nearOriginY,
        directionX,
        directionY,
        directionLengthSquared,
        minDistance,
        out
      );
    }
    if (index + 1 >= partitions.length) continue;
    const end = partitions[index + 1];
    const endValue = evaluateScalarCubic(g, end);
    if (value * endValue < 0) {
      const root = refineScalarCubicRoot(
        g,
        u,
        end,
        value,
        tolerances.rootRefinementSteps
      );
      updateCubicCandidate(
        geometry,
        ray,
        root,
        originShift,
        nearOriginX,
        nearOriginY,
        directionX,
        directionY,
        directionLengthSquared,
        minDistance,
        out
      );
    }
  }
}

function updateCubicCandidate(
  geometry,
  ray,
  u,
  originShift,
  nearOriginX,
  nearOriginY,
  directionX,
  directionY,
  directionLengthSquared,
  minDistance,
  out
) {
  const point = evaluateCubicLocal(geometry, u);
  const s = originShift + (
    (point.x - nearOriginX) * directionX +
    (point.y - nearOriginY) * directionY
  ) / directionLengthSquared;
  updateNearestIntersection(s, u, minDistance, out);
}

function updateNearestIntersection(
  s,
  u,
  minDistance,
  out
) {
  if (!Number.isFinite(s) || s <= minDistance || s >= out.s) return;
  out.s = s;
  out.u = u;
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

function getEndpointDistanceTolerance(geometry) {
  return Math.max(
    geometry.positionTolerance,
    geometry.endpointTolerance ?? 0
  );
}

function getCubicEndpointParameterTolerance(
  normalizedDistanceTolerance,
  derivativeLength,
  arithmeticParameterTolerance
) {
  if (!(derivativeLength > 0)) return arithmeticParameterTolerance;
  return Math.max(
    arithmeticParameterTolerance,
    normalizedDistanceTolerance / derivativeLength
  );
}

function cross(ax, ay, bx, by) {
  return ax * by - ay * bx;
}
