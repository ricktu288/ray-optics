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

import LineObjMixin from '../LineObjMixin.js';
import BaseCustomSurface from '../BaseCustomSurface.js';
import i18next from 'i18next';
import geometry from '../../geometry.js';

/**
 * A line-shaped custom surface.
 * 
 * Tools -> Other -> Custom surface
 * @class
 * @extends BaseCustomSurface
 * @memberof sceneObjs
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {Array<OutRay>} outRays - The expressions of the outgoing rays.
 * @property {boolean} twoSided - Whether the surface is two-sided.
 */
class CustomSurface extends LineObjMixin(BaseCustomSurface) {
  static type = 'CustomSurface';
  static isOptical = true;
  static mergesWithGlass = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
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

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.CustomSurface.title'));
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

    // Use theme colors and width
    const theme = this.scene.theme.customSurface;
    const color = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(theme.color);
    const baseWidth = theme.width * ls;
    
    if (this.twoSided) {
      // For two-sided surfaces, draw just one line with the full width
      ctx.strokeStyle = color;
      ctx.lineWidth = baseWidth;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(this.p1.x, this.p1.y);
      ctx.lineTo(this.p2.x, this.p2.y);
      ctx.stroke();
    } else {
      // For one-sided surfaces, draw two lines each with half the width
      const halfWidth = baseWidth / 2;
      
      // Draw the main solid line
      ctx.strokeStyle = color;
      ctx.lineWidth = halfWidth;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(this.p1.x, this.p1.y);
      ctx.lineTo(this.p2.x, this.p2.y);
      ctx.stroke();

      // Calculate the perpendicular vector (normal to the line)
      const dx = this.p2.x - this.p1.x;
      const dy = this.p2.y - this.p1.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length > 0) {
        // Normalize the perpendicular vector
        const perpX = -dy / length;
        const perpY = dx / length;
        
        // Shift distance is the half width
        const shiftDistance = halfWidth;
        
        // Calculate shifted points (shift toward the side where rays are ignored)
        // Since getIncidentType returns -1 for "outside to inside", we want to shift
        // toward the "outside" (negative cross product side)
        const shiftedP1x = this.p1.x - perpX * shiftDistance;
        const shiftedP1y = this.p1.y - perpY * shiftDistance;
        const shiftedP2x = this.p2.x - perpX * shiftDistance;
        const shiftedP2y = this.p2.y - perpY * shiftDistance;

        // Draw the dashed line with half width
        ctx.lineWidth = halfWidth;
        ctx.setLineDash(theme.dash.map(d => d * ls));
        ctx.beginPath();
        ctx.moveTo(shiftedP1x, shiftedP1y);
        ctx.lineTo(shiftedP2x, shiftedP2y);
        ctx.stroke();
      }
    }

    // Reset line dash
    ctx.setLineDash([]);
  }

  checkRayIntersects(ray) {
    if (!this.twoSided && this.getIncidentType(ray) == -1) {
      return null;
    }
    return this.checkRayIntersectsShape(ray);
  }

  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
    // Determine the normalized position of the incident point on the surface (where p1 and p2 corresponds to -1 and 1 respectively)
    const dist1 = geometry.distance(incidentPoint, this.p1);
    const dist2 = geometry.distance(incidentPoint, this.p2);
    const incidentPos = -1 + 2 * dist1 / (dist1 + dist2);

    // Determine the normal vector of the surface
    const rdots = (ray.p2.x - ray.p1.x) * (this.p2.x - this.p1.x) + (ray.p2.y - ray.p1.y) * (this.p2.y - this.p1.y);
    const ssq = (this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y);
    const normal = { x: rdots * (this.p2.x - this.p1.x) - ssq * (ray.p2.x - ray.p1.x), y: rdots * (this.p2.y - this.p1.y) - ssq * (ray.p2.y - ray.p1.y) };

    return this.handleOutRays(ray, rayIndex, incidentPoint, normal, incidentPos, surfaceMergingObjs, ray.bodyMergingObj);
  }


  getIncidentType(ray) {
    var rcrosss = (ray.p2.x - ray.p1.x) * (this.p2.y - this.p1.y) - (ray.p2.y - ray.p1.y) * (this.p2.x - this.p1.x);
    if (rcrosss > 0) {
      return 1; // From inside to outside
    }
    if (rcrosss < 0) {
      return -1; // From outside to inside
    }
    return NaN;
  }
}

export default CustomSurface;