var objTypes = {};
var canvas;
var ctx;
var objs = []; //物件 The objects
var objCount = 0; //物件數量 Number of the objects
var observer;
var xyBox_cancelContextMenu = false;
var scale = 1;
var cartesianSign = false;
var backgroundImage = null;
var restoredData = "";
var isFromGallery = false;
var hasUnsavedChange = false;
var showAdvancedOn = false;
var MQ;

window.onload = function (e) {
  canvas = document.getElementById('canvas1');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx = canvas.getContext('2d');



  mouse = graphs.point(0, 0);
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
    console.log("mousedown");
    //document.getElementById('objAttr_text').blur();
    // TODO: check that commenting out the above line does not cause problem.

    document.body.focus();
    canvas_onmousedown(e);
  });

  canvas.addEventListener('mousemove', function (e) {
    console.log("mousemove");
    canvas_onmousemove(e);
  });

  canvas.addEventListener('mouseup',  function (e) {
    console.log("mouseup");
    canvas_onmouseup(e);
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
      console.log("touchstart");
      document.body.focus();
      canvas_onmousemove(e);
      canvas_onmousedown(e);
    }
  });

  canvas.addEventListener('touchmove',  function (e) {
    e.preventDefault();
    console.log("touchmove");
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
        lastScale = scale;
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
      origin.x += dx2;
      origin.y += dy2;
  
      // Apply the scale transformation
      setScaleWithCenter(newScale, (x - e.target.offsetLeft) / scale, (y - e.target.offsetTop) / scale);
      
      // Update last values
      lastX = x;
      lastY = y;

    } else {
      canvas_onmousemove(e);
    }
  });

  canvas.addEventListener('touchend',  function (e) {
    console.log("touchend");
    if (e.touches.length < 2) {
      initialPinchDistance = null;
      canvas_onmouseup(e);
    }
  });

  canvas.addEventListener('touchcancel',  function (e) {
    console.log("touchcancel");
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


  document.getElementById('undo').onclick = undo;
  document.getElementById('redo').onclick = redo;
  document.getElementById('undo_mobile').onclick = undo;
  document.getElementById('redo_mobile').onclick = redo;
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
  document.getElementById('export_svg').onclick = exportSVG;
  document.getElementById('export_svg_mobile').onclick = exportSVG;
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
    colorMode = this.checked;
    document.getElementById('color_mode').checked = colorMode;
    document.getElementById('color_mode_mobile').checked = colorMode;
    draw();
  };
  document.getElementById('color_mode_mobile').onclick = document.getElementById('color_mode').onclick;

  document.getElementById('show_help_popups').onclick = function () {
    popoversEnabled = this.checked;
    localStorage.rayOpticsHelp = popoversEnabled ? "on" : "off";
  };

  document.getElementById('zoomPlus').onclick = function () {
    setScale(scale * 1.1);
  }
  document.getElementById('zoomMinus').onclick = function () {
    setScale(scale / 1.1);
  }
  document.getElementById('zoomPlus_mobile').onclick = document.getElementById('zoomPlus').onclick;
  document.getElementById('zoomMinus_mobile').onclick = document.getElementById('zoomMinus').onclick;


  document.getElementById('rayDensity').oninput = function () {
    setRayDensity(Math.exp(this.value));
    document.getElementById('rayDensity').value = this.value;
    document.getElementById('rayDensity_more').value = this.value;
    document.getElementById('rayDensity_mobile').value = this.value;
    draw();
  };
  document.getElementById('rayDensity_more').oninput = document.getElementById('rayDensity').oninput;
  document.getElementById('rayDensity_mobile').oninput = document.getElementById('rayDensity').oninput;

  document.getElementById('rayDensity').onmouseup = function () {
    setRayDensity(Math.exp(this.value)); //為了讓不支援oninput的瀏覽器可使用 For browsers not supporting oninput
    document.getElementById('rayDensity').value = this.value;
    document.getElementById('rayDensity_more').value = this.value;
    document.getElementById('rayDensity_mobile').value = this.value;
    draw();
    createUndoPoint();
  };
  document.getElementById('rayDensity_more').onmouseup = document.getElementById('rayDensity').onmouseup;
  document.getElementById('rayDensity_mobile').onmouseup = document.getElementById('rayDensity').onmouseup;

  document.getElementById('rayDensity').ontouchend = function () {
    setRayDensity(Math.exp(this.value)); //為了讓不支援oninput的瀏覽器可使用 For browsers not supporting oninput
    document.getElementById('rayDensity').value = this.value;
    document.getElementById('rayDensity_more').value = this.value;
    document.getElementById('rayDensity_mobile').value = this.value;
    draw();
    createUndoPoint();
  };
  document.getElementById('rayDensity_more').ontouchend = document.getElementById('rayDensity').ontouchend;
  document.getElementById('rayDensity_mobile').ontouchend = document.getElementById('rayDensity').ontouchend;

  document.getElementById('rayDensityPlus').onclick = function () {
    rayDensityValue = Math.log(getRayDensity()) * 1.0 + 0.1;
    setRayDensity(Math.exp(rayDensityValue));
    document.getElementById('rayDensity').value = rayDensityValue;
    document.getElementById('rayDensity_more').value = rayDensityValue;
    document.getElementById('rayDensity_mobile').value = rayDensityValue;
    draw();
  };
  document.getElementById('rayDensityMinus').onclick = function () {
    rayDensityValue = Math.log(getRayDensity()) * 1.0 - 0.1;
    setRayDensity(Math.exp(rayDensityValue));
    document.getElementById('rayDensity').value = rayDensityValue;
    document.getElementById('rayDensity_more').value = rayDensityValue;
    document.getElementById('rayDensity_mobile').value = rayDensityValue;
    draw();
  };
  document.getElementById('rayDensityPlus_mobile').onclick = document.getElementById('rayDensityPlus').onclick;
  document.getElementById('rayDensityMinus_mobile').onclick = document.getElementById('rayDensityMinus').onclick;
  document.getElementById('rayDensityPlus_more').onclick = document.getElementById('rayDensityPlus').onclick;
  document.getElementById('rayDensityMinus_more').onclick = document.getElementById('rayDensityMinus').onclick;


  document.getElementById('grid').onclick = function (e) {
    document.getElementById('grid').checked = e.target.checked;
    document.getElementById('grid_more').checked = e.target.checked;
    document.getElementById('grid_mobile').checked = e.target.checked;
    draw();
  };
  document.getElementById('grid_more').onclick = document.getElementById('grid').onclick;
  document.getElementById('grid_mobile').onclick = document.getElementById('grid').onclick;

  document.getElementById('showgrid').onclick = function (e) {
    document.getElementById('showgrid').checked = e.target.checked;
    document.getElementById('showgrid_more').checked = e.target.checked;
    document.getElementById('showgrid_mobile').checked = e.target.checked;
    draw();
  };
  document.getElementById('showgrid_more').onclick = document.getElementById('showgrid').onclick;
  document.getElementById('showgrid_mobile').onclick = document.getElementById('showgrid').onclick;

  document.getElementById('lockobjs').onclick = function (e) {
    document.getElementById('lockobjs').checked = e.target.checked;
    document.getElementById('lockobjs_more').checked = e.target.checked;
    document.getElementById('lockobjs_mobile').checked = e.target.checked;
  };
  document.getElementById('lockobjs_more').onclick = document.getElementById('lockobjs').onclick;
  document.getElementById('lockobjs_mobile').onclick = document.getElementById('lockobjs').onclick;

  document.getElementById('forceStop').onclick = function () {
    if (timerID != -1) {
      forceStop = true;
    }
  };

  document.getElementById('restore').onclick = function () { restore() };

  document.getElementById('setAttrAll').onclick = function () {
    const checked = this.checked;
    document.getElementById('setAttrAll').checked = checked;
    document.getElementById('applytoall_mobile').checked = checked;
  }
  document.getElementById('applytoall_mobile').onclick = document.getElementById('setAttrAll').onclick;

  document.getElementById('copy').onclick = function () {
    objs[objs.length] = JSON.parse(JSON.stringify(objs[selectedObj]));
    objTypes[objs[objs.length - 1].type].move(objs[objs.length - 1], gridSize, gridSize);
    selectObj(objs.length - 1);
    draw();
    createUndoPoint();
  };
  document.getElementById('copy_mobile').onclick = document.getElementById('copy').onclick;

  document.getElementById('delete').onclick = function () {
    removeObj(selectedObj);
    draw();
    createUndoPoint();
  };
  document.getElementById('delete_mobile').onclick = document.getElementById('delete').onclick;

  document.getElementById('unselect').onclick = function () {
    selectObj(-1);
    draw();
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
      backgroundImage = null;
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
    backgroundImage = null;
    JSONInput();
    createUndoPoint();
    isFromGallery = true;
    hasUnsavedChange = false;
  }
  client.send();
}




window.onresize = function (e) {
  if (ctx) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
  }
};




function initParameters() {
  isConstructing = false;
  endPositioning();
  objs.length = 0;
  selectObj(-1);

  rayDensity_light = 0.1; //光線密度(光線相關模式) The Ray Density when View is Rays or Extended rays
  rayDensity_images = 1; //光線密度(像相關模式) The Ray Density when View is All Images or Seen by Observer
  document.getElementById("rayDensity").value = rayDensity_light;
  document.getElementById("rayDensity_more").value = rayDensity_light;
  document.getElementById("rayDensity_mobile").value = rayDensity_light;
  extendLight = false;
  showLight = true;
  origin = { x: 0, y: 0 };
  observer = null;
  scale = 1;
  cartesianSign = false;
  try {
    if (localStorage.rayOpticsCartesianSign == "true") {
      cartesianSign = true;
    }
  } catch { }
  document.getElementById("zoom").innerText = Math.round(scale * 100) + '%';
  document.getElementById("zoom_mobile").innerText = Math.round(scale * 100) + '%';
  toolbtn_clicked('');
  modebtn_clicked('light');
  colorMode = false;
  backgroundImage = null;

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

  document.getElementById('setAttrAll').checked = false;
  document.getElementById('applytoall_mobile').checked = false;

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
    draw();
    createUndoPoint();
    return false;
  }
  //Ctrl+Y
  if (e.ctrlKey && e.keyCode == 89) {
    document.getElementById('redo').onclick();
  }

  //Ctrl+S
  if (e.ctrlKey && e.keyCode == 83) {
    document.getElementById('save').onclick();
  }

  //Ctrl+O
  if (e.ctrlKey && e.keyCode == 79) {
    document.getElementById('open').onclick();
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
      removeObj(selectedObj);
      draw();
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
    var step = document.getElementById('grid').checked ? gridSize : 1;
    if (selectedObj >= 0) {
      if (e.keyCode == 37) {
        objTypes[objs[selectedObj].type].move(objs[selectedObj], -step, 0);
      }
      if (e.keyCode == 38) {
        objTypes[objs[selectedObj].type].move(objs[selectedObj], 0, -step);
      }
      if (e.keyCode == 39) {
        objTypes[objs[selectedObj].type].move(objs[selectedObj], step, 0);
      }
      if (e.keyCode == 40) {
        objTypes[objs[selectedObj].type].move(objs[selectedObj], 0, step);
      }
    }
    else if (mode == 'observer') {
      if (e.keyCode == 37) {
        observer.c.x -= step;
      }
      if (e.keyCode == 38) {
        observer.c.y -= step;
      }
      if (e.keyCode == 39) {
        observer.c.x += step;
      }
      if (e.keyCode == 40) {
        observer.c.y += step;
      }
    }
    else {
      for (var i = 0; i < objs.length; i++) {
        if (e.keyCode == 37) {
          objTypes[objs[i].type].move(objs[i], -step, 0);
        }
        if (e.keyCode == 38) {
          objTypes[objs[i].type].move(objs[i], 0, -step);
        }
        if (e.keyCode == 39) {
          objTypes[objs[i].type].move(objs[i], step, 0);
        }
        if (e.keyCode == 40) {
          objTypes[objs[i].type].move(objs[i], 0, step);
        }
      }
    }
    draw();
  }



};

window.onkeyup = function (e) {
  //Arrow Keys
  if (e.keyCode >= 37 && e.keyCode <= 40) {
    createUndoPoint();
  }

};


// attributes starting with tmp_ are not written to output
function JSONreplacer(name, val) {
  if (name.startsWith("tmp_"))
    return undefined;
  return val;
}

function JSONOutput() {
  document.getElementById('textarea1').value = JSON.stringify({ version: 2, objs: objs, mode: mode, rayDensity_light: rayDensity_light, rayDensity_images: rayDensity_images, observer: observer, origin: origin, scale: scale, colorMode: colorMode }, JSONreplacer, 2);
  /*
  if (typeof (Storage) !== "undefined" && !restoredData && !isFromGallery) {
    localStorage.rayOpticsData = document.getElementById('textarea1').value;
  }
  */
}
function JSONInput() {
  document.getElementById('welcome').style.display = 'none';
  var jsonData = JSON.parse(document.getElementById('textarea1').value);
  if (typeof jsonData != 'object') return;
  if (!jsonData.version) {
    //為"線光學模擬1.0"或之前的格式 Earlier than "Ray Optics Simulation 1.0"
    var str1 = document.getElementById('textarea1').value.replace(/"point"|"xxa"|"aH"/g, '1').replace(/"circle"|"xxf"/g, '5').replace(/"k"/g, '"objs"').replace(/"L"/g, '"p1"').replace(/"G"/g, '"p2"').replace(/"F"/g, '"p3"').replace(/"bA"/g, '"exist"').replace(/"aa"/g, '"parallel"').replace(/"ba"/g, '"mirror"').replace(/"bv"/g, '"lens"').replace(/"av"/g, '"notDone"').replace(/"bP"/g, '"lightAlpha"').replace(/"ab"|"observed_light"|"observed_images"/g, '"observer"');
    jsonData = JSON.parse(str1);
    if (!jsonData.objs) {
      jsonData = { objs: jsonData };
    }
    if (!jsonData.mode) {
      jsonData.mode = 'light';
    }
    if (!jsonData.rayDensity_light) {
      jsonData.rayDensity_light = 1;
    }
    if (!jsonData.rayDensity_images) {
      jsonData.rayDensity_images = 1;
    }
    if (!jsonData.scale) {
      jsonData.scale = 1;
    }
    jsonData.version = 1;
  }
  if (jsonData.version == 1) {
    //"線光學模擬1.1"至"線光學模擬1.2" "Ray Optics Simulation 1.1" to "Ray Optics Simulation 1.2"
    jsonData.origin = { x: 0, y: 0 };
  }
  if (jsonData.version > 2) {
    //為比此版本新的檔案版本 Newer than the current version
    return;
  }
  //TODO: Create new version.
  if (!jsonData.scale) {
    jsonData.scale = 1;
  }
  if (!jsonData.colorMode) {
    jsonData.colorMode = false;
  }
  if (jsonData.backgroundImage) {
    backgroundImage = new Image();
    backgroundImage.src = "../gallery/" + jsonData.backgroundImage;
    backgroundImage.onload = function (e1) {
      setTimeout(function() {
        draw();
      }, 1);
    }
  }

  objs = jsonData.objs;
  rayDensity_light = jsonData.rayDensity_light;
  rayDensity_images = jsonData.rayDensity_images;
  observer = jsonData.observer;
  origin = jsonData.origin;
  scale = jsonData.scale;
  colorMode = jsonData.colorMode;
  document.getElementById('color_mode').checked = colorMode;
  document.getElementById('color_mode_mobile').checked = colorMode;
  modebtn_clicked(jsonData.mode);
  document.getElementById('mode_' + jsonData.mode).checked = true;
  document.getElementById('mode_' + jsonData.mode + '_mobile').checked = true;
  selectObj(selectedObj);
}


function toolbtn_clicked(tool, e) {
  if (tool != "") {
    document.getElementById('welcome').style.display = 'none';
  }
  AddingObjType = tool;
}


function modebtn_clicked(mode1) {
  mode = mode1;
  if (mode == 'images' || mode == 'observer') {
    document.getElementById("rayDensity").value = Math.log(rayDensity_images);
    document.getElementById("rayDensity_more").value = Math.log(rayDensity_images);
    document.getElementById("rayDensity_mobile").value = Math.log(rayDensity_images);
  }
  else {
    document.getElementById("rayDensity").value = Math.log(rayDensity_light);
    document.getElementById("rayDensity_more").value = Math.log(rayDensity_light);
    document.getElementById("rayDensity_mobile").value = Math.log(rayDensity_light);
  }
  if (mode == 'observer' && !observer) {
    //初始化觀察者 Initialize the observer
    observer = graphs.circle(graphs.point((canvas.width * 0.5 - origin.x) / scale, (canvas.height * 0.5 - origin.y) / scale), 20);
  }


  try {
    draw();
  } catch (error) {
    console.error(error);
    isDrawing = false;
  }
}


function setScale(value) {
  setScaleWithCenter(value, canvas.width / scale / 2, canvas.height / scale / 2);
}

function setScaleWithCenter(value, centerX, centerY) {
  scaleChange = value - scale;
  origin.x *= value / scale;
  origin.y *= value / scale;
  origin.x -= centerX * scaleChange;
  origin.y -= centerY * scaleChange;
  scale = value;
  document.getElementById("zoom").innerText = Math.round(scale * 100) + '%';
  document.getElementById("zoom_mobile").innerText = Math.round(scale * 100) + '%';
  draw();
}

function save() {
  JSONOutput();

  var blob = new Blob([document.getElementById('textarea1').value], { type: 'application/json' });
  saveAs(blob, document.getElementById('save_name').value);

  document.getElementById('saveBox').style.display = 'none';
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
        backgroundImage = new Image();
        backgroundImage.src = e.target.result;
        backgroundImage.onload = function (e1) {
          draw();
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
    console.log(fullURL.length);
    navigator.clipboard.writeText(fullURL);
    if (fullURL.length > 2043) {
      alert(getMsg("get_link_warning"));
    } else {
      hasUnsavedChange = false;
    }
  });
}

function exportSVG() {
  var ctx1 = ctx;
  if (backgroundImage) {
    var svgWidth = backgroundImage.width;
    var svgHeight = backgroundImage.height;
  } else {
    var svgWidth = canvas.width / scale;
    var svgHeight = canvas.height / scale;
  }
  ctx = new C2S(svgWidth, svgHeight);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, svgWidth, svgHeight);
  draw();
  var blob = new Blob([ctx.getSerializedSvg()], { type: 'image/svg+xml' });
  saveAs(blob, "export.svg");
  ctx = ctx1;
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

