// Glass -> Custom equation
objTypes['curvedglass'] = {

  supportSurfaceMerging: true,

  // Create the obj
  create: function(mouse) {
    return {type: 'curvedglass', p1: mouse, p2: mouse, eqn1: "0", eqn2: "0.5\\cdot\\sqrt{1-x^2}", p: 1.5};
  },

  // Show the property box
  populateObjBar: function(obj, elem) {
    objBar.createEquation('', obj.eqn1, function(obj, value) {
      obj.eqn1 = value;
    }, getMsg('custom_equation_note'));
    objBar.createEquation(' < y < ', obj.eqn2, function(obj, value) {
      obj.eqn2 = value;
    });
    objTypes['refractor'].populateObjBar(obj, elem);
  },

  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,

  // Draw the obj on canvas
  draw: function(obj, ctx, aboveLight) {
    if (aboveLight && obj.tmp_glass) {
      objTypes['refractor'].draw(obj.tmp_glass, ctx, true);
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = getMouseStyle(obj, 'transparent');
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      return;
    }
    var fn;
    try {
      fns = [evaluateLatex(obj.eqn1), evaluateLatex(obj.eqn2)];
    } catch (e) {
      delete obj.tmp_glass;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.font = '12px serif';
      ctx.fillStyle = "gray"
      ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
      ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
      ctx.fillStyle = "red"
      ctx.fillText(e.toString(), obj.p1.x, obj.p1.y);
      return;
    }
    obj.tmp_glass = {path: [{x: obj.p1.x, y: obj.p1.y, arc: false}], p: obj.p, cauchyCoeff: (obj.cauchyCoeff || 0.004)};
    for (var side = 0; side <= 1; side++) {
      var p1 = (side == 0) ? obj.p1 : obj.p2;
      var p2 = (side == 0) ? obj.p2 : obj.p1;
      var p12d = geometry.length(p1, p2);
      // unit vector from p1 to p2
      var dir1 = [(p2.x-p1.x)/p12d, (p2.y-p1.y)/p12d];
      // perpendicular direction
      var dir2 = [dir1[1], -dir1[0]];
      // get height of (this section of) parabola
      var x0 = p12d/2;
      var i;
      var lastError = "";
      var hasPoints = false;
    for (i = -0.1; i < p12d+0.09; i+=0.1) {
        // avoid using exact integers to avoid problems with detecting intersections
        var ix = i + 0.05;
        if (ix < 0) ix = 0;
        if (ix > p12d) ix = p12d;
        var x = ix-x0;
        var scaled_x = 2*x/p12d;
        var scaled_y;
        try {
          scaled_y = ((side == 0) ? 1 : (-1)) * fns[side]({x: ((side == 0) ? scaled_x : (-scaled_x))});
          if (side == 1 && -scaled_y < fns[0]({x: -scaled_x})) {
            lastError = "Curve generation error: f(x) > g(x) at x = " + (-scaled_x);
          }
          var y = scaled_y*p12d*0.5;
          var pt = geometry.point(p1.x+dir1[0]*ix+dir2[0]*y, p1.y+dir1[1]*ix+dir2[1]*y);
          pt.arc = false;
          obj.tmp_glass.path.push(pt);
          hasPoints = true;
        } catch (e) {
          lastError = e;
        }
      }
      if (!hasPoints || lastError.startsWith("Curve generation error:")) {
        delete obj.tmp_glass;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.font = '12px serif';
        ctx.fillStyle = "gray"
        ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
        ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
        ctx.fillStyle = "red"
        ctx.fillText(lastError.toString(), obj.p1.x, obj.p1.y);
        return;
      }
    }
    if (obj == mouseObj) {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
      ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
    }
    objTypes['refractor'].draw(obj.tmp_glass, ctx, aboveLight);
  },

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

    if (!obj.tmp_glass) return false;
    if (objTypes['refractor'].clicked(obj.tmp_glass, mouse_nogrid, mouse, {})) {
      // Dragging the entire obj
      draggingPart.part = 0;
      draggingPart.mouse0 = mouse; // Mouse position when the user starts dragging
      draggingPart.mouse1 = mouse; // Mouse position at the last moment during dragging
      draggingPart.snapData = {};
      return true;
    }
    return false;
  },

  dragging: objTypes['lineobj'].dragging,


  // Test if a ray may shoot on this object (if yes, return the intersection)
  rayIntersection: function(obj, ray) {

    if (!obj.tmp_glass) return;
    if (obj.p <= 0)return;

    var s_lensq = Infinity;
    var s_lensq_temp;
    var s_point = null;
    var s_point_temp = null;
    var s_point_index = -1;
    var rp_exist = [];
    var rp_lensq = [];
    var rp_temp;

    var p1;
    var p2;
    var p3;
    var center;
    var r;

    for (var i = 0; i < obj.tmp_glass.path.length; i++)
    {
      s_point_temp = null;
      //Line segment i->i+1
      var rp_temp = geometry.intersection_2line(geometry.line(ray.p1, ray.p2), geometry.line(obj.tmp_glass.path[i % obj.tmp_glass.path.length], obj.tmp_glass.path[(i + 1) % obj.tmp_glass.path.length]));

      if (geometry.intersection_is_on_segment(rp_temp, geometry.segment(obj.tmp_glass.path[i % obj.tmp_glass.path.length], obj.tmp_glass.path[(i + 1) % obj.tmp_glass.path.length])) && geometry.intersection_is_on_ray(rp_temp, ray) && geometry.length_squared(ray.p1, rp_temp) > minShotLength_squared)
      {
        s_lensq_temp = geometry.length_squared(ray.p1, rp_temp);
        s_point_temp = rp_temp;
      }

      if (s_point_temp) {
        if (s_point && geometry.length_squared(s_point_temp, s_point) < minShotLength_squared && s_point_index != i-1) {
          // The ray shots on a point where the upper and the lower surfaces overlap.
          return;
        } else if (s_lensq_temp < s_lensq)
        {
          s_lensq = s_lensq_temp;
          s_point = s_point_temp;
          s_point_index = i;
        }
      }
    }
    if (s_point)
    {
      obj.tmp_i = s_point_index;
      return s_point;
    }

  },

  // When the obj is shot by a ray
  shot: function(obj, ray, rayIndex, rp, surfaceMerging_objs) {

    var shotData = this.getShotData(obj, ray);
    var shotType = shotData.shotType;
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
    else if (shotType == 0)
    {
      // Equivalent to not shot on the obj (e.g. two interfaces overlap)
      var n1 = 1;
    }
    else
    {
      // The situation that may cause bugs (e.g. shot at an edge point)
      // To prevent shooting the ray to a wrong direction, absorb the ray
      ray.exist = false;
      return;
    }

    // Surface merging
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
        // The situation that may cause bugs (e.g. shot at an edge point)
        // To prevent shooting the ray to a wrong direction, absorb the ray
        ray.exist = false;
        return;
      }
    }

    objTypes['refractor'].refract(ray, rayIndex, shotData.s_point, shotData.normal, n1);
  },

  // Test if the ray is shot from inside or outside
  getShotType: function(obj, ray) {
    return this.getShotData(obj, ray).shotType;
  },


  getShotData: function(obj, ray) {
    // Test where in the obj does the ray shoot on
    var i = obj.tmp_i;
    var pts = obj.tmp_glass.path;

    var s_point = geometry.intersection_2line(geometry.line(ray.p1, ray.p2), geometry.line(obj.tmp_glass.path[i % obj.tmp_glass.path.length], obj.tmp_glass.path[(i + 1) % obj.tmp_glass.path.length]));
    var rp = s_point;

    var s_lensq = geometry.length_squared(ray.p1, s_point);

    var rdots = (ray.p2.x - ray.p1.x) * (obj.tmp_glass.path[(i + 1) % obj.tmp_glass.path.length].x - obj.tmp_glass.path[i % obj.tmp_glass.path.length].x) + (ray.p2.y - ray.p1.y) * (obj.tmp_glass.path[(i + 1) % obj.tmp_glass.path.length].y - obj.tmp_glass.path[i % obj.tmp_glass.path.length].y);
    var rcrosss = (ray.p2.x - ray.p1.x) * (obj.tmp_glass.path[(i + 1) % obj.tmp_glass.path.length].y - obj.tmp_glass.path[i % obj.tmp_glass.path.length].y) - (ray.p2.y - ray.p1.y) * (obj.tmp_glass.path[(i + 1) % obj.tmp_glass.path.length].x - obj.tmp_glass.path[i % obj.tmp_glass.path.length].x);
    var ssq = (obj.tmp_glass.path[(i + 1) % obj.tmp_glass.path.length].x - obj.tmp_glass.path[i % obj.tmp_glass.path.length].x) * (obj.tmp_glass.path[(i + 1) % obj.tmp_glass.path.length].x - obj.tmp_glass.path[i % obj.tmp_glass.path.length].x) + (obj.tmp_glass.path[(i + 1) % obj.tmp_glass.path.length].y - obj.tmp_glass.path[i % obj.tmp_glass.path.length].y) * (obj.tmp_glass.path[(i + 1) % obj.tmp_glass.path.length].y - obj.tmp_glass.path[i % obj.tmp_glass.path.length].y);

    var normal_x = rdots * (obj.tmp_glass.path[(i + 1) % obj.tmp_glass.path.length].x - obj.tmp_glass.path[i % obj.tmp_glass.path.length].x) - ssq * (ray.p2.x - ray.p1.x);
    var normal_y = rdots * (obj.tmp_glass.path[(i + 1) % obj.tmp_glass.path.length].y - obj.tmp_glass.path[i % obj.tmp_glass.path.length].y) - ssq * (ray.p2.y - ray.p1.y);

    if (rcrosss < 0)
    {
      var shotType = 1; // Shot from inside to outside
    }
    else
    {
      var shotType = -1; // Shot from outside to inside
    }

    // Use a simple trick to smooth out the normal vector so that image detection works.
    // However, a more proper numerical algorithm from the beginning (especially to handle singularities) is still desired.

    var seg = geometry.segment(pts[i%pts.length], pts[(i+1)%pts.length]);
    var rx = ray.p1.x - rp.x;
    var ry = ray.p1.y - rp.y;
    var mx = seg.p2.x - seg.p1.x;
    var my = seg.p2.y - seg.p1.y;

    var frac;
    if (Math.abs(mx) > Math.abs(my)) {
      frac = (rp.x - seg.p1.x) / mx;
    } else {
      frac = (rp.y - seg.p1.y) / my;
    }
    
    var segA;
    if (frac < 0.5) {
      segA = geometry.segment(pts[(i-1+pts.length)%pts.length], pts[i%pts.length]);
    } else {
      segA = geometry.segment(pts[(i+1)%pts.length], pts[(i+2)%pts.length]);
    }

    var rdotsA = (ray.p2.x - ray.p1.x) * (segA.p2.x - segA.p1.x) + (ray.p2.y - ray.p1.y) * (segA.p2.y - segA.p1.y);
    var ssqA = (segA.p2.x - segA.p1.x) * (segA.p2.x - segA.p1.x) + (segA.p2.y - segA.p1.y) * (segA.p2.y - segA.p1.y);

    var normal_xA = rdotsA * (segA.p2.x - segA.p1.x) - ssqA * (ray.p2.x - ray.p1.x);
    var normal_yA = rdotsA * (segA.p2.y - segA.p1.y) - ssqA * (ray.p2.y - ray.p1.y);

    var normal_xFinal;
    var normal_yFinal;

    if (frac < 0.5) {
      normal_xFinal = normal_x * (0.5+frac) + normal_xA * (0.5-frac);
      normal_yFinal = normal_y * (0.5+frac) + normal_yA * (0.5-frac);
    } else {
      normal_xFinal = normal_xA * (frac-0.5) + normal_x * (1.5-frac);
      normal_yFinal = normal_yA * (frac-0.5) + normal_y * (1.5-frac);
    }

    return {s_point: s_point, normal: {x: normal_xFinal, y: normal_yFinal},shotType: shotType};
  }


};
