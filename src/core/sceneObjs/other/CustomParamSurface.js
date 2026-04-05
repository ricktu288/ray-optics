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

import ParamCurveObjMixin from '../ParamCurveObjMixin.js';
import BaseCustomSurface from '../BaseCustomSurface.js';
import i18next from 'i18next';
import geometry from '../../geometry.js';

/**
 * A parametric curve-shaped custom surface.
 * 
 * Tools -> Other -> Custom parametric surface
 * @class
 * @extends BaseCustomSurface
 * @memberof sceneObjs
 * @property {Point} origin - The origin point of the parametric coordinate system.
 * @property {Array} pieces - Array of parametric curve pieces, each with eqnX, eqnY, tMin, tMax, tStep.
 * @property {Array<OutRay>} outRays - The expressions of the outgoing rays.
 * @property {boolean} twoSided - Whether the surface is two-sided.
 * @property {Array<Point>} path - The points on the calculated curve.
 */
class CustomParamSurface extends ParamCurveObjMixin(BaseCustomSurface) {
  static type = 'CustomParamSurface';
  static isOptical = true;
  static mergesWithGlass = true;
  static serializableDefaults = {
    origin: { x: 0, y: 0 },
    pieces: [
      {
        eqnX: "50\\cdot\\cos(t)",
        eqnY: "50\\cdot\\sin(t)",
        tMin: 0,
        tMax: 2 * Math.PI,
        tStep: 0.01
      }
    ],
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
    return i18next.t('main:tools.CustomParamSurface.title');
  }

  static getPropertySchema(objData, scene) {
    return [
      ...super.getPropertySchema(objData, scene),
    ];
  }

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.CustomParamSurface.title'));
    objBar.createInfoBox('<ul><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.constants') + '<br><code>pi e</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.operators') + '<br><code>+ - * / ^</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.functions') + '<br><code>sqrt sin cos tan sec csc cot sinh cosh tanh log exp arcsin arccos arctan arcsinh arccosh arctanh floor round ceil trunc sgn max min abs</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.module') + '</li></ul>');
    
    
    // Add parametric curve controls
    this.populateObjBarShape(objBar);
    
    // Add custom surface controls
    super.populateObjBar(objBar);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    // Initialize path if needed
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

    // Use theme colors and width
    const theme = this.scene.theme.customSurface;
    const color = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(theme.color);
    const baseWidth = theme.width * ls;
    
    if (this.twoSided) {
      // For two-sided surfaces, draw just one curve with the full width
      ctx.strokeStyle = color;
      ctx.lineWidth = baseWidth;
      ctx.setLineDash([]);
      this.drawPath(canvasRenderer);
      ctx.stroke();
    } else {
      // For one-sided surfaces, draw two curves each with half the width
      const halfWidth = baseWidth / 2;
      
      // Draw the main solid curve
      ctx.strokeStyle = color;
      ctx.lineWidth = halfWidth;
      ctx.setLineDash([]);
      this.drawPath(canvasRenderer);
      ctx.stroke();

      // Draw the dashed curve offset by half width (negative offset = right side)
      ctx.lineWidth = halfWidth;
      ctx.setLineDash(theme.dash.map(d => d * ls));
      this.drawPath(canvasRenderer, -halfWidth);
      ctx.stroke();
    }

    // Reset line dash
    ctx.setLineDash([]);
  }

  checkRayIntersects(ray) {
    // Get all intersections
    const intersections = this.getRayIntersections(ray);
    
    if (intersections.length === 0) {
      return null;
    }

    // Filter intersections based on surface sidedness
    let validIntersections = [];
    
    for (const intersection of intersections) {
      // Check for undefined behavior (NaN incidentType)
      if (isNaN(intersection.incidentType)) {
        return {
          isAbsorbed: true,
          isUndefinedBehavior: true
        };
      }

      // For single-sided surfaces, only allow forward-facing intersections (incidentType = 1)
      if (!this.twoSided && intersection.incidentType === -1) {
        continue; // Skip backward-facing intersections for single-sided surfaces
      }

      validIntersections.push({
        intersection: intersection,
        distance: geometry.distanceSquared(ray.p1, intersection.s_point)
      });
    }

    if (validIntersections.length === 0) {
      return null;
    }

    // For two-sided surfaces, use the nearest intersection
    if (this.twoSided) {
      validIntersections.sort((a, b) => a.distance - b.distance);
      return validIntersections[0].intersection.s_point;
    } else {
      // For one-sided surfaces, prefer forward-facing intersections (incidentType = 1)
      const forwardIntersections = validIntersections.filter(item => item.intersection.incidentType === 1);
      if (forwardIntersections.length > 0) {
        // Use the nearest forward-facing intersection
        forwardIntersections.sort((a, b) => a.distance - b.distance);
        return forwardIntersections[0].intersection.s_point;
      } else {
        // If no forward-facing intersections, use the nearest valid intersection
        validIntersections.sort((a, b) => a.distance - b.distance);
        return validIntersections[0].intersection.s_point;
      }
    }
  }

  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
    // Get all intersections to find the one at the incident point
    const intersections = this.getRayIntersections(ray);
    
    // Find the intersection that matches the incident point
    let matchingIntersection = null;
    for (const intersection of intersections) {
      if (geometry.distanceSquared(incidentPoint, intersection.s_point) < 1e-10) {
        matchingIntersection = intersection;
        break;
      }
    }

    if (!matchingIntersection) {
      // Fallback - shouldn't happen if checkRayIntersects worked correctly
      return {
        isAbsorbed: true,
      };
    }

    // Check for undefined behavior
    if (isNaN(matchingIntersection.incidentType) || 
        isNaN(matchingIntersection.normal.x) || 
        isNaN(matchingIntersection.normal.y)) {
      return {
        isAbsorbed: true,
        isUndefinedBehavior: true,
      };
    }

    // The incident position is just the parameter t (not normalized to -1 to 1)
    const incidentPos = matchingIntersection.incidentPos;

    return this.handleOutRays(ray, rayIndex, incidentPoint, matchingIntersection.normal, incidentPos, surfaceMergingObjs, ray.bodyMergingObj);
  }
}

export default CustomParamSurface; 