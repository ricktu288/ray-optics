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

import AngleSource from '../../../src/core/sceneObjs/lightSource/AngleSource';
import Scene from '../../../src/core/Scene';
import { testLineObj } from '../helpers/lineObjTests';
import { MockUser } from '../helpers/test-utils';

describe('AngleSource', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    obj = new AngleSource(scene);
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
    expect(result.type).toBe('AngleSource');
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
    expect(result.type).toBe('AngleSource');
  });

  it('sets properties for non-simulateColors', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.set("{{simulator:sceneObjs.common.brightness}}", 0.3);
    user.set("{{simulator:sceneObjs.common.emisAngle}}", 45);
    expect(user.get("{{simulator:sceneObjs.common.wavelength}}")).toBeNull();
  });

  it('sets properties for simulateColors', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.setScene('simulateColors', true);

    user.set("{{simulator:sceneObjs.common.brightness}}", 0.3);
    user.set("{{simulator:sceneObjs.common.wavelength}}", 500);
    user.set("{{simulator:sceneObjs.common.emisAngle}}", 45);
    user.set("{{simulator:sceneObjs.AngleSource.symmetric}}", false);

    expect(obj.serialize()).toEqual({
      type: "AngleSource",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      brightness: 0.3,
      wavelength: 500,
      emisAngle: 45,
      symmetric: false
    });
  });
}); 