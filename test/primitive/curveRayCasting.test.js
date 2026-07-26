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
  classifyPointInRegion as classifyPointInRegionWithNumericEpsilon,
  countCurveRayCrossings as countCurveRayCrossingsWithNumericEpsilon
} from '../../src/core/primitive/intersections.js';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric.js';

function prepareLine(start, end) {
  return prepareCurve({
    kind: 'lineSegment',
    params: { start, end }
  }, {
    numericEpsilon: FLOAT32_EPSILON
  }).geometry;
}

function squareCurves() {
  return [
    prepareLine({ x: -1, y: -1 }, { x: 1, y: -1 }),
    prepareLine({ x: 1, y: -1 }, { x: 1, y: 1 }),
    prepareLine({ x: 1, y: 1 }, { x: -1, y: 1 }),
    prepareLine({ x: -1, y: 1 }, { x: -1, y: -1 })
  ];
}

function classifyPointInRegion(curves, point, options = {}) {
  return classifyPointInRegionWithNumericEpsilon(curves, point, {
    numericEpsilon: FLOAT32_EPSILON,
    ...options
  });
}

function countCurveRayCrossings(geometry, ray, options = {}) {
  return countCurveRayCrossingsWithNumericEpsilon(geometry, ray, {
    numericEpsilon: FLOAT32_EPSILON,
    ...options
  });
}

describe('primitive region ray casting', () => {
  it('classifies points independently of curve order and orientation', () => {
    const curves = squareCurves();
    const reversed = [...curves].reverse().map(geometry => {
      const start = {
        x: geometry.originX,
        y: geometry.originY
      };
      const length = 1 / geometry.invLength;
      const end = {
        x: start.x + geometry.tangentX * length,
        y: start.y + geometry.tangentY * length
      };
      return prepareLine(end, start);
    });

    expect(classifyPointInRegion(curves, { x: 0, y: 0 })).toBe('inside');
    expect(classifyPointInRegion(curves, { x: 3, y: 0 })).toBe('outside');
    expect(classifyPointInRegion(reversed, { x: 0, y: 0 })).toBe('inside');
  });

  it('returns boundary when every retry starts on a curve', () => {
    expect(classifyPointInRegion(
      squareCurves(),
      { x: 1, y: 0 }
    )).toBe('boundary');
  });

  it('retries a cast which lands exactly on a remote corner', () => {
    const direction = {
      x: 0.9238795042037964,
      y: 0.3826834261417389
    };
    const corner = { x: direction.x * 2, y: direction.y * 2 };
    const curves = [
      prepareLine(corner, { x: corner.x + 2, y: corner.y }),
      prepareLine(
        { x: corner.x + 2, y: corner.y },
        { x: corner.x + 2, y: corner.y + 2 }
      ),
      prepareLine(
        { x: corner.x + 2, y: corner.y + 2 },
        { x: corner.x, y: corner.y + 2 }
      ),
      prepareLine({ x: corner.x, y: corner.y + 2 }, corner)
    ];

    expect(classifyPointInRegion(curves, { x: 0, y: 0 })).toBe('outside');
  });

  it('marks endpoint and tangent crossings as ambiguous', () => {
    const segment = prepareLine({ x: 1, y: 0 }, { x: 2, y: 0 });
    const endpointResult = countCurveRayCrossings(segment, {
      originX: 0,
      originY: 0,
      directionX: 1,
      directionY: 0
    });

    expect(endpointResult.ambiguous).toBe(true);
  });

  it('classifies a circular region', () => {
    const circle = prepareCurve({
      kind: 'circle',
      params: {
        center: { x: 0, y: 0 },
        radius: 2
      }
    }, {
      numericEpsilon: FLOAT32_EPSILON
    }).geometry;

    expect(classifyPointInRegion([circle], { x: 0, y: 0 })).toBe('inside');
    expect(classifyPointInRegion([circle], { x: 3, y: 0 })).toBe('outside');
    expect(classifyPointInRegion([circle], { x: 2, y: 0 })).toBe('boundary');
  });
});
