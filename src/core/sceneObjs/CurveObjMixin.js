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

import i18next from 'i18next';
import geometry from '../geometry.js';
import Simulator from '../Simulator.js';
import Bezier from 'bezier-js';

/**
 * The mixin for the scene objects that are defined by a circle.
 * @template {typeof BaseSceneObj} T
 * @param {T} Base 
 * @returns {T}
 */
const CurveObjMixin = Base => class extends Base {
  
  /**
   * @param {Scene} scene - The scene the object belongs to.
   * @param {Object|null} jsonObj - The JSON object to be deserialized, if any.
   */
  constructor(scene, jsonObj) {
    super(scene, jsonObj);

    const points_in_curve = 4

    // Reset curLens to account for potential unfinished lenses
    // this.curLens = -1;

    // Initialize curve
    this.curve = null;

    // Add toggle switch for whether or not to display control points and the lines which connect them to anchor points
    this.displayControlPoints = true;

    // Extrapolate the (unoptimized) object from the (optimized) JSON object.
    if (jsonObj.points) {
      // Check to make sure there's the correct number of points
      if (jsonObj.points.length === 4) {
        this.curve = new Bezier(jsonObj.points);
        //this.p1 = jsonObj.points[0];
        //this.p2 = jsonObj.points[3];
      } else {
        console.error("Curve could not be created; jsonObj does not contain array \"points\" of length " + String(points_in_curve) + ".");
      }
    }
  }

  /**
   * Serializes the object to a JSON object.
   * @returns {Object} The serialized JSON object.
   */
  serialize() {
    let jsonObj = super.serialize();

    // Remove redundant properties of the JSON representation of the object.
    if (this.curve) {
      // For each lens in modular/composite lens
      jsonObj.points = JSON.parse(JSON.stringify(this.curve)).points.slice(0, 4);
    } else {
      jsonObj.points = [];  // Empty
    }
    delete jsonObj.curve;

    return jsonObj;
  }

  /**
   * Move the object diffX in the x (right/left) direction and diffY in the Y (down/up) direction
   * @param {number} diffX 
   * @param {number} diffY 
   */
  move(diffX, diffY) {
    // Move curve points
    for (let i = 0; i < this.curve.points.length; i++) {
      this.curve.points[i].x += diffX;
      this.curve.points[i].y += diffY;
    }
    this.curve = new Bezier(this.curve.points);
  }

  /**
   * Rotate the curved object about a center
   * @param {number} angle 
   * @param {Point} center 
   * @returns 
   */
  rotate(angle, center) {
    // Use center of object as default rotation center if none is provided
    const rotationCenter = center || this.getDefaultCenter();

    // Initialize temp variables for use applying rotations to each point
    var cur_diff_x = 0;
    var cur_diff_y = 0;
    const points_in_curve = 4;  // number of points in a curve is constant, so no need to acquire it by referencing the current curve (e.g. below)

    // Apply rotation to all path and curve points in the object
    for (let i = 0; i < points_in_curve; i++) {
      // Calculate the current difference for the current curve point
      cur_diff_x = this.curve.points[i].x - rotationCenter.x;
      cur_diff_y = this.curve.points[i].y - rotationCenter.y; 

      this.curve.points[i].x = rotationCenter.x + cur_diff_x * Math.cos(angle) - cur_diff_y * Math.sin(angle);
      this.curve.points[i].y = rotationCenter.y + cur_diff_x * Math.sin(angle) + cur_diff_y * Math.cos(angle);
    }

    // Update the current curve
    this.curve = new Bezier(this.curve.points);

    // Update anchor points
    //this.p1 = this.curve.points[0];
    //this.p2 = this.curve.points[3];
    
    return true;
  }
  
  scale(scale, center) {
    // Use center of object as default scaling center if none is provided
    const scalingCenter = center || this.getDefaultCenter();

    // Initialize temp variables for use applying scaling to each point
    var cur_diff_x = 0;
    var cur_diff_y = 0;
    const points_in_curve = 4;  // number of points in a curve is constant, so no need to acquire it by referencing the current curve (e.g. below)

    // Apply scaling to the curve's points
    for (let i = 1; i < points_in_curve; i++) {
      // Calculate the current difference for the current curve point
      cur_diff_x = this.curve.points[i].x - scalingCenter.x;
      cur_diff_y = this.curve.points[i].y - scalingCenter.y; 

      this.curve.points[i].x = scalingCenter.x + cur_diff_x * scale;
      this.curve.points[i].y = scalingCenter.y + cur_diff_y * scale;
    }

    // Update the current curve
    this.curve = new Bezier(this.curve.points);

    // Update anchor points
    //this.p1 = this.curve.points[0];
    //this.p2 = this.curve.points[3];
    
    return true;
  }
  
  /**
   * Calculate the default center of the curved object as the average position of all shared anchor points.
   * @returns {Point}
   */
  getDefaultCenter() {
    return {
      x: Math.round((this.curve.points[0].x + this.curve.points[3].x) / 2),
      y: Math.round((this.curve.points[3].y + this.curve.points[0].y) / 2)
    };
  }
  
  onConstructMouseDown(mouse, ctrl, shift) {
    if (!this.constructionPoint) {
      this.constructionPoint = mouse.getPosSnappedToGrid();
      this.p1 = this.constructionPoint;
      this.p2 = this.constructionPoint;
    } 
    if (shift) {
      this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
    } else {
      this.p2 = mouse.getPosSnappedToGrid();
    }
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    if (shift) {
      this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
    } else {
      this.p2 = mouse.getPosSnappedToGrid();
    }

    this.p1 = ctrl ? geometry.point(2 * this.constructionPoint.x - this.p2.x, 2 * this.constructionPoint.y - this.p2.y) : this.constructionPoint;
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    if (!mouse.snapsOnPoint(this.p1)) {
      // Set default control points to be partially in between the anchor points
      this.curve = new Bezier(
        this.p1,
        {
          x: Math.round(0.25 * (this.p2.x - this.p1.x)) + this.p1.x,
          y: Math.round(0.25 * (this.p2.y - this.p1.y)) + this.p1.y
        },
        {
          x: Math.round(0.25 * (this.p1.x - this.p2.x)) + this.p2.x,
          y: Math.round(0.25 * (this.p1.y - this.p2.y)) + this.p2.y
        },
        this.p2
      );
      delete this.p1;
      delete this.p2;
      delete this.constructionPoint;
      return {
        isDone: true
      };
    }
  }

  checkMouseOver(mouse) {
    let dragContext = {};

    const mousePos = mouse.getPosSnappedToGrid();
    dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
    dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
    dragContext.snapContext = {};
    
    // Check if on curve point
    for (let i = 0; i < this.curve.points.length; i ++) {
      if (mouse.isOnPoint(this.curve.points[i])) {
        dragContext.part = 1;
        dragContext.targetPoint = this.curve.points[i];
        return dragContext;
      }
    }
    // On the curve itself
    if (mouse.isOnCurve(geometry.curve(this.curve.points))) {
      dragContext.part = 0;
      return dragContext;
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    var mousePos;
    if (dragContext.part > 0 && dragContext.part < 5) {
      // Dragging one of the control points
      if (shift) {
        mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
      } else {
        mousePos = mouse.getPosSnappedToGrid();
        dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
      }
      this.curve.points[dragContext.part - 1].x = mousePos.x;
      this.curve.points[dragContext.part - 1].y = mousePos.y;
      //this.curves[dragContext.lens][dragContext.index].update();

      this.curve = new Bezier(this.curve.points);
    }
    if (dragContext.part === 0) {
      if (shift) {
        mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
      } else {
        mousePos = mouse.getPosSnappedToGrid();
        dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
      }
      this.move(mousePos.x - dragContext.mousePos1.x, mousePos.y - dragContext.mousePos1.y);
      dragContext.mousePos1 = mousePos;
    }
  }

  /**
   * Check if a ray intersects the curve.
   * In the child class, this can be called from the `checkRayIntersects` method.
   * @param {Ray} ray - The ray.
   * @returns {Point} - The (first) intersection point, or null if none
   */
  checkRayIntersectsShape(ray) {
    var rp_temps = geometry.lineCurveIntersections(geometry.line(ray.p1, ray.p2), this.curve);
    
    if (rp_temps) {
      return rp_temps[0];
    }
    return null;
  }


  // Draw curve
  drawCurve(curve, offset, canvasRenderer) {
    const ctx = canvasRenderer.ctx;
    var p = curve.points;
    ctx.strokeStyle = 'rgb(128,128,128)';
    ctx.beginPath();
    //ctx.moveTo(p[0].x + offset.x, p[0].y + offset.y);
    ctx.moveTo(p[0].x, p[0].y);
    //ctx.bezierCurveTo(p[1].x + offset.x, p[1].y + offset.y, p[2].x + offset.x, p[2].y + offset.y, p[3].x + offset.x, p[3].y + offset.y);
    ctx.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y);
    ctx.stroke();
    ctx.closePath();

    ctx.strokeStyle = 'rgb(255,0,0)';
    this.drawLine(p[0], p[1], offset, canvasRenderer);
    this.drawLine(p[2], p[3], offset, canvasRenderer);

    ctx.fillStyle = 'rgb(255,0,0)';
    p.forEach((cur) => this.drawPoint(cur, canvasRenderer));
  }

  // Draw line
  drawLine(p1, p2, offset, canvasRenderer) {
    const ctx = canvasRenderer.ctx;
    ctx.beginPath();
    //ctx.moveTo(p1.x + offset.x, p1.y + offset.y);
    //ctx.lineTo(p2.x + offset.x, p2.y + offset.y);
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // Draw point
  drawPoint(p1, canvasRenderer) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;
    ctx.fillRect(p1.x - 1.5 * ls, p1.y - 1.5 * ls, 3 * ls, 3 * ls);
  }
}
