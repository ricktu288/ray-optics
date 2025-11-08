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

import CustomParamSurface from '../../../src/core/sceneObjs/other/CustomParamSurface.js';
import Scene from '../../../src/core/Scene.js';
import { MockUser } from '../helpers/test-utils.js';
import { testParamObj } from '../helpers/paramObjTests.js';

describe('CustomParamSurface', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    scene.gridSize = 20;
    obj = new CustomParamSurface(scene);
    user = new MockUser(obj);
  });

  testParamObj(() => ({ obj, user, scene }));

  it('creates with default parametric equations', () => {
    user.click(100, 100);

    const result = obj.serialize();
    expect(result.type).toBe('CustomParamSurface');
    expect(result.origin).toEqual({ x: 100, y: 100 });
    
    // Check pieces on the object (default values may not serialize)
    expect(obj.pieces).toEqual([
      {
        eqnX: "50\\cdot\\cos(t)",
        eqnY: "50\\cdot\\sin(t)",
        tMin: 0,
        tMax: 2 * Math.PI,
        tStep: 0.01
      }
    ]);
  });

  it('sets properties with default outRays', () => {
    user.click(100, 100);
    user.set("θ<sub>1</sub> =", "\\theta_0+0.1");
    user.set("P<sub>1</sub> =", "0.8\\cdot P_0");
    user.set("θ<sub>2</sub> =", "\\pi-\\theta_0+0.05");
    user.set("P<sub>2</sub> =", "P_0-P_1");

    const result = obj.serialize();
    expect(result.type).toBe('CustomParamSurface');
    expect(result.origin).toEqual({ x: 100, y: 100 });
    expect(result.outRays).toEqual([
      {
        eqnTheta: "\\theta_0+0.1",
        eqnP: "0.8\\cdot P_0"
      },
      {
        eqnTheta: "\\pi-\\theta_0+0.05",
        eqnP: "P_0-P_1"
      }
    ]);
  });

  it('sets twoSided property', () => {
    user.click(100, 100);
    user.set("{{simulator:sceneObjs.BaseCustomSurface.twoSided}}", true);

    const result = obj.serialize();
    expect(result.type).toBe('CustomParamSurface');
    expect(result.origin).toEqual({ x: 100, y: 100 });
    expect(result.twoSided).toBe(true);
  });

  it('adds outgoing rays using button', () => {
    user.click(100, 100);

    // Initial state has 2 outRays
    expect(obj.outRays.length).toBe(2);

    // Add a third ray
    user.clickButton('{{simulator:sceneObjs.BaseCustomSurface.addOutgoingRay}}');
    expect(obj.outRays.length).toBe(3);
    expect(obj.outRays[2]).toEqual({
      eqnTheta: '\\theta_0',
      eqnP: 'P_0'
    });
  });

  it('removes outgoing rays using button', () => {
    user.click(100, 100);

    // Add an extra ray first
    user.clickButton('{{simulator:sceneObjs.BaseCustomSurface.addOutgoingRay}}');
    expect(obj.outRays.length).toBe(3);

    // Remove one ray
    user.clickButton('{{simulator:sceneObjs.BaseCustomSurface.removeOutgoingRay}}');
    expect(obj.outRays.length).toBe(2);
  });

  it('sets custom parametric equations', () => {
    user.click(100, 100);
    user.set('x(t) =', '100\\cdot\\cos(t)');
    user.set('y(t) =', '50\\cdot\\sin(t)');
    user.set('{{simulator:sceneObjs.ParamCurveObjMixin.step}}', 0.02);

    const result = obj.serialize();
    expect(result.type).toBe('CustomParamSurface');
    expect(result.origin).toEqual({ x: 100, y: 100 });
    expect(result.pieces[0].eqnX).toBe('100\\cdot\\cos(t)');
    expect(result.pieces[0].eqnY).toBe('50\\cdot\\sin(t)');
    expect(result.pieces[0].tStep).toBe(0.02);
  });

  it('moves parametric custom surface', () => {
    user.click(100, 100);
    user.move(50, 100);

    const result = obj.serialize();
    expect(result.type).toBe('CustomParamSurface');
    expect(result.origin).toEqual({ x: 150, y: 200 });
    // Pieces remain with default values
    expect(obj.pieces[0].eqnX).toBe("50\\cdot\\cos(t)");
    expect(obj.pieces[0].eqnY).toBe("50\\cdot\\sin(t)");
  });

  it('adds multiple parametric pieces', () => {
    user.click(100, 100);

    // Add two more pieces
    user.clickButton('{{simulator:sceneObjs.ParamCurveObjMixin.addPiece}}');
    user.clickButton('{{simulator:sceneObjs.ParamCurveObjMixin.addPiece}}');

    // Verify pieces were added with default values
    expect(obj.pieces.length).toBe(3);
    expect(obj.pieces[1].eqnX).toBe('0');
    expect(obj.pieces[1].eqnY).toBe('0');
    expect(obj.pieces[1].tMin).toBe(0);
    expect(obj.pieces[1].tMax).toBe(1);
    expect(obj.pieces[1].tStep).toBe(0.01);
  });
});

