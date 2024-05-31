
f = function(e) {
  list = document.getElementsByClassName('mobile-dropdown-menu');
  let maxScrollHeight = 0;
  for (ele of list) {
    inner = ele.children[0];
    if(inner.scrollHeight > maxScrollHeight){
      maxScrollHeight = inner.scrollHeight;
    }
  }
  for (ele of list) {
    ele.style.height = maxScrollHeight + 'px';
  }
}
document.getElementById('toolbar-mobile').addEventListener('shown.bs.dropdown', f);
document.getElementById('toolbar-mobile').addEventListener('hidden.bs.dropdown', f);

function resetDropdownButtons() {
  // Remove the 'selected' class from all dropdown buttons
  document.querySelectorAll('.btn.dropdown-toggle.selected').forEach(function(button) {
    button.classList.remove('selected');
  });
  document.querySelectorAll('.btn.mobile-dropdown-trigger.selected').forEach(function(button) {
    button.classList.remove('selected');
  });
}

document.addEventListener('DOMContentLoaded', function() {
  
  document.getElementById('more-options-dropdown').addEventListener('click', function(e) {
    e.stopPropagation();
  });

  document.getElementById('mobile-dropdown-options').addEventListener('click', function(e) {
    e.stopPropagation();
  });

  // Listen for changes to any radio input within a dropdown
  document.querySelectorAll('.dropdown-menu input[type="radio"]').forEach(function(input) {
    input.addEventListener('change', function() {
      if (input.checked) {
        // Reset other dropdown buttons
        if (!input.id.includes('mobile')) {
          resetDropdownButtons();

          // Get the associated dropdown button using the aria-labelledby attribute
          let dropdownButton = document.getElementById(input.closest('.dropdown-menu').getAttribute('aria-labelledby'));

          // Style the button to indicate selection.
          dropdownButton.classList.add('selected');
        } else if (input.name == 'toolsradio_mobile'){
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
  document.querySelectorAll('input[type="radio"].btn-check').forEach(function(input) {
    if (input.name == 'toolsradio' && !input.closest('.dropdown-menu') && !input.id.includes('mobile')) { // Check if the radio is not inside a dropdown
        input.addEventListener('change', function() {
            if (input.checked) {
                // Reset dropdown buttons
                resetDropdownButtons();
            }
        });
    }
  });

});

window.addEventListener('load', function() {
  document.getElementById('toolbar-loading').style.display = 'none';
  document.getElementById('toolbar-wrapper').style.display = '';
  document.getElementById('saveModal').style.display = '';
  document.getElementById('languageModal').style.display = '';
  document.getElementById('footer-left').style.display = '';
  document.getElementById('footer-right').style.display = '';
  document.getElementById('canvas-container').style.display = '';
});

function getMsg(msg) {
  var m = locales[lang][msg];
  if (m == null) {
    //console.log("undefined message: " + msg);
    return msg;
  }
  return m.message;
}

function updateUIText(elememt = document) {
  const elements = elememt.querySelectorAll('[data-text]');
  
  elements.forEach(el => {
    const key = el.getAttribute('data-text');
    const text = getMsg(key);
    el.innerHTML = text;
  });

  document.getElementById('language').innerHTML = document.getElementById('lang-' + lang).innerHTML;
  document.getElementById('language_mobile').innerHTML = document.getElementById('lang-' + lang).innerHTML;
  for (let lang1 in locales) {
    var translated = 0;
    var total = 0;
    for (var item in locales[lang1]) {
      total++;
      if (!locales[lang1][item].incomplete) {
        translated++;
      }
    }
    //console.log([lang1, total, translated]);

    document.getElementById('lang-' + lang1).innerText = Math.round(translated/total*100) + '%';
    document.getElementById('lang-' + lang1).parentElement.parentElement.addEventListener('click', function(e) {
      if (autoSyncUrl && !hasUnsavedChange) {
        // If autoSyncUrl is enabled, we can change the language while keeping the current scene by going to the same URL with a new query.
        e.preventDefault();
        e.stopPropagation();
        navigateToNewQuery(lang1)
      }
    }, true);
  }

  document.title = getMsg('appName');
  document.getElementById('home').href = getMsg('home_url');
  document.getElementById('about').href = getMsg('about_url');
}

function navigateToNewQuery(newQuery) {
  let currentUrl = window.location.href;
  let baseUrl = currentUrl.split('?')[0];  // Remove current query if exists
  baseUrl = baseUrl.split('#')[0];         // Further remove the hash to get the base URL

  let hash = window.location.hash;         // Capture the existing hash
  let newUrl = baseUrl + "?" + newQuery + hash;  // Construct the new URL with the query and hash

  window.location.href = newUrl;  // Set the new URL
}


function updateUIWithPopovers(elememt = document) {
  const elements = elememt.querySelectorAll('[data-title], [data-popover]');
  
  elements.forEach(el => {
    const titleKey = el.getAttribute('data-title');
    const title = getMsg(titleKey);
    if (title != null) {
      el.setAttribute('title', title);
    }

    const contentKey = el.getAttribute('data-popover');
    if (contentKey == null) {
      // Tooltip
      el.setAttribute('data-bs-toggle', 'tooltip');
      el.setAttribute('data-bs-trigger', 'hover');
      el.setAttribute('data-bs-placement', 'bottom');
    } else {
      const image = el.getAttribute('data-image');
      if (image != null) {
        // Popover with image
        const content = '<img src="../img/' + image + '" class="popover-image" id="dynamic-popover-image">' + getMsg(contentKey);
        el.setAttribute('data-bs-toggle', 'popover');
        el.setAttribute('data-bs-trigger', 'hover');
        el.setAttribute('data-bs-html', 'true');
        el.setAttribute('data-bs-content', content);

        // Update popover size after image is loaded
        el.addEventListener('inserted.bs.popover', function() {
          const imgElement = document.querySelectorAll('#dynamic-popover-image');
          imgElement[imgElement.length - 1].addEventListener('load', function() {
            bootstrap.Popover.getInstance(el).update();
          });
        });
      } else {
        // Popover without image
        const content = getMsg(contentKey);
        el.setAttribute('data-bs-toggle', 'popover');
        el.setAttribute('data-bs-trigger', 'hover');
        el.setAttribute('data-bs-html', 'true');
        el.setAttribute('data-bs-content', content);
      }
    }
  });

  // Initialize Tooltips
  var tooltipTriggerList = [].slice.call(elememt.querySelectorAll('[data-bs-toggle="tooltip"]'))
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Initialize Popovers
  var popoverTriggerList = [].slice.call(elememt.querySelectorAll('[data-bs-toggle="popover"]'))
  var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });
}


function updateUIWithoutPopovers(elememt = document) {
  const elements = elememt.querySelectorAll('[data-title]');
  
  elements.forEach(el => {
    const textKey = el.getAttribute('data-text');

    if (textKey == null) {
      const titleKey = el.getAttribute('data-title');
      const title = getMsg(titleKey);
      el.setAttribute('title', title);
      el.setAttribute('data-bs-toggle', 'tooltip');
      el.setAttribute('data-bs-trigger', 'hover');
      el.setAttribute('data-bs-placement', 'bottom');
    }
  });

  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl)
  })
}

updateUIText();

var popoversEnabled = true;
try {
  if (localStorage.rayOpticsHelp == "off") {
    popoversEnabled = false;
  }
} catch { }

document.getElementById('show_help_popups').checked = popoversEnabled;
if (popoversEnabled) {
  updateUIWithPopovers();
} else {
  updateUIWithoutPopovers();
}

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
        originalWidth = $("#mobile-dropdown-tools-root").width();
        originalMarginLeft = parseInt($("#mobile-dropdown-tools-root").css("margin-left"), 10);
        originalMarginRight = parseInt($("#mobile-dropdown-tools-root").css("margin-right"), 10);
        $("#mobile-dropdown-tools-root").animate({ "margin-left": -originalWidth, "margin-right": originalWidth }, 300, function() {
          $(this).hide();
          toolGroup.style.display='';
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
      element.addEventListener('click', (event) => {
        //console.log('tool_' + toolId);
        toolbtn_clicked(toolId);
      });
    }
  });

  document.getElementById('mobile-tools').addEventListener('click', (event) => {
    // Hide the mobile tool dropdown.
    if (currentMobileToolGroupId != null) {
      document.getElementById(`mobile-dropdown-${currentMobileToolGroupId}`).style.display='none';
      document.getElementById('mobile-dropdown-tools-root').style.display='';
      f();
    }
  });

}

initTools();

function initModes() {
  const allElements = document.querySelectorAll('*');

  allElements.forEach(element => {
    if (element.id && element.id.startsWith('mode_')) {
      const modeId = element.id.replace('mode_', '').replace('_mobile', '');
      element.addEventListener('click', (event) => {
        //console.log('mode_' + modeId);
        modebtn_clicked(modeId);
        createUndoPoint();
      });
    }
  });
}

initModes();

function hideAllPopovers() {
  document.querySelectorAll('[data-bs-original-title]').forEach(function(element) {
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

document.getElementById('help-dropdown').addEventListener('click', function(e) {
  e.stopPropagation();
});

var aceEditor;
var lastCodeChangeIsFromScene = false;

function enableJsonEditor() {
  aceEditor = ace.edit("jsonEditor");
  aceEditor.setTheme("ace/theme/github_dark");
  aceEditor.session.setMode("ace/mode/json");
  aceEditor.session.setUseWrapMode(true);
  aceEditor.session.setUseSoftTabs(true);
  aceEditor.session.setTabSize(2);
  aceEditor.setHighlightActiveLine(false)
  aceEditor.container.style.background="transparent"
  aceEditor.container.getElementsByClassName('ace_gutter')[0].style.background="transparent"
  aceEditor.session.setValue(latestJsonCode);
  
  var debounceTimer;

  aceEditor.session.on('change', function(delta) {
    if (lastCodeChangeIsFromScene) {
      setTimeout(function() {
        lastCodeChangeIsFromScene = false;
      }, 100);
      return;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
      latestJsonCode = aceEditor.session.getValue();
      error = null;
      newJsonCode = latestJsonCode;
      JSONInput();
      if (!scene.error) {
        syncUrl();
        requireOccasionalCheck();
      }
    }, 500);
  });

  document.getElementById('footer-left').style.left = '355px';
  document.getElementById('sideBar').style.display = '';
}

function updateModuleObjsMenu() {
  for (let suffix of ['', '_mobile']) {
    const moduleStartLi = document.getElementById('create_modules' + suffix);

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
      moduleRadio.addEventListener('change', function() {
        if (moduleRadio.checked) {
          resetDropdownButtons();
          document.getElementById('moreToolsDropdown').classList.add('selected');
          document.getElementById('mobile-dropdown-trigger-more').classList.add('selected');
          AddingObjType = 'ModuleObj'
          addingModuleName = moduleName;
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
      removeButton.setAttribute('title', getMsg('remove_module'));
      removeButton.setAttribute('data-bs-placement', 'right');
      new bootstrap.Tooltip(removeButton);
      removeButton.addEventListener('click', function() {
        console.log(moduleName);
        scene.removeModule(moduleName);
        draw(false, true);
        hideAllPopovers();
        updateModuleObjsMenu();
        createUndoPoint();
      });
      removeButtonDiv.appendChild(removeButton);

      moduleLabel.appendChild(removeButtonDiv);
      moduleLi.appendChild(moduleRadio);
      moduleLi.appendChild(moduleLabel);
      moduleStartLi.after(moduleLi);

    }
  }

}

function disableJsonEditor() {
  aceEditor.destroy();
  aceEditor = null;
  document.getElementById('footer-left').style.left = '0px';
  document.getElementById('sideBar').style.display = 'none';
}

function updateErrorAndWarning() {
  let errors = [];
  let warnings = [];

  if (error) {
    errors.push("App: " + error);
  }

  if (warning) {
    warnings.push("App: " + warning);
  }

  if (scene.error) {
    errors.push("Scene: " + scene.error);
  }

  if (scene.warning) {
    warnings.push("Scene: " + scene.warning);
  }

  for (let i in scene.objs) {
    let error = scene.objs[i].getError();
    if (error) {
      errors.push(`objs[${i}] ${scene.objs[i].constructor.type}: ${error}`);
    }

    let warning = scene.objs[i].getWarning();
    if (warning) {
      warnings.push(`objs[${i}] ${scene.objs[i].constructor.type}: ${warning}`);
    }
  }

  if (errors.length > 0) {
    document.getElementById('errorText').innerText = errors.join('\n');
    document.getElementById('error').style.display = '';
  } else {
    document.getElementById('error').style.display = 'none';
  }

  if (warnings.length > 0) {
    document.getElementById('warningText').innerText = warnings.join('\n');
    document.getElementById('warning').style.display = '';
  } else {
    document.getElementById('warning').style.display = 'none';
  }
}