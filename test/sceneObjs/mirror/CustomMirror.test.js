/*
 * Copyright 2024 The Ray Optics Simulation authors and contributors
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

/*
 * Copyright 2024 The Ray Optics Simulation authors and contributors
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

import CustomMirror from '../../../src/core/sceneObjs/mirror/CustomMirror.js';
import Scene from '../../../src/core/Scene.js';
import { buildBvh } from '../../../src/core/primitive/bvh.js';
import { MockUser } from '../helpers/test-utils.js';

describe('CustomMirror', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    scene.gridSize = 20; // Set grid size
    obj = new CustomMirror(scene);
    user = new MockUser(obj);
  });

  it('creates object with points and equation', () => {
    user.click(100, 100);
    user.click(200, 300);
    expect(obj.serialize()).toEqual({
      type: "CustomMirror",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 }
    });
  });

  it('rotates 90 degrees around default center (midpoint)', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.rotate(Math.PI / 2); // 90 degrees counter-clockwise
    const result = obj.serialize();
    expect(result.p1.x).toBeCloseTo(250, 5);
    expect(result.p1.y).toBeCloseTo(150, 5);
    expect(result.p2.x).toBeCloseTo(50, 5);
    expect(result.p2.y).toBeCloseTo(250, 5);
    expect(result.type).toBe('CustomMirror');
  });

  it('scales to 50% around default center (midpoint)', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.scale(0.5); // Scale to 50%
    const result = obj.serialize();
    expect(result.p1.x).toBeCloseTo(125, 5);
    expect(result.p1.y).toBeCloseTo(150, 5);
    expect(result.p2.x).toBeCloseTo(175, 5);
    expect(result.p2.y).toBeCloseTo(250, 5);
    expect(result.type).toBe('CustomMirror');
  });

  it('sets properties for filter mode', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.setScene('simulateColors', true);
    user.set("{{simulator:sceneObjs.BaseFilter.filter}}", true);
    user.set("{{simulator:sceneObjs.common.wavelength}}", 500);
    user.set("{{simulator:sceneObjs.BaseFilter.bandwidth}}", 20);
    user.set("{{simulator:sceneObjs.BaseFilter.invert}}", true);
    user.set("y = ", "x^2");

    expect(obj.serialize()).toEqual({
      type: "CustomMirror",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      filter: true,
      wavelength: 500,
      bandwidth: 20,
      invert: true,
      eqn: "x^2"
    });
  });

  it('uses line primitives when a cubic Bézier derivative is non-finite', () => {
    obj.p1 = { x: 0, y: 0 };
    obj.p2 = { x: 1, y: 0 };
    obj.curveType = 'cubicBezier';

    const primitives = obj.getPrimitives();

    expect(primitives.length).toBeGreaterThan(2);
    expect(primitives[0].curve.kind).toBe('lineSegment');
    expect(primitives.at(-1).curve.kind).toBe('lineSegment');
    expect(primitives.some(primitive => primitive.curve.kind === 'cubicBezier')).toBe(true);
    expect(() => buildBvh(
      primitives.map(primitive => ({ curve: primitive.curve }))
    )).not.toThrow();
  });

  it('caches primitives until object or relevant scene settings change', () => {
    obj.p1 = { x: 0, y: 0 };
    obj.p2 = { x: 100, y: 0 };
    obj.filter = true;

    const initialPrimitives = obj.getPrimitives();
    expect(obj.getPrimitives()).toBe(initialPrimitives);

    scene.simulateColors = true;
    const colorPrimitives = obj.getPrimitives();
    expect(colorPrimitives).not.toBe(initialPrimitives);
    expect(colorPrimitives[0].filter).toBeDefined();
    expect(obj.getPrimitives()).toBe(colorPrimitives);

    obj.move(10, 20);
    const movedPrimitives = obj.getPrimitives();
    expect(movedPrimitives).not.toBe(colorPrimitives);
    expect(movedPrimitives[0].curve.params.start.x)
      .toBeCloseTo(colorPrimitives[0].curve.params.start.x + 10);
    expect(movedPrimitives[0].curve.params.start.y)
      .toBeCloseTo(colorPrimitives[0].curve.params.start.y + 20);
  });
});
