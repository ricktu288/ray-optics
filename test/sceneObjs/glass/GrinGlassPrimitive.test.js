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

import Scene from '../../../src/core/Scene.js';
import { createDagClosureEvaluator } from '../../../src/core/formula/dag-evaluator.js';
import CircleGrinGlass from '../../../src/core/sceneObjs/glass/CircleGrinGlass.js';
import GrinGlass from '../../../src/core/sceneObjs/glass/GrinGlass.js';

describe('GRIN glass primitives', () => {
  test('polygon compiles shifted refractive-index and absorption formulas', () => {
    const scene = new Scene();
    const glass = new GrinGlass(scene);
    glass.path = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 }
    ];
    glass.refIndexFn =
      '1.5+0.25\\cdot x^2+0.1\\cdot y+0.01\\cdot\\lambda';
    glass.absorptionFn = '0.02\\cdot x+0.03\\cdot y';
    glass.origin = { x: 10, y: 20 };
    glass.stepSize = 0.5;
    glass.partialReflect = false;

    const [primitive] = glass.getPrimitives();
    expect(primitive.kind).toBe('region');
    expect(primitive.curves).toHaveLength(4);
    expect(primitive.curves.every(curve => curve.kind === 'lineSegment')).toBe(true);
    expect(primitive.stepSize).toBe(0.5);
    expect(primitive.partialReflect).toBe(false);
    expect(primitive.bulkType.paramNames.slice(0, 2)).toEqual(['x_0', 'y_0']);
    expect(primitive.params.x_0).toBe(10);
    expect(primitive.params.y_0).toBe(20);

    const evaluate = createDagClosureEvaluator(primitive.bulkType.dag);
    const values = evaluate({
      ...primitive.params,
      x: 12,
      y: 23,
      lambda: 500
    });
    expect(values.n).toBeCloseTo(7.8);
    expect(values.n_x).toBeCloseTo(1);
    expect(values.n_y).toBeCloseTo(0.1);
    expect(values.alpha).toBeCloseTo(0.13);

    glass.origin = { x: 11, y: 21 };
    const [movedPrimitive] = glass.getPrimitives();
    expect(movedPrimitive.bulkType).toBe(primitive.bulkType);
    expect(movedPrimitive.params.x_0).toBe(11);
    expect(movedPrimitive.params.y_0).toBe(21);
  });

  test('zero origin adds no shift parameters', () => {
    const scene = new Scene();
    const glass = new GrinGlass(scene);
    glass.path = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 }
    ];
    glass.refIndexFn = '1.5+0.25\\cdot x^2';
    glass.absorptionFn = '0.1\\cdot y';
    glass.origin = { x: 0, y: 0 };

    const [primitive] = glass.getPrimitives();
    expect(primitive.bulkType.paramNames).not.toContain('x_0');
    expect(primitive.bulkType.paramNames).not.toContain('y_0');
    expect(primitive.params).not.toHaveProperty('x_0');
    expect(primitive.params).not.toHaveProperty('y_0');

    const values = createDagClosureEvaluator(primitive.bulkType.dag)({
      ...primitive.params,
      x: 2,
      y: 3,
      lambda: 500
    });
    expect(values.n).toBeCloseTo(2.5);
    expect(values.n_x).toBeCloseTo(1);
    expect(values.n_y).toBeCloseTo(0);
    expect(values.alpha).toBeCloseTo(0.3);
  });

  test('circle emits one circle boundary', () => {
    const scene = new Scene();
    const glass = new CircleGrinGlass(scene);
    glass.p1 = { x: 3, y: 4 };
    glass.p2 = { x: 6, y: 8 };
    glass.origin = { x: 0, y: 0 };

    const [primitive] = glass.getPrimitives();
    expect(primitive.curves).toEqual([{
      kind: 'circle',
      params: {
        center: { x: 3, y: 4 },
        radius: 5
      }
    }]);
    expect(createDagClosureEvaluator(primitive.bulkType.dag)({
      ...primitive.params,
      x: 0,
      y: 0,
      lambda: 500
    }).alpha).toBe(0);
  });
});
