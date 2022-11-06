// Mirrors -> Custom equation
objTypes['curvedglass'] = {

  supportSurfaceMerging: true,

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'curvedglass', p1: mouse, p2: mouse, eqn1: "-\\sqrt{1-x^2}", eqn2: "\\sqrt{1-x^2}", p: 1.5};
  },

  //顯示屬性方塊 Show the property box
  p_box: function(obj, elem) {
    createEquationAttr('', obj.eqn1, function(obj, value) {
      obj.eqn1 = value;
    }, elem);
    createEquationAttr(' < y < ', obj.eqn2, function(obj, value) {
      obj.eqn2 = value;
    }, elem);
    objTypes['refractor'].p_box(obj, elem);
  },

  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas, aboveLight) {
    if (aboveLight && obj.tmp_glass) {
      objTypes['refractor'].draw(obj.tmp_glass, canvas, true);
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = getMouseStyle(obj, 'transparent');
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      return;
    }
    var fn;
    try {
      fns = [evaluateLatex(obj.eqn1), evaluateLatex(obj.eqn2)];
    } catch (e) {
      delete obj.tmp_glass;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.font = '12px serif';
      ctx.fillStyle = "gray"
      ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
      ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
      ctx.fillStyle = "red"
      ctx.fillText(e.toString(), obj.p1.x, obj.p1.y);
      return;
    }
    obj.tmp_glass = {path: [{x: obj.p1.x, y: obj.p1.y, arc: false}], p: obj.p, cauchyCoeff: (obj.cauchyCoeff || 0.004)};
    for (var side = 0; side <= 1; side++) {
      var p1 = (side == 0) ? obj.p1 : obj.p2;
      var p2 = (side == 0) ? obj.p2 : obj.p1;
      var p12d = graphs.length(p1, p2);
      // unit vector from p1 to p2
      var dir1 = [(p2.x-p1.x)/p12d, (p2.y-p1.y)/p12d];
      // perpendicular direction
      var dir2 = [dir1[1], -dir1[0]];
      // get height of (this section of) parabola
      var x0 = p12d/2;
      var i;
      var lastError = "";
      var hasPoints = false;
      for (i = 0.1; i < p12d; i+=0.1) {
        // avoid using exact integers to avoid problems with detecting intersections
        var ix = i + 0.05;
        var x = ix-x0;
        var scaled_x = 2*x/p12d;
        var scaled_y;
        try {
          scaled_y = ((side == 0) ? 1 : (-1)) * fns[side]({x: ((side == 0) ? scaled_x : (-scaled_x))});
          var y = scaled_y*p12d*0.5;
          var pt = graphs.point(p1.x+dir1[0]*ix+dir2[0]*y, p1.y+dir1[1]*ix+dir2[1]*y);
          pt.arc = false;
          obj.tmp_glass.path.push(pt);
          hasPoints = true;
        } catch (e) {
          lastError = e;
        }
      }
      if (!hasPoints) {
        delete obj.tmp_glass;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.font = '12px serif';
        ctx.fillStyle = "gray"
        ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
        ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
        ctx.fillStyle = "red"
        ctx.fillText(lastError.toString(), obj.p1.x, obj.p1.y);
        return;
      }
    }
    if (obj == mouseObj) {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
      ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
    }
    objTypes['refractor'].draw(obj.tmp_glass, canvas);
  },

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

    if (!obj.tmp_glass) return false;
    if (objTypes['refractor'].clicked(obj.tmp_glass, mouse_nogrid, mouse, {})) {
      //拖曳整個物件 Dragging the entire obj
      draggingPart.part = 0;
      draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置 Mouse position when the user starts dragging
      draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置 Mouse position at the last moment during dragging
      draggingPart.snapData = {};
      return true;
    }
    return false;
  },

  dragging: objTypes['lineobj'].dragging,

  //判斷一道光是否會射到此物件(若是,則回傳交點) Test if a ray may shoot on this object (if yes, return the intersection)
  rayIntersection: function(obj, ray) {
    if (!obj.tmp_glass) return;
    return objTypes['refractor'].rayIntersection(obj.tmp_glass, ray);
  },

  //當物件被光射到時 When the obj is shot by a ray
  shot: function(obj, ray, rayIndex, rp, surfaceMerging_objs) {
    objTypes['refractor'].shot(obj.tmp_glass, ray, rayIndex, rp, surfaceMerging_objs);
  },

  //判斷光線內部/外部射出 Test if the ray is shot from inside or outside
  getShotType: function(obj, ray) {
    return objTypes['refractor'].getShotType(obj.tmp_glass, ray);
  },

};
