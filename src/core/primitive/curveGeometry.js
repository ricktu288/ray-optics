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
  getRoundingErrorFactor,
  validateNumericEpsilon
} from './numeric.js';

const POSITION_ERROR_OPERATION_COUNT = 16;
const ROOT_ERROR_OPERATION_COUNT = 32;

/**
 * Signals that a curve has no usable geometry and may be safely discarded by
 * primitive preprocessing. Other validation errors remain distinguishable.
 */
export class DegenerateCurveError extends RangeError {}

/**
 * @typedef {Object} PreparedLineSegmentGeometry
 * @property {'lineSegment'} kind
 * @property {number} originX - World-space start endpoint x coordinate.
 * @property {number} originY - World-space start endpoint y coordinate.
 * @property {number} tangentX - Unit tangent x component from start to end.
 * @property {number} tangentY - Unit tangent y component from start to end.
 * @property {number} invLength - Inverse segment length.
 * @property {number} positionTolerance - Derived world-space positional tolerance.
 * @property {number} endpointTolerance - Minimum world-space endpoint tolerance.
 */

/**
 * @typedef {Object} PreparedSmoothLineSegmentGeometry
 * @property {'smoothLineSegment'} kind
 * @property {number} originX - World-space start endpoint x coordinate.
 * @property {number} originY - World-space start endpoint y coordinate.
 * @property {number} tangentX - Unit geometric tangent x component from start to end.
 * @property {number} tangentY - Unit geometric tangent y component from start to end.
 * @property {number} invLength - Inverse segment length.
 * @property {number} startNormalX - Unit optical front-normal x component at the start endpoint.
 * @property {number} startNormalY - Unit optical front-normal y component at the start endpoint.
 * @property {number} endNormalX - Unit optical front-normal x component at the end endpoint.
 * @property {number} endNormalY - Unit optical front-normal y component at the end endpoint.
 * @property {number} positionTolerance - Derived world-space positional tolerance.
 * @property {number} endpointTolerance - Minimum world-space endpoint tolerance.
 */

/**
 * @typedef {Object} PreparedCircularArcGeometry
 * @property {'circularArc'} kind
 * @property {number} originX - World-space chord midpoint x coordinate.
 * @property {number} originY - World-space chord midpoint y coordinate.
 * @property {number} tangentX - Unit chord direction x component.
 * @property {number} tangentY - Unit chord direction y component.
 * @property {number} invChordLength - Inverse chord length.
 * @property {number} bulge - Tangent of one quarter of the signed sweep.
 * @property {number} positionTolerance - Derived world-space positional tolerance.
 * @property {number} endpointTolerance - Minimum world-space endpoint tolerance.
 */

/**
 * @typedef {Object} PreparedCubicBezierGeometry
 * @property {'cubicBezier'} kind
 * @property {number} originX - World-space normalization origin x coordinate.
 * @property {number} originY - World-space normalization origin y coordinate.
 * @property {number} invScale - Inverse uniform normalization scale.
 * @property {number} startX - Normalized start x coordinate.
 * @property {number} startY - Normalized start y coordinate.
 * @property {number} control1X - Normalized first-control x coordinate.
 * @property {number} control1Y - Normalized first-control y coordinate.
 * @property {number} control2X - Normalized second-control x coordinate.
 * @property {number} control2Y - Normalized second-control y coordinate.
 * @property {number} endX - Normalized end x coordinate.
 * @property {number} endY - Normalized end y coordinate.
 * @property {number} positionTolerance - Derived world-space positional tolerance.
 * @property {number} endpointTolerance - Minimum world-space endpoint tolerance.
 */

/**
 * @typedef {Object} PreparedCircleGeometry
 * @property {'circle'} kind
 * @property {number} centerX - World-space center x coordinate.
 * @property {number} centerY - World-space center y coordinate.
 * @property {number} signedInvRadius - Signed inverse radius preserving front-normal orientation.
 * @property {number} positionTolerance - Derived world-space positional tolerance.
 * @property {number} endpointTolerance - Always zero because a circle has no endpoints.
 */

/**
 * @typedef {PreparedLineSegmentGeometry|PreparedSmoothLineSegmentGeometry|PreparedCircularArcGeometry|PreparedCubicBezierGeometry|PreparedCircleGeometry} PreparedCurveGeometry
 */

/**
 * Prepare a primitive curve for engine-independent intersection testing.
 *
 * The returned bounds include the same engine-selected positional tolerance
 * used to extend open curves' accepted parameter intervals at their endpoints.
 * An engine that packs bounds into a lower-precision representation is
 * responsible for outward rounding while packing.
 *
 * @param {PrimitiveCurve} curve
 * @param {Object} [options]
 * @param {number} [options.lengthScale=1]
 * @param {number} [options.endpointTolerance=0] - Minimum world-space endpoint tolerance.
 * @param {number} options.numericEpsilon - Relative arithmetic epsilon selected by the engine.
 * @returns {{geometry: PreparedCurveGeometry, bounds: {minX: number, minY: number, maxX: number, maxY: number}}}
 */
export function prepareCurve(curve, {
  lengthScale = 1,
  endpointTolerance = 0,
  numericEpsilon
} = {}) {
  validateNumericEpsilon(numericEpsilon);
  if (!Number.isFinite(endpointTolerance) || endpointTolerance < 0) {
    throw new RangeError('endpointTolerance must be a finite nonnegative number.');
  }
  let geometry;
  let exactBounds;

  switch (curve.kind) {
    case 'lineSegment':
    case 'smoothLineSegment': {
      const { start, end } = curve.params;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      if (!(length > 0)) {
        throw new DegenerateCurveError(
          'A line segment must have distinct endpoints.'
        );
      }
      geometry = {
        kind: curve.kind,
        originX: start.x,
        originY: start.y,
        tangentX: dx / length,
        tangentY: dy / length,
        invLength: 1 / length
      };
      if (curve.kind === 'smoothLineSegment') {
        const startNormal = normalizePrimitiveNormal(
          curve.params.startNormal,
          'startNormal'
        );
        const endNormal = normalizePrimitiveNormal(
          curve.params.endNormal,
          'endNormal'
        );
        Object.assign(geometry, {
          startNormalX: startNormal.x,
          startNormalY: startNormal.y,
          endNormalX: endNormal.x,
          endNormalY: endNormal.y
        });
      }
      exactBounds = boundsFromCoordinates(
        Math.min(start.x, end.x),
        Math.min(start.y, end.y),
        Math.max(start.x, end.x),
        Math.max(start.y, end.y)
      );
      break;
    }

    case 'circularArc': {
      const { start, end, bulge } = curve.params;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const chordLength = Math.hypot(dx, dy);
      if (!(chordLength > 0)) {
        throw new DegenerateCurveError(
          'A circular arc must have distinct endpoints.'
        );
      }
      if (bulge === 0) {
        return prepareCurve({
          kind: 'lineSegment',
          params: { start, end }
        }, { lengthScale, endpointTolerance, numericEpsilon });
      }
      geometry = {
        kind: 'circularArc',
        originX: (start.x + end.x) * 0.5,
        originY: (start.y + end.y) * 0.5,
        tangentX: dx / chordLength,
        tangentY: dy / chordLength,
        invChordLength: 1 / chordLength,
        bulge
      };
      exactBounds = getPreparedCircularArcBounds(geometry, numericEpsilon);
      break;
    }

    case 'cubicBezier': {
      const { start, control1, control2, end } = curve.params;
      const minControlX = Math.min(start.x, control1.x, control2.x, end.x);
      const minControlY = Math.min(start.y, control1.y, control2.y, end.y);
      const maxControlX = Math.max(start.x, control1.x, control2.x, end.x);
      const maxControlY = Math.max(start.y, control1.y, control2.y, end.y);
      const scale = Math.max(
        maxControlX - minControlX,
        maxControlY - minControlY
      );
      if (!(scale > 0)) {
        throw new DegenerateCurveError(
          'A cubic Bezier must not collapse to one point.'
        );
      }
      const originX = (minControlX + maxControlX) * 0.5;
      const originY = (minControlY + maxControlY) * 0.5;
      const invScale = 1 / scale;
      geometry = {
        kind: 'cubicBezier',
        originX,
        originY,
        invScale,
        startX: (start.x - originX) * invScale,
        startY: (start.y - originY) * invScale,
        control1X: (control1.x - originX) * invScale,
        control1Y: (control1.y - originY) * invScale,
        control2X: (control2.x - originX) * invScale,
        control2Y: (control2.y - originY) * invScale,
        endX: (end.x - originX) * invScale,
        endY: (end.y - originY) * invScale
      };
      exactBounds = getPreparedCubicBezierBounds(geometry, numericEpsilon);
      break;
    }

    case 'circle': {
      const { center, radius } = curve.params;
      const absoluteRadius = Math.abs(radius);
      if (!(absoluteRadius > 0)) {
        throw new DegenerateCurveError(
          'A circle must have a nonzero radius.'
        );
      }
      geometry = {
        kind: 'circle',
        centerX: center.x,
        centerY: center.y,
        signedInvRadius: 1 / radius
      };
      exactBounds = boundsFromCoordinates(
        center.x - absoluteRadius,
        center.y - absoluteRadius,
        center.x + absoluteRadius,
        center.y + absoluteRadius
      );
      break;
    }

    default:
      throw new TypeError(
        `Unsupported primitive curve kind: ${JSON.stringify(curve.kind)}`
      );
  }

  const positionTolerance = getPositionTolerance(
    exactBounds,
    lengthScale,
    numericEpsilon
  );
  geometry.positionTolerance = positionTolerance;
  geometry.endpointTolerance =
    geometry.kind === 'circle' ? 0 : endpointTolerance;

  return {
    geometry,
    bounds: padBounds(
      exactBounds,
      Math.max(positionTolerance, geometry.endpointTolerance)
    )
  };
}

/**
 * Evaluate a prepared open curve at its native parameter.
 *
 * @param {Object} geometry
 * @param {number} u
 * @param {Object} [out]
 * @returns {{x: number, y: number}}
 */
export function evaluatePreparedCurve(geometry, u, out = {}) {
  switch (geometry.kind) {
    case 'lineSegment':
    case 'smoothLineSegment': {
      const length = 1 / geometry.invLength;
      out.x = geometry.originX + geometry.tangentX * length * u;
      out.y = geometry.originY + geometry.tangentY * length * u;
      return out;
    }

    case 'circularArc': {
      const local = evaluateCircularArcLocal(geometry.bulge, u);
      const chordLength = 1 / geometry.invChordLength;
      const normalX = -geometry.tangentY;
      const normalY = geometry.tangentX;
      out.x = geometry.originX + chordLength * (
        geometry.tangentX * local.x + normalX * local.y
      );
      out.y = geometry.originY + chordLength * (
        geometry.tangentY * local.x + normalY * local.y
      );
      return out;
    }

    case 'cubicBezier': {
      const local = evaluateCubicBezierLocal(geometry, u);
      const scale = 1 / geometry.invScale;
      out.x = geometry.originX + local.x * scale;
      out.y = geometry.originY + local.y * scale;
      return out;
    }

    default:
      throw new TypeError(`${geometry.kind} has no open-curve parameter.`);
  }
}

function normalizePrimitiveNormal(normal, name) {
  const length = Math.hypot(normal?.x, normal?.y);
  if (!(length > 0) || !Number.isFinite(length)) {
    throw new DegenerateCurveError(
      `A smooth line segment's ${name} must be a finite nonzero vector.`
    );
  }
  return {
    x: normal.x / length,
    y: normal.y / length
  };
}

/**
 * Solve a real quadratic with cancellation-resistant roots.
 *
 * @param {number} a
 * @param {number} b
 * @param {number} c
 * @param {number} numericEpsilon - Relative arithmetic epsilon selected by the engine.
 * @param {number[]} [out]
 * @returns {number[]}
 */
export function solveQuadraticRoots(a, b, c, numericEpsilon, out = []) {
  validateNumericEpsilon(numericEpsilon);
  out.length = 0;
  const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c));
  if (!(scale > 0) || !Number.isFinite(scale)) return out;

  a /= scale;
  b /= scale;
  c /= scale;

  if (a === 0) {
    if (b !== 0) out.push(-c / b);
    return out;
  }

  const product = 4 * a * c;
  let discriminant = b * b - product;
  const discriminantTolerance = getRoundingErrorFactor(
    ROOT_ERROR_OPERATION_COUNT,
    numericEpsilon
  ) * (
    Math.abs(b * b) + Math.abs(product) + Number.MIN_VALUE
  );
  if (discriminant < -discriminantTolerance) return out;
  if (Math.abs(discriminant) <= discriminantTolerance) {
    discriminant = 0;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  if (sqrtDiscriminant === 0) {
    out.push(-b / (2 * a));
    return out;
  }

  const q = -0.5 * (b + (b >= 0 ? sqrtDiscriminant : -sqrtDiscriminant));
  if (q === 0) {
    out.push(-b / (2 * a));
    return out;
  }

  const first = q / a;
  const second = c / q;
  if (first <= second) {
    out.push(first, second);
  } else {
    out.push(second, first);
  }
  return out;
}

function getPreparedCircularArcBounds(geometry, numericEpsilon) {
  const { tangentX: ex, tangentY: ey, bulge: b } = geometry;
  const nx = -ey;
  const ny = ex;
  const { k, h } = getRationalArcFactors(b);
  const derivativeX = [1 - 0.5 * k, k, -k];
  const derivativeY = [2 * h, -4 * h, 0];
  const candidates = [0, 1];

  addInteriorQuadraticRoots(
    ex * derivativeX[2] + nx * derivativeY[2],
    ex * derivativeX[1] + nx * derivativeY[1],
    ex * derivativeX[0] + nx * derivativeY[0],
    candidates,
    numericEpsilon
  );
  addInteriorQuadraticRoots(
    ey * derivativeX[2] + ny * derivativeY[2],
    ey * derivativeX[1] + ny * derivativeY[1],
    ey * derivativeX[0] + ny * derivativeY[0],
    candidates,
    numericEpsilon
  );

  const points = candidates.map(u => evaluatePreparedCurve(geometry, u));
  return boundsFromPoints(points);
}

function getPreparedCubicBezierBounds(geometry, numericEpsilon) {
  const candidates = [0, 1];
  addCubicCoordinateExtrema(
    geometry.startX,
    geometry.control1X,
    geometry.control2X,
    geometry.endX,
    candidates,
    numericEpsilon
  );
  addCubicCoordinateExtrema(
    geometry.startY,
    geometry.control1Y,
    geometry.control2Y,
    geometry.endY,
    candidates,
    numericEpsilon
  );
  return boundsFromPoints(
    candidates.map(u => evaluatePreparedCurve(geometry, u))
  );
}

function addCubicCoordinateExtrema(
  p0,
  p1,
  p2,
  p3,
  candidates,
  numericEpsilon
) {
  const d0 = 3 * (p1 - p0);
  const d1 = 3 * (p2 - p1);
  const d2 = 3 * (p3 - p2);
  addInteriorQuadraticRoots(
    d0 - 2 * d1 + d2,
    2 * (d1 - d0),
    d0,
    candidates,
    numericEpsilon
  );
}

function addInteriorQuadraticRoots(a, b, c, candidates, numericEpsilon) {
  const rootTolerance = getRoundingErrorFactor(
    ROOT_ERROR_OPERATION_COUNT,
    numericEpsilon
  );
  for (const root of solveQuadraticRoots(a, b, c, numericEpsilon)) {
    if (root > 0 && root < 1 && Number.isFinite(root)) {
      if (!candidates.some(
        candidate => Math.abs(candidate - root) <= rootTolerance
      )) {
        candidates.push(root);
      }
    }
  }
}

function evaluateCubicBezierLocal(geometry, u) {
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

function evaluateCircularArcLocal(b, u) {
  const { k, h } = getRationalArcFactors(b);
  const product = u * (1 - u);
  const weight = 1 - k * product;
  return {
    x: (u - 0.5) / weight,
    y: 2 * h * product / weight
  };
}

function getRationalArcFactors(b) {
  const absoluteB = Math.abs(b);
  if (absoluteB <= 1) {
    const denominator = 1 + b * b;
    return {
      k: 4 * b * b / denominator,
      h: -b / denominator
    };
  }
  const inverseB = 1 / b;
  const denominator = 1 + inverseB * inverseB;
  return {
    k: 4 / denominator,
    h: -inverseB / denominator
  };
}

function getPositionTolerance(
  bounds,
  lengthScale,
  numericEpsilon
) {
  const coordinateScale = Math.max(
    Math.abs(bounds.minX),
    Math.abs(bounds.minY),
    Math.abs(bounds.maxX),
    Math.abs(bounds.maxY),
    Math.abs(lengthScale),
    Number.MIN_VALUE
  );
  return getRoundingErrorFactor(
    POSITION_ERROR_OPERATION_COUNT,
    numericEpsilon
  ) * coordinateScale;
}

function padBounds(bounds, padding) {
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding
  };
}

function boundsFromCoordinates(minX, minY, maxX, maxY) {
  return { minX, minY, maxX, maxY };
}

function boundsFromPoints(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}
