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

import BaseSceneObj from '../BaseSceneObj.js';
import geometry from '../../geometry.js';
import Mouse from '../../Mouse.js';
import i18next from 'i18next';

/**
 * The handle created when holding ctrl and click several points.
 * @class
 * @extends BaseSceneObj
 * @memberof sceneObjs
 * @property {Point} p1 - The position of the handle.
 * @property {Point} p2 - The position of the rotation/scale center.
 * @property {Array<number>} objIndices - The indices of the objects bound to the handle.
 * @property {Array<ControlPoint>} controlPoints - The individual control points (in addition to the bound objects) bound to the handle.
 * @property {string} transformation - The transformation applied to the control points when dragging the handle, with the corresponding arrows marked on the handle. Possible values are "default", "translation", "xTranslation", "yTranslation", "rotation", "scaling". The "default" is the only behavior in older versions where no arrow is marked on the handle, and the transformation is determined by the ctrl and shift keys.
 * @property {number} moveStep - The step size for translation.
 * @property {number} rotateStep - The step size for rotation in degrees.
 * @property {number} scaleStep - The step size for scaling in percentage. For example, 10 means (1/1.1)x, 1x, 1.1x, (1.1)^2 x, etc; -10 means 0.9x, 1x, (1/0.9)x, (1/0.9)^2 x, etc.
 * @property {boolean} notDone - Whether the construction of the handle is complete.
 */
class Handle extends BaseSceneObj {
  static type = 'Handle';
  static isOptical = true; // As the handle may bind to objects which are optical, this should be regarded as true.
  static serializableDefaults = {
    p1: null,
    p2: null,
    objIndices: [],
    controlPoints: [],
    transformation: "default",
    moveStep: 0,
    rotateStep: 0,
    scaleStep: 0,
    notDone: false
  };

  serialize() {
    let jsonObj = super.serialize();

    if (jsonObj.controlPoints) {
      // Remove some redundent properties in the control points to reduce the size of the JSON.
      jsonObj.controlPoints = jsonObj.controlPoints.map(controlPoint => {
        let controlPointCopy = JSON.parse(JSON.stringify(controlPoint));
        delete controlPointCopy.dragContext.originalObj; // This should be inferred from `scene.objs[controlPoint.targetObjIndex]` directly.
        delete controlPointCopy.dragContext.hasDuplicated; // Always false.
        delete controlPointCopy.dragContext.isByHandle; // Always true.
        delete controlPointCopy.dragContext.targetPoint; // The target point is already stored in the newPoint.
        delete controlPointCopy.dragContext.snapContext; // Snapping is not possible with the handle.

        return controlPointCopy;
      });
    }

    return jsonObj;
  }

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('simulator:sceneObjs.Handle.handle'));
    objBar.createDropdown(i18next.t('simulator:sceneObjs.Handle.transformation'), this.transformation, {
      'default': i18next.t('simulator:common.defaultOption'),
      'translation': i18next.t('simulator:sceneObjs.Handle.transformations.translation'),
      'xTranslation': i18next.t('simulator:sceneObjs.Handle.transformations.xTranslation'),
      'yTranslation': i18next.t('simulator:sceneObjs.Handle.transformations.yTranslation'),
      'rotation': i18next.t('simulator:sceneObjs.Handle.transformations.rotation'),
      'scaling': i18next.t('simulator:sceneObjs.Handle.transformations.scaling')
    }, function (obj, value) {
      obj.transformation = value;
    }, null, true);

    switch (this.transformation) {
      case "xTranslation":
      case "yTranslation":
        if (objBar.showAdvanced(!this.arePropertiesDefault(['moveStep']))) {
          objBar.createNumber(i18next.t('simulator:sceneObjs.Handle.step'), 0, 100, 1, this.moveStep, function (obj, value) {
            obj.moveStep = Math.abs(value);
          }, i18next.t('simulator:sceneObjs.common.lengthUnitInfo'), true);
        }
        break;
      case "rotation":
        if (objBar.showAdvanced(!this.arePropertiesDefault(['rotateStep']))) {
          objBar.createNumber(i18next.t('simulator:sceneObjs.Handle.step') + ' (\u00b0)', 0, 360, 1, this.rotateStep, function (obj, value) {
            obj.rotateStep = Math.abs(value);
          }, null, true);
        }
        break;
      case "scaling":
        if (objBar.showAdvanced(!this.arePropertiesDefault(['scaleStep']))) {
          objBar.createNumber(i18next.t('simulator:sceneObjs.Handle.step') + ' (%)', 1, 200, 1, this.scaleStep, function (obj, value) {
            obj.scaleStep = value;
          }, null, true);
        }
        break;
    }
  }

  getZIndex() {
    return -Infinity;
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;
    ctx.lineWidth = 1 * ls;

    if (this.transformation == "default" || isHovered) {
      for (var i in this.controlPoints) {
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.strokeStyle = this.notDone ? 'cyan' : isHovered ? 'cyan' : ('gray');
        ctx.setLineDash([2 * ls, 2 * ls]);
        ctx.arc(this.controlPoints[i].newPoint.x, this.controlPoints[i].newPoint.y, 5 * ls, 0, Math.PI * 2, false);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    const arrowLineWidthCross = 5 * ls;
    const arrowLineWidthSingle = 8 * ls;
    const arrowLengthCross = 30 * ls;
    const arrowLengthSingle = 28 * ls;
    const arrowHeadSizeCross = 8 * ls;
    const arrowHeadSizeSingle = 12 * ls;

    if (!this.notDone) {
      ctx.globalAlpha = 1;
      // Draw the handle arrow according to the transformation
      switch (this.transformation) {
        case "default":
          ctx.beginPath();
          ctx.strokeStyle = isHovered ? 'cyan' : ('gray');
          ctx.arc(this.p1.x, this.p1.y, 2 * ls, 0, Math.PI * 2, false);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(this.p1.x, this.p1.y, 5 * ls, 0, Math.PI * 2, false);
          ctx.stroke();
          break;
        case "translation":
          // Cross arrows
          ctx.beginPath();
          ctx.strokeStyle = isHovered ? 'cyan' : ('white');
          ctx.fillStyle = isHovered ? 'cyan' : ('white');
          ctx.lineWidth = arrowLineWidthCross;
          ctx.moveTo(this.p1.x - arrowLengthCross / 2, this.p1.y);
          ctx.lineTo(this.p1.x + arrowLengthCross / 2, this.p1.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(this.p1.x, this.p1.y - arrowLengthCross / 2);
          ctx.lineTo(this.p1.x, this.p1.y + arrowLengthCross / 2);
          ctx.stroke();
          this.drawArrowHead(canvasRenderer, this.p1.x + (arrowLengthCross + arrowHeadSizeCross) / 2, this.p1.y, 0, arrowHeadSizeCross);
          this.drawArrowHead(canvasRenderer, this.p1.x, this.p1.y + (arrowLengthCross + arrowHeadSizeCross) / 2, Math.PI / 2, arrowHeadSizeCross);
          this.drawArrowHead(canvasRenderer, this.p1.x - (arrowLengthCross + arrowHeadSizeCross) / 2, this.p1.y, Math.PI, arrowHeadSizeCross);
          this.drawArrowHead(canvasRenderer, this.p1.x, this.p1.y - (arrowLengthCross + arrowHeadSizeCross) / 2, -Math.PI / 2, arrowHeadSizeCross);
          break;
        case "xTranslation":
          // Horizontal arrow
          ctx.beginPath();
          ctx.strokeStyle = isHovered ? 'cyan' : ('white');
          ctx.fillStyle = isHovered ? 'cyan' : ('white');
          ctx.lineWidth = arrowLineWidthSingle;
          ctx.moveTo(this.p1.x - arrowLengthSingle / 2, this.p1.y);
          ctx.lineTo(this.p1.x + arrowLengthSingle / 2, this.p1.y);
          ctx.stroke();
          this.drawArrowHead(canvasRenderer, this.p1.x + (arrowLengthSingle + arrowHeadSizeSingle) / 2, this.p1.y, 0, arrowHeadSizeSingle);
          this.drawArrowHead(canvasRenderer, this.p1.x - (arrowLengthSingle + arrowHeadSizeSingle) / 2, this.p1.y, Math.PI, arrowHeadSizeSingle);
          break;
        case "yTranslation":
          // Vertical arrow
          ctx.beginPath();
          ctx.strokeStyle = isHovered ? 'cyan' : ('white');
          ctx.fillStyle = isHovered ? 'cyan' : ('white');
          ctx.lineWidth = arrowLineWidthSingle;
          ctx.moveTo(this.p1.x, this.p1.y - arrowLengthSingle / 2);
          ctx.lineTo(this.p1.x, this.p1.y + arrowLengthSingle / 2);
          ctx.stroke();
          this.drawArrowHead(canvasRenderer, this.p1.x, this.p1.y + (arrowLengthSingle + arrowHeadSizeSingle) / 2, Math.PI / 2, arrowHeadSizeSingle);
          this.drawArrowHead(canvasRenderer, this.p1.x, this.p1.y - (arrowLengthSingle + arrowHeadSizeSingle) / 2, -Math.PI / 2, arrowHeadSizeSingle);
          break;
        case "rotation":
          // A bent arrow
          ctx.beginPath();
          ctx.strokeStyle = isHovered ? 'cyan' : ('white');
          ctx.fillStyle = isHovered ? 'cyan' : ('white');
          ctx.lineWidth = arrowLineWidthSingle;
          //const radius = geometry.distance(this.p1, this.p2);
          const radius = 40 * ls;
          const angle = Math.atan2(this.p1.y - this.p2.y, this.p1.x - this.p2.x);
          const center = geometry.point(this.p1.x - radius * Math.cos(angle), this.p1.y - radius * Math.sin(angle));
          const angle1 = angle - arrowLengthSingle / radius / 2;
          const angle1_ = angle - (arrowLengthSingle + arrowHeadSizeSingle) / radius / 2;
          const angle2 = angle + arrowLengthSingle / radius / 2;
          const angle2_ = angle + (arrowLengthSingle + arrowHeadSizeSingle) / radius / 2;
          ctx.arc(center.x, center.y, radius, angle1, angle2);
          ctx.stroke();
          this.drawArrowHead(canvasRenderer, center.x + radius * Math.cos(angle2_), center.y + radius * Math.sin(angle2_), angle2 + Math.PI / 2, arrowHeadSizeSingle);
          this.drawArrowHead(canvasRenderer, center.x + radius * Math.cos(angle1_), center.y + radius * Math.sin(angle1_), angle1 - Math.PI / 2, arrowHeadSizeSingle);
          break;
        case "scaling":
          // An arrow with different arrow head sizes
          ctx.beginPath();
          ctx.strokeStyle = isHovered ? 'cyan' : ('white');
          ctx.fillStyle = isHovered ? 'cyan' : ('white');
          ctx.lineWidth = arrowLineWidthSingle;
          const radialAngle = Math.atan2(this.p1.y - this.p2.y, this.p1.x - this.p2.x);
          const arrowHeadSizeLarge = 14 * ls;
          const arrowHeadSizeSmall = 10 * ls;
          ctx.beginPath();
          ctx.moveTo(this.p1.x - arrowLengthSingle / 2 * Math.cos(radialAngle), this.p1.y - arrowLengthSingle / 2 * Math.sin(radialAngle));
          ctx.lineTo(this.p1.x + arrowLengthSingle / 2 * Math.cos(radialAngle), this.p1.y + arrowLengthSingle / 2 * Math.sin(radialAngle));
          ctx.stroke();
          this.drawArrowHead(canvasRenderer, this.p1.x + (arrowLengthSingle + arrowHeadSizeLarge) / 2 * Math.cos(radialAngle), this.p1.y + (arrowLengthSingle + arrowHeadSizeLarge) / 2 * Math.sin(radialAngle), radialAngle, arrowHeadSizeLarge);
          this.drawArrowHead(canvasRenderer, this.p1.x - (arrowLengthSingle + arrowHeadSizeSmall) / 2 * Math.cos(radialAngle), this.p1.y - (arrowLengthSingle + arrowHeadSizeSmall) / 2 * Math.sin(radialAngle), radialAngle + Math.PI, arrowHeadSizeSmall);
      }

      // Draw the rotation/scale center
      ctx.lineWidth = 1 * ls;
      if (this.transformation == "default" || this.transformation == "rotation" || this.transformation == "scaling") {
        ctx.strokeStyle = isHovered ? 'cyan' : ('gray');
        ctx.beginPath();
        ctx.moveTo(this.p2.x - 5 * ls, this.p2.y);
        ctx.lineTo(this.p2.x + 5 * ls, this.p2.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(this.p2.x, this.p2.y - 5 * ls);
        ctx.lineTo(this.p2.x, this.p2.y + 5 * ls);
        ctx.stroke();
      }
    } else if (this.p1) {
      ctx.beginPath();
      ctx.strokeStyle = 'cyan';
      ctx.beginPath();
      ctx.arc(this.p1.x, this.p1.y, 2 * ls, 0, Math.PI * 2, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.p1.x, this.p1.y, 5 * ls, 0, Math.PI * 2, false);
      ctx.stroke();
    }
  }

  move(diffX, diffY) {
    if (this.notDone) return;

    // Move handle and rotation/scale center
    this.p1.x = this.p1.x + diffX;
    this.p1.y = this.p1.y + diffY;
    this.p2.x = this.p2.x + diffX;
    this.p2.y = this.p2.y + diffY;

    // Move bound objects
    let allSuccess = true;
    let unsupportedType = null;

    for (var i in this.objIndices) {
      const obj = this.scene.objs[this.objIndices[i]];
      const result = obj.move(diffX, diffY);
      if (!result) {
        unsupportedType = obj.constructor.type;
        allSuccess = false;
      }
    }

    // Move bound control points
    for (var i in this.controlPoints) {
      this.controlPoints[i].dragContext.originalObj = this.scene.objs[this.controlPoints[i].targetObjIndex].serialize();
      this.controlPoints[i].dragContext.isByHandle = true;
      this.controlPoints[i].dragContext.hasDuplicated = false;
      this.controlPoints[i].dragContext.targetPoint = { x: this.controlPoints[i].newPoint.x, y: this.controlPoints[i].newPoint.y };
      this.controlPoints[i].dragContext.snapContext = {};

      this.controlPoints[i].newPoint.x = this.controlPoints[i].newPoint.x + diffX;
      this.controlPoints[i].newPoint.y = this.controlPoints[i].newPoint.y + diffY;
      this.scene.objs[this.controlPoints[i].targetObjIndex].onDrag(new Mouse(JSON.parse(JSON.stringify(this.controlPoints[i].newPoint)), this.scene, false, 2), JSON.parse(JSON.stringify(this.controlPoints[i].dragContext)), false, false);
    }

    // Set or clear warning
    if (!allSuccess) {
      this.warning = i18next.t('simulator:sceneObjs.Handle.transformationWarning', {
        obj: unsupportedType,
        transformation: i18next.t('simulator:sceneObjs.Handle.transformations.translation')
      });
    } else {
      this.warning = null;
    }

    return allSuccess;
  }

  rotate(angle, center = null) {
    if (this.notDone) return;

    // Use p2 as the default center if none provided
    center = center || this.p2;
    
    // Apply rotation to p1 (the handle position)
    let x = this.p1.x - center.x;
    let y = this.p1.y - center.y;
    this.p1.x = Math.cos(angle) * x - Math.sin(angle) * y + center.x;
    this.p1.y = Math.sin(angle) * x + Math.cos(angle) * y + center.y;
    
    // Only rotate p2 if it's not the center of rotation
    if (center !== this.p2) {
      x = this.p2.x - center.x;
      y = this.p2.y - center.y;
      this.p2.x = Math.cos(angle) * x - Math.sin(angle) * y + center.x;
      this.p2.y = Math.sin(angle) * x + Math.cos(angle) * y + center.y;
    }
    
    // Rotate bound objects
    let allSuccess = true;
    let unsupportedType = null;

    for (var i in this.objIndices) {
      const obj = this.scene.objs[this.objIndices[i]];
      const result = obj.rotate(angle, center);
      if (!result) {
        unsupportedType = obj.constructor.type;
        allSuccess = false;
      }
    }
    
    // Rotate bound control points
    for (var i in this.controlPoints) {
      this.controlPoints[i].dragContext.originalObj = this.scene.objs[this.controlPoints[i].targetObjIndex].serialize();
      this.controlPoints[i].dragContext.isByHandle = true;
      this.controlPoints[i].dragContext.hasDuplicated = false;
      this.controlPoints[i].dragContext.targetPoint = { x: this.controlPoints[i].newPoint.x, y: this.controlPoints[i].newPoint.y };
      this.controlPoints[i].dragContext.snapContext = {};
      
      // Rotate the control point
      x = this.controlPoints[i].newPoint.x - center.x;
      y = this.controlPoints[i].newPoint.y - center.y;
      this.controlPoints[i].newPoint.x = Math.cos(angle) * x - Math.sin(angle) * y + center.x;
      this.controlPoints[i].newPoint.y = Math.sin(angle) * x + Math.cos(angle) * y + center.y;
      
      // Update the target object
      this.scene.objs[this.controlPoints[i].targetObjIndex].onDrag(
        new Mouse(JSON.parse(JSON.stringify(this.controlPoints[i].newPoint)), this.scene, false, 2),
        JSON.parse(JSON.stringify(this.controlPoints[i].dragContext)),
        false,
        false
      );
    }
    
    // Set or clear warning
    if (!allSuccess) {
      this.warning = i18next.t('simulator:sceneObjs.Handle.transformationWarning', {
        obj: unsupportedType,
        transformation: i18next.t('simulator:sceneObjs.Handle.transformations.rotation')
      });
    } else {
      this.warning = null;
    }
    
    return allSuccess;
  }

  scale(scale, center = null) {
    if (this.notDone) return;
    
    // Use p2 as the default center if none provided
    center = center || this.p2;
    
    // Apply scaling to p1 (the handle position)
    this.p1.x = (this.p1.x - center.x) * scale + center.x;
    this.p1.y = (this.p1.y - center.y) * scale + center.y;
    
    // Only scale p2 if it's not the center of scaling
    if (center !== this.p2) {
      this.p2.x = (this.p2.x - center.x) * scale + center.x;
      this.p2.y = (this.p2.y - center.y) * scale + center.y;
    }
        
    // Scale bound objects
    let allSuccess = true;
    let unsupportedType = null;

    for (var i in this.objIndices) {
      const obj = this.scene.objs[this.objIndices[i]];
      const result = obj.scale(scale, center);
      if (!result) {
        unsupportedType = obj.constructor.type;
        allSuccess = false;
      }
    }
    
    // Scale bound control points
    for (var i in this.controlPoints) {
      this.controlPoints[i].dragContext.originalObj = this.scene.objs[this.controlPoints[i].targetObjIndex].serialize();
      this.controlPoints[i].dragContext.isByHandle = true;
      this.controlPoints[i].dragContext.hasDuplicated = false;
      this.controlPoints[i].dragContext.targetPoint = { x: this.controlPoints[i].newPoint.x, y: this.controlPoints[i].newPoint.y };
      this.controlPoints[i].dragContext.snapContext = {};
      
      // Scale the control point
      this.controlPoints[i].newPoint.x = (this.controlPoints[i].newPoint.x - center.x) * scale + center.x;
      this.controlPoints[i].newPoint.y = (this.controlPoints[i].newPoint.y - center.y) * scale + center.y;
      
      // Update the target object
      this.scene.objs[this.controlPoints[i].targetObjIndex].onDrag(
        new Mouse(JSON.parse(JSON.stringify(this.controlPoints[i].newPoint)), this.scene, false, 2),
        JSON.parse(JSON.stringify(this.controlPoints[i].dragContext)),
        false,
        false
      );
    }
    
    // Set or clear warning
    if (!allSuccess) {
      this.warning = i18next.t('simulator:sceneObjs.Handle.transformationWarning', {
        obj: unsupportedType,
        transformation: i18next.t('simulator:sceneObjs.Handle.transformations.scaling')
      });
    } else {
      this.warning = null;
    }
    
    return allSuccess;
  }

  checkMouseOver(mouse) {
    let dragContext = {};
    if (this.notDone) return;
    if (mouse.isOnPoint(this.p1) || (this.transformation != "default" && geometry.distance(this.p1, mouse.pos) < 20 * this.scene.lengthScale)) {
      dragContext.part = 1;
      dragContext.targetPoint_ = geometry.point(this.p1.x, this.p1.y);
      dragContext.mousePos0 = geometry.point(this.p1.x, this.p1.y);
      dragContext.snapContext = {};
      return dragContext;
    }
    if ((this.transformation == "default" || this.transformation == "rotation" || this.transformation == "scaling") && mouse.isOnPoint(this.p2)) {
      dragContext.part = 2;
      dragContext.targetPoint = geometry.point(this.p2.x, this.p2.y);
      dragContext.mousePos0 = geometry.point(this.p2.x, this.p2.y);
      dragContext.snapContext = {};
      return dragContext;
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    if (this.notDone) return;
    
    if (shift) {
      var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
    } else {
      var mousePos = mouse.getPosSnappedToGrid();
      dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
    }
    
    if (dragContext.part == 1) {
      if ((ctrl && shift) || this.transformation == "scaling") { 
        // Scaling
        var factor = geometry.distance(this.p2, mouse.pos) / geometry.distance(this.p2, dragContext.targetPoint_);
        if (factor < 1e-5) return;
        
        // Apply scale step if enabled
        if (this.scaleStep !== 0) {
          // Calculate the step size
          const stepFactor = this.scaleStep > 0 ? 
                            (1 + this.scaleStep / 100) : 
                            (1 / (1 - Math.abs(this.scaleStep) / 100));
          
          // Find the closest power of stepFactor
          // ln(factor) / ln(stepFactor) gives us how many steps we need
          const stepCount = Math.round(Math.log(factor) / Math.log(stepFactor));
          
          // Replace with the exact power of the step factor
          factor = Math.pow(stepFactor, stepCount);
        }
        
        // Call the scale method with the snapped factor
        this.scale(factor, this.p2);
      } else if (ctrl || this.transformation == "rotation") {
        // Rotation
        var theta = Math.atan2(this.p2.y - mouse.pos.y, this.p2.x - mouse.pos.x) - 
                    Math.atan2(this.p2.y - dragContext.targetPoint_.y, this.p2.x - dragContext.targetPoint_.x);
        
        // Apply rotation step if enabled
        if (this.rotateStep > 0) {
          // Convert step from degrees to radians
          const stepRadians = this.rotateStep * Math.PI / 180;
          
          // Normalize to -180 to 180 degree range
          while (theta > Math.PI) theta -= 2 * Math.PI;
          while (theta <= -Math.PI) theta += 2 * Math.PI;

          // Round to nearest step
          theta = Math.round(theta / stepRadians) * stepRadians;
          
        }
        
        // Call the rotate method with the snapped angle
        this.rotate(theta, this.p2);
      } else {
        // Translation
        var diffX = this.transformation == "yTranslation" ? 0 : mousePos.x - dragContext.targetPoint_.x;
        var diffY = this.transformation == "xTranslation" ? 0 : mousePos.y - dragContext.targetPoint_.y;
        
        // Apply movement step if enabled
        if (this.moveStep > 0) {
          // Round to nearest step
          // Scale the step by the scene's lengthScale to make it consistent with grid size
          const step = this.moveStep * this.scene.lengthScale;
          diffX = Math.round(diffX / step) * step;
          diffY = Math.round(diffY / step) * step;
        }
        
        // Call the move method with the snapped differences
        this.move(diffX, diffY);
      }
      
      // Update the target point to the new p1 position
      dragContext.targetPoint_.x = this.p1.x;
      dragContext.targetPoint_.y = this.p1.y;
    }

    if (dragContext.part == 2) {
      this.p2.x = mousePos.x;
      this.p2.y = mousePos.y;
    }
  }

  /**
   * Add (bind) a control point to the handle.
   * @param {ControlPoint} controlPoint - The control point to be bound.
   */
  addControlPoint(controlPoint) {
    controlPoint.dragContext.originalObj = this.scene.objs[controlPoint.targetObjIndex];
    controlPoint.dragContext.isByHandle = true;
    controlPoint.dragContext.hasDuplicated = false;
    controlPoint.newPoint = controlPoint.dragContext.targetPoint;
    controlPoint = JSON.parse(JSON.stringify(controlPoint));
    this.controlPoints.push(controlPoint);
  }

  /**
   * Add (bind) an entire object to the handle.
   * @param {number} objIndex - The index of the object to be bound.
   */
  addObject(objIndex) {
    // Check if this object is already bound to avoid duplicates
    if (!this.objIndices.includes(objIndex)) {
      this.objIndices.push(objIndex);
    }
  }

  /**
   * Finish creating the handle.
   * @param {Point} point - The position of the handle.
   */
  finishHandle(point) {
    this.p1 = point;
    
    let totalX = 0;
    let totalY = 0;
    let pointCount = 0;
    
    // Add all control points to the average
    for (let i in this.controlPoints) {
      totalX += this.controlPoints[i].newPoint.x;
      totalY += this.controlPoints[i].newPoint.y;
      pointCount++;
    }
    
    // Check default centers from bound objects
    for (let i in this.objIndices) {
      const obj = this.scene.objs[this.objIndices[i]];
      const defaultCenter = obj.getDefaultCenter && obj.getDefaultCenter();
      
      if (defaultCenter) {
        totalX += defaultCenter.x;
        totalY += defaultCenter.y;
        pointCount++;
      }
    }
    
    // Calculate the average position if we have any points
    if (pointCount > 0) {
      this.p2 = geometry.point(totalX / pointCount, totalY / pointCount);
    } 
    // If no points to average, fall back to viewport center
    else {
      const centerX = (this.scene.width * 0.5 - this.scene.origin.x) / this.scene.scale;
      const centerY = (this.scene.height * 0.5 - this.scene.origin.y) / this.scene.scale;
      this.p2 = geometry.point(centerX, centerY);
    }
    
    this.notDone = false;
  }

  /**
   * Draw an filled arrow head at the given position with the given angle and size.
   * @param {CanvasRenderer} canvasRenderer - The canvas renderer.
   * @param {number} x - The x-coordinate of the arrow head.
   * @param {number} y - The y-coordinate of the arrow head.
   * @param {number} angle - The angle of the arrow head.
   * @param {number} size - The size of the arrow head.
   */
  drawArrowHead(canvasRenderer, x, y, angle, size) {
    const ctx = canvasRenderer.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size);
    ctx.lineTo(-size, size);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

};

export default Handle;