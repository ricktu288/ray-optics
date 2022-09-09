
objTypes['handle'] = {

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'handle', controlPoints: [], notDone: true};
  },

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas) {

    for (var i in obj.controlPoints) {
      // If user drags some target objs, restore them back to avoid unexpected behavior.
      objTypes[objs[obj.controlPoints[i].targetObj_index].type].dragging(objs[obj.controlPoints[i].targetObj_index], JSON.parse(JSON.stringify(obj.controlPoints[i].newPoint)), JSON.parse(JSON.stringify(obj.controlPoints[i].mousePart)), false, false);
    }
    for (var i in obj.controlPoints) {
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.strokeStyle = obj.notDone?'cyan':getMouseStyle(obj,'transparent');
      ctx.arc(obj.controlPoints[i].mousePart.targetPoint.x, obj.controlPoints[i].mousePart.targetPoint.y, 5, 0, Math.PI * 2, false);
      ctx.stroke();
    }
    if (!obj.notDone) {
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.strokeStyle = getMouseStyle(obj,'red');
      ctx.arc(obj.p1.x, obj.p1.y, 2, 0, Math.PI * 2, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(obj.p1.x, obj.p1.y, 5, 0, Math.PI * 2, false);
      ctx.stroke();
    }
  },

  //平移物件 Move the object
  move: function(obj, diffX, diffY) {
    obj.x = obj.x + diffX;
    obj.y = obj.y + diffY;
    return obj;
  },

  //繪圖區被按下時(判斷物件被按下的部分) When the drawing area is clicked (test which part of the obj is clicked)
  clicked: function(obj, mouse_nogrid, mouse, draggingPart) {
    if (obj.notDone) return;
    if (mouseOnPoint(mouse_nogrid, obj.p1))
    {
      draggingPart.part = 1;
      draggingPart.targetPoint_ = graphs.point(obj.p1.x, obj.p1.y);
      return true;
    }
    return false;
  },

  //拖曳物件時 When the user is dragging the obj
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    if (obj.notDone) return;
    if (draggingPart.part == 1)
    {
      obj.p1.x = mouse.x;
      obj.p1.y = mouse.y;
      var diffX = mouse.x - draggingPart.targetPoint_.x;
      var diffY = mouse.y - draggingPart.targetPoint_.y;
      draggingPart.targetPoint_.x = mouse.x
      draggingPart.targetPoint_.y = mouse.y
      for (var i in obj.controlPoints) {
        obj.controlPoints[i].newPoint.x += diffX;
        obj.controlPoints[i].newPoint.y += diffY;
        objTypes[objs[obj.controlPoints[i].targetObj_index].type].dragging(objs[obj.controlPoints[i].targetObj_index], JSON.parse(JSON.stringify(obj.controlPoints[i].newPoint)), JSON.parse(JSON.stringify(obj.controlPoints[i].mousePart)), false, false);
        obj.controlPoints[i].mousePart.targetPoint.x += diffX;
        obj.controlPoints[i].mousePart.targetPoint.y += diffY;
      }
    }
  },

};
