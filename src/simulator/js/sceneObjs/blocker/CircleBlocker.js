import BaseFilter from '../BaseFilter.js';
import CircleObjMixin from '../CircleObjMixin.js';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';

/**
 * Circle blocker / filter.
 * 
 * Tools -> Blocker -> Circle Blocker
 * @class
 * @extends BaseFilter
 * @memberof rayOptics.sceneObjs
 * @property {Point} p1 - The center of the circle.
 * @property {Point} p2 - A point on the circle.
 * @property {boolean} filter - Whether it is a filter.
 * @property {boolean} invert - If true, the ray with wavelength outside the bandwidth is blocked. If false, the ray with wavelength inside the bandwidth is blocked.
 * @property {number} wavelength - The target wavelength if filter is enabled. The unit is nm.
 * @property {number} bandwidth - The bandwidth if filter is enabled. The unit is nm.
 */
class CircleBlocker extends CircleObjMixin(BaseFilter) {
  static type = 'CircleBlocker';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    filter: false,
    invert: false,
    wavelength: Simulator.GREEN_WAVELENGTH,
    bandwidth: 10
  };

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    ctx.beginPath();
    ctx.arc(this.p1.x, this.p1.y, geometry.segmentLength(this), 0, Math.PI * 2);
    ctx.lineWidth = 3 * ls;
    ctx.strokeStyle = isHovered ? 'cyan' : ((this.scene.simulateColors && this.wavelength && this.filter) ? Simulator.wavelengthToColor(this.wavelength || Simulator.GREEN_WAVELENGTH, 1) : 'rgb(70,35,10)');
    //ctx.fillStyle="indigo";

    ctx.stroke();
    ctx.fillStyle = 'red';
    ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);

    ctx.lineWidth = 1 * ls;
    if (isHovered) {
      ctx.fillStyle = 'magenta';
      ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
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
    return {
      isAbsorbed: true
    };
  }
};

export default CircleBlocker;