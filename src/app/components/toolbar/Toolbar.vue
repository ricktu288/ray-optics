<!--
  Copyright 2025 The Ray Optics Simulation authors and contributors

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->

<template>
  <!-- Desktop Toolbar -->
  <div id="toolbar" class="container-fluid d-none d-lg-block" :style="toolbarStyle">
    <div class="container-xxl">
      <div class="row justify-content-between" style="flex-wrap: nowrap;">
        <FileBar layout="desktop" />
        <ToolsBar layout="desktop" />
        <ViewBar layout="desktop" />
        <RayDensityBar layout="desktop" />
        <LayoutAidsBar layout="desktop" />
        <SettingsBar layout="desktop" />
      </div>
    </div>
  </div>

  <!-- Mobile Toolbar -->
  <div id="toolbar-mobile-collapse" class="d-block d-lg-none">
    <div>
      <div id="toolbar-mobile" class="container-fluid p-0 position-relative" :style="toolbarMobileStyle">
        <div class="container-sm p-0">
          <div class="row justify-content-between m-0">
            <FileBar layout="mobile" />
            <ToolsBar layout="mobile" />
            <ViewBar layout="mobile" />
            <SettingsBar layout="mobile" />
          </div>
        </div>
        <div class="dropdown-menu mobile-dropdown-menu" :style="[mobileDropdownStyle, { display: 'block', 'z-index': 1 }]">
          <!--dummy background for collapse transition-->
          <div>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>

<script>
/**
 * @module Toolbar
 * @description The Vue component for the toolbar (which contains both the desktop and mobile parts). Note that many UI code in this component has not been refactored using a proper Vue approach.
 */
import FileBar from './FileBar.vue';
import ToolsBar from './ToolsBar.vue';
import ViewBar from './ViewBar.vue';
import SettingsBar from './SettingsBar.vue';
import RayDensityBar from './RayDensityBar.vue';
import LayoutAidsBar from './LayoutAidsBar.vue';
import * as $ from 'jquery';
import { app } from '../../services/app.js'
import { computed } from 'vue'
import { useThemeStore } from '../../store/theme'

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

export default {
  name: 'Toolbar',
  components: {
    FileBar,
    ToolsBar,
    ViewBar,
    SettingsBar,
    RayDensityBar,
    LayoutAidsBar
  },
  setup() {
    const themeStore = useThemeStore()

    // Computed styles that adapt to theme - toolbar should contrast with scene background
    const toolbarStyle = computed(() => {
      const isLight = themeStore.backgroundIsLight.value
      // Use darker background for light scenes, lighter background for dark scenes
      const backgroundColor = isLight ? 'rgba(230, 230, 230, 0.88)' : 'rgba(255, 255, 255, 0.88)'
      return { backgroundColor }
    })

    const toolbarMobileStyle = computed(() => {
      const isLight = themeStore.backgroundIsLight.value
      // Use darker background for light scenes, lighter background for dark scenes
      const backgroundColor = isLight ? 'rgb(240, 240, 240)' : 'rgb(255, 255, 255)'
      return { backgroundColor }
    })

    const mobileDropdownStyle = computed(() => {
      const isLight = themeStore.backgroundIsLight.value
      // Use darker background for light scenes, lighter background for dark scenes
      const backgroundColor = isLight ? 'rgb(240, 240, 240)' : 'rgb(255, 255, 255)'
      return { backgroundColor }
    })

    return {
      toolbarStyle,
      toolbarMobileStyle,
      mobileDropdownStyle
    }
  },
  mounted() {
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
            app.resetDropdownButtons();

            // Get the associated dropdown button using the aria-labelledby attribute
            let dropdownButton = document.getElementById(input.closest('.dropdown-menu').getAttribute('aria-labelledby'));

            // Style the button to indicate selection.
            dropdownButton.classList.add('selected');
          } else if (input.name == 'toolsradio_mobile') {
            app.resetDropdownButtons();

            // Get the associated mobile trigger button by searching up the DOM tree
            let element = input;
            let groupId = null;
            while (element && element.parentElement) {
              element = element.parentElement;
              if (element.id && element.id.startsWith('mobile-dropdown-')) {
                groupId = element.id.replace('mobile-dropdown-', '');
                break;
              }
            }
            
            if (groupId) {
              let toggle = document.getElementById(`mobile-dropdown-trigger-${groupId}`);
              if (toggle != null) {
                // Style the button to indicate selection.
                toggle.classList.add('selected');
              }
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
            app.resetDropdownButtons();
          }
        });
      }
    });

    var currentMobileToolGroupId = null;

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
  });

  document.getElementById('mobile-tools').addEventListener('click', (event) => {
    // Hide the mobile tool dropdown.
    if (currentMobileToolGroupId != null) {
      document.getElementById(`mobile-dropdown-${currentMobileToolGroupId}`).style.display = 'none';
      document.getElementById('mobile-dropdown-tools-root').style.display = '';
      f();
    }
  });
  },
}
</script>

<style>
#toolbar, #toolbar-mobile {
  padding-top: 7px;
  padding-bottom: 3px;
  padding-left: 7px;
  padding-right: 7px;
}

#toolbar {
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

#toolbar-mobile {
}


#non-toolbar-space {
  position: relative;
  flex-grow: 1;
}


.mobile-dropdown-menu {
  height: 0;
  transition: height .3s ease;
  overflow: hidden;

  top: 100%;
  left: 0;
  right: 0;
  margin: 0 !important;
  padding: 0;  
  overflow: hidden; 
  
  border: none;
  border-radius: 0;
}



#mobile-dropdown-collpase {
  position: absolute;
  top: 0;
  width: 100%;

  height: 0;
  transition: height .3s ease;
}

.range-minus-btn {
  padding-left: 0px;
  padding-right: 7px;
}

.range-plus-btn {
  padding-left: 7px;
  padding-right: 0px;
}

.settings-number {
  background-color: transparent;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.5);
  width: 40px;
  text-align: center;
}

.settings-label {
  padding-right: 0px;
}

#more-options-dropdown {
  width:350px;
  max-height: 80vh;
  overflow-y: auto;
}

#mobile-dropdown-options .container {
  max-height: 75vh;
  overflow-y: auto;
}

#mobile-dropdown-options .row {
  padding-top: 3px;
  padding-bottom: 3px;
}

#mobile-dropdown-options .form-check-input {
  height: 1.2em;
  width: 2.4em;
}


</style>