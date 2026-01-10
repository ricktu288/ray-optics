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

import BaseGlass from '../BaseGlass.js';
import CircleObjMixin from '../CircleObjMixin.js';
import i18next from 'i18next';
import geometry from '../../geometry.js';

/**
 * Glass of the shape of a circle.
 * 
 * Tools -> Glass -> Circle
 * @class
 * @extends BaseGlass
 * @memberof sceneObjs
 * @property {Point} p1 - The center of the circle.
 * @property {Point} p2 - A point on the boundary of the circle.
 * @property {number} refIndex - The refractive index of the glass, or the Cauchy coefficient A of the glass if "Simulate Colors" is on.
 * @property {number} cauchyB - The Cauchy coefficient B of the glass if "Simulate Colors" is on, in micrometer squared.
 */
class CircleGlass extends CircleObjMixin(BaseGlass) {
  static type = 'CircleGlass';
  static isOptical = true;
  static mergesWithGlass = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    refIndex: 1.5,
    cauchyB: 0.004,
    partialReflect: true
  };

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:meta.parentheses', { main: i18next.t('main:tools.categories.glass'), sub: i18next.t('main:tools.CircleGlass.title') }));
    super.populateObjBar(objBar);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    ctx.beginPath();
    ctx.arc(this.p1.x, this.p1.y, geometry.segmentLength(this), 0, Math.PI * 2, false);
    this.fillGlass(canvasRenderer, isAboveLight, isHovered);
    canvasRenderer.drawPoint(this.p1, this.scene.theme.centerPoint.color, this.scene.theme.centerPoint.size);
    if (isHovered) {
      ctx.fillStyle = 'magenta';
      ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
    }
  }

  checkRayIntersects(ray) {
    return this.checkRayIntersectsShape(ray);
  }

  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
    var midpoint = geometry.segmentMidpoint(geometry.line(ray.p1, incidentPoint));
    var d = geometry.distanceSquared(this.p1, this.p2) - geometry.distanceSquared(this.p1, midpoint);
    if (d > 0) {
      // From inside to outside
      var n1 = this.getRefIndexAt(incidentPoint, ray);
      var normal = { x: this.p1.x - incidentPoint.x, y: this.p1.y - incidentPoint.y };
    } else if (d < 0) {
      // From outside to inside
      var n1 = 1 / this.getRefIndexAt(incidentPoint, ray);
      var normal = { x: incidentPoint.x - this.p1.x, y: incidentPoint.y - this.p1.y };
    } else {
      // Situation that may cause bugs (e.g. incident on an edge point)
      // To prevent shooting the ray to a wrong direction, absorb the ray
      return {
        isAbsorbed: true,
        isUndefinedBehavior: true
      };
    }

    return this.refract(ray, rayIndex, incidentPoint, normal, n1, surfaceMergingObjs, ray.bodyMergingObj);
  }

  getIncidentType(ray) {
    var midpoint = geometry.segmentMidpoint(geometry.line(ray.p1, this.checkRayIntersects(ray)));
    var d = geometry.distanceSquared(this.p1, this.p2) - geometry.distanceSquared(this.p1, midpoint);
    if (d > 0) {
      return 1; // From inside to outside
    }
    if (d < 0) {
      return -1; // From outside to inside
    }
    return NaN;
  }
};

export default CircleGlass;
