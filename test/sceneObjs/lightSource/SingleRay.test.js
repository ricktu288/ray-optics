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

import SingleRay from '../../../src/core/sceneObjs/lightSource/SingleRay';
import Scene from '../../../src/core/Scene';
import { createDagClosureEvaluator } from '../../../src/core/formula/dag-evaluator';
import { testLineObj } from '../helpers/lineObjTests';
import { MockUser } from '../helpers/test-utils';

describe('SingleRay', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    obj = new SingleRay(scene);
    user = new MockUser(obj);
  });

  testLineObj(() => ({ obj, user }));

  it('rotates 90 degrees around default center (p1)', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.rotate(Math.PI / 2); // 90 degrees counter-clockwise
    const result = obj.serialize();
    expect(result.p1.x).toBeCloseTo(100, 5); // p1 stays in place (center of rotation)
    expect(result.p1.y).toBeCloseTo(100, 5);
    expect(result.p2.x).toBeCloseTo(-100, 5); // p2 rotates around p1
    expect(result.p2.y).toBeCloseTo(200, 5);
    expect(result.type).toBe('SingleRay');
  });

  it('scales to 50% around default center (p1)', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.scale(0.5); // Scale to 50%
    const result = obj.serialize();
    expect(result.p1.x).toBeCloseTo(100, 5); // p1 stays in place (center of scaling)
    expect(result.p1.y).toBeCloseTo(100, 5);
    expect(result.p2.x).toBeCloseTo(150, 5); // p2 moves halfway to p1
    expect(result.p2.y).toBeCloseTo(200, 5);
    expect(result.type).toBe('SingleRay');
  });

  it('sets properties for non-simulateColors', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.set("{{simulator:sceneObjs.common.brightness}}", 0.3);
    expect(user.get("{{simulator:sceneObjs.common.wavelength}}")).toBeNull();
  });

  it('sets properties for simulateColors', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.setScene('simulateColors', true);

    user.set("{{simulator:sceneObjs.common.brightness}}", 0.3);
    user.set("{{simulator:sceneObjs.common.wavelength}}", 500);

    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      brightness: 0.3,
      wavelength: 500
    });
  });

  it('creates one primitive ray with a normalized direction', () => {
    obj.p1 = { x: 10, y: 20 };
    obj.p2 = { x: 13, y: 24 };
    obj.brightness = 0.8;

    const primitive = obj.getPrimitives()[0];
    const evaluate = createDagClosureEvaluator(primitive.sourceType.dag);
    const ray = evaluate({ ...primitive.params, i: 0, N: primitive.rayCount });

    expect(primitive.kind).toBe('source');
    expect(primitive.rayCount).toBe(1);
    expect(ray.x).toBe(10);
    expect(ray.y).toBe(20);
    expect(ray.d_x).toBeCloseTo(0.6);
    expect(ray.d_y).toBeCloseTo(0.8);
    expect(ray.P_s).toBeCloseTo(0.4);
    expect(ray.P_p).toBeCloseTo(0.4);
    expect(ray.lambda).toBe(540);
  });
});
