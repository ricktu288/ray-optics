// Ruler
objTypes['ruler'] = {

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'ruler', p1: mouse, p2: mouse};
  },

  //使用lineobj原型 Use the prototype lineobj
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas, aboveLight) {
  if (aboveLight)return;
  ctx.globalCompositeOperation = 'lighter';
  var len = Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));
  var par_x = (obj.p2.x - obj.p1.x) / len;
  var par_y = (obj.p2.y - obj.p1.y) / len;
  var per_x = par_y;
  var per_y = -par_x;
  var ang = Math.atan2(obj.p2.y - obj.p1.y, obj.p2.x - obj.p1.x);

  var scale_step = 10;
  var scale_step_mid = 50;
  var scale_step_long = 100;
  var scale_len = 10;
  var scale_len_mid = 15;


  ctx.strokeStyle = getMouseStyle(obj, 'rgb(128,128,128)');
  //ctx.font="bold 14px Arial";
  ctx.font = '14px Arial';
  ctx.fillStyle = 'rgb(128,128,128)';

  if (ang > Math.PI * (-0.25) && ang <= Math.PI * 0.25)
  {
    //↘~↗
    var scale_direction = -1;
    var scale_len_long = 20;
    var text_ang = ang;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
  }
  else if (ang > Math.PI * (-0.75) && ang <= Math.PI * (-0.25))
  {
    //↗~↖
    var scale_direction = 1;
    var scale_len_long = 15;
    var text_ang = ang - Math.PI * (-0.5);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
  }
  else if (ang > Math.PI * 0.75 || ang <= Math.PI * (-0.75))
  {
    //↖~↙
    var scale_direction = 1;
    var scale_len_long = 20;
    var text_ang = ang - Math.PI;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
  }
  else
  {
    //↙~↘
    var scale_direction = -1;
    var scale_len_long = 15;
    var text_ang = ang - Math.PI * 0.5;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
  }

  ctx.beginPath();
  ctx.moveTo(obj.p1.x, obj.p1.y);
  ctx.lineTo(obj.p2.x, obj.p2.y);
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
    }
    else
    {
      ctx.lineTo(obj.p1.x + i * par_x + scale_direction * scale_len * per_x, obj.p1.y + i * par_y + scale_direction * scale_len * per_y);
    }
  }
  ctx.stroke();

  ctx.globalCompositeOperation = 'source-over';
  }

};
