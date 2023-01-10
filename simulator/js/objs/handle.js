// The handle created when holding ctrl and click several points
objTypes['handle'] = {

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'handle', controlPoints: [], notDone: true};
  },

  // Add control point when user is creating the handle
  c_addControlPoint: function(obj, controlPoint) {
    controlPoint.mousePart.originalObj = objs[controlPoint.targetObj_index];
    controlPoint.newPoint = controlPoint.mousePart.targetPoint;
    controlPoint.mousePart.byHandle = true;
    controlPoint = JSON.parse(JSON.stringify(controlPoint));
    objs[0].controlPoints.push(controlPoint);
  },

  // Finish creating the handle
  c_finishHandle: function(obj, point) {
    obj.p1 = point;
    var totalX = 0;
    var totalY = 0;
    for (var i in obj.controlPoints) {
      totalX += obj.controlPoints[i].newPoint.x;
      totalY += obj.controlPoints[i].newPoint.y;
    }
    obj.p2 = graphs.point(totalX / obj.controlPoints.length, totalY / obj.controlPoints.length);
    obj.notDone = false;
  },

  zIndex: function(obj) {
    return -Infinity;
  },

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas) {

    for (var i in obj.controlPoints) {
      // If user drags some target objs, restore them back to avoid unexpected behavior.
      obj.controlPoints[i].mousePart.originalObj = JSON.parse(JSON.stringify(objs[obj.controlPoints[i].targetObj_index]));
      objTypes[objs[obj.controlPoints[i].targetObj_index].type].dragging(objs[obj.controlPoints[i].targetObj_index], JSON.parse(JSON.stringify(obj.controlPoints[i].newPoint)), JSON.parse(JSON.stringify(obj.controlPoints[i].mousePart)), false, false);
    }
    for (var i in obj.controlPoints) {
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.strokeStyle = obj.notDone?'cyan':getMouseStyle(obj,'gray');
      ctx.setLineDash([2, 2]);
      ctx.arc(obj.controlPoints[i].newPoint.x, obj.controlPoints[i].newPoint.y, 5, 0, Math.PI * 2, false);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (!obj.notDone) {
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.strokeStyle = getMouseStyle(obj,'gray');
      ctx.arc(obj.p1.x, obj.p1.y, 2, 0, Math.PI * 2, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(obj.p1.x, obj.p1.y, 5, 0, Math.PI * 2, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(obj.p2.x - 5, obj.p2.y);
      ctx.lineTo(obj.p2.x + 5, obj.p2.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(obj.p2.x, obj.p2.y - 5);
      ctx.lineTo(obj.p2.x, obj.p2.y + 5);
      ctx.stroke();
    }
  },

  //平移物件 Move the object
  move: function(obj, diffX, diffY) {
    objTypes['handle'].dragging(obj, graphs.point(obj.p1.x + diffX, obj.p1.y + diffY), {targetPoint_: obj.p1, part: 1});
  },

  //繪圖區被按下時(判斷物件被按下的部分) When the drawing area is clicked (test which part of the obj is clicked)
  clicked: function(obj, mouse_nogrid, mouse, draggingPart) {
    if (obj.notDone) return;
    if (mouseOnPoint(mouse_nogrid, obj.p1))
    {
      draggingPart.part = 1;
      draggingPart.targetPoint_ = graphs.point(obj.p1.x, obj.p1.y);
      draggingPart.mouse0 = graphs.point(obj.p1.x, obj.p1.y);
      draggingPart.snapData = {};
      return true;
    }
    if (mouseOnPoint(mouse_nogrid, obj.p2))
    {
      draggingPart.part = 2;
      draggingPart.targetPoint = graphs.point(obj.p2.x, obj.p2.y);
      draggingPart.mouse0 = graphs.point(obj.p2.x, obj.p2.y);
      draggingPart.snapData = {};
      return true;
    }
    return false;
  },

  //拖曳物件時 When the user is dragging the obj
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    if (obj.notDone) return;
    if (shift)
    {
      var mouse_snapped = snapToDirection(mouse, draggingPart.mouse0, [{x: 1, y: 0},{x: 0, y: 1}], draggingPart.snapData);
    }
    else
    {
      var mouse_snapped = mouse;
      draggingPart.snapData = {}; //放開shift時解除原先之拖曳方向鎖定 Unlock the dragging direction when the user release the shift key
    }
    if (draggingPart.part == 1)
    {
      if (ctrl && shift) {
        // Scaling
        var factor = graphs.length(obj.p2, mouse) / graphs.length(obj.p2, draggingPart.targetPoint_)
        if (factor < 1e-5) return;
        var trans = function(p) {
          p.x = (p.x - obj.p2.x) * factor + obj.p2.x;
          p.y = (p.y - obj.p2.y) * factor + obj.p2.y;
        };
      } else if (ctrl) {
        // Rotation
        var theta = Math.atan2(obj.p2.y - mouse.y, obj.p2.x - mouse.x) - Math.atan2(obj.p2.y - draggingPart.targetPoint_.y, obj.p2.x - draggingPart.targetPoint_.x);
        var trans = function(p) {
          var x = p.x - obj.p2.x;
          var y = p.y - obj.p2.y;
          p.x = Math.cos(theta) * x - Math.sin(theta) * y + obj.p2.x;
          p.y = Math.sin(theta) * x + Math.cos(theta) * y + obj.p2.y;
        };
      } else {
        // Translation
        var diffX = mouse_snapped.x - draggingPart.targetPoint_.x;
        var diffY = mouse_snapped.y - draggingPart.targetPoint_.y;
        var trans = function(p) {
          p.x += diffX;
          p.y += diffY;
        };
      }

      // Do the transformation
      trans(obj.p1);
      trans(obj.p2);
      for (var i in obj.controlPoints) {
        obj.controlPoints[i].mousePart.originalObj = JSON.parse(JSON.stringify(objs[obj.controlPoints[i].targetObj_index]));
        trans(obj.controlPoints[i].newPoint);
        objTypes[objs[obj.controlPoints[i].targetObj_index].type].dragging(objs[obj.controlPoints[i].targetObj_index], JSON.parse(JSON.stringify(obj.controlPoints[i].newPoint)), JSON.parse(JSON.stringify(obj.controlPoints[i].mousePart)), false, false);
      }
      draggingPart.targetPoint_.x = obj.p1.x;
      draggingPart.targetPoint_.y = obj.p1.y;
    }
    
    if (draggingPart.part == 2)
    {
      obj.p2.x = mouse_snapped.x;
      obj.p2.y = mouse_snapped.y;
    }
  },

};
