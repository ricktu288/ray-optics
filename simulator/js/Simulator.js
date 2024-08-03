var isExporting = false;
var exportRayCountLimit = 100000;


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
   * @typedef {Object} Ray
   * @property {Point} p1 - The starting point of the ray.
   * @property {Point} p2 - Another point on the ray.
   * @property {number} brightness_s - he intensity of the s-polarization component of the ray.
   * @property {number} brightness_p - The intensity of the p-polarization component of the ray. In this simulator the two polarization components are assumed to be of no phase coherence.
   * @property {number} [wavelength] - The wavelength of the ray in nanometers. Only has effect when "Simulate Colors" is on.
   * @property {boolean} gap - Whether the ray is the first ray in a bunch of "continuous" rays. This is for the detection of images to work correctly. The intersection of two rays is considered as a candidate of an image only if the second ray has `gap === false`.
   * @property {boolean} isNew - Whether the ray is just emitted by a source. This is to avoid drawing trivial initial extensions in the "Extended rays" mode.
   */

  constructor(scene, ctxMain, ctxBelowLight, ctxAboveLight, ctxGrid, ctxVirtual) {
    /** @property {Scene} scene - The scene to be simulated. */
    this.scene = scene;

    this.scene.simulator = this; // This circular reference is currently only used by Detector to access `totalTruncation` and CropBox to access `processedRayCount`.

    /** @property {CanvasRenderingContext2D|C2S} ctxMain - The default context for drawing the scene. If other layers are present, this is the context for drawing the light layer. */
    this.ctxMain = ctxMain;

    /** @property {CanvasRenderingContext2D|C2S} ctxBelowLight - The context for drawing the scene below the light layer. */
    this.ctxBelowLight = ctxBelowLight;

    /** @property {CanvasRenderingContext2D|C2S} ctxAboveLight - The context for drawing the scene above the light layer. */
    this.ctxAboveLight = ctxAboveLight;

    /** @property {CanvasRenderingContext2D|C2S} ctxGrid - The context for drawing the grid layer. */
    this.ctxGrid = ctxGrid;

    /** @property {CanvasRenderingContext2D} ctxVirtual - The virtual context for color adjustment. */
    this.ctxVirtual = ctxVirtual;

    
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
   * Run the simulation and draw the scene on the canvases.
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

    if (this.ctxBelowLight.constructor != C2S) {
      this.canvasRendererBelowLight = new CanvasRenderer(this.ctxBelowLight, { x: scene.origin.x * dpr, y: scene.origin.y * dpr }, (scene.scale * dpr), scene.lengthScale, scene.backgroundImage);
      this.canvasRendererAboveLight = new CanvasRenderer(this.ctxAboveLight, { x: scene.origin.x * dpr, y: scene.origin.y * dpr }, (scene.scale * dpr), scene.lengthScale);
    }

    if (!skipLight) {
      this.canvasRendererMain = new CanvasRenderer(this.ctxMain, { x: scene.origin.x * dpr, y: scene.origin.y * dpr }, (scene.scale * dpr), scene.lengthScale);

      if (this.ctxBelowLight.constructor == C2S) {
        this.ctxAboveLight.translate(scene.origin.x / (scene.scale * dpr), scene.origin.y / (scene.scale * dpr));
      }

      this.ctxAboveLight.globalAlpha = 1;
      this.pendingRays = [];
      this.processedRayCount = 0;
    }

    if (!skipGrid && this.ctxBelowLight.constructor != C2S) {

      this.canvasRendererGrid = new CanvasRenderer(this.ctxGrid, { x: scene.origin.x * dpr, y: scene.origin.y * dpr }, (scene.scale * dpr), scene.lengthScale);

      if (scene.showGrid) {
        // Draw the grid

        this.ctxGrid.save();
        this.ctxGrid.setTransform((scene.scale * dpr), 0, 0, (scene.scale * dpr), 0, 0);
        var dashstep = 4 * scene.lengthScale;

        this.ctxGrid.strokeStyle = 'rgb(255,255,255,0.25)';
        this.ctxGrid.lineWidth = 1 * scene.lengthScale;

        var dashPattern;
        if (dashstep * scene.scale <= 2) {
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
        for (var x = scene.origin.x / scene.scale % scene.gridSize; x <= this.ctxGrid.canvas.width / (scene.scale * dpr); x += scene.gridSize) {
          this.ctxGrid.moveTo(x, scene.origin.y / scene.scale % scene.gridSize - scene.gridSize);
          this.ctxGrid.lineTo(x, this.ctxGrid.canvas.height / (scene.scale * dpr));
        }
        this.ctxGrid.stroke();

        // Draw horizontal dashed lines
        this.ctxGrid.beginPath();
        for (var y = scene.origin.y / scene.scale % scene.gridSize; y <= this.ctxGrid.canvas.height / (scene.scale * dpr); y += scene.gridSize) {
          this.ctxGrid.moveTo(scene.origin.x / scene.scale % scene.gridSize - scene.gridSize, y);
          this.ctxGrid.lineTo(this.ctxGrid.canvas.width / (scene.scale * dpr), y);
        }
        this.ctxGrid.stroke();
        this.ctxGrid.setLineDash([]);
        this.ctxGrid.restore();
      }
    }


    if (!(this.ctxBelowLight.constructor == C2S && skipLight)) {
      // Sort the objects with z-index.
      var mapped = scene.objs.map(function (obj, i) {
        return { index: i, value: obj.getZIndex() };
      });
      mapped.sort(function (a, b) {
        return a.value - b.value;
      });
      // Draw the objects
      for (var j = 0; j < scene.objs.length; j++) {
        var i = mapped[j].index;
        scene.objs[i].draw(this.ctxBelowLight.constructor == C2S ? this.canvasRendererMain : this.canvasRendererBelowLight, false, scene.objs[i] === mouseObj);

      }

      if (!skipLight) {
        // Initialize the simulation (e.g. add the rays and reset the detector readings)
        for (let obj of scene.opticalObjs) {
          const ret = obj.onSimulationStart();
          if (ret) {
            if (ret.newRays) {
              this.pendingRays.push(...ret.newRays);
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
      // Draw the "above light" layer of scene.objs. Note that we only draw this when skipLight is true because otherwise processRays() will be called and the "above light" layer will still be drawn, since draw() is called again in processRays() with skipLight set to true.

      for (var i = 0; i < scene.objs.length; i++) {
        scene.objs[i].draw(this.ctxBelowLight.constructor == C2S ? this.canvasRendererMain : this.canvasRendererAboveLight, true, scene.objs[i] === mouseObj); // Draw scene.objs[i]
      }
      if (scene.mode == 'observer') {
        // Draw the observer
        this.ctxAboveLight.globalAlpha = 1;
        this.ctxAboveLight.beginPath();
        this.ctxAboveLight.fillStyle = 'blue';
        this.ctxAboveLight.arc(scene.observer.c.x, scene.observer.c.y, scene.observer.r, 0, Math.PI * 2, false);
        this.ctxAboveLight.fill();
      }
    }

    updateErrorAndWarning();

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

    const opticalObjs = scene.opticalObjs;

    if (scene.simulateColors) {
      this.ctxMain.globalCompositeOperation = 'screen';
    }

    while (true) {
      if (new Date() - st_time > 50 && !isExporting) {
        // If already run for 200ms
        // Pause for 10ms and continue (prevent not responding)
        this.simulationTimerId = setTimeout(() => this.processRays(), this.firstBreak ? 100 : 1);
        this.firstBreak = false;

        this.emit('simulationPause', null);

        simulator.updateSimulation(true, true); // Redraw the opticalObjs to avoid outdated information (e.g. detector readings).

        this.check();
        return;
      }
      if (isExporting && this.processedRayCount > exportRayCountLimit) {
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
            if (s_point && geometry.distanceSquared(s_point_temp, s_point) < Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * scene.lengthScale * scene.lengthScale && (opticalObjs[i].constructor.supportsSurfaceMerging || s_obj.constructor.supportsSurfaceMerging)) {
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
            else if (s_lensq_temp < s_lensq && s_lensq_temp > Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * scene.lengthScale * scene.lengthScale) {
              s_obj = opticalObjs[i]; // Update the object to be shot
              s_obj_index = i;
              s_point = s_point_temp;
              s_lensq = s_lensq_temp;

              surfaceMergingObjs = [];
            }
          }
        }
        if (scene.simulateColors) {
          var color = Simulator.wavelengthToColor(this.pendingRays[j].wavelength, (this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p), this.ctxAboveLight.constructor != C2S);
        } else {
          this.ctxMain.globalAlpha = alpha0 * (this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p);
        }
        // If not shot on any object
        if (s_lensq == Infinity) {
          if (scene.mode == 'rays' || scene.mode == 'extended') {
            if (scene.simulateColors) {
              this.canvasRendererMain.drawRay(this.pendingRays[j], color); // Draw the ray
            } else {
              this.canvasRendererMain.drawRay(this.pendingRays[j], 'rgb(255,255,128)'); // Draw the ray
            }
          }
          if (scene.mode == 'extended' && !this.pendingRays[j].isNew) {
            if (scene.simulateColors) {
              this.ctxMain.setLineDash([2 * scene.lengthScale, 2 * scene.lengthScale]);
              this.canvasRendererMain.drawRay(geometry.line(this.pendingRays[j].p1, geometry.point(this.pendingRays[j].p1.x * 2 - this.pendingRays[j].p2.x, this.pendingRays[j].p1.y * 2 - this.pendingRays[j].p2.y)), color); // Draw the extension of the ray
              this.ctxMain.setLineDash([]);
            } else {
              this.canvasRendererMain.drawRay(geometry.line(this.pendingRays[j].p1, geometry.point(this.pendingRays[j].p1.x * 2 - this.pendingRays[j].p2.x, this.pendingRays[j].p1.y * 2 - this.pendingRays[j].p2.y)), 'rgb(255,128,0)'); // Draw the extension of the ray
            }
          }

          if (scene.mode == 'observer') {
            observed_point = geometry.lineCircleIntersections(this.pendingRays[j], scene.observer)[2];
            if (observed_point) {
              if (geometry.intersectionIsOnRay(observed_point, this.pendingRays[j])) {
                observed = true;
              }
            }
          }
        }
        else {
          // Here the ray will be shot on s_obj at s_point after traveling for s_len
          if (scene.mode == 'rays' || scene.mode == 'extended') {
            if (scene.simulateColors) {
              this.canvasRendererMain.drawSegment(geometry.line(this.pendingRays[j].p1, s_point), color); // Draw the ray
            } else {
              this.canvasRendererMain.drawSegment(geometry.line(this.pendingRays[j].p1, s_point), 'rgb(255,255,128)'); // Draw the ray
            }
          }
          if (scene.mode == 'extended' && !this.pendingRays[j].isNew) {
            if (scene.simulateColors) {
              this.ctxMain.setLineDash([2 * scene.lengthScale, 2 * scene.lengthScale]);
              this.canvasRendererMain.drawRay(geometry.line(this.pendingRays[j].p1, geometry.point(this.pendingRays[j].p1.x * 2 - this.pendingRays[j].p2.x, this.pendingRays[j].p1.y * 2 - this.pendingRays[j].p2.y)), color); // Draw the backward extension of the ray
              this.ctxMain.setLineDash([1 * scene.lengthScale, 5 * scene.lengthScale]);
              this.canvasRendererMain.drawRay(geometry.line(s_point, geometry.point(s_point.x * 2 - this.pendingRays[j].p1.x, s_point.y * 2 - this.pendingRays[j].p1.y)), color); // Draw the forward extension of the ray
              this.ctxMain.setLineDash([]);
            } else {
              this.canvasRendererMain.drawRay(geometry.line(this.pendingRays[j].p1, geometry.point(this.pendingRays[j].p1.x * 2 - this.pendingRays[j].p2.x, this.pendingRays[j].p1.y * 2 - this.pendingRays[j].p2.y)), 'rgb(255,128,0)'); // Draw the backward extension of the ray
              this.canvasRendererMain.drawRay(geometry.line(s_point, geometry.point(s_point.x * 2 - this.pendingRays[j].p1.x, s_point.y * 2 - this.pendingRays[j].p1.y)), 'rgb(80,80,80)'); // Draw the forward extension of the ray
            }

          }

          if (scene.mode == 'observer') {
            observed_point = geometry.lineCircleIntersections(this.pendingRays[j], scene.observer)[2];

            if (observed_point) {

              if (geometry.intersectionIsOnSegment(observed_point, geometry.line(this.pendingRays[j].p1, s_point))) {
                observed = true;
              }
            }
          }
        }
        if (scene.mode == 'observer' && this.last_ray) {
          if (!this.pendingRays[j].gap) {
            observed_intersection = geometry.linesIntersection(this.pendingRays[j], this.last_ray); // The intersection of the observed rays

            if (observed) {
              if (this.last_intersection && geometry.distanceSquared(this.last_intersection, observed_intersection) < 25 * scene.lengthScale * scene.lengthScale) {
                // If the intersections are near each others
                if (geometry.intersectionIsOnRay(observed_intersection, geometry.line(observed_point, this.pendingRays[j].p1)) && geometry.distanceSquared(observed_point, this.pendingRays[j].p1) > 1e-5 * scene.lengthScale * scene.lengthScale) {


                  if (scene.simulateColors) {
                    var color = Simulator.wavelengthToColor(this.pendingRays[j].wavelength, (this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p) * 0.5, this.ctxAboveLight.constructor != C2S);
                  } else {
                    this.ctxMain.globalAlpha = alpha0 * ((this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p) + (this.last_ray.brightness_s + this.last_ray.brightness_p)) * 0.5;
                  }
                  if (s_point) {
                    rpd = (observed_intersection.x - this.pendingRays[j].p1.x) * (s_point.x - this.pendingRays[j].p1.x) + (observed_intersection.y - this.pendingRays[j].p1.y) * (s_point.y - this.pendingRays[j].p1.y);
                  }
                  else {
                    rpd = (observed_intersection.x - this.pendingRays[j].p1.x) * (this.pendingRays[j].p2.x - this.pendingRays[j].p1.x) + (observed_intersection.y - this.pendingRays[j].p1.y) * (this.pendingRays[j].p2.y - this.pendingRays[j].p1.y);
                  }
                  if (rpd < 0) {
                    // Virtual image
                    if (scene.simulateColors) {
                      this.ctxMain.fillStyle = color;
                      this.ctxMain.fillRect(observed_intersection.x - 1.5 * scene.lengthScale, observed_intersection.y - 1.5 * scene.lengthScale, 3 * scene.lengthScale, 3 * scene.lengthScale);
                    } else {
                      this.canvasRendererMain.drawPoint(observed_intersection, 'rgb(255,128,0)'); // Draw the image
                    }
                  }
                  else if (rpd < s_lensq) {
                    // Real image
                    if (scene.simulateColors) {
                      this.canvasRendererMain.drawPoint(observed_intersection, color); // Draw the image
                    } else {
                      this.canvasRendererMain.drawPoint(observed_intersection, 'rgb(255,255,128)'); // Draw the image
                    }
                  }
                  if (scene.simulateColors) {
                    this.ctxMain.setLineDash([1 * scene.lengthScale, 2 * scene.lengthScale]);
                    this.canvasRendererMain.drawSegment(geometry.line(observed_point, observed_intersection), color); // Draw the observed ray
                    this.ctxMain.setLineDash([]);
                  } else {
                    this.canvasRendererMain.drawSegment(geometry.line(observed_point, observed_intersection), 'rgb(0,0,255)'); // Draw the observed ray
                  }
                }
                else {
                  if (scene.simulateColors) {
                    this.ctxMain.setLineDash([1 * scene.lengthScale, 2 * scene.lengthScale]);
                    this.canvasRendererMain.drawRay(geometry.line(observed_point, this.pendingRays[j].p1), color); // Draw the observed ray
                    this.ctxMain.setLineDash([]);
                  } else {
                    this.canvasRendererMain.drawRay(geometry.line(observed_point, this.pendingRays[j].p1), 'rgb(0,0,255)'); // Draw the observed ray
                  }
                }
              }
              else {
                if (this.last_intersection) {
                  if (scene.simulateColors) {
                    this.ctxMain.setLineDash([1 * scene.lengthScale, 2 * scene.lengthScale]);
                    this.canvasRendererMain.drawRay(geometry.line(observed_point, this.pendingRays[j].p1), color); // Draw the observed ray
                    this.ctxMain.setLineDash([]);
                  } else {
                    this.canvasRendererMain.drawRay(geometry.line(observed_point, this.pendingRays[j].p1), 'rgb(0,0,255)'); // Draw the observed ray
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

        if (scene.mode == 'images' && this.last_ray) {
          if (!this.pendingRays[j].gap) {

            observed_intersection = geometry.linesIntersection(this.pendingRays[j], this.last_ray);
            if (this.last_intersection && geometry.distanceSquared(this.last_intersection, observed_intersection) < 25 * scene.lengthScale * scene.lengthScale) {
              if (scene.simulateColors) {
                var color = Simulator.wavelengthToColor(this.pendingRays[j].wavelength, (this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p) * 0.5, this.ctxAboveLight.constructor != C2S);
              } else {
                this.ctxMain.globalAlpha = alpha0 * ((this.pendingRays[j].brightness_s + this.pendingRays[j].brightness_p) + (this.last_ray.brightness_s + this.last_ray.brightness_p)) * 0.5;
              }

              if (s_point) {
                rpd = (observed_intersection.x - this.pendingRays[j].p1.x) * (s_point.x - this.pendingRays[j].p1.x) + (observed_intersection.y - this.pendingRays[j].p1.y) * (s_point.y - this.pendingRays[j].p1.y);
              }
              else {
                rpd = (observed_intersection.x - this.pendingRays[j].p1.x) * (this.pendingRays[j].p2.x - this.pendingRays[j].p1.x) + (observed_intersection.y - this.pendingRays[j].p1.y) * (this.pendingRays[j].p2.y - this.pendingRays[j].p1.y);
              }

              if (rpd < 0) {
                // Virtual image
                if (scene.simulateColors) {
                  this.ctxMain.fillStyle = color;
                  this.ctxMain.fillRect(observed_intersection.x - 1.5 * scene.lengthScale, observed_intersection.y - 1.5 * scene.lengthScale, 3 * scene.lengthScale, 3 * scene.lengthScale);
                } else {
                  this.canvasRendererMain.drawPoint(observed_intersection, 'rgb(255,128,0)'); // Draw the image
                }
              }
              else if (rpd < s_lensq) {
                // Real image
                if (scene.simulateColors) {
                  this.canvasRendererMain.drawPoint(observed_intersection, color); // Draw the image
                } else {
                  this.canvasRendererMain.drawPoint(observed_intersection, 'rgb(255,255,128)'); // Draw the image
                }
              }
              else {
                // Virtual object
                if (scene.simulateColors) {
                  this.ctxMain.fillStyle = color;
                  this.ctxMain.fillRect(observed_intersection.x - 0.5 * scene.lengthScale, observed_intersection.y - 0.5 * scene.lengthScale, 1 * scene.lengthScale, 1 * scene.lengthScale);
                } else {
                  this.canvasRendererMain.drawPoint(observed_intersection, 'rgb(80,80,80)');
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
              this.pendingRays.push(...ret.newRays);
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
    if (scene.simulateColors && this.ctxMain.constructor != C2S) {
      // Inverse transformation of the color adjustment made in Simulator.wavelengthToColor.
      // This is to avoid the color satiation problem when using the 'lighter' composition.
      // Currently not supported when exporting to SVG.


      this.ctxVirtual.canvas.width = this.ctxMain.canvas.width;
      this.ctxVirtual.canvas.height = this.ctxMain.canvas.height;

      this.ctxVirtual.drawImage(this.ctxMain.canvas, 0, 0);

      var imageData = this.ctxVirtual.getImageData(0.0, 0.0, this.ctxVirtual.canvas.width, this.ctxVirtual.canvas.height);
      var data = imageData.data;
      for (var i = 0; i < data.length; i += 4) {
        if (data[i + 3] == 0) continue; // Skip transparent pixels
        var a0 = data[i + 3] / 256;
        var R = - Math.log(1 - (data[i] / 256)) * a0;
        var G = - Math.log(1 - (data[i + 1] / 256)) * a0;
        var B = - Math.log(1 - (data[i + 2] / 256)) * a0;
        var factor = Math.max(R, G, B);
        var r = 255 * R / factor;
        var g = 255 * G / factor;
        var b = 255 * B / factor;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255 * Math.min(factor, 1);
      }
      this.ctxVirtual.putImageData(imageData, 0, 0);
      this.ctxMain.globalCompositeOperation = 'source-over';

      this.ctxMain.setTransform(1, 0, 0, 1, 0, 0);
      this.ctxMain.clearRect(0, 0, this.ctxMain.canvas.width, this.ctxMain.canvas.height);
      this.ctxMain.drawImage(this.ctxVirtual.canvas, 0, 0);
      this.ctxAboveLight.setTransform(scene.scale * dpr, 0, 0, scene.scale * dpr, scene.origin.x * dpr, scene.origin.y * dpr);
    }
    this.ctxMain.globalAlpha = 1.0;

    this.check();
    if (this.shouldSimulatorStop) {
      this.emit('simulationStop', null);
      
      this.shouldSimulatorStop = false;
    } else {
      this.emit('simulationComplete', null);
    }

    simulator.updateSimulation(true, true);
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
  check() {
    if (this.brightnessScale == -1) {
      let hasDetector = false;
      for (let obj of scene.opticalObjs) {
        if (obj instanceof objTypes["Detector"]) {
          hasDetector = true;
          break;
        }
      }
      if (hasDetector || scene.simulateColors) {
        this.warning = getMsg("brightness_inconsistent_warning");
      } else {
        this.warning = null;
      }
    } else {
      this.warning = null;
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
      // Currently not supported when exporting to SVG as it is currently under draft in CSS Color 4 
      R = 1 - Math.exp(-R);
      G = 1 - Math.exp(-G);
      B = 1 - Math.exp(-B);
    }

    return "rgb(" + (R * 100) + "%," + (G * 100) + "%," + (B * 100) + "%)";

  }
}