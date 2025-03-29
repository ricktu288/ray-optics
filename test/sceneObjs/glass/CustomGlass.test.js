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

import CustomGlass from '../../../src/core/sceneObjs/glass/CustomGlass.js';
import Scene from '../../../src/core/Scene.js';
import { MockUser } from '../helpers/test-utils.js';

describe('CustomGlass', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    scene.gridSize = 20; // Set grid size
    obj = new CustomGlass(scene);
    user = new MockUser(obj);
  });

  it('creates object with points and equation', () => {
    user.click(100, 100);
    user.click(200, 300);
    expect(obj.serialize()).toEqual({
      type: "CustomGlass",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 }
    });
  });

  it('sets properties for non-simulateColors', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.setScene('simulateColors', false);
    user.set("{{simulator:sceneObjs.BaseGlass.refIndex}}", 1.8);
    user.set("", "-1");
    user.set(" < y < ", "x^2");

    expect(obj.serialize()).toEqual({
      type: "CustomGlass",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      refIndex: 1.8,
      eqn1: "-1",
      eqn2: "x^2"
    });
  });

  it('sets properties for simulateColors', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.setScene('simulateColors', true);
    user.set("{{simulator:sceneObjs.BaseGlass.cauchyCoeff}}", 1.8);
    user.set("B(μm²)", 0.008);
    user.set("", "-1");
    user.set(" < y < ", "x^2");

    expect(obj.serialize()).toEqual({
      type: "CustomGlass",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      refIndex: 1.8,
      cauchyB: 0.008,
      eqn1: "-1",
      eqn2: "x^2"
    });
  });
});
