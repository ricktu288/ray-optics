// Mirrors -> Beam Splitter
// Originally contributed by Paul Falstad (pfalstad)
objTypes['beamsplitter'] = {

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'beamsplitter', p1: mouse, p2: mouse, p: .5, isDichroic: false, isDichroicFilter: false};
  },

  dichroicSettings: objTypes['mirror'].dichroicSettings,

  //顯示屬性方塊 Show the property box
  p_box: function(obj, elem) {
    createNumberAttr(getMsg('transmissionratio'), 0, 1, 0.01, obj.p, function(obj, value) {
      obj.p = value;
    }, elem);
    dichroicSettings(obj,elem);
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
  draw: function(obj, canvas) {
    ctx.strokeStyle = getMouseStyle(obj, 'rgb(100,100,168)');
    ctx.beginPath();
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p2.x, obj.p2.y);
    ctx.stroke();
    ctx.strokeStyle = getMouseStyle(obj, (colorMode && obj.wavelength && obj.isDichroic) ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(100,100,168)');
    ctx.setLineDash([15, 15]);
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p2.x, obj.p2.y);
    ctx.stroke();
    ctx.setLineDash([]);
  },

  rayIntersection: function(obj, ray) {
    return objTypes['mirror'].rayIntersection(obj, ray);
  },

  //當物件被光射到時 When the obj is shot by a ray
  shot: function(mirror, ray, rayIndex, rp) {
    var rx = ray.p1.x - rp.x;
    var ry = ray.p1.y - rp.y;

    ray.p1 = rp;
    var mx = mirror.p2.x - mirror.p1.x;
    var my = mirror.p2.y - mirror.p1.y;
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
  },

};
