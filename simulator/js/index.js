var objTypes = {};
var canvas;
var canvas0;
var canvasLight;
var canvasGrid;
var ctx;
var ctx0;
var ctxLight;
var ctxGrid;
var dpr = 1;
var scene = new Scene();
var xyBox_cancelContextMenu = false;
var restoredData = "";
var isFromGallery = false;
var hasUnsavedChange = false;
var showAdvancedOn = false;
var MQ;
var cropMode = false;
var lastDeviceIsTouch = false;
var lastTouchTime = -1;

window.onload = function (e) {
  if (window.devicePixelRatio) {
    dpr = window.devicePixelRatio;
  }

  canvas = document.getElementById('canvas1');
  canvas0 = document.getElementById('canvas0');
  canvasLight = document.getElementById('canvasLight');
  canvasGrid = document.getElementById('canvasGrid');

  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx = canvas.getContext('2d');

  canvas0.width = window.innerWidth * dpr;
  canvas0.height = window.innerHeight * dpr;
  ctx0 = canvas0.getContext('2d');

  canvasLight.width = window.innerWidth * dpr;
  canvasLight.height = window.innerHeight * dpr;
  ctxLight = canvasLight.getContext('2d');

  canvasGrid.width = window.innerWidth * dpr;
  canvasGrid.height = window.innerHeight * dpr;
  ctxGrid = canvasGrid.getContext('2d');



  mousePos = geometry.point(0, 0);
  var needRestore = false;
  try {
    restoredData = localStorage.rayOpticsData;
    var jsonData = JSON.parse(restoredData);
    if (jsonData.objs.length > 0) {
      needRestore = true;
    }
  } catch { }

  if (needRestore) {
    document.getElementById('restore').style.display = '';
    initParameters();
    toolbtn_clicked('');
    document.getElementById('tool_').checked = true;
    document.getElementById('tool__mobile').checked = true;
    AddingObjType = '';
  } else {
    restoredData = '';
    initParameters();
  }

  undoArr[0] = document.getElementById('textarea1').value;
  document.getElementById('undo').disabled = true;
  document.getElementById('redo').disabled = true;

  document.getElementById('undo_mobile').disabled = true;
  document.getElementById('redo_mobile').disabled = true;


  canvas.addEventListener('mousedown', function (e) {
    //console.log("mousedown");
    //document.getElementById('objAttr_text').blur();
    // TODO: check that commenting out the above line does not cause problem.
    if (lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
    lastDeviceIsTouch = false;

    document.body.focus();
    canvas_onmousedown(e);
  });

  canvas.addEventListener('mousemove', function (e) {
    //console.log("mousemove");
    if (lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
    lastDeviceIsTouch = false;

    canvas_onmousemove(e);
  });

  canvas.addEventListener('mouseup',  function (e) {
    if (lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
    lastDeviceIsTouch = false;
    //console.log("mouseup");
    canvas_onmouseup(e);
  });

  canvas.addEventListener('mouseout',  function (e) {
    if (lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
    lastDeviceIsTouch = false;
    mouseObj = -1;
    draw(true, true)
  });

  // IE9, Chrome, Safari, Opera
  canvas.addEventListener("mousewheel", canvas_onmousewheel, false);
  // Firefox
  canvas.addEventListener("DOMMouseScroll", canvas_onmousewheel, false);


  let initialPinchDistance = null;
  let lastScale = 1;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('touchstart',  function (e) {
    lastDeviceIsTouch = true;
    lastTouchTime = Date.now();
    if (e.touches.length === 2) {
      // Pinch to zoom
      e.preventDefault();
      lastX = (e.touches[0].pageX + e.touches[1].pageX) / 2;
      lastY = (e.touches[0].pageY + e.touches[1].pageY) / 2;
      if (isConstructing || draggingObj >= 0) {
        canvas_onmouseup(e);
        undo();
      } else {
        canvas_onmouseup(e);
      }
    } else {
      //console.log("touchstart");
      document.body.focus();
      canvas_onmousemove(e);
      canvas_onmousedown(e);
    }
  });

  canvas.addEventListener('touchmove',  function (e) {
    lastDeviceIsTouch = true;
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
      
      newScale = Math.max(0.25, Math.min(5.00, newScale));

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
      canvas_onmousemove(e);
    }
  });

  canvas.addEventListener('touchend',  function (e) {
    lastDeviceIsTouch = true;
    lastTouchTime = Date.now();
    //console.log("touchend");
    if (e.touches.length < 2) {
      initialPinchDistance = null;
      canvas_onmouseup(e);
    }
  });

  canvas.addEventListener('touchcancel',  function (e) {
    lastDeviceIsTouch = true;
    lastTouchTime = Date.now();
    //console.log("touchcancel");
    initialPinchDistance = null;
    if (isConstructing || draggingObj >= 0) {
      canvas_onmouseup(e);
      undo();
    } else {
      canvas_onmouseup(e);
    }
  });

  canvas.addEventListener('dblclick',  function (e) {
    canvas_ondblclick(e);
  });


  document.getElementById('undo').onclick = function() {
    this.blur();
    undo();
  }
  document.getElementById('undo_mobile').onclick = document.getElementById('undo').onclick;
  document.getElementById('redo').onclick = function() {
    this.blur();
    redo();
  }
  document.getElementById('redo_mobile').onclick = document.getElementById('redo').onclick;
  document.getElementById('reset').onclick = function () {
    history.replaceState('', document.title, window.location.pathname+window.location.search);
    initParameters();
    cancelRestore();
    createUndoPoint();
    document.getElementById('welcome').style.display = '';
    isFromGallery = false;
    hasUnsavedChange = false;
  };
  document.getElementById('reset_mobile').onclick = document.getElementById('reset').onclick
  
  document.getElementById('get_link').onclick = getLink;
  document.getElementById('get_link_mobile').onclick = getLink;
  document.getElementById('export_svg').onclick = enterCropMode;
  document.getElementById('export_svg_mobile').onclick = enterCropMode;
  document.getElementById('open').onclick = function () {
    document.getElementById('openfile').click();
  };
  document.getElementById('open_mobile').onclick = document.getElementById('open').onclick
  document.getElementById('view_gallery').onclick = function() {
    window.open(getMsg("gallery_url"));
  };
  document.getElementById('view_gallery_mobile').onclick = document.getElementById('view_gallery').onclick;


  document.getElementById('openfile').onchange = function () {
    openFile(this.files[0]);
  };

  document.getElementById('color_mode').onclick = function () {
    scene.colorMode = this.checked;
    document.getElementById('color_mode').checked = scene.colorMode;
    document.getElementById('color_mode_mobile').checked = scene.colorMode;
    selectObj(selectedObj);
    this.blur();
    draw(false, true);
  };
  document.getElementById('color_mode_mobile').onclick = document.getElementById('color_mode').onclick;

  document.getElementById('show_help_popups').onclick = function () {
    this.blur();
    popoversEnabled = this.checked;
    localStorage.rayOpticsHelp = popoversEnabled ? "on" : "off";
  };

  document.getElementById('show_status').onclick = function () {
    this.blur();

    document.getElementById('show_status').checked = this.checked;
    document.getElementById('show_status_mobile').checked = this.checked;

    document.getElementById('status').style.display = this.checked ? '' : 'none';
    localStorage.rayOpticsShowStatus = this.checked ? "on" : "off";
  };
  document.getElementById('show_status_mobile').onclick = document.getElementById('show_status').onclick;

  if (typeof (Storage) !== "undefined" && localStorage.rayOpticsShowStatus && localStorage.rayOpticsShowStatus == "on") {
    document.getElementById('show_status').checked = true;
    document.getElementById('show_status_mobile').checked = true;
    document.getElementById('status').style.display = '';
  }

  document.getElementById('grid_size').onchange = function () {
    scene.gridSize = parseFloat(this.value);
    document.getElementById('grid_size').value = scene.gridSize;
    document.getElementById('grid_size_mobile').value = scene.gridSize;
    draw(true, false);
  }
  document.getElementById('grid_size_mobile').onchange = document.getElementById('grid_size').onchange;

  document.getElementById('grid_size').onclick = function () {
    this.select();
  }
  document.getElementById('grid_size_mobile').onclick = document.getElementById('grid_size').onclick;
  
  document.getElementById('grid_size').onkeydown = function(e)
  {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  document.getElementById('grid_size_mobile').onkeydown = document.getElementById('grid_size').onkeydown;

  document.getElementById('observer_size').onchange = function () {
    document.getElementById('observer_size').value = this.value;
    document.getElementById('observer_size_mobile').value = this.value;
    if (scene.observer) {
      scene.observer.r = parseFloat(this.value) * 0.5;
    }
    draw(false, true);
  }
  document.getElementById('observer_size_mobile').onchange = document.getElementById('observer_size').onchange;

  document.getElementById('observer_size').onclick = function () {
    this.select();
  }
  document.getElementById('observer_size_mobile').onclick = document.getElementById('observer_size').onclick;
  
  document.getElementById('observer_size').onkeydown = function(e)
  {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  document.getElementById('observer_size_mobile').onkeydown = document.getElementById('observer_size').onkeydown;


  document.getElementById('zoomPlus').onclick = function () {
    setScale(scene.scale * 1.1);
    this.blur();
  }
  document.getElementById('zoomMinus').onclick = function () {
    setScale(scene.scale / 1.1);
    this.blur();
  }
  document.getElementById('zoomPlus_mobile').onclick = document.getElementById('zoomPlus').onclick;
  document.getElementById('zoomMinus_mobile').onclick = document.getElementById('zoomMinus').onclick;


  document.getElementById('rayDensity').oninput = function () {
    scene.rayDensity = Math.exp(this.value);
    document.getElementById('rayDensity').value = this.value;
    document.getElementById('rayDensity_more').value = this.value;
    document.getElementById('rayDensity_mobile').value = this.value;
    draw(false, true);
  };
  document.getElementById('rayDensity_more').oninput = document.getElementById('rayDensity').oninput;
  document.getElementById('rayDensity_mobile').oninput = document.getElementById('rayDensity').oninput;

  document.getElementById('rayDensity').onmouseup = function () {
    scene.rayDensity = Math.exp(this.value); // For browsers not supporting oninput
    document.getElementById('rayDensity').value = this.value;
    document.getElementById('rayDensity_more').value = this.value;
    document.getElementById('rayDensity_mobile').value = this.value;
    this.blur();
    draw(false, true);
    createUndoPoint();
  };
  document.getElementById('rayDensity_more').onmouseup = document.getElementById('rayDensity').onmouseup;
  document.getElementById('rayDensity_mobile').onmouseup = document.getElementById('rayDensity').onmouseup;

  document.getElementById('rayDensity').ontouchend = function () {
    scene.rayDensity = Math.exp(this.value); // For browsers not supporting oninput
    document.getElementById('rayDensity').value = this.value;
    document.getElementById('rayDensity_more').value = this.value;
    document.getElementById('rayDensity_mobile').value = this.value;
    this.blur();
    draw(false, true);
    createUndoPoint();
  };
  document.getElementById('rayDensity_more').ontouchend = document.getElementById('rayDensity').ontouchend;
  document.getElementById('rayDensity_mobile').ontouchend = document.getElementById('rayDensity').ontouchend;

  document.getElementById('rayDensityPlus').onclick = function () {
    rayDensityValue = Math.log(scene.rayDensity) * 1.0 + 0.1;
    scene.rayDensity = Math.exp(rayDensityValue);
    document.getElementById('rayDensity').value = rayDensityValue;
    document.getElementById('rayDensity_more').value = rayDensityValue;
    document.getElementById('rayDensity_mobile').value = rayDensityValue;
    this.blur();
    draw(false, true);
  };
  document.getElementById('rayDensityMinus').onclick = function () {
    rayDensityValue = Math.log(scene.rayDensity) * 1.0 - 0.1;
    scene.rayDensity = Math.exp(rayDensityValue);
    document.getElementById('rayDensity').value = rayDensityValue;
    document.getElementById('rayDensity_more').value = rayDensityValue;
    document.getElementById('rayDensity_mobile').value = rayDensityValue;
    this.blur();
    draw(false, true);
  };
  document.getElementById('rayDensityPlus_mobile').onclick = document.getElementById('rayDensityPlus').onclick;
  document.getElementById('rayDensityMinus_mobile').onclick = document.getElementById('rayDensityMinus').onclick;
  document.getElementById('rayDensityPlus_more').onclick = document.getElementById('rayDensityPlus').onclick;
  document.getElementById('rayDensityMinus_more').onclick = document.getElementById('rayDensityMinus').onclick;


  document.getElementById('grid').onclick = function (e) {
    document.getElementById('grid').checked = e.target.checked;
    document.getElementById('grid_more').checked = e.target.checked;
    document.getElementById('grid_mobile').checked = e.target.checked;
    scene.grid = e.target.checked;
    this.blur();
    //draw();
  };
  document.getElementById('grid_more').onclick = document.getElementById('grid').onclick;
  document.getElementById('grid_mobile').onclick = document.getElementById('grid').onclick;

  document.getElementById('showgrid').onclick = function (e) {
    document.getElementById('showgrid').checked = e.target.checked;
    document.getElementById('showgrid_more').checked = e.target.checked;
    document.getElementById('showgrid_mobile').checked = e.target.checked;
    scene.showGrid = e.target.checked;
    this.blur();
    draw(true, false);
  };
  document.getElementById('showgrid_more').onclick = document.getElementById('showgrid').onclick;
  document.getElementById('showgrid_mobile').onclick = document.getElementById('showgrid').onclick;

  document.getElementById('lockobjs').onclick = function (e) {
    document.getElementById('lockobjs').checked = e.target.checked;
    document.getElementById('lockobjs_more').checked = e.target.checked;
    document.getElementById('lockobjs_mobile').checked = e.target.checked;
    scene.lockobjs = e.target.checked;
    this.blur();
  };
  document.getElementById('lockobjs_more').onclick = document.getElementById('lockobjs').onclick;
  document.getElementById('lockobjs_mobile').onclick = document.getElementById('lockobjs').onclick;

  document.getElementById('forceStop').onclick = function () {
    if (timerID != -1) {
      forceStop = true;
    }
  };

  document.getElementById('restore').onclick = function () { restore() };

  document.getElementById('apply_to_all').onclick = function () {
    this.blur();
    const checked = this.checked;
    document.getElementById('apply_to_all').checked = checked;
    document.getElementById('apply_to_all_mobile').checked = checked;
  }
  document.getElementById('apply_to_all_mobile').onclick = document.getElementById('apply_to_all').onclick;

  document.getElementById('copy').onclick = function () {
    this.blur();
    scene.objs[scene.objs.length] = JSON.parse(JSON.stringify(scene.objs[selectedObj]));
    objTypes[scene.objs[scene.objs.length - 1].type].move(scene.objs[scene.objs.length - 1], scene.gridSize, scene.gridSize);
    selectObj(scene.objs.length - 1);
    draw(!(objTypes[scene.objs[selectedObj].type].onBeginSimulate || objTypes[scene.objs[selectedObj].type].checkRayIntersects), true);
    createUndoPoint();
  };
  document.getElementById('copy_mobile').onclick = document.getElementById('copy').onclick;

  document.getElementById('delete').onclick = function () {
    var selectedObjType = scene.objs[selectedObj].type;
    this.blur();
    removeObj(selectedObj);
    draw(!(objTypes[selectedObjType].onBeginSimulate || objTypes[selectedObjType].checkRayIntersects), true);
    createUndoPoint();
  };
  document.getElementById('delete_mobile').onclick = document.getElementById('delete').onclick;

  document.getElementById('unselect').onclick = function () {
    selectObj(-1);
    draw(true, true);
    createUndoPoint();
  };
  document.getElementById('unselect_mobile').onclick = document.getElementById('unselect').onclick;

  document.getElementById('showAdvanced').onclick = function () {
    showAdvancedOn = true;
    selectObj(selectedObj);
  };
  document.getElementById('showAdvanced_mobile').onclick = document.getElementById('showAdvanced').onclick;

  document.getElementById('textarea1').onchange = function () {
    JSONInput();
    createUndoPoint();
  };



  document.getElementById('save_name').onkeydown = function (e) {
    if (e.keyCode == 13) {
      //enter
      document.getElementById('save_confirm').onclick();
    }

    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  document.getElementById('save_confirm').onclick = save;


  document.getElementById('xybox').onkeydown = function (e) {
    //console.log(e.keyCode)
    if (e.keyCode == 13) {
      //enter
      confirmPositioning(e.ctrlKey, e.shiftKey);
    }
    if (e.keyCode == 27) {
      //esc
      endPositioning();
    }

    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };

  document.getElementById('xybox').oninput = function (e) {
    this.size = this.value.length;
  };

  document.getElementById('xybox').addEventListener('contextmenu', function (e) {
    if (xyBox_cancelContextMenu) {
      e.preventDefault();
      xyBox_cancelContextMenu = false;
    }
  }, false);


  window.ondragenter = function (e) {
    e.stopPropagation();
    e.preventDefault();
  };

  window.ondragover = function (e) {
    e.stopPropagation();
    e.preventDefault();
  };

  window.ondrop = function (e) {
    e.stopPropagation();
    e.preventDefault();

    var dt = e.dataTransfer;
    if (dt.files[0]) {
      var files = dt.files;
      openFile(files[0]);
    }
    else {
      var fileString = dt.getData('text');
      document.getElementById('textarea1').value = fileString;
      selectedObj = -1;
      JSONInput();
      createUndoPoint();
    }
  };

  canvas.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  }, false);

  MQ = MathQuill.getInterface(2);

  if (window.location.hash.length > 150) {
    JsonUrl('lzma').decompress(window.location.hash.substr(1)).then(json => {
      document.getElementById('textarea1').value = JSON.stringify(json);
      scene.backgroundImage = null;
      JSONInput();
      createUndoPoint();
      isFromGallery = true;
      hasUnsavedChange = false;
    });
  } else if (window.location.hash.length > 1) {
    openSample(window.location.hash.substr(1) + ".json");
    history.replaceState('', document.title, window.location.pathname+window.location.search);
    isFromGallery = true;
  }
};

function openSample(name) {
  var client = new XMLHttpRequest();
  client.open('GET', '../gallery/' + name);
  client.onload = function () {
    if (client.status >= 300)
      return;
    document.getElementById('textarea1').value = client.responseText;
    scene.backgroundImage = null;
    JSONInput();
    createUndoPoint();
    isFromGallery = true;
    hasUnsavedChange = false;
  }
  client.send();
}




window.onresize = function (e) {
  scene.setViewportSize(canvas.width/dpr, canvas.height/dpr);

  if (window.devicePixelRatio) {
    dpr = window.devicePixelRatio;
  }

  if (ctx) {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas0.width = window.innerWidth * dpr;
    canvas0.height = window.innerHeight * dpr;
    canvasLight.width = window.innerWidth * dpr;
    canvasLight.height = window.innerHeight * dpr;
    canvasGrid.width = window.innerWidth * dpr;
    canvasGrid.height = window.innerHeight * dpr;
    draw();
  }
};




function initParameters() {
  isConstructing = false;
  endPositioning();
  scene = new Scene();
  scene.setViewportSize(canvas.width/dpr, canvas.height/dpr);

  selectObj(-1);

  document.getElementById("rayDensity").value = scene.rayDensity_light;
  document.getElementById("rayDensity_more").value = scene.rayDensity_light;
  document.getElementById("rayDensity_mobile").value = scene.rayDensity_light;
  document.getElementById("zoom").innerText = Math.round(scene.scale * 100) + '%';
  document.getElementById("zoom_mobile").innerText = Math.round(scene.scale * 100) + '%';
  toolbtn_clicked('');
  modebtn_clicked('light');
  scene.backgroundImage = null;

  //Reset new UI.
  
  resetDropdownButtons();
  document.getElementById('tool_').checked = true;
  document.getElementById('tool__mobile').checked = true;
  document.getElementById('mode_light').checked = true;
  document.getElementById('mode_light_mobile').checked = true;

  document.getElementById('lockobjs').checked = false;
  document.getElementById('grid').checked = false;
  document.getElementById('showgrid').checked = false;

  document.getElementById('lockobjs_more').checked = false;
  document.getElementById('grid_more').checked = false;
  document.getElementById('showgrid_more').checked = false;

  document.getElementById('lockobjs_mobile').checked = false;
  document.getElementById('grid_mobile').checked = false;
  document.getElementById('showgrid_mobile').checked = false;

  document.getElementById('color_mode').checked = false;
  document.getElementById('color_mode_mobile').checked = false;

  document.getElementById('apply_to_all').checked = false;
  document.getElementById('apply_to_all_mobile').checked = false;

  document.getElementById('grid_size').value = scene.gridSize;
  document.getElementById('grid_size_mobile').value = scene.gridSize;

  document.getElementById('observer_size').value = 40;
  document.getElementById('observer_size_mobile').value = 40;
  
  draw();
}

window.onkeydown = function (e) {
  //Ctrl+Z
  if (e.ctrlKey && e.keyCode == 90) {
    if (document.getElementById('undo').disabled == false) {
      undo();
    }
    return false;
  }
  //Ctrl+D
  if (e.ctrlKey && e.keyCode == 68) {
    cloneObj(selectedObj);
    draw(!(objTypes[scene.objs[selectedObj].type].onBeginSimulate || objTypes[scene.objs[selectedObj].type].checkRayIntersects), true);
    createUndoPoint();
    return false;
  }
  //Ctrl+Y
  if (e.ctrlKey && e.keyCode == 89) {
    document.getElementById('redo').onclick();
  }

  //Ctrl+S
  if (e.ctrlKey && e.keyCode == 83) {
    save();
    return false;
  }

  //Ctrl+O
  if (e.ctrlKey && e.keyCode == 79) {
    document.getElementById('open').onclick();
    return false;
  }

  //esc
  if (e.keyCode == 27) {
    if (isConstructing) {
      undo();
    }
  }

  /*
  if(e.altKey && e.keyCode==78)
  {
  //Alt+N
  cleanAll();
  return false;
  }
  */
  /*
  if(e.altKey && e.keyCode==65)
  {
  //Alt+A
  document.getElementById("objAttr").focus()
  return false;
  }
  */
  //Delete
  if (e.keyCode == 46 || e.keyCode == 8) {
    if (selectedObj != -1) {
      var selectedObjType = scene.objs[selectedObj].type;
      removeObj(selectedObj);
      draw(!(objTypes[selectedObjType].onBeginSimulate || objTypes[selectedObjType].checkRayIntersects), true);
      createUndoPoint();
    }
    return false;
  }

  //Ctrl
  /*
  if(e.keyCode==17)
  {
    if(draggingObj!=-1)
    {
      canvas_onmousemove(e,true);
    }
  }
  */

  //Arrow Keys
  if (e.keyCode >= 37 && e.keyCode <= 40) {
    var step = scene.grid ? scene.gridSize : 1;
    if (selectedObj >= 0) {
      if (e.keyCode == 37) {
        objTypes[scene.objs[selectedObj].type].move(scene.objs[selectedObj], -step, 0);
      }
      if (e.keyCode == 38) {
        objTypes[scene.objs[selectedObj].type].move(scene.objs[selectedObj], 0, -step);
      }
      if (e.keyCode == 39) {
        objTypes[scene.objs[selectedObj].type].move(scene.objs[selectedObj], step, 0);
      }
      if (e.keyCode == 40) {
        objTypes[scene.objs[selectedObj].type].move(scene.objs[selectedObj], 0, step);
      }
      draw(!(objTypes[scene.objs[selectedObj].type].onBeginSimulate || objTypes[scene.objs[selectedObj].type].checkRayIntersects), true);
    }
    else if (scene.mode == 'observer') {
      if (e.keyCode == 37) {
        scene.observer.c.x -= step;
      }
      if (e.keyCode == 38) {
        scene.observer.c.y -= step;
      }
      if (e.keyCode == 39) {
        scene.observer.c.x += step;
      }
      if (e.keyCode == 40) {
        scene.observer.c.y += step;
      }
      draw(false, true);
    }
    else {
      for (var i = 0; i < scene.objs.length; i++) {
        if (e.keyCode == 37) {
          objTypes[scene.objs[i].type].move(scene.objs[i], -step, 0);
        }
        if (e.keyCode == 38) {
          objTypes[scene.objs[i].type].move(scene.objs[i], 0, -step);
        }
        if (e.keyCode == 39) {
          objTypes[scene.objs[i].type].move(scene.objs[i], step, 0);
        }
        if (e.keyCode == 40) {
          objTypes[scene.objs[i].type].move(scene.objs[i], 0, step);
        }
      }
      draw();
    }
  }



};

window.onkeyup = function (e) {
  //Arrow Keys
  if (e.keyCode >= 37 && e.keyCode <= 40) {
    createUndoPoint();
  }

};

function JSONOutput() {
  scene.setViewportSize(canvas.width/dpr, canvas.height/dpr);
  document.getElementById('textarea1').value = scene.toJSON();
}

function JSONInput() {
  document.getElementById('welcome').style.display = 'none';

  scene.setViewportSize(canvas.width/dpr, canvas.height/dpr);
  scene.fromJSON(document.getElementById('textarea1').value, function (needFullUpdate, completed) {
    if (needFullUpdate) {
      // Update the UI for the loaded scene.

      document.getElementById('showgrid').checked = scene.showGrid;
      document.getElementById('showgrid_more').checked = scene.showGrid;
      document.getElementById('showgrid_mobile').checked = scene.showGrid;

      document.getElementById('grid').checked = scene.grid;
      document.getElementById('grid_more').checked = scene.grid;
      document.getElementById('grid_mobile').checked = scene.grid;

      document.getElementById('lockobjs').checked = scene.lockobjs;
      document.getElementById('lockobjs_more').checked = scene.lockobjs;
      document.getElementById('lockobjs_mobile').checked = scene.lockobjs;

      if (scene.observer) {
        document.getElementById('observer_size').value = Math.round(scene.observer.r * 2 * 1000000) / 1000000;
        document.getElementById('observer_size_mobile').value = Math.round(scene.observer.r * 2 * 1000000) / 1000000;
      } else {
        document.getElementById('observer_size').value = 40;
        document.getElementById('observer_size_mobile').value = 40;
      }

      document.getElementById('grid_size').value = scene.gridSize;
      document.getElementById('grid_size_mobile').value = scene.gridSize;

      document.getElementById("zoom").innerText = Math.round(scene.scale * 100) + '%';
      document.getElementById("zoom_mobile").innerText = Math.round(scene.scale * 100) + '%';
      document.getElementById('color_mode').checked = scene.colorMode;
      document.getElementById('color_mode_mobile').checked = scene.colorMode;
      modebtn_clicked(scene.mode);
      document.getElementById('mode_' + scene.mode).checked = true;
      document.getElementById('mode_' + scene.mode + '_mobile').checked = true;
      selectObj(selectedObj);
      draw();
    } else {
      // Partial update (e.g. when the background image is loaded)
      setTimeout(function() {
        draw(true, true);
      }, 1);
    }
  });

  
}


function toolbtn_clicked(tool, e) {
  if (tool != "") {
    document.getElementById('welcome').style.display = 'none';
  }
  AddingObjType = tool;
}


function modebtn_clicked(mode1) {
  scene.mode = mode1;
  if (scene.mode == 'images' || scene.mode == 'observer') {
    document.getElementById("rayDensity").value = Math.log(scene.rayDensity_images);
    document.getElementById("rayDensity_more").value = Math.log(scene.rayDensity_images);
    document.getElementById("rayDensity_mobile").value = Math.log(scene.rayDensity_images);
  }
  else {
    document.getElementById("rayDensity").value = Math.log(scene.rayDensity_light);
    document.getElementById("rayDensity_more").value = Math.log(scene.rayDensity_light);
    document.getElementById("rayDensity_mobile").value = Math.log(scene.rayDensity_light);
  }
  if (scene.mode == 'observer' && !scene.observer) {
    // Initialize the observer
    scene.observer = geometry.circle(geometry.point((canvas.width * 0.5 / dpr - scene.origin.x) / scene.scale, (canvas.height * 0.5 / dpr - scene.origin.y) / scene.scale), parseFloat(document.getElementById('observer_size').value) * 0.5);
  }


  try {
    draw(false, true);
  } catch (error) {
    console.error(error);
    isDrawing = false;
  }
}


function setScale(value) {
  setScaleWithCenter(value, canvas.width / scene.scale / 2, canvas.height / scene.scale / 2);
}

function setScaleWithCenter(value, centerX, centerY) {
  scaleChange = value - scene.scale;
  scene.origin.x *= value / scene.scale;
  scene.origin.y *= value / scene.scale;
  scene.origin.x -= centerX * scaleChange;
  scene.origin.y -= centerY * scaleChange;
  scene.scale = value;
  document.getElementById("zoom").innerText = Math.round(scene.scale * 100) + '%';
  document.getElementById("zoom_mobile").innerText = Math.round(scene.scale * 100) + '%';
  draw();
}

function save() {
  JSONOutput();

  var blob = new Blob([document.getElementById('textarea1').value], { type: 'application/json' });
  saveAs(blob, document.getElementById('save_name').value);
  var saveModal = bootstrap.Modal.getInstance(document.getElementById('saveModal'));
  if (saveModal) {
    saveModal.hide();
  }
  hasUnsavedChange = false;
}

function openFile(readFile) {
  var reader = new FileReader();
  document.getElementById('save_name').value = readFile.name;
  reader.readAsText(readFile);
  reader.onload = function (evt) {
    var fileString = evt.target.result;
    document.getElementById('textarea1').value = fileString;
    endPositioning();
    selectedObj = -1;
    try {
      JSONInput();
      cancelRestore();
      hasUnsavedChange = false;
    } catch (error) {
      reader.onload = function (e) {
        scene.backgroundImage = new Image();
        scene.backgroundImage.src = e.target.result;
        scene.backgroundImage.onload = function (e1) {
          draw(true, true);
          cancelRestore();
        }
      }
      reader.readAsDataURL(readFile);
    }
    createUndoPoint();
  };

}

function getLink() {
  JsonUrl('lzma').compress(JSON.parse(document.getElementById('textarea1').value)).then(output => {
    window.location.hash = '#' + output;
    var fullURL = "https://phydemo.app/ray-optics/simulator/#" + output;
    //console.log(fullURL.length);
    navigator.clipboard.writeText(fullURL);
    if (fullURL.length > 2043) {
      alert(getMsg("get_link_warning"));
    } else {
      hasUnsavedChange = false;
    }
  });
}

function enterCropMode() {
  cropMode = true;

  // Search objs for existing cropBox
  var cropBoxIndex = -1;
  for (var i = 0; i < scene.objs.length; i++) {
    if (scene.objs[i].type == 'cropbox') {
      cropBoxIndex = i;
      break;
    }
  }
  if (cropBoxIndex == -1) {
    // Create a new cropBox
    var cropBox = {
      type: 'cropbox',
      p1: geometry.point((canvas.width * 0.2 / dpr - scene.origin.x) / scene.scale, ((120 + (canvas.height-120) * 0.2) / dpr - scene.origin.y) / scene.scale),
      p2: geometry.point((canvas.width * 0.8 / dpr - scene.origin.x) / scene.scale, ((120 + (canvas.height-120) * 0.2) / dpr - scene.origin.y) / scene.scale),
      p3: geometry.point((canvas.width * 0.2 / dpr - scene.origin.x) / scene.scale, ((120 + (canvas.height-120) * 0.8) / dpr - scene.origin.y) / scene.scale),
      p4: geometry.point((canvas.width * 0.8 / dpr - scene.origin.x) / scene.scale, ((120 + (canvas.height-120) * 0.8) / dpr - scene.origin.y) / scene.scale),
      width: 1280,
      format: 'png'
    };
    scene.objs.push(cropBox);
    cropBoxIndex = scene.objs.length - 1;
  }

  selectObj(cropBoxIndex);

  draw(true, true);
}

function confirmCrop(cropBox) {
  if (cropBox.format == 'svg') {
    exportSVG(cropBox);
  } else {
    exportImage(cropBox);
  }
}

function cancelCrop() {
  cropMode = false;
  selectObj(-1);
  draw(true, true);
}

function exportSVG(cropBox) {
  var ctx_backup = ctx;
  var ctx0_backup = ctx0;
  var ctxLight_backup = ctxLight;
  var ctxGrid_backup = ctxGrid;
  var scale_backup = scene.scale;
  var origin_backup = scene.origin;
  var dpr_backup = dpr;

  scene.scale = 1;
  scene.origin = { x: -cropBox.p1.x * scene.scale, y: -cropBox.p1.y * scene.scale };
  dpr = 1;
  imageWidth = cropBox.p4.x - cropBox.p1.x;
  imageHeight = cropBox.p4.y - cropBox.p1.y;

  selectObj(-1);
  mouseObj = -1;

  ctx = new C2S(imageWidth, imageHeight);
  ctx0 = ctx;
  ctxLight = ctx;
  ctxGrid = ctx;
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, imageWidth, imageHeight);

  exportRayCountLimit = cropBox.rayCountLimit || 1e4;
  isExporting = true;
  cropMode = false;
  draw();
  isExporting = false;
  var blob = new Blob([ctx.getSerializedSvg()], { type: 'image/svg+xml' });
  saveAs(blob, "export.svg");

  ctx = ctx_backup;
  ctx0 = ctx0_backup;
  ctxLight = ctxLight_backup;
  ctxGrid = ctxGrid_backup;
  scene.scale = scale_backup;
  scene.origin = origin_backup;
  dpr = dpr_backup;
  draw(true, true);
}

function exportImage(cropBox) {

  var scale_backup = scene.scale;
  var origin_backup = scene.origin;
  var dpr_backup = dpr;

  scene.scale = cropBox.width / (cropBox.p4.x - cropBox.p1.x);
  scene.origin = { x: -cropBox.p1.x * scene.scale, y: -cropBox.p1.y * scene.scale };
  dpr = 1;
  imageWidth = cropBox.width;
  imageHeight = cropBox.width * (cropBox.p4.y - cropBox.p1.y) / (cropBox.p4.x - cropBox.p1.x);

  selectObj(-1);
  mouseObj = -1;

  canvas.width = imageWidth;
  canvas.height = imageHeight;
  canvas0.width = imageWidth;
  canvas0.height = imageHeight;
  canvasLight.width = imageWidth;
  canvasLight.height = imageHeight;
  canvasGrid.width = imageWidth;
  canvasGrid.height = imageHeight;
  exportRayCountLimit = cropBox.rayCountLimit || 1e7;
  isExporting = true;
  cropMode = false;
  draw();
  isExporting = false;

  var finalCanvas = document.createElement('canvas');
  finalCanvas.width = imageWidth;
  finalCanvas.height = imageHeight;
  var finalCtx = finalCanvas.getContext('2d');
  finalCtx.fillStyle = "black";
  finalCtx.fillRect(0, 0, imageWidth, imageHeight);
  finalCtx.drawImage(canvas0, 0, 0);
  finalCtx.drawImage(canvasGrid, 0, 0);
  finalCtx.drawImage(canvasLight, 0, 0);
  finalCtx.drawImage(canvas, 0, 0);

  finalCanvas.toBlob(function (blob) {
    saveAs(blob, "export.png");
  });

  scene.scale = scale_backup;
  scene.origin = origin_backup;
  dpr = dpr_backup;
  window.onresize();
}

function restore() {
  document.getElementById('textarea1').value = restoredData;
  document.getElementById('restore').style.display = 'none';
  restoredData = '';
  JSONInput();
  createUndoPoint();
}

function cancelRestore() {
  isFromGallery = false;
  restoredData = '';
  document.getElementById('restore').style.display = 'none';
  document.getElementById('welcome').style.display = 'none';
}

window.onbeforeunload = function(e) {
  if (!restoredData) {
    localStorage.rayOpticsData = '';
  }
  if (hasUnsavedChange) {
    return "You have unsaved change.";
  }
}

