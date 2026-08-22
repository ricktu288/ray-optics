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

import Detector from '../../../src/core/sceneObjs/other/Detector';
import Scene from '../../../src/core/Scene';
import { createDagClosureEvaluator } from '../../../src/core/formula/dag-evaluator';
import { testLineObj } from '../helpers/lineObjTests';
import { MockUser } from '../helpers/test-utils';

describe('Detector', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    obj = new Detector(scene);
    user = new MockUser(obj);
  });

  testLineObj(() => ({ obj, user }));

  it('sets properties', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.set("{{simulator:sceneObjs.Detector.irradMap}}", true);
    user.set("{{simulator:sceneObjs.Detector.binSize}}", 2);

    expect(obj.serialize()).toEqual({
      type: "Detector",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      irradMap: true,
      binSize: 2
    });
  });

  it('sets one-sided detection', () => {
    user.click(100, 100);
    user.click(200, 300);
    user.set("{{simulator:sceneObjs.Detector.twoSided}}", false);

    expect(obj.serialize()).toEqual({
      type: "Detector",
      p1: { x: 100, y: 100 },
      p2: { x: 200, y: 300 },
      twoSided: false
    });
  });

  it('initializes measurement values', () => {
    user.click(100, 100);
    user.click(200, 300);
    
    expect(obj.power).toBe(0);
    expect(obj.normal).toBe(0);
    expect(obj.shear).toBe(0);
    expect(obj.binData).toBeNull();
  });
  it('creates a detector primitive with a persistent result holder', () => {
    obj.p1 = { x: 0, y: 0 };
    obj.p2 = { x: 10, y: 0 };
    obj.twoSided = false;
    obj.irradMap = true;
    obj.binSize = 2;

    const firstPrimitive = obj.getPrimitives()[0];
    const secondPrimitive = obj.getPrimitives()[0];
    const evaluate = createDagClosureEvaluator(firstPrimitive.detectorType.dag);
    const writes = evaluate({
      ...firstPrimitive.params,
      d_0x: 0.6,
      d_0y: -0.8,
      P_0s: 0.25,
      P_0p: 0.5,
      sigma: 1,
      u: 0.25
    });

    expect(secondPrimitive).not.toBe(firstPrimitive);
    expect(secondPrimitive.result).toBe(firstPrimitive.result);
    expect(firstPrimitive.twoSided).toBe(false);
    expect(firstPrimitive.resultSize).toBe(8);
    expect(firstPrimitive.detectorType.writeCount).toBe(4);
    expect([writes.k_1, writes.k_2, writes.k_3, writes.k_4])
      .toEqual([0, 1, 2, 4]);
    expect(writes.v_1).toBeCloseTo(0.75);
    expect(writes.v_2).toBeCloseTo(0.6);
    expect(writes.v_3).toBeCloseTo(-0.45);
    expect(writes.v_4).toBeCloseTo(0.75);

    firstPrimitive.result.values = Float64Array.from([
      2, 3, 4, 5, 6, 7, 8, 9
    ]);
    obj.updateMeasurementsFromPrimitiveResults();
    expect(obj.power).toBe(2);
    expect(obj.normal).toBe(3);
    expect(obj.shear).toBe(4);
    expect(obj.binData).toEqual([5, 6, 7, 8, 9]);
  });
});
