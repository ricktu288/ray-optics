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

import BaseGlass from '../BaseGlass.js';
import CurveObjMixin from '../CurveObjMixin.js';
import i18next from 'i18next';
import geometry from '../../geometry.js';

/**
 * Glass of the shape consists of Bezier curves.
 * 
 * Tools -> Glass -> Bezier Curves
 * @class
 * @extends BaseGlass
 * @memberof sceneObjs
 * @property {Array<object>} path - The polyline path used during construction. Each element is an object with `x` and `y` properties for coordinates.
 * @property {Array<object>} curves - The Bezier curves forming the boundary. Each element is a `Bezier` object whose points (a_1, c_1, c_2, a_2) may be acquired via `object_name.points`. Any modification to these points requires creation of a new `Bezier` object defined by those points.
 * @property {Array<object>} bboxes - Cached bounding boxes of the curves.
 * @property {boolean} notDone - Whether the user is still drawing the path of the glass.
 * @property {number} refIndex - The refractive index of the glass, or the Cauchy coefficient A of the glass if "Simulate Colors" is on.
 * @property {number} cauchyB - The Cauchy coefficient B of the glass if "Simulate Colors" is on, in micrometer squared.
 */
class CurveGlass extends CurveObjMixin(BaseGlass) {
  static type = 'CurveGlass';
  static isOptical = true;
  static mergesWithGlass = true;
  static serializableDefaults = {
    points: [],
    notDone: false,
    refIndex: 1.5,
    cauchyB: 0.004,
    partialReflect: true
  }

  static getDescription(objData, scene, detailed = false) {
    return i18next.t('main:meta.parentheses', { main: i18next.t('main:tools.categories.glass'), sub: i18next.t('main:tools.CurveGlass.title') });
  }

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:meta.parentheses', { main: i18next.t('main:tools.categories.glass'), sub: i18next.t('main:tools.CurveGlass.title') }));
    super.populateObjBar(objBar);
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

  checkRayIntersects(ray) {
    if (this.notDone) return;
    this.countIntersections(ray.p1, ray.p2);
    if (this.curIntersections.shortest.i > -1 && this.curIntersections.shortest.j > -1) {
      return this.curves[this.curIntersections.shortest.i].get(this.curIntersections.curves[this.curIntersections.shortest.i][this.curIntersections.shortest.j]);
    }
  }

  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
    try {
      this.error = null;
      var incidentData = this.getIncidentData(ray);
      var incidentType = incidentData.incidentType;
      if (incidentType == 1) {
        // From inside to outside
        var n1 = this.getRefIndexAt(incidentPoint, ray);
      } else if (incidentType == -1) {
        // From outside to inside
        var n1 = 1 / this.getRefIndexAt(incidentPoint, ray);
      } else if (incidentType == 0) {
        // Equivalent to not intersecting with the object (e.g. two interfaces overlap)
        var n1 = 1;
      } else {
        // Potentially buggy situation (e.g. incident on an edge point). Absorb
        // the ray so we don't send it in a wrong direction.
        return {
          isAbsorbed: true,
          isUndefinedBehavior: true
        };
      }
      return this.refract(ray, rayIndex, incidentData.s_point, incidentData.normal, n1, surfaceMergingObjs, ray.bodyMergingObj);
    } catch (e) {
      this.error = e.toString();
      console.log(this.error);
      return {
        isAbsorbed: true,
      };
    }
  }

  getIncidentType(ray) {
    return this.getIncidentData(ray).incidentType;
  }

  isInsideGlass(point, point2) {
    return this.countIntersections(point, point2) % 2 == 1;
  }

  /* Utility methods */

  getIncidentData(ray) {
    if (this.isInsideGlass(ray.p1, ray.p2)) {
      var incidentType = 1; // Inside to outside
    } else {
      var incidentType = -1; // Outside to inside
    }

    const i = this.curIntersections.shortest.i;
    const j = this.curIntersections.shortest.j;
    var s_point = this.curves[i].get(this.curIntersections.curves[i][j]);
    s_point.t = this.curIntersections.curves[i][j];

    var normal = this.curves[i].normal(s_point.t);
    normal = geometry.point(normal.x, normal.y);

    // Reorient the normal if needed to ensure it points against the ray. This
    // is necessary because BezierJS returns normals on a fixed side, regardless
    // of the ray direction.
    if (normal.x * (ray.p2.x - ray.p1.x) + normal.y * (ray.p2.y - ray.p1.y) > 0) {
      normal.x = -normal.x;
      normal.y = -normal.y;
    }

    return { s_point: s_point, normal: geometry.point(normal.x, normal.y), incidentType: incidentType };
  }
};

export default CurveGlass;
