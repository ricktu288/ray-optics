// Mirrors -> Circular Arc
objTypes['arcmirror'] = {

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'arcmirror', p1: mouse};
  },

  //顯示屬性方塊 Show the property box
  p_box: function(obj, elem) {
    dichroicSettings(obj,elem);
  },

  //建立物件過程滑鼠按下 Mousedown when the obj is being constructed by the user
  c_mousedown: function(obj, mouse, ctrl, shift)
  {
    if (!obj.p2 && !obj.p3)
    {
      draw();
      obj.p2 = mouse;
      return;
    }
    if (obj.p2 && !obj.p3 && !mouseOnPoint_construct(mouse, obj.p1))
    {
      if (shift)
      {
        obj.p2 = snapToDirection(mouse, constructionPoint, [{x: 1, y: 0},{x: 0, y: 1},{x: 1, y: 1},{x: 1, y: -1}]);
      }
      else
      {
        obj.p2 = mouse;
      }
      draw();
      obj.p3 = mouse;
      return;
    }
  },
  //建立物件過程滑鼠移動 Mousemove when the obj is being constructed by the user
  c_mousemove: function(obj, mouse, ctrl, shift)
  {
    if (!obj.p3 && !mouseOnPoint_construct(mouse, obj.p1))
    {
      if (shift)
      {
        obj.p2 = snapToDirection(mouse, constructionPoint, [{x: 1, y: 0},{x: 0, y: 1},{x: 1, y: 1},{x: 1, y: -1}]);
      }
      else
      {
        obj.p2 = mouse;
      }

      obj.p1 = ctrl ? graphs.point(2 * constructionPoint.x - obj.p2.x, 2 * constructionPoint.y - obj.p2.y) : constructionPoint;

      draw();
      return;
    }
    if (obj.p3 && !mouseOnPoint_construct(mouse, obj.p2))
    {
      obj.p3 = mouse;
      draw();
      return;
    }
  },
  //建立物件過程滑鼠放開 Mouseup when the obj is being constructed by the user
  c_mouseup: function(obj, mouse, ctrl, shift)
  {
    if (obj.p2 && !obj.p3 && !mouseOnPoint_construct(mouse, obj.p1))
    {
      obj.p3 = mouse;
      return;
    }
    if (obj.p3 && !mouseOnPoint_construct(mouse, obj.p2))
    {
      obj.p3 = mouse;
      draw();
      isConstructing = false;
      return;
    }
  },

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas) {
    ctx.fillStyle = 'rgb(255,0,255)';
    if (obj.p3 && obj.p2)
    {
      var center = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(obj.p1, obj.p3)), graphs.perpendicular_bisector(graphs.line(obj.p2, obj.p3)));
      if (isFinite(center.x) && isFinite(center.y))
      {
        var r = graphs.length(center, obj.p3);
        var a1 = Math.atan2(obj.p1.y - center.y, obj.p1.x - center.x);
        var a2 = Math.atan2(obj.p2.y - center.y, obj.p2.x - center.x);
        var a3 = Math.atan2(obj.p3.y - center.y, obj.p3.x - center.x);
        ctx.strokeStyle = getMouseStyle(obj, (colorMode && obj.wavelength && obj.isDichroic) ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(168,168,168)');
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, a1, a2, (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2));
        ctx.stroke();
        if (obj == mouseObj) {
          ctx.fillRect(obj.p3.x - 1.5, obj.p3.y - 1.5, 3, 3);
          ctx.fillStyle = 'rgb(255,0,0)';
          ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
          ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
        }
      }
      else
      {
        //圓弧三點共線,當作線段處理 The three points on the arc is colinear. Treat as a line segment.
        ctx.strokeStyle = (colorMode && obj.wavelength && obj.isDichroic) ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(168,168,168)';
        ctx.beginPath();
        ctx.moveTo(obj.p1.x, obj.p1.y);
        ctx.lineTo(obj.p2.x, obj.p2.y);
        ctx.stroke();

        ctx.fillRect(obj.p3.x - 1.5, obj.p3.y - 1.5, 3, 3);
        ctx.fillStyle = 'rgb(255,0,0)';
        ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
        ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
      }
    }
    else if (obj.p2)
    {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
      ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
    }
    else
    {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
    }
  },

  //平移物件 Move the object
  move: function(obj, diffX, diffY) {
    //移動線段的第一點 Move the first point
    obj.p1.x = obj.p1.x + diffX;
    obj.p1.y = obj.p1.y + diffY;
    //移動線段的第二點 Move the second point
    obj.p2.x = obj.p2.x + diffX;
    obj.p2.y = obj.p2.y + diffY;

    obj.p3.x = obj.p3.x + diffX;
    obj.p3.y = obj.p3.y + diffY;
    return obj;
  },


  //繪圖區被按下時(判斷物件被按下的部分) When the drawing area is clicked (test which part of the obj is clicked)
  clicked: function(obj, mouse_nogrid, mouse, draggingPart) {
    if (mouseOnPoint(mouse_nogrid, obj.p1) && graphs.length_squared(mouse_nogrid, obj.p1) <= graphs.length_squared(mouse_nogrid, obj.p2) && graphs.length_squared(mouse_nogrid, obj.p1) <= graphs.length_squared(mouse_nogrid, obj.p3))
    {
      draggingPart.part = 1;
      draggingPart.targetPoint = graphs.point(obj.p1.x, obj.p1.y);
      return true;
    }
    if (mouseOnPoint(mouse_nogrid, obj.p2) && graphs.length_squared(mouse_nogrid, obj.p2) <= graphs.length_squared(mouse_nogrid, obj.p3))
    {
      draggingPart.part = 2;
      draggingPart.targetPoint = graphs.point(obj.p2.x, obj.p2.y);
      return true;
    }
    if (mouseOnPoint(mouse_nogrid, obj.p3))
    {
      draggingPart.part = 3;
      draggingPart.targetPoint = graphs.point(obj.p3.x, obj.p3.y);
      return true;
    }

    var center = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(obj.p1, obj.p3)), graphs.perpendicular_bisector(graphs.line(obj.p2, obj.p3)));
    if (isFinite(center.x) && isFinite(center.y))
    {
      var r = graphs.length(center, obj.p3);
      var a1 = Math.atan2(obj.p1.y - center.y, obj.p1.x - center.x);
      var a2 = Math.atan2(obj.p2.y - center.y, obj.p2.x - center.x);
      var a3 = Math.atan2(obj.p3.y - center.y, obj.p3.x - center.x);
      var a_m = Math.atan2(mouse_nogrid.y - center.y, mouse_nogrid.x - center.x);
      if (Math.abs(graphs.length(center, mouse_nogrid) - r) < clickExtent_line && (((a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2)) == ((a2 < a_m && a_m < a1) || (a1 < a2 && a2 < a_m) || (a_m < a1 && a1 < a2))))
      {
        //拖曳整個物件 Dragging the entire obj
        draggingPart.part = 0;
        draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置 Mouse position when the user starts dragging
        draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置 Mouse position at the last moment during dragging
        draggingPart.snapData = {};
        return true;
      }
    }
    else
    {
      //圓弧三點共線,當作線段處理 The three points on the arc is colinear. Treat as a line segment.
      if (mouseOnSegment(mouse_nogrid, obj))
      {
        draggingPart.part = 0;
        draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置 Mouse position when the user starts dragging
        draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置 Mouse position at the last moment during dragging
        draggingPart.snapData = {};
        return true;
      }
    }
    return false;
  },

  //拖曳物件時 When the user is dragging the obj
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    var basePoint;
    if (draggingPart.part == 1)
    {
      //正在拖曳第一個端點 Dragging the first endpoint
      basePoint = ctrl ? graphs.midpoint(draggingPart.originalObj) : draggingPart.originalObj.p2;

      obj.p1 = shift ? snapToDirection(mouse, basePoint, [{x: 1, y: 0},{x: 0, y: 1},{x: 1, y: 1},{x: 1, y: -1},{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)}]) : mouse;
      obj.p2 = ctrl ? graphs.point(2 * basePoint.x - obj.p1.x, 2 * basePoint.y - obj.p1.y) : basePoint;
    }
    if (draggingPart.part == 2)
    {
      //正在拖曳第二個端點 Dragging the second endpoint

      basePoint = ctrl ? graphs.midpoint(draggingPart.originalObj) : draggingPart.originalObj.p1;

      obj.p2 = shift ? snapToDirection(mouse, basePoint, [{x: 1, y: 0},{x: 0, y: 1},{x: 1, y: 1},{x: 1, y: -1},{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)}]) : mouse;
      obj.p1 = ctrl ? graphs.point(2 * basePoint.x - obj.p2.x, 2 * basePoint.y - obj.p2.y) : basePoint;
    }
    if (draggingPart.part == 3)
    {
      //正在拖曳弧形控制點 Dragging the control point of the arc
      obj.p3 = mouse;
    }

    if (draggingPart.part == 0)
    {
      //正在拖曳整個物件 Dragging the entire obj

      if (shift)
      {
        var mouse_snapped = snapToDirection(mouse, draggingPart.mouse0, [{x: 1, y: 0},{x: 0, y: 1},{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)},{x: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y), y: -(draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x)}], draggingPart.snapData);
      }
      else
      {
        var mouse_snapped = mouse;
        draggingPart.snapData = {}; //放開shift時解除原先之拖曳方向鎖定 Unlock the dragging direction when the user release the shift key
      }

      var mouseDiffX = draggingPart.mouse1.x - mouse_snapped.x; //目前滑鼠位置與上一次的滑鼠位置的X軸差 The X difference between the mouse position now and at the previous moment
      var mouseDiffY = draggingPart.mouse1.y - mouse_snapped.y; //目前滑鼠位置與上一次的滑鼠位置的Y軸差 The Y difference between the mouse position now and at the previous moment
      //移動線段的第一點 Move the first point
      obj.p1.x = obj.p1.x - mouseDiffX;
      obj.p1.y = obj.p1.y - mouseDiffY;
      //移動線段的第二點 Move the second point
      obj.p2.x = obj.p2.x - mouseDiffX;
      obj.p2.y = obj.p2.y - mouseDiffY;

      obj.p3.x = obj.p3.x - mouseDiffX;
      obj.p3.y = obj.p3.y - mouseDiffY;

      //更新滑鼠位置 Update the mouse position
      draggingPart.mouse1 = mouse_snapped;
    }
  },



  //判斷一道光是否會射到此物件(若是,則回傳交點) Test if a ray may shoot on this object (if yes, return the intersection)
  rayIntersection: function(mirror, ray) {
    if (!mirror.p3 || !wavelengthInteraction(mirror, ray)) {return;}
    var center = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(mirror.p1, mirror.p3)), graphs.perpendicular_bisector(graphs.line(mirror.p2, mirror.p3)));
    if (isFinite(center.x) && isFinite(center.y)) {

      var rp_temp = graphs.intersection_line_circle(graphs.line(ray.p1, ray.p2), graphs.circle(center, mirror.p2));
      var rp_exist = [];
      var rp_lensq = [];
      for (var i = 1; i <= 2; i++)
      {

        rp_exist[i] = !graphs.intersection_is_on_segment(graphs.intersection_2line(graphs.line(mirror.p1, mirror.p2), graphs.line(mirror.p3, rp_temp[i])), graphs.segment(mirror.p3, rp_temp[i])) && graphs.intersection_is_on_ray(rp_temp[i], ray) && graphs.length_squared(rp_temp[i], ray.p1) > minShotLength_squared;


        rp_lensq[i] = graphs.length_squared(ray.p1, rp_temp[i]);
      }


      if (rp_exist[1] && ((!rp_exist[2]) || rp_lensq[1] < rp_lensq[2])) {return rp_temp[1];}
      if (rp_exist[2] && ((!rp_exist[1]) || rp_lensq[2] < rp_lensq[1])) {return rp_temp[2];}
    }
    else
    {
      //圓弧三點共線,當作線段處理 The three points on the arc is colinear. Treat as a line segment.
      return objTypes['lineobj'].rayIntersection(mirror, ray);
    }
  },

  //當物件被光射到時 When the obj is shot by a ray
  shot: function(mirror, ray, rayIndex, rp) {
    var rx = ray.p1.x - rp.x;
    var ry = ray.p1.y - rp.y;
    var mx = mirror.p2.x - mirror.p1.x;
    var my = mirror.p2.y - mirror.p1.y;

    var center = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(mirror.p1, mirror.p3)), graphs.perpendicular_bisector(graphs.line(mirror.p2, mirror.p3)));
    if (isFinite(center.x) && isFinite(center.y)) {
      var cx = center.x - rp.x;
      var cy = center.y - rp.y;
      var c_sq = cx * cx + cy * cy;
      var r_dot_c = rx * cx + ry * cy;
      ray.p1 = rp;
      ray.p2 = graphs.point(rp.x - c_sq * rx + 2 * r_dot_c * cx, rp.y - c_sq * ry + 2 * r_dot_c * cy);
    }
    else
    {
      //圓弧三點共線,當作線段處理 The three points on the arc is colinear. Treat as a line segment.
      return objTypes['mirror'].shot(mirror, ray, rayIndex, rp);
    }
    
  }

};
