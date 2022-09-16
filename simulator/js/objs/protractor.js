// Protractor
objTypes['protractor'] = {

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'protractor', p1: mouse, p2: mouse};
  },

  //使用lineobj原型 Use the prototype lineobj
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: function(obj, mouse, ctrl, shift) {objTypes['lineobj'].c_mousemove(obj, mouse, false, shift)},
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
    if (Math.abs(graphs.length(obj.p1, mouse_nogrid) - graphs.length_segment(obj)) < clickExtent_line)
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

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas, aboveLight) {
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

    ctx.strokeStyle = getMouseStyle(obj, 'rgb(128,128,128)');
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = 'rgb(128,128,128)';

    if (r * scale_step * Math.PI / 180 < scale_width_limit)
    {
      //刻度太小 The scale is too small
      scale_step = 2;
      scale_step_mid = 10;
      scale_step_long = 30;
    }
    if (r * scale_step * Math.PI / 180 < scale_width_limit)
    {
      //刻度太小 The scale is too small
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
      //刻度太小 The scale is too small
      scale_step = 10;
      scale_step_mid = 30;
      scale_step_long = 90;
    }


    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    ctx.beginPath();
    ctx.arc(obj.p1.x, obj.p1.y, r, 0, Math.PI * 2, false);

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
      }
      else
      {
        ctx.lineTo(obj.p1.x + (r - scale_len) * Math.cos(ang), obj.p1.y + (r - scale_len) * Math.sin(ang));
      }
    }
    ctx.stroke();

    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = 'red';
  ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
  if (obj == mouseObj) {
    ctx.fillStyle = 'magenta';
    ctx.fillRect(obj.p2.x - 2.5, obj.p2.y - 2.5, 5, 5);
  }

  }

};
