/**
 * The version of the JSON data format of the scene.
 * @const {number}
 */
const DATA_VERSION = 2;

/**
 * Represents the scene in this simulator.
 */
class Scene {
  constructor() {
    /** @property {Object[]} objs - The objects (optical elements and/or decorations created by the user with "Tools") in the scene. */
    this.objs = [];

    /** @property {string} mode - The mode of the scene. Possible values: 'light' (Rays), 'extended_light' (Extended Rays), 'images' (All Images), 'observer' (Seen by Observer). */
    this.mode = 'light';

    /** @property {number} rayDensity_light - The density of rays in 'light' and 'extended_light' modes. */
    this.rayDensity_light = 0.1;

    /** @property {number} rayDensity_images - The density of rays in 'images' and 'observer' modes. */
    this.rayDensity_images = 1;

    /** @property {boolean} showGrid - The "Grid" option indicating if the grid is visible. */
    this.showGrid = false;

    /** @property {boolean} grid - The "Snap to Grid" option indicating if mouse actions are snapped to the grid. */
    this.grid = false;

    /** @property {boolean} lockobjs - The "Lock Objects" option indicating if the objects are locked. */
    this.lockobjs = false;

    /** @property {number} gridSize - The size of the grid. */
    this.gridSize = 20;

    /** @property {Object|null} observer - The observer of the scene, null if not set. */
    this.observer = null;

    /** @property {Object} origin - The origin of the scene in the viewport. */
    this.origin = { x: 0, y: 0 };

    /** @property {number} scale - The scale factor (the viewport CSS pixel per internal length unit) of the scene. */
    this.scale = 1;

    /** @property {number} width - The width (in CSS pixels) of the viewport. */
    this.width = 1500;

    /** @property {number} height - The height (in CSS pixels) of the viewport. */
    this.height = 900;

    /** @property {boolean} colorMode - The "Simulate Color" option indicating if the color (wavelength) of the rays is simulated (also affecting whether the options of color filtering or Cauchy coefficients of some objects are shown.) */
    this.colorMode = false;

    /** @property {boolean} symbolicGrin - The "Symbolic body-merging" option in the gradient-index glass objects (which is a global option), indicating if the symbolic math is used to calculate the effective refractive index resulting from the "body-merging" of several gradient-index glass objects. */
    this.symbolicGrin = false;

    /** @property {Object|null} backgroundImage - The background image of the scene, null if not set. */
    this.backgroundImage = null;
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
    if (!jsonData.scale) {
      jsonData.scale = 1;
    }
    if (!jsonData.colorMode) {
      jsonData.colorMode = false;
    }
    if (!jsonData.symbolicGrin) {
      jsonData.symbolicGrin = false;
    }
    if (!jsonData.width) {
      jsonData.width = 1500;
    }
    if (!jsonData.height) {
      jsonData.height = 900;
    }
    if (!jsonData.showGrid) {
      jsonData.showGrid = false;
    }
    if (!jsonData.grid) {
      jsonData.grid = false;
    }
    if (!jsonData.lockobjs) {
      jsonData.lockobjs = false;
    }
    if (!jsonData.gridSize) {
      jsonData.gridSize = 20;
    }

    // Set the scene
    this.objs = jsonData.objs;
    this.mode = jsonData.mode;
    this.rayDensity_light = jsonData.rayDensity_light;
    this.rayDensity_images = jsonData.rayDensity_images;
    this.showGrid = jsonData.showGrid;
    this.grid = jsonData.grid;
    this.lockobjs = jsonData.lockobjs;
    this.gridSize = jsonData.gridSize;
    this.observer = jsonData.observer;

    // Take the approximated size of the current viewport, which may be different from that of the scene to be loaded.
    const approximatedWidth = Math.ceil(this.width / 100) * 100;
    const approximatedHeight = Math.ceil(this.height / 100) * 100;
    
    // Rescale the scene to fit the current viewport.
    let rescaleFactor = 1;

    if (jsonData.width/jsonData.height > approximatedWidth/approximatedHeight) {
      rescaleFactor = jsonData.width / approximatedWidth;
    } else {
      rescaleFactor = jsonData.height / approximatedHeight;
    }
    
    this.scale = jsonData.scale / rescaleFactor;
    this.origin.x = jsonData.origin.x / rescaleFactor;
    this.origin.y = jsonData.origin.y / rescaleFactor;

    this.colorMode = jsonData.colorMode;
    this.symbolicGrin = jsonData.symbolicGrin;

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
    const approximatedWidth = Math.ceil(this.width / 100) * 100;
    const approximatedHeight = Math.ceil(this.height / 100) * 100;

    return JSON.stringify({
      version: DATA_VERSION,
      objs: this.objs,
      mode: this.mode,
      rayDensity_light: this.rayDensity_light,
      rayDensity_images: this.rayDensity_images,
      showGrid: this.showGrid,
      grid: this.grid,
      lockobjs: this.lockobjs,
      gridSize: this.gridSize,
      observer: this.observer,
      origin: this.origin,
      scale: this.scale,
      width: approximatedWidth,
      height: approximatedHeight,
      colorMode: this.colorMode,
      symbolicGrin: this.symbolicGrin
    }, function (name, val) {
      if (name.startsWith("tmp_"))
        return undefined;
      return val;
    }, 2);
  }
};