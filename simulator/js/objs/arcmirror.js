// Mirror -> Circular Arc
objTypes['arcmirror'] = {

  // Create the obj
  create: function (mouse) {
    return { type: 'arcmirror', p1: mouse.getPosSnappedToGrid() };
  },

  // Show the property box
  populateObjBar: function (obj, objBar) {
    dichroicSettings(obj, objBar);
  },

  // Mousedown when the obj is being constructed by the user
  c_mousedown: function (obj, mouse, ctrl, shift) {
    if (!obj.p2 && !obj.p3) {
      obj.p2 = mouse.getPosSnappedToGrid();
      return;
    }
    if (obj.p2 && !obj.p3 && !mouse.isOnPoint(obj.p1)) {
      if (shift) {
        obj.p2 = mouse.getPosSnappedToDirection(constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
      }
      else {
        obj.p2 = mouse.getPosSnappedToGrid();
      }
      obj.p3 = mouse.getPosSnappedToGrid();
      return;
    }
  },
  // Mousemove when the obj is being constructed by the user
  c_mousemove: function (obj, mouse, ctrl, shift) {
    if (!obj.p3 && !mouse.isOnPoint(obj.p1)) {
      if (shift) {
        obj.p2 = mouse.getPosSnappedToDirection(constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
      }
      else {
        obj.p2 = mouse.getPosSnappedToGrid();
      }

      obj.p1 = ctrl ? geometry.point(2 * constructionPoint.x - obj.p2.x, 2 * constructionPoint.y - obj.p2.y) : constructionPoint;

      return;
    }
    if (obj.p3) {
      obj.p3 = mouse.getPosSnappedToGrid();
      return;
    }
  },
  // Mouseup when the obj is being constructed by the user
  c_mouseup: function (obj, mouse, ctrl, shift) {
    if (obj.p2 && !obj.p3 && !mouse.isOnPoint(obj.p1)) {
      obj.p3 = mouse.getPosSnappedToGrid();
      return;
    }
    if (obj.p3 && !mouse.isOnPoint(obj.p2)) {
      obj.p3 = mouse.getPosSnappedToGrid();
      return {
        isDone: true
      };
    }
  },

  // Draw the obj on canvas
  draw: function (obj, ctx, aboveLight) {
    ctx.fillStyle = 'rgb(255,0,255)';
    if (obj.p3 && obj.p2) {
      var center = geometry.intersection_2line(geometry.perpendicular_bisector(geometry.line(obj.p1, obj.p3)), geometry.perpendicular_bisector(geometry.line(obj.p2, obj.p3)));
      if (isFinite(center.x) && isFinite(center.y)) {
        var r = geometry.length(center, obj.p3);
        var a1 = Math.atan2(obj.p1.y - center.y, obj.p1.x - center.x);
        var a2 = Math.atan2(obj.p2.y - center.y, obj.p2.x - center.x);
        var a3 = Math.atan2(obj.p3.y - center.y, obj.p3.x - center.x);
        ctx.strokeStyle = getMouseStyle(obj, (scene.colorMode && obj.wavelength && obj.isDichroic) ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(168,168,168)');
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, a1, a2, (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2));
        ctx.stroke();
        if (obj == mouseObj) {
          ctx.fillRect(obj.p3.x - 1.5, obj.p3.y - 1.5, 3, 3);
          ctx.fillStyle = 'rgb(255,0,0)';
          ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
          ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
        }
      }
      else {
        // The three points on the arc is colinear. Treat as a line segment.
        ctx.strokeStyle = getMouseStyle(obj, (scene.colorMode && obj.wavelength && obj.isDichroic) ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(168,168,168)');
        ctx.beginPath();
        ctx.moveTo(obj.p1.x, obj.p1.y);
        ctx.lineTo(obj.p2.x, obj.p2.y);
        ctx.stroke();

        ctx.fillRect(obj.p3.x - 1.5, obj.p3.y - 1.5, 3, 3);
        ctx.fillStyle = 'rgb(255,0,0)';
        ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
        ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
      }
    }
    else if (obj.p2) {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
      ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
    }
    else {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
    }
  },

  // Move the object
  move: function (obj, diffX, diffY) {
    // Move the first point
    obj.p1.x = obj.p1.x + diffX;
    obj.p1.y = obj.p1.y + diffY;
    // Move the second point
    obj.p2.x = obj.p2.x + diffX;
    obj.p2.y = obj.p2.y + diffY;

    obj.p3.x = obj.p3.x + diffX;
    obj.p3.y = obj.p3.y + diffY;
    return obj;
  },


  // When the drawing area is clicked (test which part of the obj is clicked)
  clicked: function (obj, mouse, draggingPart) {
    if (mouse.isOnPoint(obj.p1) && geometry.length_squared(mouse.pos, obj.p1) <= geometry.length_squared(mouse.pos, obj.p2) && geometry.length_squared(mouse.pos, obj.p1) <= geometry.length_squared(mouse.pos, obj.p3)) {
      draggingPart.part = 1;
      draggingPart.targetPoint = geometry.point(obj.p1.x, obj.p1.y);
      return true;
    }
    if (mouse.isOnPoint(obj.p2) && geometry.length_squared(mouse.pos, obj.p2) <= geometry.length_squared(mouse.pos, obj.p3)) {
      draggingPart.part = 2;
      draggingPart.targetPoint = geometry.point(obj.p2.x, obj.p2.y);
      return true;
    }
    if (mouse.isOnPoint(obj.p3)) {
      draggingPart.part = 3;
      draggingPart.targetPoint = geometry.point(obj.p3.x, obj.p3.y);
      return true;
    }

    var center = geometry.intersection_2line(geometry.perpendicular_bisector(geometry.line(obj.p1, obj.p3)), geometry.perpendicular_bisector(geometry.line(obj.p2, obj.p3)));
    const mousePos = mouse.getPosSnappedToGrid();
    if (isFinite(center.x) && isFinite(center.y)) {
      var r = geometry.length(center, obj.p3);
      var a1 = Math.atan2(obj.p1.y - center.y, obj.p1.x - center.x);
      var a2 = Math.atan2(obj.p2.y - center.y, obj.p2.x - center.x);
      var a3 = Math.atan2(obj.p3.y - center.y, obj.p3.x - center.x);
      var a_m = Math.atan2(mouse.pos.y - center.y, mouse.pos.x - center.x);
      if (Math.abs(geometry.length(center, mouse.pos) - r) < mouse.getClickExtent() && (((a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2)) == ((a2 < a_m && a_m < a1) || (a1 < a2 && a2 < a_m) || (a_m < a1 && a1 < a2)))) {
        // Dragging the entire obj
        draggingPart.part = 0;
        draggingPart.mouse0 = mousePos; // Mouse position when the user starts dragging
        draggingPart.mouse1 = mousePos; // Mouse position at the last moment during dragging
        draggingPart.snapData = {};
        return true;
      }
    }
    else {
      // The three points on the arc is colinear. Treat as a line segment.
      if (mouseOnSegment(mouse_nogrid, obj)) {
        draggingPart.part = 0;
        draggingPart.mouse0 = mousePos; // Mouse position when the user starts dragging
        draggingPart.mouse1 = mousePos; // Mouse position at the last moment during dragging
        draggingPart.snapData = {};
        return true;
      }
    }
    return false;
  },

  // When the user is dragging the obj
  dragging: function (obj, mouse, draggingPart, ctrl, shift) {
    var basePoint;
    if (draggingPart.part == 1) {
      // Dragging the first endpoint
      basePoint = ctrl ? geometry.midpoint(draggingPart.originalObj) : draggingPart.originalObj.p2;

      obj.p1 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
      obj.p2 = ctrl ? geometry.point(2 * basePoint.x - obj.p1.x, 2 * basePoint.y - obj.p1.y) : basePoint;
    }
    if (draggingPart.part == 2) {
      // Dragging the second endpoint

      basePoint = ctrl ? geometry.midpoint(draggingPart.originalObj) : draggingPart.originalObj.p1;

      obj.p2 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
      obj.p1 = ctrl ? geometry.point(2 * basePoint.x - obj.p2.x, 2 * basePoint.y - obj.p2.y) : basePoint;
    }
    if (draggingPart.part == 3) {
      // Dragging the control point of the arc
      obj.p3 = mouse.getPosSnappedToGrid();
    }

    if (draggingPart.part == 0) {
      // Dragging the entire obj

      if (shift) {
        var mousePos = mouse.getPosSnappedToDirection(draggingPart.mouse0, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y) }, { x: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y), y: -(draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x) }], draggingPart.snapData);
      }
      else {
        var mousePos = mouse.getPosSnappedToGrid();;
        draggingPart.snapData = {}; // Unlock the dragging direction when the user release the shift key
      }

      var mouseDiffX = draggingPart.mouse1.x - mousePos.x; // The X difference between the mouse position now and at the previous moment
      var mouseDiffY = draggingPart.mouse1.y - mousePos.y; // The Y difference between the mouse position now and at the previous moment
      // Move the first point
      obj.p1.x = obj.p1.x - mouseDiffX;
      obj.p1.y = obj.p1.y - mouseDiffY;
      // Move the second point
      obj.p2.x = obj.p2.x - mouseDiffX;
      obj.p2.y = obj.p2.y - mouseDiffY;

      obj.p3.x = obj.p3.x - mouseDiffX;
      obj.p3.y = obj.p3.y - mouseDiffY;

      // Update the mouse position
      draggingPart.mouse1 = mousePos;
    }
  },



  // Test if a ray may shoot on this object (if yes, return the intersection)
  rayIntersection: function (mirror, ray) {
    if (!mirror.p3 || !wavelengthInteraction(mirror, ray)) { return; }
    var center = geometry.intersection_2line(geometry.perpendicular_bisector(geometry.line(mirror.p1, mirror.p3)), geometry.perpendicular_bisector(geometry.line(mirror.p2, mirror.p3)));
    if (isFinite(center.x) && isFinite(center.y)) {

      var rp_temp = geometry.intersection_line_circle(geometry.line(ray.p1, ray.p2), geometry.circle(center, mirror.p2));
      var rp_exist = [];
      var rp_lensq = [];
      for (var i = 1; i <= 2; i++) {

        rp_exist[i] = !geometry.intersection_is_on_segment(geometry.intersection_2line(geometry.line(mirror.p1, mirror.p2), geometry.line(mirror.p3, rp_temp[i])), geometry.segment(mirror.p3, rp_temp[i])) && geometry.intersection_is_on_ray(rp_temp[i], ray) && geometry.length_squared(rp_temp[i], ray.p1) > minShotLength_squared;


        rp_lensq[i] = geometry.length_squared(ray.p1, rp_temp[i]);
      }


      if (rp_exist[1] && ((!rp_exist[2]) || rp_lensq[1] < rp_lensq[2])) { return rp_temp[1]; }
      if (rp_exist[2] && ((!rp_exist[1]) || rp_lensq[2] < rp_lensq[1])) { return rp_temp[2]; }
    }
    else {
      // The three points on the arc is colinear. Treat as a line segment.
      return objTypes['lineobj'].rayIntersection(mirror, ray);
    }
  },

  // When the obj is shot by a ray
  shot: function (mirror, ray, rayIndex, rp) {
    var rx = ray.p1.x - rp.x;
    var ry = ray.p1.y - rp.y;
    var mx = mirror.p2.x - mirror.p1.x;
    var my = mirror.p2.y - mirror.p1.y;

    var center = geometry.intersection_2line(geometry.perpendicular_bisector(geometry.line(mirror.p1, mirror.p3)), geometry.perpendicular_bisector(geometry.line(mirror.p2, mirror.p3)));
    if (isFinite(center.x) && isFinite(center.y)) {
      var cx = center.x - rp.x;
      var cy = center.y - rp.y;
      var c_sq = cx * cx + cy * cy;
      var r_dot_c = rx * cx + ry * cy;
      ray.p1 = rp;
      ray.p2 = geometry.point(rp.x - c_sq * rx + 2 * r_dot_c * cx, rp.y - c_sq * ry + 2 * r_dot_c * cy);
    }
    else {
      // The three points on the arc is colinear. Treat as a line segment.
      return objTypes['mirror'].shot(mirror, ray, rayIndex, rp);
    }

  }

};
