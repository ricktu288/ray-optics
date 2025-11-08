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

import PlaneGlass from '../../../src/core/sceneObjs/glass/PlaneGlass';
import Scene from '../../../src/core/Scene';
import { testLineObj } from '../helpers/lineObjTests';
import { MockUser } from '../helpers/test-utils';

describe('PlaneGlass', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    obj = new PlaneGlass(scene);
    user = new MockUser(obj);
  });

  it('creates with two clicks', () => {
    user.click(101, 102);
    user.click(203, 304);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 101, y: 102 },
      p2: { x: 203, y: 304 },
    });
  });

  it('creates with one drag', () => {
    user.drag(101, 102, 203, 304);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 101, y: 102 },
      p2: { x: 203, y: 304 },
    });
  });

  it('creates with grid snapping', () => {
    user.setScene('snapToGrid', true);
    user.drag(101, 102, 203, 304);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
    });
  });

  it('creates with shift + drag horizontally', () => {
    user.shiftDrag(100, 100, 200, 110);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 100 },
    });
  });

  it('creates with shift + drag vertically', () => {
    user.shiftDrag(100, 100, 110, 200);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 100, y: 100 },
      p2: { x: 100, y: 200 },
    });
  });

  it('creates with shift + drag diagonally', () => {
    user.shiftDrag(100, 100, 210, 190);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 200 },
    });
  });

  it('hovers with mouse', () => {
    user.click(100, 100);
    user.click(200, 300);
    
    expect(user.hover(101, 101)).toBeTruthy();
    expect(user.hover(201, 301)).toBeTruthy();
    expect(user.hover(101, 301)).toBeFalsy();
    expect(user.hover(201, 101)).toBeFalsy();
    expect(user.hover(151, 201)).toBeTruthy();
    expect(user.hover(300, 500)).toBeTruthy();
  });

  it('drags with mouse', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.drag(101, 101, 200, 200);
    user.drag(201, 301, 300, 400);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 200, y: 200 },
      p2: { x: 300, y: 400 },
    });
  });

  it('drags with mouse with grid snapping', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.setScene('snapToGrid', true);

    user.drag(101, 101, 201, 201);
    user.drag(201, 301, 301, 401);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 200, y: 200 },
      p2: { x: 300, y: 400 },
    });
  });

  it('shift + drags second point horizontally', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.shiftDrag(200, 300, 110, 200);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 100, y: 100 },
      p2: { x: 100, y: 200 },
    });
  });

  it('shift + drags first point horizontally', () => {
    user.click(200, 300);
    user.click(100, 100);

    user.shiftDrag(200, 300, 110, 200);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 100, y: 200 },
      p2: { x: 100, y: 100 },
    });
  });

  it('shift + drags second point vertically', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.shiftDrag(200, 300, 110, 200);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 100, y: 100 },
      p2: { x: 100, y: 200 },
    });
  });

  it('shift + drags first point vertically', () => {
    user.click(200, 300);
    user.click(100, 100);

    user.shiftDrag(200, 300, 110, 200);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 100, y: 200 },
      p2: { x: 100, y: 100 },
    });
  });

  it('shift + drags second point diagonally', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.shiftDrag(200, 300, 210, 190);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 200 },
    });
  });

  it('shift + drags first point diagonally', () => {
    user.click(200, 300);
    user.click(100, 100);

    user.shiftDrag(200, 300, 210, 190);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 200, y: 200 },
      p2: { x: 100, y: 100 },
    });
  });

  it('shift + drags second point with same slope', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.shiftDrag(200, 300, 302, 499);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 100, y: 100 },
      p2: { x: 300, y: 500 },
    });
  });

  it('shift + drags first point with same slope', () => {
    user.click(200, 300);
    user.click(100, 100);

    user.shiftDrag(200, 300, 302, 499);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 300, y: 500 },
      p2: { x: 100, y: 100 },
    });
  });

  it('ctrl + drags second point', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.ctrlDrag(200, 300, 300, 400);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 0, y: 0 },
      p2: { x: 300, y: 400 },
    });
  });

  it('drags the whole object', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.drag(151, 201, 251, 401);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 200, y: 300 },
      p2: { x: 300, y: 500 },
    });
  });

  it('shift + drags the whole object horizontally', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.shiftDrag(151, 201, 251, 211);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 200, y: 100 },
      p2: { x: 300, y: 300 },
    });
  });

  it('shift + drags the whole object vertically', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.shiftDrag(151, 201, 161, 401);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 100, y: 300 },
      p2: { x: 200, y: 500 },
    });
  });

  it('shift + drags the whole object with same slope', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.shiftDrag(151, 201, 253, 400);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 200, y: 300 },
      p2: { x: 300, y: 500 },
    });
  });

  it('shift + drags the whole object with opposite slope', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.shiftDrag(151, 201, 352, 103);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 300, y: 0 },
      p2: { x: 400, y: 200 },
    });
  });

  it('moves the entire object by a vector', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.move(50, 100);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 150, y: 200 },
      p2: { x: 250, y: 400 },
    });
  });

  it('rotates 90 degrees around default center (midpoint)', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.rotate(Math.PI / 2); // 90 degrees counter-clockwise
    const result = obj.serialize();
    expect(result.p1.x).toBeCloseTo(250, 5);
    expect(result.p1.y).toBeCloseTo(150, 5);
    expect(result.p2.x).toBeCloseTo(50, 5);
    expect(result.p2.y).toBeCloseTo(250, 5);
    expect(result.type).toBe('PlaneGlass');
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
    expect(result.type).toBe('PlaneGlass');
  });

  it('sets properties for non-simulateColors', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.setScene('simulateColors', false);
    user.set("{{simulator:sceneObjs.BaseGlass.refIndex}}", 1.8);
    expect(user.get("B(μm²)")).toBeNull();

    expect(obj.serialize()).toEqual({
      type: "PlaneGlass",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      refIndex: 1.8
    });
  });

  it('sets properties for simulateColors', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.setScene('simulateColors', true);
    user.set("{{simulator:sceneObjs.BaseGlass.cauchyCoeff}}", 1.8);
    user.set("B(μm²)", 0.008);

    expect(obj.serialize()).toEqual({
      type: "PlaneGlass",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      refIndex: 1.8,
      cauchyB: 0.008
    });
  });
}); 