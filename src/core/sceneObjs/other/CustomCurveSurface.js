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

import BaseCustomSurface from '../BaseCustomSurface.js';
import CurveObjMixin from '../CurveObjMixin.js';
import i18next from 'i18next';
import geometry from '../../geometry.js';

/**
 * A custom surface whose shape is a sequence of cubic Bezier curves. Can be
 * drawn as an open polyline (finish by double-clicking the last anchor) or a
 * closed shape (finish by clicking the first anchor).
 *
 * The incident position parameter `t` exposed to the outgoing-ray equations
 * is the natural parameter of the polyBezier: if the incident point lies at
 * local parameter `t_local` (in `[0, 1]`) of the `i`-th Bezier segment (0-
 * indexed in the order the user clicked the anchors), then the exposed
 * parameter is `t = i + t_local`. The parameter is not arc-length uniform.
 *
 * Tools -> Other -> Custom Bezier Surface
 * @class
 * @extends BaseCustomSurface
 * @memberof sceneObjs
 * @property {Array<object>} points - The anchor/control points of the Bezier curves (managed by {@link CurveObjMixin}).
 * @property {Array<object>} curves - The Bezier curves forming the surface.
 * @property {Array<object>} bboxes - Cached bounding boxes of the curves.
 * @property {boolean} notDone - Whether the user is still drawing the path.
 * @property {boolean} isClosed - Whether the curve forms a closed loop.
 * @property {Array<OutRay>} outRays - The expressions of the outgoing rays.
 * @property {boolean} twoSided - Whether the surface is two-sided.
 */
class CustomCurveSurface extends CurveObjMixin(BaseCustomSurface) {
  static type = 'CustomCurveSurface';
  static isOptical = true;
  static mergesWithGlass = true;
  static allowOpen = true;
  static serializableDefaults = {
    points: [],
    notDone: false,
    isClosed: true,
    outRays: [
      {
        eqnTheta: "\\theta_0",
        eqnP: "0.7\\cdot P_0"
      },
      {
        eqnTheta: "\\pi-\\theta_0",
        eqnP: "P_0-P_1"
      }
    ],
    twoSided: false,
  };

  static getDescription(objData, scene, detailed = false) {
    return i18next.t('main:tools.CustomCurveSurface.title');
  }

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.CustomCurveSurface.title'));
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

    const theme = this.scene.theme.customSurface;
    const color = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(theme.color);
    const baseWidth = theme.width * ls;

    if (this.twoSided) {
      ctx.strokeStyle = color;
      ctx.lineWidth = baseWidth;
      ctx.setLineDash([]);
      ctx.beginPath();
      this.tracePath(canvasRenderer);
      if (this.isClosed) ctx.closePath();
      ctx.stroke();
    } else {
      const halfWidth = baseWidth / 2;

      // The solid (reactive) side
      ctx.strokeStyle = color;
      ctx.lineWidth = halfWidth;
      ctx.setLineDash([]);
      ctx.beginPath();
      this.tracePath(canvasRenderer);
      if (this.isClosed) ctx.closePath();
      ctx.stroke();

      // The dashed (ignored) side, offset into the -normal direction to match
      // the convention used by CustomSurface (line): incident rays crossing
      // from the dashed side into the solid side are ignored.
      ctx.lineWidth = halfWidth;
      ctx.setLineDash(theme.dash.map(d => d * ls));
      ctx.beginPath();
      this.traceOffsetPath(canvasRenderer, -halfWidth);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    if (isHovered) {
      this.drawControlHandles(canvasRenderer);
    }
    ctx.lineWidth = 1;
  }

  /**
   * Build a sub-path tracing each Bezier curve offset by `offset` units along
   * its normal. Offsetting is done by sampling each curve and connecting the
   * samples with straight line segments, which is a good approximation for
   * small offsets (such as half the stroke width) and is robust for nearly
   * degenerate curves (where `Bezier#offset` can fail).
   * @param {CanvasRenderer} canvasRenderer
   * @param {number} offset
   */
  traceOffsetPath(canvasRenderer, offset) {
    const ctx = canvasRenderer.ctx;
    if (this.curves.length === 0) return;
    const samplesPerCurve = 32;
    let first = true;
    for (let c = 0; c < this.curves.length; c++) {
      const curve = this.curves[c];
      for (let k = (c === 0 ? 0 : 1); k <= samplesPerCurve; k++) {
        const t = k / samplesPerCurve;
        const p = curve.get(t);
        const n = curve.normal(t);
        const x = p.x + offset * n.x;
        const y = p.y + offset * n.y;
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
    }
    if (this.isClosed) ctx.closePath();
  }

  checkRayIntersects(ray) {
    if (this.notDone) return null;
    if (!this.curves || this.curves.length === 0) return null;

    this.countIntersections(ray.p1, ray.p2);
    if (!this.curIntersections) return null;

    // Iterate over all intersections to find the nearest one on the "active"
    // side of the surface. For one-sided surfaces an earlier (nearer)
    // intersection may be on the ignored side (e.g. on an S-shaped curve
    // where a ray first grazes the ignored-side lobe before hitting the
    // active-side lobe); those are skipped rather than causing the whole
    // object to be ignored.
    const rdx = ray.p2.x - ray.p1.x;
    const rdy = ray.p2.y - ray.p1.y;

    let bestDistSq = Infinity;
    let bestI = -1;
    let bestT = NaN;
    let bestPoint = null;

    for (let i = 0; i < this.curIntersections.curves.length; i++) {
      const ts = this.curIntersections.curves[i];
      for (let j = 0; j < ts.length; j++) {
        const t = ts[j];
        const p = this.curves[i].get(t);
        const dSq = geometry.distanceSquared(ray.p1, p);
        if (dSq >= bestDistSq) continue;

        if (!this.twoSided) {
          const tan = this.curves[i].derivative(t);
          const cross = rdx * tan.y - rdy * tan.x;
          // `cross < 0` corresponds to the rejected (outside-to-inside)
          // orientation; `cross === 0` is ill-defined (grazing).
          if (!(cross > 0)) continue;
        }

        bestDistSq = dSq;
        bestI = i;
        bestT = t;
        bestPoint = p;
      }
    }

    if (bestI < 0) return null;

    // Remember the incidence location so `onRayIncident` can compute the
    // surface normal without recomputing intersections.
    this.tmp_incidentCurve = bestI;
    this.tmp_incidentT = bestT;

    return geometry.point(bestPoint.x, bestPoint.y);
  }

  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
    const i = this.tmp_incidentCurve;
    const t = this.tmp_incidentT;

    if (typeof i !== 'number' || i < 0 || typeof t !== 'number') {
      return { isAbsorbed: true, isUndefinedBehavior: true };
    }

    // Use the bezier normal at the intersection. The returned normal has a
    // unit length and is oriented 90° CCW from the tangent direction.
    const normal = this.curves[i].normal(t);

    // The incident position uses the natural polyBezier parameter: each
    // segment contributes a unit interval of the combined parameter, so
    // `incidentPos = i + t` where `t` is the local Bezier parameter of the
    // intersection and `i` is the (zero-based) index of the segment.
    const incidentPos = i + t;

    return this.handleOutRays(ray, rayIndex, incidentPoint, normal, incidentPos, surfaceMergingObjs, ray.bodyMergingObj);
  }

  getIncidentType(ray) {
    const i = this.tmp_incidentCurve;
    const t = this.tmp_incidentT;
    if (typeof i !== 'number' || i < 0 || typeof t !== 'number') return NaN;

    const tangent = this.curves[i].derivative(t);
    const rcrosst = (ray.p2.x - ray.p1.x) * tangent.y - (ray.p2.y - ray.p1.y) * tangent.x;
    if (rcrosst > 0) return 1;
    if (rcrosst < 0) return -1;
    return NaN;
  }
}

export default CustomCurveSurface;
