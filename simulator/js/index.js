var objTypes = {};
var canvas;
var ctx;
var objs = []; //物件 The objects
var objCount = 0; //物件數量 Number of the objects
var observer;
var tools_normal = ['laser', 'parallel', 'ruler', 'protractor', 'power', 'text', ''];
var tools_withList = ['radiant_', 'mirror_', 'refractor_', 'blocker_'];
var tools_inList = ['radiant', 'led', 'mirror', 'arcmirror', 'idealmirror', 'lens', 'sphericallens', 'refractor', 'halfplane', 'circlelens', 'parabolicmirror', 'beamsplitter','blackline','blackcircle'];
var modes = ['light', 'extended_light', 'images', 'observer'];
var xyBox_cancelContextMenu = false;
var scale = 1;
var cartesianSign = false;
var backgroundImage = null;
var restoredData = "";

window.onload = function(e) {
  init_i18n();
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
    window.toolBarViewModel.tools.selected("Move View");
    AddingObjType = '';
  } else {
    restoredData = '';
    initParameters();
  }

  undoArr[0] = document.getElementById('textarea1').value;
  document.getElementById('undo').disabled = true;
  document.getElementById('redo').disabled = true;

  window.onmousedown = function(e)
  {
    selectObj(-1);
  };
  window.ontouchstart = function(e)
  {
    selectObj(-1);
  };


  canvas.onmousedown = function(e)
  {
    //document.getElementById('objAttr_text').blur();
    // TODO: check that commenting out the above line does not cause problem.

    document.body.focus();
    canvas_onmousedown(e);
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
    return false;
  };

  canvas.onmousemove = function(e)
  {
    canvas_onmousemove(e);
  };

  canvas.onmouseup = function(e)
  {
    canvas_onmouseup(e);
  };

  // IE9, Chrome, Safari, Opera
  canvas.addEventListener("mousewheel", canvas_onmousewheel, false);
  // Firefox
  canvas.addEventListener("DOMMouseScroll", canvas_onmousewheel, false);


  canvas.ontouchstart = function(e)
  {
    //document.getElementById('objAttr_text').blur();
    // TODO: check that commenting out the above line does not cause problem.

    document.body.focus();
    canvas_onmousedown(e);
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };

  canvas.ontouchmove = function(e)
  {
    canvas_onmousemove(e);
    e.preventDefault();
  };

  canvas.ontouchend = function(e)
  {
    canvas_onmouseup(e);
    e.preventDefault();
  };

  canvas.ontouchcancel = function(e)
  {
    canvas_onmouseup(e);
    undo();
    e.preventDefault();
  };

  canvas.ondblclick = function(e)
  {
    canvas_ondblclick(e);
  };


  tools_normal.forEach(function(element, index)
  {
    document.getElementById('tool_' + element).onclick = function(e) {toolbtn_clicked(element, e);};
  });

  tools_withList.forEach(function(element, index)
  {
    document.getElementById('tool_' + element).onclick = function(e) {toolbtn_clicked(element, e);};
  });

  tools_inList.forEach(function(element, index)
  {
    document.getElementById('tool_' + element).onclick = function(e) {toolbtn_clicked(element, e);};
  });



  document.getElementById('undo').onclick = undo;
  document.getElementById('redo').onclick = redo;
  document.getElementById('reset').onclick = function() {initParameters();cancelRestore();createUndoPoint();};
  document.getElementById('save').onclick = function()
  {
    document.getElementById('saveBox').style.display = '';
    document.getElementById('save_name').select();
  };
  document.getElementById('export_svg').onclick = exportSVG;
  document.getElementById('open').onclick = function()
  {
    document.getElementById('openfile').click();
  };

  document.getElementById('openfile').onchange = function()
  {
    open(this.files[0]);
  };

  modes.forEach(function(element, index)
  {
  document.getElementById('mode_' + element).onclick = function() {
    modebtn_clicked(element);
    createUndoPoint();
  };
  });
  document.getElementById('color_mode').onclick = function()
  {
    colorMode = this.checked;
    draw();
  };


  document.getElementById('zoom').oninput = function()
  {
    setScale(this.value / 100);
    draw();
  };
  document.getElementById('zoom_txt').onfocusout = function()
  {
    setScale(this.value / 100);
    draw();
  };
  document.getElementById('zoom_txt').onkeyup = function()
  {
    if (event.keyCode === 13) {
      setScale(this.value / 100);
      draw();
    }
  };
  document.getElementById('zoom').onmouseup = function()
  {
    setScale(this.value / 100); //為了讓不支援oninput的瀏覽器可使用 For browsers not supporting oninput
    createUndoPoint();
  };
  document.getElementById('zoom').ontouchend = function()
  {
    setScale(this.value / 100); //為了讓不支援oninput的瀏覽器可使用 For browsers not supporting oninput
    createUndoPoint();
  };
  document.getElementById('rayDensity').oninput = function()
  {
    setRayDensity(Math.exp(this.value));
    draw();
  };
  document.getElementById('rayDensity_txt').onfocusout = function()
  {
    setRayDensity(Math.exp(this.value));
    draw();
  };
  document.getElementById('rayDensity_txt').onkeyup = function()
  {
    if (event.keyCode === 13) {
      setRayDensity(Math.exp(this.value));
      draw();
    }
  };
  document.getElementById('rayDensity').onmouseup = function()
  {
    setRayDensity(Math.exp(this.value)); //為了讓不支援oninput的瀏覽器可使用 For browsers not supporting oninput
    draw();
    createUndoPoint();
  };
  document.getElementById('rayDensity').ontouchend = function()
  {
    setRayDensity(Math.exp(this.value)); //為了讓不支援oninput的瀏覽器可使用 For browsers not supporting oninput
    draw();
    createUndoPoint();
  };
  document.getElementById('grid').onclick = function() {draw()};
  document.getElementById('showgrid').onclick = function() {draw()};

  document.getElementById('forceStop').onclick = function()
  {
    if (timerID != -1)
    {
      forceStop = true;
    }
  };
  cancelMousedownEvent('forceStop');
  document.getElementById('restore').onclick = function() {restore()};
  cancelMousedownEvent('restore');
  cancelMousedownEvent('setAttrAll');
  cancelMousedownEvent('setAttrAll_');

  document.getElementById('copy').onclick = function()
  {
    objs[objs.length] = JSON.parse(JSON.stringify(objs[selectedObj]));
    draw();
    createUndoPoint();
  };
  cancelMousedownEvent('copy');
  document.getElementById('delete').onclick = function()
  {
    removeObj(selectedObj);
    draw();
    createUndoPoint();
  };
  cancelMousedownEvent('delete');
  document.getElementById('textarea1').onchange = function()
  {
    JSONInput();
    createUndoPoint();
  };



  document.getElementById('save_name').onkeydown = function(e)
  {
    if (e.keyCode == 13)
    {
      //enter
      document.getElementById('save_confirm').onclick();
    }
    if (e.keyCode == 27)
    {
      //esc
      document.getElementById('save_cancel').onclick();
    }

    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  document.getElementById('save_cancel').onclick = function()
  {
    document.getElementById('saveBox').style.display = 'none';
  };
  document.getElementById('save_confirm').onclick = save;

  cancelMousedownEvent('saveBox');


  document.getElementById('xybox').onkeydown = function(e)
  {
    //console.log(e.keyCode)
    if (e.keyCode == 13)
    {
      //enter
      confirmPositioning(e.ctrlKey, e.shiftKey);
    }
    if (e.keyCode == 27)
    {
      //esc
      endPositioning();
    }

    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };

  document.getElementById('xybox').oninput = function(e)
  {
    this.size = this.value.length;
  };

  document.getElementById('xybox').addEventListener('contextmenu', function(e) {
    if (xyBox_cancelContextMenu)
    {
       e.preventDefault();
       xyBox_cancelContextMenu = false;
    }
      }, false);

  cancelMousedownEvent('xybox');


  window.ondragenter = function(e)
  {
    e.stopPropagation();
    e.preventDefault();
  };

  window.ondragover = function(e)
  {
    e.stopPropagation();
    e.preventDefault();
  };

  window.ondrop = function(e)
  {
    e.stopPropagation();
    e.preventDefault();

    var dt = e.dataTransfer;
    if (dt.files[0])
    {
      var files = dt.files;
      open(files[0]);
    }
    else
    {
      var fileString = dt.getData('text');
      document.getElementById('textarea1').value = fileString;
      selectedObj = -1;
      JSONInput();
      createUndoPoint();
    }
  };

  canvas.addEventListener('contextmenu', function(e) {
          e.preventDefault();
      }, false);


  var i;
  var samples = [ "reflect.json", "internal-reflection.json", "parabolic-mirror.json", "prisms.json", "lens-images.json",
                  "convex-lens.json", "concave-lens.json", "spherical-aberration.json", "zoom-lens.json",
                  "apparent-depth-of-an-object-under-water.json", "compound-microscope.json", "images-formed-by-two-mirrors.json",
                  "reflection-and-refraction-of-a-single-ray.json", "spherical-lens-and-mirror.json", "chromatic-dispersion.json" ];
  for (i = 1; ; i++) {
    var elt = document.getElementById("sample" + i);
    if (!elt) break;
    const ii = i;
    elt.onclick = function () { openSample(samples[ii-1]); };
  }
};

function openSample(name) {
  var client = new XMLHttpRequest();
  client.open('GET', '../samples/' + name);
  client.onload = function() {
    if (client.status >= 300)
      return;
    document.getElementById('textarea1').value = client.responseText;
    JSONInput();
    cancelRestore();
    createUndoPoint();
  }
  client.send();
}




window.onresize = function(e) {
if (ctx)
{
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}
};




function initParameters()
{
  isConstructing = false;
  endPositioning();
  objs.length = 0;
  selectObj(-1);

  rayDensity_light = 0.1; //光線密度(光線相關模式) The Ray Density when View is Rays or Extended rays
  rayDensity_images = 1; //光線密度(像相關模式) The Ray Density when View is All Images or Seen by Observer
  window.toolBarViewModel.rayDensity.value(rayDensity_light);
  extendLight = false;
  showLight = true;
  origin = {x: 0, y: 0};
  observer = null;
  scale = 1;
  cartesianSign = false;
  try {
    if (localStorage.rayOpticsCartesianSign == "true") {
      cartesianSign = true;
    }
  } catch { }
  window.toolBarViewModel.zoom.value(scale * 100);
  toolbtn_clicked('laser');
  modebtn_clicked('light');
  colorMode = false;
  backgroundImage = null;

  //Reset new UI.
  window.toolBarViewModel.tools.selected("Ray");
  window.toolBarViewModel.modes.selected("Rays");
  window.toolBarViewModel.c1.selected(false);
  window.toolBarViewModel.c2.selected(false);
  window.toolBarViewModel.c3.selected(false);
  window.toolBarViewModel.colorMode.selected(false);

  document.getElementById('lockobjs').checked = false;
  document.getElementById('grid').checked = false;
  document.getElementById('showgrid').checked = false;

  document.getElementById('setAttrAll').checked = false;

  draw();
}

window.onkeydown = function(e)
{
  //Ctrl+Z
  if (e.ctrlKey && e.keyCode == 90)
  {
  if (document.getElementById('undo').disabled == false)
  {
    undo();
  }
  return false;
  }

  //Ctrl+D
  if (e.ctrlKey && e.keyCode == 68)
  {
  objs[objs.length] = JSON.parse(JSON.stringify(objs[selectedObj]));
  draw();
  createUndoPoint();
  return false;
  }
  //Ctrl+Y
  if (e.ctrlKey && e.keyCode == 89)
  {
    document.getElementById('redo').onclick();
  }

  //Ctrl+S
  if (e.ctrlKey && e.keyCode == 83)
  {
    document.getElementById('save').onclick();
  }

  //Ctrl+O
  if (e.ctrlKey && e.keyCode == 79)
  {
    document.getElementById('open').onclick();
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
  if (e.keyCode == 46 || e.keyCode == 8)
  {
  if (selectedObj != -1)
  {
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
  if (e.keyCode >= 37 && e.keyCode <= 40)
  {
    var step = document.getElementById('grid').checked ? gridSize : 1;
    if (selectedObj >= 0)
    {
      if (e.keyCode == 37)
      {
        objTypes[objs[selectedObj].type].move(objs[selectedObj], -step, 0);
      }
      if (e.keyCode == 38)
      {
        objTypes[objs[selectedObj].type].move(objs[selectedObj], 0, -step);
      }
      if (e.keyCode == 39)
      {
        objTypes[objs[selectedObj].type].move(objs[selectedObj], step, 0);
      }
      if (e.keyCode == 40)
      {
        objTypes[objs[selectedObj].type].move(objs[selectedObj], 0, step);
      }
    }
    else if (mode == 'observer')
    {
      if (e.keyCode == 37)
      {
        observer.c.x -= step;
      }
      if (e.keyCode == 38)
      {
        observer.c.y -= step;
      }
      if (e.keyCode == 39)
      {
        observer.c.x += step;
      }
      if (e.keyCode == 40)
      {
        observer.c.y += step;
      }
    }
    else
    {
      for (var i = 0; i < objs.length; i++)
      {
        if (e.keyCode == 37)
        {
          objTypes[objs[i].type].move(objs[i], -step, 0);
        }
        if (e.keyCode == 38)
        {
          objTypes[objs[i].type].move(objs[i], 0, -step);
        }
        if (e.keyCode == 39)
        {
          objTypes[objs[i].type].move(objs[i], step, 0);
        }
        if (e.keyCode == 40)
        {
          objTypes[objs[i].type].move(objs[i], 0, step);
        }
      }
    }
    draw();
  }



};

window.onkeyup = function(e)
{
  //Arrow Keys
  if (e.keyCode >= 37 && e.keyCode <= 40)
  {
    createUndoPoint();
  }

};


// attributes starting with tmp_ are not written to output
function JSONreplacer(name, val) {
  if (name.startsWith("tmp_"))
    return undefined;
  return val;
}

function JSONOutput()
{
  document.getElementById('textarea1').value = JSON.stringify({version: 2, objs: objs, mode: mode, rayDensity_light: rayDensity_light, rayDensity_images: rayDensity_images, observer: observer, origin: origin, scale: scale, colorMode: colorMode}, JSONreplacer, 2);
  if (typeof(Storage) !== "undefined" && !restoredData) {
    localStorage.rayOpticsData = document.getElementById('textarea1').value;
  }
}
function JSONInput()
{
  var jsonData = JSON.parse(document.getElementById('textarea1').value);
  if (typeof jsonData != 'object')return;
  if (!jsonData.version)
  {
    //為"線光學模擬1.0"或之前的格式 Earlier than "Ray Optics Simulation 1.0"
    var str1 = document.getElementById('textarea1').value.replace(/"point"|"xxa"|"aH"/g, '1').replace(/"circle"|"xxf"/g, '5').replace(/"k"/g, '"objs"').replace(/"L"/g, '"p1"').replace(/"G"/g, '"p2"').replace(/"F"/g, '"p3"').replace(/"bA"/g, '"exist"').replace(/"aa"/g, '"parallel"').replace(/"ba"/g, '"mirror"').replace(/"bv"/g, '"lens"').replace(/"av"/g, '"notDone"').replace(/"bP"/g, '"lightAlpha"').replace(/"ab"|"observed_light"|"observed_images"/g, '"observer"');
    jsonData = JSON.parse(str1);
    if (!jsonData.objs)
    {
      jsonData = {objs: jsonData};
    }
    if (!jsonData.mode)
    {
      jsonData.mode = 'light';
    }
    if (!jsonData.rayDensity_light)
    {
      jsonData.rayDensity_light = 1;
    }
    if (!jsonData.rayDensity_images)
    {
      jsonData.rayDensity_images = 1;
    }
    if (!jsonData.scale)
    {
      jsonData.scale = 1;
    }
    jsonData.version = 1;
  }
  if (jsonData.version == 1)
  {
    //"線光學模擬1.1"至"線光學模擬1.2" "Ray Optics Simulation 1.1" to "Ray Optics Simulation 1.2"
    jsonData.origin = {x: 0, y: 0};
  }
  if (jsonData.version > 2)
  {
    //為比此版本新的檔案版本 Newer than the current version
    return;
  }
  //TODO: Create new version.
  if (!jsonData.scale)
  {
    jsonData.scale = 1;
  }
  if (!jsonData.colorMode)
  {
    jsonData.colorMode = false;
  }

  objs = jsonData.objs;
  rayDensity_light = jsonData.rayDensity_light;
  rayDensity_images = jsonData.rayDensity_images;
  observer = jsonData.observer;
  origin = jsonData.origin;
  scale = jsonData.scale;
  colorMode = jsonData.colorMode;
  window.toolBarViewModel.colorMode.selected(colorMode);
  modebtn_clicked(jsonData.mode);
  selectObj(selectedObj);
}


function toolbtn_clicked(tool, e)
{
  AddingObjType = tool;
  if (tool == "radiant_") {
    var t = window.toolBarViewModel.point_sources.selected();
    if (t == "360 degrees")
      AddingObjType = "radiant";
    if (t == "Finite angle")
      AddingObjType = "led";
  } else if (tool == "mirror_") {
    var t = window.toolBarViewModel.mirrors.selected();
    if (t == "Segment")
      AddingObjType = "mirror";
    else if (t == "Circular Arc")
      AddingObjType = "arcmirror";
    else if (t == "Parabolic")
      AddingObjType = "parabolicmirror";
    else if (t == "Beam Splitter")
      AddingObjType = "beamsplitter";
    else if (t == "Ideal Curved")
      AddingObjType = "idealmirror";
  } else if (tool == "refractor_") {
    var t = window.toolBarViewModel.glasses.selected();
    if (t == "Half-plane")
      AddingObjType = "halfplane";
    else if (t == "Circle")
      AddingObjType = "circlelens";
    else if (t == "Free-shape")
      AddingObjType = "refractor";
    else if (t == "Ideal Lens")
      AddingObjType = "lens";
    else if (t == "Spherical Lens")
      AddingObjType = "sphericallens";
  } else if (tool === "blocker_") {
    var t = window.toolBarViewModel.blockers.selected();
    if (t === "Line Blocker")
      AddingObjType = "blackline";
    else if (t === "Circle Blocker")
      AddingObjType = "blackcircle";
  }
}


function modebtn_clicked(mode1)
{
  window.toolBarViewModel.modes.selected({"light":"Rays","extended_light":"Extended Rays","images":"All Images","observer":"Seen by Observer"}[mode1]);
  mode = mode1;
  if (mode == 'images' || mode == 'observer')
  {
    window.toolBarViewModel.rayDensity.value(Math.log(rayDensity_images));
  }
  else
  {
    window.toolBarViewModel.rayDensity.value(Math.log(rayDensity_light));
  }
  if (mode == 'observer' && !observer)
  {
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



function cancelMousedownEvent(id)
{
  document.getElementById(id).onmousedown = function(e)
  {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  document.getElementById(id).ontouchstart = function(e)
  {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
}

function cancelMousedownEvent_(elem)
{
  elem.onmousedown = function(e)
  {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  elem.ontouchstart = function(e)
  {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
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
  draw();
}

function save()
{
  JSONOutput();

  var blob = new Blob([document.getElementById('textarea1').value], {type: 'application/json'});
  saveAs(blob, document.getElementById('save_name').value);

  document.getElementById('saveBox').style.display = 'none';
}

function open(readFile)
{
  var reader = new FileReader();
  document.getElementById('save_name').value = readFile.name;
  reader.readAsText(readFile);
  reader.onload = function(evt) {
    var fileString = evt.target.result;
    document.getElementById('textarea1').value = fileString;
    endPositioning();
    selectedObj = -1;
    try {
      JSONInput();
      cancelRestore();
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
  ctx.fillStyle="black";
  ctx.fillRect(0,0, svgWidth, svgHeight);
  draw();
  var blob = new Blob([ctx.getSerializedSvg()], {type: 'image/svg+xml'});
      saveAs(blob,"export.svg");
  ctx = ctx1;
}

function restore() {
  document.getElementById('textarea1').value = restoredData;
  document.getElementById('restore').style.display = 'none';
  document.getElementById('welcome').style.display = 'none';
  restoredData = '';
  JSONInput();
  createUndoPoint();
}

function cancelRestore() {
  restoredData = '';
  document.getElementById('restore').style.display = 'none';
  document.getElementById('welcome').style.display = 'none';
}



