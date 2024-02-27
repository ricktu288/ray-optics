// The crop box appears when using File -> Export as PNG/SVG
objTypes['cropbox'] = {

  // Show the property box
  populateObjBar: function(obj, objBar) {
    var width = geometry.length(obj.p1, obj.p2);
    var height = geometry.length(obj.p1, obj.p3);
    objBar.createNumber(getMsg('cropbox_size'), 0, 1000, 1, width, function(obj, value) {
      obj.p2 = geometry.point(obj.p1.x + 1*value, obj.p2.y);
      obj.p4 = geometry.point(obj.p3.x + 1*value, obj.p4.y);
    }, null, true);
    objBar.createNumber('x', 0, 1000, 1, height, function(obj, value) {
      obj.p3 = geometry.point(obj.p3.x, obj.p1.y + 1*value);
      obj.p4 = geometry.point(obj.p4.x, obj.p2.y + 1*value);
    }, null, true);
    objBar.createDropdown(getMsg('image_format'), obj.format, {
      'png': 'PNG',
      'svg': 'SVG'
    }, function(obj, value) {
      obj.format = value;
    }, null, true);


    if (obj.format != 'svg') {
      objBar.createNumber(getMsg('image_width'), 0, 1000, 1, obj.width, function(obj, value) {
        obj.width = 1*value;
      }, null, true);
    } else {
      objBar.createInfoBox(getMsg('export_svg_popover'))
    }

    objBar.createButton(getMsg('save'), function(obj) {
      confirmCrop(obj);
    });
    objBar.createButton(getMsg('save_cancel'), function(obj) {
      cancelCrop();
    });
  },

  // Move the object
  move: function(obj, diffX, diffY) {
    obj.p1.x = obj.p1.x + diffX;
    obj.p1.y = obj.p1.y + diffY;
    obj.p2.x = obj.p2.x + diffX;
    obj.p2.y = obj.p2.y + diffY;
    obj.p3.x = obj.p3.x + diffX;
    obj.p3.y = obj.p3.y + diffY;
    obj.p4.x = obj.p4.x + diffX;
    obj.p4.y = obj.p4.y + diffY;
    return obj;
  },

  // When the drawing area is clicked (test which part of the obj is clicked)
  checkMouseOver: function(obj, mouse, draggingPart) {
    if (!cropMode) return false;

    // Top left
    if (mouse.isOnPoint(obj.p1)) {
      draggingPart.part = 1;
      draggingPart.targetPoint = geometry.point(obj.p1.x, obj.p1.y);
      draggingPart.cursor = 'nwse-resize';
      draggingPart.requiresObjBarUpdate = true;
      return true;
    }
    // Top right
    if (mouse.isOnPoint(obj.p2)) {
      draggingPart.part = 2;
      draggingPart.targetPoint = geometry.point(obj.p2.x, obj.p2.y);
      draggingPart.cursor = 'nesw-resize';
      draggingPart.requiresObjBarUpdate = true;
      return true;
    }
    // Bottom left
    if (mouse.isOnPoint(obj.p3)) {
      draggingPart.part = 3;
      draggingPart.targetPoint = geometry.point(obj.p3.x, obj.p3.y);
      draggingPart.cursor = 'nesw-resize';
      draggingPart.requiresObjBarUpdate = true;
      return true;
    }
    // Bottom right
    if (mouse.isOnPoint(obj.p4)) {
      draggingPart.part = 4;
      draggingPart.targetPoint = geometry.point(obj.p4.x, obj.p4.y);
      draggingPart.cursor = 'nwse-resize';
      draggingPart.requiresObjBarUpdate = true;
      return true;
    }
    // Top
    if (mouse.isOnSegment(geometry.segment(obj.p1, obj.p2))) {
      draggingPart.part = 5;
      draggingPart.cursor = 'ns-resize';
      draggingPart.requiresObjBarUpdate = true;
      return true;
    }
    // Right
    if (mouse.isOnSegment(geometry.segment(obj.p2, obj.p4))) {
      draggingPart.part = 6;
      draggingPart.cursor = 'ew-resize';
      draggingPart.requiresObjBarUpdate = true;
      return true;
    }
    // Bottom
    if (mouse.isOnSegment(geometry.segment(obj.p3, obj.p4))) {
      draggingPart.part = 7;
      draggingPart.cursor = 'ns-resize';
      draggingPart.requiresObjBarUpdate = true;
      return true;
    }
    // Left
    if (mouse.isOnSegment(geometry.segment(obj.p1, obj.p3))) {
      draggingPart.part = 8;
      draggingPart.cursor = 'ew-resize';
      draggingPart.requiresObjBarUpdate = true;
      return true;
    }
    // Inside
    const mousePos = mouse.getPosSnappedToGrid();
    if ((obj.p1.x < mousePos.x && mousePos.x < obj.p2.x) && (obj.p1.y < mousePos.y && mousePos.y < obj.p3.y)) {
      draggingPart.part = 0;
      draggingPart.mousePos0 = mousePos; // Mouse position when the user starts dragging
      draggingPart.mousePos1 = mousePos; // Mouse position at the last moment during dragging
      draggingPart.snapData = {};
      return true;
    }
    return false;
  },

  // When the user is dragging the obj
  onDrag: function(obj, mouse, draggingPart, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();

    // Top left
    if (draggingPart.part == 1) {
      obj.p1.x = mousePos.x;
      obj.p1.y = mousePos.y;
      obj.p2.y = mousePos.y;
      obj.p3.x = mousePos.x;
    }
    // Top right
    else if (draggingPart.part == 2) {
      obj.p2.x = mousePos.x;
      obj.p2.y = mousePos.y;
      obj.p1.y = mousePos.y;
      obj.p4.x = mousePos.x;
    }
    // Bottom left
    else if (draggingPart.part == 3) {
      obj.p3.x = mousePos.x;
      obj.p3.y = mousePos.y;
      obj.p1.x = mousePos.x;
      obj.p4.y = mousePos.y;
    }
    // Bottom right
    else if (draggingPart.part == 4) {
      obj.p4.x = mousePos.x;
      obj.p4.y = mousePos.y;
      obj.p2.x = mousePos.x;
      obj.p3.y = mousePos.y;
    }
    // Top
    else if (draggingPart.part == 5) {
      obj.p1.y = mousePos.y;
      obj.p2.y = mousePos.y;
    }
    // Right
    else if (draggingPart.part == 6) {
      obj.p2.x = mousePos.x;
      obj.p4.x = mousePos.x;
    }
    // Bottom
    else if (draggingPart.part == 7) {
      obj.p3.y = mousePos.y;
      obj.p4.y = mousePos.y;
    }
    // Left
    else if (draggingPart.part == 8) {
      obj.p1.x = mousePos.x;
      obj.p3.x = mousePos.x;
    }
    // Inside
    else if (draggingPart.part == 0) {
      if (shift)
      {
        var mousePosSnapped = mouse.getPosSnappedToDirection(draggingPart.mousePos0, [{x: 1, y: 0},{x: 0, y: 1}], draggingPart.snapData);
      }
      else
      {
        var mousePosSnapped = mouse.getPosSnappedToGrid();
        draggingPart.snapData = {}; // Unlock the dragging direction when the user release the shift key
      }
  
      var mouseDiffX = draggingPart.mousePos1.x - mousePosSnapped.x; // The X difference between the mouse position now and at the previous moment
      var mouseDiffY = draggingPart.mousePos1.y - mousePosSnapped.y; // The Y difference between the mouse position now and at the previous moment
      

      obj.p1.x -= mouseDiffX;
      obj.p1.y -= mouseDiffY;
      obj.p2.x -= mouseDiffX;
      obj.p2.y -= mouseDiffY;
      obj.p3.x -= mouseDiffX;
      obj.p3.y -= mouseDiffY;
      obj.p4.x -= mouseDiffX;
      obj.p4.y -= mouseDiffY;

      // Update the mouse position
      draggingPart.mousePos1 = mousePosSnapped;
    }

  },

  // Draw the obj on canvas
  draw: function(obj, ctx, aboveLight) {    
    if (!cropMode) return;

    // Draw the crop box
    ctx.strokeStyle = getMouseStyle(obj,'white');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p2.x, obj.p2.y);
    ctx.lineTo(obj.p4.x, obj.p4.y);
    ctx.lineTo(obj.p3.x, obj.p3.y);
    ctx.lineTo(obj.p1.x, obj.p1.y);
    ctx.stroke();

    // Draw the crop box's corner points
    ctx.fillStyle = getMouseStyle(obj,'white');
    ctx.beginPath();
    ctx.arc(obj.p1.x, obj.p1.y, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(obj.p2.x, obj.p2.y, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(obj.p3.x, obj.p3.y, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(obj.p4.x, obj.p4.y, 5, 0, 2 * Math.PI);
    ctx.fill();
    
  }

};
