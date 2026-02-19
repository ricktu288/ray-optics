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

import ArcMirror from '../../../src/core/sceneObjs/mirror/ArcMirror';
import Scene from '../../../src/core/Scene';
import { MockUser } from '../helpers/test-utils';
import geometry from '../../../src/core/geometry';

describe('ArcMirror', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    scene.gridSize = 20; // Set grid size
    obj = new ArcMirror(scene);
    user = new MockUser(obj);
  });

  it('creates with three clicks', () => {
    user.click(100, 100); // First endpoint
    user.click(200, 100); // Second endpoint
    user.click(150, 150); // Control point on arc
    expect(obj.serialize()).toEqual({
      type: 'ArcMirror',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 100 },
      p3: { x: 150, y: 150 }
    });
  });

  it('creates with drag and click', () => {
    user.drag(100, 100, 200, 100); // Drag for endpoints
    user.click(150, 150); // Click for control point
    expect(obj.serialize()).toEqual({
      type: 'ArcMirror',
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
      type: 'ArcMirror',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 100 },
      p3: { x: 160, y: 140 }
    });
  });

  it('hovers with mouse', () => {
    user.click(100, 100);
    user.click(200, 100);
    user.click(150, 150);
    
    // Test hover on endpoints and control point
    expect(user.hover(101, 101)).toBeTruthy(); // Near p1
    expect(user.hover(201, 101)).toBeTruthy(); // Near p2
    expect(user.hover(151, 151)).toBeTruthy(); // Near p3

    // Test hover on arc segments
    const center = geometry.linesIntersection(
      geometry.perpendicularBisector(geometry.line(obj.p1, obj.p3)),
      geometry.perpendicularBisector(geometry.line(obj.p2, obj.p3))
    );
    const radius = geometry.distance(center, obj.p3);
    const pointOnArc = {
      x: center.x + radius * Math.cos(Math.PI / 4),
      y: center.y + radius * Math.sin(Math.PI / 4)
    };
    expect(user.hover(pointOnArc.x, pointOnArc.y)).toBeTruthy();
    
    // Test point far from object
    expect(user.hover(300, 300)).toBeFalsy();
  });

  it('drags endpoints with mouse', () => {
    user.click(100, 100);
    user.click(200, 100);
    user.click(150, 150);

    user.drag(100, 100, 120, 120); // Drag p1
    expect(obj.serialize()).toEqual({
      type: 'ArcMirror',
      p1: { x: 120, y: 120 },
      p2: { x: 200, y: 100 },
      p3: { x: 150, y: 150 }
    });
  });

  it('drags control point with mouse', () => {
    user.click(100, 100);
    user.click(200, 100);
    user.click(150, 150);

    user.drag(150, 150, 150, 180); // Drag p3
    expect(obj.serialize()).toEqual({
      type: 'ArcMirror',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 100 },
      p3: { x: 150, y: 180 }
    });
  });

  it('drags with grid snapping', () => {
    scene.snapToGrid = true;
    user.click(100, 100);
    user.click(200, 100);
    user.click(150, 150);

    user.drag(101, 101, 118, 122); // Should snap to (120, 120)
    expect(obj.serialize()).toEqual({
      type: 'ArcMirror',
      p1: { x: 120, y: 120 },
      p2: { x: 200, y: 100 },
      p3: { x: 160, y: 160 }
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
      type: "ArcMirror",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 100 },
      p3: { x: 150, y: 150 },
      filter: true,
      wavelength: 500,
      bandwidth: 20,
      invert: true
    });
  });

  it('hovers over mirror with colinear points', () => {
    // Create arc mirror with colinear points
    user.click(0, 0);       // First endpoint
    user.click(0, 100);     // Second endpoint
    user.click(0, 50);      // Control point (colinear)

    // Test hovering over endpoints and control point
    expect(user.hover(1, 0)).toBeTruthy();    // Near p1
    expect(user.hover(1, 100)).toBeTruthy();  // Near p2
    expect(user.hover(1, 50)).toBeTruthy();   // Near p3 (colinear)

    // Test hovering over line segments (since points are colinear)
    expect(user.hover(0, 25)).toBeTruthy();   // Between p1 and p3
    expect(user.hover(0, 75)).toBeTruthy();   // Between p3 and p2

    // Test hovering over non-object area
    expect(user.hover(50, 50)).toBeFalsy();   // Far from line
    expect(user.hover(0, 150)).toBeFalsy();   // Beyond endpoints
  });

  it('moves the entire object by a vector', () => {
    user.click(100, 100);
    user.click(200, 100);
    user.click(150, 150);

    user.move(50, 100);
    expect(obj.serialize()).toEqual({
      type: 'ArcMirror',
      p1: { x: 150, y: 200 },
      p2: { x: 250, y: 200 },
      p3: { x: 200, y: 250 }
    });
  });

  it('rotates 90 degrees around default center (p3)', () => {
    user.click(100, 100);
    user.click(200, 100);
    user.click(150, 150);

    user.rotate(Math.PI / 2); // 90 degrees counter-clockwise
    const result = obj.serialize();
    expect(result.p1.x).toBeCloseTo(200, 5); // p1 rotates around p3
    expect(result.p1.y).toBeCloseTo(100, 5);
    expect(result.p2.x).toBeCloseTo(200, 5); // p2 rotates around p3
    expect(result.p2.y).toBeCloseTo(200, 5);
    expect(result.p3.x).toBeCloseTo(150, 5); // p3 stays in place (center of rotation)
    expect(result.p3.y).toBeCloseTo(150, 5);
    expect(result.type).toBe('ArcMirror');
  });

  it('rotates 90 degrees around explicit center', () => {
    user.click(100, 100);
    user.click(200, 100);
    user.click(150, 150);

    user.rotate(Math.PI / 2, { x: 0, y: 0 }); // 90 degrees around origin
    const result = obj.serialize();
    expect(result.p1.x).toBeCloseTo(-100, 5); // p1 rotates around origin
    expect(result.p1.y).toBeCloseTo(100, 5);
    expect(result.p2.x).toBeCloseTo(-100, 5); // p2 rotates around origin
    expect(result.p2.y).toBeCloseTo(200, 5);
    expect(result.p3.x).toBeCloseTo(-150, 5); // p3 rotates around origin
    expect(result.p3.y).toBeCloseTo(150, 5);
    expect(result.type).toBe('ArcMirror');
  });

  it('scales to 50% around default center (p3)', () => {
    user.click(100, 100);
    user.click(200, 100);
    user.click(150, 150);

    user.scale(0.5); // Scale to 50%
    const result = obj.serialize();
    expect(result.p1.x).toBeCloseTo(125, 5); // p1 scales toward p3
    expect(result.p1.y).toBeCloseTo(125, 5);
    expect(result.p2.x).toBeCloseTo(175, 5); // p2 scales toward p3
    expect(result.p2.y).toBeCloseTo(125, 5);
    expect(result.p3.x).toBeCloseTo(150, 5); // p3 stays in place (center of scaling)
    expect(result.p3.y).toBeCloseTo(150, 5);
    expect(result.type).toBe('ArcMirror');
  });

  it('scales to 50% around explicit center', () => {
    user.click(100, 100);
    user.click(200, 100);
    user.click(150, 150);

    user.scale(0.5, { x: 0, y: 0 }); // Scale to 50% around origin
    const result = obj.serialize();
    expect(result.p1.x).toBeCloseTo(50, 5); // p1 scales toward origin
    expect(result.p1.y).toBeCloseTo(50, 5);
    expect(result.p2.x).toBeCloseTo(100, 5); // p2 scales toward origin
    expect(result.p2.y).toBeCloseTo(50, 5);
    expect(result.p3.x).toBeCloseTo(75, 5); // p3 scales toward origin
    expect(result.p3.y).toBeCloseTo(75, 5);
    expect(result.type).toBe('ArcMirror');
  });

  describe('focal length', () => {
    // Setup: p1=(100,200), p2=(300,200), p3=(200,100)
    // This gives: center=(200,200), R=100, chord=200, apertureHalf=100
    // axisDir=(0,1) from p3 toward center, tanDir=(1,0)
    // Focal length = R/2 = 50 (positive since p3 is on the left of p1→p2)

    it('gets focal length from geometry', () => {
      user.click(100, 200);
      user.click(300, 200);
      user.click(200, 100);

      expect(user.get("{{simulator:sceneObjs.common.focalLength}}")).toBeCloseTo(50, 5);
    });

    it('sets focal length with enough diameter', () => {
      user.click(100, 200);
      user.click(300, 200);
      user.click(200, 100);

      // apertureHalf=100, f=100 → R=200 >= apertureHalf → enough diameter
      user.set("{{simulator:sceneObjs.common.focalLength}}", 100);

      const result = obj.serialize();
      // p3 stays fixed
      expect(result.p3.x).toBeCloseTo(200, 5);
      expect(result.p3.y).toBeCloseTo(100, 5);
      // p1 and p2 x-coordinates stay symmetric around x=200
      expect(result.p1.x).toBeCloseTo(100, 5);
      expect(result.p2.x).toBeCloseTo(300, 5);
      // p1.y and p2.y should be equal (symmetric arc)
      expect(result.p1.y).toBeCloseTo(result.p2.y, 5);
      // Verify focal length reads back correctly
      user.updateObjBar();
      expect(user.get("{{simulator:sceneObjs.common.focalLength}}")).toBeCloseTo(100, 3);
    });

    it('sets focal length with not enough diameter', () => {
      user.click(100, 200);
      user.click(300, 200);
      user.click(200, 100);

      // apertureHalf=100, f=30 → R=60 < apertureHalf → not enough diameter
      // The mirror becomes a semicircle with R=60
      user.set("{{simulator:sceneObjs.common.focalLength}}", 30);

      const result = obj.serialize();
      // p3 stays fixed
      expect(result.p3.x).toBeCloseTo(200, 5);
      expect(result.p3.y).toBeCloseTo(100, 5);
      // Endpoints form a semicircle: center=(200,160), R=60
      expect(result.p1.x).toBeCloseTo(140, 5);
      expect(result.p1.y).toBeCloseTo(160, 5);
      expect(result.p2.x).toBeCloseTo(260, 5);
      expect(result.p2.y).toBeCloseTo(160, 5);
      // Chord shrinks from 200 to 120
      const newChord = geometry.distance(result.p1, result.p2);
      expect(newChord).toBeCloseTo(120, 3);
      // Verify focal length reads back correctly
      user.updateObjBar();
      expect(user.get("{{simulator:sceneObjs.common.focalLength}}")).toBeCloseTo(30, 3);
    });

    it('drags p3 and updates focal length', () => {
      user.click(100, 200);
      user.click(300, 200);
      user.click(200, 100);

      // Initial focal length is 50
      expect(user.get("{{simulator:sceneObjs.common.focalLength}}")).toBeCloseTo(50, 5);

      // Drag p3 closer to the chord → larger radius → larger focal length
      // New: p3=(200,150), center=(200,275), R=125, f=62.5
      user.drag(200, 100, 200, 150);
      expect(user.get("{{simulator:sceneObjs.common.focalLength}}")).toBeCloseTo(62.5, 3);
    });
  });
}); 