/**
 * The base class for optical elements with wavelength filter functionality, including mirrors (which have the dichroic feature) and blockers.
 * @property {boolean} isDichroic - Whether the filter feature is enabled. The name comes from the first use case of this feature (dichroic mirrors). This name should be changed in the future. The name on the UI is "Filter".
 * @property {boolean} isDichroicFilter - If true, the element interacts with the ray only if its wavelength is outside the bandwidth of the filter. If false, the element interacts with the ray only if its wavelength is within the bandwidth of the filter. Again, the name should be changed in the future. The name on the UI is "Invert".
 * @property {number} wavelength - The target wavelength of the filter. The unit is nm.
 * @property {number} bandwidth - The bandwidth of the filter. The unit is nm.
 */
class BaseFilter extends BaseSceneObj {

  populateObjBar(objBar) {
    if (this.scene.colorMode) {
      objBar.createBoolean(getMsg('filter'), this.isDichroic, function (obj, value) {
        obj.isDichroic = value;
        obj.wavelength = obj.wavelength;
        obj.isDichroicFilter = obj.isDichroicFilter;
        obj.bandwidth = obj.bandwidth;
      }, null, true);
      if (this.isDichroic) {
        objBar.createBoolean(getMsg('invert'), this.isDichroicFilter, function (obj, value) {
          if (obj.isDichroic) {
            obj.isDichroicFilter = value;
          }
        });
        objBar.createNumber(getMsg('wavelength'), UV_WAVELENGTH, INFRARED_WAVELENGTH, 1, this.wavelength, function (obj, value) {
          obj.wavelength = value;
        });
        objBar.createNumber("± " + getMsg('bandwidth'), 0, (INFRARED_WAVELENGTH - UV_WAVELENGTH), 1, this.bandwidth, function (obj, value) {
          obj.bandwidth = value;
        });
      }
    }
  }

  /**
   * Checks if the ray interacts with the filter at the level of the wavelength.
   * @param {Ray} ray - The ray to be checked.
   * @returns {boolean} - If true, the ray interacts with the filter at the level of the wavelength.
   */
  checkRayIntersectFilter(ray) {
    var dichroicEnabled = this.scene.colorMode && this.isDichroic && this.wavelength;
    var rayHueMatchesMirror =  Math.abs(this.wavelength - ray.wavelength) <= this.bandwidth;
    return !dichroicEnabled || (rayHueMatchesMirror != this.isDichroicFilter);
  }
};
