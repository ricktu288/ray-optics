/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import geometry from '../geometry.js';

const TWO_PI = Math.PI * 2;
const SMOOTH_NORMAL_LENGTH_RATIO_LIMIT = 10;

export function createLineSegmentCurve(start, end) {
  if (!isFinitePoint(start) || !isFinitePoint(end) ||
      (start.x === end.x && start.y === end.y)) {
    return null;
  }
  return {
    kind: 'lineSegment',
    params: {
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y }
    }
  };
}

export function createCubicBezierCurve(curve) {
  if (!curve?.points || curve.points.length !== 4) return null;
  const [start, control1, control2, end] = curve.points;
  if (![start, control1, control2, end].every(isFinitePoint)) return null;
  if ([control1, control2, end].every(
    point => point.x === start.x && point.y === start.y
  )) {
    return null;
  }
  return {
    kind: 'cubicBezier',
    params: {
      start: { x: start.x, y: start.y },
      control1: { x: control1.x, y: control1.y },
      control2: { x: control2.x, y: control2.y },
      end: { x: end.x, y: end.y }
    }
  };
}

/**
 * Convert an endpoint/through-point circular arc to the primitive bulge form.
 * Collinear input falls back to a line segment.
 */
export function createArcOrLineCurve(start, end, through) {
  if (![start, end, through].every(isFinitePoint)) return null;
  const center = geometry.linesIntersection(
    geometry.perpendicularBisector(geometry.line(start, through)),
    geometry.perpendicularBisector(geometry.line(end, through))
  );
  if (center && Number.isFinite(center.x) && Number.isFinite(center.y)) {
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
    const throughAngle = Math.atan2(through.y - center.y, through.x - center.x);
    const counterclockwiseSweep = normalizeAngle(endAngle - startAngle);
    const throughSweep = normalizeAngle(throughAngle - startAngle);
    const signedSweep = throughSweep <= counterclockwiseSweep + 1e-12
      ? counterclockwiseSweep
      : counterclockwiseSweep - TWO_PI;
    const bulge = Math.tan(signedSweep * 0.25);
    if (Number.isFinite(bulge) && bulge !== 0) {
      return {
        kind: 'circularArc',
        params: {
          start: { x: start.x, y: start.y },
          end: { x: end.x, y: end.y },
          bulge
        }
      };
    }
  }
  return createLineSegmentCurve(start, end);
}

/**
 * Convert the sampled representation maintained by ParamCurveObjMixin and the
 * custom-equation glass/mirror classes. Each returned entry retains the
 * sampled parameter endpoints used to reconstruct a legacy `t` from native
 * primitive parameter `u`.
 */
export function createSampledPrimitiveCurveEntries(obj, {
  skipBoundarySegments = false
} = {}) {
  if (!obj.path && !obj.initPath?.()) return [];
  if (!obj.path || obj.path.length < 2) return [];

  if (obj.curveType === 'cubicBezier') {
    if (!obj._ensureCubicBezierPathReady?.()) return [];
    const entries = [];
    for (let index = 0; index < obj.bezierSegments.length; index++) {
      const isBoundary = Boolean(
        obj.bezierSegmentBoundaryFlags?.[index] ||
        obj.bezierSegmentLinearFlags?.[index]
      );
      if (skipBoundarySegments && isBoundary) continue;
      const curve = isBoundary
        ? createLineSegmentCurve(obj.path[index], obj.path[index + 1])
        : createCubicBezierCurve(obj.bezierSegments[index]);
      if (!curve) continue;
      entries.push({
        curve,
        index,
        parameterStart: obj.path[index].t,
        parameterEnd: obj.path[index + 1].t
      });
    }
    return entries;
  }

  const segmentInfos = obj.path.slice(0, -1).map(
    (start, index) => createSegmentInfo(start, obj.path[index + 1])
  );
  const entries = [];
  for (let index = 0; index < obj.path.length - 1; index++) {
    const start = obj.path[index];
    const end = obj.path[index + 1];
    const segment = segmentInfos[index];
    if (!segment) continue;
    let curve;
    if (obj.curveType === 'smoothNormal' &&
        !isLargeSamplingSkip(segmentInfos, index)) {
      curve = {
        kind: 'smoothLineSegment',
        params: {
          start: { x: start.x, y: start.y },
          end: { x: end.x, y: end.y },
          startNormal: getCornerNormal(segment, segmentInfos[index - 1]),
          endNormal: getCornerNormal(segment, segmentInfos[index + 1])
        }
      };
    } else {
      curve = createLineSegmentCurve(start, end);
    }
    if (!curve) continue;
    entries.push({
      curve,
      index,
      parameterStart: start.t,
      parameterEnd: end.t
    });
  }
  return entries;
}

export function createBezierPrimitiveCurves(curves) {
  return (curves || []).map(createCubicBezierCurve).filter(Boolean);
}

function isFinitePoint(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

function normalizeAngle(angle) {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

function createSegmentInfo(start, end) {
  if (!isFinitePoint(start) || !isFinitePoint(end)) return null;
  const tangentX = end.x - start.x;
  const tangentY = end.y - start.y;
  const length = Math.hypot(tangentX, tangentY);
  if (!(length > 0)) return null;
  return {
    length,
    normal: { x: -tangentY / length, y: tangentX / length }
  };
}

function getCornerNormal(segment, adjacentSegment) {
  if (!lengthsAreComparable(segment, adjacentSegment)) {
    return { ...segment.normal };
  }
  const x = segment.normal.x + adjacentSegment.normal.x;
  const y = segment.normal.y + adjacentSegment.normal.y;
  const length = Math.hypot(x, y);
  return length > 0
    ? { x: x / length, y: y / length }
    : { ...segment.normal };
}

function lengthsAreComparable(first, second) {
  if (!first || !second) return false;
  return first.length / second.length < SMOOTH_NORMAL_LENGTH_RATIO_LIMIT &&
    second.length / first.length < SMOOTH_NORMAL_LENGTH_RATIO_LIMIT;
}

function isLargeSamplingSkip(segments, index) {
  const segment = segments[index];
  const previous = segments[index - 1];
  const next = segments[index + 1];
  return Boolean(
    previous &&
      segment.length / previous.length >= SMOOTH_NORMAL_LENGTH_RATIO_LIMIT ||
    next &&
      segment.length / next.length >= SMOOTH_NORMAL_LENGTH_RATIO_LIMIT
  );
}
