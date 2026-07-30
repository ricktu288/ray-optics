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
  ensureCurveIntersectionNormal,
  intersectCurve as intersectCurveGeometry
} from '../../src/core/primitive/nearestIntersection.js';
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
  const numericEpsilon = options.numericEpsilon ?? FLOAT32_EPSILON;
  const hit = intersectCurveGeometry(geometry, inputRay, {
    ...options,
    numericEpsilon
  });
  if (!hit) return null;
  return ensureCurveIntersectionNormal(
    geometry,
    inputRay,
    hit,
    { numericEpsilon }
  );
}

function intersectCurveWithNumericEpsilon(
  geometry,
  inputRay,
  options
) {
  return intersectCurveGeometry(geometry, inputRay, {
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
  const filter = processedCurve.filter;
  const inFilterInterval = !filter ||
    Math.abs(wavelength - filter.wavelength) <= filter.bandwidth;
  const filterPasses = !filter ||
    (filter.invert ? !inFilterInterval : inFilterInterval);
  if (!filterPasses) return null;
  const hit = intersectCurve(
    processedCurve.geometry,
    inputRay,
    options
  );
  if (!hit) return null;
  const frontSideOnly =
    processedCurve.ownerKind !== 'region' && !processedCurve.twoSided;
  return frontSideOnly && hit.sigma !== 1 ? null : hit;
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

function createTransverseRayThroughExtendedCurve(
  geometry,
  u,
  scale,
  numericEpsilon
) {
  const target = evaluatePreparedCurve(geometry, u);
  const secantStart = evaluatePreparedCurve(geometry, u - 1e-5);
  const secantEnd = evaluatePreparedCurve(geometry, u + 1e-5);
  const tangentX = secantEnd.x - secantStart.x;
  const tangentY = secantEnd.y - secantStart.y;
  const tangentLength = Math.hypot(tangentX, tangentY);
  const origin = {
    x: target.x + 2 * scale * tangentY / tangentLength,
    y: target.y - 2 * scale * tangentX / tangentLength
  };
  return createRayDirectedToPoint(origin, target, numericEpsilon);
}

describe('prepared curve intersections', () => {
  it('calculates line distance/parameter before normal/side', () => {
    const geometry = prepare('lineSegment', {
      start: { x: 0, y: 0 },
      end: { x: 2, y: 0 }
    });
    const inputRay = ray(1, 2, 0, -1);
    const hit = intersectCurveGeometry(geometry, inputRay, {
      numericEpsilon: FLOAT32_EPSILON
    });

    expect(hit).toEqual({
      s: 2,
      u: 0.5,
      normalX: 0,
      normalY: 0,
      sigma: 0
    });
    ensureCurveIntersectionNormal(
      geometry,
      inputRay,
      hit,
      { numericEpsilon: FLOAT32_EPSILON }
    );
    expect(hit.s).toBeCloseTo(2);
    expect(hit.u).toBeCloseTo(0.5);
    expect(hit.normalX).toBeCloseTo(0);
    expect(hit.normalY).toBeCloseTo(1);
    expect(hit.sigma).toBe(1);
  });

  it('interpolates the optical normal of a smooth line segment', () => {
    const geometry = prepare('smoothLineSegment', {
      start: { x: 0, y: 0 },
      end: { x: 2, y: 0 },
      startNormal: { x: 0, y: 1 },
      endNormal: { x: 1, y: 0 }
    });
    const hit = intersectCurve(geometry, ray(1, 2, 0, -1));

    expect(hit.s).toBeCloseTo(2);
    expect(hit.u).toBeCloseTo(0.5);
    expect(hit.normalX).toBeCloseTo(Math.SQRT1_2);
    expect(hit.normalY).toBeCloseTo(Math.SQRT1_2);
    expect(hit.sigma).toBe(1);
  });

  it('uses the interpolated smooth normal for crossing side', () => {
    const geometry = prepare('smoothLineSegment', {
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      startNormal: { x: 1, y: 0.1 },
      endNormal: { x: 1, y: 0.1 }
    });
    const hit = intersectCurve(geometry, ray(6, -0.1, -1, 0.1));

    expect(hit.u).toBeCloseTo(0.5);
    expect(hit.sigma).toBe(1);
    expect(hit.normalX).toBeGreaterThan(0);
    expect(hit.normalY).toBeGreaterThan(0);
  });

  it('extends a line parameter interval across a sub-f32 junction gap', () => {
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

    expect(firstHit.u).toBeGreaterThan(1);
    expect(secondHit.u).toBeLessThan(0);
    expect(firstHit.s).toBeCloseTo(1);
    expect(secondHit.s).toBeCloseTo(1);
  });

  it('selects the nearest ordinary arc root', () => {
    const geometry = prepare('circularArc', {
      start: { x: 420, y: 220 },
      end: { x: 540, y: 360 },
      bulge: 4.871924368621301
    });
    const directionX = 80;
    const directionY = 0.0001;
    const directionLength = Math.hypot(directionX, directionY);
    const hit = intersectCurve(
      geometry,
      ray(
        280,
        360,
        directionX / directionLength,
        directionY / directionLength
      )
    );

    expect(hit).toMatchObject({ sigma: -1 });
    expect(hit.u).toBeCloseTo(0.9999960079);
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
              const hit = intersectCurveWithNumericEpsilon(
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
                missed: hit === null
              }).toEqual(expect.objectContaining({
                missed: false
              }));
            }
          }
        }
      }
    }
  });

  it('uses a configured endpoint tolerance to extend a line and its bounds', () => {
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
    const hit = intersectCurveWithNumericEpsilon(
      prepared.geometry,
      ray(1.005, -1, 0, 1),
      { numericEpsilon: FLOAT32_EPSILON }
    );

    expect(hit.u).toBeGreaterThan(1);
    expect(prepared.geometry.endpointTolerance).toBe(0.01);
    expect(prepared.bounds.maxX).toBeCloseTo(1.01);
  });

  it.each([
    {
      name: 'circular arc',
      curve: {
        kind: 'circularArc',
        params: {
          start: { x: -1, y: 0 },
          end: { x: 1, y: 0 },
          bulge: 0.5
        }
      }
    },
    {
      name: 'cubic Bezier',
      curve: {
        kind: 'cubicBezier',
        params: {
          start: { x: -1, y: 0 },
          control1: { x: -0.25, y: -0.2 },
          control2: { x: 0.25, y: 0.2 },
          end: { x: 1, y: 0 }
        }
      }
    }
  ])('extends the $name parameter interval at a junction', ({ curve }) => {
    const geometry = prepareCurve(curve, {
      lengthScale: 1,
      endpointTolerance: 0.01,
      numericEpsilon: FLOAT32_EPSILON
    }).geometry;
    const inputRay = createTransverseRayThroughExtendedCurve(
      geometry,
      1.002,
      1,
      FLOAT32_EPSILON
    );
    const hit = intersectCurve(geometry, inputRay);

    expect(hit.u).toBeGreaterThan(1);
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

                const hit = intersectCurveWithNumericEpsilon(
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
                const targetHit = hit &&
                  Math.abs(hit.s - targetDistance) <= targetDistanceTolerance;

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

  it('does not apply region tangency policy to an ordinary intersection', () => {
    const geometry = prepare('circle', {
      center: { x: 0, y: 0 },
      radius: 1
    });

    expect(intersectCurve(geometry, ray(-2, 1, 1, 0))).toMatchObject({
      s: expect.closeTo(2),
      u: 0.5
    });
  });
});
