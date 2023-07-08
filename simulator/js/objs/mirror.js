// Mirrors -> Segment
objTypes['mirror'] = {

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'mirror', p1: mouse, p2: mouse};
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
    this.dichroicSettings(obj,elem);
  },

  dichroicSettings: function(obj, elem){
    if (colorMode && createAdvancedOptions(obj.isDichroic)) {
      createBooleanAttr(getMsg('dichroic'), obj.isDichroic, function(obj, value) {
          obj.isDichroic = value;
          obj.wavelength = obj.wavelength || GREEN_WAVELENGTH;
          obj.isDichroicFilter = obj.isDichroicFilter || false;
          obj.bandwidth = obj.bandwidth || 10
      }, elem);
      createBooleanAttr(getMsg('filter'), obj.isDichroicFilter, function(obj, value) {
        if(obj.isDichroic){
          obj.isDichroicFilter = value;
        }
      }, elem);
      createNumberAttr(getMsg('wavelength'), UV_WAVELENGTH, INFRARED_WAVELENGTH, 1, obj.wavelength || GREEN_WAVELENGTH, function(obj, value) { 
        obj.wavelength = value;
      }, elem);
      createNumberAttr("± " + getMsg('bandwidth'), 0, (INFRARED_WAVELENGTH - UV_WAVELENGTH) , 1, obj.bandwidth || 10, function(obj, value) { 
        obj.bandwidth = value;
      }, elem);
    }
  },

  //Checks to see if the wavelength of the ray interacts and reflects off the mirror.
  //Reflect if not dichroic, the hue matches when not a filter, or when the hue doesn't match and it is a filter
  wavelengthInteraction: function(mirror, ray){
    var dichroicEnabled = colorMode && mirror.isDichroic && mirror.wavelength;
    var rayHueMatchesMirror =  Math.abs(mirror.wavelength - ray.wavelength) <= (mirror.bandwidth || 0);
    return !dichroicEnabled || (rayHueMatchesMirror != mirror.isDichroicFilter);
  }, 

  //Describes how the ray refects off the mirror surface
  rayIntersection: function(mirror, ray) {
    if (objTypes['mirror'].wavelengthInteraction(mirror,ray)) {
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
