/**
 * Drawing tool
 * Tools -> Other -> Drawing
 * @property {Array<Array<number>>} points - The points of the drawing. Each element represents a stroke, which is an array of coordinates ordered as `[x1, y1, x2, y2, ...]`.
 * @property {boolean} isDrawing - Whether the user is drawing (before "stop drawing" is clicked).
 * @property {boolean} isMouseDown - Temperary indication of whether the mouse is down (during the drawing stage).
 */
objTypes['drawing'] = class extends BaseSceneObj {
  static type = 'drawing';
  static serializableDefaults = {
    points: [],
    isDrawing: false
  };

  populateObjBar(objBar) {
    if (this.isDrawing) {
      objBar.createButton(getMsg('stop_drawing'), function (obj) {
        obj.isDrawing = false;
        isConstructing = false;
      }, true);
    }
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    ctx.strokeStyle = isHovered ? 'cyan' : 'white';
    ctx.beginPath();
    for (const stroke of this.points) {
      ctx.moveTo(stroke[0], stroke[1]);
      for (let i = 2; i < stroke.length; i += 2) {
        ctx.lineTo(stroke[i], stroke[i + 1]);
      }
    }
    ctx.stroke();
  }

  move(diffX, diffY) {
    for (const stroke of this.points) {
      for (let i = 0; i < stroke.length; i += 2) {
        stroke[i] += diffX;
        stroke[i + 1] += diffY;
      }
    }
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    if (!this.isDrawing) {
      // Initialize the drawing
      this.isDrawing = true;
      this.points = [];
    }
    const mousePos = mouse.getPosSnappedToGrid();
    this.points.push([mousePos.x, mousePos.y]);
    this.isMouseDown = true;
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();
    if (!this.isMouseDown) return;
    this.points[this.points.length - 1].push(mousePos.x, mousePos.y);
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    this.isMouseDown = false;
    return {
      requiresUndoPoint: true
    };
  }

  checkMouseOver(mouse) {
    let dragContext = {};
    for (const stroke of this.points) {
      for (let i = 0; i < stroke.length - 2; i += 2) {
        if (mouse.isOnSegment(geometry.line(geometry.point(stroke[i], stroke[i + 1]), geometry.point(stroke[i + 2], stroke[i + 3])))) {
          const mousePos = mouse.getPosSnappedToGrid();
          dragContext.part = 0;
          dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
          dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
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

    var mouseDiffX = dragContext.mousePos1.x - mousePos.x; // The X difference between the mouse position now and at the previous moment
    var mouseDiffY = dragContext.mousePos1.y - mousePos.y; // The Y difference between the mouse position now and at the previous moment

    if (dragContext.part == 0) {
      for (const stroke of this.points) {
        for (let i = 0; i < stroke.length; i += 2) {
          stroke[i] -= mouseDiffX;
          stroke[i + 1] -= mouseDiffY;
        }
      }
    }

    // Update the mouse position
    dragContext.mousePos1 = mousePos;
  }
};
