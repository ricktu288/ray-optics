// Blocker -> Line Blocker
objTypes['blackline'] = {

  // Create the obj
  create: function(mouse) {
    return {type: 'blackline', p1: mouse, p2: mouse};
  },

  // Use the prototype lineobj
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,

  // Draw the obj on canvas
  draw: function(obj, ctx, aboveLight) {
  ctx.strokeStyle = getMouseStyle(obj, (colorMode && obj.wavelength && obj.isDichroic) ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(70,35,10)');
  ctx.lineWidth = 3;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(obj.p1.x, obj.p1.y);
  ctx.lineTo(obj.p2.x, obj.p2.y);
  ctx.stroke();
  ctx.lineWidth = 1;
  },

  // Show the property box
  p_box: function(obj, elem) {
    dichroicSettings(obj,elem);
  },

  //Describes how the ray hits the object
  rayIntersection: function(blackline, ray) {
    if (wavelengthInteraction(blackline,ray)) {
      return objTypes['lineobj'].rayIntersection(blackline, ray);
    }    
  },

  // When the obj is shot by a ray
  shot: function(obj, ray, rayIndex, rp) {
    ray.exist = false;
  }

};
