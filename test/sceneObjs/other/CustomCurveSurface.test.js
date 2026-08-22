/*
 * Copyright 2025 The Ray Optics Simulation authors and contributors
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

import CustomCurveSurface from '../../../src/core/sceneObjs/other/CustomCurveSurface.js';
import Scene from '../../../src/core/Scene.js';
import { MockUser } from '../helpers/test-utils.js';

describe('CustomCurveSurface', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    scene.gridSize = 20;
    obj = new CustomCurveSurface(scene);
    user = new MockUser(obj);
  });

  it('creates an open Bezier surface', () => {
    user.click(100, 100);
    user.click(130, 80);
    user.click(170, 120);
    user.click(200, 100);
    user.click(200, 100);

    const result = obj.serialize();
    expect(result.type).toBe('CustomCurveSurface');
    expect(result.isClosed).toBe(false);
    expect(result.points).toHaveLength(4);
  });

  it('creates a closed Bezier surface', () => {
    user.click(100, 100);
    user.click(130, 80);
    user.click(170, 120);
    user.click(200, 100);
    user.click(100, 100);

    const result = obj.serialize();
    expect(result.type).toBe('CustomCurveSurface');
    expect(obj.isClosed).toBe(true);
    expect(result.isClosed).toBeUndefined();
    expect(result.points).toHaveLength(4);
  });

  it('sets two-sided and outgoing-ray properties', () => {
    user.click(100, 100);
    user.set("{{simulator:sceneObjs.BaseCustomSurface.twoSided}}", true);
    user.set("θ<sub>1</sub> =", "\\theta_0+0.1");

    const result = obj.serialize();
    expect(result.type).toBe('CustomCurveSurface');
    expect(result.twoSided).toBe(true);
    expect(result.outRays[0].eqnTheta).toBe('\\theta_0+0.1');
  });
});
