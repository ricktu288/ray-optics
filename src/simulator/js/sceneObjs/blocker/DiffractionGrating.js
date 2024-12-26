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

import LineObjMixin from '../LineObjMixin.js';
import BaseSceneObj from '../BaseSceneObj.js';
import i18next from 'i18next';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';

/**
 * Diffraction Grating
 * 
 * Tools -> Blocker -> Diffraction Grating
 * 
 * It is in the blocker category since the model we use is a blocker with slits.
 * @class
 * @extends BaseSceneObj
 * @memberof sceneObjs
 * @property {Point} p1 - The first endpoint of the line segment.
 * @property {Point} p2 - The second endpoint of the line segment.
 * @property {number} lineDensity - The number of lines per millimeter.
 * @property {boolean} customBrightness - Whether the output brightness are customized.
 * @property {number[]} brightnesses - The brightnesses of the diffracted rays for m = 0, 1, -1, 2, -2, ... when `customBrightness` is true. The number is to be normalized to the brightness of the incident ray. The values not in the array are set to 0.
 * @property {number} slitRatio - The ratio of the slit width to the line interval.
 * @property {boolean} mirrored - Whether the diffraction grating is reflective.
 */
class DiffractionGrating extends LineObjMixin(BaseSceneObj) {
  static type = 'DiffractionGrating';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    lineDensity: 1000,
    customBrightness: false,
    brightnesses: [1, 0.5, 0.5],
    slitRatio: 0.5,
    mirrored: false
  };

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.DiffractionGrating.title'));
    objBar.createNumber(i18next.t('simulator:sceneObjs.DiffractionGrating.lineDensity', {lengthUnit: 'mm'}), 1, 2500, 5, this.lineDensity, function (obj, value) {
      obj.lineDensity = value;
    });

    objBar.createBoolean(i18next.t('simulator:sceneObjs.DiffractionGrating.customBrightness'), this.customBrightness, function (obj, value) {
      obj.customBrightness = value;
    }, i18next.t('simulator:sceneObjs.DiffractionGrating.customBrightnessInfo'), true);

    if (this.customBrightness) {
      objBar.createTuple('', this.brightnesses.join(', '), function (obj, value) {
        obj.brightnesses = value.split(',').map(parseFloat);
      });
    } else if (objBar.showAdvanced(!this.arePropertiesDefault(['slitRatio']))) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.DiffractionGrating.slitRatio'), 0, 1, 0.001, this.slitRatio, function (obj, value) {
        obj.slitRatio = value;
      });
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['mirrored']))) {
      objBar.createBoolean(i18next.t('simulator:sceneObjs.DiffractionGrating.mirrored'), this.mirrored, function (obj, value) {
        obj.mirrored = value;
      });
    }
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
      ctx.fillStyle = 'rgb(128,128,128)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      return;
    }
    
    if (this.mirrored) {
      ctx.strokeStyle = isHovered ? 'cyan' : 'rgb(168,168,168)';
      ctx.beginPath();
      ctx.moveTo(this.p1.x, this.p1.y);
      ctx.lineTo(this.p2.x, this.p2.y);
      ctx.stroke();
    }
    ctx.strokeStyle = isHovered ? 'cyan' : 'rgb(124,62,18)';
    ctx.lineWidth = 2 * ls;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    if (this.customBrightness) {
      ctx.setLineDash([2 * ls, 2 * ls]);
    } else {
      ctx.setLineDash([4 * (1 - this.slitRatio) * ls, 4 * this.slitRatio * ls]);
    }
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1 * ls;
  }

  onSimulationStart() {
    this.warning = null;
    if (this.scene.mode == 'images' || this.scene.mode == 'observer') {
      this.warning = (this.warning || "") + i18next.t('simulator:sceneObjs.common.imageDetectionWarning');
    }

    if (!this.scene.simulateColors) {
      this.warning = (this.warning || "") + i18next.t('simulator:sceneObjs.common.nonSimulateColorsWarning');
    }
  }

  checkRayIntersects(ray) {
    return this.checkRayIntersectsShape(ray);
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    let truncation = 0;
    const mm_in_nm = 1 / 1000000;
    var rx = ray.p1.x - incidentPoint.x;
    var ry = ray.p1.y - incidentPoint.y;
    var mx = this.p2.x - this.p1.x;
    var my = this.p2.y - this.p1.y;

    var wavelength = (ray.wavelength || Simulator.GREEN_WAVELENGTH) * mm_in_nm;
    var interval = 1 / this.lineDensity;
    var slit_width = interval * this.slitRatio;

    //Find which side the incoming ray is hitting the diffraction line segment
    var crossProduct = rx * my - ry * mx;
    var left_point = crossProduct > 0 ? this.p1 : this.p2;

    //If mirrored, reflect the rays rather than pass them
    var mirror = this.mirrored ? -1 : 1;

    //Find angles
    var theta_left = Math.PI - Math.atan2(left_point.y - incidentPoint.y, left_point.x - incidentPoint.x);
    var theta_i = Math.PI - Math.atan2(ry, rx);
    var incidence_angle = Math.PI / 2 - (theta_left < theta_i ? theta_left + 2 * Math.PI - theta_i : theta_left - theta_i);

    var m_min = -Math.floor(interval / wavelength * (1 - Math.sin(incidence_angle)));
    var m_max = -Math.ceil(interval / wavelength * (-1 - Math.sin(incidence_angle)));

    let newRays = [];

    for (var m = m_min; m <= m_max; m++) {
      var diffracted_angle = Math.asin(Math.sin(incidence_angle) - m * wavelength / interval);

      var rot_c = Math.cos(mirror * (-Math.PI / 2 - diffracted_angle));
      var rot_s = Math.sin(mirror * (-Math.PI / 2 - diffracted_angle));
      var diffracted_ray = geometry.line(incidentPoint, geometry.point(incidentPoint.x + (left_point.x - incidentPoint.x) * rot_c - (left_point.y - incidentPoint.y) * rot_s, incidentPoint.y + (left_point.x - incidentPoint.x) * rot_s + (left_point.y - incidentPoint.y) * rot_c));

      // Calculate intensity
      if (this.customBrightness) {
        var intensity = this.brightnesses[m<=0 ? -2*m : 2*m-1] || 0;
      } else {
        // Treat the gratings as a blocker with slits
        var phase_diff = 2 * Math.PI * slit_width / wavelength * (Math.sin(incidence_angle) - Math.sin(diffracted_angle))
        var sinc_arg = (phase_diff == 0) ? 1 : Math.sin(phase_diff / 2) / (phase_diff / 2);

        // This formula may not be accurate when `diffracted_angle` is large. This is warned in the popover of the tool.
        var intensity = slit_width * slit_width / (interval * interval) * Math.pow(sinc_arg, 2);
      }

      if (intensity == 0) {
        continue;
      }
      
      diffracted_ray.wavelength = ray.wavelength;
      diffracted_ray.brightness_s = ray.brightness_s * intensity;
      diffracted_ray.brightness_p = ray.brightness_p * intensity;

      // There is currently no good way to make image detection work here. So just set gap to true to disable image detection for the diffracted rays.
      diffracted_ray.gap = true;

      if (diffracted_ray.brightness_s + diffracted_ray.brightness_p > (this.scene.simulator.useFloatColorRenderer ? 1e-6 : 0.01)) {
        newRays.push(diffracted_ray);
      } else {
        truncation += diffracted_ray.brightness_s + diffracted_ray.brightness_p;
      }
    }

    return {
      isAbsorbed: true,
      newRays: newRays,
      truncation: truncation
    };
  }
};

export default DiffractionGrating;