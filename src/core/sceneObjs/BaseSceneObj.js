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

/**
 * @typedef {Object} ConstructReturn
 * @property {boolean} [isDone] - Whether the construction is done.
 * @property {boolean} [requiresObjBarUpdate] - Whether the object bar should be updated.
 * @property {boolean} [isCancelled] - Whether the construction is cancelled.
 */

/**
 * @typedef {Object} SimulationReturn
 * @property {boolean} [isAbsorbed] - Whether the object absorbs the ray.
 * @property {Array<Ray>} [newRays] - The new rays to be added.
 * @property {number} [truncation] - The brightness of truncated rays due to numerical cutoff (e.g. after a large number of partial internal reflections within a glass). This is used to estimate the error of the simulation.
 * @property {number} [brightnessScale] - The actual brightness of the ray divided by the brightness inferred from the properties of the object. This should be 1 when "ray density" is high enough. When "ray density" is low, the calculated brightness of the individual rays will be too high (alpha value for rendering will be larger than 1). In this case, the object should rescale all the brightness of the rays by a factor to keep the maximum alpha value to be 1. This factor should be returned here and is used to generate warnings.
 */

/**
 * Base class for objects (optical elements, decorations, etc.) in the scene.
 * @class
 */
class BaseSceneObj {

  /**
   * @param {Scene} scene - The scene the object belongs to.
   * @param {Object|null} jsonObj - The JSON object to be deserialized, if any.
   */
  constructor(scene, jsonObj) {
    /** @property {Scene} scene - The scene the object belongs to. */
    this.scene = scene;
    /** @property {string|null} error - The error message of the object. */
    this.error = null;
    /** @property {string|null} warning - The warning message of the object. */
    this.warning = null;

    const serializableDefaults = this.constructor.serializableDefaults;
    for (const propName in serializableDefaults) {
      const stringifiedDefault = JSON.stringify(serializableDefaults[propName]);
      if (jsonObj && jsonObj.hasOwnProperty(propName)) {
        const stringifiedValue = JSON.stringify(jsonObj[propName]);
        this[propName] = JSON.parse(stringifiedValue);
      } else {
        this[propName] = JSON.parse(stringifiedDefault);
      }
    }
  }

  /**
   * Serializes the object to a JSON object.
   * @returns {Object} The serialized JSON object.
   */
  serialize() {
    const jsonObj = { type: this.constructor.type };
    const serializableDefaults = this.constructor.serializableDefaults;

    for (const propName in serializableDefaults) {
      const stringifiedValue = JSON.stringify(this[propName]);
      const stringifiedDefault = JSON.stringify(serializableDefaults[propName]);
      if (stringifiedValue !== stringifiedDefault) {
        jsonObj[propName] = JSON.parse(stringifiedValue);
      }
    }

    return jsonObj;
  }
  
  /**
   * Check whether the given properties of the object are all the default values.
   * @param {string[]} propertyNames - The property names to be checked.
   * @returns {boolean} Whether the properties are all the default values.
   */
  arePropertiesDefault(propertyNames) {
    const serializableDefaults = this.constructor.serializableDefaults;
    for (const propName of propertyNames) {
      const stringifiedValue = JSON.stringify(this[propName]);
      const stringifiedDefault = JSON.stringify(serializableDefaults[propName]);
      if (stringifiedValue !== stringifiedDefault) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * The type of the object.
   */
  static type = '';

  /**
   * The default values of the properties of the object which are to be serialized. The keys are the property names and the values are the default values. If some properties is default, they will not be serialized and will be deserialized to the default values.
   */
  static serializableDefaults = {};

  /**
   * Whether the object is optical (i.e. is a light source, interacts with rays, or detects rays).
   */
  static isOptical = false;

  /**
   * Whether the object supports surface merging. (This is currently only for glasses, where the surfaces of two glasses are merged to form a single surface if the surfaces overlap.)
   */
  static supportsSurfaceMerging = false;

  /**
   * Populate the object bar.
   * Called when the user selects the object (it is selected automatically when the user creates it, so the construction may not be completed at this stage).
   * @param {ObjBar} objBar - The object bar to be populated.
   */
  populateObjBar(objBar) {
    // Do nothing by default
  }

  /**
   * Get the z-index of the object for the sequence of drawing.
   * Called before the simulator starts to draw the scene.
   * @returns {number} The z-index. The smaller the number is, the earlier `draw` is called.
   */
  getZIndex() {
    return 0;
  }

  /**
   * Draw the object on the canvas.
   * Called once before the simulator renders the light with `isAboveLight === false` and once after with `isAboveLight === true`.
   * Due to historical reason, some objects use this function to do some initialization. This should be avoided in the future.
   * @param {CanvasRenderer} canvasRenderer - The canvas renderer.
   * @param {boolean} isAboveLight - Whether the rendering layer is above the light layer.
   * @param {boolean} isHovered - Whether the object is hovered by the mouse, which determines the style of the object to be drawn, e.g., with lighlighted color.
   */
  draw(canvasRenderer, isAboveLight, isHovered) {
    // Do nothing by default
  }

  /**
   * Move the object by the given displacement.
   * Called when the user use arrow keys to move the object.
   * @param {number} diffX - The x-coordinate displacement.
   * @param {number} diffY - The y-coordinate displacement.
   */
  move(diffX, diffY) {
    // Do nothing by default
  }

  /**
   * Rotate the object. (This feature is incomplete and currently only implemented for `ConcaveDiffractionGrating`.)
   * @param {number} cw
   */
  rotate(cw) {
    // Do nothing by default
  }

  /**
   * Mouse down event when the object is being constructed by the user.
   * @param {Mouse} mouse - The mouse object.
   * @param {boolean} ctrl - Whether the control key is pressed.
   * @param {boolean} shift - Whether the shift key is pressed.
   * @returns {ConstructReturn} The return value.
   */
  onConstructMouseDown(mouse, ctrl, shift) {
    // Do nothing by default
  }

  /**
   * Mouse move event when the object is being constructed by the user.
   * @param {Mouse} mouse - The mouse object.
   * @param {boolean} ctrl - Whether the control key is pressed.
   * @param {boolean} shift - Whether the shift key is pressed.
   * @returns {ConstructReturn} The return value.
   */
  onConstructMouseMove(mouse, ctrl, shift) {
    // Do nothing by default
  }

  /**
   * Mouse up event when the object is being constructed by the user.
   * @param {Mouse} mouse - The mouse object.
   * @param {boolean} ctrl - Whether the control key is pressed.
   * @param {boolean} shift - Whether the shift key is pressed.
   * @returns {ConstructReturn} The return value.
   */
  onConstructMouseUp(mouse, ctrl, shift) {
    // Do nothing by default
  }

  /**
   * Undo event when the object is being constructed by the user.
   * @returns {ConstructReturn} The return value.
   */
  onConstructUndo() {
    return {
      isCancelled: true
    }
  }

  /**
   * Check whether the mouse is over the object, which is called when the user moves the mouse over the scene. This is used for deciding the highlighting of the object, and also for deciding that if the user starts dragging at this position, which part of the object should be dragged.
   * @param {Mouse} mouse - The mouse object.
   * @returns {DragContext|null} The drag context if the user starts dragging at this position, or null if the mouse is not over the object.
   */
  checkMouseOver(mouse) {
    return null;
  }

  /**
   * The event when the user drags the object, which is fired on every step during the dragging. The object should be updated according to `DragContext` which is returned by `checkMouseOver`. `dragContext` can be modified during the dragging.
   * @param {Mouse} mouse - The mouse object.
   * @param {DragContext} dragContext - The drag context.
   * @param {boolean} ctrl - Whether the control key is pressed.
   * @param {boolean} shift - Whether the shift key is pressed.
   */
  onDrag(mouse, dragContext, ctrl, shift) {
    // Do nothing by default
  }

  /**
   * The event when the simulation starts.
   * If this object is a light source, it should emit rays here by setting `newRays`. If the object is a detector, it may do some initialization here.
   * @returns {SimulationReturn|null} The return value.
   */
  onSimulationStart() {
    // Do nothing by default
  }

  

  /**
   * Check whether the object intersects with the given ray.
   * Called during the ray tracing when `ray` is to be tested whether it intersects with the object. Find whether they intersect and find the nearset intersection if so. Implemented only by optical elements that affects or detect rays.
   * @param {Ray} ray - The ray.
   * @returns {Point|null} - The intersection (closest to the beginning of the ray) if they intersect.
   */
  checkRayIntersects(ray) {
    return null;
  }


  /**
   * The event when a ray is incident on the object.
   * Called during the ray tracing when `ray` has been calculated to be incident on the object at the `incidentPoint`. Perform the interaction between `ray` and the object. Implemented only by optical elements that affects or detect rays.
   * If `ray` is absorbed by the object, return `{ isAbsorbed: true }`.
   * If there is a primary outgoing ray, directly modify `ray` to be the outgoing ray. This includes the case when the object is a detector that does not modify the direction of the ray.
   * If there are secondary rays to be emitted, return `{ newRays: [ray1, ray2, ...] }`. Note that if there are more than one secondary rays, image detection does not work in the current version, and `rayN.gap` should be set to `true`. But for future support, the secondary ray which is to be of the same continuous bunch or rays should have consistent index in the `newRays` array.
   * Sometimes keeping tracks of all the rays may result in infinite loop (such as in a glass). Depending on the situation, some rays with brightness below a certain threshold (such as 0.01) may be truncated. In this case, the brightness of the truncated rays should be returned as `truncation`.
   * @param {Ray} ray - The ray.
   * @param {number} rayIndex - The index of the ray in the array of all rays currently in the scene in the simulator. In particular, in a bunch of continuous rays, the rays are ordered by the time they are emitted, and the index is the order of emission. This can be used to downsample the rays and increase the individual brightness if it is too low.
   * @param {Point} incidentPoint - The point where the ray is incident on the object, which is the intersection point found by `checkRayIntersects`.
   * @param {Array<BaseSceneObj>} surfaceMergingObjs - The objects that are merged with the current object. If two or more objects with `supportsSurfaceMerging === true` has overlapping surfaces (often acheived by using the grid), and if a ray is incident on those surfaces together, only one of the object will be have `onRayIncident` being called, and the other objects will be in `surfaceMergingObjs`. In this case, this function must also deal with the combination of the surface before doing the actual interaction. Note that treating them as two very close surfaces may not give the correct result due to an essential discontinuity of ray optics (which is smoothed out at the scale of the wavelength in reality).
   * @returns {SimulationReturn|null} The return value.
   */
  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
    // Do nothing by default
  }

  /**
   * Get the error message of the object.
   * @returns {string|null} The error message.
   */
  getError() {
    return this.error;
  }

  /**
   * Get the warning message of the object.
   * @returns {string|null} The warning message.
   */
  getWarning() {
    return this.warning;
  }

}

export default BaseSceneObj;