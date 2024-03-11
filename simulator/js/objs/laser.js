// Light source -> Single ray
objTypes['laser'] = {

  // Create the obj
  create: function (constructionPoint) {
    return { type: 'laser', p1: constructionPoint, p2: constructionPoint, p: 1 };
  },

  // Use the prototype lineobj
  onConstructMouseDown: objTypes['lineobj'].onConstructMouseDown,
  onConstructMouseMove: objTypes['lineobj'].onConstructMouseMove,
  onConstructMouseUp: objTypes['lineobj'].onConstructMouseUp,
  move: objTypes['lineobj'].move,
  checkMouseOver: objTypes['lineobj'].checkMouseOver,
  onDrag: objTypes['lineobj'].onDrag,

  // Show the property box
  populateObjBar: function (obj, objBar) {
    objBar.createNumber(getMsg('brightness'), 0.01, 1, 0.01, obj.p || 1, function (obj, value) {
      obj.p = value;
    });
    if (scene.colorMode) {
      objBar.createNumber(getMsg('wavelength'), UV_WAVELENGTH, INFRARED_WAVELENGTH, 1, obj.wavelength || GREEN_WAVELENGTH, function (obj, value) {
        obj.wavelength = value;
      });
    }
  },

  // Draw the obj on canvas
  draw: function (obj, ctx, aboveLight) {
    ctx.fillStyle = getMouseStyle(obj, scene.colorMode ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(255,0,0)');
    ctx.fillRect(obj.p1.x - 2.5, obj.p1.y - 2.5, 5, 5);
    ctx.fillStyle = getMouseStyle(obj, 'rgb(255,0,0)');
    ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
  },


  // Shoot rays
  onBeginSimulate: function (obj) {
    var ray1 = geometry.ray(obj.p1, obj.p2);
    ray1.brightness_s = 0.5 * (obj.p || 1);
    ray1.brightness_p = 0.5 * (obj.p || 1);
    if (scene.colorMode) {
      ray1.wavelength = obj.wavelength || GREEN_WAVELENGTH;
    }
    ray1.gap = true;
    ray1.isNew = true;
    addRay(ray1);
  }

};
