/**
 * The version of the JSON data format of the scene.
 * @const {number}
 */
const DATA_VERSION = 2;

/**
 * Represents the scene in this simulator.
 * @class Scene
 * @property {Object[]} objs - The objects (optical elements and/or decorations created by the user with "Tools") in the scene.
 * @property {string} mode - The mode of the scene. Possible values: 'light' (Rays), 'extended_light' (Extended Rays), 'images' (All Images), 'observer' (Seen by Observer).
 * @property {number} rayDensity_light - The density of rays in 'light' and 'extended_light' modes.
 * @property {number} rayDensity_images - The density of rays in 'images' and 'observer' modes.
 * @property {boolean} showGrid - The "Grid" option indicating if the grid is visible.
 * @property {boolean} grid - The "Snap to Grid" option indicating if mouse actions are snapped to the grid.
 * @property {boolean} lockobjs - The "Lock Objects" option indicating if the objects are locked.
 * @property {number} gridSize - The size of the grid.
 * @property {Object|null} observer - The observer of the scene, null if not set.
 * @property {Object} origin - The origin of the scene in the viewport.
 * @property {number} scale - The scale factor (the viewport CSS pixel per internal length unit) of the scene.
 * @property {number} width - The width (in CSS pixels) of the viewport.
 * @property {number} height - The height (in CSS pixels) of the viewport.
 * @property {boolean} colorMode - The "Simulate Color" option indicating if the color (wavelength) of the rays is simulated (also affecting whether the options of color filtering or Cauchy coefficients of some objects are shown.)
 * @property {boolean} symbolicGrin - The "Symbolic body-merging" option in the gradient-index glass objects (which is a global option), indicating if the symbolic math is used to calculate the effective refractive index resulting from the "body-merging" of several gradient-index glass objects.
 * @property {Object|null} backgroundImage - The background image of the scene, null if not set.
 */
class Scene {
  static serializableDefaults = {
    objs: [],
    mode: 'light',
    rayDensity_light: 0.1,
    rayDensity_images: 1,
    showGrid: false,
    grid: false,
    lockobjs: false,
    gridSize: 20,
    observer: null,
    origin: { x: 0, y: 0 },
    scale: 1,
    width: 1500,
    height: 900,
    colorMode: false,
    symbolicGrin: false
  };
  
  constructor() {
    this.backgroundImage = null;
    this.fromJSON(JSON.stringify({version: DATA_VERSION}), () => {});
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
    return this.mode == 'light' || this.mode == 'extended_light' ? this.rayDensity_light : this.rayDensity_images;
  }

  set rayDensity(val) {
    if (this.mode == 'light' || this.mode == 'extended_light') {
      this.rayDensity_light = val;
    } else {
      this.rayDensity_images = val;
    }
  }

  /**
   * The callback function when the entire scene or a resource (e.g. image) is loaded.
   * @callback fromJSONCallback
   * @param {boolean} needFullUpdate - Whether the scene needs a full update.
   * @param {boolean} completed - Whether the scene is completely loaded.
   */

  /**
  * Load the scene from JSON.
  * @param {string} json
  * @param {fromJSONCallback} callback - The callback function when the entire scene or a resource (e.g. image) is loaded.
  */
  fromJSON(json, callback) {
    let jsonData = JSON.parse(json);

    // Convert the scene from old versions if necessary.
    if (!jsonData.version) {
      // Earlier than "Ray Optics Simulation 1.0"
      let str1 = json.replace(/"point"|"xxa"|"aH"/g, '1').replace(/"circle"|"xxf"/g, '5').replace(/"k"/g, '"objs"').replace(/"L"/g, '"p1"').replace(/"G"/g, '"p2"').replace(/"F"/g, '"p3"').replace(/"bA"/g, '"exist"').replace(/"aa"/g, '"parallel"').replace(/"ba"/g, '"mirror"').replace(/"bv"/g, '"lens"').replace(/"av"/g, '"notDone"').replace(/"bP"/g, '"lightAlpha"').replace(/"ab"|"observed_light"|"observed_images"/g, '"observer"');
      jsonData = JSON.parse(str1);
      if (!jsonData.objs) {
        jsonData = { objs: jsonData };
      }
      if (!jsonData.mode) {
        jsonData.mode = 'light';
      }
      if (!jsonData.rayDensity_light) {
        jsonData.rayDensity_light = 1;
      }
      if (!jsonData.rayDensity_images) {
        jsonData.rayDensity_images = 1;
      }
      if (!jsonData.scale) {
        jsonData.scale = 1;
      }
      jsonData.version = 1;
    }
    if (jsonData.version == 1) {
      // "Ray Optics Simulation 1.1" to "Ray Optics Simulation 1.2"
      jsonData.origin = { x: 0, y: 0 };
    }
    if (jsonData.version > DATA_VERSION) {
      // Newer than the current version
      throw new Error('The version of the scene is newer than the current version of the simulator.');
    }

    const serializableDefaults = Scene.serializableDefaults;

    // Take the approximated size of the current viewport, which may be different from that of the scene to be loaded.
    const approximatedWidth = Math.ceil((this.width || serializableDefaults.width) / 100) * 100;
    const approximatedHeight = Math.ceil((this.height || serializableDefaults.height) / 100) * 100;

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

    // Load the objects in the scene.
    this.objs = jsonData.objs.map(objData =>
      new objTypes[objData.type](this, objData)
    );

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
  }

  /**
   * Convert the scene to JSON.
   * @method toJSON
   * @returns {string} The JSON string representing the scene.
   */
  toJSON() {
    let jsonData = {version: DATA_VERSION};
    
    // Serialize the objects in the scene.
    jsonData.objs = this.objs.map(obj => obj.serialize());

    // Use approximated size of the current viewport.
    const approximatedWidth = Math.ceil(this.width / 100) * 100;
    const approximatedHeight = Math.ceil(this.height / 100) * 100;
    jsonData.width = approximatedWidth;
    jsonData.height = approximatedHeight;

    // Only export non-default properties.
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
};