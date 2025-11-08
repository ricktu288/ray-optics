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

import CustomSurface from '../../../src/core/sceneObjs/other/CustomSurface.js';
import Scene from '../../../src/core/Scene.js';
import { MockUser } from '../helpers/test-utils.js';
import { testLineObj } from '../helpers/lineObjTests.js';

describe('CustomSurface', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    scene.gridSize = 20;
    obj = new CustomSurface(scene);
    user = new MockUser(obj);
  });

  testLineObj(() => ({ obj, user }));

  it('rotates 90 degrees around default center (midpoint)', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.rotate(Math.PI / 2); // 90 degrees counter-clockwise
    const result = obj.serialize();
    expect(result.p1.x).toBeCloseTo(250, 5);
    expect(result.p1.y).toBeCloseTo(150, 5);
    expect(result.p2.x).toBeCloseTo(50, 5);
    expect(result.p2.y).toBeCloseTo(250, 5);
    expect(result.type).toBe('CustomSurface');
  });

  it('scales to 50% around default center (midpoint)', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.scale(0.5); // Scale to 50%
    const result = obj.serialize();
    expect(result.p1.x).toBeCloseTo(125, 5);
    expect(result.p1.y).toBeCloseTo(150, 5);
    expect(result.p2.x).toBeCloseTo(175, 5);
    expect(result.p2.y).toBeCloseTo(250, 5);
    expect(result.type).toBe('CustomSurface');
  });

  it('sets properties with default outRays', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.set("θ<sub>1</sub> =", "\\theta_0+0.1");
    user.set("P<sub>1</sub> =", "0.8\\cdot P_0");
    user.set("θ<sub>2</sub> =", "\\pi-\\theta_0+0.05");
    user.set("P<sub>2</sub> =", "P_0-P_1");

    expect(obj.serialize()).toEqual({
      type: 'CustomSurface',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      outRays: [
        {
          eqnTheta: "\\theta_0+0.1",
          eqnP: "0.8\\cdot P_0"
        },
        {
          eqnTheta: "\\pi-\\theta_0+0.05",
          eqnP: "P_0-P_1"
        }
      ]
    });
  });

  it('sets twoSided property', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.set("{{simulator:sceneObjs.BaseCustomSurface.twoSided}}", true);

    expect(obj.serialize()).toEqual({
      type: 'CustomSurface',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      twoSided: true
    });
  });

  it('sets properties with twoSided and custom outRays', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.set("θ<sub>1</sub> =", "0");
    user.set("P<sub>1</sub> =", "P_0");
    user.set("θ<sub>2</sub> =", "\\pi");
    user.set("P<sub>2</sub> =", "0");
    user.set("{{simulator:sceneObjs.BaseCustomSurface.twoSided}}", true);

    expect(obj.serialize()).toEqual({
      type: 'CustomSurface',
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      outRays: [
        {
          eqnTheta: "0",
          eqnP: "P_0"
        },
        {
          eqnTheta: "\\pi",
          eqnP: "0"
        }
      ],
      twoSided: true
    });
  });

  it('adds outgoing rays using button', () => {
    user.click(100, 100);
    user.click(200, 300);

    // Initial state has 2 outRays
    expect(obj.outRays.length).toBe(2);

    // Add a third ray
    user.clickButton('{{simulator:sceneObjs.BaseCustomSurface.addOutgoingRay}}');
    expect(obj.outRays.length).toBe(3);
    expect(obj.outRays[2]).toEqual({
      eqnTheta: '\\theta_0',
      eqnP: 'P_0'
    });

    // Add a fourth ray
    user.clickButton('{{simulator:sceneObjs.BaseCustomSurface.addOutgoingRay}}');
    expect(obj.outRays.length).toBe(4);
    expect(obj.outRays[3]).toEqual({
      eqnTheta: '\\theta_0',
      eqnP: 'P_0'
    });

    // Verify serialization includes all rays
    const result = obj.serialize();
    expect(result.outRays.length).toBe(4);
    expect(result.type).toBe('CustomSurface');
  });

  it('removes outgoing rays using button', () => {
    user.click(100, 100);
    user.click(200, 300);

    // Add an extra ray first
    user.clickButton('{{simulator:sceneObjs.BaseCustomSurface.addOutgoingRay}}');
    expect(obj.outRays.length).toBe(3);

    // Remove one ray
    user.clickButton('{{simulator:sceneObjs.BaseCustomSurface.removeOutgoingRay}}');
    expect(obj.outRays.length).toBe(2);

    // Remove another ray
    user.clickButton('{{simulator:sceneObjs.BaseCustomSurface.removeOutgoingRay}}');
    expect(obj.outRays.length).toBe(1);

    // Remove the last ray
    user.clickButton('{{simulator:sceneObjs.BaseCustomSurface.removeOutgoingRay}}');
    expect(obj.outRays.length).toBe(0);

    // Verify serialization
    const result = obj.serialize();
    expect(result.outRays.length).toBe(0);
    expect(result.type).toBe('CustomSurface');
  });

  it('adds and removes outgoing rays in sequence', () => {
    user.click(100, 100);
    user.click(200, 300);

    // Start with 2 rays
    expect(obj.outRays.length).toBe(2);

    // Add two rays
    user.clickButton('{{simulator:sceneObjs.BaseCustomSurface.addOutgoingRay}}');
    user.clickButton('{{simulator:sceneObjs.BaseCustomSurface.addOutgoingRay}}');
    expect(obj.outRays.length).toBe(4);

    // Remove one ray
    user.clickButton('{{simulator:sceneObjs.BaseCustomSurface.removeOutgoingRay}}');
    expect(obj.outRays.length).toBe(3);

    // Add one more ray
    user.clickButton('{{simulator:sceneObjs.BaseCustomSurface.addOutgoingRay}}');
    expect(obj.outRays.length).toBe(4);

    // Set properties on the newly added rays
    user.set("θ<sub>3</sub> =", "\\theta_0/2");
    user.set("P<sub>3</sub> =", "0.5\\cdot P_0");
    user.set("θ<sub>4</sub> =", "\\pi/4");
    user.set("P<sub>4</sub> =", "0.25\\cdot P_0");

    const result = obj.serialize();
    expect(result.outRays.length).toBe(4);
    expect(result.outRays[2].eqnTheta).toBe("\\theta_0/2");
    expect(result.outRays[2].eqnP).toBe("0.5\\cdot P_0");
    expect(result.outRays[3].eqnTheta).toBe("\\pi/4");
    expect(result.outRays[3].eqnP).toBe("0.25\\cdot P_0");
  });
});

