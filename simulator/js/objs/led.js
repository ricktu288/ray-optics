// Point source -> Finite angle
// Originally contributed by GLmontanari
objTypes['led'] = {
  
  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'led', p1: mouse, p2: mouse, p : 30, symmetric : true};
  },

  //顯示屬性方塊 Show the property box
  p_box: function(obj, elem) {
    createNumberAttr(getMsg('brightness'), 0, 1, 0.01, obj.brightness || 0.5, function(obj, value) {
      obj.brightness = value;
    }, elem, getMsg('brightness_note_popover'));
    if (colorMode) {
      createNumberAttr(getMsg('wavelength'), UV_WAVELENGTH, INFRARED_WAVELENGTH, 1, obj.wavelength || GREEN_WAVELENGTH, function(obj, value) {
        obj.wavelength = value;
      }, elem);
    }
    createNumberAttr(getMsg('emissionangle'), 0, 180, 1, obj.p, function(obj, value) {
      obj.p = value;
    }, elem);
    if (createAdvancedOptions(!obj.symmetric)) {
      createBooleanAttr(getMsg('symmetric'), obj.symmetric, function(obj, value) {
        obj.symmetric = value;
      }, elem);
    }
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
  ctx.fillStyle = colorMode? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : getMouseStyle(obj, 'rgb(0,255,0)');
  ctx.fillRect(obj.p1.x - 2.5, obj.p1.y - 2.5, 5, 5);
  if (colorMode) {
    ctx.fillStyle = getMouseStyle(obj, 'rgb(255,255,255)');
    ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
  }
  ctx.fillStyle = getMouseStyle(obj, 'rgb(255,0,0)');
  ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
  },


  //射出光線 Shoot rays
  shoot: function(obj) {
  var s = Math.PI * 2 / parseInt(getRayDensity() * 500);
  var i0 = (mode == 'observer') ? (-s * 2 + 1e-6) : 0;
  
  var ang, x1, y1, iStart, iEnd;
  if (obj.symmetric) {
    iStart = (i0 - (Math.PI / 180.0 * obj.p) / 2.0);
    iEnd = (i0 + (Math.PI / 180.0 * obj.p) / 2.0 - 1e-5);
  } else {
    iStart = i0;
    iEnd = (i0 + (Math.PI / 180.0 * obj.p) - 1e-5);
  }
  for (var i = iStart; i < iEnd; i = i + s)
  {
	var r = Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));	
	
	ang = i + Math.atan2(obj.p2.y - obj.p1.y, obj.p2.x - obj.p1.x);

	x1 = obj.p1.x + r * Math.cos(ang);
	y1 = obj.p1.y + r * Math.sin(ang);
	
    var ray1 = graphs.ray(graphs.point(obj.p1.x, obj.p1.y), graphs.point(x1, y1));
	
    ray1.brightness_s = Math.min((obj.brightness || 0.5) / getRayDensity(), 1) * 0.5;
    ray1.brightness_p = Math.min((obj.brightness || 0.5) / getRayDensity(), 1) * 0.5;
    if (colorMode) {
      ray1.wavelength = obj.wavelength || GREEN_WAVELENGTH;
    }
    ray1.isNew = true;
    if (i == i0)
    {
      ray1.gap = true;
    }
    addRay(ray1);
  }
  }

};
