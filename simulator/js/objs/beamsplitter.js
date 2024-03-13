// Mirror -> Beam Splitter
objTypes['beamsplitter'] = {

  // Create the obj
  create: function (constructionPoint) {
    return { type: 'beamsplitter', p1: constructionPoint, p2: constructionPoint, p: .5, isDichroic: false, isDichroicFilter: false };
  },

  dichroicSettings: objTypes['mirror'].dichroicSettings,

  // Show the property box
  populateObjBar: function (obj, objBar) {
    objBar.createNumber(getMsg('transmissionratio'), 0, 1, 0.01, obj.p, function (obj, value) {
      obj.p = value;
    });
    dichroicSettings(obj, objBar);
  },

  // Use the prototype lineobj
  onConstructMouseDown: objTypes['lineobj'].onConstructMouseDown,
  onConstructMouseMove: objTypes['lineobj'].onConstructMouseMove,
  onConstructMouseUp: objTypes['lineobj'].onConstructMouseUp,
  move: objTypes['lineobj'].move,
  checkMouseOver: objTypes['lineobj'].checkMouseOver,
  onDrag: objTypes['lineobj'].onDrag,
  checkRayIntersects: objTypes['lineobj'].checkRayIntersects,

  // Draw the obj on canvas
  draw: function (obj, ctx, aboveLight) {
    ctx.strokeStyle = getMouseStyle(obj, 'rgb(100,100,168)');
    ctx.beginPath();
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p2.x, obj.p2.y);
    ctx.stroke();
    ctx.strokeStyle = getMouseStyle(obj, (scene.colorMode && obj.wavelength && obj.isDichroic) ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(100,100,168)');
    ctx.setLineDash([15, 15]);
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p2.x, obj.p2.y);
    ctx.stroke();
    ctx.setLineDash([]);
  },

  checkRayIntersects: function (obj, ray) {
    return objTypes['mirror'].checkRayIntersects(obj, ray);
  },

  // When the obj is shot by a ray
  onRayIncident: function (obj, ray, rayIndex, rp) {
    var rx = ray.p1.x - rp.x;
    var ry = ray.p1.y - rp.y;

    ray.p1 = rp;
    var mx = obj.p2.x - obj.p1.x;
    var my = obj.p2.y - obj.p1.y;
    ray.p2 = geometry.point(rp.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, rp.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
    var ray2 = geometry.ray(rp, geometry.point(rp.x - rx, rp.y - ry));
    var transmission = obj.p;
    ray2.brightness_s = transmission * ray.brightness_s;
    ray2.brightness_p = transmission * ray.brightness_p;
    ray2.wavelength = ray.wavelength;
    ray.brightness_s *= (1 - transmission);
    ray.brightness_p *= (1 - transmission);
    if (ray2.brightness_s + ray2.brightness_p > .01) {
      return {
        newRays: [ray2]
      };
    } else {
      return {
        truncation: ray2.brightness_s + ray2.brightness_p
      };
    }
  }

};
