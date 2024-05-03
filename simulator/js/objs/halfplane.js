/**
 * Glass of the shape of a half-plane.
 * Tools -> Glass -> Half-plane
 * @property {Point} p1 - A point on the boundary of the half-plane.
 * @property {Point} p2 - Another point on the boundary of the half-plane.
 * @property {number} p - The refractive index of the glass, or the Cauchy coefficient A of the glass if color mode is on.
 * @property {number} cauchyCoeff - The Cauchy coefficient B of the glass if color mode is on, in micrometer squared.
 */
objTypes['halfplane'] = class extends LineObjMixin(BaseGlass) {
  static type = 'halfplane';
  static isOptical = true;
  static supportsSurfaceMerging = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    p: 1.5,
    cauchyCoeff: 0.004
  };

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;

    var len = Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
    var par_x = (this.p2.x - this.p1.x) / len;
    var par_y = (this.p2.y - this.p1.y) / len;
    var per_x = par_y;
    var per_y = -par_x;

    var sufficientlyLargeDistance = (Math.abs(this.p1.x + this.scene.origin.x) + Math.abs(this.p1.y + this.scene.origin.y) + ctx.canvas.height + ctx.canvas.width) / Math.min(1, this.scene.scale);

    ctx.beginPath();
    ctx.moveTo(this.p1.x - par_x * sufficientlyLargeDistance, this.p1.y - par_y * sufficientlyLargeDistance);
    ctx.lineTo(this.p1.x + par_x * sufficientlyLargeDistance, this.p1.y + par_y * sufficientlyLargeDistance);
    ctx.lineTo(this.p1.x + (par_x - per_x) * sufficientlyLargeDistance, this.p1.y + (par_y - per_y) * sufficientlyLargeDistance);
    ctx.lineTo(this.p1.x - (par_x + per_x) * sufficientlyLargeDistance, this.p1.y - (par_y + per_y) * sufficientlyLargeDistance);

    this.fillGlass(canvasRenderer, isAboveLight, isHovered);

    if (isHovered) {
      ctx.fillStyle = 'magenta';
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
    if (mouse.isOnLine(this)) {
      const mousePos = mouse.getPosSnappedToGrid();
      dragContext.part = 0;
      dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
      dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
      dragContext.snapContext = {};
      return dragContext;
    }
  }


  checkRayIntersects(ray) {
    if (this.p <= 0) return;
    var rp_temp = geometry.linesIntersection(ray, this);

    if (geometry.intersectionIsOnRay(rp_temp, ray)) {
      return rp_temp;
    }
  }

  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {

    var rdots = (ray.p2.x - ray.p1.x) * (this.p2.x - this.p1.x) + (ray.p2.y - ray.p1.y) * (this.p2.y - this.p1.y);
    var ssq = (this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y);
    var normal = { x: rdots * (this.p2.x - this.p1.x) - ssq * (ray.p2.x - ray.p1.x), y: rdots * (this.p2.y - this.p1.y) - ssq * (ray.p2.y - ray.p1.y) };

    var incidentType = this.getIncidentType(ray);
    if (incidentType == 1) {
      // From inside to outside
      var n1 = this.getRefIndexAt(incidentPoint, ray);
    } else if (incidentType == -1) {
      // From outside to inside
      var n1 = 1 / this.getRefIndexAt(incidentPoint, ray);
    } else {
      // Situation that may cause bugs (e.g. incident on an edge point)
      // To prevent shooting the ray to a wrong direction, absorb the ray
      return {
        isAbsorbed: true
      };
    }

    return this.refract(ray, rayIndex, incidentPoint, normal, n1, surfaceMergingObjs, ray.bodyMergingObj);
  }

  getIncidentType(ray) {
    var rcrosss = (ray.p2.x - ray.p1.x) * (this.p2.y - this.p1.y) - (ray.p2.y - ray.p1.y) * (this.p2.x - this.p1.x);
    if (rcrosss > 0) {
      return 1; // From inside to outside
    }
    if (rcrosss < 0) {
      return -1; // From outside to inside
    }
    return NaN;
  }
};
