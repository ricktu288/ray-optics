// Blocker
objTypes['blackline'] = {

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'blackline', p1: mouse, p2: mouse};
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

  wavelengthInteraction: function(blackline, ray){
    var dichroicEnabled = colorMode && blackline.isDichroic && blackline.wavelength;
    var rayHueMatchesMirror =  Math.abs(blackline.wavelength - ray.wavelength) <= (blackline.bandwidth || 0);
    return !dichroicEnabled || (rayHueMatchesMirror != blackline.isDichroicFilter);
  }, 

  //Describes how the ray 
  rayIntersection: function(blackline, ray) {
    if (objTypes['blackline'].wavelengthInteraction(blackline,ray)) {
      return objTypes['lineobj'].rayIntersection(blackline, ray);
    }    
  },

  //當物件被光射到時 When the obj is shot by a ray
  shot: function(obj, ray, rayIndex, rp) {
    ray.exist = false;
  }

};
