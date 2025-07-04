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

/**
 * The ruler tool
 * 
 * Tools -> Other -> Ruler
 * @class
 * @extends BaseSceneObj
 * @memberof sceneObjs
 * @property {Point} p1 - The first endpoint of the line segment.
 * @property {Point} p2 - The second endpoint of the line segment.
 * @property {number} scaleInterval - The scale interval of the ruler.
 */
class Ruler extends LineObjMixin(BaseSceneObj) {
  static type = 'Ruler';
  static serializableDefaults = {
    p1: null,
    p2: null,
    scaleInterval: 10
  };

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.Ruler.title'));
    objBar.createNumber(i18next.t('simulator:sceneObjs.Ruler.scaleInterval'), 0, 10, 1, this.scaleInterval, function (obj, value) {
      obj.scaleInterval = value;
    }, i18next.t('simulator:sceneObjs.common.lengthUnitInfo'), true);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    if (isAboveLight) return;

    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
      ctx.fillStyle = 'rgb(128,128,128)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      return;
    }
    
    if (this.scene.theme.background.color.r == 0 && this.scene.theme.background.color.g == 0 && this.scene.theme.background.color.b == 0) {
      ctx.globalCompositeOperation = 'lighter';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }
    var len = Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
    var par_x = (this.p2.x - this.p1.x) / len;
    var par_y = (this.p2.y - this.p1.y) / len;
    var per_x = par_y;
    var per_y = -par_x;
    var ang = Math.atan2(this.p2.y - this.p1.y, this.p2.x - this.p1.x);

    var scale_step = this.scaleInterval;
    var scale_step_mid = scale_step * 5;
    var scale_step_long = scale_step * 10;
    var scale_len = 10 * ls;
    var scale_len_mid = 15 * ls;

    ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.ruler.color);
    ctx.font = (this.scene.theme.rulerText.size * ls) + 'px ' + this.scene.theme.rulerText.font;
    ctx.fillStyle = canvasRenderer.rgbaToCssColor(this.scene.theme.rulerText.color);
    if (ang > Math.PI * (-0.25) && ang <= Math.PI * 0.25) {
      //↘~↗
      var scale_direction = -1;
      var scale_len_long = 20 * ls;
      var text_ang = ang;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
    } else if (ang > Math.PI * (-0.75) && ang <= Math.PI * (-0.25)) {
      //↗~↖
      var scale_direction = 1;
      var scale_len_long = 15 * ls;
      var text_ang = ang - Math.PI * (-0.5);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
    } else if (ang > Math.PI * 0.75 || ang <= Math.PI * (-0.75)) {
      //↖~↙
      var scale_direction = 1;
      var scale_len_long = 20 * ls;
      var text_ang = ang - Math.PI;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
    } else {
      //↙~↘
      var scale_direction = -1;
      var scale_len_long = 15 * ls;
      var text_ang = ang - Math.PI * 0.5;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
    }

    ctx.lineWidth = this.scene.theme.ruler.width * ls;

    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    var x, y;
    for (var i = 0; i <= len; i += scale_step) {
      ctx.moveTo(this.p1.x + i * par_x, this.p1.y + i * par_y);
      if (i % scale_step_long == 0) {
        x = this.p1.x + i * par_x + scale_direction * scale_len_long * per_x;
        y = this.p1.y + i * par_y + scale_direction * scale_len_long * per_y;
        ctx.lineTo(x, y);
        if (canvasRenderer.isSVG) ctx.stroke();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(text_ang);
        ctx.fillText(i, 0, 0);
        ctx.restore();
      } else if (i % scale_step_mid == 0) {
        ctx.lineTo(this.p1.x + i * par_x + scale_direction * scale_len_mid * per_x, this.p1.y + i * par_y + scale_direction * scale_len_mid * per_y);
      } else {
        ctx.lineTo(this.p1.x + i * par_x + scale_direction * scale_len * per_x, this.p1.y + i * par_y + scale_direction * scale_len * per_y);
      }
    }
    ctx.stroke();

    ctx.globalCompositeOperation = 'source-over';
  }

  scale(scale, center) {
    super.scale(scale, center);
    return false; // It is unclear what properties should be scaled.
  }

  getDefaultCenter() {
    return this.p1;
  }
};

export default Ruler;