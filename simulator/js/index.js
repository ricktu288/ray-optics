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
var isFromGallery = false;
var hasUnsavedChange = false;
var showAdvancedOn = false;
var MQ;
var cropMode = false;
var lastDeviceIsTouch = false;
var lastTouchTime = -1;
var autoSyncUrl = false;
var warning = null;
var error = null;

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

  initParameters();

  JSONOutput();
  undoArr[0] = latestJsonCode;
  document.getElementById('undo').disabled = true;
  document.getElementById('redo').disabled = true;

  document.getElementById('undo_mobile').disabled = true;
  document.getElementById('redo_mobile').disabled = true;


  canvas.addEventListener('mousedown', function (e) {
    error = null;
    //console.log("mousedown");
    //document.getElementById('objAttr_text').blur();
    // TODO: check that commenting out the above line does not cause problem.
    if (lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
    lastDeviceIsTouch = false;

    if (scene.error) {
      canvas.style.cursor = 'not-allowed';
      return;
    }

    document.body.focus();
    canvas_onmousedown(e);
  });

  canvas.addEventListener('mousemove', function (e) {
    //console.log("mousemove");
    if (lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
    lastDeviceIsTouch = false;

    if (scene.error) {
      canvas.style.cursor = 'not-allowed';
      return;
    }

    canvas_onmousemove(e);
  });

  canvas.addEventListener('mouseup',  function (e) {
    if (lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
    lastDeviceIsTouch = false;

    if (scene.error) {
      canvas.style.cursor = 'not-allowed';
      return;
    }

    //console.log("mouseup");
    canvas_onmouseup(e);
  });

  canvas.addEventListener('mouseout',  function (e) {
    if (lastDeviceIsTouch && Date.now() - lastTouchTime < 500) return;
    lastDeviceIsTouch = false;
    if (draggingObj != -1) {
      canvas_onmouseup(e);
    }
    mouseObj = -1;
    document.getElementById('mouseCoordinates').innerHTML = "";
    simulator.updateSimulation(true, true)
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
    if (scene.error) return;
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
    if (scene.error) return;
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
      
      newScale = Math.max(0.25/scene.lengthScale, Math.min(5.00/scene.lengthScale, newScale));

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
    if (scene.error) return;
    lastDeviceIsTouch = true;
    lastTouchTime = Date.now();
    //console.log("touchend");
    if (e.touches.length < 2) {
      initialPinchDistance = null;
      canvas_onmouseup(e);
      JSONOutput();
    }
  });

  canvas.addEventListener('touchcancel',  function (e) {
    if (scene.error) return;
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
    if (scene.error) return;
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
    document.getElementById("welcome").innerHTML = welcome_msgs[lang];
    document.getElementById('welcome').style.display = '';
    createUndoPoint();
    isFromGallery = false;
    hasUnsavedChange = false;
    if (aceEditor) {
      aceEditor.session.setValue(latestJsonCode);
    }
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

  document.getElementById('simulateColors').onclick = function () {
    scene.simulateColors = this.checked;
    document.getElementById('simulateColors').checked = scene.simulateColors;
    document.getElementById('simulateColors_mobile').checked = scene.simulateColors;
    selectObj(selectedObj);
    this.blur();
    simulator.updateSimulation(false, true);
    createUndoPoint();
  };
  document.getElementById('simulateColors_mobile').onclick = document.getElementById('simulateColors').onclick;

  document.getElementById('show_help_popups').onclick = function () {
    this.blur();
    popoversEnabled = this.checked;
    localStorage.rayOpticsHelp = popoversEnabled ? "on" : "off";
  };

  document.getElementById('show_json_editor').onclick = function () {
    this.blur();

    document.getElementById('show_json_editor').checked = this.checked;
    document.getElementById('show_json_editor_mobile').checked = this.checked;

    if (this.checked) {
      enableJsonEditor();
    } else {
      disableJsonEditor();
    }

    localStorage.rayOpticsShowJsonEditor = this.checked ? "on" : "off";
  };
  document.getElementById('show_json_editor_mobile').onclick = document.getElementById('show_json_editor').onclick;

  if (typeof (Storage) !== "undefined" && localStorage.rayOpticsShowJsonEditor && localStorage.rayOpticsShowJsonEditor == "on") {
    enableJsonEditor();
    document.getElementById('show_json_editor').checked = true;
    document.getElementById('show_json_editor_mobile').checked = true;
  } else {
    document.getElementById('show_json_editor').checked = false;
    document.getElementById('show_json_editor_mobile').checked = false;
  }

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
  } else {
    document.getElementById('show_status').checked = false;
    document.getElementById('show_status_mobile').checked = false;
    document.getElementById('status').style.display = 'none';
  }

  document.getElementById('auto_sync_url').onclick = function () {
    this.blur();

    document.getElementById('auto_sync_url').checked = this.checked;
    document.getElementById('auto_sync_url_mobile').checked = this.checked;

    localStorage.rayOpticsAutoSyncUrl = this.checked ? "on" : "off";
    autoSyncUrl = this.checked;

    JSONOutput();
  };
  document.getElementById('auto_sync_url_mobile').onclick = document.getElementById('auto_sync_url').onclick;

  if (typeof (Storage) !== "undefined" && localStorage.rayOpticsAutoSyncUrl && localStorage.rayOpticsAutoSyncUrl == "on") {
    document.getElementById('auto_sync_url').checked = true;
    document.getElementById('auto_sync_url_mobile').checked = true;
    autoSyncUrl = true;
  } else {
    document.getElementById('auto_sync_url').checked = false;
    document.getElementById('auto_sync_url_mobile').checked = false;
    autoSyncUrl = false;
  }

  document.getElementById('gridSize').onchange = function () {
    scene.gridSize = parseFloat(this.value);
    document.getElementById('gridSize').value = scene.gridSize;
    document.getElementById('gridSize_mobile').value = scene.gridSize;
    simulator.updateSimulation(true, false);
    JSONOutput();
  }
  document.getElementById('gridSize_mobile').onchange = document.getElementById('gridSize').onchange;

  document.getElementById('gridSize').onclick = function () {
    this.select();
  }
  document.getElementById('gridSize_mobile').onclick = document.getElementById('gridSize').onclick;
  
  document.getElementById('gridSize').onkeydown = function(e)
  {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  document.getElementById('gridSize_mobile').onkeydown = document.getElementById('gridSize').onkeydown;

  document.getElementById('observer_size').onchange = function () {
    document.getElementById('observer_size').value = this.value;
    document.getElementById('observer_size_mobile').value = this.value;
    if (scene.observer) {
      scene.observer.r = parseFloat(this.value) * 0.5;
    }
    simulator.updateSimulation(false, true);
    JSONOutput();
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

  document.getElementById('lengthScale').onchange = function () {
    scene.lengthScale = parseFloat(this.value);
    if (isNaN(scene.lengthScale)) {
      scene.lengthScale = 1;
    }
    if (scene.lengthScale < 0.1) {
      scene.lengthScale = 0.1;
    }
    if (scene.lengthScale > 10) {
      scene.lengthScale = 10;
    }
    document.getElementById('lengthScale').value = scene.lengthScale;
    document.getElementById('lengthScale_mobile').value = scene.lengthScale;
    setScale(scene.scale);
    simulator.updateSimulation();
    JSONOutput();
  }
  document.getElementById('lengthScale_mobile').onchange = document.getElementById('lengthScale').onchange;

  document.getElementById('lengthScale').onclick = function () {
    this.select();
  }
  document.getElementById('lengthScale_mobile').onclick = document.getElementById('lengthScale').onclick;
  
  document.getElementById('lengthScale').onkeydown = function(e)
  {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  document.getElementById('lengthScale_mobile').onkeydown = document.getElementById('lengthScale').onkeydown;


  document.getElementById('zoomPlus').onclick = function () {
    setScale(scene.scale * 1.1);
    JSONOutput();
    this.blur();
  }
  document.getElementById('zoomMinus').onclick = function () {
    setScale(scene.scale / 1.1);
    JSONOutput();
    this.blur();
  }
  document.getElementById('zoomPlus_mobile').onclick = document.getElementById('zoomPlus').onclick;
  document.getElementById('zoomMinus_mobile').onclick = document.getElementById('zoomMinus').onclick;


  document.getElementById('rayDensity').oninput = function () {
    scene.rayDensity = Math.exp(this.value);
    document.getElementById('rayDensity').value = this.value;
    document.getElementById('rayDensity_more').value = this.value;
    document.getElementById('rayDensity_mobile').value = this.value;
    simulator.updateSimulation(false, true);
  };
  document.getElementById('rayDensity_more').oninput = document.getElementById('rayDensity').oninput;
  document.getElementById('rayDensity_mobile').oninput = document.getElementById('rayDensity').oninput;

  document.getElementById('rayDensity').onmouseup = function () {
    scene.rayDensity = Math.exp(this.value); // For browsers not supporting oninput
    document.getElementById('rayDensity').value = this.value;
    document.getElementById('rayDensity_more').value = this.value;
    document.getElementById('rayDensity_mobile').value = this.value;
    this.blur();
    simulator.updateSimulation(false, true);
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
    simulator.updateSimulation(false, true);
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
    simulator.updateSimulation(false, true);
    createUndoPoint();
  };
  document.getElementById('rayDensityMinus').onclick = function () {
    rayDensityValue = Math.log(scene.rayDensity) * 1.0 - 0.1;
    scene.rayDensity = Math.exp(rayDensityValue);
    document.getElementById('rayDensity').value = rayDensityValue;
    document.getElementById('rayDensity_more').value = rayDensityValue;
    document.getElementById('rayDensity_mobile').value = rayDensityValue;
    this.blur();
    simulator.updateSimulation(false, true);
    createUndoPoint();
  };
  document.getElementById('rayDensityPlus_mobile').onclick = document.getElementById('rayDensityPlus').onclick;
  document.getElementById('rayDensityMinus_mobile').onclick = document.getElementById('rayDensityMinus').onclick;
  document.getElementById('rayDensityPlus_more').onclick = document.getElementById('rayDensityPlus').onclick;
  document.getElementById('rayDensityMinus_more').onclick = document.getElementById('rayDensityMinus').onclick;


  document.getElementById('snapToGrid').onclick = function (e) {
    document.getElementById('snapToGrid').checked = e.target.checked;
    document.getElementById('snapToGrid_more').checked = e.target.checked;
    document.getElementById('snapToGrid_mobile').checked = e.target.checked;
    scene.snapToGrid = e.target.checked;
    this.blur();
    JSONOutput();
    //simulator.updateSimulation();
  };
  document.getElementById('snapToGrid_more').onclick = document.getElementById('snapToGrid').onclick;
  document.getElementById('snapToGrid_mobile').onclick = document.getElementById('snapToGrid').onclick;

  document.getElementById('showGrid').onclick = function (e) {
    document.getElementById('showGrid').checked = e.target.checked;
    document.getElementById('showGrid_more').checked = e.target.checked;
    document.getElementById('showGrid_mobile').checked = e.target.checked;
    scene.showGrid = e.target.checked;
    this.blur();
    simulator.updateSimulation(true, false);
    JSONOutput();
  };
  document.getElementById('showGrid_more').onclick = document.getElementById('showGrid').onclick;
  document.getElementById('showGrid_mobile').onclick = document.getElementById('showGrid').onclick;

  document.getElementById('lockObjs').onclick = function (e) {
    document.getElementById('lockObjs').checked = e.target.checked;
    document.getElementById('lockObjs_more').checked = e.target.checked;
    document.getElementById('lockObjs_mobile').checked = e.target.checked;
    scene.lockObjs = e.target.checked;
    this.blur();
    JSONOutput();
  };
  document.getElementById('lockObjs_more').onclick = document.getElementById('lockObjs').onclick;
  document.getElementById('lockObjs_mobile').onclick = document.getElementById('lockObjs').onclick;

  document.getElementById('forceStop').onclick = function () {
    if (timerID != -1) {
      forceStop = true;
    }
  };

  document.getElementById('apply_to_all').onclick = function () {
    this.blur();
    const checked = this.checked;
    document.getElementById('apply_to_all').checked = checked;
    document.getElementById('apply_to_all_mobile').checked = checked;
  }
  document.getElementById('apply_to_all_mobile').onclick = document.getElementById('apply_to_all').onclick;

  document.getElementById('copy').onclick = function () {
    this.blur();
    scene.objs[scene.objs.length] = new objTypes[scene.objs[selectedObj].constructor.type](scene, scene.objs[selectedObj]);
    scene.objs[scene.objs.length - 1].move(scene.gridSize, scene.gridSize);
    selectObj(scene.objs.length - 1);
    simulator.updateSimulation(!scene.objs[selectedObj].constructor.isOptical, true);
    createUndoPoint();
  };
  document.getElementById('copy_mobile').onclick = document.getElementById('copy').onclick;

  document.getElementById('delete').onclick = function () {
    var selectedObjType = scene.objs[selectedObj].constructor.type;
    this.blur();
    removeObj(selectedObj);
    simulator.updateSimulation(!objTypes[selectedObjType].isOptical, true);
    createUndoPoint();
  };
  document.getElementById('delete_mobile').onclick = document.getElementById('delete').onclick;

  document.getElementById('unselect').onclick = function () {
    selectObj(-1);
    simulator.updateSimulation(true, true);
    createUndoPoint();
  };
  document.getElementById('unselect_mobile').onclick = document.getElementById('unselect').onclick;

  document.getElementById('showAdvanced').onclick = function () {
    showAdvancedOn = true;
    selectObj(selectedObj);
  };
  document.getElementById('showAdvanced_mobile').onclick = document.getElementById('showAdvanced').onclick;



  document.getElementById('save_name').onkeydown = function (e) {
    if (e.keyCode == 13) {
      //enter
      document.getElementById('save_confirm').onclick();
    }

    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  document.getElementById('save_confirm').onclick = save;
  document.getElementById('save_rename').onclick = rename;

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
      latestJsonCode = fileString;
      selectedObj = -1;
      JSONInput();
      createUndoPoint();
    }
  };

  canvas.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  }, false);

  MQ = MathQuill.getInterface(2);

  window.onerror = function (msg, url) {
    error = `Error: ${msg} at ${url}`;
    document.getElementById('welcome').style.display = 'none';
    updateErrorAndWarning();
  }

  // Update the scene when the URL changes
  window.onpopstate = function (event) {
    if (window.location.hash.length > 70) {
      // The URL contains a compressed JSON scene.
      JsonUrl('lzma').decompress(window.location.hash.substr(1)).then(json => {
        latestJsonCode = JSON.stringify(json);
        scene.backgroundImage = null;
        JSONInput();
        createUndoPoint();
        isFromGallery = true;
        hasUnsavedChange = false;
        if (aceEditor) {
          aceEditor.session.setValue(latestJsonCode);
        }
      }).catch(e => {
        error = "JsonUrl: " + e;
        document.getElementById('welcome').style.display = 'none';
        updateErrorAndWarning();
      });;
    } else if (window.location.hash.length > 1) {
      // The URL contains a link to a gallery item.
      openSample(window.location.hash.substr(1) + ".json");
      history.replaceState('', document.title, window.location.pathname+window.location.search);
      isFromGallery = true;
    }
  };

  window.onpopstate();

  window.addEventListener('message', function(event) {
    if (event.data && event.data.rayOpticsModuleName) {
      importModule(event.data.rayOpticsModuleName + '.json');
    }
  });
};

function openSample(name) {
  var client = new XMLHttpRequest();
  client.open('GET', '../gallery/' + name);
  client.onload = function () {
    if (client.status >= 300) {
      error = "openSample: HTTP Request Error: " + client.status;
      document.getElementById('welcome').style.display = 'none';
      updateErrorAndWarning();
      return;
    }
    latestJsonCode = client.responseText;
    scene.backgroundImage = null;
    JSONInput();
    createUndoPoint();
    isFromGallery = true;
    hasUnsavedChange = false;
    if (aceEditor) {
      aceEditor.session.setValue(latestJsonCode);
    }
  }
  client.onerror = function () {
    error = "openSample: HTTP Request Error";
    document.getElementById('welcome').style.display = 'none';
    updateErrorAndWarning();
  }
  client.ontimeout = function () {
    error = "openSample: HTTP Request Timeout";
    document.getElementById('welcome').style.display = 'none';
    updateErrorAndWarning();
  }

  client.send();
}

function importModule(name) {
  var client = new XMLHttpRequest();
  client.open('GET', '../modules/' + name);
  client.onload = function () {
    document.getElementById('welcome').style.display = 'none';
    if (client.status >= 300) {
      error = "importModule: HTTP Request Error: " + client.status;
      updateErrorAndWarning();
      return;
    }
    try {
      const moduleJSON = JSON.parse(client.responseText);
      for (let moduleName in moduleJSON.modules) {
        if (moduleJSON.modules.hasOwnProperty(moduleName)) {
          let newModuleName = moduleName;
          if (scene.modules[moduleName] && JSON.stringify(scene.modules[moduleName]) != JSON.stringify(moduleJSON.modules[moduleName])){
            newModuleName = prompt(getMsg('module_conflict'), moduleName);
            if (!newModuleName) {
              continue;
            }
          }
          scene.addModule(newModuleName, moduleJSON.modules[moduleName]);
        }
      }
    } catch (e) {
      error = "importModule: " + e.toString();
      updateErrorAndWarning();
      return;
    }
    simulator.updateSimulation(false, true);
    createUndoPoint();
    updateModuleObjsMenu();
  }
  client.onerror = function () {
    error = "importModule: HTTP Request Error";
    document.getElementById('welcome').style.display = 'none';
    updateErrorAndWarning();
  }
  client.ontimeout = function () {
    error = "importModule: HTTP Request Timeout";
    document.getElementById('welcome').style.display = 'none';
    updateErrorAndWarning();
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
    simulator.updateSimulation();
  }
};




function initParameters() {
  document.title = getMsg('appName');
  document.getElementById('save_name').value = "";

  isConstructing = false;
  endPositioning();
  scene = new Scene();
  scene.setViewportSize(canvas.width/dpr, canvas.height/dpr);

  selectObj(-1);

  document.getElementById("rayDensity").value = scene.rayModeDensity;
  document.getElementById("rayDensity_more").value = scene.rayModeDensity;
  document.getElementById("rayDensity_mobile").value = scene.rayModeDensity;
  document.getElementById("zoom").innerText = Math.round(scene.scale * scene.lengthScale * 100) + '%';
  document.getElementById("zoom_mobile").innerText = Math.round(scene.scale * scene.lengthScale * 100) + '%';
  toolbtn_clicked('');
  modebtn_clicked('rays');
  scene.backgroundImage = null;

  //Reset new UI.
  
  resetDropdownButtons();
  updateModuleObjsMenu();
  
  document.getElementById('tool_').checked = true;
  document.getElementById('tool__mobile').checked = true;
  document.getElementById('mode_rays').checked = true;
  document.getElementById('mode_rays_mobile').checked = true;

  document.getElementById('lockObjs').checked = false;
  document.getElementById('snapToGrid').checked = false;
  document.getElementById('showGrid').checked = false;

  document.getElementById('lockObjs_more').checked = false;
  document.getElementById('snapToGrid_more').checked = false;
  document.getElementById('showGrid_more').checked = false;

  document.getElementById('lockObjs_mobile').checked = false;
  document.getElementById('snapToGrid_mobile').checked = false;
  document.getElementById('showGrid_mobile').checked = false;

  document.getElementById('simulateColors').checked = false;
  document.getElementById('simulateColors_mobile').checked = false;

  document.getElementById('apply_to_all').checked = false;
  document.getElementById('apply_to_all_mobile').checked = false;

  document.getElementById('gridSize').value = scene.gridSize;
  document.getElementById('gridSize_mobile').value = scene.gridSize;

  document.getElementById('observer_size').value = 40;
  document.getElementById('observer_size_mobile').value = 40;

  document.getElementById('lengthScale').value = scene.lengthScale;
  document.getElementById('lengthScale_mobile').value = scene.lengthScale;
  
  simulator.updateSimulation();
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
    simulator.updateSimulation(!scene.objs[selectedObj].constructor.isOptical, true);
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
      var selectedObjType = scene.objs[selectedObj].constructor.type;
      removeObj(selectedObj);
      simulator.updateSimulation(!objTypes[selectedObjType].isOptical, true);
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
    var step = scene.snapToGrid ? scene.gridSize : 1;
    if (selectedObj >= 0) {
      if (e.keyCode == 37) {
        scene.objs[selectedObj].move(-step, 0);
      }
      if (e.keyCode == 38) {
        scene.objs[selectedObj].move(0, -step);
      }
      if (e.keyCode == 39) {
        scene.objs[selectedObj].move(step, 0);
      }
      if (e.keyCode == 40) {
        scene.objs[selectedObj].move(0, step);
      }
      simulator.updateSimulation(!scene.objs[selectedObj].constructor.isOptical, true);
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
      simulator.updateSimulation(false, true);
    }
    else {
      // TODO: Is this a historical remnant? Should the expected behavior be to change `scene.origin` instead? Note however that some users may be using the current behavior to align the scene with the background image or the grid.
      for (var i = 0; i < scene.objs.length; i++) {
        if (e.keyCode == 37) {
          scene.objs[i].move(-step, 0);
        }
        if (e.keyCode == 38) {
          scene.objs[i].move(0, -step);
        }
        if (e.keyCode == 39) {
          scene.objs[i].move(step, 0);
        }
        if (e.keyCode == 40) {
          scene.objs[i].move(0, step);
        }
      }
      simulator.updateSimulation();
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
  if (scene.error) {
    return;
  }

  scene.setViewportSize(canvas.width/dpr, canvas.height/dpr);
  
  newJsonCode = scene.toJSON();
  if (aceEditor && newJsonCode != latestJsonCode && !aceEditor.isFocused()) {

    // Calculate the position of the first and last character that has changed
    var minLen = Math.min(newJsonCode.length, latestJsonCode.length);
    var startChar = 0;
    while (startChar < minLen && newJsonCode[startChar] == latestJsonCode[startChar]) {
      startChar++;
    }
    var endChar = 0;
    while (endChar < minLen && newJsonCode[newJsonCode.length - 1 - endChar] == latestJsonCode[latestJsonCode.length - 1 - endChar]) {
      endChar++;
    }

    // Convert the character positions to line numbers
    var startLineNum = newJsonCode.substr(0, startChar).split("\n").length - 1;
    var endLineNum = newJsonCode.substr(0, newJsonCode.length - endChar).split("\n").length - 1;

    // Set selection range to highlight changes using the Range object
    var Range = require("ace/range").Range;
    var selectionRange = new Range(startLineNum, 0, endLineNum+1, 0);

    lastCodeChangeIsFromScene = true;
    aceEditor.setValue(newJsonCode);
    aceEditor.selection.setSelectionRange(selectionRange);

    // Scroll to the first line that has changed
    aceEditor.scrollToLine(startLineNum, true, true, function () { });
  }
  latestJsonCode = newJsonCode;
  
  syncUrl();
  warning = "";
  updateErrorAndWarning();
  requireOccasionalCheck();
}

var requireOccasionalCheckTimeout = null;

function requireOccasionalCheck() {
  if (scene.error) {
    return;
  }

  if (requireOccasionalCheckTimeout) {
    clearTimeout(requireOccasionalCheckTimeout);
  }

  requireOccasionalCheckTimeout = setTimeout(occasionalCheck, scene.warning ? 500 : 5000);
}

function occasionalCheck() {
  if (scene.error) {
    return;
  }
  scene.warning = null;

  // Check if there are identical optical objects
  const opticalObjs = scene.opticalObjs;

  if (opticalObjs.length < 100) {
    const stringifiedObjs = opticalObjs.map(obj => JSON.stringify(obj));
    for (var i = 0; i < opticalObjs.length; i++) {
      for (var j = i + 1; j < opticalObjs.length; j++) {
        if (stringifiedObjs[i] == stringifiedObjs[j]) {
          scene.warning = `opticalObjs[${i}]==[${j}] ${opticalObjs[i].constructor.type}: ` + getMsg('identical_optical_objects_warning');
          break;
        }
      }
    }
  }
  updateErrorAndWarning();
}

var lastFullURL = "";

function syncUrl() {
  if (!autoSyncUrl) return;
  if (document.getElementById('welcome').style.display != 'none') return;
  
  var compressed = JsonUrl('lzma').compress(JSON.parse(latestJsonCode)).then(output => {
    var fullURL = "https://phydemo.app/ray-optics/simulator/#" + output;
    if (fullURL.length > 2041) {
      warning = getMsg('auto_sync_url_warning');
      updateErrorAndWarning();
    } else {
      if (Math.abs(fullURL.length - lastFullURL.length) > 200) {
        // If the length of the scene change significantly, push a new history state to prevent accidental data loss.
        lastFullURL = fullURL;
        window.history.pushState(undefined, undefined, '#' + output);
      } else {
        lastFullURL = fullURL;
        window.history.replaceState(undefined, undefined, '#' + output);
      }
      hasUnsavedChange = false;
      warning = "";
      updateErrorAndWarning();
    }
  });
}





function JSONInput() {
  document.getElementById('welcome').style.display = 'none';

  scene.setViewportSize(canvas.width/dpr, canvas.height/dpr);
  scene.fromJSON(latestJsonCode, function (needFullUpdate, completed) {
    if (needFullUpdate) {
      // Update the UI for the loaded scene.

      if (scene.name) {
        document.title = scene.name + " - " + getMsg("appName");
        document.getElementById('save_name').value = scene.name;
      } else {
        document.title = getMsg("appName");
      }

      if (Object.keys(scene.modules).length > 0) {
        updateModuleObjsMenu();
      }

      document.getElementById('showGrid').checked = scene.showGrid;
      document.getElementById('showGrid_more').checked = scene.showGrid;
      document.getElementById('showGrid_mobile').checked = scene.showGrid;

      document.getElementById('snapToGrid').checked = scene.snapToGrid;
      document.getElementById('snapToGrid_more').checked = scene.snapToGrid;
      document.getElementById('snapToGrid_mobile').checked = scene.snapToGrid;

      document.getElementById('lockObjs').checked = scene.lockObjs;
      document.getElementById('lockObjs_more').checked = scene.lockObjs;
      document.getElementById('lockObjs_mobile').checked = scene.lockObjs;

      if (scene.observer) {
        document.getElementById('observer_size').value = Math.round(scene.observer.r * 2 * 1000000) / 1000000;
        document.getElementById('observer_size_mobile').value = Math.round(scene.observer.r * 2 * 1000000) / 1000000;
      } else {
        document.getElementById('observer_size').value = 40;
        document.getElementById('observer_size_mobile').value = 40;
      }

      document.getElementById('gridSize').value = scene.gridSize;
      document.getElementById('gridSize_mobile').value = scene.gridSize;

      document.getElementById('lengthScale').value = scene.lengthScale;
      document.getElementById('lengthScale_mobile').value = scene.lengthScale;

      document.getElementById("zoom").innerText = Math.round(scene.scale * scene.lengthScale * 100) + '%';
      document.getElementById("zoom_mobile").innerText = Math.round(scene.scale * scene.lengthScale * 100) + '%';
      document.getElementById('simulateColors').checked = scene.simulateColors;
      document.getElementById('simulateColors_mobile').checked = scene.simulateColors;
      modebtn_clicked(scene.mode);
      document.getElementById('mode_' + scene.mode).checked = true;
      document.getElementById('mode_' + scene.mode + '_mobile').checked = true;
      selectObj(selectedObj);
      simulator.updateSimulation();
    } else {
      // Partial update (e.g. when the background image is loaded)
      setTimeout(function() {
        simulator.updateSimulation(true, true);
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
    document.getElementById("rayDensity").value = Math.log(scene.imageModeDensity);
    document.getElementById("rayDensity_more").value = Math.log(scene.imageModeDensity);
    document.getElementById("rayDensity_mobile").value = Math.log(scene.imageModeDensity);
  }
  else {
    document.getElementById("rayDensity").value = Math.log(scene.rayModeDensity);
    document.getElementById("rayDensity_more").value = Math.log(scene.rayModeDensity);
    document.getElementById("rayDensity_mobile").value = Math.log(scene.rayModeDensity);
  }
  if (scene.mode == 'observer' && !scene.observer) {
    // Initialize the observer
    scene.observer = geometry.circle(geometry.point((canvas.width * 0.5 / dpr - scene.origin.x) / scene.scale, (canvas.height * 0.5 / dpr - scene.origin.y) / scene.scale), parseFloat(document.getElementById('observer_size').value) * 0.5);
  }


  try {
    simulator.updateSimulation(false, true);
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
  document.getElementById("zoom").innerText = Math.round(scene.scale * scene.lengthScale * 100) + '%';
  document.getElementById("zoom_mobile").innerText = Math.round(scene.scale * scene.lengthScale * 100) + '%';
  simulator.updateSimulation();
}

function rename() {
  scene.name = document.getElementById('save_name').value;
  if (scene.name) {
    document.title = scene.name + " - " + getMsg("appName");
  } else {
    document.title = getMsg("appName");
  }
  JSONOutput();
}

function save() {
  rename();

  var blob = new Blob([latestJsonCode], { type: 'application/json' });
  saveAs(blob, (scene.name || "scene") + ".json");
  var saveModal = bootstrap.Modal.getInstance(document.getElementById('saveModal'));
  if (saveModal) {
    saveModal.hide();
  }
  hasUnsavedChange = false;
}

function openFile(readFile) {
  var reader = new FileReader();
  reader.readAsText(readFile);
  reader.onload = function (evt) {
    var fileString = evt.target.result;

    let isJSON = true;
    try {
      const parsed = JSON.parse(fileString);
      if (typeof parsed !== 'object' || parsed === null) {
        isJSON = false;
      }
    } catch (e) {
      isJSON = false;
    }

    if (isJSON) {
      // Load the scene file
      latestJsonCode = fileString;
      endPositioning();
      selectedObj = -1;
      JSONInput();
      hasUnsavedChange = false;
      createUndoPoint();
      if (aceEditor) {
        aceEditor.session.setValue(latestJsonCode);
      }
    } else {
      // Load the background image file
      reader.onload = function (e) {
        scene.backgroundImage = new Image();
        scene.backgroundImage.src = e.target.result;
        scene.backgroundImage.onload = function (e1) {
          simulator.updateSimulation(true, true);
        }
        scene.backgroundImage.onerror = function (e1) {
          scene.backgroundImage = null;
          error = "openFile: The file is neither a valid JSON scene nor an image file.";
          updateErrorAndWarning();
        }
      }
      reader.readAsDataURL(readFile);
    }
  };

}

function getLink() {
  JSONOutput();
  JsonUrl('lzma').compress(JSON.parse(latestJsonCode)).then(output => {
    var fullURL = "https://phydemo.app/ray-optics/simulator/#" + output;
    lastFullURL = fullURL;
    window.history.pushState(undefined, undefined, '#' + output);
    //console.log(fullURL.length);
    navigator.clipboard.writeText(fullURL);
    if (fullURL.length > 2041) {
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
    if (scene.objs[i].constructor.type == 'CropBox') {
      cropBoxIndex = i;
      break;
    }
  }
  if (cropBoxIndex == -1) {
    // Create a new cropBox
    let cropBox = new objTypes['CropBox'](scene, {
      p1: geometry.point((canvas.width * 0.2 / dpr - scene.origin.x) / scene.scale, ((120 + (canvas.height-120) * 0.2) / dpr - scene.origin.y) / scene.scale),
      p4: geometry.point((canvas.width * 0.8 / dpr - scene.origin.x) / scene.scale, ((120 + (canvas.height-120) * 0.8) / dpr - scene.origin.y) / scene.scale),
    });
    scene.objs.push(cropBox);
    cropBoxIndex = scene.objs.length - 1;
  }

  selectObj(cropBoxIndex);

  simulator.updateSimulation(true, true);
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
  simulator.updateSimulation(true, true);
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
  simulator.updateSimulation();
  isExporting = false;
  var blob = new Blob([ctx.getSerializedSvg()], { type: 'image/svg+xml' });
  saveAs(blob, (scene.name || "export") + ".svg");

  ctx = ctx_backup;
  ctx0 = ctx0_backup;
  ctxLight = ctxLight_backup;
  ctxGrid = ctxGrid_backup;
  scene.scale = scale_backup;
  scene.origin = origin_backup;
  dpr = dpr_backup;
  simulator.updateSimulation(true, true);
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
  simulator.updateSimulation();
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
    saveAs(blob, (scene.name || "export") + ".png");
  });

  scene.scale = scale_backup;
  scene.origin = origin_backup;
  dpr = dpr_backup;
  window.onresize();
}

window.onbeforeunload = function(e) {
  if (hasUnsavedChange) {
    return "You have unsaved change.";
  }
}

