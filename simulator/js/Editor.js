class Editor {
  constructor(scene, canvas, objBar, xyBox) {
    /** @property {Scene} scene - The scene to be edited and simulated. */
    this.scene = scene;

    this.scene.editor = this; // This circular reference is currently only used by CropBox.

    /** @property {HTMLCanvasElement} canvas - The top-layered canvas for user interaction. */
    this.canvas = canvas;

    /** @property {ObjBar} objBar - The object bar for editing object properties. */
    this.objBar = objBar;

    /** @property {HTMLInputElement} xyBox - The input box for entering coordinates. */
    this.xyBox = xyBox;

    /** @property {boolean} lastDeviceIsTouch - Whether the last interaction with `canvas` is done by a touch device. */
    this.lastDeviceIsTouch = false;

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
      if (draggingObj != -1) {
        self.handleCanvasMouseUp(e);
      }
      mouseObj = -1;
      document.getElementById('mouseCoordinates').innerHTML = "";
      simulator.updateSimulation(true, true)
    });


    // IE9, Chrome, Safari, Opera
    this.canvas.addEventListener("mousewheel", function(e) {
      self.handleCanvasMouseWheel()
    }, false);
    // Firefox
    this.canvas.addEventListener("DOMMouseScroll", function(e) {
      self.handleCanvasMouseWheel()
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
        if (isConstructing || draggingObj >= 0) {
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
          lastScale = scene.scale;
        }

        // Calculate the scaling factor
        const scaleFactor = distance / initialPinchDistance;

        // Update scale based on previous scale and scaling factor
        let newScale = lastScale * scaleFactor;

        newScale = Math.max(0.25 / scene.lengthScale, Math.min(5.00 / scene.lengthScale, newScale));

        // Calculate the mid point between the two touches
        const x = (e.touches[0].pageX + e.touches[1].pageX) / 2;
        const y = (e.touches[0].pageY + e.touches[1].pageY) / 2;

        // Calculate the change in scale relative to the center point
        const dx2 = x - lastX;
        const dy2 = y - lastY;

        // Apply the translation
        scene.origin.x += dx2;
        scene.origin.y += dy2;

        // Apply the scale transformation
        setScaleWithCenter(newScale, (x - e.target.offsetLeft) / scene.scale, (y - e.target.offsetTop) / scene.scale);

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
      if (isConstructing || draggingObj >= 0) {
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
    var mousePos_nogrid = geometry.point((et.pageX - e.target.offsetLeft - scene.origin.x) / scene.scale, (et.pageY - e.target.offsetTop - scene.origin.y) / scene.scale); // The real position of the mouse
    mousePos_lastmousedown = mousePos_nogrid;
    if (positioningObj != -1) {
      this.confirmPositioning(e.ctrlKey, e.shiftKey);
      if (!(e.which && e.which == 3)) {
        return;
      }
    }
  
  
    if (!((e.which && (e.which == 1 || e.which == 3)) || (e.changedTouches))) {
      return;
    }
  
    if (scene.snapToGrid) {
      mousePos = geometry.point(Math.round(((et.pageX - e.target.offsetLeft - scene.origin.x) / scene.scale) / scene.gridSize) * scene.gridSize, Math.round(((et.pageY - e.target.offsetTop - scene.origin.y) / scene.scale) / scene.gridSize) * scene.gridSize);
  
    }
    else {
      mousePos = mousePos_nogrid;
    }
  
  
    if (isConstructing) {
      if ((e.which && e.which == 1) || (e.changedTouches)) {
        // Only react for left click
        // If an obj is being created, pass the action to it
        if (selectedObj != scene.objs.length - 1) {
          this.selectObj(scene.objs.length - 1); // Keep the constructing obj selected
        }
        const ret = scene.objs[scene.objs.length - 1].onConstructMouseDown(new Mouse(mousePos_nogrid, scene, editor.lastDeviceIsTouch), e.ctrlKey, e.shiftKey);
        if (ret && ret.isDone) {
          isConstructing = false;
        }
        if (ret && ret.requiresObjBarUpdate) {
          this.selectObj(selectedObj);
        }
        simulator.updateSimulation(!scene.objs[scene.objs.length - 1].constructor.isOptical, true);
      }
    }
    else {
      // lockObjs prevents selection, but alt overrides it
      if ((!(scene.lockObjs) != (e.altKey && AddingObjType != '')) && !(e.which == 3)) {
  
        dragContext = {};
  
        if (scene.mode == 'observer') {
          if (geometry.distanceSquared(mousePos_nogrid, scene.observer.c) < scene.observer.r * scene.observer.r) {
            // The mousePos clicked the observer
            draggingObj = -4;
            dragContext = {};
            //dragContext.part=0;
            dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
            dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
            dragContext.snapContext = {};
            return;
          }
        }
  
        var rets = this.selectionSearch(mousePos_nogrid);
        var ret = rets[0];
        if (ret.targetObjIndex != -1) {
          if (!e.ctrlKey && scene.objs.length > 0 && scene.objs[0].constructor.type == "Handle" && scene.objs[0].notDone) {
            // User is creating a handle
            this.removeObj(0);
            ret.targetObjIndex--;
          }
          this.selectObj(ret.targetObjIndex);
          dragContext = ret.dragContext;
          dragContext.originalObj = scene.objs[ret.targetObjIndex].serialize(); // Store the obj status before dragging
          dragContext.hasDuplicated = false;
          draggingObj = ret.targetObjIndex;
          if (e.ctrlKey && dragContext.targetPoint) {
            pendingControlPointSelection = true;
            pendingControlPoints = rets;
          }
          return;
        }
      }
  
      if (draggingObj == -1) {
        // The mousePos clicked the blank area
        if (scene.objs.length > 0 && scene.objs[0].constructor.type == "Handle" && scene.objs[0].notDone) {
          // User is creating a handle
          this.finishHandleCreation(mousePos);
          return;
        }
        if ((AddingObjType == '') || (e.which == 3)) {
          // To drag the entire scene
          draggingObj = -3;
          dragContext = {};
          dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
          dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
          dragContext.mousePos2 = scene.origin; //Original origin.
          dragContext.snapContext = {};
          this.selectObj(-1);
        }
        else {
          // Create a new object
          isConstructing = true;
          let referenceObj = {};
          if (scene.objs[selectedObj]) {
            if (scene.objs[selectedObj].constructor.type == AddingObjType) {
              referenceObj = scene.objs[selectedObj].serialize();
            }
          }
          scene.pushObj(new objTypes[AddingObjType](scene, referenceObj));
  
          const ret = scene.objs[scene.objs.length - 1].onConstructMouseDown(new Mouse(mousePos_nogrid, scene, editor.lastDeviceIsTouch));
          if (ret && ret.isDone) {
            isConstructing = false;
          }
          this.selectObj(scene.objs.length - 1);
          simulator.updateSimulation(!scene.objs[scene.objs.length - 1].constructor.isOptical, true);
        }
      }
    }
  }

  /**
   * Handle the equivalent of the mousemove event on the canvas, which can be triggered by both mouse and single touch.
   * @param {MouseEvent} e - The event.
   */
  handleCanvasMouseMove(e) {

    pendingControlPointSelection = false;
    if (e.changedTouches) {
      var et = e.changedTouches[0];
    } else {
      var et = e;
    }
    var mousePos_nogrid = geometry.point((et.pageX - e.target.offsetLeft - scene.origin.x) / scene.scale, (et.pageY - e.target.offsetTop - scene.origin.y) / scene.scale); // The real position of the mouse
    var mousePos2;
    if (scene.snapToGrid && !(e.altKey && !isConstructing)) {
      mousePos2 = geometry.point(Math.round(((et.pageX - e.target.offsetLeft - scene.origin.x) / scene.scale) / scene.gridSize) * scene.gridSize, Math.round(((et.pageY - e.target.offsetTop - scene.origin.y) / scene.scale) / scene.gridSize) * scene.gridSize);
    }
    else {
      mousePos2 = mousePos_nogrid;
    }
  
    if (!isConstructing && draggingObj == -1 && !scene.lockObjs) {
      // highlight object under mousePos cursor
      var ret = this.selectionSearch(mousePos_nogrid)[0];
      //console.log(mousePos_nogrid);
      var newMouseObj = (ret.targetObjIndex == -1) ? null : scene.objs[ret.targetObjIndex];
      if (mouseObj != newMouseObj) {
        mouseObj = newMouseObj;
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
        if (scene.mode == 'observer' && geometry.distanceSquared(mousePos, scene.observer.c) < scene.observer.r * scene.observer.r) {
          canvas.style.cursor = 'pointer';
        } else {
          canvas.style.cursor = '';
        }
      }
    }
  
    if (mousePos2.x == mousePos.x && mousePos2.y == mousePos.y) {
      return;
    }
    mousePos = mousePos2;
  
  
    const mousePosDigits = Math.max(Math.round(Math.log10(scene.scale)), 0);
    document.getElementById('mouseCoordinates').innerHTML = getMsg('mouse_coordinates') + "(" + mousePos.x.toFixed(mousePosDigits) + ", " + mousePos.y.toFixed(mousePosDigits) + ")";
  
    if (isConstructing) {
      // highlight object being constructed
      mouseObj = scene.objs[scene.objs.length - 1];
  
      // If some object is being created, pass the action to it
      const ret = scene.objs[scene.objs.length - 1].onConstructMouseMove(new Mouse(mousePos_nogrid, scene, editor.lastDeviceIsTouch), e.ctrlKey, e.shiftKey);
      if (ret && ret.isDone) {
        isConstructing = false;
      }
      if (ret && ret.requiresObjBarUpdate) {
        this.selectObj(selectedObj);
      }
      simulator.updateSimulation(!scene.objs[scene.objs.length - 1].constructor.isOptical, true);
    }
    else {
      if (draggingObj == -4) {
        if (e.shiftKey) {
          var mousePos_snapped = snapToDirection(mousePos, dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
        }
        else {
          var mousePos_snapped = mousePos;
          dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
        }
  
        var mouseDiffX = (mousePos_snapped.x - dragContext.mousePos1.x); // The X difference between the mouse position now and at the previous moment
        var mouseDiffY = (mousePos_snapped.y - dragContext.mousePos1.y); // The Y difference between the mouse position now and at the previous moment
  
        scene.observer.c.x += mouseDiffX;
        scene.observer.c.y += mouseDiffY;
  
        // Update the mouse position
        dragContext.mousePos1 = mousePos_snapped;
        simulator.updateSimulation(false, true);
      }
  
      var returndata;
      if (draggingObj >= 0) {
        // Here the mouse is dragging an object
  
        scene.objs[draggingObj].onDrag(new Mouse(mousePos_nogrid, scene, editor.lastDeviceIsTouch, e.altKey * 1), dragContext, e.ctrlKey, e.shiftKey);
        // If dragging an entire object, then when Ctrl is hold, clone the object
        if (dragContext.part == 0) {
          if (e.ctrlKey && !dragContext.hasDuplicated) {
  
            scene.pushObj(new objTypes[scene.objs[draggingObj].constructor.type](scene, dragContext.originalObj));
            dragContext.hasDuplicated = true;
          }
          if (!e.ctrlKey && dragContext.hasDuplicated) {
            scene.objs.length--;
            dragContext.hasDuplicated = false;
          }
        }
  
        simulator.updateSimulation(!scene.objs[draggingObj].constructor.isOptical, true);
  
        if (dragContext.requiresObjBarUpdate) {
          this.selectObj(selectedObj);
        }
      }
  
      if (draggingObj == -3 && dragContext.mousePos1) {
        // Move the entire scene
        // Here mousePos is the currect mouse position, dragContext.mousePos1 is the mouse position at the previous moment
  
        var mouseDiffX = (mousePos.x - dragContext.mousePos1.x); // The X difference between the mouse position now and at the previous moment
        var mouseDiffY = (mousePos.y - dragContext.mousePos1.y); // The Y difference between the mouse position now and at the previous moment
        scene.origin.x = mouseDiffX * scene.scale + dragContext.mousePos2.x;
        scene.origin.y = mouseDiffY * scene.scale + dragContext.mousePos2.y;
        simulator.updateSimulation();
      }
  
  
    }
  }

  /**
   * Handle the equivalent of the mouseup event on the canvas, which can be triggered by both mouse and single touch.
   * @param {MouseEvent} e - The event.
   */
  handleCanvasMouseUp(e) {
    if (isConstructing) {
      if ((e.which && e.which == 1) || (e.changedTouches)) {
        // If an object is being created, pass the action to it
        const ret = scene.objs[scene.objs.length - 1].onConstructMouseUp(new Mouse(mousePos, scene, editor.lastDeviceIsTouch), e.ctrlKey, e.shiftKey);
        if (ret && ret.isDone) {
          isConstructing = false;
        }
        if (ret && ret.requiresObjBarUpdate) {
          this.selectObj(selectedObj);
        }
        simulator.updateSimulation(!scene.objs[scene.objs.length - 1].constructor.isOptical, true);
        if (!isConstructing) {
          // The object says the contruction is done
          this.createUndoPoint();
          if (document.getElementById('lockObjs').checked) {
            mouseObj = -1;
            simulator.updateSimulation(true, true);
          }
        }
      }
    }
    else {
      if (pendingControlPointSelection) {
        pendingControlPointSelection = false
        this.addControlPointsForHandle(pendingControlPoints);
      }
      if (e.which && e.which == 3 && draggingObj == -3 && mousePos.x == dragContext.mousePos0.x && mousePos.y == dragContext.mousePos0.y) {
        draggingObj = -1;
        dragContext = {};
        JSONOutput();
        this.handleCanvasDblClick(e);
        return;
      }
      if (draggingObj != -3) {
        this.createUndoPoint();
      } else {
        // If user is moving the view, do not create undo point, but still updating the JSON code.
        JSONOutput();
      }
      draggingObj = -1;
      dragContext = {};
    }
  
  }


  /**
   * Handle the equivalent of the dblclick event on the canvas.
   * @param {MouseEvent} e - The event.
   */
  handleCanvasDblClick(e) {
    //console.log("dblclick");
    var mousePos = geometry.point((e.pageX - e.target.offsetLeft - scene.origin.x) / scene.scale, (e.pageY - e.target.offsetTop - scene.origin.y) / scene.scale); // The real position of the mouse (never use grid here)
    if (isConstructing) {
    }
    else if (new Mouse(mousePos, scene, editor.lastDeviceIsTouch).isOnPoint(mousePos_lastmousedown)) {
      dragContext = {};
      if (scene.mode == 'observer') {
        if (geometry.distanceSquared(mousePos, scene.observer.c) < scene.observer.r * scene.observer.r) {
  
          // The mousePos clicked the observer
          positioningObj = -4;
          dragContext = {};
          dragContext.targetPoint = geometry.point(scene.observer.c.x, scene.observer.c.y);
          dragContext.snapContext = {};
  
          document.getElementById('xybox').style.left = (dragContext.targetPoint.x * scene.scale + scene.origin.x) + 'px';
          document.getElementById('xybox').style.top = (dragContext.targetPoint.y * scene.scale + scene.origin.y) + 'px';
          document.getElementById('xybox').value = '(' + (dragContext.targetPoint.x) + ',' + (dragContext.targetPoint.y) + ')';
          document.getElementById('xybox').size = document.getElementById('xybox').value.length;
          document.getElementById('xybox').style.display = '';
          document.getElementById('xybox').select();
          document.getElementById('xybox').setSelectionRange(1, document.getElementById('xybox').value.length - 1);
          //console.log("show xybox");
          xyBox_cancelContextMenu = true;
  
          return;
        }
      }
  
      var ret = this.selectionSearch(mousePos)[0];
      if (ret.targetObjIndex != -1 && ret.dragContext.targetPoint) {
        this.selectObj(ret.targetObjIndex);
        dragContext = ret.dragContext;
        dragContext.originalObj = scene.objs[ret.targetObjIndex].serialize(); // Store the obj status before dragging
  
        dragContext.hasDuplicated = false;
        positioningObj = ret.targetObjIndex;
  
        document.getElementById('xybox').style.left = (dragContext.targetPoint.x * scene.scale + scene.origin.x) + 'px';
        document.getElementById('xybox').style.top = (dragContext.targetPoint.y * scene.scale + scene.origin.y) + 'px';
        document.getElementById('xybox').value = '(' + (dragContext.targetPoint.x) + ',' + (dragContext.targetPoint.y) + ')';
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
   * Handle the mousewheel event on the canvas.
   * @param {WheelEvent} e - The event.
   */
  handleCanvasMouseWheel(e) {
    var now = Date.now();
    if (now - lastZoomTime < zoomThrottle) return; // Too soon since the last zoom
    lastZoomTime = now;
  
    // cross-browser wheel delta
    var e = window.event || e; // old IE support
    var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
    var d = scene.scale * scene.lengthScale;
    if (delta < 0) {
      d = scene.scale * scene.lengthScale - 0.25;
    } else if (delta > 0) {
      d = scene.scale * scene.lengthScale + 0.25;
    }
    d = Math.max(0.25, Math.min(5.00, d)) * 100;
    setScaleWithCenter(d / scene.lengthScale / 100, (e.pageX - e.target.offsetLeft) / scene.scale, (e.pageY - e.target.offsetTop) / scene.scale);
    JSONOutput();
    //window.toolBarViewModel.zoom.value(d);
    this.handleCanvasMouseMove(e);
    return false;
  }

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
  
    for (var i = 0; i < scene.objs.length; i++) {
      if (typeof scene.objs[i] != 'undefined') {
        let dragContext_ = scene.objs[i].checkMouseOver(new Mouse(mousePos_nogrid, scene, editor.lastDeviceIsTouch));
        if (dragContext_) {
          // the mouse is over the object
  
          if (dragContext_.targetPoint || dragContext_.targetPoint_) {
            // The mousePos clicked a point
            if (!targetIsPoint) {
              targetIsPoint = true; // If the mouse can click a point, then it must click a point
              results = [];
            }
            var click_lensq_temp = geometry.distanceSquared(mousePos_nogrid, (dragContext_.targetPoint || dragContext_.targetPoint_));
            if (click_lensq_temp <= click_lensq || targetObjIndex == selectedObj) {
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
              if (targetObjIndex == selectedObj) targetIsSelected = true;
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
    if (!(scene.objs[0].constructor.type == "Handle" && scene.objs[0].notDone)) {
      scene.unshiftObj(new objTypes["Handle"](scene, { notDone: true }));
      if (selectedObj >= 0) selectedObj++;
      for (var i in controlPoints) {
        controlPoints[i].targetObjIndex++;
      }
    }
    for (var i in controlPoints) {
      scene.objs[0].addControlPoint(controlPoints[i]);
    }
    simulator.updateSimulation(true, true);
  }

  /**
   * Finish the creation of a handle.
   * @param {Point} point - The point for the position of the handle.
   */
  finishHandleCreation(point) {
    scene.objs[0].finishHandle(point);
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
  
    if (index < 0 || index >= scene.objs.length) {
      // If this object does not exist
      selectedObj = -1;
      document.getElementById('obj_bar').style.display = 'none';
      showAdvancedOn = false;
      return;
    }
    selectedObj = index;
    if (scene.objs[index].constructor.type == 'Handle') {
      document.getElementById('obj_bar').style.display = 'none';
      return;
    }
    document.getElementById('obj_name').innerHTML = getMsg('toolname_' + scene.objs[index].constructor.type);
    document.getElementById('showAdvanced').style.display = 'none';
    document.getElementById('showAdvanced_mobile_container').style.display = 'none';
  
    document.getElementById('obj_bar_main').style.display = '';
    document.getElementById('obj_bar_main').innerHTML = '';
    scene.objs[index].populateObjBar(objBar);
  
    if (document.getElementById('obj_bar_main').innerHTML != '') {
      for (var i = 0; i < scene.objs.length; i++) {
        if (i != selectedObj && scene.objs[i].constructor.type == scene.objs[selectedObj].constructor.type) {
          // If there is an object with the same type, then show "Apply to All"
          document.getElementById('apply_to_all_box').style.display = '';
          document.getElementById('apply_to_all_mobile_container').style.display = '';
          break;
        }
        if (i == scene.objs.length - 1) {
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
      if (positioningObj == -4) {
        // Observer
        scene.observer.c.x = xyData[0];
        scene.observer.c.y = xyData[1];
        simulator.updateSimulation(false, true);
      }
      else {
        // Object
        scene.objs[positioningObj].onDrag(new Mouse(geometry.point(xyData[0], xyData[1]), scene, editor.lastDeviceIsTouch, 2), dragContext, ctrl, shift);
        simulator.updateSimulation(!scene.objs[positioningObj].constructor.isOptical, true);
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
    positioningObj = -1;
    dragContext = {};
  }
  
  /**
   * Remove an object.
   * @param {number} index - The index of the object to remove.
   */
  removeObj(index) {
    isConstructing = false;
    scene.removeObj(index);
  
    selectedObj--;
    this.selectObj(selectedObj);
  }

  /**
   * Create an undo point.
   */
  createUndoPoint() {
    JSONOutput();
    undoIndex = (undoIndex + 1) % undoLimit;
    undoUBound = undoIndex;
    document.getElementById('undo').disabled = false;
    document.getElementById('redo').disabled = true;
    document.getElementById('undo_mobile').disabled = false;
    document.getElementById('redo_mobile').disabled = true;
    undoArr[undoIndex] = latestJsonCode;
    if (undoUBound == undoLBound) {
      // The limit of undo is reached
      undoLBound = (undoLBound + 1) % undoLimit;
    }
    hasUnsavedChange = true;
  }

  /**
   * Undo the last edit.
   */
  undo() {
    if (isConstructing) {
      const constructingObjType = scene.objs[scene.objs.length - 1].constructor.type;
      const ret = scene.objs[scene.objs.length - 1].onConstructUndo();
      if (ret && ret.isCancelled) {
        isConstructing = false;
        scene.objs.length--;
        this.selectObj(-1);
      }
      simulator.updateSimulation(!objTypes[constructingObjType].isOptical, true);
      return;
    }
    if (positioningObj != -1) {
      // If the user is entering coordinates when clicked the undo, then only stop the coordinates entering rather than do the real undo
      this.endPositioning();
      return;
    }
    if (undoIndex == undoLBound)
      // The lower bound of undo data is reached
      return;
    undoIndex = (undoIndex + (undoLimit - 1)) % undoLimit;
    latestJsonCode = undoArr[undoIndex];
    JSONInput();
    document.getElementById('redo').disabled = false;
    document.getElementById('redo_mobile').disabled = false;
    if (undoIndex == undoLBound) {
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
    isConstructing = false;
    this.endPositioning();
    if (undoIndex == undoUBound)
      // The lower bound of undo data is reached
      return;
    undoIndex = (undoIndex + 1) % undoLimit;
    latestJsonCode = undoArr[undoIndex];
    JSONInput();
    document.getElementById('undo').disabled = false;
    document.getElementById('undo_mobile').disabled = false;
    if (undoIndex == undoUBound) {
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


var mousePos; // Position of the mouse
var mousePos_lastmousedown; // Position of the mouse the last time when the user clicked
var isConstructing = false; // The user is constructing a new object
var draggingObj = -1; // Object index in drag (-1 for no drag, -3 for the entire picture, -4 for observer)
var positioningObj = -1; // Object index in entering the coordinates (-1 for none, -4 for observer)
var dragContext = {}; // The part in drag and some mouse position data
var selectedObj = -1; // The index of the selected object (-1 for none)
var mouseObj = -1;
var AddingObjType = ''; // The type of the object to add when user click the canvas
var addingModuleName = '';
var latestJsonCode = ''; // The latest JSON code
var undoArr = []; // Undo data
var undoIndex = 0; // Current undo position
var undoLimit = 20; // Limit of undo
var undoUBound = 0; // Current upper bound of undo data
var undoLBound = 0; // Current lower bound of undo data

var pendingControlPointSelection = false;
var pendingControlPoints;







var lastZoomTime = 0;
var zoomThrottle = 100; // 100 ms between zooms


