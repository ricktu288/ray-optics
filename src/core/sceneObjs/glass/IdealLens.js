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
 * Ideal lens
 * 
 * Tools -> Glass -> Ideal Lens
 * @class
 * @extends BaseSceneObj
 * @memberof sceneObjs
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {number} focalLength - The focal length.
 */
class IdealLens extends LineObjMixin(BaseSceneObj) {
  static type = 'IdealLens';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    focalLength: 100
  };

  static getPropertySchema(objData, scene) {
    return [
      ...super.getPropertySchema(objData, scene),
      { key: 'focalLength', type: 'number', label: i18next.t('simulator:sceneObjs.common.focalLength') },
    ];
  }

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.IdealLens.title'));
    objBar.createNumber(i18next.t('simulator:sceneObjs.common.focalLength'), -1000 * this.scene.lengthScale, 1000 * this.scene.lengthScale, 1 * this.scene.lengthScale, this.focalLength, function (obj, value) {
      obj.focalLength = value;
    }, i18next.t('simulator:sceneObjs.common.lengthUnitInfo'));
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
      ctx.fillStyle = 'rgb(128,128,128)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      return;
    }
    
    var len = Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
    var par_x = (this.p2.x - this.p1.x) / len;
    var par_y = (this.p2.y - this.p1.y) / len;
    var per_x = par_y;
    var per_y = -par_x;

    var arrow_size_per = this.scene.theme.idealCurveArrow.size / 2 * ls;
    var arrow_size_par = this.scene.theme.idealCurveArrow.size / 2 * ls;
    var center_size = this.scene.theme.idealCurveArrow.size / 5 * ls;

    // Draw the line segment
    ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor([(this.scene.theme.glass.color.r + this.scene.theme.background.color.r) / 2, (this.scene.theme.glass.color.g + this.scene.theme.background.color.g) / 2, (this.scene.theme.glass.color.b + this.scene.theme.background.color.b) / 2, 1]);
    ctx.globalAlpha = 1 / ((Math.abs(this.focalLength / this.scene.lengthScale) / 100) + 1);
    ctx.lineWidth = this.scene.theme.idealCurveArrow.size / 5 * 2 * ls;
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
    ctx.lineWidth = 1 * ls;

    ctx.globalAlpha = 1;
    ctx.fillStyle = canvasRenderer.rgbaToCssColor(this.scene.theme.idealCurveArrow.color);

    // Draw the center point of the lens
    var center = geometry.segmentMidpoint(this);
    ctx.strokeStyle = canvasRenderer.rgbaToCssColor(this.scene.theme.idealCurveCenter.color);
    ctx.beginPath();
    ctx.moveTo(center.x - per_x * center_size, center.y - per_y * center_size);
    ctx.lineTo(center.x + per_x * center_size, center.y + per_y * center_size);
    ctx.stroke();

    if (this.focalLength > 0) {
      // Draw the arrow (p1)
      ctx.beginPath();
      ctx.moveTo(this.p1.x - par_x * arrow_size_par, this.p1.y - par_y * arrow_size_par);
      ctx.lineTo(this.p1.x + par_x * arrow_size_par + per_x * arrow_size_per, this.p1.y + par_y * arrow_size_par + per_y * arrow_size_per);
      ctx.lineTo(this.p1.x + par_x * arrow_size_par - per_x * arrow_size_per, this.p1.y + par_y * arrow_size_par - per_y * arrow_size_per);
      ctx.fill();

      // Draw the arrow (p2)
      ctx.beginPath();
      ctx.moveTo(this.p2.x + par_x * arrow_size_par, this.p2.y + par_y * arrow_size_par);
      ctx.lineTo(this.p2.x - par_x * arrow_size_par + per_x * arrow_size_per, this.p2.y - par_y * arrow_size_par + per_y * arrow_size_per);
      ctx.lineTo(this.p2.x - par_x * arrow_size_par - per_x * arrow_size_per, this.p2.y - par_y * arrow_size_par - per_y * arrow_size_per);
      ctx.fill();
    }

    if (this.focalLength < 0) {
      // Draw the arrow (p1)
      ctx.beginPath();
      ctx.moveTo(this.p1.x + par_x * arrow_size_par, this.p1.y + par_y * arrow_size_par);
      ctx.lineTo(this.p1.x - par_x * arrow_size_par + per_x * arrow_size_per, this.p1.y - par_y * arrow_size_par + per_y * arrow_size_per);
      ctx.lineTo(this.p1.x - par_x * arrow_size_par - per_x * arrow_size_per, this.p1.y - par_y * arrow_size_par - per_y * arrow_size_per);
      ctx.fill();

      // Draw the arrow (p2)
      ctx.beginPath();
      ctx.moveTo(this.p2.x - par_x * arrow_size_par, this.p2.y - par_y * arrow_size_par);
      ctx.lineTo(this.p2.x + par_x * arrow_size_par + per_x * arrow_size_per, this.p2.y + par_y * arrow_size_par + per_y * arrow_size_per);
      ctx.lineTo(this.p2.x + par_x * arrow_size_par - per_x * arrow_size_per, this.p2.y + par_y * arrow_size_par - per_y * arrow_size_per);
      ctx.fill();
    }

    if (isHovered) {
      // show focal length
      var mp = geometry.segmentMidpoint(this);
      ctx.fillStyle = 'rgb(255,0,255)';
      ctx.fillRect(mp.x + this.focalLength * per_x - 1.5 * ls, mp.y + this.focalLength * per_y - 1.5 * ls, 3 * ls, 3 * ls);
      ctx.fillRect(mp.x - this.focalLength * per_x - 1.5 * ls, mp.y - this.focalLength * per_y - 1.5 * ls, 3 * ls, 3 * ls);
    }
  }

  scale(scale, center) {
    super.scale(scale, center);
    this.focalLength *= scale;
    return true;
  }

  checkRayIntersects(ray) {
    return this.checkRayIntersectsShape(ray);
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    var lens_length = geometry.segmentLength(this);
    var main_line_unitvector_x = (-this.p1.y + this.p2.y) / lens_length;
    var main_line_unitvector_y = (this.p1.x - this.p2.x) / lens_length;
    var mid_point = geometry.segmentMidpoint(this);

    var twoF_point_1 = geometry.point(mid_point.x + main_line_unitvector_x * 2 * this.focalLength, mid_point.y + main_line_unitvector_y * 2 * this.focalLength);  // The first point at two focal lengths
    var twoF_point_2 = geometry.point(mid_point.x - main_line_unitvector_x * 2 * this.focalLength, mid_point.y - main_line_unitvector_y * 2 * this.focalLength);  // The second point at two focal lengths

    var twoF_line_near, twoF_line_far;
    if (geometry.distanceSquared(ray.p1, twoF_point_1) < geometry.distanceSquared(ray.p1, twoF_point_2)) {
      // The first point at two focal lengths is on the same side as the ray
      twoF_line_near = geometry.parallelLineThroughPoint(this, twoF_point_1);
      twoF_line_far = geometry.parallelLineThroughPoint(this, twoF_point_2);
    } else {
      // The second point at two focal lengths is on the same side as the ray
      twoF_line_near = geometry.parallelLineThroughPoint(this, twoF_point_2);
      twoF_line_far = geometry.parallelLineThroughPoint(this, twoF_point_1);
    }

    if (this.focalLength > 0) {
      // Converging lens
      ray.p2 = geometry.linesIntersection(twoF_line_far, geometry.line(mid_point, geometry.linesIntersection(twoF_line_near, ray)));
      ray.p1 = incidentPoint;
    } else {
      // Diverging lens
      ray.p2 = geometry.linesIntersection(twoF_line_far, geometry.line(incidentPoint, geometry.linesIntersection(twoF_line_near, geometry.line(mid_point, geometry.linesIntersection(twoF_line_far, ray)))));
      ray.p1 = incidentPoint;
    }
  }
};

export default IdealLens;