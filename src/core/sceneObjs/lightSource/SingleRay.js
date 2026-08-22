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

import BaseSceneObj from '../BaseSceneObj.js';
import LineObjMixin from '../LineObjMixin.js';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';
import { parseFormula } from '../../formula/formula-parser.js';
import i18next from 'i18next';

const SINGLE_RAY_SOURCE_TYPE = {
  name: 'Single ray',
  paramNames: ['x_0', 'y_0', 'd_x_0', 'd_y_0', 'P', 'lambda_0'],
  dag: parseFormula(
    `
      x = x_0;
      y = y_0;
      d_x = d_x_0;
      d_y = d_y_0;
      P_s = P;
      P_p = P;
      lambda = lambda_0;
    `,
    ['x_0', 'y_0', 'd_x_0', 'd_y_0', 'P', 'lambda_0']
  )
};

/**
 * A single ray of light.
 * 
 * Tools -> Light source -> Single ray
 * @class
 * @extends BaseSceneObj
 * @memberof sceneObjs
 * @property {Point} p1 - The start point of the ray.
 * @property {Point} p2 - Another point on the ray.
 * @property {number} brightness - The brightness of the ray.
 * @property {number} wavelength - The wavelength of the ray in nm. Only effective when "Simulate Colors" is on.
 */
class SingleRay extends LineObjMixin(BaseSceneObj) {
  static type = 'SingleRay';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    brightness: 1,
    wavelength: Simulator.GREEN_WAVELENGTH
  };

  static getDescription(objData, scene, detailed = false) {
    return i18next.t('main:tools.SingleRay.title');
  }

  static getPropertySchema(objData, scene) {
    return [
      { key: 'p1', type: 'point', label: i18next.t('simulator:sceneObjs.LineObjMixin.sourcePoint') },
      { key: 'p2', type: 'point', label: i18next.t('simulator:sceneObjs.LineObjMixin.directionPoint') },
      { key: 'brightness', type: 'number', label: i18next.t('simulator:sceneObjs.common.brightness') },
      { key: 'wavelength', type: 'number', label: i18next.t('simulator:sceneObjs.common.wavelength') + ' (nm)' },
    ];
  }

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.SingleRay.title'));
    objBar.createNumber(i18next.t('simulator:sceneObjs.common.brightness'), 0.01, 1, 0.01, this.brightness, function (obj, value) {
      obj.brightness = value;
    });
    if (this.scene.simulateColors) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.common.wavelength') + ' (nm)', Simulator.UV_WAVELENGTH, Simulator.INFRARED_WAVELENGTH, 1, this.wavelength, function (obj, value) {
        obj.wavelength = value;
      });
    }
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    let sourceColor = this.scene.theme.sourcePoint.color;
    let directionColor = this.scene.theme.directionPoint.color;

    if (this.scene.simulateColors) {
      sourceColor = this.scene.simulator.wavelengthToColor(this.wavelength, 1);
    }
    
    if (isHovered) {
      sourceColor = this.scene.highlightColor;
      directionColor = this.scene.highlightColor;
    }

    canvasRenderer.drawPoint(this.p1, sourceColor, this.scene.theme.sourcePoint.size);
    canvasRenderer.drawPoint(this.p2, directionColor, this.scene.theme.directionPoint.size);
  }

  getDefaultCenter() {
    return this.p1;
  }

  getPrimitives() {
    if (!this.p1 || !this.p2) return [];

    const directionX = this.p2.x - this.p1.x;
    const directionY = this.p2.y - this.p1.y;
    const directionLength = Math.hypot(directionX, directionY);
    if (!(directionLength > 0) || !Number.isFinite(directionLength)) {
      return [];
    }

    return [{
      kind: 'source',
      sourceType: SINGLE_RAY_SOURCE_TYPE,
      params: {
        x_0: this.p1.x,
        y_0: this.p1.y,
        d_x_0: directionX / directionLength,
        d_y_0: directionY / directionLength,
        P: 0.5 * this.brightness,
        lambda_0: this.scene.simulateColors
          ? this.wavelength
          : Simulator.GREEN_WAVELENGTH
      },
      rayCount: 1
    }];
  }

  onSimulationStart() {
    var ray1 = geometry.line(this.p1, this.p2);
    ray1.brightness_s = 0.5 * this.brightness;
    ray1.brightness_p = 0.5 * this.brightness;
    if (this.scene.simulateColors) {
      ray1.wavelength = this.wavelength;
    }
    ray1.gap = true;
    ray1.isNew = true;
    return {
      newRays: [ray1]
    };
  }
};

export default SingleRay;
