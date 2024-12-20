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

import ParabolicMirror from '../../../src/simulator/js/sceneObjs/mirror/ParabolicMirror.js';
import Scene from '../../../src/simulator/js/Scene.js';
import { MockUser } from '../helpers/test-utils.js';

describe('ParabolicMirror', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    scene.gridSize = 20; // Set grid size
    obj = new ParabolicMirror(scene);
    user = new MockUser(obj);
  });

  it('creates with three clicks', () => {
    user.click(100, 100); // First endpoint
    user.click(200, 100); // Second endpoint
    user.click(150, 150); // Vertex point
    expect(obj.serialize()).toEqual({
      type: 'ParabolicMirror',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 100 },
      p3: { x: 150, y: 150 }
    });
  });

  it('creates with drag and click', () => {
    user.drag(100, 100, 200, 100); // Drag for endpoints
    user.click(150, 150); // Click for vertex point
    expect(obj.serialize()).toEqual({
      type: 'ParabolicMirror',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 100 },
      p3: { x: 150, y: 150 }
    });
  });

  it('creates with grid snapping', () => {
    scene.snapToGrid = true;
    user.click(101, 102); // Should snap to (100, 100)
    user.click(198, 97); // Should snap to (200, 100)
    user.click(152, 148); // Should snap to (160, 140)
    expect(obj.serialize()).toEqual({
      type: 'ParabolicMirror',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 100 },
      p3: { x: 160, y: 140 }
    });
  });

  it('drags endpoints with mouse', () => {
    user.click(100, 100);
    user.click(200, 100);
    user.click(150, 150);

    user.drag(100, 100, 120, 120); // Drag p1
    expect(obj.serialize()).toEqual({
      type: 'ParabolicMirror',
      p1: { x: 120, y: 120 },
      p2: { x: 200, y: 100 },
      p3: { x: 150, y: 150 }
    });
  });

  it('drags vertex point with mouse', () => {
    user.click(100, 100);
    user.click(200, 100);
    user.click(150, 150);

    user.drag(150, 150, 150, 180); // Drag p3
    expect(obj.serialize()).toEqual({
      type: 'ParabolicMirror',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 100 },
      p3: { x: 150, y: 180 }
    });
  });

  it('drags with grid snapping', () => {
    scene.snapToGrid = true;
    user.click(100, 100);
    user.click(200, 100);
    user.click(160, 140);

    user.drag(101, 101, 118, 122); // Should snap to (120, 120)
    expect(obj.serialize()).toEqual({
      type: 'ParabolicMirror',
      p1: { x: 120, y: 120 },
      p2: { x: 200, y: 100 },
      p3: { x: 160, y: 140 }
    });
  });

  it('sets properties for non-filter mode', () => {
    user.click(100, 100);
    user.click(200, 100);
    user.click(150, 150);
    expect(user.get("{{simulator:sceneObjs.BaseFilter.filter}}")).toBeNull();
  });

  it('sets properties for filter mode', () => {
    user.click(100, 100);
    user.click(200, 100);
    user.click(150, 150);
    user.setScene('simulateColors', true);
    user.set("{{simulator:sceneObjs.BaseFilter.filter}}", true);
    user.set("{{simulator:sceneObjs.common.wavelength}}", 500);
    user.set("{{simulator:sceneObjs.BaseFilter.bandwidth}}", 20);
    user.set("{{simulator:sceneObjs.BaseFilter.invert}}", true);

    expect(obj.serialize()).toEqual({
      type: "ParabolicMirror",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 100 },
      p3: { x: 150, y: 150 },
      filter: true,
      wavelength: 500,
      bandwidth: 20,
      invert: true
    });
  });
}); 