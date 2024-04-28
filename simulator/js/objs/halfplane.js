// Glass -> Half-plane
objTypes['halfplane'] = {

  supportSurfaceMerging: true,

  // Create the obj
  create: function (constructionPoint) {
    return { type: 'halfplane', p1: constructionPoint, p2: constructionPoint, p: 1.5 };
  },

  populateObjBar: objTypes['refractor'].populateObjBar,

  // Use the prototype lineobj
  onConstructMouseDown: objTypes['lineobj'].onConstructMouseDown,
  onConstructMouseMove: objTypes['lineobj'].onConstructMouseMove,
  onConstructMouseUp: objTypes['lineobj'].onConstructMouseUp,
  move: objTypes['lineobj'].move,
  onDrag: objTypes['lineobj'].onDrag,

  // When the drawing area is clicked (test which part of the obj is clicked)
  checkMouseOver: function (obj, mouse) {
    let dragContext = {};
    if (mouse.isOnPoint(obj.p1) && geometry.distanceSquared(mouse.pos, obj.p1) <= geometry.distanceSquared(mouse.pos, obj.p2)) {
      dragContext.part = 1;
      dragContext.targetPoint = geometry.point(obj.p1.x, obj.p1.y);
      return dragContext;
    }
    if (mouse.isOnPoint(obj.p2)) {
      dragContext.part = 2;
      dragContext.targetPoint = geometry.point(obj.p2.x, obj.p2.y);
      return dragContext;
    }
    if (mouse.isOnLine(obj)) {
      const mousePos = mouse.getPosSnappedToGrid();
      dragContext.part = 0;
      dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
      dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
      dragContext.snapContext = {};
      return dragContext;
    }
  },

  // Test if a ray may shoot on this object (if yes, return the intersection)
  checkRayIntersects: function (obj, ray) {
    if (obj.p <= 0) return;
    var rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(obj.p1, obj.p2));

    if (geometry.intersectionIsOnRay(rp_temp, ray)) {
      return rp_temp;
    }
  },

  getZIndex: objTypes['refractor'].getZIndex,

  // Draw the obj on canvas
  draw: function (obj, canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;

    var len = Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));
    var par_x = (obj.p2.x - obj.p1.x) / len;
    var par_y = (obj.p2.y - obj.p1.y) / len;
    var per_x = par_y;
    var per_y = -par_x;

    var sufficientlyLargeDistance = (Math.abs(obj.p1.x + scene.origin.x) + Math.abs(obj.p1.y + scene.origin.y) + ctx.canvas.height + ctx.canvas.width) / Math.min(1, scene.scale);

    ctx.beginPath();
    ctx.moveTo(obj.p1.x - par_x * sufficientlyLargeDistance, obj.p1.y - par_y * sufficientlyLargeDistance);
    ctx.lineTo(obj.p1.x + par_x * sufficientlyLargeDistance, obj.p1.y + par_y * sufficientlyLargeDistance);
    ctx.lineTo(obj.p1.x + (par_x - per_x) * sufficientlyLargeDistance, obj.p1.y + (par_y - per_y) * sufficientlyLargeDistance);
    ctx.lineTo(obj.p1.x - (par_x + per_x) * sufficientlyLargeDistance, obj.p1.y - (par_y + per_y) * sufficientlyLargeDistance);

    objTypes['refractor'].fillGlass(obj.p, obj, canvasRenderer, isAboveLight, isHovered);

    if (isHovered) {
      ctx.fillStyle = 'magenta';
      ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
      ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
    }


  },

  // When the obj is shot by a ray
  onRayIncident: function (obj, ray, rayIndex, incidentPoint, surfaceMerging_objs) {
    // If at least one of the surface merging object is a GRIN glass, the interaction should be handled by the GRIN glass instead.
    if (surfaceMerging_objs) {
      for (let i = 0; i < surfaceMerging_objs.length; i++) {
        if (surfaceMerging_objs[i].type == 'grin_refractor' || surfaceMerging_objs[i].type == 'grin_circlelens') {
          // Exclude the GRIN glass from the surface merging objects and include obj itself.
          let new_surfaceMerging_objs = surfaceMerging_objs.filter((value, index, arr) => {
            return value != surfaceMerging_objs[i];
          });
          new_surfaceMerging_objs.push(obj);
          return objTypes[surfaceMerging_objs[i].type].onRayIncident(surfaceMerging_objs[i], ray, rayIndex, incidentPoint, new_surfaceMerging_objs);
        }
      }
    }

    var rdots = (ray.p2.x - ray.p1.x) * (obj.p2.x - obj.p1.x) + (ray.p2.y - ray.p1.y) * (obj.p2.y - obj.p1.y);
    var ssq = (obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y);
    var normal = { x: rdots * (obj.p2.x - obj.p1.x) - ssq * (ray.p2.x - ray.p1.x), y: rdots * (obj.p2.y - obj.p1.y) - ssq * (ray.p2.y - ray.p1.y) };

    var incidentType = this.getIncidentType(obj, ray);
    if (incidentType == 1) {
      // Shot from inside to outside
      var n1 = (!scene.colorMode) ? obj.p : (obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001)); // The refractive index of the source material (assuming the destination has 1)
    }
    else if (incidentType == -1) {
      // Shot from outside to inside
      var n1 = 1 / ((!scene.colorMode) ? obj.p : (obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001)));
    }
    else {
      // Situation that may cause bugs (e.g. shot at an edge point)
      // To prevent shooting the ray to a wrong direction, absorb the ray
      return {
        isAbsorbed: true
      };
    }

    // Surface merging
    //if(surfaceMerging_obj)
    for (var i = 0; i < surfaceMerging_objs.length; i++) {
      incidentType = objTypes[surfaceMerging_objs[i].type].getIncidentType(surfaceMerging_objs[i], ray);
      if (incidentType == 1) {
        // Shot from inside to outside
        n1 *= (!scene.colorMode) ? surfaceMerging_objs[i].p : (surfaceMerging_objs[i].p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001));
      }
      else if (incidentType == -1) {
        // Shot from outside to inside
        n1 /= (!scene.colorMode) ? surfaceMerging_objs[i].p : (surfaceMerging_objs[i].p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001));
      }
      else if (incidentType == 0) {
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
    return objTypes['refractor'].refract(ray, rayIndex, incidentPoint, normal, n1);


  },

  getIncidentType: function (obj, ray) {
    var rcrosss = (ray.p2.x - ray.p1.x) * (obj.p2.y - obj.p1.y) - (ray.p2.y - ray.p1.y) * (obj.p2.x - obj.p1.x);
    if (rcrosss > 0) {
      return 1; // From inside to outside
    }
    if (rcrosss < 0) {
      return -1; // From outside to inside
    }
    return 2;
  }

};
