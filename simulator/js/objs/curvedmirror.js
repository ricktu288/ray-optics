/**
 * Mirror with shape defined by a custom equation.
 * Tools -> Mirror -> Custom equation
 * @property {Point} p1 - The point corresponding to (-1,0) in the coordinate system of the equation.
 * @property {Point} p2 - The point corresponding to (1,0) in the coordinate system of the equation.
 * @property {string} p - The equation of the mirror. The variable is x.
 * @property {boolean} isDichroic - Whether it is a dichroic mirror.
 * @property {boolean} isDichroicFilter - If true, the ray with wavelength outside the bandwidth is reflected. If false, the ray with wavelength inside the bandwidth is reflected.
 * @property {number} wavelength - The target wavelength if dichroic is enabled. The unit is nm.
 * @property {number} bandwidth - The bandwidth if dichroic is enabled. The unit is nm.
 * @property {Array<Point>} tmp_points - The points on the curve.
 * @property {number} tmp_i - The index of the point on the curve where the ray is incident.
 */
objTypes['curvedmirror'] = class extends LineObjMixin(BaseFilter) {
  static type = 'curvedmirror';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    p: "0.5\\cdot\\sqrt{1-x^2}",
    isDichroic: false,
    isDichroicFilter: false,
    wavelength: GREEN_WAVELENGTH,
    bandwidth: 10
  };

  populateObjBar(objBar) {
    objBar.createEquation('y = ', this.p, function (obj, value) {
      obj.p = value;
    }, getMsg('custom_equation_note'));
    
    super.populateObjBar(objBar);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    var fn;
    try {
      fn = evaluateLatex(this.p);
    } catch (e) {
      delete this.tmp_points;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.font = '12px serif';
      ctx.fillStyle = "gray"
      ctx.fillRect(this.p1.x - 1.5, this.p1.y - 1.5, 3, 3);
      ctx.fillRect(this.p2.x - 1.5, this.p2.y - 1.5, 3, 3);
      ctx.fillStyle = "red"
      ctx.fillText(e.toString(), this.p1.x, this.p1.y);
      return;
    }
    ctx.fillStyle = 'rgb(255,0,255)';
    var p12d = geometry.distance(this.p1, this.p2);
    // unit vector from p1 to p2
    var dir1 = [(this.p2.x - this.p1.x) / p12d, (this.p2.y - this.p1.y) / p12d];
    // perpendicular direction
    var dir2 = [dir1[1], -dir1[0]];
    // get height of (this section of) parabola
    var x0 = p12d / 2;
    var i;
    ctx.strokeStyle = isHovered ? 'cyan' : ((scene.colorMode && this.wavelength && this.isDichroic) ? wavelengthToColor(this.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(168,168,168)');
    ctx.beginPath();
    this.tmp_points = [];
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
        var pt = geometry.point(this.p1.x + dir1[0] * ix + dir2[0] * y, this.p1.y + dir1[1] * ix + dir2[1] * y);
        if (i == -0.1) {
          ctx.moveTo(pt.x, pt.y);
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
        this.tmp_points.push(pt);
      } catch (e) {
        lastError = e;
      }
    }
    if (this.tmp_points.length == 0) {
      delete this.tmp_points;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.font = '12px serif';
      ctx.fillStyle = "gray"
      ctx.fillRect(this.p1.x - 1.5, this.p1.y - 1.5, 3, 3);
      ctx.fillRect(this.p2.x - 1.5, this.p2.y - 1.5, 3, 3);
      ctx.fillStyle = "red"
      ctx.fillText(lastError.toString(), this.p1.x, this.p1.y);
      return;
    }
    ctx.stroke();
    if (isHovered) {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(this.p1.x - 1.5, this.p1.y - 1.5, 3, 3);
      ctx.fillRect(this.p2.x - 1.5, this.p2.y - 1.5, 3, 3);
    }
  }

  checkMouseOver(mouse) {
    let dragContext = {};
    if (mouse.isOnPoint(this.p1) && geometry.distanceSquared(mouse.pos, this.p1) <= geometry.distanceSquared(mouse.pos, this.p2)) {
      dragContext.part = 1;
      dragContext.targetPoint = geometry.point(this.p1.x, this.p1.y);
      return dragContext;
    }
    if (mouse.isOnPoint(this.p2)) {
      dragContext.part = 2;
      dragContext.targetPoint = geometry.point(this.p2.x, this.p2.y);
      return dragContext;
    }

    if (!this.tmp_points) return;
    var i;
    var pts = this.tmp_points;
    for (i = 0; i < pts.length - 1; i++) {

      var seg = geometry.line(pts[i], pts[i + 1]);
      if (mouse.isOnSegment(seg)) {
        // Dragging the entire this
        const mousePos = mouse.getPosSnappedToGrid();
        dragContext.part = 0;
        dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
        dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
        dragContext.snapContext = {};
        return dragContext;
      }
    }
  }

  checkRayIntersects(ray) {
    if (!this.tmp_points || !this.checkRayIntersectFilter(ray)) return;
    var i, j;
    var pts = this.tmp_points;
    var dir = geometry.distance(this.p2, ray.p1) > geometry.distance(this.p1, ray.p1);
    var incidentPoint;
    for (j = 0; j < pts.length - 1; j++) {
      i = dir ? j : (pts.length - 2 - j);
      var rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(pts[i], pts[i + 1]));
      var seg = geometry.line(pts[i], pts[i + 1]);
      // need minShotLength check to handle a ray that reflects off mirror multiple times
      if (geometry.distance(ray.p1, rp_temp) < minShotLength)
        continue;
      if (geometry.intersectionIsOnSegment(rp_temp, seg) && geometry.intersectionIsOnRay(rp_temp, ray)) {
        if (!incidentPoint || geometry.distance(ray.p1, rp_temp) < geometry.distance(ray.p1, incidentPoint)) {
          incidentPoint = rp_temp;
          this.tmp_i = i;
        }
      }
    }
    if (incidentPoint) return incidentPoint;
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    var rx = ray.p1.x - incidentPoint.x;
    var ry = ray.p1.y - incidentPoint.y;
    var i = this.tmp_i;
    var pts = this.tmp_points;
    var seg = geometry.line(pts[i], pts[i + 1]);
    var mx = seg.p2.x - seg.p1.x;
    var my = seg.p2.y - seg.p1.y;


    ray.p1 = incidentPoint;
    var frac;
    if (Math.abs(mx) > Math.abs(my)) {
      frac = (incidentPoint.x - seg.p1.x) / mx;
    } else {
      frac = (incidentPoint.y - seg.p1.y) / my;
    }

    if ((i == 0 && frac < 0.5) || (i == pts.length - 2 && frac >= 0.5)) {
      ray.p2 = geometry.point(incidentPoint.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, incidentPoint.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
    } else {
      // Use a simple trick to smooth out the slopes of outgoing rays so that image detection works.
      // However, a more proper numerical algorithm from the beginning (especially to handle singularities) is still desired.

      var outx = incidentPoint.x + rx * (my * my - mx * mx) - 2 * ry * mx * my;
      var outy = incidentPoint.y + ry * (mx * mx - my * my) - 2 * rx * mx * my;

      var segA;
      if (frac < 0.5) {
        segA = geometry.line(pts[i - 1], pts[i]);
      } else {
        segA = geometry.line(pts[i + 1], pts[i + 2]);
      }
      var rxA = ray.p1.x - incidentPoint.x;
      var ryA = ray.p1.y - incidentPoint.y;
      var mxA = segA.p2.x - segA.p1.x;
      var myA = segA.p2.y - segA.p1.y;

      var outxA = incidentPoint.x + rxA * (myA * myA - mxA * mxA) - 2 * ryA * mxA * myA;
      var outyA = incidentPoint.y + ryA * (mxA * mxA - myA * myA) - 2 * rxA * mxA * myA;

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
