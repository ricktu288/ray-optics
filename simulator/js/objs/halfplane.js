// Glass -> Half-plane
objTypes['halfplane'] = {

  supportSurfaceMerging: true,

  // Create the obj
  create: function(mouse) {
    return {type: 'halfplane', p1: mouse, p2: mouse, p: 1.5};
  },

  populateObjBar: objTypes['refractor'].populateObjBar,

  // Use the prototype lineobj
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,

  // When the drawing area is clicked (test which part of the obj is clicked)
  clicked: function(obj, mouse_nogrid, mouse, draggingPart) {
    if (mouseOnPoint(mouse_nogrid, obj.p1) && geometry.length_squared(mouse_nogrid, obj.p1) <= geometry.length_squared(mouse_nogrid, obj.p2))
    {
      draggingPart.part = 1;
      draggingPart.targetPoint = geometry.point(obj.p1.x, obj.p1.y);
      return true;
    }
    if (mouseOnPoint(mouse_nogrid, obj.p2))
    {
      draggingPart.part = 2;
      draggingPart.targetPoint = geometry.point(obj.p2.x, obj.p2.y);
      return true;
    }
    if (mouseOnLine(mouse_nogrid, obj))
    {
      draggingPart.part = 0;
      draggingPart.mouse0 = mouse; // Mouse position when the user starts dragging
      draggingPart.mouse1 = mouse; // Mouse position at the last moment during dragging
      draggingPart.snapData = {};
      return true;
    }
    return false;
  },

  // When the user is dragging the obj
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    var basePoint;
    if (draggingPart.part == 1)
    {
      // Dragging the first endpoint
      basePoint = ctrl ? geometry.midpoint(draggingPart.originalObj) : draggingPart.originalObj.p2;

      obj.p1 = shift ? snapToDirection(mouse, basePoint, [{x: 1, y: 0},{x: 0, y: 1},{x: 1, y: 1},{x: 1, y: -1},{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)}]) : mouse;
      obj.p2 = ctrl ? geometry.point(2 * basePoint.x - obj.p2.x, 2 * basePoint.y - obj.p2.y) : basePoint;
    }
    if (draggingPart.part == 2)
    {
      // Dragging the second endpoint

      basePoint = ctrl ? geometry.midpoint(draggingPart.originalObj) : draggingPart.originalObj.p1;

      obj.p2 = shift ? snapToDirection(mouse, basePoint, [{x: 1, y: 0},{x: 0, y: 1},{x: 1, y: 1},{x: 1, y: -1},{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)}]) : mouse;
      obj.p1 = ctrl ? geometry.point(2 * basePoint.x - obj.p2.x, 2 * basePoint.y - obj.p2.y) : basePoint;
    }
    if (draggingPart.part == 0)
    {
      // Dragging the entire line

      if (shift)
      {
        var mouse_snapped = snapToDirection(mouse, draggingPart.mouse0, [{x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y)},{x: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y), y: -(draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x)}], draggingPart.snapData);
      }
      else
      {
        var mouse_snapped = mouse;
        draggingPart.snapData = {}; // Unlock the dragging direction when the user release the shift key
      }

      var mouseDiffX = draggingPart.mouse1.x - mouse_snapped.x; // The X difference between the mouse position now and at the previous moment
      var mouseDiffY = draggingPart.mouse1.y - mouse_snapped.y; // The Y difference between the mouse position now and at the previous moment
      // Move the first point
      obj.p1.x = obj.p1.x - mouseDiffX;
      obj.p1.y = obj.p1.y - mouseDiffY;
      // Move the second point
      obj.p2.x = obj.p2.x - mouseDiffX;
      obj.p2.y = obj.p2.y - mouseDiffY;
      // Update the mouse position
      draggingPart.mouse1 = mouse_snapped;
    }
  },

  // Test if a ray may shoot on this object (if yes, return the intersection)
  rayIntersection: function(obj, ray) {
    if (obj.p <= 0)return;
    var rp_temp = geometry.intersection_2line(geometry.line(ray.p1, ray.p2), geometry.line(obj.p1, obj.p2));

    if (geometry.intersection_is_on_ray(rp_temp, ray))
    {
      return rp_temp;
    }
  },

  zIndex: objTypes['refractor'].zIndex,

  // Draw the obj on canvas
  draw: function(obj, ctx, aboveLight) {

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

  objTypes['refractor'].fillGlass(obj.p, obj, ctx, aboveLight);

  if (obj == mouseObj) {
    ctx.fillStyle = 'magenta';
    ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
    ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
  }


  },

  // When the obj is shot by a ray
  shot: function(obj, ray, rayIndex, rp, surfaceMerging_objs) {
    var rdots = (ray.p2.x - ray.p1.x) * (obj.p2.x - obj.p1.x) + (ray.p2.y - ray.p1.y) * (obj.p2.y - obj.p1.y);
    var ssq = (obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y);
    var normal = {x: rdots * (obj.p2.x - obj.p1.x) - ssq * (ray.p2.x - ray.p1.x), y: rdots * (obj.p2.y - obj.p1.y) - ssq * (ray.p2.y - ray.p1.y)};

    var shotType = this.getShotType(obj, ray);
    if (shotType == 1)
    {
      // Shot from inside to outside
      var n1 = (!scene.colorMode)?obj.p:(obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001)); // The refractive index of the source material (assuming the destination has 1)
    }
    else if (shotType == -1)
    {
      // Shot from outside to inside
      var n1 = 1 / ((!scene.colorMode)?obj.p:(obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001)));
    }
    else
    {
      // Situation that may cause bugs (e.g. shot at an edge point)
      // To prevent shooting the ray to a wrong direction, absorb the ray
      ray.exist = false;
      return;
    }

    // Surface merging
    //if(surfaceMerging_obj)
    for (var i = 0; i < surfaceMerging_objs.length; i++)
    {
      shotType = objTypes[surfaceMerging_objs[i].type].getShotType(surfaceMerging_objs[i], ray);
      if (shotType == 1)
      {
        // Shot from inside to outside
        n1 *= (!scene.colorMode)?surfaceMerging_objs[i].p:(surfaceMerging_objs[i].p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001));
      }
      else if (shotType == -1)
      {
        // Shot from outside to inside
        n1 /= (!scene.colorMode)?surfaceMerging_objs[i].p:(surfaceMerging_objs[i].p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength*ray.wavelength*0.000001));
      }
      else if (shotType == 0)
      {
        // Equivalent to not shot on the obj (e.g. two interfaces overlap)
        //n1=n1;
      }
      else
      {
        // Situation that may cause bugs (e.g. shot at an edge point)
        // To prevent shooting the ray to a wrong direction, absorb the ray
        ray.exist = false;
        return;
      }
    }
    objTypes['refractor'].refract(ray, rayIndex, rp, normal, n1);


  },

  getShotType: function(obj, ray) {
    var rcrosss = (ray.p2.x - ray.p1.x) * (obj.p2.y - obj.p1.y) - (ray.p2.y - ray.p1.y) * (obj.p2.x - obj.p1.x);
    if (rcrosss > 0)
    {
      return 1; // From inside to outside
    }
    if (rcrosss < 0)
    {
      return -1; // From outside to inside
    }
    return 2;
  }

};
