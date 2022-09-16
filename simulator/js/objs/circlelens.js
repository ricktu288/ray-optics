// Glasses -> Circle
objTypes['circlelens'] = {

  supportSurfaceMerging: true, //支援界面融合 Surface merging

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'circlelens', p1: mouse, p2: mouse, p: 1.5};
  },

  p_box: objTypes['refractor'].p_box,

  //使用lineobj原型 Use the prototype lineobj
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: function(obj, mouse, ctrl, shift) {objTypes['lineobj'].c_mousemove(obj, mouse, false, shift)},
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,

  //繪圖區被按下時(判斷物件被按下的部分) When the drawing area is clicked (test which part of the obj is clicked)
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
      draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置 Mouse position when the user starts dragging
      draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置 Mouse position at the last moment during dragging
      draggingPart.snapData = {};
      return true;
    }
    return false;
  },

  //拖曳物件時 When the user is dragging the obj
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {objTypes['lineobj'].dragging(obj, mouse, draggingPart, false, shift)},

  //判斷一道光是否會射到此物件(若是,則回傳交點) Test if a ray may shoot on this object (if yes, return the intersection)
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

  zIndex: objTypes['refractor'].zIndex,

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas, aboveLight) {

  ctx.beginPath();
  ctx.arc(obj.p1.x, obj.p1.y, graphs.length_segment(obj), 0, Math.PI * 2, false);
  objTypes['refractor'].fillGlass(obj.p, obj, aboveLight);
  ctx.lineWidth = 1;
  //ctx.fillStyle="indigo";
  ctx.fillStyle = 'red';
  ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
  //ctx.fillStyle="rgb(255,0,255)";
  if (obj == mouseObj) {
    ctx.fillStyle = 'magenta';
    //ctx.fillStyle="Purple";
    ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
  }


  },

  //當物件被光射到時 When the obj is shot by a ray
  shot: function(obj, ray, rayIndex, rp, surfaceMerging_objs) {

    var midpoint = graphs.midpoint(graphs.line_segment(ray.p1, rp));
    var d = graphs.length_squared(obj.p1, obj.p2) - graphs.length_squared(obj.p1, midpoint);
    if (d > 0)
    {
      //從內部射向外部 Shot from inside to outside
      var n1 = (!colorMode)?obj.p:(obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001)); //來源介質的折射率(目的介質假設為1) The refractive index of the source material (assuming the destination has 1)
      var normal = {x: obj.p1.x - rp.x, y: obj.p1.y - rp.y};
    }
    else if (d < 0)
    {
      //從外部射向內部 Shot from outside to inside
      var n1 = 1 / ((!colorMode)?obj.p:(obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001)));
      var normal = {x: rp.x - obj.p1.x, y: rp.y - obj.p1.y};
    }
    else
    {
      //可能導致Bug的狀況(如射到邊界點 Shot at an edge point)
      //為防止光線射向錯誤方向導致誤解,將光線吸收 To prevent shooting the ray to a wrong direction, absorb the ray
      ray.exist = false;
      return;
    }

    var shotType;

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
    objTypes['refractor'].refract(ray, rayIndex, rp, normal, n1);


  },

  getShotType: function(obj, ray) {

    var midpoint = graphs.midpoint(graphs.line_segment(ray.p1, this.rayIntersection(obj, ray)));
    var d = graphs.length_squared(obj.p1, obj.p2) - graphs.length_squared(obj.p1, midpoint);

    if (d > 0)
    {
      return 1; //由內向外 From inside to outside
    }
    if (d < 0)
    {
      return -1; //由外向內 From outside to inside
    }
    return 2;
  }

};
