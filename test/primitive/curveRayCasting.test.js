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

import { prepareCurve } from '../../src/core/primitive/curveGeometry.js';
import {
  countCurveRayCrossings as countCurveRayCrossingsWithNumericEpsilon
} from '../../src/core/primitive/curveRayCrossings.js';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric.js';

function prepareLine(start, end) {
  return prepareCurve({
    kind: 'lineSegment',
    params: { start, end }
  }, {
    numericEpsilon: FLOAT32_EPSILON
  }).geometry;
}

function countCurveRayCrossings(geometry, ray, options = {}) {
  return countCurveRayCrossingsWithNumericEpsilon(geometry, ray, {
    numericEpsilon: FLOAT32_EPSILON,
    ...options
  });
}

describe('primitive region ray casting', () => {
  it('returns the forward crossing count', () => {
    const segment = prepareLine({ x: 1, y: -1 }, { x: 1, y: 1 });
    const result = countCurveRayCrossings(segment, {
      originX: 0,
      originY: 0,
      directionX: 1,
      directionY: 0
    });

    expect(result).toEqual({
      count: 1,
      ambiguous: false,
      nearestForwardS: 1
    });
  });

  it('marks endpoint and tangent crossings as ambiguous', () => {
    const segment = prepareLine({ x: 1, y: 0 }, { x: 1, y: 1 });
    const endpointResult = countCurveRayCrossings(segment, {
      originX: 0,
      originY: 0,
      directionX: 1,
      directionY: 0
    });

    expect(endpointResult.ambiguous).toBe(true);
    expect(endpointResult.nearestForwardS).toBe(1);

    const circle = prepareCurve({
      kind: 'circle',
      params: {
        center: { x: 0, y: 0 },
        radius: 1
      }
    }, {
      numericEpsilon: FLOAT32_EPSILON
    }).geometry;
    const tangentResult = countCurveRayCrossings(circle, {
      originX: -2,
      originY: 1,
      directionX: 1,
      directionY: 0
    });

    expect(tangentResult).toEqual({
      count: 0,
      ambiguous: true,
      nearestForwardS: 2
    });
  });

  it('derives endpoint ambiguity from a parameter near the endpoint', () => {
    const segment = prepareLine({ x: 1, y: 0 }, { x: 1, y: 1 });
    const result = countCurveRayCrossings(segment, {
      originX: 0,
      originY: 1e-7,
      directionX: 1,
      directionY: 0
    });

    expect(result).toEqual({
      count: 0,
      ambiguous: true,
      nearestForwardS: 1
    });
  });

  it('ignores origin contacts', () => {
    const circle = prepareCurve({
      kind: 'circle',
      params: {
        center: { x: 0, y: 0 },
        radius: 2
      }
    }, {
      numericEpsilon: FLOAT32_EPSILON
    }).geometry;

    const result = countCurveRayCrossings(circle, {
      originX: 2,
      originY: 0,
      directionX: 1,
      directionY: 0
    });

    expect(result).toEqual({
      count: 0,
      ambiguous: false,
      nearestForwardS: Infinity
    });
  });

  it('counts all three crossings of a looping scalar cubic', () => {
    const geometry = prepareCurve({
      kind: 'cubicBezier',
      params: {
        start: { x: 0, y: -0.08 },
        control1: { x: 1 / 3, y: 0.14 },
        control2: { x: 2 / 3, y: -0.14 },
        end: { x: 1, y: 0.08 }
      }
    }, {
      numericEpsilon: FLOAT32_EPSILON
    }).geometry;

    expect(countCurveRayCrossings(geometry, {
      originX: -1,
      originY: 0,
      directionX: 1,
      directionY: 0
    })).toEqual({
      count: 3,
      ambiguous: false,
      nearestForwardS: expect.closeTo(1.2)
    });
  });
});
