// Other -> Text

// generic list of web safe fonts
fonts = [
  'Serif',
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Impact',
  'Lucida Sans'
];

fontStyles = {
  'Normal': getMsg('normal'),
  'Bold': getMsg('bold'),
  'Italic': getMsg('italic'),
  'Bold Italic': getMsg('bolditalic'),
  'Oblique': getMsg('oblique'),
  'Bold Oblique': getMsg('boldoblique')
}

fontAlignments = {
  'left': getMsg('left'),
  'center': getMsg('center'),
  'right': getMsg('right')
}

objTypes['text'] = {

  // Create the obj
  create: function(mouse) {
  return {type: 'text', x: mouse.x, y: mouse.y, p: getMsg("text_here"), fontSize: 24, fontName: 'Serif', fontStyle: 'Normal', fontAlignment: 'left', fontSmallCaps: false, fontAngle: 0};
  },

  // Show the property box
  populateObjBar: function(obj, elem) {
    objBar.createText('', obj.p, function(obj, value) {
      obj.p = value;
    });

    if (objBar.showAdvanced(typeof obj.fontSize != 'undefined' && (obj.fontSize != 24 || obj.fontName != 'Serif' || obj.fontStyle != 'Normal' || obj.fontAlignment != 'left' || obj.fontSmallCaps || obj.fontAngle != 0))) {
      objBar.createNumber(getMsg('fontsize'), 6, 96, 1, obj.fontSize || 24, function(obj, value) {
        obj.fontSize = value;
      }, null, true);
      objBar.createDropdown(getMsg('fontname'), obj.fontName || 'Serif', fonts, function(obj, value) {
        obj.fontName = value;
      });
      objBar.createDropdown(getMsg('fontstyle'), obj.fontStyle || 'Normal', fontStyles, function(obj, value) {
        obj.fontStyle = value;
      });
      objBar.createDropdown(getMsg('fontalignment'), obj.fontAlignment || 'left', fontAlignments, function(obj, value) {
        obj.fontAlignment = value;
      });
      objBar.createBoolean(getMsg('smallcaps'), obj.fontSmallCaps, function(obj, value) {
        obj.fontSmallCaps = value;
      });
      objBar.createNumber(getMsg('angle'), 0, 360, 1, obj.fontAngle || 0, function(obj, value) {
        obj.fontAngle = value;
      }, null, true);
    }
  },

  // Mousedown when the obj is being constructed by the user
  c_mousedown: function(obj, mouse, ctrl, shift)
  {
    
  },

  // Mousemove when the obj is being constructed by the user
  c_mousemove: function(obj, mouse, ctrl, shift)
  {
    obj.x=mouse.x;
    obj.y=mouse.y;
  },

  // Mouseup when the obj is being constructed by the user
  c_mouseup: function(obj, mouse, ctrl, shift)
  {
    isConstructing = false;
  },

  // Draw the obj on canvas
  draw: function(obj, ctx ,aboveLight) {
    ctx.fillStyle = getMouseStyle(obj, 'white');
    ctx.textAlign = obj.fontAlignment || 'left';
    ctx.textBaseline = 'bottom';

    fontName = '';
    if (obj.fontStyle && obj.fontStyle != 'Normal') fontName += obj.fontStyle + ' ';
    if (obj.fontSmallCaps) fontName += 'small-caps '
    fontName += (obj.fontSize || 24) + 'px ' + (obj.fontName || 'serif');
    ctx.font = fontName;

    ctx.save();
    ctx.translate(obj.x, obj.y);
    ctx.rotate(-(obj.fontAngle||0)/180*Math.PI);
    y_offset = 0;
    obj.tmp_left = 0;
    obj.tmp_right = 0;
    obj.tmp_up = 0;
    obj.tmp_down = 0;
    obj.p.split('\n').forEach(line => {
      ctx.fillText(line, 0, y_offset);
      lineDimensions = ctx.measureText(line);
      obj.tmp_left = Math.max(obj.tmp_left, lineDimensions.actualBoundingBoxLeft);
      obj.tmp_right = Math.max(obj.tmp_right, lineDimensions.actualBoundingBoxRight);
      obj.tmp_up = Math.max(obj.tmp_up, lineDimensions.actualBoundingBoxAscent - y_offset);
      obj.tmp_down = Math.max(obj.tmp_down, -lineDimensions.actualBoundingBoxDescent + y_offset);
      if (lineDimensions.fontBoundingBoxAscent) {
        y_offset += lineDimensions.fontBoundingBoxAscent + lineDimensions.fontBoundingBoxDescent;
      } else {
        y_offset += (obj.fontSize || 24) * 1.5;
      }
    });
    ctx.restore();
    // precompute triganometry for faster calculations in 'clicked' function
    obj.tmp_sin_angle = Math.sin((obj.fontAngle||0)/180*Math.PI);
    obj.tmp_cos_angle = Math.cos((obj.fontAngle||0)/180*Math.PI);
  },

  // Move the object
  move: function(obj, diffX, diffY) {
    obj.x = obj.x + diffX;
    obj.y = obj.y + diffY;
    return obj;
  },

  // When the drawing area is clicked (test which part of the obj is clicked)
  clicked: function(obj, mouse_nogrid, mouse, draggingPart) {
    
    // translate and rotate the mouse point into the text's reference frame for easy comparison
    relativeMouseX = mouse_nogrid.x - obj.x
    relativeMouseY = mouse_nogrid.y - obj.y
    rotatedMouseX = relativeMouseX * obj.tmp_cos_angle - relativeMouseY * obj.tmp_sin_angle;
    rotatedMouseY = relativeMouseY * obj.tmp_cos_angle + relativeMouseX * obj.tmp_sin_angle;
    if (rotatedMouseX >= -obj.tmp_left && rotatedMouseX <=  obj.tmp_right &&
        rotatedMouseY <=  obj.tmp_down && rotatedMouseY >= -obj.tmp_up) {
      draggingPart.part = 0;
      draggingPart.mouse0 = geometry.point(mouse_nogrid.x, mouse_nogrid.y);
      draggingPart.mouse0snapped = scene.grid ? geometry.point(Math.round(draggingPart.mouse0.x / scene.gridSize) * scene.gridSize, Math.round(draggingPart.mouse0.y / scene.gridSize) * scene.gridSize) : draggingPart.mouse0;
      draggingPart.targetPoint_ = geometry.point(obj.x, obj.y); // Avoid setting 'targetPoint' (otherwise the xybox will appear and move the text to incorrect coordinates).
      draggingPart.snapData = {};
      return true;
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

    // 'mouse' current mouse position, snapped to grid
    // 'draggingPart.targetPoint_' object placement position (bottom left)
    // 'draggingPart.mouse0' is coordiates of where the drag started, not snapped
    // 'draggingPart.mouse0snapped' is coordiates of where the drag started, snapped to grid
    // 'mouse_snapped' is restriced to horzontal or vertical when shift held, snapped to grid

    // new location  =  current location (snapped)  +  object placement location  -  where drag started (snapped)
    obj.x = mouse_snapped.x + draggingPart.targetPoint_.x - draggingPart.mouse0snapped.x;
    obj.y = mouse_snapped.y + draggingPart.targetPoint_.y - draggingPart.mouse0snapped.y;
  },

};
