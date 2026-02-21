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
import ParamCurveObjMixin from '../ParamCurveObjMixin.js';
import i18next from 'i18next';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';

/**
 * Glass with shape defined by parametric curve pieces.
 * 
 * Tools -> Glass -> Parametric curve
 * @class
 * @extends BaseGlass
 * @memberof sceneObjs
 * @property {Point} origin - The origin point of the parametric coordinate system.
 * @property {Array} pieces - Array of parametric curve pieces, each with eqnX, eqnY, tMin, tMax, tStep.
 * @property {number} refIndex - The refractive index of the glass, or the Cauchy coefficient A of the glass if "Simulate Colors" is on.
 * @property {number} cauchyB - The Cauchy coefficient B of the glass if "Simulate Colors" is on, in micrometer squared.
 * @property {Array<Point>} path - The points on the calculated curve.
 * @property {string} warning - Warning message if the curve is not closed or not positively oriented.
 */
class ParamGlass extends ParamCurveObjMixin(BaseGlass) {
  static type = 'ParamGlass';
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
    refIndex: 1.5,
    cauchyB: 0.004,
    partialReflect: true
  };

  static getPropertySchema(objData, scene) {
    return [
      ...super.getPropertySchema(objData, scene),
    ];
  }

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.categories.glass'));
    objBar.createInfoBox('<ul><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.constants') + '<br><code>pi e</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.operators') + '<br><code>+ - * / ^</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.functions') + '<br><code>sqrt sin cos tan sec csc cot sinh cosh tanh log exp arcsin arccos arctan arcsinh arccosh arctanh floor round ceil trunc sgn max min abs</code></li><li>' + i18next.t('simulator:sceneObjs.ParamGlass.eqnInfo.closedAndPositivelyOriented') + '</li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.module') + '</li></ul>');
    
    
    // Add parametric curve controls
    this.populateObjBarShape(objBar);
    
    // Add glass controls from BaseGlass
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

    // Draw the parametric curve glass
    if (this.path && this.path.length > 2) {
      this.drawPath(canvasRenderer);
      this.fillGlass(canvasRenderer, isAboveLight, isHovered);
    }
  }

  checkRayIntersects(ray) {
    var incidentData = this.getIncidentData(ray);
    if (incidentData.incidentType === NaN || !incidentData.s_point) {
      if (incidentData.incidentType === NaN) {
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
    var incidentData = this.getIncidentData(ray);
    var incidentType = incidentData.incidentType;
    
    if (incidentType === 1) {
      // From inside to outside
      var n1 = this.getRefIndexAt(incidentPoint, ray);
    } else if (incidentType === -1) {
      // From outside to inside
      var n1 = 1 / this.getRefIndexAt(incidentPoint, ray);
    } else if (incidentType === 0) {
      // Equivalent to not intersecting with the object (e.g. two interfaces overlap)
      var n1 = 1;
    } else {
      // Situation that may cause bugs (e.g. incident on an edge point)
      // To prevent shooting the ray to a wrong direction, absorb the ray
      return {
        isAbsorbed: true,
        isUndefinedBehavior: true
      };
    }

    return this.refract(ray, rayIndex, incidentPoint, incidentData.normal, n1, surfaceMergingObjs, ray.bodyMergingObj);
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

    // Sort intersections by distance from ray origin
    intersections.sort((a, b) => {
      const distA = geometry.distanceSquared(ray.p1, a.s_point);
      const distB = geometry.distanceSquared(ray.p1, b.s_point);
      return distA - distB;
    });

    const minInteractionLength = Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale;

    // Find the first valid intersection
    for (let i = 0; i < intersections.length; i++) {
      const currentIntersection = intersections[i];
      
      // Check for undefined behavior (NaN incidentType)
      if (isNaN(currentIntersection.incidentType)) {
        return {
          s_point: currentIntersection.s_point,
          normal: currentIntersection.normal,
          incidentType: NaN
        };
      }

      // Check if this intersection overlaps with others within minimum interaction length
      const overlappingIntersections = intersections.filter((other, idx) => {
        if (idx === i) return false;
        return geometry.distanceSquared(currentIntersection.s_point, other.s_point) < minInteractionLength;
      });

      if (overlappingIntersections.length === 0) {
        // No overlapping intersections - this is valid
        return {
          s_point: currentIntersection.s_point,
          normal: currentIntersection.normal,
          incidentType: currentIntersection.incidentType
        };
      } else if (overlappingIntersections.length === 1) {
        // Exactly one overlapping intersection
        const otherIntersection = overlappingIntersections[0];
        
        // Check if incident types are exactly opposite (+1 and -1)
        if ((currentIntersection.incidentType === 1 && otherIntersection.incidentType === -1) ||
            (currentIntersection.incidentType === -1 && otherIntersection.incidentType === 1)) {
          // This pair cancels each other - continue to next intersection
          continue;
        } else {
          // Other overlapping case - undefined behavior
          return {
            s_point: currentIntersection.s_point,
            normal: currentIntersection.normal,
            incidentType: NaN
          };
        }
      } else {
        // Multiple overlapping intersections - undefined behavior
        return {
          s_point: currentIntersection.s_point,
          normal: currentIntersection.normal,
          incidentType: NaN
        };
      }
    }

    // All intersections were either undefined or canceled out - equivalent to no intersection
    return {
      s_point: null,
      normal: { x: NaN, y: NaN },
      incidentType: 0
    };
  }

  getIncidentType(ray) {
    return this.getIncidentData(ray).incidentType;
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

export default ParamGlass; 