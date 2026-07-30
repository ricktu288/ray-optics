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
  getRoundingErrorFactor,
  validateNumericEpsilon
} from './numeric.js';

const PARAMETER_ERROR_OPERATION_COUNT = 32;
const TANGENT_ERROR_OPERATION_COUNT = 32;
const CUBIC_VALUE_ERROR_OPERATION_COUNT = 64;

/**
 * Count forward crossings of one curve for an even-odd region ray cast.
 *
 * @param {Object} geometry
 * @param {{originX: number, originY: number, directionX: number, directionY: number}} ray
 * @param {Object} [options]
 * @param {number} options.numericEpsilon
 * @param {number} [options.originTolerance]
 * @param {Object} [out]
 * @returns {{count: number, ambiguous: boolean, nearestForwardS: number}}
 */
export function countCurveRayCrossings(
  geometry,
  ray,
  options = {},
  out = {}
) {
  const tolerances = createIntersectionTolerances(options.numericEpsilon);
  const originTolerance =
    options.originTolerance ?? geometry.positionTolerance;
  out.count = 0;
  out.ambiguous = false;
  out.nearestForwardS = Infinity;

  switch (geometry.kind) {
    case 'lineSegment':
    case 'smoothLineSegment':
      countLineSegmentCrossings(
        geometry,
        ray,
        originTolerance,
        tolerances,
        out
      );
      break;
    case 'circularArc':
      countCircularArcCrossings(
        geometry,
        ray,
        originTolerance,
        tolerances,
        out
      );
      break;
    case 'cubicBezier':
      countCubicBezierCrossings(
        geometry,
        ray,
        originTolerance,
        tolerances,
        out
      );
      break;
    case 'circle':
      countCircleCrossings(
        geometry,
        ray,
        originTolerance,
        tolerances,
        out
      );
      break;
    default:
      throw new TypeError(
        `Unsupported prepared curve kind: ${JSON.stringify(geometry.kind)}`
      );
  }
  return out;
}

function countLineSegmentCrossings(
  geometry,
  ray,
  originTolerance,
  tolerances,
  out
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
      out.ambiguous = true;
    }
    return;
  }

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
    return;
  }
  const distanceScale = Math.abs(denominator);
  if (Math.abs(lineDistance) <= originTolerance * distanceScale) {
    return;
  }
  if (lineDistance * denominator < 0) return;
  out.nearestForwardS = lineDistance / denominator;
  if (isEndpointParameter(rawU, tolerances.parameter)) {
    out.ambiguous = true;
    return;
  }
  out.count++;
}

function countCircleCrossings(
  geometry,
  ray,
  originTolerance,
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
    const normalX = originX + s * directionX;
    const normalY = originY + s * directionY;
    if (!isForwardRoot(s, 0.5, false, originTolerance, tolerances, out)) {
      continue;
    }
    if (isNearTangency(
      directionX,
      directionY,
      normalX,
      normalY,
      tolerances.tangent
    )) {
      out.ambiguous = true;
      continue;
    }
    out.count++;
  }
}

function countCircularArcCrossings(
  geometry,
  ray,
  originTolerance,
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

    if (!isForwardRoot(
      rootS,
      rawU,
      true,
      originTolerance,
      tolerances,
      out
    )) {
      continue;
    }
    const frontLocalX = -4 * b * rootX;
    const frontLocalY = -(4 * b * rootY - oneMinusBSquared);
    if (isNearTangency(
      dx,
      dy,
      frontLocalX,
      frontLocalY,
      tolerances.tangent
    )) {
      out.ambiguous = true;
      continue;
    }
    out.count++;
  }
}

function countCubicBezierCrossings(
  geometry,
  ray,
  originTolerance,
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
  if (g.every(value => Math.abs(value) <= valueTolerance)) {
    out.ambiguous = true;
    return;
  }

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

  let lastRoot = -Infinity;
  let nearestForwardProjection = Infinity;
  for (let index = 0; index < partitions.length; index++) {
    const start = partitions[index];
    const startValue = evaluateScalarCubic(g, start);
    if (
      Math.abs(startValue) <= valueTolerance &&
      Math.abs(start - lastRoot) > tolerances.parameter
    ) {
      nearestForwardProjection = Math.min(
        nearestForwardProjection,
        addCubicCrossing(
          geometry,
          start,
          originX,
          originY,
          directionX,
          directionY,
          directionLengthSquared,
          originTolerance,
          tolerances,
          out
        )
      );
      lastRoot = start;
    }
    if (index + 1 >= partitions.length) continue;
    const end = partitions[index + 1];
    const endValue = evaluateScalarCubic(g, end);
    if (startValue * endValue < 0) {
      const root = refineScalarCubicRoot(
        g,
        start,
        end,
        startValue,
        tolerances.rootRefinementSteps
      );
      if (Math.abs(root - lastRoot) > tolerances.parameter) {
        nearestForwardProjection = Math.min(
          nearestForwardProjection,
          addCubicCrossing(
            geometry,
            root,
            originX,
            originY,
            directionX,
            directionY,
            directionLengthSquared,
            originTolerance,
            tolerances,
            out
          )
        );
        lastRoot = root;
      }
    }
  }
  if (Number.isFinite(nearestForwardProjection)) {
    out.nearestForwardS = Math.min(
      out.nearestForwardS,
      nearestForwardProjection / directionLengthSquared
    );
  }
}

function addCubicCrossing(
  geometry,
  u,
  originX,
  originY,
  directionX,
  directionY,
  directionLengthSquared,
  originTolerance,
  tolerances,
  out
) {
  const point = evaluateCubicLocal(geometry, u);
  const projection =
    (point.x - originX) * directionX +
    (point.y - originY) * directionY;
  if (!Number.isFinite(projection)) return Infinity;
  if (Math.abs(projection) <= originTolerance * directionLengthSquared) {
    return Infinity;
  }
  if (projection < 0) return Infinity;
  if (isEndpointParameter(u, tolerances.parameter)) {
    out.ambiguous = true;
    return projection;
  }
  const tangent = evaluateCubicTangent(geometry, u);
  if (isNearTangency(
    directionX,
    directionY,
    -tangent.y,
    tangent.x,
    tolerances.tangent
  )) {
    out.ambiguous = true;
    return projection;
  }
  out.count++;
  return projection;
}

function isForwardRoot(
  s,
  u,
  hasEndpoints,
  originTolerance,
  tolerances,
  out
) {
  if (!Number.isFinite(s)) return false;
  if (Math.abs(s) <= originTolerance) {
    return false;
  }
  if (s < 0) return false;
  out.nearestForwardS = Math.min(out.nearestForwardS, s);
  if (hasEndpoints && isEndpointParameter(u, tolerances.parameter)) {
    out.ambiguous = true;
    return false;
  }
  return true;
}

function evaluateCubicTangent(geometry, u) {
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
  return { x: tangentX, y: tangentY };
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
    rootRefinementSteps: Math.max(
      1,
      Math.ceil(-Math.log2(parameter)) + 1
    )
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

function isNearTangency(
  directionX,
  directionY,
  normalX,
  normalY,
  tolerance
) {
  const directionLengthSquared =
    directionX * directionX + directionY * directionY;
  const normalLengthSquared = normalX * normalX + normalY * normalY;
  if (!(directionLengthSquared > 0) || !(normalLengthSquared > 0)) {
    return true;
  }
  const dot = directionX * normalX + directionY * normalY;
  return dot * dot <=
    tolerance * tolerance * directionLengthSquared * normalLengthSquared;
}

function isEndpointParameter(u, tolerance) {
  return u <= tolerance || u >= 1 - tolerance;
}

function cross(ax, ay, bx, by) {
  return ax * by - ay * bx;
}
