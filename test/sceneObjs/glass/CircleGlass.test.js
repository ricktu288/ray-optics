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

import CircleGlass from '../../../src/simulator/js/sceneObjs/glass/CircleGlass';
import Scene from '../../../src/simulator/js/Scene';
import { testCircleObj } from '../helpers/circleObjTests';
import { MockUser } from '../helpers/test-utils';

describe('CircleGlass', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    obj = new CircleGlass(scene);
    user = new MockUser(obj);
  });

  testCircleObj(() => ({ obj, user }));

  it('sets properties for non-simulateColors', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.setScene('simulateColors', false);
    user.set("{{simulator:sceneObjs.BaseGlass.refIndex}}", 1.8);
    expect(user.get("B(μm²)")).toBeNull();

    expect(obj.serialize()).toEqual({
      type: "CircleGlass",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      refIndex: 1.8
    });
  });

  it('sets properties for simulateColors', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.setScene('simulateColors', true);
    user.set("{{simulator:sceneObjs.BaseGlass.cauchyCoeff}}", 1.8);
    user.set("B(μm²)", 0.008);

    expect(obj.serialize()).toEqual({
      type: "CircleGlass",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      refIndex: 1.8,
      cauchyB: 0.008
    });
  });
}); 