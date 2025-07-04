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
import CircleObjMixin from '../CircleObjMixin.js';
import i18next from 'i18next';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';

/**
 * Circle blocker / filter.
 * 
 * Tools -> Blocker -> Circle Blocker
 * @class
 * @extends BaseFilter
 * @memberof sceneObjs
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

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.CircleBlocker.title'));
    super.populateObjBar(objBar);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    ctx.beginPath();
    ctx.arc(this.p1.x, this.p1.y, geometry.segmentLength(this), 0, Math.PI * 2);
    const colorArray = Simulator.wavelengthToColor(this.wavelength || Simulator.GREEN_WAVELENGTH, 1);
    ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.simulateColors && this.wavelength && this.filter ? colorArray : this.scene.theme.blocker.color);
    ctx.lineWidth = this.scene.theme.blocker.width * ls;
    ctx.stroke();
    canvasRenderer.drawPoint(this.p1, this.scene.theme.centerPoint.color, this.scene.theme.centerPoint.size);

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