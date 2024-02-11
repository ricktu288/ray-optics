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

var gridSize = 20; // Size of the grid
var origin = { x: 0, y: 0 }; // Origin of the grid

var pendingControlPointSelection = false;
var pendingControlPoints;

function getMouseStyle(obj, style, screen) {
  if (obj == mouseObj && mouseObj)
    return (screen && colorMode) ? 'rgb(0,100,100)' : 'rgb(0,255,255)'
  return style;
}

function getClickExtent(isPoint, isConstruct) {
  if (isPoint) {
    if (isConstruct) {
      var clickExtent = clickExtent_point_construct / scale;
    } else {
      var clickExtent = clickExtent_point / scale;
    }
  } else {
    var clickExtent = clickExtent_line / scale;
  }
  if (lastDeviceIsTouch) {
    clickExtent *= touchscreenExtentRatio;
  }
  return clickExtent;
}

function mouseOnPoint(mouse, point) {
  return graphs.length_squared(mouse, point) < getClickExtent(true) * getClickExtent(true);
}

function mouseOnPoint_construct(mouse, point) {
  return graphs.length_squared(mouse, point) < getClickExtent(true, true) * getClickExtent(true, true);
}

function mouseOnSegment(mouse, segment) {
  var d_per = Math.pow((mouse.x - segment.p1.x) * (segment.p1.y - segment.p2.y) + (mouse.y - segment.p1.y) * (segment.p2.x - segment.p1.x), 2) / ((segment.p1.y - segment.p2.y) * (segment.p1.y - segment.p2.y) + (segment.p2.x - segment.p1.x) * (segment.p2.x - segment.p1.x)); // Similar to the distance between the mouse and the line
  var d_par = (segment.p2.x - segment.p1.x) * (mouse.x - segment.p1.x) + (segment.p2.y - segment.p1.y) * (mouse.y - segment.p1.y); // Similar to the projected point of the mouse on the line
  return d_per < getClickExtent() * getClickExtent() && d_par >= 0 && d_par <= graphs.length_segment_squared(segment);
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
    return graphs.point(basePoint.x + k * directions[snapData.i0].x, basePoint.y + k * directions[snapData.i0].y);
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
    return graphs.point(basePoint.x + k * directions[i0].x, basePoint.y + k * directions[i0].y);
  }
}

function canvas_onmousedown(e) {
  if (e.changedTouches) {
    var et = e.changedTouches[0];
  } else {
    var et = e;
  }
  var mouse_nogrid = graphs.point((et.pageX - e.target.offsetLeft - origin.x) / scale, (et.pageY - e.target.offsetTop - origin.y) / scale); // The real position of the mouse
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

  if (document.getElementById('grid').checked) {
    mouse = graphs.point(Math.round(((et.pageX - e.target.offsetLeft - origin.x) / scale) / gridSize) * gridSize, Math.round(((et.pageY - e.target.offsetTop - origin.y) / scale) / gridSize) * gridSize);

  }
  else {
    mouse = mouse_nogrid;
  }


  if (isConstructing) {
    if ((e.which && e.which == 1) || (e.changedTouches)) {
      // Only react for left click
      // If an obj is being created, pass the action to it
      objTypes[scene.objsRefactored[scene.objsRefactored.length - 1].type].c_mousedown(scene.objsRefactored[scene.objsRefactored.length - 1], mouse, e.ctrlKey, e.shiftKey);
      draw(!(objTypes[scene.objsRefactored[scene.objsRefactored.length - 1].type].shoot || objTypes[scene.objsRefactored[scene.objsRefactored.length - 1].type].rayIntersection), true);
    }
  }
  else {
    // lockobjs prevents selection, but alt overrides it
    if ((!(document.getElementById('lockobjs').checked) != (e.altKey && AddingObjType != '')) && !(e.which == 3)) {

      draggingPart = {};

      if (scene.modeRefactored == 'observer') {
        if (graphs.length_squared(mouse_nogrid, observer.c) < observer.r * observer.r) {
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
        if (!e.ctrlKey && scene.objsRefactored.length > 0 && scene.objsRefactored[0].type == "handle" && scene.objsRefactored[0].notDone) {
          // User is creating a handle
          removeObj(0);
          ret.targetObj_index--;
        }
        selectObj(ret.targetObj_index);
        draggingPart = ret.mousePart;
        draggingPart.originalObj = JSON.parse(JSON.stringify(scene.objsRefactored[ret.targetObj_index])); // Store the obj status before dragging
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
      if (scene.objsRefactored.length > 0 && scene.objsRefactored[0].type == "handle" && scene.objsRefactored[0].notDone) {
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
        draggingPart.mouse2 = origin; //Original origin.
        draggingPart.snapData = {};
        selectObj(-1);
      }
      else {
        // Create a new object
        scene.objsRefactored[scene.objsRefactored.length] = objTypes[AddingObjType].create(mouse);
        isConstructing = true;
        constructionPoint = mouse;
        if (scene.objsRefactored[selectedObj]) {
          if (hasSameAttrType(scene.objsRefactored[selectedObj], scene.objsRefactored[scene.objsRefactored.length - 1]) && scene.objsRefactored[selectedObj].p) {
            scene.objsRefactored[scene.objsRefactored.length - 1].p = scene.objsRefactored[selectedObj].p; // Let the property of this obj to be the same as the previously selected obj (if of the same type)
            // TODO: Generalized this to other properties.
          }
        }
        selectObj(scene.objsRefactored.length - 1);
        objTypes[scene.objsRefactored[scene.objsRefactored.length - 1].type].c_mousedown(scene.objsRefactored[scene.objsRefactored.length - 1], mouse);
        draw(!(objTypes[scene.objsRefactored[scene.objsRefactored.length - 1].type].shoot || objTypes[scene.objsRefactored[scene.objsRefactored.length - 1].type].rayIntersection), true);
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

  for (var i = 0; i < scene.objsRefactored.length; i++) {
    if (typeof scene.objsRefactored[i] != 'undefined') {
      mousePart_ = {};
      if (objTypes[scene.objsRefactored[i].type].clicked(scene.objsRefactored[i], mouse_nogrid, mouse, mousePart_)) {
        // click(() returns true means the mouse clicked the object

        if (mousePart_.targetPoint || mousePart_.targetPoint_) {
          // The mouse clicked a point
          if (!targetIsPoint) {
            targetIsPoint = true; // If the mouse can click a point, then it must click a point
            results = [];
          }
          var click_lensq_temp = graphs.length_squared(mouse_nogrid, (mousePart_.targetPoint || mousePart_.targetPoint_));
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
  var mouse_nogrid = graphs.point((et.pageX - e.target.offsetLeft - origin.x) / scale, (et.pageY - e.target.offsetTop - origin.y) / scale); // The real position of the mouse
  var mouse2;
  if (document.getElementById('grid').checked && !(e.altKey && !isConstructing)) {
    mouse2 = graphs.point(Math.round(((et.pageX - e.target.offsetLeft - origin.x) / scale) / gridSize) * gridSize, Math.round(((et.pageY - e.target.offsetTop - origin.y) / scale) / gridSize) * gridSize);
  }
  else {
    mouse2 = mouse_nogrid;
  }

  if (!isConstructing && draggingObj == -1 && !document.getElementById('lockobjs').checked) {
    // highlight object under mouse cursor
    var ret = selectionSearch(mouse_nogrid)[0];
    //console.log(mouse_nogrid);
    var newMouseObj = (ret.targetObj_index == -1) ? null : scene.objsRefactored[ret.targetObj_index];
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
      if (scene.modeRefactored == 'observer' && graphs.length_squared(mouse, observer.c) < observer.r * observer.r) {
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
    mouseObj = scene.objsRefactored[scene.objsRefactored.length - 1];

    // If some object is being created, pass the action to it
    objTypes[scene.objsRefactored[scene.objsRefactored.length - 1].type].c_mousemove(scene.objsRefactored[scene.objsRefactored.length - 1], mouse, e.ctrlKey, e.shiftKey);
    draw(!(objTypes[scene.objsRefactored[scene.objsRefactored.length - 1].type].shoot || objTypes[scene.objsRefactored[scene.objsRefactored.length - 1].type].rayIntersection), true);
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

      observer.c.x += mouseDiffX;
      observer.c.y += mouseDiffY;

      // Update the mouse position
      draggingPart.mouse1 = mouse_snapped;
      draw(false, true);
    }

    var returndata;
    if (draggingObj >= 0) {
      // Here the mouse is dragging an object

      objTypes[scene.objsRefactored[draggingObj].type].dragging(scene.objsRefactored[draggingObj], mouse, draggingPart, e.ctrlKey, e.shiftKey);
      // If dragging an entire object, then when Ctrl is hold, clone the object
      if (draggingPart.part == 0) {
        if (e.ctrlKey && !draggingPart.hasDuplicated) {

          scene.objsRefactored[scene.objsRefactored.length] = draggingPart.originalObj;
          draggingPart.hasDuplicated = true;
        }
        if (!e.ctrlKey && draggingPart.hasDuplicated) {
          scene.objsRefactored.length--;
          draggingPart.hasDuplicated = false;
        }
      }

      draw(!(objTypes[scene.objsRefactored[draggingObj].type].shoot || objTypes[scene.objsRefactored[draggingObj].type].rayIntersection), true);

      if (draggingPart.requiresPBoxUpdate) {
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
      origin.x = mouseDiffX * scale + draggingPart.mouse2.x;
      origin.y = mouseDiffY * scale + draggingPart.mouse2.y;
      draw();
    }

    
  }
}

function canvas_onmouseup(e) {
  if (isConstructing) {
    if ((e.which && e.which == 1) || (e.changedTouches)) {
      // If an object is being created, pass the action to it
      objTypes[scene.objsRefactored[scene.objsRefactored.length - 1].type].c_mouseup(scene.objsRefactored[scene.objsRefactored.length - 1], mouse, e.ctrlKey, e.shiftKey);
      draw(!(objTypes[scene.objsRefactored[scene.objsRefactored.length - 1].type].shoot || objTypes[scene.objsRefactored[scene.objsRefactored.length - 1].type].rayIntersection), true);
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
  if (!(scene.objsRefactored[0].type == "handle" && scene.objsRefactored[0].notDone)) {
    scene.objsRefactored.unshift(objTypes["handle"].create());
    for (var i in scene.objsRefactored) {
      if (scene.objsRefactored[i].type == "handle") {
        for (var j in scene.objsRefactored[i].controlPoints) {
          scene.objsRefactored[i].controlPoints[j].targetObj_index++;
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
    objTypes["handle"].c_addControlPoint(scene.objsRefactored[0], controlPoints[i]);
  }
  draw(true, true);
}


function finishHandleCreation(point) {
  objTypes["handle"].c_finishHandle(scene.objsRefactored[0], point);
  draw(true, true);
}




function canvas_ondblclick(e) {
  //console.log("dblclick");
  var mouse = graphs.point((e.pageX - e.target.offsetLeft - origin.x) / scale, (e.pageY - e.target.offsetTop - origin.y) / scale); // The real position of the mouse (never use grid here)
  if (isConstructing) {
  }
  else if (mouseOnPoint(mouse, mouse_lastmousedown)) {
    draggingPart = {};
    if (scene.modeRefactored == 'observer') {
      if (graphs.length_squared(mouse, observer.c) < observer.r * observer.r) {

        // The mouse clicked the observer
        positioningObj = -4;
        draggingPart = {};
        draggingPart.targetPoint = graphs.point(observer.c.x, observer.c.y);
        draggingPart.snapData = {};

        document.getElementById('xybox').style.left = (draggingPart.targetPoint.x * scale + origin.x) + 'px';
        document.getElementById('xybox').style.top = (draggingPart.targetPoint.y * scale + origin.y) + 'px';
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
      draggingPart.originalObj = JSON.parse(JSON.stringify(scene.objsRefactored[ret.targetObj_index])); // Store the obj status before dragging

      draggingPart.hasDuplicated = false;
      positioningObj = ret.targetObj_index;

      document.getElementById('xybox').style.left = (draggingPart.targetPoint.x * scale + origin.x) + 'px';
      document.getElementById('xybox').style.top = (draggingPart.targetPoint.y * scale + origin.y) + 'px';
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
  var d = scale;
  if (delta < 0) {
    d = scale - 0.25;
  } else if (delta > 0) {
    d = scale + 0.25;
  }
  d = Math.max(0.25, Math.min(5.00, d)) * 100;
  setScaleWithCenter(d / 100, (e.pageX - e.target.offsetLeft) / scale, (e.pageY - e.target.offsetTop) / scale);
  //window.toolBarViewModel.zoom.value(d);
  canvas_onmousemove(e);
  return false;
}


function selectObj(index) {
  hideAllPopovers();
  if (pendingPBoxEvent) {
    // If the user is in the middle of editing a value, then clearing the innerHTML of p_box will cause the change event not to fire, so we need to manually fire it.
    pendingPBoxEvent();
    pendingPBoxEvent = null;
  }

  if (index < 0 || index >= scene.objsRefactored.length) {
    // If this object does not exist
    selectedObj = -1;
    document.getElementById('obj_settings').style.display = 'none';
    showAdvancedOn = false;
    return;
  }
  selectedObj = index;
  if (scene.objsRefactored[index].type == 'handle') {
    document.getElementById('obj_settings').style.display = 'none';
    return;
  }
  document.getElementById('obj_name').innerHTML = getMsg('toolname_' + scene.objsRefactored[index].type);
  document.getElementById('showAdvanced').style.display = 'none';
  document.getElementById('showAdvanced_mobile_container').style.display = 'none';
  if (objTypes[scene.objsRefactored[index].type].p_box) {
    document.getElementById('p_box').style.display = '';
    document.getElementById('p_box').innerHTML = '';
    objTypes[scene.objsRefactored[index].type].p_box(scene.objsRefactored[index], document.getElementById('p_box'));

    if (document.getElementById('p_box').innerHTML != '') {
      for (var i = 0; i < scene.objsRefactored.length; i++) {
        if (i != selectedObj && hasSameAttrType(scene.objsRefactored[i], scene.objsRefactored[selectedObj])) {
          // If there is an object with the same type, then show "Apply to All"
          document.getElementById('setAttrAll_box').style.display = '';
          document.getElementById('applytoall_mobile_container').style.display = '';
          break;
        }
        if (i == scene.objsRefactored.length - 1) {
          document.getElementById('setAttrAll_box').style.display = 'none';
          document.getElementById('applytoall_mobile_container').style.display = 'none';
        }
      }
    } else {
      document.getElementById('setAttrAll_box').style.display = 'none';
      document.getElementById('applytoall_mobile_container').style.display = 'none';
    }
  }
  else {
    document.getElementById('p_box').style.display = 'none';
    document.getElementById('setAttrAll_box').style.display = 'none';
    document.getElementById('applytoall_mobile_container').style.display = 'none';
  }

  document.getElementById('obj_settings').style.display = '';
}


function confirmPositioning(ctrl, shift) {
  var xyData = JSON.parse('[' + document.getElementById('xybox').value.replace(/\(|\)/g, '') + ']');
  // Only do the action when the user enter two numbers (coordinates)
  if (xyData.length == 2) {
    if (positioningObj == -4) {
      // Observer
      observer.c.x = xyData[0];
      observer.c.y = xyData[1];
      draw(false, true);
    }
    else {
      // Object
      objTypes[scene.objsRefactored[positioningObj].type].dragging(scene.objsRefactored[positioningObj], graphs.point(xyData[0], xyData[1]), draggingPart, ctrl, shift);
      draw(!(objTypes[scene.objsRefactored[positioningObj].type].shoot || objTypes[scene.objsRefactored[positioningObj].type].rayIntersection), true);
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
  for (var i = index; i < scene.objsRefactored.length - 1; i++) {
    scene.objsRefactored[i] = JSON.parse(JSON.stringify(scene.objsRefactored[i + 1]));
  }

  for (var i in scene.objsRefactored) {
    if (scene.objsRefactored[i].type == "handle") {
      for (var j in scene.objsRefactored[i].controlPoints) {
        if (scene.objsRefactored[i].controlPoints[j].targetObj_index > index) {
          scene.objsRefactored[i].controlPoints[j].targetObj_index--;
        } else if (scene.objsRefactored[i].controlPoints[j].targetObj_index == index) {
          scene.objsRefactored[i].controlPoints = [];
          break;
        }
      }
    }
  }

  isConstructing = false;
  scene.objsRefactored.length = scene.objsRefactored.length - 1;
  selectedObj--;
  selectObj(selectedObj);
}

function cloneObj(index) {
  if (scene.objsRefactored[index].type == "handle") {
    var indices = [];
    for (var j in scene.objsRefactored[index].controlPoints) {
      if (indices.indexOf(scene.objsRefactored[index].controlPoints[j].targetObj_index) == -1) {
        indices.push(scene.objsRefactored[index].controlPoints[j].targetObj_index);
      }
    }
    //console.log(indices);
    for (var j in indices) {
      if (scene.objsRefactored[indices[j]].type != "handle") {
        cloneObj(indices[j]);
      }
    }
  } else {
    scene.objsRefactored[scene.objsRefactored.length] = JSON.parse(JSON.stringify(scene.objsRefactored[index]));
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
  if (isConstructing && !(scene.objsRefactored.length > 0 && scene.objsRefactored[scene.objsRefactored.length - 1].type == 'drawing')) {
    // If the user is constructing an object when clicked the undo, then only stop the consturction rather than do the real undo

    isConstructing = false;
    scene.objsRefactored.length--;
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
