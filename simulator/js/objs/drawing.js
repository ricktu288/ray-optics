// Other -> Drawing
objTypes['drawing'] = {

  // Create the obj
  create: function(mouse) {
    return {type: 'drawing', points: [], tmp_isMouseDown: false};
  },

  // Show the property box
  p_box: function(obj, elem) {
    if (isConstructing) {
      createButton(getMsg('stop_drawing'), function(obj) {
        obj.notDone = false;
        isConstructing = false;
        selectObj(scene.objs.length - 1);
      }, elem);
    }
  },

  // Mousedown when the obj is being constructed by the user
  c_mousedown: function(obj, mouse, ctrl, shift)
  {
    obj.points.push([mouse.x, mouse.y]);
    obj.tmp_isMouseDown = true;
    selectObj(scene.objs.length - 1);
  },
  // Mousemove when the obj is being constructed by the user
  c_mousemove: function(obj, mouse, ctrl, shift)
  {
    if (!obj.tmp_isMouseDown) return;
    obj.points[obj.points.length - 1].push(mouse.x, mouse.y);
  },
  // Mouseup when the obj is being constructed by the user
  c_mouseup: function(obj, mouse, ctrl, shift)
  {
    obj.tmp_isMouseDown = false;
    createUndoPoint();
  },

  // Draw the obj on canvas
  draw: function(obj, ctx, aboveLight) {
    ctx.strokeStyle = getMouseStyle(obj, "white");
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
  move: function(obj, diffX, diffY) {
    for (var i = 0; i < obj.points.length; i++) {
      for (var j = 0; j < obj.points[i].length; j += 2) {
        obj.points[i][j] += diffX;
        obj.points[i][j + 1] += diffY;
      }
    }
    return obj;
  },


  // When the drawing area is clicked (test which part of the obj is clicked)
  clicked: function(obj, mouse_nogrid, mouse, draggingPart) {
    for (var i = 0; i < obj.points.length; i++) {
      for (var j = 0; j < obj.points[i].length - 2; j += 2) {
        if (mouseOnSegment(mouse_nogrid, graphs.segment(graphs.point(obj.points[i][j], obj.points[i][j + 1]), graphs.point(obj.points[i][j + 2], obj.points[i][j + 3])))) {
          draggingPart.part = 0;
          draggingPart.mouse0 = mouse; // Mouse position when the user starts dragging
          draggingPart.mouse1 = mouse; // Mouse position at the last moment during dragging
          draggingPart.snapData = {};
          return true;
        }
      }
    }
    return false;
  },

  // When the user is dragging the obj
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    if (shift)
    {
      var mouse_snapped = snapToDirection(mouse, draggingPart.mouse0, [{x: 1, y: 0},{x: 0, y: 1}], draggingPart.snapData);
    }
    else
    {
      var mouse_snapped = mouse;
      draggingPart.snapData = {}; // Unlock the dragging direction when the user release the shift key
    }

    var mouseDiffX = draggingPart.mouse1.x - mouse_snapped.x; // The X difference between the mouse position now and at the previous moment
    var mouseDiffY = draggingPart.mouse1.y - mouse_snapped.y; // The Y difference between the mouse position now and at the previous moment
    
    if (draggingPart.part == 0) {
      for (var i = 0; i < obj.points.length; i++) {
        for (var j = 0; j < obj.points[i].length; j += 2) {
          obj.points[i][j] -= mouseDiffX;
          obj.points[i][j + 1] -= mouseDiffY;
        }
      }
    }

    // Update the mouse position
    draggingPart.mouse1 = mouse_snapped;
  }

};
