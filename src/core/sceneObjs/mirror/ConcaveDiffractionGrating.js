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

import i18next from 'i18next';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';
import BaseSceneObj from '../BaseSceneObj.js';

/**
 * Mirror with shape of a circular arc. Diffracts light. 
 * 
 * Tools -> Mirror -> Concave Grating
 * @class
 * @extends BaseSceneObj
 * @memberof sceneObjs
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {Point} p3 - The control point on the arc.
 * @property {number} lineDensity - The number of lines per millimeter.
 * @property {boolean} customBrightness - Whether the output brightness are customized.
 * @property {number[]} brightnesses - The brightnesses of the diffracted rays for m = 0, 1, -1, 2, -2, ... when `customBrightness` is true. The number is to be normalized to the brightness of the incident ray. The values not in the array are set to 0.
 * @property {number} slitRatio - The ratio of the slit width to the line interval.
 */
class ConcaveDiffractionGrating extends BaseSceneObj {
  static type = 'ConcaveDiffractionGrating';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    p3: null,
    lineDensity: 1000,
    customBrightness: false,
    brightnesses: [1, 0.5, 0.5],
    slitRatio: 0.5,
  };

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.ConcaveDiffractionGrating.title'));
    objBar.createNumber(i18next.t('simulator:sceneObjs.DiffractionGrating.lineDensity', {lengthUnit: 'mm'}), 1, 2500, 5, this.lineDensity, function (obj, value) {
      obj.lineDensity = value;
    });

    objBar.createBoolean(i18next.t('simulator:sceneObjs.DiffractionGrating.customBrightness'), this.customBrightness, function (obj, value) {
      obj.customBrightness = value;
    }, i18next.t('simulator:sceneObjs.DiffractionGrating.customBrightnessInfo'), true);

    if (this.customBrightness) {
      objBar.createTuple('', this.brightnesses.join(', '), function (obj, value) {
        obj.brightnesses = value.split(',').map(parseFloat);
      });
    } else if (objBar.showAdvanced(!this.arePropertiesDefault(['slitRatio']))) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.DiffractionGrating.slitRatio'), 0, 1, 0.001, this.slitRatio, function (obj, value) {
        obj.slitRatio = value;
      });
    }
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    ctx.fillStyle = 'rgb(255,0,255)';
    if (this.p3 && this.p2) {
      var center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(this.p1, this.p3)), geometry.perpendicularBisector(geometry.line(this.p2, this.p3)));
      if (isFinite(center.x) && isFinite(center.y)) {
        var r = geometry.distance(center, this.p3);
        var a1 = Math.atan2(this.p1.y - center.y, this.p1.x - center.x);
        var a2 = Math.atan2(this.p2.y - center.y, this.p2.x - center.x);
        var a3 = Math.atan2(this.p3.y - center.y, this.p3.x - center.x);
        ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.mirror.color);
        ctx.lineWidth = this.scene.theme.mirror.width * ls;
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, a1, a2, (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2));
        ctx.stroke();
        ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.diffractionGrating.color);
        ctx.lineWidth = this.scene.theme.diffractionGrating.width * ls;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        if (this.customBrightness) {
          ctx.setLineDash(this.scene.theme.diffractionGrating.dash.map(d => d * ls));
        } else {
          ctx.setLineDash([this.scene.theme.diffractionGrating.dash[0] * 2 * (1 - this.slitRatio) * ls, this.scene.theme.diffractionGrating.dash[1] * 2 * this.slitRatio * ls]);
        }
        ctx.arc(center.x, center.y, r, a1, a2, (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1 * ls;
        if (isHovered) {
          ctx.fillRect(this.p3.x - 1.5 * ls, this.p3.y - 1.5 * ls, 3 * ls, 3 * ls);
          ctx.fillStyle = 'rgb(255,0,0)';
          ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
          ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
        }
      } else {
        ctx.fillRect(this.p3.x - 1.5 * ls, this.p3.y - 1.5 * ls, 3 * ls, 3 * ls);
        ctx.fillStyle = 'rgb(255,0,0)';
        ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
        ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
      }
    } else if (this.p2) {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
    } else {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
    }
  }

  move(diffX, diffY) {
    this.p1.x = this.p1.x + diffX;
    this.p1.y = this.p1.y + diffY;
    this.p2.x = this.p2.x + diffX;
    this.p2.y = this.p2.y + diffY;
    this.p3.x = this.p3.x + diffX;
    this.p3.y = this.p3.y + diffY;

    return true;
  }

  rotate(angle, center) {
    // Use p3 as default rotation center if none is provided
    const rotationCenter = center || this.p3;
    
    // Calculate differences from rotation center for all points
    const diff_p1_x = this.p1.x - rotationCenter.x;
    const diff_p1_y = this.p1.y - rotationCenter.y;
    const diff_p2_x = this.p2.x - rotationCenter.x;
    const diff_p2_y = this.p2.y - rotationCenter.y;
    const diff_p3_x = this.p3.x - rotationCenter.x;
    const diff_p3_y = this.p3.y - rotationCenter.y;

    // Apply rotation matrix to p1
    this.p1.x = rotationCenter.x + diff_p1_x * Math.cos(angle) - diff_p1_y * Math.sin(angle);
    this.p1.y = rotationCenter.y + diff_p1_x * Math.sin(angle) + diff_p1_y * Math.cos(angle);

    // Apply rotation matrix to p2
    this.p2.x = rotationCenter.x + diff_p2_x * Math.cos(angle) - diff_p2_y * Math.sin(angle);
    this.p2.y = rotationCenter.y + diff_p2_x * Math.sin(angle) + diff_p2_y * Math.cos(angle);
    
    // Apply rotation matrix to p3
    this.p3.x = rotationCenter.x + diff_p3_x * Math.cos(angle) - diff_p3_y * Math.sin(angle);
    this.p3.y = rotationCenter.y + diff_p3_x * Math.sin(angle) + diff_p3_y * Math.cos(angle);
    
    return true;
  }
  
  scale(scale, center) {
    // Use p3 as default scaling center if none is provided
    const scalingCenter = center || this.p3;
    
    // Calculate differences from scaling center for all points
    const diff_p1_x = this.p1.x - scalingCenter.x;
    const diff_p1_y = this.p1.y - scalingCenter.y;
    const diff_p2_x = this.p2.x - scalingCenter.x;
    const diff_p2_y = this.p2.y - scalingCenter.y;
    const diff_p3_x = this.p3.x - scalingCenter.x;
    const diff_p3_y = this.p3.y - scalingCenter.y;
    
    // Apply scaling to p1
    this.p1.x = scalingCenter.x + diff_p1_x * scale;
    this.p1.y = scalingCenter.y + diff_p1_y * scale;
    
    // Apply scaling to p2
    this.p2.x = scalingCenter.x + diff_p2_x * scale;
    this.p2.y = scalingCenter.y + diff_p2_y * scale;
    
    // Apply scaling to p3
    this.p3.x = scalingCenter.x + diff_p3_x * scale;
    this.p3.y = scalingCenter.y + diff_p3_y * scale;
    
    return true;
  }
  
  getDefaultCenter() {
    return this.p3;
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    if (!this.constructionPoint) {
      // Initialize the construction stage.
      this.constructionPoint = mouse.getPosSnappedToGrid();
      this.p1 = this.constructionPoint;
      this.p2 = null;
      this.p3 = null;
    }

    if (!this.p2 && !this.p3) {
      this.p2 = mouse.getPosSnappedToGrid();
      return;
    }

    if (this.p2 && !this.p3 && !mouse.snapsOnPoint(this.p1)) {
      if (shift) {
        this.p2 = mouse.getPosSnappedToDirection(this.p1, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
      } else {
        this.p2 = mouse.getPosSnappedToGrid();
      }
      this.p3 = mouse.getPosSnappedToGrid();
      return;
    }
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    if (!this.p3 && !mouse.isOnPoint(this.p1)) {
      if (shift) {
        this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
      } else {
        this.p2 = mouse.getPosSnappedToGrid();
      }

      this.p1 = ctrl ? geometry.point(2 * this.constructionPoint.x - this.p2.x, 2 * this.constructionPoint.y - this.p2.y) : this.constructionPoint;

      return;
    }
    if (this.p3) {
      this.p3 = mouse.getPosSnappedToGrid();
      return;
    }
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    if (this.p2 && !this.p3 && !mouse.isOnPoint(this.p1)) {
      this.p3 = mouse.getPosSnappedToGrid();
      return;
    }
    if (this.p3 && !mouse.isOnPoint(this.p2)) {
      this.p3 = mouse.getPosSnappedToGrid();
      delete this.constructionPoint;
      return {
        isDone: true
      };
    }
  }

  checkMouseOver(mouse) {
    let dragContext = {};
    if (mouse.isOnPoint(this.p1) && geometry.distanceSquared(mouse.pos, this.p1) <= geometry.distanceSquared(mouse.pos, this.p2) && geometry.distanceSquared(mouse.pos, this.p1) <= geometry.distanceSquared(mouse.pos, this.p3)) {
      dragContext.part = 1;
      dragContext.targetPoint = geometry.point(this.p1.x, this.p1.y);
      return dragContext;
    }
    if (mouse.isOnPoint(this.p2) && geometry.distanceSquared(mouse.pos, this.p2) <= geometry.distanceSquared(mouse.pos, this.p3)) {
      dragContext.part = 2;
      dragContext.targetPoint = geometry.point(this.p2.x, this.p2.y);
      return dragContext;
    }
    if (mouse.isOnPoint(this.p3)) {
      dragContext.part = 3;
      dragContext.targetPoint = geometry.point(this.p3.x, this.p3.y);
      return dragContext;
    }

    var center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(this.p1, this.p3)), geometry.perpendicularBisector(geometry.line(this.p2, this.p3)));
    const mousePos = mouse.getPosSnappedToGrid();
    if (isFinite(center.x) && isFinite(center.y)) {
      var r = geometry.distance(center, this.p3);
      var a1 = Math.atan2(this.p1.y - center.y, this.p1.x - center.x);
      var a2 = Math.atan2(this.p2.y - center.y, this.p2.x - center.x);
      var a3 = Math.atan2(this.p3.y - center.y, this.p3.x - center.x);
      var a_m = Math.atan2(mouse.pos.y - center.y, mouse.pos.x - center.x);
      if (Math.abs(geometry.distance(center, mouse.pos) - r) < mouse.getClickExtent() && (((a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2)) == ((a2 < a_m && a_m < a1) || (a1 < a2 && a2 < a_m) || (a_m < a1 && a1 < a2)))) {
        // Dragging the entire obj
        dragContext.part = 0;
        dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
        dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
        dragContext.snapContext = {};
        return dragContext;
      }
    } else {
      // The three points on the arc is colinear. Treat as a line segment.
      if (mouse.isOnSegment(this)) {
        dragContext.part = 0;
        dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
        dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
        dragContext.snapContext = {};
        return dragContext;
      }
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    var basePoint;
    if (dragContext.part == 1) {
      // Dragging the first endpoint
      basePoint = ctrl ? geometry.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p2;

      this.p1 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
      this.p2 = ctrl ? geometry.point(2 * basePoint.x - this.p1.x, 2 * basePoint.y - this.p1.y) : basePoint;
    }
    if (dragContext.part == 2) {
      // Dragging the second endpoint
      basePoint = ctrl ? geometry.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p1;

      this.p2 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
      this.p1 = ctrl ? geometry.point(2 * basePoint.x - this.p2.x, 2 * basePoint.y - this.p2.y) : basePoint;
    }
    if (dragContext.part == 3) {
      // Dragging the third endpoint
      this.p3 = mouse.getPosSnappedToGrid();
    }
    if (dragContext.part == 0) {
      // Dragging the entire obj
      if (shift) {
        var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }, { x: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y), y: -(dragContext.originalObj.p2.x - dragContext.originalObj.p1.x) }], dragContext.snapContext);
      } else {
        var mousePos = mouse.getPosSnappedToGrid();;
        dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
      }

      var mouseDiffX = dragContext.mousePos1.x - mousePos.x; // The X difference between the mouse position now and at the previous moment
      var mouseDiffY = dragContext.mousePos1.y - mousePos.y; // The Y difference between the mouse position now and at the previous moment
      // Move the first point
      this.p1.x = this.p1.x - mouseDiffX;
      this.p1.y = this.p1.y - mouseDiffY;
      // Move the second point
      this.p2.x = this.p2.x - mouseDiffX;
      this.p2.y = this.p2.y - mouseDiffY;

      this.p3.x = this.p3.x - mouseDiffX;
      this.p3.y = this.p3.y - mouseDiffY;

      // Update the mouse position
      dragContext.mousePos1 = mousePos;
    }
  }

  onSimulationStart() {
    this.warning = null;
    if (this.scene.mode == 'images' || this.scene.mode == 'observer') {
      this.warning = (this.warning || "") + i18next.t('simulator:sceneObjs.common.imageDetectionWarning');
    }

    if (!this.scene.simulateColors) {
      this.warning = (this.warning || "") + i18next.t('simulator:sceneObjs.common.nonSimulateColorsWarning');
    }
  }

  checkRayIntersects(ray) {
    if (!this.p3) { return null; }
    var center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(this.p1, this.p3)), geometry.perpendicularBisector(geometry.line(this.p2, this.p3)));
    if (isFinite(center.x) && isFinite(center.y)) {
      var rp_temp = geometry.lineCircleIntersections(geometry.line(ray.p1, ray.p2), geometry.circle(center, this.p2));
      var rp_exist = [];
      var rp_lensq = [];
      for (var i = 1; i <= 2; i++) {
        rp_exist[i] = !geometry.intersectionIsOnSegment(geometry.linesIntersection(geometry.line(this.p1, this.p2), geometry.line(this.p3, rp_temp[i])), geometry.line(this.p3, rp_temp[i])) && geometry.intersectionIsOnRay(rp_temp[i], ray) && geometry.distanceSquared(rp_temp[i], ray.p1) > Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale;
        rp_lensq[i] = geometry.distanceSquared(ray.p1, rp_temp[i]);
      }
      if (rp_exist[1] && ((!rp_exist[2]) || rp_lensq[1] < rp_lensq[2])) { return rp_temp[1]; }
      if (rp_exist[2] && ((!rp_exist[1]) || rp_lensq[2] < rp_lensq[1])) { return rp_temp[2]; }
    } else {
      // The three points on the arc is colinear. Treat as a line segment.
      var rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(this.p1, this.p2));

      if (geometry.intersectionIsOnSegment(rp_temp, this) && geometry.intersectionIsOnRay(rp_temp, ray)) {
        return rp_temp;
      } else {
        return null;
      }
    }
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    const mm_in_nm = 1 / 1e6;
    let truncation = 0;
  
    // Ray and Grating Geometry
    const rx = ray.p1.x - incidentPoint.x;
    const ry = ray.p1.y - incidentPoint.y;
  
    // Center of curvature (for reflection/diffraction)
    const center = geometry.linesIntersection(
      geometry.perpendicularBisector(geometry.line(this.p1, this.p3)),
      geometry.perpendicularBisector(geometry.line(this.p2, this.p3))
    );
  
    const wavelength = (ray.wavelength || Simulator.GREEN_WAVELENGTH) * mm_in_nm;
    const interval = 1 / this.lineDensity;
    const slit_width = interval * this.slitRatio;
  
    let newRays = [];
  
    // Incident and Normal Angles
    let ray_angle = Math.atan2(ry, rx);
    let normal_angle;
    let dotProduct;
    if (isFinite(center.x) && isFinite(center.y)) {
      normal_angle = Math.atan2(incidentPoint.y - center.y, incidentPoint.x - center.x);      // Initial normal pointing from center to the incident point
      dotProduct = rx * (incidentPoint.x - center.x) + ry * (incidentPoint.y - center.y);  // Check if the ray is hitting the inner surface
    }  else {    // the mirror is plane - the 3 points are collinear
      const dx = this.p2.x - this.p1.x;
      const dy = this.p2.y - this.p1.y;
      dotProduct = rx * dx + ry * dy;
      normal_angle = Math.atan2(-dx, dy);                                                      // The normal is perpendicular to the mirror's direction vector
    }
    if (dotProduct < 0) {
      normal_angle += Math.PI;                                                                 // Reverse the normal direction for inner/outer surface reflection
    }

    let incidence_angle = ray_angle - normal_angle;
  
    // Diffraction Orders
    const m_min = Math.ceil((Math.sin(incidence_angle) - 1) * interval / wavelength);
    const m_max = Math.floor((Math.sin(incidence_angle) + 1) * interval / wavelength);
  
    for (let m = m_min; m <= m_max; m++) {
      const argument = (m * wavelength / interval) - Math.sin(incidence_angle);
      if (argument < -1 || argument > 1) continue; // Skip invalid orders
  
      let diffracted_angle = Math.asin(argument);                 // computes:            arcsin ((m*wavelength / interval) - sin(incidence_angle))
                                                                  // that's different to  arcsin (sin(incidence_angle) - (m*wavelength / interval)) , which is the value necessary in the below calculation for the intensities with sinc
  
      // Rotate relative to the normal
      const rot_angle = normal_angle + diffracted_angle;
      const dx = Math.cos(rot_angle);
      const dy = Math.sin(rot_angle);
  
      const diffracted_ray = geometry.line(
        incidentPoint,
        geometry.point(incidentPoint.x + dx, incidentPoint.y + dy)
      );

      // Calculate intensity
      if (this.customBrightness) {
        var intensity = this.brightnesses[m<=0 ? -2*m : 2*m-1] || 0;
      } else {
        // Treat the gratings as a blocker with slits
        diffracted_angle = Math.asin(Math.sin(incidence_angle) - m * wavelength / interval);
        var phase_diff = 2 * Math.PI * slit_width / wavelength * (Math.sin(incidence_angle) - Math.sin(diffracted_angle))
        var sinc_arg = (phase_diff == 0) ? 1 : Math.sin(phase_diff / 2) / (phase_diff / 2);

        // This formula may not be accurate when `diffracted_angle` is large. This is warned in the popover of the tool.
        var intensity = slit_width * slit_width / (interval * interval) * Math.pow(sinc_arg, 2);
      }

      if (intensity == 0) {
        continue;
      }
      
      diffracted_ray.wavelength = ray.wavelength;
      diffracted_ray.brightness_s = ray.brightness_s * intensity;
      diffracted_ray.brightness_p = ray.brightness_p * intensity;

      // There is currently no good way to make image detection work here. So just set gap to true to disable image detection for the diffracted rays.
      diffracted_ray.gap = true;

      if (diffracted_ray.brightness_s + diffracted_ray.brightness_p > (this.scene.colorMode != 'default' ? 1e-6 : 0.01)) {
        newRays.push(diffracted_ray);
      } else {
        truncation += diffracted_ray.brightness_s + diffracted_ray.brightness_p;
      }
    }

    return {
      isAbsorbed: true,
      newRays: newRays,
      truncation: truncation
    };
  }  
};

export default ConcaveDiffractionGrating;