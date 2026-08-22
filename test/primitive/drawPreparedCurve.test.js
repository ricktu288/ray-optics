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

import { prepareCurve } from '../../src/core/primitive/curveGeometry';
import {
  drawPreparedCurve,
  drawPreparedRegion
} from '../../src/core/primitive/drawPreparedCurve';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric';

function createRenderer() {
  return {
    ctx: {
      save: jest.fn(),
      restore: jest.fn(),
      setLineDash: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      arc: jest.fn(),
      bezierCurveTo: jest.fn(),
      closePath: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn()
    },
    lengthScale: 2,
    rgbaToCssColor: jest.fn(() => 'rgba(255, 0, 0, 1)')
  };
}

describe('prepared primitive curve drawing', () => {
  it('uses the canvas cubic Bézier path directly', () => {
    const renderer = createRenderer();
    const curve = {
      kind: 'cubicBezier',
      params: {
        start: { x: 1, y: 2 },
        control1: { x: 3, y: 5 },
        control2: { x: 7, y: 11 },
        end: { x: 13, y: 17 }
      }
    };
    const { geometry } = prepareCurve(curve, {
      numericEpsilon: FLOAT32_EPSILON
    });

    drawPreparedCurve(renderer, geometry, [1, 0, 0, 1], 3);

    expect(renderer.ctx.moveTo).toHaveBeenCalledWith(1, 2);
    expect(renderer.ctx.bezierCurveTo).toHaveBeenCalledWith(
      3,
      5,
      7,
      11,
      13,
      17
    );
    expect(renderer.ctx.lineTo).not.toHaveBeenCalled();
    expect(renderer.ctx.stroke).toHaveBeenCalledTimes(1);
    expect(renderer.ctx.lineWidth).toBe(6);
  });

  it.each([
    {
      kind: 'circularArc',
      params: {
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
        bulge: 0.5
      }
    },
    {
      kind: 'circle',
      params: {
        center: { x: 4, y: 6 },
        radius: 3
      }
    }
  ])('uses a canvas arc for $kind', curve => {
    const renderer = createRenderer();
    const { geometry } = prepareCurve(curve, {
      numericEpsilon: FLOAT32_EPSILON
    });

    drawPreparedCurve(renderer, geometry, [1, 0, 0, 1]);

    expect(renderer.ctx.arc).toHaveBeenCalledTimes(1);
    expect(renderer.ctx.stroke).toHaveBeenCalledTimes(1);
  });

  it('fills a connected region path with the even-odd rule', () => {
    const renderer = createRenderer();
    const geometries = [
      [[0, 0], [4, 0]],
      [[4, 0], [4, 3]],
      [[4, 3], [0, 3]],
      [[0, 3], [0, 0]]
    ].map(([start, end]) => prepareCurve({
      kind: 'lineSegment',
      params: {
        start: { x: start[0], y: start[1] },
        end: { x: end[0], y: end[1] }
      }
    }, {
      numericEpsilon: FLOAT32_EPSILON
    }).geometry);

    drawPreparedRegion(
      renderer,
      geometries,
      [0, 0, 1, 0.2],
      [0, 0, 1, 1]
    );

    expect(renderer.ctx.fill).toHaveBeenCalledWith('evenodd');
    expect(renderer.ctx.closePath).toHaveBeenCalledTimes(1);
    expect(renderer.ctx.stroke).toHaveBeenCalledTimes(1);
  });
});
