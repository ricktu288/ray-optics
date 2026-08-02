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

import CurveMirror from '../../../src/core/sceneObjs/mirror/CurveMirror';
import Scene from '../../../src/core/Scene';

describe('CurveMirror', () => {
  it('creates one cubic Bézier primitive for each finished curve', () => {
    const scene = new Scene();
    scene.simulateColors = true;
    const obj = new CurveMirror(scene);
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
    const obj = new CurveMirror(new Scene());
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
