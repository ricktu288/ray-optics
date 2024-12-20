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

import CustomMirror from '../../../src/simulator/js/sceneObjs/mirror/CustomMirror.js';
import Scene from '../../../src/simulator/js/Scene.js';
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
}); 