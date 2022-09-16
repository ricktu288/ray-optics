// Glasses -> Half-plane
objTypes['halfplane'] = {

  supportSurfaceMerging: true,

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'halfplane', p1: mouse, p2: mouse, p: 1.5};
  },

  p_box: objTypes['refractor'].p_box,

  //使用lineobj原型 Use the prototype lineobj
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,

  //繪圖區被按下時(判斷物件被按下的部分) When the drawing area is clicked (test which part of the obj is clicked)
  clicked: function(obj, mouse_nogrid, mouse, draggingPart) {
    if (mouseOnPoint(mouse_nogrid, obj.p1) && graphs.length_squared(mouse_nogrid, obj.p1) <= graphs.length_squared(mouse_nogrid, obj.p2))
    {
      draggingPart.part = 1;
      draggingPart.targetPoint = graphs.point(obj.p1.x, obj.p1.y);
      return true;
    }
    if (mouseOnPoint(mouse_nogrid, obj.p2))
    {
      draggingPart.part = 2;
      draggingPart.targetPoint = graphs.point(obj.p2.x, obj.p2.y);
      return true;
    }
    if (mouseOnLine(mouse_nogrid, obj))
    {
      draggingPart.part = 0;
      draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置 Mouse position when the user starts dragging
      draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置 Mouse position at the last moment during dragging
      draggingPart.snapData = {};
      return true;
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
      obj.p2 = ctrl ? graphs.point(2 * basePoint.x - obj.p2.x, 2 * basePoint.y - obj.p2.y) : basePoint;
    }
    if (draggingPart.part == 2)
    {
      //正在拖曳第二個端點 Dragging the second endpoint

      basePoint = ctrl ? graphs.midpoint(draggingPart.originalObj) : draggingPart.originalObj.p1;

      obj.p2 = shift ? snapToDirection(mouse, basePoint, [{x: 1, y: 0},{x: 0, y: 1},{x: 1, y: 1},{x: 1, y: -1},{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)}]) : mouse;
      obj.p1 = ctrl ? graphs.point(2 * basePoint.x - obj.p2.x, 2 * basePoint.y - obj.p2.y) : basePoint;
    }
    if (draggingPart.part == 0)
    {
      //正在拖曳整條線 Dragging the entire line

      if (shift)
      {
        var mouse_snapped = snapToDirection(mouse, draggingPart.mouse0, [{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)},{x: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y), y: -(draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x)}], draggingPart.snapData);
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
      //更新滑鼠位置 Update the mouse position
      draggingPart.mouse1 = mouse_snapped;
    }
  },

  //判斷一道光是否會射到此物件(若是,則回傳交點) Test if a ray may shoot on this object (if yes, return the intersection)
  rayIntersection: function(obj, ray) {
    if (obj.p <= 0)return;
    var rp_temp = graphs.intersection_2line(graphs.line(ray.p1, ray.p2), graphs.line(obj.p1, obj.p2));

    if (graphs.intersection_is_on_ray(rp_temp, ray))
    {
      return rp_temp;
    }
  },

  zIndex: objTypes['refractor'].zIndex,

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas, aboveLight) {

  var len = Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));
  var par_x = (obj.p2.x - obj.p1.x) / len;
  var par_y = (obj.p2.y - obj.p1.y) / len;
  var per_x = par_y;
  var per_y = -par_x;

  var sufficientlyLargeDistance = (Math.abs(obj.p1.x + origin.x) + Math.abs(obj.p1.y + origin.y) + canvas.height + canvas.width) / Math.min(1, scale);

  ctx.beginPath();
  ctx.moveTo(obj.p1.x - par_x * sufficientlyLargeDistance, obj.p1.y - par_y * sufficientlyLargeDistance);
  ctx.lineTo(obj.p1.x + par_x * sufficientlyLargeDistance, obj.p1.y + par_y * sufficientlyLargeDistance);
  ctx.lineTo(obj.p1.x + (par_x - per_x) * sufficientlyLargeDistance, obj.p1.y + (par_y - per_y) * sufficientlyLargeDistance);
  ctx.lineTo(obj.p1.x - (par_x + per_x) * sufficientlyLargeDistance, obj.p1.y - (par_y + per_y) * sufficientlyLargeDistance);

  objTypes['refractor'].fillGlass(obj.p, obj, aboveLight);

  if (obj == mouseObj) {
    ctx.fillStyle = 'magenta';
    ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
    ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
  }


  },

  //當物件被光射到時 When the obj is shot by a ray
  shot: function(obj, ray, rayIndex, rp, surfaceMerging_objs) {
    var rdots = (ray.p2.x - ray.p1.x) * (obj.p2.x - obj.p1.x) + (ray.p2.y - ray.p1.y) * (obj.p2.y - obj.p1.y);
    var ssq = (obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y);
    var normal = {x: rdots * (obj.p2.x - obj.p1.x) - ssq * (ray.p2.x - ray.p1.x), y: rdots * (obj.p2.y - obj.p1.y) - ssq * (ray.p2.y - ray.p1.y)};

    var shotType = this.getShotType(obj, ray);
    if (shotType == 1)
    {
      //從內部射向外部 Shot from inside to outside
      var n1 = (!colorMode)?obj.p:(obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001)); //來源介質的折射率(目的介質假設為1) The refractive index of the source material (assuming the destination has 1)
    }
    else if (shotType == -1)
    {
      //從外部射向內部 Shot from outside to inside
      var n1 = 1 / ((!colorMode)?obj.p:(obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001)));
    }
    else
    {
      //可能導致Bug的狀況(如射到邊界點 Shot at an edge point)
      //為防止光線射向錯誤方向導致誤解,將光線吸收 To prevent shooting the ray to a wrong direction, absorb the ray
      ray.exist = false;
      return;
    }

    //界面融合 Surface merging
    //if(surfaceMerging_obj)
    for (var i = 0; i < surfaceMerging_objs.length; i++)
    {
      shotType = objTypes[surfaceMerging_objs[i].type].getShotType(surfaceMerging_objs[i], ray);
      if (shotType == 1)
      {
        //從內部射向外部 Shot from inside to outside
        n1 *= (!colorMode)?surfaceMerging_objs[i].p:(surfaceMerging_objs[i].p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001));
      }
      else if (shotType == -1)
      {
        //從外部射向內部 Shot from outside to inside
        n1 /= (!colorMode)?surfaceMerging_objs[i].p:(surfaceMerging_objs[i].p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001));
      }
      else if (shotType == 0)
      {
        //等同於沒射到 Equivalent to not shot on the obj(例如兩界面重合)
        //n1=n1;
      }
      else
      {
        //可能導致Bug的狀況(如射到邊界點 Shot at an edge point)
        //為防止光線射向錯誤方向導致誤解,將光線吸收 To prevent shooting the ray to a wrong direction, absorb the ray
        ray.exist = false;
        return;
      }
    }
    objTypes['refractor'].refract(ray, rayIndex, rp, normal, n1);


  },

  getShotType: function(obj, ray) {
    var rcrosss = (ray.p2.x - ray.p1.x) * (obj.p2.y - obj.p1.y) - (ray.p2.y - ray.p1.y) * (obj.p2.x - obj.p1.x);
    if (rcrosss > 0)
    {
      return 1; //由內向外 From inside to outside
    }
    if (rcrosss < 0)
    {
      return -1; //由外向內 From outside to inside
    }
    return 2;
  }

};
