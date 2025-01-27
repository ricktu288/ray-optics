/*
 * Copyright 2024 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import BaseSceneObj from './BaseSceneObj.js';
import Simulator from '../Simulator.js';
import i18next from 'i18next';

/**
 * The base class for optical elements with wavelength filter functionality, including mirrors (which have the dichroic feature) and blockers.
 * @class
 * @extends BaseSceneObj
 * @property {boolean} filter - Whether the filter feature is enabled.
 * @property {boolean} invert - If true, the element interacts with the ray only if its wavelength is outside the bandwidth of the filter. If false, the element interacts with the ray only if its wavelength is within the bandwidth of the filter.
 * @property {number} wavelength - The target wavelength of the filter. The unit is nm.
 * @property {number} bandwidth - The bandwidth of the filter. The unit is nm.
 */
class BaseFilter extends BaseSceneObj {

  populateObjBar(objBar) {
    if (this.scene.simulateColors) {
      objBar.createBoolean(i18next.t('simulator:sceneObjs.BaseFilter.filter'), this.filter, function (obj, value) {
        obj.filter = value;
        obj.wavelength = obj.wavelength;
        obj.invert = obj.invert;
        obj.bandwidth = obj.bandwidth;
      }, null, true);
      if (this.filter) {
        objBar.createBoolean(i18next.t('simulator:sceneObjs.BaseFilter.invert'), this.invert, function (obj, value) {
          if (obj.filter) {
            obj.invert = value;
          }
        });
        objBar.createNumber(i18next.t('simulator:sceneObjs.common.wavelength') + ' (nm)', Simulator.UV_WAVELENGTH, Simulator.INFRARED_WAVELENGTH, 1, this.wavelength, function (obj, value) {
          obj.wavelength = value;
        });
        objBar.createNumber("± " + i18next.t('simulator:sceneObjs.BaseFilter.bandwidth') + ' (nm)', 0, (Simulator.INFRARED_WAVELENGTH - Simulator.UV_WAVELENGTH), 1, this.bandwidth, function (obj, value) {
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
    var dichroicEnabled = this.scene.simulateColors && this.filter && this.wavelength;
    var rayHueMatchesMirror =  Math.abs(this.wavelength - ray.wavelength) <= this.bandwidth;
    return !dichroicEnabled || (rayHueMatchesMirror != this.invert);
  }
};

export default BaseFilter;