/**
 * Glass defined by a custom inequality.
 * Tools -> Glass -> Custom equation
 * @property {Point} p1 - The point corresponding to (-1,0) in the coordinate system of the equation.
 * @property {Point} p2 - The point corresponding to (1,0) in the coordinate system of the equation.
 * @property {string} eqn1 - The equation of the surface with smaller y. The variable is x.
 * @property {string} eqn2 - The equation of the surface with larger y. The variable is x.
 * @property {number} p - The refractive index of the glass, or the Cauchy coefficient A of the glass if color mode is on.
 * @property {number} cauchyCoeff - The Cauchy coefficient B of the glass if color mode is on, in micrometer squared.
 * @property {Array<Point>} path - The points on the calculated curve.
 * @property {number} tmp_i - The index of the point on the curve where the ray is incident.
 */
objTypes['curvedglass'] = class extends LineObjMixin(BaseGlass) {
  static type = 'curvedglass';
  static isOptical = true;
  static supportsSurfaceMerging = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    eqn1: "0",
    eqn2: "0.5\\cdot\\sqrt{1-x^2}",
    p: 1.5,
    cauchyCoeff: 0.004
  };

  populateObjBar(objBar) {
    objBar.createEquation('', this.eqn1, function (obj, value) {
      obj.eqn1 = value;
    }, getMsg('custom_equation_note'));
    objBar.createEquation(' < y < ', this.eqn2, function (obj, value) {
      obj.eqn2 = value;
    });

    super.populateObjBar(objBar);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    if (isAboveLight) {
      if (this.path) {
        this.drawGlass(canvasRenderer, isAboveLight, isHovered);
      }
      return;
    }

    var fns;
    try {
      fns = [evaluateLatex(this.eqn1), evaluateLatex(this.eqn2)];
    } catch (e) {
      delete this.path;
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

    this.path = [{ x: this.p1.x, y: this.p1.y }];
    for (var side = 0; side <= 1; side++) {
      var p1 = (side == 0) ? this.p1 : this.p2;
      var p2 = (side == 0) ? this.p2 : this.p1;
      var p12d = geometry.distance(p1, p2);
      var dir1 = [(p2.x - p1.x) / p12d, (p2.y - p1.y) / p12d];
      var dir2 = [dir1[1], -dir1[0]];
      var x0 = p12d / 2;
      var i;
      var lastError = "";
      var hasPoints = false;
      for (i = -0.1; i < p12d + 0.09; i += 0.1) {
        var ix = i + 0.05;
        if (ix < 0) ix = 0;
        if (ix > p12d) ix = p12d;
        var x = ix - x0;
        var scaled_x = 2 * x / p12d;
        var scaled_y;
        try {
          scaled_y = ((side == 0) ? 1 : (-1)) * fns[side]({ x: ((side == 0) ? scaled_x : (-scaled_x)) });
          if (side == 1 && -scaled_y < fns[0]({ x: -scaled_x })) {
            lastError = "Curve generation error: f(x) > g(x) at x = " + (-scaled_x);
          }
          var y = scaled_y * p12d * 0.5;
          var pt = geometry.point(p1.x + dir1[0] * ix + dir2[0] * y, p1.y + dir1[1] * ix + dir2[1] * y);
          this.path.push(pt);
          hasPoints = true;
        } catch (e) {
          lastError = e;
        }
      }
      if (!hasPoints || lastError.startsWith("Curve generation error:")) {
        delete this.path;
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
    }

    if (isHovered) {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(this.p1.x - 1.5, this.p1.y - 1.5, 3, 3);
      ctx.fillRect(this.p2.x - 1.5, this.p2.y - 1.5, 3, 3);
    }

    this.drawGlass(canvasRenderer, isAboveLight, isHovered);
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

    if (!this.path) return false;
    for (let i = 0; i < this.path.length - 1; i++) {
      if (mouse.isOnSegment(geometry.line(this.path[i], this.path[(i+1)%this.path.length]))) {
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
    if (!this.path) return;
    if (this.p <= 0) return;

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

    for (var i = 0; i < this.path.length; i++) {
      s_point_temp = null;
      //Line segment i->i+1
      var rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(this.path[i % this.path.length], this.path[(i + 1) % this.path.length]));

      if (geometry.intersectionIsOnSegment(rp_temp, geometry.line(this.path[i % this.path.length], this.path[(i + 1) % this.path.length])) && geometry.intersectionIsOnRay(rp_temp, ray) && geometry.distanceSquared(ray.p1, rp_temp) > minShotLength_squared) {
        s_lensq_temp = geometry.distanceSquared(ray.p1, rp_temp);
        s_point_temp = rp_temp;
      }

      if (s_point_temp) {
        if (s_point && geometry.distanceSquared(s_point_temp, s_point) < minShotLength_squared && s_point_index != i - 1) {
          // The ray shots on a point where the upper and the lower surfaces overlap.
          return;
        } else if (s_lensq_temp < s_lensq) {
          s_lensq = s_lensq_temp;
          s_point = s_point_temp;
          s_point_index = i;
        }
      }
    }
    if (s_point) {
      this.tmp_i = s_point_index;
      return s_point;
    }
  }

  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
    var incidentData = this.getIncidentData(ray);
    var incidentType = incidentData.incidentType;
    if (incidentType == 1) {
      // From inside to outside
      var n1 = this.getRefIndexAt(incidentPoint, ray);
    } else if (incidentType == -1) {
      // From outside to inside
      var n1 = 1 / this.getRefIndexAt(incidentPoint, ray);
    } else if (incidentType == 0) {
      // Equivalent to not intersecting with the object (e.g. two interfaces overlap)
      var n1 = 1;
    } else {
      // The situation that may cause bugs (e.g. incident on an edge point)
      // To prevent shooting the ray to a wrong direction, absorb the ray
      return {
        isAbsorbed: true
      };
    }

    return this.refract(ray, rayIndex, incidentPoint, incidentData.normal, n1, surfaceMergingObjs, ray.bodyMergingthis);
  }

  getIncidentData(ray) {
    var i = this.tmp_i;
    var pts = this.path;

    var s_point = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(this.path[i % this.path.length], this.path[(i + 1) % this.path.length]));
    var incidentPoint = s_point;

    var s_lensq = geometry.distanceSquared(ray.p1, s_point);

    var rdots = (ray.p2.x - ray.p1.x) * (this.path[(i + 1) % this.path.length].x - this.path[i % this.path.length].x) + (ray.p2.y - ray.p1.y) * (this.path[(i + 1) % this.path.length].y - this.path[i % this.path.length].y);
    var rcrosss = (ray.p2.x - ray.p1.x) * (this.path[(i + 1) % this.path.length].y - this.path[i % this.path.length].y) - (ray.p2.y - ray.p1.y) * (this.path[(i + 1) % this.path.length].x - this.path[i % this.path.length].x);
    var ssq = (this.path[(i + 1) % this.path.length].x - this.path[i % this.path.length].x) * (this.path[(i + 1) % this.path.length].x - this.path[i % this.path.length].x) + (this.path[(i + 1) % this.path.length].y - this.path[i % this.path.length].y) * (this.path[(i + 1) % this.path.length].y - this.path[i % this.path.length].y);

    var normal_x = rdots * (this.path[(i + 1) % this.path.length].x - this.path[i % this.path.length].x) - ssq * (ray.p2.x - ray.p1.x);
    var normal_y = rdots * (this.path[(i + 1) % this.path.length].y - this.path[i % this.path.length].y) - ssq * (ray.p2.y - ray.p1.y);

    if (rcrosss < 0) {
      var incidentType = 1; // From inside to outside
    } else {
      var incidentType = -1; // From outside to inside
    }

    // Use a simple trick to smooth out the normal vector so that image detection works.
    // However, a more proper numerical algorithm from the beginning (especially to handle singularities) is still desired.

    var seg = geometry.line(pts[i % pts.length], pts[(i + 1) % pts.length]);
    var rx = ray.p1.x - incidentPoint.x;
    var ry = ray.p1.y - incidentPoint.y;
    var mx = seg.p2.x - seg.p1.x;
    var my = seg.p2.y - seg.p1.y;

    var frac;
    if (Math.abs(mx) > Math.abs(my)) {
      frac = (incidentPoint.x - seg.p1.x) / mx;
    } else {
      frac = (incidentPoint.y - seg.p1.y) / my;
    }

    var segA;
    if (frac < 0.5) {
      segA = geometry.line(pts[(i - 1 + pts.length) % pts.length], pts[i % pts.length]);
    } else {
      segA = geometry.line(pts[(i + 1) % pts.length], pts[(i + 2) % pts.length]);
    }

    var rdotsA = (ray.p2.x - ray.p1.x) * (segA.p2.x - segA.p1.x) + (ray.p2.y - ray.p1.y) * (segA.p2.y - segA.p1.y);
    var ssqA = (segA.p2.x - segA.p1.x) * (segA.p2.x - segA.p1.x) + (segA.p2.y - segA.p1.y) * (segA.p2.y - segA.p1.y);

    var normal_xA = rdotsA * (segA.p2.x - segA.p1.x) - ssqA * (ray.p2.x - ray.p1.x);
    var normal_yA = rdotsA * (segA.p2.y - segA.p1.y) - ssqA * (ray.p2.y - ray.p1.y);

    var normal_xFinal;
    var normal_yFinal;

    if (frac < 0.5) {
      normal_xFinal = normal_x * (0.5 + frac) + normal_xA * (0.5 - frac);
      normal_yFinal = normal_y * (0.5 + frac) + normal_yA * (0.5 - frac);
    } else {
      normal_xFinal = normal_xA * (frac - 0.5) + normal_x * (1.5 - frac);
      normal_yFinal = normal_yA * (frac - 0.5) + normal_y * (1.5 - frac);
    }

    return { s_point: s_point, normal: { x: normal_xFinal, y: normal_yFinal }, incidentType: incidentType };
  }
  

  /* Utility methods */

  drawGlass(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    ctx.beginPath();
    ctx.moveTo(this.path[0].x, this.path[0].y);
    for (var i = 1; i < this.path.length; i++) {
      ctx.lineTo(this.path[i].x, this.path[i].y);
    }
    this.fillGlass(canvasRenderer, isAboveLight, isHovered);
  }
};
