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

import BaseFilter from '../BaseFilter.js';
import CurveObjMixin from '../CurveObjMixin.js';
import i18next from 'i18next';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';

/**
 * Mirror whose shape is a sequence of cubic Bezier curves. Can be drawn as an
 * open polyline (finish by double-clicking the last anchor) or a closed shape
 * (finish by clicking the first anchor, as with CurveGlass).
 *
 * Tools -> Mirror -> Bezier Curves
 * @class
 * @extends BaseFilter
 * @memberof sceneObjs
 * @property {Array<object>} path - The polyline path used during construction.
 * @property {Array<object>} curves - The Bezier curves forming the mirror surface.
 * @property {Array<object>} bboxes - Cached bounding boxes of the curves.
 * @property {boolean} notDone - Whether the user is still drawing the path.
 * @property {boolean} isClosed - Whether the curve forms a closed loop.
 * @property {boolean} filter - Whether it is a dichroic mirror.
 * @property {boolean} invert - If true, rays outside the bandwidth are reflected.
 * @property {number} wavelength - The target wavelength if dichroic is enabled, in nm.
 * @property {number} bandwidth - The bandwidth if dichroic is enabled, in nm.
 */
class CurveMirror extends CurveObjMixin(BaseFilter) {
  static type = 'CurveMirror';
  static isOptical = true;
  static mergesWithGlass = true;
  static allowOpen = true;
  static serializableDefaults = {
    points: [],
    notDone: false,
    isClosed: true,
    filter: false,
    invert: false,
    wavelength: Simulator.GREEN_WAVELENGTH,
    bandwidth: 10
  }

  static getDescription(objData, scene, detailed = false) {
    return i18next.t('main:meta.parentheses', { main: i18next.t('main:tools.categories.mirror'), sub: i18next.t('main:tools.CurveMirror.title') });
  }

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:meta.parentheses', { main: i18next.t('main:tools.categories.mirror'), sub: i18next.t('main:tools.CurveMirror.title') }));
    super.populateObjBar(objBar);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    if (this.notDone) {
      this.drawConstruction(canvasRenderer);
      ctx.lineWidth = 1;
      return;
    }

    if (this.curves.length === 0) {
      ctx.lineWidth = 1;
      return;
    }

    const colorArray = this.scene.simulator.wavelengthToColor(this.wavelength || Simulator.GREEN_WAVELENGTH, 1);
    ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.simulateColors && this.wavelength && this.filter ? colorArray : this.scene.theme.mirror.color);
    ctx.lineWidth = this.scene.theme.mirror.width * ls;

    ctx.beginPath();
    this.tracePath(canvasRenderer);
    if (this.isClosed) {
      ctx.closePath();
    }
    ctx.stroke();

    if (isHovered) {
      this.drawControlHandles(canvasRenderer);
    }
    ctx.lineWidth = 1;
  }

  checkRayIntersects(ray) {
    if (this.notDone) return;
    if (!this.checkRayIntersectFilter(ray)) return;
    if (!this.curves || this.curves.length === 0) return;

    this.countIntersections(ray.p1, ray.p2);
    const shortest = this.curIntersections && this.curIntersections.shortest;
    if (shortest && shortest.i > -1 && shortest.j > -1) {
      const s_point = this.curves[shortest.i].get(this.curIntersections.curves[shortest.i][shortest.j]);
      // Remember the incidence location so `onRayIncident` can compute the
      // surface normal without recomputing intersections.
      this.tmp_incidentCurve = shortest.i;
      this.tmp_incidentT = this.curIntersections.curves[shortest.i][shortest.j];
      return geometry.point(s_point.x, s_point.y);
    }
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    // Compute the reflection direction using the surface normal at the
    // intersection point. BezierJS returns the normal on a fixed side, so we
    // flip it to point against the incoming ray direction.
    const i = this.tmp_incidentCurve;
    const t = this.tmp_incidentT;

    if (typeof i !== 'number' || i < 0 || typeof t !== 'number') {
      return { isAbsorbed: true, isUndefinedBehavior: true };
    }

    let normal = this.curves[i].normal(t);
    let nx = normal.x;
    let ny = normal.y;
    // Ensure the normal faces the incoming ray.
    if (nx * (ray.p2.x - ray.p1.x) + ny * (ray.p2.y - ray.p1.y) > 0) {
      nx = -nx;
      ny = -ny;
    }

    // Reflect the ray direction (ray.p1 -> ray.p2) about the normal at the
    // incidence point: d' = d - 2 (d . n) n, with n a unit vector.
    const dx = ray.p2.x - ray.p1.x;
    const dy = ray.p2.y - ray.p1.y;
    const dDotN = dx * nx + dy * ny;
    const rx = dx - 2 * dDotN * nx;
    const ry = dy - 2 * dDotN * ny;

    ray.p1 = incidentPoint;
    ray.p2 = geometry.point(incidentPoint.x + rx, incidentPoint.y + ry);
  }
};

export default CurveMirror;
