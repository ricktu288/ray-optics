var graphs = {
  /**
  * 基本圖型
  **/
  point: function(x, y) {return {type: 1, x: x, y: y, exist: true}},

  line: function(p1, p2) {return {type: 2, p1: p1, p2: p2, exist: true}},

  ray: function(p1, p2) {return {type: 3, p1: p1, p2: p2, exist: true}},

  line_segment: function(p1, p2) {return {type: 4, p1: p1, p2: p2, exist: true}},

  segment: function(p1, p2) {return {type: 4, p1: p1, p2: p2, exist: true}},

  circle: function(c, r) {
    if (typeof r == 'object' && r.type == 1) {
      return {type: 5, c: c, r: this.line_segment(c, r), exist: true}
    } else {
      return {type: 5, c: c, r: r, exist: true}
    }
  },
  /**
  * inner product
  * @method dot
  * @param {graph.point} p1
  * @param {graph.point} p2
  * @return {Number}
  **/
  dot: function(p1, p2) {
    return p1.x * p2.x + p1.y * p2.y;
  },
  /**
  * outer product
  * @method cross
  * @param {graph.point} p1
  * @param {graph.point} p2
  * @return {Number}
  **/
  cross: function(p1, p2) {
    return p1.x * p2.y - p1.y * p2.x;
  },
  /**
  * 求交點
  * @method intersection
  * @param {graph} obj1
  * @param {graph} obj2
  * @return {graph.point}
  **/
  intersection: function(obj1, obj2) {
    // line & line
    if (obj1.type == 2 && obj2.type == 2) {
      return this.intersection_2line(obj1, obj2);
    }
    // line & circle
    else if (obj1.type == 2 && obj2.type == 5) {
      return this.intersection_line_circle(obj1, obj2);
    }
    // circle & line
    else if (obj1.type == 5 && obj2.type == 2) {
      return this.intersection_line_circle(obj2, obj1);
    }
  },
  /**
  * 兩直線交點
  * @method intersection_2line
  * @param {graph.line} l1
  * @param {graph.line} l2
  * @return {graph.point}
  **/
  intersection_2line: function(l1, l2) {
    var A = l1.p2.x * l1.p1.y - l1.p1.x * l1.p2.y;
    var B = l2.p2.x * l2.p1.y - l2.p1.x * l2.p2.y;
    var xa = l1.p2.x - l1.p1.x;
    var xb = l2.p2.x - l2.p1.x;
    var ya = l1.p2.y - l1.p1.y;
    var yb = l2.p2.y - l2.p1.y;
    return graphs.point((A * xb - B * xa) / (xa * yb - xb * ya), (A * yb - B * ya) / (xa * yb - xb * ya));
  },
  /**
  * 直線與圓的交點
  * @method intersection_2line
  * @param {graph.line} l1
  * @param {graph.circle} c2
  * @return {graph.point}
  **/
  intersection_line_circle: function(l1, c1) {
    var xa = l1.p2.x - l1.p1.x;
    var ya = l1.p2.y - l1.p1.y;
    var cx = c1.c.x;
    var cy = c1.c.y;
    var r_sq = (typeof c1.r == 'object') ? ((c1.r.p1.x - c1.r.p2.x) * (c1.r.p1.x - c1.r.p2.x) + (c1.r.p1.y - c1.r.p2.y) * (c1.r.p1.y - c1.r.p2.y)) : (c1.r * c1.r);

    var l = Math.sqrt(xa * xa + ya * ya);
    var ux = xa / l;
    var uy = ya / l;

    var cu = ((cx - l1.p1.x) * ux + (cy - l1.p1.y) * uy);
    var px = l1.p1.x + cu * ux;
    var py = l1.p1.y + cu * uy;


    var d = Math.sqrt(r_sq - (px - cx) * (px - cx) - (py - cy) * (py - cy));

    var ret = [];
    ret[1] = graphs.point(px + ux * d, py + uy * d);
    ret[2] = graphs.point(px - ux * d, py - uy * d);

    return ret;
  },


  intersection_is_on_ray: function(p1, r1) {
    return (p1.x - r1.p1.x) * (r1.p2.x - r1.p1.x) + (p1.y - r1.p1.y) * (r1.p2.y - r1.p1.y) >= 0;
  },


  intersection_is_on_segment: function(p1, s1) {
    return (p1.x - s1.p1.x) * (s1.p2.x - s1.p1.x) + (p1.y - s1.p1.y) * (s1.p2.y - s1.p1.y) >= 0 && (p1.x - s1.p2.x) * (s1.p1.x - s1.p2.x) + (p1.y - s1.p2.y) * (s1.p1.y - s1.p2.y) >= 0;
  },

  /**
  * 線段長度
  * @method length_segment
  * @param {graph.segment} seg
  * @return {Number}
  **/
  length_segment: function(seg) {
    return Math.sqrt(this.length_segment_squared(seg));
  },
  /**
  * 線段長度平方
  * @method length_segment_squared
  * @param {graph.segment} seg
  * @return {Number}
  **/
  length_segment_squared: function(seg) {
    return this.length_squared(seg.p1, seg.p2);
  },
  /**
  * 兩點距離
  * @method length
  * @param {graph.point} p1
  * @param {graph.point} p2
  * @return {Number}
  **/
  length: function(p1, p2) {
    return Math.sqrt(this.length_squared(p1, p2));
  },
  /**
  * 兩點距離平方
  * @method length_squared
  * @param {graph.point} p1
  * @param {graph.point} p2
  * @return {Number}
  **/
  length_squared: function(p1, p2) {
    var dx = p1.x - p2.x;
    var dy = p1.y - p2.y;
    return dx * dx + dy * dy;
  },

  /*
  * 基本作圖函數
  */
  /**
  * 線段中點
  * @method midpoint
  * @param {graph.line} l1
  * @return {graph.point}
  **/
  midpoint: function(l1) {
    var nx = (l1.p1.x + l1.p2.x) * 0.5;
    var ny = (l1.p1.y + l1.p2.y) * 0.5;
    return graphs.point(nx, ny);
  },

  midpoint_points: function(p1, p2) {
    var nx = (p1.x + p2.x) * 0.5;
    var ny = (p1.y + p2.y) * 0.5;
    return graphs.point(nx, ny);
  },
  /**
  * 線段中垂線
  * @method perpendicular_bisector
  * @param {graph.line} l1
  * @return {graph.line}
  **/
  perpendicular_bisector: function(l1) {
    return graphs.line(
        graphs.point(
          (-l1.p1.y + l1.p2.y + l1.p1.x + l1.p2.x) * 0.5,
          (l1.p1.x - l1.p2.x + l1.p1.y + l1.p2.y) * 0.5
        ),
        graphs.point(
          (l1.p1.y - l1.p2.y + l1.p1.x + l1.p2.x) * 0.5,
          (-l1.p1.x + l1.p2.x + l1.p1.y + l1.p2.y) * 0.5
        )
      );
  },
  /**
  * 畫通過一點且與一直線平行的線
  * @method parallel
  * @param {graph.line} l1
  * @param {graph.point} p1
  * @return {graph.line}
  **/
  parallel: function(l1, p1) {
    var dx = l1.p2.x - l1.p1.x;
    var dy = l1.p2.y - l1.p1.y;
    return graphs.line(p1, graphs.point(p1.x + dx, p1.y + dy));
  }
};

function getMouseStyle(obj, style, screen) {
  if (obj == mouseObj && mouseObj)
    return (screen && colorMode)?'rgb(0,100,100)':'rgb(0,255,255)'
  return style;
}

var canvasPainter = {
  draw: function(graph, color) {
    //var ctx = canvas.getContext('2d');
    // point
    if (graph.type == 1) {
      ctx.fillStyle = color ? color : 'red';
      ctx.fillRect(graph.x - 2, graph.y - 2, 5, 5); //繪製填滿的矩形
      /*
        ctx.beginPath();
        ctx.arc(graph.x,graph.y,2,0,Math.PI*2,false);
        ctx.fill();
      */
    }
    // line
    else if (graph.type == 2) {
      ctx.strokeStyle = color ? color : 'black';
      ctx.beginPath();
      var ang1 = Math.atan2((graph.p2.x - graph.p1.x), (graph.p2.y - graph.p1.y)); //從斜率取得角度
      var cvsLimit = (Math.abs(graph.p1.x + origin.x) + Math.abs(graph.p1.y + origin.y) + canvas.height + canvas.width) / Math.min(1, scale);  //取一個會超出繪圖區的距離(當做直線端點)
      ctx.moveTo(graph.p1.x - Math.sin(ang1) * cvsLimit, graph.p1.y - Math.cos(ang1) * cvsLimit);
      ctx.lineTo(graph.p1.x + Math.sin(ang1) * cvsLimit, graph.p1.y + Math.cos(ang1) * cvsLimit);
      ctx.stroke();
    }
    // ray
    else if (graph.type == 3) {
      ctx.strokeStyle = color ? color : 'black';
      var ang1, cvsLimit;
      if (Math.abs(graph.p2.x - graph.p1.x) > 1e-5 || Math.abs(graph.p2.y - graph.p1.y) > 1e-5)
      {
        ctx.beginPath();
        ang1 = Math.atan2((graph.p2.x - graph.p1.x), (graph.p2.y - graph.p1.y)); //從斜率取得角度
        cvsLimit = (Math.abs(graph.p1.x + origin.x) + Math.abs(graph.p1.y + origin.y) + canvas.height + canvas.width) / Math.min(1, scale);  //取一個會超出繪圖區的距離(當做直線端點)
        ctx.moveTo(graph.p1.x, graph.p1.y);
        ctx.lineTo(graph.p1.x + Math.sin(ang1) * cvsLimit, graph.p1.y + Math.cos(ang1) * cvsLimit);
        ctx.stroke();
      }
    }
    // (line_)segment
    else if (graph.type == 4) {
      ctx.strokeStyle = color ? color : 'black';
      ctx.beginPath();
      ctx.moveTo(graph.p1.x, graph.p1.y);
      ctx.lineTo(graph.p2.x, graph.p2.y);
      ctx.stroke();
    }
    // circle
    else if (graph.type == 5) {
      ctx.strokeStyle = color ? color : 'black';
      ctx.beginPath();
      if (typeof graph.r == 'object') {
        var dx = graph.r.p1.x - graph.r.p2.x;
        var dy = graph.r.p1.y - graph.r.p2.y;
        ctx.arc(graph.c.x, graph.c.y, Math.sqrt(dx * dx + dy * dy), 0, Math.PI * 2, false);
      } else {
        ctx.arc(graph.c.x, graph.c.y, graph.r, 0, Math.PI * 2, false);
      }
      ctx.stroke();
    }
  },
  cls: function() {
    //var ctx = canvas.getContext('2d');
    if (ctx.constructor != C2S) {
        //only do this when not being exported to SVG to avoid bug
        ctx.setTransform(1,0,0,1,0,0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(scale,0,0,scale,origin.x, origin.y);
        if (backgroundImage) {
            ctx.drawImage(backgroundImage,0,0);
        }
    } else if (!backgroundImage) {
        ctx.translate(origin.x / scale, origin.y / scale);
    }
  }
};

  var objTypes = {};

  //線段物件之原型
  objTypes['lineobj'] = {
  //==============================建立物件過程滑鼠按下=======================================
  c_mousedown: function(obj, mouse)
  {
    obj.p2 = mouse;
    if (!mouseOnPoint_construct(mouse, obj.p1))
    {
      draw();
    }
  },
  //==============================建立物件過程滑鼠移動=======================================
  c_mousemove: function(obj, mouse, ctrl, shift)
  {
    //var basePoint=ctrl?graphs.midpoint(obj):obj.p1;

    //if(!obj.p2

    if (shift)
    {
      //var sq3=Math.sqrt(3);
      //obj.p2=snapToDirection(mouse,constructionPoint,[{x:1,y:0},{x:0,y:1},{x:1,y:1},{x:1,y:-1},{x:1,y:sq3},{x:1,y:-sq3},{x:sq3,y:1},{x:sq3,y:-1}]);
      obj.p2 = snapToDirection(mouse, constructionPoint, [{x: 1, y: 0},{x: 0, y: 1},{x: 1, y: 1},{x: 1, y: -1}]);
    }
    else
    {
      obj.p2 = mouse;
    }

    obj.p1 = ctrl ? graphs.point(2 * constructionPoint.x - obj.p2.x, 2 * constructionPoint.y - obj.p2.y) : constructionPoint;

    if (!mouseOnPoint_construct(mouse, obj.p1))
    {
      draw();
    }

  },
  //==============================建立物件過程滑鼠放開=======================================
  c_mouseup: function(obj, mouse)
  {
    if (!mouseOnPoint_construct(mouse, obj.p1))
    {
      isConstructing = false;
    }
  },

  //=================================平移物件====================================
  move: function(obj, diffX, diffY) {
    //移動線段的第一點
    obj.p1.x = obj.p1.x + diffX;
    obj.p1.y = obj.p1.y + diffY;
    //移動線段的第二點
    obj.p2.x = obj.p2.x + diffX;
    obj.p2.y = obj.p2.y + diffY;
  },


  //==========================繪圖區被按下時(判斷物件被按下的部分)===========================
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
    if (mouseOnSegment(mouse_nogrid, obj))
    {
      draggingPart.part = 0;
      draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置
      draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置
      draggingPart.snapData = {};
      return true;
    }
    return false;
  },

  //=================================拖曳物件時====================================
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    var basePoint;
    if (draggingPart.part == 1)
    {
      //正在拖曳第一個端點
      //Dragging the first endpoint
      basePoint = ctrl ? graphs.midpoint(draggingPart.originalObj) : draggingPart.originalObj.p2;

      obj.p1 = shift ? snapToDirection(mouse, basePoint, [{x: 1, y: 0},{x: 0, y: 1},{x: 1, y: 1},{x: 1, y: -1},{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)}]) : mouse;
      obj.p2 = ctrl ? graphs.point(2 * basePoint.x - obj.p1.x, 2 * basePoint.y - obj.p1.y) : basePoint;

      //obj.p1=mouse;
    }
    if (draggingPart.part == 2)
    {
      //正在拖曳第二個端點
      //Dragging the second endpoint
      basePoint = ctrl ? graphs.midpoint(draggingPart.originalObj) : draggingPart.originalObj.p1;

      obj.p2 = shift ? snapToDirection(mouse, basePoint, [{x: 1, y: 0},{x: 0, y: 1},{x: 1, y: 1},{x: 1, y: -1},{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)}]) : mouse;
      obj.p1 = ctrl ? graphs.point(2 * basePoint.x - obj.p2.x, 2 * basePoint.y - obj.p2.y) : basePoint;

      //obj.p2=mouse;
    }
    if (draggingPart.part == 0)
    {
      //正在拖曳整條線
      //Dragging the entire line

      if (shift)
      {
        var mouse_snapped = snapToDirection(mouse, draggingPart.mouse0, [{x: 1, y: 0},{x: 0, y: 1},{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)},{x: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y), y: -(draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x)}], draggingPart.snapData);
      }
      else
      {
        var mouse_snapped = mouse;
        draggingPart.snapData = {}; //放開shift時解除原先之拖曳方向鎖定
      }

      var mouseDiffX = draggingPart.mouse1.x - mouse_snapped.x; //目前滑鼠位置與上一次的滑鼠位置的X軸差
      var mouseDiffY = draggingPart.mouse1.y - mouse_snapped.y; //目前滑鼠位置與上一次的滑鼠位置的Y軸差
      //移動線段的第一點
      obj.p1.x = obj.p1.x - mouseDiffX;
      obj.p1.y = obj.p1.y - mouseDiffY;
      //移動線段的第二點
      obj.p2.x = obj.p2.x - mouseDiffX;
      obj.p2.y = obj.p2.y - mouseDiffY;
      //更新滑鼠位置
      draggingPart.mouse1 = mouse_snapped;
    }
  },

  //====================判斷一道光是否會射到此物件(若是,則回傳交點)====================
  rayIntersection: function(obj, ray) {
    var rp_temp = graphs.intersection_2line(graphs.line(ray.p1, ray.p2), graphs.line(obj.p1, obj.p2));   //求光(的延長線)與物件(的延長線)的交點

    if (graphs.intersection_is_on_segment(rp_temp, obj) && graphs.intersection_is_on_ray(rp_temp, ray))
    {
      //↑若rp_temp在ray上且rp_temp在obj上(即ray真的有射到obj,不是ray的延長線射到或射到obj的延長線上)
      return rp_temp; //回傳光線的頭與鏡子的交點
    }
  }


  };

  //"refractor"物件
  objTypes['refractor'] = {

  supportSurfaceMerging: true, //支援界面融合
  //======================================建立物件=========================================
  create: function(mouse) {
    return {type: 'refractor', path: [{x: mouse.x, y: mouse.y, arc: false}], notDone: true, p: 1.5};
  },

  //===================================顯示屬性方塊=========================================
  p_box: function(obj, elem) {
    if (colorMode) {
      createNumberAttr(getMsg('cauchycoeff') + " A:", 1, 3, 0.01, obj.p, function(obj, value) {
        obj.p = value;
      }, elem);
      createNumberAttr("B(μm²):", 0.0001, 0.02, 0.0001, (obj.cauchyCoeff || 0.004), function(obj, value) {
        obj.cauchyCoeff = value;
      }, elem);
    } else {
      createNumberAttr(getMsg('refractiveindex'), 1, 3, 0.01, obj.p, function(obj, value) {
        obj.p = value;
      }, elem);
    }
  },

  //==============================建立物件過程滑鼠按下=======================================
  c_mousedown: function(obj, mouse)
  {
    if (obj.path.length > 1)
    {
      if (obj.path.length > 3 && mouseOnPoint(mouse, obj.path[0]))
      {
        //滑鼠按了第一點
        obj.path.length--;
        obj.notDone = false;
        draw();
        return;
      }
      obj.path[obj.path.length - 1] = {x: mouse.x, y: mouse.y}; //移動最後一點
      obj.path[obj.path.length - 1].arc = true;
    }
  },
  //==============================建立物件過程滑鼠移動=======================================
  c_mousemove: function(obj, mouse, ctrl, shift)
  {
    if (!obj.notDone) {return;}
    if (typeof obj.path[obj.path.length - 1].arc != 'undefined')
    {
      if (obj.path[obj.path.length - 1].arc && Math.sqrt(Math.pow(obj.path[obj.path.length - 1].x - mouse.x, 2) + Math.pow(obj.path[obj.path.length - 1].y - mouse.y, 2)) >= 5)
      {
        obj.path[obj.path.length] = mouse;
        draw();
      }
    }
    else
    {
      obj.path[obj.path.length - 1] = {x: mouse.x, y: mouse.y}; //移動最後一點
      draw();
    }
  },
  //==============================建立物件過程滑鼠放開=======================================
  c_mouseup: function(obj, mouse)
  {
    if (!obj.notDone) {
      isConstructing = false;
      draw();
      return;
    }
    if (obj.path.length > 3 && mouseOnPoint(mouse, obj.path[0]))
    {
      //滑鼠在第一點處放開
      obj.path.length--;
      obj.notDone = false;
      isConstructing = false;
      draw();
      return;
    }
    if (obj.path[obj.path.length - 2] && !obj.path[obj.path.length - 2].arc && mouseOnPoint_construct(mouse, obj.path[obj.path.length - 2]))
    {
      delete obj.path[obj.path.length - 1].arc;
    }
    else
    {
      obj.path[obj.path.length - 1] = {x: mouse.x, y: mouse.y}; //移動最後一點
      obj.path[obj.path.length - 1].arc = false;
      obj.path[obj.path.length] = {x: mouse.x, y: mouse.y}; //建立新的一點

    }
    draw();
  },
  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas, aboveLight) {

    //var ctx = canvas.getContext('2d');
    var p1;
    var p2;
    var p3;
    var center;
    var r;
    var a1;
    var a2;
    var a3;
    var acw;

    if (obj.notDone)
    {
      //使用者尚未畫完物件

      ctx.beginPath();
      ctx.moveTo(obj.path[0].x, obj.path[0].y);

      for (var i = 0; i < obj.path.length - 1; i++)
      {
        //ii=i%(obj.path.length);
        if (obj.path[(i + 1)].arc && !obj.path[i].arc && i < obj.path.length - 2)
        {
          p1 = graphs.point(obj.path[i].x, obj.path[i].y);
          p2 = graphs.point(obj.path[(i + 2)].x, obj.path[(i + 2)].y);
          p3 = graphs.point(obj.path[(i + 1)].x, obj.path[(i + 1)].y);
          center = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(p1, p3)), graphs.perpendicular_bisector(graphs.line(p2, p3)));
          if (isFinite(center.x) && isFinite(center.y))
          {
            r = graphs.length(center, p3);
            a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
            a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
            a3 = Math.atan2(p3.y - center.y, p3.x - center.x);
            acw = (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2); //p1->p3->p2之旋轉方向,逆時針為true

            ctx.arc(center.x, center.y, r, a1, a2, acw);
          }
          else
          {
            //圓弧三點共線,當作線段處理
            //arcInvalid=true;
            ctx.lineTo(obj.path[(i + 2)].x, obj.path[(i + 2)].y);
          }


        }
        else if (!obj.path[(i + 1)].arc && !obj.path[i].arc)
        {
          ctx.lineTo(obj.path[(i + 1)].x, obj.path[(i + 1)].y);
        }
      }
      //if(!arcInvalid)
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgb(128,128,128)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    else if (!aboveLight)
    {
      //物件已經畫完
      ctx.beginPath();
      ctx.moveTo(obj.path[0].x, obj.path[0].y);

      for (var i = 0; i < obj.path.length; i++)
      {
        //ii=i%(obj.path.length);
        if (obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc)
        {
          p1 = graphs.point(obj.path[i % obj.path.length].x, obj.path[i % obj.path.length].y);
          p2 = graphs.point(obj.path[(i + 2) % obj.path.length].x, obj.path[(i + 2) % obj.path.length].y);
          p3 = graphs.point(obj.path[(i + 1) % obj.path.length].x, obj.path[(i + 1) % obj.path.length].y);
          center = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(p1, p3)), graphs.perpendicular_bisector(graphs.line(p2, p3)));
          //console.log([center.x,center.y]);
          if (isFinite(center.x) && isFinite(center.y))
          {
            r = graphs.length(center, p3);
            a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
            a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
            a3 = Math.atan2(p3.y - center.y, p3.x - center.x);
            acw = (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2); //p1->p3->p2之旋轉方向,逆時針為true

            ctx.arc(center.x, center.y, r, a1, a2, acw);
          }
          else
          {
            //圓弧三點共線,當作線段處理
            ctx.lineTo(obj.path[(i + 2) % obj.path.length].x, obj.path[(i + 2) % obj.path.length].y);
          }

        }
        else if (!obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc)
        {
          ctx.lineTo(obj.path[(i + 1) % obj.path.length].x, obj.path[(i + 1) % obj.path.length].y);
        }
      }
      this.fillGlass(obj.p, obj);
    }
    ctx.lineWidth = 1;


    if (obj == mouseObj)
    {
      for (var i = 0; i < obj.path.length; i++)
      {
        if (typeof obj.path[i].arc != 'undefined')
        {
          if (obj.path[i].arc)
          {
            ctx.fillStyle = 'rgb(255,0,255)';
            //ctx.fillStyle="indigo";
            ctx.fillRect(obj.path[i].x - 2, obj.path[i].y - 2, 3, 3);
          }
          else
          {
            ctx.fillStyle = 'rgb(255,0,0)';
            ctx.fillRect(obj.path[i].x - 2, obj.path[i].y - 2, 3, 3);
          }
        }
      }
    }
  },

  fillGlass: function(n, obj)
  {
    if (n >= 1)
    {
      if (colorMode) {
        ctx.globalCompositeOperation = 'screen';
        var alpha = 1 - Math.exp(-(Math.log(n) / Math.log(1.5) * 0.2));
        ctx.fillStyle = getMouseStyle(obj, "rgb(" + (alpha * 100) + "%," + (alpha * 100) + "%," + (alpha * 100) + "%)", true);
        //ctx.globalAlpha = ;
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = getMouseStyle(obj, 'white');
        //ctx.fillStyle="rgb(128,128,128)";
        //ctx.globalAlpha=1-(1/n);
        ctx.globalAlpha = Math.log(n) / Math.log(1.5) * 0.2;
      }

      //ctx.globalAlpha=0.3;
      ctx.fill('evenodd');
      //ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

    }
    else
    {

      ctx.globalAlpha = 1;
      ctx.strokeStyle = getMouseStyle(obj, 'rgb(70,70,70)');
      ctx.lineWidth = 1;
      ctx.stroke();

    }

  },

  //=================================平移物件====================================
  move: function(obj, diffX, diffY) {
    for (var i = 0; i < obj.path.length; i++)
    {
      obj.path[i].x += diffX;
      obj.path[i].y += diffY;
    }
  },


  //==========================繪圖區被按下時(判斷物件被按下的部分)===========================
  clicked: function(obj, mouse_nogrid, mouse, draggingPart) {

    var p1;
    var p2;
    var p3;
    var center;
    var r;
    var a1;
    var a2;
    var a3;


    var click_lensq = Infinity;
    var click_lensq_temp;
    var targetPoint_index = -1;
    for (var i = 0; i < obj.path.length; i++)
    {
      if (mouseOnPoint(mouse_nogrid, obj.path[i]))
      {
        click_lensq_temp = graphs.length_squared(mouse_nogrid, obj.path[i]);
        if (click_lensq_temp <= click_lensq)
        {
          click_lensq = click_lensq_temp;
          targetPoint_index = i;
        }
      }
    }
    if (targetPoint_index != -1)
    {
      draggingPart.part = 1;
      draggingPart.index = targetPoint_index;
      draggingPart.targetPoint = graphs.point(obj.path[targetPoint_index].x, obj.path[targetPoint_index].y);
      return true;
    }

    for (var i = 0; i < obj.path.length; i++)
    {
      if (obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc)
      {
        p1 = graphs.point(obj.path[i % obj.path.length].x, obj.path[i % obj.path.length].y);
        p2 = graphs.point(obj.path[(i + 2) % obj.path.length].x, obj.path[(i + 2) % obj.path.length].y);
        p3 = graphs.point(obj.path[(i + 1) % obj.path.length].x, obj.path[(i + 1) % obj.path.length].y);
        center = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(p1, p3)), graphs.perpendicular_bisector(graphs.line(p2, p3)));
        if (isFinite(center.x) && isFinite(center.y))
        {
          r = graphs.length(center, p3);
          a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
          a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
          a3 = Math.atan2(p3.y - center.y, p3.x - center.x);
          var a_m = Math.atan2(mouse_nogrid.y - center.y, mouse_nogrid.x - center.x);
          if (Math.abs(graphs.length(center, mouse_nogrid) - r) < clickExtent_line && (((a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2)) == ((a2 < a_m && a_m < a1) || (a1 < a2 && a2 < a_m) || (a_m < a1 && a1 < a2))))
          {
            //拖曳整個物件
            draggingPart.part = 0;
            draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置
            draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置
            draggingPart.snapData = {};
            return true;
          }
        }
        else
        {
          //圓弧三點共線,當作線段處理
          if (mouseOnSegment(mouse_nogrid, graphs.segment(obj.path[(i) % obj.path.length], obj.path[(i + 2) % obj.path.length])))
          {
            //拖曳整個物件
            draggingPart.part = 0;
            draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置
            draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置
            draggingPart.snapData = {};
            return true;
          }
        }

      }
      else if (!obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc)
      {
        if (mouseOnSegment(mouse_nogrid, graphs.segment(obj.path[(i) % obj.path.length], obj.path[(i + 1) % obj.path.length])))
        {
          //拖曳整個物件
          draggingPart.part = 0;
          draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置
          draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置
          draggingPart.snapData = {};
          return true;
        }
      }
    }

  },

  //=================================拖曳物件時====================================
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    if (draggingPart.part == 1)
    {
      obj.path[draggingPart.index].x = mouse.x;
      obj.path[draggingPart.index].y = mouse.y;
    }

    if (draggingPart.part == 0)
    {
      if (shift)
      {
        var mouse_snapped = snapToDirection(mouse, draggingPart.mouse0, [{x: 1, y: 0},{x: 0, y: 1}], draggingPart.snapData);
      }
      else
      {
        var mouse_snapped = mouse;
        draggingPart.snapData = {}; //放開shift時解除原先之拖曳方向鎖定
      }
      this.move(obj, mouse_snapped.x - draggingPart.mouse1.x, mouse_snapped.y - draggingPart.mouse1.y);
      draggingPart.mouse1 = mouse_snapped;
    }
  },



  //====================判斷一道光是否會射到此物件(若是,則回傳交點)====================
  rayIntersection: function(obj, ray) {

    if (obj.notDone || obj.p <= 0)return;

    var s_lensq = Infinity;
    var s_lensq_temp;
    var s_point = null;
    var s_point_temp = null;
    //var a_rp;
    var rp_exist = [];
    var rp_lensq = [];
    var rp_temp;

    var p1;
    var p2;
    var p3;
    var center;
    var r;
    //var pathInvalid=false;

    for (var i = 0; i < obj.path.length; i++)
    {
      s_point_temp = null;
      if (obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc)
      {
        //圓弧i->i+1->i+2
        p1 = graphs.point(obj.path[i % obj.path.length].x, obj.path[i % obj.path.length].y);
        p2 = graphs.point(obj.path[(i + 2) % obj.path.length].x, obj.path[(i + 2) % obj.path.length].y);
        p3 = graphs.point(obj.path[(i + 1) % obj.path.length].x, obj.path[(i + 1) % obj.path.length].y);
        center = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(p1, p3)), graphs.perpendicular_bisector(graphs.line(p2, p3)));
        if (isFinite(center.x) && isFinite(center.y))
        {
          r = graphs.length(center, p3);
          rp_temp = graphs.intersection_line_circle(graphs.line(ray.p1, ray.p2), graphs.circle(center, p2));   //求光(的延長線)與鏡子的交點
          for (var ii = 1; ii <= 2; ii++)
          {
            rp_exist[ii] = !graphs.intersection_is_on_segment(graphs.intersection_2line(graphs.line(p1, p2), graphs.line(p3, rp_temp[ii])), graphs.segment(p3, rp_temp[ii])) && graphs.intersection_is_on_ray(rp_temp[ii], ray) && graphs.length_squared(rp_temp[ii], ray.p1) > minShotLength_squared;
            rp_lensq[ii] = graphs.length_squared(ray.p1, rp_temp[ii]); //光線射到第i交點的距離
          }
          if (rp_exist[1] && ((!rp_exist[2]) || rp_lensq[1] < rp_lensq[2]) && rp_lensq[1] > minShotLength_squared)
          {
            s_point_temp = rp_temp[1];
            s_lensq_temp = rp_lensq[1];
          }
          if (rp_exist[2] && ((!rp_exist[1]) || rp_lensq[2] < rp_lensq[1]) && rp_lensq[2] > minShotLength_squared)
          {
            s_point_temp = rp_temp[2];
            s_lensq_temp = rp_lensq[2];
          }
        }
        else
        {
          //圓弧三點共線,當作線段處理
          //線段i->i+2
          var rp_temp = graphs.intersection_2line(graphs.line(ray.p1, ray.p2), graphs.line(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length]));   //求光(的延長線)與物件(的延長線)的交點

          if (graphs.intersection_is_on_segment(rp_temp, graphs.segment(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length])) && graphs.intersection_is_on_ray(rp_temp, ray) && graphs.length_squared(ray.p1, rp_temp) > minShotLength_squared)
          {
            //↑若rp_temp在ray上且rp_temp在obj上(即ray真的有射到obj,不是ray的延長線射到或射到obj的延長線上)
            s_lensq_temp = graphs.length_squared(ray.p1, rp_temp); //交點到[光線的頭]的距離
            s_point_temp = rp_temp;
          }
        }
      }
      else if (!obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc)
      {
        //線段i->i+1
        var rp_temp = graphs.intersection_2line(graphs.line(ray.p1, ray.p2), graphs.line(obj.path[i % obj.path.length], obj.path[(i + 1) % obj.path.length]));   //求光(的延長線)與物件(的延長線)的交點

        if (graphs.intersection_is_on_segment(rp_temp, graphs.segment(obj.path[i % obj.path.length], obj.path[(i + 1) % obj.path.length])) && graphs.intersection_is_on_ray(rp_temp, ray) && graphs.length_squared(ray.p1, rp_temp) > minShotLength_squared)
        {
          //↑若rp_temp在ray上且rp_temp在obj上(即ray真的有射到obj,不是ray的延長線射到或射到obj的延長線上)
          s_lensq_temp = graphs.length_squared(ray.p1, rp_temp); //交點到[光線的頭]的距離
          s_point_temp = rp_temp;
        }
      }
      if (s_point_temp)
      {
        if (s_lensq_temp < s_lensq)
        {
          s_lensq = s_lensq_temp;
          s_point = s_point_temp;
        }
      }
    }
    if (s_point)
    {
      return s_point;
    }

  },

  //=============================當物件被光射到時================================
  shot: function(obj, ray, rayIndex, rp, surfaceMerging_objs) {

    if (obj.notDone) {return;}
    //var ctx = canvas.getContext('2d');
    //ctx.beginPath();
    //ctx.moveTo(obj.path[0].x,obj.path[0].y);
    var shotData = this.getShotData(obj, ray);
    var shotType = shotData.shotType;
    if (shotType == 1)
    {
      //從內部射向外部
      var n1 = (!colorMode)?obj.p:(obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001)); //來源介質的折射率(目的介質假設為1)
      //canvasPainter.draw(graphs.segment(ray.p1,s_point),canvas,"red");
    }
    else if (shotType == -1)
    {
      //從外部射向內部
      var n1 = 1 / ((!colorMode)?obj.p:(obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001)));
    }
    else if (shotType == 0)
    {
      //等同於沒射到(例如兩界面重合)
      var n1 = 1;
    }
    else
    {
      //可能導致Bug的狀況(如射到邊界點)
      //為防止光線射向錯誤方向導致誤解,將光線吸收
      ray.exist = false;
      return;
    }

    //界面融合
    for (var i = 0; i < surfaceMerging_objs.length; i++)
    {
      shotType = objTypes[surfaceMerging_objs[i].type].getShotType(surfaceMerging_objs[i], ray);
      if (shotType == 1)
      {
        //從內部射向外部
        n1 *= (!colorMode)?surfaceMerging_objs[i].p:(surfaceMerging_objs[i].p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001));
      }
      else if (shotType == -1)
      {
        //從外部射向內部
        n1 /= (!colorMode)?surfaceMerging_objs[i].p:(surfaceMerging_objs[i].p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001));
      }
      else if (shotType == 0)
      {
        //等同於沒射到(例如兩界面重合)
        //n1=n1;
      }
      else
      {
        //可能導致Bug的狀況(如射到邊界點)
        //為防止光線射向錯誤方向導致誤解,將光線吸收
        ray.exist = false;
        return;
      }
    }

    this.refract(ray, rayIndex, shotData.s_point, shotData.normal, n1);
  },

  //=========================判斷光線內部/外部射出==============================
  getShotType: function(obj, ray) {
    return this.getShotData(obj, ray).shotType;
  },


  getShotData: function(obj, ray) {
    //=========判斷光射到物件的何處==========
    var s_lensq = Infinity;
    var s_lensq_temp;
    var s_point = null;
    var s_point_temp = null;
    var s_point_index;

    var surfaceMultiplicity = 1; //界面重合次數

    var rp_on_ray = [];
    var rp_exist = [];
    var rp_lensq = [];
    var rp_temp;

    var rp2_exist = [];
    var rp2_lensq = [];
    var rp2_temp;

    var normal_x;
    var normal_x_temp;

    var normal_y;
    var normal_y_temp;

    var rdots;
    var ssq;

    var nearEdge = false;
    var nearEdge_temp = false;

    var p1;
    var p2;
    var p3;
    var center;
    var ray2 = graphs.ray(ray.p1, graphs.point(ray.p2.x + Math.random() * 1e-5, ray.p2.y + Math.random() * 1e-5)); //用來作為內外判斷的光線(測試光線)
    var ray_intersect_count = 0; //測試光線與物件的相交次數(奇數表示光線來自內部)

    for (var i = 0; i < obj.path.length; i++)
    {
      s_point_temp = null;
      nearEdge_temp = false;
      if (obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc)
      {
        //圓弧i->i+1->i+2
        p1 = graphs.point(obj.path[i % obj.path.length].x, obj.path[i % obj.path.length].y);
        p2 = graphs.point(obj.path[(i + 2) % obj.path.length].x, obj.path[(i + 2) % obj.path.length].y);
        p3 = graphs.point(obj.path[(i + 1) % obj.path.length].x, obj.path[(i + 1) % obj.path.length].y);
        center = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(p1, p3)), graphs.perpendicular_bisector(graphs.line(p2, p3)));
        if (isFinite(center.x) && isFinite(center.y))
        {
          rp_temp = graphs.intersection_line_circle(graphs.line(ray.p1, ray.p2), graphs.circle(center, p2));   //求光(的延長線)與鏡子的交點
          rp2_temp = graphs.intersection_line_circle(graphs.line(ray2.p1, ray2.p2), graphs.circle(center, p2));
          for (var ii = 1; ii <= 2; ii++)
          {


            rp_on_ray[ii] = graphs.intersection_is_on_ray(rp_temp[ii], ray);
            rp_exist[ii] = rp_on_ray[ii] && !graphs.intersection_is_on_segment(graphs.intersection_2line(graphs.line(p1, p2), graphs.line(p3, rp_temp[ii])), graphs.segment(p3, rp_temp[ii])) && graphs.length_squared(rp_temp[ii], ray.p1) > minShotLength_squared;
            rp_lensq[ii] = graphs.length_squared(ray.p1, rp_temp[ii]); //光線射到第i交點的距離

            rp2_exist[ii] = !graphs.intersection_is_on_segment(graphs.intersection_2line(graphs.line(p1, p2), graphs.line(p3, rp2_temp[ii])), graphs.segment(p3, rp2_temp[ii])) && graphs.intersection_is_on_ray(rp2_temp[ii], ray2) && graphs.length_squared(rp2_temp[ii], ray2.p1) > minShotLength_squared;
            rp2_lensq[ii] = graphs.length_squared(ray2.p1, rp2_temp[ii]);
          }

          if (rp_exist[1] && ((!rp_exist[2]) || rp_lensq[1] < rp_lensq[2]) && rp_lensq[1] > minShotLength_squared)
          {
            s_point_temp = rp_temp[1];
            s_lensq_temp = rp_lensq[1];
            if (rp_on_ray[2] && rp_lensq[1] < rp_lensq[2])
            {
              //光線由外向內(對於弧線本身)
              normal_x_temp = s_point_temp.x - center.x;
              normal_y_temp = s_point_temp.y - center.y;
            }
            else
            {
              normal_x_temp = center.x - s_point_temp.x;
              normal_y_temp = center.y - s_point_temp.y;
            }
          }
          if (rp_exist[2] && ((!rp_exist[1]) || rp_lensq[2] < rp_lensq[1]) && rp_lensq[2] > minShotLength_squared)
          {
            s_point_temp = rp_temp[2];
            s_lensq_temp = rp_lensq[2];
            if (rp_on_ray[1] && rp_lensq[2] < rp_lensq[1])
            {
              //光線由外向內(對於弧線本身)
              normal_x_temp = s_point_temp.x - center.x;
              normal_y_temp = s_point_temp.y - center.y;
            }
            else
            {
              normal_x_temp = center.x - s_point_temp.x;
              normal_y_temp = center.y - s_point_temp.y;
            }
          }
          if (rp2_exist[1] && rp2_lensq[1] > minShotLength_squared)
          {
            ray_intersect_count++;
            //canvasPainter.draw(ray2,canvas,"white");
          }
          if (rp2_exist[2] && rp2_lensq[2] > minShotLength_squared)
          {
            ray_intersect_count++;
          }

          //太靠近邊界的判斷
          if (s_point_temp && (graphs.length_squared(s_point_temp, p1) < minShotLength_squared || graphs.length_squared(s_point_temp, p2) < minShotLength_squared))
          {
            nearEdge_temp = true;
          }

        }
        else
        {
          //圓弧三點共線,當作線段處理
          //線段i->i+2
          rp_temp = graphs.intersection_2line(graphs.line(ray.p1, ray.p2), graphs.line(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length]));   //求光(的延長線)與物件(的延長線)的交點

          rp2_temp = graphs.intersection_2line(graphs.line(ray2.p1, ray2.p2), graphs.line(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length]));   //求光(的延長線)與物件(的延長線)的交點
          if (graphs.intersection_is_on_segment(rp_temp, graphs.segment(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length])) && graphs.intersection_is_on_ray(rp_temp, ray) && graphs.length_squared(ray.p1, rp_temp) > minShotLength_squared)
          {
            //↑若rp_temp在ray上且rp_temp在obj上(即ray真的有射到obj,不是ray的延長線射到或射到obj的延長線上)
            //ray_intersect_count++;
            s_lensq_temp = graphs.length_squared(ray.p1, rp_temp); //交點到[光線的頭]的距離
            s_point_temp = rp_temp;

            rdots = (ray.p2.x - ray.p1.x) * (obj.path[(i + 2) % obj.path.length].x - obj.path[i % obj.path.length].x) + (ray.p2.y - ray.p1.y) * (obj.path[(i + 2) % obj.path.length].y - obj.path[i % obj.path.length].y); //ray與此線段之內積
            ssq = (obj.path[(i + 2) % obj.path.length].x - obj.path[i % obj.path.length].x) * (obj.path[(i + 2) % obj.path.length].x - obj.path[i % obj.path.length].x) + (obj.path[(i + 2) % obj.path.length].y - obj.path[i % obj.path.length].y) * (obj.path[(i + 2) % obj.path.length].y - obj.path[i % obj.path.length].y); //此線段長度平方

            normal_x_temp = rdots * (obj.path[(i + 2) % obj.path.length].x - obj.path[i % obj.path.length].x) - ssq * (ray.p2.x - ray.p1.x);
            normal_y_temp = rdots * (obj.path[(i + 2) % obj.path.length].y - obj.path[i % obj.path.length].y) - ssq * (ray.p2.y - ray.p1.y);


          }

          if (graphs.intersection_is_on_segment(rp2_temp, graphs.segment(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length])) && graphs.intersection_is_on_ray(rp2_temp, ray2) && graphs.length_squared(ray2.p1, rp2_temp) > minShotLength_squared)
          {
            ray_intersect_count++;
          }

          //太靠近邊界的判斷
          if (s_point_temp && (graphs.length_squared(s_point_temp, obj.path[i % obj.path.length]) < minShotLength_squared || graphs.length_squared(s_point_temp, obj.path[(i + 2) % obj.path.length]) < minShotLength_squared))
          {
            nearEdge_temp = true;
          }
          //ctx.lineTo(obj.path[(i+2)%obj.path.length].x,obj.path[(i+2)%obj.path.length].y);
        }
      }
      else if (!obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc)
      {
        //線段i->i+1
        rp_temp = graphs.intersection_2line(graphs.line(ray.p1, ray.p2), graphs.line(obj.path[i % obj.path.length], obj.path[(i + 1) % obj.path.length]));   //求光(的延長線)與物件(的延長線)的交點

        rp2_temp = graphs.intersection_2line(graphs.line(ray2.p1, ray2.p2), graphs.line(obj.path[i % obj.path.length], obj.path[(i + 1) % obj.path.length]));   //求光(的延長線)與物件(的延長線)的交點
        if (graphs.intersection_is_on_segment(rp_temp, graphs.segment(obj.path[i % obj.path.length], obj.path[(i + 1) % obj.path.length])) && graphs.intersection_is_on_ray(rp_temp, ray) && graphs.length_squared(ray.p1, rp_temp) > minShotLength_squared)
        {
          //↑若rp_temp在ray上且rp_temp在obj上(即ray真的有射到obj,不是ray的延長線射到或射到obj的延長線上)
          //ray_intersect_count++;
          s_lensq_temp = graphs.length_squared(ray.p1, rp_temp); //交點到[光線的頭]的距離
          s_point_temp = rp_temp;

          rdots = (ray.p2.x - ray.p1.x) * (obj.path[(i + 1) % obj.path.length].x - obj.path[i % obj.path.length].x) + (ray.p2.y - ray.p1.y) * (obj.path[(i + 1) % obj.path.length].y - obj.path[i % obj.path.length].y); //ray與此線段之內積
          ssq = (obj.path[(i + 1) % obj.path.length].x - obj.path[i % obj.path.length].x) * (obj.path[(i + 1) % obj.path.length].x - obj.path[i % obj.path.length].x) + (obj.path[(i + 1) % obj.path.length].y - obj.path[i % obj.path.length].y) * (obj.path[(i + 1) % obj.path.length].y - obj.path[i % obj.path.length].y); //此線段長度平方

          normal_x_temp = rdots * (obj.path[(i + 1) % obj.path.length].x - obj.path[i % obj.path.length].x) - ssq * (ray.p2.x - ray.p1.x);
          normal_y_temp = rdots * (obj.path[(i + 1) % obj.path.length].y - obj.path[i % obj.path.length].y) - ssq * (ray.p2.y - ray.p1.y);


        }

        if (graphs.intersection_is_on_segment(rp2_temp, graphs.segment(obj.path[i % obj.path.length], obj.path[(i + 1) % obj.path.length])) && graphs.intersection_is_on_ray(rp2_temp, ray2) && graphs.length_squared(ray2.p1, rp2_temp) > minShotLength_squared)
        {
          ray_intersect_count++;
        }

        //太靠近邊界的判斷
        if (s_point_temp && (graphs.length_squared(s_point_temp, obj.path[i % obj.path.length]) < minShotLength_squared || graphs.length_squared(s_point_temp, obj.path[(i + 1) % obj.path.length]) < minShotLength_squared))
        {
          nearEdge_temp = true;
        }
      }
      if (s_point_temp)
      {
        if (s_point && graphs.length_squared(s_point_temp, s_point) < minShotLength_squared)
        {
          //自我界面融合
          surfaceMultiplicity++;
        }
        else if (s_lensq_temp < s_lensq)
        {
          s_lensq = s_lensq_temp;
          s_point = s_point_temp;
          s_point_index = i;
          normal_x = normal_x_temp;
          normal_y = normal_y_temp;
          nearEdge = nearEdge_temp;
          surfaceMultiplicity = 1;
        }
      }
    }


    if (nearEdge)
    {
      var shotType = 2; //射到邊界點
    }
    else if (surfaceMultiplicity % 2 == 0)
    {
      var shotType = 0; //等同於沒射到
    }
    else if (ray_intersect_count % 2 == 1)
    {
      var shotType = 1; //從內部射向外部
    }
    else
    {
      var shotType = -1; //從外部射向內部
    }

    return {s_point: s_point, normal: {x: normal_x, y: normal_y},shotType: shotType};
  },

  //=========================折射處理==============================
  refract: function(ray, rayIndex, s_point, normal, n1)
  {
    var normal_len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
    var normal_x = normal.x / normal_len;
    var normal_y = normal.y / normal_len;

    var ray_len = Math.sqrt((ray.p2.x - ray.p1.x) * (ray.p2.x - ray.p1.x) + (ray.p2.y - ray.p1.y) * (ray.p2.y - ray.p1.y));

    var ray_x = (ray.p2.x - ray.p1.x) / ray_len;
    var ray_y = (ray.p2.y - ray.p1.y) / ray_len;


    //參考http://en.wikipedia.org/wiki/Snell%27s_law#Vector_form

    var cos1 = -normal_x * ray_x - normal_y * ray_y;
    //console.log(cos1)
    var sq1 = 1 - n1 * n1 * (1 - cos1 * cos1);


    if (sq1 < 0)
    {
      //全反射
      //var a_out=a_n*2-a_r;
      ray.p1 = s_point;
      ray.p2 = graphs.point(s_point.x + ray_x + 2 * cos1 * normal_x, s_point.y + ray_y + 2 * cos1 * normal_y);


    }
    else
    {
      //折射
      var cos2 = Math.sqrt(sq1);

      var R_s = Math.pow((n1 * cos1 - cos2) / (n1 * cos1 + cos2), 2);
      var R_p = Math.pow((n1 * cos2 - cos1) / (n1 * cos2 + cos1), 2);
      //參考http://en.wikipedia.org/wiki/Fresnel_equations#Definitions_and_power_equations

      //處理反射光
      var ray2 = graphs.ray(s_point, graphs.point(s_point.x + ray_x + 2 * cos1 * normal_x, s_point.y + ray_y + 2 * cos1 * normal_y));
      ray2.brightness_s = ray.brightness_s * R_s;
      ray2.brightness_p = ray.brightness_p * R_p;
      ray2.wavelength = ray.wavelength;
      ray2.gap = ray.gap;
      if (ray2.brightness_s + ray2.brightness_p > 0.01)
      {
        //將反射光新增至等待區
        addRay(ray2);
      }
      else 
      {
        totalTruncation += ray2.brightness_s + ray2.brightness_p;
        if (!ray.gap)
        {
          var amp = Math.floor(0.01 / ray2.brightness_s + ray2.brightness_p) + 1;
          if (rayIndex % amp == 0)
          {
            ray2.brightness_s = ray2.brightness_s * amp;
            ray2.brightness_p = ray2.brightness_p * amp;
            addRay(ray2);
          }
        }
      }

      //處理折射光
      ray.p1 = s_point;
      ray.p2 = graphs.point(s_point.x + n1 * ray_x + (n1 * cos1 - cos2) * normal_x, s_point.y + n1 * ray_y + (n1 * cos1 - cos2) * normal_y);
      ray.brightness_s = ray.brightness_s * (1 - R_s);
      ray.brightness_p = ray.brightness_p * (1 - R_p);

    }
  }


  };

  //"halfplane"(半平面折射鏡)物件
  objTypes['halfplane'] = {

  supportSurfaceMerging: true, //支援界面融合

  //======================================建立物件=========================================
  create: function(mouse) {
    return {type: 'halfplane', p1: mouse, p2: mouse, p: 1.5};
  },

  p_box: objTypes['refractor'].p_box,

  //使用lineobj原型
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,

  //==========================繪圖區被按下時(判斷物件被按下的部分)===========================
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
      draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置
      draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置
      draggingPart.snapData = {};
      return true;
    }
    return false;
  },

  //=================================拖曳物件時====================================
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    var basePoint;
    if (draggingPart.part == 1)
    {
      //正在拖曳第一個端點
      basePoint = ctrl ? graphs.midpoint(draggingPart.originalObj) : draggingPart.originalObj.p2;

      obj.p1 = shift ? snapToDirection(mouse, basePoint, [{x: 1, y: 0},{x: 0, y: 1},{x: 1, y: 1},{x: 1, y: -1},{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)}]) : mouse;
      obj.p2 = ctrl ? graphs.point(2 * basePoint.x - obj.p2.x, 2 * basePoint.y - obj.p2.y) : basePoint;

      //obj.p1=mouse;
    }
    if (draggingPart.part == 2)
    {
      //正在拖曳第二個端點

      basePoint = ctrl ? graphs.midpoint(draggingPart.originalObj) : draggingPart.originalObj.p1;

      obj.p2 = shift ? snapToDirection(mouse, basePoint, [{x: 1, y: 0},{x: 0, y: 1},{x: 1, y: 1},{x: 1, y: -1},{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)}]) : mouse;
      obj.p1 = ctrl ? graphs.point(2 * basePoint.x - obj.p2.x, 2 * basePoint.y - obj.p2.y) : basePoint;

      //obj.p2=mouse;
    }
    if (draggingPart.part == 0)
    {
      //正在拖曳整條線

      if (shift)
      {
        var mouse_snapped = snapToDirection(mouse, draggingPart.mouse0, [{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)},{x: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y), y: -(draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x)}], draggingPart.snapData);
      }
      else
      {
        var mouse_snapped = mouse;
        draggingPart.snapData = {}; //放開shift時解除原先之拖曳方向鎖定
      }

      var mouseDiffX = draggingPart.mouse1.x - mouse_snapped.x; //目前滑鼠位置與上一次的滑鼠位置的X軸差
      var mouseDiffY = draggingPart.mouse1.y - mouse_snapped.y; //目前滑鼠位置與上一次的滑鼠位置的Y軸差
      //移動線段的第一點
      obj.p1.x = obj.p1.x - mouseDiffX;
      obj.p1.y = obj.p1.y - mouseDiffY;
      //移動線段的第二點
      obj.p2.x = obj.p2.x - mouseDiffX;
      obj.p2.y = obj.p2.y - mouseDiffY;
      //更新滑鼠位置
      draggingPart.mouse1 = mouse_snapped;
    }
  },

  //====================判斷一道光是否會射到此物件(若是,則回傳交點)====================
  rayIntersection: function(obj, ray) {
    if (obj.p <= 0)return;
    var rp_temp = graphs.intersection_2line(graphs.line(ray.p1, ray.p2), graphs.line(obj.p1, obj.p2));   //求光(的延長線)與物件的交點

    if (graphs.intersection_is_on_ray(rp_temp, ray))
    {
      //↑若rp_temp在ray上(即ray真的有射到obj,不是ray的延長線射到)
      return rp_temp; //回傳光線的頭與鏡子的交點
    }
  },


  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas, aboveLight) {

  if (!aboveLight)
  {
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

    objTypes['refractor'].fillGlass(obj.p, obj);
  }

  ctx.fillStyle = 'indigo';
  ctx.fillRect(obj.p1.x - 2, obj.p1.y - 2, 3, 3);
  ctx.fillRect(obj.p2.x - 2, obj.p2.y - 2, 3, 3);


  },

  //=============================當物件被光射到時================================
  shot: function(obj, ray, rayIndex, rp, surfaceMerging_objs) {
    //ray.exist=false;

    var rdots = (ray.p2.x - ray.p1.x) * (obj.p2.x - obj.p1.x) + (ray.p2.y - ray.p1.y) * (obj.p2.y - obj.p1.y); //ray與此線段之內積
    var ssq = (obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y); //此線段長度平方
    var normal = {x: rdots * (obj.p2.x - obj.p1.x) - ssq * (ray.p2.x - ray.p1.x), y: rdots * (obj.p2.y - obj.p1.y) - ssq * (ray.p2.y - ray.p1.y)};
    //normal.x=rdots*(obj.p2.x-obj.p1.x)-ssq*(ray.p2.x-ray.p1.x);
    //normal.y=rdots*(obj.p2.y-obj.p1.y)-ssq*(ray.p2.y-ray.p1.y);

    var shotType = this.getShotType(obj, ray);
    if (shotType == 1)
    {
      //從內部射向外部
      var n1 = (!colorMode)?obj.p:(obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001)); //來源介質的折射率(目的介質假設為1)
      //canvasPainter.draw(graphs.segment(ray.p1,s_point),canvas,"red");
    }
    else if (shotType == -1)
    {
      //從外部射向內部
      var n1 = 1 / ((!colorMode)?obj.p:(obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001)));
    }
    else
    {
      //可能導致Bug的狀況(如射到邊界點)
      //為防止光線射向錯誤方向導致誤解,將光線吸收
      ray.exist = false;
      return;
    }

    //界面融合
    //if(surfaceMerging_obj)
    for (var i = 0; i < surfaceMerging_objs.length; i++)
    {
      shotType = objTypes[surfaceMerging_objs[i].type].getShotType(surfaceMerging_objs[i], ray);
      if (shotType == 1)
      {
        //從內部射向外部
        n1 *= (!colorMode)?surfaceMerging_objs[i].p:(surfaceMerging_objs[i].p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001));
      }
      else if (shotType == -1)
      {
        //從外部射向內部
        n1 /= (!colorMode)?surfaceMerging_objs[i].p:(surfaceMerging_objs[i].p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001));
      }
      else if (shotType == 0)
      {
        //等同於沒射到(例如兩界面重合)
        //n1=n1;
      }
      else
      {
        //可能導致Bug的狀況(如射到邊界點)
        //為防止光線射向錯誤方向導致誤解,將光線吸收
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
      return 1; //由內向外
    }
    if (rcrosss < 0)
    {
      return -1; //由外向內
    }
    return 2;
  }

  };

  //"circlelens"物件
  objTypes['circlelens'] = {

  supportSurfaceMerging: true, //支援界面融合

  //======================================建立物件=========================================
  create: function(mouse) {
    return {type: 'circlelens', p1: mouse, p2: mouse, p: 1.5};
  },

  p_box: objTypes['refractor'].p_box,

  //使用lineobj原型
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: function(obj, mouse, ctrl, shift) {objTypes['lineobj'].c_mousemove(obj, mouse, false, shift)},
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,

  //==========================繪圖區被按下時(判斷物件被按下的部分)===========================
  // When the drawing area is pressed (to determine the part of the object being pressed)
  clicked: function(obj, mouse_nogrid, mouse, draggingPart) {
    // clicking on p1 (center)?
    if (mouseOnPoint(mouse_nogrid, obj.p1) && graphs.length_squared(mouse_nogrid, obj.p1) <= graphs.length_squared(mouse_nogrid, obj.p2))
    {
      draggingPart.part = 1;
      draggingPart.targetPoint = graphs.point(obj.p1.x, obj.p1.y);
      return true;
    }
    // clicking on p2 (edge)?
    if (mouseOnPoint(mouse_nogrid, obj.p2))
    {
      draggingPart.part = 2;
      draggingPart.targetPoint = graphs.point(obj.p2.x, obj.p2.y);
      return true;
    }
    // clicking on outer edge of circle?  then drag entire circle
    //if (Math.abs(graphs.length(obj.p1, mouse_nogrid) - graphs.length_segment(obj)) < clickExtent_line)
    // clicking inside circle?  then drag entire circle
    if (Math.abs(graphs.length(obj.p1, mouse_nogrid) < graphs.length_segment(obj)))
    {
      draggingPart.part = 0;
      draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置
      draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置
      draggingPart.snapData = {};
      return true;
    }
    return false;
  },

  //=================================拖曳物件時====================================
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {objTypes['lineobj'].dragging(obj, mouse, draggingPart, false, shift)},

  //====================判斷一道光是否會射到此物件(若是,則回傳交點)====================
  rayIntersection: function(obj, ray) {
    if (obj.p <= 0)return;
    var rp_temp = graphs.intersection_line_circle(graphs.line(ray.p1, ray.p2), graphs.circle(obj.p1, obj.p2));   //求光(的延長線)與鏡子的交點
    var rp_exist = [];
    var rp_lensq = [];
    for (var i = 1; i <= 2; i++)
    {

      rp_exist[i] = graphs.intersection_is_on_ray(rp_temp[i], ray) && graphs.length_squared(rp_temp[i], ray.p1) > minShotLength_squared;


      rp_lensq[i] = graphs.length_squared(ray.p1, rp_temp[i]); //光線射到第i交點的距離
    }


    if (rp_exist[1] && ((!rp_exist[2]) || rp_lensq[1] < rp_lensq[2])) {return rp_temp[1];}
    if (rp_exist[2] && ((!rp_exist[1]) || rp_lensq[2] < rp_lensq[1])) {return rp_temp[2];}
  },


  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas, aboveLight) {

  if (!aboveLight)
  {
    ctx.beginPath();
    ctx.arc(obj.p1.x, obj.p1.y, graphs.length_segment(obj), 0, Math.PI * 2, false);
    objTypes['refractor'].fillGlass(obj.p, obj);
  }
  ctx.lineWidth = 1;
  //ctx.fillStyle="indigo";
  ctx.fillStyle = 'red';
  ctx.fillRect(obj.p1.x - 2, obj.p1.y - 2, 3, 3);
  //ctx.fillStyle="rgb(255,0,255)";
  ctx.fillStyle = 'indigo';
  //ctx.fillStyle="Purple";
  ctx.fillRect(obj.p2.x - 2, obj.p2.y - 2, 3, 3);


  },

  //=============================當物件被光射到時================================
  shot: function(obj, ray, rayIndex, rp, surfaceMerging_objs) {

    var midpoint = graphs.midpoint(graphs.line_segment(ray.p1, rp));
    var d = graphs.length_squared(obj.p1, obj.p2) - graphs.length_squared(obj.p1, midpoint);
    if (d > 0)
    {
      //從內部射向外部
      var n1 = (!colorMode)?obj.p:(obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001)); //來源介質的折射率(目的介質假設為1)
      //var normal={x:rp.x-obj.p1.x,y:rp.y-obj.p1.y};
      var normal = {x: obj.p1.x - rp.x, y: obj.p1.y - rp.y};
    }
    else if (d < 0)
    {
      //從外部射向內部
      var n1 = 1 / ((!colorMode)?obj.p:(obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001)));
      var normal = {x: rp.x - obj.p1.x, y: rp.y - obj.p1.y};
      //var normal={x:obj.p1.x-rp.x,y:obj.p1.y-rp.y};
    }
    else
    {
      //可能導致Bug的狀況(如射到邊界點)
      //為防止光線射向錯誤方向導致誤解,將光線吸收
      ray.exist = false;
      return;
    }
    //console.log(n1);

    var shotType;

    //界面融合
    //if(surfaceMerging_obj)
    for (var i = 0; i < surfaceMerging_objs.length; i++)
    {
      shotType = objTypes[surfaceMerging_objs[i].type].getShotType(surfaceMerging_objs[i], ray);
      if (shotType == 1)
      {
        //從內部射向外部
        n1 *= (!colorMode)?surfaceMerging_objs[i].p:(surfaceMerging_objs[i].p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001));
      }
      else if (shotType == -1)
      {
        //從外部射向內部
        n1 /= (!colorMode)?surfaceMerging_objs[i].p:(surfaceMerging_objs[i].p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001));
      }
      else if (shotType == 0)
      {
        //等同於沒射到(例如兩界面重合)
        //n1=n1;
      }
      else
      {
        //可能導致Bug的狀況(如射到邊界點)
        //為防止光線射向錯誤方向導致誤解,將光線吸收
        ray.exist = false;
        return;
      }
    }
    objTypes['refractor'].refract(ray, rayIndex, rp, normal, n1);


  },

  getShotType: function(obj, ray) {

    var midpoint = graphs.midpoint(graphs.line_segment(ray.p1, this.rayIntersection(obj, ray)));
    var d = graphs.length_squared(obj.p1, obj.p2) - graphs.length_squared(obj.p1, midpoint);

    if (d > 0)
    {
      return 1; //由內向外
    }
    if (d < 0)
    {
      return -1; //由外向內
    }
    return 2;
  }

  };


  //"laser"物件
  objTypes['laser'] = {

  //======================================建立物件=========================================
  create: function(mouse) {
    return {type: 'laser', p1: mouse, p2: mouse, p: 1};
  },

  //使用lineobj原型
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,

  //===================================顯示屬性方塊=========================================
  p_box: function(obj, elem) {
    createNumberAttr(getMsg('brightness'), 0, 1, 0.01, obj.p || 1, function(obj, value) {
      obj.p = value;
    }, elem);
    if (colorMode) {
      createNumberAttr(getMsg('wavelength'), 400, 700, 1, obj.wavelength || 532, function(obj, value) {
        obj.wavelength = value;
      }, elem);
    }
  },

  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas) {
  //var ctx = canvas.getContext('2d');
  ctx.fillStyle = getMouseStyle(obj, 'rgb(255,0,0)');
  ctx.fillRect(obj.p1.x - 2, obj.p1.y - 2, 5, 5);
  ctx.fillRect(obj.p2.x - 2, obj.p2.y - 2, 3, 3);
  },


  //=================================射出光線=============================================
  shoot: function(obj) {
  var ray1 = graphs.ray(obj.p1, obj.p2);
  ray1.brightness_s = 0.5 * (obj.p || 1);
  ray1.brightness_p = 0.5 * (obj.p || 1);
  if (colorMode) {
    ray1.wavelength = obj.wavelength || 532;
  }
  ray1.gap = true;
  ray1.isNew = true;
  addRay(ray1);
  }




  };

  //"led"物件
  objTypes['led'] = {
  
  //======================================建立物件=========================================
  create: function(mouse) {
    return {type: 'led', p1: mouse, p2: mouse, p : 30, symmetric : true};
  },

  //===================================顯示屬性方塊=========================================
  p_box: function(obj, elem) {
    createNumberAttr(getMsg('brightness'), 0, 1, 0.01, obj.brightness || 0.5, function(obj, value) {
      obj.brightness = value;
    }, elem);
    if (colorMode) {
      createNumberAttr(getMsg('wavelength'), 380, 750, 1, obj.wavelength || 532, function(obj, value) {
        obj.wavelength = value;
      }, elem);
    }
    createNumberAttr(getMsg('emissionangle'), 0, 180, 1, obj.p, function(obj, value) {
      obj.p = value;
    }, elem);
    createBooleanAttr(getMsg('symmetric'), obj.symmetric, function(obj, value) {
      obj.symmetric = value;
    }, elem);
  },

  //使用lineobj原型
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,

  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas) {
  //var ctx = canvas.getContext('2d');
  if (colorMode) {
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = wavelengthToColor(obj.wavelength || 532, 1);
    ctx.fillRect(obj.p1.x - 2, obj.p1.y - 2, 5, 5);
    ctx.fillStyle = getMouseStyle(obj, 'rgb(255,255,255)');
    ctx.fillRect(obj.p1.x - 1, obj.p1.y - 1, 3, 3);
    ctx.globalCompositeOperation = "source-over";
  } else {
    ctx.fillStyle = getMouseStyle(obj, 'rgb(0,255,0)');
    ctx.fillRect(obj.p1.x - 2, obj.p1.y - 2, 5, 5);
  }
  ctx.fillStyle = getMouseStyle(obj, 'rgb(255,0,0)');
  ctx.fillRect(obj.p2.x - 2, obj.p2.y - 2, 3, 3);
  },


  //=================================射出光線=============================================
  shoot: function(obj) {
  var s = Math.PI * 2 / parseInt(getRayDensity() * 500);
  var i0 = (mode == 'observer') ? (-s * 2 + 1e-6) : 0;
  
  var ang, x1, y1, iStart, iEnd;
  if (obj.symmetric) {
    iStart = (i0 - (Math.PI / 180.0 * obj.p) / 2.0);
    iEnd = (i0 + (Math.PI / 180.0 * obj.p) / 2.0 - 1e-5);
  } else {
    iStart = i0;
    iEnd = (i0 + (Math.PI / 180.0 * obj.p) - 1e-5);
  }
  for (var i = iStart; i < iEnd; i = i + s)
  {
	var r = Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));	
	
	ang = i + Math.atan2(obj.p2.y - obj.p1.y, obj.p2.x - obj.p1.x);

	x1 = obj.p1.x + r * Math.cos(ang);
	y1 = obj.p1.y + r * Math.sin(ang);
	
    var ray1 = graphs.ray(graphs.point(obj.p1.x, obj.p1.y), graphs.point(x1, y1));
	
    ray1.brightness_s = Math.min((obj.brightness || 0.5) / getRayDensity(), 1) * 0.5;
    ray1.brightness_p = Math.min((obj.brightness || 0.5) / getRayDensity(), 1) * 0.5;
    if (colorMode) {
      ray1.wavelength = obj.wavelength || 532;
    }
    ray1.isNew = true;
    if (i == i0)
    {
      ray1.gap = true;
    }
    addRay(ray1);
  }
  }




  };

  //"mirror"(鏡子)物件
  objTypes['mirror'] = {

  //======================================建立物件=========================================
  create: function(mouse) {
    return {type: 'mirror', p1: mouse, p2: mouse};
  },

  //使用lineobj原型
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,
  rayIntersection: objTypes['lineobj'].rayIntersection,

  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas) {
    //ctx.lineWidth=1.5;
    ctx.strokeStyle = getMouseStyle(obj, 'rgb(168,168,168)');
    ctx.beginPath();
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p2.x, obj.p2.y);
    ctx.stroke();
    //ctx.lineWidth=1;
  },



  //=============================當物件被光射到時================================
  shot: function(mirror, ray, rayIndex, rp) {
    //此時代表光一定有射到鏡子,只需找到交點,不需判斷是否真的射到
    var rx = ray.p1.x - rp.x;
    var ry = ray.p1.y - rp.y;
    var mx = mirror.p2.x - mirror.p1.x;
    var my = mirror.p2.y - mirror.p1.y;
    ray.p1 = rp;
    ray.p2 = graphs.point(rp.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, rp.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
  }





  };

  // beam splitter
  objTypes['beamsplitter'] = {

  //======================================建立物件=========================================
  create: function(mouse) {
    return {type: 'beamsplitter', p1: mouse, p2: mouse, p: .5};
  },

  //===================================顯示屬性方塊=========================================
  p_box: function(obj, elem) {
    createNumberAttr(getMsg('transmissionratio'), 0, 1, 0.01, obj.p, function(obj, value) {
      obj.p = value;
    }, elem);
  },

  //使用lineobj原型
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,
  rayIntersection: objTypes['lineobj'].rayIntersection,

  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas) {
    //ctx.lineWidth=1.5;
    ctx.strokeStyle = getMouseStyle(obj, 'rgb(100,100,168)');
    ctx.beginPath();
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p2.x, obj.p2.y);
    ctx.stroke();
    //ctx.lineWidth=1;
  },



  //=============================當物件被光射到時================================
  shot: function(mirror, ray, rayIndex, rp) {
    //此時代表光一定有射到鏡子,只需找到交點,不需判斷是否真的射到
    var rx = ray.p1.x - rp.x;
    var ry = ray.p1.y - rp.y;
    var mx = mirror.p2.x - mirror.p1.x;
    var my = mirror.p2.y - mirror.p1.y;
    ray.p1 = rp;
    ray.p2 = graphs.point(rp.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, rp.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
    var ray2 = graphs.ray(rp, graphs.point(rp.x-rx, rp.y-ry));
    var transmission = mirror.p;
    ray2.brightness_s = transmission*ray.brightness_s;
    ray2.brightness_p = transmission*ray.brightness_p;
    ray2.wavelength = ray.wavelength;
    if (ray2.brightness_s + ray2.brightness_p > .01) {
      addRay(ray2);
    } else {
        totalTruncation += ray2.brightness_s + ray2.brightness_p;
    }
    ray.brightness_s *= (1-transmission);
    ray.brightness_p *= (1-transmission);
  }

  };

  //"lens"(透鏡)物件
  objTypes['lens'] = {

  //======================================建立物件=========================================
  create: function(mouse) {
    return {type: 'lens', p1: mouse, p2: mouse, p: 100};
  },

  //===================================顯示屬性方塊=========================================
  p_box: function(obj, elem) {
    createNumberAttr(getMsg('focallength'), -1000, 1000, 1, obj.p, function(obj, value) {
      obj.p = value;
    }, elem);
  },

  //使用lineobj原型
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,
  rayIntersection: objTypes['lineobj'].rayIntersection,

  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas) {
  //var ctx = canvas.getContext('2d');

  var len = Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));
  var par_x = (obj.p2.x - obj.p1.x) / len;
  var par_y = (obj.p2.y - obj.p1.y) / len;
  var per_x = par_y;
  var per_y = -par_x;

  var arrow_size_per = 5;
  var arrow_size_par = 5;
  var center_size = 2;

  //畫線
  ctx.strokeStyle = getMouseStyle(obj, 'rgb(128,128,128)');
  ctx.globalAlpha = 1 / ((Math.abs(obj.p) / 100) + 1);
  //ctx.globalAlpha=0.3;
  ctx.lineWidth = 4;
  //ctx.lineCap = "round"
  ctx.beginPath();
  ctx.moveTo(obj.p1.x, obj.p1.y);
  ctx.lineTo(obj.p2.x, obj.p2.y);
  ctx.stroke();
  ctx.lineWidth = 1;
  //ctx.lineCap = "butt"


  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgb(255,0,0)';

  //畫透鏡中心點
  var center = graphs.midpoint(obj);
  ctx.strokeStyle = 'rgb(255,255,255)';
  ctx.beginPath();
  ctx.moveTo(center.x - per_x * center_size, center.y - per_y * center_size);
  ctx.lineTo(center.x + per_x * center_size, center.y + per_y * center_size);
  ctx.stroke();

  if (obj.p > 0)
  {
    //畫箭頭(p1)
    ctx.beginPath();
    ctx.moveTo(obj.p1.x - par_x * arrow_size_par, obj.p1.y - par_y * arrow_size_par);
    ctx.lineTo(obj.p1.x + par_x * arrow_size_par + per_x * arrow_size_per, obj.p1.y + par_y * arrow_size_par + per_y * arrow_size_per);
    ctx.lineTo(obj.p1.x + par_x * arrow_size_par - per_x * arrow_size_per, obj.p1.y + par_y * arrow_size_par - per_y * arrow_size_per);
    ctx.fill();

    //畫箭頭(p2)
    ctx.beginPath();
    ctx.moveTo(obj.p2.x + par_x * arrow_size_par, obj.p2.y + par_y * arrow_size_par);
    ctx.lineTo(obj.p2.x - par_x * arrow_size_par + per_x * arrow_size_per, obj.p2.y - par_y * arrow_size_par + per_y * arrow_size_per);
    ctx.lineTo(obj.p2.x - par_x * arrow_size_par - per_x * arrow_size_per, obj.p2.y - par_y * arrow_size_par - per_y * arrow_size_per);
    ctx.fill();
  }
  if (obj.p < 0)
  {
    //畫箭頭(p1)
    ctx.beginPath();
    ctx.moveTo(obj.p1.x + par_x * arrow_size_par, obj.p1.y + par_y * arrow_size_par);
    ctx.lineTo(obj.p1.x - par_x * arrow_size_par + per_x * arrow_size_per, obj.p1.y - par_y * arrow_size_par + per_y * arrow_size_per);
    ctx.lineTo(obj.p1.x - par_x * arrow_size_par - per_x * arrow_size_per, obj.p1.y - par_y * arrow_size_par - per_y * arrow_size_per);
    ctx.fill();

    //畫箭頭(p2)
    ctx.beginPath();
    ctx.moveTo(obj.p2.x - par_x * arrow_size_par, obj.p2.y - par_y * arrow_size_par);
    ctx.lineTo(obj.p2.x + par_x * arrow_size_par + per_x * arrow_size_per, obj.p2.y + par_y * arrow_size_par + per_y * arrow_size_per);
    ctx.lineTo(obj.p2.x + par_x * arrow_size_par - per_x * arrow_size_per, obj.p2.y + par_y * arrow_size_par - per_y * arrow_size_per);
    ctx.fill();
  }

  if (obj == mouseObj) {
    // show focal length
    var mp = graphs.midpoint(obj);
    ctx.fillStyle = 'rgb(255,0,255)';
    ctx.fillRect(mp.x+obj.p*per_x - 2, mp.y+obj.p*per_y - 2, 3, 3);
    ctx.fillRect(mp.x-obj.p*per_x - 2, mp.y-obj.p*per_y - 2, 3, 3);
  }
  },



  //=============================當物件被光射到時================================
  shot: function(lens, ray, rayIndex, shootPoint) {

    var lens_length = graphs.length_segment(lens);
    var main_line_unitvector_x = (-lens.p1.y + lens.p2.y) / lens_length;
    var main_line_unitvector_y = (lens.p1.x - lens.p2.x) / lens_length;
    //(-l1.p1.y+l1.p2.y+l1.p1.x+l1.p2.x)*0.5,(l1.p1.x-l1.p2.x+l1.p1.y+l1.p2.y)*0.5
    var mid_point = graphs.midpoint(lens); //透鏡中心點

    var twoF_point_1 = graphs.point(mid_point.x + main_line_unitvector_x * 2 * lens.p, mid_point.y + main_line_unitvector_y * 2 * lens.p);  //兩倍焦距點1
    var twoF_point_2 = graphs.point(mid_point.x - main_line_unitvector_x * 2 * lens.p, mid_point.y - main_line_unitvector_y * 2 * lens.p);  //兩倍焦距點2

    var twoF_line_near, twoF_line_far;
    if (graphs.length_squared(ray.p1, twoF_point_1) < graphs.length_squared(ray.p1, twoF_point_2))
    {
      //兩倍焦距點1和光線在同一側
      twoF_line_near = graphs.parallel(lens, twoF_point_1);
      twoF_line_far = graphs.parallel(lens, twoF_point_2);
    }
    else
    {
      //兩倍焦距點2和光線在同一側
      twoF_line_near = graphs.parallel(lens, twoF_point_2);
      twoF_line_far = graphs.parallel(lens, twoF_point_1);
    }


    if (lens.p > 0)
    {
      //匯聚透鏡
      ray.p2 = graphs.intersection_2line(twoF_line_far, graphs.line(mid_point, graphs.intersection_2line(twoF_line_near, ray)));
      ray.p1 = shootPoint;
    }
    else
    {
      //發散透鏡
      ray.p2 = graphs.intersection_2line(twoF_line_far, graphs.line(shootPoint, graphs.intersection_2line(twoF_line_near, graphs.line(mid_point, graphs.intersection_2line(twoF_line_far, ray)))));
      ray.p1 = shootPoint;
    }
  }





  };

  objTypes['sphericallens'] = {

  supportSurfaceMerging: true,

  create: function(mouse) {
    return {type: 'sphericallens', path: [{x: mouse.x, y: mouse.y, arc: false}], notDone: true, p: 1.5};
  },

  p_box: objTypes['refractor'].p_box,

  c_mousedown: objTypes['refractor'].c_mousedown,
  c_mousemove: objTypes['refractor'].c_mousemove,

  c_mouseup: function(obj, mouse) {
    objTypes['refractor'].c_mouseup(obj, mouse);
    if (obj.path.length > 2 && obj.notDone) {
      var p1 = obj.path[0];
      var p2 = obj.path[1];
      var len = Math.hypot(p1.x-p2.x, p1.y-p2.y);
      var dx = (p2.x-p1.x)/len;
      var dy = (p2.y-p1.y)/len;
      var dpx = dy;
      var dpy = -dx;
      var cx = (p1.x+p2.x)*.5;
      var cy = (p1.y+p2.y)*.5;
      const thick = 10;
      // create lens
      obj.path[0] = {x: p1.x-dpx*thick, y: p1.y-dpy*thick, arc: false};
      obj.path[1] = {x: p1.x+dpx*thick, y: p1.y+dpy*thick, arc: false};
      obj.path[2] = {x: cx+dpx*thick*2, y: cy+dpy*thick*2, arc: true};
      obj.path[3] = {x: p2.x+dpx*thick, y: p2.y+dpy*thick, arc: false};
      obj.path[4] = {x: p2.x-dpx*thick, y: p2.y-dpy*thick, arc: false};
      obj.path[5] = {x: cx-dpx*thick*2, y: cy-dpy*thick*2, arc: true};
      obj.notDone = false;
      isConstructing = false;
      draw();
    }
  },

  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    var p1 = graphs.midpoint_points(obj.path[0], obj.path[1]);
    var p2 = graphs.midpoint_points(obj.path[3], obj.path[4]);
    var len = Math.hypot(p1.x-p2.x, p1.y-p2.y);
    var dx = (p2.x-p1.x)/len;
    var dy = (p2.y-p1.y)/len;
    var dpx = dy;
    var dpy = -dx;
    var cx = (p1.x+p2.x)*.5;
    var cy = (p1.y+p2.y)*.5;
    var othick = Math.hypot(obj.path[0].x-p1.x, obj.path[0].y-p1.y);
    var cthick2 = Math.hypot(obj.path[2].x-cx, obj.path[2].y-cy);
    var cthick5 = Math.hypot(obj.path[5].x-cx, obj.path[5].y-cy);
    var oldx, oldy;
    if (draggingPart.part == 1) {
      oldx = obj.path[draggingPart.index].x;
      oldy = obj.path[draggingPart.index].y;
    }

    objTypes['refractor'].dragging(obj, mouse, draggingPart, ctrl, shift);
    if (draggingPart.part != 1)
      return;
    if (draggingPart.index == 2 || draggingPart.index == 5) {
      // keep center points on optical axis
      var off = (mouse.x-cx)*dpx + (mouse.y-cy)*dpy;
      obj.path[draggingPart.index] = {x: cx+dpx*off, y: cy+dpy*off, arc: true };
    } else {
      var thick = Math.abs(((mouse.x-cx)*dpx + (mouse.y-cy)*dpy));
      // adjust center thickness to match so curvature is the same
      cthick2 += thick-othick;
      cthick5 += thick-othick;
      var mpt = obj.path[draggingPart.index];
      var lchange = (mpt.x-oldx)*dx + (mpt.y-oldy)*dy;
      // adjust length
      if (draggingPart.index < 2) {
        p1.x += lchange*dx;
        p1.y += lchange*dy;
      } else {
        p2.x += lchange*dx;
        p2.y += lchange*dy;
      }
      // recreate lens
      obj.path[0] = {x: p1.x-dpx*thick, y: p1.y-dpy*thick, arc: false};
      obj.path[1] = {x: p1.x+dpx*thick, y: p1.y+dpy*thick, arc: false};
      obj.path[2] = {x: cx+dpx*cthick2, y: cy+dpy*cthick2, arc: true};
      obj.path[3] = {x: p2.x+dpx*thick, y: p2.y+dpy*thick, arc: false};
      obj.path[4] = {x: p2.x-dpx*thick, y: p2.y-dpy*thick, arc: false};
      obj.path[5] = {x: cx-dpx*cthick5, y: cy-dpy*cthick5, arc: true};
    }
  },

  draw: function(obj, canvas, aboveLight) {
    objTypes['refractor'].draw(obj, canvas, aboveLight);
    if (obj.path.length < 6)
      return;

    // get radii of curvature
    var center1 = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(obj.path[1], obj.path[2])),
                                            graphs.perpendicular_bisector(graphs.line(obj.path[3], obj.path[2])));
    var r2 = graphs.length(center1, obj.path[2]);
    var center2 = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(obj.path[4], obj.path[5])),
                                            graphs.perpendicular_bisector(graphs.line(obj.path[0], obj.path[5])));
    var r1 = graphs.length(center2, obj.path[5]);

    var p1 = graphs.midpoint_points(obj.path[0], obj.path[1]);
    var p2 = graphs.midpoint_points(obj.path[3], obj.path[4]);
    var len = Math.hypot(p1.x-p2.x, p1.y-p2.y);
    var dx = (p2.x-p1.x)/len;
    var dy = (p2.y-p1.y)/len;
    var dpx = dy;
    var dpy = -dx;
    var cx = (p1.x+p2.x)*.5;
    var cy = (p1.y+p2.y)*.5;
    var thick = graphs.length(obj.path[2], obj.path[5]);

    // correct sign
    if (dpx*(center1.x-obj.path[2].x)+dpy*(center1.y-obj.path[2].y) < 0)
      r2 = -r2;
    if (dpx*(center2.x-obj.path[5].x)+dpy*(center2.y-obj.path[5].y) < 0)
      r1 = -r1;

    if (obj == mouseObj) {
      // the lensmaker's equation is apparently not accurate enough at the scale of this simulator so we
      // do some extra work to get an accurate focal length.  still not quite exact
      var n = (!colorMode)?obj.p:(obj.p + (obj.cauchyCoeff || 0.004) / (565*565*0.000001));
      var si1 = n*r1/(n-1);
      var power = (1-n)/r2 - n/(thick-si1);
      var focalLength = 1/power;
      ctx.fillStyle = 'rgb(255,0,255)';
      ctx.fillRect(obj.path[2].x+focalLength*dpx - 2, obj.path[2].y+focalLength*dpy - 2, 3, 3);

      // other side is slightly different
      si1 = -n*r2/(n-1);
      power = -(1-n)/r1 - n/(thick-si1);
      focalLength = 1/power;
      ctx.fillRect(obj.path[5].x-focalLength*dpx - 2, obj.path[5].y-focalLength*dpy - 2, 3, 3);
    }
  },

  move: objTypes['refractor'].move,
  clicked: objTypes['refractor'].clicked,
  rayIntersection: objTypes['refractor'].rayIntersection,
  shot: objTypes['refractor'].shot,
  fillGlass: objTypes['refractor'].fillGlass,
  getShotData: objTypes['refractor'].getShotData,
  refract: objTypes['refractor'].refract,
  getShotType: objTypes['refractor'].getShotType,

  };

  //"idealmirror"(理想曲面鏡)物件
  objTypes['idealmirror'] = {

  //======================================建立物件=========================================
  create: function(mouse) {
    return {type: 'idealmirror', p1: mouse, p2: graphs.point(mouse.x + gridSize, mouse.y), p: 100};
  },

  //===================================顯示屬性方塊=========================================
  p_box: function(obj, elem) {
    createNumberAttr(getMsg('focallength'), -1000, 1000, 1, obj.p * (cartesianSign?-1:1), function(obj, value) {
      obj.p = value * (cartesianSign?-1:1);
    }, elem);
    createBooleanAttr(getMsg('cartesiansign'), cartesianSign, function(obj, value) {
      if (obj == objs[selectedObj]) {
        cartesianSign = value;
        localStorage.rayOpticsCartesianSign = value?"true":"false";
        selectObj(selectedObj);
      }
    }, elem);
  },

  //使用lineobj原型
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,
  rayIntersection: objTypes['lineobj'].rayIntersection,

  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas) {
  //var ctx = canvas.getContext('2d');

  var len = Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));
  var par_x = (obj.p2.x - obj.p1.x) / len;
  var par_y = (obj.p2.y - obj.p1.y) / len;
  var per_x = par_y;
  var per_y = -par_x;

  var arrow_size_per = 5;
  var arrow_size_par = 5;
  var center_size = 1;

  //畫線
  ctx.strokeStyle = getMouseStyle(obj, 'rgb(168,168,168)');
  //ctx.globalAlpha=1/((Math.abs(obj.p)/100)+1);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  //ctx.lineCap = "round"
  ctx.beginPath();
  ctx.moveTo(obj.p1.x, obj.p1.y);
  ctx.lineTo(obj.p2.x, obj.p2.y);
  ctx.stroke();
  ctx.lineWidth = 1;
  //ctx.lineCap = "butt"


  //畫面鏡中心點
  var center = graphs.midpoint(obj);
  ctx.strokeStyle = 'rgb(255,255,255)';
  ctx.beginPath();
  ctx.moveTo(center.x - per_x * center_size, center.y - per_y * center_size);
  ctx.lineTo(center.x + per_x * center_size, center.y + per_y * center_size);
  ctx.stroke();



  //ctx.globalAlpha=1;
  ctx.fillStyle = 'rgb(255,0,0)';

  //單面版畫箭頭(兩方向焦距相反)
  /*
  if(obj.p>0)
  {
    //畫箭頭(p1)
    ctx.beginPath();
    ctx.moveTo(obj.p1.x+per_x*arrow_size_per2,obj.p1.y+per_y*arrow_size_per2);
    ctx.lineTo(obj.p1.x-per_x*arrow_size_per,obj.p1.y-per_y*arrow_size_per);
    ctx.lineTo(obj.p1.x+per_x*arrow_size_per2+par_x*arrow_size_par,obj.p1.y+per_y*arrow_size_per2+par_y*arrow_size_par);
    ctx.fill();

    //畫箭頭(p2)
    ctx.beginPath();
    ctx.moveTo(obj.p2.x+per_x*arrow_size_per2,obj.p2.y+per_y*arrow_size_per2);
    ctx.lineTo(obj.p2.x-per_x*arrow_size_per,obj.p2.y-per_y*arrow_size_per);
    ctx.lineTo(obj.p2.x+per_x*arrow_size_per2-par_x*arrow_size_par,obj.p2.y+per_y*arrow_size_per2-par_y*arrow_size_par);
    ctx.fill();
  }
  if(obj.p<0)
  {
    //畫箭頭(p1)
    ctx.beginPath();
    ctx.moveTo(obj.p1.x-per_x*arrow_size_per2,obj.p1.y-per_y*arrow_size_per2);
    ctx.lineTo(obj.p1.x+per_x*arrow_size_per,obj.p1.y+per_y*arrow_size_per);
    ctx.lineTo(obj.p1.x-per_x*arrow_size_per2+par_x*arrow_size_par,obj.p1.y-per_y*arrow_size_per2+par_y*arrow_size_par);
    ctx.fill();

    //畫箭頭(p2)
    ctx.beginPath();
    ctx.moveTo(obj.p2.x-per_x*arrow_size_per2,obj.p2.y-per_y*arrow_size_per2);
    ctx.lineTo(obj.p2.x+per_x*arrow_size_per,obj.p2.y+per_y*arrow_size_per);
    ctx.lineTo(obj.p2.x-per_x*arrow_size_per2-par_x*arrow_size_par,obj.p2.y-per_y*arrow_size_per2-par_y*arrow_size_par);
    ctx.fill();
  }
  */

  //雙面版畫箭頭
  if (obj.p < 0)
  {
    //畫箭頭(p1)
    ctx.beginPath();
    ctx.moveTo(obj.p1.x - par_x * arrow_size_par, obj.p1.y - par_y * arrow_size_par);
    ctx.lineTo(obj.p1.x + par_x * arrow_size_par + per_x * arrow_size_per, obj.p1.y + par_y * arrow_size_par + per_y * arrow_size_per);
    ctx.lineTo(obj.p1.x + par_x * arrow_size_par - per_x * arrow_size_per, obj.p1.y + par_y * arrow_size_par - per_y * arrow_size_per);
    ctx.fill();

    //畫箭頭(p2)
    ctx.beginPath();
    ctx.moveTo(obj.p2.x + par_x * arrow_size_par, obj.p2.y + par_y * arrow_size_par);
    ctx.lineTo(obj.p2.x - par_x * arrow_size_par + per_x * arrow_size_per, obj.p2.y - par_y * arrow_size_par + per_y * arrow_size_per);
    ctx.lineTo(obj.p2.x - par_x * arrow_size_par - per_x * arrow_size_per, obj.p2.y - par_y * arrow_size_par - per_y * arrow_size_per);
    ctx.fill();
  }
  if (obj.p > 0)
  {
    //畫箭頭(p1)
    ctx.beginPath();
    ctx.moveTo(obj.p1.x + par_x * arrow_size_par, obj.p1.y + par_y * arrow_size_par);
    ctx.lineTo(obj.p1.x - par_x * arrow_size_par + per_x * arrow_size_per, obj.p1.y - par_y * arrow_size_par + per_y * arrow_size_per);
    ctx.lineTo(obj.p1.x - par_x * arrow_size_par - per_x * arrow_size_per, obj.p1.y - par_y * arrow_size_par - per_y * arrow_size_per);
    ctx.fill();

    //畫箭頭(p2)
    ctx.beginPath();
    ctx.moveTo(obj.p2.x - par_x * arrow_size_par, obj.p2.y - par_y * arrow_size_par);
    ctx.lineTo(obj.p2.x + par_x * arrow_size_par + per_x * arrow_size_per, obj.p2.y + par_y * arrow_size_par + per_y * arrow_size_per);
    ctx.lineTo(obj.p2.x + par_x * arrow_size_par - per_x * arrow_size_per, obj.p2.y + par_y * arrow_size_par - per_y * arrow_size_per);
    ctx.fill();
  }

  },



  //=============================當物件被光射到時================================
  shot: function(obj, ray, rayIndex, shootPoint) {
    //當成理想透鏡與平面鏡的結合
    objTypes['lens'].shot(obj, ray, rayIndex, graphs.point(shootPoint.x, shootPoint.y));


    //將光線往後拉
    ray.p1.x = 2 * ray.p1.x - ray.p2.x;
    ray.p1.y = 2 * ray.p1.y - ray.p2.y;



    objTypes['mirror'].shot(obj, ray, rayIndex, shootPoint);
  }





  };

  //"blackline"(黑線)物件
  objTypes['blackline'] = {

  //======================================建立物件=========================================
  create: function(mouse) {
    return {type: 'blackline', p1: mouse, p2: mouse};
  },

  //使用lineobj原型
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,
  rayIntersection: objTypes['lineobj'].rayIntersection,

  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas) {
  //var ctx = canvas.getContext('2d');
  ctx.strokeStyle = getMouseStyle(obj, 'rgb(70,35,10)');
  ctx.lineWidth = 3;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(obj.p1.x, obj.p1.y);
  ctx.lineTo(obj.p2.x, obj.p2.y);
  ctx.stroke();
  ctx.lineWidth = 1;
  },

  //=============================當物件被光射到時================================
  shot: function(obj, ray, rayIndex, rp) {
    ray.exist = false;
  }

  };

  //"text"
  objTypes['text'] = {

  //======================================建立物件=========================================
  create: function(mouse) {
  return {type: 'text', x: mouse.x, y: mouse.y, p: 'text here'};
  },

  //===================================顯示屬性方塊=========================================
  p_box: function(obj, elem) {
    createStringAttr('', obj.p, function(obj, value) {
      obj.p = value;
    }, elem);
  },

  //==============================建立物件過程滑鼠按下=======================================
  c_mousedown: function(obj, mouse)
  {
    draw();
  },
  //==============================建立物件過程滑鼠移動=======================================
  c_mousemove: function(obj, mouse, ctrl, shift)
  {
    obj.x=mouse.x;
    obj.y=mouse.y;
    draw();
  },
  //==============================建立物件過程滑鼠放開=======================================
  c_mouseup: function(obj, mouse)
  {
    isConstructing = false;
  },

  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas) {
  ctx.fillStyle = getMouseStyle(obj, 'white');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.font = '24px serif';
  ctx.fillText(obj.p, obj.x, obj.y);
  obj.tmp_width = ctx.measureText(obj.p).width;
  },

  //=================================平移物件====================================
  move: function(obj, diffX, diffY) {
    obj.x = obj.x + diffX;
    obj.y = obj.y + diffY;
    return obj;
  },


  //==========================繪圖區被按下時(判斷物件被按下的部分)===========================
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

  //=================================拖曳物件時====================================
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    if (shift)
    {
      var mouse_snapped = snapToDirection(mouse, draggingPart.mouse0, [{x: 1, y: 0},{x: 0, y: 1}], draggingPart.snapData);
    }
    else
    {
      var mouse_snapped = mouse;
      draggingPart.snapData = {}; //放開shift時解除原先之拖曳方向鎖定
    }

    obj.x = mouse_snapped.x + draggingPart.targetPoint_.x - draggingPart.mouse0.x;
    obj.y = mouse_snapped.y + draggingPart.targetPoint_.y - draggingPart.mouse0.y;
    return {obj: obj};
  },

  };

  //"radiant"物件
  objTypes['radiant'] = {

  //======================================建立物件=========================================
  create: function(mouse) {
  return {type: 'radiant', x: mouse.x, y: mouse.y, p: 0.5};
  },

  p_box: objTypes['laser'].p_box,

  //==============================建立物件過程滑鼠按下=======================================
  c_mousedown: function(obj, mouse)
  {
    draw();
  },
  //==============================建立物件過程滑鼠移動=======================================
  c_mousemove: function(obj, mouse, ctrl, shift)
  {
    /*
    obj.x=mouse.x;
    obj.y=mouse.y;
    draw();
    */
  },
  //==============================建立物件過程滑鼠放開=======================================
  c_mouseup: function(obj, mouse)
  {
    isConstructing = false;
  },

  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas) {
  //var ctx = canvas.getContext('2d');
  if (colorMode) {
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = wavelengthToColor(obj.wavelength || 532, 1);
    ctx.fillRect(obj.x - 2, obj.y - 2, 5, 5);
    ctx.fillStyle = getMouseStyle(obj, 'rgb(255,255,255)', true);
    ctx.fillRect(obj.x - 1, obj.y - 1, 3, 3);
    ctx.globalCompositeOperation = "source-over";
  } else {
    ctx.fillStyle = getMouseStyle(obj, 'rgb(0,255,0)');
    ctx.fillRect(obj.x - 2, obj.y - 2, 5, 5);
  }

  },

  //=================================平移物件====================================
  move: function(obj, diffX, diffY) {
    obj.x = obj.x + diffX;
    obj.y = obj.y + diffY;
    return obj;
  },


  //==========================繪圖區被按下時(判斷物件被按下的部分)===========================
  clicked: function(obj, mouse_nogrid, mouse, draggingPart) {
    if (mouseOnPoint(mouse_nogrid, obj))
    {
      draggingPart.part = 0;
      draggingPart.mouse0 = graphs.point(obj.x, obj.y);
      draggingPart.targetPoint = graphs.point(obj.x, obj.y);
      draggingPart.snapData = {};
      return true;
    }
    return false;
  },

  //=================================拖曳物件時====================================
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    if (shift)
    {
      var mouse_snapped = snapToDirection(mouse, draggingPart.mouse0, [{x: 1, y: 0},{x: 0, y: 1}], draggingPart.snapData);
    }
    else
    {
      var mouse_snapped = mouse;
      draggingPart.snapData = {}; //放開shift時解除原先之拖曳方向鎖定
    }

    obj.x = mouse_snapped.x;
    obj.y = mouse_snapped.y;
    return {obj: obj};
  },


  //=================================射出光線=============================================
  shoot: function(obj) {
  var s = Math.PI * 2 / parseInt(getRayDensity() * 500);
  var i0 = (mode == 'observer') ? (-s * 2 + 1e-6) : 0; //為避免使用觀察者時出現黑色間格
  for (var i = i0; i < (Math.PI * 2 - 1e-5); i = i + s)
  {
    var ray1 = graphs.ray(graphs.point(obj.x, obj.y), graphs.point(obj.x + Math.sin(i), obj.y + Math.cos(i)));
    ray1.brightness_s = Math.min(obj.p / getRayDensity(), 1) * 0.5;
    ray1.brightness_p = Math.min(obj.p / getRayDensity(), 1) * 0.5;
    ray1.isNew = true;
    if (colorMode) {
      ray1.wavelength = obj.wavelength || 532;
    }
    if (i == i0)
    {
      ray1.gap = true;
    }
    addRay(ray1);
  }
  }




  };

  //"parallel"(平行光)物件
  objTypes['parallel'] = {

  //======================================建立物件=========================================
  create: function(mouse) {
    return {type: 'parallel', p1: mouse, p2: mouse, p: 0.5};
  },

  p_box: objTypes['laser'].p_box,

  //使用lineobj原型
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,

  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas) {
    //var ctx = canvas.getContext('2d');
    var a_l = Math.atan2(obj.p1.x - obj.p2.x, obj.p1.y - obj.p2.y) - Math.PI / 2;
    if (colorMode) {
      ctx.globalCompositeOperation = "screen";
      ctx.strokeStyle = getMouseStyle(obj, wavelengthToColor(obj.wavelength || 532, 1));
    } else {
      ctx.strokeStyle = getMouseStyle(obj, 'rgb(0,255,0)');
    }
    ctx.lineWidth = 4;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(obj.p1.x + Math.sin(a_l) * 2, obj.p1.y + Math.cos(a_l) * 2);
    ctx.lineTo(obj.p2.x + Math.sin(a_l) * 2, obj.p2.y + Math.cos(a_l) * 2);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";

    ctx.strokeStyle = 'rgba(128,128,128,255)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p2.x, obj.p2.y);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
  },




  //=================================射出光線=============================================
  shoot: function(obj) {
    var n = graphs.length_segment(obj) * getRayDensity();
    var stepX = (obj.p2.x - obj.p1.x) / n;
    var stepY = (obj.p2.y - obj.p1.y) / n;
    var rayp2_x = obj.p1.x + obj.p2.y - obj.p1.y;
    var rayp2_y = obj.p1.y - obj.p2.x + obj.p1.x;


    for (var i = 0.5; i <= n; i++)
    {
      var ray1 = graphs.ray(graphs.point(obj.p1.x + i * stepX, obj.p1.y + i * stepY), graphs.point(rayp2_x + i * stepX, rayp2_y + i * stepY));
      ray1.brightness_s = Math.min(obj.p / getRayDensity(), 1) * 0.5;
      ray1.brightness_p = Math.min(obj.p / getRayDensity(), 1) * 0.5;
      ray1.isNew = true;
      if (colorMode) {
        ray1.wavelength = obj.wavelength || 532;
      }
      if (i == 0)
      {
        ray1.gap = true;
      }
      addRay(ray1);
    }

  }





  };

  //"arcmirror"(弧形鏡子)物件
  objTypes['arcmirror'] = {

  //======================================建立物件=========================================
  create: function(mouse) {
    return {type: 'arcmirror', p1: mouse};
  },

  //==============================建立物件過程滑鼠按下=======================================
  c_mousedown: function(obj, mouse)
  {
    if (!obj.p2 && !obj.p3)
    {
      draw();
      obj.p2 = mouse;
      return;
    }
    if (obj.p2 && !obj.p3 && !mouseOnPoint_construct(mouse, obj.p1))
    {
      obj.p2 = mouse;
      draw();
      obj.p3 = mouse;
      return;
    }
  },
  //==============================建立物件過程滑鼠移動=======================================
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

      //obj.p2=mouse;
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
  //==============================建立物件過程滑鼠放開=======================================
  c_mouseup: function(obj, mouse)
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

  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas) {
    //var ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(255,0,255)';
    //ctx.lineWidth=1.5;
    if (obj.p3 && obj.p2)
    {
      var center = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(obj.p1, obj.p3)), graphs.perpendicular_bisector(graphs.line(obj.p2, obj.p3)));
      if (isFinite(center.x) && isFinite(center.y))
      {
        var r = graphs.length(center, obj.p3);
        var a1 = Math.atan2(obj.p1.y - center.y, obj.p1.x - center.x);
        var a2 = Math.atan2(obj.p2.y - center.y, obj.p2.x - center.x);
        var a3 = Math.atan2(obj.p3.y - center.y, obj.p3.x - center.x);
        ctx.strokeStyle = getMouseStyle(obj, 'rgb(168,168,168)');
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, a1, a2, (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2));
        ctx.stroke();
        if (obj == mouseObj) {
          ctx.fillRect(obj.p3.x - 2, obj.p3.y - 2, 3, 3);
          ctx.fillStyle = 'rgb(255,0,0)';
          ctx.fillRect(obj.p1.x - 2, obj.p1.y - 2, 3, 3);
          ctx.fillRect(obj.p2.x - 2, obj.p2.y - 2, 3, 3);
        }
      }
      else
      {
        //圓弧三點共線,當作線段處理
        ctx.strokeStyle = 'rgb(168,168,168)';
        ctx.beginPath();
        ctx.moveTo(obj.p1.x, obj.p1.y);
        ctx.lineTo(obj.p2.x, obj.p2.y);
        ctx.stroke();

        ctx.fillRect(obj.p3.x - 2, obj.p3.y - 2, 3, 3);
        ctx.fillStyle = 'rgb(255,0,0)';
        ctx.fillRect(obj.p1.x - 2, obj.p1.y - 2, 3, 3);
        ctx.fillRect(obj.p2.x - 2, obj.p2.y - 2, 3, 3);
      }
    }
    else if (obj.p2)
    {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(obj.p1.x - 2, obj.p1.y - 2, 3, 3);
      ctx.fillRect(obj.p2.x - 2, obj.p2.y - 2, 3, 3);
    }
    else
    {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(obj.p1.x - 2, obj.p1.y - 2, 3, 3);
    }
    //ctx.lineWidth=1;
  },

  //=================================平移物件====================================
  move: function(obj, diffX, diffY) {
    //移動線段的第一點
    obj.p1.x = obj.p1.x + diffX;
    obj.p1.y = obj.p1.y + diffY;
    //移動線段的第二點
    obj.p2.x = obj.p2.x + diffX;
    obj.p2.y = obj.p2.y + diffY;

    obj.p3.x = obj.p3.x + diffX;
    obj.p3.y = obj.p3.y + diffY;
    return obj;
  },


  //==========================繪圖區被按下時(判斷物件被按下的部分)===========================
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
        //拖曳整個物件
        draggingPart.part = 0;
        draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置
        draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置
        draggingPart.snapData = {};
        return true;
      }
    }
    else
    {
      //圓弧三點共線,當作線段處理
      if (mouseOnSegment(mouse_nogrid, obj))
      {
        draggingPart.part = 0;
        draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置
        draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置
        draggingPart.snapData = {};
        return true;
      }
    }
    return false;
  },

  //=================================拖曳物件時====================================
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    var basePoint;
    if (draggingPart.part == 1)
    {
      //正在拖曳第一個端點
      basePoint = ctrl ? graphs.midpoint(draggingPart.originalObj) : draggingPart.originalObj.p2;

      obj.p1 = shift ? snapToDirection(mouse, basePoint, [{x: 1, y: 0},{x: 0, y: 1},{x: 1, y: 1},{x: 1, y: -1},{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)}]) : mouse;
      obj.p2 = ctrl ? graphs.point(2 * basePoint.x - obj.p1.x, 2 * basePoint.y - obj.p1.y) : basePoint;

      //obj.p1=mouse;
    }
    if (draggingPart.part == 2)
    {
      //正在拖曳第二個端點

      basePoint = ctrl ? graphs.midpoint(draggingPart.originalObj) : draggingPart.originalObj.p1;

      obj.p2 = shift ? snapToDirection(mouse, basePoint, [{x: 1, y: 0},{x: 0, y: 1},{x: 1, y: 1},{x: 1, y: -1},{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)}]) : mouse;
      obj.p1 = ctrl ? graphs.point(2 * basePoint.x - obj.p2.x, 2 * basePoint.y - obj.p2.y) : basePoint;

      //obj.p2=mouse;
    }
    if (draggingPart.part == 3)
    {
      //正在拖曳弧形控制點
      obj.p3 = mouse;
    }

    if (draggingPart.part == 0)
    {
      //正在拖曳整個物件

      if (shift)
      {
        var mouse_snapped = snapToDirection(mouse, draggingPart.mouse0, [{x: 1, y: 0},{x: 0, y: 1},{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)},{x: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y), y: -(draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x)}], draggingPart.snapData);
      }
      else
      {
        var mouse_snapped = mouse;
        draggingPart.snapData = {}; //放開shift時解除原先之拖曳方向鎖定
      }

      var mouseDiffX = draggingPart.mouse1.x - mouse_snapped.x; //目前滑鼠位置與上一次的滑鼠位置的X軸差
      var mouseDiffY = draggingPart.mouse1.y - mouse_snapped.y; //目前滑鼠位置與上一次的滑鼠位置的Y軸差
      //移動線段的第一點
      obj.p1.x = obj.p1.x - mouseDiffX;
      obj.p1.y = obj.p1.y - mouseDiffY;
      //移動線段的第二點
      obj.p2.x = obj.p2.x - mouseDiffX;
      obj.p2.y = obj.p2.y - mouseDiffY;

      obj.p3.x = obj.p3.x - mouseDiffX;
      obj.p3.y = obj.p3.y - mouseDiffY;

      //更新滑鼠位置
      draggingPart.mouse1 = mouse_snapped;
    }
  },



  //====================判斷一道光是否會射到此物件(若是,則回傳交點)====================
  rayIntersection: function(obj, ray) {
    if (!obj.p3) {return;}
    var center = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(obj.p1, obj.p3)), graphs.perpendicular_bisector(graphs.line(obj.p2, obj.p3)));
    if (isFinite(center.x) && isFinite(center.y))
    {

      var rp_temp = graphs.intersection_line_circle(graphs.line(ray.p1, ray.p2), graphs.circle(center, obj.p2));   //求光(的延長線)與鏡子的交點
      //canvasPainter.draw(rp_temp[1],canvas);
      //var a_rp
      var rp_exist = [];
      var rp_lensq = [];
      for (var i = 1; i <= 2; i++)
      {

        rp_exist[i] = !graphs.intersection_is_on_segment(graphs.intersection_2line(graphs.line(obj.p1, obj.p2), graphs.line(obj.p3, rp_temp[i])), graphs.segment(obj.p3, rp_temp[i])) && graphs.intersection_is_on_ray(rp_temp[i], ray) && graphs.length_squared(rp_temp[i], ray.p1) > minShotLength_squared;


        rp_lensq[i] = graphs.length_squared(ray.p1, rp_temp[i]); //光線射到第i交點的距離
      }


      if (rp_exist[1] && ((!rp_exist[2]) || rp_lensq[1] < rp_lensq[2])) {return rp_temp[1];}
      if (rp_exist[2] && ((!rp_exist[1]) || rp_lensq[2] < rp_lensq[1])) {return rp_temp[2];}
    }
    else
    {
      //圓弧三點共線,當作線段處理
      return objTypes['mirror'].rayIntersection(obj, ray);
    }
    //alert("")
  },

  //=============================當物件被光射到時================================
  shot: function(obj, ray, rayIndex, rp) {

    //alert("")
    var center = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(obj.p1, obj.p3)), graphs.perpendicular_bisector(graphs.line(obj.p2, obj.p3)));
    if (isFinite(center.x) && isFinite(center.y))
    {

      var rx = ray.p1.x - rp.x;
      var ry = ray.p1.y - rp.y;
      var cx = center.x - rp.x;
      var cy = center.y - rp.y;
      var c_sq = cx * cx + cy * cy;
      var r_dot_c = rx * cx + ry * cy;
      ray.p1 = rp;

      ray.p2 = graphs.point(rp.x - c_sq * rx + 2 * r_dot_c * cx, rp.y - c_sq * ry + 2 * r_dot_c * cy);
    }
    else
    {
      //圓弧三點共線,當作線段處理
      return objTypes['mirror'].shot(obj, ray, rayIndex, rp);
    }

  }





  };

  // parabolic mirror
  objTypes['parabolicmirror'] = {

  //======================================建立物件=========================================
  create: function(mouse) {
    return {type: 'parabolicmirror', p1: mouse};
  },

  c_mousedown: objTypes['arcmirror'].c_mousedown,
  c_mousemove: objTypes['arcmirror'].c_mousemove,
  c_mouseup: objTypes['arcmirror'].c_mouseup,

  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas) {
    //var ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(255,0,255)';
    //ctx.lineWidth=1.5;
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
      ctx.strokeStyle = getMouseStyle(obj, 'rgb(168,168,168)');
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
        ctx.fillRect(obj.p3.x - 2, obj.p3.y - 2, 3, 3);
        var focusx = (obj.p1.x+obj.p2.x)*.5 + dir2[0]*(height-1/(4*a));
        var focusy = (obj.p1.y+obj.p2.y)*.5 + dir2[1]*(height-1/(4*a));
        ctx.fillRect(focusx - 2, focusy - 2, 3, 3);
        ctx.fillStyle = 'rgb(255,0,0)';
        ctx.fillRect(obj.p1.x - 2, obj.p1.y - 2, 3, 3);
        ctx.fillRect(obj.p2.x - 2, obj.p2.y - 2, 3, 3);
      }
    }
    else if (obj.p2)
    {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(obj.p1.x - 2, obj.p1.y - 2, 3, 3);
      ctx.fillRect(obj.p2.x - 2, obj.p2.y - 2, 3, 3);
    }
    else
    {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(obj.p1.x - 2, obj.p1.y - 2, 3, 3);
    }
    //ctx.lineWidth=1;
  },

  move: objTypes['arcmirror'].move,

  //==========================繪圖區被按下時(判斷物件被按下的部分)===========================
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
        //拖曳整個物件
        draggingPart.part = 0;
        draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置
        draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置
        draggingPart.snapData = {};
        return true;
      }
    }
    return false;
  },

  dragging: objTypes['arcmirror'].dragging,

  //====================判斷一道光是否會射到此物件(若是,則回傳交點)====================
  rayIntersection: function(obj, ray) {
    if (!obj.p3) {return;}
    if (!obj.tmp_points) return;
    var i,j;
    var pts = obj.tmp_points;
    var dir = graphs.length(obj.p2, ray.p1) > graphs.length(obj.p1, ray.p1);
    var rp;
    for (j = 0; j < pts.length-1; j++) {
      i = dir ? j : (pts.length-2-j);
      var rp_temp = graphs.intersection_2line(graphs.line(ray.p1, ray.p2), graphs.line(pts[i], pts[i+1]));
      var seg = graphs.segment(pts[i], pts[i+1]);
      // need minShotLength check to handle a ray that reflects off mirror multiple times
      if (graphs.length(ray.p1, rp_temp) < minShotLength)
        continue;
      if (graphs.intersection_is_on_segment(rp_temp, seg) && graphs.intersection_is_on_ray(rp_temp, ray)) {
          if (!rp || graphs.length(ray.p1, rp_temp) < graphs.length(ray.p1, rp)) {
              rp = rp_temp;
          }
      }
    }
    if (rp) return rp;
  },

  //=============================當物件被光射到時================================
  shot: function(obj, ray, rayIndex, rp) {
    var i;
    var pts = obj.tmp_points;
    var dir = graphs.length(obj.p2, rp) > graphs.length(obj.p1, rp);
    for (j = 0; j < pts.length-1; j++) {
      i = dir ? j : (pts.length-2-j);
      var seg = graphs.segment(pts[i], pts[i+1]);
      if (graphs.intersection_is_on_segment(rp, seg)) {
        var rx = ray.p1.x - rp.x;
        var ry = ray.p1.y - rp.y;
        var mx = seg.p2.x - seg.p1.x;
        var my = seg.p2.y - seg.p1.y;
        ray.p1 = rp;
        ray.p2 = graphs.point(rp.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, rp.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
        return;
      }
    }
  }





  };

  //"ruler"物件
  objTypes['ruler'] = {

  //======================================建立物件=========================================
  create: function(mouse) {
    return {type: 'ruler', p1: mouse, p2: mouse};
  },

  //使用lineobj原型
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,

  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas, aboveLight) {
  //var ctx = canvas.getContext('2d');
  if (aboveLight)return;
  ctx.globalCompositeOperation = 'lighter';
  var len = Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));
  var par_x = (obj.p2.x - obj.p1.x) / len;
  var par_y = (obj.p2.y - obj.p1.y) / len;
  var per_x = par_y;
  var per_y = -par_x;
  var ang = Math.atan2(obj.p2.y - obj.p1.y, obj.p2.x - obj.p1.x);
  //console.log(ang);

  var scale_step = 10;
  var scale_step_mid = 50;
  var scale_step_long = 100;
  var scale_len = 10;
  var scale_len_mid = 15;
  //var scale_len_long=20;


  ctx.strokeStyle = getMouseStyle(obj, 'rgb(128,128,128)', true);
  //ctx.font="bold 14px Arial";
  ctx.font = '14px Arial';
  ctx.fillStyle = 'rgb(128,128,128)';

  if (ang > Math.PI * (-0.25) && ang <= Math.PI * 0.25)
  {
    //↘~↗
    //console.log("↘~↗");
    var scale_direction = -1;
    var scale_len_long = 20;
    var text_ang = ang;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
  }
  else if (ang > Math.PI * (-0.75) && ang <= Math.PI * (-0.25))
  {
    //↗~↖
    //console.log("↗~↖");
    var scale_direction = 1;
    var scale_len_long = 15;
    var text_ang = ang - Math.PI * (-0.5);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
  }
  else if (ang > Math.PI * 0.75 || ang <= Math.PI * (-0.75))
  {
    //↖~↙
    //console.log("↖~↙");
    var scale_direction = 1;
    var scale_len_long = 20;
    var text_ang = ang - Math.PI;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
  }
  else
  {
    //↙~↘
    //console.log("↙~↘");
    var scale_direction = -1;
    var scale_len_long = 15;
    var text_ang = ang - Math.PI * 0.5;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
  }

  //ctx.textBaseline="hanging";
  //ctx.lineWidth=3;
  //ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(obj.p1.x, obj.p1.y);
  ctx.lineTo(obj.p2.x, obj.p2.y);
  //ctx.stroke();
  //ctx.lineWidth=1;
  var x, y;
  for (var i = 0; i <= len; i += scale_step)
  {
    ctx.moveTo(obj.p1.x + i * par_x, obj.p1.y + i * par_y);
    if (i % scale_step_long == 0)
    {
      x = obj.p1.x + i * par_x + scale_direction * scale_len_long * per_x;
      y = obj.p1.y + i * par_y + scale_direction * scale_len_long * per_y;
      ctx.lineTo(x, y);
      if (ctx.constructor == C2S) ctx.stroke();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(text_ang);
      ctx.fillText(i, 0, 0);
      ctx.restore();
    }
    else if (i % scale_step_mid == 0)
    {
      ctx.lineTo(obj.p1.x + i * par_x + scale_direction * scale_len_mid * per_x, obj.p1.y + i * par_y + scale_direction * scale_len_mid * per_y);
      //ctx.stroke();
    }
    else
    {
      ctx.lineTo(obj.p1.x + i * par_x + scale_direction * scale_len * per_x, obj.p1.y + i * par_y + scale_direction * scale_len * per_y);
      //ctx.stroke();
    }
  }
  ctx.stroke();
  //ctx.stroke();

  ctx.globalCompositeOperation = 'source-over';
  }

  };

  //"protractor"物件
  objTypes['protractor'] = {

  //======================================建立物件=========================================
  create: function(mouse) {
    return {type: 'protractor', p1: mouse, p2: mouse};
  },

  //使用lineobj原型
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: function(obj, mouse, ctrl, shift) {objTypes['lineobj'].c_mousemove(obj, mouse, false, shift)},
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,

  //==========================繪圖區被按下時(判斷物件被按下的部分)===========================
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
    if (Math.abs(graphs.length(obj.p1, mouse_nogrid) - graphs.length_segment(obj)) < clickExtent_line)
    {
      draggingPart.part = 0;
      draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置
      draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置
      draggingPart.snapData = {};
      return true;
    }
    return false;
  },

  //=================================拖曳物件時====================================
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {objTypes['lineobj'].dragging(obj, mouse, draggingPart, false, shift)},

  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas, aboveLight) {
  //var ctx = canvas.getContext('2d');
  if (!aboveLight)
  {
    ctx.globalCompositeOperation = 'lighter';
    var r = Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));
    var scale_width_limit = 5;

    var scale_step = 1;
    var scale_step_mid = 5;
    var scale_step_long = 10;
    var scale_len = 10;
    var scale_len_mid = 15;
    var scale_len_long = 20;

    ctx.strokeStyle = getMouseStyle(obj, 'rgb(128,128,128)',true);
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = 'rgb(128,128,128)';

    if (r * scale_step * Math.PI / 180 < scale_width_limit)
    {
      //刻度太小
      scale_step = 2;
      scale_step_mid = 10;
      scale_step_long = 30;
    }
    if (r * scale_step * Math.PI / 180 < scale_width_limit)
    {
      //刻度太小
      scale_step = 5;
      scale_step_mid = 10;
      scale_step_long = 30;
      scale_len = 5;
      scale_len_mid = 8;
      scale_len_long = 10;
      ctx.font = 'bold 10px Arial';
    }
    if (r * scale_step * Math.PI / 180 < scale_width_limit)
    {
      //刻度太小
      scale_step = 10;
      scale_step_mid = 30;
      scale_step_long = 90;
    }


    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    ctx.beginPath();
    ctx.arc(obj.p1.x, obj.p1.y, r, 0, Math.PI * 2, false);
      //ctx.stroke();

    var ang, x, y;
    for (var i = 0; i < 360; i += scale_step)
    {
      ang = i * Math.PI / 180 + Math.atan2(obj.p2.y - obj.p1.y, obj.p2.x - obj.p1.x);
      ctx.moveTo(obj.p1.x + r * Math.cos(ang), obj.p1.y + r * Math.sin(ang));
      if (i % scale_step_long == 0)
      {
        x = obj.p1.x + (r - scale_len_long) * Math.cos(ang);
        y = obj.p1.y + (r - scale_len_long) * Math.sin(ang);
        ctx.lineTo(x, y);
        if (ctx.constructor == C2S) ctx.stroke();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang + Math.PI * 0.5);
        ctx.fillText((i > 180) ? (360 - i) : i, 0, 0);
        ctx.restore();
      }
      else if (i % scale_step_mid == 0)
      {
        ctx.lineTo(obj.p1.x + (r - scale_len_mid) * Math.cos(ang), obj.p1.y + (r - scale_len_mid) * Math.sin(ang));
        //ctx.stroke();
      }
      else
      {
        ctx.lineTo(obj.p1.x + (r - scale_len) * Math.cos(ang), obj.p1.y + (r - scale_len) * Math.sin(ang));
        //ctx.stroke();
      }
    }
    ctx.stroke();
    //ctx.stroke();

    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = 'red';
  ctx.fillRect(obj.p1.x - 2, obj.p1.y - 2, 3, 3);
  ctx.fillStyle = 'rgb(255,0,255)';
  //ctx.fillStyle="indigo";
  ctx.fillRect(obj.p2.x - 2, obj.p2.y - 2, 3, 3);

  }

  };
  //"power"物件
  objTypes['power'] = {

  //======================================建立物件=========================================
  create: function(mouse) {
    return {type: 'power', p1: mouse, p2: mouse};
  },

  //使用lineobj原型
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,
  rayIntersection: objTypes['lineobj'].rayIntersection,
  //=================================將物件畫到Canvas上====================================
  draw: function(obj, canvas, aboveLight) {
    //var ctx = canvas.getContext('2d');

    if (!aboveLight) {
      ctx.globalCompositeOperation = 'lighter';

      ctx.strokeStyle = getMouseStyle(obj, 'rgb(192,192,192)', true)
      //ctx.textBaseline="hanging";
      //ctx.lineWidth=3;
      //ctx.lineCap = "butt";
      ctx.setLineDash([5,5]);
      ctx.beginPath();
      ctx.moveTo(obj.p1.x, obj.p1.y);
      ctx.lineTo(obj.p2.x, obj.p2.y);
      //ctx.stroke();
      //ctx.lineWidth=1;
      ctx.stroke();
      ctx.setLineDash([]);
      //ctx.stroke();

      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.globalCompositeOperation = 'lighter';
      var len = Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));
      
      var accuracy = Math.max(-Math.floor(Math.log10(totalTruncation)), 0);
      if (totalTruncation > 0 && accuracy <= 2) {
        var str1 = "P=" + obj.power.toFixed(accuracy) + "±" + totalTruncation.toFixed(accuracy);
        var str2 = "F⊥=" + obj.normal.toFixed(accuracy) + "±" + totalTruncation.toFixed(accuracy);
        var str3 = "F∥=" + obj.shear.toFixed(accuracy) + "±" + totalTruncation.toFixed(accuracy);
      } else {
        var str1 = "P=" + obj.power.toFixed(2);
        var str2 = "F⊥=" + obj.normal.toFixed(2);
        var str3 = "F∥=" + obj.shear.toFixed(2);
      }

      ctx.font = '16px Arial';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = getMouseStyle(obj, 'rgb(192,192,192)');
      ctx.fillText(str1, obj.p2.x, obj.p2.y);
      ctx.fillText(str2, obj.p2.x, obj.p2.y + 20);
      ctx.fillText(str3, obj.p2.x, obj.p2.y + 40);
      ctx.globalCompositeOperation = 'source-over';
    }

  },

  //=================================射出光線=============================================
  shoot: function(obj) {
    obj.power = 0;
    obj.normal = 0;
    obj.shear = 0;
  },

  //=============================當物件被光射到時================================
  shot: function(obj, ray, rayIndex, shootPoint) {
    var rcrosss = (ray.p2.x - ray.p1.x) * (obj.p2.y - obj.p1.y) - (ray.p2.y - ray.p1.y) * (obj.p2.x - obj.p1.x);
    var sint = rcrosss / Math.sqrt((ray.p2.x - ray.p1.x) * (ray.p2.x - ray.p1.x) + (ray.p2.y - ray.p1.y) * (ray.p2.y - ray.p1.y)) / Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));
    var cost = ((ray.p2.x - ray.p1.x) * (obj.p2.x - obj.p1.x) + (ray.p2.y - ray.p1.y) * (obj.p2.y - obj.p1.y)) / Math.sqrt((ray.p2.x - ray.p1.x) * (ray.p2.x - ray.p1.x) + (ray.p2.y - ray.p1.y) * (ray.p2.y - ray.p1.y)) / Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));
    ray.p2 = graphs.point(shootPoint.x + ray.p2.x - ray.p1.x, shootPoint.y + ray.p2.y - ray.p1.y);
    ray.p1 = graphs.point(shootPoint.x, shootPoint.y);

    obj.power += Math.sign(rcrosss) * (ray.brightness_s + ray.brightness_p);
    obj.normal += Math.sign(rcrosss) * sint * (ray.brightness_s + ray.brightness_p);
    obj.shear -= Math.sign(rcrosss) * cost * (ray.brightness_s + ray.brightness_p);
  }





  };


  var canvas;
  var ctx;
  var mouse; //滑鼠位置
  var mouse_lastmousedown; //上一次按下滑鼠時的滑鼠位置
  var objs = []; //物件
  var objCount = 0; //物件數量
  var isConstructing = false; //正在建立新的物件
  var constructionPoint; //建立物件的起始位置
  var draggingObj = -1; //拖曳中的物件編號(-1表示沒有拖曳,-3表示整個畫面,-4表示觀察者)
                        //Object number in drag (-1 for no drag, -3 for the entire picture, -4 for observer)
  var positioningObj = -1; //輸入座標中的物件編號(-1表示沒有,-4表示觀察者)
  var draggingPart = {}; //拖曳的部份與滑鼠位置資訊
  var selectedObj = -1; //選取的物件編號(-1表示沒有選取)
  var mouseObj = -1;
  var mousePart = {};
  var AddingObjType = ''; //拖曳空白處新增物件的類型
  var waitingRays = []; //待處理光線
  var waitingRayCount = 0; //待處理光線數量
  var rayDensity_light = 0.1; //光線密度(光線相關模式)
  var rayDensity_images = 1; //光線密度(像相關模式)
  var extendLight = false; //觀察者的影像
  var showLight = true; //顯示光線
  var gridSize = 20; //格線大小
  var origin = {x: 0, y: 0}; //格線原點座標
  var undoArr = []; //復原資料
  var undoIndex = 0; //目前復原的位置
  var undoLimit = 20; //復原步數上限
  var undoUBound = 0; //目前復原資料上界
  var undoLBound = 0; //目前復原資料下界
  var observer;
  var mode = 'light';
  var timerID = -1;
  var isDrawing = false;
  var hasExceededTime = false;
  var forceStop = false;
  var lastDrawTime = -1;
  var stateOutdated = false; //上次繪圖完後狀態已經變更
  var minShotLength = 1e-6; //光線兩次作用的最短距離(小於此距離的光線作用會被忽略)
  var minShotLength_squared = minShotLength * minShotLength;
  var snapToDirection_lockLimit_squared = 900; //拖曳物件且使用吸附至方向功能時鎖定吸附之方向所需的拖曳距離之平方
  var clickExtent_line = 10;
  var clickExtent_point = 10;
  var clickExtent_point_construct = 10;
  var tools_normal = ['laser', 'parallel', 'blackline', 'ruler', 'protractor', 'power', 'text', ''];
  var tools_withList = ['radiant_', 'mirror_', 'refractor_'];
  var tools_inList = ['radiant', 'led', 'mirror', 'arcmirror', 'idealmirror', 'lens', 'sphericallens', 'refractor', 'halfplane', 'circlelens', 'parabolicmirror', 'beamsplitter'];
  var modes = ['light', 'extended_light', 'images', 'observer'];
  var xyBox_cancelContextMenu = false;
  var scale = 1;
  var cartesianSign = false;
  var totalTruncation = 0;
  var backgroundImage = null;
  var restoredData = "";
  var colorMode = false;

  window.onload = function(e) {
    init_i18n();
    canvas = document.getElementById('canvas1');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx = canvas.getContext('2d');



    mouse = graphs.point(0, 0);
    //mode=document.getElementById("mode").value;
    //observer=graphs.circle(graphs.point(canvas.width*0.5,canvas.height*0.5),20);
    //document.getElementById('objAttr_text').value="";
    //toolbtn_clicked(AddingObjType);
    var needRestore = false;
    try {
      restoredData = localStorage.rayOpticsData;
      var jsonData = JSON.parse(restoredData);
      if (jsonData.objs.length > 0) {
        needRestore = true;
      }
    } catch { }

    if (needRestore) {
      document.getElementById('restore').style.display = '';
      initParameters();
      toolbtn_clicked('');
      window.toolBarViewModel.tools.selected("Move View");
      AddingObjType = '';
    } else {
      restoredData = '';
      initParameters();
    }

    undoArr[0] = document.getElementById('textarea1').value;
    document.getElementById('undo').disabled = true;
    document.getElementById('redo').disabled = true;

    window.onmousedown = function(e)
    {
      selectObj(-1);
    };
    window.ontouchstart = function(e)
    {
      selectObj(-1);
    };


    canvas.onmousedown = function(e)
    {
      //document.getElementById('objAttr_text').blur();
      // TODO: check that commenting out the above line does not cause problem.

      document.body.focus();
      canvas_onmousedown(e);
      e.cancelBubble = true;
      if (e.stopPropagation) e.stopPropagation();
      return false;
    };

    canvas.onmousemove = function(e)
    {
      canvas_onmousemove(e);
    };

    canvas.onmouseup = function(e)
    {
      canvas_onmouseup(e);
    };

    // IE9, Chrome, Safari, Opera
    canvas.addEventListener("mousewheel", canvas_onmousewheel, false);
    // Firefox
    canvas.addEventListener("DOMMouseScroll", canvas_onmousewheel, false);

    function canvas_onmousewheel(e) {
      // cross-browser wheel delta
      var e = window.event || e; // old IE support
      var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
      var d = scale;
      if (delta < 0) {
        d = scale * 0.9;
      } else if (delta > 0) {
        d = scale / 0.9;
      }
      d = Math.max(25, Math.min(500, d * 100));
      setScaleWithCenter(d / 100, (e.pageX - e.target.offsetLeft) / scale, (e.pageY - e.target.offsetTop) / scale);
      window.toolBarViewModel.zoom.value(d);
      return false;
    }

    canvas.ontouchstart = function(e)
    {
      //document.getElementById('objAttr_text').blur();
      // TODO: check that commenting out the above line does not cause problem.

      document.body.focus();
      canvas_onmousedown(e);
      e.cancelBubble = true;
      if (e.stopPropagation) e.stopPropagation();
    };

    canvas.ontouchmove = function(e)
    {
      canvas_onmousemove(e);
      e.preventDefault();
    };

    canvas.ontouchend = function(e)
    {
      canvas_onmouseup(e);
      e.preventDefault();
    };

    canvas.ontouchcancel = function(e)
    {
      canvas_onmouseup(e);
      undo();
      e.preventDefault();
    };

    canvas.ondblclick = function(e)
    {
      canvas_ondblclick(e);
    };


    tools_normal.forEach(function(element, index)
    {
      document.getElementById('tool_' + element).onmouseenter = function(e) {toolbtn_mouseentered(element, e);};
      document.getElementById('tool_' + element).onclick = function(e) {toolbtn_clicked(element, e);};
      cancelMousedownEvent('tool_' + element);
    });

    tools_withList.forEach(function(element, index)
    {
      document.getElementById('tool_' + element).onmouseenter = function(e) {toolbtnwithlist_mouseentered(element, e);};
      /*document.getElementById('tool_' + element).onclick = function(e) {toolbtnwithlist_mouseentered(element, e);};*/
      document.getElementById('tool_' + element).onclick = function(e) {toolbtn_clicked(element, e);};
      document.getElementById('tool_' + element).onmouseleave = function(e) {toolbtnwithlist_mouseleft(element, e);};
      document.getElementById('tool_' + element + 'list').onmouseleave = function(e) {toollist_mouseleft(element, e);};
      cancelMousedownEvent('tool_' + element);
    });

    tools_inList.forEach(function(element, index)
    {
      document.getElementById('tool_' + element).onclick = function(e) {toollistbtn_clicked(element, e);};
      cancelMousedownEvent('tool_' + element);
    });


    document.getElementById('undo').onclick = undo;
    cancelMousedownEvent('undo');
    document.getElementById('redo').onclick = redo;
    cancelMousedownEvent('redo');
    document.getElementById('reset').onclick = function() {initParameters();cancelRestore();createUndoPoint();};
    cancelMousedownEvent('reset');
    document.getElementById('accessJSON').onclick = accessJSON;
    cancelMousedownEvent('accessJSON');
    document.getElementById('save').onclick = function()
    {
      document.getElementById('saveBox').style.display = '';
      document.getElementById('save_name').select();
    };
    cancelMousedownEvent('save');
    document.getElementById('export_svg').onclick = exportSVG;
    cancelMousedownEvent('export_svg');
    document.getElementById('open').onclick = function()
    {
      document.getElementById('openfile').click();
    };
    cancelMousedownEvent('open');

    document.getElementById('openfile').onchange = function()
    {
      open(this.files[0]);
    };

    modes.forEach(function(element, index)
    {
    document.getElementById('mode_' + element).onclick = function() {
      modebtn_clicked(element);
      createUndoPoint();
    };
    cancelMousedownEvent('mode_' + element);
    });
    document.getElementById('zoom').oninput = function()
    {
      setScale(this.value / 100);
      draw();
    };
    document.getElementById('zoom_txt').onfocusout = function()
    {
      setScale(this.value / 100);
      draw();
    };
    document.getElementById('zoom_txt').onkeyup = function()
    {
      if (event.keyCode === 13) {
        setScale(this.value / 100);
        draw();
      }
    };
    document.getElementById('zoom').onmouseup = function()
    {
      setScale(this.value / 100); //為了讓不支援oninput的瀏覽器可使用
      createUndoPoint();
    };
    document.getElementById('zoom').ontouchend = function()
    {
      setScale(this.value / 100); //為了讓不支援oninput的瀏覽器可使用
      createUndoPoint();
    };
    cancelMousedownEvent('rayDensity');
    document.getElementById('rayDensity').oninput = function()
    {
      setRayDensity(Math.exp(this.value));
      draw();
    };
    document.getElementById('rayDensity_txt').onfocusout = function()
    {
      setRayDensity(Math.exp(this.value));
      draw();
    };
    document.getElementById('rayDensity_txt').onkeyup = function()
    {
      if (event.keyCode === 13) {
        setRayDensity(Math.exp(this.value));
        draw();
      }
    };
    document.getElementById('rayDensity').onmouseup = function()
    {
      setRayDensity(Math.exp(this.value)); //為了讓不支援oninput的瀏覽器可使用
      draw();
      createUndoPoint();
    };
    document.getElementById('rayDensity').ontouchend = function()
    {
      setRayDensity(Math.exp(this.value)); //為了讓不支援oninput的瀏覽器可使用
      draw();
      createUndoPoint();
    };
    cancelMousedownEvent('rayDensity');
    cancelMousedownEvent('lockobjs_');
    cancelMousedownEvent('grid_');
    document.getElementById('showgrid_').onclick = function() {draw()};
    document.getElementById('showgrid').onclick = function() {draw()};
    cancelMousedownEvent('showgrid_');

    document.getElementById('forceStop').onclick = function()
    {
      if (timerID != -1)
      {
        forceStop = true;
      }
    };
    cancelMousedownEvent('forceStop');
    document.getElementById('restore').onclick = function() {restore()};
    cancelMousedownEvent('restore');
    cancelMousedownEvent('setAttrAll');
    cancelMousedownEvent('setAttrAll_');

    document.getElementById('copy').onclick = function()
    {
      objs[objs.length] = JSON.parse(JSON.stringify(objs[selectedObj]));
      draw();
      createUndoPoint();
    };
    cancelMousedownEvent('copy');
    document.getElementById('delete').onclick = function()
    {
      removeObj(selectedObj);
      draw();
      createUndoPoint();
    };
    cancelMousedownEvent('delete');
    document.getElementById('textarea1').onchange = function()
    {
      JSONInput();
      createUndoPoint();
    };



    document.getElementById('save_name').onkeydown = function(e)
    {
      //console.log(e.keyCode)
      if (e.keyCode == 13)
      {
        //enter
        document.getElementById('save_confirm').onclick();
      }
      if (e.keyCode == 27)
      {
        //esc
        document.getElementById('save_cancel').onclick();
      }

      e.cancelBubble = true;
      if (e.stopPropagation) e.stopPropagation();
    };
    document.getElementById('save_cancel').onclick = function()
    {
      document.getElementById('saveBox').style.display = 'none';
    };
    document.getElementById('save_confirm').onclick = save;

    cancelMousedownEvent('saveBox');


    document.getElementById('xybox').onkeydown = function(e)
    {
      //console.log(e.keyCode)
      if (e.keyCode == 13)
      {
        //enter
        confirmPositioning(e.ctrlKey, e.shiftKey);
      }
      if (e.keyCode == 27)
      {
        //esc
        endPositioning();
      }

      e.cancelBubble = true;
      if (e.stopPropagation) e.stopPropagation();
    };

    document.getElementById('xybox').oninput = function(e)
    {
      this.size = this.value.length;
    };

    document.getElementById('xybox').addEventListener('contextmenu', function(e) {
      if (xyBox_cancelContextMenu)
      {
         e.preventDefault();
         xyBox_cancelContextMenu = false;
      }
        }, false);

    cancelMousedownEvent('xybox');


    window.ondragenter = function(e)
    {
      e.stopPropagation();
      e.preventDefault();
    };

    window.ondragover = function(e)
    {
      e.stopPropagation();
      e.preventDefault();
    };

    window.ondrop = function(e)
    {
      e.stopPropagation();
      e.preventDefault();

      var dt = e.dataTransfer;
      if (dt.files[0])
      {
        var files = dt.files;
        open(files[0]);
      }
      else
      {
        var fileString = dt.getData('text');
        document.getElementById('textarea1').value = fileString;
        selectedObj = -1;
        JSONInput();
        createUndoPoint();
      }
    };

    canvas.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        }, false);


    var i;
    var samples = [ "reflect.json", "internal-reflection.json", "parabolic-mirror.json", "prisms.json", "lens-images.json",
		    "convex-lens.json", "concave-lens.json", "spherical-aberration.json", "zoom-lens.json",
                    "apparent-depth-of-an-object-under-water.json", "compound-microscope.json", "images-formed-by-two-mirrors.json",
                    "reflection-and-refraction-of-a-single-ray.json", "spherical-lens-and-mirror.json" ];
    for (i = 1; ; i++) {
      var elt = document.getElementById("sample" + i);
      if (!elt) break;
      const ii = i;
      elt.onclick = function () { openSample(samples[ii-1]); };
    }

    //toolbtn_clicked('laser');
  };

  function openSample(name) {
    var client = new XMLHttpRequest();
    client.open('GET', '../samples/' + name);
    client.onload = function() {
      if (client.status >= 300)
        return;
      document.getElementById('textarea1').value = client.responseText;
      JSONInput();
      cancelRestore();
      createUndoPoint();
    }
    client.send();
  }

  //========================畫出物件=================================

  function draw()
  {
    stateOutdated = true;
    totalTruncation = 0;
    document.getElementById('forceStop').style.display = 'none';
    if (timerID != -1)
    {
      //若程式正在處理上一次的繪圖,則停止處理
      clearTimeout(timerID);
      timerID = -1;
      isDrawing = false;
    }

    if (!isDrawing)
    {
      isDrawing = true;
      draw_();
    }
  }


  function draw_() {
    if (!stateOutdated)
    {
      isDrawing = false;
      return;
    }
    stateOutdated = false;

    JSONOutput();
    canvasPainter.cls(); //清空Canvas
    ctx.globalAlpha = 1;
    hasExceededTime = false;
    waitingRays = []; //清空等待區
    shotRayCount = 0;



    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (document.getElementById('showgrid').checked && ctx.constructor != C2S)
    {
      //畫出格線
      //ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgb(64,64,64)';
      var dashstep = 4;
      ctx.beginPath();
      for (var x = origin.x / scale % gridSize; x <= canvas.width / scale; x += gridSize)
      {
        for (var y = 0; y <= canvas.height / scale; y += dashstep)
        {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + dashstep * 0.5);
        }
      }
      for (var y = origin.y / scale % gridSize; y <= canvas.height / scale; y += gridSize)
      {
        for (var x = 0; x <= canvas.width / scale; x += dashstep)
        {
          ctx.moveTo(x, y);
          ctx.lineTo(x + dashstep * 0.5, y);
        }
      }
      ctx.stroke();
    }
    ctx.restore();


    //畫出物件
    for (var i = 0; i < objs.length; i++)
    {
      objTypes[objs[i].type].draw(objs[i], canvas); //畫出objs[i]
      if (objTypes[objs[i].type].shoot)
      {
        objTypes[objs[i].type].shoot(objs[i]); //若objs[i]能射出光線,讓它射出
      }
    }
    shootWaitingRays();
    if (mode == 'observer')
    {
      //畫出即時觀察者
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.fillStyle = 'blue';
      ctx.arc(observer.c.x, observer.c.y, observer.r, 0, Math.PI * 2, false);
      ctx.fill();
    }
    lastDrawTime = new Date();
    //ctx.setTransform(1,0,0,1,0,0);
  }



  //////////////////////////////////////////////////////////////////////////////////////////////////////
  //========================================光線處理區==================================================
  //////////////////////////////////////////////////////////////////////////////////////////////////////

  //====================將一道光放入等待區=========================
  function addRay(ray) {
    waitingRays[waitingRays.length] = ray;
  }

  //==================取得目前模式的光線密度======================
  function getRayDensity()
  {
    if (mode == 'images' || mode == 'observer')
    {
      return rayDensity_images;
    }
    else
    {
      return rayDensity_light;
    }
  }


  //====================射出等待區的光線=========================
  function shootWaitingRays() {
    timerID = -1;
    var st_time = new Date();
    //var instantObserver=mode=="observer";
    var alpha0 = 1;
    //var alpha0=document.getElementById("lightAlpha").value;
    ctx.globalAlpha = alpha0;
    //canvas.getContext('2d').lineWidth = 2;
    var ray1;
    var observed;
    var last_ray;
    var last_intersection;
    var s_obj;
    var s_obj_index;
    var last_s_obj_index;
    var s_point;
    var s_point_temp;
    //var s_len;
    var s_lensq;
    var s_lensq_temp;
    var observed_point;
    var observed_intersection;
    var rpd;
    var leftRayCount = waitingRays.length;
    var surfaceMerging_objs = [];
    
    //ctx.beginPath();
    if (colorMode) {
      ctx.globalCompositeOperation = 'screen';
    }
    while (leftRayCount != 0 && !forceStop)
    {
      if (new Date() - st_time > 200 && ctx.constructor != C2S)
      {
        //若已計算超過200ms
        //先休息10ms後再繼續(防止程式沒有回應)
        document.getElementById('status').innerHTML = shotRayCount + ' rays (' + leftRayCount + ' waiting)'; //顯示狀態
        hasExceededTime = true;
        timerID = setTimeout(shootWaitingRays, 10); //10ms後再回來此function
        document.getElementById('forceStop').style.display = '';
        //console.log(timerID)
        return; //跳出此function
      }

      leftRayCount = 0; //重新開始計算剩餘光線數量
      last_s_obj_index = -1;
      last_ray = null;
      last_intersection = null;
      for (var j = 0; j < waitingRays.length; j++)
      {
        if (waitingRays[j] && waitingRays[j].exist)
        {
          //若waitingRays[j]存在
          //開始射出waitingRays[j](等待區的最後一條光線)
          //判斷這道光射出後,會先撞到哪一個物件

          //↓搜尋每一個"與這道光相交的物件",尋找"[物件與光線的交點]離[光線的頭]最近的物件"
          s_obj = null; //"到目前為止,已檢查的物件中[與光線的交點]離[光線的頭]最近的物件"
          s_obj_index = -1;
          s_point = null;  //s_obj與光線的交點
          surfaceMerging_objs = []; //要與射到的物件進行界面融合的物件
          //surfaceMerging_obj_index=-1;
          //s_len=Infinity;
          s_lensq = Infinity; //將 "[s_obj與光線的交點]和[光線的頭]之間的距離平方" 設為無限大(因為目前尚未檢查任何物件,而現在是要尋找最小值)
          observed = false; //waitingRays[j]是否被觀察者看到
          for (var i = 0; i < objs.length; i++)
          {
            //↓若objs[i]會影響到光
            if (objTypes[objs[i].type].rayIntersection) {
              //↓判斷objs[i]是否與這道光相交
              s_point_temp = objTypes[objs[i].type].rayIntersection(objs[i], waitingRays[j]);
              if (s_point_temp)
              {
                //此時代表objs[i]是"與這道光相交的物件",交點是s_point_temp
                s_lensq_temp = graphs.length_squared(waitingRays[j].p1, s_point_temp); //交點到[光線的頭]的距離
                if (s_point && graphs.length_squared(s_point_temp, s_point) < minShotLength_squared && (objTypes[objs[i].type].supportSurfaceMerging || objTypes[s_obj.type].supportSurfaceMerging))
                {
                  //這道光同時射到兩個物件,且至少有一個支援界面融合

                  if (objTypes[s_obj.type].supportSurfaceMerging)
                  {
                    if (objTypes[objs[i].type].supportSurfaceMerging)
                    {
                      //兩個都支援界面融合(例如兩個折射鏡以一條邊相連)
                      surfaceMerging_objs[surfaceMerging_objs.length] = objs[i];
                    }
                    else
                    {
                      //只有先射到的界面支援界面融合
                      //將擬定射到的物件設為不支援界面融合者(如折射鏡邊界與一遮光片重合,則只執行遮光片的動作)
                      s_obj = objs[i];
                      s_obj_index = i;
                      s_point = s_point_temp;
                      s_lensq = s_lensq_temp;

                      surfaceMerging_objs = [];
                    }
                  }
                }
                else if (s_lensq_temp < s_lensq && s_lensq_temp > minShotLength_squared)
                {
                  //↑若 "[objs[i]與光線的交點]和[光線的頭]之間的的距離" 比 "到目前為止,已檢查的物件中[與光線的交點]離[光線的頭]最近的物件"的還短

                  s_obj = objs[i]; //更新"到目前為止,已檢查的物件中[物件與光線的交點]離[光線的頭]最近的物件"
                  s_obj_index = i;
                  s_point = s_point_temp; //s_point也一起更新
                  s_lensq = s_lensq_temp; //s_len也一起更新

                  surfaceMerging_objs = [];
                }
              }
            }
          }
          if (colorMode) {
            var color = wavelengthToColor(waitingRays[j].wavelength, (waitingRays[j].brightness_s + waitingRays[j].brightness_p));
          } else {
            ctx.globalAlpha = alpha0 * (waitingRays[j].brightness_s + waitingRays[j].brightness_p);
          }
          //↓若光線沒有射到任何物件
          if (s_lensq == Infinity)
          {
            if (mode == 'light' || mode == 'extended_light')
            {
              if (colorMode) {
                canvasPainter.draw(waitingRays[j], color); //畫出這條光線
              } else {
                canvasPainter.draw(waitingRays[j], 'rgb(255,255,128)'); //畫出這條光線
              }
              //if(waitingRays[j].gap)canvasPainter.draw(waitingRays[j],canvas,"rgb(0,0,255)");
            }
            if (mode == 'extended_light' && !waitingRays[j].isNew)
            {
              if (colorMode) {
                ctx.setLineDash([2, 2]);
                canvasPainter.draw(graphs.ray(waitingRays[j].p1, graphs.point(waitingRays[j].p1.x * 2 - waitingRays[j].p2.x, waitingRays[j].p1.y * 2 - waitingRays[j].p2.y)), color); //畫出這條光的延長線
                ctx.setLineDash([]);
              } else {
                canvasPainter.draw(graphs.ray(waitingRays[j].p1, graphs.point(waitingRays[j].p1.x * 2 - waitingRays[j].p2.x, waitingRays[j].p1.y * 2 - waitingRays[j].p2.y)), 'rgb(255,128,0)'); //畫出這條光的延長線
              }
            }

            if (mode == 'observer')
            {
              //使用即時觀察者
              observed_point = graphs.intersection_line_circle(waitingRays[j], observer)[2];
              if (observed_point)
              {
                if (graphs.intersection_is_on_ray(observed_point, waitingRays[j]))
                {
                  observed = true;
                }
              }
            }

            //waitingRays[j]=null  //將這條光線從等待區中移除
            //這道光已射到無窮遠處,不需要再處理
          }
          else
          {
            //此時,代表光線會在射出經過s_len(距離)後,在s_point(位置)撞到s_obj(物件)
            if (mode == 'light' || mode == 'extended_light')
            {
              if (colorMode) {
                canvasPainter.draw(graphs.segment(waitingRays[j].p1, s_point), color); //畫出這條光線
              } else {
                canvasPainter.draw(graphs.segment(waitingRays[j].p1, s_point), 'rgb(255,255,128)'); //畫出這條光線
              }
              //if(waitingRays[j].gap)canvasPainter.draw(graphs.segment(waitingRays[j].p1,s_point),canvas,"rgb(0,0,255)");
            }
            if (mode == 'extended_light' && !waitingRays[j].isNew)
            {
              if (colorMode) {
                ctx.setLineDash([2, 2]);
                canvasPainter.draw(graphs.ray(waitingRays[j].p1, graphs.point(waitingRays[j].p1.x * 2 - waitingRays[j].p2.x, waitingRays[j].p1.y * 2 - waitingRays[j].p2.y)), color); //畫出這條光的延長線
                ctx.setLineDash([1, 5]);
                canvasPainter.draw(graphs.ray(s_point, graphs.point(s_point.x * 2 - waitingRays[j].p1.x, s_point.y * 2 - waitingRays[j].p1.y)), color); //畫出這條光向前的延長線
                ctx.setLineDash([]);
              } else {
                canvasPainter.draw(graphs.ray(waitingRays[j].p1, graphs.point(waitingRays[j].p1.x * 2 - waitingRays[j].p2.x, waitingRays[j].p1.y * 2 - waitingRays[j].p2.y)), 'rgb(255,128,0)'); //畫出這條光的延長線
                canvasPainter.draw(graphs.ray(s_point, graphs.point(s_point.x * 2 - waitingRays[j].p1.x, s_point.y * 2 - waitingRays[j].p1.y)), 'rgb(80,80,80)'); //畫出這條光向前的延長線
              }

            }

            if (mode == 'observer')
            {
              //使用即時觀察者
              observed_point = graphs.intersection_line_circle(waitingRays[j], observer)[2];

              if (observed_point)
              {

                if (graphs.intersection_is_on_segment(observed_point, graphs.segment(waitingRays[j].p1, s_point)))
                {
                  observed = true;
                }
              }
            }


          }
          if (mode == 'observer' && last_ray)
          {
            //模式:即時觀察者
            if (!waitingRays[j].gap)
            {
              observed_intersection = graphs.intersection_2line(waitingRays[j], last_ray); //觀察到的光線之交點

              if (observed)
              {
                if (last_intersection && graphs.length_squared(last_intersection, observed_intersection) < 25)
                {
                  //當交點彼此相當靠近
                  if (graphs.intersection_is_on_ray(observed_intersection, graphs.ray(observed_point, waitingRays[j].p1)) && graphs.length_squared(observed_point, waitingRays[j].p1) > 1e-5)
                  {


                    if (colorMode) {
                      var color = wavelengthToColor(waitingRays[j].wavelength, (waitingRays[j].brightness_s + waitingRays[j].brightness_p) * 0.5);
                    } else {
                      ctx.globalAlpha = alpha0 * ((waitingRays[j].brightness_s + waitingRays[j].brightness_p) + (last_ray.brightness_s + last_ray.brightness_p)) * 0.5;
                    }
                    if (s_point)
                    {
                      rpd = (observed_intersection.x - waitingRays[j].p1.x) * (s_point.x - waitingRays[j].p1.x) + (observed_intersection.y - waitingRays[j].p1.y) * (s_point.y - waitingRays[j].p1.y);
                      //(observed_intersection-waitingRays[j].p1)與(s_point-waitingRays[j].p1)之內積
                    }
                    else
                    {
                      rpd = (observed_intersection.x - waitingRays[j].p1.x) * (waitingRays[j].p2.x - waitingRays[j].p1.x) + (observed_intersection.y - waitingRays[j].p1.y) * (waitingRays[j].p2.y - waitingRays[j].p1.y);
                      //(observed_intersection-waitingRays[j].p1)與(waitingRays[j].p2-waitingRays[j].p1)之內積
                    }
                    if (rpd < 0)
                    {
                      //虛像
                      if (colorMode) {
                        ctx.fillStyle = color;
                        ctx.fillRect(observed_intersection.x - 1, observed_intersection.y - 1, 3, 3);
                      } else {
                        canvasPainter.draw(observed_intersection, 'rgb(255,128,0)'); //畫出像
                      }
                        //}
                    }
                    else if (rpd < s_lensq)
                    {
                      //實像
                      if (colorMode) {
                        canvasPainter.draw(observed_intersection, color); //畫出像
                      } else {
                        canvasPainter.draw(observed_intersection, 'rgb(255,255,128)'); //畫出像
                      }
                    }
                      if (colorMode) {
                        ctx.setLineDash([1, 2]);
                        canvasPainter.draw(graphs.segment(observed_point, observed_intersection), color); //畫出觀察到的光線(射線)
                        ctx.setLineDash([]);
                      } else {
                        canvasPainter.draw(graphs.segment(observed_point, observed_intersection), 'rgb(0,0,255)'); //畫出連線
                      }
                  }
                  else
                  {
                    if (colorMode) {
                      ctx.setLineDash([1, 2]);
                      canvasPainter.draw(graphs.ray(observed_point, waitingRays[j].p1), color); //畫出觀察到的光線(射線)
                      ctx.setLineDash([]);
                    } else {
                      canvasPainter.draw(graphs.ray(observed_point, waitingRays[j].p1), 'rgb(0,0,255)'); //畫出觀察到的光線(射線)
                    }
                  }
                }
                else //if(last_intersection && (last_intersection.x*last_intersection.x+last_intersection.y*last_intersection.y>100))
                {
                  if (last_intersection)
                  {
                    if (colorMode) {
                      ctx.setLineDash([1, 2]);
                      canvasPainter.draw(graphs.ray(observed_point, waitingRays[j].p1), color); //畫出觀察到的光線(射線)
                      ctx.setLineDash([]);
                    } else {
                      canvasPainter.draw(graphs.ray(observed_point, waitingRays[j].p1), 'rgb(0,0,255)'); //畫出觀察到的光線(射線)
                    }
                  }
                  /*
                  else
                  {
                    canvasPainter.draw(graphs.ray(observed_point,waitingRays[j].p1),canvas,"rgb(255,0,0)");
                  }
                  */
                }
              }
              last_intersection = observed_intersection;
            }
            else
            {
              last_intersection = null;
            }
          }

          if (mode == 'images' && last_ray)
          {
            //模式:像
            if (!waitingRays[j].gap)
            {

              observed_intersection = graphs.intersection_2line(waitingRays[j], last_ray);
              if (last_intersection && graphs.length_squared(last_intersection, observed_intersection) < 25)
              {
                if (colorMode) {
                  var color = wavelengthToColor(waitingRays[j].wavelength, (waitingRays[j].brightness_s + waitingRays[j].brightness_p) * 0.5);
                } else {
                  ctx.globalAlpha = alpha0 * ((waitingRays[j].brightness_s + waitingRays[j].brightness_p) + (last_ray.brightness_s + last_ray.brightness_p)) * 0.5;
                }

                if (s_point)
                {
                  rpd = (observed_intersection.x - waitingRays[j].p1.x) * (s_point.x - waitingRays[j].p1.x) + (observed_intersection.y - waitingRays[j].p1.y) * (s_point.y - waitingRays[j].p1.y);
                  //(observed_intersection-waitingRays[j].p1)與(s_point-waitingRays[j].p1)之內積
                }
                else
                {
                  rpd = (observed_intersection.x - waitingRays[j].p1.x) * (waitingRays[j].p2.x - waitingRays[j].p1.x) + (observed_intersection.y - waitingRays[j].p1.y) * (waitingRays[j].p2.y - waitingRays[j].p1.y);
                  //(observed_intersection-waitingRays[j].p1)與(waitingRays[j].p2-waitingRays[j].p1)之內積
                }

                if (rpd < 0)
                {
                  //虛像
                  if (colorMode) {
                    ctx.fillStyle = color;
                    ctx.fillRect(observed_intersection.x - 1, observed_intersection.y - 1, 3, 3);
                  } else {
                    canvasPainter.draw(observed_intersection, 'rgb(255,128,0)'); //畫出像
                  }
                }
                else if (rpd < s_lensq)
                {
                  //實像
                  if (colorMode) {
                    canvasPainter.draw(observed_intersection, color); //畫出像
                  } else {
                    canvasPainter.draw(observed_intersection, 'rgb(255,255,128)'); //畫出像
                  }
                }
                else
                {
                  //虛物
                  if (colorMode) {
                    ctx.fillStyle = color;
                    ctx.fillRect(observed_intersection.x, observed_intersection.y, 1, 1);
                  } else {
                    canvasPainter.draw(observed_intersection, 'rgb(80,80,80)'); //畫出像
                  }
                }
              }
              last_intersection = observed_intersection;
            }

          }




          if (last_s_obj_index != s_obj_index)
          {
            waitingRays[j].gap = true;
          }
          waitingRays[j].isNew = false;


          //==================
          //last_ray=waitingRays[j];
          last_ray = {p1: waitingRays[j].p1, p2: waitingRays[j].p2};
          //last_s_obj=s_obj;
          last_s_obj_index = s_obj_index;
          if (s_obj)
          {
            objTypes[s_obj.type].shot(s_obj, waitingRays[j], j, s_point, surfaceMerging_objs);
          }
          else
          {
            waitingRays[j] = null;
          }

          shotRayCount = shotRayCount + 1; //已處理光線數量+1
          if (waitingRays[j] && waitingRays[j].exist)
          {
            leftRayCount = leftRayCount + 1;
          }
          //這道光線處理完畢
        }
      }

    }
    if (colorMode && ctx.constructor != C2S) {
      // Inverse transformation of the color adjustment made in wavelengthToColor.
      // This is to avoid the color satiation problem when using the 'lighter' composition.
      // Currently not supported when exporting to SVG.
      var imageData = ctx.getImageData(0.0, 0.0, canvas.width, canvas.height);
      var data = imageData.data;
      for (var i = 0; i < data.length; i += 4) {
          var R = - Math.log(1-(data[i] / 256));
          var G = - Math.log(1-(data[i+1] / 256));
          var B = - Math.log(1-(data[i+2] / 256));
          var factor = Math.max(R,G,B,1);
          data[i] = 255 * R / factor;
          data[i+1] = 255 * G / factor;
          data[i+2] = 255 * B / factor;
      }
      ctx.putImageData(imageData, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1.0;
    //if(showLight)
    //{
      for (var i = 0; i < objs.length; i++)
        {
        objTypes[objs[i].type].draw(objs[i], canvas, true); //畫出objs[i]
        }
    //}
    if (mode == 'observer')
    {
      //畫出即時觀察者
      //var ctx = canvas.getContext('2d');
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.fillStyle = 'blue';
      ctx.arc(observer.c.x, observer.c.y, observer.r, 0, Math.PI * 2, false);
      ctx.fill();
    }
    if (forceStop)
    {
      document.getElementById('status').innerHTML = shotRayCount + ' rays (stopped)';
      forceStop = false;
    }
    else if (hasExceededTime)
    {
      document.getElementById('status').innerHTML = shotRayCount + ' rays';
    }
    else
    {
      document.getElementById('status').innerHTML = shotRayCount + ' rays (' + (new Date() - st_time) + 'ms)';
    }
    document.getElementById('forceStop').style.display = 'none';
    //ctx.stroke();
    setTimeout(draw_, 10);

  }



  //////////////////////////////////////////////////////////////////////////////////////////////////////
  //========================================滑鼠動作區==================================================
  //////////////////////////////////////////////////////////////////////////////////////////////////////


  function mouseOnPoint(mouse, point)
  {
    return graphs.length_squared(mouse, point) < clickExtent_point * clickExtent_point;
  }

  function mouseOnPoint_construct(mouse, point)
  {
    return graphs.length_squared(mouse, point) < clickExtent_point_construct * clickExtent_point_construct;
  }

  function mouseOnSegment(mouse, segment)
  {
    var d_per = Math.pow((mouse.x - segment.p1.x) * (segment.p1.y - segment.p2.y) + (mouse.y - segment.p1.y) * (segment.p2.x - segment.p1.x), 2) / ((segment.p1.y - segment.p2.y) * (segment.p1.y - segment.p2.y) + (segment.p2.x - segment.p1.x) * (segment.p2.x - segment.p1.x)); //類似於滑鼠與直線垂直距離
    var d_par = (segment.p2.x - segment.p1.x) * (mouse.x - segment.p1.x) + (segment.p2.y - segment.p1.y) * (mouse.y - segment.p1.y); //類似於滑鼠在直線上投影位置
    return d_per < clickExtent_line * clickExtent_line && d_par >= 0 && d_par <= graphs.length_segment_squared(segment);
  }

  function mouseOnLine(mouse, line)
  {
    var d_per = Math.pow((mouse.x - line.p1.x) * (line.p1.y - line.p2.y) + (mouse.y - line.p1.y) * (line.p2.x - line.p1.x), 2) / ((line.p1.y - line.p2.y) * (line.p1.y - line.p2.y) + (line.p2.x - line.p1.x) * (line.p2.x - line.p1.x)); //類似於滑鼠與直線垂直距離
    return d_per < clickExtent_line * clickExtent_line;
  }

  //將滑鼠位置吸附至指定的方向中之最接近者(該方向直線上之投影點)
  function snapToDirection(mouse, basePoint, directions, snapData)
  {
    var x = mouse.x - basePoint.x;
    var y = mouse.y - basePoint.y;

    if (snapData && snapData.locked)
    {
      //已經鎖定吸附對象
      var k = (directions[snapData.i0].x * x + directions[snapData.i0].y * y) / (directions[snapData.i0].x * directions[snapData.i0].x + directions[snapData.i0].y * directions[snapData.i0].y);
      return graphs.point(basePoint.x + k * directions[snapData.i0].x, basePoint.y + k * directions[snapData.i0].y);
    }
    else
    {
      var i0;
      var d_sq;
      var d0_sq = Infinity;
      for (var i = 0; i < directions.length; i++)
      {
        d_sq = (directions[i].y * x - directions[i].x * y) * (directions[i].y * x - directions[i].x * y) / (directions[i].x * directions[i].x + directions[i].y * directions[i].y);
        if (d_sq < d0_sq)
        {
          d0_sq = d_sq;
          i0 = i;
        }
      }

      if (snapData && x * x + y * y > snapToDirection_lockLimit_squared)
      {
        //鎖定吸附對象
        snapData.locked = true;
        snapData.i0 = i0;
      }

      var k = (directions[i0].x * x + directions[i0].y * y) / (directions[i0].x * directions[i0].x + directions[i0].y * directions[i0].y);
      return graphs.point(basePoint.x + k * directions[i0].x, basePoint.y + k * directions[i0].y);
    }
  }

  //================================================================================================================================
  //=========================================================MouseDown==============================================================
  function canvas_onmousedown(e) {
  //滑鼠按下時
  //console.log(e.which);
  if (e.changedTouches) {
    var et = e.changedTouches[0];
  } else {
    var et = e;
  }
  var mouse_nogrid = graphs.point((et.pageX - e.target.offsetLeft - origin.x) / scale, (et.pageY - e.target.offsetTop - origin.y) / scale); //滑鼠實際位置
  mouse_lastmousedown = mouse_nogrid;
  if (positioningObj != -1)
  {
    confirmPositioning(e.ctrlKey, e.shiftKey);
    if (!(e.which && e.which == 3))
    {
      return;
    }
  }


  if (!((e.which && (e.which == 1 || e.which == 3)) || (e.changedTouches)))
  {
    return;
  }

  //if(document.getElementById("grid").checked || e.altKey)
  if (document.getElementById('grid').checked)
  {
    //使用格線
    mouse = graphs.point(Math.round(((et.pageX - e.target.offsetLeft - origin.x) / scale) / gridSize) * gridSize, Math.round(((et.pageY - e.target.offsetTop - origin.y) / scale) / gridSize) * gridSize);

  }
  else
  {
    //不使用格線
    mouse = mouse_nogrid;
  }



  if (isConstructing)
  {
    if ((e.which && e.which == 1) || (e.changedTouches))
    {
      //只有滑鼠左鍵才反應
      //若有一個物件正在被建立,則將動作直接傳給它
      objTypes[objs[objs.length - 1].type].c_mousedown(objs[objs.length - 1], mouse);
    }
  }
  else
  {
    // lockobjs prevents selection, but alt overrides it
    if ((!(document.getElementById('lockobjs').checked) != (e.altKey && AddingObjType != '')) && !(e.which == 3))
    {
      //搜尋每個物件,尋找滑鼠按到的物件

      draggingPart = {};

      if (mode == 'observer')
      {
        if (graphs.length_squared(mouse_nogrid, observer.c) < observer.r * observer.r)
        {
          //滑鼠按到觀察者
          draggingObj = -4;
          draggingPart = {};
          //draggingPart.part=0;
          draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置
          draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置
          draggingPart.snapData = {};
          return;
        }
      }

      var ret = selectionSearch(mouse_nogrid);
      if (ret.targetObj_index != -1)
        {
        //最後決定選擇targetObj_index
        selectObj(ret.targetObj_index);
        draggingPart = ret.mousePart;
        draggingPart.originalObj = JSON.parse(JSON.stringify(objs[ret.targetObj_index])); //暫存拖曳前的物件狀態
        draggingPart.hasDuplicated = false;
        draggingObj = ret.targetObj_index;
        return;
        }
      }

    if (draggingObj == -1)
      {
      //====================滑鼠按到了空白處=============================
       if ((AddingObjType == '') || (e.which == 3))
       {
       //====================準備平移整個畫面===========================
         draggingObj = -3;
         draggingPart = {};
         //draggingPart.part=0;
         draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置
         draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置
         draggingPart.mouse2 = origin; //Original origin.
         draggingPart.snapData = {};
         document.getElementById('obj_settings').style.display = 'none';
         selectedObj = -1;
       }
       else
       {
       //=======================建立新的物件========================
        objs[objs.length] = objTypes[AddingObjType].create(mouse);
        isConstructing = true;
        constructionPoint = mouse;
        if (objs[selectedObj])
        {
          if (hasSameAttrType(objs[selectedObj], objs[objs.length - 1]) && objs[selectedObj].p)
          {
            objs[objs.length - 1].p = objs[selectedObj].p; //讓此物件的附加屬性與上一個選取的物件相同(若類型相同)
            // TODO: Generalized this to other properties.
          }
        }
        selectObj(objs.length - 1);
        objTypes[objs[objs.length - 1].type].c_mousedown(objs[objs.length - 1], mouse);
        cancelRestore();
       }
      }
  }
  }

  // search for best object to select at mouse position
  function selectionSearch(mouse_nogrid) {
    var i;
    var mousePart_;
    var click_lensq = Infinity;
    var click_lensq_temp;
    var targetObj_index = -1;
    //var targetObj_index_temp;
    var targetIsPoint = false;
    var mousePart;

    for (var i = 0; i < objs.length; i++) {
      if (typeof objs[i] != 'undefined') {
        mousePart_ = {};
        if (objTypes[objs[i].type].clicked(objs[i], mouse_nogrid, mouse, mousePart_)) {
          //clicked()回傳true表示滑鼠按到了該物件

          if (mousePart_.targetPoint) {
            //滑鼠按到一個點
            targetIsPoint = true; //一旦發現能夠按到點,就必須按到點
            var click_lensq_temp = graphs.length_squared(mouse_nogrid, mousePart_.targetPoint);
            if (click_lensq_temp <= click_lensq) {
              targetObj_index = i; //按到點的情況下,選擇最接近滑鼠的
              click_lensq = click_lensq_temp;
              mousePart = mousePart_;
            }
          } else if (!targetIsPoint) {
            //滑鼠按到的不是點,且到目前為止未按到點
            targetObj_index = i; //按到非點的情況下,選擇最後建立的
            mousePart = mousePart_;
          }
        }
      }
    }
    return { mousePart: mousePart, targetObj_index: targetObj_index };
  }


  //================================================================================================================================
  //========================================================MouseMove===============================================================
  function canvas_onmousemove(e) {
  //滑鼠移動時
  if (e.changedTouches) {
    var et = e.changedTouches[0];
  } else {
    var et = e;
  }
  var mouse_nogrid = graphs.point((et.pageX - e.target.offsetLeft - origin.x) / scale, (et.pageY - e.target.offsetTop - origin.y) / scale); //滑鼠實際位置
  var mouse2;
  //if(document.getElementById("grid").checked != e.altKey)
  if (document.getElementById('grid').checked && !(e.altKey && !isConstructing))
  {
    //使用格線
    mouse2 = graphs.point(Math.round(((et.pageX - e.target.offsetLeft - origin.x) / scale) / gridSize) * gridSize, Math.round(((et.pageY - e.target.offsetTop - origin.y) / scale) / gridSize) * gridSize);
  }
  else
  {
    //不使用格線
    mouse2 = mouse_nogrid;
  }

  if (mouse2.x == mouse.x && mouse2.y == mouse.y)
  {
    return;
  }
  mouse = mouse2;


  if (isConstructing)
  {
    // highlight object being constructed
    mouseObj = objs[objs.length-1];

    //若有一個物件正在被建立,則將動作直接傳給它
    objTypes[objs[objs.length - 1].type].c_mousemove(objs[objs.length - 1], mouse, e.ctrlKey, e.shiftKey);
  }
  else
  {
    var instantObserver = mode == 'observed_light' || mode == 'observed_images';
    if (draggingObj == -4)
    {
      if (e.shiftKey)
      {
        var mouse_snapped = snapToDirection(mouse, draggingPart.mouse0, [{x: 1, y: 0},{x: 0, y: 1}], draggingPart.snapData);
      }
      else
      {
        var mouse_snapped = mouse;
        draggingPart.snapData = {}; //放開shift時解除原先之拖曳方向鎖定
      }

      var mouseDiffX = (mouse_snapped.x - draggingPart.mouse1.x); //目前滑鼠位置與上一次的滑鼠位置的X軸差
      var mouseDiffY = (mouse_snapped.y - draggingPart.mouse1.y); //目前滑鼠位置與上一次的滑鼠位置的Y軸差

      observer.c.x += mouseDiffX;
      observer.c.y += mouseDiffY;

      //更新滑鼠位置
      draggingPart.mouse1 = mouse_snapped;
      draw();
    }

    var returndata;
    if (draggingObj >= 0)
      {
       //此時,代表滑鼠正在拖曳一個物件

      objTypes[objs[draggingObj].type].dragging(objs[draggingObj], mouse, draggingPart, e.ctrlKey, e.shiftKey);
      //如果正在拖曳整個物件,則按Ctrl鍵時複製原物件
      if (draggingPart.part == 0)
      {
        if (e.ctrlKey && !draggingPart.hasDuplicated)
        {

          objs[objs.length] = draggingPart.originalObj;
          draggingPart.hasDuplicated = true;
        }
        if (!e.ctrlKey && draggingPart.hasDuplicated)
        {
          objs.length--;
          draggingPart.hasDuplicated = false;
        }
      }

      draw();
      }

    if (draggingObj == -3)
    {
      //====================平移整個畫面===========================
      //此時mouse為目前滑鼠位置,draggingPart.mouse1為上一次的滑鼠位置

      if (e.shiftKey)
      {
        var mouse_snapped = snapToDirection(mouse_nogrid, draggingPart.mouse0, [{x: 1, y: 0},{x: 0, y: 1}], draggingPart.snapData);
      }
      else
      {
        var mouse_snapped = mouse_nogrid;
        draggingPart.snapData = {}; //放開shift時解除原先之拖曳方向鎖定
      }

      var mouseDiffX = (mouse_snapped.x - draggingPart.mouse1.x); //目前滑鼠位置與上一次的滑鼠位置的X軸差
      var mouseDiffY = (mouse_snapped.y - draggingPart.mouse1.y); //目前滑鼠位置與上一次的滑鼠位置的Y軸差
      /*for (var i = 0; i < objs.length; i++)
      {
        objTypes[objs[i].type].move(objs[i], mouseDiffX, mouseDiffY);
      }*/
      //draggingPart.mouse1 = mouse_snapped; //將"上一次的滑鼠位置"設為目前的滑鼠位置(給下一次使用)
      /*if (observer)
      {
        observer.c.x += mouseDiffX;
        observer.c.y += mouseDiffY;
      }*/
      origin.x = mouseDiffX * scale + draggingPart.mouse2.x;
      origin.y = mouseDiffY * scale + draggingPart.mouse2.y;
      draw();
    }

    if (draggingObj == -1 && !document.getElementById('lockobjs').checked) {
      // highlight object under mouse cursor
      var ret = selectionSearch(mouse_nogrid);
      var newMouseObj = (ret.targetObj_index == -1) ? null : objs[ret.targetObj_index];
      if (mouseObj != newMouseObj) {
        mouseObj = newMouseObj;
        draw();
      }
    }
  }
  }
  //==================================================================================================================================
  //==============================MouseUp===============================
  function canvas_onmouseup(e) {
  //滑鼠放開時
  /*
  if(document.getElementById("grid").checked != e.ctrlKey)
  {
    //使用格線
    var mouse=graphs.point(Math.round((e.pageX-e.target.offsetLeft)/gridSize)*gridSize,Math.round((e.pageY-e.target.offsetTop)/gridSize)*gridSize)
  }
  else
  {
    //不使用格線
    var mouse=graphs.point(e.pageX-e.target.offsetLeft,e.pageY-e.target.offsetTop)
  }
  */
  //document.getElementById('status').innerHTML=mouse.x;
  if (isConstructing)
  {
    if ((e.which && e.which == 1) || (e.changedTouches))
    {
      //若有一個物件正在被建立,則將動作直接傳給它
      objTypes[objs[objs.length - 1].type].c_mouseup(objs[objs.length - 1], mouse);
      if (!isConstructing)
      {
        //該物件已經表示建立完畢
        createUndoPoint();
      }
    }
  }
  else
  {
    if (e.which && e.which == 3 && draggingObj == -3 && mouse.x == draggingPart.mouse0.x && mouse.y == draggingPart.mouse0.y)
    {
      draggingObj = -1;
      draggingPart = {};
      canvas_ondblclick(e);
      return;
    }
    draggingObj = -1;
    draggingPart = {};
    createUndoPoint();
  }



  }


  function canvas_ondblclick(e) {
    console.log("dblclick");
    var mouse = graphs.point((e.pageX - e.target.offsetLeft - origin.x) / scale, (e.pageY - e.target.offsetTop - origin.y) / scale); //滑鼠實際位置(一律不使用格線)
    if (isConstructing)
    {
    }
    else if (mouseOnPoint(mouse, mouse_lastmousedown))
    {
      draggingPart = {};
      if (mode == 'observer')
      {
        if (graphs.length_squared(mouse, observer.c) < observer.r * observer.r)
        {

          //滑鼠按到觀察者
          positioningObj = -4;
          draggingPart = {};
          draggingPart.targetPoint = graphs.point(observer.c.x, observer.c.y);
          draggingPart.snapData = {};

          document.getElementById('xybox').style.left = (draggingPart.targetPoint.x * scale + origin.x) + 'px';
          document.getElementById('xybox').style.top = (draggingPart.targetPoint.y * scale + origin.y) + 'px';
          document.getElementById('xybox').value = '(' + (draggingPart.targetPoint.x) + ',' + (draggingPart.targetPoint.y) + ')';
          document.getElementById('xybox').size = document.getElementById('xybox').value.length;
          document.getElementById('xybox').style.display = '';
          document.getElementById('xybox').select();
          document.getElementById('xybox').setSelectionRange(1, document.getElementById('xybox').value.length - 1);
          console.log("show xybox");
          //e.cancelBubble = true;
          //if (e.stopPropagation) e.stopPropagation();
          xyBox_cancelContextMenu = true;

          return;
        }
      }


      //搜尋每個物件,尋找滑鼠按到的物件
      var draggingPart_ = {};
      var click_lensq = Infinity;
      var click_lensq_temp;
      var targetObj_index = -1;
      //var targetObj_index_temp;
      //var targetIsPoint=false;

      //for(var i=objs.length-1;i>=0;i--)
      for (var i = 0; i < objs.length; i++)
        {
        if (typeof objs[i] != 'undefined')
          {
            draggingPart_ = {};
            if (objTypes[objs[i].type].clicked(objs[i], mouse, mouse, draggingPart_))
            {
              //clicked()回傳true表示滑鼠按到了該物件

              if (draggingPart_.targetPoint)
              {
                //滑鼠按到一個點
                //targetIsPoint=true; //一旦發現能夠按到點,就必須按到點
                click_lensq_temp = graphs.length_squared(mouse, draggingPart_.targetPoint);
                if (click_lensq_temp <= click_lensq)
                {
                  targetObj_index = i; //按到點的情況下,選擇最接近滑鼠的
                  click_lensq = click_lensq_temp;
                  draggingPart = draggingPart_;
                }
              }
            }
          }
        }
        if (targetObj_index != -1)
        {
          selectObj(targetObj_index);
          draggingPart.originalObj = JSON.parse(JSON.stringify(objs[targetObj_index])); //暫存拖曳前的物件狀態
          draggingPart.hasDuplicated = false;
          positioningObj = targetObj_index; //輸入位置的物件設為i

          document.getElementById('xybox').style.left = (draggingPart.targetPoint.x * scale + origin.x) + 'px';
          document.getElementById('xybox').style.top = (draggingPart.targetPoint.y * scale + origin.y) + 'px';
          document.getElementById('xybox').value = '(' + (draggingPart.targetPoint.x) + ',' + (draggingPart.targetPoint.y) + ')';
          document.getElementById('xybox').size = document.getElementById('xybox').value.length;
          document.getElementById('xybox').style.display = '';
          document.getElementById('xybox').select();
          document.getElementById('xybox').setSelectionRange(1, document.getElementById('xybox').value.length - 1);
          console.log("show xybox");
          //e.cancelBubble = true;
          //if (e.stopPropagation) e.stopPropagation();
          xyBox_cancelContextMenu = true;
        }
    }

  }


  window.onresize = function(e) {
  if (ctx)
  {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
  }
  };

  function selectObj(index)
  {
    if (index < 0 || index >= objs.length)
    {
      //若此物件不存在
      selectedObj = -1;
      document.getElementById('obj_settings').style.display = 'none';
      return;
    }
    selectedObj = index;
    document.getElementById('obj_name').innerHTML = document.getElementById('tool_' + objs[index].type).dataset['n'];
    if (objTypes[objs[index].type].p_box)
    {
      document.getElementById('p_box').style.display = '';
      document.getElementById('p_box').innerHTML = '';
      objTypes[objs[index].type].p_box(objs[index], document.getElementById('p_box'));
      for (var i = 0; i < objs.length; i++)
      {
        if (i != selectedObj && hasSameAttrType(objs[i], objs[selectedObj]))
        {
          //若有另一個相同type的物件,則顯示"套用全部"選項
          document.getElementById('setAttrAll_box').style.display = '';
          //document.getElementById('setAttrAll').checked=false;
          break;
        }
        if (i == objs.length - 1)
        {
          document.getElementById('setAttrAll_box').style.display = 'none';
        }
      }
    }
    else
    {
      document.getElementById('p_box').style.display = 'none';
      document.getElementById('setAttrAll_box').style.display = 'none';
    }

    document.getElementById('obj_settings').style.display = '';
  }

  function hasSameAttrType(obj1, obj2)
  {
    return obj1.type==obj2.type;
  }

  function setAttr(func)
  {
    if (!document.getElementById('setAttrAll').checked)
    {
      func(objs[selectedObj]);
    }
    else
    {
      for (var i = 0; i < objs.length; i++)
      {
        if (hasSameAttrType(objs[i], objs[selectedObj]))
        {
          func(objs[i]);
        }
      }
    }
    draw();
  }

  function confirmPositioning(ctrl, shift)
  {
    var xyData = JSON.parse('[' + document.getElementById('xybox').value.replace(/\(|\)/g, '') + ']');
    //if(xyData.length==2)
    //只有當輸入兩個數值(座標)時才進行動作
    if (xyData.length == 2)
    {
      if (positioningObj == -4)
      {
        //觀察者
        observer.c.x = xyData[0];
        observer.c.y = xyData[1];
      }
      else
      {
        //物件
        objTypes[objs[positioningObj].type].dragging(objs[positioningObj], graphs.point(xyData[0], xyData[1]), draggingPart, ctrl, shift);
      }
      draw();
      createUndoPoint();
    }

    endPositioning();
  }

  function endPositioning()
  {
    document.getElementById('xybox').style.display = 'none';
    positioningObj = -1;
    draggingPart = {};
  }

  function removeObj(index)
  {
    for (var i = index; i < objs.length - 1; i++)
    {
      objs[i] = JSON.parse(JSON.stringify(objs[i + 1]));
    }
    isConstructing = false;
    objs.length = objs.length - 1;
    selectedObj--;
    selectObj(selectedObj);
  }

  function createUndoPoint()
  {
    undoIndex = (undoIndex + 1) % undoLimit;
    undoUBound = undoIndex;
    document.getElementById('undo').disabled = false;
    document.getElementById('redo').disabled = true;
    undoArr[undoIndex] = document.getElementById('textarea1').value;
    if (undoUBound == undoLBound)
    {
      //復原步數已達上限
      undoLBound = (undoLBound + 1) % undoLimit;
    }
  }

  function undo()
  {
    if (isConstructing)
    {
      //假如按下復原時,使用者正在建立一個物件,則此時只將建立動作終止,而不做真正的復原

      isConstructing = false;
      objs.length--;
      selectObj(-1);

      draw();
      return;
    }
    if (positioningObj != -1)
    {
      //假如按下復原時,使用者正在輸入座標,則此時只將輸入座標動作終止,而不做真正的復原
      endPositioning();
      return;
    }
    if (undoIndex == undoLBound)
        //已達復原資料下界
        return;
    undoIndex = (undoIndex + (undoLimit - 1)) % undoLimit;
    document.getElementById('textarea1').value = undoArr[undoIndex];
    JSONInput();
    document.getElementById('redo').disabled = false;
    if (undoIndex == undoLBound)
    {
      //已達復原資料下界
      document.getElementById('undo').disabled = true;
    }

  }

  function redo()
  {
    isConstructing = false;
    endPositioning();
    if (undoIndex == undoUBound)
      //已達復原資料下界
      return;
    undoIndex = (undoIndex + 1) % undoLimit;
    document.getElementById('textarea1').value = undoArr[undoIndex];
    JSONInput();
    document.getElementById('undo').disabled = false;
    if (undoIndex == undoUBound)
    {
      //已達復原資料下界
      document.getElementById('redo').disabled = true;
    }
  }

  function initParameters()
  {
    isConstructing = false;
    endPositioning();
    objs.length = 0;
    selectObj(-1);

    //AddingObjType="";
    rayDensity_light = 0.1; //光線密度(光線相關模式)
    rayDensity_images = 1; //光線密度(像相關模式)
    window.toolBarViewModel.rayDensity.value(rayDensity_light);
    extendLight = false; //觀察者的影像
    showLight = true; //顯示光線
    origin = {x: 0, y: 0};
    observer = null;
    scale = 1;
    cartesianSign = false;
    try {
      if (localStorage.rayOpticsCartesianSign == "true") {
        cartesianSign = true;
      }
    } catch { }
    window.toolBarViewModel.zoom.value(scale * 100);
    //mode="light";
    toolbtn_clicked('laser');
    modebtn_clicked('light');
    colorMode = false;
    backgroundImage = null;

    //Reset new UI.
    window.toolBarViewModel.tools.selected("Ray");
    window.toolBarViewModel.modes.selected("Rays");
    window.toolBarViewModel.c1.selected(false);
    window.toolBarViewModel.c2.selected(false);
    window.toolBarViewModel.c3.selected(false);
    window.toolBarViewModel.colorMode.selected(false);

    document.getElementById('lockobjs').checked = false;
    document.getElementById('grid').checked = false;
    document.getElementById('showgrid').checked = false;

    document.getElementById('setAttrAll').checked = false;

    draw();
    //createUndoPoint();
  }

  window.onkeydown = function(e)
  {
    //console.log(e.keyCode);
    //console.log(e.ctrlKey);

    //Ctrl+Z
    if (e.ctrlKey && e.keyCode == 90)
    {
    if (document.getElementById('undo').disabled == false)
    {
      undo();
    }
    return false;
    }

    //Ctrl+D
    if (e.ctrlKey && e.keyCode == 68)
    {
    objs[objs.length] = JSON.parse(JSON.stringify(objs[selectedObj]));
    draw();
    createUndoPoint();
    return false;
    }
    //Ctrl+Y
    if (e.ctrlKey && e.keyCode == 89)
    {
      document.getElementById('redo').onclick();
    }

    //Ctrl+S
    if (e.ctrlKey && e.keyCode == 83)
    {
      document.getElementById('save').onclick();
    }

    //Ctrl+O
    if (e.ctrlKey && e.keyCode == 79)
    {
      document.getElementById('open').onclick();
    }

    /*
    if(e.altKey && e.keyCode==78)
    {
    //Alt+N
    cleanAll();
    return false;
    }
    */
    /*
    if(e.altKey && e.keyCode==65)
    {
    //Alt+A
    document.getElementById("objAttr").focus()
    return false;
    }
    */
    //Delete
    if (e.keyCode == 46 || e.keyCode == 8)
    {
    if (selectedObj != -1)
    {
      removeObj(selectedObj);
      draw();
      createUndoPoint();
    }
    return false;
    }

    //Ctrl
    /*
    if(e.keyCode==17)
    {
      if(draggingObj!=-1)
      {
        canvas_onmousemove(e,true);
      }
    }
    */

    //Arrow Keys
    if (e.keyCode >= 37 && e.keyCode <= 40)
    {
      var step = document.getElementById('grid').checked ? gridSize : 1;
      if (selectedObj >= 0)
      {
        if (e.keyCode == 37)
        {
          objTypes[objs[selectedObj].type].move(objs[selectedObj], -step, 0);
        }
        if (e.keyCode == 38)
        {
          objTypes[objs[selectedObj].type].move(objs[selectedObj], 0, -step);
        }
        if (e.keyCode == 39)
        {
          objTypes[objs[selectedObj].type].move(objs[selectedObj], step, 0);
        }
        if (e.keyCode == 40)
        {
          objTypes[objs[selectedObj].type].move(objs[selectedObj], 0, step);
        }
      }
      else if (mode == 'observer')
      {
        if (e.keyCode == 37)
        {
          observer.c.x -= step;
        }
        if (e.keyCode == 38)
        {
          observer.c.y -= step;
        }
        if (e.keyCode == 39)
        {
          observer.c.x += step;
        }
        if (e.keyCode == 40)
        {
          observer.c.y += step;
        }
      }
      else
      {
        for (var i = 0; i < objs.length; i++)
        {
          if (e.keyCode == 37)
          {
            objTypes[objs[i].type].move(objs[i], -step, 0);
          }
          if (e.keyCode == 38)
          {
            objTypes[objs[i].type].move(objs[i], 0, -step);
          }
          if (e.keyCode == 39)
          {
            objTypes[objs[i].type].move(objs[i], step, 0);
          }
          if (e.keyCode == 40)
          {
            objTypes[objs[i].type].move(objs[i], 0, step);
          }
        }
      }
      draw();
    }



};

  window.onkeyup = function(e)
  {
    //Arrow Keys
    if (e.keyCode >= 37 && e.keyCode <= 40)
    {
      createUndoPoint();
    }

  };


  // attributes starting with tmp_ are not written to output
  function JSONreplacer(name, val) {
    if (name.startsWith("tmp_"))
      return undefined;
    return val;
  }

  //=========================================JSON輸出/輸入====================================================
  function JSONOutput()
  {
    document.getElementById('textarea1').value = JSON.stringify({version: 2, objs: objs, mode: mode, rayDensity_light: rayDensity_light, rayDensity_images: rayDensity_images, observer: observer, origin: origin, scale: scale, colorMode: colorMode}, JSONreplacer, 2);
    if (typeof(Storage) !== "undefined" && !restoredData) {
      localStorage.rayOpticsData = document.getElementById('textarea1').value;
    }
  }
  function JSONInput()
  {
    var jsonData = JSON.parse(document.getElementById('textarea1').value);
    if (typeof jsonData != 'object')return;
    //console.log(jsonData);
    if (!jsonData.version)
    {
      //為"線光學模擬1.0"或之前的格式
      //var str1=document.getElementById("textarea1").value.replace(/"point"|"xxa"/g,"1").replace(/"circle"|"xxf"/g,"5");
      var str1 = document.getElementById('textarea1').value.replace(/"point"|"xxa"|"aH"/g, '1').replace(/"circle"|"xxf"/g, '5').replace(/"k"/g, '"objs"').replace(/"L"/g, '"p1"').replace(/"G"/g, '"p2"').replace(/"F"/g, '"p3"').replace(/"bA"/g, '"exist"').replace(/"aa"/g, '"parallel"').replace(/"ba"/g, '"mirror"').replace(/"bv"/g, '"lens"').replace(/"av"/g, '"notDone"').replace(/"bP"/g, '"lightAlpha"').replace(/"ab"|"observed_light"|"observed_images"/g, '"observer"');
      jsonData = JSON.parse(str1);
      if (!jsonData.objs)
      {
        jsonData = {objs: jsonData};
      }
      if (!jsonData.mode)
      {
        jsonData.mode = 'light';
      }
      if (!jsonData.rayDensity_light)
      {
        jsonData.rayDensity_light = 1;
      }
      if (!jsonData.rayDensity_images)
      {
        jsonData.rayDensity_images = 1;
      }
      if (!jsonData.scale)
      {
        jsonData.scale = 1;
      }
      jsonData.version = 1;
    }
    if (jsonData.version == 1)
    {
      //"線光學模擬1.1"至"線光學模擬1.2"
      jsonData.origin = {x: 0, y: 0};
    }
    if (jsonData.version > 2)
    {
      //為比此版本新的檔案版本
      return;
    }
    //TODO: Create new version.
    if (!jsonData.scale)
    {
      jsonData.scale = 1;
    }
    if (!jsonData.colorMode)
    {
      jsonData.colorMode = false;
    }

    objs = jsonData.objs;
    rayDensity_light = jsonData.rayDensity_light;
    rayDensity_images = jsonData.rayDensity_images;
    observer = jsonData.observer;
    origin = jsonData.origin;
    scale = jsonData.scale;
    colorMode = jsonData.colorMode;
    window.toolBarViewModel.colorMode.selected(colorMode);
    modebtn_clicked(jsonData.mode);
    selectObj(selectedObj);
    //draw();
  }

  function accessJSON()
  {
    if (document.getElementById('textarea1').style.display == 'none')
    {
      document.getElementById('textarea1').style.display = '';
      document.getElementById('textarea1').select();
    }
    else
    {
      document.getElementById('textarea1').style.display = 'none';
    }

  }


  function toolbtn_mouseentered(tool, e)
  {
    hideAllLists();
  }

  function toolbtn_clicked(tool, e)
  {

    tools_normal.forEach(function(element, index)
    {
      document.getElementById('tool_' + element).className = 'toolbtn';

    });
    tools_withList.forEach(function(element, index)
    {
      document.getElementById('tool_' + element).className = 'toolbtn';
    });
    tools_inList.forEach(function(element, index)
    {
      document.getElementById('tool_' + element).className = 'toollistbtn';
    });

    hideAllLists();

    document.getElementById('tool_' + tool).className = 'toolbtnselected';
    AddingObjType = tool;
    if (tool == "radiant_") {
      var t = window.toolBarViewModel.point_sources.selected();
      if (t == "360 degrees")
        AddingObjType = "radiant";
      if (t == "Finite angle")
        AddingObjType = "led";
    } else if (tool == "mirror_") {
      var t = window.toolBarViewModel.mirrors.selected();
      if (t == "Segment")
        AddingObjType = "mirror";
      else if (t == "Circular Arc")
        AddingObjType = "arcmirror";
      else if (t == "Parabolic")
        AddingObjType = "parabolicmirror";
      else if (t == "Beam Splitter")
        AddingObjType = "beamsplitter";
      else if (t == "Ideal Curved")
        AddingObjType = "idealmirror";
    } else if (tool == "refractor_") {
      var t = window.toolBarViewModel.glasses.selected();
      if (t == "Half-plane")
        AddingObjType = "halfplane";
      else if (t == "Circle")
        AddingObjType = "circlelens";
      else if (t == "Free-shape")
        AddingObjType = "refractor";
      else if (t == "Ideal Lens")
        AddingObjType = "lens";
      else if (t == "Spherical Lens")
        AddingObjType = "sphericallens";
    }
  }

  function toolbtnwithlist_mouseentered(tool, e)
  {
    //console.log("tool_"+tool)
    /*hideAllLists();
    var rect = document.getElementById('tool_' + tool).getBoundingClientRect();
    //console.log(document.getElementById("tool_"+tool+"list"))
    document.getElementById('tool_' + tool + 'list').style.left = rect.left + 'px';
    document.getElementById('tool_' + tool + 'list').style.top = rect.bottom + 'px';
    document.getElementById('tool_' + tool + 'list').style.display = '';
    if (document.getElementById('tool_' + tool).className == 'toolbtn')
    {
      document.getElementById('tool_' + tool).className = 'toolbtnwithlisthover';
    }*/
  }

  function toolbtnwithlist_mouseleft(tool, e)
  {
    //console.log("btnout")

    /*var rect = document.getElementById('tool_' + tool + 'list').getBoundingClientRect();
    mouse = graphs.point(e.pageX, e.pageY);
    //console.log(rect)
    //console.log(mouse)
    if (mouse.x < rect.left || mouse.x > rect.right || mouse.y < rect.top - 5 || mouse.y > rect.bottom)
    {
      //滑鼠不在下拉選單上
      document.getElementById('tool_' + tool + 'list').style.display = 'none';
      if (document.getElementById('tool_' + tool).className == 'toolbtnwithlisthover')
      {
        document.getElementById('tool_' + tool).className = 'toolbtn';
      }
    }*/

  }

  function toollist_mouseleft(tool, e)
  {
    //console.log("listout")
    var rect = document.getElementById('tool_' + tool).getBoundingClientRect();
    mouse = graphs.point(e.pageX, e.pageY);
    if (mouse.x < rect.left || mouse.x > rect.right || mouse.y < rect.top || mouse.y > rect.bottom + 5)
    {
      //滑鼠不在帶下拉選單的按鈕上
      document.getElementById('tool_' + tool + 'list').style.display = 'none';
      if (document.getElementById('tool_' + tool).className == 'toolbtnwithlisthover')
      {
        document.getElementById('tool_' + tool).className = 'toolbtn';
      }
    }
  }

  function hideAllLists()
  {
    tools_withList.forEach(function(element, index)
    {
      document.getElementById('tool_' + element + 'list').style.display = 'none';
      if (document.getElementById('tool_' + element).className == 'toolbtnwithlisthover')
      {
        document.getElementById('tool_' + element).className = 'toolbtn';
      }
    });
  }

  function toollistbtn_clicked(tool, e)
  {
    //document.getElementById("tool_"+AddingObjType).className="toolbtn";

    var selected_toolbtn; //先前被按下的toolbtn
    var selecting_toolbtnwithlist; //這個toollistbtn所屬的toolbtnwithlist
    tools_withList.forEach(function(element, index)
    {
      if (document.getElementById('tool_' + element).className == 'toolbtnwithlisthover')
      {
        selecting_toolbtnwithlist = element;
      }
      if (document.getElementById('tool_' + element).className == 'toolbtnselected')
      {
        selected_toolbtn = element;
      }
    });
    //console.log([selected_toolbtn,selecting_toolbtnwithlist]);
    if (!selecting_toolbtnwithlist)
    {
      selecting_toolbtnwithlist = selected_toolbtn; //這個toollistbtn屬於先前被按下的toolbtn
    }
    //console.log(selecting_toolbtnwithlist);
    tools_normal.forEach(function(element, index)
    {
      document.getElementById('tool_' + element).className = 'toolbtn';
    });
    tools_withList.forEach(function(element, index)
    {
      document.getElementById('tool_' + element).className = 'toolbtn';
    });
    tools_inList.forEach(function(element, index)
    {
      document.getElementById('tool_' + element).className = 'toollistbtn';
    });

    hideAllLists();

    document.getElementById('tool_' + selecting_toolbtnwithlist).className = 'toolbtnselected';
    document.getElementById('tool_' + tool).className = 'toollistbtnselected';
    AddingObjType = tool;
  }


  function modebtn_clicked(mode1)
  {
    console.log(mode1);
    document.getElementById('mode_' + mode).className = 'toolbtn';
    document.getElementById('mode_' + mode1).className = 'toolbtnselected';
    window.toolBarViewModel.modes.selected({"light":"Rays","extended_light":"Extended Rays","images":"All Images","observer":"Seen by Observer"}[mode1]);
    mode = mode1;
    if (mode == 'images' || mode == 'observer')
    {
      //document.getElementById('rayDensity').value = Math.log(rayDensity_images);
      window.toolBarViewModel.rayDensity.value(Math.log(rayDensity_images));
    }
    else
    {
      //document.getElementById('rayDensity').value = Math.log(rayDensity_light);
      window.toolBarViewModel.rayDensity.value(Math.log(rayDensity_light));
    }
    if (mode == 'observer' && !observer)
    {
      //初始化觀察者
      observer = graphs.circle(graphs.point((canvas.width * 0.5 - origin.x) / scale, (canvas.height * 0.5 - origin.y) / scale), 20);
    }


    try {
      draw();
    } catch (error) {
      console.error(error);
      isDrawing = false;
    }
  }



  function cancelMousedownEvent(id)
  {
    document.getElementById(id).onmousedown = function(e)
    {
      e.cancelBubble = true;
      if (e.stopPropagation) e.stopPropagation();
    };
    document.getElementById(id).ontouchstart = function(e)
    {
      e.cancelBubble = true;
      if (e.stopPropagation) e.stopPropagation();
    };
  }

  function cancelMousedownEvent_(elem)
  {
    elem.onmousedown = function(e)
    {
      e.cancelBubble = true;
      if (e.stopPropagation) e.stopPropagation();
    };
    elem.ontouchstart = function(e)
    {
      e.cancelBubble = true;
      if (e.stopPropagation) e.stopPropagation();
    };
  }


  function setRayDensity(value)
  {
    if (mode == 'images' || mode == 'observer')
    {
      rayDensity_images = value;
    }
    else
    {
      rayDensity_light = value;
    }
  }

  function setScale(value) {
    setScaleWithCenter(value, canvas.width / scale / 2, canvas.height / scale / 2);
  }

  function setScaleWithCenter(value, centerX, centerY) {
    scaleChange = value - scale;
    origin.x *= value / scale;
    origin.y *= value / scale;
    origin.x -= centerX * scaleChange;
    origin.y -= centerY * scaleChange;
    scale = value;
    draw();
  }

  function save()
  {
    JSONOutput();

    var blob = new Blob([document.getElementById('textarea1').value], {type: 'application/json'});
    saveAs(blob, document.getElementById('save_name').value);

    document.getElementById('saveBox').style.display = 'none';
  }

  function open(readFile)
  {
    var reader = new FileReader();
    document.getElementById('save_name').value = readFile.name;
    reader.readAsText(readFile);
    reader.onload = function(evt) {
      var fileString = evt.target.result;
      document.getElementById('textarea1').value = fileString;
      endPositioning();
      selectedObj = -1;
      try {
        JSONInput();
        cancelRestore();
      } catch (error) {
        reader.onload = function (e) {
            backgroundImage = new Image();
            backgroundImage.src = e.target.result;
            backgroundImage.onload = function (e1) {
                draw();
                cancelRestore();
            }
        }
        reader.readAsDataURL(readFile);
      }
      createUndoPoint();
    };

  }
  
  function exportSVG() {
    var ctx1 = ctx;
    if (backgroundImage) {
        var svgWidth = backgroundImage.width;
        var svgHeight = backgroundImage.height;
    } else {
        var svgWidth = canvas.width / scale;
        var svgHeight = canvas.height / scale;
    }
    ctx = new C2S(svgWidth, svgHeight);
    ctx.fillStyle="black";
    ctx.fillRect(0,0, svgWidth, svgHeight);
    draw();
    var blob = new Blob([ctx.getSerializedSvg()], {type: 'image/svg+xml'});
        saveAs(blob,"export.svg");
    ctx = ctx1;
  }
  
  function restore() {
    document.getElementById('textarea1').value = restoredData;
    document.getElementById('restore').style.display = 'none';
    restoredData = '';
    JSONInput();
    createUndoPoint();
  }
  
  function cancelRestore() {
    restoredData = '';
    document.getElementById('restore').style.display = 'none';
  }

  var lang = 'en';
  function getMsg(msg) {
    //if (typeof chrome != 'undefined') {
    //  return chrome.i18n.getMessage(msg);
    //} else {
    var m = locales[lang][msg];
    if (m == null) {
      console.log("undefined message: " + msg);
      return msg;
    }
    return m.message;
    //}
  }

  function init_i18n() {
    if (navigator.language) {
      var browser_lang = navigator.language;
      if (browser_lang.toLowerCase() == 'zh-tw') {
        lang = 'zh-TW';
      }
      if (browser_lang.toLowerCase() == 'zh-cn') {
        lang = 'zh-CN';
      }
    }

    var url_lang = location.search.substr(1)
    if (url_lang && locales[url_lang]) {
      lang = url_lang;
    }


    var downarraw = '\u25BC';
    var uparraw = '\u25B2';
    //var downarraw="\u25BE";
    document.title = getMsg('appName');

    //===========toolbar===========
    document.getElementById('toolbar_title').innerHTML = getMsg('toolbar_title');

    //Ray
    document.getElementById('tool_laser').value = getMsg('toolname_laser');
    document.getElementById('tool_laser').dataset['n'] = getMsg('toolname_laser');

    //Beam
    document.getElementById('tool_parallel').value = getMsg('toolname_parallel');
    document.getElementById('tool_parallel').dataset['n'] = getMsg('toolname_parallel');

    //Point source▼
    document.getElementById('tool_radiant_').value = getMsg('toolname_radiant_') + downarraw;

    //Point source->360 degrees
    document.getElementById('tool_radiant').value = getMsg('toolname_radiant');
    document.getElementById('tool_radiant').dataset['n'] = getMsg('toolname_radiant');
	
    //Point source->Finite angle
    document.getElementById('tool_led').value = getMsg('toolname_led');
    document.getElementById('tool_led').dataset['n'] = getMsg('toolname_led');

    //Mirror▼
    document.getElementById('tool_mirror_').value = getMsg('toolname_mirror_') + downarraw;

    //Mirror->Line
    document.getElementById('tool_mirror').value = getMsg('tooltitle_mirror');
    document.getElementById('tool_mirror').dataset['n'] = getMsg('toolname_mirror_');

    //Mirror->Circular Arc
    document.getElementById('tool_arcmirror').value = getMsg('tooltitle_arcmirror');
    document.getElementById('tool_arcmirror').dataset['n'] = getMsg('toolname_mirror_');

    //Mirror->Parabolic
    document.getElementById('tool_parabolicmirror').value = getMsg('tooltitle_parabolicmirror');
    document.getElementById('tool_parabolicmirror').dataset['n'] = getMsg('toolname_mirror_');

    //Mirror->Curve (ideal)
    document.getElementById('tool_idealmirror').value = getMsg('tooltitle_idealmirror');
    document.getElementById('tool_idealmirror').dataset['n'] = getMsg('toolname_idealmirror');

    //Mirror->Beam Splitter
    document.getElementById('tool_beamsplitter').value = getMsg('tooltitle_beamsplitter');
    document.getElementById('tool_beamsplitter').dataset['n'] = getMsg('toolname_beamsplitter');

    //Refractor▼
    document.getElementById('tool_refractor_').value = getMsg('toolname_refractor_') + downarraw;

    //Refractor->Half-plane
    document.getElementById('tool_halfplane').value = getMsg('tooltitle_halfplane');
    document.getElementById('tool_halfplane').dataset['n'] = getMsg('toolname_refractor_');

    //Refractor->Circle
    document.getElementById('tool_circlelens').value = getMsg('tooltitle_circlelens');
    document.getElementById('tool_circlelens').dataset['n'] = getMsg('toolname_refractor_');

    //Refractor->Other shape
    document.getElementById('tool_refractor').value = getMsg('tooltitle_refractor');
    document.getElementById('tool_refractor').dataset['n'] = getMsg('toolname_refractor_');

    //Refractor->Lens (ideal)
    document.getElementById('tool_lens').value = getMsg('tooltitle_lens');
    document.getElementById('tool_lens').dataset['n'] = getMsg('toolname_lens');

    //Refractor->Lens (real)
    document.getElementById('tool_sphericallens').value = getMsg('tooltitle_sphericallens');
    document.getElementById('tool_sphericallens').dataset['n'] = getMsg('toolname_sphericallens');

    //Blocker
    document.getElementById('tool_blackline').value = getMsg('toolname_blackline');
    document.getElementById('tool_blackline').dataset['n'] = getMsg('toolname_blackline');

    //Ruler
    document.getElementById('tool_ruler').value = getMsg('toolname_ruler');
    document.getElementById('tool_ruler').dataset['n'] = getMsg('toolname_ruler');

    //Protractor
    document.getElementById('tool_protractor').value = getMsg('toolname_protractor');
    document.getElementById('tool_protractor').dataset['n'] = getMsg('toolname_protractor');

    //Power Measurement
    document.getElementById('tool_power').value = getMsg('toolname_power');
    document.getElementById('tool_power').dataset['n'] = getMsg('toolname_power');
    
    //Text
    document.getElementById('tool_text').value = getMsg('toolname_text');
    document.getElementById('tool_text').dataset['n'] = getMsg('toolname_text');

    //Move view
    document.getElementById('tool_').value = getMsg('toolname_');



    //===========modebar===========
    document.getElementById('modebar_title').innerHTML = getMsg('modebar_title');
    document.getElementById('mode_light').value = getMsg('modename_light');
    document.getElementById('mode_extended_light').value = getMsg('modename_extended_light');
    document.getElementById('mode_images').value = getMsg('modename_images');
    document.getElementById('mode_observer').value = getMsg('modename_observer');
    document.getElementById('rayDensity_title').innerHTML = getMsg('raydensity');


    document.getElementById('undo').value = getMsg('undo');
    document.getElementById('redo').value = getMsg('redo');
    document.getElementById('reset').value = getMsg('reset');
    document.getElementById('save').value = getMsg('save');
    document.getElementById('save_name_title').innerHTML = getMsg('save_name');
    document.getElementById('save_confirm').value = getMsg('save');
    document.getElementById('save_cancel').value = getMsg('save_cancel');
    document.getElementById('save_description').innerHTML = getMsg('save_description');
    document.getElementById('open').value = getMsg('open');
    document.getElementById('lockobjs_title').innerHTML = getMsg('lockobjs');
    document.getElementById('grid_title').innerHTML = getMsg('snaptogrid');
    document.getElementById('showgrid_title').innerHTML = getMsg('grid');

    document.getElementById('setAttrAll_title').innerHTML = getMsg('applytoall');
    document.getElementById('copy').value = getMsg('duplicate');
    document.getElementById('delete').value = getMsg('delete');

    document.getElementById('forceStop').innerHTML = getMsg('processing');
    document.getElementById('restore').innerHTML = getMsg('restore');

    document.getElementById('homepage').innerHTML = getMsg('homepage');
    document.getElementById('source').innerHTML = getMsg('source');
    document.getElementById('language').innerHTML = document.getElementById('lang-'+lang).innerHTML + uparraw;
  }


  function createNumberAttr(label, min, max, step, value, func, elem) {
    var p_name = document.createElement('span');
    p_name.innerHTML = '&nbsp;' + label + '&nbsp;';
    elem.appendChild(p_name);
    var objAttr_range = document.createElement('input');
    objAttr_range.type = 'range';
    objAttr_range.min = min;
    objAttr_range.max = max;
    objAttr_range.step = step;
    objAttr_range.value = value;
    elem.appendChild(objAttr_range);
    var objAttr_text = document.createElement('input');
    objAttr_text.type = 'text';
    objAttr_text.value = value;
    objAttr_text.style.width = '40px';
    objAttr_text.style.marginLeft = '0.2em';
    elem.appendChild(objAttr_text);
    objAttr_range.oninput = function()
    {
      objAttr_text.value = objAttr_range.value;
      setAttr(function(obj) {
        func(obj, objAttr_range.value * 1);
      });
    };

    objAttr_range.onmouseup = function()
    {
      createUndoPoint();
    };

    objAttr_range.ontouchend = function()
    {
      setAttr(function(obj) {
        func(obj, objAttr_range.value * 1);
      });
      createUndoPoint();
    };
    cancelMousedownEvent_(objAttr_range);
    objAttr_text.onchange = function()
    {
      objAttr_range.value = objAttr_text.value;
      setAttr(function(obj) {
        func(obj, objAttr_text.value);
      });
    };
    cancelMousedownEvent_(objAttr_text);
    objAttr_text.onkeydown = function(e)
    {
      e.cancelBubble = true;
      if (e.stopPropagation) e.stopPropagation();
    };
    objAttr_text.onclick = function(e)
    {
      this.select();
    };
  }

  function createStringAttr(label, value, func, elem) {
    var p_name = document.createElement('span');
    p_name.innerHTML = '&nbsp;' + label + '&nbsp;';
    elem.appendChild(p_name);
    var objAttr_text = document.createElement('input');
    objAttr_text.type = 'text';
    objAttr_text.value = value;
    objAttr_text.style.width = '200px';
    elem.appendChild(objAttr_text);
    objAttr_text.onchange = function()
    {
      setAttr(function(obj) {
        func(obj, objAttr_text.value);
      });
    };
    cancelMousedownEvent_(objAttr_text);
    objAttr_text.onkeydown = function(e)
    {
      e.cancelBubble = true;
      if (e.stopPropagation) e.stopPropagation();
    };
    objAttr_text.onclick = function(e)
    {
      this.select();
    };
  }

  function createBooleanAttr(label, value, func, elem) {
    var label_elem = document.createElement('label');
    label_elem.style.marginLeft = '0.2em';
    label_elem.style.marginRight = '0.2em';
    elem.appendChild(label_elem);
    var objAttr_checkbox = document.createElement('input');
    objAttr_checkbox.type = 'checkbox';
    objAttr_checkbox.style.display = 'inline';
    objAttr_checkbox.checked = value;
    label_elem.appendChild(objAttr_checkbox);
    var p_name = document.createElement('span');
    p_name.innerHTML = '&nbsp;' + label;
    label_elem.appendChild(p_name);
    objAttr_checkbox.onchange = function()
    {
      setAttr(function(obj) {
        func(obj, objAttr_checkbox.checked);
      });
    };
    cancelMousedownEvent_(label_elem);
  }

// takes wavelength in nm and returns an rgb value
function wavelengthToColor(wavelength, brightness) {
    // From https://scienceprimer.com/javascript-code-convert-light-wavelength-color
    var r,
        g,
        b,
        alpha,
        colorSpace,
        wl = wavelength,
        gamma = 1;


    if (wl >= 380 && wl < 440) {
        R = -1 * (wl - 440) / (440 - 380);
        G = 0;
        B = 1;
   } else if (wl >= 440 && wl < 490) {
       R = 0;
       G = (wl - 440) / (490 - 440);
       B = 1;  
    } else if (wl >= 490 && wl < 510) {
        R = 0;
        G = 1;
        B = -1 * (wl - 510) / (510 - 490);
    } else if (wl >= 510 && wl < 580) {
        R = (wl - 510) / (580 - 510);
        G = 1;
        B = 0;
    } else if (wl >= 580 && wl < 645) {
        R = 1;
        G = -1 * (wl - 645) / (645 - 580);
        B = 0.0;
    } else if (wl >= 645 && wl <= 780) {
        R = 1;
        G = 0;
        B = 0;
    } else {
        R = 0;
        G = 0;
        B = 0;
    }

    // intensty is lower at the edges of the visible spectrum.
    if (wl > 780 || wl < 380) {
        alpha = 0;
    } else if (wl > 700) {
        alpha = (780 - wl) / (780 - 700);
    } else if (wl < 420) {
        alpha = (wl - 380) / (420 - 380);
    } else {
        alpha = 1;
    }

    R *= alpha * brightness;
    G *= alpha * brightness;
    B *= alpha * brightness;

    if (ctx.constructor != C2S) {
      // Adjust color to make (R,G,B) linear when using the 'screen' composition.
      // This is to avoid the color satiation problem when using the 'lighter' composition.
      // Currently not supported when exporting to SVG.
      R = 1 - Math.exp(-R);
      G = 1 - Math.exp(-G);
      B = 1 - Math.exp(-B);
    }

    return "rgb(" + (R * 100) + "%," + (G * 100) + "%," + (B * 100) + "%)";
   
}
