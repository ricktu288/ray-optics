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

import Glass from '../../../src/simulator/js/sceneObjs/glass/Glass';
import Scene from '../../../src/simulator/js/Scene';
import { MockUser } from '../helpers/test-utils';

describe('Glass', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    scene.gridSize = 20; // Set grid size
    obj = new Glass(scene);
    user = new MockUser(obj);
  });

  it('creates square with five clicks', () => {
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(1, 1);
    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 0, y: 0, arc: false },
        { x: 100, y: 0, arc: false },
        { x: 100, y: 100, arc: false },
        { x: 0, y: 100, arc: false }
      ]
    });
  });

  it('creates square with grid snapping', () => {
    scene.snapToGrid = true;
    user.click(8, 8);     // Should snap to (0, 0)
    user.click(108, -8);  // Should snap to (100, 0)
    user.click(92, 108);  // Should snap to (100, 100)
    user.click(-8, 92);   // Should snap to (0, 100)
    user.click(1, 1);     // Should snap to (0, 0)
    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 0, y: 0, arc: false },
        { x: 100, y: 0, arc: false },
        { x: 100, y: 100, arc: false },
        { x: 0, y: 100, arc: false }
      ]
    });
  });

  it('drags square points with mouse', () => {
    // Create the square first
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(1, 1);

    // Drag each point
    user.drag(0, 0, 20, 20);     // First point
    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 20, y: 20, arc: false },
        { x: 100, y: 0, arc: false },
        { x: 100, y: 100, arc: false },
        { x: 0, y: 100, arc: false }
      ]
    });

    user.drag(100, 0, 120, 20);  // Second point
    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 20, y: 20, arc: false },
        { x: 120, y: 20, arc: false },
        { x: 100, y: 100, arc: false },
        { x: 0, y: 100, arc: false }
      ]
    });

    user.drag(100, 100, 120, 120);  // Third point
    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 20, y: 20, arc: false },
        { x: 120, y: 20, arc: false },
        { x: 120, y: 120, arc: false },
        { x: 0, y: 100, arc: false }
      ]
    });

    user.drag(0, 100, 20, 120);  // Fourth point
    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 20, y: 20, arc: false },
        { x: 120, y: 20, arc: false },
        { x: 120, y: 120, arc: false },
        { x: 20, y: 120, arc: false }
      ]
    });
  });

  it('creates lens-like shape (actually a circle) with click and drags', () => {
    user.click(0, -100);
    user.drag(100, 0, 0, 100);
    user.drag(-100, 0, 1, -101);
    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 0, y: -100, arc: false },
        { x: 100, y: 0, arc: true },
        { x: 0, y: 100, arc: false },
        { x: -100, y: 0, arc: true }
      ]
    });
  });

  it('hovers over square points and edges', () => {
    // Create the square first
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(0, 0);

    // Test hovering over points
    expect(user.hover(1, 1)).toBeTruthy();      // First point
    expect(user.hover(99, 1)).toBeTruthy();     // Second point
    expect(user.hover(99, 99)).toBeTruthy();    // Third point
    expect(user.hover(1, 99)).toBeTruthy();     // Fourth point

    // Test hovering over edges
    expect(user.hover(50, 0)).toBeTruthy();     // Top edge
    expect(user.hover(100, 50)).toBeTruthy();   // Right edge
    expect(user.hover(50, 100)).toBeTruthy();   // Bottom edge
    expect(user.hover(0, 50)).toBeTruthy();     // Left edge

    // Test hovering over non-object area
    expect(user.hover(50, 50)).toBeFalsy();     // Center
    expect(user.hover(150, 150)).toBeFalsy();   // Outside
  });

  it('hovers over lens points and arcs', () => {
    // Create the lens shape
    user.click(0, -100);
    user.drag(100, 0, 0, 100);
    user.drag(-100, 0, 0, -100);

    // Test hovering over points
    expect(user.hover(0, -99)).toBeTruthy();    // Top point
    expect(user.hover(0, 99)).toBeTruthy();     // Bottom point

    // Test hovering over arc points
    expect(user.hover(99, 0)).toBeTruthy();     // Right arc point
    expect(user.hover(-99, 0)).toBeTruthy();    // Left arc point

    // Test hovering over arc segments
    expect(user.hover(70, -70)).toBeTruthy();   // Top-right arc
    expect(user.hover(70, 70)).toBeTruthy();    // Bottom-right arc
    expect(user.hover(-70, 70)).toBeTruthy();   // Bottom-left arc
    expect(user.hover(-70, -70)).toBeTruthy();  // Top-left arc

    // Test hovering over non-object area
    expect(user.hover(0, 0)).toBeFalsy();       // Center
    expect(user.hover(150, 150)).toBeFalsy();   // Outside
  });

  it('drags entire square by dragging sides', () => {
    // Create the square first
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(0, 0);

    // Drag by top edge
    user.drag(50, 0, 50, -50);
    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 0, y: -50, arc: false },
        { x: 100, y: -50, arc: false },
        { x: 100, y: 50, arc: false },
        { x: 0, y: 50, arc: false }
      ]
    });

    // Drag by right edge
    user.drag(100, 0, 150, 0);
    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 50, y: -50, arc: false },
        { x: 150, y: -50, arc: false },
        { x: 150, y: 50, arc: false },
        { x: 50, y: 50, arc: false }
      ]
    });

    // Drag by bottom edge
    user.drag(100, 50, 100, 100);
    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 50, y: 0, arc: false },
        { x: 150, y: 0, arc: false },
        { x: 150, y: 100, arc: false },
        { x: 50, y: 100, arc: false }
      ]
    });

    // Drag by left edge
    user.drag(50, 50, 0, 50);
    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 0, y: 0, arc: false },
        { x: 100, y: 0, arc: false },
        { x: 100, y: 100, arc: false },
        { x: 0, y: 100, arc: false }
      ]
    });
  });

  it('shift + drags square horizontally and vertically', () => {
    // Create the square first
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(0, 0);

    // Shift + drag horizontally by top edge
    user.shiftDrag(50, 0, 150, 20);
    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 100, y: 0, arc: false },
        { x: 200, y: 0, arc: false },
        { x: 200, y: 100, arc: false },
        { x: 100, y: 100, arc: false }
      ]
    });

    // Shift + drag vertically by right edge
    user.shiftDrag(200, 50, 180, 150);
    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 100, y: 100, arc: false },
        { x: 200, y: 100, arc: false },
        { x: 200, y: 200, arc: false },
        { x: 100, y: 200, arc: false }
      ]
    });

    // Shift + drag horizontally by bottom edge
    user.shiftDrag(150, 200, 50, 220);
    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 0, y: 100, arc: false },
        { x: 100, y: 100, arc: false },
        { x: 100, y: 200, arc: false },
        { x: 0, y: 200, arc: false }
      ]
    });

    // Shift + drag vertically by left edge
    user.shiftDrag(0, 150, 20, 50);
    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 0, y: 0, arc: false },
        { x: 100, y: 0, arc: false },
        { x: 100, y: 100, arc: false },
        { x: 0, y: 100, arc: false }
      ]
    });
  });

  it('sets properties for non-simulateColors', () => {
    // Create the square first
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(0, 0);

    user.setScene('simulateColors', false);
    user.set("{{simulator:sceneObjs.BaseGlass.refIndex}}", 1.8);
    expect(user.get("B(μm²)")).toBeNull();

    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 0, y: 0, arc: false },
        { x: 100, y: 0, arc: false },
        { x: 100, y: 100, arc: false },
        { x: 0, y: 100, arc: false }
      ],
      refIndex: 1.8
    });
  });

  it('sets properties for simulateColors', () => {
    // Create the square first
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(0, 0);

    user.setScene('simulateColors', true);
    user.set("{{simulator:sceneObjs.BaseGlass.cauchyCoeff}}", 1.8);
    user.set("B(μm²)", 0.008);

    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 0, y: 0, arc: false },
        { x: 100, y: 0, arc: false },
        { x: 100, y: 100, arc: false },
        { x: 0, y: 100, arc: false }
      ],
      refIndex: 1.8,
      cauchyB: 0.008
    });
  });

  it('hovers over lens with colinear points', () => {
    // Create the lens shape with colinear points
    user.click(0, -100);
    user.drag(0, 0, 0, 100);  // First arc point and next point are colinear
    user.drag(-100, 0, 0, -100);

    // Test hovering over points
    expect(user.hover(0, -99)).toBeTruthy();    // Top point
    expect(user.hover(0, 99)).toBeTruthy();     // Bottom point

    // Test hovering over arc points
    expect(user.hover(0, 0)).toBeTruthy();      // Middle point (colinear)
    expect(user.hover(-99, 0)).toBeTruthy();    // Left arc point

    // Test hovering over line segments (since points are colinear)
    expect(user.hover(0, 50)).toBeTruthy();     // Top-middle segment
    expect(user.hover(0, -50)).toBeTruthy();    // Bottom-middle segment

    // Test hovering over arc segments
    expect(user.hover(-70, 70)).toBeTruthy();   // Bottom-left arc
    expect(user.hover(-70, -70)).toBeTruthy();  // Top-left arc

    // Test hovering over non-object area
    expect(user.hover(50, 50)).toBeFalsy();     // Outside right
    expect(user.hover(-150, 0)).toBeFalsy();    // Outside left
  });

  it('onConstructUndo removes construction points', () => {
    // Start creating a square
    user.click(0, 0);       // First point
    user.click(100, 0);     // Second point
    user.click(100, 100);   // Third point
    user.click(50, 50);     // Extra point (will be undone)
    
    // Undo the extra point
    obj.onConstructUndo();
    
    // Complete the square normally
    user.click(0, 100);     // Fourth point
    user.click(1, 1);       // Close the shape
    
    // Verify we get a proper square
    expect(obj.serialize()).toEqual({
      type: 'Glass',
      path: [
        { x: 0, y: 0, arc: false },
        { x: 100, y: 0, arc: false },
        { x: 100, y: 100, arc: false },
        { x: 0, y: 100, arc: false }
      ]
    });
  });

}); 