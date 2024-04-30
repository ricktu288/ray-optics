/**
 * Ideal lens
 * Tools -> Glass -> Ideal Lens
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {number} p - The focal length.
 */
objTypes['lens'] = class extends LineObjMixin(BaseSceneObj) {
  static type = 'lens';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    p: 100
  };

  populateObjBar(objBar) {
    objBar.createNumber(getMsg('focallength'), -1000, 1000, 1, this.p, function (obj, value) {
      obj.p = value;
    });
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    var len = Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
    var par_x = (this.p2.x - this.p1.x) / len;
    var par_y = (this.p2.y - this.p1.y) / len;
    var per_x = par_y;
    var per_y = -par_x;

    var arrow_size_per = 5;
    var arrow_size_par = 5;
    var center_size = 2;

    // Draw the line segment
    ctx.strokeStyle = isHovered ? 'cyan' : ('rgb(128,128,128)');
    ctx.globalAlpha = 1 / ((Math.abs(this.p) / 100) + 1);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgb(255,0,0)';

    // Draw the center point of the lens
    var center = geometry.segmentMidpoint(this);
    ctx.strokeStyle = 'rgb(255,255,255)';
    ctx.beginPath();
    ctx.moveTo(center.x - per_x * center_size, center.y - per_y * center_size);
    ctx.lineTo(center.x + per_x * center_size, center.y + per_y * center_size);
    ctx.stroke();

    if (this.p > 0) {
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

    if (this.p < 0) {
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

    if (isHovered) {
      // show focal length
      var mp = geometry.segmentMidpoint(this);
      ctx.fillStyle = 'rgb(255,0,255)';
      ctx.fillRect(mp.x + this.p * per_x - 1.5, mp.y + this.p * per_y - 1.5, 3, 3);
      ctx.fillRect(mp.x - this.p * per_x - 1.5, mp.y - this.p * per_y - 1.5, 3, 3);
    }
  }

  checkRayIntersects(ray) {
    return this.checkRayIntersectsShape(ray);
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    var lens_length = geometry.segmentLength(this);
    var main_line_unitvector_x = (-this.p1.y + this.p2.y) / lens_length;
    var main_line_unitvector_y = (this.p1.x - this.p2.x) / lens_length;
    var mid_point = geometry.segmentMidpoint(this);

    var twoF_point_1 = geometry.point(mid_point.x + main_line_unitvector_x * 2 * this.p, mid_point.y + main_line_unitvector_y * 2 * this.p);  // The first point at two focal lengths
    var twoF_point_2 = geometry.point(mid_point.x - main_line_unitvector_x * 2 * this.p, mid_point.y - main_line_unitvector_y * 2 * this.p);  // The second point at two focal lengths

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

    if (this.p > 0) {
      // Converging lens
      ray.p2 = geometry.linesIntersection(twoF_line_far, geometry.line(mid_point, geometry.linesIntersection(twoF_line_near, ray)));
      ray.p1 = incidentPoint;
    } else {
      // Diverging lens
      ray.p2 = geometry.linesIntersection(twoF_line_far, geometry.line(incidentPoint, geometry.linesIntersection(twoF_line_near, geometry.line(mid_point, geometry.linesIntersection(twoF_line_far, ray)))));
      ray.p1 = incidentPoint;
    }
  }
};
