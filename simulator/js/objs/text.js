// Text
objTypes['text'] = {

  //建立物件 Create the obj
  create: function(mouse) {
  return {type: 'text', x: mouse.x, y: mouse.y, p: 'text here'};
  },

  //顯示屬性方塊 Show the property box
  p_box: function(obj, elem) {
    createStringAttr('', obj.p, function(obj, value) {
      obj.p = value;
    }, elem);
  },

  //建立物件過程滑鼠按下 Mousedown when the obj is being constructed by the user
  c_mousedown: function(obj, mouse)
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
  c_mouseup: function(obj, mouse)
  {
    isConstructing = false;
  },

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas) {
  ctx.fillStyle = getMouseStyle(obj, 'white');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.font = '24px serif';
  ctx.fillText(obj.p, obj.x, obj.y);
  obj.tmp_width = ctx.measureText(obj.p).width;
  },

  //平移物件 Move the object
  move: function(obj, diffX, diffY) {
    obj.x = obj.x + diffX;
    obj.y = obj.y + diffY;
    return obj;
  },

  //繪圖區被按下時(判斷物件被按下的部分) When the drawing area is clicked (test which part of the obj is clicked)
  clicked: function(obj, mouse_nogrid, mouse, draggingPart) {
    
    if (mouse_nogrid.x >= obj.x && mouse_nogrid.x <= obj.x+obj.tmp_width &&
        mouse_nogrid.y <= obj.y && mouse_nogrid.y >= obj.y-24) {
      draggingPart.part = 0;
      draggingPart.mouse0 = graphs.point(mouse_nogrid.x, mouse_nogrid.y);
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

    obj.x = mouse_snapped.x + draggingPart.targetPoint_.x - draggingPart.mouse0.x;
    obj.y = mouse_snapped.y + draggingPart.targetPoint_.y - draggingPart.mouse0.y;
    return {obj: obj};
  },

};
