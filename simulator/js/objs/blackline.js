// Blocker -> Line Blocker
objTypes['blackline'] = {

  // Create the obj
  create: function (constructionPoint) {
    return { type: 'blackline', p1: constructionPoint, p2: constructionPoint };
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
    ctx.strokeStyle = isHovered ? 'cyan' : ((scene.colorMode && obj.wavelength && obj.isDichroic) ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(70,35,10)');
    ctx.lineWidth = 3;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p2.x, obj.p2.y);
    ctx.stroke();
    ctx.lineWidth = 1;
  },

  // Show the property box
  populateObjBar: function (obj, objBar) {
    dichroicSettings(obj, objBar);
  },

  //Describes how the ray hits the object
  checkRayIntersects: function (obj, ray) {
    if (wavelengthInteraction(obj, ray)) {
      return objTypes['lineobj'].checkRayIntersects(obj, ray);
    }
  },

  // When the obj is shot by a ray
  onRayIncident: function (obj, ray, rayIndex, incidentPoint) {
    return {
      isAbsorbed: true
    };
  }

};
