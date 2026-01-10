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
import ParamCurveObjMixin from '../ParamCurveObjMixin.js';
import i18next from 'i18next';
import geometry from '../../geometry.js';

/**
 * Gradient-index glass with shape defined by parametric curve pieces.
 * 
 * Tools -> Glass -> GRIN Parametric Curve
 * @class
 * @extends BaseGrinGlass
 * @memberof sceneObjs
 * @property {Point} origin - The origin point of the parametric coordinate system.
 * @property {Array} pieces - Array of parametric curve pieces, each with eqnX, eqnY, tMin, tMax, tStep.
 * @property {string} refIndexFn - The refractive index function in x and y in LaTeX format.
 * @property {number} stepSize - The step size for the ray trajectory equation.
 * @property {number} intersectTol - The epsilon for the intersection calculations.
 * @property {Array<Point>} path - The points on the calculated curve.
 * @property {string} warning - Warning message if the curve is not closed or not positively oriented.
 */
class ParamGrinGlass extends ParamCurveObjMixin(BaseGrinGlass) {
  static type = 'ParamGrinGlass';
  static isOptical = true;
  static mergesWithGlass = true;
  static serializableDefaults = {
    origin: { x: 0, y: 0 },
    pieces: [
      {
        eqnX: "50\\cdot\\cos\\left(t\\right)",
        eqnY: "50\\cdot\\sin\\left(t\\right)",
        tMin: 0,
        tMax: 2 * Math.PI,
        tStep: 0.01
      }
    ],
    refIndexFn: '1+e^{-\\frac{x^2+y^2}{50^2}}',
    absorptionFn: '0',
    stepSize: 1,
    intersectTol: 1e-3,
    partialReflect: true
  };

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.ParamGrinGlass.title'));
    objBar.createInfoBox('<ul><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.constants') + '<br><code>pi e</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.operators') + '<br><code>+ - * / ^</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.functions') + '<br><code>sqrt sin cos tan sec csc cot sinh cosh tanh log exp arcsin arccos arctan arcsinh arccosh arctanh floor round ceil trunc sgn max min abs</code></li><li>' + i18next.t('simulator:sceneObjs.ParamGlass.eqnInfo.closedAndPositivelyOriented') + '</li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.module') + '</li></ul>');
    
    
    // Add parametric curve controls
    this.populateObjBarShape(objBar);
    
    // Add GRIN glass controls from BaseGrinGlass
    super.populateObjBar(objBar);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    // Initialize path if needed and validate curve
    if (!this.path) {
      if (!this.initPath()) {
        // If initialization failed, draw error indicator at origin
        ctx.fillStyle = "red";
        ctx.fillRect(this.origin.x - 1.5 * ls, this.origin.y - 1.5 * ls, 3 * ls, 3 * ls);
        return;
      }
      this.validateCurve();
    }

    // Check if curve is empty or fully degenerate
    let isEmptyOrDegenerate = false;
    
    if (this.path.length < 2) {
      isEmptyOrDegenerate = true;
    } else {
      // Check if all points are identical (fully degenerate curve)
      const firstPoint = this.path[0];
      let allPointsIdentical = true;
      for (let i = 1; i < this.path.length; i++) {
        if (Math.abs(this.path[i].x - firstPoint.x) > 1e-10 || 
            Math.abs(this.path[i].y - firstPoint.y) > 1e-10) {
          allPointsIdentical = false;
          break;
        }
      }
      isEmptyOrDegenerate = allPointsIdentical;
    }

    if (isEmptyOrDegenerate) {
      // Empty or fully degenerate curve - always draw origin square
      ctx.fillStyle = isHovered ? 'rgb(255,0,0)' : 'rgb(128,128,128)';
      ctx.fillRect(this.origin.x - 1.5 * ls, this.origin.y - 1.5 * ls, 3 * ls, 3 * ls);
      return;
    }

    if (isAboveLight) {
      if (this.path && this.path.length > 2) {
        this.drawPath(canvasRenderer);
        this.fillGlass(canvasRenderer, isAboveLight, isHovered);
      }
      return;
    }

    // Draw the parametric curve GRIN glass
    if (this.path && this.path.length > 2) {
      this.drawPath(canvasRenderer);
      this.fillGlass(canvasRenderer, isAboveLight, isHovered);
    }
  }

  move(diffX, diffY) {
    super.move(diffX, diffY);
    this.initFns();
    return true;
  }

  rotate(angle, center) {
    super.rotate(angle, center);
    this.initFns();
    return false;
  }

  scale(scale, center) {
    super.scale(scale, center);
    this.initFns();
    return false;
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    super.onConstructMouseDown(mouse, ctrl, shift);
    this.initFns();
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    super.onDrag(mouse, dragContext, ctrl, shift);
    this.initFns();
  }

  checkRayIntersects(ray) {
    if (!this.fn_p) {
      this.initFns();
    }
    
    // If ray starts inside the glass or on boundary, step forward
    if (this.isInsideGlass(ray.p1) || this.isOnBoundary(ray.p1)) {
      let len = geometry.distance(ray.p1, ray.p2);
      let x = ray.p1.x + (this.stepSize / len) * (ray.p2.x - ray.p1.x);
      let y = ray.p1.y + (this.stepSize / len) * (ray.p2.y - ray.p1.y);
      const intersection_point = geometry.point(x, y);
      if (this.isInsideGlass(intersection_point)) {
        return intersection_point;
      }
    }

    var incidentData = this.getIncidentData(ray);
    if (isNaN(incidentData.incidentType) || !incidentData.s_point) {
      if (isNaN(incidentData.incidentType)) {
        return {
          isAbsorbed: true,
          isUndefinedBehavior: true
        };
      }
      return null;
    }

    return incidentData.s_point;
  }

  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
    if (!this.fn_p) {
      // This means that some error has occurred earlier in parsing the equation.
      return {
        isAbsorbed: true
      };
    }
    
    try {
      this.error = null;

      // Check if ray is hitting the boundary from outside or inside
      if ((this.isInsideGlass(ray.p1) || this.isOutsideGlass(ray.p1)) && this.isOnBoundary(incidentPoint)) {
        let r_bodyMerging_obj = ray.bodyMergingObj; // Save the current bodyMergingObj

        var incidentData = this.getIncidentData(ray);
        var incidentType = incidentData.incidentType;
        
        if (incidentType === 1) {
          // From inside to outside
          var n1 = this.getRefIndexAt(incidentPoint, ray);
          var normal = incidentData.normal;
          this.onRayExit(ray);
        } else if (incidentType === -1) {
          // From outside to inside
          var n1 = 1 / this.getRefIndexAt(incidentPoint, ray);
          var normal = incidentData.normal;
          this.onRayEnter(ray);
        } else {
          // The situation that may cause bugs (e.g. incident on an edge point)
          return {
            isAbsorbed: true,
            isUndefinedBehavior: true
          };
        }
        
        return this.refract(ray, rayIndex, incidentPoint, normal, n1, surfaceMergingObjs, r_bodyMerging_obj);
      } else {
        // Ray is propagating inside the GRIN glass
        if (ray.bodyMergingObj === undefined) {
          ray.bodyMergingObj = this.initRefIndex(ray); // Initialize the bodyMerging object of the ray
        }
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

  getIncidentData(ray) {
    // Get all intersections from the mixin
    const intersections = this.getRayIntersections(ray);
    
    if (intersections.length === 0) {
      return {
        s_point: null,
        normal: { x: NaN, y: NaN },
        incidentType: 0
      };
    }

    // Find the nearest intersection (simple approach for GRIN glass)
    let nearestIntersection = null;
    let nearestDistance = Infinity;

    for (const intersection of intersections) {
      // Check for undefined behavior (NaN incidentType)
      if (isNaN(intersection.incidentType)) {
        return {
          s_point: intersection.s_point,
          normal: intersection.normal,
          incidentType: NaN
        };
      }

      const distance = geometry.distanceSquared(ray.p1, intersection.s_point);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIntersection = intersection;
      }
    }

    if (nearestIntersection) {
      return {
        s_point: nearestIntersection.s_point,
        normal: nearestIntersection.normal,
        incidentType: nearestIntersection.incidentType
      };
    }

    // No valid intersection found
    return {
      s_point: null,
      normal: { x: NaN, y: NaN },
      incidentType: 0
    };
  }

  getIncidentType(ray) {
    return this.getIncidentData(ray).incidentType;
  }

  isOutsideGlass(point) {
    return super.isOutside(point);
  }

  isInsideGlass(point) {
    return super.isInside(point);
  }

  isOnBoundary(point) {
    return super.isOnBoundary(point);
  }

 /**
 * Validate that the curve is closed and positively oriented.
 * Sets this.warning if validation fails.
 */
  validateCurve() {
    if (!this.isClosed()) {
      this.warning = i18next.t('simulator:sceneObjs.ParamGlass.warning.notClosed');
      return;
    }
    
    if (!this.isPositivelyOriented()) {
      this.warning = i18next.t('simulator:sceneObjs.ParamGlass.warning.notPositivelyOriented');
      return;
    }
    
    this.warning = null;
  }

  /**
   * Override initPath to validate curve after generation.
   */
  initPath() {
    const result = super.initPath();
    if (result) {
      this.validateCurve();
    }
    return result;
  }
}

export default ParamGrinGlass; 