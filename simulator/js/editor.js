var mouse; //滑鼠位置 Position of the mouse
var mouse_lastmousedown; //上一次按下滑鼠時的滑鼠位置 Position of the mouse the last time when the user clicked
var isConstructing = false; //正在建立新的物件 The user is constructing a new object
var constructionPoint; //建立物件的起始位置 The point where the user starts the construction
var draggingObj = -1; //拖曳中的物件編號(-1表示沒有拖曳,-3表示整個畫面,-4表示觀察者) Object index in drag (-1 for no drag, -3 for the entire picture, -4 for observer)
var positioningObj = -1; //輸入座標中的物件編號(-1表示沒有,-4表示觀察者) Object index in entering the coordinates (-1 for none, -4 for observer)
var draggingPart = {}; //拖曳的部份與滑鼠位置資訊 The part in drag and some mouse position data
var selectedObj = -1; //選取的物件編號(-1表示沒有選取) The index of the selected object (-1 for none)
var mouseObj = -1;
var mousePart = {};
var AddingObjType = ''; //拖曳空白處新增物件的類型 The type of the object to add when user click the canvas
var undoArr = []; //復原資料 Undo data
var undoIndex = 0; //目前復原的位置 Current undo position
var undoLimit = 20; //復原步數上限 Limit of undo
var undoUBound = 0; //目前復原資料上界 Current upper bound of undo data
var undoLBound = 0; //目前復原資料下界 Current lower bound of undo data
var snapToDirection_lockLimit_squared = 900; //拖曳物件且使用吸附至方向功能時鎖定吸附之方向所需的拖曳距離之平方 The square of the legnth needed to snap to a direction when dragging an object with snap-to-direction
var clickExtent_line = 10;
var clickExtent_point = 10;
var clickExtent_point_construct = 10;

var gridSize = 20; //格線大小 Size of the grid
var origin = { x: 0, y: 0 }; //格線原點座標 Origin of the grid

var pendingControlPointSelection = false;
var pendingControlPoints;

function getMouseStyle(obj, style, screen) {
  if (obj == mouseObj && mouseObj)
    return (screen && colorMode) ? 'rgb(0,100,100)' : 'rgb(0,255,255)'
  return style;
}

function mouseOnPoint(mouse, point) {
  return graphs.length_squared(mouse, point) < clickExtent_point * clickExtent_point;
}

function mouseOnPoint_construct(mouse, point) {
  return graphs.length_squared(mouse, point) < clickExtent_point_construct * clickExtent_point_construct;
}

function mouseOnSegment(mouse, segment) {
  var d_per = Math.pow((mouse.x - segment.p1.x) * (segment.p1.y - segment.p2.y) + (mouse.y - segment.p1.y) * (segment.p2.x - segment.p1.x), 2) / ((segment.p1.y - segment.p2.y) * (segment.p1.y - segment.p2.y) + (segment.p2.x - segment.p1.x) * (segment.p2.x - segment.p1.x)); //類似於滑鼠與直線垂直距離 Similar to the distance between the mouse and the line
  var d_par = (segment.p2.x - segment.p1.x) * (mouse.x - segment.p1.x) + (segment.p2.y - segment.p1.y) * (mouse.y - segment.p1.y); //類似於滑鼠在直線上投影位置 Similar to the projected point of the mouse on the line
  return d_per < clickExtent_line * clickExtent_line && d_par >= 0 && d_par <= graphs.length_segment_squared(segment);
}

function mouseOnLine(mouse, line) {
  var d_per = Math.pow((mouse.x - line.p1.x) * (line.p1.y - line.p2.y) + (mouse.y - line.p1.y) * (line.p2.x - line.p1.x), 2) / ((line.p1.y - line.p2.y) * (line.p1.y - line.p2.y) + (line.p2.x - line.p1.x) * (line.p2.x - line.p1.x)); //類似於滑鼠與直線垂直距離 Similar to the distance between the mouse and the line
  return d_per < clickExtent_line * clickExtent_line;
}

//將滑鼠位置吸附至指定的方向中之最接近者(該方向直線上之投影點) Snap the mouse position to the direction nearest to the given directions
function snapToDirection(mouse, basePoint, directions, snapData) {
  var x = mouse.x - basePoint.x;
  var y = mouse.y - basePoint.y;

  if (snapData && snapData.locked) {
    //已經鎖定吸附對象 The snap has been locked
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
      //鎖定吸附對象 lock the snap
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
  var mouse_nogrid = graphs.point((et.pageX - e.target.offsetLeft - origin.x) / scale, (et.pageY - e.target.offsetTop - origin.y) / scale); //滑鼠實際位置 The real position of the mouse
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
      //只有滑鼠左鍵才反應 Only react for left click
      //若有一個物件正在被建立,則將動作直接傳給它 If an obj is being created, pass the action to it
      objTypes[objs[objs.length - 1].type].c_mousedown(objs[objs.length - 1], mouse, e.ctrlKey, e.shiftKey);
    }
  }
  else {
    // lockobjs prevents selection, but alt overrides it
    if ((!(document.getElementById('lockobjs').checked) != (e.altKey && AddingObjType != '')) && !(e.which == 3)) {

      draggingPart = {};

      if (mode == 'observer') {
        if (graphs.length_squared(mouse_nogrid, observer.c) < observer.r * observer.r) {
          //滑鼠按到觀察者 The mouse clicked the observer
          draggingObj = -4;
          draggingPart = {};
          //draggingPart.part=0;
          draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置 Mouse position when the user starts dragging
          draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置 Mouse position at the last moment during dragging
          draggingPart.snapData = {};
          return;
        }
      }

      var rets = selectionSearch(mouse_nogrid);
      var ret = rets[0];
      if (ret.targetObj_index != -1) {
        if (!e.ctrlKey && objs.length > 0 && objs[0].type == "handle" && objs[0].notDone) {
          // User is creating a handle
          removeObj(0);
          ret.targetObj_index--;
        }
        selectObj(ret.targetObj_index);
        draggingPart = ret.mousePart;
        draggingPart.originalObj = JSON.parse(JSON.stringify(objs[ret.targetObj_index])); //暫存拖曳前的物件狀態 Store the obj status before dragging
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
      //滑鼠按到了空白處 The mouse clicked the blank area
      if (objs.length > 0 && objs[0].type == "handle" && objs[0].notDone) {
        // User is creating a handle
        finishHandleCreation(mouse);
        return;
      }
      if ((AddingObjType == '') || (e.which == 3)) {
        //準備平移整個畫面 To drag the entire scene
        draggingObj = -3;
        draggingPart = {};
        draggingPart.mouse0 = mouse; //開始拖曳時的滑鼠位置 Mouse position when the user starts dragging
        draggingPart.mouse1 = mouse; //拖曳時上一點的滑鼠位置 Mouse position at the last moment during dragging
        draggingPart.mouse2 = origin; //Original origin.
        draggingPart.snapData = {};
        selectObj(-1);
      }
      else {
        //建立新的物件 Create a new object
        objs[objs.length] = objTypes[AddingObjType].create(mouse);
        isConstructing = true;
        constructionPoint = mouse;
        if (objs[selectedObj]) {
          if (hasSameAttrType(objs[selectedObj], objs[objs.length - 1]) && objs[selectedObj].p) {
            objs[objs.length - 1].p = objs[selectedObj].p; //讓此物件的附加屬性與上一個選取的物件相同(若類型相同) Let the property of this obj to be the same as the previously selected obj (if of the same type)
            // TODO: Generalized this to other properties.
          }
        }
        selectObj(objs.length - 1);
        objTypes[objs[objs.length - 1].type].c_mousedown(objs[objs.length - 1], mouse);
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

  for (var i = 0; i < objs.length; i++) {
    if (typeof objs[i] != 'undefined') {
      mousePart_ = {};
      if (objTypes[objs[i].type].clicked(objs[i], mouse_nogrid, mouse, mousePart_)) {
        //clicked()回傳true表示滑鼠按到了該物件 click(() returns true means the mouse clicked the object

        if (mousePart_.targetPoint || mousePart_.targetPoint_) {
          //滑鼠按到一個點 The mouse clicked a point
          if (!targetIsPoint) {
            targetIsPoint = true; //一旦發現能夠按到點,就必須按到點 If the mouse can click a point, then it must click a point
            results = [];
          }
          var click_lensq_temp = graphs.length_squared(mouse_nogrid, (mousePart_.targetPoint || mousePart_.targetPoint_));
          if (click_lensq_temp <= click_lensq || targetObj_index == selectedObj) {
            //按到點的情況下,選擇最接近滑鼠的 In case of clicking a point, choose the one nearest to the mouse
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
          //滑鼠按到的不是點,且到目前為止未按到點 If not clicking a point, and until now not clicking any point
          targetObj_index = i; //按到非點的情況下,選擇最後建立的 If clicking non-point, choose the most newly created one
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
  var mouse_nogrid = graphs.point((et.pageX - e.target.offsetLeft - origin.x) / scale, (et.pageY - e.target.offsetTop - origin.y) / scale); //滑鼠實際位置 The real position of the mouse
  var mouse2;
  if (document.getElementById('grid').checked && !(e.altKey && !isConstructing)) {
    mouse2 = graphs.point(Math.round(((et.pageX - e.target.offsetLeft - origin.x) / scale) / gridSize) * gridSize, Math.round(((et.pageY - e.target.offsetTop - origin.y) / scale) / gridSize) * gridSize);
  }
  else {
    mouse2 = mouse_nogrid;
  }

  if (mouse2.x == mouse.x && mouse2.y == mouse.y) {
    return;
  }
  mouse = mouse2;


  if (isConstructing) {
    // highlight object being constructed
    mouseObj = objs[objs.length - 1];

    //若有一個物件正在被建立,則將動作直接傳給它 If some object is being created, pass the action to it
    objTypes[objs[objs.length - 1].type].c_mousemove(objs[objs.length - 1], mouse, e.ctrlKey, e.shiftKey);
  }
  else {
    var instantObserver = mode == 'observed_light' || mode == 'observed_images';
    if (draggingObj == -4) {
      if (e.shiftKey) {
        var mouse_snapped = snapToDirection(mouse, draggingPart.mouse0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], draggingPart.snapData);
      }
      else {
        var mouse_snapped = mouse;
        draggingPart.snapData = {}; //放開shift時解除原先之拖曳方向鎖定 Unlock the dragging direction when the user release the shift key
      }

      var mouseDiffX = (mouse_snapped.x - draggingPart.mouse1.x); //目前滑鼠位置與上一次的滑鼠位置的X軸差 The X difference between the mouse position now and at the previous moment
      var mouseDiffY = (mouse_snapped.y - draggingPart.mouse1.y); //目前滑鼠位置與上一次的滑鼠位置的Y軸差 The Y difference between the mouse position now and at the previous moment

      observer.c.x += mouseDiffX;
      observer.c.y += mouseDiffY;

      //更新滑鼠位置 Update the mouse position
      draggingPart.mouse1 = mouse_snapped;
      draw();
    }

    var returndata;
    if (draggingObj >= 0) {
      //此時,代表滑鼠正在拖曳一個物件 Here the mouse is dragging an object

      objTypes[objs[draggingObj].type].dragging(objs[draggingObj], mouse, draggingPart, e.ctrlKey, e.shiftKey);
      //如果正在拖曳整個物件,則按Ctrl鍵時複製原物件 If dragging an entire object, then when Ctrl is hold, clone the object
      if (draggingPart.part == 0) {
        if (e.ctrlKey && !draggingPart.hasDuplicated) {

          objs[objs.length] = draggingPart.originalObj;
          draggingPart.hasDuplicated = true;
        }
        if (!e.ctrlKey && draggingPart.hasDuplicated) {
          objs.length--;
          draggingPart.hasDuplicated = false;
        }
      }

      draw();
    }

    if (draggingObj == -3) {
      //平移整個畫面 Move the entire scene
      //此時mouse為目前滑鼠位置,draggingPart.mouse1為上一次的滑鼠位置 Here mouse is the currect mouse position, draggingPart.mouse1 is the mouse position at the previous moment

      if (e.shiftKey) {
        var mouse_snapped = snapToDirection(mouse_nogrid, draggingPart.mouse0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], draggingPart.snapData);
      }
      else {
        var mouse_snapped = mouse_nogrid;
        draggingPart.snapData = {}; //放開shift時解除原先之拖曳方向鎖定 Unlock the dragging direction when the user release the shift key
      }

      var mouseDiffX = (mouse_snapped.x - draggingPart.mouse1.x); //目前滑鼠位置與上一次的滑鼠位置的X軸差 The X difference between the mouse position now and at the previous moment
      var mouseDiffY = (mouse_snapped.y - draggingPart.mouse1.y); //目前滑鼠位置與上一次的滑鼠位置的Y軸差 The Y difference between the mouse position now and at the previous moment
      origin.x = mouseDiffX * scale + draggingPart.mouse2.x;
      origin.y = mouseDiffY * scale + draggingPart.mouse2.y;
      draw();
    }

    if (draggingObj == -1 && !document.getElementById('lockobjs').checked) {
      // highlight object under mouse cursor
      var ret = selectionSearch(mouse_nogrid)[0];
      var newMouseObj = (ret.targetObj_index == -1) ? null : objs[ret.targetObj_index];
      if (mouseObj != newMouseObj) {
        mouseObj = newMouseObj;
        draw();
      }
    }
  }
}

function canvas_onmouseup(e) {
  if (isConstructing) {
    if ((e.which && e.which == 1) || (e.changedTouches)) {
      //若有一個物件正在被建立,則將動作直接傳給它 If an object is being created, pass the action to it
      objTypes[objs[objs.length - 1].type].c_mouseup(objs[objs.length - 1], mouse, e.ctrlKey, e.shiftKey);
      if (!isConstructing) {
        //該物件已經表示建立完畢 The object says the contruction is done
        createUndoPoint();
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
  if (!(objs[0].type == "handle" && objs[0].notDone)) {
    objs.unshift(objTypes["handle"].create());
    for (var i in objs) {
      if (objs[i].type == "handle") {
        for (var j in objs[i].controlPoints) {
          objs[i].controlPoints[j].targetObj_index++;
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
    objTypes["handle"].c_addControlPoint(objs[0], controlPoints[i]);
  }
  draw();
}


function finishHandleCreation(point) {
  objTypes["handle"].c_finishHandle(objs[0], point);
  draw();
}




function canvas_ondblclick(e) {
  console.log("dblclick");
  var mouse = graphs.point((e.pageX - e.target.offsetLeft - origin.x) / scale, (e.pageY - e.target.offsetTop - origin.y) / scale); //滑鼠實際位置(一律不使用格線) The real position of the mouse (never use grid here)
  if (isConstructing) {
  }
  else if (mouseOnPoint(mouse, mouse_lastmousedown)) {
    draggingPart = {};
    if (mode == 'observer') {
      if (graphs.length_squared(mouse, observer.c) < observer.r * observer.r) {

        //滑鼠按到觀察者 The mouse clicked the observer
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
        console.log("show xybox");
        xyBox_cancelContextMenu = true;

        return;
      }
    }

    var ret = selectionSearch(mouse)[0];
    if (ret.targetObj_index != -1 && ret.mousePart.targetPoint) {
      selectObj(ret.targetObj_index);
      draggingPart = ret.mousePart;
      draggingPart.originalObj = JSON.parse(JSON.stringify(objs[ret.targetObj_index])); //暫存拖曳前的物件狀態 Store the obj status before dragging

      draggingPart.hasDuplicated = false;
      positioningObj = ret.targetObj_index;

      document.getElementById('xybox').style.left = (draggingPart.targetPoint.x * scale + origin.x) + 'px';
      document.getElementById('xybox').style.top = (draggingPart.targetPoint.y * scale + origin.y) + 'px';
      document.getElementById('xybox').value = '(' + (draggingPart.targetPoint.x) + ',' + (draggingPart.targetPoint.y) + ')';
      document.getElementById('xybox').size = document.getElementById('xybox').value.length;
      document.getElementById('xybox').style.display = '';
      document.getElementById('xybox').select();
      document.getElementById('xybox').setSelectionRange(1, document.getElementById('xybox').value.length - 1);
      console.log("show xybox");
      xyBox_cancelContextMenu = true;
    }
  }

}


function canvas_onmousewheel(e) {
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
  return false;
}


function selectObj(index) {
  hideAllPopovers();

  if (index < 0 || index >= objs.length) {
    //若此物件不存在 If this object does not exist
    selectedObj = -1;
    document.getElementById('obj_settings').style.display = 'none';
    showAdvancedOn = false;
    return;
  }
  selectedObj = index;
  if (objs[index].type == 'handle') {
    document.getElementById('obj_settings').style.display = 'none';
    return;
  }
  document.getElementById('obj_name').innerHTML = getMsg('toolname_' + objs[index].type);
  document.getElementById('showAdvanced').style.display = 'none';
  document.getElementById('showAdvanced_mobile_container').style.display = 'none';
  if (objTypes[objs[index].type].p_box) {
    document.getElementById('p_box').style.display = '';
    document.getElementById('p_box').innerHTML = '';
    objTypes[objs[index].type].p_box(objs[index], document.getElementById('p_box'));

    if (document.getElementById('p_box').innerHTML != '') {
      for (var i = 0; i < objs.length; i++) {
        if (i != selectedObj && hasSameAttrType(objs[i], objs[selectedObj])) {
          //若有另一個相同type的物件,則顯示"套用全部"選項 If there is an object with the same type, then show "Apply to All"
          document.getElementById('setAttrAll_box').style.display = '';
          document.getElementById('applytoall_mobile_container').style.display = '';
          break;
        }
        if (i == objs.length - 1) {
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
  //只有當輸入兩個數值(座標)時才進行動作 Only do the action when the user enter two numbers (coordinates)
  if (xyData.length == 2) {
    if (positioningObj == -4) {
      //觀察者 Observer
      observer.c.x = xyData[0];
      observer.c.y = xyData[1];
    }
    else {
      //物件 Object
      objTypes[objs[positioningObj].type].dragging(objs[positioningObj], graphs.point(xyData[0], xyData[1]), draggingPart, ctrl, shift);
    }
    draw();
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
  for (var i = index; i < objs.length - 1; i++) {
    objs[i] = JSON.parse(JSON.stringify(objs[i + 1]));
  }

  for (var i in objs) {
    if (objs[i].type == "handle") {
      for (var j in objs[i].controlPoints) {
        if (objs[i].controlPoints[j].targetObj_index > index) {
          objs[i].controlPoints[j].targetObj_index--;
        } else if (objs[i].controlPoints[j].targetObj_index == index) {
          objs[i].controlPoints = [];
          break;
        }
      }
    }
  }

  isConstructing = false;
  objs.length = objs.length - 1;
  selectedObj--;
  selectObj(selectedObj);
}

function cloneObj(index) {
  if (objs[index].type == "handle") {
    var indices = [];
    for (var j in objs[index].controlPoints) {
      if (indices.indexOf(objs[index].controlPoints[j].targetObj_index) == -1) {
        indices.push(objs[index].controlPoints[j].targetObj_index);
      }
    }
    console.log(indices);
    for (var j in indices) {
      if (objs[indices[j]].type != "handle") {
        cloneObj(indices[j]);
      }
    }
  } else {
    objs[objs.length] = JSON.parse(JSON.stringify(objs[index]));
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
    //復原步數已達上限 The limit of undo is reached
    undoLBound = (undoLBound + 1) % undoLimit;
  }
  hasUnsavedChange = true;
}

function undo() {
  if (isConstructing) {
    //假如按下復原時,使用者正在建立一個物件,則此時只將建立動作終止,而不做真正的復原 If the user is constructing an object when clicked the undo, then only stop the consturction rather than do the real undo

    isConstructing = false;
    objs.length--;
    selectObj(-1);

    draw();
    return;
  }
  if (positioningObj != -1) {
    //假如按下復原時,使用者正在輸入座標,則此時只將輸入座標動作終止,而不做真正的復原 If the user is entering coordinates when clicked the undo, then only stop the coordinates entering rather than do the real undo
    endPositioning();
    return;
  }
  if (undoIndex == undoLBound)
    //已達復原資料下界 The lower bound of undo data is reached
    return;
  undoIndex = (undoIndex + (undoLimit - 1)) % undoLimit;
  document.getElementById('textarea1').value = undoArr[undoIndex];
  JSONInput();
  document.getElementById('redo').disabled = false;
  document.getElementById('redo_mobile').disabled = false;
  if (undoIndex == undoLBound) {
    //已達復原資料下界 The lower bound of undo data is reached
    document.getElementById('undo').disabled = true;
    document.getElementById('undo_mobile').disabled = true;
  }

}

function redo() {
  isConstructing = false;
  endPositioning();
  if (undoIndex == undoUBound)
    //已達復原資料下界 The lower bound of undo data is reached
    return;
  undoIndex = (undoIndex + 1) % undoLimit;
  document.getElementById('textarea1').value = undoArr[undoIndex];
  JSONInput();
  document.getElementById('undo').disabled = false;
  document.getElementById('undo_mobile').disabled = false;
  if (undoIndex == undoUBound) {
    //已達復原資料下界 The lower bound of undo data is reached
    document.getElementById('redo').disabled = true;
    document.getElementById('redo_mobile').disabled = true;
  }
}
