// Mirrors -> Parabolic
// Originally contributed by Paul Falstad (pfalstad)
objTypes['parabolicmirror'] = {

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'parabolicmirror', p1: mouse};
  },

  dichroicSettings: objTypes['mirror'].dichroicSettings,

  //顯示屬性方塊 Show the property box
  p_box: function(obj, elem) {
    dichroicSettings(obj,elem);
  },

  c_mousedown: objTypes['arcmirror'].c_mousedown,
  c_mousemove: objTypes['arcmirror'].c_mousemove,
  c_mouseup: objTypes['arcmirror'].c_mouseup,

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas) {
    ctx.fillStyle = 'rgb(255,0,255)';
    if (obj.p3 && obj.p2)
    {
      var p12d = graphs.length(obj.p1, obj.p2);
      // unit vector from p1 to p2
      var dir1 = [(obj.p2.x-obj.p1.x)/p12d, (obj.p2.y-obj.p1.y)/p12d];
      // perpendicular direction
      var dir2 = [dir1[1], -dir1[0]];
      // get height of (this section of) parabola
      var height = (obj.p3.x-obj.p1.x)*dir2[0]+(obj.p3.y-obj.p1.y)*dir2[1];
      // reposition p3 to be at vertex
      obj.p3.x = (obj.p1.x+obj.p2.x)*.5 + dir2[0]*height;
      obj.p3.y = (obj.p1.y+obj.p2.y)*.5 + dir2[1]*height;
      var x0 = p12d/2;
      var a = height/(x0*x0); // y=ax^2
      var i;
      ctx.strokeStyle = getMouseStyle(obj, (colorMode && obj.wavelength && obj.isDichroic) ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(168,168,168)');
      ctx.beginPath();
      obj.tmp_points = [graphs.point(obj.p1.x, obj.p1.y)];
      ctx.moveTo(obj.p1.x, obj.p1.y);
      for (i = 0.1; i < p12d; i+=0.1) {
        // avoid using exact integers to avoid problems with detecting intersections
        var ix = i+.001;
        var x = ix-x0;
        var y = height-a*x*x;
        var pt = graphs.point(obj.p1.x+dir1[0]*ix+dir2[0]*y, obj.p1.y+dir1[1]*ix+dir2[1]*y);
        ctx.lineTo(pt.x, pt.y);
        obj.tmp_points.push(pt);
      }
      ctx.stroke();
      if (obj == mouseObj) {
        ctx.fillRect(obj.p3.x - 1.5, obj.p3.y - 1.5, 3, 3);
        var focusx = (obj.p1.x+obj.p2.x)*.5 + dir2[0]*(height-1/(4*a));
        var focusy = (obj.p1.y+obj.p2.y)*.5 + dir2[1]*(height-1/(4*a));
        ctx.fillRect(focusx - 1.5, focusy - 1.5, 3, 3);
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

  move: objTypes['arcmirror'].move,

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

    if (!obj.tmp_points) return false;
    var i;
    var pts = obj.tmp_points;
    for (i = 0; i < pts.length-1; i++) {
      
      var seg = graphs.segment(pts[i], pts[i+1]);
      if (mouseOnSegment(mouse_nogrid, seg))
      {
        //拖曳整個物件 Dragging the entire obj
        draggingPart.part = 0;
        draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置 Mouse position when the user starts dragging
        draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置 Mouse position at the last moment during dragging
        draggingPart.snapData = {};
        return true;
      }
    }
    return false;
  },

  dragging: objTypes['arcmirror'].dragging,

  //判斷一道光是否會射到此物件(若是,則回傳交點) Test if a ray may shoot on this object (if yes, return the intersection)
  rayIntersection: function(obj, ray) {
    if (!obj.p3) {return;}
    return objTypes['curvedmirror'].rayIntersection(obj, ray);
  },

  //當物件被光射到時 When the obj is shot by a ray
  shot: function(obj, ray, rayIndex, rp) {
    return objTypes['curvedmirror'].shot(obj, ray, rayIndex, rp);
  }

};
