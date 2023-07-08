// Text
// Originally contributed by Paul Falstad (pfalstad)

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

fontStyles = [
  'Normal',
  'Bold',
  'Italic',
  'Bold Italic',
  'Oblique',
  'Bold Oblique'
]

fontAlignments = {
  'left': "Left",
  'center': "Centre",
  'right': "Right"
}

objTypes['text'] = {

  //建立物件 Create the obj
  create: function(mouse) {
  return {type: 'text', x: mouse.x, y: mouse.y, p: 'text here', fontSize: 24, fontName: 'Serif', fontStyle: 'Normal', fontAlignment: 'left', fontSmallCaps: false, fontAngle: 0};
  },

  //顯示屬性方塊 Show the property box
  p_box: function(obj, elem) {
    // createStringAttr('', obj.p, function(obj, value) {
    //   obj.p = value;
    // }, elem);
    createTextAttr('', obj.p, function(obj, value) {
      obj.p = value;
    }, elem);

    if (createAdvancedOptions(typeof obj.fontSize != 'undefined' && (obj.fontSize != 24 || obj.fontName != 'Serif' || obj.fontStyle != 'Normal' || obj.fontAlignment != 'left' || obj.fontSmallCaps || obj.fontAngle != 0))) {
      createNumberAttr(getMsg('fontsize'), 6, 96, 1, obj.fontSize || 24, function(obj, value) {
        obj.fontSize = value;
      }, elem);
      createDropdownAttr(getMsg('fontname'), obj.fontName || 'Serif', fonts, function(obj, value) {
        obj.fontName = value;
      }, elem);
      createDropdownAttr(getMsg('fontstyle'), obj.fontStyle || 'Normal', fontStyles, function(obj, value) {
        obj.fontStyle = value;
      }, elem);
      createDropdownAttr(getMsg('fontalignment'), obj.fontAlignment || 'left', fontAlignments, function(obj, value) {
        obj.fontAlignment = value;
      }, elem);
      createBooleanAttr(getMsg('smallcaps'), obj.fontSmallCaps, function(obj, value) {
        obj.fontSmallCaps = value;
      }, elem);
      createNumberAttr(getMsg('angle'), 0, 360, 1, obj.fontAngle || 0, function(obj, value) {
        obj.fontAngle = value;
      }, elem);
    }
  },

  //建立物件過程滑鼠按下 Mousedown when the obj is being constructed by the user
  c_mousedown: function(obj, mouse, ctrl, shift)
  {
    draw();
  },

  //建立物件過程滑鼠移動 Mousemove when the obj is being constructed by the user
  c_mousemove: function(obj, mouse, ctrl, shift)
  {
    obj.x=mouse.x;
    obj.y=mouse.y;
    draw();
  },

  //建立物件過程滑鼠放開 Mouseup when the obj is being constructed by the user
  c_mouseup: function(obj, mouse, ctrl, shift)
  {
    isConstructing = false;
  },

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas) {
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

  //平移物件 Move the object
  move: function(obj, diffX, diffY) {
    obj.x = obj.x + diffX;
    obj.y = obj.y + diffY;
    return obj;
  },

  //繪圖區被按下時(判斷物件被按下的部分) When the drawing area is clicked (test which part of the obj is clicked)
  clicked: function(obj, mouse_nogrid, mouse, draggingPart) {
    
    // translate and rotate the mouse point into the text's reference frame for easy comparison
    relativeMouseX = mouse_nogrid.x - obj.x
    relativeMouseY = mouse_nogrid.y - obj.y
    rotatedMouseX = relativeMouseX * obj.tmp_cos_angle - relativeMouseY * obj.tmp_sin_angle;
    rotatedMouseY = relativeMouseY * obj.tmp_cos_angle + relativeMouseX * obj.tmp_sin_angle;
    if (rotatedMouseX >= -obj.tmp_left && rotatedMouseX <=  obj.tmp_right &&
        rotatedMouseY <=  obj.tmp_down && rotatedMouseY >= -obj.tmp_up) {
      draggingPart.part = 0;
      draggingPart.mouse0 = graphs.point(mouse_nogrid.x, mouse_nogrid.y);
      draggingPart.mouse0snapped = document.getElementById('grid').checked ? graphs.point(Math.round(draggingPart.mouse0.x / gridSize) * gridSize, Math.round(draggingPart.mouse0.y / gridSize) * gridSize) : draggingPart.mouse0;
      draggingPart.targetPoint_ = graphs.point(obj.x, obj.y); // Avoid setting 'targetPoint' (otherwise the xybox will appear and move the text to incorrect coordinates).
      draggingPart.snapData = {};
      return true;
    }
    return false;
  },

  //拖曳物件時 When the user is dragging the obj
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    if (shift)
    {
      var mouse_snapped = snapToDirection(mouse, draggingPart.mouse0, [{x: 1, y: 0},{x: 0, y: 1}], draggingPart.snapData);
    }
    else
    {
      var mouse_snapped = mouse;
      draggingPart.snapData = {}; //放開shift時解除原先之拖曳方向鎖定 Unlock the dragging direction when the user release the shift key
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
