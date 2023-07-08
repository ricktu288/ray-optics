// Detector
objTypes['power'] = {

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'power', p1: mouse, p2: mouse, power: 0, normal: 0, shear: 0};
  },

  //使用lineobj原型 Use the prototype lineobj
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,
  rayIntersection: objTypes['lineobj'].rayIntersection,

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas, aboveLight) {
    if (!aboveLight) {
      ctx.globalCompositeOperation = 'lighter';

      ctx.strokeStyle = getMouseStyle(obj, 'rgb(192,192,192)')
      ctx.setLineDash([5,5]);
      ctx.beginPath();
      ctx.moveTo(obj.p1.x, obj.p1.y);
      ctx.lineTo(obj.p2.x, obj.p2.y);
      ctx.stroke();
      ctx.setLineDash([]);

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

  //射出光線 Shoot rays
  shoot: function(obj) {
    obj.power = 0;
    obj.normal = 0;
    obj.shear = 0;
  },

  //當物件被光射到時 When the obj is shot by a ray
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
