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

import geometry from '../geometry.js';
import Simulator from '../Simulator.js';
import i18next from 'i18next';

/**
 * The mixin for the scene objects that are defined by a circle.
 * @template {typeof BaseSceneObj} T
 * @param {T} Base 
 * @returns {T}
 */
const CircleObjMixin = Base => class extends Base {

  static getPropertySchema(objData, scene) {
    return [
      { key: 'p1', type: 'point', label: i18next.t('simulator:sceneObjs.CircleObjMixin.center') },
      { key: 'p2', type: 'point', label: i18next.t('simulator:sceneObjs.CircleObjMixin.radiusPoint') },
      ...super.getPropertySchema(objData, scene),
    ];
  }

  move(diffX, diffY) {
    // Move the first point
    this.p1.x = this.p1.x + diffX;
    this.p1.y = this.p1.y + diffY;
    // Move the second point
    this.p2.x = this.p2.x + diffX;
    this.p2.y = this.p2.y + diffY;
    
    return true;
  }
  
  rotate(angle, center) {
    // Use center of circle as default rotation center if none is provided
    const rotationCenter = center || this.getDefaultCenter();
    
    // Calculate differences from rotation center for both points
    const diff_p1_x = this.p1.x - rotationCenter.x;
    const diff_p1_y = this.p1.y - rotationCenter.y;
    const diff_p2_x = this.p2.x - rotationCenter.x;
    const diff_p2_y = this.p2.y - rotationCenter.y;
    
    // Apply rotation matrix to p1 (center of circle)
    this.p1.x = rotationCenter.x + diff_p1_x * Math.cos(angle) - diff_p1_y * Math.sin(angle);
    this.p1.y = rotationCenter.y + diff_p1_x * Math.sin(angle) + diff_p1_y * Math.cos(angle);
    
    // Apply rotation matrix to p2 (point on circumference)
    this.p2.x = rotationCenter.x + diff_p2_x * Math.cos(angle) - diff_p2_y * Math.sin(angle);
    this.p2.y = rotationCenter.y + diff_p2_x * Math.sin(angle) + diff_p2_y * Math.cos(angle);
    
    return true;
  }
  
  scale(scale, center) {
    // Use center of circle as default scaling center if none is provided
    const scalingCenter = center || this.getDefaultCenter();
    
    // Calculate differences from scaling center for both points
    const diff_p1_x = this.p1.x - scalingCenter.x;
    const diff_p1_y = this.p1.y - scalingCenter.y;
    const diff_p2_x = this.p2.x - scalingCenter.x;
    const diff_p2_y = this.p2.y - scalingCenter.y;
    
    // Apply scaling to p1 (center of circle)
    this.p1.x = scalingCenter.x + diff_p1_x * scale;
    this.p1.y = scalingCenter.y + diff_p1_y * scale;
    
    // Apply scaling to p2 (point on circumference)
    this.p2.x = scalingCenter.x + diff_p2_x * scale;
    this.p2.y = scalingCenter.y + diff_p2_y * scale;
    
    return true;
  }
  
  getDefaultCenter() {
    // Return the center of the circle (p1)
    return this.p1;
  }
  
  onConstructMouseDown(mouse, ctrl, shift) {
    if (!this.constructionPoint) {
      // Initialize the construction stage.
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

    this.p1 = this.constructionPoint;
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    if (!mouse.snapsOnPoint(this.p1)) {
      delete this.constructionPoint;
      return {
        isDone: true
      };
    }
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
    if (Math.abs(geometry.distance(this.p1, mouse.pos) - geometry.segmentLength(this)) < mouse.getClickExtent()) {
      const mousePos = mouse.getPosSnappedToGrid();
      dragContext.part = 0;
      dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
      dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
      dragContext.snapContext = {};
      return dragContext;
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    if (dragContext.part == 1) {
      // Dragging the center point
      const basePoint = dragContext.originalObj.p2;

      this.p1 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
      this.p2 = basePoint;
    }
    if (dragContext.part == 2) {
      // Dragging the point on the circumference
      const basePoint = dragContext.originalObj.p1;

      this.p2 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
      this.p1 = basePoint;
    }
    if (dragContext.part == 0) {
      // Dragging the entire circle

      if (shift) {
        var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }, { x: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y), y: -(dragContext.originalObj.p2.x - dragContext.originalObj.p1.x) }], dragContext.snapContext);
      } else {
        var mousePos = mouse.getPosSnappedToGrid();
        dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
      }

      const mouseDiffX = dragContext.mousePos1.x - mousePos.x; // The X difference between the mouse position now and at the previous moment
      const mouseDiffY = dragContext.mousePos1.y - mousePos.y; // The Y difference between the mouse position now and at the previous moment The Y difference between the mouse position now and at the previous moment
      // Move the center point
      this.p1.x = this.p1.x - mouseDiffX;
      this.p1.y = this.p1.y - mouseDiffY;
      // Move the point on the circumference
      this.p2.x = this.p2.x - mouseDiffX;
      this.p2.y = this.p2.y - mouseDiffY;
      // Update the mouse position
      dragContext.mousePos1 = mousePos;
    }
  }

  /**
   * Check if a ray intersects the circle.
   * In the child class, this can be called from the `checkRayIntersects` method.
   * @param {Ray} ray - The ray.
   * @returns {Point} The intersection point, or null if there is no intersection.
   */
  checkRayIntersectsShape(ray) {
    const rp_temp = geometry.lineCircleIntersections(geometry.line(ray.p1, ray.p2), geometry.circle(this.p1, this.p2));
    const rp_exist = [];
    const rp_lensq = [];
    for (let i = 1; i <= 2; i++) {
      rp_exist[i] = geometry.intersectionIsOnRay(rp_temp[i], ray) && geometry.distanceSquared(rp_temp[i], ray.p1) > Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale;
      rp_lensq[i] = geometry.distanceSquared(ray.p1, rp_temp[i]);
    }

    if (rp_exist[1] && ((!rp_exist[2]) || rp_lensq[1] < rp_lensq[2])) {
      return rp_temp[1];
    }
    if (rp_exist[2] && ((!rp_exist[1]) || rp_lensq[2] < rp_lensq[1])) {
      return rp_temp[2];
    }
  }
};

export default CircleObjMixin;