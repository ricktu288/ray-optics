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

import { MockUser } from './test-utils';
import geometry from '../../../src/core/geometry';

export function testCircleObj(getTestContext) {
  let obj;
  let user;

  beforeEach(() => {
    const context = getTestContext();
    obj = context.obj;
    user = context.user;
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

  it('hovers with mouse', () => {
    user.click(100, 100);
    user.click(200, 300);
    
    expect(user.hover(101, 101)).toBeTruthy(); // Center point
    expect(user.hover(201, 301)).toBeTruthy(); // Point on circumference
    
    // Point on circle's edge
    const radius = geometry.segmentLength(obj);
    const pointOnCircle = {
      x: obj.p1.x + radius / Math.sqrt(2),
      y: obj.p1.y + radius / Math.sqrt(2)
    };
    expect(user.hover(pointOnCircle.x, pointOnCircle.y)).toBeTruthy();
    
    // Point outside circle
    expect(user.hover(300, 300)).toBeFalsy();
  });

  it('drags center point', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.drag(101, 101, 200, 200);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 200, y: 200 },
      p2: { x: 200, y: 300 }, // Circumference point keeps its absolute position
    });
  });

  it('drags point on circumference', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.drag(201, 301, 300, 400);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 100, y: 100 },
      p2: { x: 300, y: 400 },
    });
  });

  it('drags with grid snapping', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.setScene('snapToGrid', true);

    user.drag(101, 101, 201, 201);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 200, y: 200 },
      p2: { x: 200, y: 300 }, // Circumference point keeps its absolute position
    });
  });

  it('drags the whole circle', () => {
    user.click(100, 100);
    user.click(200, 300);

    const radius = geometry.segmentLength(obj);
    const pointOnCircle = {
      x: obj.p1.x + radius / Math.sqrt(2),
      y: obj.p1.y + radius / Math.sqrt(2)
    };
    user.drag(pointOnCircle.x, pointOnCircle.y, pointOnCircle.x + 100, pointOnCircle.y + 200);
    
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 200, y: 300 },
      p2: { x: 300, y: 500 },
    });
  });

  it('moves the entire circle by a vector', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.move(50, 100);
    expect(obj.serialize()).toEqual({
      type: obj.constructor.type,
      p1: { x: 150, y: 200 },
      p2: { x: 250, y: 400 },
    });
  });

  it('rotates 90 degrees around explicit center', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.rotate(Math.PI / 2, { x: 0, y: 0 }); // 90 degrees around origin
    const result = obj.serialize();
    expect(result.p1.x).toBeCloseTo(-100, 5);
    expect(result.p1.y).toBeCloseTo(100, 5);
    expect(result.p2.x).toBeCloseTo(-300, 5);
    expect(result.p2.y).toBeCloseTo(200, 5);
    expect(result.type).toBe(obj.constructor.type);
  });

  it('scales to 50% around explicit center', () => {
    user.click(100, 100);
    user.click(200, 300);

    user.scale(0.5, { x: 0, y: 0 }); // Scale to 50% around origin
    const result = obj.serialize();
    expect(result.p1.x).toBeCloseTo(50, 5);
    expect(result.p1.y).toBeCloseTo(50, 5);
    expect(result.p2.x).toBeCloseTo(100, 5);
    expect(result.p2.y).toBeCloseTo(150, 5);
    expect(result.type).toBe(obj.constructor.type);
  });
} 