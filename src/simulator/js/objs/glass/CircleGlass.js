import { BaseGlass } from '../BaseGlass.js';
import { CircleObjMixin } from '../CircleObjMixin.js';
import { geometry } from '../../geometry.js';

/**
 * Glass of the shape of a circle.
 * 
 * Tools -> Glass -> Circle
 * @class
 * @extends BaseGlass
 * @alias rayOptics.objTypes.CircleGlass
 * @property {Point} p1 - The center of the circle.
 * @property {Point} p2 - A point on the boundary of the circle.
 * @property {number} refIndex - The refractive index of the glass, or the Cauchy coefficient A of the glass if "Simulate Colors" is on.
 * @property {number} cauchyB - The Cauchy coefficient B of the glass if "Simulate Colors" is on, in micrometer squared.
 */
export class CircleGlass extends CircleObjMixin(BaseGlass) {
  static type = 'CircleGlass';
  static isOptical = true;
  static supportsSurfaceMerging = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    refIndex: 1.5,
    cauchyB: 0.004
  };

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    ctx.beginPath();
    ctx.arc(this.p1.x, this.p1.y, geometry.segmentLength(this), 0, Math.PI * 2, false);
    this.fillGlass(canvasRenderer, isAboveLight, isHovered);
    ctx.lineWidth = 1;
    ctx.fillStyle = 'red';
    ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
    if (isHovered) {
      ctx.fillStyle = 'magenta';
      ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
    }
  }

  checkRayIntersects(ray) {
    if (this.refIndex <= 0) return;
    return this.checkRayIntersectsShape(ray);
  }

  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
    var midpoint = geometry.segmentMidpoint(geometry.line(ray.p1, incidentPoint));
    var d = geometry.distanceSquared(this.p1, this.p2) - geometry.distanceSquared(this.p1, midpoint);
    if (d > 0) {
      // From inside to outside
      var n1 = this.getRefIndexAt(incidentPoint, ray);
      var normal = { x: this.p1.x - incidentPoint.x, y: this.p1.y - incidentPoint.y };
    } else if (d < 0) {
      // From outside to inside
      var n1 = 1 / this.getRefIndexAt(incidentPoint, ray);
      var normal = { x: incidentPoint.x - this.p1.x, y: incidentPoint.y - this.p1.y };
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
    var midpoint = geometry.segmentMidpoint(geometry.line(ray.p1, this.checkRayIntersects(ray)));
    var d = geometry.distanceSquared(this.p1, this.p2) - geometry.distanceSquared(this.p1, midpoint);
    if (d > 0) {
      return 1; // From inside to outside
    }
    if (d < 0) {
      return -1; // From outside to inside
    }
    return NaN;
  }
};
