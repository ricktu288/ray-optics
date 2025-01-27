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

import CircleGrinGlass from '../../../src/core/sceneObjs/glass/CircleGrinGlass';
import Scene from '../../../src/core/Scene';
import { testCircleObj } from '../helpers/circleObjTests';
import { MockUser } from '../helpers/test-utils';

describe('CircleGrinGlass', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    obj = new CircleGrinGlass(scene);
    user = new MockUser(obj);
  });

  // Override the circle object tests to include origin
  it('creates with two clicks', () => {
    user.click(100, 100);
    user.click(200, 300);
    expect(obj.serialize()).toEqual({
      type: "CircleGrinGlass",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      origin: { x: 100, y: 100 }
    });
  });

  it('sets properties', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.set("n(x,y) = ", "1+x^2");
    user.set("{{simulator:sceneObjs.BaseGrinGlass.stepSize}}", 2);
    user.set("{{simulator:sceneObjs.BaseGrinGlass.intersectTol}}", 0.002);

    expect(obj.serialize()).toEqual({
      type: "CircleGrinGlass",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      origin: { x: 100, y: 100 },
      refIndexFn: "1+x^2",
      stepSize: 2,
      intersectTol: 0.002
    });
  });
}); 