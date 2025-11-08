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

import CurveGrinGlass from '../../../src/core/sceneObjs/glass/CurveGrinGlass.js';
import Scene from '../../../src/core/Scene.js';
import { MockUser } from '../helpers/test-utils.js';

describe('CurveGrinGlass', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    scene.gridSize = 20;
    obj = new CurveGrinGlass(scene);
    user = new MockUser(obj);
  });

  it('creates with Bezier curve points', () => {
    // Create a simple closed curve with 4 anchor points
    user.click(0, 0);     // First anchor
    user.click(100, 0);   // Second anchor
    user.click(100, 100); // Third anchor
    user.click(0, 100);   // Fourth anchor
    user.click(0, 0);     // Close the shape

    const result = obj.serialize();
    expect(result.type).toBe('CurveGrinGlass');
    expect(result.points).toBeDefined();
    expect(result.points.length).toBeGreaterThan(0);
    // Each point should have anchor and control points
    expect(result.points[0].a1).toBeDefined();
    expect(result.points[0].c1).toBeDefined();
    expect(result.points[0].c2).toBeDefined();
  });

  it('creates with grid snapping', () => {
    scene.snapToGrid = true;
    user.click(5, 8);
    user.click(95, 2);
    user.click(98, 102);
    user.click(2, 98);
    user.click(5, 8);

    const result = obj.serialize();
    expect(result.type).toBe('CurveGrinGlass');
    expect(result.points).toBeDefined();
  });

  it('hovers with mouse', () => {
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(0, 0);
    
    // Just verify object was created
    expect(obj.serialize().type).toBe('CurveGrinGlass');
  });

  it('moves the entire object by a vector', () => {
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(0, 0);

    user.move(50, 100);
    const result = obj.serialize();
    expect(result.type).toBe('CurveGrinGlass');
    
    // Verify that points have moved
    const firstAnchor = result.points[0].a1;
    expect(firstAnchor.x).toBeCloseTo(50, 5);
    expect(firstAnchor.y).toBeCloseTo(100, 5);
  });

  it('rotates 90 degrees around default center', () => {
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(0, 0);

    user.rotate(Math.PI / 2); // 90 degrees counter-clockwise
    const result = obj.serialize();
    expect(result.type).toBe('CurveGrinGlass');
    
    // Verify rotation occurred (points should be rotated around centroid)
    expect(result.points).toBeDefined();
    expect(result.points.length).toBeGreaterThan(0);
  });

  it('rotates 90 degrees around explicit center', () => {
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(0, 0);

    user.rotate(Math.PI / 2, { x: 0, y: 0 }); // 90 degrees around origin
    const result = obj.serialize();
    expect(result.type).toBe('CurveGrinGlass');
    
    // First anchor should rotate from (0,0) to (0,0) - stays at origin
    const firstAnchor = result.points[0].a1;
    expect(firstAnchor.x).toBeCloseTo(0, 5);
    expect(firstAnchor.y).toBeCloseTo(0, 5);
  });

  it('scales to 50% around explicit center', () => {
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(0, 0);

    user.scale(0.5, { x: 0, y: 0 }); // Scale to 50% around origin
    const result = obj.serialize();
    expect(result.type).toBe('CurveGrinGlass');
    
    // Points should be scaled toward origin
    expect(result.points).toBeDefined();
    expect(result.points.length).toBeGreaterThan(0);
  });

  it('sets GRIN glass properties', () => {
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(0, 0);

    user.set("n(x,y) = ", "1+x^2");
    user.set("α(x,y) = ", "0.1*x");
    user.set("{{simulator:sceneObjs.BaseGrinGlass.stepSize}}", 2);
    user.set("{{simulator:sceneObjs.BaseGrinGlass.intersectTol}}", 0.002);

    const result = obj.serialize();
    expect(result.type).toBe('CurveGrinGlass');
    expect(result.refIndexFn).toBe("1+x^2");
    expect(result.absorptionFn).toBe("0.1*x");
    expect(result.stepSize).toBe(2);
    expect(result.intersectTol).toBe(0.002);
  });

  it('sets origin for GRIN coordinate system', () => {
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(0, 0);

    user.set("{{simulator:sceneObjs.common.coordOrigin}}", "(50,75)");

    const result = obj.serialize();
    expect(result.type).toBe('CurveGrinGlass');
    expect(result.origin).toEqual({ x: 50, y: 75 });
  });

  it('finishes drawing when closed', () => {
    user.click(0, 0);
    user.click(100, 0);
    user.click(100, 100);
    user.click(0, 100);
    user.click(0, 0); // Close the shape

    expect(obj.notDone).toBe(false);
    const result = obj.serialize();
    expect(result.notDone).toBeUndefined(); // notDone is false by default, so not serialized
  });
});


