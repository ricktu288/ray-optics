/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
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

import CurveMirror from '../../../src/core/sceneObjs/mirror/CurveMirror.js';
import Scene from '../../../src/core/Scene.js';
import { MockUser } from '../helpers/test-utils.js';

describe('CurveMirror', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    scene.gridSize = 20;
    obj = new CurveMirror(scene);
    user = new MockUser(obj);
  });

  it('creates an open Bezier mirror', () => {
    user.click(100, 100);
    user.click(130, 80);
    user.click(170, 120);
    user.click(200, 100);
    user.click(200, 100);

    const result = obj.serialize();
    expect(result.type).toBe('CurveMirror');
    expect(result.isClosed).toBe(false);
    expect(result.points).toHaveLength(4);
  });

  it('creates a closed Bezier mirror', () => {
    user.click(100, 100);
    user.click(130, 80);
    user.click(170, 120);
    user.click(200, 100);
    user.click(100, 100);

    const result = obj.serialize();
    expect(result.type).toBe('CurveMirror');
    expect(obj.isClosed).toBe(true);
    expect(result.isClosed).toBeUndefined();
    expect(result.points).toHaveLength(4);
  });

  it('sets filter properties', () => {
    obj = new CurveMirror(scene, { type: 'CurveMirror', points: [], isClosed: false, filter: false });
    user = new MockUser(obj);
    user.updateObjBar();
    user.setScene('simulateColors', true);
    user.set("{{simulator:sceneObjs.BaseFilter.filter}}", true);
    user.set("{{simulator:sceneObjs.common.wavelength}}", 500);
    user.set("{{simulator:sceneObjs.BaseFilter.bandwidth}}", 20);

    expect(obj.serialize()).toMatchObject({
      type: 'CurveMirror', filter: true, wavelength: 500, bandwidth: 20
    });
  });

  it('creates one cubic Bézier primitive for each finished curve', () => {
    scene.simulateColors = true;
    obj.notDone = false;
    obj.filter = true;
    obj.wavelength = 500;
    obj.bandwidth = 20;
    obj.invert = true;
    obj.newCurve([
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 0 }
    ]);

    expect(obj.getPrimitives()).toEqual([
      expect.objectContaining({
        kind: 'surface',
        curve: {
          kind: 'cubicBezier',
          params: {
            start: { x: 0, y: 0 },
            control1: { x: 0, y: 100 },
            control2: { x: 100, y: 100 },
            end: { x: 100, y: 0 }
          }
        },
        twoSided: true,
        surfaceType: expect.objectContaining({
          mergesWithBoundary: true
        }),
        params: {},
        filter: {
          wavelength: 500,
          bandwidth: 20,
          invert: true
        }
      })
    ]);
  });

  it('does not create primitives while under construction', () => {
    obj.notDone = true;
    obj.newCurve([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 0 }
    ]);

    expect(obj.getPrimitives()).toEqual([]);
  });
});
