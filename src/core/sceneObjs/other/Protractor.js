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
import i18next from 'i18next';
import CircleObjMixin from '../CircleObjMixin.js';

/**
 * The protractor tool
 * 
 * Tools -> Other -> Protractor
 * @class
 * @extends BaseSceneObj
 * @memberof sceneObjs
 * @property {Point} p1 - The center of the protractor.
 * @property {Point} p2 - The zero point on the protractor.
 */
class Protractor extends CircleObjMixin(BaseSceneObj) {
  static type = 'Protractor';
  static serializableDefaults = {
    p1: null,
    p2: null
  };

  static getDescription(objData, scene, detailed = false) {
    return i18next.t('main:tools.Protractor.title');
  }

  static getPropertySchema(objData, scene) {
    return [
      { key: 'p1', type: 'point', label: i18next.t('simulator:sceneObjs.CircleObjMixin.center') },
      { key: 'p2', type: 'point', label: i18next.t('simulator:sceneObjs.Protractor.zeroPoint') },
    ];
  }

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.Protractor.title'));
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    if (!isAboveLight) {
      if (this.scene.theme.background.color.r == 0 && this.scene.theme.background.color.g == 0 && this.scene.theme.background.color.b == 0) {
        ctx.globalCompositeOperation = 'lighter';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }
      var r = Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
      var scale_width_limit = 5 * ls;

      var scale_step = 1;
      var scale_step_mid = 5;
      var scale_step_long = 10;
      var scale_len = 10 * ls;
      var scale_len_mid = 15 * ls;
      var scale_len_long = 20 * ls;

      ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.ruler.color);
      ctx.font = 'bold ' + (this.scene.theme.rulerText.size * ls) + 'px ' + this.scene.theme.rulerText.font;
      ctx.fillStyle = canvasRenderer.rgbaToCssColor(this.scene.theme.rulerText.color);

      if (r * scale_step * Math.PI / 180 < scale_width_limit) {
        // The scale is too small
        scale_step = 2;
        scale_step_mid = 10;
        scale_step_long = 30;
      }
      if (r * scale_step * Math.PI / 180 < scale_width_limit) {
        // The scale is too small
        scale_step = 5;
        scale_step_mid = 10;
        scale_step_long = 30;
        scale_len = 5 * ls;
        scale_len_mid = 8 * ls;
        scale_len_long = 10 * ls;
        ctx.font = 'bold ' + (this.scene.theme.rulerText.size * 10 / 14 * ls) + 'px ' + this.scene.theme.rulerText.font;
      }
      if (r * scale_step * Math.PI / 180 < scale_width_limit) {
        // The scale is too small
        scale_step = 10;
        scale_step_mid = 30;
        scale_step_long = 90;
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      ctx.lineWidth = this.scene.theme.ruler.width * ls;

      ctx.beginPath();
      ctx.arc(this.p1.x, this.p1.y, r, 0, Math.PI * 2, false);

      var ang, x, y;
      for (var i = 0; i < 360; i += scale_step) {
        ang = i * Math.PI / 180 + Math.atan2(this.p2.y - this.p1.y, this.p2.x - this.p1.x);
        ctx.moveTo(this.p1.x + r * Math.cos(ang), this.p1.y + r * Math.sin(ang));
        if (i % scale_step_long == 0) {
          x = this.p1.x + (r - scale_len_long) * Math.cos(ang);
          y = this.p1.y + (r - scale_len_long) * Math.sin(ang);
          ctx.lineTo(x, y);
          if (canvasRenderer.isSVG) ctx.stroke();
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(ang + Math.PI * 0.5);
          ctx.fillText((i > 180) ? (360 - i) : i, 0, 0);
          ctx.restore();
        } else if (i % scale_step_mid == 0) {
          ctx.lineTo(this.p1.x + (r - scale_len_mid) * Math.cos(ang), this.p1.y + (r - scale_len_mid) * Math.sin(ang));
        } else {
          ctx.lineTo(this.p1.x + (r - scale_len) * Math.cos(ang), this.p1.y + (r - scale_len) * Math.sin(ang));
        }
      }
      ctx.stroke();

      ctx.globalCompositeOperation = 'source-over';
    }
    canvasRenderer.drawPoint(this.p1, this.scene.theme.centerPoint.color, this.scene.theme.centerPoint.size);
    if (isHovered) {
      ctx.fillStyle = 'magenta';
      ctx.fillRect(this.p2.x - 2.5 * ls, this.p2.y - 2.5 * ls, 5 * ls, 5 * ls);
    }
  }
};

export default Protractor;