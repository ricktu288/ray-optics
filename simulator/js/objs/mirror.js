// Mirrors -> Segment
objTypes['mirror'] = {

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'mirror', p1: mouse, p2: mouse, isDichroic: false, isDichroicFilter: false};
  },

  //使用lineobj原型 Use the prototype lineobj
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas) {    
    ctx.strokeStyle = getMouseStyle(obj, (colorMode && obj.wavelength && obj.isDichroic) ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(168,168,168)');
    ctx.beginPath();
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p2.x, obj.p2.y);
    ctx.stroke();
  },

  //顯示屬性方塊 Show the property box
  p_box: function(obj, elem) {
    if (colorMode) {
      createBooleanAttr(getMsg('dichroic'), obj.isDichroic, function(obj, value) {
          obj.isDichroic = value;
      }, elem);
      createBooleanAttr(/*getMsg('dichroic')*/" Filter", obj.isDichroicFilter, function(obj, value) {
        obj.isDichroicFilter = value;
      }, elem);
      createNumberAttr(getMsg('wavelength'), UV_WAVELENGTH, INFRARED_WAVELENGTH, 1, obj.wavelength || GREEN_WAVELENGTH, function(obj, value) { 
        obj.wavelength = obj.isDichroic? value : NaN;
      }, elem);
    }
  },

  rayIntersection: function(mirror, ray) {
    var dichroicEnabled = colorMode && mirror.isDichroic && mirror.wavelength;
    var rayHueMatchesMirror =  mirror.wavelength == ray.wavelength;
    //Reflect if not dichroic, the hue matches when not a filter, or when the hue doesn't match and it is a filter
    if(!dichroicEnabled || rayHueMatchesMirror != mirror.isDichroicFilter) {    
      return objTypes['lineobj'].rayIntersection(mirror, ray);
    }
  },

  //當物件被光射到時 When the obj is shot by a ray
  shot: function(mirror, ray, rayIndex, rp) {
    var rx = ray.p1.x - rp.x;
    var ry = ray.p1.y - rp.y;
    var mx = mirror.p2.x - mirror.p1.x;
    var my = mirror.p2.y - mirror.p1.y;

    ray.p1 = rp;
    ray.p2 = graphs.point(rp.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, rp.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
  }


};
