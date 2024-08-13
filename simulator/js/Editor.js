class Editor {

  /**
   * The limit of the undo data.
   */
  static UNDO_LIMIT = 20;
  
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

  constructor(scene, canvas, objBar, xyBox) {
    /** @property {Scene} scene - The scene to be edited and simulated. */
    this.scene = scene;

    this.scene.editor = this;

    /** @property {HTMLCanvasElement} canvas - The top-layered canvas for user interaction. */
    this.canvas = canvas;

    /** @property {ObjBar} objBar - The object bar for editing object properties. */
    this.objBar = objBar;

    /** @property {HTMLInputElement} xyBox - The input box for entering coordinates. */
    this.xyBox = xyBox;

    /** @property {boolean} lastDeviceIsTouch - Whether the last interaction with `canvas` is done by a touch device. */
    this.lastDeviceIsTouch = false;

    /** @property {Point} mousePos - The position of the mouse in the scene. */
    this.mousePos = geometry.point(0, 0);

    /** @property {Point} lastMousePos - The position of the mouse in the scene when the last mousedown event is triggered. */
    this.lastMousePos = geometry.point(0, 0);

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
    this.undoData = [];

    /** @property {number} undoIndex - The index of the undo data currently displayed. */
    this.undoIndex = 0;

    /** @property {number} undoLBound - The upper bound of the undo data index. */
    this.undoLBound = 0;

    /** @property {number} undoUBound - The lower bound of the undo data index. */
    this.undoUBound = 0;

    /** @property {boolean} pendingControlPointSelection - Whether a user has clicked on a control point with the Ctrl key held down, and the editor is waiting to see if the user is going to select the control point for a handle. */
    this.pendingControlPointSelection = false;

    /** @property {ControlPoint[]} pendingControlPoints - The control points to be selected for a handle when the user clicks on a control point with the Ctrl key held down. */
    this.pendingControlPoints = [];

    /** @property {string} addingModuleName - The name of the module that will be added when the user clicks on the canvas if `addingObjType` is 'ModuleObj'. */
    this.addingModuleName = '';

    /** @property {object} eventListeners - The event listeners of the editor. */
    this.eventListeners = {};

    this.initCanvas();
  }

  /**
   * Initialize the canvas event listeners.
   */
  initCanvas() {

    let lastTouchTime = -1;

    const self = this;

    this.canvas.addEventListener('mousedown', function (e) {
      error = null;
      if (self.lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
      self.lastDeviceIsTouch = false;

      if (self.scene.error) {
        self.canvas.style.cursor = 'not-allowed';
        return;
      }

      self.canvas.focus();
      self.handleCanvasMouseDown(e);
    });

    this.canvas.addEventListener('mousemove', function (e) {
      //console.log("mousemove");
      if (self.lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
      self.lastDeviceIsTouch = false;

      if (self.scene.error) {
        self.canvas.style.cursor = 'not-allowed';
        return;
      }

      self.handleCanvasMouseMove(e);
    });

    this.canvas.addEventListener('mouseup', function (e) {
      if (self.lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
      self.lastDeviceIsTouch = false;

      if (self.scene.error) {
        self.canvas.style.cursor = 'not-allowed';
        return;
      }

      //console.log("mouseup");
      self.handleCanvasMouseUp(e);
    });

    this.canvas.addEventListener('mouseout', function (e) {
      if (self.lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
      self.lastDeviceIsTouch = false;
      if (self.draggingObjIndex != -1) {
        self.handleCanvasMouseUp(e);
      }
      self.hoveredObjIndex = -1;
      document.getElementById('mouseCoordinates').innerHTML = "";
      simulator.updateSimulation(true, true)
    });


    let lastZoomTime = 0;
    let zoomThrottle = 100; // 100 ms between zooms
    
    this.canvas.addEventListener('wheel', function(e) {
      var now = Date.now();
      if (now - lastZoomTime < zoomThrottle) return; // Too soon since the last zoom
      lastZoomTime = now;
    
      // cross-browser wheel delta
      var e = window.event || e; // old IE support
      var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
      var d = self.scene.scale * self.scene.lengthScale;
      if (delta < 0) {
        d = self.scene.scale * self.scene.lengthScale - 0.25;
      } else if (delta > 0) {
        d = self.scene.scale * self.scene.lengthScale + 0.25;
      }
      d = Math.max(0.25, Math.min(5.00, d)) * 100;
      setScaleWithCenter(d / self.scene.lengthScale / 100, (e.pageX - e.target.offsetLeft) / self.scene.scale, (e.pageY - e.target.offsetTop) / self.scene.scale);
      JSONOutput();
      //window.toolBarViewModel.zoom.value(d);
      self.handleCanvasMouseMove(e);
      return false;
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
          self.handleCanvasMouseUp(e);
          self.undo();
        } else {
          self.handleCanvasMouseUp(e);
        }
      } else {
        //console.log("touchstart");
        self.canvas.focus();
        self.handleCanvasMouseMove(e);
        self.handleCanvasMouseDown(e);
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
        setScaleWithCenter(newScale, (x - e.target.offsetLeft) / self.scene.scale, (y - e.target.offsetTop) / self.scene.scale);

        // Update last values
        lastX = x;
        lastY = y;

      } else {
        self.handleCanvasMouseMove(e);
      }
    });

    this.canvas.addEventListener('touchend', function (e) {
      if (self.scene.error) return;
      self.lastDeviceIsTouch = true;
      lastTouchTime = Date.now();
      //console.log("touchend");
      if (e.touches.length < 2) {
        initialPinchDistance = null;
        self.handleCanvasMouseUp(e);
        JSONOutput();
      }
    });

    this.canvas.addEventListener('touchcancel', function (e) {
      if (self.scene.error) return;
      self.lastDeviceIsTouch = true;
      lastTouchTime = Date.now();
      //console.log("touchcancel");
      initialPinchDistance = null;
      if (self.isConstructing || self.draggingObjIndex >= 0) {
        self.handleCanvasMouseUp(e);
        self.undo();
      } else {
        self.handleCanvasMouseUp(e);
      }
    });

    this.canvas.addEventListener('dblclick', function (e) {
      if (self.scene.error) return;
      self.handleCanvasDblClick(e);
    });
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
   * Handle the equivalent of the mousedown event on the canvas, which can be triggered by both mouse and single touch.
   * @param {MouseEvent} e - The event.
   */
  handleCanvasMouseDown(e) {
    if (e.changedTouches) {
      var et = e.changedTouches[0];
    } else {
      var et = e;
    }
    var mousePos_nogrid = geometry.point((et.pageX - e.target.offsetLeft - this.scene.origin.x) / this.scene.scale, (et.pageY - e.target.offsetTop - this.scene.origin.y) / this.scene.scale); // The real position of the mouse
    this.lastMousePos = mousePos_nogrid;
    if (this.positioningObjIndex != -1) {
      this.confirmPositioning(e.ctrlKey, e.shiftKey);
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
        simulator.updateSimulation(!this.scene.objs[this.scene.objs.length - 1].constructor.isOptical, true);
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
            // User is creating a handle
            this.removeObj(0);
            ret.targetObjIndex--;
          }
          this.selectObj(ret.targetObjIndex);
          this.dragContext = ret.dragContext;
          this.dragContext.originalObj = this.scene.objs[ret.targetObjIndex].serialize(); // Store the obj status before dragging
          this.dragContext.hasDuplicated = false;
          this.draggingObjIndex = ret.targetObjIndex;
          if (e.ctrlKey && this.dragContext.targetPoint) {
            this.pendingControlPointSelection = true;
            this.pendingControlPoints = rets;
          }
          return;
        }
      }
  
      if (this.draggingObjIndex == -1) {
        // The mousePos clicked the blank area
        if (this.scene.objs.length > 0 && this.scene.objs[0].constructor.type == "Handle" && this.scene.objs[0].notDone) {
          // User is creating a handle
          this.finishHandleCreation(this.mousePos);
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
          this.scene.pushObj(new objTypes[this.addingObjType](this.scene, referenceObj));
  
          const ret = this.scene.objs[this.scene.objs.length - 1].onConstructMouseDown(new Mouse(mousePos_nogrid, this.scene, this.lastDeviceIsTouch));
          if (ret && ret.isDone) {
            this.isConstructing = false;
          }
          this.selectObj(this.scene.objs.length - 1);
          simulator.updateSimulation(!this.scene.objs[this.scene.objs.length - 1].constructor.isOptical, true);
        }
      }
    }
  }

  /**
   * Handle the equivalent of the mousemove event on the canvas, which can be triggered by both mouse and single touch.
   * @param {MouseEvent} e - The event.
   */
  handleCanvasMouseMove(e) {

    this.pendingControlPointSelection = false;
    if (e.changedTouches) {
      var et = e.changedTouches[0];
    } else {
      var et = e;
    }
    var mousePos_nogrid = geometry.point((et.pageX - e.target.offsetLeft - this.scene.origin.x) / this.scene.scale, (et.pageY - e.target.offsetTop - this.scene.origin.y) / this.scene.scale); // The real position of the mouse
    var mousePos2;
    if (this.scene.snapToGrid && !(e.altKey && !this.isConstructing)) {
      mousePos2 = geometry.point(Math.round(((et.pageX - e.target.offsetLeft - this.scene.origin.x) / this.scene.scale) / this.scene.gridSize) * this.scene.gridSize, Math.round(((et.pageY - e.target.offsetTop - this.scene.origin.y) / this.scene.scale) / this.scene.gridSize) * this.scene.gridSize);
    }
    else {
      mousePos2 = mousePos_nogrid;
    }
  
    if (!this.isConstructing && this.draggingObjIndex == -1 && !this.scene.lockObjs) {
      // highlight object under mousePos cursor
      var ret = this.selectionSearch(mousePos_nogrid)[0];
      //console.log(mousePos_nogrid);
      if (this.hoveredObjIndex != ret.targetObjIndex) {
        this.hoveredObjIndex = ret.targetObjIndex;
        simulator.updateSimulation(true, true);
      }
      if (ret.dragContext) {
        if (ret.dragContext.cursor) {
          canvas.style.cursor = ret.dragContext.cursor;
        } else if (ret.dragContext.targetPoint || ret.dragContext.targetPoint_) {
          canvas.style.cursor = 'pointer';
        } else if (ret.dragContext.part == 0) {
          canvas.style.cursor = 'move';
        } else {
          canvas.style.cursor = '';
        }
      } else {
        if (this.scene.mode == 'observer' && geometry.distanceSquared(this.mousePos, this.scene.observer.c) < this.scene.observer.r * this.scene.observer.r) {
          canvas.style.cursor = 'pointer';
        } else {
          canvas.style.cursor = '';
        }
      }
    }
  
    if (mousePos2.x == this.mousePos.x && mousePos2.y == this.mousePos.y) {
      return;
    }
    this.mousePos = mousePos2;
  
  
    const mousePosDigits = Math.max(Math.round(Math.log10(this.scene.scale)), 0);
    document.getElementById('mouseCoordinates').innerHTML = getMsg('mouse_coordinates') + "(" + this.mousePos.x.toFixed(mousePosDigits) + ", " + this.mousePos.y.toFixed(mousePosDigits) + ")";

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
      simulator.updateSimulation(!this.scene.objs[this.scene.objs.length - 1].constructor.isOptical, true);
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
        simulator.updateSimulation(false, true);
      }
  
      if (this.draggingObjIndex >= 0) {
        // Here the mouse is dragging an object
  
        this.scene.objs[this.draggingObjIndex].onDrag(new Mouse(mousePos_nogrid, this.scene, this.lastDeviceIsTouch, e.altKey * 1), this.dragContext, e.ctrlKey, e.shiftKey);
        // If dragging an entire object, then when Ctrl is hold, clone the object
        if (this.dragContext.part == 0) {
          if (e.ctrlKey && !this.dragContext.hasDuplicated) {
  
            this.scene.pushObj(new objTypes[this.scene.objs[this.draggingObjIndex].constructor.type](this.scene, this.dragContext.originalObj));
            this.dragContext.hasDuplicated = true;
          }
          if (!e.ctrlKey && this.dragContext.hasDuplicated) {
            this.scene.objs.length--;
            this.dragContext.hasDuplicated = false;
          }
        }
  
        simulator.updateSimulation(!this.scene.objs[this.draggingObjIndex].constructor.isOptical, true);
  
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
        simulator.updateSimulation();
      }
  
  
    }
  }

  /**
   * Handle the equivalent of the mouseup event on the canvas, which can be triggered by both mouse and single touch.
   * @param {MouseEvent} e - The event.
   */
  handleCanvasMouseUp(e) {
    if (this.isConstructing) {
      if ((e.which && e.which == 1) || (e.changedTouches)) {
        // If an object is being created, pass the action to it
        const ret = this.scene.objs[this.scene.objs.length - 1].onConstructMouseUp(new Mouse(this.mousePos, this.scene, this.lastDeviceIsTouch), e.ctrlKey, e.shiftKey);
        if (ret && ret.isDone) {
          this.isConstructing = false;
        }
        if (ret && ret.requiresObjBarUpdate) {
          this.selectObj(this.selectedObjIndex);
        }
        simulator.updateSimulation(!this.scene.objs[this.scene.objs.length - 1].constructor.isOptical, true);
        if (!this.isConstructing) {
          // The object says the contruction is done
          this.createUndoPoint();
          if (document.getElementById('lockObjs').checked) {
            this.hoveredObjIndex = -1;
            simulator.updateSimulation(true, true);
          }
        }
      }
    }
    else {
      if (this.pendingControlPointSelection) {
        this.pendingControlPointSelection = false
        this.addControlPointsForHandle(this.pendingControlPoints);
      }
      if (e.which && e.which == 3 && this.draggingObjIndex == -3 && this.mousePos.x == this.dragContext.mousePos0.x && this.mousePos.y == this.dragContext.mousePos0.y) {
        this.draggingObjIndex = -1;
        this.dragContext = {};
        JSONOutput();
        this.handleCanvasDblClick(e);
        return;
      }
      if (this.draggingObjIndex != -3) {
        this.createUndoPoint();
      } else {
        // If user is moving the view, do not create undo point, but still updating the JSON code.
        JSONOutput();
      }
      this.draggingObjIndex = -1;
      this.dragContext = {};
    }
  
  }


  /**
   * Handle the equivalent of the dblclick event on the canvas.
   * @param {MouseEvent} e - The event.
   */
  handleCanvasDblClick(e) {
    //console.log("dblclick");
    this.mousePos = geometry.point((e.pageX - e.target.offsetLeft - this.scene.origin.x) / this.scene.scale, (e.pageY - e.target.offsetTop - this.scene.origin.y) / this.scene.scale); // The real position of the mouse (never use grid here)
    if (this.isConstructing) {
    }
    else if (new Mouse(this.mousePos, this.scene, this.lastDeviceIsTouch).isOnPoint(this.lastMousePos)) {
      this.dragContext = {};
      if (this.scene.mode == 'observer') {
        if (geometry.distanceSquared(this.mousePos, this.scene.observer.c) < this.scene.observer.r * this.scene.observer.r) {
  
          // The mousePos clicked the observer
          this.positioningObjIndex = -4;
          this.dragContext = {};
          this.dragContext.targetPoint = geometry.point(this.scene.observer.c.x, this.scene.observer.c.y);
          this.dragContext.snapContext = {};
  
          document.getElementById('xybox').style.left = (this.dragContext.targetPoint.x * this.scene.scale + this.scene.origin.x) + 'px';
          document.getElementById('xybox').style.top = (this.dragContext.targetPoint.y * this.scene.scale + this.scene.origin.y) + 'px';
          document.getElementById('xybox').value = '(' + (this.dragContext.targetPoint.x) + ',' + (this.dragContext.targetPoint.y) + ')';
          document.getElementById('xybox').size = document.getElementById('xybox').value.length;
          document.getElementById('xybox').style.display = '';
          document.getElementById('xybox').select();
          document.getElementById('xybox').setSelectionRange(1, document.getElementById('xybox').value.length - 1);
          //console.log("show xybox");
          xyBox_cancelContextMenu = true;
  
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
  
        document.getElementById('xybox').style.left = (this.dragContext.targetPoint.x * this.scene.scale + this.scene.origin.x) + 'px';
        document.getElementById('xybox').style.top = (this.dragContext.targetPoint.y * this.scene.scale + this.scene.origin.y) + 'px';
        document.getElementById('xybox').value = '(' + (this.dragContext.targetPoint.x) + ',' + (this.dragContext.targetPoint.y) + ')';
        document.getElementById('xybox').size = document.getElementById('xybox').value.length;
        document.getElementById('xybox').style.display = '';
        document.getElementById('xybox').select();
        document.getElementById('xybox').setSelectionRange(1, document.getElementById('xybox').value.length - 1);
        //console.log("show xybox");
        xyBox_cancelContextMenu = true;
      }
    }
  
  }

  /**
   * @typedef {Object} SelectionSearchResult
   * @property {DragContext} dragContext - The drag context.
   * @property {number} targetObjIndex - The index of the target object.
   */

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
   * @typedef {Object} ControlPoint
   * @property {DragContext} dragContext - The drag context of the virtual mouse that is dragging the control point.
   * @property {Point} newPoint - The new position of the control point.
   */

  /**
   * Add control points for a handle (create a new handle or add to the currently consturcting handle).
   * @param {ControlPoint[]} controlPoints - The control points to add.
   */
  addControlPointsForHandle(controlPoints) {
    if (!(this.scene.objs[0].constructor.type == "Handle" && this.scene.objs[0].notDone)) {
      this.scene.unshiftObj(new objTypes["Handle"](this.scene, { notDone: true }));
      if (this.selectedObjIndex >= 0) this.selectedObjIndex++;
      for (var i in controlPoints) {
        controlPoints[i].targetObjIndex++;
      }
    }
    for (var i in controlPoints) {
      this.scene.objs[0].addControlPoint(controlPoints[i]);
    }
    simulator.updateSimulation(true, true);
  }

  /**
   * Finish the creation of a handle.
   * @param {Point} point - The point for the position of the handle.
   */
  finishHandleCreation(point) {
    this.scene.objs[0].finishHandle(point);
    simulator.updateSimulation(true, true);
  }

  /**
   * Select an object.
   * @param {number} index - The index of the object to select.
   */
  selectObj(index) {
    hideAllPopovers();
    if (objBar.pendingEvent) {
      // If the user is in the middle of editing a value, then clearing the innerHTML of obj_bar_main will cause the change event not to fire, so we need to manually fire it.
      objBar.pendingEvent();
      objBar.pendingEvent = null;
    }
  
    if (index < 0 || index >= this.scene.objs.length) {
      // If this object does not exist
      this.selectedObjIndex = -1;
      document.getElementById('obj_bar').style.display = 'none';
      showAdvancedOn = false;
      return;
    }
    this.selectedObjIndex = index;
    if (this.scene.objs[index].constructor.type == 'Handle') {
      document.getElementById('obj_bar').style.display = 'none';
      return;
    }
    document.getElementById('obj_name').innerHTML = getMsg('toolname_' + this.scene.objs[index].constructor.type);
    document.getElementById('showAdvanced').style.display = 'none';
    document.getElementById('showAdvanced_mobile_container').style.display = 'none';
  
    document.getElementById('obj_bar_main').style.display = '';
    document.getElementById('obj_bar_main').innerHTML = '';
    this.scene.objs[index].populateObjBar(objBar);
  
    if (document.getElementById('obj_bar_main').innerHTML != '') {
      for (var i = 0; i < this.scene.objs.length; i++) {
        if (i != this.selectedObjIndex && this.scene.objs[i].constructor.type == this.scene.objs[this.selectedObjIndex].constructor.type) {
          // If there is an object with the same type, then show "Apply to All"
          document.getElementById('apply_to_all_box').style.display = '';
          document.getElementById('apply_to_all_mobile_container').style.display = '';
          break;
        }
        if (i == this.scene.objs.length - 1) {
          document.getElementById('apply_to_all_box').style.display = 'none';
          document.getElementById('apply_to_all_mobile_container').style.display = 'none';
        }
      }
    } else {
      document.getElementById('apply_to_all_box').style.display = 'none';
      document.getElementById('apply_to_all_mobile_container').style.display = 'none';
    }
  
  
    document.getElementById('obj_bar').style.display = '';
  }

  /**
   * Confirm the positioning in the coordinate box.
   * @param {boolean} ctrl - Whether the Ctrl key is pressed.
   * @param {boolean} shift - Whether the Shift key is pressed.
   */
  confirmPositioning(ctrl, shift) {
    var xyData = JSON.parse('[' + document.getElementById('xybox').value.replace(/\(|\)/g, '') + ']');
    // Only do the action when the user enter two numbers (coordinates)
    if (xyData.length == 2) {
      if (this.positioningObjIndex == -4) {
        // Observer
        this.scene.observer.c.x = xyData[0];
        this.scene.observer.c.y = xyData[1];
        simulator.updateSimulation(false, true);
      }
      else {
        // Object
        this.scene.objs[this.positioningObjIndex].onDrag(new Mouse(geometry.point(xyData[0], xyData[1]), this.scene, this.lastDeviceIsTouch, 2), this.dragContext, ctrl, shift);
        simulator.updateSimulation(!this.scene.objs[this.positioningObjIndex].constructor.isOptical, true);
      }
  
      this.createUndoPoint();
    }
  
    this.endPositioning();
  }

  /**
   * End the positioning in the coordinate box.
   */
  endPositioning() {
    document.getElementById('xybox').style.display = 'none';
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
   * Create an undo point.
   */
  createUndoPoint() {
    JSONOutput();
    this.undoIndex = (this.undoIndex + 1) % Editor.UNDO_LIMIT;
    this.undoUBound = this.undoIndex;
    document.getElementById('undo').disabled = false;
    document.getElementById('redo').disabled = true;
    document.getElementById('undo_mobile').disabled = false;
    document.getElementById('redo_mobile').disabled = true;
    this.undoData[this.undoIndex] = latestJsonCode;
    if (this.undoUBound == this.undoLBound) {
      // The limit of undo is reached
      this.undoLBound = (this.undoLBound + 1) % Editor.UNDO_LIMIT;
    }
    hasUnsavedChange = true;
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
      simulator.updateSimulation(!objTypes[constructingObjType].isOptical, true);
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
    latestJsonCode = this.undoData[this.undoIndex];
    JSONInput();
    document.getElementById('redo').disabled = false;
    document.getElementById('redo_mobile').disabled = false;
    if (this.undoIndex == this.undoLBound) {
      // The lower bound of undo data is reached
      document.getElementById('undo').disabled = true;
      document.getElementById('undo_mobile').disabled = true;
    }
    if (aceEditor) {
      aceEditor.session.setValue(latestJsonCode);
    }
    syncUrl();
    requireOccasionalCheck();
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
    latestJsonCode = this.undoData[this.undoIndex];
    JSONInput();
    document.getElementById('undo').disabled = false;
    document.getElementById('undo_mobile').disabled = false;
    if (this.undoIndex == this.undoUBound) {
      // The lower bound of undo data is reached
      document.getElementById('redo').disabled = true;
      document.getElementById('redo_mobile').disabled = true;
    }
    if (aceEditor) {
      aceEditor.session.setValue(latestJsonCode);
    }
    syncUrl();
    requireOccasionalCheck();
  }
  
}

var latestJsonCode = ''; // The latest JSON code







