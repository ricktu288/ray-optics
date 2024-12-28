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
import i18next from 'i18next';
import { exp } from 'mathjs';

/**
 * A parallel or divergent beam of light.
 * 
 * Tools -> Light source -> beam
 * @class
 * @extends BaseSceneObj
 * @memberof sceneObjs
 * @property {Point} p1 - The first endpoint of the segment perpendicular to the beam.
 * @property {Point} p2 - The second endpoint of the segment perpendicular to the beam.
 * @property {number} brightness - The brightness of the beam.
 * @property {number} wavelength - The wavelength of the beam in nm. Only effective when "Simulate Colors" is on.
 * @property {number} emisAngle - The angle of divergence in degrees.
 * @property {boolean} lambert - Whether the beam is Lambertian.
 * @property {boolean} random - Whether the beam is random.
 * @property {Array<number>} randomNumbers - Random numbers used for random beam.
 */
class Beam extends LineObjMixin(BaseSceneObj) {
  static type = 'Beam';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    brightness: 0.5,
    wavelength: Simulator.GREEN_WAVELENGTH,
    emisAngle: 0.0,
    lambert: false,
    random: false
  };

  populateObjBar(objBar) {
    if (this.scene.colorMode !== 'legacy') {
      var brightnessInfo = i18next.t('simulator:sceneObjs.common.brightnessInfo.newColorModes');
    } else {
      var brightnessInfo = '<p>' + i18next.t('simulator:sceneObjs.common.brightnessInfo.rayDensity') + '</p><p>' + i18next.t('simulator:sceneObjs.common.brightnessInfo.rayDensitySlider') + '</p>';
    }
    objBar.setTitle(i18next.t('main:tools.Beam.title'));
    objBar.createNumber(i18next.t('simulator:sceneObjs.common.brightness'), 0.01 / this.scene.lengthScale, 1 / this.scene.lengthScale, 0.01 / this.scene.lengthScale, this.brightness, function (obj, value) {
      obj.brightness = value;
    }, brightnessInfo);
    if (this.scene.simulateColors) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.common.wavelength') + ' (nm)', Simulator.UV_WAVELENGTH, Simulator.INFRARED_WAVELENGTH, 1, this.wavelength, function (obj, value) {
        obj.wavelength = value;
      });
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['emisAngle', 'lambert', 'random']))) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.common.emisAngle') + ' (°)', 0, 180, 1, this.emisAngle, function (obj, value) {
        obj.emisAngle = value;
      });
      objBar.createBoolean(i18next.t('simulator:sceneObjs.common.lambert'), this.lambert, function (obj, value) {
        obj.lambert = value;
      });
      objBar.createBoolean(i18next.t('simulator:sceneObjs.common.random'), this.random, function (obj, value) {
        obj.random = value;
      });
    }
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    super.onConstructMouseDown(mouse, ctrl, shift);
    if (this.scene.colorMode !== 'legacy') {
      // In the new color modes, the default brightness for newly created sources is set to 0.1 instead.
      this.brightness = 0.1;
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

    var a_l = Math.atan2(this.p1.x - this.p2.x, this.p1.y - this.p2.y) - Math.PI / 2;
    const colorArray = Simulator.wavelengthToColor(this.wavelength, 1);
    ctx.strokeStyle = isHovered ? 'cyan' : (this.scene.simulateColors ? canvasRenderer.rgbaToCssColor(colorArray) : 'rgb(0,255,0)');
    ctx.lineWidth = 4 * ls;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(this.p1.x + Math.sin(a_l) * 2 * ls, this.p1.y + Math.cos(a_l) * 2 * ls);
    ctx.lineTo(this.p2.x + Math.sin(a_l) * 2 * ls, this.p2.y + Math.cos(a_l) * 2 * ls);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(128,128,128,255)';
    ctx.lineWidth = 2 * ls;
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
    ctx.lineWidth = 1 * ls;
    ctx.lineCap = 'butt';
  }

  onSimulationStart() {
    if ((this.scene.mode == 'images' || this.scene.mode == 'observer') && (this.emisAngle > 0 || this.random)) {
      this.warning = i18next.t('simulator:sceneObjs.Beam.imageDetectionWarning');
    } else {
      this.warning = null;
    }

    let rayDensity = this.scene.rayDensity;

    do {
      var n = geometry.segmentLength(this) * rayDensity / this.scene.lengthScale;
      var stepX = (this.p2.x - this.p1.x) / n;
      var stepY = (this.p2.y - this.p1.y) / n;
      var s = Math.PI * 2 / parseInt(rayDensity * 500);
      var sizeX = (this.p2.x - this.p1.x);
      var sizeY = (this.p2.y - this.p1.y);
      var normal = Math.atan2(stepX, stepY) + Math.PI / 2.0;
      var halfAngle = this.emisAngle / 180.0 * Math.PI * 0.5;
      var numnAngledRays = 1.0 + Math.floor(halfAngle / s) * 2.0;
      var rayBrightness = 1.0 / numnAngledRays;

      var expectBrightness = this.brightness * this.scene.lengthScale / rayDensity * rayBrightness;

      if (this.scene.colorMode !== 'legacy' && expectBrightness > 1) {
        // In the new color modes, the brightness scale is always kept to 1 for consistent detector readings, so the ray density is overriden to keep the brightness scale to 1. Currently the strategy is to increase the number of angled rays until the brightness is less than 1. This may be improved in the future.
        rayDensity += 1/500;
      }
    } while (this.scene.colorMode !== 'legacy' && expectBrightness > 1);
    this.initRandom();

    let newRays = [];

    if (!this.random) {
      for (var i = 0.5; i <= n; i++) {
        var x = this.p1.x + i * stepX;
        var y = this.p1.y + i * stepY;
        newRays.push(this.newRay(x, y, normal, 0.0, i == 0, rayBrightness, rayDensity));
        for (var angle = s; angle < halfAngle; angle += s) {
          newRays.push(this.newRay(x, y, normal, angle, i == 0, rayBrightness, rayDensity));
          newRays.push(this.newRay(x, y, normal, -angle, i == 0, rayBrightness, rayDensity));
        }
      }
    } else {
      for (var i = 0; i < n * numnAngledRays; i++) {
        const position = this.getRandom(i * 2);
        const angle = this.getRandom(i * 2 + 1);
        newRays.push(this.newRay(
          this.p1.x + position * sizeX,
          this.p1.y + position * sizeY,
          normal,
          (angle * 2 - 1) * halfAngle,
          i == 0,
          rayBrightness, rayDensity));
      }
    }

    return {
      newRays: newRays,
      brightnessScale: Math.min(this.brightness * this.scene.lengthScale / rayDensity * rayBrightness, 1) / (this.brightness * this.scene.lengthScale / rayDensity * rayBrightness)
    };
  }


  /** Utility methods */

  initRandom() {
    if (this.randomNumbers == undefined || !this.random) {
      this.clearRandom();
    }
  }

  clearRandom() {
    this.randomNumbers = [];
  }

  getRandom(i) {
    for (let j = this.randomNumbers.length; j <= i; j++) {
      this.randomNumbers.push(this.scene.rng());
    }
    return this.randomNumbers[i];
  }

  newRay(x, y, normal, angle, gap, brightness_factor = 1.0, rayDensity = this.scene.rayDensity) {
    var ray1 = geometry.line(geometry.point(x, y), geometry.point(x + Math.sin(normal + angle), y + Math.cos(normal + angle)));
    ray1.brightness_s = Math.min(this.brightness * this.scene.lengthScale / rayDensity * brightness_factor, 1) * 0.5;
    ray1.brightness_p = Math.min(this.brightness * this.scene.lengthScale / rayDensity * brightness_factor, 1) * 0.5;
    if (this.lambert) {
      const lambert = Math.cos(angle)
      ray1.brightness_s *= lambert;
      ray1.brightness_p *= lambert;
    }
    ray1.isNew = true;
    if (this.scene.simulateColors) {
      ray1.wavelength = this.wavelength;
    }
    ray1.gap = gap;

    return ray1;
  }
};

export default Beam;