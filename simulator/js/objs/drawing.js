// Other -> Drawing
objTypes['drawing'] = {

  // Create the obj
  create: function (constructionPoint) {
    return { type: 'drawing', points: [], tmp_isMouseDown: false, notDone: true };
  },

  // Show the property box
  populateObjBar: function (obj, objBar) {
    if (obj.notDone) {
      objBar.createButton(getMsg('stop_drawing'), function (obj) {
        delete obj.notDone;
      }, true);
    }
  },

  // Mousedown when the obj is being constructed by the user
  onConstructMouseDown: function (obj, constructionPoint, mouse, ctrl, shift) {
    if (!obj.notDone) {
      return {
        isDone: true
      };
    }
    const mousePos = mouse.getPosSnappedToGrid();
    obj.points.push([mousePos.x, mousePos.y]);
    obj.tmp_isMouseDown = true;
  },
  // Mousemove when the obj is being constructed by the user
  onConstructMouseMove: function (obj, constructionPoint, mouse, ctrl, shift) {
    if (!obj.notDone) {
      return {
        isDone: true
      };
    }
    const mousePos = mouse.getPosSnappedToGrid();
    if (!obj.tmp_isMouseDown) return;
    obj.points[obj.points.length - 1].push(mousePos.x, mousePos.y);
  },
  // Mouseup when the obj is being constructed by the user
  onConstructMouseUp: function (obj, constructionPoint, mouse, ctrl, shift) {
    obj.tmp_isMouseDown = false;
    return {
      requiresUndoPoint: true
    }
  },

  // Draw the obj on canvas
  draw: function (obj, canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    ctx.strokeStyle = isHovered ? 'cyan' : ("white");
    ctx.beginPath();
    for (var i = 0; i < obj.points.length; i++) {
      ctx.moveTo(obj.points[i][0], obj.points[i][1]);
      for (var j = 2; j < obj.points[i].length; j += 2) {
        ctx.lineTo(obj.points[i][j], obj.points[i][j + 1]);
      }
    }
    ctx.stroke();
  },

  // Move the object
  move: function (obj, diffX, diffY) {
    for (var i = 0; i < obj.points.length; i++) {
      for (var j = 0; j < obj.points[i].length; j += 2) {
        obj.points[i][j] += diffX;
        obj.points[i][j + 1] += diffY;
      }
    }
    return obj;
  },


  // When the drawing area is clicked (test which part of the obj is clicked)
  checkMouseOver: function (obj, mouse) {
    let dragContext = {};
    for (var i = 0; i < obj.points.length; i++) {
      for (var j = 0; j < obj.points[i].length - 2; j += 2) {
        if (mouse.isOnSegment(geometry.line(geometry.point(obj.points[i][j], obj.points[i][j + 1]), geometry.point(obj.points[i][j + 2], obj.points[i][j + 3])))) {
          const mousePos = mouse.getPosSnappedToGrid();
          dragContext.part = 0;
          dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
          dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
          dragContext.snapContext = {};
          return dragContext;
        }
      }
    }
  },

  // When the user is dragging the obj
  onDrag: function (obj, mouse, dragContext, ctrl, shift) {
    if (shift) {
      var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
    }
    else {
      var mousePos = mouse.getPosSnappedToGrid();
      dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
    }

    var mouseDiffX = dragContext.mousePos1.x - mousePos.x; // The X difference between the mouse position now and at the previous moment
    var mouseDiffY = dragContext.mousePos1.y - mousePos.y; // The Y difference between the mouse position now and at the previous moment

    if (dragContext.part == 0) {
      for (var i = 0; i < obj.points.length; i++) {
        for (var j = 0; j < obj.points[i].length; j += 2) {
          obj.points[i][j] -= mouseDiffX;
          obj.points[i][j + 1] -= mouseDiffY;
        }
      }
    }

    // Update the mouse position
    dragContext.mousePos1 = mousePos;
  }

};
