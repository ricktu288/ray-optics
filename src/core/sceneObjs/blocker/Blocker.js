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

/**
 * Line blocker / filter.
 * 
 * Tools -> Blocker -> Line Blocker
 * @class
 * @extends BaseFilter
 * @memberof sceneObjs
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {boolean} filter - Whether it is a filter.
 * @property {boolean} invert - If true, the ray with wavelength outside the bandwidth is blocked. If false, the ray with wavelength inside the bandwidth is blocked.
 * @property {number} wavelength - The target wavelength if filter is enabled. The unit is nm.
 * @property {number} bandwidth - The bandwidth if filter is enabled. The unit is nm.
 */
class Blocker extends LineObjMixin(BaseFilter) {
  static type = 'Blocker';
  static isOptical = true;
  static mergesWithGlass = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    filter: false,
    invert: false,
    wavelength: Simulator.GREEN_WAVELENGTH,
    bandwidth: 10
  };

  static getPropertySchema(objData, scene) {
    return [
      ...super.getPropertySchema(objData, scene),
    ];
  }

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.Blocker.title'));
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

    const colorArray = this.scene.simulator.wavelengthToColor(this.wavelength || Simulator.GREEN_WAVELENGTH, 1);
    ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.simulateColors && this.wavelength && this.filter ? colorArray : this.scene.theme.blocker.color);
    ctx.lineWidth = this.scene.theme.blocker.width * ls;
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

export default Blocker;