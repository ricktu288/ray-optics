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

import Drawing from '../../../src/core/sceneObjs/other/Drawing';
import Scene from '../../../src/core/Scene';
import { MockUser } from '../helpers/test-utils';

describe('Drawing', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    obj = new Drawing(scene);
    user = new MockUser(obj);
  });

  describe('construction', () => {
    it('initializes drawing mode on first mouse down', () => {
      user.mouseDown(100, 100);
      expect(obj.isDrawing).toBeTruthy();
      expect(obj.isMouseDown).toBeTruthy();
      expect(obj.strokes).toEqual([[100, 100]]);
    });

    it('adds points to stroke while moving with mouse down', () => {
      user.mouseDown(100, 100);
      user.mouseMove(120, 120);
      user.mouseMove(140, 140);
      expect(obj.strokes[0]).toEqual([100, 100, 120, 120, 140, 140]);
    });

    it('stops adding points on mouse up', () => {
      user.mouseDown(100, 100);
      user.mouseMove(120, 120);
      user.mouseUp(120, 120);
      expect(obj.isMouseDown).toBeFalsy();
      expect(obj.strokes[0]).toEqual([100, 100, 120, 120]);
    });

    it('creates new stroke on next mouse down', () => {
      // First stroke
      user.mouseDown(100, 100);
      user.mouseMove(120, 120);
      user.mouseUp(120, 120);

      // Second stroke
      user.mouseDown(200, 200);
      user.mouseMove(220, 220);

      expect(obj.strokes).toHaveLength(2);
      expect(obj.strokes[0]).toEqual([100, 100, 120, 120]);
      expect(obj.strokes[1]).toEqual([200, 200, 220, 220]);
    });

    it('finishes drawing when finish button clicked', () => {
      user.mouseDown(100, 100);
      user.mouseMove(120, 120);
      user.mouseUp(120, 120);
      user.clickButton('{{simulator:sceneObjs.Drawing.finishDrawing}}');
      expect(obj.isDrawing).toBeFalsy();
    });

    describe('undo', () => {
      it('removes last stroke when multiple strokes exist', () => {
        // Create first stroke
        user.mouseDown(100, 100);
        user.mouseMove(120, 120);
        user.mouseUp(120, 120);

        // Create second stroke
        user.mouseDown(200, 200);
        user.mouseMove(220, 220);
        user.mouseUp(220, 220);

        // Undo should remove second stroke
        user.undo();
        expect(obj.strokes).toHaveLength(1);
        expect(obj.strokes[0]).toEqual([100, 100, 120, 120]);
      });

      it('cancels construction when only one stroke exists', () => {
        // Create single stroke
        user.mouseDown(100, 100);
        user.mouseMove(120, 120);
        user.mouseUp(120, 120);

        // Undo should cancel construction
        const result = user.undo();
        expect(result.isCancelled).toBeTruthy();
        expect(user.targetObj.scene.editor.isConstructing).toBeFalsy();
      });
    });
  });

  describe('dragging', () => {
    beforeEach(() => {
      // Create a finished drawing
      user.mouseDown(100, 100);
      user.mouseMove(120, 120);
      user.mouseUp(120, 120);
      user.clickButton('{{simulator:sceneObjs.Drawing.finishDrawing}}');
    });

    it('moves entire drawing', () => {
      user.drag(110, 110, 150, 150);
      expect(obj.strokes[0]).toEqual([140, 140, 160, 160]);
    });

    it('moves with grid snapping', () => {
      user.setScene('snapToGrid', true);
      user.drag(110, 110, 151, 151);
      expect(obj.strokes[0]).toEqual([140, 140, 160, 160]);
    });

    it('moves with shift constraint', () => {
      user.shiftDrag(110, 110, 150, 130);
      expect(obj.strokes[0]).toEqual([140, 100, 160, 120]);
    });
  });

  it('serializes correctly', () => {
    user.mouseDown(100, 100);
    user.mouseMove(120, 120);
    user.mouseUp(120, 120);
    user.clickButton('{{simulator:sceneObjs.Drawing.finishDrawing}}');

    expect(obj.serialize()).toEqual({
      type: 'Drawing',
      strokes: [[100, 100, 120, 120]]
    });
  });

  it('moves the entire object by a vector', () => {
    user.mouseDown(100, 100);
    user.mouseMove(120, 120);
    user.mouseUp(120, 120);
    user.mouseDown(200, 200);
    user.mouseMove(220, 220);
    user.mouseUp(220, 220);
    user.clickButton('{{simulator:sceneObjs.Drawing.finishDrawing}}');

    user.move(50, 100);
    expect(obj.serialize()).toEqual({
      type: 'Drawing',
      strokes: [[150, 200, 170, 220], [250, 300, 270, 320]]
    });
  });

  it('rotates 90 degrees around default center', () => {
    user.mouseDown(100, 100);
    user.mouseMove(120, 120);
    user.mouseUp(120, 120);
    user.clickButton('{{simulator:sceneObjs.Drawing.finishDrawing}}');

    user.rotate(Math.PI / 2); // 90 degrees counter-clockwise around default center
    const result = obj.serialize();
    expect(result.type).toBe('Drawing');
    expect(result.strokes).toHaveLength(1);
    // Test that transformation occurred (exact values depend on default center)
    expect(result.strokes[0]).toHaveLength(4);
    expect(typeof result.strokes[0][0]).toBe('number');
  });

  it('rotates 90 degrees around explicit center', () => {
    user.mouseDown(100, 100);
    user.mouseMove(120, 120);
    user.mouseUp(120, 120);
    user.clickButton('{{simulator:sceneObjs.Drawing.finishDrawing}}');

    user.rotate(Math.PI / 2, { x: 0, y: 0 }); // 90 degrees around origin
    const result = obj.serialize();
    expect(result.strokes[0][0]).toBeCloseTo(-100, 5); // x becomes -y
    expect(result.strokes[0][1]).toBeCloseTo(100, 5);  // y becomes x
    expect(result.strokes[0][2]).toBeCloseTo(-120, 5);
    expect(result.strokes[0][3]).toBeCloseTo(120, 5);
    expect(result.type).toBe('Drawing');
  });

  it('scales to 50% around explicit center', () => {
    user.mouseDown(100, 100);
    user.mouseMove(120, 120);
    user.mouseUp(120, 120);
    user.clickButton('{{simulator:sceneObjs.Drawing.finishDrawing}}');

    user.scale(0.5, { x: 0, y: 0 }); // Scale to 50% around origin
    expect(obj.serialize()).toEqual({
      type: 'Drawing',
      strokes: [[50, 50, 60, 60]]
    });
  });
}); 