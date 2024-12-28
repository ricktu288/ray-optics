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
import i18next from 'i18next';
import geometry from '../../geometry.js';

/**
 * The detector tool
 * 
 * Tools -> Other -> Detector
 * @class
 * @extends BaseSceneObj
 * @memberof sceneObjs
 * @property {Point} p1 - The first endpoint of the line segment.
 * @property {Point} p2 - The second endpoint of the line segment.
 * @property {boolean} irradMap - Whether to display the irradiance map.
 * @property {number} binSize - The size of the bin for the irradiance map.
 * @property {number} power - The measured power through the detector.
 * @property {number} normal - The measured normal force through the detector.
 * @property {number} shear - The measured shear force through the detector.
 * @property {Array<number>} binData - The measured data for the irradiance map.
 */
class Detector extends LineObjMixin(BaseSceneObj) {
  static type = 'Detector';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    irradMap: false,
    binSize: 1
  };

  constructor(scene, properties) {
    super(scene, properties);

    // Initialize the quantities to be measured
    this.power = 0;
    this.normal = 0;
    this.shear = 0;
    this.binData = null;
  }

  populateObjBar(objBar) {
    if (this.scene.colorMode !== 'legacy') {
      var sInfo = i18next.t('simulator:sceneObjs.Detector.info.sNewColorModes');
    } else {
      var sInfo = i18next.t('simulator:sceneObjs.Detector.info.s');
    }
    objBar.setTitle(i18next.t('main:tools.Detector.title'));
    objBar.createInfoBox('<ul><li>' + i18next.t('simulator:sceneObjs.Detector.info.P') + '</li><li>' + i18next.t('simulator:sceneObjs.Detector.info.Fperp') + '</li><li>' + i18next.t('simulator:sceneObjs.Detector.info.Fpar') + '</li><li>' + i18next.t('simulator:sceneObjs.Detector.info.irradiance') + '</li><li>' + i18next.t('simulator:sceneObjs.Detector.info.length') + '</li><li>' + i18next.t('simulator:sceneObjs.Detector.info.B') + '</li><li>' + sInfo + '</li><li>' + i18next.t('simulator:sceneObjs.Detector.info.truncation') + '</li></ul>');

    objBar.createBoolean(i18next.t('simulator:sceneObjs.Detector.irradMap'), this.irradMap, function (obj, value) {
      obj.irradMap = value;
    }, null, true);

    if (this.irradMap) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.Detector.binSize'), 0.01 * this.scene.lengthScale, 10 * this.scene.lengthScale, 0.01 * this.scene.lengthScale, this.binSize, function (obj, value) {
        obj.binSize = value;
      }, i18next.t('simulator:sceneObjs.common.lengthUnitInfo'));

      const self = this;

      objBar.createButton(i18next.t('simulator:sceneObjs.Detector.exportData'), function (obj) {
        // Export the irradiance map to a CSV file
        var binSize = obj.binSize;
        var binNum = Math.ceil(Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y)) / binSize);
        var binData = obj.binData;
        var csv = "data:text/csv;charset=utf-8,";

        // Write the header
        csv += "Position,Irradiance\n";

        // Write the data
        for (var i = 0; i < binNum; i++) {
          csv += i * binSize + "," + (binData[i] / binSize) + "\n";
        }
        var encodedUri = encodeURI(csv);

        // Download the file
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", (self.scene.name || "irradiance_map") + ".csv");
        document.body.appendChild(link);
        link.click();
      });
    }
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    if (!isAboveLight) {
      ctx.globalCompositeOperation = 'lighter';

      ctx.strokeStyle = isHovered ? 'cyan' : ('rgb(192,192,192)');
      ctx.lineWidth = 1 * ls;
      ctx.setLineDash([5 * ls, 5 * ls]);
      ctx.beginPath();
      ctx.moveTo(this.p1.x, this.p1.y);
      ctx.lineTo(this.p2.x, this.p2.y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.globalCompositeOperation = 'lighter';
      var len = Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));

      var accuracy = Math.max(-Math.floor(Math.log10(this.scene.simulator.totalTruncation)), 0);
      if (this.scene.simulator.totalTruncation > 0 && accuracy <= 2) {
        var str1 = "P=" + this.power.toFixed(accuracy) + "±" + this.scene.simulator.totalTruncation.toFixed(accuracy);
        var str2 = "F⊥=" + this.normal.toFixed(accuracy) + "±" + this.scene.simulator.totalTruncation.toFixed(accuracy);
        var str3 = "F∥=" + this.shear.toFixed(accuracy) + "±" + this.scene.simulator.totalTruncation.toFixed(accuracy);
      } else {
        var str1 = "P=" + this.power.toFixed(2);
        var str2 = "F⊥=" + this.normal.toFixed(2);
        var str3 = "F∥=" + this.shear.toFixed(2);
      }

      ctx.font = (16 * ls) + 'px Arial';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isHovered ? 'cyan' : ('rgb(192,192,192)');
      ctx.fillText(str1, this.p2.x, this.p2.y);
      ctx.fillText(str2, this.p2.x, this.p2.y + 20 * ls);
      ctx.fillText(str3, this.p2.x, this.p2.y + 40 * ls);
      ctx.globalCompositeOperation = 'source-over';

      if (this.irradMap && this.binData) {
        // Define the unit vector of the x-axis of the plot (parallel to obj) and the y-axis of the plot (perpendicular to obj)
        var len = Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
        var ux = (this.p2.x - this.p1.x) / len;
        var uy = (this.p2.y - this.p1.y) / len;
        var vx = uy;
        var vy = -ux;

        // Draw the irradiance map
        ctx.lineWidth = 1 * ls;
        ctx.strokeStyle = isHovered ? 'cyan' : ('rgb(255,255,255)');
        ctx.fillStyle = 'blue';
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        for (var i = 0; i < this.binData.length; i++) {
          ctx.lineTo(this.p1.x + ux * i * this.binSize + vx * this.binData[i] / this.binSize * 20 * ls * ls, this.p1.y + uy * i * this.binSize + vy * this.binData[i] / this.binSize * 20 * ls * ls);
          ctx.lineTo(this.p1.x + ux * (i + 1) * this.binSize + vx * this.binData[i] / this.binSize * 20 * ls * ls, this.p1.y + uy * (i + 1) * this.binSize + vy * this.binData[i] / this.binSize * 20 * ls * ls);
        }
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  onSimulationStart() {
    this.power = 0;
    this.normal = 0;
    this.shear = 0;

    if (this.irradMap) {
      var binSize = this.binSize;
      var binNum = Math.ceil(Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y)) / binSize);
      var binData = [];
      for (var i = 0; i < binNum; i++) {
        binData[i] = 0;
      }
      this.binData = binData;
    }
  }

  checkRayIntersects(ray) {
    return this.checkRayIntersectsShape(ray);
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    var rcrosss = (ray.p2.x - ray.p1.x) * (this.p2.y - this.p1.y) - (ray.p2.y - ray.p1.y) * (this.p2.x - this.p1.x);
    var sint = rcrosss / Math.sqrt((ray.p2.x - ray.p1.x) * (ray.p2.x - ray.p1.x) + (ray.p2.y - ray.p1.y) * (ray.p2.y - ray.p1.y)) / Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
    var cost = ((ray.p2.x - ray.p1.x) * (this.p2.x - this.p1.x) + (ray.p2.y - ray.p1.y) * (this.p2.y - this.p1.y)) / Math.sqrt((ray.p2.x - ray.p1.x) * (ray.p2.x - ray.p1.x) + (ray.p2.y - ray.p1.y) * (ray.p2.y - ray.p1.y)) / Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
    ray.p2 = geometry.point(incidentPoint.x + ray.p2.x - ray.p1.x, incidentPoint.y + ray.p2.y - ray.p1.y);
    ray.p1 = geometry.point(incidentPoint.x, incidentPoint.y);

    this.power += Math.sign(rcrosss) * (ray.brightness_s + ray.brightness_p);
    this.normal += Math.sign(rcrosss) * sint * (ray.brightness_s + ray.brightness_p);
    this.shear -= Math.sign(rcrosss) * cost * (ray.brightness_s + ray.brightness_p);

    if (this.irradMap && this.binData) {
      var binSize = this.binSize;
      var binNum = Math.ceil(Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y)) / binSize);
      var binIndex = Math.floor(Math.sqrt((incidentPoint.x - this.p1.x) * (incidentPoint.x - this.p1.x) + (incidentPoint.y - this.p1.y) * (incidentPoint.y - this.p1.y)) / binSize);
      this.binData[binIndex] += Math.sign(rcrosss) * (ray.brightness_s + ray.brightness_p);
    }
  }
};

export default Detector;