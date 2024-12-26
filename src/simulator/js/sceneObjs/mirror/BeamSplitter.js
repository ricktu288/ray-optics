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

import BaseFilter from '../BaseFilter.js';
import LineObjMixin from '../LineObjMixin.js';
import i18next from 'i18next';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';

/**
 * Beam splitter.
 * 
 * Tools -> Mirror -> Beam splitter
 * @class
 * @extends BaseFilter
 * @memberof sceneObjs
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {number} transRatio - The transmission ratio.
 * @property {boolean} filter - Whether it is a dichroic beam splitter.
 * @property {boolean} invert - If true, the ray with wavelength outside the bandwidth interacts with the beam splitter. If false, the ray with wavelength inside the bandwidth interacts with the beam splitter.
 * @property {number} wavelength - The target wavelength if dichroic is enabled. The unit is nm.
 * @property {number} bandwidth - The bandwidth if dichroic is enabled. The unit is nm.
 */
class BeamSplitter extends LineObjMixin(BaseFilter) {
  static type = 'BeamSplitter';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    transRatio: 0.5,
    filter: false,
    invert: false,
    wavelength: Simulator.GREEN_WAVELENGTH,
    bandwidth: 10
  };

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.BeamSplitter.title'));
    objBar.createNumber(i18next.t('simulator:sceneObjs.BeamSplitter.transRatio'), 0, 1, 0.01, this.transRatio, function (obj, value) {
      obj.transRatio = value;
    });

    super.populateObjBar(objBar);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
      ctx.fillStyle = 'rgb(128,128,128)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      return;
    }
    
    ctx.strokeStyle = isHovered ? 'cyan' : ('rgb(100,100,168)');
    ctx.lineWidth = 1 * ls;
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
    const colorArray = Simulator.wavelengthToColor(this.wavelength || Simulator.GREEN_WAVELENGTH, 1);
    ctx.strokeStyle = isHovered ? 'cyan' : (this.scene.simulateColors && this.wavelength && this.filter ? canvasRenderer.rgbaToCssColor(colorArray) : 'rgb(100,100,168)');
    ctx.setLineDash([15 * ls, 15 * ls]);
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  checkRayIntersects(ray) {
    if (this.checkRayIntersectFilter(ray)) {
      return this.checkRayIntersectsShape(ray);
    } else {
      return null;
    }
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    var rx = ray.p1.x - incidentPoint.x;
    var ry = ray.p1.y - incidentPoint.y;

    ray.p1 = incidentPoint;
    var mx = this.p2.x - this.p1.x;
    var my = this.p2.y - this.p1.y;
    ray.p2 = geometry.point(incidentPoint.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, incidentPoint.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
    var ray2 = geometry.line(incidentPoint, geometry.point(incidentPoint.x - rx, incidentPoint.y - ry));
    var transmission = this.transRatio;
    ray2.brightness_s = transmission * ray.brightness_s;
    ray2.brightness_p = transmission * ray.brightness_p;
    ray2.wavelength = ray.wavelength;
    ray.brightness_s *= (1 - transmission);
    ray.brightness_p *= (1 - transmission);
    if (ray2.brightness_s + ray2.brightness_p > (this.scene.simulator.useFloatColorRenderer ? 1e-6 : 0.01)) {
      return {
        newRays: [ray2]
      };
    } else if (ray.brightness_s + ray.brightness_p > (this.scene.simulator.useFloatColorRenderer ? 1e-6 : 0.01)) {
      return {
        truncation: ray2.brightness_s + ray2.brightness_p
      };
    } else {
      return {
        isAbsorbed: true,
        truncation: ray.brightness_s + ray.brightness_p + ray2.brightness_s + ray2.brightness_p
      };
    }
  }
};

export default BeamSplitter;