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
 * Line or arrow decoration
 * 
 * Tools -> Other -> Line / Arrow
 * @class
 * @extends BaseSceneObj
 * @memberof sceneObjs
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {boolean} arrow - Whether an arrow is pointing from the first endpoint.
 * @property {boolean} backArrow - Whether an arrow is pointing from the second endpoint.
 */
class LineArrow extends LineObjMixin(BaseSceneObj) {
  static type = 'LineArrow';
  static serializableDefaults = {
    p1: null,
    p2: null,
    arrow: false,
    backArrow: false
  };

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.LineArrow.title'));
    objBar.createBoolean(i18next.t('simulator:sceneObjs.LineArrow.arrow'), this.arrow, function (obj, value) {
      obj.arrow = value;
    });

    objBar.createBoolean(i18next.t('simulator:sceneObjs.LineArrow.backArrow'), this.backArrow, function (obj, value) {
      obj.backArrow = value;
    });
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
      ctx.fillStyle = 'rgb(128,128,128)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      return;
    }
    
    ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.decoration.color);
    ctx.lineWidth = this.scene.theme.decoration.width * ls;
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
    if (this.arrow) {
      this.drawArrow(canvasRenderer, this.p1, this.p2);
    }
    if (this.backArrow) {
      this.drawArrow(canvasRenderer, this.p2, this.p1);
    }
  }
  

  /** Utility method */

  drawArrow(canvasRenderer, p1, p2) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const len = Math.max(this.scene.theme.decoration.width * 5 * ls, 10 * ls);
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - len * Math.cos(angle - Math.PI / 6), p2.y - len * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - len * Math.cos(angle + Math.PI / 6), p2.y - len * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }
};

export default LineArrow;