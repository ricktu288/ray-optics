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

import geometry from '../geometry.js';
import BaseSceneObj from './BaseSceneObj.js';
import { evaluateLatex } from '../equation.js';
import i18next from 'i18next';

/**
 * The mixin for the scene objects that are defined by a line segment.
 * @template {typeof BaseSceneObj} T
 * @param {T} Base 
 * @returns {T}
 */
const ParamCurveObjMixin = Base => class extends Base {

  static getPropertySchema(objData, scene) {
    return [
      { key: 'origin', type: 'point', label: i18next.t('simulator:sceneObjs.common.coordOrigin') },
      { key: 'pieces', type: 'array',
        label: i18next.t('simulator:sceneObjs.ParamCurveObjMixin.pieces'),
        itemSchema: [
          { key: 'eqnX', type: 'equation', label: 'x(t)', variables: ['t'] },
          { key: 'eqnY', type: 'equation', label: 'y(t)', variables: ['t'] },
          { key: 'tMin', type: 'number', label: 't<sub>min</sub>' },
          { key: 'tMax', type: 'number', label: 't<sub>max</sub>' },
          { key: 'tStep', type: 'number', label: i18next.t('simulator:sceneObjs.ParamCurveObjMixin.step') },
        ],
      },
      ...super.getPropertySchema(objData, scene),
    ];
  }

  constructor(scene, jsonObj) {
    super(scene, jsonObj);
    // Check for unknown keys in pieces
    const knownKeys = ['eqnX', 'eqnY', 'tMin', 'tMax', 'tStep'];
    for (let i = 0; i < this.pieces.length; i++) {
      for (const key in this.pieces[i]) {
        if (!knownKeys.includes(key)) {
          this.scene.error = i18next.t('simulator:generalErrors.unknownObjectKey', { key: `pieces[${i}].${key}`, type: this.constructor.type }); // Here the error is stored in the scene, not the object, to prevent further errors occurring in the object from replacing it, and also because this error likely indicates an incompatible scene version.
        }
      }
    }
  }

  move(diffX, diffY) {
    this.origin.x = this.origin.x + diffX;
    this.origin.y = this.origin.y + diffY;
    
    // Invalidate path after moving
    delete this.path;
    
    return true;
  }
  
  rotate(angle, center) {
    // Use origin as default rotation center if none is provided
    const rotationCenter = center || this.origin;
    
    // Calculate difference from rotation center for origin
    const diff_x = this.origin.x - rotationCenter.x;
    const diff_y = this.origin.y - rotationCenter.y;
    
    // Apply rotation matrix to origin
    this.origin.x = rotationCenter.x + diff_x * Math.cos(angle) - diff_y * Math.sin(angle);
    this.origin.y = rotationCenter.y + diff_x * Math.sin(angle) + diff_y * Math.cos(angle);
    
    // Invalidate path after rotating
    delete this.path;
    
    return false;
  }
  
  scale(scale, center) {
    // Use origin as default scaling center if none is provided
    const scalingCenter = center || this.origin;
    
    // Calculate difference from scaling center for origin
    const diff_x = this.origin.x - scalingCenter.x;
    const diff_y = this.origin.y - scalingCenter.y;
    
    // Apply scaling to origin
    this.origin.x = scalingCenter.x + diff_x * scale;
    this.origin.y = scalingCenter.y + diff_y * scale;
    
    // Invalidate path after scaling
    delete this.path;
    
    return false;
  }
  
  getDefaultCenter() {
    return this.origin;
  }
  
  onConstructMouseDown(mouse, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();
    this.origin.x = mousePos.x;
    this.origin.y = mousePos.y;
    // Invalidate path during construction
    delete this.path;
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    // No movement during construction for point-based objects
    // Invalidate path during construction
    delete this.path;
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    // Invalidate path after construction
    delete this.path;
    return {
      isDone: true
    };
  }

  checkMouseOver(mouse) {
    let dragContext = {};
    
    // Initialize path if needed for non-empty curves
    if (this.pieces.length > 0) {
      if (!this.path) {
        if (!this.initPath()) {
          // If path initialization failed, fall back to origin check
          if (mouse.isOnPoint(this.origin)) {
            const mousePos = mouse.getPosSnappedToGrid();
            dragContext.part = 0;
            dragContext.mousePos0 = mousePos;
            dragContext.mousePos1 = mousePos;
            dragContext.snapContext = {};
            return dragContext;
          }
          return null;
        }
      }
      
      // Check if all points are identical (degenerate curve)
      let allPointsIdentical = true;
      if (this.path.length > 1) {
        const firstPoint = this.path[0];
        for (let i = 1; i < this.path.length; i++) {
          if (Math.abs(this.path[i].x - firstPoint.x) > 1e-10 || 
              Math.abs(this.path[i].y - firstPoint.y) > 1e-10) {
            allPointsIdentical = false;
            break;
          }
        }
      }
      
      // For non-degenerate curves, check if mouse is on the curve
      if (!allPointsIdentical && this.path.length > 1) {
        for (let i = 0; i < this.path.length - 1; i++) {
          var seg = geometry.line(this.path[i], this.path[i + 1]);
          if (mouse.isOnSegment(seg)) {
            const mousePos = mouse.getPosSnappedToGrid();
            dragContext.part = 0;
            dragContext.mousePos0 = mousePos;
            dragContext.mousePos1 = mousePos;
            dragContext.requiresObjBarUpdate = true;
            dragContext.snapContext = {};
            return dragContext;
          }
        }
        return null;
      }
    }
    
    // For empty curves or degenerate curves, check if mouse is on origin
    if (mouse.isOnPoint(this.origin)) {
      const mousePos = mouse.getPosSnappedToGrid();
      dragContext.part = 0;
      dragContext.mousePos0 = mousePos;
      dragContext.mousePos1 = mousePos;
      dragContext.requiresObjBarUpdate = true;
      dragContext.snapContext = {};
      return dragContext;
    }
    
    return null;
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    if (shift) {
      var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
    } else {
      var mousePos = mouse.getPosSnappedToGrid();
      dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
    }

    var mouseDiffX = dragContext.mousePos1.x - mousePos.x; // The X difference between the mouse position now and at the previous moment
    var mouseDiffY = dragContext.mousePos1.y - mousePos.y; // The Y difference between the mouse position now and at the previous moment
    
    // Move the origin
    this.origin.x = this.origin.x - mouseDiffX;
    this.origin.y = this.origin.y - mouseDiffY;
    
    // Update the mouse position
    dragContext.mousePos1 = mousePos;
    
    // Invalidate path after any dragging operation
    delete this.path;
  }

  /**
   * Initialize the path points based on the parametric curve pieces.
   * This method generates points for each piece from tMin to tMax with the given step.
   * @returns {boolean} Whether the initialization was successful.
   */
  initPath() {
    var fns = [];
    try {
      // Compile all the equations
      for (let i = 0; i < this.pieces.length; i++) {
        fns.push({
          fnX: evaluateLatex(this.pieces[i].eqnX),
          fnY: evaluateLatex(this.pieces[i].eqnY)
        });
      }
    } catch (e) {
      delete this.path;
      this.error = e.toString();
      return false;
    }

    this.path = [];
    
    // Generate points for each piece
    for (let pieceIndex = 0; pieceIndex < this.pieces.length; pieceIndex++) {
      const piece = this.pieces[pieceIndex];
      const fn = fns[pieceIndex];
      
      const tMin = piece.tMin;
      const tMax = piece.tMax;
      const tStep = piece.tStep;
      
      if (!(tStep > 0)) {
        delete this.path;
        this.error = i18next.t('simulator:sceneObjs.ParamCurveObjMixin.error.invalidStepSize', { step: tStep });
        return false;
      }
      
      if (!(tMin < tMax)) {
        delete this.path;
        this.error = i18next.t('simulator:sceneObjs.ParamCurveObjMixin.error.invalidRange', { tMin: tMin, tMax: tMax });
        return false;
      }
      
      // Always sample t=tMin
      try {
        const x = fn.fnX({ t: tMin });
        const y = fn.fnY({ t: tMin });
        
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          throw new Error(i18next.t('simulator:sceneObjs.ParamCurveObjMixin.error.nonFiniteCoords', { t: tMin, x: x, y: y }));
        }
        
        this.path.push({
          x: this.origin.x + x,
          y: this.origin.y + y,
          pieceIndex: pieceIndex,
          t: tMin
        });
      } catch (e) {
        delete this.path;
        this.error = i18next.t('simulator:sceneObjs.ParamCurveObjMixin.error.pieceError', { pieceIndex: pieceIndex + 1, t: tMin, error: e.toString() });
        return false;
      }
      
      // Sample intermediate points
      for (let t = tMin + tStep; t < tMax; t += tStep) {
        try {
          const x = fn.fnX({ t: t });
          const y = fn.fnY({ t: t });
          
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error(i18next.t('simulator:sceneObjs.ParamCurveObjMixin.error.nonFiniteCoords', { x: x, y: y }));
          }
          
          this.path.push({
            x: this.origin.x + x,
            y: this.origin.y + y,
            pieceIndex: pieceIndex,
            t: t
          });
        } catch (e) {
          delete this.path;
          this.error = i18next.t('simulator:sceneObjs.ParamCurveObjMixin.error.pieceError', { pieceIndex: pieceIndex + 1, t: t, error: e.toString() });
          return false;
        }
      }
      
      // Always sample t=tMax (unless it's the same as tMin)
      if (tMax > tMin) {
        try {
          const x = fn.fnX({ t: tMax });
          const y = fn.fnY({ t: tMax });
          
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error(i18next.t('simulator:sceneObjs.ParamCurveObjMixin.error.nonFiniteCoords', { t: tMax, x: x, y: y }));
          }
          
          this.path.push({
            x: this.origin.x + x,
            y: this.origin.y + y,
            pieceIndex: pieceIndex,
            t: tMax
          });
        } catch (e) {
          delete this.path;
          this.error = i18next.t('simulator:sceneObjs.ParamCurveObjMixin.error.pieceError', { pieceIndex: pieceIndex + 1, t: tMax, error: e.toString() });
          return false;
        }
      }
    }
    
    this.error = null;
    return true;
  }

  /**
   * Draw the parametric curve path on the canvas.
   * This method sets up the canvas path but does not stroke or fill it.
   * @param {CanvasRenderer} canvasRenderer - The canvas renderer
   * @param {number} offset - Optional offset distance perpendicular to the curve (positive = left side)
   */
  drawPath(canvasRenderer, offset = 0) {
    const ctx = canvasRenderer.ctx;
    
    if (!this.path || this.path.length === 0) {
      return;
    }
    
    if (offset === 0) {
      // No offset - draw the original path
      ctx.beginPath();
      ctx.moveTo(this.path[0].x, this.path[0].y);
      
      for (let i = 1; i < this.path.length; i++) {
        ctx.lineTo(this.path[i].x, this.path[i].y);
      }
    } else {
      // Draw offset path
      ctx.beginPath();
      let hasPath = false;
      
      for (let i = 0; i < this.path.length - 1; i++) {
        const p1 = this.path[i];
        const p2 = this.path[i + 1];
        
        // Calculate the perpendicular vector (normal to the segment)
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 1e-10) {
          // Normalize the perpendicular vector
          const perpX = -dy / length;
          const perpY = dx / length;
          
          // Calculate offset points
          const offsetP1x = p1.x + perpX * offset;
          const offsetP1y = p1.y + perpY * offset;
          const offsetP2x = p2.x + perpX * offset;
          const offsetP2y = p2.y + perpY * offset;

          if (!hasPath) {
            ctx.moveTo(offsetP1x, offsetP1y);
            hasPath = true;
          }
          ctx.lineTo(offsetP2x, offsetP2y);
        }
      }
    }
  }

  /**
   * Check if the parametric curve is closed (first point matches last point within floating point error).
   * Lazy-generates the path if needed.
   * @returns {boolean} True if the curve is closed, false otherwise
   */
  isClosed() {
    // Initialize path if needed
    if (!this.path) {
      if (!this.initPath()) {
        return false;
      }
    }
    
    if (this.path.length < 2) {
      return false;
    }
    
    const firstPoint = this.path[0];
    const lastPoint = this.path[this.path.length - 1];
    
    // Check if first and last points are within floating point error
    const tolerance = 1e-10;
    const dx = Math.abs(firstPoint.x - lastPoint.x);
    const dy = Math.abs(firstPoint.y - lastPoint.y);
    
    return dx < tolerance && dy < tolerance;
  }

  /**
   * Check if the parametric curve is positively oriented (clockwise in the computer graphics coordinate system).
   * Uses the shoelace formula to calculate signed area.
   * Lazy-generates the path if needed.
   * @returns {boolean} True if the curve is positively oriented false otherwise
   */
  isPositivelyOriented() {
    // Initialize path if needed
    if (!this.path) {
      if (!this.initPath()) {
        return false;
      }
    }
    
    if (this.path.length < 3) {
      return false;
    }
    
    // Calculate signed area using the shoelace formula
    let signedArea = 0;
    
    for (let i = 0; i < this.path.length - 1; i++) {
      const p1 = this.path[i];
      const p2 = this.path[i + 1];
      signedArea += (p1.x - p2.x) * (p1.y + p2.y);
    }
    
    return signedArea > 0;
  }

  /**
   * Check if a point is outside the parametric curve (using crossing number algorithm).
   * Lazy-generates the path if needed.
   * @param {Point} point - The point to test
   * @returns {boolean} True if the point is outside the curve, false otherwise
   */
  isOutside(point) {
    // Initialize path if needed
    if (!this.path) {
      if (!this.initPath()) {
        return false;
      }
    }

    return (!this.isOnBoundary(point) && this.countIntersections(point) % 2 === 0);
  }

  /**
   * Check if a point is inside the parametric curve (using crossing number algorithm).
   * Lazy-generates the path if needed.
   * @param {Point} point - The point to test
   * @returns {boolean} True if the point is inside the curve, false otherwise
   */
  isInside(point) {
    // Initialize path if needed
    if (!this.path) {
      if (!this.initPath()) {
        return false;
      }
    }
    
    return (!this.isOnBoundary(point) && this.countIntersections(point) % 2 === 1);
  }

  /**
   * Check if a point is on the boundary of the parametric curve.
   * Uses distance-based approach similar to checkMouseOver for robustness.
   * Lazy-generates the path if needed.
   * @param {Point} point - The point to test
   * @returns {boolean} True if the point is on the boundary, false otherwise
   */
  isOnBoundary(point) {
    // Initialize path if needed
    if (!this.path) {
      if (!this.initPath()) {
        return false;
      }
    }
    
    if (this.path.length < 2) {
      return false;
    }
    
    // Check distance to each segment, similar to checkMouseOver approach
    for (let i = 0; i < this.path.length - 1; i++) {
      const p1 = this.path[i];
      const p2 = this.path[i + 1];
      
      // Skip degenerate segments
      const segLengthSq = geometry.distanceSquared(p1, p2);
      if (segLengthSq < 1e-20) continue;
      
      // Calculate distance from point to line segment
      const seg = geometry.line(p1, p2);
      const distToSeg = this.distancePointToSegment(point, seg);
      
      if (distToSeg <= this.intersectTol) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calculate distance from a point to a line segment.
   * @param {Point} point - The point
   * @param {Line} segment - The line segment
   * @returns {number} Distance from point to segment
   */
  distancePointToSegment(point, segment) {
    const p1 = segment.p1;
    const p2 = segment.p2;
    
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSq = dx * dx + dy * dy;
    
    if (lengthSq < 1e-20) {
      // Degenerate segment - return distance to point
      return geometry.distance(point, p1);
    }
    
    // Calculate parameter t for closest point on line
    let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lengthSq;
    
    // Clamp t to [0,1] to stay within segment
    t = Math.max(0, Math.min(1, t));
    
    // Calculate closest point on segment
    const closestX = p1.x + t * dx;
    const closestY = p1.y + t * dy;
    
    // Return distance to closest point
    return geometry.distance(point, geometry.point(closestX, closestY));
  }

  /**
   * Count intersections between a horizontal ray from the point and the parametric curve.
   * Uses a more robust crossing number algorithm that handles dense/repeated points.
   * Lazy-generates the path if needed.
   * @param {Point} point - The point from which to cast the horizontal ray
   * @returns {number} Number of intersections with the curve boundary
   */
  countIntersections(point) {
    // Initialize path if needed
    if (!this.path) {
      if (!this.initPath()) {
        return 0;
      }
    }
    
    if (this.path.length < 2) {
      return 0;
    }
    
    var cnt = 0;
    const rayY = point.y;
    const rayStartX = point.x;
    
    for (let i = 0; i < this.path.length - 1; i++) {
      let p1 = this.path[i];
      let p2 = this.path[i + 1];
      
      // Skip degenerate segments  
      if (geometry.distanceSquared(p1, p2) < 1e-20) continue;
      
      // Ensure p1.y <= p2.y for consistent crossing detection
      if (p1.y > p2.y) {
        [p1, p2] = [p2, p1];
      }
      
      // Check if ray intersects this segment's y range
      if (rayY > p2.y || rayY <= p1.y) continue;
      
      // Calculate x intersection point
      let intersectX;
      if (Math.abs(p2.y - p1.y) < 1e-10) {
        // Nearly horizontal segment - skip to avoid numerical issues
        continue;
      } else {
        // Calculate intersection x-coordinate
        const t = (rayY - p1.y) / (p2.y - p1.y);
        intersectX = p1.x + t * (p2.x - p1.x);
      }
      
      // Check if intersection is to the right of the point
      if (intersectX > rayStartX) {
        cnt++;
      }
    }
    
    return cnt;
  }

  /**
   * Populate the object bar with parametric curve controls.
   * This method should be called from populateObjBar in subclasses.
   * @param {ObjBar} objBar - The object bar instance
   */
  populateObjBarShape(objBar) {
    const showSubscripts = this.pieces.length >= 2;
    
    // Create individual equations for each piece
    for (let i = 0; i < this.pieces.length; i++) {
      const pieceIndex = i + 1; // 1-based indexing for display
      const currentIndex = i; // Capture the current index for closure
      
      // Create equation labels with or without subscripts
      const xLabel = showSubscripts ? `x<sub>${pieceIndex}</sub>(t) =` : 'x(t) =';
      const yLabel = showSubscripts ? `y<sub>${pieceIndex}</sub>(t) =` : 'y(t) =';
      
      // Create X equation
      objBar.createEquation(xLabel, this.pieces[i].eqnX, function (obj, value) {
        obj.pieces[currentIndex].eqnX = value;
        // Invalidate path when equation changes
        delete obj.path;
      });
      
      // Create Y equation  
      objBar.createEquation(yLabel, this.pieces[i].eqnY, function (obj, value) {
        obj.pieces[currentIndex].eqnY = value;
        // Invalidate path when equation changes
        delete obj.path;
      });
      
      // Create tMin input (number without slider)
      objBar.createNumber('', -Infinity, Infinity, 0.01, this.pieces[i].tMin, function (obj, value) {
        obj.pieces[currentIndex].tMin = value;
        // Invalidate path when parameter changes
        delete obj.path;
      }, null, true);
      
      // Create tMax input (number without slider)
      objBar.createNumber(' < t < ', -Infinity, Infinity, 0.01, this.pieces[i].tMax, function (obj, value) {
        obj.pieces[currentIndex].tMax = value;
        // Invalidate path when parameter changes
        delete obj.path;
      }, null, true);
      
      // Add "Step" label and input
      objBar.createNumber(i18next.t('simulator:sceneObjs.ParamCurveObjMixin.step'), 0.001, 1, 0.001, this.pieces[i].tStep, function (obj, value) {
        obj.pieces[currentIndex].tStep = value;
        // Invalidate path when parameter changes
        delete obj.path;
      }, null, true);
    }
    
    // Add "+" button to add new piece
    objBar.createButton(i18next.t('simulator:sceneObjs.ParamCurveObjMixin.addPiece'), function (obj) {
      obj.pieces.push({
        eqnX: "0",
        eqnY: "0", 
        tMin: 0,
        tMax: 1,
        tStep: 0.01
      });
      // Invalidate path when pieces change
      delete obj.path;
    }, true, `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
      <path d="M2 7.5h5.5V2h1v5.5H14v1H8.5V14h-1V8.5H2v-1z"/>
    </svg>
    `);
    
    // Only show "-" button if there are multiple pieces
    if (this.pieces.length >= 2) {
      objBar.createButton(i18next.t('simulator:sceneObjs.ParamCurveObjMixin.removePiece'), function (obj) {
        if (obj.pieces.length > 0) {
          obj.pieces.pop();
          // Invalidate path when pieces change
          delete obj.path;
        }
      }, true, `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M2 7.5h12v1H2z"/>
      </svg>
      `);
    }

    // Add origin control
    objBar.createTuple(i18next.t('simulator:sceneObjs.common.coordOrigin'), '(' + this.origin.x + ',' + this.origin.y + ')', function (obj, value) {
      const commaPosition = value.indexOf(',');
      if (commaPosition != -1) {
        const origin_x = parseFloat(value.slice(1, commaPosition));
        const origin_y = parseFloat(value.slice(commaPosition + 1, -1));
        obj.origin = geometry.point(origin_x, origin_y);
        // Invalidate path when origin changes
        delete obj.path;
      }
    });
  }

  /**
   * Get all ray intersections with the parametric curve.
   * Returns an array of intersection data with normal vectors and incident types
   * consistent with CustomArcSurface conventions for counterclockwise arcs.
   * @param {Ray} ray - The ray to check intersections with
   * @returns {Array} Array of intersection objects with properties:
   *   - s_point: intersection point
   *   - normal: {x, y} normal vector
   *   - incidentType: 1 (inside to outside), -1 (outside to inside), or NaN
   *   - incidentPiece: piece index (0-based)
   *   - incidentPos: parameter t value of the intersection
   */
  getRayIntersections(ray) {
    const intersections = [];
    
    // Initialize path if needed
    if (!this.path) {
      if (!this.initPath()) {
        return intersections;
      }
    }
    
    if (this.path.length < 2) {
      return intersections;
    }
    
    // Check each segment in the path
    for (let i = 0; i < this.path.length - 1; i++) {
      const p1 = this.path[i];
      const p2 = this.path[i + 1];
      
      // Check for ray intersection with this segment
      const rp_temp = geometry.linesIntersection(
        geometry.line(ray.p1, ray.p2), 
        geometry.line(p1, p2)
      );
      
      if (geometry.intersectionIsOnSegment(rp_temp, geometry.line(p1, p2)) && 
          geometry.intersectionIsOnRay(rp_temp, ray) && 
          geometry.distanceSquared(ray.p1, rp_temp) > 1e-10) {
        
        // Linear interpolation to find exact t value within the segment
        const segmentLength = geometry.distance(p1, p2);
        const intersectionDist = geometry.distance(p1, rp_temp);
        const segmentRatio = segmentLength > 1e-10 ? intersectionDist / segmentLength : 0;
        const incidentPos = p1.t + (p2.t - p1.t) * segmentRatio;
        
        // Calculate tangent vector (direction of parametric curve)
        const tangentX = p2.x - p1.x;
        const tangentY = p2.y - p1.y;
        const tangentLength = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
        
        let normal, incidentType;
        
        if (tangentLength > 1e-10) {
          // Normalize tangent
          const tangentNormX = tangentX / tangentLength;
          const tangentNormY = tangentY / tangentLength;
          
          // Calculate incident type using cross product (consistent with CustomArcSurface)
          // For counterclockwise convention: positive cross product = inside to outside
          const rcrosst = (ray.p2.x - ray.p1.x) * tangentNormY - (ray.p2.y - ray.p1.y) * tangentNormX;
          
          if (rcrosst > 1e-10) {
            incidentType = 1; // From inside to outside
          } else if (rcrosst < -1e-10) {
            incidentType = -1; // From outside to inside
          } else {
            incidentType = NaN; // Parallel/tangent
          }
          
          // Calculate basic normal for this segment
          const rdots = (ray.p2.x - ray.p1.x) * tangentNormX + (ray.p2.y - ray.p1.y) * tangentNormY;

          const normal_x = rdots * tangentNormX - (ray.p2.x - ray.p1.x);
          const normal_y = rdots * tangentNormY - (ray.p2.y - ray.p1.y);
          
          // Smooth out the normal vector so that image detection works.
          // This approach is slightly different from the one in CustomMirror.js,
          // Still, the error is first order, and a better approach is still desired.
          
          // Calculate fraction along the segment
          var frac;
          if (Math.abs(tangentX) > Math.abs(tangentY)) {
            frac = (rp_temp.x - p1.x) / tangentX;
          } else {
            frac = (rp_temp.y - p1.y) / tangentY;
          }
          
          var normal_xFinal = normal_x;
          var normal_yFinal = normal_y;
          
          // Apply smoothing if not at the endpoints and we have adjacent segments
          if ((i > 0 && frac < 0.5) || (i < this.path.length - 2 && frac >= 0.5)) {
            var segA;
            if (frac < 0.5 && i > 0) {
              segA = geometry.line(this.path[i - 1], this.path[i]);
            } else if (frac >= 0.5 && i < this.path.length - 2) {
              segA = geometry.line(this.path[i + 1], this.path[i + 2]);
            }
            
            if (segA) {
              var tangentAX = segA.p2.x - segA.p1.x;
              var tangentAY = segA.p2.y - segA.p1.y;
              var tangentALength = Math.sqrt(tangentAX * tangentAX + tangentAY * tangentAY);
              
              // Apply normal smoothing only if the length of the adjacent segments are comparable
              // This is to avoid wrong direction at discontinuities (although most use cases should not have this problem)
              if (tangentALength / tangentLength < 10 && tangentLength / tangentALength < 10) {
                var tangentANormX = tangentAX / tangentALength;
                var tangentANormY = tangentAY / tangentALength;
                
                var rdotsA = (ray.p2.x - ray.p1.x) * tangentANormX + (ray.p2.y - ray.p1.y) * tangentANormY;

                var normal_xA = rdotsA * tangentANormX - (ray.p2.x - ray.p1.x);
                var normal_yA = rdotsA * tangentANormY - (ray.p2.y - ray.p1.y);
                
                // Blend the normals
                if (frac < 0.5) {
                  normal_xFinal = normal_x * (0.5 + frac) + normal_xA * (0.5 - frac);
                  normal_yFinal = normal_y * (0.5 + frac) + normal_yA * (0.5 - frac);
                } else {
                  normal_xFinal = normal_xA * (frac - 0.5) + normal_x * (1.5 - frac);
                  normal_yFinal = normal_yA * (frac - 0.5) + normal_y * (1.5 - frac);
                }
              }
            }
          }
          
          const normal_len = Math.sqrt(normal_xFinal * normal_xFinal + normal_yFinal * normal_yFinal);
          normal = {
            x: normal_xFinal / normal_len,
            y: normal_yFinal / normal_len
          };
        } else {
          // Tangent length too small - degenerate segment
          incidentType = NaN;
          normal = {
            x: NaN,
            y: NaN
          };
        }
        
        intersections.push({
          s_point: geometry.point(rp_temp.x, rp_temp.y),
          normal: normal,
          incidentType: incidentType,
          incidentPiece: p1.pieceIndex,
          incidentPos: incidentPos
        });
      }
    }
    
    return intersections;
  }
};

export default ParamCurveObjMixin;