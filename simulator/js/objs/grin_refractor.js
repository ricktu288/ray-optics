// Glass -> Gradient-index polygon
objTypes['grin_refractor'] = {

  supportSurfaceMerging: true,

  // Create the obj
  create: function (constructionPoint) {
    const p = '1.1 + 0.1 * cos(0.1 * y)';
    const p_tex = '1.1+0.1\\cdot\\cos\\left(0.1\\cdot y\\right)';
    const p_der_x = '0';
    const p_der_x_tex = '0';
    const p_der_y = 'sin(y / 10) * -1 / 100';
    const p_der_y_tex = '\\frac{\\sin\\left(\\frac{ y}{10}\\right)\\cdot-1}{100}';
    const origin = geometry.point(0, 0); // origin of refractive index function n(x,y)
    return { type: 'grin_refractor', path: [{ x: constructionPoint.x, y: constructionPoint.y, arc: false }], notDone: true, origin: origin, p: p, p_tex: p_tex, p_der_x: p_der_x, p_der_x_tex: p_der_x_tex, p_der_y: p_der_y, p_der_y_tex: p_der_y_tex, fn_p: evaluateLatex(p_tex), fn_p_der_x: evaluateLatex(p_der_x_tex), fn_p_der_y: evaluateLatex(p_der_y_tex), step_size: 1, eps: 1e-3 }; // Note that in this object, eps has units of [length]
  },

  // Use the prototype reftactor
  c_mousemove: objTypes['refractor'].c_mousemove,
  c_mouseup: objTypes['refractor'].c_mouseup,
  zIndex: objTypes['refractor'].zIndex,
  fillGlass: objTypes['grin_circlelens'].fillGlass,
  move: objTypes['refractor'].move,
  clicked: objTypes['refractor'].clicked,
  dragging: objTypes['refractor'].dragging,
  getShotType: objTypes['refractor'].getShotType,
  getShotData: objTypes['refractor'].getShotData,

  // Use the prototype grin_circlelens
  step: objTypes['grin_circlelens'].step,
  initRefIndex: objTypes['grin_circlelens'].initRefIndex,
  multRefIndex: objTypes['grin_circlelens'].multRefIndex,
  devRefIndex: objTypes['grin_circlelens'].devRefIndex,
  rayIntersection: objTypes['grin_circlelens'].rayIntersection,
  refract: objTypes['grin_circlelens'].refract,
  populateObjBar: objTypes['grin_circlelens'].populateObjBar,

  // Similar to the c_mousedown function of the refractor object, except here the arc functionality is removed
  c_mousedown: function (obj, constructionPoint, mouse, ctrl, shift) {
    if (obj.path.length > 1) {
      if (obj.path.length > 3 && mouse.isOnPoint(obj.path[0])) {
        // Clicked the first point
        obj.path.length--;
        obj.notDone = false;
        return;
      }
      const mousePos = mouse.getPosSnappedToGrid();
      obj.path[obj.path.length - 1] = { x: mousePos.x, y: mousePos.y }; // Move the last point
    }
  },

  // When the obj is shot by a ray
  shot: function (obj, ray, rayIndex, rp, surfaceMerging_objs) {
    try {
      if ((objTypes[obj.type].isInsideGlass(obj, ray.p1) || objTypes[obj.type].isOutsideGlass(obj, ray.p1)) && objTypes[obj.type].isOnBoundary(obj, rp)) // if the ray is hitting the circle from the outside, or from the inside (meaning that the point rp is on the boundary of the circle, and the point ray.p1 is inside/outside the circle)
      {
        if (obj.notDone) { return; }
        var shotData = this.getShotData(obj, ray);
        var shotType = shotData.shotType;
        var p = obj.fn_p({ x: rp.x - obj.origin.x, y: rp.y - obj.origin.y }) // refractive index at the intersection point - rp
        if (shotType == 1) {
          // Shot from inside to outside
          var n1 = (!scene.colorMode) ? p : (p + (obj.cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001)); // The refractive index of the source material (assuming the destination has 1)
        }
        else if (shotType == -1) {
          // Shot from outside to inside
          var n1 = 1 / ((!scene.colorMode) ? p : (p + (obj.cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001)));
        }
        else if (shotType == 0) {
          // Equivalent to not shot on the obj (e.g. two interfaces overlap)
          var n1 = 1;
        }
        else {
          // The situation that may cause bugs (e.g. shot at an edge point)
          // To prevent shooting the ray to a wrong direction, absorb the ray
          ray.exist = false;
          return;
        }

        /*
        A bodyMerging object is an object containing three properties - "fn_p", "fn_p_der_x" and "fn_p_der_y", 
        which are the refractive index and its partial derivative functions, respectively, for some region of the simulation.
        Every ray has a temporary bodyMerging object ("bodyMerging_obj") as a property
        (this property exists only while the ray is inside a region of one or several overlapping grin objects - e.g. grin_circlelens and grin_refractor),
        which gets updated as the ray enters/exits into/from grin objects, using the
        "multRefIndex"/"devRefIndex" function, respectively.
        */
        let r_bodyMerging_obj; // save the current bodyMerging_obj of the ray, to pass it later to the reflected ray in the 'refract' function
        if (surfaceMerging_objs.length) {
          // Surface merging
          for (var i = 0; i < surfaceMerging_objs.length; i++) {
            let p = surfaceMerging_objs[i].fn_p({ x: rp.x - surfaceMerging_objs[i].origin.x, y: rp.y - surfaceMerging_objs[i].origin.y }) // refractive index at the intersection point - rp
            shotType = objTypes[surfaceMerging_objs[i].type].getShotType(surfaceMerging_objs[i], ray);
            if (shotType == 1) {
              // Shot from inside to outside
              n1 *= (!scene.colorMode) ? p : (p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001));
            }
            else if (shotType == -1) {
              // Shot from outside to inside
              n1 /= (!scene.colorMode) ? p : (p + (surfaceMerging_objs[i].cauchyCoeff || 0.004) / (ray.wavelength * ray.wavelength * 0.000001));
            }
            else if (shotType == 0) {
              // Equivalent to not shot on the obj (e.g. two interfaces overlap)
              //n1=n1;
            }
            else {
              // The situation that may cause bugs (e.g. shot at an edge point)
              // To prevent shooting the ray to a wrong direction, absorb the ray
              ray.exist = false;
              return;
            }
          }
        }
        else {
          if (objTypes[obj.type].isInsideGlass(obj, ray.p1)) {
            if (ray.bodyMerging_obj === undefined)
              ray.bodyMerging_obj = objTypes[obj.type].initRefIndex(obj, ray); // Initialize the bodyMerging object of the ray
            r_bodyMerging_obj = ray.bodyMerging_obj; // Save the current bodyMerging object of the ray
            ray.bodyMerging_obj = objTypes[obj.type].devRefIndex(ray.bodyMerging_obj, obj);	// The ray exits the "obj" grin object, and therefore its bodyMerging object is to be updated
          }
          else {
            r_bodyMerging_obj = ray.bodyMerging_obj; // Save the current bodyMerging object of the ray
            if (ray.bodyMerging_obj !== undefined)
              ray.bodyMerging_obj = objTypes[obj.type].multRefIndex(ray.bodyMerging_obj, obj); // The ray enters the "obj" grin object, and therefore its bodyMerging object is to be updated
            else
              ray.bodyMerging_obj = { p: obj.p, fn_p: obj.fn_p, fn_p_der_x: obj.fn_p_der_x, fn_p_der_y: obj.fn_p_der_y }; // Initialize the bodyMerging object of the ray
          }
        }
        objTypes[obj.type].refract(ray, rayIndex, shotData.s_point, shotData.normal, n1, r_bodyMerging_obj);
      }
      else {
        if (ray.bodyMerging_obj === undefined)
          ray.bodyMerging_obj = objTypes[obj.type].initRefIndex(obj, ray); // Initialize the bodyMerging object of the ray
        next_point = objTypes[obj.type].step(obj, obj.origin, ray.p1, rp, ray);
        ray.p1 = rp;
        ray.p2 = next_point;
      }
    } catch (e) {
      ray.exist = false;
      return;
    }
  },

  draw: function (obj, ctx, aboveLight) {
    var p1;
    var p2;
    var p3;
    var center;
    var r;
    var a1;
    var a2;
    var a3;
    var acw;

    if (obj.error) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.font = '12px serif';
      ctx.fillStyle = "red"
      ctx.fillText(obj.error.toString(), obj.path[0].x, obj.path[0].y);
    }

    if (obj.notDone) {
      // The user has not finish drawing the obj yet

      ctx.beginPath();
      ctx.moveTo(obj.path[0].x, obj.path[0].y);

      for (var i = 0; i < obj.path.length - 1; i++) {
        if (obj.path[(i + 1)].arc && !obj.path[i].arc && i < obj.path.length - 2) {
          p1 = geometry.point(obj.path[i].x, obj.path[i].y);
          p2 = geometry.point(obj.path[(i + 2)].x, obj.path[(i + 2)].y);
          p3 = geometry.point(obj.path[(i + 1)].x, obj.path[(i + 1)].y);
          center = geometry.intersection_2line(geometry.perpendicular_bisector(geometry.line(p1, p3)), geometry.perpendicular_bisector(geometry.line(p2, p3)));
          if (isFinite(center.x) && isFinite(center.y)) {
            r = geometry.length(center, p3);
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
          center = geometry.intersection_2line(geometry.perpendicular_bisector(geometry.line(p1, p3)), geometry.perpendicular_bisector(geometry.line(p2, p3)));
          if (isFinite(center.x) && isFinite(center.y)) {
            r = geometry.length(center, p3);
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
      this.fillGlass(2.3, obj, ctx, aboveLight);
    }
    ctx.lineWidth = 1;


    if (obj == mouseObj) {
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

  // Implementation of the "crossing number algorithm" (see - https://en.wikipedia.org/wiki/Point_in_polygon)
  countIntersections: function (obj, p3) {
    var cnt = 0;
    for (let i = 0; i < obj.path.length; i++) {
      let p1 = obj.path[i];
      let p2 = obj.path[(i + 1) % obj.path.length];
      let y_max = Math.max(p1.y, p2.y);
      let y_min = Math.min(p1.y, p2.y);
      if ((y_max - p3.y - obj.eps > 0 && y_max - p3.y + obj.eps > 0) && (y_min - p3.y - obj.eps < 0 && y_min - p3.y + obj.eps < 0)) {
        if (p1.x == p2.x && (p1.x - p3.x + obj.eps > 0 && p1.x - p3.x - obj.eps > 0)) // in case the current segment is vertical
          cnt++;
        else if ((p1.x + ((p3.y - p1.y) / (p2.y - p1.y)) * (p2.x - p1.x)) - p3.x - obj.eps > 0 && (p1.x + ((p3.y - p1.y) / (p2.y - p1.y)) * (p2.x - p1.x)) - p3.x + obj.eps > 0)
          cnt++;
      }
    }
    return cnt; // Returns the number of intersections between a horizontal ray (that originates from the point - p3) and the Free-shape glass object - obj.
  },

  // Returns true if the point p3 is on the boundary of the simple polygon glass, otherwise returns false
  isOnBoundary: function (obj, p3) {
    for (let i = 0; i < obj.path.length; i++) {
      let p1 = obj.path[i];
      let p2 = obj.path[(i + 1) % obj.path.length];
      let p1_p2 = geometry.point(p2.x - p1.x, p2.y - p1.y);
      let p1_p3 = geometry.point(p3.x - p1.x, p3.y - p1.y);
      if (geometry.cross(p1_p2, p1_p3) - obj.eps < 0 && geometry.cross(p1_p2, p1_p3) + obj.eps > 0) // if p1_p2 and p1_p3 are collinear
      {
        let dot_p2_p3 = geometry.dot(p1_p2, p1_p3);
        let p1_p2_squared = geometry.length_squared(p1, p2);
        if (p1_p2_squared - dot_p2_p3 + obj.eps >= 0 && dot_p2_p3 + obj.eps >= 0) // if the projection of the segment p1_p3 onto the segment p1_p2, is contained in the segment p1_p2
          return true;
      }
    }
    return false;
  },

  // Returns true if point is outside the simple polygon glass, otherwise returns false
  isOutsideGlass: function (obj, point) {
    return (!this.isOnBoundary(obj, point) && this.countIntersections(obj, point) % 2 == 0)
  },

  // Returns true if point is inside the simple polygon glass, otherwise returns false
  isInsideGlass: function (obj, point) {
    return (!this.isOnBoundary(obj, point) && this.countIntersections(obj, point) % 2 == 1)
  }

};
