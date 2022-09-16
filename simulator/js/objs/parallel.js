// Beam
objTypes['parallel'] = {

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'parallel', p1: mouse, p2: mouse, p: 0.5};
  },

  p_box: objTypes['laser'].p_box,

  //使用lineobj原型 Use the prototype lineobj
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas) {
    //var ctx = canvas.getContext('2d');
    var a_l = Math.atan2(obj.p1.x - obj.p2.x, obj.p1.y - obj.p2.y) - Math.PI / 2;
    if (colorMode) {
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

    ctx.strokeStyle = 'rgba(128,128,128,255)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p2.x, obj.p2.y);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
  },

  //射出光線 Shoot rays
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
