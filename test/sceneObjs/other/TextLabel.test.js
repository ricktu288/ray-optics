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

import TextLabel from '../../../src/core/sceneObjs/other/TextLabel';
import Scene from '../../../src/core/Scene';
import { MockUser } from '../helpers/test-utils';

describe('TextLabel', () => {
  let scene;
  let obj;
  let user;

  beforeEach(() => {
    scene = new Scene();
    obj = new TextLabel(scene);
    user = new MockUser(obj);

    // Simulate the bounding box values that would be set by the canvas context
    obj.left = 10;
    obj.right = 50;
    obj.up = 10;
    obj.down = 20;
    obj.sin_angle = 0;
    obj.cos_angle = 1;
  });

  it('creates with one click', () => {
    user.click(101, 102);
    expect(obj.serialize()).toEqual({
      type: 'TextLabel',
      x: 101,
      y: 102,
      text: '{{simulator:sceneObjs.TextLabel.textHere}}'
    });
  });

  it('creates with grid snapping', () => {
    user.setScene('snapToGrid', true);
    user.click(101, 102);
    expect(obj.serialize()).toEqual({
      type: 'TextLabel',
      x: 100,
      y: 100,
      text: '{{simulator:sceneObjs.TextLabel.textHere}}'
    });
  });

  it('hovers with mouse', () => {
    user.click(100, 100);
    
    // Point inside text bounds
    expect(user.hover(120, 110)).toBeTruthy();
    // Point outside text bounds
    expect(user.hover(200, 200)).toBeFalsy();
  });

  it('drags with mouse', () => {
    user.click(100, 100);
    user.drag(110, 110, 200, 200);
    expect(obj.serialize()).toEqual({
      type: 'TextLabel',
      x: 190,
      y: 190,
      text: '{{simulator:sceneObjs.TextLabel.textHere}}'
    });
  });

  it('drags with grid snapping', () => {
    user.click(100, 100);
    user.setScene('snapToGrid', true);
    user.drag(110, 110, 201, 201);
    expect(obj.serialize()).toEqual({
      type: 'TextLabel',
      x: 180,
      y: 180,
      text: '{{simulator:sceneObjs.TextLabel.textHere}}',
    });
  });

  it('shift + drags horizontally', () => {
    user.click(100, 100);
    user.shiftDrag(110, 110, 200, 150);
    expect(obj.serialize()).toEqual({
      type: 'TextLabel',
      x: 190,
      y: 100,
      text: '{{simulator:sceneObjs.TextLabel.textHere}}'
    });
  });

  it('shift + drags vertically', () => {
    user.click(100, 100);
    user.shiftDrag(110, 110, 150, 200);
    expect(obj.serialize()).toEqual({
      type: 'TextLabel',
      x: 100,
      y: 190,
      text: '{{simulator:sceneObjs.TextLabel.textHere}}'
    });
  });

  it('moves by a vector', () => {
    user.click(100, 100);
    user.move(50, 100);
    expect(obj.serialize()).toEqual({
      type: 'TextLabel',
      x: 150,
      y: 200,
      text: '{{simulator:sceneObjs.TextLabel.textHere}}'
    });
  });

  it('sets text properties', () => {
    user.click(100, 100);
    
    user.set('', 'Hello World');
    user.set("{{simulator:sceneObjs.TextLabel.fontSize}}", 36);
    user.set("{{simulator:sceneObjs.TextLabel.font}}", 'Arial');
    user.set("{{simulator:sceneObjs.TextLabel.fontStyle}}", 'Bold');
    user.set("{{simulator:sceneObjs.TextLabel.alignment}}", 'center');
    user.set("{{simulator:sceneObjs.TextLabel.smallCaps}}", true);
    user.set("{{simulator:sceneObjs.TextLabel.angle}}", 45);

    expect(obj.serialize()).toEqual({
      type: 'TextLabel',
      x: 100,
      y: 100,
      text: 'Hello World',
      fontSize: 36,
      font: 'Arial',
      fontStyle: 'Bold',
      alignment: 'center',
      smallCaps: true,
      angle: 45
    });
  });
}); 