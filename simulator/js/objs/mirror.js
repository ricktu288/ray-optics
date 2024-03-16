// Mirror -> Segment
objTypes['mirror'] = {

  // Create the obj
  create: function (constructionPoint) {
    return { type: 'mirror', p1: constructionPoint, p2: constructionPoint };
  },

  // Use the prototype lineobj
  onConstructMouseDown: objTypes['lineobj'].onConstructMouseDown,
  onConstructMouseMove: objTypes['lineobj'].onConstructMouseMove,
  onConstructMouseUp: objTypes['lineobj'].onConstructMouseUp,
  move: objTypes['lineobj'].move,
  checkMouseOver: objTypes['lineobj'].checkMouseOver,
  onDrag: objTypes['lineobj'].onDrag,

  // Draw the obj on canvas
  draw: function (obj, canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    ctx.strokeStyle = isHovered ? 'cyan' : ((scene.colorMode && obj.wavelength && obj.isDichroic) ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(168,168,168)');
    ctx.beginPath();
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p2.x, obj.p2.y);
    ctx.stroke();
  },

  // Show the property box
  populateObjBar: function (obj, objBar) {
    dichroicSettings(obj, objBar);
  },

  //Describes how the ray refects off the mirror surface
  checkRayIntersects: function (obj, ray) {
    if (wavelengthInteraction(obj, ray)) {
      return objTypes['lineobj'].checkRayIntersects(obj, ray);
    }
  },

  // When the obj is shot by a ray
  onRayIncident: function (obj, ray, rayIndex, rp) {
    var rx = ray.p1.x - rp.x;
    var ry = ray.p1.y - rp.y;
    var mx = obj.p2.x - obj.p1.x;
    var my = obj.p2.y - obj.p1.y;

    ray.p1 = rp;
    ray.p2 = geometry.point(rp.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, rp.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
  }

};
