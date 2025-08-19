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
import i18next from 'i18next';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';
import { Bezier } from 'bezier-js';

/**
 * Glass of the shape consists of Bezier curves.
 * 
 * Tools -> Glass -> Cubic Bezier Curves
 * @class
 * @extends BaseGlass
 * @memberof sceneObjs
 * @property {Array<object>} path - The path of the glass, connecting each curve. Each element is an object with `x` and `y` properties for coordinates.
 * @property {Array<object>} curves - The curves connected in series along the path. Each element is an object represented by a `Bezier` object whose points (a_1, c_1, c_2, a_2) may be acquired via `object_name.points`. Any modification to these points requires creation of a new `Bezier` object defined by those points (e.g. `new Bezier(a_1, c_1, c_2, a_2)`).
 * @property {Array<object>} bboxes - Bounding boxes of the curves. Calculated and stored whenever a curve is created. Used to prevent unnecesary recalculation of bounding boxes of curves.
 * @property {boolean} notDone - Whether the user is still drawing the path of the glass.
 * @property {number} refIndex - The refractive index of the glass, or the Cauchy coefficient A of the glass if "Simulate Colors" is on.
 * @property {number} cauchyB - The Cauchy coefficient B of the glass if "Simulate Colors" is on, in micrometer squared.
 * @property {number} intersectTol - Tolerance for intersection calculations (unit: pixels).
 */
class CurveGlass extends BaseGlass {
  static type = 'CurveGlass';
  static isOptical = true;
  static mergesWithGlass = true;
  static serializableDefaults = {
    points: [],
    notDone: false,
    displayControlPoints: true,
    refIndex: 1.5,
    cauchyB: 0.004,
    intersectTol: 0.05
  }
  
  /**
   * @param {Scene} scene - The scene the object belongs to.
   * @param {Object|null} jsonObj - The JSON object to be deserialized, if any.
   */
  constructor(scene, jsonObj) {
    super(scene, jsonObj);

    // Initialize curves and bboxes
    this.curves = [];
    this.bboxes = [];

    // Add toggle switch for whether or not to display control points and the lines which connect them to anchor points
    this.displayControlPoints = true;

    console.log("DEBUG: CONSTRUCTOR CALLED: ");
    console.log(jsonObj);

    // Extrapolate the (unoptimized) object from the (optimized) JSON object.
    // NOTE: The "curves" and "path" properties should eventually be combined and optimized to be consistent with the JSON representation.
    if (jsonObj.points) {
      // Add new curve
      //this.curves.push([]);

      // Go through each of the curves in the current lens
      for (let curCurve = 0; curCurve < jsonObj.points.length; curCurve++) {
        // The first point is the first anchor point, the second two control points, and the first of the next curve the last anchor point
        this.newCurve(
          [ 
            jsonObj.points[curCurve].a1, 
            jsonObj.points[curCurve].c1, 
            jsonObj.points[curCurve].c2, 
            jsonObj.points[(curCurve + 1) % jsonObj.points.length].a1
          ], 
          -1
        );
      }
      //  this.curLens++;
      //}
    } 
  }

  /**
   * Serializes the object to a JSON object.
   * @returns {Object} The serialized JSON object.
   */
  serialize() {
    let jsonObj = super.serialize();

    // Remove redundant properties of the JSON representation of the object.
    if (this.curves) {
      jsonObj.points = this.curves.map(curve => {
        // Get the first three points of the curve
        const pts = JSON.parse(JSON.stringify(curve)).points.slice(0, 3).map(pts => {
          // Get only the x and y, not the t and d
          return geometry.point(pts.x, pts.y);
        });
        return {
          a1: pts[0],
          c1: pts[1],
          c2: pts[2]
        };
      });
    } else {
      // Empty if no curves or in middle of construction
      jsonObj.points = [];
    }
    delete jsonObj.curves;
    if (jsonObj.path) delete jsonObj.path;

    console.log("Final: " + JSON.stringify(jsonObj));

    return jsonObj;
  }

  populateObjectBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.CurveGrinGlass.title'));
    objBar.createBoolean(i18next.t('simulator:sceneObjs.CurveGlass.displayControlPoints'), this.displayControlPoints, function (obj, value) {
      obj.displayControlPoints = value;
    }, i18next.t('simulator:sceneObjs.CurveGlass.displayControlPoints'), true);
    super.populateObjBar(objBar);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    // Draw lens as it's being drawn
    if (this.notDone) {
      // Ensure the path exists before attempting to draw it
      if (this.path) {
        // The user has not finished drawing the object yet
        ctx.beginPath();
        ctx.moveTo(this.path[0].x, this.path[0].y);

        for (var i = 0; i < this.path.length - 1; i++) {
          ctx.lineTo(this.path[(i + 1)].x, this.path[(i + 1)].y);
          this.drawPoint(this.path[i], canvasRenderer);
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgb(128,128,128)';
        ctx.lineWidth = 1 * ls;
        ctx.stroke();
      }
    } else {
      // The user has completed drawing the object
      ctx.beginPath();
      ctx.moveTo(this.curves[0].points[0].x, this.curves[0].points[0].y);

      for (var i = 0; i < this.curves.length; i++) {
        this.drawCurve(this.curves[i], canvasRenderer);
      }
      this.fillGlass(canvasRenderer, isAboveLight, isHovered);
    }
    ctx.lineWidth = 1;
  }

  /**
   * Move the object diffX in the x (right/left) direction and diffY in the Y (down/up) direction
   * @param {number} diffX 
   * @param {number} diffY 
   */
  move(diffX, diffY) {
    // Each curve in lens
    for (let i = 0; i < this.curves.length; i++) {
      // Move path points
      //this.path[i].x += diffX;
      //this.path[i].y += diffY;

      // Move curve points
      for (let j = 0; j < this.curves[i].points.length; j++) {
        this.curves[i].points[j].x += diffX;
        this.curves[i].points[j].y += diffY;
      }
      //this.curves[i].update();
      this.newCurve(this.curves[i].points, i);
    }
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
    const points_in_curve = 4;  // number of points in a curve is constant, so no need to acquire it by referencing the current curve (e.g. below)

    // Initialize temp variables for use applying rotations to each point
    var cur_diff_x = 0;
    var cur_diff_y = 0;

    // Apply rotation to all curve points in the object
    for (let i = 0; i < this.curve.length; i++) {    // path length should equal curve length, hence they are effectively interchangeable here
      // Apply rotation to the rest of the current curve's points
      for (let j = 0; j < points_in_curve; j++) {
        // Calculate the current difference for the current curve point
        cur_diff_x = this.curves[i].points[j].x - rotationCenter.x;
        cur_diff_y = this.curves[i].points[j].y - rotationCenter.y; 

        this.curves[i].points[j].x = rotationCenter.x + cur_diff_x * Math.cos(angle) - cur_diff_y * Math.sin(angle);
        this.curves[i].points[j].y = rotationCenter.y + cur_diff_x * Math.sin(angle) + cur_diff_y * Math.cos(angle);
      }

      // Update the current curve
      this.newCurve(this.curves[i].points, i);
    }
    
    return true;
  }
  
  scale(scale, center) {
    // Use center of object as default scaling center if none is provided
    const scalingCenter = center || this.getDefaultCenter();

    // Initialize temp variables for use applying scaling to each point
    var cur_diff_x = 0;
    var cur_diff_y = 0;
    const points_in_curve = 4;  // number of points in a curve is constant, so no need to acquire it by referencing the current curve (e.g. below)

    // Apply scaling to all curve points in the object
    for (let i = 0; i < this.curves.length; i++) {    // path length should equal curve length, hence they are effectively interchangeable here
      // Apply scaling to the rest of the current curve's points
      for (let j = 0; j < points_in_curve; j++) {
        // Calculate the current difference for the current curve point
        cur_diff_x = this.curves[i].points[j].x - scalingCenter.x;
        cur_diff_y = this.curves[i].points[j].y - scalingCenter.y; 

        this.curves[i].points[j].x = scalingCenter.x + cur_diff_x * scale;
        this.curves[i].points[j].y = scalingCenter.y + cur_diff_y * scale;
      }

      // Update the current curve
      this.newCurve(this.curves[i].points, i);
    }
    
    return true;
  }
  
  /**
   * Calculate the default center of the curved object as the average position of all anchor points.
   * @returns {Point}
   */
  getDefaultCenter() {
    var curPath = []

    // Get the current path from the current curves
    for (let i = 0; i < this.curves.length; i++) {
      curPath.push(this.curves[i].points[0]);
    }

    return {
      x: Math.round(curPath.reduce((partialPointsSum, curPoint) => partialPointsSum.x + curPoint.x, 0) / this.curves.length),
      y: Math.round(curPath.reduce((partialPointsSum, curPoint) => partialPointsSum.y + curPoint.y, 0) / this.curves.length)
    };
  }
  
  onConstructMouseDown(mouse, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();
    
    // Initialize new curve object
    if (!this.notDone) {
      // Initialize the construction stage
      this.notDone = true;
      
      // Initialize path and curves and bboxes
      this.curves = [];
      this.bboxes = [];
      this.path = [{ x: mousePos.x, y: mousePos.y }];
      //this.path = [];
      console.error(Math.round(this.path.length));
    } 

    if (this.path.length > 0) {
      // Check if clicked on first point in path of current lens
      if (this.path.length > 3 && mouse.snapsOnPoint(this.path[0])) {
        // Clicked the first point
        this.path.length--;   // Remove the ast one (removes the duplicate point at the end)
        this.notDone = false;

        this.generatePolyBezier();
        //console.log(this.curves[0] instanceof Bezier);

        // Reset path
        //this.path = [];
        //delete this.path;

        return {
          isDone: true
        };
      } else {
        // Move the last point
        this.path.push({ x: mousePos.x, y: mousePos.y });
        //this.path[this.path.length - 1] = { x: mousePos.x, y: mousePos.y };
      }
    }
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    if (!this.notDone) return { isDone: true };
    const mousePos = mouse.getPosSnappedToGrid();
    this.path[this.path.length - 1] = { x: mousePos.x, y: mousePos.y }; // Move the last point
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    if (!this.notDone) return { isDone: true };
    /*
    // Check if clicked on first point in path of current lens
    if (this.path.length > 3 && mouse.snapsOnPoint(this.path[0])) { 
      // Clicked the first point

      this.generatePolyBezier();
      //console.log(this.curves[0] instanceof Bezier);

      // Reset path
      //this.path = [];
      //delete this.path;
      this.path.length--;
      this.notDone = false;

      return {
        isDone: true
      };
    }
    const mousePos = mouse.getPosSnappedToGrid();
    this.path[this.path.length - 1] = { x: mousePos.x, y: mousePos.y };   // Move last point
    this.path[this.path.length] = { x: mousePos.x, y: mousePos.y };       // Create new point
    */
  }

  onConstructUndo() {
    if (this.path.length <= 2) {
      return {
        isCancelled: true
      };
    } else {
      if (this.curves) {
        this.curves.pop(); 
        this.path.pop();
      }
      else this.path.pop();
    }
  }

  checkMouseOver(mouse) {
    var dragContext = {};
    var curCurvePts = [];
    var nextCurve = 0;

    const mousePos = mouse.getPosSnappedToGrid();
    dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
    dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
    dragContext.snapContext = {};
    
    // Go thru each curve
    for (let c = 0; c < this.curves.length; c++) {
      curCurvePts = this.curves[c].points;
      // Handle path point separate from control points due to overlap with previous curve's final path point
      if (mouse.isOnPoint(this.curves[c].points[0])) {// || mouse.isOnPoint(this.curves[(c - 1 + this.curves.length) % this.curves.length].points[3])) {
        dragContext.part = 1;
        dragContext.targetPoint = this.curves[c].points[0];
        dragContext.index = c;
        return dragContext;
      }
      /*nextCurve = (c + 1) % this.curves.length;
      console.error("A");
      if (mouse.isOnPoint(curCurvePts[3]) || mouse.isOnPoint(this.curves[nextCurve].points[0])) {
        dragContext.part = 1;
        console.error("B");
        dragContext.targetPoint = curCurvePts[3];//this.curves[nextCurve].points[0];
        dragContext.index = c;
        return dragContext;
      }*/

      // Check if on one of the control points
      for (let i = 1; i < curCurvePts.length - 1; i++) {
        if (mouse.isOnPoint(curCurvePts[i])) {
          dragContext.part = i + 1;
          dragContext.targetPoint = curCurvePts[i];
          dragContext.index = c;
          return dragContext;
        }
      }
    }
    // On the curve itself. Done outside of previous loop due to conflicts with path points
    for (let c = 0; c < this.curves.length; c++) {
      if (mouse.isOnCurve(this.curves[c])) {
        dragContext.part = 0;
        return dragContext;
      }
    }
  }
  
  onDrag(mouse, dragContext, ctrl, shift) {
    var mousePos;
    var mod = 0;
    var closest = { x: 0, y: 0 };
    const curPrev = (dragContext.index - 1 + this.curves.length) % this.curves.length;

    if (shift) {
      mod++;
    }
    if (ctrl) {
      mod += 2;
    }

    if (dragContext.part === 1) {
      switch (mod) {
        // Default behavior (no movement restrictions)
        default:
          mousePos = mouse.getPosSnappedToGrid();
          dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
          break;

        // Snapping to a direction
        case 1://, 3:
          mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
          break;

        // Essentially default movement, but also taking the relevant control points along with the moving path point
        case 2:

          mousePos = mouse.getPosSnappedToGrid();
          dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key

          // Get the difference in position between mouse and path point being moved to figure out how we want to translate the control points
          var diffX = mousePos.x - this.curves[dragContext.index].points[0].x;
          var diffY = mousePos.y - this.curves[dragContext.index].points[0].y;

          // First control point of the latter curve
          this.curves[dragContext.index].points[1].x += diffX; 
          this.curves[dragContext.index].points[1].y += diffY; 
          // Second control point of the former curve
          this.curves[curPrev].points[2].x += diffX;
          this.curves[curPrev].points[2].y += diffY;
          
          /*if (geometry.distanceSquared(this.path[(dragContext.index - 1 + this.path.length) % this.path.length], this.path[dragContext.index]) < geometry.distanceSquared(this.path[(dragContext.index + 1) % this.path.length], this.path[dragContext.index])) {
            closest = this.path[(dragContext.index - 1 + this.path.length) % this.path.length];
          } else {
            closest = this.path[(dragContext.index + 1) % this.path.length];
          }
          mousePos = mouse.getPosSnappedToDirection(geometry.point(closest.x, closest.y), [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
          */

          //this.curves[dragContext.index].update();
          //this.curves[curPrev].update();

          this.newCurve(this.curves[dragContext.index].points, dragContext.index);
          this.newCurve(this.curves[curPrev].points, curPrev);

         break;
      }
      // Move path points
      //this.path[dragContext.index].x = mousePos.x;
      //this.path[dragContext.index].y = mousePos.y;
      // Move the associated point on the current curve and the previous curve
      this.curves[dragContext.index].points[0].x = mousePos.x;
      this.curves[dragContext.index].points[0].y = mousePos.y;
      this.curves[curPrev].points[3].x = mousePos.x;
      this.curves[curPrev].points[3].y = mousePos.y;

      //this.curves[dragContext.index].update();
      //this.curves[curPrev].update();

      this.newCurve(this.curves[dragContext.index].points, dragContext.index);
      this.newCurve(this.curves[curPrev].points, curPrev);

    }

    else if (dragContext.part === 2 || dragContext.part === 3) {
      if (shift) {
        mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
      } else {
        mousePos = mouse.getPosSnappedToGrid();
        dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
      }
      this.curves[dragContext.index].points[dragContext.part - 1].x = mousePos.x;
      this.curves[dragContext.index].points[dragContext.part - 1].y = mousePos.y;
      //this.curves[dragContext.index].update();

      this.newCurve(this.curves[dragContext.index].points, dragContext.index);

      
      // Also handle any potential dependent curves
      /*
      if (Object.hasOwn(this.dependentVertices, dragContext.lens)) {
        if (Object.hasOwn(this.dependentVertices, dragContext.index)) {
          this.dependentVertices[dragContext.index].forEach((point) => {
            var tmp_point = this.curves[dragContext.lens][dragContext.index].compute(point.t);
            if (point.type === "end") {
              //this.curves[point.lens][point.index].points[3].x = tmp_point.x;
              //this.curves[point.lens][point.index].points[3].y = tmp_point.y;
              this.curves[point.lens][point.index] = new Bezier(
                this.curves[point.lens][point.index].points[0],
                this.curves[point.lens][point.index].points[1],
                this.curves[point.lens][point.index].points[2],
                { x: tmp_point.x, y: tmp_point.y }
              );
            } else {
              // If not end point, assume start point
              //this.curves[point.lens][point.index].points[0].x = tmp_point.x;
              //this.curves[point.lens][point.index].points[0].y = tmp_point.y;
              this.curves[point.lens][point.index] = new Bezier(
                { x: tmp_point.x, y: tmp_point.y },
                this.curves[point.lens][point.index].points[1],
                this.curves[point.lens][point.index].points[2],
                this.curves[point.lens][point.index].points[3]
              );
            }
            this.curves[point.lens][point.index].update();
          });
        }
      }*/
    }

    else if (dragContext.part === 0) {
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
  
  checkRayIntersects(ray) {
    if (this.notDone) return;
    if (this.isInsideGlass(ray.p1) || this.isOnBoundary(ray.p1)) // if the first point of the ray is inside the circle, or on its boundary
    {
      this.rayLen = geometry.distance(ray.p1, ray.p2);
      let x = ray.p1.x + (this.stepSize / this.rayLen) * (ray.p2.x - ray.p1.x);
      let y = ray.p1.y + (this.stepSize / this.rayLen) * (ray.p2.y - ray.p1.y);
      const intersection_point = geometry.point(x, y);
      if (this.isInsideGlass(intersection_point)) // if intersection_point is inside the circle
        return intersection_point;
    }

    var s_lensq = Infinity;
    var s_lensq_temp;
    var s_point = null;
    var s_point_temp = null;
    var s_point_index = -1;
    var rp_temp = { x: Infinity, y: Infinity };
    var rp_temp2;
    var intersections = null;
    var scaled_ray = ray;

    // Go thru each curve
    for (var i = 0; i < this.curves.length; i++) {
      //rp_temp = { x: NaN, y: NaN }; // Reset and populate rp_temp
      s_point_temp = null;

      // Scale ray to ensure it is long enough to intersect the curve before checking for intersection using BezierJS's curve.lineIntersects function
      scaled_ray = geometry.scaleRayForCurve(ray, this.curves[i]);

      // Get the closest point of intersection to the first point of the ray on the current curve
      intersections = this.curves[i].lineIntersects(scaled_ray);
      if (intersections.length >= 1) {
        // Go through each of them, get the intersection point closest to p1, since it comes sorted by coordinate
        //rp_temp = this.curves[i].get(intersections[0]);
        //console.log("Intersection: " + intersections[0]);
        rp_temp = { x: Infinity, y: Infinity };


        intersections.forEach((intersection) => {
          rp_temp2 = this.curves[i].get(intersection);
          //console.log("cRI cur rp_temp2: " + rp_temp2.x + ", " + rp_temp2.y + "\n\tt: " + intersection + "\n\t" + rp_temp2);
          if (geometry.distanceSquared(geometry.point(rp_temp2.x, rp_temp2.y), scaled_ray.p1) < geometry.distanceSquared(geometry.point(rp_temp.x, rp_temp.y), scaled_ray.p1)) {
            rp_temp = rp_temp2;
            //rp_temp = geometry.point(rp_temp.x, rp_temp.y);
          }
        });


        //console.log("cRI intersections:\n\tLength: " + intersections.length + "\n\tFirst point: " + rp_temp.x + ", " + rp_temp.y);
      
        //Line segment i->i+1
        //var rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(this.path[i % this.path.length], this.path[(i + 1) % this.path.length]));
        // Curve i

        //if (geometry.intersectionIsOnCurve(rp_temp, this.curves[i], this.intersectTol) && geometry.intersectionIsOnRay(rp_temp, ray) && geometry.distanceSquared(ray.p1, rp_temp) > Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale) {
        // Intersection with curve can be assumed since that's where we got the point in the first place (above), hence there's no second check for if the point is on the curve here.
        if (geometry.intersectionIsOnRay(geometry.point(rp_temp.x, rp_temp.y), scaled_ray) && geometry.distanceSquared(scaled_ray.p1, geometry.point(rp_temp.x, rp_temp.y)) > Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale) {
          s_lensq_temp = geometry.distanceSquared(scaled_ray.p1, rp_temp);
          s_point_temp = rp_temp;
        }

        //if (s_point_temp && (!s_point || geometry.distance(geometry.point(s_point.x, s_point.y), scaled_ray.p1) > geometry.distance(geometry.point(s_point_temp.x, s_point_temp.y), scaled_ray.p1))) {
        if (s_point_temp) {
          if (s_point && geometry.distanceSquared(geometry.point(s_point_temp.x, s_point_temp.y), geometry.point(s_point.x, s_point.y)) < Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale && s_point_index != i - 1) {
            // The ray shots on a point where the upper and the lower surfaces overlap.
            return;
          } else if (s_lensq_temp < s_lensq) {
            s_lensq = s_lensq_temp;
            s_point = s_point_temp;
            s_point_index = i;
          }
        }
      }
    }
    if (s_point) {
      // Temp store indices for curve being intersected
      this.tmp_i = s_point_index;

      console.log("cRI intersection:\n\tCurrent point: " + s_point.x + ", " + s_point.y);

      return s_point;
    }
  }

  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
    try {
      this.error = null;
      console.log("TEST1");
      //console.log("Checking incident...");
      // If incidentPoint is not null, then that means that checkRayIntersects returned a non-null s_point, which can only be acquired for this object by there existing at least one intersection point. Hence we need not check if isOnBoundary, but instead whether or not incidentPoint is null.
      //if ((this.isInsideGlass(ray.p1) || this.isOutsideGlass(ray.p1)) && this.isOnBoundary(incidentPoint)) // if the ray is hitting the circle from the outside, or from the inside (meaning that the point incidentPoint is on the boundary of the circle, and the point ray.p1 is inside/outside the circle)
      //if ((this.isInsideGlass(ray.p1) || this.isOutsideGlass(ray.p1)) && this.isOnBoundary(geometry.point(incidentPoint.x, incidentPoint.y))) // if the ray is hitting the circle from the outside, or from the inside (meaning that the point incidentPoint is on the boundary of the circle, and the point ray.p1 is inside/outside the circle)
      {
        console.log("ray incident exists.");
        var incidentData = this.getIncidentData(ray);
        var incidentType = incidentData.incidentType;
        if (incidentType == 1) {
          // From inside to outside
          var n1 = this.getRefIndexAt(incidentPoint, ray);
          console.log("Incident type I");
        } else if (incidentType == -1) {
          // From outside to inside
          var n1 = 1 / this.getRefIndexAt(incidentPoint, ray);
          console.log("Incident type II");
        } else if (incidentType == 0) {
          // Equivalent to not intersecting with the object (e.g. two interfaces overlap)
          var n1 = 1;
          console.log("Incident type III");
        } else {
          // The situation that may cause bugs (e.g. incident on an edge point)
          // To prevent shooting the ray to a wrong direction, absorb the ray
          console.log("Incident type NULL");
          return {
            isAbsorbed: true,
            isUndefinedBehavior: true
          };
        }
        console.log(
          "INCIDENT DATA:" + 
          "\n\tNormal:\t" + incidentData.normal.x + ", " + incidentData.normal.y + 
          "\n\tS_point:\t" + incidentData.s_point.x + ", " + incidentData.s_point.y + 
          "\n\tN1:\t" + n1
        );
        return this.refract(ray, rayIndex, incidentData.s_point, incidentData.normal, n1, surfaceMergingObjs, ray.bodyMergingObj);
      }
    } catch (e) {
      this.error = e.toString();
      console.log(this.error);
      return {
        isAbsorbed: true,
        isUndefinedBehavior: true
      };
    }
  }

  getIncidentType(ray) {
    console.log("incidentType(" + ray + "):\t" + this.getIncidentData(ray).incidentType);
    return this.getIncidentData(ray).incidentType;
  }

  isOutsideGlass(point) {
    //console.log("isOutsideGlass(" + point + "):\t" + !this.isOnBoundary(point) && this.countIntersections(point) % 2 == 0);
    return (!this.isOnBoundary(point) && this.countIntersections(point, -1) % 2 == 0)
  }

  isInsideGlass(point) {
    console.log("isInsideGlass():\t" + String(!this.isOnBoundary(point) && this.countIntersections(point, -1) % 2 == 1) + "");
    return (!this.isOnBoundary(point) && this.countIntersections(point, -1) % 2 == 1)
  }
  
  isOnBoundary(p3) {
    /* Old
    for (let i = 0; i < this.path.length; i++) {
      let p1 = this.path[i];
      let p2 = this.path[(i + 1) % this.path.length];
      let p1_p2 = geometry.point(p2.x - p1.x, p2.y - p1.y);
      let p1_p3 = geometry.point(p3.x - p1.x, p3.y - p1.y);
      if (geometry.cross(p1_p2, p1_p3) - this.intersectTol < 0 && geometry.cross(p1_p2, p1_p3) + this.intersectTol > 0) // if p1_p2 and p1_p3 are collinear
      {
        let dot_p2_p3 = geometry.dot(p1_p2, p1_p3);
        let p1_p2_squared = geometry.distanceSquared(p1, p2);
        if (p1_p2_squared - dot_p2_p3 + this.intersectTol >= 0 && dot_p2_p3 + this.intersectTol >= 0) // if the projection of the segment p1_p3 onto the segment p1_p2, is contained in the segment p1_p2
          return true;
      }
    }
    return false;*/

    // New (curve-oriented)
    for (let i = 0; i < this.curves.length; i++) {
      /*closestPoint = this.curves[i].get(this.curves[i].project(geometry.point(p3.x, p3.y)).t);
      closestPoint = geometry.point(closestPoint.x, closestPoint.y);
      console.log("CURVE " + i + ": Tolerance:" + this.intersectTol);
      console.log("Closest point:\t" + closestPoint.x + ", " + closestPoint.y);
      console.log("Point given:\t" + p3.x + ", " + p3.y);
      console.log("Difference:\t" + (p3.x - closestPoint.x) + ", " + (p3.y - closestPoint.y));
      console.log("Distance:\t" + geometry.distance(geometry.point(p3.x, p3.y), closestPoint));*/

      /*
      var rayVec = geometry.point(ray.p2.x - ray.p1.x, ray.p2.y - ray.p1.y);
      var projection = this.curves[i].project(geometry.point(p3.x, p3.y));
      // Get the normal, but rotated 90 degrees (due to how we want to use it); hence, get the normalized derivative
      var normal = geometry.normalize(this.curves[i].derivative(projection.t));

      // If the distance to the nearest point on the current curve from p3 is below the intersect tolerance threshold, p3 is on boundary
      if (projection.d ** 2 <= this.intersectTol * (1 + Math.abs(geometry.dot(rayVec, geometry.point(normal.x, normal.y))) / (geometry.distance(ray.p1, ray.p2) * geometry.distance({x:0, y:0}, normal.x, normal.y))) ) {//(this.stepSize / this.rayLen)) {
      */
      

      // New old

      // First, check if the point is within the bounding box of the curve. This prevents unnecessary calculations of the projection
      if (p3.x > this.bboxes[i].x.max || p3.x < this.bboxes[i].x.min || p3.y > this.bboxes[i].y.max || p3.y < this.bboxes[i].y.min) {
        // Check how far away the nearest point on the curve to p3 is from p3
        if (this.curves[i].project({ x: p3.x, y: p3.y }).d ** 2 <= this.intersectTol) {
          console.log("INTERSECTION: " + this.curves[i].project({ x: p3.x, y: p3.y }).d + "");
          return true;
        }
      }

      // New
      /*
      // First, check if in bounding box. if not, we can skip the rest of the following calculations.
      var bbox = this.curves[i].bbox();
      if (p3.x > bbox.x.max || p3.x < bbox.x.min || p3.y > bbox.y.max || p3.y < bbox.y.min) {
        continue;
      }

      var proj = this.curves[i].project(geometry.point(p3.x, p3.y));
      var proj_point = this.curves[i].compute(proj.t); // Get the nearest point on the curve to p3

      // Get the normalized derivative, tangent with the nearest point on the curve
      var deriv_point = geometry.normalize(this.curves[i].derivative(proj.t));
      deriv_point = geometry.point(-deriv_point.x, -deriv_point.y); // Flip it to have it point from far point to point on curve

      // Translate the deriv point to be in the same coord space as proj_point
      var deriv_point_translated = geometry.point(proj_point.x - deriv_point.x, proj_point.y - deriv_point.y);

      // Get the point representing the vector pointing from the farthest point on the normalized derivative vector after translation to p3
      var p1_p3 = geometry.normalize(geometry.point(p3.x - deriv_point_translated.y, p3.y - deriv_point_translated.y));

      // Get the point representing the derivative vector pointing from its farthest point to the projection point from which it was derived, i.e. deriv_point rotated by pi radians
      var p1_p2 = geometry.point(-deriv_point.x * 2, -deriv_point.y * 2);
      console.log("DERIV POINT:\n" + deriv_point.x + ", " + deriv_point.y);
      console.log("p1_p2:\n" + p1_p2.x + ", " + p1_p2.y);
      console.log("p1_p3:\n" + p1_p3.x + ", " + p1_p3.y);
      console.log("CROSS p1_p2 x p1_p3:\n" + geometry.cross(p1_p2, p1_p3));

      // Use the old pre-existing boundary check using our new values calculated consideration of the use of curves
      if (geometry.cross(p1_p2, p1_p3) - this.intersectTol < 0 && geometry.cross(p1_p2, p1_p3) + this.intersectTol > 0) // if p1_p2 and p1_p3 are collinear
      {
        var dot_p2_p3 = geometry.dot(p1_p2, p1_p3);
        console.log("DOT_P2_P3:\n" + dot_p2_p3);
        var p1_p2_squared = geometry.distanceSquared(geometry.point(0, 0), deriv_point);
        if (p1_p2_squared - dot_p2_p3 + this.intersectTol >= 0 && dot_p2_p3 - p1_p2_squared + this.intersectTol >= 0) // if the projection of the segment p1_p3 onto the segment p1_p2, is contained in the segment p1_p2
          console.log("INTERSECTION ON BOUND:\n" + p1_p2.x + ", " + p1_p2.y + "\n" + p1_p3.x + ", " + p1_p3.y);
          return true;
      }
      */
    }
    return false;
  }

  /* Utility methods */

  getIncidentData(ray) {
    // Assuming this.checkRayIntersects(ray) has already been called, this.tmp_i should correspond to the curve in which the nearest intersection lays
    var i = this.tmp_i;
    //var l = this.tmp_l;
    var s_point = { x: Infinity, y: Infinity, t: 0 };
    var s_point_tmp = s_point;
    

    // Get all intersections with the aforementioned curve
    var intersections = this.curves[i].lineIntersects(geometry.scaleRayForCurve(ray, this.curves[i]));
    
    // Get normal from the curve at the nearest intersection to ray.p1
    if (intersections.length >= 1) {
      //s_point = this.curves[i].get(intersections[0]);
      
      // Get closest intersection on curve to current point (for when there are multiple intersections on the curve)
      intersections.forEach((intersection) => {
        s_point_tmp = this.curves[i].get(intersection);
        if (geometry.distanceSquared(geometry.point(s_point_tmp.x, s_point_tmp.y), ray.p1) < geometry.distanceSquared(geometry.point(s_point.x, s_point.y), ray.p1)) {
          s_point = s_point_tmp;
        }
      });
    }


    // Get the normalized normal vector of the curve at the intersection point
    var normal = this.curves[i].normal(s_point.t);
    normal = geometry.point(normal.x, normal.y);

    // Important note: Since we're dealing with computer graphics, negative y is up and positive y is down, as that's the standard convention.
    console.log(
      "NORMALS:" +
      "\n\tUnchanged:\t" + normal.x + ", " + normal.y +
      "\n\t+x, -y (in use):\t" + normal.x + ", " + (-normal.y) +
      "\n\t-x, -y:\t" + (-normal.x) + ", " + (-normal.y) +
      "\n\t-x, +y:\t" + (-normal.x) + ", " + (normal.y)
    )

    // Reorient tangent if necessary, to ensure it's on the same side of the curve as p1. 
    //  This is necessary due to how BezierJS calculates normals to always be on the same side relative to the path from its first anchor point to its second anchor point. 
    //  All this does is flip the normal vector about the point on the curve which acts as its point of origin if the normal is pointing in the same direction of the ray as per the sign of the dot product.
    if (normal.x * (ray.p2.x - ray.p1.x) + normal.y * (ray.p2.y - ray.p1.y) > 0) {
      normal.x = -normal.x;
      normal.y = -normal.y;
    }/*
    if (normal.x * (ray.p2.x - ray.p1.x) + normal.y * (ray.p2.y - ray.p1.y) > 0) {
      normal.x = -normal.x;
      normal.y = normal.y;
    }*/

    if (this.isInsideGlass(ray.p1)) {
      var incidentType = 1; // Inside to outside
    } else {
      var incidentType = -1; // Outside to inside
    }

    return { s_point: s_point, normal: geometry.point(normal.x, normal.y), incidentType: incidentType }
  }

  // Implementation of the "crossing number algorithm" (see - https://en.wikipedia.org/wiki/Point_in_polygon)
  // Using p3 and (0, 0), as the purpose of this function is to test whether the number of intersections is even or odd, hence the actual number is irrelevant, hence any secondary point will do for our purposes.
  countIntersections(p3) {//, lens) {
    var cnt = 0;

    // Go thru each curve
    for (let i = 0; i < this.curves.length; i++) {
      // Add the number of intersections found on the current curve from p3 to (0, 0)
      cnt += this.curves[i].intersects(geometry.line(geometry.point(p3.x, p3.y), {x: 0, y: 0})).length;// ? 1 : 0;
    }
    return cnt; // Returns the number of intersections between a horizontal ray (that originates from the point - p3) and the Free-shape glass object - this.
  }

  // Generate default control points from path (helper method)
  generateDefaultControlPoints(pts) {
    const cpVec1 = geometry.normalizeVec(geometry.point(pts[2].x - pts[0].x, pts[2].y - pts[0].y));
    const cpVec2 = geometry.normalizeVec(geometry.point(pts[3].x - pts[1].x, pts[3].y - pts[1].y));

    return [ geometry.point(pts[1].x + Math.floor(cpVec1.x * 50 + 0.5), pts[1].y + Math.floor(cpVec1.y * 50 + 0.5)), geometry.point(pts[2].x - Math.floor(cpVec2.x * 50 + 0.5), pts[2].y - Math.floor(cpVec2.y * 50 + 0.5)) ];
  }

  // Generate Poly Bezier (i.e. set of Bezier curves which will form the boundaries of the lens) from path
  generatePolyBezier() {
    var curCtrlPts = null;
    // Create one curve for each line
    for (var i = 0; i < this.path.length; i++) {
      curCtrlPts = this.generateDefaultControlPoints([ this.path[(i - 1 + this.path.length) % this.path.length], this.path[i], this.path[(i + 1) % this.path.length], this.path[(i + 2) % this.path.length] ]);
      this.newCurve([{ x: this.path[i].x, y: this.path[i].y }, { x: curCtrlPts[0].x, y: curCtrlPts[0].y }, { x: curCtrlPts[1].x, y: curCtrlPts[1].y }, { x: this.path[(i + 1) % this.path.length].x, y: this.path[(i + 1) % this.path.length].y }]);
    }
    //this.polyBezier = new PolyBezier(this.curves);
  }
  
  // Draw curve
  drawCurve(curve, canvasRenderer) {
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

    // Lines connecting anchors and control points
    ctx.strokeStyle = 'rgb(255,0,0)';
    //this.drawLine(p[0], p[1], offset, canvasRenderer);
    //this.drawLine(p[2], p[3], offset, canvasRenderer);
    this.drawLine(p[0], p[1], canvasRenderer, ctx.strokeStyle);
    this.drawLine(p[2], p[3], canvasRenderer, ctx.strokeStyle);

    // Draw points at each point in curve
    ctx.fillStyle = 'rgb(255,0,0)';
    p.forEach((cur) => this.drawPoint(cur, canvasRenderer));
  }

  // Draw line
  drawLine(p1, p2, canvasRenderer, strokeStyle) {
    const ctx = canvasRenderer.ctx;
    ctx.strokeStyle = strokeStyle || 'rgb(128,128,128)';
    ctx.beginPath();
    //ctx.moveTo(p1.x + offset.x, p1.y + offset.y);
    //ctx.lineTo(p2.x + offset.x, p2.y + offset.y);
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.closePath();

    // Draw points
    ctx.fillStyle = 'rgb(255,0,0)';
    [p1, p2].forEach((cur) => this.drawPoint(cur, canvasRenderer));
  }

  // Draw point
  drawPoint(p1, canvasRenderer) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;
    ctx.fillRect(p1.x - 1.5 * ls, p1.y - 1.5 * ls, 3 * ls, 3 * ls);
  }

  // Create new curve, set new bounding box
  newCurve(pts, i) {
    // Making complete new poly-Bezier curve (default behavior)
    if (typeof i === "undefined" || i === -1) {
      this.curves.push(new Bezier(pts));
      this.bboxes.push(this.curves[this.curves.length - 1].bbox());

      return this.curves[this.curves.length - 1];
    } else {
      // Otherwise, handle the given index
      this.curves[i] = new Bezier(pts);
      this.bboxes[i] = this.curves[i].bbox();

      return this.curves[i];
    }
  }
};

export default CurveGlass;
