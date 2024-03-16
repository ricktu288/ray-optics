// Glass -> Polygon / Circular Arcs
objTypes['refractor'] = {

  supportSurfaceMerging: true,

  // Create the obj
  create: function (constructionPoint) {
    return { type: 'refractor', path: [{ x: constructionPoint.x, y: constructionPoint.y, arc: false }], notDone: true, p: 1.5 };
  },

  // Show the property box
  populateObjBar: function (obj, objBar) {
    if (scene.colorMode) {
      objBar.createNumber(getMsg('cauchycoeff') + " A", 1, 3, 0.01, obj.p, function (obj, value) {
        obj.p = value * 1;
      }, getMsg('refractiveindex_note_popover'));
      objBar.createNumber("B(μm²)", 0.0001, 0.02, 0.0001, (obj.cauchyCoeff || 0.004), function (obj, value) {
        obj.cauchyCoeff = value;
      });
    } else {
      objBar.createNumber(getMsg('refractiveindex'), 0.5, 2.5, 0.01, obj.p, function (obj, value) {
        obj.p = value * 1;
      }, getMsg('refractiveindex_note_popover'));
    }
  },

  // Mousedown when the obj is being constructed by the user
  onConstructMouseDown: function (obj, constructionPoint, mouse, ctrl, shift) {
    if (obj.path.length > 1) {
      if (obj.path.length > 3 && mouse.isOnPoint(obj.path[0])) {
        // Clicked the first point
        obj.path.length--;
        obj.notDone = false;
        return;
      }
      const mousePos = mouse.getPosSnappedToGrid();
      obj.path[obj.path.length - 1] = { x: mousePos.x, y: mousePos.y }; // Move the last point
      obj.path[obj.path.length - 1].arc = true;
    }
  },
  // Mousemove when the obj is being constructed by the user
  onConstructMouseMove: function (obj, constructionPoint, mouse, ctrl, shift) {
    if (!obj.notDone) { return; }
    const mousePos = mouse.getPosSnappedToGrid();
    if (typeof obj.path[obj.path.length - 1].arc != 'undefined') {
      if (obj.path[obj.path.length - 1].arc && Math.sqrt(Math.pow(obj.path[obj.path.length - 1].x - mousePos.x, 2) + Math.pow(obj.path[obj.path.length - 1].y - mousePos.y, 2)) >= 5) {
        obj.path[obj.path.length] = mousePos;
      }
    }
    else {
      obj.path[obj.path.length - 1] = { x: mousePos.x, y: mousePos.y }; // Move the last point
    }
  },
  // Mouseup when the obj is being constructed by the user
  onConstructMouseUp: function (obj, constructionPoint, mouse, ctrl, shift) {
    if (!obj.notDone) {
      return {
        isDone: true
      };
    }
    if (obj.path.length > 3 && mouse.isOnPoint(obj.path[0])) {
      // Mouse released at the first point
      obj.path.length--;
      obj.notDone = false;
      return {
        isDone: true
      };
    }
    if (obj.path[obj.path.length - 2] && !obj.path[obj.path.length - 2].arc && mouse.isOnPoint(obj.path[obj.path.length - 2])) {
      delete obj.path[obj.path.length - 1].arc;
    }
    else {
      const mousePos = mouse.getPosSnappedToGrid();
      obj.path[obj.path.length - 1] = { x: mousePos.x, y: mousePos.y }; // Move the last point
      obj.path[obj.path.length - 1].arc = false;
      obj.path[obj.path.length] = { x: mousePos.x, y: mousePos.y }; // Create a new point

    }
  },

  zIndex: function (obj) {
    return obj.p * (-1); // The material with (relative) refractive index < 1 should be draw after the one with > 1 so that the color subtraction in fillGlass works.
  },

  // Draw the obj on canvas
  draw: function (obj, canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    var p1;
    var p2;
    var p3;
    var center;
    var r;
    var a1;
    var a2;
    var a3;
    var acw;

    if (obj.notDone) {
      // The user has not finish drawing the obj yet

      ctx.beginPath();
      ctx.moveTo(obj.path[0].x, obj.path[0].y);

      for (var i = 0; i < obj.path.length - 1; i++) {
        if (obj.path[(i + 1)].arc && !obj.path[i].arc && i < obj.path.length - 2) {
          p1 = geometry.point(obj.path[i].x, obj.path[i].y);
          p2 = geometry.point(obj.path[(i + 2)].x, obj.path[(i + 2)].y);
          p3 = geometry.point(obj.path[(i + 1)].x, obj.path[(i + 1)].y);
          center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(p1, p3)), geometry.perpendicularBisector(geometry.line(p2, p3)));
          if (isFinite(center.x) && isFinite(center.y)) {
            r = geometry.distance(center, p3);
            a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
            a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
            a3 = Math.atan2(p3.y - center.y, p3.x - center.x);
            acw = (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2); // The rotation direction of p1->p3->p2. True indicates counterclockwise

            ctx.arc(center.x, center.y, r, a1, a2, acw);
          }
          else {
            // The three points on the arc is colinear. Treat as a line segment.
            ctx.lineTo(obj.path[(i + 2)].x, obj.path[(i + 2)].y);
          }


        }
        else if (!obj.path[(i + 1)].arc && !obj.path[i].arc) {
          ctx.lineTo(obj.path[(i + 1)].x, obj.path[(i + 1)].y);
        }
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgb(128,128,128)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    else {
      // The user has completed drawing the obj
      ctx.beginPath();
      ctx.moveTo(obj.path[0].x, obj.path[0].y);

      for (var i = 0; i < obj.path.length; i++) {
        if (obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc) {
          p1 = geometry.point(obj.path[i % obj.path.length].x, obj.path[i % obj.path.length].y);
          p2 = geometry.point(obj.path[(i + 2) % obj.path.length].x, obj.path[(i + 2) % obj.path.length].y);
          p3 = geometry.point(obj.path[(i + 1) % obj.path.length].x, obj.path[(i + 1) % obj.path.length].y);
          center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(p1, p3)), geometry.perpendicularBisector(geometry.line(p2, p3)));
          if (isFinite(center.x) && isFinite(center.y)) {
            r = geometry.distance(center, p3);
            a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
            a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
            a3 = Math.atan2(p3.y - center.y, p3.x - center.x);
            acw = (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2); // The rotation direction of p1->p3->p2. True indicates counterclockwise

            ctx.arc(center.x, center.y, r, a1, a2, acw);
          }
          else {
            // The three points on the arc is colinear. Treat as a line segment.
            ctx.lineTo(obj.path[(i + 2) % obj.path.length].x, obj.path[(i + 2) % obj.path.length].y);
          }

        }
        else if (!obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc) {
          ctx.lineTo(obj.path[(i + 1) % obj.path.length].x, obj.path[(i + 1) % obj.path.length].y);
        }
      }
      this.fillGlass(obj.p, obj, canvasRenderer, isAboveLight, isHovered);
    }
    ctx.lineWidth = 1;


    if (isHovered) {
      for (var i = 0; i < obj.path.length; i++) {
        if (typeof obj.path[i].arc != 'undefined') {
          if (obj.path[i].arc) {
            ctx.fillStyle = 'rgb(255,0,255)';
            ctx.fillRect(obj.path[i].x - 1.5, obj.path[i].y - 1.5, 3, 3);
          }
          else {
            ctx.fillStyle = 'rgb(255,0,0)';
            ctx.fillRect(obj.path[i].x - 1.5, obj.path[i].y - 1.5, 3, 3);
          }
        }
      }
    }
  },

  fillGlass: function (n, obj, canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;

    //console.log(isAboveLight)
    if (isAboveLight) {
      // Draw the highlight only
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = isHovered ? 'cyan' : ('transparent');
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      return;
    }
    if (n >= 1) {
      ctx.globalCompositeOperation = 'lighter';
      var alpha = Math.log(n) / Math.log(1.5) * 0.2;
      if (ctx.constructor != C2S) {
        ctx.fillStyle = "rgb(" + (alpha * 100) + "%," + (alpha * 100) + "%," + (alpha * 100) + "%)";
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "white";
      }
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

    }
    else {
      var alpha = Math.log(1 / n) / Math.log(1.5) * 0.2;
      if (ctx.constructor != C2S) {
        // Subtract the gray color.
        // Use a trick to make the color become red (indicating nonphysical) if the total refractive index is lower than one.

        // A trick to work around a buggy behavior in some browser (at least in Google Chrome 105 on macOS 12.2.1 on iMac 2021) that the color in the lower left corner of the canvas is filled to the glass. Reason unknown.
        // TODO: Find out the reason behind this behavior.
        var imageData = ctx.getImageData(0.0, 0.0, ctx.canvas.width, ctx.canvas.height);
        var data = imageData.data;
        ctx.putImageData(imageData, 0, 0);

        ctx.globalCompositeOperation = 'difference';
        ctx.fillStyle = "rgb(" + (alpha * 100) + "%," + (0) + "%," + (0) + "%)";
        ctx.fill('evenodd');

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "white";
        ctx.globalAlpha = 1;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.setTransform(scene.scale * dpr, 0, 0, scene.scale * dpr, scene.origin.x * dpr, scene.origin.y * dpr);

        ctx.globalCompositeOperation = 'lighter';

        ctx.fillStyle = "rgb(" + (0) + "%," + (alpha * 100) + "%," + (alpha * 100) + "%)";
        ctx.fill('evenodd');

        ctx.globalCompositeOperation = 'difference';

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.setTransform(scene.scale * dpr, 0, 0, scene.scale * dpr, scene.origin.x * dpr, scene.origin.y * dpr);

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      } else {
        // canvas2svg does not support globalCompositeOperation. Use the old appearance.
        ctx.globalAlpha = 1;
        ctx.strokeStyle = isHovered ? 'cyan' : ('rgb(70,70,70)');
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

  },

  // Move the object
  move: function (obj, diffX, diffY) {
    for (var i = 0; i < obj.path.length; i++) {
      obj.path[i].x += diffX;
      obj.path[i].y += diffY;
    }
  },


  // When the drawing area is clicked (test which part of the obj is clicked)
  checkMouseOver: function (obj, mouse, draggingPart) {

    var p1;
    var p2;
    var p3;
    var center;
    var r;
    var a1;
    var a2;
    var a3;


    var click_lensq = Infinity;
    var click_lensq_temp;
    var targetPoint_index = -1;
    for (var i = 0; i < obj.path.length; i++) {
      if (mouse.isOnPoint(obj.path[i])) {
        click_lensq_temp = geometry.distanceSquared(mouse.pos, obj.path[i]);
        if (click_lensq_temp <= click_lensq) {
          click_lensq = click_lensq_temp;
          targetPoint_index = i;
        }
      }
    }
    if (targetPoint_index != -1) {
      draggingPart.part = 1;
      draggingPart.index = targetPoint_index;
      draggingPart.targetPoint = geometry.point(obj.path[targetPoint_index].x, obj.path[targetPoint_index].y);
      return true;
    }

    for (var i = 0; i < obj.path.length; i++) {
      if (obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc) {
        p1 = geometry.point(obj.path[i % obj.path.length].x, obj.path[i % obj.path.length].y);
        p2 = geometry.point(obj.path[(i + 2) % obj.path.length].x, obj.path[(i + 2) % obj.path.length].y);
        p3 = geometry.point(obj.path[(i + 1) % obj.path.length].x, obj.path[(i + 1) % obj.path.length].y);
        center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(p1, p3)), geometry.perpendicularBisector(geometry.line(p2, p3)));
        if (isFinite(center.x) && isFinite(center.y)) {
          r = geometry.distance(center, p3);
          a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
          a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
          a3 = Math.atan2(p3.y - center.y, p3.x - center.x);
          var a_m = Math.atan2(mouse.pos.y - center.y, mouse.pos.x - center.x);
          if (Math.abs(geometry.distance(center, mouse.pos) - r) < mouse.getClickExtent() && (((a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2)) == ((a2 < a_m && a_m < a1) || (a1 < a2 && a2 < a_m) || (a_m < a1 && a1 < a2)))) {
            // Dragging the entire obj
            const mousePos = mouse.getPosSnappedToGrid();
            draggingPart.part = 0;
            draggingPart.mousePos0 = mousePos; // Mouse position when the user starts dragging
            draggingPart.mousePos1 = mousePos; // Mouse position at the last moment during dragging
            draggingPart.snapData = {};
            return true;
          }
        }
        else {
          // The three points on the arc is colinear. Treat as a line segment.
          if (mouse.isOnSegment(geometry.line(obj.path[(i) % obj.path.length], obj.path[(i + 2) % obj.path.length]))) {
            // Dragging the entire obj
            const mousePos = mouse.getPosSnappedToGrid();
            draggingPart.part = 0;
            draggingPart.mousePos0 = mousePos; // Mouse position when the user starts dragging
            draggingPart.mousePos1 = mousePos; // Mouse position at the last moment during dragging
            draggingPart.snapData = {};
            return true;
          }
        }
      }
      else if (!obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc) {
        if (mouse.isOnSegment(geometry.line(obj.path[(i) % obj.path.length], obj.path[(i + 1) % obj.path.length]))) {
          // Dragging the entire obj
          const mousePos = mouse.getPosSnappedToGrid();
          draggingPart.part = 0;
          draggingPart.mousePos0 = mousePos; // Mouse position when the user starts dragging
          draggingPart.mousePos1 = mousePos; // Mouse position at the last moment during dragging
          draggingPart.snapData = {};
          return true;
        }
      }
    }

  },

  // When the user is dragging the obj
  onDrag: function (obj, mouse, draggingPart, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();

    if (draggingPart.part == 1) {
      obj.path[draggingPart.index].x = mousePos.x;
      obj.path[draggingPart.index].y = mousePos.y;
    }

    if (draggingPart.part == 0) {
      if (shift) {
        var mousePosSnapped = mouse.getPosSnappedToDirection(draggingPart.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], draggingPart.snapData);
      }
      else {
        var mousePosSnapped = mouse.getPosSnappedToGrid();
        draggingPart.snapData = {}; // Unlock the dragging direction when the user release the shift key
      }
      this.move(obj, mousePosSnapped.x - draggingPart.mousePos1.x, mousePosSnapped.y - draggingPart.mousePos1.y);
      draggingPart.mousePos1 = mousePosSnapped;
    }
  },



  // Test if a ray may shoot on this object (if yes, return the intersection)
  checkRayIntersects: function (obj, ray) {

    if (obj.notDone || obj.p <= 0) return;

    var s_lensq = Infinity;
    var s_lensq_temp;
    var s_point = null;
    var s_point_temp = null;
    var rp_exist = [];
    var rp_lensq = [];
    var rp_temp;

    var p1;
    var p2;
    var p3;
    var center;
    var r;

    for (var i = 0; i < obj.path.length; i++) {
      s_point_temp = null;
      if (obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc) {
        // The arc i->i+1->i+2
        p1 = geometry.point(obj.path[i % obj.path.length].x, obj.path[i % obj.path.length].y);
        p2 = geometry.point(obj.path[(i + 2) % obj.path.length].x, obj.path[(i + 2) % obj.path.length].y);
        p3 = geometry.point(obj.path[(i + 1) % obj.path.length].x, obj.path[(i + 1) % obj.path.length].y);
        center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(p1, p3)), geometry.perpendicularBisector(geometry.line(p2, p3)));
        if (isFinite(center.x) && isFinite(center.y)) {
          r = geometry.distance(center, p3);
          rp_temp = geometry.lineCircleIntersections(geometry.line(ray.p1, ray.p2), geometry.circle(center, p2));
          for (var ii = 1; ii <= 2; ii++) {
            rp_exist[ii] = !geometry.intersectionIsOnSegment(geometry.linesIntersection(geometry.line(p1, p2), geometry.line(p3, rp_temp[ii])), geometry.line(p3, rp_temp[ii])) && geometry.intersectionIsOnRay(rp_temp[ii], ray) && geometry.distanceSquared(rp_temp[ii], ray.p1) > minShotLength_squared;
            rp_lensq[ii] = geometry.distanceSquared(ray.p1, rp_temp[ii]);
          }
          if (rp_exist[1] && ((!rp_exist[2]) || rp_lensq[1] < rp_lensq[2]) && rp_lensq[1] > minShotLength_squared) {
            s_point_temp = rp_temp[1];
            s_lensq_temp = rp_lensq[1];
          }
          if (rp_exist[2] && ((!rp_exist[1]) || rp_lensq[2] < rp_lensq[1]) && rp_lensq[2] > minShotLength_squared) {
            s_point_temp = rp_temp[2];
            s_lensq_temp = rp_lensq[2];
          }
        }
        else {
          // The three points on the arc is colinear. Treat as a line segment.
          var rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length]));

          if (geometry.intersectionIsOnSegment(rp_temp, geometry.line(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length])) && geometry.intersectionIsOnRay(rp_temp, ray) && geometry.distanceSquared(ray.p1, rp_temp) > minShotLength_squared) {
            s_lensq_temp = geometry.distanceSquared(ray.p1, rp_temp);
            s_point_temp = rp_temp;
          }
        }
      }
      else if (!obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc) {
        //Line segment i->i+1
        var rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(obj.path[i % obj.path.length], obj.path[(i + 1) % obj.path.length]));

        if (geometry.intersectionIsOnSegment(rp_temp, geometry.line(obj.path[i % obj.path.length], obj.path[(i + 1) % obj.path.length])) && geometry.intersectionIsOnRay(rp_temp, ray) && geometry.distanceSquared(ray.p1, rp_temp) > minShotLength_squared) {
          s_lensq_temp = geometry.distanceSquared(ray.p1, rp_temp);
          s_point_temp = rp_temp;
        }
      }
      if (s_point_temp) {
        if (s_lensq_temp < s_lensq) {
          s_lensq = s_lensq_temp;
          s_point = s_point_temp;
        }
      }
    }
    if (s_point) {
      return s_point;
    }

  },

  // When the obj is shot by a ray
  onRayIncident: function (obj, ray, rayIndex, rp, surfaceMerging_objs) {

    if (obj.notDone) { return; }
    var shotData = this.getShotData(obj, ray);
    var shotType = shotData.shotType;
    if (shotType == 1) {
      // Shot from inside to outside
      var n1 = (!scene.colorMode) ? obj.p : (obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001)); // The refractive index of the source material (assuming the destination has 1)
    }
    else if (shotType == -1) {
      // Shot from outside to inside
      var n1 = 1 / ((!scene.colorMode) ? obj.p : (obj.p + (obj.cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001)));
    }
    else if (shotType == 0) {
      // Equivalent to not shot on the obj (e.g. two interfaces overlap)
      var n1 = 1;
    }
    else {
      // The situation that may cause bugs (e.g. shot at an edge point)
      // To prevent shooting the ray to a wrong direction, absorb the ray
      return {
        isAbsorbed: true
      };
    }

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

    return this.refract(ray, rayIndex, shotData.s_point, shotData.normal, n1);
  },

  // Test if the ray is shot from inside or outside
  getShotType: function (obj, ray) {
    return this.getShotData(obj, ray).shotType;
  },


  getShotData: function (obj, ray) {
    // Test where in the obj does the ray shoot on
    var s_lensq = Infinity;
    var s_lensq_temp;
    var s_point = null;
    var s_point_temp = null;
    var s_point_index;

    var surfaceMultiplicity = 1; // How many time the surfaces coincide

    var rp_on_ray = [];
    var rp_exist = [];
    var rp_lensq = [];
    var rp_temp;

    var rp2_exist = [];
    var rp2_lensq = [];
    var rp2_temp;

    var normal_x;
    var normal_x_temp;

    var normal_y;
    var normal_y_temp;

    var rdots;
    var ssq;

    var nearEdge = false;
    var nearEdge_temp = false;

    var p1;
    var p2;
    var p3;
    var center;
    var ray2 = geometry.line(ray.p1, geometry.point(ray.p2.x + Math.random() * 1e-5, ray.p2.y + Math.random() * 1e-5)); // The ray to test the inside/outside (the test ray)
    var ray_intersect_count = 0; // The intersection count (odd means from outside)

    for (var i = 0; i < obj.path.length; i++) {
      s_point_temp = null;
      nearEdge_temp = false;
      if (obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc) {
        // The arc i->i+1->i+2
        p1 = geometry.point(obj.path[i % obj.path.length].x, obj.path[i % obj.path.length].y);
        p2 = geometry.point(obj.path[(i + 2) % obj.path.length].x, obj.path[(i + 2) % obj.path.length].y);
        p3 = geometry.point(obj.path[(i + 1) % obj.path.length].x, obj.path[(i + 1) % obj.path.length].y);
        center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(p1, p3)), geometry.perpendicularBisector(geometry.line(p2, p3)));
        if (isFinite(center.x) && isFinite(center.y)) {
          rp_temp = geometry.lineCircleIntersections(geometry.line(ray.p1, ray.p2), geometry.circle(center, p2));
          rp2_temp = geometry.lineCircleIntersections(geometry.line(ray2.p1, ray2.p2), geometry.circle(center, p2));
          for (var ii = 1; ii <= 2; ii++) {
            rp_on_ray[ii] = geometry.intersectionIsOnRay(rp_temp[ii], ray);
            rp_exist[ii] = rp_on_ray[ii] && !geometry.intersectionIsOnSegment(geometry.linesIntersection(geometry.line(p1, p2), geometry.line(p3, rp_temp[ii])), geometry.line(p3, rp_temp[ii])) && geometry.distanceSquared(rp_temp[ii], ray.p1) > minShotLength_squared;
            rp_lensq[ii] = geometry.distanceSquared(ray.p1, rp_temp[ii]);

            rp2_exist[ii] = !geometry.intersectionIsOnSegment(geometry.linesIntersection(geometry.line(p1, p2), geometry.line(p3, rp2_temp[ii])), geometry.line(p3, rp2_temp[ii])) && geometry.intersectionIsOnRay(rp2_temp[ii], ray2) && geometry.distanceSquared(rp2_temp[ii], ray2.p1) > minShotLength_squared;
            rp2_lensq[ii] = geometry.distanceSquared(ray2.p1, rp2_temp[ii]);
          }

          if (rp_exist[1] && ((!rp_exist[2]) || rp_lensq[1] < rp_lensq[2]) && rp_lensq[1] > minShotLength_squared) {
            s_point_temp = rp_temp[1];
            s_lensq_temp = rp_lensq[1];
            if (rp_on_ray[2] && rp_lensq[1] < rp_lensq[2]) {
              //The ray is from outside to inside (with respect to the arc itself)
              normal_x_temp = s_point_temp.x - center.x;
              normal_y_temp = s_point_temp.y - center.y;
            }
            else {
              normal_x_temp = center.x - s_point_temp.x;
              normal_y_temp = center.y - s_point_temp.y;
            }
          }
          if (rp_exist[2] && ((!rp_exist[1]) || rp_lensq[2] < rp_lensq[1]) && rp_lensq[2] > minShotLength_squared) {
            s_point_temp = rp_temp[2];
            s_lensq_temp = rp_lensq[2];
            if (rp_on_ray[1] && rp_lensq[2] < rp_lensq[1]) {
              //The ray is from outside to inside (with respect to the arc itself)
              normal_x_temp = s_point_temp.x - center.x;
              normal_y_temp = s_point_temp.y - center.y;
            }
            else {
              normal_x_temp = center.x - s_point_temp.x;
              normal_y_temp = center.y - s_point_temp.y;
            }
          }
          if (rp2_exist[1] && rp2_lensq[1] > minShotLength_squared) {
            ray_intersect_count++;
          }
          if (rp2_exist[2] && rp2_lensq[2] > minShotLength_squared) {
            ray_intersect_count++;
          }

          // Test if too close to an edge
          if (s_point_temp && (geometry.distanceSquared(s_point_temp, p1) < minShotLength_squared || geometry.distanceSquared(s_point_temp, p2) < minShotLength_squared)) {
            nearEdge_temp = true;
          }

        }
        else {
          // The three points on the arc is colinear. Treat as a line segment.
          rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length]));

          rp2_temp = geometry.linesIntersection(geometry.line(ray2.p1, ray2.p2), geometry.line(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length]));
          if (geometry.intersectionIsOnSegment(rp_temp, geometry.line(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length])) && geometry.intersectionIsOnRay(rp_temp, ray) && geometry.distanceSquared(ray.p1, rp_temp) > minShotLength_squared) {
            s_lensq_temp = geometry.distanceSquared(ray.p1, rp_temp);
            s_point_temp = rp_temp;

            rdots = (ray.p2.x - ray.p1.x) * (obj.path[(i + 2) % obj.path.length].x - obj.path[i % obj.path.length].x) + (ray.p2.y - ray.p1.y) * (obj.path[(i + 2) % obj.path.length].y - obj.path[i % obj.path.length].y);
            ssq = (obj.path[(i + 2) % obj.path.length].x - obj.path[i % obj.path.length].x) * (obj.path[(i + 2) % obj.path.length].x - obj.path[i % obj.path.length].x) + (obj.path[(i + 2) % obj.path.length].y - obj.path[i % obj.path.length].y) * (obj.path[(i + 2) % obj.path.length].y - obj.path[i % obj.path.length].y);

            normal_x_temp = rdots * (obj.path[(i + 2) % obj.path.length].x - obj.path[i % obj.path.length].x) - ssq * (ray.p2.x - ray.p1.x);
            normal_y_temp = rdots * (obj.path[(i + 2) % obj.path.length].y - obj.path[i % obj.path.length].y) - ssq * (ray.p2.y - ray.p1.y);


          }

          if (geometry.intersectionIsOnSegment(rp2_temp, geometry.line(obj.path[i % obj.path.length], obj.path[(i + 2) % obj.path.length])) && geometry.intersectionIsOnRay(rp2_temp, ray2) && geometry.distanceSquared(ray2.p1, rp2_temp) > minShotLength_squared) {
            ray_intersect_count++;
          }

          // Test if too close to an edge
          if (s_point_temp && (geometry.distanceSquared(s_point_temp, obj.path[i % obj.path.length]) < minShotLength_squared || geometry.distanceSquared(s_point_temp, obj.path[(i + 2) % obj.path.length]) < minShotLength_squared)) {
            nearEdge_temp = true;
          }
        }
      }
      else if (!obj.path[(i + 1) % obj.path.length].arc && !obj.path[i % obj.path.length].arc) {
        //Line segment i->i+1
        rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(obj.path[i % obj.path.length], obj.path[(i + 1) % obj.path.length]));

        rp2_temp = geometry.linesIntersection(geometry.line(ray2.p1, ray2.p2), geometry.line(obj.path[i % obj.path.length], obj.path[(i + 1) % obj.path.length]));
        if (geometry.intersectionIsOnSegment(rp_temp, geometry.line(obj.path[i % obj.path.length], obj.path[(i + 1) % obj.path.length])) && geometry.intersectionIsOnRay(rp_temp, ray) && geometry.distanceSquared(ray.p1, rp_temp) > minShotLength_squared) {
          s_lensq_temp = geometry.distanceSquared(ray.p1, rp_temp);
          s_point_temp = rp_temp;

          rdots = (ray.p2.x - ray.p1.x) * (obj.path[(i + 1) % obj.path.length].x - obj.path[i % obj.path.length].x) + (ray.p2.y - ray.p1.y) * (obj.path[(i + 1) % obj.path.length].y - obj.path[i % obj.path.length].y);
          ssq = (obj.path[(i + 1) % obj.path.length].x - obj.path[i % obj.path.length].x) * (obj.path[(i + 1) % obj.path.length].x - obj.path[i % obj.path.length].x) + (obj.path[(i + 1) % obj.path.length].y - obj.path[i % obj.path.length].y) * (obj.path[(i + 1) % obj.path.length].y - obj.path[i % obj.path.length].y);

          normal_x_temp = rdots * (obj.path[(i + 1) % obj.path.length].x - obj.path[i % obj.path.length].x) - ssq * (ray.p2.x - ray.p1.x);
          normal_y_temp = rdots * (obj.path[(i + 1) % obj.path.length].y - obj.path[i % obj.path.length].y) - ssq * (ray.p2.y - ray.p1.y);


        }

        if (geometry.intersectionIsOnSegment(rp2_temp, geometry.line(obj.path[i % obj.path.length], obj.path[(i + 1) % obj.path.length])) && geometry.intersectionIsOnRay(rp2_temp, ray2) && geometry.distanceSquared(ray2.p1, rp2_temp) > minShotLength_squared) {
          ray_intersect_count++;
        }

        // Test if too close to an edge
        if (s_point_temp && (geometry.distanceSquared(s_point_temp, obj.path[i % obj.path.length]) < minShotLength_squared || geometry.distanceSquared(s_point_temp, obj.path[(i + 1) % obj.path.length]) < minShotLength_squared)) {
          nearEdge_temp = true;
        }
      }
      if (s_point_temp) {
        if (s_point && geometry.distanceSquared(s_point_temp, s_point) < minShotLength_squared) {
          // Self surface merging
          surfaceMultiplicity++;
        }
        else if (s_lensq_temp < s_lensq) {
          s_lensq = s_lensq_temp;
          s_point = s_point_temp;
          s_point_index = i;
          normal_x = normal_x_temp;
          normal_y = normal_y_temp;
          nearEdge = nearEdge_temp;
          surfaceMultiplicity = 1;
        }
      }
    }


    if (nearEdge) {
      var shotType = 2; // Shot at an edge point
    }
    else if (surfaceMultiplicity % 2 == 0) {
      var shotType = 0; // Equivalent to not shot on the obj
    }
    else if (ray_intersect_count % 2 == 1) {
      var shotType = 1; // Shot from inside to outside
    }
    else {
      var shotType = -1; // Shot from outside to inside
    }

    return { s_point: s_point, normal: { x: normal_x, y: normal_y }, shotType: shotType };
  },

  // Do the refraction
  refract: function (ray, rayIndex, s_point, normal, n1) {
    var normal_len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
    var normal_x = normal.x / normal_len;
    var normal_y = normal.y / normal_len;

    var ray_len = Math.sqrt((ray.p2.x - ray.p1.x) * (ray.p2.x - ray.p1.x) + (ray.p2.y - ray.p1.y) * (ray.p2.y - ray.p1.y));

    var ray_x = (ray.p2.x - ray.p1.x) / ray_len;
    var ray_y = (ray.p2.y - ray.p1.y) / ray_len;


    // Reference http://en.wikipedia.org/wiki/Snell%27s_law#Vector_form

    var cos1 = -normal_x * ray_x - normal_y * ray_y;
    var sq1 = 1 - n1 * n1 * (1 - cos1 * cos1);


    if (sq1 < 0) {
      // Total internal reflection
      ray.p1 = s_point;
      ray.p2 = geometry.point(s_point.x + ray_x + 2 * cos1 * normal_x, s_point.y + ray_y + 2 * cos1 * normal_y);


    }
    else {
      // Refraction
      var cos2 = Math.sqrt(sq1);

      var R_s = Math.pow((n1 * cos1 - cos2) / (n1 * cos1 + cos2), 2);
      var R_p = Math.pow((n1 * cos2 - cos1) / (n1 * cos2 + cos1), 2);
      // Reference http://en.wikipedia.org/wiki/Fresnel_equations#Definitions_and_power_equations

      let newRays = [];
      let truncation = 0;

      // Handle the reflected ray
      var ray2 = geometry.line(s_point, geometry.point(s_point.x + ray_x + 2 * cos1 * normal_x, s_point.y + ray_y + 2 * cos1 * normal_y));
      ray2.brightness_s = ray.brightness_s * R_s;
      ray2.brightness_p = ray.brightness_p * R_p;
      ray2.wavelength = ray.wavelength;
      ray2.gap = ray.gap;
      if (ray2.brightness_s + ray2.brightness_p > 0.01) {
        newRays.push(ray2);
      }
      else {
        truncation += ray2.brightness_s + ray2.brightness_p;
        if (!ray.gap) {
          var amp = Math.floor(0.01 / ray2.brightness_s + ray2.brightness_p) + 1;
          if (rayIndex % amp == 0) {
            ray2.brightness_s = ray2.brightness_s * amp;
            ray2.brightness_p = ray2.brightness_p * amp;
            newRays.push(ray2);
          }
        }
      }

      // Handle the refracted ray
      ray.p1 = s_point;
      ray.p2 = geometry.point(s_point.x + n1 * ray_x + (n1 * cos1 - cos2) * normal_x, s_point.y + n1 * ray_y + (n1 * cos1 - cos2) * normal_y);
      ray.brightness_s = ray.brightness_s * (1 - R_s);
      ray.brightness_p = ray.brightness_p * (1 - R_p);

      return {
        newRays: newRays,
        truncation: truncation
      };
    }
  }


};
