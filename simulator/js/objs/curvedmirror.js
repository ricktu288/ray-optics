// Mirror -> Custom equation
objTypes['curvedmirror'] = {

  // Create the obj
  create: function (constructionPoint) {
    return { type: 'curvedmirror', p1: constructionPoint, p2: constructionPoint, p: "0.5\\cdot\\sqrt{1-x^2}" };
  },

  dichroicSettings: objTypes['mirror'].dichroicSettings,
  wavelengthInteraction: objTypes['mirror'].wavelengthInteraction,

  // Show the property box
  populateObjBar: function (obj, objBar) {
    objBar.createEquation('y = ', obj.p, function (obj, value) {
      obj.p = value;
    }, getMsg('custom_equation_note'));
    dichroicSettings(obj, objBar);
  },

  onConstructMouseDown: objTypes['lineobj'].onConstructMouseDown,
  onConstructMouseMove: objTypes['lineobj'].onConstructMouseMove,
  onConstructMouseUp: objTypes['lineobj'].onConstructMouseUp,

  // Draw the obj on canvas
  draw: function (obj, ctx, aboveLight) {
    var fn;
    try {
      fn = evaluateLatex(obj.p);
    } catch (e) {
      delete obj.tmp_points;
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
    ctx.fillStyle = 'rgb(255,0,255)';
    var p12d = geometry.length(obj.p1, obj.p2);
    // unit vector from p1 to p2
    var dir1 = [(obj.p2.x - obj.p1.x) / p12d, (obj.p2.y - obj.p1.y) / p12d];
    // perpendicular direction
    var dir2 = [dir1[1], -dir1[0]];
    // get height of (this section of) parabola
    var x0 = p12d / 2;
    var i;
    ctx.strokeStyle = getMouseStyle(obj, (scene.colorMode && obj.wavelength && obj.isDichroic) ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(168,168,168)');
    ctx.beginPath();
    obj.tmp_points = [];
    var lastError = "";
    for (i = -0.1; i < p12d + 0.09; i += 0.1) {
      // avoid using exact integers to avoid problems with detecting intersections
      var ix = i + 0.05;
      if (ix < 0) ix = 0;
      if (ix > p12d) ix = p12d;
      var x = ix - x0;
      var scaled_x = 2 * x / p12d;
      var scaled_y;
      try {
        scaled_y = fn({ x: scaled_x, "pi": Math.PI });
        var y = scaled_y * p12d * 0.5;
        var pt = geometry.point(obj.p1.x + dir1[0] * ix + dir2[0] * y, obj.p1.y + dir1[1] * ix + dir2[1] * y);
        if (i == -0.1) {
          ctx.moveTo(pt.x, pt.y);
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
        obj.tmp_points.push(pt);
      } catch (e) {
        lastError = e;
      }
    }
    if (obj.tmp_points.length == 0) {
      delete obj.tmp_points;
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
    ctx.stroke();
    if (obj == mouseObj) {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(obj.p1.x - 1.5, obj.p1.y - 1.5, 3, 3);
      ctx.fillRect(obj.p2.x - 1.5, obj.p2.y - 1.5, 3, 3);
    }
  },

  move: objTypes['lineobj'].move,

  // When the drawing area is clicked (test which part of the obj is clicked)
  checkMouseOver: function (obj, mouse, draggingPart) {
    if (mouse.isOnPoint(obj.p1) && geometry.length_squared(mouse.pos, obj.p1) <= geometry.length_squared(mouse.pos, obj.p2)) {
      draggingPart.part = 1;
      draggingPart.targetPoint = geometry.point(obj.p1.x, obj.p1.y);
      return true;
    }
    if (mouse.isOnPoint(obj.p2)) {
      draggingPart.part = 2;
      draggingPart.targetPoint = geometry.point(obj.p2.x, obj.p2.y);
      return true;
    }

    if (!obj.tmp_points) return false;
    var i;
    var pts = obj.tmp_points;
    for (i = 0; i < pts.length - 1; i++) {

      var seg = geometry.segment(pts[i], pts[i + 1]);
      if (mouse.isOnSegment(seg)) {
        // Dragging the entire obj
        const mousePos = mouse.getPosSnappedToGrid();
        draggingPart.part = 0;
        draggingPart.mousePos0 = mousePos; // Mouse position when the user starts dragging
        draggingPart.mousePos1 = mousePos; // Mouse position at the last moment during dragging
        draggingPart.snapData = {};
        return true;
      }
    }
    return false;
  },

  onDrag: objTypes['lineobj'].onDrag,

  // Test if a ray may shoot on this object (if yes, return the intersection)
  checkRayIntersects: function (obj, ray) {
    if (!obj.tmp_points || !wavelengthInteraction(obj, ray)) return;
    var i, j;
    var pts = obj.tmp_points;
    var dir = geometry.length(obj.p2, ray.p1) > geometry.length(obj.p1, ray.p1);
    var rp;
    for (j = 0; j < pts.length - 1; j++) {
      i = dir ? j : (pts.length - 2 - j);
      var rp_temp = geometry.intersection_2line(geometry.line(ray.p1, ray.p2), geometry.line(pts[i], pts[i + 1]));
      var seg = geometry.segment(pts[i], pts[i + 1]);
      // need minShotLength check to handle a ray that reflects off mirror multiple times
      if (geometry.length(ray.p1, rp_temp) < minShotLength)
        continue;
      if (geometry.intersection_is_on_segment(rp_temp, seg) && geometry.intersection_is_on_ray(rp_temp, ray)) {
        if (!rp || geometry.length(ray.p1, rp_temp) < geometry.length(ray.p1, rp)) {
          rp = rp_temp;
          obj.tmp_i = i;
        }
      }
    }
    if (rp) return rp;
  },

  // When the obj is shot by a ray
  onShoot: function (obj, ray, rayIndex, rp) {
    var rx = ray.p1.x - rp.x;
    var ry = ray.p1.y - rp.y;
    var i = obj.tmp_i;
    var pts = obj.tmp_points;
    var seg = geometry.segment(pts[i], pts[i + 1]);
    var mx = seg.p2.x - seg.p1.x;
    var my = seg.p2.y - seg.p1.y;


    ray.p1 = rp;
    var frac;
    if (Math.abs(mx) > Math.abs(my)) {
      frac = (rp.x - seg.p1.x) / mx;
    } else {
      frac = (rp.y - seg.p1.y) / my;
    }

    if ((i == 0 && frac < 0.5) || (i == pts.length - 2 && frac >= 0.5)) {
      ray.p2 = geometry.point(rp.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, rp.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
    } else {
      // Use a simple trick to smooth out the slopes of outgoing rays so that image detection works.
      // However, a more proper numerical algorithm from the beginning (especially to handle singularities) is still desired.

      var outx = rp.x + rx * (my * my - mx * mx) - 2 * ry * mx * my;
      var outy = rp.y + ry * (mx * mx - my * my) - 2 * rx * mx * my;

      var segA;
      if (frac < 0.5) {
        segA = geometry.segment(pts[i - 1], pts[i]);
      } else {
        segA = geometry.segment(pts[i + 1], pts[i + 2]);
      }
      var rxA = ray.p1.x - rp.x;
      var ryA = ray.p1.y - rp.y;
      var mxA = segA.p2.x - segA.p1.x;
      var myA = segA.p2.y - segA.p1.y;

      var outxA = rp.x + rxA * (myA * myA - mxA * mxA) - 2 * ryA * mxA * myA;
      var outyA = rp.y + ryA * (mxA * mxA - myA * myA) - 2 * rxA * mxA * myA;

      var outxFinal;
      var outyFinal;

      if (frac < 0.5) {
        outxFinal = outx * (0.5 + frac) + outxA * (0.5 - frac);
        outyFinal = outy * (0.5 + frac) + outyA * (0.5 - frac);
      } else {
        outxFinal = outxA * (frac - 0.5) + outx * (1.5 - frac);
        outyFinal = outyA * (frac - 0.5) + outy * (1.5 - frac);
      }
      //console.log(frac);
      ray.p2 = geometry.point(outxFinal, outyFinal);
    }
  }

};
