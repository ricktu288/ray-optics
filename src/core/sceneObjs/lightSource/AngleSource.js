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

/**
 * Finite angle point source
 * 
 * Tools -> Light source -> Point source (<360deg)
 * @class
 * @extends BaseSceneObj
 * @memberof sceneObjs
 * @property {Point} p1 - The position of the point source.
 * @property {Point} p2 - Another point on the reference line.
 * @property {number} brightness - The brightness of the point source.
 * @property {number} wavelength - The wavelength of the point source in nm. Only effective when "Simulate Colors" is on.
 * @property {number} emisAngle - The angle of emission in degrees.
 * @property {boolean} symmetric - Whether the emission is symmetric about the reference line. If not, the emission is only on one side of the reference line.
 */
class AngleSource extends LineObjMixin(BaseSceneObj) {
  static type = 'AngleSource';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    brightness: 0.5,
    wavelength: Simulator.GREEN_WAVELENGTH,
    emisAngle: 36.001,
    symmetric: true
  };

  static getPropertySchema(objData, scene) {
    return [
      { key: 'p1', type: 'point', label: i18next.t('simulator:sceneObjs.LineObjMixin.sourcePoint') },
      { key: 'p2', type: 'point', label: i18next.t('simulator:sceneObjs.LineObjMixin.directionPoint') },
      { key: 'brightness', type: 'number', label: i18next.t('simulator:sceneObjs.common.brightness') },
      { key: 'wavelength', type: 'number', label: i18next.t('simulator:sceneObjs.common.wavelength') + ' (nm)' },
      { key: 'emisAngle', type: 'number', label: i18next.t('simulator:sceneObjs.common.emisAngle') + ' (\u00B0)' },
      { key: 'symmetric', type: 'boolean', label: i18next.t('simulator:sceneObjs.AngleSource.symmetric') },
    ];
  }

  populateObjBar(objBar) {
    if (this.scene.colorMode !== 'default') {
      var brightnessInfo = i18next.t('simulator:sceneObjs.common.brightnessInfo.newColorModes');
    } else {
      var brightnessInfo = '<p>' + i18next.t('simulator:sceneObjs.common.brightnessInfo.rayDensity') + '</p><p>' + i18next.t('simulator:sceneObjs.common.brightnessInfo.rayDensitySlider') + '</p>';
    }
    objBar.setTitle(i18next.t('main:tools.PointSource.title') + ' (<360\u00B0)');
    objBar.createNumber(i18next.t('simulator:sceneObjs.common.brightness'), 0.01, 1, 0.01, this.brightness, function (obj, value) {
      obj.brightness = value;
    }, brightnessInfo);
    if (this.scene.simulateColors) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.common.wavelength') + ' (nm)', Simulator.UV_WAVELENGTH, Simulator.INFRARED_WAVELENGTH, 1, this.wavelength, function (obj, value) {
        obj.wavelength = value;
      });
    }
    objBar.createNumber(i18next.t('simulator:sceneObjs.common.emisAngle') + ' (°)', 0, 180, 1, this.emisAngle, function (obj, value) {
      obj.emisAngle = value;
    });
    if (objBar.showAdvanced(!this.arePropertiesDefault(['symmetric']))) {
      objBar.createBoolean(i18next.t('simulator:sceneObjs.AngleSource.symmetric'), this.symmetric, function (obj, value) {
        obj.symmetric = value;
      });
    }
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    super.onConstructMouseDown(mouse, ctrl, shift);
    if (this.scene.colorMode !== 'default') {
      // In the new color modes, the default brightness for newly created sources is set to 0.1 instead.
      this.brightness = 0.1;
    }
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    if (this.scene.simulateColors) {
      canvasRenderer.drawPoint(this.p1, this.scene.simulator.wavelengthToColor(this.wavelength, 1), this.scene.theme.lightSource.size);

      canvasRenderer.drawPoint(this.p1, isHovered ? this.scene.highlightColor : this.scene.theme.colorSourceCenter.color, this.scene.theme.colorSourceCenter.size);
    } else {
      canvasRenderer.drawPoint(this.p1, isHovered ? this.scene.highlightColor : this.scene.theme.lightSource.color, this.scene.theme.lightSource.size);
    }

    canvasRenderer.drawPoint(this.p2, isHovered ? this.scene.highlightColor : this.scene.theme.directionPoint.color, this.scene.theme.directionPoint.size);
  }

  getDefaultCenter() {
    return this.p1;
  }

  onSimulationStart() {
    let rayDensity = this.scene.rayDensity;
    do {
      var expectBrightness = this.brightness / rayDensity;

      if (this.scene.colorMode !== 'default' && expectBrightness > 1) {
        // In the new color modes, the brightness scale is always kept to 1 for consistent detector readings, so the ray density is overriden to keep the brightness scale to 1. Currently the strategy is to increase the number of angled rays until the brightness is less than 1. This may be improved in the future.
        rayDensity += 1/500;
      }
    } while (this.scene.colorMode !== 'default' && expectBrightness > 1);

    var s = Math.PI * 2 / parseInt(rayDensity * 500);
    var i0 = (this.scene.mode == 'observer') ? (-s * 2 + 1e-6) : 0;

    var ang, x1, y1, iStart, iEnd;
    if (this.symmetric) {
      iStart = (i0 - (Math.PI / 180.0 * this.emisAngle) / 2.0);
      iEnd = (i0 + (Math.PI / 180.0 * this.emisAngle) / 2.0 - 1e-5);
    } else {
      iStart = i0;
      iEnd = (i0 + (Math.PI / 180.0 * this.emisAngle) - 1e-5);
    }

    let newRays = [];

    for (var i = iStart; i < iEnd; i = i + s) {
      var r = Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));

      ang = i + Math.atan2(this.p2.y - this.p1.y, this.p2.x - this.p1.x);

      x1 = this.p1.x + r * Math.cos(ang);
      y1 = this.p1.y + r * Math.sin(ang);

      var ray1 = geometry.line(geometry.point(this.p1.x, this.p1.y), geometry.point(x1, y1));

      ray1.brightness_s = Math.min(this.brightness / rayDensity, 1) * 0.5;
      ray1.brightness_p = Math.min(this.brightness / rayDensity, 1) * 0.5;
      if (this.scene.simulateColors) {
        ray1.wavelength = this.wavelength;
      }
      ray1.isNew = true;
      if (i == i0) {
        ray1.gap = true;
      }
      newRays.push(ray1);
    }

    return {
      newRays: newRays,
      brightnessScale: Math.min(this.brightness / rayDensity, 1) / (this.brightness / rayDensity)
    };
  }
};

export default AngleSource;