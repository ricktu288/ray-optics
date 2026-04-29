/*
 * Copyright 2025 The Ray Optics Simulation authors and contributors
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
import CurveObjMixin from '../CurveObjMixin.js';
import i18next from 'i18next';
import geometry from '../../geometry.js';

/**
 * Gradient-index glass of the shape consists of Bezier curves.
 * 
 * Tools -> Glass -> GRIN Bezier Curves
 * @class
 * @extends BaseGrinGlass
 * @memberof sceneObjs
 * @property {Array<object>} path - The polyline path used during construction. Each element is an object with `x` and `y` properties for coordinates.
 * @property {Array<object>} curves - The Bezier curves forming the boundary. Each element is a `Bezier` object whose points (a_1, c_1, c_2, a_2) may be acquired via `object_name.points`.
 * @property {Array<object>} bboxes - Cached bounding boxes of the curves.
 * @property {Array<object>} curIntersections - Most recent intersections calculated in `countIntersections` for each curve.
 * @property {boolean} notDone - Whether the user is still drawing the path of the glass.
 * @property {string} refIndexFn - The refractive index function in x and y in LaTeX format.
 * @property {Point} origin - The origin of the (x,y) coordinates used in the refractive index function.
 * @property {number} stepSize - The step size for the ray trajectory equation.
 * @property {number} intersectTol - Tolerance for intersection calculations (unit: pixels).
 */
class CurveGrinGlass extends CurveObjMixin(BaseGrinGlass) {
  static type = 'CurveGrinGlass';
  static isOptical = true;
  static mergesWithGlass = true;
  static serializableDefaults = {
    points: [],
    notDone: false,
    refIndexFn: '1.1+0.1\\cdot\\cos\\left(0.1\\cdot y\\right)',
    absorptionFn: '0',
    plotFns: false,
    origin: { x: 0, y: 0 },
    stepSize: 1,
    intersectTol: 5e-2,
    partialReflect: true
  }

  static getDescription(objData, scene, detailed = false) {
    return i18next.t('main:tools.CurveGrinGlass.title');
  }

  static getPropertySchema(objData, scene) {
    const schema = super.getPropertySchema(objData, scene);
    // Insert the coordinate-origin descriptor right after the `points` array
    // entry that the mixin contributes, mirroring the legacy ordering.
    schema.splice(1, 0, { key: 'origin', type: 'point', label: i18next.t('simulator:sceneObjs.common.coordOrigin') });
    return schema;
  }

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.CurveGrinGlass.title'));
    super.populateObjBar(objBar);
  }

  // The GRIN crossing-number test does NOT need RNG jitter because this class
  // uses a deterministic (but irrational) offset; override countIntersections
  // for the p4-omitted branch to preserve historical behavior exactly.
  countIntersections(p3, p4) {
    if (typeof p4 !== "undefined") {
      return super.countIntersections(p3, p4);
    }
    let cnt = 0;
    let minX = Infinity;
    for (let i = 0; i < this.bboxes.length; i++) {
      if (this.bboxes[i].x.min < minX) {
        minX = this.bboxes[i].x.min;
      }
    }
    const outsidePoint = { x: minX - 1.23456789, y: p3.y + 1.23456789 };
    for (let i = 0; i < this.curves.length; i++) {
      cnt += this.curves[i].lineIntersects(geometry.line(geometry.point(p3.x, p3.y), outsidePoint)).length;
    }
    return cnt;
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;

    if (this.notDone) {
      this.drawConstruction(canvasRenderer);
    } else {
      ctx.beginPath();
      this.tracePath(canvasRenderer);
      this.fillGlass(canvasRenderer, isAboveLight, isHovered);

      if (isHovered) {
        this.drawControlHandles(canvasRenderer);
      }
    }
    ctx.lineWidth = 1;
  }

  getGrinFillBounds() {
    if (!this.bboxes || this.bboxes.length === 0) {
      return null;
    }

    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;

    for (const bbox of this.bboxes) {
      xMin = Math.min(xMin, bbox.x.min);
      xMax = Math.max(xMax, bbox.x.max);
      yMin = Math.min(yMin, bbox.y.min);
      yMax = Math.max(yMax, bbox.y.max);
    }

    return { xMin, xMax, yMin, yMax };
  }

  drawGrinRegionPath(ctx) {
    if (!this.curves || this.curves.length === 0) {
      return;
    }
    const first = this.curves[0].points[0];
    ctx.moveTo(first.x, first.y);
    for (const curve of this.curves) {
      const p = curve.points;
      ctx.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y);
    }
    ctx.closePath();
  }

  move(diffX, diffY) {
    super.move(diffX, diffY);
    return false;
  }

  rotate(angle, center) {
    super.rotate(angle, center);
    return false;
  }

  scale(scale, center) {
    super.scale(scale, center);
    return false;
  }

  checkRayIntersects(ray) {
    if (!this.fn_p) {
      this.initFns();
    }
    if (this.notDone) { return; }
    if (this.isInsideGlass(ray.p1) || this.isOnBoundary(ray.p1)) {
      this.rayLen = geometry.distance(ray.p1, ray.p2);
      let x = ray.p1.x + (this.stepSize / this.rayLen) * (ray.p2.x - ray.p1.x);
      let y = ray.p1.y + (this.stepSize / this.rayLen) * (ray.p2.y - ray.p1.y);
      const intersection_point = geometry.point(x, y);
      if (this.isInsideGlass(intersection_point))
        return intersection_point;
    }

    this.countIntersections(ray.p1, ray.p2);
    if (this.curIntersections.shortest.i > -1 && this.curIntersections.shortest.j > -1) {
      const s_point = this.curves[this.curIntersections.shortest.i].get(this.curIntersections.curves[this.curIntersections.shortest.i][this.curIntersections.shortest.j]);
      return geometry.point(s_point.x, s_point.y);
    }
  }

  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
    if (!this.fn_p) {
      this.initFns();
      return { isAbsorbed: true };
    }
    this.error = null;
    try {
      var incidentData = this.getIncidentData(ray);
      if ((this.isInsideGlass(ray.p1) || this.isOutsideGlass(ray.p1)) && this.isOnBoundary(incidentPoint)) {
        let r_bodyMerging_obj = ray.bodyMergingObj;

        var incidentType = incidentData.incidentType;

        if (incidentType === 1) {
          var n1 = this.getRefIndexAt(incidentData.s_point, ray);
          this.onRayExit(ray);
        } else if (incidentType === -1) {
          var n1 = 1 / this.getRefIndexAt(incidentData.s_point, ray);
          this.onRayEnter(ray);
        } else if (incidentType === 0) {
          var n1 = 1;
        } else {
          return {
            isAbsorbed: true,
            isUndefinedBehavior: true
          };
        }
        return this.refract(ray, rayIndex, incidentData.s_point, incidentData.normal, n1, surfaceMergingObjs, r_bodyMerging_obj);
      } else {
        if (ray.bodyMergingObj === undefined)
          ray.bodyMergingObj = this.initRefIndex(ray);
        const next_point = this.step(ray.p1, incidentPoint, ray);
        ray.p1 = incidentPoint;
        ray.p2 = next_point;
      }
    } catch (e) {
      this.error = e.toString();
      return { isAbsorbed: true };
    }
  }

  getIncidentType(ray) {
    return this.getIncidentData(ray).incidentType;
  }

  isOutsideGlass(point, point2) {
    return (!(!point2 && this.isOnBoundary(point)) && this.countIntersections(point, point2) % 2 === 0);
  }

  isInsideGlass(point, point2) {
    return (!(!point2 && this.isOnBoundary(point)) && this.countIntersections(point, point2) % 2 === 1);
  }

  isOnBoundary(p3) {
    for (let i = 0; i < this.curves.length; i++) {
      if (p3.x <= this.bboxes[i].x.max && p3.x >= this.bboxes[i].x.min || p3.y <= this.bboxes[i].y.max && p3.y >= this.bboxes[i].y.min) {
        const proj = this.curves[i].project({ x: p3.x, y: p3.y }).d;
        if (Math.pow(proj, 2) <= this.intersectTol) {
          return true;
        }
      }
    }
    return false;
  }

  /* Utility methods */

  getIncidentData(ray) {
    var incidentType;
    if (this.isInsideGlass(ray.p1, ray.p2)) {
      incidentType = 1;
    } else {
      incidentType = -1;
    }

    if (this.curIntersections.shortest.i === -1) {
      return {
        s_point: null,
        normal: { x: NaN, y: NaN },
        incidentType: 0
      };
    }

    const i = this.curIntersections.shortest.i;
    const j = this.curIntersections.shortest.j;
    var s_point = this.curves[i].get(this.curIntersections.curves[i][j]);
    s_point.t = this.curIntersections.curves[i][j];

    // Handle the case where the entire ray stays within the lens bounds.
    let len = geometry.distance(ray.p1, ray.p2);
    if (incidentType === 1 && Math.pow(len, 2) < this.curIntersections.shortest.val && this.isInsideGlass(ray.p2)) {
      return {
        s_point: geometry.point(ray.p1.x + (this.stepSize / len) * (ray.p2.x - ray.p1.x), ray.p1.y + (this.stepSize / len) * (ray.p2.y - ray.p1.y)),
        normal: { x: NaN, y: NaN },
        incidentType: 2
      };
    }

    var normal = this.curves[i].normal(s_point.t);
    normal = geometry.point(normal.x, normal.y);

    // Reorient the normal if needed to ensure it points against the ray.
    if (normal.x * (ray.p2.x - ray.p1.x) + normal.y * (ray.p2.y - ray.p1.y) > 0) {
      normal.x = -normal.x;
      normal.y = -normal.y;
    }

    return {
      s_point: geometry.point(s_point.x, s_point.y),
      normal: geometry.point(normal.x, normal.y),
      incidentType: incidentType
    };
  }
};

export default CurveGrinGlass;
