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

import * as sceneObjs from './sceneObjs.js';
import { versionUpdate } from './versionUpdate.js';
import i18next from 'i18next';
import seedrandom from 'seedrandom';

/**
 * The version of the JSON data format of the scene, which matches the major version number of the app starting from version 5.0.
 * @const {number}
 */
export const DATA_VERSION = 5;

/**
 * Represents the optical scene for simulation. The scene contains the instances of scene objects (from {@link sceneObjs}) and the settings of the simulation. Scene objects include optical elements (e.g. mirrors, lenses), detectors, decorations (e.g. rulers, text labels), and special objects (e.g. handles, cropboxes). It also contains the module definitions used in the scene. Since the settings of the scene may affect the behavior of the scene objects, a reference to the scene is also stored in each scene object.
 * 
 * The data represented by the scene can be serialized to JSON and deserialized from JSON. The JSON data format of the scene is versioned, and the version number is stored in the JSON data. The scene is backward-compatible with older versions of the JSON data format, and the scene is converted to the current version when loaded. Note that the background image of the scene is not serialized, and the viewport size is adapted to the current viewport when deserialized.
 * 
 * In the Ray Optics Simulator web app, a single instance is used, representing the current scene being edited and simulated, and is the main data structure of the app. The scene is serialized or deserialized to/from JSON when saving, loading, sync with URL, or undo/redo.
 * Some scene-unrelated settings for the app (e.g. whether to show the status box) are not stored in the scene but in the browser's local storage.
 * 
 * This class can also be used by other projects, including those running in a standalone environment (e.g. Node.js).
 * @class
 * @property {string} name - The name of the scene.
 * @property {Object<string,ModuleDef>} modules - The definitions of modules used in the scene.
 * @property {Array<BaseSceneObj>} objs - The objects (optical elements and/or decorations created by the user with "Tools") in the scene.
 * @property {string} mode - The mode of the scene. Possible values: 'rays' (Rays), 'extended' (Extended Rays), 'images' (All Images), 'observer' (Seen by Observer).
 * @property {number} rayModeDensity - The density of rays in 'rays' and 'extended' modes.
 * @property {number} imageModeDensity - The density of rays in 'images' and 'observer' modes.
 * @property {boolean} showGrid - The "Grid" option indicating if the grid is visible.
 * @property {boolean} snapToGrid - The "Snap to Grid" option indicating if mouse actions are snapped to the grid.
 * @property {boolean} lockObjs - The "Lock Objects" option indicating if the objects are locked.
 * @property {number} gridSize - The size of the grid.
 * @property {Circle|null} observer - The observer of the scene, null if not set.
 * @property {number} lengthScale - The length scale used in line width, default font size, etc in the scene.
 * @property {Point} origin - The origin of the scene in the viewport.
 * @property {number} scale - The scale factor (the viewport CSS pixel per internal length unit) of the scene.
 * @property {number} width - The width (in CSS pixels) of the viewport.
 * @property {number} height - The height (in CSS pixels) of the viewport.
 * @property {boolean} simulateColors - The "Simulate Color" option indicating if the color (wavelength) of the rays is simulated (also affecting whether the options of color filtering or Cauchy coefficients of some objects are shown.)
 * @property {string} colorMode - The mode of rendering the color of rays (color mapping functions, etc, including the brightness behavior when `simulateColors` is false). Possible values are 'default' (when 'Correct Brightness' is off), 'linear' (Linear Value), 'linearRGB' (Linear RGB), 'reinhard' (Reinhard), and 'colorizedIntensity' (Color-coded Intensity).
 * @property {boolean} showRayArrows - The "Show Ray Arrows" option indicating if the arrows are shown on the rays indicating its direction.
 * @property {boolean} symbolicBodyMerging - The "Symbolic body-merging" option in the gradient-index glass objects (which is a global option), indicating if the symbolic math is used to calculate the effective refractive index resulting from the "body-merging" of several gradient-index glass objects.
 * @property {string|null} randomSeed - The seed for the random number generator used in the simulation, null if using randomly generated seed. Using a seed allows the simulation to be deterministic for the same version of this app when randomness is used. However, reproducibility is only guaranteed if the scene is just loaded (that is, no other editing has been done on the scene). Also, reproducibility is not guaranteed across different versions of the app.
 * @property {function} rng - The random number generator.
 * @property {Object|null} backgroundImage - The background image of the scene, null if not set.
 */
class Scene {
  static serializableDefaults = {
    name: '',
    modules: {},
    objs: [],
    mode: 'rays',
    rayModeDensity: 0.1,
    imageModeDensity: 1,
    showGrid: false,
    snapToGrid: false,
    lockObjs: false,
    gridSize: 20,
    observer: null,
    lengthScale: 1,
    origin: { x: 0, y: 0 },
    scale: 1,
    width: 1500,
    height: 900,
    simulateColors: false,
    colorMode: 'default',
    showRayArrows: false,
    symbolicBodyMerging: false,
    randomSeed: null
  };

  constructor() {
    this.backgroundImage = null;
    this.error = null;
    this.warning = null;
    this.rng = new seedrandom(new Date().getTime().toString());
    this.loadJSON(JSON.stringify({ version: DATA_VERSION }), () => { });
  }

  /**
  * Set the size (in CSS pixels) for the viewport of the scene.
  * @method setViewportSize
  * @param {number} width
  * @param {number} height
  */
  setViewportSize(width, height) {
    this.width = width;
    this.height = height;
  }


  /** @property {number} rayDensity - The mode-dependent ray density. */
  get rayDensity() {
    return this.mode == 'rays' || this.mode == 'extended' ? this.rayModeDensity : this.imageModeDensity;
  }

  set rayDensity(val) {
    if (this.mode == 'rays' || this.mode == 'extended') {
      this.rayModeDensity = val;
    } else {
      this.imageModeDensity = val;
    }
  }

  /** @property {Array<BaseSceneObj>} opticalObjs - The objects in the scene which are optical. Module objects are expanded recursively. If the user edits only the non-optical part of the scene, then the content of this array will not change. */
  get opticalObjs() {
    function expandObjs(objs) {
      let expandedObjs = [];
      for (let obj of objs) {
        if (obj.constructor === sceneObjs['ModuleObj']) {
          expandedObjs = expandedObjs.concat(expandObjs(obj.objs));
        } else {
          expandedObjs.push(obj);
        }
      }
      return expandedObjs;
    }

    return expandObjs(this.objs).filter(obj => obj.constructor.isOptical);
  }

  /**
   * The callback function when the entire scene or a resource (e.g. image) is loaded.
   * @callback loadJSONCallback
   * @param {boolean} needFullUpdate - Whether the scene needs a full update.
   * @param {boolean} completed - Whether the scene is completely loaded.
   */

  /**
  * Load the scene from JSON.
  * @param {string} json
  * @param {loadJSONCallback} callback - The callback function when the entire scene or a resource (e.g. image) is loaded.
  */
  loadJSON(json, callback) {
    this.error = null;
    this.warning = null;
    try {
      let jsonData = JSON.parse(json);

      // Convert the scene from old versions if necessary.
      if (!jsonData.version) {
        jsonData = versionUpdate(jsonData);
      } else if (typeof jsonData.version === 'string' || jsonData.version > DATA_VERSION) {
        // Newer than the current version or non-numeric version (e.g. "5.1")
        this.error = i18next.t('simulator:generalErrors.newerVersion');
        callback(true, true);
        return;
      } else if (jsonData.version < DATA_VERSION) {
        jsonData = versionUpdate(jsonData);
      }

      const serializableDefaults = Scene.serializableDefaults;

      const originalWidth = this.width || serializableDefaults.width;
      const originalHeight = this.height || serializableDefaults.height;

      // Take the approximated size of the current viewport, which may be different from that of the scene to be loaded.
      const approximatedWidth = Math.ceil(originalWidth / 100) * 100;
      const approximatedHeight = Math.ceil(originalHeight / 100) * 100;

      // Check for unknown keys in the scene JSON
      const knownKeys = ['version', 'name', 'modules', 'objs', 'backgroundImage', ...Object.keys(serializableDefaults)];
      for (const key in jsonData) {
        if (!knownKeys.includes(key)) {
          this.error = i18next.t('simulator:generalErrors.unknownSceneKey', { key });
          callback(true, true);
          return;
        }
      }

      // Check for valid enumerable values
      const validModes = ['rays', 'extended', 'images', 'observer'];
      if (jsonData.mode && !validModes.includes(jsonData.mode)) {
        this.error = i18next.t('simulator:generalErrors.unknownPropertyValue', { property: 'mode', value: jsonData.mode });
        callback(true, true);
        return;
      }

      const validColorModes = ['default', 'linear', 'linearRGB', 'reinhard', 'colorizedIntensity'];
      if (jsonData.colorMode && !validColorModes.includes(jsonData.colorMode)) {
        this.error = i18next.t('simulator:generalErrors.unknownPropertyValue', { property: 'colorMode', value: jsonData.colorMode });
        callback(true, true);
        return;
      }

      // Set the properties of the scene. Use the default properties if the JSON data does not contain them.
      for (let key in serializableDefaults) {
        if (!(key in jsonData)) {
          jsonData[key] = JSON.parse(JSON.stringify(serializableDefaults[key]));
        }
        this[key] = jsonData[key];
      }

      // Rescale the scene to fit the current viewport.
      let rescaleFactor = 1;

      if (jsonData.width / jsonData.height > approximatedWidth / approximatedHeight) {
        rescaleFactor = jsonData.width / approximatedWidth;
      } else {
        rescaleFactor = jsonData.height / approximatedHeight;
      }

      this.scale = jsonData.scale / rescaleFactor;
      this.origin.x = jsonData.origin.x / rescaleFactor;
      this.origin.y = jsonData.origin.y / rescaleFactor;
      this.width = originalWidth;
      this.height = originalHeight;

      // Load the random number generator.
      if (this.randomSeed) {
        this.rng = new seedrandom(this.randomSeed);
      } else {
        this.rng = new seedrandom(new Date().getTime().toString());
      }

      // Load the objects in the scene.
      this.objs = [];
      for (const objData of jsonData.objs) {
        if (!sceneObjs[objData.type]) {
          this.error = i18next.t('simulator:generalErrors.unknownObjectType', { type: objData.type });
          break;
        }
        this.objs.push(new sceneObjs[objData.type](this, objData));
      }

      // If there's an error, stop importing
      if (this.error) {
        callback(true, true);
        return;
      }

      // Load the background image.
      if (jsonData.backgroundImage) {
        this.backgroundImage = new Image();
        this.backgroundImage.src = "../gallery/" + jsonData.backgroundImage;
        this.backgroundImage.onload = function (e1) {
          callback(false, true);
        }
        callback(true, false);
      } else {
        // The JSON data does not contain the background image. Currently this does not mean that we should clear the background image (as the undo/redo history does not currently store it). However, this may change in the future.
        callback(true, true);
      }
    } catch (e) {
      this.error = e.toString();
      this.objs = [];
      callback(true, true);
    }
  }

  /**
   * Convert the scene to JSON.
   * @method toJSON
   * @returns {string} The JSON string representing the scene.
   */
  toJSON() {
    let jsonData = { version: DATA_VERSION };

    // Put the name of the scene first.
    if (this.name) {
      jsonData.name = this.name;
    }

    // And then the module definitions.
    if (Object.keys(this.modules).length > 0) {
      jsonData.modules = this.modules;
    }

    // Serialize the objects in the scene.
    jsonData.objs = this.objs.map(obj => obj.serialize());

    // Use approximated size of the current viewport.
    const approximatedWidth = Math.ceil(this.width / 100) * 100;
    const approximatedHeight = Math.ceil(this.height / 100) * 100;
    jsonData.width = approximatedWidth;
    jsonData.height = approximatedHeight;

    // Export the rest of non-default properties.
    const serializableDefaults = Scene.serializableDefaults;
    for (let propName in serializableDefaults) {
      if (!jsonData.hasOwnProperty(propName)) {
        const stringifiedValue = JSON.stringify(this[propName]);
        const stringifiedDefault = JSON.stringify(serializableDefaults[propName]);
        if (stringifiedValue !== stringifiedDefault) {
          jsonData[propName] = JSON.parse(stringifiedValue);
        }
      }
    }

    return JSON.stringify(jsonData, null, 2);
  }

  /**
   * Add an object to the scene.
   * @param {BaseSceneObj} obj
   */
  pushObj(obj) {
    this.objs.push(obj);
    obj.scene = this;
  }

  /**
   * Add an object to the scene at the beginning of the list.
   * @param {BaseSceneObj} obj
   */
  unshiftObj(obj) {
    this.objs.unshift(obj);
    obj.scene = this;
    
    // Update `targetObjIndex` of all handle objects.
    for (var i in this.objs) {
      if (this.objs[i].constructor.type == "Handle") {
        for (var j in this.objs[i].controlPoints) {
          this.objs[i].controlPoints[j].targetObjIndex++;
        }
        for (var j in this.objs[i].objIndices) {
          this.objs[i].objIndices[j]++;
        }
      }
    }
  }

  /**
   * Remove the object at an index.
   * @param {number} index
   */
  removeObj(index) {
    for (var i = index; i < this.objs.length - 1; i++) {
      let oldObj = this.objs[i+1].serialize();
      this.objs[i] = new sceneObjs[oldObj.type](this, oldObj);
    }

    for (var i in this.objs) {
      if (this.objs[i].constructor.type == "Handle") {
        // Filter out the control points that reference the deleted object
        // and adjust indices for control points that reference objects after the deleted one
        let newControlPoints = [];
        for (var j = 0; j < this.objs[i].controlPoints.length; j++) {
          if (this.objs[i].controlPoints[j].targetObjIndex > index) {
            // Adjust index for objects after the deleted one
            this.objs[i].controlPoints[j].targetObjIndex--;
            newControlPoints.push(this.objs[i].controlPoints[j]);
          } else if (this.objs[i].controlPoints[j].targetObjIndex != index) {
            // Keep control points that don't reference the deleted object
            newControlPoints.push(this.objs[i].controlPoints[j]);
          }
          // Skip control points that reference the deleted object
        }
        this.objs[i].controlPoints = newControlPoints;
        
        // Filter out the objIndices that reference the deleted object
        // and adjust indices for objIndices that reference objects after the deleted one
        let newObjIndices = [];
        for (var j = 0; j < this.objs[i].objIndices.length; j++) {
          if (this.objs[i].objIndices[j] > index) {
            // Adjust index for objects after the deleted one
            newObjIndices.push(this.objs[i].objIndices[j] - 1);
          } else if (this.objs[i].objIndices[j] != index) {
            // Keep objIndices that don't reference the deleted object
            newObjIndices.push(this.objs[i].objIndices[j]);
          }
          // Skip objIndices that reference the deleted object
        }
        this.objs[i].objIndices = newObjIndices;
      }
    }

    this.objs.length = this.objs.length - 1;
  }

  /**
   * Clone the object at an index.
   * @param {number} index
   * @returns {BaseSceneObj} The cloned object
   */
  cloneObj(index) {
    let oldObj = this.objs[index].serialize();
    this.objs[this.objs.length] = new sceneObjs[oldObj.type](this, oldObj);
    return this.objs[this.objs.length - 1];
  }

  /**
   * Clone the objects bound to the handle at an index.
   * @param {number} index
   */
  cloneObjsByHandle(index) {
    let handle = this.objs[index];
    if (handle.constructor.type !== "Handle") {
      return;
    }

    var indices = [];
    for (var j in handle.controlPoints) {
      if (indices.indexOf(handle.controlPoints[j].targetObjIndex) == -1) {
        indices.push(handle.controlPoints[j].targetObjIndex);
      }
    }
    for (var j in handle.objIndices) {
      if (indices.indexOf(handle.objIndices[j]) == -1) {
        indices.push(handle.objIndices[j]);
      }
    }
    for (var j in indices) {
      if (this.objs[indices[j]].constructor.type != "Handle") {
        this.cloneObj(indices[j]);
      }
    }
  }

  /**
   * Add a module definition.
   * @param {string} moduleName
   * @param {ModuleDef} moduleDef
   * @returns {boolean} Whether the module is successfully added.
   */
  addModule(moduleName, moduleDef) {
    this.modules[moduleName] = moduleDef;

    // Update all module objects.
    for (let i in this.objs) {
      if (this.objs[i].constructor.type === "ModuleObj") {
        this.objs[i] = new sceneObjs.ModuleObj(this, this.objs[i].serialize());
      }
    }

    return true;
  }

  /**
   * Remove a given module and demodulize all corresponding module objects.
   * @param {string} moduleName 
   */
  removeModule(moduleName) {
    mainLoop: while (true) {
      for (let obj of this.objs) {
        if (obj.constructor.type === "ModuleObj" && obj.module === moduleName) {
          obj.demodulize();
          continue mainLoop;
        }
      }
      break;
    }

    delete this.modules[moduleName];
  }

  /**
   * Set the scale of the scene while keeping a given center point fixed.
   * @param {number} value - The new scale factor.
   * @param {number} centerX - The x-coordinate of the center point.
   * @param {number} centerY - The y-coordinate of the center point.
   */
  setScaleWithCenter(value, centerX, centerY) {
    const scaleChange = value - this.scale;
    this.origin.x *= value / this.scale;
    this.origin.y *= value / this.scale;
    this.origin.x -= centerX * scaleChange;
    this.origin.y -= centerY * scaleChange;
    this.scale = value;
  }

  /**
   * Perform an delayed validation on the scene and generate warnings if necessary. This method should not be called when the editing is in progress.
   */
  validateDelayed() {
    if (this.error) {
      return;
    }
    this.warning = null;
  
    // Check if there are identical optical objects
    const opticalObjs = this.opticalObjs;
  
    if (opticalObjs.length < 100) {
      const stringifiedObjs = opticalObjs.map(obj => JSON.stringify(obj));
      for (var i = 0; i < opticalObjs.length; i++) {
        for (var j = i + 1; j < opticalObjs.length; j++) {
          if (stringifiedObjs[i] == stringifiedObjs[j]) {
            this.warning = `opticalObjs[${i}]==[${j}] ${opticalObjs[i].constructor.type}: ` + i18next.t('simulator:generalWarnings.identicalObjects');
            break;
          }
        }
      }
    }
  }
};

export default Scene;