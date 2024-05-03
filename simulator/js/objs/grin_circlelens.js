/**
 * Gradient-index glass of the shape of a circle.
 * Tools -> Glass -> Gradient-index Circle
 * @property {Point} p1 - The center of the circle.
 * @property {Point} p2 - A point on the boundary of the circle.
 * @property {string} p_tex - The refractive index function in x and y in LaTeX format.
 * @property {Point} origin - The origin of the (x,y) coordinates used in the refractive index function.
 * @property {number} step_size - The step size for the ray trajectory equation.
 * @property {number} eps - The epsilon for the intersection calculations.
 */
objTypes['grin_circlelens'] = class extends CircleObjMixin(BaseGrinGlass) {
  static type = 'grin_circlelens';
  static isOptical = true;
  static supportsSurfaceMerging = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    p_tex: '1+e^{-\\frac{x^2+y^2}{50^2}}',
    origin: { x: 0, y: 0 },
    step_size: 1,
    eps: 1e-3
  };

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;

    if (this.error) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.font = '12px serif';
      ctx.fillStyle = "red"
      ctx.fillText(this.error.toString(), this.p1.x, this.p1.y);
    }

    ctx.beginPath();
    ctx.arc(this.p1.x, this.p1.y, geometry.segmentLength(this), 0, Math.PI * 2, false);
    this.fillGlass(canvasRenderer, isAboveLight, isHovered);
    ctx.lineWidth = 1;
    ctx.fillStyle = 'red';
    ctx.fillRect(this.p1.x - 1.5, this.p1.y - 1.5, 3, 3);
    if (isHovered) {
      ctx.fillStyle = 'magenta';
      ctx.fillRect(this.p2.x - 1.5, this.p2.y - 1.5, 3, 3);
    }
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    super.onConstructMouseDown(mouse, ctrl, shift);
    this.origin = geometry.point(this.p1.x, this.p1.y);
    this.initFns();
  }

  checkRayIntersects(ray) {
    if (!this.fn_p) {
      this.initFns();
    }
    if (this.isInsideGlass(ray.p1) || this.isOnBoundary(ray.p1)) // if the first point of the ray is inside the circle, or on its boundary
    {
      let len = geometry.distance(ray.p1, ray.p2);
      let x = ray.p1.x + (this.step_size / len) * (ray.p2.x - ray.p1.x);
      let y = ray.p1.y + (this.step_size / len) * (ray.p2.y - ray.p1.y);
      const intersection_point = geometry.point(x, y);
      if (this.isInsideGlass(intersection_point)) // if intersection_point is inside the circle
        return intersection_point;
    }
    return this.checkRayIntersectsShape(ray);
  }

  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
    if (this.notDone) { return; }
    try {
      if ((this.isInsideGlass(ray.p1) || this.isOutsideGlass(ray.p1)) && this.isOnBoundary(incidentPoint)) // if the ray is hitting the circle from the outside, or from the inside (meaning that the point incidentPoint is on the boundary of the circle, and the point ray.p1 is inside/outside the circle)
      {
        let r_bodyMerging_obj = ray.bodyMergingObj; // save the current bodyMergingObj of the ray, to pass it later to the reflected ray in the 'refract' function

        var midpoint = geometry.segmentMidpoint(geometry.line(ray.p1, incidentPoint));
        var d = geometry.distanceSquared(this.p1, this.p2) - geometry.distanceSquared(this.p1, midpoint);
        if (d > 0) {
          // From inside to outside
          var n1 = this.getRefIndexAt(incidentPoint, ray);
          var normal = { x: this.p1.x - incidentPoint.x, y: this.p1.y - incidentPoint.y };
          this.onRayExit(ray);
        } else if (d < 0) {
          // From outside to inside
          var n1 = 1 / this.getRefIndexAt(incidentPoint, ray);
          var normal = { x: incidentPoint.x - this.p1.x, y: incidentPoint.y - this.p1.y };
          this.onRayEnter(ray);
        } else {
          // The situation that may cause bugs (e.g. incident on an edge point)
          // To prevent shooting the ray to a wrong direction, absorb the ray
          return {
            isAbsorbed: true
          };
        }
        return this.refract(ray, rayIndex, incidentPoint, normal, n1, surfaceMergingObjs, r_bodyMerging_obj);
      } else {
        if (ray.bodyMergingObj === undefined)
          ray.bodyMergingObj = this.initRefIndex(ray); // Initialize the bodyMerging object of the ray
        const next_point = this.step(ray.p1, incidentPoint, ray);
        ray.p1 = incidentPoint;
        ray.p2 = next_point;
      }
    } catch (e) {
      //throw e
      console.log("Error in onRayIncident of GRIN glass: " + e.toString());
      return {
        isAbsorbed: true
      };
    }
  }

  getIncidentType(ray) {
    var midpoint = geometry.segmentMidpoint(geometry.line(ray.p1, this.checkRayIntersectsShape(ray)));
    var d = geometry.distanceSquared(this.p1, this.p2) - geometry.distanceSquared(this.p1, midpoint);
    if (d > 0) {
      return 1; // From inside to outside
    }
    if (d < 0) {
      return -1; // From outside to inside
    }
    return NaN;
  }

  isOutsideGlass(point) {
    const R_squared = geometry.distanceSquared(this.p1, this.p2);
    return (geometry.distanceSquared(this.p1, point) - R_squared - this.eps > 0 && geometry.distanceSquared(this.p1, point) - R_squared + this.eps > 0);
  }

  isInsideGlass(point) {
    const R_squared = geometry.distanceSquared(this.p1, this.p2);
    return (geometry.distanceSquared(this.p1, point) - R_squared - this.eps < 0 && geometry.distanceSquared(this.p1, point) - R_squared + this.eps < 0);
  }

  isOnBoundary(point) {
    const R_squared = geometry.distanceSquared(this.p1, this.p2);
    return (geometry.distanceSquared(this.p1, point) - R_squared - this.eps < 0 && geometry.distanceSquared(this.p1, point) - R_squared + this.eps > 0);
  }
};
