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

import BaseSceneObj from '../BaseSceneObj.js';
import i18next from 'i18next';
import geometry from '../../geometry.js';

/**
 * Drawing tool
 * 
 * Tools -> Other -> Drawing
 * @class
 * @extends BaseSceneObj
 * @memberof sceneObjs
 * @property {Array<Array<number>>} strokes - The strokes of the drawing. Each element represents a stroke, which is an array of coordinates ordered as `[x1, y1, x2, y2, ...]`. The coordinates are rounded to reduce the size of the JSON data.
 * @property {boolean} isDrawing - Whether the user is drawing (before "stop drawing" is clicked).
 * @property {boolean} isMouseDown - Temperary indication of whether the mouse is down (during the drawing stage).
 */
class Drawing extends BaseSceneObj {
  static type = 'Drawing';
  static serializableDefaults = {
    strokes: [],
    isDrawing: false
  };

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.Drawing.title'));
    if (this.isDrawing) {
      objBar.createButton(i18next.t('simulator:sceneObjs.Drawing.finishDrawing'), function (obj) {
        obj.isDrawing = false;
        if (obj.scene.editor.isConstructing) {
          obj.scene.editor.isConstructing = false;
        }
      }, true);
    }
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    ctx.strokeStyle = isHovered ? 'cyan' : 'white';
    ctx.lineWidth = 1 * ls;
    ctx.beginPath();
    for (const stroke of this.strokes) {
      ctx.moveTo(stroke[0], stroke[1]);
      for (let i = 2; i < stroke.length; i += 2) {
        ctx.lineTo(stroke[i], stroke[i + 1]);
      }
    }
    ctx.stroke();
  }

  move(diffX, diffY) {
    // Removed rounding to avoid error accumulation
    for (const stroke of this.strokes) {
      for (let i = 0; i < stroke.length; i += 2) {
        stroke[i] += diffX;
        stroke[i + 1] += diffY;
      }
    }
    return true;
  }

  rotate(angle, center = null) {
    // Use the calculated center of the drawing if none provided
    center = center || this.getDefaultCenter();
    
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    for (const stroke of this.strokes) {
      for (let i = 0; i < stroke.length; i += 2) {
        const x = stroke[i];
        const y = stroke[i + 1];
        
        // Apply rotation without rounding
        const dx = x - center.x;
        const dy = y - center.y;
        
        stroke[i] = center.x + dx * cos - dy * sin;
        stroke[i + 1] = center.y + dx * sin + dy * cos;
      }
    }
    
    return true;
  }

  scale(scale, center = null) {
    // Use the calculated center of the drawing if none provided
    center = center || this.getDefaultCenter();
    
    for (const stroke of this.strokes) {
      for (let i = 0; i < stroke.length; i += 2) {
        // Apply scaling without rounding
        stroke[i] = center.x + (stroke[i] - center.x) * scale;
        stroke[i + 1] = center.y + (stroke[i + 1] - center.y) * scale;
      }
    }
    
    return true;
  }

  getDefaultCenter() {
    // Calculate the center as the average of all points in the drawing
    if (this.strokes.length === 0) {
      return { x: 0, y: 0 }; // Fallback for empty drawing
    }
    
    let sumX = 0;
    let sumY = 0;
    let totalPoints = 0;
    
    for (const stroke of this.strokes) {
      for (let i = 0; i < stroke.length; i += 2) {
        sumX += stroke[i];
        sumY += stroke[i + 1];
        totalPoints++;
      }
    }
    
    if (totalPoints === 0) {
      return { x: 0, y: 0 };
    }
    
    return {
      x: sumX / totalPoints,
      y: sumY / totalPoints
    };
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    if (!this.isDrawing) {
      // Initialize the drawing
      this.isDrawing = true;
      this.strokes = [];
    }
    const mousePos = mouse.getPosSnappedToGrid();
    this.strokes.push([this.round(mousePos.x), this.round(mousePos.y)]);
    this.isMouseDown = true;
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();
    if (!this.isMouseDown) return;
    if (this.strokes.length === 0 || this.strokes[this.strokes.length - 1].length < 2) return;

    const distanceSq = (this.strokes[this.strokes.length - 1][this.strokes[this.strokes.length - 1].length - 2] - mousePos.x) ** 2 + (this.strokes[this.strokes.length - 1][this.strokes[this.strokes.length - 1].length - 1] - mousePos.y) ** 2;
    
    if (distanceSq < 4 * this.scene.lengthScale * this.scene.lengthScale) return;

    this.strokes[this.strokes.length - 1].push(this.round(mousePos.x), this.round(mousePos.y));
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    this.isMouseDown = false;
  }

  onConstructUndo() {
    if (this.strokes.length < 2) {
      return {
        isCancelled: true
      }
    } else {
      this.strokes.pop();
    }
  }

  checkMouseOver(mouse) {
    let dragContext = {};
    for (const stroke of this.strokes) {
      for (let i = 0; i < stroke.length - 2; i += 2) {
        if (mouse.isOnSegment(geometry.line(geometry.point(stroke[i], stroke[i + 1]), geometry.point(stroke[i + 2], stroke[i + 3])))) {
          const mousePos = mouse.getPosSnappedToGrid();
          const roundedMousePos = geometry.point(this.round(mousePos.x), this.round(mousePos.y));
          dragContext.part = 0;
          dragContext.mousePos0 = roundedMousePos; // Mouse position when the user starts dragging
          dragContext.mousePos1 = roundedMousePos; // Mouse position at the last moment during dragging
          dragContext.snapContext = {};
          return dragContext;
        }
      }
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    if (shift) {
      var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
    } else {
      var mousePos = mouse.getPosSnappedToGrid();
      dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
    }

    const roundedMousePos = geometry.point(this.round(mousePos.x), this.round(mousePos.y));

    var mouseDiffX = dragContext.mousePos1.x - roundedMousePos.x; // The X difference between the mouse position now and at the previous moment
    var mouseDiffY = dragContext.mousePos1.y - roundedMousePos.y; // The Y difference between the mouse position now and at the previous moment

    if (dragContext.part == 0) {
      for (const stroke of this.strokes) {
        for (let i = 0; i < stroke.length; i += 2) {
          stroke[i] -= mouseDiffX;
          stroke[i + 1] -= mouseDiffY;
        }
      }
    }

    // Update the mouse position
    dragContext.mousePos1 = roundedMousePos;
  }

  /* Utility functions */

  /**
   * Round the coordinates of the strokes to integers times the length scale (to reduce the size of the JSON data).
   */
  round(num) {
    return Math.round(num / this.scene.lengthScale) * this.scene.lengthScale;
  }
};

export default Drawing;