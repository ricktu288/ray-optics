import { BaseFilter } from '../BaseFilter.js';
import { LineObjMixin } from '../LineObjMixin.js';
import { Simulator } from '../../Simulator.js';

/**
 * Line blocker / filter.
 * 
 * Tools -> Blocker -> Line Blocker
 * @class
 * @extends BaseFilter
 * @alias rayOptics.sceneObjs.Blocker
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {boolean} filter - Whether it is a filter.
 * @property {boolean} invert - If true, the ray with wavelength outside the bandwidth is blocked. If false, the ray with wavelength inside the bandwidth is blocked.
 * @property {number} wavelength - The target wavelength if filter is enabled. The unit is nm.
 * @property {number} bandwidth - The bandwidth if filter is enabled. The unit is nm.
 */
export class Blocker extends LineObjMixin(BaseFilter) {
  static type = 'Blocker';
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

    if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
      ctx.fillStyle = 'rgb(128,128,128)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      return;
    }

    ctx.strokeStyle = isHovered ? 'cyan' : ((this.scene.simulateColors && this.wavelength && this.filter) ? Simulator.wavelengthToColor(this.wavelength || Simulator.GREEN_WAVELENGTH, 1) : 'rgb(70,35,10)');
    ctx.lineWidth = 3 * ls;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
    ctx.lineWidth = 1 * ls;
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
