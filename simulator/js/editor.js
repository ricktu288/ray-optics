var mouse; // Position of the mouse
var mouse_lastmousedown; // Position of the mouse the last time when the user clicked
var isConstructing = false; // The user is constructing a new object
var constructionPoint; // The point where the user starts the construction
var draggingObj = -1; // Object index in drag (-1 for no drag, -3 for the entire picture, -4 for observer)
var positioningObj = -1; // Object index in entering the coordinates (-1 for none, -4 for observer)
var draggingPart = {}; // The part in drag and some mouse position data
var selectedObj = -1; // The index of the selected object (-1 for none)
var mouseObj = -1;
var mousePart = {};
var AddingObjType = ''; // The type of the object to add when user click the canvas
var undoArr = []; // Undo data
var undoIndex = 0; // Current undo position
var undoLimit = 20; // Limit of undo
var undoUBound = 0; // Current upper bound of undo data
var undoLBound = 0; // Current lower bound of undo data
var snapToDirection_lockLimit_squared = 900; // The square of the legnth needed to snap to a direction when dragging an object with snap-to-direction
var clickExtent_line = 10;
var clickExtent_point = 10;
var clickExtent_point_construct = 10;
var touchscreenExtentRatio = 2;

var pendingControlPointSelection = false;
var pendingControlPoints;

function getMouseStyle(obj, style, screen) {
  if (obj == mouseObj && mouseObj)
    return (screen && scene.colorMode) ? 'rgb(0,100,100)' : 'rgb(0,255,255)'
  return style;
}

function getClickExtent(isPoint, isConstruct) {
  if (isPoint) {
    if (isConstruct) {
      var clickExtent = clickExtent_point_construct / scene.scale;
    } else {
      var clickExtent = clickExtent_point / scene.scale;
    }
  } else {
    var clickExtent = clickExtent_line / scene.scale;
  }
  if (lastDeviceIsTouch) {
    clickExtent *= touchscreenExtentRatio;
  }
  return clickExtent;
}

function mouseOnPoint(mouse, point) {
  return geometry.length_squared(mouse, point) < getClickExtent(true) * getClickExtent(true);
}

function mouseOnPoint_construct(mouse, point) {
  return geometry.length_squared(mouse, point) < getClickExtent(true, true) * getClickExtent(true, true);
}

function mouseOnSegment(mouse, segment) {
  var d_per = Math.pow((mouse.x - segment.p1.x) * (segment.p1.y - segment.p2.y) + (mouse.y - segment.p1.y) * (segment.p2.x - segment.p1.x), 2) / ((segment.p1.y - segment.p2.y) * (segment.p1.y - segment.p2.y) + (segment.p2.x - segment.p1.x) * (segment.p2.x - segment.p1.x)); // Similar to the distance between the mouse and the line
  var d_par = (segment.p2.x - segment.p1.x) * (mouse.x - segment.p1.x) + (segment.p2.y - segment.p1.y) * (mouse.y - segment.p1.y); // Similar to the projected point of the mouse on the line
  return d_per < getClickExtent() * getClickExtent() && d_par >= 0 && d_par <= geometry.length_segment_squared(segment);
}

function mouseOnLine(mouse, line) {
  var d_per = Math.pow((mouse.x - line.p1.x) * (line.p1.y - line.p2.y) + (mouse.y - line.p1.y) * (line.p2.x - line.p1.x), 2) / ((line.p1.y - line.p2.y) * (line.p1.y - line.p2.y) + (line.p2.x - line.p1.x) * (line.p2.x - line.p1.x)); // Similar to the distance between the mouse and the line
  return d_per < getClickExtent() * getClickExtent();
}

// Snap the mouse position to the direction nearest to the given directions
function snapToDirection(mouse, basePoint, directions, snapData) {
  var x = mouse.x - basePoint.x;
  var y = mouse.y - basePoint.y;

  if (snapData && snapData.locked) {
    // The snap has been locked
    var k = (directions[snapData.i0].x * x + directions[snapData.i0].y * y) / (directions[snapData.i0].x * directions[snapData.i0].x + directions[snapData.i0].y * directions[snapData.i0].y);
    return geometry.point(basePoint.x + k * directions[snapData.i0].x, basePoint.y + k * directions[snapData.i0].y);
  }
  else {
    var i0;
    var d_sq;
    var d0_sq = Infinity;
    for (var i = 0; i < directions.length; i++) {
      d_sq = (directions[i].y * x - directions[i].x * y) * (directions[i].y * x - directions[i].x * y) / (directions[i].x * directions[i].x + directions[i].y * directions[i].y);
      if (d_sq < d0_sq) {
        d0_sq = d_sq;
        i0 = i;
      }
    }

    if (snapData && x * x + y * y > snapToDirection_lockLimit_squared) {
      // lock the snap
      snapData.locked = true;
      snapData.i0 = i0;
    }

    var k = (directions[i0].x * x + directions[i0].y * y) / (directions[i0].x * directions[i0].x + directions[i0].y * directions[i0].y);
    return geometry.point(basePoint.x + k * directions[i0].x, basePoint.y + k * directions[i0].y);
  }
}

function canvas_onmousedown(e) {
  if (e.changedTouches) {
    var et = e.changedTouches[0];
  } else {
    var et = e;
  }
  var mouse_nogrid = geometry.point((et.pageX - e.target.offsetLeft - scene.origin.x) / scene.scale, (et.pageY - e.target.offsetTop - scene.origin.y) / scene.scale); // The real position of the mouse
  mouse_lastmousedown = mouse_nogrid;
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
    mouse = geometry.point(Math.round(((et.pageX - e.target.offsetLeft - scene.origin.x) / scene.scale) / scene.gridSize) * scene.gridSize, Math.round(((et.pageY - e.target.offsetTop - scene.origin.y) / scene.scale) / scene.gridSize) * scene.gridSize);

  }
  else {
    mouse = mouse_nogrid;
  }


  if (isConstructing) {
    if ((e.which && e.which == 1) || (e.changedTouches)) {
      // Only react for left click
      // If an obj is being created, pass the action to it
      if (selectedObj != scene.objs.length - 1) {
        selectObj(scene.objs.length - 1); // Keep the constructing obj selected
      }
      const ret = objTypes[scene.objs[scene.objs.length - 1].type].c_mousedown(scene.objs[scene.objs.length - 1], mouse, e.ctrlKey, e.shiftKey);
      if (ret && ret.isDone) {
        isConstructing = false;
      }
      if (ret && ret.requiresObjBarUpdate) {
        selectObj(selectedObj);
      }
      if (ret && ret.newUndoPoint) {
        createUndoPoint();
      }
      draw(!(objTypes[scene.objs[scene.objs.length - 1].type].shoot || objTypes[scene.objs[scene.objs.length - 1].type].rayIntersection), true);
    }
  }
  else {
    // lockobjs prevents selection, but alt overrides it
    if ((!(scene.lockobjs) != (e.altKey && AddingObjType != '')) && !(e.which == 3)) {

      draggingPart = {};

      if (scene.mode == 'observer') {
        if (geometry.length_squared(mouse_nogrid, scene.observer.c) < scene.observer.r * scene.observer.r) {
          // The mouse clicked the observer
          draggingObj = -4;
          draggingPart = {};
          //draggingPart.part=0;
          draggingPart.mouse0 = mouse; // Mouse position when the user starts dragging
          draggingPart.mouse1 = mouse; // Mouse position at the last moment during dragging
          draggingPart.snapData = {};
          return;
        }
      }

      var rets = selectionSearch(mouse_nogrid);
      var ret = rets[0];
      if (ret.targetObj_index != -1) {
        if (!e.ctrlKey && scene.objs.length > 0 && scene.objs[0].type == "handle" && scene.objs[0].notDone) {
          // User is creating a handle
          removeObj(0);
          ret.targetObj_index--;
        }
        selectObj(ret.targetObj_index);
        draggingPart = ret.mousePart;
        draggingPart.originalObj = JSON.parse(JSON.stringify(scene.objs[ret.targetObj_index])); // Store the obj status before dragging
        draggingPart.hasDuplicated = false;
        draggingObj = ret.targetObj_index;
        if (e.ctrlKey && draggingPart.targetPoint) {
          pendingControlPointSelection = true;
          pendingControlPoints = rets;
        }
        return;
      }
    }

    if (draggingObj == -1) {
      // The mouse clicked the blank area
      if (scene.objs.length > 0 && scene.objs[0].type == "handle" && scene.objs[0].notDone) {
        // User is creating a handle
        finishHandleCreation(mouse);
        return;
      }
      if ((AddingObjType == '') || (e.which == 3)) {
        // To drag the entire scene
        draggingObj = -3;
        draggingPart = {};
        draggingPart.mouse0 = mouse; // Mouse position when the user starts dragging
        draggingPart.mouse1 = mouse; // Mouse position at the last moment during dragging
        draggingPart.mouse2 = scene.origin; //Original origin.
        draggingPart.snapData = {};
        selectObj(-1);
      }
      else {
        // Create a new object
        scene.objs[scene.objs.length] = objTypes[AddingObjType].create(mouse);
        isConstructing = true;
        constructionPoint = mouse;
        if (scene.objs[selectedObj]) {
          if (scene.objs[selectedObj].type == scene.objs[scene.objs.length - 1].type && scene.objs[selectedObj].p) {
            scene.objs[scene.objs.length - 1].p = scene.objs[selectedObj].p; // Let the property of this obj to be the same as the previously selected obj (if of the same type)
            // TODO: Generalized this to other properties.
          }
        }
        selectObj(scene.objs.length - 1);
        const ret = objTypes[scene.objs[scene.objs.length - 1].type].c_mousedown(scene.objs[scene.objs.length - 1], mouse);
        if (ret && ret.isDone) {
          isConstructing = false;
        }
        if (ret && ret.requiresObjBarUpdate) {
          selectObj(selectedObj);
        }
        if (ret && ret.newUndoPoint) {
          createUndoPoint();
        }
        draw(!(objTypes[scene.objs[scene.objs.length - 1].type].shoot || objTypes[scene.objs[scene.objs.length - 1].type].rayIntersection), true);
        cancelRestore();
      }
    }
  }
}

// search for best object to select at mouse position
function selectionSearch(mouse_nogrid) {
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
      mousePart_ = {};
      if (objTypes[scene.objs[i].type].clicked(scene.objs[i], mouse_nogrid, mouse, mousePart_)) {
        // click(() returns true means the mouse clicked the object

        if (mousePart_.targetPoint || mousePart_.targetPoint_) {
          // The mouse clicked a point
          if (!targetIsPoint) {
            targetIsPoint = true; // If the mouse can click a point, then it must click a point
            results = [];
          }
          var click_lensq_temp = geometry.length_squared(mouse_nogrid, (mousePart_.targetPoint || mousePart_.targetPoint_));
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
  var mouse_nogrid = geometry.point((et.pageX - e.target.offsetLeft - scene.origin.x) / scene.scale, (et.pageY - e.target.offsetTop - scene.origin.y) / scene.scale); // The real position of the mouse
  var mouse2;
  if (scene.grid && !(e.altKey && !isConstructing)) {
    mouse2 = geometry.point(Math.round(((et.pageX - e.target.offsetLeft - scene.origin.x) / scene.scale) / scene.gridSize) * scene.gridSize, Math.round(((et.pageY - e.target.offsetTop - scene.origin.y) / scene.scale) / scene.gridSize) * scene.gridSize);
  }
  else {
    mouse2 = mouse_nogrid;
  }

  if (!isConstructing && draggingObj == -1 && !scene.lockobjs) {
    // highlight object under mouse cursor
    var ret = selectionSearch(mouse_nogrid)[0];
    //console.log(mouse_nogrid);
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
      if (scene.mode == 'observer' && geometry.length_squared(mouse, scene.observer.c) < scene.observer.r * scene.observer.r) {
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = '';
      }
    }
  }

  if (mouse2.x == mouse.x && mouse2.y == mouse.y) {
    return;
  }
  mouse = mouse2;


  if (isConstructing) {
    // highlight object being constructed
    mouseObj = scene.objs[scene.objs.length - 1];

    // If some object is being created, pass the action to it
    const ret = objTypes[scene.objs[scene.objs.length - 1].type].c_mousemove(scene.objs[scene.objs.length - 1], mouse, e.ctrlKey, e.shiftKey);
    if (ret && ret.isDone) {
      isConstructing = false;
    }
    if (ret && ret.requiresObjBarUpdate) {
      selectObj(selectedObj);
    }
    if (ret && ret.newUndoPoint) {
      createUndoPoint();
    }
    draw(!(objTypes[scene.objs[scene.objs.length - 1].type].shoot || objTypes[scene.objs[scene.objs.length - 1].type].rayIntersection), true);
  }
  else {
    if (draggingObj == -4) {
      if (e.shiftKey) {
        var mouse_snapped = snapToDirection(mouse, draggingPart.mouse0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], draggingPart.snapData);
      }
      else {
        var mouse_snapped = mouse;
        draggingPart.snapData = {}; // Unlock the dragging direction when the user release the shift key
      }

      var mouseDiffX = (mouse_snapped.x - draggingPart.mouse1.x); // The X difference between the mouse position now and at the previous moment
      var mouseDiffY = (mouse_snapped.y - draggingPart.mouse1.y); // The Y difference between the mouse position now and at the previous moment

      scene.observer.c.x += mouseDiffX;
      scene.observer.c.y += mouseDiffY;

      // Update the mouse position
      draggingPart.mouse1 = mouse_snapped;
      draw(false, true);
    }

    var returndata;
    if (draggingObj >= 0) {
      // Here the mouse is dragging an object

      objTypes[scene.objs[draggingObj].type].dragging(scene.objs[draggingObj], mouse, draggingPart, e.ctrlKey, e.shiftKey);
      // If dragging an entire object, then when Ctrl is hold, clone the object
      if (draggingPart.part == 0) {
        if (e.ctrlKey && !draggingPart.hasDuplicated) {

          scene.objs[scene.objs.length] = draggingPart.originalObj;
          draggingPart.hasDuplicated = true;
        }
        if (!e.ctrlKey && draggingPart.hasDuplicated) {
          scene.objs.length--;
          draggingPart.hasDuplicated = false;
        }
      }

      draw(!(objTypes[scene.objs[draggingObj].type].shoot || objTypes[scene.objs[draggingObj].type].rayIntersection), true);

      if (draggingPart.requiresObjBarUpdate) {
        selectObj(selectedObj);
      }
    }

    if (draggingObj == -3) {
      // Move the entire scene
      // Here mouse is the currect mouse position, draggingPart.mouse1 is the mouse position at the previous moment

      if (e.shiftKey) {
        var mouse_snapped = snapToDirection(mouse_nogrid, draggingPart.mouse0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], draggingPart.snapData);
      }
      else {
        var mouse_snapped = mouse_nogrid;
        draggingPart.snapData = {}; // Unlock the dragging direction when the user release the shift key
      }

      var mouseDiffX = (mouse_snapped.x - draggingPart.mouse1.x); // The X difference between the mouse position now and at the previous moment
      var mouseDiffY = (mouse_snapped.y - draggingPart.mouse1.y); // The Y difference between the mouse position now and at the previous moment
      scene.origin.x = mouseDiffX * scene.scale + draggingPart.mouse2.x;
      scene.origin.y = mouseDiffY * scene.scale + draggingPart.mouse2.y;
      draw();
    }

    
  }
}

function canvas_onmouseup(e) {
  if (isConstructing) {
    if ((e.which && e.which == 1) || (e.changedTouches)) {
      // If an object is being created, pass the action to it
      const ret = objTypes[scene.objs[scene.objs.length - 1].type].c_mouseup(scene.objs[scene.objs.length - 1], mouse, e.ctrlKey, e.shiftKey);
      if (ret && ret.isDone) {
        isConstructing = false;
      }
      if (ret && ret.requiresObjBarUpdate) {
        selectObj(selectedObj);
      }
      if (ret && ret.newUndoPoint) {
        createUndoPoint();
      }
      draw(!(objTypes[scene.objs[scene.objs.length - 1].type].shoot || objTypes[scene.objs[scene.objs.length - 1].type].rayIntersection), true);
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
    if (e.which && e.which == 3 && draggingObj == -3 && mouse.x == draggingPart.mouse0.x && mouse.y == draggingPart.mouse0.y) {
      draggingObj = -1;
      draggingPart = {};
      canvas_ondblclick(e);
      return;
    }
    if (draggingObj != -3) {
      // If user is moving the view, do not create undo point.
      createUndoPoint();
    }
    draggingObj = -1;
    draggingPart = {};
  }

}

function addControlPointsForHandle(controlPoints) {
  if (!(scene.objs[0].type == "handle" && scene.objs[0].notDone)) {
    scene.objs.unshift(objTypes["handle"].create());
    for (var i in scene.objs) {
      if (scene.objs[i].type == "handle") {
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
    objTypes["handle"].c_addControlPoint(scene.objs[0], controlPoints[i]);
  }
  draw(true, true);
}


function finishHandleCreation(point) {
  objTypes["handle"].c_finishHandle(scene.objs[0], point);
  draw(true, true);
}




function canvas_ondblclick(e) {
  //console.log("dblclick");
  var mouse = geometry.point((e.pageX - e.target.offsetLeft - scene.origin.x) / scene.scale, (e.pageY - e.target.offsetTop - scene.origin.y) / scene.scale); // The real position of the mouse (never use grid here)
  if (isConstructing) {
  }
  else if (mouseOnPoint(mouse, mouse_lastmousedown)) {
    draggingPart = {};
    if (scene.mode == 'observer') {
      if (geometry.length_squared(mouse, scene.observer.c) < scene.observer.r * scene.observer.r) {

        // The mouse clicked the observer
        positioningObj = -4;
        draggingPart = {};
        draggingPart.targetPoint = geometry.point(scene.observer.c.x, scene.observer.c.y);
        draggingPart.snapData = {};

        document.getElementById('xybox').style.left = (draggingPart.targetPoint.x * scene.scale + scene.origin.x) + 'px';
        document.getElementById('xybox').style.top = (draggingPart.targetPoint.y * scene.scale + scene.origin.y) + 'px';
        document.getElementById('xybox').value = '(' + (draggingPart.targetPoint.x) + ',' + (draggingPart.targetPoint.y) + ')';
        document.getElementById('xybox').size = document.getElementById('xybox').value.length;
        document.getElementById('xybox').style.display = '';
        document.getElementById('xybox').select();
        document.getElementById('xybox').setSelectionRange(1, document.getElementById('xybox').value.length - 1);
        //console.log("show xybox");
        xyBox_cancelContextMenu = true;

        return;
      }
    }

    var ret = selectionSearch(mouse)[0];
    if (ret.targetObj_index != -1 && ret.mousePart.targetPoint) {
      selectObj(ret.targetObj_index);
      draggingPart = ret.mousePart;
      draggingPart.originalObj = JSON.parse(JSON.stringify(scene.objs[ret.targetObj_index])); // Store the obj status before dragging

      draggingPart.hasDuplicated = false;
      positioningObj = ret.targetObj_index;

      document.getElementById('xybox').style.left = (draggingPart.targetPoint.x * scene.scale + scene.origin.x) + 'px';
      document.getElementById('xybox').style.top = (draggingPart.targetPoint.y * scene.scale + scene.origin.y) + 'px';
      document.getElementById('xybox').value = '(' + (draggingPart.targetPoint.x) + ',' + (draggingPart.targetPoint.y) + ')';
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
  if (scene.objs[index].type == 'handle') {
    document.getElementById('obj_bar').style.display = 'none';
    return;
  }
  document.getElementById('obj_name').innerHTML = getMsg('toolname_' + scene.objs[index].type);
  document.getElementById('showAdvanced').style.display = 'none';
  document.getElementById('showAdvanced_mobile_container').style.display = 'none';
  if (objTypes[scene.objs[index].type].populateObjBar) {
    document.getElementById('obj_bar_main').style.display = '';
    document.getElementById('obj_bar_main').innerHTML = '';
    objTypes[scene.objs[index].type].populateObjBar(scene.objs[index], objBar);

    if (document.getElementById('obj_bar_main').innerHTML != '') {
      for (var i = 0; i < scene.objs.length; i++) {
        if (i != selectedObj && scene.objs[i].type == scene.objs[selectedObj].type) {
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
  }
  else {
    document.getElementById('obj_bar_main').style.display = 'none';
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
      objTypes[scene.objs[positioningObj].type].dragging(scene.objs[positioningObj], geometry.point(xyData[0], xyData[1]), draggingPart, ctrl, shift);
      draw(!(objTypes[scene.objs[positioningObj].type].shoot || objTypes[scene.objs[positioningObj].type].rayIntersection), true);
    }
    
    createUndoPoint();
  }

  endPositioning();
}

function endPositioning() {
  document.getElementById('xybox').style.display = 'none';
  positioningObj = -1;
  draggingPart = {};
}

function removeObj(index) {
  for (var i = index; i < scene.objs.length - 1; i++) {
    scene.objs[i] = JSON.parse(JSON.stringify(scene.objs[i + 1]));
  }

  for (var i in scene.objs) {
    if (scene.objs[i].type == "handle") {
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
  if (scene.objs[index].type == "handle") {
    var indices = [];
    for (var j in scene.objs[index].controlPoints) {
      if (indices.indexOf(scene.objs[index].controlPoints[j].targetObj_index) == -1) {
        indices.push(scene.objs[index].controlPoints[j].targetObj_index);
      }
    }
    //console.log(indices);
    for (var j in indices) {
      if (scene.objs[indices[j]].type != "handle") {
        cloneObj(indices[j]);
      }
    }
  } else {
    scene.objs[scene.objs.length] = JSON.parse(JSON.stringify(scene.objs[index]));
  }
}


function createUndoPoint() {
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
  if (isConstructing && !(scene.objs.length > 0 && scene.objs[scene.objs.length - 1].type == 'drawing')) {
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
