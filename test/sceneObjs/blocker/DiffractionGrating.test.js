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

import DiffractionGrating from '../../../src/core/sceneObjs/blocker/DiffractionGrating';
import Scene from '../../../src/core/Scene';
import { testLineObj } from '../helpers/lineObjTests';
import { MockUser } from '../helpers/test-utils';

describe('DiffractionGrating', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    obj = new DiffractionGrating(scene);
    user = new MockUser(obj);
  });

  testLineObj(() => ({ obj, user }));

  it('rotates 90 degrees around default center (midpoint)', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.rotate(Math.PI / 2); // 90 degrees counter-clockwise
    const result = obj.serialize();
    expect(result.p1.x).toBeCloseTo(250, 5);
    expect(result.p1.y).toBeCloseTo(150, 5);
    expect(result.p2.x).toBeCloseTo(50, 5);
    expect(result.p2.y).toBeCloseTo(250, 5);
    expect(result.type).toBe('DiffractionGrating');
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
    expect(result.type).toBe('DiffractionGrating');
  });

  it('sets properties without custom brightness', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.set("{{simulator:sceneObjs.DiffractionGrating.lineDensity}}", 600);
    user.set("{{simulator:sceneObjs.DiffractionGrating.mirrored}}", true);
    user.set("{{simulator:sceneObjs.DiffractionGrating.slitRatio}}", 0.7);

    expect(obj.serialize()).toEqual({
      type: "DiffractionGrating",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      lineDensity: 600,
      mirrored: true,
      slitRatio: 0.7
    });
  });

  it('sets properties with custom brightness', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.set("{{simulator:sceneObjs.DiffractionGrating.lineDensity}}", 600);
    user.set("{{simulator:sceneObjs.DiffractionGrating.mirrored}}", true);
    user.set("{{simulator:sceneObjs.DiffractionGrating.customBrightness}}", true);
    user.set("{{simulator:sceneObjs.DiffractionGrating.customBrightness}}", '1, 0.7, 0.7, 0.3, 0.3', 1);

    expect(obj.serialize()).toEqual({
      type: "DiffractionGrating",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      lineDensity: 600,
      mirrored: true,
      customBrightness: true,
      brightnesses: [1, 0.7, 0.7, 0.3, 0.3]
    });
  });
}); 