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
  prepareCurve
} from '../../src/core/primitive/curveGeometry.js';
import {
  intersectCurve as intersectCurveWithNumericEpsilon,
  intersectCurveAll as intersectCurveAllWithNumericEpsilon,
  intersectProcessedCurve as intersectProcessedCurveWithNumericEpsilon
} from '../../src/core/primitive/intersections.js';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric.js';

function prepare(kind, params, options) {
  return prepareCurve({ kind, params }, {
    numericEpsilon: FLOAT32_EPSILON,
    ...options
  }).geometry;
}

function ray(originX, originY, directionX, directionY) {
  return { originX, originY, directionX, directionY };
}

function intersectCurve(geometry, inputRay, options = {}) {
  return intersectCurveWithNumericEpsilon(geometry, inputRay, {
    numericEpsilon: FLOAT32_EPSILON,
    ...options
  });
}

function intersectCurveAll(geometry, inputRay, options = {}) {
  return intersectCurveAllWithNumericEpsilon(geometry, inputRay, {
    numericEpsilon: FLOAT32_EPSILON,
    ...options
  });
}

function intersectProcessedCurve(
  processedCurve,
  inputRay,
  wavelength,
  options = {}
) {
  return intersectProcessedCurveWithNumericEpsilon(
    processedCurve,
    inputRay,
    wavelength,
    {
      numericEpsilon: FLOAT32_EPSILON,
      ...options
    }
  );
}

function scalePoint(point, scale, offsetX, offsetY) {
  return {
    x: offsetX + point.x * scale,
    y: offsetY + point.y * scale
  };
}

function createEndpointTestCases(scale, offsetRatio) {
  const offsetX = offsetRatio * scale;
  const offsetY = -0.37 * offsetRatio * scale;
  const point = value => scalePoint(value, scale, offsetX, offsetY);
  return [
    {
      name: 'line',
      kind: 'lineSegment',
      params: {
        start: point({ x: -1, y: -0.2 }),
        end: point({ x: 1, y: 0.35 })
      }
    },
    {
      name: 'nearly flat arc',
      kind: 'circularArc',
      params: {
        start: point({ x: -1, y: 0 }),
        end: point({ x: 1, y: 0.4 }),
        bulge: 1e-8
      }
    },
    {
      name: 'semicircular arc',
      kind: 'circularArc',
      params: {
        start: point({ x: -1, y: 0 }),
        end: point({ x: 1, y: 0.4 }),
        bulge: 1
      }
    },
    {
      name: 'cubic Bezier',
      kind: 'cubicBezier',
      params: {
        start: point({ x: -1, y: -0.2 }),
        control1: point({ x: -1, y: -0.2 }),
        control2: point({ x: 0.4, y: 0.9 }),
        end: point({ x: 1, y: 0.35 })
      }
    }
  ];
}

function createRayDirectedToEndpoint(endpoint, scale, numericEpsilon) {
  return createRayDirectedToPoint({
    x: endpoint.x - 3.7 * scale,
    y: endpoint.y + 2.9 * scale
  }, endpoint, numericEpsilon);
}

function createRayDirectedToPoint(origin, target, numericEpsilon) {
  const round = numericEpsilon === FLOAT32_EPSILON
    ? Math.fround
    : value => value;
  const originX = round(origin.x);
  const originY = round(origin.y);
  const targetX = round(target.x);
  const targetY = round(target.y);
  const dx = round(targetX - originX);
  const dy = round(targetY - originY);
  const length = round(Math.hypot(dx, dy));
  return {
    originX,
    originY,
    directionX: round(dx / length),
    directionY: round(dy / length)
  };
}

function createEndpointToInteriorParameters(numericEpsilon) {
  const parameters = new Set([
    0,
    numericEpsilon / 8,
    numericEpsilon / 2,
    numericEpsilon,
    2 * numericEpsilon,
    8 * numericEpsilon,
    32 * numericEpsilon,
    0.25,
    0.5
  ]);
  for (let exponent = -16; exponent <= -1; exponent++) {
    parameters.add(10 ** exponent);
  }
  return [...parameters]
    .filter(value => value >= 0 && value <= 0.5)
    .sort((a, b) => a - b);
}

function createTransverseRayThroughCurve(
  geometry,
  u,
  scale,
  numericEpsilon
) {
  const target = evaluatePreparedCurve(geometry, u);
  const secantStart = evaluatePreparedCurve(
    geometry,
    Math.max(0, u - 1e-4)
  );
  const secantEnd = evaluatePreparedCurve(
    geometry,
    Math.min(1, u + 1e-4)
  );
  const tangentX = secantEnd.x - secantStart.x;
  const tangentY = secantEnd.y - secantStart.y;
  const tangentLength = Math.hypot(tangentX, tangentY);
  const origin = {
    x: target.x + 3.7 * scale * tangentY / tangentLength,
    y: target.y - 3.7 * scale * tangentX / tangentLength
  };
  return createRayDirectedToPoint(origin, target, numericEpsilon);
}

describe('prepared curve intersections', () => {
  it('returns line distance, native parameter, adjusted normal, and side', () => {
    const geometry = prepare('lineSegment', {
      start: { x: 0, y: 0 },
      end: { x: 2, y: 0 }
    });
    const hit = intersectCurve(geometry, ray(1, 2, 0, -1));

    expect(hit.s).toBeCloseTo(2);
    expect(hit.u).toBeCloseTo(0.5);
    expect(hit.normalX).toBeCloseTo(0);
    expect(hit.normalY).toBeCloseTo(1);
    expect(hit.sigma).toBe(1);
  });

  it('uses endpoint caps to close a sub-f32 gap between connected pieces', () => {
    const first = prepare('lineSegment', {
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 }
    }, { lengthScale: 1 });
    const second = prepare('lineSegment', {
      start: { x: 1.000001, y: 0 },
      end: { x: 2, y: 0 }
    }, { lengthScale: 1 });
    const throughGap = ray(1.0000005, -1, 0, 1);

    const firstHit = intersectCurve(first, throughGap);
    const secondHit = intersectCurve(second, throughGap);

    expect(firstHit.u).toBe(1);
    expect(secondHit.u).toBe(0);
    expect(firstHit.s).toBeCloseTo(1);
    expect(secondHit.s).toBeCloseTo(1);
  });

  it('does not add endpoint caps when both ordinary arc roots are present', () => {
    const geometry = prepare('circularArc', {
      start: { x: 420, y: 220 },
      end: { x: 540, y: 360 },
      bulge: 4.871924368621301
    });
    const directionX = 80;
    const directionY = 0.0001;
    const directionLength = Math.hypot(directionX, directionY);
    const result = intersectCurveAll(
      geometry,
      ray(
        280,
        360,
        directionX / directionLength,
        directionY / directionLength
      )
    );

    expect(result.hits).toHaveLength(2);
    expect(result.hits[0]).toMatchObject({
      sigma: -1
    });
    expect(result.hits[0].u).toBeCloseTo(0.9999960079);
    expect(result.hits[1]).toMatchObject({
      sigma: 1
    });
    expect(result.hits[1].u).toBeCloseTo(0.6323119014);
  });

  it('always counts a ray directed to an endpoint across wide scales', () => {
    const numericEpsilons = [FLOAT32_EPSILON, Number.EPSILON];
    const scales = [1e-12, 1e-6, 1, 1e6, 1e12];
    const offsetRatios = [3.25, 1e4];

    for (const numericEpsilon of numericEpsilons) {
      for (const scale of scales) {
        for (const offsetRatio of offsetRatios) {
          for (const curve of createEndpointTestCases(scale, offsetRatio)) {
            const geometry = prepareCurve(curve, {
              lengthScale: scale,
              numericEpsilon
            }).geometry;
            for (const [u, endpoint] of [
              [0, curve.params.start],
              [1, curve.params.end]
            ]) {
              const inputRay = createRayDirectedToEndpoint(
                endpoint,
                scale,
                numericEpsilon
              );
              const result = intersectCurveAllWithNumericEpsilon(
                geometry,
                inputRay,
                { numericEpsilon }
              );

              expect({
                numericEpsilon,
                scale,
                offsetRatio,
                curve: curve.name,
                u,
                missed: result.hits.length === 0
              }).toEqual(expect.objectContaining({
                missed: false
              }));
            }
          }
        }
      }
    }
  });

  it('uses a configured endpoint tolerance as a minimum and pads bounds for it', () => {
    const prepared = prepareCurve({
      kind: 'lineSegment',
      params: {
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 }
      }
    }, {
      lengthScale: 1,
      endpointTolerance: 0.01,
      numericEpsilon: FLOAT32_EPSILON
    });
    const result = intersectCurveAllWithNumericEpsilon(
      prepared.geometry,
      ray(1.005, -1, 0, 1),
      { numericEpsilon: FLOAT32_EPSILON }
    );

    expect(result.hits).toEqual([
      expect.objectContaining({ u: 1 })
    ]);
    expect(prepared.geometry.endpointTolerance).toBe(0.01);
    expect(prepared.bounds.maxX).toBeCloseTo(1.01);
  });

  it('has no gap between endpoint and interior hits across wide scales', () => {
    const numericEpsilons = [FLOAT32_EPSILON, Number.EPSILON];
    const scales = [1e-12, 1e-6, 1, 1e6, 1e12];
    const offsetRatios = [3.25, 1e4];

    for (const numericEpsilon of numericEpsilons) {
      const distancesFromEndpoint =
        createEndpointToInteriorParameters(numericEpsilon);
      for (const scale of scales) {
        for (const offsetRatio of offsetRatios) {
          for (const curve of createEndpointTestCases(scale, offsetRatio)) {
            const geometry = prepareCurve(curve, {
              lengthScale: scale,
              numericEpsilon
            }).geometry;
            for (const endpointU of [0, 1]) {
              for (const distanceFromEndpoint of distancesFromEndpoint) {
                const u = endpointU === 0
                  ? distanceFromEndpoint
                  : 1 - distanceFromEndpoint;
                const target = evaluatePreparedCurve(geometry, u);
                const inputRay = createTransverseRayThroughCurve(
                  geometry,
                  u,
                  scale,
                  numericEpsilon
                );

                const result = intersectCurveAllWithNumericEpsilon(
                  geometry,
                  inputRay,
                  { numericEpsilon }
                );
                const round = numericEpsilon === FLOAT32_EPSILON
                  ? Math.fround
                  : value => value;
                const targetOffsetX = round(target.x) - inputRay.originX;
                const targetOffsetY = round(target.y) - inputRay.originY;
                const directionLengthSquared =
                  inputRay.directionX * inputRay.directionX +
                  inputRay.directionY * inputRay.directionY;
                const targetDistance = (
                  targetOffsetX * inputRay.directionX +
                  targetOffsetY * inputRay.directionY
                ) / directionLengthSquared;
                const targetDistanceTolerance = Math.max(
                  4 * geometry.positionTolerance,
                  64 * numericEpsilon * Math.abs(targetDistance)
                );
                const targetHit = result.hits.some(hit =>
                  Math.abs(hit.s - targetDistance) <= targetDistanceTolerance
                );

                expect({
                  numericEpsilon,
                  scale,
                  offsetRatio,
                  curve: curve.name,
                  endpointU,
                  distanceFromEndpoint,
                  missed: !targetHit
                }).toEqual(expect.objectContaining({ missed: false }));
              }
            }
          }
        }
      }
    }
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
  ])('intersects arc bulge %p and returns stable rational u', bulge => {
    const geometry = prepare('circularArc', {
      start: { x: -1, y: 0 },
      end: { x: 1, y: 0 },
      bulge
    });
    const midpointY = -bulge;
    const hit = intersectCurve(
      geometry,
      ray(0, midpointY - 2, 0, 1)
    );

    expect(hit).not.toBeNull();
    expect(hit.u).toBeCloseTo(0.5, 6);
    expect(hit.s).toBeCloseTo(2, 5);
    expect(Number.isFinite(hit.normalX)).toBe(true);
    expect(Number.isFinite(hit.normalY)).toBe(true);
  });

  it('uses 0.5 as the neutral circle parameter and preserves orientation', () => {
    const outward = prepare('circle', {
      center: { x: 0, y: 0 },
      radius: 1
    });
    const inward = prepare('circle', {
      center: { x: 0, y: 0 },
      radius: -1
    });

    const outwardHit = intersectCurve(outward, ray(-2, 0, 1, 0));
    const inwardHit = intersectCurve(inward, ray(-2, 0, 1, 0));

    expect(outwardHit).toMatchObject({ u: 0.5, sigma: 1 });
    expect(outwardHit.normalX).toBeCloseTo(-1);
    expect(inwardHit).toMatchObject({ u: 0.5, sigma: -1 });
    expect(inwardHit.normalX).toBeCloseTo(-1);
  });

  it('finds all three intersections of a looping scalar cubic', () => {
    const geometry = prepare('cubicBezier', {
      start: { x: 0, y: -0.08 },
      control1: { x: 1 / 3, y: 0.14 },
      control2: { x: 2 / 3, y: -0.14 },
      end: { x: 1, y: 0.08 }
    });
    const result = intersectCurveAll(
      geometry,
      ray(-1, 0, 1, 0)
    );

    expect(result.ambiguous).toBe(false);
    expect(result.hits).toHaveLength(3);
    expect(result.hits.map(hit => hit.u)).toEqual([
      expect.closeTo(0.2, 6),
      expect.closeTo(0.5, 6),
      expect.closeTo(0.8, 6)
    ]);
    expect(result.hits.map(hit => hit.s)).toEqual([
      expect.closeTo(1.2, 6),
      expect.closeTo(1.5, 6),
      expect.closeTo(1.8, 6)
    ]);
  });

  it('handles a nearly linear cubic without replacing its geometry', () => {
    const geometry = prepare('cubicBezier', {
      start: { x: -1, y: 0 },
      control1: { x: -0.3, y: 1e-8 },
      control2: { x: 0.3, y: -1e-8 },
      end: { x: 1, y: 0 }
    });
    const hit = intersectCurve(geometry, ray(0, -2, 0, 1));

    expect(hit).not.toBeNull();
    expect(hit.u).toBeCloseTo(0.5, 6);
    expect(hit.s).toBeCloseTo(2, 6);
  });

  it('retains arc and cubic hits after prepared data is rounded to f32', () => {
    const roundNumbersToF32 = value => Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        typeof item === 'number' ? Math.fround(item) : item
      ])
    );
    const arcGeometry = roundNumbersToF32(prepare('circularArc', {
      start: { x: -1, y: 0 },
      end: { x: 1, y: 0 },
      bulge: 1e-6
    }));
    const cubicGeometry = roundNumbersToF32(prepare('cubicBezier', {
      start: { x: -1, y: 0 },
      control1: { x: -0.3, y: 1e-6 },
      control2: { x: 0.3, y: -1e-6 },
      end: { x: 1, y: 0 }
    }));

    expect(intersectCurve(
      arcGeometry,
      ray(0, -1, 0, 1)
    ).u).toBeCloseTo(0.5, 5);
    expect(intersectCurve(
      cubicGeometry,
      ray(0, -1, 0, 1)
    ).u).toBeCloseTo(0.5, 5);
  });

  it('applies wavelength and one-sided policy outside curve geometry', () => {
    const processedCurve = {
      geometry: prepare('lineSegment', {
        start: { x: 0, y: 0 },
        end: { x: 1, y: 0 }
      }),
      ownerKind: 'surface',
      ownerId: 0,
      twoSided: false,
      filter: {
        wavelength: 500,
        bandwidth: 10,
        invert: false
      }
    };

    expect(intersectProcessedCurve(
      processedCurve,
      ray(0.5, 1, 0, -1),
      500
    )).not.toBeNull();
    expect(intersectProcessedCurve(
      processedCurve,
      ray(0.5, -1, 0, 1),
      500
    )).toBeNull();
    expect(intersectProcessedCurve(
      processedCurve,
      ray(0.5, 1, 0, -1),
      600
    )).toBeNull();
  });

  it('does not immediately re-hit an outgoing ray origin', () => {
    const geometry = prepare('lineSegment', {
      start: { x: -1, y: 0 },
      end: { x: 1, y: 0 }
    });

    expect(intersectCurve(geometry, ray(0, 0, 0, 1))).toBeNull();
  });
});
