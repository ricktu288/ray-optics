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
var cropMode = false;

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

  canvas.addEventListener('mouseout',  function (e) {
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
    colorMode = this.checked;
    document.getElementById('color_mode').checked = colorMode;
    document.getElementById('color_mode_mobile').checked = colorMode;
    selectObj(selectedObj);
    draw(false, true);
  };
  document.getElementById('color_mode_mobile').onclick = document.getElementById('color_mode').onclick;

  document.getElementById('show_help_popups').onclick = function () {
    popoversEnabled = this.checked;
    localStorage.rayOpticsHelp = popoversEnabled ? "on" : "off";
  };

  document.getElementById('show_status').onclick = function () {
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
    gridSize = parseFloat(this.value);
    document.getElementById('grid_size').value = gridSize;
    document.getElementById('grid_size_mobile').value = gridSize;
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
    if (observer) {
      observer.r = parseFloat(this.value) * 0.5;
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
    draw(false, true);
  };
  document.getElementById('rayDensity_more').oninput = document.getElementById('rayDensity').oninput;
  document.getElementById('rayDensity_mobile').oninput = document.getElementById('rayDensity').oninput;

  document.getElementById('rayDensity').onmouseup = function () {
    setRayDensity(Math.exp(this.value)); //為了讓不支援oninput的瀏覽器可使用 For browsers not supporting oninput
    document.getElementById('rayDensity').value = this.value;
    document.getElementById('rayDensity_more').value = this.value;
    document.getElementById('rayDensity_mobile').value = this.value;
    draw(false, true);
    createUndoPoint();
  };
  document.getElementById('rayDensity_more').onmouseup = document.getElementById('rayDensity').onmouseup;
  document.getElementById('rayDensity_mobile').onmouseup = document.getElementById('rayDensity').onmouseup;

  document.getElementById('rayDensity').ontouchend = function () {
    setRayDensity(Math.exp(this.value)); //為了讓不支援oninput的瀏覽器可使用 For browsers not supporting oninput
    document.getElementById('rayDensity').value = this.value;
    document.getElementById('rayDensity_more').value = this.value;
    document.getElementById('rayDensity_mobile').value = this.value;
    draw(false, true);
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
    draw(false, true);
  };
  document.getElementById('rayDensityMinus').onclick = function () {
    rayDensityValue = Math.log(getRayDensity()) * 1.0 - 0.1;
    setRayDensity(Math.exp(rayDensityValue));
    document.getElementById('rayDensity').value = rayDensityValue;
    document.getElementById('rayDensity_more').value = rayDensityValue;
    document.getElementById('rayDensity_mobile').value = rayDensityValue;
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
    //draw();
  };
  document.getElementById('grid_more').onclick = document.getElementById('grid').onclick;
  document.getElementById('grid_mobile').onclick = document.getElementById('grid').onclick;

  document.getElementById('showgrid').onclick = function (e) {
    document.getElementById('showgrid').checked = e.target.checked;
    document.getElementById('showgrid_more').checked = e.target.checked;
    document.getElementById('showgrid_mobile').checked = e.target.checked;
    draw(true, false);
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
    draw(!(objTypes[objs[selectedObj].type].shoot || objTypes[objs[selectedObj].type].rayIntersection), true);
    createUndoPoint();
  };
  document.getElementById('copy_mobile').onclick = document.getElementById('copy').onclick;

  document.getElementById('delete').onclick = function () {
    var selectedObjType = objs[selectedObj].type;
    removeObj(selectedObj);
    draw(!(objTypes[selectedObjType].shoot || objTypes[selectedObjType].rayIntersection), true);
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

  gridSize = 20;
  document.getElementById('grid_size').value = gridSize;
  document.getElementById('grid_size_mobile').value = gridSize;

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
    draw(!(objTypes[objs[selectedObj].type].shoot || objTypes[objs[selectedObj].type].rayIntersection), true);
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
      var selectedObjType = objs[selectedObj].type;
      removeObj(selectedObj);
      draw(!(objTypes[selectedObjType].shoot || objTypes[selectedObjType].rayIntersection), true);
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
      draw(!(objTypes[objs[selectedObj].type].shoot || objTypes[objs[selectedObj].type].rayIntersection), true);
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
      draw(false, true);
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


// attributes starting with tmp_ are not written to output
function JSONreplacer(name, val) {
  if (name.startsWith("tmp_"))
    return undefined;
  return val;
}

function JSONOutput() {
  var canvasWidth = Math.ceil((canvas.width/dpr) / 100) * 100;
  var canvasHeight = Math.ceil((canvas.height/dpr) / 100) * 100;
  document.getElementById('textarea1').value = JSON.stringify({
     version: 2,
     objs: objs,
     mode: mode,
     rayDensity_light: rayDensity_light,
     rayDensity_images: rayDensity_images,
     showGrid: document.getElementById('showgrid').checked,
     grid: document.getElementById('grid').checked,
     lockobjs: document.getElementById('lockobjs').checked,
     gridSize: gridSize,
     observer: observer,
     origin: origin,
     scale: scale,
     width: canvasWidth,
     height: canvasHeight,
     colorMode: colorMode,
     symbolicGrin: symbolicGrin
    }, JSONreplacer, 2);
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
  if (!jsonData.symbolicGrin) {
    jsonData.symbolicGrin = false;
  }
  if (jsonData.backgroundImage) {
    backgroundImage = new Image();
    backgroundImage.src = "../gallery/" + jsonData.backgroundImage;
    backgroundImage.onload = function (e1) {
      setTimeout(function() {
        draw(true, true);
      }, 1);
    }
  }
  if (!jsonData.width) {
    jsonData.width = 1500;
  }
  if (!jsonData.height) {
    jsonData.height = 900;
  }
  if (!jsonData.showGrid) {
    jsonData.showGrid = false;
  }
  if (!jsonData.grid) {
    jsonData.grid = false;
  }
  if (!jsonData.lockobjs) {
    jsonData.lockobjs = false;
  }
  if (!jsonData.gridSize) {
    jsonData.gridSize = 20;
  }

  objs = jsonData.objs;
  rayDensity_light = jsonData.rayDensity_light;
  rayDensity_images = jsonData.rayDensity_images;

  document.getElementById('showgrid').checked = jsonData.showGrid;
  document.getElementById('showgrid_more').checked = jsonData.showGrid;
  document.getElementById('showgrid_mobile').checked = jsonData.showGrid;
  document.getElementById('grid').checked = jsonData.grid;
  document.getElementById('grid_more').checked = jsonData.grid;
  document.getElementById('grid_mobile').checked = jsonData.grid;
  document.getElementById('lockobjs').checked = jsonData.lockobjs;
  document.getElementById('lockobjs_more').checked = jsonData.lockobjs;
  document.getElementById('lockobjs_mobile').checked = jsonData.lockobjs;

  observer = jsonData.observer;

  if (observer) {
    document.getElementById('observer_size').value = Math.round(observer.r * 2 * 1000000) / 1000000;
    document.getElementById('observer_size_mobile').value = Math.round(observer.r * 2 * 1000000) / 1000000;
  } else {
    document.getElementById('observer_size').value = 40;
    document.getElementById('observer_size_mobile').value = 40;
  }

  gridSize = jsonData.gridSize;
  document.getElementById('grid_size').value = gridSize;
  document.getElementById('grid_size_mobile').value = gridSize;

  var canvasWidth = Math.ceil((canvas.width/dpr) / 100) * 100;
  var canvasHeight = Math.ceil((canvas.height/dpr) / 100) * 100;

  // Rescale the image to fit the screen
  if (jsonData.width/jsonData.height > canvasWidth/canvasHeight) {
    var rescaleFactor = jsonData.width / canvasWidth;
  } else {
    var rescaleFactor = jsonData.height / canvasHeight;
  }
  console.log(rescaleFactor);
  scale = jsonData.scale / rescaleFactor;
  origin.x = jsonData.origin.x / rescaleFactor;
  origin.y = jsonData.origin.y / rescaleFactor;

  document.getElementById("zoom").innerText = Math.round(scale * 100) + '%';
  document.getElementById("zoom_mobile").innerText = Math.round(scale * 100) + '%';
  colorMode = jsonData.colorMode;
  symbolicGrin = jsonData.symbolicGrin;
  document.getElementById('color_mode').checked = colorMode;
  document.getElementById('color_mode_mobile').checked = colorMode;
  modebtn_clicked(jsonData.mode);
  document.getElementById('mode_' + jsonData.mode).checked = true;
  document.getElementById('mode_' + jsonData.mode + '_mobile').checked = true;
  selectObj(selectedObj);
  draw();
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
    observer = graphs.circle(graphs.point((canvas.width * 0.5 / dpr - origin.x) / scale, (canvas.height * 0.5 / dpr - origin.y) / scale), parseFloat(document.getElementById('observer_size').value) * 0.5);
  }


  try {
    draw(false, true);
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
        backgroundImage = new Image();
        backgroundImage.src = e.target.result;
        backgroundImage.onload = function (e1) {
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
    console.log(fullURL.length);
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
  for (var i = 0; i < objs.length; i++) {
    if (objs[i].type == 'cropbox') {
      cropBoxIndex = i;
      break;
    }
  }
  if (cropBoxIndex == -1) {
    // Create a new cropBox
    var cropBox = {
      type: 'cropbox',
      p1: graphs.point((canvas.width * 0.2 / dpr - origin.x) / scale, ((120 + (canvas.height-120) * 0.2) / dpr - origin.y) / scale),
      p2: graphs.point((canvas.width * 0.8 / dpr - origin.x) / scale, ((120 + (canvas.height-120) * 0.2) / dpr - origin.y) / scale),
      p3: graphs.point((canvas.width * 0.2 / dpr - origin.x) / scale, ((120 + (canvas.height-120) * 0.8) / dpr - origin.y) / scale),
      p4: graphs.point((canvas.width * 0.8 / dpr - origin.x) / scale, ((120 + (canvas.height-120) * 0.8) / dpr - origin.y) / scale),
      width: 1280,
      format: 'png'
    };
    objs.push(cropBox);
    cropBoxIndex = objs.length - 1;
  }

  selectObj(cropBoxIndex);

  draw(true, true);
}

function exportSVG(cropBox) {
  var ctx_backup = ctx;
  var ctx0_backup = ctx0;
  var ctxLight_backup = ctxLight;
  var ctxGrid_backup = ctxGrid;
  var scale_backup = scale;
  var origin_backup = origin;
  var dpr_backup = dpr;

  scale = 1;
  origin = { x: -cropBox.p1.x * scale, y: -cropBox.p1.y * scale };
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
  scale = scale_backup;
  origin = origin_backup;
  dpr = dpr_backup;
  draw(true, true);
}

function exportImage(cropBox) {

  var scale_backup = scale;
  var origin_backup = origin;
  var dpr_backup = dpr;

  scale = cropBox.width / (cropBox.p4.x - cropBox.p1.x);
  origin = { x: -cropBox.p1.x * scale, y: -cropBox.p1.y * scale };
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

  scale = scale_backup;
  origin = origin_backup;
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

