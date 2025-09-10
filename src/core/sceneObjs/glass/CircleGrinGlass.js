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

import BaseGrinGlass from '../BaseGrinGlass.js';
import CircleObjMixin from '../CircleObjMixin.js';
import i18next from 'i18next';
import geometry from '../../geometry.js';

/**
 * Gradient-index glass of the shape of a circle.
 * 
 * Tools -> Glass -> GRIN Circle
 * @class
 * @extends BaseGrinGlass
 * @memberof sceneObjs
 * @property {Point} p1 - The center of the circle.
 * @property {Point} p2 - A point on the boundary of the circle.
 * @property {string} refIndexFn - The refractive index function in x and y in LaTeX format.
 * @property {Point} origin - The origin of the (x,y) coordinates used in the refractive index function.
 * @property {number} stepSize - The step size for the ray trajectory equation.
 * @property {number} intersectTol - The epsilon for the intersection calculations.
 */
class CircleGrinGlass extends CircleObjMixin(BaseGrinGlass) {
  static type = 'CircleGrinGlass';
  static isOptical = true;
  static mergesWithGlass = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    refIndexFn: '1+e^{-\\frac{x^2+y^2}{50^2}}',
    absorptionFn: '0',
    origin: { x: 0, y: 0 },
    stepSize: 1,
    intersectTol: 1e-3
  };

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.CircleGrinGlass.title'));
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

  move(diffX, diffY) {
    super.move(diffX, diffY);
    return false; // By the current design the origin is not moved. This may need to be changed in the future.
  }

  rotate(angle, center) {
    super.rotate(angle, center);
    return false; // By the current design the origin is not moved. This may need to be changed in the future.
  }

  scale(scale, center) {
    super.scale(scale, center);
    return false; // By the current design the origin is not moved. This may need to be changed in the future.
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    super.onConstructMouseDown(mouse, ctrl, shift);
    this.origin = geometry.point(this.p1.x, this.p1.y);
    this.initFns();
  }

  checkRayIntersects(ray) {
    if (this.notDone) { return; }
    if (!this.fn_p) {
      this.initFns();
    }
    if (this.isInsideGlass(ray.p1) || this.isOnBoundary(ray.p1)) // if the first point of the ray is inside the circle, or on its boundary
    {
      let len = geometry.distance(ray.p1, ray.p2);
      let x = ray.p1.x + (this.stepSize / len) * (ray.p2.x - ray.p1.x);
      let y = ray.p1.y + (this.stepSize / len) * (ray.p2.y - ray.p1.y);
      const intersection_point = geometry.point(x, y);
      if (this.isInsideGlass(intersection_point)) // if intersection_point is inside the circle
        return intersection_point;
    }
    return this.checkRayIntersectsShape(ray);
  }

  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
    if (!this.fn_p) {
      // This means that some error has been occuring eariler in parsing the equation.
      return {
        isAbsorbed: true
      };
    }
    try {
      this.error = null;

      if ((this.isInsideGlass(ray.p1) || this.isOutsideGlass(ray.p1)) && this.isOnBoundary(incidentPoint)) // if the ray is hitting the circle from the outside, or from the inside (meaning that the point incidentPoint is on the boundary of the circle, and the point ray.p1 is inside/outside the circle)
      {
        let r_bodyMerging_obj = ray.bodyMergingObj; // save the current bodyMergingObj of the ray, to pass it later to the reflected ray in the 'refract' function

        var midpoint = geometry.segmentMidpoint(geometry.line(ray.p1, incidentPoint));
        var d = geometry.distanceSquared(this.p1, this.p2) - geometry.distanceSquared(this.p1, midpoint);
        if (d > 0) {
          // From inside to outside
          var n1 = this.getRefIndexAt(incidentPoint, ray);
          var normal = { x: this.p1.x - incidentPoint.x, y: this.p1.y - incidentPoint.y };
          this.onRayExit(ray);
        } else if (d < 0) {
          // From outside to inside
          var n1 = 1 / this.getRefIndexAt(incidentPoint, ray);
          var normal = { x: incidentPoint.x - this.p1.x, y: incidentPoint.y - this.p1.y };
          this.onRayEnter(ray);
        } else {
          // The situation that may cause bugs (e.g. incident on an edge point)
          // To prevent shooting the ray to a wrong direction, absorb the ray
          return {
            isAbsorbed: true,
            isUndefinedBehavior: true
          };
        }
        return this.refract(ray, rayIndex, incidentPoint, normal, n1, surfaceMergingObjs, r_bodyMerging_obj);
      } else {
        if (ray.bodyMergingObj === undefined)
          ray.bodyMergingObj = this.initRefIndex(ray); // Initialize the bodyMerging object of the ray
        const next_point = this.step(ray.p1, incidentPoint, ray);
        ray.p1 = incidentPoint;
        ray.p2 = next_point;
      }
    } catch (e) {
      this.error = e.toString();
      return {
        isAbsorbed: true
      };
    }
  }

  getIncidentType(ray) {
    var midpoint = geometry.segmentMidpoint(geometry.line(ray.p1, this.checkRayIntersectsShape(ray)));
    var d = geometry.distanceSquared(this.p1, this.p2) - geometry.distanceSquared(this.p1, midpoint);
    if (d > 0) {
      return 1; // From inside to outside
    }
    if (d < 0) {
      return -1; // From outside to inside
    }
    return NaN;
  }

  isOutsideGlass(point) {
    const R_squared = geometry.distanceSquared(this.p1, this.p2);
    return (geometry.distanceSquared(this.p1, point) - R_squared - this.intersectTol > 0 && geometry.distanceSquared(this.p1, point) - R_squared + this.intersectTol > 0);
  }

  isInsideGlass(point) {
    const R_squared = geometry.distanceSquared(this.p1, this.p2);
    return (geometry.distanceSquared(this.p1, point) - R_squared - this.intersectTol < 0 && geometry.distanceSquared(this.p1, point) - R_squared + this.intersectTol < 0);
  }

  isOnBoundary(point) {
    const R_squared = geometry.distanceSquared(this.p1, this.p2);
    return (geometry.distanceSquared(this.p1, point) - R_squared - this.intersectTol < 0 && geometry.distanceSquared(this.p1, point) - R_squared + this.intersectTol > 0);
  }
};

export default CircleGrinGlass;