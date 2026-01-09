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

import BaseFilter from '../BaseFilter.js';
import i18next from 'i18next';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';

/**
 * Mirror with shape of a circular arc.
 * 
 * Tools -> Mirror -> Circular Arc
 * @class
 * @extends BaseFilter
 * @memberof sceneObjs
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {Point} p3 - The control point on the arc.
 * @property {boolean} filter - Whether it is a dichroic mirror.
 * @property {boolean} invert - If true, the ray with wavelength outside the bandwidth is reflected. If false, the ray with wavelength inside the bandwidth is reflected.
 * @property {number} wavelength - The target wavelength if dichroic is enabled. The unit is nm.
 * @property {number} bandwidth - The bandwidth if dichroic is enabled. The unit is nm.
 */
class ArcMirror extends BaseFilter {
  static type = 'ArcMirror';
  static isOptical = true;
  static mergesWithGlass = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    p3: null,
    filter: false,
    invert: false,
    wavelength: Simulator.GREEN_WAVELENGTH,
    bandwidth: 10
  };

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:meta.parentheses', { main: i18next.t('main:tools.categories.mirror'), sub: i18next.t('main:tools.ArcMirror.title') }));

    // Alternative parametrization: focal length (paraxial approximation).
    if (this.p1 && this.p2 && this.p3) {
      const chordLen = geometry.distance(this.p1, this.p2);
      const eps = 1e-12;
      if (chordLen > eps) {
        const apertureHalf = chordLen * 0.5;

        // Axis direction (unit) through p3, perpendicular to the mirror at p3.
        // If the arc is valid, this is along the radius (p3 -> center).
        // If degenerate (collinear), fall back to the perpendicular of the chord.
        let axisDirX, axisDirY;
        const center = geometry.linesIntersection(
          geometry.perpendicularBisector(geometry.line(this.p1, this.p3)),
          geometry.perpendicularBisector(geometry.line(this.p2, this.p3))
        );
        if (center && isFinite(center.x) && isFinite(center.y)) {
          const dx = center.x - this.p3.x;
          const dy = center.y - this.p3.y;
          const d = Math.hypot(dx, dy);
          axisDirX = dx / d;
          axisDirY = dy / d;
        } else {
          const ux = (this.p2.x - this.p1.x) / chordLen;
          const uy = (this.p2.y - this.p1.y) / chordLen;
          axisDirX = uy;
          axisDirY = -ux;
        }
        const tanDirX = axisDirY;
        const tanDirY = -axisDirX;

        // Initial focal length shown in obj bar.
        // Use Infinity for degenerate / flat case.
        // Sign convention (per request): if p3 is on the left of the directed line p1->p2, focal length is positive,
        // otherwise negative. (Uses the same "left normal" convention as dir2 = [dy, -dx] elsewhere in this codebase.)
        let focalLength = Infinity;
        if (center && isFinite(center.x) && isFinite(center.y)) {
          const r = geometry.distance(center, this.p3);
          const side = (this.p3.x - this.p1.x) * tanDirX + (this.p3.y - this.p1.y) * tanDirY;
          const sgn = side === 0 ? 1 : Math.sign(side);
          focalLength = sgn * (r / 2);
        }

        objBar.createNumber(
          i18next.t('simulator:sceneObjs.common.focalLength'),
          -1000 * this.scene.lengthScale,
          1000 * this.scene.lengthScale,
          1 * this.scene.lengthScale,
          focalLength,
          function (obj, value) {
            // Map slider value 0 -> Infinity. Also accept typed "inf"/"-inf".
            const f = (value === 0) ? Infinity : value;

            // Keep p3 fixed.
            const p3x = obj.p3.x;
            const p3y = obj.p3.y;

            if (!isFinite(f)) {
              // Flat / degenerate: treat as a line segment centered at p3 along the tangent direction.
              obj.p1 = geometry.point(p3x + tanDirX * apertureHalf, p3y + tanDirY * apertureHalf);
              obj.p2 = geometry.point(p3x - tanDirX * apertureHalf, p3y - tanDirY * apertureHalf);
              return;
            }

            // Desired radius from focal length (paraxial): R = 2f.
            let R = 2 * f;
            let absR = Math.abs(R);
            if (!(absR > eps)) {
              // Extremely small values behave like Infinity for robustness.
              obj.p1 = geometry.point(p3x + tanDirX * apertureHalf, p3y + tanDirY * apertureHalf);
              obj.p2 = geometry.point(p3x - tanDirX * apertureHalf, p3y - tanDirY * apertureHalf);
              return;
            }

            // If radius is too small to support the captured aperture, temporarily use a semicircle
            // with the requested radius (effective apertureHalf = |R|). Do NOT mutate captured apertureHalf.
            const apertureHalfEffective = (absR < apertureHalf) ? absR : apertureHalf;

            // Build a symmetric arc: p3 is the mid-arc point, endpoints are rotations by ±theta.
            const centerNew = geometry.point(p3x + axisDirX * R, p3y + axisDirY * R);
            const theta = Math.asin(Math.min(1, apertureHalfEffective / absR)); // theta ∈ (0, π/2]
            const cosT = Math.cos(theta);
            const sinT = Math.sin(theta);

            // p = center - R*(axis*cosT ± tan*sinT)
            obj.p1 = geometry.point(
              centerNew.x - R * (axisDirX * cosT + tanDirX * sinT),
              centerNew.y - R * (axisDirY * cosT + tanDirY * sinT)
            );
            obj.p2 = geometry.point(
              centerNew.x - R * (axisDirX * cosT - tanDirX * sinT),
              centerNew.y - R * (axisDirY * cosT - tanDirY * sinT)
            );
          },
          i18next.t('simulator:sceneObjs.common.lengthUnitInfo')
        );
      }
    }

    super.populateObjBar(objBar);
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
        const colorArray = this.scene.simulator.wavelengthToColor(this.wavelength || Simulator.GREEN_WAVELENGTH, 1);
        ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.simulateColors && this.wavelength && this.filter ? colorArray : this.scene.theme.mirror.color);
        ctx.lineWidth = this.scene.theme.mirror.width * ls;
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, a1, a2, (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2));
        ctx.stroke();
        if (isHovered) {
          ctx.fillRect(this.p3.x - 1.5 * ls, this.p3.y - 1.5 * ls, 3 * ls, 3 * ls);
          // Show (paraxial) focal point assuming the axis goes through p3 and is perpendicular to the mirror at p3,
          // i.e. along the radius direction (p3 -> center). For a circular mirror, f ≈ R/2.
          if (isFinite(r) && r > 1e-12) {
            const focusx = (this.p3.x + center.x) * 0.5;
            const focusy = (this.p3.y + center.y) * 0.5;
            ctx.fillRect(focusx - 1.5 * ls, focusy - 1.5 * ls, 3 * ls, 3 * ls);
          }
          ctx.fillStyle = 'rgb(255,0,0)';
          ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
          ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
        }
      } else {
        // The three points on the arc is colinear. Treat as a line segment.
        const colorArray = this.scene.simulator.wavelengthToColor(this.wavelength || Simulator.GREEN_WAVELENGTH, 1);
        ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.simulateColors && this.wavelength && this.filter ? colorArray : this.scene.theme.mirror.color);
        ctx.lineWidth = this.scene.theme.mirror.width * ls;
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.stroke();

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
      return {
        requiresObjBarUpdate: true
      };
    }

    if (this.p2 && !this.p3 && !mouse.snapsOnPoint(this.p1)) {
      if (shift) {
        this.p2 = mouse.getPosSnappedToDirection(this.p1, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
      } else {
        this.p2 = mouse.getPosSnappedToGrid();
      }
      this.p3 = mouse.getPosSnappedToGrid();
      return {
        requiresObjBarUpdate: true
      };
    }
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    if (!this.p3 && !mouse.snapsOnPoint(this.p1)) {
      if (shift) {
        this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
      } else {
        this.p2 = mouse.getPosSnappedToGrid();
      }

      this.p1 = ctrl ? geometry.point(2 * this.constructionPoint.x - this.p2.x, 2 * this.constructionPoint.y - this.p2.y) : this.constructionPoint;

      return {
        requiresObjBarUpdate: true
      };
    }
    if (this.p3) {
      this.p3 = mouse.getPosSnappedToGrid();
      return {
        requiresObjBarUpdate: true
      };
    }
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    if (this.p2 && !this.p3 && !mouse.snapsOnPoint(this.p1)) {
      this.p3 = mouse.getPosSnappedToGrid();
      return {
        requiresObjBarUpdate: true
      };
    }
    if (this.p3 && !mouse.snapsOnPoint(this.p2)) {
      this.p3 = mouse.getPosSnappedToGrid();
      delete this.constructionPoint;
      return {
        isDone: true,
        requiresObjBarUpdate: true
      };
    }
  }

  checkMouseOver(mouse) {
    let dragContext = {};
    if (mouse.isOnPoint(this.p1) && geometry.distanceSquared(mouse.pos, this.p1) <= geometry.distanceSquared(mouse.pos, this.p2) && geometry.distanceSquared(mouse.pos, this.p1) <= geometry.distanceSquared(mouse.pos, this.p3)) {
      dragContext.part = 1;
      dragContext.targetPoint = geometry.point(this.p1.x, this.p1.y);
      dragContext.requiresObjBarUpdate = true;
      return dragContext;
    }
    if (mouse.isOnPoint(this.p2) && geometry.distanceSquared(mouse.pos, this.p2) <= geometry.distanceSquared(mouse.pos, this.p3)) {
      dragContext.part = 2;
      dragContext.targetPoint = geometry.point(this.p2.x, this.p2.y);
      dragContext.requiresObjBarUpdate = true;
      return dragContext;
    }
    if (mouse.isOnPoint(this.p3)) {
      dragContext.part = 3;
      dragContext.targetPoint = geometry.point(this.p3.x, this.p3.y);
      dragContext.requiresObjBarUpdate = true;
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
        dragContext.requiresObjBarUpdate = true;
        return dragContext;
      }
    } else {
      // The three points on the arc is colinear. Treat as a line segment.
      if (mouse.isOnSegment(this)) {
        dragContext.part = 0;
        dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
        dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
        dragContext.snapContext = {};
        dragContext.requiresObjBarUpdate = true;
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

  checkRayIntersects(ray) {
    if (this.checkRayIntersectFilter(ray)) {
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
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    var rx = ray.p1.x - incidentPoint.x;
    var ry = ray.p1.y - incidentPoint.y;
    var mx = this.p2.x - this.p1.x;
    var my = this.p2.y - this.p1.y;

    var center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(this.p1, this.p3)), geometry.perpendicularBisector(geometry.line(this.p2, this.p3)));
    if (isFinite(center.x) && isFinite(center.y)) {
      var cx = center.x - incidentPoint.x;
      var cy = center.y - incidentPoint.y;
      var c_sq = cx * cx + cy * cy;
      var r_dot_c = rx * cx + ry * cy;
      ray.p1 = incidentPoint;
      ray.p2 = geometry.point(incidentPoint.x - c_sq * rx + 2 * r_dot_c * cx, incidentPoint.y - c_sq * ry + 2 * r_dot_c * cy);
    } else {
      // The three points on the arc is colinear. Treat as a line segment.

      var rx = ray.p1.x - incidentPoint.x;
      var ry = ray.p1.y - incidentPoint.y;
      var mx = this.p2.x - this.p1.x;
      var my = this.p2.y - this.p1.y;

      ray.p1 = incidentPoint;
      ray.p2 = geometry.point(incidentPoint.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, incidentPoint.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
    }
  }
};

export default ArcMirror;