var mousePos; // Position of the mouse
var mousePos_lastmousedown; // Position of the mouse the last time when the user clicked
var isConstructing = false; // The user is constructing a new object
var constructionPoint; // The point where the user starts the construction
var draggingObj = -1; // Object index in drag (-1 for no drag, -3 for the entire picture, -4 for observer)
var positioningObj = -1; // Object index in entering the coordinates (-1 for none, -4 for observer)
var dragContext = {}; // The part in drag and some mouse position data
var selectedObj = -1; // The index of the selected object (-1 for none)
var mouseObj = -1;
var mousePart = {};
var AddingObjType = ''; // The type of the object to add when user click the canvas
var undoArr = []; // Undo data
var undoIndex = 0; // Current undo position
var undoLimit = 20; // Limit of undo
var undoUBound = 0; // Current upper bound of undo data
var undoLBound = 0; // Current lower bound of undo data

var pendingControlPointSelection = false;
var pendingControlPoints;

function getMouseStyle(obj, style, screen) {
  if (obj == mouseObj && mouseObj)
    return (screen && scene.colorMode) ? 'rgb(0,100,100)' : 'rgb(0,255,255)'
  return style;
}

function canvas_onmousedown(e) {
  if (e.changedTouches) {
    var et = e.changedTouches[0];
  } else {
    var et = e;
  }
  var mousePos_nogrid = geometry.point((et.pageX - e.target.offsetLeft - scene.origin.x) / scene.scale, (et.pageY - e.target.offsetTop - scene.origin.y) / scene.scale); // The real position of the mouse
  mousePos_lastmousedown = mousePos_nogrid;
  if (positioningObj != -1) {
    confirmPositioning(e.ctrlKey, e.shiftKey);
    if (!(e.which && e.which == 3)) {
      return;
    }
  }


  if (!((e.which && (e.which == 1 || e.which == 3)) || (e.changedTouches))) {
    return;
  }

  if (scene.grid) {
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
        selectObj(scene.objs.length - 1); // Keep the constructing obj selected
      }
      const ret = scene.objs[scene.objs.length - 1].onConstructMouseDown(new Mouse(mousePos_nogrid, scene, lastDeviceIsTouch), e.ctrlKey, e.shiftKey);
      if (ret && ret.isDone) {
        isConstructing = false;
      }
      if (ret && ret.requiresObjBarUpdate) {
        selectObj(selectedObj);
      }
      if (ret && ret.requiresUndoPoint) {
        createUndoPoint();
      }
      draw(!scene.objs[scene.objs.length - 1].constructor.isOptical, true);
    }
  }
  else {
    // lockobjs prevents selection, but alt overrides it
    if ((!(scene.lockobjs) != (e.altKey && AddingObjType != '')) && !(e.which == 3)) {

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

      var rets = selectionSearch(mousePos_nogrid);
      var ret = rets[0];
      if (ret.targetObj_index != -1) {
        if (!e.ctrlKey && scene.objs.length > 0 && scene.objs[0].constructor.type == "handle" && scene.objs[0].notDone) {
          // User is creating a handle
          removeObj(0);
          ret.targetObj_index--;
        }
        selectObj(ret.targetObj_index);
        dragContext = ret.mousePart;
        dragContext.originalObj = scene.objs[ret.targetObj_index].serialize(); // Store the obj status before dragging
        dragContext.hasDuplicated = false;
        draggingObj = ret.targetObj_index;
        if (e.ctrlKey && dragContext.targetPoint) {
          pendingControlPointSelection = true;
          pendingControlPoints = rets;
        }
        return;
      }
    }

    if (draggingObj == -1) {
      // The mousePos clicked the blank area
      if (scene.objs.length > 0 && scene.objs[0].constructor.type == "handle" && scene.objs[0].notDone) {
        // User is creating a handle
        finishHandleCreation(mousePos);
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
        selectObj(-1);
      }
      else {
        // Create a new object
        constructionPoint = mousePos;
        isConstructing = true;
        let referenceObj = {};
        if (scene.objs[selectedObj]) {
          if (scene.objs[selectedObj].constructor.type == AddingObjType) {
            referenceObj = scene.objs[selectedObj].serialize();
          }
        }
        scene.objs[scene.objs.length] = new objTypes[AddingObjType](scene, referenceObj);

        const ret = scene.objs[scene.objs.length - 1].onConstructMouseDown(new Mouse(mousePos_nogrid, scene, lastDeviceIsTouch));
        if (ret && ret.isDone) {
          isConstructing = false;
        }
        if (ret && ret.requiresUndoPoint) {
          createUndoPoint();
        }
        selectObj(scene.objs.length - 1);
        draw(!scene.objs[scene.objs.length - 1].constructor.isOptical, true);
        cancelRestore();
      }
    }
  }
}

// search for best object to select at mouse position
function selectionSearch(mousePos_nogrid) {
  var i;
  var mousePart_;
  var click_lensq = Infinity;
  var click_lensq_temp;
  var targetObj_index = -1;
  var targetIsPoint = false;
  var mousePart;
  var targetIsSelected = false;
  var results = [];

  for (var i = 0; i < scene.objs.length; i++) {
    if (typeof scene.objs[i] != 'undefined') {
      let mousePart_ = scene.objs[i].checkMouseOver(new Mouse(mousePos_nogrid, scene, lastDeviceIsTouch));
      if (mousePart_) {
        // the mouse is over the object

        if (mousePart_.targetPoint || mousePart_.targetPoint_) {
          // The mousePos clicked a point
          if (!targetIsPoint) {
            targetIsPoint = true; // If the mouse can click a point, then it must click a point
            results = [];
          }
          var click_lensq_temp = geometry.distanceSquared(mousePos_nogrid, (mousePart_.targetPoint || mousePart_.targetPoint_));
          if (click_lensq_temp <= click_lensq || targetObj_index == selectedObj) {
            // In case of clicking a point, choose the one nearest to the mouse
            // But if the object is the selected object, the points from this object have the highest priority.
            targetObj_index = i;
            click_lensq = click_lensq_temp;
            mousePart = mousePart_;
            if (!targetIsSelected) {
              results.unshift({mousePart: mousePart, targetObj_index: targetObj_index});
            } else {
              results.push({mousePart: mousePart, targetObj_index: targetObj_index});
            }
            if (targetObj_index == selectedObj) targetIsSelected = true;
          }
        } else if (!targetIsPoint) {
          // If not clicking a point, and until now not clicking any point
          targetObj_index = i; // If clicking non-point, choose the most newly created one
          mousePart = mousePart_;
          results.unshift({mousePart: mousePart, targetObj_index: targetObj_index});
        }
      }
    }
  }
  if (results.length == 0) {
    results.push({targetObj_index: -1});
  }
  return results;
}


function canvas_onmousemove(e) {

  pendingControlPointSelection = false;
  if (e.changedTouches) {
    var et = e.changedTouches[0];
  } else {
    var et = e;
  }
  var mousePos_nogrid = geometry.point((et.pageX - e.target.offsetLeft - scene.origin.x) / scene.scale, (et.pageY - e.target.offsetTop - scene.origin.y) / scene.scale); // The real position of the mouse
  var mousePos2;
  if (scene.grid && !(e.altKey && !isConstructing)) {
    mousePos2 = geometry.point(Math.round(((et.pageX - e.target.offsetLeft - scene.origin.x) / scene.scale) / scene.gridSize) * scene.gridSize, Math.round(((et.pageY - e.target.offsetTop - scene.origin.y) / scene.scale) / scene.gridSize) * scene.gridSize);
  }
  else {
    mousePos2 = mousePos_nogrid;
  }

  if (!isConstructing && draggingObj == -1 && !scene.lockobjs) {
    // highlight object under mousePos cursor
    var ret = selectionSearch(mousePos_nogrid)[0];
    //console.log(mousePos_nogrid);
    var newMouseObj = (ret.targetObj_index == -1) ? null : scene.objs[ret.targetObj_index];
    if (mouseObj != newMouseObj) {
      mouseObj = newMouseObj;
      draw(true, true);
    }
    if (ret.mousePart) {
      if (ret.mousePart.cursor) {
        canvas.style.cursor = ret.mousePart.cursor;
      } else if (ret.mousePart.targetPoint || ret.mousePart.targetPoint_) {
        canvas.style.cursor = 'pointer';
      } else if (ret.mousePart.part == 0) {
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


  document.getElementById('mouseCoordinates').innerHTML = getMsg('mouse_coordinates') + "(" + Math.round(mousePos.x) + "," + Math.round(mousePos.y) + ")";

  if (isConstructing) {
    // highlight object being constructed
    mouseObj = scene.objs[scene.objs.length - 1];

    // If some object is being created, pass the action to it
    const ret = scene.objs[scene.objs.length - 1].onConstructMouseMove(new Mouse(mousePos_nogrid, scene, lastDeviceIsTouch), e.ctrlKey, e.shiftKey);
    if (ret && ret.isDone) {
      isConstructing = false;
    }
    if (ret && ret.requiresObjBarUpdate) {
      selectObj(selectedObj);
    }
    if (ret && ret.requiresUndoPoint) {
      createUndoPoint();
    }
    draw(!scene.objs[scene.objs.length - 1].constructor.isOptical, true);
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
      draw(false, true);
    }

    var returndata;
    if (draggingObj >= 0) {
      // Here the mouse is dragging an object

      scene.objs[draggingObj].onDrag(new Mouse(mousePos_nogrid, scene, lastDeviceIsTouch, e.altKey*1), dragContext, e.ctrlKey, e.shiftKey);
      // If dragging an entire object, then when Ctrl is hold, clone the object
      if (dragContext.part == 0) {
        if (e.ctrlKey && !dragContext.hasDuplicated) {

          scene.objs[scene.objs.length] = new objTypes[dragContext.originalObj.type](scene, dragContext.originalObj);
          dragContext.hasDuplicated = true;
        }
        if (!e.ctrlKey && dragContext.hasDuplicated) {
          scene.objs.length--;
          dragContext.hasDuplicated = false;
        }
      }

      draw(!scene.objs[draggingObj].constructor.isOptical, true);

      if (dragContext.requiresObjBarUpdate) {
        selectObj(selectedObj);
      }
    }

    if (draggingObj == -3 && dragContext.mousePos1) {
      // Move the entire scene
      // Here mousePos is the currect mouse position, dragContext.mousePos1 is the mouse position at the previous moment

      var mouseDiffX = (mousePos.x - dragContext.mousePos1.x); // The X difference between the mouse position now and at the previous moment
      var mouseDiffY = (mousePos.y - dragContext.mousePos1.y); // The Y difference between the mouse position now and at the previous moment
      scene.origin.x = mouseDiffX * scene.scale + dragContext.mousePos2.x;
      scene.origin.y = mouseDiffY * scene.scale + dragContext.mousePos2.y;
      draw();
    }

    
  }
}

function canvas_onmouseup(e) {
  if (isConstructing) {
    if ((e.which && e.which == 1) || (e.changedTouches)) {
      // If an object is being created, pass the action to it
      const ret = scene.objs[scene.objs.length - 1].onConstructMouseUp(new Mouse(mousePos, scene, lastDeviceIsTouch), e.ctrlKey, e.shiftKey);
      if (ret && ret.isDone) {
        isConstructing = false;
      }
      if (ret && ret.requiresObjBarUpdate) {
        selectObj(selectedObj);
      }
      if (ret && ret.requiresUndoPoint) {
        createUndoPoint();
      }
      draw(!scene.objs[scene.objs.length - 1].constructor.isOptical, true);
      if (!isConstructing) {
        // The object says the contruction is done
        createUndoPoint();
        if (document.getElementById('lockobjs').checked) {
          mouseObj = -1;
          draw(true, true);
        }
      }
    }
  }
  else {
    if (pendingControlPointSelection) {
      pendingControlPointSelection = false
      addControlPointsForHandle(pendingControlPoints);
    }
    if (e.which && e.which == 3 && draggingObj == -3 && mousePos.x == dragContext.mousePos0.x && mousePos.y == dragContext.mousePos0.y) {
      draggingObj = -1;
      dragContext = {};
      canvas_ondblclick(e);
      return;
    }
    if (draggingObj != -3) {
      // If user is moving the view, do not create undo point.
      createUndoPoint();
    }
    draggingObj = -1;
    dragContext = {};
  }

}

function addControlPointsForHandle(controlPoints) {
  if (!(scene.objs[0].constructor.type == "handle" && scene.objs[0].notDone)) {
    scene.objs.unshift(new objTypes["handle"](scene, {notDone: true}));
    for (var i in scene.objs) {
      if (scene.objs[i].constructor.type == "handle") {
        for (var j in scene.objs[i].controlPoints) {
          scene.objs[i].controlPoints[j].targetObj_index++;
        }
      }
    }
    if (selectedObj >= 0) selectedObj++;
    for (var i in controlPoints) {
      controlPoints[i].targetObj_index++;
    }
    handleIndex = 0;
  }
  for (var i in controlPoints) {
    scene.objs[0].addControlPoint(controlPoints[i]);
  }
  draw(true, true);
}


function finishHandleCreation(point) {
  scene.objs[0].finishHandle(point);
  draw(true, true);
}



function canvas_ondblclick(e) {
  //console.log("dblclick");
  var mousePos = geometry.point((e.pageX - e.target.offsetLeft - scene.origin.x) / scene.scale, (e.pageY - e.target.offsetTop - scene.origin.y) / scene.scale); // The real position of the mouse (never use grid here)
  if (isConstructing) {
  }
  else if (new Mouse(mousePos, scene, lastDeviceIsTouch).isOnPoint(mousePos_lastmousedown)) {
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

    var ret = selectionSearch(mousePos)[0];
    if (ret.targetObj_index != -1 && ret.mousePart.targetPoint) {
      selectObj(ret.targetObj_index);
      dragContext = ret.mousePart;
      dragContext.originalObj = scene.objs[ret.targetObj_index].serialize(); // Store the obj status before dragging

      dragContext.hasDuplicated = false;
      positioningObj = ret.targetObj_index;

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

var lastZoomTime = 0;
var zoomThrottle = 100; // 100 ms between zooms

function canvas_onmousewheel(e) {
  var now = Date.now();
  if (now - lastZoomTime < zoomThrottle) return; // Too soon since the last zoom
  lastZoomTime = now;

  // cross-browser wheel delta
  var e = window.event || e; // old IE support
  var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));
  var d = scene.scale;
  if (delta < 0) {
    d = scene.scale - 0.25;
  } else if (delta > 0) {
    d = scene.scale + 0.25;
  }
  d = Math.max(0.25, Math.min(5.00, d)) * 100;
  setScaleWithCenter(d / 100, (e.pageX - e.target.offsetLeft) / scene.scale, (e.pageY - e.target.offsetTop) / scene.scale);
  //window.toolBarViewModel.zoom.value(d);
  canvas_onmousemove(e);
  return false;
}


function selectObj(index) {
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
  if (scene.objs[index].constructor.type == 'handle') {
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


function confirmPositioning(ctrl, shift) {
  var xyData = JSON.parse('[' + document.getElementById('xybox').value.replace(/\(|\)/g, '') + ']');
  // Only do the action when the user enter two numbers (coordinates)
  if (xyData.length == 2) {
    if (positioningObj == -4) {
      // Observer
      scene.observer.c.x = xyData[0];
      scene.observer.c.y = xyData[1];
      draw(false, true);
    }
    else {
      // Object
      scene.objs[positioningObj].onDrag(new Mouse(geometry.point(xyData[0], xyData[1]), scene, lastDeviceIsTouch, 2), dragContext, ctrl, shift);
      draw(!scene.objs[positioningObj].constructor.isOptical, true);
    }
    
    createUndoPoint();
  }

  endPositioning();
}

function endPositioning() {
  document.getElementById('xybox').style.display = 'none';
  positioningObj = -1;
  dragContext = {};
}

function removeObj(index) {
  for (var i = index; i < scene.objs.length - 1; i++) {
    let oldObj = scene.objs[i+1].serialize();
    scene.objs[i] = new objTypes[oldObj.type](scene, oldObj);
  }

  for (var i in scene.objs) {
    if (scene.objs[i].constructor.type == "handle") {
      for (var j in scene.objs[i].controlPoints) {
        if (scene.objs[i].controlPoints[j].targetObj_index > index) {
          scene.objs[i].controlPoints[j].targetObj_index--;
        } else if (scene.objs[i].controlPoints[j].targetObj_index == index) {
          scene.objs[i].controlPoints = [];
          break;
        }
      }
    }
  }

  isConstructing = false;
  scene.objs.length = scene.objs.length - 1;
  selectedObj--;
  selectObj(selectedObj);
}

function cloneObj(index) {
  if (scene.objs[index].constructor.type == "handle") {
    var indices = [];
    for (var j in scene.objs[index].controlPoints) {
      if (indices.indexOf(scene.objs[index].controlPoints[j].targetObj_index) == -1) {
        indices.push(scene.objs[index].controlPoints[j].targetObj_index);
      }
    }
    //console.log(indices);
    for (var j in indices) {
      if (scene.objs[indices[j]].constructor.type != "handle") {
        cloneObj(indices[j]);
      }
    }
  } else {
    let oldObj = scene.objs[index].serialize();
    scene.objs[scene.objs.length] = new objTypes[oldObj.type](scene, oldObj);
  }
}


function createUndoPoint() {
  JSONOutput();
  undoIndex = (undoIndex + 1) % undoLimit;
  undoUBound = undoIndex;
  document.getElementById('undo').disabled = false;
  document.getElementById('redo').disabled = true;
  document.getElementById('undo_mobile').disabled = false;
  document.getElementById('redo_mobile').disabled = true;
  undoArr[undoIndex] = document.getElementById('textarea1').value;
  if (undoUBound == undoLBound) {
    // The limit of undo is reached
    undoLBound = (undoLBound + 1) % undoLimit;
  }
  hasUnsavedChange = true;
}

function undo() {
  if (isConstructing && !(scene.objs.length > 0 && scene.objs[scene.objs.length - 1].constructor.type == 'drawing')) {
    // If the user is constructing an object when clicked the undo, then only stop the consturction rather than do the real undo

    isConstructing = false;
    scene.objs.length--;
    selectObj(-1);

    draw();
    return;
  }
  if (positioningObj != -1) {
    // If the user is entering coordinates when clicked the undo, then only stop the coordinates entering rather than do the real undo
    endPositioning();
    return;
  }
  if (undoIndex == undoLBound)
    // The lower bound of undo data is reached
    return;
  undoIndex = (undoIndex + (undoLimit - 1)) % undoLimit;
  document.getElementById('textarea1').value = undoArr[undoIndex];
  JSONInput();
  document.getElementById('redo').disabled = false;
  document.getElementById('redo_mobile').disabled = false;
  if (undoIndex == undoLBound) {
    // The lower bound of undo data is reached
    document.getElementById('undo').disabled = true;
    document.getElementById('undo_mobile').disabled = true;
  }

}

function redo() {
  isConstructing = false;
  endPositioning();
  if (undoIndex == undoUBound)
    // The lower bound of undo data is reached
    return;
  undoIndex = (undoIndex + 1) % undoLimit;
  document.getElementById('textarea1').value = undoArr[undoIndex];
  JSONInput();
  document.getElementById('undo').disabled = false;
  document.getElementById('undo_mobile').disabled = false;
  if (undoIndex == undoUBound) {
    // The lower bound of undo data is reached
    document.getElementById('redo').disabled = true;
    document.getElementById('redo_mobile').disabled = true;
  }
}
