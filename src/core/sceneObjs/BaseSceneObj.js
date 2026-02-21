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

/**
 * @typedef {Object} PropertyDescriptor
 * @property {string} key - Dot-separated property path (e.g. 'focalLength', 'p1', 'path.0', 'params.r1'). Numeric segments are array indices. Empty string '' means the root object itself (e.g. PointSource x/y).
 * @property {'point'|'number'|'boolean'|'dropdown'|'equation'|'text'|'style'|'array'} type - The type of the property.
 * @property {'stroke'|'fill'} [styleKind] - For 'style' type: 'stroke' = line/stroke style (color, width, dash); 'fill' = fill style (color only). Required when type is 'style'.
 * @property {string} label - Pre-rendered HTML label string (i18n already expanded).
 * @property {string|null} [info] - Optional pre-rendered HTML for an info popover (i18n already expanded).
 * @property {Object<string,string>|null} [options] - For 'dropdown' type: value -> display label map (already translated).
 * @property {Array<string|RegExp>|null} [variables] - For 'equation' type: valid variable names (literal strings or RegExp patterns).
 * @property {boolean} [differentiable] - For 'equation' type: if true, only the differentiable function subset is allowed (for symbolic derivative). Default false.
 * @property {boolean} [readOnly] - If true, the property is display-only (e.g. module name in ModuleObj).
 * @property {boolean} [updatesSchema] - If true, changing this property invalidates the schema (reserved for future use).
 * @property {Array<PropertyDescriptor>|null} [itemSchema] - For 'array' type: schema for each array item. Keys within itemSchema are relative to each array element.
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
 * @property {boolean} [isUndefinedBehavior] - Whether the behavior of the ray is undefined. For example, when the ray is incident on a corner of a glass.
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
    /** @property {string|null} name - The name of the object. */
    this.name = jsonObj?.name || '';

    // Check for unknown keys in the jsonObj
    if (jsonObj) {
      const serializableDefaults = this.constructor.serializableDefaults;
      const knownKeys = ['type', 'name', ...Object.keys(serializableDefaults)];
      for (const key in jsonObj) {
        if (!knownKeys.includes(key)) {
          this.scene.error = i18next.t('simulator:generalErrors.unknownObjectKey', { key, type: this.constructor.type }); // Here the error is stored in the scene, not the object, to prevent further errors occurring in the object from replacing it, and also because this error likely indicates an incompatible scene version.
        }
      }

      // Set the properties of the object
      for (const propName in serializableDefaults) {
        const stringifiedDefault = JSON.stringify(serializableDefaults[propName]);
        if (jsonObj.hasOwnProperty(propName)) {
          const stringifiedValue = JSON.stringify(jsonObj[propName]);
          this[propName] = JSON.parse(stringifiedValue);
        } else {
          this[propName] = JSON.parse(stringifiedDefault);
        }
      }
    } else {
      // No jsonObj, use defaults
      const serializableDefaults = this.constructor.serializableDefaults;
      for (const propName in serializableDefaults) {
        const stringifiedDefault = JSON.stringify(serializableDefaults[propName]);
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
    const serializableDefaults = {
      name: '',
      ...this.constructor.serializableDefaults
    };

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
   * Whether the object can merge its surface with the surfaces of glasses (here "glass" means a subclass of `BaseGlass`). For glasses this is always true. Suppose a ray is incident on the overlapping surfaces of N+1 objects. If all objects has this property set to true, and N of them are glasses, then `onRayIncident` will be called only on the other one (glass or not), with the N glasses being in `surfaceMergingObjs`. Otherwise, the behavior is undefined, and a warning will be shown.
   */
  static mergesWithGlass = false;

  /**
   * Get the property schema for this object type. This is for the UI of the visual editor in the sidebar, mainly designed for editing object templates in modules, and not intended for basic usage of this app (unlike the object bar). Therefore, the schema only contains direct properties (not derived from other properties), and are context-independent (e.g. not depend on whether "Simulate Colors" is on). The only context is the "resource"-like information of the scene such as the module parameter names. Also, since it is for module templates, the objData is not the class instance, but the raw JSON data of the object/template.
   * Returns an ordered array of {@link PropertyDescriptor} objects describing all editable properties.
   * This is a static method that works on raw JSON data (no instance needed), so it can be used
   * for both live objects and module templates. The schema is context-independent: it always lists
   * all properties a type can have, regardless of current scene settings.
   * @param {Object} objData - The raw JSON data of the object (or template).
   * @param {Scene} scene - The scene instance. Provides access to scene-level definitions (e.g. `scene.modules`). Must not be used to branch on scene settings.
   * @returns {PropertyDescriptor[]} The property descriptors.
   */
  static getPropertySchema(objData, scene) {
    return [];
  }

  /**
   * Populate the object bar. Note that this is different from the property schema (which is for the sidebar). The object bar is for regular users, and contains whatever properties which are most convenient for the users to edit, so it may contains dependent properties (like focal length of an arc mirror, which is derived from the three points of the arc). And since editing the points for regular users is done in the canvas, their coordinates are not shown in the object bar.
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
   * @returns {boolean} True if the movement is done properly in the sense that if every object is moved by the same displacement, the resulting scene should look essentially the same as if the viewport is moved by the opposite displacement. False otherwise.
   */
  move(diffX, diffY) {
    return false;
  }

  /**
   * Rotate the object by the given angle.
   * @param {number} angle - The angle in radians. Positive for counter-clockwise.
   * @param {Point} center - The center of rotation. If null, there should be a default center of rotation (which is used when the user uses the +/- keys to rotate the object)
   * @returns {boolean} True if the rotation is done properly in the sense that if every object is rotated by the same angle and center, the resulting scene should look essentially the same as if the viewport is rotated by the opposite angle. False otherwise.
   */
  rotate(angle, center) {
    return false;
  }

  /**
   * Scale the object by the given scale factor.
   * @param {number} scale - The scale factor.
   * @param {Point} center - The center of scaling. If null, there should be a default center of scaling.
   * @returns {boolean} True if the scaling is done properly in the sense that if every object is scaled by the same scale factor and center, the resulting scene should look essentially the same as if the viewport is scaled by the same scale factor. False otherwise.
   */
  scale(scale, center) {
    return false;
  }

  /**
   * Get the default center of rotation or scaling.
   * @returns {Point} The default center of rotation or scaling.
   */
  getDefaultCenter() {
    return null;
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
   * @param {Array<BaseGlass>} surfaceMergingObjs - The glass objects that are merged with the current object. When a ray is incident on the overlapping surfaces of N+1 objects with `mergesWithGlass === true`, and N of them are glasses, then this function will be called only on the other one (glass or not), with the N glasses being in this array. The function will need to handle the combination of the surfaces. Note that treating them as two very close surfaces may not give the correct result due to an essential discontinuity of ray optics (which is smoothed out at the scale of the wavelength in reality).
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