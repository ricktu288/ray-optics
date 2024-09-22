import { BaseSceneObj } from '../BaseSceneObj.js';
import { getMsg } from '../../translations.js';
import { geometry } from '../../geometry.js';

/**
 * Drawing tool
 * 
 * Tools -> Other -> Drawing
 * @property {Array<Array<number>>} strokes - The strokes of the drawing. Each element represents a stroke, which is an array of coordinates ordered as `[x1, y1, x2, y2, ...]`. The coordinates are rounded to reduce the size of the JSON data.
 * @property {boolean} isDrawing - Whether the user is drawing (before "stop drawing" is clicked).
 * @property {boolean} isMouseDown - Temperary indication of whether the mouse is down (during the drawing stage).
 */
export class Drawing extends BaseSceneObj {
  static type = 'Drawing';
  static serializableDefaults = {
    strokes: [],
    isDrawing: false
  };

  populateObjBar(objBar) {
    if (this.isDrawing) {
      objBar.createButton(getMsg('stop_drawing'), function (obj) {
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
    let roundedDiffX = this.round(diffX);
    let roundedDiffY = this.round(diffY);
    for (const stroke of this.strokes) {
      for (let i = 0; i < stroke.length; i += 2) {
        stroke[i] += roundedDiffX;
        stroke[i + 1] += roundedDiffY;
      }
    }
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
