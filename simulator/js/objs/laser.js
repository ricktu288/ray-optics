// Ray
objTypes['laser'] = {

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'laser', p1: mouse, p2: mouse, p: 1};
  },

  //使用lineobj原型 Use the prototype lineobj
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,

  //顯示屬性方塊 Show the property box
  p_box: function(obj, elem) {
    createNumberAttr(getMsg('brightness'), 0, 1, 0.01, obj.p || 1, function(obj, value) {
      obj.p = value;
    }, elem);
    if (colorMode) {
      createNumberAttr(getMsg('wavelength'), UV_WAVELENGTH, INFRARED_WAVELENGTH, 1, obj.wavelength || GREEN_WAVELENGTH, function(obj, value) {
        obj.wavelength = value;
      }, elem);
    }
  },

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas) {
  ctx.fillStyle = getMouseStyle(obj, colorMode ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(255,0,0)');
  ctx.fillRect(obj.p1.x - 2.5, obj.p1.y - 2.5, 5, 5);
  ctx.fillStyle = getMouseStyle(obj, 'rgb(255,0,0)');
  ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
  },


  //射出光線 Shoot rays
  shoot: function(obj) {
  var ray1 = graphs.ray(obj.p1, obj.p2);
  ray1.brightness_s = 0.5 * (obj.p || 1);
  ray1.brightness_p = 0.5 * (obj.p || 1);
  if (colorMode) {
    ray1.wavelength = obj.wavelength || GREEN_WAVELENGTH;
  }
  ray1.gap = true;
  ray1.isNew = true;
  addRay(ray1);
  }

};
