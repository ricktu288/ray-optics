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

import geometry from './geometry.js';
import * as sceneObjs from './sceneObjs.js';
import Mouse from './Mouse.js';
import * as C2S from 'canvas2svg';
import { saveAs } from 'file-saver';
import Scene from './Scene.js';
import Simulator from './Simulator.js';

/**
 * @typedef {Object} DragContext
 * @property {number} part - The index of the part within the object being dragged. 0 for the whole object.
 * @property {Point} [targetPoint] - The target point where the user is dragging. This is recognized by the editor so that it can be used for popping up the coordinate box (when the user double-clicks or right-clicks such a point), or binding to a handle (when the user holds Ctrl and clicks such a point).
 * @property {Point} [targetPoint_] - If this property is set instead of setting `targetPoint`, then the point will not be used for the coordinate box or handle, but is still recognized by the editor when deciding which part of which object the user want to interact with.
 * @property {boolean} [requiresObjBarUpdate] - Whether the object bar should be updated during the dragging.
 * @property {string} [cursor] - The cursor to be used during hovering and dragging.
 * @property {SnapContext} [snapContext] - The snap context.
 * @property {boolean} [hasDuplicated] - Whether the object is duplicated during the dragging. This is true when the user holds the Ctrl key and drags the whole object. Only set by the editor.
 * @property {BaseSceneObj} [originalObj] - The original object when the dragging starts. Only set by the editor.
 * @property {boolean} [isByHandle] - Whether the dragging is initiated by dragging a handle. Only set by the editor.
 */

/**
 * @typedef {Object} SelectionSearchResult
 * @property {DragContext} dragContext - The drag context.
 * @property {number} targetObjIndex - The index of the target object.
 */

/**
 * @typedef {Object} ControlPoint
 * @property {DragContext} dragContext - The drag context of the virtual mouse that is dragging the control point.
 * @property {Point} newPoint - The new position of the control point.
 */

/**
 * @typedef {Object} SnapContext
 * @property {boolean} [locked] - Whether the snapping direction is locked.
 * @property {number} [i0] - The index of the locked direction.
 */

/**
 * The visual scene editor that edits the scene represented by the {@link Scene} class. This class is responsible for handling user interactions with the canvas, such as dragging objects, selecting objects, and adding objects. It also manages the undo and redo operations (by serializing/deserializing the scene to/from JSON) and the crop mode. Rendering is not done by this class, but by the {@link Simulator} class. Also, the UI update (e.g. object bar) is not done by this class. When UI update is needed, this class emits events to notify the UI to update.
 * 
 * When constructing or editing an object in the scene, the object itself is responsible for handling the mouse events, and the editor only passes the events to the object (including checking whether the mouse is interacting with the object). See the mouse-related methods in the {@link BaseSceneObj} class for more information. The options in the object bar when the object is selected is also managed by the `populateObjBar` method of the object itself (and not the editor).
 * 
 * In the Ray Optics Simulator web app, a single instance of this class is used to manage the scene and the canvas. Although several canvas layers are used, this class only manages the top-layered canvas where mouse or touch events are captured. 
 * The `newAction` event is emitted when a new action is done by the user, and is used to create a new undo point.
 * When the Ace editor is enabled, it has its own undo and redo operations, and is not always in sync with the undo and redo operations of this class.
 * 
 * This class is not intended to be used in a Node.js environment, but can be used by other web apps to create standalone interactive optical simulations without the main UI of the Ray Optics Simulator web app.
 * @class
 */
class Editor {

  /**
   * The limit of the undo data.
   */
  static UNDO_LIMIT = 50;

  /**
   * The minimal interval between two undo points.
   */
  static UNDO_INTERVAL = 250;

  /**
   * Create a new Editor instance.
   * @param {Scene} scene - The scene to be edited and simulated.
   * @param {HTMLCanvasElement} canvas - The top-layered canvas for user interaction.
   * @param {Simulator} simulator - The simulator.
   */
  constructor(scene, canvas, simulator) {
    /** @property {Scene} scene - The scene to be edited and simulated. */
    this.scene = scene;

    this.scene.editor = this;

    /** @property {HTMLCanvasElement} canvas - The top-layered canvas for user interaction. */
    this.canvas = canvas;

    /** @property {Simulator} simulator - The simulator. */
    this.simulator = simulator;

    /** @property {boolean} lastDeviceIsTouch - Whether the last interaction with `canvas` is done by a touch device. */
    this.lastDeviceIsTouch = false;

    /** @property {Point} mousePos - The position of the mouse in the scene. */
    this.mousePos = geometry.point(0, 0);

    /** @property {Point|null} lastMousePos - The position of the mouse in the scene when the last mousedown event is triggered before the mouse is treated as moved. */
    this.lastMousePos = null;

    /** @property {boolean} isConstructing - Whether an object is being constructed. */
    this.isConstructing = false;

    /** @property {number} draggingObjIndex - The index of the object being dragged. -1 if no object is being dragged; -3 if the scene is being dragged; -4 if the observer is being dragged. */
    this.draggingObjIndex = -1;

    /** @property {number} positioningObjIndex - The index of the object being positioned. -1 if no object is being positioned; -4 if the observer is being positioned. */
    this.positioningObjIndex = -1;

    /** @property {DragContext} dragContext - The context of the dragging or positioning action. */
    this.dragContext = {};

    /** @property {number} selectedObjIndex - The index of the selected object. -1 if no object is selected. */
    this.selectedObjIndex = -1;

    /** @property {number} hoveredObjIndex - The index of the hovered object. -1 if no object is hovered. */
    this.hoveredObjIndex = -1;

    /** @property {string} addingObjType - The type of the object that will be added when the user clicks on the canvas. Empty if 'Move view' tool is selected so that no object will be added. */
    this.addingObjType = '';

    /** @property {string[]} undoData - The data for undoing, where each element is a JSON string representing the scene. */
    this.undoData = [this.scene.toJSON()];

    /** @property {Date} lastActionTime - The time when the last undo data is pushed. */
    this.lastActionTime = new Date();

    /** @property {string} lastActionJson - The JSON string representing the scene when the last undo data is pushed. */
    this.lastActionJson = this.scene.toJSON();

    /** @property {number} undoIndex - The index of the undo data currently displayed. */
    this.undoIndex = 0;

    /** @property {number} undoLBound - The upper bound of the undo data index. */
    this.undoLBound = 0;

    /** @property {number} undoUBound - The lower bound of the undo data index. */
    this.undoUBound = 0;

    /** @property {boolean} isInCropMode - Whether the editor is in the crop mode. */
    this.isInCropMode = false;

    /** @property {boolean} pendingControlPointSelection - Whether a user has clicked on a control point with the Ctrl key held down, and the editor is waiting to see if the user is going to select the control point for a handle. */
    this.pendingControlPointSelection = false;

    /** @property {ControlPoint[]} pendingControlPoints - The control points to be selected for a handle when the user clicks on a control point with the Ctrl key held down. */
    this.pendingControlPoints = [];
    
    /** @property {boolean} pendingObjectSelection - Whether a user has clicked on an object with the Ctrl key held down, and the editor is waiting to see if the user is going to select the object for a handle. */
    this.pendingObjectSelection = false;
    
    /** @property {number} pendingObjectIndex - The index of the object to be bound to a handle when the user clicks on an object with the Ctrl key held down. */
    this.pendingObjectIndex = -1;

    /** @property {string} addingModuleName - The name of the module that will be added when the user clicks on the canvas if `addingObjType` is 'ModuleObj'. */
    this.addingModuleName = '';

    /** @property {object} eventListeners - The event listeners of the editor. */
    this.eventListeners = {};

    /** @property {number} delayedValidationTimerId - The ID of the timer for performing a delayed validation. */
    this.delayedValidationTimerId = -1;

    /** @property {number} minimalDragLength - The minimal drag length threshold to trigger a drag operation. */
    this.minimalDragLength = 3;

    this.initCanvas();
  }

  /**
   * Add an event listener to the editor.
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
   * The event when the mouse coordinate changes. This is different from the actual mousemove, since the grid snapping is considered, and the coordnates can also be updated by other events such as zooming.
   * @event Editor#mouseCoordinateChange
   * @type {object}
   * @property {Point} mousePos - The position of the mouse in the scene. Null if the mouse is out of the canvas.
   */

  /**
   * The event when the selection changes. This may also be triggered if the same object is selected again.
   * @event Editor#selectionChange
   * @type {object}
   * @property {number} oldIndex - The index of the previously selected object.
   * @property {number} newIndex - The index of the newly selected object.
   */

  /**
   * The event when the user interacts with the canvas during the positioning of an object, so that the new coordinates are assumed to be confirmed.
   * @event Editor#requestPositioningComfirm
   * @type {object}
   * @property {boolean} ctrl - Whether the Ctrl key is held down.
   * @property {boolean} shift - Whether the Shift key is held down.
   */

  /**
   * The event when the positioning of an object starts.
   * @event Editor#positioningStart
   * @type {object}
   * @property {DragContext} dragContext - The context of the positioning action, which is the same as the drag context if the user instead drags the control point to be positioned.
   */

  /**
   * The event when the positioning of an object ends (either confirmed or canceled).
   * @event Editor#positioningEnd
   */

  /**
   * The event when the scene is loaded. If the scene contains resources that takes time to load, this event is emitted every time a resource is loaded, where the last event has the `completed` property set to `true`.
   * @event Editor#sceneLoaded
   * @type {object}
   * @property {boolean} needFullUpdate - Whether the UI needs a full update.
   * @property {boolean} completed - Whether the loading is completed.
   */

  /**
   * The event when a new action is done and the UI (e.g. code editor) should be updated.
   * @event Editor#newAction
   * @type {object}
   * @property {string} oldJSON - The JSON string representing the scene before the action.
   * @property {string} newJSON - The JSON string representing the scene after the action.
   * @property {boolean} fromJsonEditor - Whether the action is from the JSON editor.
   */

  /**
   * The event when the scale of the scene is changed.
   * @event Editor#scaleChange
   */

  /**
   * The event when a new undo data is pushed.
   * @event Editor#newUndoPoint
   */

  /**
   * The event when the user undo an action.
   * @event Editor#undo
   */

  /**
   * The event when the user redo an action.
   * @event Editor#redo
   */

  /**
   * The event when the error and warning messages in the UI should be updated.
   * @event requestUpdateErrorAndWarning
   */

  /**
   * Initialize the canvas event listeners.
   */
  initCanvas() {

    let lastTouchTime = -1;

    const self = this;

    this.canvas.addEventListener('mousedown', function (e) {
      if (self.lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
      self.lastDeviceIsTouch = false;

      if (self.scene.error) {
        self.canvas.style.cursor = 'not-allowed';
        return;
      }

      e.preventDefault(); // Prevent text selection
      self.canvas.focus();
      self.onCanvasMouseDown(e);
    });

    this.canvas.addEventListener('mousemove', function (e) {
      //console.log("mousemove");
      if (self.lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
      self.lastDeviceIsTouch = false;

      if (self.scene.error) {
        self.canvas.style.cursor = 'not-allowed';
        return;
      }

      e.preventDefault(); // Prevent text selection
      self.onCanvasMouseMove(e);
    });

    this.canvas.addEventListener('mouseup', function (e) {
      if (self.lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
      self.lastDeviceIsTouch = false;

      if (self.scene.error) {
        self.canvas.style.cursor = 'not-allowed';
        return;
      }

      //console.log("mouseup");
      self.onCanvasMouseUp(e);
    });

    this.canvas.addEventListener('mouseout', function (e) {
      if (self.lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
      self.lastDeviceIsTouch = false;
      if (self.draggingObjIndex != -1) {
        self.onCanvasMouseUp(e);
      }
      self.hoveredObjIndex = -1;

      self.emit('mouseCoordinateChange', { mousePos: null });
      self.simulator.updateSimulation(true, true)
    });


    let lastZoomTime = 0;
    let zoomThrottle = 16; // ~60fps for smoother feel

    this.canvas.addEventListener('wheel', function (e) {
      e.preventDefault(); // Prevent default scrolling
      
      var now = Date.now();
      if (now - lastZoomTime < zoomThrottle) return;
      lastZoomTime = now;

      // Get precise delta from wheel event
      const deltaY = e.deltaY || e.detail || e.wheelDelta;
      
      // Calculate zoom speed based on current scale
      const currentScale = self.scene.scale * self.scene.lengthScale;
      const zoomSpeed = Math.max(0.05, currentScale * 0.05); // Faster zoom at higher scales
      
      // Calculate new scale with pixel-precise delta
      let newScale = currentScale;
      if (deltaY > 0) {
        newScale = currentScale - zoomSpeed;
      } else if (deltaY < 0) {
        newScale = currentScale + zoomSpeed;
      }
      
      // Clamp scale between min and max values
      newScale = Math.max(0.25, Math.min(5.00, newScale));
      
      // Convert to percentage scale
      const finalScale = newScale * 100;
      
      // Apply zoom centered on mouse position
      self.setScaleWithCenter(
        finalScale / self.scene.lengthScale / 100,
        (e.pageX - e.target.offsetLeft) / self.scene.scale,
        (e.pageY - e.target.offsetTop) / self.scene.scale
      );
      
      self.onActionComplete();
    }, false);

    let initialPinchDistance = null;
    let lastScale = 1;
    let lastX = 0;
    let lastY = 0;

    this.canvas.addEventListener('touchstart', function (e) {
      if (self.scene.error) return;
      self.lastDeviceIsTouch = true;
      lastTouchTime = Date.now();
      if (e.touches.length === 2) {
        // Pinch to zoom
        e.preventDefault();
        lastX = (e.touches[0].pageX + e.touches[1].pageX) / 2;
        lastY = (e.touches[0].pageY + e.touches[1].pageY) / 2;
        if (self.isConstructing || self.draggingObjIndex >= 0) {
          self.onCanvasMouseUp(e);
          self.undo();
        } else {
          self.onCanvasMouseUp(e);
        }
      } else {
        //console.log("touchstart");
        self.canvas.focus();
        self.onCanvasMouseMove(e);
        self.onCanvasMouseDown(e);
      }
    });


    this.canvas.addEventListener('touchmove', function (e) {
      if (self.scene.error) return;
      self.lastDeviceIsTouch = true;
      lastTouchTime = Date.now();
      e.preventDefault();
      //console.log("touchmove");
      if (e.touches.length === 2) {
        // Pinch to zoom

        // Calculate current distance between two touches
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If initialPinchDistance is null, this is the first move event of the pinch
        // Set initial distance
        if (initialPinchDistance === null) {
          initialPinchDistance = distance;
          lastScale = self.scene.scale;
        }

        // Calculate the scaling factor
        const scaleFactor = distance / initialPinchDistance;

        // Update scale based on previous scale and scaling factor
        let newScale = lastScale * scaleFactor;

        newScale = Math.max(0.25 / self.scene.lengthScale, Math.min(5.00 / self.scene.lengthScale, newScale));

        // Calculate the mid point between the two touches
        const x = (e.touches[0].pageX + e.touches[1].pageX) / 2;
        const y = (e.touches[0].pageY + e.touches[1].pageY) / 2;

        // Calculate the change in scale relative to the center point
        const dx2 = x - lastX;
        const dy2 = y - lastY;

        // Apply the translation
        self.scene.origin.x += dx2;
        self.scene.origin.y += dy2;

        // Apply the scale transformation
        self.setScaleWithCenter(newScale, (x - e.target.offsetLeft) / self.scene.scale, (y - e.target.offsetTop) / self.scene.scale);

        // Update last values
        lastX = x;
        lastY = y;

      } else {
        self.onCanvasMouseMove(e);
      }
    });

    this.canvas.addEventListener('touchend', function (e) {
      if (self.scene.error) return;
      self.lastDeviceIsTouch = true;
      lastTouchTime = Date.now();
      //console.log("touchend");
      if (e.touches.length < 2) {
        initialPinchDistance = null;
        self.onCanvasMouseUp(e);
        self.onActionComplete();
      }
    });

    this.canvas.addEventListener('touchcancel', function (e) {
      if (self.scene.error) return;
      self.lastDeviceIsTouch = true;
      lastTouchTime = Date.now();
      //console.log("touchcancel");
      initialPinchDistance = null;
      /*
      if (self.isConstructing || self.draggingObjIndex >= 0) {
        self.onCanvasMouseUp(e);
        self.undo();
      } else {
        self.onCanvasMouseUp(e);
      }
      */
      self.onCanvasMouseUp(e);
    });

    this.canvas.addEventListener('dblclick', function (e) {
      if (self.scene.error) return;
      self.onCanvasDblClick(e);
    });
  }


  /**
   * Handle the equivalent of the mousedown event on the canvas, which can be triggered by both mouse and single touch.
   * @param {MouseEvent} e - The event.
   */
  onCanvasMouseDown(e) {
    if (e.changedTouches) {
      var et = e.changedTouches[0];
      this.lastDeviceIsTouch = true;
    } else {
      var et = e;
      this.lastDeviceIsTouch = false;
    }

    // Get raw coordinates first
    const rawX = (et.pageX - e.target.offsetLeft - this.scene.origin.x) / this.scene.scale;
    const rawY = (et.pageY - e.target.offsetTop - this.scene.origin.y) / this.scene.scale;

    this.lastMousePos = geometry.point(rawX, rawY);
    
    // Truncate to binary fractions
    const truncX = this.truncateToBinaryFraction(rawX, this.scene.scale);
    const truncY = this.truncateToBinaryFraction(rawY, this.scene.scale);
    
    var mousePos_nogrid = geometry.point(truncX, truncY);
    var mousePos2;
    if (this.scene.snapToGrid && !(e.altKey && !this.isConstructing)) {
      mousePos2 = geometry.point(
        Math.round(((et.pageX - e.target.offsetLeft - this.scene.origin.x) / this.scene.scale) / this.scene.gridSize) * this.scene.gridSize,
        Math.round(((et.pageY - e.target.offsetTop - this.scene.origin.y) / this.scene.scale) / this.scene.gridSize) * this.scene.gridSize
      );
    }
    else {
      mousePos2 = mousePos_nogrid;
    }

    if (this.positioningObjIndex != -1) {
      this.emit('requestPositioningComfirm', { ctrl: e.ctrlKey, shift: e.shiftKey });
      if (!(e.which && e.which == 3)) {
        return;
      }
    }


    if (!((e.which && (e.which == 1 || e.which == 3)) || (e.changedTouches))) {
      return;
    }

    if (this.scene.snapToGrid) {
      this.mousePos = geometry.point(Math.round(((et.pageX - e.target.offsetLeft - this.scene.origin.x) / this.scene.scale) / this.scene.gridSize) * this.scene.gridSize, Math.round(((et.pageY - e.target.offsetTop - this.scene.origin.y) / this.scene.scale) / this.scene.gridSize) * this.scene.gridSize);

    }
    else {
      this.mousePos = mousePos_nogrid;
    }


    if (this.isConstructing) {
      if ((e.which && e.which == 1) || (e.changedTouches)) {
        // Only react for left click
        // If an obj is being created, pass the action to it
        if (this.selectedObjIndex != this.scene.objs.length - 1) {
          this.selectObj(this.scene.objs.length - 1); // Keep the constructing obj selected
        }
        const ret = this.scene.objs[this.scene.objs.length - 1].onConstructMouseDown(new Mouse(mousePos_nogrid, this.scene, this.lastDeviceIsTouch), e.ctrlKey, e.shiftKey);
        if (ret && ret.isDone) {
          this.isConstructing = false;
        }
        if (ret && ret.requiresObjBarUpdate) {
          this.selectObj(this.selectedObjIndex);
        }
        this.simulator.updateSimulation(!this.scene.objs[this.scene.objs.length - 1].constructor.isOptical, true);
      }
    }
    else {
      // lockObjs prevents selection, but alt overrides it
      if ((!(this.scene.lockObjs) != (e.altKey && this.addingObjType != '')) && !(e.which == 3)) {

        this.dragContext = {};

        if (this.scene.mode == 'observer') {
          if (geometry.distanceSquared(mousePos_nogrid, this.scene.observer.c) < this.scene.observer.r * this.scene.observer.r) {
            // The mousePos clicked the observer
            this.draggingObjIndex = -4;
            this.dragContext = {};
            this.dragContext.mousePos0 = this.mousePos; // Mouse position when the user starts dragging
            this.dragContext.mousePos1 = this.mousePos; // Mouse position at the last moment during dragging
            this.dragContext.snapContext = {};
            return;
          }
        }

        var rets = this.selectionSearch(mousePos_nogrid);
        var ret = rets[0];
        if (ret.targetObjIndex != -1) {
          if (!e.ctrlKey && this.scene.objs.length > 0 && this.scene.objs[0].constructor.type == "Handle" && this.scene.objs[0].notDone) {
            // If the user was creating a handle but now clicking a point without holding ctrl, cancel the handle creation
            this.removeObj(0);
            ret.targetObjIndex--;
          }
          this.selectObj(ret.targetObjIndex);
          this.dragContext = ret.dragContext;
          this.dragContext.originalObj = this.scene.objs[ret.targetObjIndex].serialize(); // Store the obj status before dragging
          this.dragContext.hasDuplicated = false;
          this.draggingObjIndex = ret.targetObjIndex;
          if (e.ctrlKey) {
            // If we're clicking on an entire object, prepare to bind it to a new handle
            if (this.dragContext.part === 0) {
              this.pendingObjectSelection = true;
              this.pendingObjectIndex = ret.targetObjIndex;
            }
            // If we're clicking on a control point, prepare to bind it to a new handle
            else if (this.dragContext.targetPoint) {
              this.pendingControlPointSelection = true;
              this.pendingControlPoints = rets;
            }
          }
          return;
        }
      }

      if (this.draggingObjIndex == -1) {
        // The mousePos clicked the blank area
        if (this.scene.objs.length > 0 && this.scene.objs[0].constructor.type == "Handle" && this.scene.objs[0].notDone) {
          // User is creating a handle
          this.finishHandleCreation(this.mousePos);
          this.hoveredObjIndex = 0;
          this.canvas.style.cursor = 'pointer';
          this.simulator.updateSimulation(true, true);
          return;
        }
        if ((this.addingObjType == '') || (e.which == 3)) {
          // To drag the entire scene
          this.draggingObjIndex = -3;
          this.dragContext = {};
          this.dragContext.mousePos0 = this.mousePos; // Mouse position when the user starts dragging
          this.dragContext.mousePos1 = this.mousePos; // Mouse position at the last moment during dragging
          this.dragContext.mousePos2 = this.scene.origin; //Original origin.
          this.dragContext.snapContext = {};
          this.selectObj(-1);
        }
        else {
          // Create a new object
          this.isConstructing = true;
          let referenceObj = {};
          if (this.scene.objs[this.selectedObjIndex]) {
            if (this.scene.objs[this.selectedObjIndex].constructor.type == this.addingObjType) {
              referenceObj = this.scene.objs[this.selectedObjIndex].serialize();
            }
          }
          this.scene.pushObj(new sceneObjs[this.addingObjType](this.scene, referenceObj));

          const ret = this.scene.objs[this.scene.objs.length - 1].onConstructMouseDown(new Mouse(mousePos_nogrid, this.scene, this.lastDeviceIsTouch));
          if (ret && ret.isDone) {
            this.isConstructing = false;
          }
          this.selectObj(this.scene.objs.length - 1);
          this.simulator.updateSimulation(!this.scene.objs[this.scene.objs.length - 1].constructor.isOptical, true);
        }
      }
    }
  }

  /**
   * Handle the equivalent of the mousemove event on the canvas, which can be triggered by both mouse and single touch.
   * @param {MouseEvent} e - The event.
   */
  onCanvasMouseMove(e) {
    if (e.changedTouches) {
      var et = e.changedTouches[0];
    } else {
      var et = e;
    }
    
    // Get raw coordinates first
    const rawX = (et.pageX - e.target.offsetLeft - this.scene.origin.x) / this.scene.scale;
    const rawY = (et.pageY - e.target.offsetTop - this.scene.origin.y) / this.scene.scale;

    if (this.lastMousePos) {
      // Calculate the distance moved
      const distanceSquared = geometry.distanceSquared(this.lastMousePos, geometry.point(rawX, rawY));
      if (distanceSquared < (this.minimalDragLength * this.minimalDragLength) / (this.scene.scale * this.scene.scale)) {
        return; // Do not proceed if the drag is less than the threshold
      }
      this.lastMousePos = null;
    }
    
    // Truncate to binary fractions
    const truncX = this.truncateToBinaryFraction(rawX, this.scene.scale);
    const truncY = this.truncateToBinaryFraction(rawY, this.scene.scale);
    
    var mousePos_nogrid = geometry.point(truncX, truncY);
    var mousePos2;
    if (this.scene.snapToGrid && !(e.altKey && !this.isConstructing)) {
      mousePos2 = geometry.point(
        Math.round(((et.pageX - e.target.offsetLeft - this.scene.origin.x) / this.scene.scale) / this.scene.gridSize) * this.scene.gridSize,
        Math.round(((et.pageY - e.target.offsetTop - this.scene.origin.y) / this.scene.scale) / this.scene.gridSize) * this.scene.gridSize
      );
    }
    else {
      mousePos2 = mousePos_nogrid;
    }

    this.pendingControlPointSelection = false;
    this.pendingObjectSelection = false;

    const isCreatingHandle = this.scene.objs.length > 0 && 
                          this.scene.objs[0].constructor.type === "Handle" && 
                          this.scene.objs[0].notDone;

    

    if (!this.isConstructing && this.draggingObjIndex == -1 && !this.scene.lockObjs) {
      // highlight object under mousePos cursor
      var ret = this.selectionSearch(mousePos_nogrid)[0];
      //console.log(mousePos_nogrid);
      if (this.hoveredObjIndex != ret.targetObjIndex) {
        this.hoveredObjIndex = ret.targetObjIndex;
        this.simulator.updateSimulation(true, true);
      }
      if (ret.dragContext) {
        if (ret.dragContext.cursor) {
          this.canvas.style.cursor = ret.dragContext.cursor;
        } else if (ret.dragContext.targetPoint || ret.dragContext.targetPoint_) {
          this.canvas.style.cursor = 'pointer';
        } else if (ret.dragContext.part == 0) {
          this.canvas.style.cursor = 'move';
        } else {
          this.canvas.style.cursor = '';
        }
      } else if (this.scene.mode == 'observer' && geometry.distanceSquared(this.mousePos, this.scene.observer.c) < this.scene.observer.r * this.scene.observer.r) {
        this.canvas.style.cursor = 'pointer';
      } else if (isCreatingHandle) {
        if (!e.ctrlKey) {
          // When creating a handle and already released ctrlKey, use alias cursor to move the handle to indicate that the user is going to place the handle
          this.canvas.style.cursor = 'alias';
          if (mousePos2) {
            this.scene.objs[0].p1 = mousePos2;
            this.simulator.updateSimulation(true, true);
          }
        } else {
          // If the user hold the ctrlKey again, remove the handle to indicate that they are still selecting the things to be bound, and not ready to choose the handle position yet.
          this.canvas.style.cursor = '';
          if (this.scene.objs[0].p1) {  
            this.scene.objs[0].p1 = null;
            this.simulator.updateSimulation(true, true);
          }
        }
      } else {
        this.canvas.style.cursor = '';
      }
    }

    if (mousePos2.x == this.mousePos.x && mousePos2.y == this.mousePos.y) {
      return;
    }
    this.mousePos = mousePos2;

    this.emit('mouseCoordinateChange', { mousePos: this.mousePos });


    if (this.isConstructing) {
      // highlight object being constructed
      this.hoveredObjIndex = this.scene.objs.length - 1;

      // If some object is being created, pass the action to it
      const ret = this.scene.objs[this.scene.objs.length - 1].onConstructMouseMove(new Mouse(this.mousePos, this.scene, this.lastDeviceIsTouch), e.ctrlKey, e.shiftKey);
      if (ret && ret.isDone) {
        this.isConstructing = false;
      }
      if (ret && ret.requiresObjBarUpdate) {
        this.selectObj(this.selectedObjIndex);
      }
      this.simulator.updateSimulation(!this.scene.objs[this.scene.objs.length - 1].constructor.isOptical, true);
    }
    else {
      if (this.draggingObjIndex == -4) {
        if (e.shiftKey) {
          var mousePos_snapped = (new Mouse(this.mousePos, this.scene, this.lastDeviceIsTouch)).getPosSnappedToDirection(this.dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], this.dragContext.snapContext);
        }
        else {
          var mousePos_snapped = this.mousePos;
          this.dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
        }

        var mouseDiffX = (mousePos_snapped.x - this.dragContext.mousePos1.x); // The X difference between the mouse position now and at the previous moment
        var mouseDiffY = (mousePos_snapped.y - this.dragContext.mousePos1.y); // The Y difference between the mouse position now and at the previous moment

        this.scene.observer.c.x += mouseDiffX;
        this.scene.observer.c.y += mouseDiffY;

        // Update the mouse position
        this.dragContext.mousePos1 = mousePos_snapped;
        this.simulator.updateSimulation(false, true);
      }

      if (this.draggingObjIndex >= 0) {
        // Here the mouse is dragging an object

        this.scene.objs[this.draggingObjIndex].onDrag(new Mouse(mousePos_nogrid, this.scene, this.lastDeviceIsTouch, e.altKey * 1), this.dragContext, e.ctrlKey, e.shiftKey);
        // If dragging an entire object, then when Ctrl is hold, clone the object
        if (this.dragContext.part == 0) {
          if (e.ctrlKey && !this.dragContext.hasDuplicated) {

            this.scene.pushObj(new sceneObjs[this.scene.objs[this.draggingObjIndex].constructor.type](this.scene, this.dragContext.originalObj));
            this.dragContext.hasDuplicated = true;
          }
          if (!e.ctrlKey && this.dragContext.hasDuplicated) {
            this.scene.objs.length--;
            this.dragContext.hasDuplicated = false;
          }
        }

        this.simulator.updateSimulation(!this.scene.objs[this.draggingObjIndex].constructor.isOptical, true);

        if (this.dragContext.requiresObjBarUpdate) {
          this.selectObj(this.selectedObjIndex);
        }
      }

      if (this.draggingObjIndex == -3 && this.dragContext.mousePos1) {
        // Move the entire scene
        // Here mousePos is the currect mouse position, dragContext.mousePos1 is the mouse position at the previous moment

        var mouseDiffX = (this.mousePos.x - this.dragContext.mousePos1.x); // The X difference between the mouse position now and at the previous moment
        var mouseDiffY = (this.mousePos.y - this.dragContext.mousePos1.y); // The Y difference between the mouse position now and at the previous moment
        this.scene.origin.x = mouseDiffX * this.scene.scale + this.dragContext.mousePos2.x;
        this.scene.origin.y = mouseDiffY * this.scene.scale + this.dragContext.mousePos2.y;
        this.simulator.updateSimulation();
      }


    }
  }

  /**
   * Truncates a number to the nearest binary fraction while ensuring the error is less than 1 pixel.
   * @param {number} value - The value to truncate
   * @param {number} scale - The scale factor (pixels per unit)
   * @returns {number} The truncated value
   */
  truncateToBinaryFraction(value, scale) {
    // Find the smallest binary fraction that keeps error < 1 pixel
    const minError = 1 / scale;
    let step = 1;
    while (step > minError) {
      step /= 2;
    }
    return Math.round(value / step) * step;
  }

  /**
   * Handle the equivalent of the mouseup event on the canvas, which can be triggered by both mouse and single touch.
   * @param {MouseEvent} e - The event.
   */
  onCanvasMouseUp(e) {
    if (e.changedTouches) {
      var et = e.changedTouches[0];
    } else {
      var et = e;
    }

    // Get raw coordinates first
    const rawX = (et.pageX - e.target.offsetLeft - this.scene.origin.x) / this.scene.scale;
    const rawY = (et.pageY - e.target.offsetTop - this.scene.origin.y) / this.scene.scale;
    
    // Truncate to binary fractions
    const truncX = this.truncateToBinaryFraction(rawX, this.scene.scale);
    const truncY = this.truncateToBinaryFraction(rawY, this.scene.scale);
    
    var mousePos_nogrid = geometry.point(truncX, truncY);
    var mousePos2;
    if (this.scene.snapToGrid && !(e.altKey && !this.isConstructing)) {
      mousePos2 = geometry.point(
        Math.round(((et.pageX - e.target.offsetLeft - this.scene.origin.x) / this.scene.scale) / this.scene.gridSize) * this.scene.gridSize,
        Math.round(((et.pageY - e.target.offsetTop - this.scene.origin.y) / this.scene.scale) / this.scene.gridSize) * this.scene.gridSize
      );
    }
    else {
      mousePos2 = mousePos_nogrid;
    }

    if (this.isConstructing) {
      if ((e.which && e.which == 1) || (e.changedTouches)) {
        // If an object is being created, pass the action to it
        const ret = this.scene.objs[this.scene.objs.length - 1].onConstructMouseUp(new Mouse(mousePos_nogrid, this.scene, this.lastDeviceIsTouch), e.ctrlKey, e.shiftKey);
        if (ret && ret.isDone) {
          this.isConstructing = false;
        }
        if (ret && ret.requiresObjBarUpdate) {
          this.selectObj(this.selectedObjIndex);
        }
        this.simulator.updateSimulation(!this.scene.objs[this.scene.objs.length - 1].constructor.isOptical, true);
        if (!this.isConstructing) {
          // The object says the contruction is done
          this.onActionComplete();
          if (this.scene.lockObjs) {
            this.hoveredObjIndex = -1;
            this.simulator.updateSimulation(true, true);
          }
        }
      }
    }
    else {
      if (this.pendingControlPointSelection) {
        this.pendingControlPointSelection = false;
        this.addControlPointsForHandle(this.pendingControlPoints);
        this.hoveredObjIndex = -1;
        this.simulator.updateSimulation(true, true);
      }
      if (this.pendingObjectSelection) {
        this.pendingObjectSelection = false;
        this.addObjectForHandle(this.pendingObjectIndex);
        this.hoveredObjIndex = -1;
        this.simulator.updateSimulation(true, true);
      }
      if (e.which && e.which == 3 && this.draggingObjIndex == -3 && this.mousePos.x == this.dragContext.mousePos0.x && this.mousePos.y == this.dragContext.mousePos0.y) {
        this.draggingObjIndex = -1;
        this.dragContext = {};
        this.onCanvasDblClick(e);
        return;
      }
      this.onActionComplete();
      this.draggingObjIndex = -1;
      this.dragContext = {};
    }

  }


  /**
   * Handle the equivalent of the dblclick event on the canvas.
   * @param {MouseEvent} e - The event.
   */
  onCanvasDblClick(e) {
    //console.log("dblclick");
    // Get raw coordinates first
    const rawX = (e.pageX - e.target.offsetLeft - this.scene.origin.x) / this.scene.scale;
    const rawY = (e.pageY - e.target.offsetTop - this.scene.origin.y) / this.scene.scale;
    
    // Truncate to binary fractions
    const truncX = this.truncateToBinaryFraction(rawX, this.scene.scale);
    const truncY = this.truncateToBinaryFraction(rawY, this.scene.scale);
    
    this.mousePos = geometry.point(truncX, truncY);
    if (this.isConstructing) {
    }
    else if (this.lastMousePos && new Mouse(this.mousePos, this.scene, this.lastDeviceIsTouch).isOnPoint(this.lastMousePos)) {
      this.dragContext = {};

      if (this.scene.mode == 'observer') {
        if (geometry.distanceSquared(this.mousePos, this.scene.observer.c) < this.scene.observer.r * this.scene.observer.r) {

          // The mousePos clicked the observer
          this.positioningObjIndex = -4;
          this.dragContext = {};
          this.dragContext.targetPoint = geometry.point(this.scene.observer.c.x, this.scene.observer.c.y);
          this.dragContext.snapContext = {};

          this.emit('positioningStart', { dragContext: this.dragContext });

          return;
        }
      }

      var ret = this.selectionSearch(this.mousePos)[0];
      if (ret.targetObjIndex != -1 && ret.dragContext.targetPoint) {
        this.selectObj(ret.targetObjIndex);
        this.dragContext = ret.dragContext;
        this.dragContext.originalObj = this.scene.objs[ret.targetObjIndex].serialize(); // Store the obj status before dragging

        this.dragContext.hasDuplicated = false;
        this.positioningObjIndex = ret.targetObjIndex;

        this.emit('positioningStart', { dragContext: this.dragContext });

      }
    }

  }

  /**
   * search for best object to select at mouse position
   * @param {Point} mousePos_nogrid - The mouse position in the scene (without snapping to grid).
   * @returns {SelectionSearchResult[]} - The search results.
   */
  selectionSearch(mousePos_nogrid) {
    var i;
    var click_lensq = Infinity;
    var click_lensq_temp;
    var targetObjIndex = -1;
    var targetIsPoint = false;
    var dragContext;
    var targetIsSelected = false;
    var results = [];

    for (var i = 0; i < this.scene.objs.length; i++) {
      if (typeof this.scene.objs[i] != 'undefined') {
        let dragContext_ = this.scene.objs[i].checkMouseOver(new Mouse(mousePos_nogrid, this.scene, this.lastDeviceIsTouch));
        if (dragContext_) {
          // the mouse is over the object

          if (dragContext_.targetPoint || dragContext_.targetPoint_) {
            // The mousePos clicked a point
            if (!targetIsPoint) {
              targetIsPoint = true; // If the mouse can click a point, then it must click a point
              results = [];
            }
            var click_lensq_temp = geometry.distanceSquared(mousePos_nogrid, (dragContext_.targetPoint || dragContext_.targetPoint_));
            if (click_lensq_temp <= click_lensq || targetObjIndex == this.selectedObjIndex) {
              // In case of clicking a point, choose the one nearest to the mouse
              // But if the object is the selected object, the points from this object have the highest priority.
              targetObjIndex = i;
              click_lensq = click_lensq_temp;
              dragContext = dragContext_;
              if (!targetIsSelected) {
                results.unshift({ dragContext: dragContext, targetObjIndex: targetObjIndex });
              } else {
                results.push({ dragContext: dragContext, targetObjIndex: targetObjIndex });
              }
              if (targetObjIndex == this.selectedObjIndex) targetIsSelected = true;
            }
          } else if (!targetIsPoint) {
            // If not clicking a point, and until now not clicking any point
            targetObjIndex = i; // If clicking non-point, choose the most newly created one
            dragContext = dragContext_;
            results.unshift({ dragContext: dragContext, targetObjIndex: targetObjIndex });
          }
        }
      }
    }
    if (results.length == 0) {
      results.push({ targetObjIndex: -1 });
    }
    return results;
  }

  /**
   * Add control points for a handle (create a new handle or add to the currently consturcting handle).
   * @param {ControlPoint[]} controlPoints - The control points to add.
   */
  addControlPointsForHandle(controlPoints) {
    if (!(this.scene.objs[0].constructor.type == "Handle" && this.scene.objs[0].notDone)) {
      this.scene.unshiftObj(new sceneObjs["Handle"](this.scene, { notDone: true }));
      if (this.selectedObjIndex >= 0) this.selectedObjIndex++;
      for (var i in controlPoints) {
        controlPoints[i].targetObjIndex++;
      }
    }
    for (var i in controlPoints) {
      this.scene.objs[0].addControlPoint(controlPoints[i]);
    }
    this.simulator.updateSimulation(true, true);
  }

  /**
   * Add an entire object to a handle (create a new handle or add to the currently constructing handle).
   * @param {number} objIndex - The index of the object to bind to the handle.
   */
  addObjectForHandle(objIndex) {
    // Create a new handle if one isn't already being constructed
    if (!(this.scene.objs[0].constructor.type == "Handle" && this.scene.objs[0].notDone)) {
      this.scene.unshiftObj(new sceneObjs["Handle"](this.scene, { notDone: true }));
      if (this.selectedObjIndex >= 0) this.selectedObjIndex++;
      // Adjust objIndex since we added an object at the beginning of the array
      objIndex++;
    }
    
    // Add the object to the handle
    this.scene.objs[0].addObject(objIndex);
    this.simulator.updateSimulation(true, true);
  }

  /**
   * Finish the creation of a handle.
   * @param {Point} point - The point for the position of the handle.
   */
  finishHandleCreation(point) {
    this.scene.objs[0].finishHandle(point);
    this.simulator.updateSimulation(true, true);
    this.selectObj(0);
  }

  /**
   * Select an object.
   * @param {number} index - The index of the object to select.
   */
  selectObj(index) {
    // If a handle is being constructed, always unselect.
    // This is to avoid giving the user a false impression that one could adjust properties in the object bar to apply to all selected objects (which may be the case in the future)
    if (this.scene.objs[0] && this.scene.objs[0].constructor.type == "Handle" && this.scene.objs[0].notDone) {
      this.selectedObjIndex = -1;
      this.emit('selectionChange', { oldIndex: this.selectedObjIndex, newIndex: -1 });
      return;
    }

    if (index < 0 || index >= this.scene.objs.length) {
      // If this object does not exist
      this.emit('selectionChange', { oldIndex: this.selectedObjIndex, newIndex: -1 });
      this.selectedObjIndex = -1;
      
      return;
    }
    this.emit('selectionChange', { oldIndex: this.selectedObjIndex, newIndex: index });
    this.selectedObjIndex = index;
  }

  /**
   * Confirm the positioning in the coordinate box.
   * @param {number} x - The x-coordinate.
   * @param {number} y - The y-coordinate.
   * @param {boolean} ctrl - Whether the Ctrl key is pressed.
   * @param {boolean} shift - Whether the Shift key is pressed.
   */
  confirmPositioning(x, y, ctrl, shift) {


    if (this.positioningObjIndex == -4) {
      // Observer
      this.scene.observer.c.x = x;
      this.scene.observer.c.y = y;
      this.simulator.updateSimulation(false, true);
    }
    else {
      // Object
      this.scene.objs[this.positioningObjIndex].onDrag(new Mouse(geometry.point(x, y), this.scene, this.lastDeviceIsTouch, 2), this.dragContext, ctrl, shift);
      this.simulator.updateSimulation(!this.scene.objs[this.positioningObjIndex].constructor.isOptical, true);
    }

    this.onActionComplete();

    this.endPositioning();
  }

  /**
   * End the positioning in the coordinate box.
   */
  endPositioning() {
    this.emit('positioningEnd');
    this.positioningObjIndex = -1;
    this.dragContext = {};
  }

  /**
   * Remove an object.
   * @param {number} index - The index of the object to remove.
   */
  removeObj(index) {
    this.isConstructing = false;
    this.scene.removeObj(index);

    this.selectedObjIndex--;
    this.selectObj(this.selectedObjIndex);
  }

  /**
   * Set the scale of the scene with respect to the center point of the canvas.
   * @param {number} value - The new scale.
   */
  setScale(value) {
    this.setScaleWithCenter(value, this.canvas.width / this.scene.scale / 2, this.canvas.height / this.scene.scale / 2);
  }
  
  /**
   * Set the scale of the scene while keeping a given center point fixed.
   * @param {number} value - The new scale factor.
   * @param {number} centerX - The x-coordinate of the center point.
   * @param {number} centerY - The y-coordinate of the center point.
   */
  setScaleWithCenter(value, centerX, centerY) {
    this.scene.setScaleWithCenter(value, centerX, centerY);
    this.emit('scaleChange');
    
    this.simulator.updateSimulation();
  }

  /**
   * Load a JSON string of the scene to the editor.
   * @param {string} json - The JSON string of the scene.
   */
  loadJSON(json) {
    const self = this;
    this.scene.setViewportSize(this.canvas.width / this.simulator.dpr, this.canvas.height / this.simulator.dpr);
    this.scene.loadJSON(json, function (needFullUpdate, completed) {
      self.emit('sceneLoaded', { needFullUpdate: needFullUpdate, completed: completed });
      if (needFullUpdate) {
        self.simulator.updateSimulation();
      } else {
        // Partial update (e.g. when the background image is loaded)
        setTimeout(function () {
          self.simulator.updateSimulation(true, true);
        }, 1);
      }
    });
    
    this.selectObj(-1);
    // this.lastActionJson = json;
    this.simulator.updateSimulation();
  }

  /**
   * Called when a change (action) is completed. This function will update the undo data, sync the JSON editor, etc.
   * @param {boolean} fromJsonEditor - Whether the action is from the JSON editor.
   */
  onActionComplete(fromJsonEditor = false) {
    if (this.scene.error) {
      return;
    }

    const newJSON = this.scene.toJSON();
    const oldJSON = this.lastActionJson;
    this.lastActionJson = newJSON;
    this.emit('newAction', { newJSON: newJSON, oldJSON: oldJSON, fromJsonEditor: fromJsonEditor });

    this.emit('requestUpdateErrorAndWarning');
    this.requireDelayedValidation();

    if (new Date() - this.lastActionTime > Editor.UNDO_INTERVAL && newJSON != oldJSON) {
      this.undoIndex = (this.undoIndex + 1) % Editor.UNDO_LIMIT;
      this.emit('newUndoPoint');
      
      this.undoUBound = this.undoIndex;
      if (this.undoUBound == this.undoLBound) {
        // The limit of undo is reached
        this.undoLBound = (this.undoLBound + 1) % Editor.UNDO_LIMIT;
      }
    }

    this.undoData[this.undoIndex] = this.lastActionJson;

    this.lastActionTime = new Date();
  }

  /**
   * Undo the last edit.
   */
  undo() {
    if (this.isConstructing) {
      const constructingObjType = this.scene.objs[this.scene.objs.length - 1].constructor.type;
      const ret = this.scene.objs[this.scene.objs.length - 1].onConstructUndo();
      if (ret && ret.isCancelled) {
        this.isConstructing = false;
        this.scene.objs.length--;
        this.selectObj(-1);
      }
      this.simulator.updateSimulation(!sceneObjs[constructingObjType].isOptical, true);
      return;
    }
    if (this.positioningObjIndex != -1) {
      // If the user is entering coordinates when clicked the undo, then only stop the coordinates entering rather than do the real undo
      this.endPositioning();
      return;
    }
    if (this.undoIndex == this.undoLBound)
      // The lower bound of undo data is reached
      return;
    this.undoIndex = (this.undoIndex + (Editor.UNDO_LIMIT - 1)) % Editor.UNDO_LIMIT;
    this.loadJSON(this.undoData[this.undoIndex]);
    this.lastActionJson = this.undoData[this.undoIndex];
    this.emit('undo');

    this.requireDelayedValidation();
  }

  /**
   * Redo the last edit.
   */
  redo() {
    this.isConstructing = false;
    this.endPositioning();
    if (this.undoIndex == this.undoUBound)
      // The lower bound of undo data is reached
      return;
    this.undoIndex = (this.undoIndex + 1) % Editor.UNDO_LIMIT;
    this.loadJSON(this.undoData[this.undoIndex]);
    this.lastActionJson = this.undoData[this.undoIndex];
    this.emit('redo');

    this.requireDelayedValidation();
  }

  /**
   * Enter the crop mode that allows the user to crop the scene for exporting.
   */
  enterCropMode() {
    this.isInCropMode = true;

    // Search objs for existing cropBox
    var cropBoxIndex = -1;
    for (var i = 0; i < this.scene.objs.length; i++) {
      if (this.scene.objs[i].constructor.type == 'CropBox') {
        cropBoxIndex = i;
        break;
      }
    }
    if (cropBoxIndex == -1) {
      // Create a new cropBox
      this.scene.pushObj(new sceneObjs['CropBox'](this.scene, {
        p1: geometry.point((this.canvas.width * 0.2 / this.simulator.dpr - this.scene.origin.x) / this.scene.scale, ((120 + (this.canvas.height - 120) * 0.2) / this.simulator.dpr - this.scene.origin.y) / this.scene.scale),
        p4: geometry.point((this.canvas.width * 0.8 / this.simulator.dpr - this.scene.origin.x) / this.scene.scale, ((120 + (this.canvas.height - 120) * 0.8) / this.simulator.dpr - this.scene.origin.y) / this.scene.scale),
      }));
      cropBoxIndex = this.scene.objs.length - 1;
    }

    this.selectObj(cropBoxIndex);

    this.simulator.updateSimulation(true, true);
  }

  /**
   * Confirm the crop box and export the cropped scene.
   * @param {CropBox} cropBox - The crop box.
   */
  confirmCrop(cropBox) {
    if (cropBox.format == 'svg') {
      this.exportSVG(cropBox);
    } else {
      this.exportImage(cropBox);
    }
    this.isInCropMode = false;
    this.selectObj(-1);
    this.simulator.updateSimulation(true, true);
  }

  /**
   * Exit the crop mode without exporting the cropped scene.
   */
  cancelCrop() {
    this.isInCropMode = false;
    this.selectObj(-1);
    this.simulator.updateSimulation(true, true);
  }

  /**
   * Export the cropped scene as an SVG file.
   * @param {CropBox} cropBox - The crop box.
   */
  exportSVG(cropBox) {
    const self = this;
    const exportingScene = new Scene();
    exportingScene.backgroundImage = this.scene.backgroundImage;
    exportingScene.loadJSON(this.scene.toJSON(), function (needFullUpdate, completed) {
      if (!completed) {
        return;
      }

      exportingScene.scale = 1;
      exportingScene.origin = { x: -cropBox.p1.x * exportingScene.scale, y: -cropBox.p1.y * exportingScene.scale };

      const imageWidth = cropBox.p4.x - cropBox.p1.x;
      const imageHeight = cropBox.p4.y - cropBox.p1.y;

      const ctxSVG = new C2S(imageWidth, imageHeight);

      if (!cropBox.transparent) {
        ctxSVG.fillStyle = `rgb(${Math.round(exportingScene.theme.background.color.r * 255)}, ${Math.round(exportingScene.theme.background.color.g * 255)}, ${Math.round(exportingScene.theme.background.color.b * 255)})`;
        ctxSVG.fillRect(0, 0, imageWidth, imageHeight);
      }

      const exportSimulator = new Simulator(exportingScene, ctxSVG, null, null, null, null, false, cropBox.rayCountLimit || 1e7);

      function onSimulationEnd() {
        const blob = new Blob([ctxSVG.getSerializedSvg()], { type: 'image/svg+xml' });
        saveAs(blob, (self.scene.name || "export") + ".svg");
      }

      exportSimulator.on('simulationComplete', onSimulationEnd);
      exportSimulator.on('simulationStop', onSimulationEnd);

      exportSimulator.updateSimulation();
    });
  }

  /**
   * Export the cropped scene as a PNG image.
   * @param {CropBox} cropBox - The crop box.
   */
  exportImage(cropBox) {
    const self = this;
    const exportingScene = new Scene();
    exportingScene.backgroundImage = this.scene.backgroundImage;
    exportingScene.loadJSON(this.scene.toJSON(), function (needFullUpdate, completed) {
      if (!completed) {
        return;
      }

      exportingScene.scale = cropBox.width / (cropBox.p4.x - cropBox.p1.x);
      exportingScene.origin = { x: -cropBox.p1.x * exportingScene.scale, y: -cropBox.p1.y * exportingScene.scale };

      if (cropBox.transparent && exportingScene.theme.background.color.r == 0 && exportingScene.theme.background.color.g == 0 && exportingScene.theme.background.color.b == 0) {
        // Use a non-black background color so that some rendering (e.g. glass) will not assume the background is black.
        exportingScene.theme.background.color = { r: 0.01, g: 0.01, b: 0.01 };
      }

      const imageWidth = cropBox.width;
      const imageHeight = cropBox.width * (cropBox.p4.y - cropBox.p1.y) / (cropBox.p4.x - cropBox.p1.x);

      const canvases = [];
      const ctxs = [];
      for (let i = 0; i < 4; i++) {
        canvases.push(document.createElement('canvas'));
        ctxs.push(canvases[i].getContext('2d'));
        canvases[i].width = imageWidth;
        canvases[i].height = imageHeight;
      }



      let canvasGl = document.createElement('canvas');
      let gl = null;
      if (self.simulator.glMain) {
        canvasGl.width = imageWidth;
        canvasGl.height = imageHeight;

        const contextAttributes = {
          alpha: true,
          premultipliedAlpha: true,
          antialias: false,
        };
        gl = canvasGl.getContext('webgl', contextAttributes) || canvasGl.getContext('experimental-webgl', contextAttributes);
      }

      const exportSimulator = new Simulator(exportingScene, ctxs[0], ctxs[1], ctxs[2], ctxs[3], document.createElement('canvas').getContext('2d'), false, cropBox.rayCountLimit || 1e7, gl);

      function onSimulationEnd() {
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = imageWidth;
        finalCanvas.height = imageHeight;
        const finalCtx = finalCanvas.getContext('2d');

        if (!cropBox.transparent) {
          finalCtx.fillStyle = `rgb(${Math.round(exportingScene.theme.background.color.r * 255)}, ${Math.round(exportingScene.theme.background.color.g * 255)}, ${Math.round(exportingScene.theme.background.color.b * 255)})`;
          finalCtx.fillRect(0, 0, cropBox.width, cropBox.width * (cropBox.p4.y - cropBox.p1.y) / (cropBox.p4.x - cropBox.p1.x));
        }

        finalCtx.drawImage(canvases[1], 0, 0);
        finalCtx.drawImage(canvases[3], 0, 0);
        if (self.scene.colorMode == 'default') {
          finalCtx.drawImage(canvases[0], 0, 0);
        } else {
          finalCtx.drawImage(canvasGl, 0, 0);
        }
        finalCtx.drawImage(canvases[2], 0, 0);

        finalCanvas.toBlob(function (blob) {
          saveAs(blob, (self.scene.name || "export") + ".png");
        });
      }

      exportSimulator.on('simulationComplete', onSimulationEnd);
      exportSimulator.on('simulationStop', onSimulationEnd);

      exportSimulator.updateSimulation();
    });
  }

  /**
   * Require a delayed validation of the scene. The actual validation will be performed if the user is inactive for a while.
   */
  requireDelayedValidation() {
    if (this.scene.error) {
      return;
    }

    if (this.delayedValidationTimerId) {
      clearTimeout(this.delayedValidationTimerId);
    }

    const self = this;
    this.delayedValidationTimerId = setTimeout(function () {
      self.validateDelayed()
     }, this.scene.warning ? 500 : 5000);
  }

  /**
   * Perform the delayed validation of the scene. Called after the user has been inactive for a while.
   */
  validateDelayed() {
    this.scene.validateDelayed();
    this.emit('requestUpdateErrorAndWarning');
  }

  /**
   * Determines if an object should be highlighted in the scene.
   * @param {number} objIndex - The index of the object to check.
   * @returns {boolean} - Whether the object should be highlighted.
   */
  isObjHighlighted(objIndex) {
    // Check if a handle is being created (first object is a handle with notDone=true)
    const isCreatingHandle = this.scene.objs.length > 0 && 
                            this.scene.objs[0].constructor.type === "Handle" && 
                            this.scene.objs[0].notDone;
    
    // If we're creating a handle, highlight objects bound to it
    if (isCreatingHandle) {
      const handle = this.scene.objs[0];
      
      // Check if this object is directly bound to the handle
      if (handle.objIndices.includes(objIndex)) {
        return true;
      }
    }
    
    // If hoveredObjIndex is not valid, check only the handle binding status above
    if (!this.scene.objs[this.hoveredObjIndex]) {
      return false;
    }
    
    // If the hovered object is a handle, highlight both the handle and any bound objects
    if (this.scene.objs[this.hoveredObjIndex].constructor.type === "Handle") {
      return this.scene.objs[this.hoveredObjIndex].objIndices.includes(objIndex) || this.hoveredObjIndex === objIndex;
    } else {
      // Otherwise, only highlight the hovered object itself
      return this.hoveredObjIndex === objIndex;
    }
  }

  /**
   * Select all objects in the scene by creating a handle that binds to all objects.
   * If a handle is already being created, add all objects to it.
   */
  selectAll() {
    // Skip if there are no objects
    if (this.scene.objs.length === 0) {
      return;
    }

    // Create a new handle if one isn't already being constructed
    let handleIndex = -1;
    if (this.scene.objs.length > 0 && this.scene.objs[0].constructor.type === "Handle" && this.scene.objs[0].notDone) {
      handleIndex = 0;
    } else {
      this.scene.unshiftObj(new sceneObjs["Handle"](this.scene, { notDone: true }));
      if (this.selectedObjIndex >= 0) this.selectedObjIndex++;
      this.selectObj(-1);
      handleIndex = 0;
      // Adjust selected object index since we added an object at the beginning of the array
      if (this.selectedObjIndex >= 0) {
        this.selectedObjIndex++;
      }
    }

    // Clear existing objIndices to avoid duplicates
    this.scene.objs[handleIndex].objIndices = [];

    // Add all objects to the handle except for itself or other handles
    for (let i = 0; i < this.scene.objs.length; i++) {
      // Skip the handle itself or other handles
      if (this.scene.objs[i].constructor.type !== "Handle") {
        this.scene.objs[handleIndex].addObject(i);
      }
    }

    // The handle remains in notDone state so user can position it
    this.simulator.updateSimulation(true, true);
  }
}

export default Editor;