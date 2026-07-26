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
  prepareCurve as prepareCurveWithNumericEpsilon
} from '../../src/core/primitive/curveGeometry.js';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric.js';

function prepareCurve(curve, options = {}) {
  return prepareCurveWithNumericEpsilon(curve, {
    numericEpsilon: FLOAT32_EPSILON,
    ...options
  });
}

function line(start, end) {
  return { kind: 'lineSegment', params: { start, end } };
}

function arc(start, end, bulge) {
  return { kind: 'circularArc', params: { start, end, bulge } };
}

function cubic(start, control1, control2, end) {
  return {
    kind: 'cubicBezier',
    params: { start, control1, control2, end }
  };
}

function expectBoundsContain(bounds, point) {
  expect(point.x).toBeGreaterThanOrEqual(bounds.minX);
  expect(point.x).toBeLessThanOrEqual(bounds.maxX);
  expect(point.y).toBeGreaterThanOrEqual(bounds.minY);
  expect(point.y).toBeLessThanOrEqual(bounds.maxY);
}

describe('prepared primitive curve geometry', () => {
  it('normalizes a line and pads its bounds using the selected epsilon', () => {
    const { geometry, bounds } = prepareCurve(
      line({ x: 2, y: 3 }, { x: 5, y: 7 }),
      { lengthScale: 1 }
    );

    expect(geometry).toMatchObject({
      kind: 'lineSegment',
      originX: 2,
      originY: 3,
      tangentX: 0.6,
      tangentY: 0.8,
      invLength: 0.2
    });
    expect(geometry.positionTolerance).toBeGreaterThan(0);
    expect(bounds.minX).toBeLessThan(2);
    expect(bounds.minY).toBeLessThan(3);
    expect(bounds.maxX).toBeGreaterThan(5);
    expect(bounds.maxY).toBeGreaterThan(7);
  });

  it('uses a smaller positional tolerance for an f64 engine', () => {
    const curve = line({ x: 2, y: 3 }, { x: 5, y: 7 });
    const f32 = prepareCurve(curve);
    const f64 = prepareCurveWithNumericEpsilon(curve, {
      numericEpsilon: Number.EPSILON
    });

    expect(f64.geometry.positionTolerance)
      .toBeLessThan(f32.geometry.positionTolerance);
    expect(f64.bounds.minX).toBeGreaterThan(f32.bounds.minX);
    expect(f64.bounds.maxX).toBeLessThan(f32.bounds.maxX);
  });

  it('converts only an exactly flat arc to a line', () => {
    const exact = prepareCurve(
      arc({ x: -1, y: 0 }, { x: 1, y: 0 }, 0)
    );
    const nearlyFlat = prepareCurve(
      arc({ x: -1, y: 0 }, { x: 1, y: 0 }, 1e-8)
    );

    expect(exact.geometry.kind).toBe('lineSegment');
    expect(nearlyFlat.geometry.kind).toBe('circularArc');
    expect(evaluatePreparedCurve(nearlyFlat.geometry, 0.5).y)
      .toBeCloseTo(-1e-8, 14);
  });

  it.each([
    1e-8,
    -1e-8,
    1 - 2 ** -20,
    1,
    1 + 2 ** -20,
    -1,
    2,
    -2
  ])('keeps center-free arc bounds conservative for bulge %p', bulge => {
    const { geometry, bounds } = prepareCurve(
      arc({ x: -3, y: 2 }, { x: 5, y: 6 }, bulge)
    );

    for (let index = 0; index <= 1000; index++) {
      expectBoundsContain(
        bounds,
        evaluatePreparedCurve(geometry, index / 1000)
      );
    }
  });

  it('normalizes cubic controls and bounds all sampled points', () => {
    const { geometry, bounds } = prepareCurve(cubic(
      { x: 100, y: -20 },
      { x: 140, y: 80 },
      { x: 180, y: -100 },
      { x: 220, y: 10 }
    ));

    expect(geometry.kind).toBe('cubicBezier');
    expect(Math.max(
      Math.abs(geometry.startX),
      Math.abs(geometry.startY),
      Math.abs(geometry.control1X),
      Math.abs(geometry.control1Y),
      Math.abs(geometry.control2X),
      Math.abs(geometry.control2Y),
      Math.abs(geometry.endX),
      Math.abs(geometry.endY)
    )).toBeLessThanOrEqual(0.5);

    for (let index = 0; index <= 1000; index++) {
      expectBoundsContain(
        bounds,
        evaluatePreparedCurve(geometry, index / 1000)
      );
    }
  });

  it('preserves a circle radius orientation and pads its bounds', () => {
    const { geometry, bounds } = prepareCurve({
      kind: 'circle',
      params: {
        center: { x: 3, y: -2 },
        radius: -4
      }
    });

    expect(geometry).toMatchObject({
      kind: 'circle',
      centerX: 3,
      centerY: -2,
      signedInvRadius: -0.25
    });
    expect(bounds.minX).toBeLessThan(-1);
    expect(bounds.maxX).toBeGreaterThan(7);
    expect(bounds.minY).toBeLessThan(-6);
    expect(bounds.maxY).toBeGreaterThan(2);
  });
});
