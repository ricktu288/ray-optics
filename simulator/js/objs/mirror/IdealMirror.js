/**
 * Ideal curved mirror that follows the mirror equation exactly.
 * Tools -> Mirror -> Ideal curved mirror
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {number} focalLength - The focal length. The Cartesian sign convention is not used. But if the Cartesian sign convention is enabled (as a preference setting), the focal length changes sign in the UI.
 * 
 */
objTypes['IdealMirror'] = class extends LineObjMixin(BaseFilter) {
  static type = 'IdealMirror';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    focalLength: 100,
    filter: false,
    invert: false,
    wavelength: GREEN_WAVELENGTH,
    bandwidth: 10
  };

  populateObjBar(objBar) {
    var cartesianSign = false;
    if (localStorage && localStorage.rayOpticsCartesianSign) {
      cartesianSign = localStorage.rayOpticsCartesianSign == "true";
    }
    objBar.createNumber(getMsg('focalLength'), -1000 * this.scene.lengthScale, 1000 * this.scene.lengthScale, 1 * this.scene.lengthScale, this.focalLength * (cartesianSign ? -1 : 1), function (obj, value) {
      obj.focalLength = value * (cartesianSign ? -1 : 1);
    }, getMsg('length_unit_popover'));
    if (objBar.showAdvanced(cartesianSign)) {
      objBar.createBoolean(getMsg('cartesianSign'), cartesianSign, function (obj, value) {
        localStorage.rayOpticsCartesianSign = value ? "true" : "false";
      }, null, true);
    }

    super.populateObjBar(objBar);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
      ctx.fillStyle = 'rgb(128,128,128)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      return;
    }

    var len = Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
    var par_x = (this.p2.x - this.p1.x) / len;
    var par_y = (this.p2.y - this.p1.y) / len;
    var per_x = par_y;
    var per_y = -par_x;

    var arrow_size_per = 5 * ls;
    var arrow_size_par = 5 * ls;
    var center_size = 1 * ls;

    // Draw the line segment
    ctx.strokeStyle = isHovered ? 'cyan' : ((scene.simulateColors && this.wavelength && this.filter) ? Simulator.wavelengthToColor(this.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(168,168,168)');
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1 * ls;
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
    ctx.lineWidth = 1 * ls;


    // Draw the center point of the mirror
    var center = geometry.segmentMidpoint(this);
    ctx.strokeStyle = 'rgb(255,255,255)';
    ctx.beginPath();
    ctx.moveTo(center.x - per_x * center_size, center.y - per_y * center_size);
    ctx.lineTo(center.x + per_x * center_size, center.y + per_y * center_size);
    ctx.stroke();


    ctx.fillStyle = 'rgb(255,0,0)';


    // Draw the arrow for the two-sided version
    if (this.focalLength < 0) {
      // Draw the arrow (p1)
      ctx.beginPath();
      ctx.moveTo(this.p1.x - par_x * arrow_size_par, this.p1.y - par_y * arrow_size_par);
      ctx.lineTo(this.p1.x + par_x * arrow_size_par + per_x * arrow_size_per, this.p1.y + par_y * arrow_size_par + per_y * arrow_size_per);
      ctx.lineTo(this.p1.x + par_x * arrow_size_par - per_x * arrow_size_per, this.p1.y + par_y * arrow_size_par - per_y * arrow_size_per);
      ctx.fill();

      // Draw the arrow (p2)
      ctx.beginPath();
      ctx.moveTo(this.p2.x + par_x * arrow_size_par, this.p2.y + par_y * arrow_size_par);
      ctx.lineTo(this.p2.x - par_x * arrow_size_par + per_x * arrow_size_per, this.p2.y - par_y * arrow_size_par + per_y * arrow_size_per);
      ctx.lineTo(this.p2.x - par_x * arrow_size_par - per_x * arrow_size_per, this.p2.y - par_y * arrow_size_par - per_y * arrow_size_per);
      ctx.fill();
    }
    if (this.focalLength > 0) {
      // Draw the arrow (p1)
      ctx.beginPath();
      ctx.moveTo(this.p1.x + par_x * arrow_size_par, this.p1.y + par_y * arrow_size_par);
      ctx.lineTo(this.p1.x - par_x * arrow_size_par + per_x * arrow_size_per, this.p1.y - par_y * arrow_size_par + per_y * arrow_size_per);
      ctx.lineTo(this.p1.x - par_x * arrow_size_par - per_x * arrow_size_per, this.p1.y - par_y * arrow_size_par - per_y * arrow_size_per);
      ctx.fill();

      // Draw the arrow (p2)
      ctx.beginPath();
      ctx.moveTo(this.p2.x - par_x * arrow_size_par, this.p2.y - par_y * arrow_size_par);
      ctx.lineTo(this.p2.x + par_x * arrow_size_par + per_x * arrow_size_per, this.p2.y + par_y * arrow_size_par + per_y * arrow_size_per);
      ctx.lineTo(this.p2.x + par_x * arrow_size_par - per_x * arrow_size_per, this.p2.y + par_y * arrow_size_par - per_y * arrow_size_per);
      ctx.fill();
    }
  }

  checkRayIntersects(ray) {
    if (this.checkRayIntersectFilter(ray)) {
      return this.checkRayIntersectsShape(ray);
    } else {
      return null;
    }
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    var mirror_length = geometry.segmentLength(this);
    var main_line_unitvector_x = (-this.p1.y + this.p2.y) / mirror_length;
    var main_line_unitvector_y = (this.p1.x - this.p2.x) / mirror_length;
    var mid_point = geometry.segmentMidpoint(this);

    var twoF_point_1 = geometry.point(mid_point.x + main_line_unitvector_x * 2 * this.focalLength, mid_point.y + main_line_unitvector_y * 2 * this.focalLength);  // The first point at two focal lengths
    var twoF_point_2 = geometry.point(mid_point.x - main_line_unitvector_x * 2 * this.focalLength, mid_point.y - main_line_unitvector_y * 2 * this.focalLength);  // The second point at two focal lengths

    var twoF_line_near, twoF_line_far;
    if (geometry.distanceSquared(ray.p1, twoF_point_1) < geometry.distanceSquared(ray.p1, twoF_point_2)) {
      // The first point at two focal lengths is on the same side as the ray
      twoF_line_near = geometry.parallelLineThroughPoint(this, twoF_point_1);
      twoF_line_far = geometry.parallelLineThroughPoint(this, twoF_point_2);
    } else {
      // The second point at two focal lengths is on the same side as the ray
      twoF_line_near = geometry.parallelLineThroughPoint(this, twoF_point_2);
      twoF_line_far = geometry.parallelLineThroughPoint(this, twoF_point_1);
    }

    if (this.focalLength > 0) {
      ray.p2 = geometry.linesIntersection(twoF_line_far, geometry.line(mid_point, geometry.linesIntersection(twoF_line_near, ray)));
      ray.p1 = geometry.point(incidentPoint.x, incidentPoint.y);
    } else {
      ray.p2 = geometry.linesIntersection(twoF_line_far, geometry.line(incidentPoint, geometry.linesIntersection(twoF_line_near, geometry.line(mid_point, geometry.linesIntersection(twoF_line_far, ray)))));
      ray.p1 = geometry.point(incidentPoint.x, incidentPoint.y);
    }

    // The above calculation is for an ideal lens, now mirror it.
    
    ray.p1.x = 2 * ray.p1.x - ray.p2.x;
    ray.p1.y = 2 * ray.p1.y - ray.p2.y;

    var rx = ray.p1.x - incidentPoint.x;
    var ry = ray.p1.y - incidentPoint.y;
    var mx = this.p2.x - this.p1.x;
    var my = this.p2.y - this.p1.y;

    ray.p1 = incidentPoint;
    ray.p2 = geometry.point(incidentPoint.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, incidentPoint.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
  }
};
