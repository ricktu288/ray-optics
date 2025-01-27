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

import GrinGlass from '../../../src/core/sceneObjs/glass/GrinGlass.js';
import Scene from '../../../src/core/Scene';
import { MockUser } from '../helpers/test-utils';

describe('GrinGlass', () => {
  let obj;
  let user;
  let scene;

  beforeEach(() => {
    scene = new Scene();
    scene.gridSize = 20; // Set grid size
    obj = new GrinGlass(scene);
    user = new MockUser(obj);
  });

  test('creates square with four clicks', () => {
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(1, 1);
    expect(obj.serialize()).toEqual({
      type: 'GrinGlass',
      path: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ]
    });
  });

  test('creates square with grid snapping', () => {
    scene.snapToGrid = true;
    user.click(8, 8);     // Should snap to (0, 0)
    user.click(108, -8);  // Should snap to (100, 0)
    user.click(92, 108);  // Should snap to (100, 100)
    user.click(-8, 92);   // Should snap to (0, 100)
    user.click(1, 1);     // Should snap to (0, 0)
    expect(obj.serialize()).toEqual({
      type: 'GrinGlass',
      path: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ]
    });
  });

  test('drags square points with mouse', () => {
    // Create the square first
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(1, 1);

    // Drag each point
    user.drag(0, 0, 20, 20);     // First point
    expect(obj.serialize()).toEqual({
      type: 'GrinGlass',
      path: [
        { x: 20, y: 20 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ]
    });

    user.drag(100, 0, 120, 20);  // Second point
    expect(obj.serialize()).toEqual({
      type: 'GrinGlass',
      path: [
        { x: 20, y: 20 },
        { x: 120, y: 20 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ]
    });

    user.drag(100, 100, 120, 120);  // Third point
    expect(obj.serialize()).toEqual({
      type: 'GrinGlass',
      path: [
        { x: 20, y: 20 },
        { x: 120, y: 20 },
        { x: 120, y: 120 },
        { x: 0, y: 100 }
      ]
    });

    user.drag(0, 100, 20, 120);  // Fourth point
    expect(obj.serialize()).toEqual({
      type: 'GrinGlass',
      path: [
        { x: 20, y: 20 },
        { x: 120, y: 20 },
        { x: 120, y: 120 },
        { x: 20, y: 120 }
      ]
    });
  });

  test('drags entire square by dragging sides', () => {
    // Create the square first
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(1, 1);

    // Drag by top edge
    user.drag(50, 0, 50, -50);
    expect(obj.serialize()).toEqual({
      type: 'GrinGlass',
      path: [
        { x: 0, y: -50 },
        { x: 100, y: -50 },
        { x: 100, y: 50 },
        { x: 0, y: 50 }
      ]
    });

    // Drag by right edge
    user.drag(100, 0, 150, 0);
    expect(obj.serialize()).toEqual({
      type: 'GrinGlass',
      path: [
        { x: 50, y: -50 },
        { x: 150, y: -50 },
        { x: 150, y: 50 },
        { x: 50, y: 50 }
      ]
    });

    // Drag by bottom edge
    user.drag(100, 50, 100, 100);
    expect(obj.serialize()).toEqual({
      type: 'GrinGlass',
      path: [
        { x: 50, y: 0 },
        { x: 150, y: 0 },
        { x: 150, y: 100 },
        { x: 50, y: 100 }
      ]
    });

    // Drag by left edge
    user.drag(50, 50, 0, 50);
    expect(obj.serialize()).toEqual({
      type: 'GrinGlass',
      path: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ]
    });
  });

  test('shift + drags square horizontally and vertically', () => {
    // Create the square first
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(1, 1);

    // Shift + drag horizontally by top edge
    user.shiftDrag(50, 0, 150, 20);
    expect(obj.serialize()).toEqual({
      type: 'GrinGlass',
      path: [
        { x: 100, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 100 },
        { x: 100, y: 100 }
      ]
    });

    // Shift + drag vertically by right edge
    user.shiftDrag(200, 50, 180, 150);
    expect(obj.serialize()).toEqual({
      type: 'GrinGlass',
      path: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 }
      ]
    });

    // Shift + drag horizontally by bottom edge
    user.shiftDrag(150, 200, 50, 220);
    expect(obj.serialize()).toEqual({
      type: 'GrinGlass',
      path: [
        { x: 0, y: 100 },
        { x: 100, y: 100 },
        { x: 100, y: 200 },
        { x: 0, y: 200 }
      ]
    });

    // Shift + drag vertically by left edge
    user.shiftDrag(0, 150, 20, 50);
    expect(obj.serialize()).toEqual({
      type: 'GrinGlass',
      path: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ]
    });
  });

  test('sets properties', () => {
    // Create the square first
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(1, 1);

    user.set("n(x,y) = ", "1+x^2");
    user.set("{{simulator:sceneObjs.BaseGrinGlass.stepSize}}", 2);
    user.set("{{simulator:sceneObjs.BaseGrinGlass.intersectTol}}", 0.002);

    expect(obj.serialize()).toEqual({
      type: 'GrinGlass',
      path: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ],
      refIndexFn: "1+x^2",
      stepSize: 2,
      intersectTol: 0.002
    });
  });

  test('hovers over square points and edges', () => {
    // Create the square first
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(1, 1);

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

    // Test hovering over non-interactive areas
    expect(user.hover(50, 50)).toBeFalsy();     // Center
    expect(user.hover(150, 150)).toBeFalsy();   // Outside
  });

  test('onConstructUndo removes construction points', () => {
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
      type: 'GrinGlass',
      path: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ]
    });
  });
}); 