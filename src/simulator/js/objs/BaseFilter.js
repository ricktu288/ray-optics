import { BaseSceneObj } from './BaseSceneObj.js';
import { Simulator } from '../Simulator.js';
import { getMsg } from '../translations.js';

/**
 * The base class for optical elements with wavelength filter functionality, including mirrors (which have the dichroic feature) and blockers.
 * @property {boolean} filter - Whether the filter feature is enabled.
 * @property {boolean} invert - If true, the element interacts with the ray only if its wavelength is outside the bandwidth of the filter. If false, the element interacts with the ray only if its wavelength is within the bandwidth of the filter.
 * @property {number} wavelength - The target wavelength of the filter. The unit is nm.
 * @property {number} bandwidth - The bandwidth of the filter. The unit is nm.
 */
export class BaseFilter extends BaseSceneObj {

  populateObjBar(objBar) {
    if (this.scene.simulateColors) {
      objBar.createBoolean(getMsg('filter'), this.filter, function (obj, value) {
        obj.filter = value;
        obj.wavelength = obj.wavelength;
        obj.invert = obj.invert;
        obj.bandwidth = obj.bandwidth;
      }, null, true);
      if (this.filter) {
        objBar.createBoolean(getMsg('invert'), this.invert, function (obj, value) {
          if (obj.filter) {
            obj.invert = value;
          }
        });
        objBar.createNumber(getMsg('wavelength'), Simulator.UV_WAVELENGTH, Simulator.INFRARED_WAVELENGTH, 1, this.wavelength, function (obj, value) {
          obj.wavelength = value;
        });
        objBar.createNumber("± " + getMsg('bandwidth'), 0, (Simulator.INFRARED_WAVELENGTH - Simulator.UV_WAVELENGTH), 1, this.bandwidth, function (obj, value) {
          obj.bandwidth = value;
        });
      }
    }
  }

  /**
   * Checks if the ray interacts with the filter at the level of the wavelength.
   * @param {import('../Simulator.js').Ray} ray - The ray to be checked.
   * @returns {boolean} - If true, the ray interacts with the filter at the level of the wavelength.
   */
  checkRayIntersectFilter(ray) {
    var dichroicEnabled = this.scene.simulateColors && this.filter && this.wavelength;
    var rayHueMatchesMirror =  Math.abs(this.wavelength - ray.wavelength) <= this.bandwidth;
    return !dichroicEnabled || (rayHueMatchesMirror != this.invert);
  }
};
