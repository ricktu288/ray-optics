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

import ParamGlass from '../../../src/core/sceneObjs/glass/ParamGlass.js';
import Scene from '../../../src/core/Scene.js';
import { MockUser } from '../helpers/test-utils.js';
import { testParamObj } from '../helpers/paramObjTests.js';

describe('ParamGlass', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    scene.gridSize = 20;
    obj = new ParamGlass(scene);
    user = new MockUser(obj);
  });

  testParamObj(() => ({ obj, user, scene }));

  it('creates with default parametric equations', () => {
    user.click(100, 100);

    const result = obj.serialize();
    expect(result.type).toBe('ParamGlass');
    expect(result.origin).toEqual({ x: 100, y: 100 });
    
    // Check pieces on the object (default values may not serialize)
    expect(obj.pieces).toEqual([
      {
        eqnX: "50\\cdot\\cos\\left(t\\right)",
        eqnY: "50\\cdot\\sin\\left(t\\right)",
        tMin: 0,
        tMax: 2 * Math.PI,
        tStep: 0.01
      }
    ]);
  });

  it('sets properties for non-simulateColors', () => {
    user.click(100, 100);
    user.setScene('simulateColors', false);
    user.set("{{simulator:sceneObjs.BaseGlass.refIndex}}", 1.8);
    expect(user.get("B(μm²)")).toBeNull();

    const result = obj.serialize();
    expect(result.type).toBe('ParamGlass');
    expect(result.origin).toEqual({ x: 100, y: 100 });
    expect(result.refIndex).toBe(1.8);
  });

  it('sets properties for simulateColors', () => {
    user.click(100, 100);
    user.setScene('simulateColors', true);
    user.set("{{simulator:sceneObjs.BaseGlass.cauchyCoeff}}", 1.8);
    user.set("B(μm²)", 0.008);

    const result = obj.serialize();
    expect(result.type).toBe('ParamGlass');
    expect(result.origin).toEqual({ x: 100, y: 100 });
    expect(result.refIndex).toBe(1.8);
    expect(result.cauchyB).toBe(0.008);
  });

  it('sets custom parametric equations', () => {
    user.click(100, 100);
    user.set('x(t) =', '100\\cdot\\cos\\left(t\\right)');
    user.set('y(t) =', '50\\cdot\\sin\\left(t\\right)');
    user.set('{{simulator:sceneObjs.ParamCurveObjMixin.step}}', 0.02);

    const result = obj.serialize();
    expect(result.type).toBe('ParamGlass');
    expect(result.origin).toEqual({ x: 100, y: 100 });
    expect(result.pieces[0].eqnX).toBe('100\\cdot\\cos\\left(t\\right)');
    expect(result.pieces[0].eqnY).toBe('50\\cdot\\sin\\left(t\\right)');
    expect(result.pieces[0].tStep).toBe(0.02);
  });

  it('moves parametric glass', () => {
    user.click(100, 100);
    user.move(50, 100);

    const result = obj.serialize();
    expect(result.type).toBe('ParamGlass');
    expect(result.origin).toEqual({ x: 150, y: 200 });
    // Pieces remain with default values
    expect(obj.pieces[0].eqnX).toBe("50\\cdot\\cos\\left(t\\right)");
    expect(obj.pieces[0].eqnY).toBe("50\\cdot\\sin\\left(t\\right)");
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

