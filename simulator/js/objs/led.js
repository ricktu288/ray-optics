// Light source -> Point source (<360deg)
objTypes['led'] = {

  // Create the obj
  create: function (constructionPoint) {
    return { type: 'led', p1: constructionPoint, p2: constructionPoint, p: 36.001, symmetric: true };
  },

  // Show the property box
  populateObjBar: function (obj, objBar) {
    objBar.createNumber(getMsg('brightness'), 0.01, 1, 0.01, obj.brightness || 0.5, function (obj, value) {
      obj.brightness = value;
    }, getMsg('brightness_note_popover'));
    if (scene.colorMode) {
      objBar.createNumber(getMsg('wavelength'), UV_WAVELENGTH, INFRARED_WAVELENGTH, 1, obj.wavelength || GREEN_WAVELENGTH, function (obj, value) {
        obj.wavelength = value;
      });
    }
    objBar.createNumber(getMsg('emissionangle'), 0, 180, 1, obj.p, function (obj, value) {
      obj.p = value;
    });
    if (objBar.showAdvanced(!obj.symmetric)) {
      objBar.createBoolean(getMsg('symmetric'), obj.symmetric, function (obj, value) {
        obj.symmetric = value;
      });
    }
  },

  // Use the prototype lineobj
  onConstructMouseDown: objTypes['lineobj'].onConstructMouseDown,
  onConstructMouseMove: objTypes['lineobj'].onConstructMouseMove,
  onConstructMouseUp: objTypes['lineobj'].onConstructMouseUp,
  move: objTypes['lineobj'].move,
  checkMouseOver: objTypes['lineobj'].checkMouseOver,
  onDrag: objTypes['lineobj'].onDrag,

  // Draw the obj on canvas
  draw: function (obj, ctx, aboveLight) {
    ctx.fillStyle = scene.colorMode ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : getMouseStyle(obj, 'rgb(0,255,0)');
    ctx.fillRect(obj.p1.x - 2.5, obj.p1.y - 2.5, 5, 5);
    if (scene.colorMode) {
      ctx.fillStyle = getMouseStyle(obj, 'rgb(255,255,255)');
      ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
    }
    ctx.fillStyle = getMouseStyle(obj, 'rgb(255,0,0)');
    ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
  },


  // Shoot rays
  onSimulationStart: function (obj) {
    var s = Math.PI * 2 / parseInt(scene.rayDensity * 500);
    var i0 = (scene.mode == 'observer') ? (-s * 2 + 1e-6) : 0;

    var ang, x1, y1, iStart, iEnd;
    if (obj.symmetric) {
      iStart = (i0 - (Math.PI / 180.0 * obj.p) / 2.0);
      iEnd = (i0 + (Math.PI / 180.0 * obj.p) / 2.0 - 1e-5);
    } else {
      iStart = i0;
      iEnd = (i0 + (Math.PI / 180.0 * obj.p) - 1e-5);
    }
    for (var i = iStart; i < iEnd; i = i + s) {
      var r = Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));

      ang = i + Math.atan2(obj.p2.y - obj.p1.y, obj.p2.x - obj.p1.x);

      x1 = obj.p1.x + r * Math.cos(ang);
      y1 = obj.p1.y + r * Math.sin(ang);

      var ray1 = geometry.ray(geometry.point(obj.p1.x, obj.p1.y), geometry.point(x1, y1));

      ray1.brightness_s = Math.min((obj.brightness || 0.5) / scene.rayDensity, 1) * 0.5;
      ray1.brightness_p = Math.min((obj.brightness || 0.5) / scene.rayDensity, 1) * 0.5;
      if (scene.colorMode) {
        ray1.wavelength = obj.wavelength || GREEN_WAVELENGTH;
      }
      ray1.isNew = true;
      if (i == i0) {
        ray1.gap = true;
      }
      addRay(ray1);
    }
  }

};
