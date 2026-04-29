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
import LineObjMixin from '../LineObjMixin.js';
import i18next from 'i18next';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';
import { evaluateLatex } from '../../equation.js';
import { equationValueForListDisplay } from '../../propertyUtils/equationConversion.js';
import escapeHtml from 'escape-html';
import { Bezier } from 'bezier-js';
import { parseTex } from 'tex-math-parser';
import * as math from 'mathjs';
import { curveTypePropertyInfoHtml } from '../ParamCurveObjMixin.js';

function compileEquationDerivative(eqnLatex) {
  const p = parseTex(eqnLatex).toString().replaceAll('\\cdot', '*').replaceAll('\\frac', '/');
  const p_der = math.derivative(p, 'x').toString();
  const p_der_tex = math.parse(p_der).toTex()
    .replaceAll('{+', '{')
    .replaceAll('\\mathrm{x}', 'x');
  return evaluateLatex(p_der_tex);
}

/**
 * Glass defined by a custom inequality.
 * 
 * Tools -> Glass -> Custom equation
 * @class
 * @extends BaseGlass
 * @memberof sceneObjs
 * @property {Point} p1 - The point corresponding to (-1,0) in the coordinate system of the equation.
 * @property {Point} p2 - The point corresponding to (1,0) in the coordinate system of the equation.
 * @property {string} eqn1 - The equation of the surface with smaller y. The variable is x.
 * @property {string} eqn2 - The equation of the surface with larger y. The variable is x.
 * @property {number} refIndex - The refractive index of the glass, or the Cauchy coefficient A of the glass if "Simulate Colors" is on.
 * @property {number} cauchyB - The Cauchy coefficient B of the glass if "Simulate Colors" is on, in micrometer squared.
 * @property {Array<Point>} path - The points on the calculated curve.
 * @property {number} tmp_i - The index of the point on the curve where the ray is incident.
 */
class CustomGlass extends LineObjMixin(BaseGlass) {
  static type = 'CustomGlass';
  static isOptical = true;
  static mergesWithGlass = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    eqn1: "0",
    eqn2: "0.5\\cdot\\sqrt{1-x^2}",
    curveStepSize: 0.1000001,
    curveType: 'smoothNormal',
    refIndex: 1.5,
    cauchyB: 0.004,
    partialReflect: true
  };

  static getDescription(objData, scene, detailed = false) {
    const base = i18next.t('main:tools.categories.glass');
    if (!detailed) {
      return i18next.t('main:meta.parentheses', { main: base, sub: i18next.t('main:tools.CustomGlass.title') });
    }
    const eqn1 = objData?.eqn1 ?? '';
    const eqn2 = objData?.eqn2 ?? '';
    const parts = [eqn1, eqn2].filter(Boolean).map((v) => escapeHtml(equationValueForListDisplay(v)));
    return parts.length ? i18next.t('main:meta.colon', { name: base, value: '<span style="font-family: monospace">' + parts.join(', ') + '</span>' }) : base;
  }

  static getPropertySchema(objData, scene) {
    const info = '<ul><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.mathjs') + '<br><code>+ - * / ^ sqrt sin cos tan sec csc cot sinh cosh tanh log exp asin acos atan asinh acosh atanh floor round ceil max min abs sign</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.customFunctions') + '</li></ul>';
    const curveTypeOptions = {
      polygonal: i18next.t('simulator:sceneObjs.ParamCurveObjMixin.curveTypes.polygonal'),
      smoothNormal: i18next.t('simulator:sceneObjs.ParamCurveObjMixin.curveTypes.smoothNormal'),
      cubicBezier: i18next.t('simulator:sceneObjs.ParamCurveObjMixin.curveTypes.cubicBezier'),
    };
    return [
      ...super.getPropertySchema(objData, scene),
      { key: 'eqn1', type: 'equation', label: 'f(x)', variables: ['x'], info: info },
      { key: 'eqn2', type: 'equation', label: 'g(x)', variables: ['x'], info: info },
      {
        key: 'curveType',
        type: 'dropdown',
        label: i18next.t('simulator:sceneObjs.ParamCurveObjMixin.curveType'),
        options: curveTypeOptions,
        info: curveTypePropertyInfoHtml(),
      },
      {
        key: 'curveStepSize',
        type: 'number',
        label: i18next.t('simulator:sceneObjs.common.curveStepSize') + ' (px)' + ' <sup class="beta-label-sup">Beta</sup>',
        info: '<p>' + i18next.t('simulator:sceneObjs.common.eqnInfo.curveStepSize') + '</p>',
      },
    ];
  }

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.categories.glass'));
    objBar.createEquation('', this.eqn1, function (obj, value) {
      obj.eqn1 = value;
      // Invalidate path when equation changes
      delete obj.path;
    }, '<ul><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.constants') + '<br><code>pi e</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.operators') + '<br><code>+ - * / ^</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.functions') + '<br><code>sqrt sin cos tan sec csc cot sinh cosh tanh log exp arcsin arccos arctan arcsinh arccosh arctanh floor round ceil trunc sgn max min abs</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.module') + '</li></ul>');
    objBar.createEquation(' < y < ', this.eqn2, function (obj, value) {
      obj.eqn2 = value;
      // Invalidate path when equation changes
      delete obj.path;
    });

    if (objBar.showAdvanced(!this.arePropertiesDefault(['curveType']))) {
      const curveTypeOptions = {
        polygonal: i18next.t('simulator:sceneObjs.ParamCurveObjMixin.curveTypes.polygonal'),
        smoothNormal: i18next.t('simulator:sceneObjs.ParamCurveObjMixin.curveTypes.smoothNormal'),
        cubicBezier: i18next.t('simulator:sceneObjs.ParamCurveObjMixin.curveTypes.cubicBezier'),
      };
      objBar.createDropdown(i18next.t('simulator:sceneObjs.ParamCurveObjMixin.curveType'), this.curveType, curveTypeOptions, function (obj, value) {
        obj.curveType = value;
        delete obj.path;
        delete obj.bezierSegments;
        delete obj.bezierSegmentLinearFlags;
      }, curveTypePropertyInfoHtml(), true);
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['curveStepSize']))) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.common.curveStepSize') + ' (px)' + ' <sup class="beta-label-sup">Beta</sup>', 0.001, 1, 0.001, this.curveStepSize, function (obj, value) {
        obj.curveStepSize = parseFloat(value);
        delete obj.path;
        delete obj.bezierSegments;
        delete obj.bezierSegmentLinearFlags;
      }, '<p>' + i18next.t('simulator:sceneObjs.common.eqnInfo.curveStepSize') + '</p>', true);
    }

    super.populateObjBar(objBar);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
      ctx.fillStyle = 'rgb(128,128,128)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      return;
    }

    this._invalidateCurveIfLengthScaleChanged();
    
    if (isAboveLight) {
      if (this.path) {
        this.drawGlass(canvasRenderer, isAboveLight, isHovered);
      }
      return;
    }

    // Initialize path if needed
    if (!this.path) {
      if (!this.initPath()) {
        // If initialization failed, draw error indicators
        ctx.fillStyle = "red";
        ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
        ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
        return;
      }
    }

    if (isHovered) {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
    }

    this.drawGlass(canvasRenderer, isAboveLight, isHovered);

    this.error = null;
  }

  move(diffX, diffY) {
    super.move(diffX, diffY);
    // Invalidate path after moving
    delete this.path;
    delete this.bezierSegments;
    delete this.bezierSegmentLinearFlags;
    return true;
  }

  rotate(angle, center = null) {
    super.rotate(angle, center);
    // Invalidate path after rotating
    delete this.path;
    delete this.bezierSegments;
    delete this.bezierSegmentLinearFlags;
    return true;
  }

  scale(scale, center = null) {
    super.scale(scale, center);
    // Invalidate path after scaling
    delete this.path;
    delete this.bezierSegments;
    delete this.bezierSegmentLinearFlags;
    return true;
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    super.onConstructMouseDown(mouse, ctrl, shift);
    // Invalidate path during construction
    delete this.path;
    delete this.bezierSegments;
    delete this.bezierSegmentLinearFlags;
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    super.onConstructMouseMove(mouse, ctrl, shift);
    // Invalidate path during construction
    delete this.path;
    delete this.bezierSegments;
    delete this.bezierSegmentLinearFlags;
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    const result = super.onConstructMouseUp(mouse, ctrl, shift);
    // Invalidate path after construction
    delete this.path;
    delete this.bezierSegments;
    delete this.bezierSegmentLinearFlags;
    return result;
  }

  checkMouseOver(mouse) {
    let dragContext = {};
    if (mouse.isOnPoint(this.p1) && geometry.distanceSquared(mouse.pos, this.p1) <= geometry.distanceSquared(mouse.pos, this.p2)) {
      dragContext.part = 1;
      dragContext.targetPoint = geometry.point(this.p1.x, this.p1.y);
      return dragContext;
    }
    if (mouse.isOnPoint(this.p2)) {
      dragContext.part = 2;
      dragContext.targetPoint = geometry.point(this.p2.x, this.p2.y);
      return dragContext;
    }

    this._invalidateCurveIfLengthScaleChanged();

    // Initialize path if needed
    if (!this.path) {
      if (!this.initPath()) {
        return null;
      }
    }

    if (this.curveType === 'cubicBezier' && this._ensureBezierPathReady()) {
      for (let i = 0; i < this.bezierSegments.length; i++) {
        const isLinearBoundary = this.bezierSegmentLinearFlags?.[i];
        const isHit = isLinearBoundary
          ? mouse.isOnSegment(geometry.line(this.path[i], this.path[i + 1]))
          : mouse.isOnCurve(this.bezierSegments[i]);
        if (isHit) {
          const mousePos = mouse.getPosSnappedToGrid();
          dragContext.part = 0;
          dragContext.mousePos0 = mousePos;
          dragContext.mousePos1 = mousePos;
          dragContext.snapContext = {};
          return dragContext;
        }
      }
    } else {
      for (let i = 0; i < this.path.length - 1; i++) {
        if (mouse.isOnSegment(geometry.line(this.path[i], this.path[(i + 1) % this.path.length]))) {
          const mousePos = mouse.getPosSnappedToGrid();
          dragContext.part = 0;
          dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
          dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
          dragContext.snapContext = {};
          return dragContext;
        }
      }
    }
    return null;
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    super.onDrag(mouse, dragContext, ctrl, shift);
    // Invalidate path after any dragging operation
    delete this.path;
    delete this.bezierSegments;
    delete this.bezierSegmentLinearFlags;
  }

  checkRayIntersects(ray) {
    this._invalidateCurveIfLengthScaleChanged();

    // Initialize path if needed
    if (!this.path) {
      if (!this.initPath()) {
        return null;
      }
    }

    if (this.curveType === 'cubicBezier' && this._ensureBezierPathReady()) {
      return this.checkRayIntersectsBezier(ray);
    }
    return this.checkRayIntersectsLinear(ray);
  }

  checkRayIntersectsLinear(ray) {
    var s_lensq = Infinity;
    var s_lensq_temp;
    var s_point = null;
    var s_point_temp = null;
    var s_point_index = -1;
    for (var i = 0; i < this.path.length; i++) {
      s_point_temp = null;
      var rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(this.path[i % this.path.length], this.path[(i + 1) % this.path.length]));
      if (geometry.intersectionIsOnSegment(rp_temp, geometry.line(this.path[i % this.path.length], this.path[(i + 1) % this.path.length])) && geometry.intersectionIsOnRay(rp_temp, ray) && geometry.distanceSquared(ray.p1, rp_temp) > Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale) {
        s_lensq_temp = geometry.distanceSquared(ray.p1, rp_temp);
        s_point_temp = rp_temp;
      }
      if (s_point_temp) {
        if (s_point && geometry.distanceSquared(s_point_temp, s_point) < Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale && s_point_index != i - 1) {
          return null;
        } else if (s_lensq_temp < s_lensq) {
          s_lensq = s_lensq_temp;
          s_point = s_point_temp;
          s_point_index = i;
        }
      }
    }
    if (s_point) {
      this.tmp_i = s_point_index;
      return s_point;
    }
    return null;
  }

  checkRayIntersectsBezier(ray) {
    let closest = null;
    let closestDistSq = Infinity;
    const big = this.scene.lengthScale * 1e9;
    const raySeg = geometry.line(ray.p1, geometry.point(
      ray.p1.x + (ray.p2.x - ray.p1.x) * big,
      ray.p1.y + (ray.p2.y - ray.p1.y) * big
    ));
    for (let i = 0; i < this.bezierSegments.length; i++) {
      if (this.bezierSegmentLinearFlags?.[i]) {
        const rp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(this.path[i], this.path[i + 1]));
        if (!geometry.intersectionIsOnSegment(rp, geometry.line(this.path[i], this.path[i + 1]))) continue;
        if (!geometry.intersectionIsOnRay(rp, ray)) continue;
        const distSq = geometry.distanceSquared(ray.p1, rp);
        if (distSq <= Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale) continue;
        if (distSq < closestDistSq) {
          closestDistSq = distSq;
          closest = rp;
          this.tmp_i = i;
          this.tmp_bezierU = null;
        }
        continue;
      }

      const curve = this.bezierSegments[i];
      const us = curve.lineIntersects(raySeg);
      for (let k = 0; k < us.length; k++) {
        const rp = curve.get(us[k]);
        if (!geometry.intersectionIsOnRay(rp, ray)) continue;
        const distSq = geometry.distanceSquared(ray.p1, rp);
        if (distSq <= Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale) continue;
        if (distSq < closestDistSq) {
          closestDistSq = distSq;
          closest = rp;
          this.tmp_i = i;
          this.tmp_bezierU = us[k];
        }
      }
    }
    return closest;
  }

  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
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
      // The situation that may cause bugs (e.g. incident on an edge point)
      // To prevent shooting the ray to a wrong direction, absorb the ray
      return {
        isAbsorbed: true,
        isUndefinedBehavior: true
      };
    }

    return this.refract(ray, rayIndex, incidentPoint, incidentData.normal, n1, surfaceMergingObjs, ray.bodyMergingObj);
  }

  getIncidentData(ray) {
    if (this.curveType === 'cubicBezier' && this._ensureBezierPathReady()) {
      return this.getIncidentDataBezier(ray);
    }
    return this.getIncidentDataLinear(ray, this.curveType === 'smoothNormal');
  }

  getIncidentDataLinear(ray, smoothNormals) {
    var i = this.tmp_i;
    var pts = this.path;

    var s_point = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(this.path[i % this.path.length], this.path[(i + 1) % this.path.length]));
    var incidentPoint = s_point;

    var s_lensq = geometry.distanceSquared(ray.p1, s_point);

    var rdots = (ray.p2.x - ray.p1.x) * (this.path[(i + 1) % this.path.length].x - this.path[i % this.path.length].x) + (ray.p2.y - ray.p1.y) * (this.path[(i + 1) % this.path.length].y - this.path[i % this.path.length].y);
    var rcrosss = (ray.p2.x - ray.p1.x) * (this.path[(i + 1) % this.path.length].y - this.path[i % this.path.length].y) - (ray.p2.y - ray.p1.y) * (this.path[(i + 1) % this.path.length].x - this.path[i % this.path.length].x);
    var ssq = (this.path[(i + 1) % this.path.length].x - this.path[i % this.path.length].x) * (this.path[(i + 1) % this.path.length].x - this.path[i % this.path.length].x) + (this.path[(i + 1) % this.path.length].y - this.path[i % this.path.length].y) * (this.path[(i + 1) % this.path.length].y - this.path[i % this.path.length].y);

    var normal_x = rdots * (this.path[(i + 1) % this.path.length].x - this.path[i % this.path.length].x) - ssq * (ray.p2.x - ray.p1.x);
    var normal_y = rdots * (this.path[(i + 1) % this.path.length].y - this.path[i % this.path.length].y) - ssq * (ray.p2.y - ray.p1.y);

    if (rcrosss < 0) {
      var incidentType = 1; // From inside to outside
    } else {
      var incidentType = -1; // From outside to inside
    }

    // Use a simple trick to smooth out the normal vector so that image detection works.
    // However, a more proper numerical algorithm from the beginning (especially to handle singularities) is still desired.

    var seg = geometry.line(pts[i % pts.length], pts[(i + 1) % pts.length]);
    var rx = ray.p1.x - incidentPoint.x;
    var ry = ray.p1.y - incidentPoint.y;
    var mx = seg.p2.x - seg.p1.x;
    var my = seg.p2.y - seg.p1.y;

    var frac;
    if (Math.abs(mx) > Math.abs(my)) {
      frac = (incidentPoint.x - seg.p1.x) / mx;
    } else {
      frac = (incidentPoint.y - seg.p1.y) / my;
    }

    var normal_xFinal = normal_x;
    var normal_yFinal = normal_y;
    if (smoothNormals) {
      var segA;
      if (frac < 0.5) {
        segA = geometry.line(pts[(i - 1 + pts.length) % pts.length], pts[i % pts.length]);
      } else {
        segA = geometry.line(pts[(i + 1) % pts.length], pts[(i + 2) % pts.length]);
      }
      var rdotsA = (ray.p2.x - ray.p1.x) * (segA.p2.x - segA.p1.x) + (ray.p2.y - ray.p1.y) * (segA.p2.y - segA.p1.y);
      var ssqA = (segA.p2.x - segA.p1.x) * (segA.p2.x - segA.p1.x) + (segA.p2.y - segA.p1.y) * (segA.p2.y - segA.p1.y);
      var normal_xA = rdotsA * (segA.p2.x - segA.p1.x) - ssqA * (ray.p2.x - ray.p1.x);
      var normal_yA = rdotsA * (segA.p2.y - segA.p1.y) - ssqA * (ray.p2.y - ray.p1.y);
      if (frac < 0.5) {
        normal_xFinal = normal_x * (0.5 + frac) + normal_xA * (0.5 - frac);
        normal_yFinal = normal_y * (0.5 + frac) + normal_yA * (0.5 - frac);
      } else {
        normal_xFinal = normal_xA * (frac - 0.5) + normal_x * (1.5 - frac);
        normal_yFinal = normal_yA * (frac - 0.5) + normal_y * (1.5 - frac);
      }
    }

    return { s_point: s_point, normal: { x: normal_xFinal, y: normal_yFinal }, incidentType: incidentType };
  }

  getIncidentDataBezier(ray) {
    const i = this.tmp_i;
    if (this.bezierSegmentLinearFlags?.[i]) {
      const segP1 = this.path[i];
      const segP2 = this.path[i + 1];
      const incidentPoint = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(segP1, segP2));
      const rayDx = ray.p2.x - ray.p1.x;
      const rayDy = ray.p2.y - ray.p1.y;
      const segDx = segP2.x - segP1.x;
      const segDy = segP2.y - segP1.y;
      const rcrosss = rayDx * segDy - rayDy * segDx;
      const incidentType = rcrosss < 0 ? 1 : -1;
      const rdots = rayDx * segDx + rayDy * segDy;
      const ssq = segDx * segDx + segDy * segDy;
      const normal_x = rdots * segDx - ssq * rayDx;
      const normal_y = rdots * segDy - ssq * rayDy;
      return { s_point: incidentPoint, normal: { x: normal_x, y: normal_y }, incidentType: incidentType };
    }
    const u = this.tmp_bezierU;
    const curve = this.bezierSegments?.[i];
    if (!curve) {
      return { s_point: null, normal: { x: NaN, y: NaN }, incidentType: 0 };
    }
    const incidentPoint = curve.get(u);
    const tangent = curve.derivative(u);
    const tx = tangent.x;
    const ty = tangent.y;
    const rayDx = ray.p2.x - ray.p1.x;
    const rayDy = ray.p2.y - ray.p1.y;
    const rcrosss = rayDx * ty - rayDy * tx;
    const incidentType = rcrosss < 0 ? 1 : -1;
    const rdots = rayDx * tx + rayDy * ty;
    const ssq = tx * tx + ty * ty;
    const normal_x = rdots * tx - ssq * rayDx;
    const normal_y = rdots * ty - ssq * rayDy;
    return { s_point: incidentPoint, normal: { x: normal_x, y: normal_y }, incidentType: incidentType };
  }

  getIncidentType(ray) {
    return this.getIncidentData(ray).incidentType;
  }
  
  /* Utility methods */

  _invalidateCurveIfLengthScaleChanged() {
    if (this.path && this._curveCacheLengthScale !== this.scene.lengthScale) {
      delete this.path;
      delete this.bezierSegments;
      delete this.bezierSegmentLinearFlags;
      delete this._curveCacheLengthScale;
    }
  }

  drawGlass(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    ctx.beginPath();
    if (this.curveType === 'cubicBezier' && this._ensureBezierPathReady()) {
      const p0 = this.bezierSegments[0].get(0);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 0; i < this.bezierSegments.length; i++) {
        if (this.bezierSegmentLinearFlags?.[i]) {
          const p1 = this.path[i + 1];
          ctx.lineTo(p1.x, p1.y);
          continue;
        }
        const curve = this.bezierSegments[i];
        const pts = curve.points;
        ctx.bezierCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y);
      }
    } else {
      ctx.moveTo(this.path[0].x, this.path[0].y);
      for (var i = 1; i < this.path.length; i++) {
        ctx.lineTo(this.path[i].x, this.path[i].y);
      }
    }
    this.fillGlass(canvasRenderer, isAboveLight, isHovered);
  }

  _pathPairToHermiteBezier(p1, p2) {
    const dt = p2.t - p1.t;
    if (Math.abs(dt) < 1e-20) {
      return new Bezier([
        { x: p1.x, y: p1.y },
        { x: p1.x, y: p1.y },
        { x: p2.x, y: p2.y },
        { x: p2.x, y: p2.y },
      ]);
    }
    return new Bezier([
      { x: p1.x, y: p1.y },
      { x: p1.x + (p1.dxdt * dt) / 3, y: p1.y + (p1.dydt * dt) / 3 },
      { x: p2.x - (p2.dxdt * dt) / 3, y: p2.y - (p2.dydt * dt) / 3 },
      { x: p2.x, y: p2.y },
    ]);
  }

  _ensureBezierPathReady() {
    if (this.curveType !== 'cubicBezier') return true;
    if (!this.path || this.path.length < 2) return false;
    if (this.bezierSegments &&
        this.bezierSegments.length === this.path.length - 1 &&
        this.bezierSegmentLinearFlags &&
        this.bezierSegmentLinearFlags.length === this.bezierSegments.length) return true;
    this.bezierSegments = [];
    this.bezierSegmentLinearFlags = [];
    for (let i = 0; i < this.path.length - 1; i++) {
      this.bezierSegments.push(this._pathPairToHermiteBezier(this.path[i], this.path[i + 1]));
      this.bezierSegmentLinearFlags.push(this.path[i].side !== this.path[i + 1].side);
    }
    return true;
  }

  /**
   * Initialize the path points based on the equations.
   * This method is called by draw() and checkRayIntersects() when needed.
   * @returns {boolean} Whether the initialization was successful.
   */
  initPath() {
    if (!(this.curveStepSize > 1e-6)) {
      delete this.path;
      this.error = i18next.t('simulator:sceneObjs.ParamCurveObjMixin.error.invalidStepSize', { step: this.curveStepSize });
      return false;
    }

    if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
      delete this.path;
      // this.error = "Invalid glass: endpoints are the same";
      return false;
    }

    var fns;
    const wantBezier = this.curveType === 'cubicBezier';
    var derFns;
    try {
      fns = [evaluateLatex(this.eqn1), evaluateLatex(this.eqn2)];
      if (wantBezier) {
        derFns = [compileEquationDerivative(this.eqn1), compileEquationDerivative(this.eqn2)];
      }
    } catch (e) {
      delete this.path;
      delete this.bezierSegments;
      delete this.bezierSegmentLinearFlags;
      this.error = e.toString();
      return false;
    }

    this.path = [{ x: this.p1.x, y: this.p1.y, side: 0 }];
    if (wantBezier) {
      const p12d0 = geometry.distance(this.p1, this.p2);
      const dir10 = [(this.p2.x - this.p1.x) / p12d0, (this.p2.y - this.p1.y) / p12d0];
      const dir20 = [dir10[1], -dir10[0]];
      const d0 = derFns[0]({ x: -1 });
      this.path[0].t = -1;
      this.path[0].dxdt = dir10[0] * (p12d0 * 0.5) + dir20[0] * (p12d0 * 0.5) * d0;
      this.path[0].dydt = dir10[1] * (p12d0 * 0.5) + dir20[1] * (p12d0 * 0.5) * d0;
    }
    for (var side = 0; side <= 1; side++) {
      var p1 = (side == 0) ? this.p1 : this.p2;
      var p2 = (side == 0) ? this.p2 : this.p1;
      var p12d = geometry.distance(p1, p2);
      var dir1 = [(p2.x - p1.x) / p12d, (p2.y - p1.y) / p12d];
      var dir2 = [dir1[1], -dir1[0]];
      var x0 = p12d / 2;
      var i;
      var lastError = "";
      var hasPoints = false;
      var hasCurveGenerationError = false;
      const step = this.curveStepSize * this.scene.lengthScale;
      const sampleOffset = 0.5 * step;
      const sampleEndExtension = 0.9 * step;
      for (i = -step; i < p12d + sampleEndExtension; i += step) {
        var ix = i + sampleOffset;
        if (ix < 0) ix = 0;
        if (ix > p12d) ix = p12d;
        var x = ix - x0;
        var scaled_x = 2 * x / p12d;
        var scaled_y;
        try {
          scaled_y = ((side == 0) ? 1 : (-1)) * fns[side]({ x: ((side == 0) ? scaled_x : (-scaled_x)) });
          if (side == 1 && -scaled_y < fns[0]({ x: -scaled_x })) {
            lastError = i18next.t('simulator:sceneObjs.CustomGlass.curveGenerationError', { x: (-scaled_x) });
            hasCurveGenerationError = true;
          }
          var y = scaled_y * p12d * 0.5;
          var pt = geometry.point(p1.x + dir1[0] * ix + dir2[0] * y, p1.y + dir1[1] * ix + dir2[1] * y);
          if (wantBezier) {
            const dSide = side == 0 ? derFns[0]({ x: scaled_x }) : derFns[1]({ x: -scaled_x });
            pt.t = scaled_x;
            pt.dxdt = dir1[0] * (p12d * 0.5) + dir2[0] * (p12d * 0.5) * dSide;
            pt.dydt = dir1[1] * (p12d * 0.5) + dir2[1] * (p12d * 0.5) * dSide;
          }
          pt.side = side;
          this.path.push(pt);
          hasPoints = true;
        } catch (e) {
          lastError = e;
        }
      }
      if (!hasPoints || hasCurveGenerationError) {
        delete this.path;
        delete this.bezierSegments;
        delete this.bezierSegmentLinearFlags;
        this.error = lastError.toString();
        return false;
      }
    }
    
    this.error = null;
    delete this.bezierSegments;
    delete this.bezierSegmentLinearFlags;
    this._curveCacheLengthScale = this.scene.lengthScale;
    return true;
  }
};

export default CustomGlass;