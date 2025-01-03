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
 * @file {@link Simulator} is the class for simulating the optical system described by the {@link Scene} class and rendering the scene (optical elements, decorations, rays, etc) on the canvas layers. It can also be used in a standalone environment (e.g. Node.js).
 */

import CanvasRenderer from './CanvasRenderer.js';
import FloatColorRenderer from './FloatColorRenderer.js';
import geometry from './geometry.js';
import * as C2S from 'canvas2svg';
import * as sceneObjs from './sceneObjs.js';
import i18next from 'i18next';

/**
 * @typedef {Object} Ray
 * @property {Point} p1 - The starting point of the ray.
 * @property {Point} p2 - Another point on the ray.
 * @property {number} brightness_s - he intensity of the s-polarization component of the ray.
 * @property {number} brightness_p - The intensity of the p-polarization component of the ray. In this simulator the two polarization components are assumed to be of no phase coherence.
 * @property {number} [wavelength] - The wavelength of the ray in nanometers. Only has effect when "Simulate Colors" is on.
 * @property {boolean} gap - Whether the ray is the first ray in a bunch of "continuous" rays. This is for the detection of images to work correctly. The intersection of two rays is considered as a candidate of an image only if the second ray has `gap === false`.
 * @property {boolean} isNew - Whether the ray is just emitted by a source. This is to avoid drawing trivial initial extensions in the "Extended rays" mode.
 */

/**
 * The simulator class, which simulates the optical system described by the {@link Scene} class and renders the scene (optical elements, decorations, rays, etc) on the canvas layers.
 * 
 * When a ray interacts with an object (optical element) in the scene, the object itself is responsible for handling the interaction, and the simulator only call the related methods of the object. See `onSimulationStart`, `checkRayIntersects` and `onRayIncident` in the {@link BaseSceneObj} class for more information. The rendering of the object is also a method `draw` of the object itself called by the simulator.
 * 
 * In the Ray Optics Simulator web app, a single instance of this class is used in the entire session to simulate the scene interactively. `updateSimulation` is called whenever the scene is updated. If the simulation is too long, the simulator will automatically pause and resume to prevent the browser from not responding, and emit the `simulationPause` event to notify the UI to update the simulation status. When exporting the scene to PNG or SVG, a new instance of this class is created and `updateSimulation` is called once to render the scene without pausing.
 * 
 * This class can also be used by other projects, including those running in a standalone environment (e.g. Node.js) to simulate and render the scene without the UI. Note however that even if one is only interested in the numerical results (e.g. detector readings), the canvas layers are still required for the simulator to work properly. In the future, a headless mode may be implemented to allow the simulator to run without the canvas layers.
 * @class
 */
class Simulator {
  
  /**
   * The minimal length between two interactions with rays (when smaller than this, the interaction will be ignored). Also the threshold for surface merging.
   */
  static MIN_RAY_SEGMENT_LENGTH = 1e-6;
  static MIN_RAY_SEGMENT_LENGTH_SQUARED = Simulator.MIN_RAY_SEGMENT_LENGTH * Simulator.MIN_RAY_SEGMENT_LENGTH;

  static UV_WAVELENGTH = 380;
  static VIOLET_WAVELENGTH = 420;
  static BLUE_WAVELENGTH = 460;
  static CYAN_WAVELENGTH = 500;
  static GREEN_WAVELENGTH = 540;
  static YELLOW_WAVELENGTH = 580;
  static RED_WAVELENGTH = 620;
  static INFRARED_WAVELENGTH = 700;

  /**
   * Creates a new Simulator instance.
   * @param {Scene} scene - The scene to be simulated.
   * @param {CanvasRenderingContext2D|C2S} ctxMain - The default context for drawing the scene.
   * @param {CanvasRenderingContext2D|C2S} ctxBelowLight - The context for drawing the scene below the light layer.
   * @param {CanvasRenderingContext2D|C2S} ctxAboveLight - The context for drawing the scene above the light layer.
   * @param {CanvasRenderingContext2D|C2S} ctxGrid - The context for drawing the grid layer.
   * @param {CanvasRenderingContext2D} ctxVirtual - The virtual context for color adjustment.
   * @param {boolean} enableTimer - Whether to enable the timer for the simulation.
   * @param {number} [rayCountLimit=Infinity] - The maximum number of processed rays in the simulation.
   * @param {boolean} [useFloatColorRenderer=false] - Whether to use the FloatColorRenderer for the light layer.
   */
  constructor(scene, ctxMain, ctxBelowLight, ctxAboveLight, ctxGrid, ctxVirtual, enableTimer, rayCountLimit = Infinity, useFloatColorRenderer = false) {
    /** @property {Scene} scene - The scene to be simulated. */
    this.scene = scene;

    this.scene.simulator = this; // This circular reference is currently only used by Detector to access `totalTruncation` and CropBox to access `processedRayCount`.

    /** @property {CanvasRenderingContext2D|C2S} ctxMain - The default context for drawing the this.scene. If other layers are present, this is the context for drawing the light layer only. */
    this.ctxMain = ctxMain;

    /** @property {CanvasRenderingContext2D|C2S} ctxBelowLight - The context for drawing the this.scene below the light layer. */
    this.ctxBelowLight = ctxBelowLight;

    /** @property {CanvasRenderingContext2D|C2S} ctxAboveLight - The context for drawing the this.scene above the light layer. */
    this.ctxAboveLight = ctxAboveLight;

    /** @property {CanvasRenderingContext2D|C2S} ctxGrid - The context for drawing the grid layer. */
    this.ctxGrid = ctxGrid;

    /** @property {CanvasRenderingContext2D} ctxVirtual - The virtual context for color adjustment. */
    this.ctxVirtual = ctxVirtual;

    if (typeof C2S !== 'undefined' && ctxMain.constructor === C2S) {
      /** @property {boolean} isSVG - Whether the canvas is being exported to SVG. */
      this.isSVG = true;
    }

    /** @property {number} dpr - The device pixel ratio of the canvases. */
    this.dpr = 1;

    /** @property {boolean} enableTimer - Whether to enable the timer for the simulation so that it automatically pauses and resumes when the simulation is too long. */
    this.enableTimer = enableTimer;

    /** @property {number} rayCountLimit - The maximum number of processed rays in the simulation. When this limit is reached, the simulation will stop. */
    this.rayCountLimit = rayCountLimit;

    /** @property {boolean} useFloatColorRenderer - Whether to use the FloatColorRenderer for the light layer. */
    this.useFloatColorRenderer = useFloatColorRenderer;

    /** @property {Ray[]} pendingRays - The rays to be processed. */
    this.pendingRays = [];

    /** @property {number} simulationTimerId - The ID of the timer for the simulation. */
    this.simulationTimerId = -1;

    /** @property {boolean} shouldSimulatorStop - Whether the simulation should stop immediately in the next step of the timer. */
    this.shouldSimulatorStop = false;

    /** @property {Date} simulationStartTime - The time when the simulation starts. */
    this.simulationStartTime = null;

    /** @property {number} totalTruncation - The total truncated brightness of rays in the infinite series of internal reflection during the simulation. */
    this.totalTruncation = 0;

    /** @property {number} brightnessScale - The brightness scale of the simulation. 0 if undetermined, -1 if inconsistent. */
    this.brightnessScale = 0;

    /** @property {number} processedRayCount - The number of rays processed in the simulation. */
    this.processedRayCount = 0;

    /** @property {string} error - The error message of the simulation. */
    this.error = null;

    /** @property {string} warning - The warning message of the simulation. */
    this.warning = null;

    /** @property {object} eventListeners - The event listeners of the simulator. */
    this.eventListeners = {};

    this.canvasRendererMain = null;
    this.canvasRendererBelowLight = null;
    this.canvasRendererAboveLight = null;
    this.canvasRendererGrid = null;
  }

  /**
   * Add an event listener to the simulator.
   * @param {string} eventName - The name of the event.
   * @param {function} callback - The callback function.
   */
  on(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  }

  /**
   * Emit an event.
   * @param {string} eventName - The name of the event.
   * @param {any} data - The data to be passed to the callback functions.
   */
  emit(eventName, data) {
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName].forEach(callback => callback(data));
    }
  }

  /**
   * The event emitted when the simulation starts.
   * @event Simulator#simulationStart
   */

  /**
   * The event emitted when the simulation pauses (when the timer is enabled and the maximum continue running time is exceeded).
   * @event Simulator#simulationPause
   */

  /**
   * The event emitted when the simulation completes (all the rays are processed completely).
   * @event Simulator#simulationComplete
   */

  /**
   * The event emitted when the simulation stops (when the maximum number of processed rays is reached or if the user force stop the simulation).
   * @event Simulator#simulationStop
   */

  /**
   * The event when the error and warning messages in the UI should be updated.
   * @event requestUpdateErrorAndWarning
   */

  /**
   * Run the simulation and draw the this.scene on the canvases.
   * @param {boolean} skipLight - Whether to skip the light layer.
   * @param {boolean} skipGrid - Whether to skip the grid layer.
   * @returns {void}
   */
  updateSimulation(skipLight, skipGrid) {
    if (!skipLight) {
      this.totalTruncation = 0;
      this.brightnessScale = 0;
      //clearError();
      //clearWarning();
      this.simulationStartTime = new Date();
      this.emit('simulationStart', null);
    }

    if (!skipLight && this.simulationTimerId != -1) {
      // If still handling the last draw, then stop
      clearTimeout(this.simulationTimerId);
      this.simulationTimerId = -1;
    }

    /*
    if (!skipLight && this.useFloatColorRenderer && this.canvasRendererMain && this.canvasRendererMain.destroy) {
      // Destroy the canvas renderer to prevent memory leak
      this.canvasRendererMain.destroy();
      this.canvasRendererMain = null;
    }
    */

    if (this.ctxBelowLight && this.ctxAboveLight) {
      this.canvasRendererBelowLight = new CanvasRenderer(this.ctxBelowLight, { x: this.scene.origin.x * this.dpr, y: this.scene.origin.y * this.dpr }, (this.scene.scale * this.dpr), this.scene.lengthScale, this.scene.backgroundImage);
      this.canvasRendererAboveLight = new CanvasRenderer(this.ctxAboveLight, { x: this.scene.origin.x * this.dpr, y: this.scene.origin.y * this.dpr }, (this.scene.scale * this.dpr), this.scene.lengthScale);
    }

    if (!skipLight) {
      if (this.useFloatColorRenderer) {
        if (this.scene.colorMode == 'legacy' && this.scene.simulateColors) {
          var colorMode = 'legacy_color';
        } else {
          var colorMode = this.scene.colorMode;
        }

        // Renew the float color renderer only if some parameters have changed
        if (this.canvasRendererMain && this.canvasRendererMain.colorMode == colorMode && this.canvasRendererMain.scale == this.scene.scale * this.dpr && this.canvasRendererMain.lengthScale == this.scene.lengthScale && this.canvasRendererMain.origin.x == this.scene.origin.x * this.dpr && this.canvasRendererMain.origin.y == this.scene.origin.y * this.dpr && this.canvasRendererMain.width == this.ctxMain.canvas.width && this.canvasRendererMain.height == this.ctxMain.canvas.height) {
          this.canvasRendererMain.begin();
        } else {
          if (this.canvasRendererMain) {
            this.canvasRendererMain.destroy();
          }
          this.canvasRendererMain = new FloatColorRenderer(this.ctxMain, { x: this.scene.origin.x * this.dpr, y: this.scene.origin.y * this.dpr }, (this.scene.scale * this.dpr), this.scene.lengthScale, null, null, colorMode);
        }
      } else {
        this.canvasRendererMain = new CanvasRenderer(this.ctxMain, { x: this.scene.origin.x * this.dpr, y: this.scene.origin.y * this.dpr }, (this.scene.scale * this.dpr), this.scene.lengthScale, null, this.ctxVirtual);
      }

      if (this.isSVG) {
        this.ctxMain.translate(this.scene.origin.x / (this.scene.scale * this.dpr), this.scene.origin.y / (this.scene.scale * this.dpr));
        this.ctxMain.globalAlpha = 1;
      } else {
        this.ctxAboveLight.globalAlpha = 1;
      }
      this.pendingRays = [];
      this.processedRayCount = 0;
    }

    if (!skipGrid && this.ctxGrid) {

      this.canvasRendererGrid = new CanvasRenderer(this.ctxGrid, { x: this.scene.origin.x * this.dpr, y: this.scene.origin.y * this.dpr }, (this.scene.scale * this.dpr), this.scene.lengthScale);

      if (this.scene.showGrid) {
        // Draw the grid

        this.ctxGrid.save();
        this.ctxGrid.setTransform((this.scene.scale * this.dpr), 0, 0, (this.scene.scale * this.dpr), 0, 0);
        var dashstep = 4 * this.scene.lengthScale;

        this.ctxGrid.strokeStyle = 'rgb(255,255,255,0.25)';
        this.ctxGrid.lineWidth = 1 * this.scene.lengthScale;

        var dashPattern;
        if (dashstep * this.scene.scale <= 2) {
          // The dash pattern is too dense, so we just draw a solid line
          dashPattern = [];
        } else {
          // Set up the dash pattern: [dash length, space length]
          var dashPattern = [dashstep * 0.5, dashstep * 0.5];
        }

        // Apply the dash pattern to the context
        this.ctxGrid.setLineDash(dashPattern);

        // Draw vertical dashed lines
        this.ctxGrid.beginPath();
        for (var x = this.scene.origin.x / this.scene.scale % this.scene.gridSize; x <= this.ctxGrid.canvas.width / (this.scene.scale * this.dpr); x += this.scene.gridSize) {
          this.ctxGrid.moveTo(x, this.scene.origin.y / this.scene.scale % this.scene.gridSize - this.scene.gridSize);
          this.ctxGrid.lineTo(x, this.ctxGrid.canvas.height / (this.scene.scale * this.dpr));
        }
        this.ctxGrid.stroke();

        // Draw horizontal dashed lines
        this.ctxGrid.beginPath();
        for (var y = this.scene.origin.y / this.scene.scale % this.scene.gridSize; y <= this.ctxGrid.canvas.height / (this.scene.scale * this.dpr); y += this.scene.gridSize) {
          this.ctxGrid.moveTo(this.scene.origin.x / this.scene.scale % this.scene.gridSize - this.scene.gridSize, y);
          this.ctxGrid.lineTo(this.ctxGrid.canvas.width / (this.scene.scale * this.dpr), y);
        }
        this.ctxGrid.stroke();
        this.ctxGrid.setLineDash([]);
        this.ctxGrid.restore();
      }
    }


    if (!(!this.ctxBelowLight && skipLight)) {
      // Sort the objects with z-index.
      var mapped = this.scene.objs.map(function (obj, i) {
        return { index: i, value: obj.getZIndex() };
      });
      mapped.sort(function (a, b) {
        return a.value - b.value;
      });
      // Draw the objects
      for (var j = 0; j < this.scene.objs.length; j++) {
        var i = mapped[j].index;
        
        if (this.scene.editor) {
          var isHovered = this.scene.editor.hoveredObjIndex === i;
        } else {
          var isHovered = false;
        }
        this.scene.objs[i].draw((!this.ctxBelowLight) ? this.canvasRendererMain : this.canvasRendererBelowLight, false, isHovered);

      }

      if (!skipLight) {
        // Initialize the simulation (e.g. add the rays and reset the detector readings)
        for (let obj of this.scene.opticalObjs) {
          const ret = obj.onSimulationStart();
          if (ret) {
            if (ret.newRays) {
              for (let newRay of ret.newRays) {
                this.pendingRays.push(newRay);
              }
            }
            if (ret.truncation) {
              this.totalTruncation += ret.truncation;
            }
            if (ret.brightnessScale) {
              if (this.brightnessScale == 0) {
                this.brightnessScale = ret.brightnessScale;
              } else if (this.brightnessScale != ret.brightnessScale) {
                this.brightnessScale = -1;
              }
            }
          }
        }
      }

    }

    if (!skipLight) {
      this.leftRayCount = 0;
      this.last_s_obj_index = -1;
      this.last_ray = null;
      this.last_intersection = null;
      this.pendingRaysIndex = -1;
      this.firstBreak = true;
      this.processRays();
    }

    if (skipLight) {
      // Draw the "above light" layer of this.scene.objs. Note that we only draw this when skipLight is true because otherwise processRays() will be called and the "above light" layer will still be drawn, since draw() is called again in processRays() with skipLight set to true.

      for (var i = 0; i < this.scene.objs.length; i++) {
        if (this.scene.editor) {
          var isHovered = this.scene.editor.hoveredObjIndex === i;
        } else {
          var isHovered = false;
        }
        this.scene.objs[i].draw((!this.ctxAboveLight) ? this.canvasRendererMain : this.canvasRendererAboveLight, true, isHovered); // Draw this.scene.objs[i]
      }
      if (this.scene.mode == 'observer') {
        // Draw the observer
        this.ctxAboveLight.globalAlpha = 1;
        this.ctxAboveLight.beginPath();
        this.ctxAboveLight.fillStyle = 'blue';
        this.ctxAboveLight.arc(this.scene.observer.c.x, this.scene.observer.c.y, this.scene.observer.r, 0, Math.PI * 2, false);
        this.ctxAboveLight.fill();
      }
    }

    this.emit('requestUpdateErrorAndWarning');

  }

  /**
   * Process the rays in `this.pendingRays` during the simulation.
   * @returns {void}
   * @private
   */
  processRays() {
    this.simulationTimerId = -1;
    var st_time = new Date();
    var alpha0 = 1;
    this.ctxMain.globalAlpha = alpha0;
    var observed;
    var s_obj;
    var s_obj_index;
    var s_point;
    var s_point_temp;
    var s_lensq;
    var s_lensq_temp;
    var observed_point;
    var observed_intersection;
    var rpd;
    var surfaceMergingObjs = [];

    const opticalObjs = this.scene.opticalObjs;

    if (this.scene.simulateColors) {
      this.ctxMain.globalCompositeOperation = 'screen';
    }

    while (true) {
      if (new Date() - st_time > 50 && this.enableTimer) {
        // If already run for 50ms
        // Pause for 10ms and continue (prevent not responding)
        this.simulationTimerId = setTimeout(() => this.processRays(), this.firstBreak ? 100 : 1);
        this.firstBreak = false;

        if (this.useFloatColorRenderer) {
          this.canvasRendererMain.flush();
        }

        this.emit('simulationPause', null);

        this.updateSimulation(true, true); // Redraw the opticalObjs to avoid outdated information (e.g. detector readings).

        this.validate();
        return;
      }
      if (this.processedRayCount > this.rayCountLimit) {
        this.shouldSimulatorStop = true;
        break;
      }
      if (this.shouldSimulatorStop) break;
      if (this.pendingRaysIndex >= this.pendingRays.length) {
        if (this.leftRayCount == 0) {
          break;
        }
        this.leftRayCount = 0;
        this.last_s_obj_index = -1;
        this.last_ray = null;
        this.last_intersection = null;
        this.pendingRaysIndex = -1;
        continue;
      }
      this.pendingRaysIndex++;





      var j = this.pendingRaysIndex;
      if (this.pendingRays[j]) {
        // Start handling this.pendingRays[j]
        // Test which object will this ray shoot on first

        // Search every object intersected with the ray, and find which intersection is the nearest
        s_obj = null; // The current nearest object in search
        s_obj_index = -1;
        s_point = null;  // The intersection
        surfaceMergingObjs = []; // The objects whose surface is to be merged with s_obj
        s_lensq = Infinity;
        observed = false; // Whether this.pendingRays[j] is observed by the observer
        for (var i = 0; i < opticalObjs.length; i++) {
          // Test whether opticalObjs[i] intersects with the ray
          s_point_temp = opticalObjs[i].checkRayIntersects(this.pendingRays[j]);
          if (s_point_temp) {
            // Here opticalObjs[i] intersects with the ray at s_point_temp
            s_lensq_temp = geometry.distanceSquared(this.pendingRays[j].p1, s_point_temp);
            if (s_point && geometry.distanceSquared(s_point_temp, s_point) < Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale && (opticalObjs[i].constructor.supportsSurfaceMerging || s_obj.constructor.supportsSurfaceMerging)) {
              // The ray is shot on two objects at the same time, and at least one of them supports surface merging

              if (s_obj.constructor.supportsSurfaceMerging) {
                if (opticalObjs[i].constructor.supportsSurfaceMerging) {
                  // Both of them supports surface merging (e.g. two glasses with one common edge
                  surfaceMergingObjs[surfaceMergingObjs.length] = opticalObjs[i];
                }
                else {
                  // Only the first shot object supports surface merging
                  // Set the object to be shot to be the one not supporting surface merging (e.g. if one surface of a glass coincides with a blocker, then only block the ray)
                  s_obj = opticalObjs[i];
                  s_obj_index = i;
                  s_point = s_point_temp;
                  s_lensq = s_lensq_temp;

                  surfaceMergingObjs = [];
                }
              }
            }
            else if (s_lensq_temp < s_lensq && s_lensq_temp > Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale) {
              s_obj = opticalObjs[i]; // Update the object to be shot
              s_obj_index = i;
              s_point = s_point_temp;
              s_lensq = s_lensq_temp;

              surfaceMergingObjs = [];
            }
          }
        }
        if (this.scene.simulateColors) {
          var color = Simulator.wavelengthToColor(this.pendingRays[j].wavelength, (this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p), !this.isSVG && !this.useFloatColorRenderer);
        } else {
          var alpha = alpha0 * (this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p);
        }
        // If not shot on any object
        if (s_lensq == Infinity) {
          if (this.scene.mode == 'rays' || this.scene.mode == 'extended') {
            if (this.scene.simulateColors) {
              this.canvasRendererMain.drawRay(this.pendingRays[j], color, this.scene.showRayArrows); // Draw the ray
            } else {
              this.canvasRendererMain.drawRay(this.pendingRays[j], [1, 1, 0.5, alpha], this.scene.showRayArrows); // Draw the ray
            }
          }
          if (this.scene.mode == 'extended' && !this.pendingRays[j].isNew) {
            if (this.scene.simulateColors) {
              this.canvasRendererMain.drawRay(geometry.line(this.pendingRays[j].p1, geometry.point(this.pendingRays[j].p1.x * 2 - this.pendingRays[j].p2.x, this.pendingRays[j].p1.y * 2 - this.pendingRays[j].p2.y)), color, undefined, [2 * this.scene.lengthScale, 2 * this.scene.lengthScale]); // Draw the extension of the ray
            } else {
              this.canvasRendererMain.drawRay(geometry.line(this.pendingRays[j].p1, geometry.point(this.pendingRays[j].p1.x * 2 - this.pendingRays[j].p2.x, this.pendingRays[j].p1.y * 2 - this.pendingRays[j].p2.y)), [1, 0.5, 0, alpha], undefined, []); // Draw the extension of the ray
            }
          }

          if (this.scene.mode == 'observer') {
            observed_point = geometry.lineCircleIntersections(this.pendingRays[j], this.scene.observer)[2];
            if (observed_point) {
              if (geometry.intersectionIsOnRay(observed_point, this.pendingRays[j])) {
                observed = true;
              }
            }
          }
        }
        else {
          // Here the ray will be shot on s_obj at s_point after traveling for s_len
          if (this.scene.mode == 'rays' || this.scene.mode == 'extended') {
            if (this.scene.simulateColors) {
              this.canvasRendererMain.drawSegment(geometry.line(this.pendingRays[j].p1, s_point), color, this.scene.showRayArrows); // Draw the ray
            } else {
              this.canvasRendererMain.drawSegment(geometry.line(this.pendingRays[j].p1, s_point), [1, 1, 0.5, alpha], this.scene.showRayArrows); // Draw the ray
            }
          }
          if (this.scene.mode == 'extended' && !this.pendingRays[j].isNew) {
            if (this.scene.simulateColors) {
              this.canvasRendererMain.drawRay(geometry.line(this.pendingRays[j].p1, geometry.point(this.pendingRays[j].p1.x * 2 - this.pendingRays[j].p2.x, this.pendingRays[j].p1.y * 2 - this.pendingRays[j].p2.y)), color, undefined, [2 * this.scene.lengthScale, 2 * this.scene.lengthScale]); // Draw the backward extension of the ray
              this.canvasRendererMain.drawRay(geometry.line(s_point, geometry.point(s_point.x * 2 - this.pendingRays[j].p1.x, s_point.y * 2 - this.pendingRays[j].p1.y)), color, undefined, [1 * this.scene.lengthScale, 5 * this.scene.lengthScale]); // Draw the forward extension of the ray
            } else {
              this.canvasRendererMain.drawRay(geometry.line(this.pendingRays[j].p1, geometry.point(this.pendingRays[j].p1.x * 2 - this.pendingRays[j].p2.x, this.pendingRays[j].p1.y * 2 - this.pendingRays[j].p2.y)), [1, 0.5, 0, alpha], undefined, []); // Draw the backward extension of the ray
              this.canvasRendererMain.drawRay(geometry.line(s_point, geometry.point(s_point.x * 2 - this.pendingRays[j].p1.x, s_point.y * 2 - this.pendingRays[j].p1.y)), [0.3, 0.3, 0.3, alpha], undefined, []); // Draw the forward extension of the ray
            }

          }

          if (this.scene.mode == 'observer') {
            observed_point = geometry.lineCircleIntersections(this.pendingRays[j], this.scene.observer)[2];

            if (observed_point) {

              if (geometry.intersectionIsOnSegment(observed_point, geometry.line(this.pendingRays[j].p1, s_point))) {
                observed = true;
              }
            }
          }
        }
        if (this.scene.mode == 'observer' && this.last_ray) {
          if (!this.pendingRays[j].gap) {
            observed_intersection = geometry.linesIntersection(this.pendingRays[j], this.last_ray); // The intersection of the observed rays

            if (observed) {
              if (this.last_intersection && geometry.distanceSquared(this.last_intersection, observed_intersection) < 25 * this.scene.lengthScale * this.scene.lengthScale) {
                // If the intersections are near each others
                if (geometry.intersectionIsOnRay(observed_intersection, geometry.line(observed_point, this.pendingRays[j].p1)) && geometry.distanceSquared(observed_point, this.pendingRays[j].p1) > 1e-5 * this.scene.lengthScale * this.scene.lengthScale) {


                  if (this.scene.simulateColors) {
                    var color = Simulator.wavelengthToColor(this.pendingRays[j].wavelength, (this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p) * 0.5, !this.isSVG && !this.useFloatColorRenderer);
                  } else {
                    const alpha = alpha0 * ((this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p) + (this.last_ray.brightness_s + this.last_ray.brightness_p)) * 0.5;
                    this.ctxMain.globalAlpha = alpha;
                  }
                  if (s_point) {
                    rpd = (observed_intersection.x - this.pendingRays[j].p1.x) * (s_point.x - this.pendingRays[j].p1.x) + (observed_intersection.y - this.pendingRays[j].p1.y) * (s_point.y - this.pendingRays[j].p1.y);
                  }
                  else {
                    rpd = (observed_intersection.x - this.pendingRays[j].p1.x) * (this.pendingRays[j].p2.x - this.pendingRays[j].p1.x) + (observed_intersection.y - this.pendingRays[j].p1.y) * (this.pendingRays[j].p2.y - this.pendingRays[j].p1.y);
                  }
                  if (rpd < 0) {
                    // Virtual image
                    if (this.scene.simulateColors) {
                      this.canvasRendererMain.drawPoint(observed_intersection, color, 3);
                    } else {
                      this.canvasRendererMain.drawPoint(observed_intersection, [1, 0.5, 0, alpha]); // Draw the image
                    }
                  }
                  else if (rpd < s_lensq) {
                    // Real image
                    if (this.scene.simulateColors) {
                      this.canvasRendererMain.drawPoint(observed_intersection, color); // Draw the image
                    } else {
                      this.canvasRendererMain.drawPoint(observed_intersection, [1, 1, 0.5, alpha]); // Draw the image
                    }
                  }
                  if (this.scene.simulateColors) {
                    this.canvasRendererMain.drawSegment(geometry.line(observed_point, observed_intersection), color, undefined, [1 * this.scene.lengthScale, 2 * this.scene.lengthScale]); // Draw the observed ray
                  } else {
                    this.canvasRendererMain.drawSegment(geometry.line(observed_point, observed_intersection), [0, 0, 1, alpha], undefined, []); // Draw the observed ray
                  }
                }
                else {
                  if (this.scene.simulateColors) {
                    this.canvasRendererMain.drawRay(geometry.line(observed_point, this.pendingRays[j].p1), color, undefined, [1 * this.scene.lengthScale, 2 * this.scene.lengthScale]); // Draw the observed ray
                  } else {
                    this.canvasRendererMain.drawRay(geometry.line(observed_point, this.pendingRays[j].p1), [0, 0, 1, alpha], undefined, []); // Draw the observed ray
                  }
                }
              }
              else {
                if (this.last_intersection) {
                  if (this.scene.simulateColors) {
                    this.canvasRendererMain.drawRay(geometry.line(observed_point, this.pendingRays[j].p1), color, undefined, [1 * this.scene.lengthScale, 2 * this.scene.lengthScale]); // Draw the observed ray
                  } else {
                    this.canvasRendererMain.drawRay(geometry.line(observed_point, this.pendingRays[j].p1), [0, 0, 1, alpha], undefined, []); // Draw the observed ray
                  }
                }
              }
            }
            this.last_intersection = observed_intersection;
          }
          else {
            this.last_intersection = null;
          }
        }

        if (this.scene.mode == 'images' && this.last_ray) {
          if (!this.pendingRays[j].gap) {

            observed_intersection = geometry.linesIntersection(this.pendingRays[j], this.last_ray);
            if (this.last_intersection && geometry.distanceSquared(this.last_intersection, observed_intersection) < 25 * this.scene.lengthScale * this.scene.lengthScale) {
              if (this.scene.simulateColors) {
                var color = Simulator.wavelengthToColor(this.pendingRays[j].wavelength, (this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p) * 0.5, !this.isSVG && !this.useFloatColorRenderer);
              } else {
                const alpha = alpha0 * ((this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p) + (this.last_ray.brightness_s + this.last_ray.brightness_p)) * 0.5;
                this.ctxMain.globalAlpha = alpha;
              }

              if (s_point) {
                rpd = (observed_intersection.x - this.pendingRays[j].p1.x) * (s_point.x - this.pendingRays[j].p1.x) + (observed_intersection.y - this.pendingRays[j].p1.y) * (s_point.y - this.pendingRays[j].p1.y);
              }
              else {
                rpd = (observed_intersection.x - this.pendingRays[j].p1.x) * (this.pendingRays[j].p2.x - this.pendingRays[j].p1.x) + (observed_intersection.y - this.pendingRays[j].p1.y) * (this.pendingRays[j].p2.y - this.pendingRays[j].p1.y);
              }

              if (rpd < 0) {
                // Virtual image
                if (this.scene.simulateColors) {
                  this.canvasRendererMain.drawPoint(observed_intersection, color, 3);
                } else {
                  this.canvasRendererMain.drawPoint(observed_intersection, [1, 0.5, 0, alpha]); // Draw the image
                }
              }
              else if (rpd < s_lensq) {
                // Real image
                if (this.scene.simulateColors) {
                  this.canvasRendererMain.drawPoint(observed_intersection, color); // Draw the image
                } else {
                  this.canvasRendererMain.drawPoint(observed_intersection, [1, 1, 0.5, alpha]); // Draw the image
                }
              }
              else {
                // Virtual object
                if (this.scene.simulateColors) {
                  this.canvasRendererMain.drawPoint(observed_intersection, color, 1);
                } else {
                  this.canvasRendererMain.drawPoint(observed_intersection, this.useFloatColorRenderer ? [0.03, 0.03, 0.03, alpha] : [0.3, 0.3, 0.3, alpha]);
                }
              }
            }
            this.last_intersection = observed_intersection;
          }

        }

        if (this.last_s_obj_index != s_obj_index) {
          this.pendingRays[j].gap = true;
        }
        this.pendingRays[j].isNew = false;

        this.last_ray = { p1: this.pendingRays[j].p1, p2: this.pendingRays[j].p2 };
        this.last_s_obj_index = s_obj_index;
        if (s_obj) {
          const ret = s_obj.onRayIncident(this.pendingRays[j], j, s_point, surfaceMergingObjs);
          if (ret) {
            if (ret.isAbsorbed) {
              this.pendingRays[j] = null;
            }
            if (ret.newRays) {
              for (let newRay of ret.newRays) {
                this.pendingRays.push(newRay);
              }
            }
            if (ret.truncation) {
              this.totalTruncation += ret.truncation;
            }
          }
        }
        else {
          this.pendingRays[j] = null;
        }

        this.processedRayCount = this.processedRayCount + 1;
        if (this.pendingRays[j]) {
          this.leftRayCount = this.leftRayCount + 1;
        }
      }
    }

    //}
    if (this.scene.simulateColors && !this.isSVG) {
      this.canvasRendererMain.applyColorTransformation();
      this.ctxAboveLight.setTransform(this.scene.scale * this.dpr, 0, 0, this.scene.scale * this.dpr, this.scene.origin.x * this.dpr, this.scene.origin.y * this.dpr);
    }
    if (this.useFloatColorRenderer) {
      this.canvasRendererMain.flush();
    }
    this.ctxMain.globalAlpha = 1.0;
    
    this.updateSimulation(true, true);

    this.validate();

    if (this.shouldSimulatorStop) {
      this.emit('simulationStop', null);
      
      this.shouldSimulatorStop = false;
    } else {
      this.emit('simulationComplete', null);
    }
  }

  /**
   * Stop the simulation.
   * @returns {void}
   */
  stopSimulation() {
    if (this.simulationTimerId != -1) {
      this.shouldSimulatorStop = true;
    }
  }

  /**
   * Check the simulation and display warnings or errors if necessary.
   * @returns {void}
   */
  validate() {
    if (this.brightnessScale == -1) {
      let hasDetector = false;
      for (let obj of this.scene.opticalObjs) {
        if (obj instanceof sceneObjs["Detector"]) {
          hasDetector = true;
          break;
        }
      }
      if (hasDetector || this.scene.simulateColors) {
        this.warning = i18next.t('simulator:generalWarnings.brightnessInconsistent');
      } else {
        this.warning = null;
      }
    } else {
      this.warning = null;
    }

    if (!this.useFloatColorRenderer && this.scene.colorMode !== 'legacy') {
      this.warning = i18next.t('simulator:generalWarnings.needsFloatColorRenderer', { colorMode: i18next.t(`simulator:colorModeModal.${this.scene.colorMode}.title`) });
    }

    if (this.useFloatColorRenderer && this.scene.colorMode === 'legacy') {
      this.warning = i18next.t('simulator:generalWarnings.legacyColorMode');
    }
  }

  static wavelengthToColor(wavelength, brightness, transform) {
    // From https://scienceprimer.com/javascript-code-convert-light-wavelength-color
    var R,
      G,
      B,
      alpha,
      wl = wavelength;

    if (wl >= Simulator.UV_WAVELENGTH && wl < Simulator.VIOLET_WAVELENGTH) {
      R = 0.5;
      G = 0;
      B = 1;
    } else if (wl >= Simulator.VIOLET_WAVELENGTH && wl < Simulator.BLUE_WAVELENGTH) {
      R = -0.5 * (wl - Simulator.BLUE_WAVELENGTH) / (Simulator.BLUE_WAVELENGTH - Simulator.VIOLET_WAVELENGTH);
      G = 0;
      B = 1;
    } else if (wl >= Simulator.BLUE_WAVELENGTH && wl < Simulator.CYAN_WAVELENGTH) {
      R = 0;
      G = (wl - Simulator.BLUE_WAVELENGTH) / (Simulator.CYAN_WAVELENGTH - Simulator.BLUE_WAVELENGTH);
      B = 1;
    } else if (wl >= Simulator.CYAN_WAVELENGTH && wl < Simulator.GREEN_WAVELENGTH) {
      R = 0;
      G = 1;
      B = -1 * (wl - Simulator.GREEN_WAVELENGTH) / (Simulator.GREEN_WAVELENGTH - Simulator.CYAN_WAVELENGTH);
    } else if (wl >= Simulator.GREEN_WAVELENGTH && wl < Simulator.YELLOW_WAVELENGTH) {
      R = (wl - Simulator.GREEN_WAVELENGTH) / (Simulator.YELLOW_WAVELENGTH - Simulator.GREEN_WAVELENGTH);
      G = 1;
      B = 0;
    } else if (wl >= Simulator.YELLOW_WAVELENGTH && wl < Simulator.RED_WAVELENGTH) {
      R = 1;
      G = -1 * (wl - Simulator.RED_WAVELENGTH) / (Simulator.RED_WAVELENGTH - Simulator.YELLOW_WAVELENGTH);
      B = 0.0;
    } else if (wl >= Simulator.RED_WAVELENGTH && wl <= Simulator.INFRARED_WAVELENGTH) {
      R = 1;
      G = 0;
      B = 0;
    } else {
      R = 0;
      G = 0;
      B = 0;
    }

    // intensty is lower at the edges of the visible spectrum.
    if (wl > Simulator.INFRARED_WAVELENGTH || wl < Simulator.UV_WAVELENGTH) {
      alpha = 0;
    } else if (wl > Simulator.RED_WAVELENGTH) {
      alpha = (Simulator.INFRARED_WAVELENGTH - wl) / (Simulator.INFRARED_WAVELENGTH - Simulator.RED_WAVELENGTH);
    } else if (wl < Simulator.VIOLET_WAVELENGTH) {
      alpha = (wl - Simulator.UV_WAVELENGTH) / (Simulator.VIOLET_WAVELENGTH - Simulator.UV_WAVELENGTH);
    } else {
      alpha = 1;
    }

    R *= alpha * brightness;
    G *= alpha * brightness;
    B *= alpha * brightness;

    if (transform) {
      // Adjust color to make (R,G,B) linear when using the 'screen' composition.
      // This is to avoid the color satiation problem when using the 'lighter' composition.
      // Currently not supported when exporting to SVG.


      R = 1 - Math.exp(-R);
      G = 1 - Math.exp(-G);
      B = 1 - Math.exp(-B);
    }

    return [R, G, B, 1];
  }
}

export default Simulator;