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
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';
import i18next from 'i18next';

/**
 * 360 degree point source
 * 
 * Tools -> Light Source -> Point source (360deg)
 * @class
 * @extends BaseSceneObj
 * @memberof sceneObjs
 * @property {number} x - The x coordinate of the point source.
 * @property {number} y - The y coordinate of the point source.
 * @property {number} brightness - The brightness of the point source.
 * @property {number} wavelength - The wavelength of the light emitted by the point source in nm. Only effective when "Simulate Colors" is on.
 */
class PointSource extends BaseSceneObj {
  static type = 'PointSource';
  static isOptical = true;
  static serializableDefaults = {
    x: null,
    y: null,
    brightness: 0.5,
    wavelength: Simulator.GREEN_WAVELENGTH
  };

  populateObjBar(objBar) {
    if (this.scene.colorMode !== 'default') {
      var brightnessInfo = i18next.t('simulator:sceneObjs.common.brightnessInfo.newColorModes');
    } else {
      var brightnessInfo = '<p>' + i18next.t('simulator:sceneObjs.common.brightnessInfo.rayDensity') + '</p><p>' + i18next.t('simulator:sceneObjs.common.brightnessInfo.rayDensitySlider') + '</p>';
    }
    objBar.setTitle(i18next.t('main:tools.PointSource.title') + ' (360\u00B0)');
    objBar.createNumber(i18next.t('simulator:sceneObjs.common.brightness'), 0.01, 1, 0.01, this.brightness, function (obj, value) {
      obj.brightness = value;
    }, brightnessInfo);
    if (this.scene.simulateColors) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.common.wavelength') + ' (nm)', Simulator.UV_WAVELENGTH, Simulator.INFRARED_WAVELENGTH, 1, this.wavelength, function (obj, value) {
        obj.wavelength = value;
      });
    }
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    const colorArray = Simulator.wavelengthToColor(this.wavelength, 1);
    ctx.fillStyle = this.scene.simulateColors ? canvasRenderer.rgbaToCssColor(colorArray) : isHovered ? 'cyan' : 'rgb(0,255,0)';
    ctx.fillRect(this.x - 2.5 * ls, this.y - 2.5 * ls, 5 * ls, 5 * ls);
    if (this.scene.simulateColors) {
      ctx.fillStyle = isHovered ? 'cyan' : ('rgb(255,255,255)');
      ctx.fillRect(this.x - 1.5 * ls, this.y - 1.5 * ls, 3 * ls, 3 * ls);
    }
  }

  move(diffX, diffY) {
    this.x += diffX;
    this.y += diffY;
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();
    this.x = mousePos.x;
    this.y = mousePos.y;
    if (this.scene.colorMode !== 'default') {
      // In the new color modes, the default brightness for newly created sources is set to 0.1 instead.
      this.brightness = 0.1;
    }
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    return {
      isDone: true
    };
  }

  checkMouseOver(mouse) {
    let dragContext = {};
    if (mouse.isOnPoint(this)) {
      dragContext.part = 0;
      dragContext.targetPoint = geometry.point(this.x, this.y);
      dragContext.snapContext = {};
      return dragContext;
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    if (shift) {
      var mousePos = mouse.getPosSnappedToDirection(dragContext.targetPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
    } else {
      var mousePos = mouse.getPosSnappedToGrid();
      dragContext.snapContext = {};
    }

    this.x = mousePos.x;
    this.y = mousePos.y;
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

    let newRays = [];
    var s = Math.PI * 2 / parseInt(rayDensity * 500);
    var i0 = (this.scene.mode == 'observer') ? (-s * 2 + 1e-6) : 0;
    for (var i = i0; i < (Math.PI * 2 - 1e-5); i = i + s) {
      var ray1 = geometry.line(geometry.point(this.x, this.y), geometry.point(this.x + Math.sin(i), this.y + Math.cos(i)));
      ray1.brightness_s = Math.min(this.brightness / rayDensity, 1) * 0.5;
      ray1.brightness_p = Math.min(this.brightness / rayDensity, 1) * 0.5;
      ray1.isNew = true;
      if (this.scene.simulateColors) {
        ray1.wavelength = this.wavelength;
      }
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

export default PointSource;