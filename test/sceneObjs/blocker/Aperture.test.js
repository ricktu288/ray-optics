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

import Aperture from '../../../src/core/sceneObjs/blocker/Aperture';
import Scene from '../../../src/core/Scene';
import { MockUser } from '../helpers/test-utils';
import geometry from '../../../src/core/geometry';

describe('Aperture', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    scene.gridSize = 20; // Set grid size
    obj = new Aperture(scene);
    user = new MockUser(obj);
  });

  // Line object tests implemented directly
  it('creates with two clicks', () => {
    user.click(100, 100);
    user.click(200, 200);
    expect(obj.serialize()).toEqual({
      type: 'Aperture',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 200 },
      p3: { x: 140, y: 140 },
      p4: { x: 160, y: 160 }
    });
  });

  it('creates with one drag', () => {
    user.drag(100, 100, 200, 200);
    expect(obj.serialize()).toEqual({
      type: 'Aperture',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 200 },
      p3: { x: 140, y: 140 },
      p4: { x: 160, y: 160 }
    });
  });

  it('creates with grid snapping', () => {
    scene.snapToGrid = true;
    user.click(101, 102); // Should snap to (100, 100)
    user.click(203, 204); // Should snap to (200, 200)
    expect(obj.serialize()).toEqual({
      type: 'Aperture',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 200 },
      p3: { x: 140, y: 140 },
      p4: { x: 160, y: 160 }
    });
  });

  it('hovers with mouse', () => {
    user.click(100, 100);
    user.click(200, 200);
    
    expect(user.hover(101, 101)).toBeTruthy(); // Near p1
    expect(user.hover(201, 201)).toBeTruthy(); // Near p2
    expect(user.hover(120, 120)).toBeTruthy(); // On p1-p3 segment
    expect(user.hover(180, 180)).toBeTruthy(); // On p2-p4 segment
    expect(user.hover(300, 300)).toBeFalsy();  // Far from object
  });

  it('drags with mouse', () => {
    user.click(100, 100);
    user.click(200, 200);

    user.drag(140, 140, 200, 200); // Drag p3
    expect(obj.serialize()).toEqual({
      type: 'Aperture',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 200 },
      p3: { x: 200, y: 200 },
      p4: { x: 100, y: 100 }
    });
  });

  it('drags with grid snapping', () => {
    scene.snapToGrid = true;
    user.click(100, 100);
    user.click(200, 200);

    user.drag(141, 141, 201, 201); // Should snap to (200, 200)
    expect(obj.serialize()).toEqual({
      type: 'Aperture',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 200 },
      p3: { x: 200, y: 200 },
      p4: { x: 100, y: 100 }
    });
  });

  it('sets properties for non-filter mode', () => {
    user.click(100, 100);
    user.click(200, 200);
    expect(user.get("{{simulator:sceneObjs.BaseFilter.filter}}")).toBeNull();
  });

  it('sets properties for filter mode', () => {
    user.click(100, 100);
    user.click(200, 200);
    user.setScene('simulateColors', true);
    user.set("{{simulator:sceneObjs.BaseFilter.filter}}", true);
    user.set("{{simulator:sceneObjs.common.wavelength}}", 500);
    user.set("{{simulator:sceneObjs.BaseFilter.bandwidth}}", 20);
    user.set("{{simulator:sceneObjs.BaseFilter.invert}}", true);

    expect(obj.serialize()).toEqual({
      type: "Aperture",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 200 },
      p3: { x: 140, y: 140 },
      p4: { x: 160, y: 160 },
      filter: true,
      wavelength: 500,
      bandwidth: 20,
      invert: true
    });
  });

  it('sets aperture diameter', () => {
    user.click(100, 100);
    user.click(200, 200);
    user.set("{{simulator:sceneObjs.Aperture.diameter}}", 50);

    const p3 = obj.serialize().p3;
    const p4 = obj.serialize().p4;
    const diameter = geometry.distance(p3, p4);
    expect(diameter).toBeCloseTo(50, 0);
  });

  it('drags p3 with mouse and updates diameter', () => {
    user.click(100, 100);
    user.click(200, 200);

    user.drag(140, 140, 200, 200); // Drag p3
    expect(obj.serialize()).toEqual({
      type: 'Aperture',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 200 },
      p3: { x: 200, y: 200 },
      p4: { x: 100, y: 100 }
    });
    expect(user.get("{{simulator:sceneObjs.Aperture.diameter}}")).toBeCloseTo(141.4, 1); // sqrt(2) * 100
  });

  it('drags p4 with mouse and updates diameter', () => {
    user.click(100, 100);
    user.click(200, 200);

    user.drag(160, 160, 100, 100); // Drag p4
    expect(obj.serialize()).toEqual({
      type: 'Aperture',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 200 },
      p3: { x: 200, y: 200 },
      p4: { x: 100, y: 100 }
    });
    expect(user.get("{{simulator:sceneObjs.Aperture.diameter}}")).toBeCloseTo(141.4, 1); // sqrt(2) * 100
  });
}); 