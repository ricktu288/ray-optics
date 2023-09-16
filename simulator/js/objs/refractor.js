// Glasses -> Free-shape
objTypes['refractor'] = {

  supportSurfaceMerging: true,

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'refractor', path: [{x: mouse.x, y: mouse.y, arc: false}], notDone: true, p: 1.5};
  },

  //顯示屬性方塊 Show the property box
  p_box: function(obj, elem) {
    if (colorMode) {
      createNumberAttr(getMsg('cauchycoeff') + " A", 1, 3, 0.01, obj.p, function(obj, value) {
        obj.p = value * 1;
      }, elem, getMsg('refractiveindex_note_popover'));
      createNumberAttr("B(μm²)", 0.0001, 0.02, 0.0001, (obj.cauchyCoeff || 0.004), function(obj, value) {
        obj.cauchyCoeff = value;
      }, elem);
    } else {
      createNumberAttr(getMsg('refractiveindex'), 0.5, 2.5, 0.01, obj.p, function(obj, value) {
        obj.p = value * 1;
      }, elem, getMsg('refractiveindex_note_popover'));
    }
  },

  //建立物件過程滑鼠按下 Mousedown when the obj is being constructed by the user
  c_mousedown: function(obj, mouse, ctrl, shift)
  {
    if (obj.path.length > 1)
    {
      if (obj.path.length > 3 && mouseOnPoint(mouse, obj.path[0]))
      {
        //滑鼠按了第一點 Clicked the first point
        obj.path.length--;
        obj.notDone = false;
        draw();
        return;
      }
      obj.path[obj.path.length - 1] = {x: mouse.x, y: mouse.y}; //移動最後一點 Move the last point
      obj.path[obj.path.length - 1].arc = true;
    }
  },
  //建立物件過程滑鼠移動 Mousemove when the obj is being constructed by the user
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
      obj.path[obj.path.length - 1] = {x: mouse.x, y: mouse.y}; //移動最後一點 Move the last point
      draw();
    }
  },
  //建立物件過程滑鼠放開 Mouseup when the obj is being constructed by the user
  c_mouseup: function(obj, mouse, ctrl, shift)
  {
    if (!obj.notDone) {
      isConstructing = false;
      draw();
      return;
    }
    if (obj.path.length > 3 && mouseOnPoint(mouse, obj.path[0]))
    {
      //滑鼠在第一點處放開 Mouse released at the first point
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
      obj.path[obj.path.length - 1] = {x: mouse.x, y: mouse.y}; //移動最後一點 Move the last point
      obj.path[obj.path.length - 1].arc = false;
      obj.path[obj.path.length] = {x: mouse.x, y: mouse.y}; //建立新的一點 Create a new point

    }
    draw();
  },
  
  zIndex: function(obj) {
    return obj.p * (-1); // The material with (relative) refractive index < 1 should be draw after the one with > 1 so that the color subtraction in fillGlass works.
  },

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas, aboveLight) {
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
      //使用者尚未畫完物件 The user has not finish drawing the obj yet

      ctx.beginPath();
      ctx.moveTo(obj.path[0].x, obj.path[0].y);

      for (var i = 0; i < obj.path.length - 1; i++)
      {
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
            acw = (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2); //p1->p3->p2之旋轉方向,逆時針為true The rotation direction of p1->p3->p2. True indicates counterclockwise

            ctx.arc(center.x, center.y, r, a1, a2, acw);
          }
          else
          {
            //圓弧三點共線,當作線段處理 The three points on the arc is colinear. Treat as a line segment.
            ctx.lineTo(obj.path[(i + 2)].x, obj.path[(i + 2)].y);
          }


        }
        else if (!obj.path[(i + 1)].arc && !obj.path[i].arc)
        {
          ctx.lineTo(obj.path[(i + 1)].x, obj.path[(i + 1)].y);
        }
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgb(128,128,128)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    else
    {
      //物件已經畫完 The user has completed drawing the obj
      ctx.beginPath();
      ctx.moveTo(obj.path[0].x, obj.path[0].y);

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
            acw = (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2); //p1->p3->p2之旋轉方向,逆時針為true The rotation direction of p1->p3->p2. True indicates counterclockwise

            ctx.arc(center.x, center.y, r, a1, a2, acw);
          }
          else
          {
            //圓弧三點共線,當作線段處理 The three points on the arc is colinear. Treat as a line segment.
            ctx.lineTo(obj.path[(i + 2) % obj.path.length].x, obj.path[(i + 2) % obj.path.length].y);
          }

        }
        else if (!obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc)
        {
          ctx.lineTo(obj.path[(i + 1) % obj.path.length].x, obj.path[(i + 1) % obj.path.length].y);
        }
      }
      this.fillGlass(obj.p, obj, aboveLight);
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
            ctx.fillRect(obj.path[i].x - 1.5, obj.path[i].y - 1.5, 3, 3);
          }
          else
          {
            ctx.fillStyle = 'rgb(255,0,0)';
            ctx.fillRect(obj.path[i].x - 1.5, obj.path[i].y - 1.5, 3, 3);
          }
        }
      }
    }
  },

  fillGlass: function(n, obj, aboveLight)
  {
    if (aboveLight) {
      // Draw the highlight only
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = getMouseStyle(obj, 'transparent');
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      return;
    }
    if (n >= 1)
    {
      ctx.globalCompositeOperation = 'lighter';
      var alpha = Math.log(n) / Math.log(1.5) * 0.2;
      if (ctx.constructor != C2S) {
        ctx.fillStyle = "rgb(" + (alpha * 100) + "%," + (alpha * 100) + "%," + (alpha * 100) + "%)";
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle ="white";
      }
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

    }
    else
    {
      var alpha = Math.log(1/n) / Math.log(1.5) * 0.2;
      if (ctx.constructor != C2S) {
        // Subtract the gray color.
        // Use a trick to make the color become red (indicating nonphysical) if the total refractive index is lower than one.

        // A trick to work around a buggy behavior in some browser (at least in Google Chrome 105 on macOS 12.2.1 on iMac 2021) that the color in the lower left corner of the canvas is filled to the glass. Reason unknown.
        // TODO: Find out the reason behind this behavior.
        var imageData = ctx.getImageData(0.0, 0.0, canvas.width, canvas.height);
        var data = imageData.data;
        ctx.putImageData(imageData, 0, 0);

        ctx.globalCompositeOperation = 'difference';
        ctx.fillStyle = "rgb(" + (alpha * 100) + "%," + (0) + "%," + (0) + "%)";
        ctx.fill('evenodd');

        ctx.setTransform(1,0,0,1,0,0);
        ctx.fillStyle = "white";
        ctx.globalAlpha = 1;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(scale,0,0,scale,origin.x, origin.y);
        
        ctx.globalCompositeOperation = 'lighter';

        ctx.fillStyle = "rgb(" + (0) + "%," + (alpha * 100) + "%," + (alpha * 100) + "%)";
        ctx.fill('evenodd');

        ctx.globalCompositeOperation = 'difference';

        ctx.setTransform(1,0,0,1,0,0);
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(scale,0,0,scale,origin.x, origin.y);

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      } else {
        // canvas2svg does not support globalCompositeOperation. Use the old appearance.
        ctx.globalAlpha = 1;
        ctx.strokeStyle = getMouseStyle(obj, 'rgb(70,70,70)');
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

  },

  //平移物件 Move the object
  move: function(obj, diffX, diffY) {
    for (var i = 0; i < obj.path.length; i++)
    {
      obj.path[i].x += diffX;
      obj.path[i].y += diffY;
    }
  },


  //繪圖區被按下時(判斷物件被按下的部分) When the drawing area is clicked (test which part of the obj is clicked)
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
          if (mouseOnSegment(mouse_nogrid, graphs.segment(obj.path[(i) % obj.path.length], obj.path[(i + 2) % obj.path.length])))
          {
            //拖曳整個物件 Dragging the entire obj
            draggingPart.part = 0;
            draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置 Mouse position when the user starts dragging
            draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置 Mouse position at the last moment during dragging
            draggingPart.snapData = {};
            return true;
          }
        }

      }
      else if (!obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc)
      {
        if (mouseOnSegment(mouse_nogrid, graphs.segment(obj.path[(i) % obj.path.length], obj.path[(i + 1) % obj.path.length])))
        {
          //拖曳整個物件 Dragging the entire obj
          draggingPart.part = 0;
          draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置 Mouse position when the user starts dragging
          draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置 Mouse position at the last moment during dragging
          draggingPart.snapData = {};
          return true;
        }
      }
    }

  },

  //拖曳物件時 When the user is dragging the obj
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
        draggingPart.snapData = {}; //放開shift時解除原先之拖曳方向鎖定 Unlock the dragging direction when the user release the shift key
      }
      this.move(obj, mouse_snapped.x - draggingPart.mouse1.x, mouse_snapped.y - draggingPart.mouse1.y);
      draggingPart.mouse1 = mouse_snapped;
    }
  },



  //判斷一道光是否會射到此物件(若是,則回傳交點) Test if a ray may shoot on this object (if yes, return the intersection)
  rayIntersection: function(obj, ray) {

    if (obj.notDone || obj.p <= 0)return;

    var s_lensq = Infinity;
    var s_lensq_temp;
    var s_point = null;
    var s_point_temp = null;
    var rp_exist = [];
    var rp_lensq = [];
    var rp_temp;

    var p1;
    var p2;
    var p3;
    var center;
    var r;

    for (var i = 0; i < obj.path.length; i++)
    {
      s_point_temp = null;
      if (obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc)
      {
        //圓弧i->i+1->i+2 The arc i->i+1->i+2
        p1 = graphs.point(obj.path[i % obj.path.length].x, obj.path[i % obj.path.length].y);
        p2 = graphs.point(obj.path[(i + 2) % obj.path.length].x, obj.path[(i + 2) % obj.path.length].y);
        p3 = graphs.point(obj.path[(i + 1) % obj.path.length].x, obj.path[(i + 1) % obj.path.length].y);
        center = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(p1, p3)), graphs.perpendicular_bisector(graphs.line(p2, p3)));
        if (isFinite(center.x) && isFinite(center.y))
        {
          r = graphs.length(center, p3);
          rp_temp = graphs.intersection_line_circle(graphs.line(ray.p1, ray.p2), graphs.circle(center, p2));
          for (var ii = 1; ii <= 2; ii++)
          {
            rp_exist[ii] = !graphs.intersection_is_on_segment(graphs.intersection_2line(graphs.line(p1, p2), graphs.line(p3, rp_temp[ii])), graphs.segment(p3, rp_temp[ii])) && graphs.intersection_is_on_ray(rp_temp[ii], ray) && graphs.length_squared(rp_temp[ii], ray.p1) > minShotLength_squared;
            rp_lensq[ii] = graphs.length_squared(ray.p1, rp_temp[ii]);
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
          //圓弧三點共線,當作線段處理 The three points on the arc is colinear. Treat as a line segment.
          //線段i->i+2
          var rp_temp = graphs.intersection_2line(graphs.line(ray.p1, ray.p2), graphs.line(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length]));

          if (graphs.intersection_is_on_segment(rp_temp, graphs.segment(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length])) && graphs.intersection_is_on_ray(rp_temp, ray) && graphs.length_squared(ray.p1, rp_temp) > minShotLength_squared)
          {
            s_lensq_temp = graphs.length_squared(ray.p1, rp_temp);
            s_point_temp = rp_temp;
          }
        }
      }
      else if (!obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc)
      {
        //Line segment i->i+1
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

  //當物件被光射到時 When the obj is shot by a ray
  shot: function(obj, ray, rayIndex, rp, surfaceMerging_objs) {

    if (obj.notDone) {return;}
    var shotData = this.getShotData(obj, ray);
    var shotType = shotData.shotType;
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
    else if (shotType == 0)
    {
      //等同於沒射到 Equivalent to not shot on the obj(例如兩界面重合)
      var n1 = 1;
    }
    else
    {
      //可能導致Bug的狀況(如射到邊界點) The situation that may cause a bug (e.g. shot at an edge point)
      //為防止光線射向錯誤方向導致誤解,將光線吸收 To prevent shooting the ray to a wrong direction, absorb the ray
      ray.exist = false;
      return;
    }

    //界面融合 Surface merging
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

    this.refract(ray, rayIndex, shotData.s_point, shotData.normal, n1);
  },

  //判斷光線內部/外部射出 Test if the ray is shot from inside or outside
  getShotType: function(obj, ray) {
    return this.getShotData(obj, ray).shotType;
  },


  getShotData: function(obj, ray) {
    //判斷光射到物件的何處 Test where in the obj does the ray shoot on
    var s_lensq = Infinity;
    var s_lensq_temp;
    var s_point = null;
    var s_point_temp = null;
    var s_point_index;

    var surfaceMultiplicity = 1; //界面重合次數 How many time the surfaces coincide

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
    var ray2 = graphs.ray(ray.p1, graphs.point(ray.p2.x + Math.random() * 1e-5, ray.p2.y + Math.random() * 1e-5)); //用來作為內外判斷的光線(測試光線) The ray to test the inside/outside (the test ray)
    var ray_intersect_count = 0; //測試光線與物件的相交次數(奇數表示光線來自內部) The intersection count (odd means from outside)

    for (var i = 0; i < obj.path.length; i++)
    {
      s_point_temp = null;
      nearEdge_temp = false;
      if (obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc)
      {
        //圓弧i->i+1->i+2 The arc i->i+1->i+2
        p1 = graphs.point(obj.path[i % obj.path.length].x, obj.path[i % obj.path.length].y);
        p2 = graphs.point(obj.path[(i + 2) % obj.path.length].x, obj.path[(i + 2) % obj.path.length].y);
        p3 = graphs.point(obj.path[(i + 1) % obj.path.length].x, obj.path[(i + 1) % obj.path.length].y);
        center = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(p1, p3)), graphs.perpendicular_bisector(graphs.line(p2, p3)));
        if (isFinite(center.x) && isFinite(center.y))
        {
          rp_temp = graphs.intersection_line_circle(graphs.line(ray.p1, ray.p2), graphs.circle(center, p2));
          rp2_temp = graphs.intersection_line_circle(graphs.line(ray2.p1, ray2.p2), graphs.circle(center, p2));
          for (var ii = 1; ii <= 2; ii++)
          {
            rp_on_ray[ii] = graphs.intersection_is_on_ray(rp_temp[ii], ray);
            rp_exist[ii] = rp_on_ray[ii] && !graphs.intersection_is_on_segment(graphs.intersection_2line(graphs.line(p1, p2), graphs.line(p3, rp_temp[ii])), graphs.segment(p3, rp_temp[ii])) && graphs.length_squared(rp_temp[ii], ray.p1) > minShotLength_squared;
            rp_lensq[ii] = graphs.length_squared(ray.p1, rp_temp[ii]);

            rp2_exist[ii] = !graphs.intersection_is_on_segment(graphs.intersection_2line(graphs.line(p1, p2), graphs.line(p3, rp2_temp[ii])), graphs.segment(p3, rp2_temp[ii])) && graphs.intersection_is_on_ray(rp2_temp[ii], ray2) && graphs.length_squared(rp2_temp[ii], ray2.p1) > minShotLength_squared;
            rp2_lensq[ii] = graphs.length_squared(ray2.p1, rp2_temp[ii]);
          }

          if (rp_exist[1] && ((!rp_exist[2]) || rp_lensq[1] < rp_lensq[2]) && rp_lensq[1] > minShotLength_squared)
          {
            s_point_temp = rp_temp[1];
            s_lensq_temp = rp_lensq[1];
            if (rp_on_ray[2] && rp_lensq[1] < rp_lensq[2])
            {
              //The ray is from outside to inside (with respect to the arc itself)
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
              //The ray is from outside to inside (with respect to the arc itself)
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
          }
          if (rp2_exist[2] && rp2_lensq[2] > minShotLength_squared)
          {
            ray_intersect_count++;
          }

          //太靠近邊界的判斷 Test if too close to an edge
          if (s_point_temp && (graphs.length_squared(s_point_temp, p1) < minShotLength_squared || graphs.length_squared(s_point_temp, p2) < minShotLength_squared))
          {
            nearEdge_temp = true;
          }

        }
        else
        {
          //圓弧三點共線,當作線段處理 The three points on the arc is colinear. Treat as a line segment.
          //線段i->i+2
          rp_temp = graphs.intersection_2line(graphs.line(ray.p1, ray.p2), graphs.line(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length]));

          rp2_temp = graphs.intersection_2line(graphs.line(ray2.p1, ray2.p2), graphs.line(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length]));
          if (graphs.intersection_is_on_segment(rp_temp, graphs.segment(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length])) && graphs.intersection_is_on_ray(rp_temp, ray) && graphs.length_squared(ray.p1, rp_temp) > minShotLength_squared)
          {
            s_lensq_temp = graphs.length_squared(ray.p1, rp_temp);
            s_point_temp = rp_temp;

            rdots = (ray.p2.x - ray.p1.x) * (obj.path[(i + 2) % obj.path.length].x - obj.path[i % obj.path.length].x) + (ray.p2.y - ray.p1.y) * (obj.path[(i + 2) % obj.path.length].y - obj.path[i % obj.path.length].y);
            ssq = (obj.path[(i + 2) % obj.path.length].x - obj.path[i % obj.path.length].x) * (obj.path[(i + 2) % obj.path.length].x - obj.path[i % obj.path.length].x) + (obj.path[(i + 2) % obj.path.length].y - obj.path[i % obj.path.length].y) * (obj.path[(i + 2) % obj.path.length].y - obj.path[i % obj.path.length].y);

            normal_x_temp = rdots * (obj.path[(i + 2) % obj.path.length].x - obj.path[i % obj.path.length].x) - ssq * (ray.p2.x - ray.p1.x);
            normal_y_temp = rdots * (obj.path[(i + 2) % obj.path.length].y - obj.path[i % obj.path.length].y) - ssq * (ray.p2.y - ray.p1.y);


          }

          if (graphs.intersection_is_on_segment(rp2_temp, graphs.segment(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length])) && graphs.intersection_is_on_ray(rp2_temp, ray2) && graphs.length_squared(ray2.p1, rp2_temp) > minShotLength_squared)
          {
            ray_intersect_count++;
          }

          //太靠近邊界的判斷 Test if too close to an edge
          if (s_point_temp && (graphs.length_squared(s_point_temp, obj.path[i % obj.path.length]) < minShotLength_squared || graphs.length_squared(s_point_temp, obj.path[(i + 2) % obj.path.length]) < minShotLength_squared))
          {
            nearEdge_temp = true;
          }
        }
      }
      else if (!obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc)
      {
        //Line segment i->i+1
        rp_temp = graphs.intersection_2line(graphs.line(ray.p1, ray.p2), graphs.line(obj.path[i % obj.path.length], obj.path[(i + 1) % obj.path.length]));

        rp2_temp = graphs.intersection_2line(graphs.line(ray2.p1, ray2.p2), graphs.line(obj.path[i % obj.path.length], obj.path[(i + 1) % obj.path.length]));
        if (graphs.intersection_is_on_segment(rp_temp, graphs.segment(obj.path[i % obj.path.length], obj.path[(i + 1) % obj.path.length])) && graphs.intersection_is_on_ray(rp_temp, ray) && graphs.length_squared(ray.p1, rp_temp) > minShotLength_squared)
        {
          s_lensq_temp = graphs.length_squared(ray.p1, rp_temp);
          s_point_temp = rp_temp;

          rdots = (ray.p2.x - ray.p1.x) * (obj.path[(i + 1) % obj.path.length].x - obj.path[i % obj.path.length].x) + (ray.p2.y - ray.p1.y) * (obj.path[(i + 1) % obj.path.length].y - obj.path[i % obj.path.length].y);
          ssq = (obj.path[(i + 1) % obj.path.length].x - obj.path[i % obj.path.length].x) * (obj.path[(i + 1) % obj.path.length].x - obj.path[i % obj.path.length].x) + (obj.path[(i + 1) % obj.path.length].y - obj.path[i % obj.path.length].y) * (obj.path[(i + 1) % obj.path.length].y - obj.path[i % obj.path.length].y);

          normal_x_temp = rdots * (obj.path[(i + 1) % obj.path.length].x - obj.path[i % obj.path.length].x) - ssq * (ray.p2.x - ray.p1.x);
          normal_y_temp = rdots * (obj.path[(i + 1) % obj.path.length].y - obj.path[i % obj.path.length].y) - ssq * (ray.p2.y - ray.p1.y);


        }

        if (graphs.intersection_is_on_segment(rp2_temp, graphs.segment(obj.path[i % obj.path.length], obj.path[(i + 1) % obj.path.length])) && graphs.intersection_is_on_ray(rp2_temp, ray2) && graphs.length_squared(ray2.p1, rp2_temp) > minShotLength_squared)
        {
          ray_intersect_count++;
        }

        //太靠近邊界的判斷 Test if too close to an edge
        if (s_point_temp && (graphs.length_squared(s_point_temp, obj.path[i % obj.path.length]) < minShotLength_squared || graphs.length_squared(s_point_temp, obj.path[(i + 1) % obj.path.length]) < minShotLength_squared))
        {
          nearEdge_temp = true;
        }
      }
      if (s_point_temp)
      {
        if (s_point && graphs.length_squared(s_point_temp, s_point) < minShotLength_squared)
        {
          //自我界面融合 Self surface merging
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
      var shotType = 2; //射到邊界點 Shot at an edge point
    }
    else if (surfaceMultiplicity % 2 == 0)
    {
      var shotType = 0; //等同於沒射到 Equivalent to not shot on the obj
    }
    else if (ray_intersect_count % 2 == 1)
    {
      var shotType = 1; //從內部射向外部 Shot from inside to outside
    }
    else
    {
      var shotType = -1; //從外部射向內部 Shot from outside to inside
    }

    return {s_point: s_point, normal: {x: normal_x, y: normal_y},shotType: shotType};
  },

  //折射處理 Do the refraction
  refract: function(ray, rayIndex, s_point, normal, n1)
  {
    var normal_len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
    var normal_x = normal.x / normal_len;
    var normal_y = normal.y / normal_len;

    var ray_len = Math.sqrt((ray.p2.x - ray.p1.x) * (ray.p2.x - ray.p1.x) + (ray.p2.y - ray.p1.y) * (ray.p2.y - ray.p1.y));

    var ray_x = (ray.p2.x - ray.p1.x) / ray_len;
    var ray_y = (ray.p2.y - ray.p1.y) / ray_len;


    //參考 Reference http://en.wikipedia.org/wiki/Snell%27s_law#Vector_form

    var cos1 = -normal_x * ray_x - normal_y * ray_y;
    var sq1 = 1 - n1 * n1 * (1 - cos1 * cos1);


    if (sq1 < 0)
    {
      //全反射 Total internal reflection
      ray.p1 = s_point;
      ray.p2 = graphs.point(s_point.x + ray_x + 2 * cos1 * normal_x, s_point.y + ray_y + 2 * cos1 * normal_y);


    }
    else
    {
      //折射 Refraction
      var cos2 = Math.sqrt(sq1);

      var R_s = Math.pow((n1 * cos1 - cos2) / (n1 * cos1 + cos2), 2);
      var R_p = Math.pow((n1 * cos2 - cos1) / (n1 * cos2 + cos1), 2);
      //參考 Reference http://en.wikipedia.org/wiki/Fresnel_equations#Definitions_and_power_equations

      //處理反射光 Handle the reflected ray
      var ray2 = graphs.ray(s_point, graphs.point(s_point.x + ray_x + 2 * cos1 * normal_x, s_point.y + ray_y + 2 * cos1 * normal_y));
      ray2.brightness_s = ray.brightness_s * R_s;
      ray2.brightness_p = ray.brightness_p * R_p;
      ray2.wavelength = ray.wavelength;
      ray2.gap = ray.gap;
      if (ray2.brightness_s + ray2.brightness_p > 0.01)
      {
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

      //處理折射光 Handle the refracted ray
      ray.p1 = s_point;
      ray.p2 = graphs.point(s_point.x + n1 * ray_x + (n1 * cos1 - cos2) * normal_x, s_point.y + n1 * ray_y + (n1 * cos1 - cos2) * normal_y);
      ray.brightness_s = ray.brightness_s * (1 - R_s);
      ray.brightness_p = ray.brightness_p * (1 - R_p);

    }
  }


};
