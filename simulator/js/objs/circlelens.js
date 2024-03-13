// Glass -> Circle
objTypes['circlelens'] = {

  supportSurfaceMerging: true, // Surface merging

  // Create the obj
  create: function (constructionPoint) {
    return { type: 'circlelens', p1: constructionPoint, p2: constructionPoint, p: 1.5 };
  },

  populateObjBar: objTypes['refractor'].populateObjBar,

  // Use the prototype lineobj
  onConstructMouseDown: objTypes['circleobj'].onConstructMouseDown,
  onConstructMouseMove: objTypes['circleobj'].onConstructMouseMove,
  onConstructMouseUp: objTypes['circleobj'].onConstructMouseUp,
  move: objTypes['circleobj'].move,
  checkMouseOver: objTypes['circleobj'].checkMouseOver,
  onDrag: objTypes['circleobj'].onDrag,

  // Test if a ray may shoot on this object (if yes, return the intersection)
  checkRayIntersects: function (obj, ray) {
    if (obj.p <= 0) return;
    return objTypes['circleobj'].checkRayIntersects(obj, ray);
  },

  zIndex: objTypes['refractor'].zIndex,

  // Draw the obj on canvas
  draw: function (obj, ctx, aboveLight) {

    ctx.beginPath();
    ctx.arc(obj.p1.x, obj.p1.y, geometry.length_segment(obj), 0, Math.PI * 2, false);
    objTypes['refractor'].fillGlass(obj.p, obj, ctx, aboveLight);
    ctx.lineWidth = 1;
    //ctx.fillStyle="indigo";
    ctx.fillStyle = 'red';
    ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
    //ctx.fillStyle="rgb(255,0,255)";
    if (obj == mouseObj) {
      ctx.fillStyle = 'magenta';
      //ctx.fillStyle="Purple";
      ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
    }


  },

  // When the obj is shot by a ray
  onRayIncident: function (obj, ray, rayIndex, rp, surfaceMerging_objs) {

    var midpoint = geometry.midpoint(geometry.line_segment(ray.p1, rp));
    var d = geometry.length_squared(obj.p1, obj.p2) - geometry.length_squared(obj.p1, midpoint);
    if (d > 0) {
      // Shot from inside to outside
      var n1 = (!scene.colorMode) ? obj.p : (obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001)); // The refractive index of the source material (assuming the destination has 1)
      var normal = { x: obj.p1.x - rp.x, y: obj.p1.y - rp.y };
    }
    else if (d < 0) {
      // Shot from outside to inside
      var n1 = 1 / ((!scene.colorMode) ? obj.p : (obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001)));
      var normal = { x: rp.x - obj.p1.x, y: rp.y - obj.p1.y };
    }
    else {
      // Situation that may cause bugs (e.g. shot at an edge point)
      // To prevent shooting the ray to a wrong direction, absorb the ray
      return {
        isAbsorbed: true
      };
    }

    var shotType;

    // Surface merging
    for (var i = 0; i < surfaceMerging_objs.length; i++) {
      shotType = objTypes[surfaceMerging_objs[i].type].getShotType(surfaceMerging_objs[i], ray);
      if (shotType == 1) {
        // Shot from inside to outside
        n1 *= (!scene.colorMode) ? surfaceMerging_objs[i].p : (surfaceMerging_objs[i].p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001));
      }
      else if (shotType == -1) {
        // Shot from outside to inside
        n1 /= (!scene.colorMode) ? surfaceMerging_objs[i].p : (surfaceMerging_objs[i].p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001));
      }
      else if (shotType == 0) {
        // Equivalent to not shot on the obj (e.g. two interfaces overlap)
        //n1=n1;
      }
      else {
        // Situation that may cause bugs (e.g. shot at an edge point)
        // To prevent shooting the ray to a wrong direction, absorb the ray
        return {
          isAbsorbed: true
        };
      }
    }
    return objTypes['refractor'].refract(ray, rayIndex, rp, normal, n1);


  },

  getShotType: function (obj, ray) {

    var midpoint = geometry.midpoint(geometry.line_segment(ray.p1, this.checkRayIntersects(obj, ray)));
    var d = geometry.length_squared(obj.p1, obj.p2) - geometry.length_squared(obj.p1, midpoint);

    if (d > 0) {
      return 1; // From inside to outside
    }
    if (d < 0) {
      return -1; // From outside to inside
    }
    return 2;
  }

};
