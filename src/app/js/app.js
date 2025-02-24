/*
 * Copyright 2024 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as bootstrap from 'bootstrap';
import 'bootstrap/scss/bootstrap.scss';
import * as $ from 'jquery';
import { Scene, Simulator, Editor, geometry, sceneObjs } from '../../core/index.js';
import { DATA_VERSION } from '../../core/Scene.js';
import ObjBar from './ObjBar.js';
import { saveAs } from 'file-saver';
import i18next, { t, use } from 'i18next';
import HttpBackend from 'i18next-http-backend';
import { jsonEditorService } from '../services/jsonEditor.js';
import { statusEmitter, STATUS_EVENT_NAMES } from '../composables/useStatus.js';

const isDevelopment = process.env.NODE_ENV === 'development';

async function startApp() {
  await i18next.use(HttpBackend).init({
    lng: window.lang,
    debug: isDevelopment,
    fallbackLng: 'en',
    load: 'currentOnly',
    ns: ['main', 'simulator'],
    backend: {
      loadPath: '../locales/{{lng}}/{{ns}}.json',
    },
    interpolation: {
      escapeValue: false
    }
  });

  scene = new Scene();
  window.scene = scene;

  await import('../main').then(vueApp => {
    vueApp.initVueApp();
  });

  jsonEditorService.updateContent(scene.toJSON());

  let dpr = window.devicePixelRatio || 1;

  canvas = document.getElementById('canvasAboveLight');
  canvasBelowLight = document.getElementById('canvasBelowLight');
  canvasLight = document.getElementById('canvasLight');
  canvasLightWebGL = document.getElementById('canvasLightWebGL');
  canvasGrid = document.getElementById('canvasGrid');

  let gl;

  try {
    const contextAttributes = {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    };
    gl = canvasLightWebGL.getContext('webgl', contextAttributes) || canvasLightWebGL.getContext('experimental-webgl', contextAttributes);
    var ext = gl.getExtension('OES_texture_float');

    if (!ext) {
      throw new Error('OES_texture_float not supported.');
    }
  } catch (e) {
    console.log('Failed to initialize WebGL: ' + e);
    gl = null;
  }

  simulator = new Simulator(scene,
    canvasLight.getContext('2d'),
    canvasBelowLight.getContext('2d'),
    canvasAboveLight.getContext('2d'),
    canvasGrid.getContext('2d'),
    document.createElement('canvas').getContext('2d'),
    true,
    Infinity,
    gl
  );
  window.simulator = simulator;

  editor = new Editor(scene, canvas, simulator);
  window.editor = editor;



  console.log(document.getElementById('obj_bar_main'))

  initUIText();
  initTools();


  objBar = new ObjBar(document.getElementById('obj_bar_main'), document.getElementById('obj_name'));

  objBar.on('showAdvancedEnabled', function (enabled) {
    if (enabled) {
      document.getElementById('showAdvanced').style.display = '';
      document.getElementById('showAdvanced_mobile_container').style.display = '';
    } else {
      document.getElementById('showAdvanced').style.display = 'none';
      document.getElementById('showAdvanced_mobile_container').style.display = 'none';
    }
  });

  objBar.on('edit', function () {
    simulator.updateSimulation(!objBar.targetObj.constructor.isOptical, true);
  });

  objBar.on('editEnd', function () {
    editor.onActionComplete();
  });

  objBar.on('requestUpdate', function () {
    editor.selectObj(editor.selectedObjIndex);
  });

  document.getElementById('apply_to_all').addEventListener('change', function () {
    objBar.shouldApplyToAll = this.checked;
  });




  simulator.dpr = dpr;

  simulator.on('simulationStart', function () {
    statusEmitter.emit(STATUS_EVENT_NAMES.SIMULATOR_STATUS, {
      rayCount: 0,
      totalTruncation: 0,
      brightnessScale: null,
      timeElapsed: 0,
      isSimulatorRunning: true,
      isForceStop: false
    });
  });

  simulator.on('simulationPause', function () {
    statusEmitter.emit(STATUS_EVENT_NAMES.SIMULATOR_STATUS, {
      rayCount: simulator.processedRayCount,
      totalTruncation: simulator.totalTruncation,
      brightnessScale: simulator.brightnessScale,
      timeElapsed: new Date() - simulator.simulationStartTime,
      isSimulatorRunning: true,
      isForceStop: false
    });
  });
  
  simulator.on('simulationStop', function () {
    statusEmitter.emit(STATUS_EVENT_NAMES.SIMULATOR_STATUS, {
      rayCount: simulator.processedRayCount,
      totalTruncation: simulator.totalTruncation,
      brightnessScale: simulator.brightnessScale,
      timeElapsed: new Date() - simulator.simulationStartTime,
      isSimulatorRunning: false,
      isForceStop: true
    });
  });
  
  simulator.on('simulationComplete', function () {
    statusEmitter.emit(STATUS_EVENT_NAMES.SIMULATOR_STATUS, {
      rayCount: simulator.processedRayCount,
      totalTruncation: simulator.totalTruncation,
      brightnessScale: simulator.brightnessScale,
      timeElapsed: new Date() - simulator.simulationStartTime,
      isSimulatorRunning: false,
      isForceStop: false
    });
  });

  simulator.on('requestUpdateErrorAndWarning', function () {
    updateErrorAndWarning();
  });

  simulator.on('webglContextLost', function () {
    console.log('WebGL context lost');
    canvasLightWebGL.style.display = 'none';
    canvasLight.style.display = '';
  });


  editor.on('positioningStart', function (e) {
    document.getElementById('xybox').style.left = (e.dragContext.targetPoint.x * scene.scale + scene.origin.x) + 'px';
    document.getElementById('xybox').style.top = (e.dragContext.targetPoint.y * scene.scale + scene.origin.y) + 'px';
    document.getElementById('xybox').value = '(' + (e.dragContext.targetPoint.x) + ',' + (e.dragContext.targetPoint.y) + ')';
    document.getElementById('xybox').size = document.getElementById('xybox').value.length;
    document.getElementById('xybox').style.display = '';
    document.getElementById('xybox').select();
    document.getElementById('xybox').setSelectionRange(1, document.getElementById('xybox').value.length - 1);
    //console.log("show xybox");
    xyBox_cancelContextMenu = true;
  });

  editor.on('requestPositioningComfirm', function (e) {
    confirmPositioning(e.ctrl, e.shift);
  });

  editor.on('positioningEnd', function (e) {
    document.getElementById('xybox').style.display = 'none';
  });

  editor.on('mouseCoordinateChange', function (e) {
    statusEmitter.emit(STATUS_EVENT_NAMES.MOUSE_POSITION, 
      e.mousePos ? { x: e.mousePos.x, y: e.mousePos.y } : { x: undefined, y: undefined }
    );
  });

  editor.emit('mouseCoordinateChange', { mousePos: null });

  editor.on('selectionChange', function (e) {
    hideAllPopovers();
    if (objBar.pendingEvent) {
      // If the user is in the middle of editing a value, then clearing the innerHTML of obj_bar_main will cause the change event not to fire, so we need to manually fire it.
      objBar.pendingEvent();
      objBar.pendingEvent = null;
    }

    if (e.newIndex >= 0) {
      objBar.targetObj = scene.objs[e.newIndex];

      document.getElementById('showAdvanced').style.display = 'none';
      document.getElementById('showAdvanced_mobile_container').style.display = 'none';

      document.getElementById('obj_bar_main').style.display = '';
      document.getElementById('obj_bar_main').innerHTML = '';
      scene.objs[e.newIndex].populateObjBar(objBar);

      if (document.getElementById('obj_bar_main').innerHTML != '') {
        for (var i = 0; i < scene.objs.length; i++) {
          if (i != e.newIndex && scene.objs[i].constructor.type == scene.objs[e.newIndex].constructor.type) {
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
    } else {
      document.getElementById('obj_bar').style.display = 'none';
      objBar.shouldShowAdvanced = false;
    }
  });

  editor.on('sceneLoaded', function (e) {
    document.getElementById('welcome').style.display = 'none';
    if (e.needFullUpdate) {
      // Update the UI for the loaded scene.

      if (scene.name) {
        document.title = scene.name + " - " + i18next.t('main:pages.simulator') + ' - ' + i18next.t('main:project.name');
        //document.getElementById('save_name').value = scene.name;
      } else {
        document.title = i18next.t('main:pages.simulator') + ' - ' + i18next.t('main:project.name');
      }

      if (Object.keys(scene.modules).length > 0) {
        updateModuleObjsMenu();
      }

      modebtn_clicked(scene.mode);
      colorModebtn_clicked(scene.colorMode);
      editor.selectObj(editor.selectedObjIndex);

      document.dispatchEvent(new Event('sceneChanged'));
    }
  });

  editor.on('newAction', function (e) {
    jsonEditorService.updateContent(e.newJSON, e.oldJSON);
    syncUrl();
    warning = "";
    hasUnsavedChange = true;
  });

  editor.on('newUndoPoint', function (e) {
    document.getElementById('undo').disabled = false;
    document.getElementById('redo').disabled = true;
    document.getElementById('undo_mobile').disabled = false;
    document.getElementById('redo_mobile').disabled = true;
  });

  editor.on('undo', function (e) {
    document.getElementById('redo').disabled = false;
    document.getElementById('redo_mobile').disabled = false;
    if (editor.undoIndex == editor.undoLBound) {
      // The lower bound of undo data is reached
      document.getElementById('undo').disabled = true;
      document.getElementById('undo_mobile').disabled = true;
    }
    jsonEditorService.updateContent(editor.lastActionJson);
    syncUrl();
  });

  editor.on('redo', function (e) {
    document.getElementById('undo').disabled = false;
    document.getElementById('undo_mobile').disabled = false;
    if (editor.undoIndex == editor.undoUBound) {
      // The lower bound of undo data is reached
      document.getElementById('redo').disabled = true;
      document.getElementById('redo_mobile').disabled = true;
    }
    jsonEditorService.updateContent(editor.lastActionJson);
    syncUrl();
  });

  editor.on('scaleChange', function (e) {
    document.dispatchEvent(new Event('sceneChanged'));
  });

  editor.on('requestUpdateErrorAndWarning', function () {
    updateErrorAndWarning();
  });

  init();

  document.getElementById('undo').disabled = true;
  document.getElementById('redo').disabled = true;

  document.getElementById('undo_mobile').disabled = true;
  document.getElementById('redo_mobile').disabled = true;


  window.onkeydown = function (e) {
    //Ctrl+Z or Cmd+Z
    if ((e.ctrlKey || e.metaKey) && e.keyCode == 90) {
      if (document.getElementById('undo').disabled == false) {
        editor.undo();
      }
      return false;
    }
    //Ctrl+D or Cmd+D
    if ((e.ctrlKey || e.metaKey) && e.keyCode == 68) {
      if (editor.selectedObjIndex != -1) {
        if (scene.objs[editor.selectedObjIndex].constructor.type == 'Handle') {
          scene.cloneObjsByHandle(editor.selectedObjIndex);
        } else {
          scene.cloneObj(editor.selectedObjIndex);
        }

        simulator.updateSimulation(!scene.objs[editor.selectedObjIndex].constructor.isOptical, true);
        editor.onActionComplete();
      }
      return false;
    }
    //Ctrl+Y or Cmd+Y
    if ((e.ctrlKey || e.metaKey) && e.keyCode == 89) {
      document.getElementById('redo').onclick();
    }

    //Ctrl+S or Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.keyCode == 83) {
      save();
      return false;
    }

    //Ctrl+O or Cmd+O
    if ((e.ctrlKey || e.metaKey) && e.keyCode == 79) {
      document.getElementById('open').onclick();
      return false;
    }

    //esc
    if (e.keyCode == 27) {
      if (editor.isConstructing) {
        editor.undo();
      }
    }

    //Delete
    if (e.keyCode == 46 || e.keyCode == 8) {
      if (editor.selectedObjIndex != -1) {
        var selectedObjType = scene.objs[editor.selectedObjIndex].constructor.type;
        editor.removeObj(editor.selectedObjIndex);
        simulator.updateSimulation(!sceneObjs[selectedObjType].isOptical, true);
        editor.onActionComplete();
      }
      return false;
    }

    //Plus and Minus Keys for rotation
    if (e.keyCode == 107 || e.keyCode == 187) {             // + key for rotate clockwise
      if (editor.selectedObjIndex != -1) {
        scene.objs[editor.selectedObjIndex].rotate(1);
        simulator.updateSimulation(!scene.objs[editor.selectedObjIndex].constructor.isOptical, true);
      }
    }
    if (e.keyCode == 109 || e.keyCode == 189) {             // - key for rotate c-clockwise
      if (editor.selectedObjIndex != -1) {
        scene.objs[editor.selectedObjIndex].rotate(-1);
        simulator.updateSimulation(!scene.objs[editor.selectedObjIndex].constructor.isOptical, true);
      }
    }

    //Arrow Keys
    if (e.keyCode >= 37 && e.keyCode <= 40) {
      var step = scene.snapToGrid ? scene.gridSize : 1;
      if (editor.selectedObjIndex >= 0) {
        if (e.keyCode == 37) {
          scene.objs[editor.selectedObjIndex].move(-step, 0);
        }
        if (e.keyCode == 38) {
          scene.objs[editor.selectedObjIndex].move(0, -step);
        }
        if (e.keyCode == 39) {
          scene.objs[editor.selectedObjIndex].move(step, 0);
        }
        if (e.keyCode == 40) {
          scene.objs[editor.selectedObjIndex].move(0, step);
        }
        simulator.updateSimulation(!scene.objs[editor.selectedObjIndex].constructor.isOptical, true);
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
      editor.onActionComplete();
    }
  };

  document.getElementById('undo').onclick = function () {
    this.blur();
    editor.undo();
  }
  document.getElementById('undo_mobile').onclick = document.getElementById('undo').onclick;
  document.getElementById('redo').onclick = function () {
    this.blur();
    editor.redo();
  }
  document.getElementById('redo_mobile').onclick = document.getElementById('redo').onclick;
  document.getElementById('reset').onclick = function () {
    history.replaceState('', document.title, window.location.pathname + window.location.search);
    init();
    document.getElementById("welcome_loading").style.display = 'none';
    document.getElementById("welcome_instruction").style.display = '';
    document.getElementById('welcome').style.display = '';
    editor.onActionComplete();
    hasUnsavedChange = false;
    jsonEditorService.updateContent(editor.lastActionJson);
  };
  document.getElementById('reset_mobile').onclick = document.getElementById('reset').onclick

  document.getElementById('get_link').onclick = getLink;
  document.getElementById('get_link_mobile').onclick = getLink;
  document.getElementById('export_svg').onclick = function () {
    editor.enterCropMode();
  };
  document.getElementById('export_svg_mobile').onclick = function () {
    editor.enterCropMode();
  };
  document.getElementById('open').onclick = function () {
    document.getElementById('openfile').click();
  };
  document.getElementById('open_mobile').onclick = document.getElementById('open').onclick
  document.getElementById('view_gallery').onclick = function () {
    window.open(mapURL('/gallery'));
  };
  document.getElementById('view_gallery_mobile').onclick = document.getElementById('view_gallery').onclick;


  document.getElementById('openfile').onchange = function () {
    openFile(this.files[0]);
  };

  document.getElementById('apply_to_all').onclick = function () {
    this.blur();
    const checked = this.checked;
    objBar.shouldApplyToAll = checked;
    document.getElementById('apply_to_all').checked = checked;
    document.getElementById('apply_to_all_mobile').checked = checked;
  }
  document.getElementById('apply_to_all_mobile').onclick = document.getElementById('apply_to_all').onclick;

  document.getElementById('copy').onclick = function () {
    this.blur();
    if (scene.objs[editor.selectedObjIndex].constructor.type == 'Handle') {
      scene.cloneObjsByHandle(editor.selectedObjIndex);
      scene.objs[editor.selectedObjIndex].move(scene.gridSize, scene.gridSize);
    } else {
      scene.cloneObj(editor.selectedObjIndex).move(scene.gridSize, scene.gridSize);
    }
    editor.selectObj(scene.objs.length - 1);
    simulator.updateSimulation(!scene.objs[editor.selectedObjIndex].constructor.isOptical, true);
    editor.onActionComplete();
  };
  document.getElementById('copy_mobile').onclick = document.getElementById('copy').onclick;

  document.getElementById('delete').onclick = function () {
    var selectedObjType = scene.objs[editor.selectedObjIndex].constructor.type;
    this.blur();
    editor.removeObj(editor.selectedObjIndex);
    simulator.updateSimulation(!sceneObjs[selectedObjType].isOptical, true);
    editor.onActionComplete();
  };
  document.getElementById('delete_mobile').onclick = document.getElementById('delete').onclick;

  document.getElementById('unselect').onclick = function () {
    editor.selectObj(-1);
    simulator.updateSimulation(true, true);
    editor.onActionComplete();
  };
  document.getElementById('unselect_mobile').onclick = document.getElementById('unselect').onclick;

  document.getElementById('showAdvanced').onclick = function () {
    objBar.shouldShowAdvanced = true;
    editor.selectObj(editor.selectedObjIndex);
  };
  document.getElementById('showAdvanced_mobile').onclick = document.getElementById('showAdvanced').onclick;



  /*
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
  */

  document.getElementById('xybox').onkeydown = function (e) {
    //console.log(e.keyCode)
    if (e.keyCode == 13) {
      //enter
      confirmPositioning(e.ctrlKey, e.shiftKey);
    }
    if (e.keyCode == 27) {
      //esc
      editor.endPositioning();
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
      editor.loadJSON(fileString);
      editor.onActionComplete();
    }
  };

  canvas.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  }, false);

  canvas.addEventListener('mousedown', function (e) {
    error = null;
  }, false);

  window.onerror = function (msg, url) {
    error = `Error: ${msg} at ${url}`;
    document.getElementById('welcome').style.display = 'none';
    updateErrorAndWarning();
  }

  // Update the scene when the URL changes
  window.onpopstate = function (event) {
    if (window.location.hash.length > 70) {
      // The URL contains a compressed JSON scene.
      require('json-url')('lzma').decompress(window.location.hash.substr(1)).then(json => {
        scene.backgroundImage = null;
        editor.loadJSON(JSON.stringify(json));
        editor.onActionComplete();
        hasUnsavedChange = false;
        jsonEditorService.updateContent(editor.lastActionJson);
      }).catch(e => {
        error = "JsonUrl: " + e;
        document.getElementById('welcome').style.display = 'none';
        updateErrorAndWarning();
      });;
    } else if (window.location.hash.length > 1) {
      // The URL contains a link to a gallery item.
      openSample(window.location.hash.substr(1) + ".json");
      history.replaceState('', document.title, window.location.pathname + window.location.search);
    }
  };

  window.onpopstate();

  window.addEventListener('message', function (event) {
    if (event.data && event.data.rayOpticsModuleName) {
      importModule(event.data.rayOpticsModuleName + '.json');
    }
  });

  document.getElementById('toolbar-loading').style.display = 'none';

  document.getElementById('toolbar-mobile').addEventListener('shown.bs.dropdown', f);
  document.getElementById('toolbar-mobile').addEventListener('hidden.bs.dropdown', f);

  document.getElementById('more-options-dropdown').addEventListener('click', function (e) {
    e.stopPropagation();
  });

  document.getElementById('mobile-dropdown-options').addEventListener('click', function (e) {
    e.stopPropagation();
  });

  // Listen for changes to any radio input within a dropdown
  document.querySelectorAll('.dropdown-menu input[type="radio"]').forEach(function (input) {
    input.addEventListener('change', function () {
      if (input.checked) {
        // Reset other dropdown buttons
        if (!input.id.includes('mobile')) {
          resetDropdownButtons();

          // Get the associated dropdown button using the aria-labelledby attribute
          let dropdownButton = document.getElementById(input.closest('.dropdown-menu').getAttribute('aria-labelledby'));

          // Style the button to indicate selection.
          dropdownButton.classList.add('selected');
        } else if (input.name == 'toolsradio_mobile') {
          resetDropdownButtons();

          // Get the associated mobile trigger button
          let groupId = input.parentElement.parentElement.id.replace('mobile-dropdown-', '');
          let toggle = document.getElementById(`mobile-dropdown-trigger-${groupId}`);
          if (toggle != null) {
            // Style the button to indicate selection.
            toggle.classList.add('selected');
          }
        }
      }
    });
  });

  // Listen for changes to standalone radio inputs (outside dropdowns)
  document.querySelectorAll('input[type="radio"].btn-check').forEach(function (input) {
    if (input.name == 'toolsradio' && !input.closest('.dropdown-menu') && !input.id.includes('mobile')) { // Check if the radio is not inside a dropdown
      input.addEventListener('change', function () {
        if (input.checked) {
          // Reset dropdown buttons
          resetDropdownButtons();
        }
      });
    }
  });

  document.getElementById('help-dropdown').addEventListener('click', function (e) {
    e.stopPropagation();
  });

}

startApp();


var canvas;
var canvasBelowLight;
var canvasLight;
var canvasLightWebGL;
var canvasGrid;
var scene;
var editor;
var simulator;
var objBar;
var xyBox_cancelContextMenu = false;
var hasUnsavedChange = false;
var warning = null;
var error = null;


const f = function (e) {
  const list = document.getElementsByClassName('mobile-dropdown-menu');
  let maxScrollHeight = 0;
  for (let ele of list) {
    const inner = ele.children[0];
    if (inner.scrollHeight > maxScrollHeight) {
      maxScrollHeight = inner.scrollHeight;
    }
  }
  for (let ele of list) {
    ele.style.height = maxScrollHeight + 'px';
  }
}

function resetDropdownButtons() {
  // Remove the 'selected' class from all dropdown buttons
  document.querySelectorAll('.btn.dropdown-toggle.selected').forEach(function (button) {
    button.classList.remove('selected');
  });
  document.querySelectorAll('.btn.mobile-dropdown-trigger.selected').forEach(function (button) {
    button.classList.remove('selected');
  });
}


function initUIText() {
  setText('reset', i18next.t('simulator:file.reset.title'));
  setText('save', i18next.t('simulator:file.save.title'));
  setText('open', i18next.t('simulator:file.open.title'), null, i18next.t('simulator:file.open.description'));
  setText('export_svg', i18next.t('simulator:file.export.title'));
  setText('get_link', i18next.t('simulator:file.copyLink.title'), null, i18next.t('simulator:file.copyLink.description'));
  setText('view_gallery', i18next.t('simulator:file.viewGallery.title'), null, i18next.t('simulator:file.viewGallery.description'));
  setText('undo', null, i18next.t('simulator:file.undo.title'));
  setText('redo', null, i18next.t('simulator:file.redo.title'));
  setText('file_text', i18next.t('simulator:file.title'));
  setText('sourceToolsDropdown', i18next.t('main:tools.categories.lightSource'));
  setText('tool_SingleRay_label', i18next.t('main:tools.SingleRay.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.SingleRay.description'), sub: i18next.t('main:tools.SingleRay.instruction')}), 'SingleRay.svg');
  setText('tool_Beam_label', i18next.t('main:tools.Beam.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.Beam.description'), sub: i18next.t('main:tools.common.lineInstruction')}), 'Beam.svg');
  setText('tool_PointSource_label', i18next.t('main:tools.PointSource.title') + ' (360\u00B0)', null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.PointSource.description'), sub: i18next.t('main:tools.common.clickInstruction')}), 'PointSource.svg');
  setText('tool_AngleSource_label', i18next.t('main:tools.PointSource.title') + ' (<360\u00B0)', null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.AngleSource.description'), sub: i18next.t('main:tools.SingleRay.instruction')}), 'AngleSource.svg');
  setText('mirrorToolsDropdown', i18next.t('main:tools.categories.mirror'));
  setText('tool_Mirror_label', i18next.t('main:tools.Mirror.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.Mirror.description'), sub: i18next.t('main:tools.common.lineInstruction')}), 'Mirror.svg');
  setText('tool_ArcMirror_label', i18next.t('main:tools.ArcMirror.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.ArcMirror.description'), sub: i18next.t('main:tools.ArcMirror.instruction')}), 'ArcMirror.svg');
  setText('tool_ConcaveDiffractionGrating_label', i18next.t('main:tools.ConcaveDiffractionGrating.title') + '<sup>Beta</sup>', null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.ConcaveDiffractionGrating.description'), sub: i18next.t('main:tools.ArcMirror.instruction')}), 'ConcaveDiffractionGrating.svg');
  setText('tool_ParabolicMirror_label', i18next.t('main:tools.ParabolicMirror.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.ParabolicMirror.description'), sub: i18next.t('main:tools.ParabolicMirror.instruction')}), 'ParabolicMirror.svg');
  setText('tool_CustomMirror_label', i18next.t('main:tools.CustomMirror.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.CustomMirror.description'), sub: i18next.t('main:tools.common.lineInstruction')}), 'CustomMirror.svg');
  setText('tool_IdealMirror_label', i18next.t('main:tools.IdealMirror.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.IdealMirror.description'), sub: i18next.t('main:tools.common.lineInstruction')}), 'IdealMirror.svg');
  setText('tool_BeamSplitter_label', i18next.t('main:tools.BeamSplitter.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.BeamSplitter.description'), sub: i18next.t('main:tools.common.lineInstruction')}), 'BeamSplitter.svg');
  setText('glassToolsDropdown', i18next.t('main:tools.categories.glass'));
  setText('tool_PlaneGlass_label', i18next.t('main:tools.PlaneGlass.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.PlaneGlass.description'), sub: i18next.t('main:tools.PlaneGlass.instruction')}), 'PlaneGlass.svg');
  setText('tool_CircleGlass_label', i18next.t('main:tools.CircleGlass.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.CircleGlass.description'), sub: i18next.t('main:tools.common.circleInstruction')}), 'CircleGlass.svg');
  setText('tool_Glass_label', i18next.t('main:tools.Glass.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.Glass.description'), sub: i18next.t('main:tools.Glass.instruction')}), 'Glass.svg');
  setText('tool_CustomGlass_label', i18next.t('main:tools.CustomGlass.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.CustomGlass.description'), sub: i18next.t('main:tools.common.lineInstruction')}), 'CustomGlass.svg');
  setText('tool_IdealLens_label', i18next.t('main:tools.IdealLens.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.IdealLens.description'), sub: i18next.t('main:tools.common.lineInstruction')}), 'IdealLens.svg');
  setText('tool_SphericalLens_label', i18next.t('main:tools.SphericalLens.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.SphericalLens.description'), sub: i18next.t('main:tools.common.lineInstruction')}), 'SphericalLens.svg');
  setText('tool_CircleGrinGlass_label', i18next.t('main:tools.CircleGrinGlass.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.CircleGrinGlass.description'), sub: i18next.t('main:tools.common.circleInstruction')}), 'CircleGrinGlass.svg');
  setText('tool_GrinGlass_label', i18next.t('main:tools.GrinGlass.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.GrinGlass.description'), sub: i18next.t('main:tools.GrinGlass.instruction')}) + '<br>' + i18next.t('main:tools.GrinGlass.warning'), 'GrinGlass.svg');
  setText('blockerToolsDropdown', i18next.t('main:tools.categories.blocker'));
  setText('tool_Blocker_label', i18next.t('main:tools.Blocker.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.Blocker.description'), sub: i18next.t('main:tools.common.lineInstruction')}), 'Blocker.svg');
  setText('tool_CircleBlocker_label', i18next.t('main:tools.CircleBlocker.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.CircleBlocker.description'), sub: i18next.t('main:tools.common.circleInstruction')}), 'CircleBlocker.svg');
  setText('tool_Aperture_label', i18next.t('main:tools.Aperture.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.Aperture.description'), sub: i18next.t('main:tools.Aperture.instruction')}), 'Aperture.svg');
  setText('tool_DiffractionGrating_label', i18next.t('main:tools.DiffractionGrating.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.DiffractionGrating.description'), sub: i18next.t('main:tools.common.lineInstruction')}), 'DiffractionGrating.svg');
  setText('moreToolsDropdown', i18next.t('main:tools.categories.other'));
  setText('tool_Ruler_label', i18next.t('main:tools.Ruler.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.Ruler.description'), sub: i18next.t('main:tools.common.lineInstruction')}), 'Ruler.svg');
  setText('tool_Protractor_label', i18next.t('main:tools.Protractor.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.Protractor.description'), sub: i18next.t('main:tools.common.lineInstruction')}), 'Protractor.svg');
  setText('tool_Detector_label', i18next.t('main:tools.Detector.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.Detector.description'), sub: i18next.t('main:tools.common.lineInstruction')}), 'Detector.svg');
  setText('tool_TextLabel_label', i18next.t('main:tools.TextLabel.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.TextLabel.description'), sub: i18next.t('main:tools.common.clickInstruction')}));
  setText('tool_LineArrow_label', i18next.t('main:tools.LineArrow.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.LineArrow.description'), sub: i18next.t('main:tools.common.lineInstruction')}));
  setText('tool_Drawing_label', i18next.t('main:tools.Drawing.title'), null, i18next.t('main:meta.parentheses', {main: i18next.t('main:tools.Drawing.description'), sub: i18next.t('main:tools.Drawing.instruction')}));
  setText('import_modules', '<i>' + i18next.t('main:tools.modules.import') + '</i>');
  setText('tool__label', null, i18next.t('main:tools.moveView.title'), i18next.t('main:tools.moveView.description'));
  setText('tools_text', i18next.t('main:tools.title'));
  setText('advanced-help', i18next.t('simulator:settings.advancedHelp'));
  setText('settings_text', i18next.t('simulator:settings.title'));
  setText('moreSettings_text', i18next.t('simulator:settings.more'));
  setText('reset_mobile', i18next.t('simulator:file.reset.title'));
  setText('save_button', i18next.t('simulator:file.save.title'));
  setText('open_mobile', i18next.t('simulator:file.open.title'));
  setText('export_svg_mobile', i18next.t('simulator:file.export.title'));
  setText('get_link_mobile', i18next.t('simulator:file.copyLink.title'));
  setText('view_gallery_mobile', i18next.t('simulator:file.viewGallery.title'));
  setText('tools_mobile_text', i18next.t('main:tools.title'));
  setText('tool_lightSource__text', i18next.t('main:tools.categories.lightSource'));
  setText('tool_mirror__text', i18next.t('main:tools.categories.mirror'));
  setText('tool_glass__text', i18next.t('main:tools.categories.glass'));
  setText('tool_blocker__text', i18next.t('main:tools.categories.blocker'));
  setText('tool_more__text', i18next.t('main:tools.categories.other'));
  setText('tool__mobile_label', i18next.t('main:tools.moveView.title'));
  setText('tool_SingleRay_mobile_label', i18next.t('main:tools.SingleRay.title'));
  setText('tool_Beam_mobile_label', i18next.t('main:tools.Beam.title'));
  setText('tool_PointSource_mobile_label', i18next.t('main:tools.PointSource.title') + ' (360\u00B0)');
  setText('tool_AngleSource_mobile_label', i18next.t('main:tools.PointSource.title') + ' (<360\u00B0)');
  setText('tool_Mirror_mobile_label', i18next.t('main:tools.Mirror.title'));
  setText('tool_ArcMirror_mobile_label', i18next.t('main:tools.ArcMirror.title'));
  setText('tool_ConcaveDiffractionGrating_mobile_label', i18next.t('main:tools.ConcaveDiffractionGrating.title') + '<sup>Beta</sup>');
  setText('tool_ParabolicMirror_mobile_label', i18next.t('main:tools.ParabolicMirror.title'));
  setText('tool_CustomMirror_mobile_label', i18next.t('main:tools.CustomMirror.title'));
  setText('tool_IdealMirror_mobile_label', i18next.t('main:tools.IdealMirror.title'));
  setText('tool_BeamSplitter_mobile_label', i18next.t('main:tools.BeamSplitter.title'));
  setText('tool_PlaneGlass_mobile_label', i18next.t('main:tools.PlaneGlass.title'));
  setText('tool_CircleGlass_mobile_label', i18next.t('main:tools.CircleGlass.title'));
  setText('tool_Glass_mobile_label', i18next.t('main:tools.Glass.title'));
  setText('tool_CustomGlass_mobile_label', i18next.t('main:tools.CustomGlass.title'));
  setText('tool_IdealLens_mobile_label', i18next.t('main:tools.IdealLens.title'));
  setText('tool_SphericalLens_mobile_label', i18next.t('main:tools.SphericalLens.title'));
  setText('tool_CircleGrinGlass_mobile_label', i18next.t('main:tools.CircleGrinGlass.title'));
  setText('tool_GrinGlass_mobile_label', i18next.t('main:tools.GrinGlass.title'));
  setText('tool_Blocker_mobile_label', i18next.t('main:tools.Blocker.title'));
  setText('tool_CircleBlocker_mobile_label', i18next.t('main:tools.CircleBlocker.title'));
  setText('tool_Aperture_mobile_label', i18next.t('main:tools.Aperture.title'));
  setText('tool_DiffractionGrating_mobile_label', i18next.t('main:tools.DiffractionGrating.title'));
  setText('tool_Ruler_mobile_label', i18next.t('main:tools.Ruler.title'));
  setText('tool_Protractor_mobile_label', i18next.t('main:tools.Protractor.title'));
  setText('tool_Detector_mobile_label', i18next.t('main:tools.Detector.title'));
  setText('tool_TextLabel_mobile_label', i18next.t('main:tools.TextLabel.title'));
  setText('tool_LineArrow_mobile_label', i18next.t('main:tools.LineArrow.title'));
  setText('tool_Drawing_mobile_label', i18next.t('main:tools.Drawing.title'));
  setText('import_modules_mobile', '<i>' + i18next.t('main:tools.modules.import') + '</i>');
  setText('moreSettings_text_mobile', i18next.t('simulator:settings.more'));
  setText('showAdvanced', i18next.t('simulator:objBar.showAdvanced.title'));
  setText('apply_to_all_label', null, i18next.t('simulator:objBar.applyToAll.title'));
  setText('copy', null, i18next.t('simulator:objBar.duplicate.title'));
  setText('delete', null, i18next.t('simulator:objBar.delete.title'));
  setText('unselect', null, null, i18next.t('simulator:objBar.unselect.description'));
  setText('showAdvanced_mobile', i18next.t('simulator:objBar.showAdvanced.title'));
  setText('apply_to_all_mobile_label', i18next.t('simulator:objBar.applyToAll.title'));
  setText('copy_mobile', i18next.t('simulator:objBar.duplicate.title'));
  setText('delete_mobile', i18next.t('simulator:objBar.delete.title'));
  setText('unselect_mobile', i18next.t('simulator:objBar.unselect.title'));


  document.title = i18next.t('main:pages.simulator') + ' - ' + i18next.t('main:project.name');
  document.getElementById('home').href = mapURL('/home');
  document.getElementById('about').href = mapURL('/about');
}

function navigateToNewQuery(newQuery) {
  let currentUrl = window.location.href;
  let baseUrl = currentUrl.split('?')[0];  // Remove current query if exists
  baseUrl = baseUrl.split('#')[0];         // Further remove the hash to get the base URL

  let hash = window.location.hash;         // Capture the existing hash
  let newUrl = baseUrl + "?" + newQuery + hash;  // Construct the new URL with the query and hash

  window.location.href = newUrl;  // Set the new URL
}

function setText(id, text, title, popover, image) {
  const elem = document.getElementById(id);

  if (elem == null) {
    throw new Error('Element with ID "' + id + '" not found.');
  }

  if (text != null) {
    elem.innerHTML = text;
  }
  
  if (popoversEnabled) {
    if (title != null) {
      elem.setAttribute('title', title);
    }

    if (popover != null) {
      // Popover
      if (image != null) {
        const content = '<img src="../img/' + image + '" class="popover-image" id="dynamic-popover-image">' + popover;
        elem.setAttribute('data-bs-toggle', 'popover');
        elem.setAttribute('data-bs-trigger', 'hover');
        elem.setAttribute('data-bs-html', 'true');
        elem.setAttribute('data-bs-content', content);

        // Update popover size after image is loaded
        elem.addEventListener('inserted.bs.popover', function () {
          const imgElement = document.querySelectorAll('#dynamic-popover-image');
          imgElement[imgElement.length - 1].addEventListener('load', function () {
            bootstrap.Popover.getInstance(elem).update();
          });
        });
      } else {
        elem.setAttribute('data-bs-toggle', 'popover');
        elem.setAttribute('data-bs-trigger', 'hover');
        elem.setAttribute('data-bs-html', 'true');
        elem.setAttribute('data-bs-content', popover);
      }

      // Initialize the popover
      new bootstrap.Popover(elem);
    } else if (title != null) {
      // Tooltip
      elem.setAttribute('title', title);
      elem.setAttribute('data-bs-toggle', 'tooltip');
      elem.setAttribute('data-bs-trigger', 'hover');
      elem.setAttribute('data-bs-placement', 'bottom');

      // Initialize the tooltip
      new bootstrap.Tooltip(elem);
    }
  } else {
    if (text == null && title != null) {
      elem.setAttribute('title', title);
      elem.setAttribute('data-bs-toggle', 'tooltip');
      elem.setAttribute('data-bs-trigger', 'hover');
      elem.setAttribute('data-bs-placement', 'bottom');

      // Initialize the tooltip
      new bootstrap.Tooltip(elem);
    }
  }
}



var popoversEnabled = true;




var currentMobileToolGroupId = null;

function initTools() {

  const allElements = document.querySelectorAll('*');

  allElements.forEach(element => {
    if (element.id && element.id.startsWith('mobile-dropdown-trigger-')) {
      const toolGroupId = element.id.replace('mobile-dropdown-trigger-', '');
      const toolGroup = document.getElementById(`mobile-dropdown-${toolGroupId}`);

      element.addEventListener('click', (event) => {
        // Show the corresponding tool group in the mobile tool dropdown.
        event.stopPropagation();
        const originalWidth = $("#mobile-dropdown-tools-root").width();
        const originalMarginLeft = parseInt($("#mobile-dropdown-tools-root").css("margin-left"), 10);
        const originalMarginRight = parseInt($("#mobile-dropdown-tools-root").css("margin-right"), 10);
        $("#mobile-dropdown-tools-root").animate({ "margin-left": -originalWidth, "margin-right": originalWidth }, 300, function () {
          $(this).hide();
          toolGroup.style.display = '';
          $(this).css({
            "margin-left": originalMarginLeft + "px",
            "margin-right": originalMarginRight + "px"
          });
          f();
        });

        currentMobileToolGroupId = toolGroupId;
      });
    }

    if (element.id && element.id.startsWith('tool_')) {
      const toolId = element.id.replace('tool_', '').replace('_mobile', '');
      if (sceneObjs[toolId] || toolId == '') {
        element.addEventListener('click', (event) => {
          toolbtn_clicked(toolId);
        });
      }
    }
  });

  document.getElementById('mobile-tools').addEventListener('click', (event) => {
    // Hide the mobile tool dropdown.
    if (currentMobileToolGroupId != null) {
      document.getElementById(`mobile-dropdown-${currentMobileToolGroupId}`).style.display = 'none';
      document.getElementById('mobile-dropdown-tools-root').style.display = '';
      f();
    }
  });

}



function hideAllPopovers() {
  console.log('hideAllPopovers');
  document.querySelectorAll('[data-bs-original-title]').forEach(function (element) {
    var popoverInstance = bootstrap.Popover.getInstance(element);
    if (popoverInstance) {
      popoverInstance.hide();
    }
    var tooltipInstance = bootstrap.Tooltip.getInstance(element);
    if (tooltipInstance) {
      tooltipInstance.hide();
    }
  });
}

function updateModuleObjsMenu() {
  for (let suffix of ['', '_mobile']) {
    const moduleStartLi = document.getElementById('module_start' + suffix);

    // Remove all children after moduleStartLi
    while (moduleStartLi.nextElementSibling) {
      moduleStartLi.nextElementSibling.remove();
    }

    // Add all module objects to the menu after moduleStartLi
    for (let moduleName of Object.keys(scene.modules)) {
      const moduleLi = document.createElement('li');

      const moduleRadio = document.createElement('input');
      moduleRadio.type = 'radio';
      moduleRadio.name = 'toolsradio' + suffix;
      moduleRadio.id = 'moduleTool_' + moduleName + suffix;
      moduleRadio.classList.add('btn-check');
      moduleRadio.autocomplete = 'off';
      moduleRadio.addEventListener('change', function () {
        if (moduleRadio.checked) {
          resetDropdownButtons();
          document.getElementById('moreToolsDropdown').classList.add('selected');
          document.getElementById('mobile-dropdown-trigger-more').classList.add('selected');
          toolbtn_clicked('ModuleObj');
          editor.addingModuleName = moduleName;
        }
      });

      const moduleLabel = document.createElement('label');
      moduleLabel.classList.add('btn', 'shadow-none', 'btn-primary', 'dropdown-item', 'd-flex', 'w-100');
      moduleLabel.htmlFor = 'moduleTool_' + moduleName + suffix;

      const moduleNameDiv = document.createElement('div');
      moduleNameDiv.classList.add('col');
      moduleNameDiv.style.fontFamily = 'monospace';
      moduleNameDiv.innerText = moduleName;
      moduleLabel.appendChild(moduleNameDiv);


      const removeButtonDiv = document.createElement('div');
      removeButtonDiv.classList.add('col', 'text-end');
      const removeButton = document.createElement('button');
      removeButton.classList.add('btn');
      removeButton.style.color = 'gray';
      removeButton.style.padding = '0px';
      //removeButton.style.margin = '0px';
      removeButton.style.fontSize = '10px';
      removeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="-4 0 16 20">
        <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/>
      </svg>
      `;
      removeButton.setAttribute('data-bs-toggle', 'tooltip');
      removeButton.setAttribute('title', i18next.t('main:tools.modules.remove'));
      removeButton.setAttribute('data-bs-placement', 'right');
      new bootstrap.Tooltip(removeButton);
      removeButton.addEventListener('click', function () {
        console.log(moduleName);
        scene.removeModule(moduleName);
        if (editor.addingObjType == 'ModuleObj' && editor.addingModuleName == moduleName) {
          toolbtn_clicked('');  // Deselect the module object tool
        }
        simulator.updateSimulation(false, true);
        hideAllPopovers();
        updateModuleObjsMenu();
        editor.onActionComplete();
      });
      removeButtonDiv.appendChild(removeButton);

      moduleLabel.appendChild(removeButtonDiv);
      moduleLi.appendChild(moduleRadio);
      moduleLi.appendChild(moduleLabel);
      moduleStartLi.after(moduleLi);

    }
  }

}

function updateErrorAndWarning() {
  statusEmitter.emit(STATUS_EVENT_NAMES.SYSTEM_STATUS, {
    app: { 
      error: error, 
      warning: warning 
    },
    scene: { 
      error: scene.error, 
      warning: scene.warning 
    },
    simulator: { 
      error: simulator.error, 
      warning: simulator.warning 
    },
    objects: scene.objs.map((obj, i) => ({
      index: i,
      type: obj.constructor.type,
      error: obj.getError(),
      warning: obj.getWarning()
    }))
  });
}

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
    scene.backgroundImage = null;
    editor.loadJSON(client.responseText);

    editor.onActionComplete();
    hasUnsavedChange = false;
    jsonEditorService.updateContent(editor.lastActionJson);
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
          if (scene.modules[moduleName] && JSON.stringify(scene.modules[moduleName]) != JSON.stringify(moduleJSON.modules[moduleName])) {
            newModuleName = prompt(i18next.t('simulator:moduleModal.conflict'), moduleName);
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
    editor.onActionComplete();
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









function init() {
  document.title = i18next.t('main:pages.simulator') + ' - ' + i18next.t('main:project.name');
  //document.getElementById('save_name').value = "";

  editor.isConstructing = false;
  editor.endPositioning();

  scene.backgroundImage = null;
  scene.loadJSON(JSON.stringify({ version: DATA_VERSION }), () => { });
  scene.origin = geometry.point(0, 0);
  scene.scale = 1;

  let dpr = window.devicePixelRatio || 1;

  scene.setViewportSize(canvas.width / dpr, canvas.height / dpr);

  editor.selectObj(-1);

  toolbtn_clicked('');
  modebtn_clicked('rays');
  colorModebtn_clicked('default');
  scene.backgroundImage = null;

  //Reset new UI.

  resetDropdownButtons();
  updateModuleObjsMenu();

  document.getElementById('tool_').checked = true;
  document.getElementById('tool__mobile').checked = true;

  document.getElementById('apply_to_all').checked = false;
  document.getElementById('apply_to_all_mobile').checked = false;

  simulator.updateSimulation();
}





var lastFullURL = "";
var syncUrlTimerId = -1;

function syncUrl() {
  if (!window.autoSyncUrl) return;
  if (document.getElementById('welcome').style.display != 'none') return;

  if (syncUrlTimerId != -1) {
    clearTimeout(syncUrlTimerId);
  }
  syncUrlTimerId = setTimeout(function () {
    var compressed = require('json-url')('lzma').compress(JSON.parse(editor.lastActionJson)).then(output => {
      var fullURL = "https://phydemo.app/ray-optics/simulator/#" + output;
      if (fullURL.length > 2041) {
        warning = i18next.t('simulator:generalWarnings.autoSyncUrlTooLarge');
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
  }, 1000);
}


function toolbtn_clicked(tool, e) {
  if (tool != "") {
    document.getElementById('welcome').style.display = 'none';
  }
  editor.addingObjType = tool;
}


function modebtn_clicked(mode1) {
  scene.mode = mode1;
  if (scene.mode == 'observer' && !scene.observer) {
    // Initialize the observer
    scene.observer = geometry.circle(geometry.point((canvas.width * 0.5 / simulator.dpr - scene.origin.x) / scene.scale, (canvas.height * 0.5 / simulator.dpr - scene.origin.y) / scene.scale), 40);
  }
}

window.modebtn_clicked = modebtn_clicked;

function colorModebtn_clicked(colorMode) {
  scene.colorMode = colorMode;
}

window.colorModebtn_clicked = colorModebtn_clicked;


function rename() {
  //scene.name = document.getElementById('save_name').value;
  if (scene.name) {
    document.title = scene.name + " - " + i18next.t('main:pages.simulator') + ' - ' + i18next.t('main:project.name');
  } else {
    document.title = i18next.t('main:pages.simulator') + ' - ' + i18next.t('main:project.name');
  }
  document.dispatchEvent(new Event('sceneChanged'));
  editor.onActionComplete();
}

window.rename = rename;

function save() {
  rename();

  var blob = new Blob([editor.lastActionJson], { type: 'application/json' });
  saveAs(blob, (scene.name || "scene") + ".json");
  var saveModal = bootstrap.Modal.getInstance(document.getElementById('saveModal'));
  if (saveModal) {
    saveModal.hide();
  }
  hasUnsavedChange = false;
}

window.save = save;

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
      editor.loadJSON(fileString);
      hasUnsavedChange = false;
      editor.onActionComplete();
      jsonEditorService.updateContent(editor.lastActionJson);
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
  require('json-url')('lzma').compress(JSON.parse(editor.lastActionJson)).then(output => {
    var fullURL = "https://phydemo.app/ray-optics/simulator/#" + output;
    lastFullURL = fullURL;
    window.history.pushState(undefined, undefined, '#' + output);
    //console.log(fullURL.length);
    navigator.clipboard.writeText(fullURL);
    if (fullURL.length > 2041) {
      alert(i18next.t('simulator:generalWarnings.shareLinkTooLong'));
    } else {
      hasUnsavedChange = false;
    }
  });
}


window.onbeforeunload = function (e) {
  if (hasUnsavedChange) {
    return "You have unsaved change.";
  }
}

function confirmPositioning(ctrl, shift) {
  var xyData = JSON.parse('[' + document.getElementById('xybox').value.replace(/\(|\)/g, '') + ']');
  if (xyData.length == 2) {
    editor.confirmPositioning(xyData[0], xyData[1], ctrl, shift);
  }
}


function mapURL(url) {
  const localeData = window.localeData[window.lang];
  const route = (localeData.route !== undefined) ? localeData.route : '/' + window.lang;
  const rootURL = '..'
  const urlMap = {
    "/home": rootURL + (localeData.home ? route : '') + '/',
    "/gallery": rootURL + (localeData.gallery ? route : '') + '/gallery/',
    "/modules/modules": rootURL + (localeData.modules ? route : '') + '/modules/modules.html',
    "/modules/tutorial": rootURL + (localeData.moduleTutorial ? route : '') + '/modules/tutorial',
    "/about": rootURL + (localeData.about ? route : '') + '/about',
    "/email": "mailto:ray-optics@phydemo.app",
    "/github": "https://github.com/ricktu288/ray-optics",
    "/github/issues": "https://github.com/ricktu288/ray-optics/issues",
    "/github/discussions": "https://github.com/ricktu288/ray-optics/discussions",
    "/run-locally": "https://github.com/ricktu288/ray-optics/blob/master/run-locally/README.md",
    "/contributing": "https://github.com/ricktu288/ray-optics/blob/master/CONTRIBUTING.md",
    "/contributing/gallery": "https://github.com/ricktu288/ray-optics/blob/master/CONTRIBUTING.md#contributing-items-to-the-gallery",
    "/contributing/modules": "https://github.com/ricktu288/ray-optics/blob/master/CONTRIBUTING.md#contributing-modules",
    "/weblate": "https://hosted.weblate.org/engage/ray-optics-simulation/",
  };
  return urlMap[url] || url;
}

window.mapURL = mapURL;

// Parse the markdown-like links in the text with mapURL and return the HTML.
function parseLinks(text) {
  return text.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, function (match, text, url) {
    if (text === 'ray-optics@phydemo.app') {
      // Prevent link from wrapping.
      return `<a href="${mapURL(url)}" target="_blank" style="white-space: nowrap;">${text}</a>`;
    } else {
      return `<a href="${mapURL(url)}" target="_blank">${text}</a>`;
    }
  });
}

window.parseLinks = parseLinks;

window.rename = rename;