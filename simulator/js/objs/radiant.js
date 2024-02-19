// Light Source -> Point source (360deg)
objTypes['radiant'] = {

  // Create the obj
  create: function(mouse) {
  return {type: 'radiant', x: mouse.x, y: mouse.y, p: 0.5};
  },

  // Show the property box
  populateObjBar: function(obj, elem) {
    objBar.createNumber(getMsg('brightness'), 0.01, 1, 0.01, obj.p || 1, function(obj, value) {
      obj.p = value;
    }, getMsg('brightness_note_popover'));
    if (scene.colorMode) {
      objBar.createNumber(getMsg('wavelength'), UV_WAVELENGTH, INFRARED_WAVELENGTH, 1, obj.wavelength || GREEN_WAVELENGTH, function(obj, value) {
        obj.wavelength = value;
      });
    }
  },

  // Mousedown when the obj is being constructed by the user
  c_mousedown: function(obj, mouse, ctrl, shift)
  {
    
  },
  // Mousemove when the obj is being constructed by the user
  c_mousemove: function(obj, mouse, ctrl, shift)
  {

  },
  // Mouseup when the obj is being constructed by the user
  c_mouseup: function(obj, mouse, ctrl, shift)
  {
    isConstructing = false;
  },

  // Draw the obj on canvas
  draw: function(obj, ctx, aboveLight) {
  ctx.fillStyle = scene.colorMode? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : getMouseStyle(obj, 'rgb(0,255,0)');
  ctx.fillRect(obj.x - 2.5, obj.y - 2.5, 5, 5);
  if (scene.colorMode) {
    ctx.fillStyle = getMouseStyle(obj, 'rgb(255,255,255)');
    ctx.fillRect(obj.x - 1.5, obj.y - 1.5, 3, 3);
  }
  },

  // Move the object
  move: function(obj, diffX, diffY) {
    obj.x = obj.x + diffX;
    obj.y = obj.y + diffY;
    return obj;
  },

  // When the drawing area is clicked (test which part of the obj is clicked)
  clicked: function(obj, mouse_nogrid, mouse, draggingPart) {
    if (mouseOnPoint(mouse_nogrid, obj))
    {
      draggingPart.part = 0;
      draggingPart.mouse0 = geometry.point(obj.x, obj.y);
      draggingPart.targetPoint = geometry.point(obj.x, obj.y);
      draggingPart.snapData = {};
      return true;
    }
    return false;
  },

  // When the user is dragging the obj
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    if (shift)
    {
      var mouse_snapped = snapToDirection(mouse, draggingPart.mouse0, [{x: 1, y: 0},{x: 0, y: 1}], draggingPart.snapData);
    }
    else
    {
      var mouse_snapped = mouse;
      draggingPart.snapData = {}; // Unlock the dragging direction when the user release the shift key
    }

    obj.x = mouse_snapped.x;
    obj.y = mouse_snapped.y;
  },

  // Shoot rays
  shoot: function(obj) {
  var s = Math.PI * 2 / parseInt(scene.rayDensity * 500);
  var i0 = (scene.mode == 'observer') ? (-s * 2 + 1e-6) : 0; // To avoid black gap when using the observer
  for (var i = i0; i < (Math.PI * 2 - 1e-5); i = i + s)
  {
    var ray1 = geometry.ray(geometry.point(obj.x, obj.y), geometry.point(obj.x + Math.sin(i), obj.y + Math.cos(i)));
    ray1.brightness_s = Math.min(obj.p / scene.rayDensity, 1) * 0.5;
    ray1.brightness_p = Math.min(obj.p / scene.rayDensity, 1) * 0.5;
    ray1.isNew = true;
    if (scene.colorMode) {
      ray1.wavelength = obj.wavelength || GREEN_WAVELENGTH;
    }
    if (i == i0)
    {
      ray1.gap = true;
    }
    addRay(ray1);
  }
  }

};
