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
  <div v-if="layout === 'desktop'" class="col-auto">
    <div class="row">
      <div class="btn-group" role="group">
        <div class="dropdown">
          <button class="btn shadow-none btn-secondary dropdown-toggle" type="button" id="optionsDropdown" data-bs-toggle="dropdown" aria-expanded="false">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-gear" viewBox="0 0 16 16">
              <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
              <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
            </svg>
          </button>
          <div class="dropdown-menu" id="more-options-dropdown" aria-labelledby="optionsDropdown">
            <div class="container">
              <RayDensityBar layout="tablet" />
              <LayoutAidsBar layout="tablet" />

              <ToggleControl
                id="showRayArrows"
                :label="$t('simulator:settings.showRayArrows.title') + '<sup>Beta</sup>'"
                v-model="showRayArrows"
                :layout="layout"
              />

              <ToggleControl
                id="correct_brightness"
                :label="$t('simulator:settings.correctBrightness.title') + '<sup>Beta</sup>'"
                :popoverContent="$t('simulator:settings.correctBrightness.description')"
                v-model="correctBrightness"
                :layout="layout"
                :verticalOffset="25"
              />
              <ToggleControl
                id="simulateColors"
                :label="$t('main:simulateColors.title')"
                :popoverContent="$t('main:simulateColors.description') + '<br>' + $t('main:simulateColors.instruction') + '<br>' + $t('main:simulateColors.warning')"
                v-model="simulateColors"
                :layout="layout"
                :verticalOffset="50"
              />
              <div class="row d-flex justify-content-between align-items-center" data-bs-placement="left" data-bs-offset="20,20" id="colorMode_popover">
                <div class="col-auto settings-label" id="colorMode_text"></div>
                <div class="col-auto d-flex align-items-center">
                  <button class="btn shadow-none dropdown-toggle" type="button" data-bs-toggle="modal" data-bs-target="#colorModeModal" id="colorMode" disabled>
                  </button>
                </div>
              </div>
              <NumberControl
                id="gridSize"
                :label="$t('simulator:settings.gridSize.title')"
                :popoverContent="$t('simulator:sceneObjs.common.lengthUnitInfo')"
                v-model="gridSize"
                :layout="layout"
              />

              <NumberControl
                id="observer_size"
                :label="$t('simulator:settings.observerSize.title')"
                v-model="observerSize"
                :min="1"
                :max="100"
                :default-value="40"
                :layout="layout"
                :popover-content="$t('simulator:sceneObjs.common.lengthUnitInfo')"
              />

              <NumberControl
                id="lengthScale"
                :label="$t('simulator:settings.lengthScale.title')"
                :popover-content="$t('simulator:settings.lengthScale.description')"
                v-model="lengthScale"
                :min="0.1"
                :max="10"
                :default-value="1"
                :layout="layout"
              />

              <ZoomControl
                id="zoom"
                :label="$t('simulator:settings.zoom.title')"
                v-model="zoom"
                :layout="layout"
              />

              <hr class="dropdown-divider">
              <div class="row d-flex justify-content-between align-items-center">
                <div class="col-auto settings-label" id="language_text"></div>
                <div class="col-auto d-flex align-items-center">
                  <button class="btn shadow-none dropdown-toggle" type="button" data-bs-toggle="modal" data-bs-target="#languageModal" id="language">
                    English
                  </button>
                </div>
              </div>
              <div class="language-warning alert alert-warning py-1 mt-1" style="display: none; font-size: 0.875rem; padding-left: 10px; margin-right: 5px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle me-1" viewBox="0 0 16 16" style="margin-bottom:2px">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                  <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                </svg>
              </div>

              <ToggleControl
                id="auto_sync_url"
                :label="$t('simulator:settings.autoSyncUrl.title')"
                :popoverContent="$t('simulator:settings.autoSyncUrl.description')"
                v-model="autoSyncUrl"
                :layout="layout"
              />

              <ToggleControl
                id="show_json_editor"
                :label="$t('simulator:settings.showJsonEditor.title')"
                :popoverContent="$t('simulator:settings.showJsonEditor.description')"
                v-model="showJsonEditor"
                :layout="layout"
              />

              <ToggleControl
                id="show_status"
                :label="$t('simulator:settings.showStatusBox.title')"
                :popoverContent="$t('simulator:settings.showStatusBox.description')"
                v-model="showStatus"
                :layout="layout"
              />

              <ToggleControl
                id="show_help_popups"
                :label="$t('simulator:settings.showHelpPopups.title')"
                :popoverContent="$t('simulator:settings.showHelpPopups.description')"
                v-model="help"
                :layout="layout"
              />

              <div id="advanced-help"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div id="settings_text" class="row justify-content-center title d-none d-xxl-flex"></div>
    <div class="row justify-content-center title d-flex d-xxl-none" id="moreSettings_text"></div>
  </div>

  <div v-if="layout === 'mobile'" class="col p-1">
    <button type="button" class="btn shadow-none btn-secondary w-100" data-bs-toggle="dropdown" data-bs-display="static">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-gear" viewBox="0 0 16 16">
        <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
        <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
      </svg>
      <span class="d-none d-md-inline" id="moreSettings_text_mobile"></span>
    </button>
    <div class="dropdown-menu mobile-dropdown-menu">
      <div id="mobile-dropdown-options" class="mobile-dropdown">
        <div class="container" style="padding-bottom: 15px;">
          <RayDensityBar layout="mobile" />
          <LayoutAidsBar layout="mobile" />

          <ToggleControl
            v-if="layout === 'mobile'"
            id="showRayArrows_mobile"
            :label="$t('simulator:settings.showRayArrows.title') + '<sup>Beta</sup>'"
            v-model="showRayArrows"
            :layout="layout"
          />

          <ToggleControl
            id="correct_brightness_mobile"
            :label="$t('simulator:settings.correctBrightness.title') + '<sup>Beta</sup>'"
            v-model="correctBrightness"
            :layout="layout"
          />
          <ToggleControl
            id="simulateColors_mobile"
            :label="$t('main:simulateColors.title')"
            v-model="simulateColors"
            :layout="layout"
          />
          <div class="row d-flex justify-content-between align-items-center">
            <div class="col-auto settings-label" id="colorMode_mobile_text"></div>
            <div class="col-auto d-flex align-items-center">
              <button class="btn dropdown-toggle" type="button" data-bs-toggle="modal" data-bs-target="#colorModeModal" id="colorMode_mobile" disabled>
              </button>
            </div>
          </div>
          <NumberControl
            id="grid_size_mobile"
            :label="$t('simulator:settings.gridSize.title')"
            v-model="gridSize"
            :min="10"
            :max="100"
            :default-value="50"
            :layout="layout"
          />

          <NumberControl
            id="observer_size_mobile"
            :label="$t('simulator:settings.observerSize.title')"
            v-model="observerSize"
            :min="1"
            :max="100"
            :default-value="40"
            :layout="layout"
            :popover-content="$t('simulator:sceneObjs.common.lengthUnitInfo')"
          />

          <NumberControl
            id="lengthScale_mobile"
            :label="$t('simulator:settings.lengthScale.title')"
            :popover-content="$t('simulator:settings.lengthScale.description')"
            v-model="lengthScale"
            :min="0.1"
            :max="10"
            :default-value="1"
            :layout="layout"
          />

          <ZoomControl
            id="zoom_mobile"
            :label="$t('simulator:settings.zoom.title')"
            v-model="zoom"
            :layout="layout"
          />

          <hr class="dropdown-divider">

          <div class="row d-flex justify-content-between align-items-center">
            <div class="col-auto settings-label" id="language_mobile_text"></div>
            <div class="col-auto d-flex align-items-center">
              <button class="btn dropdown-toggle" type="button" data-bs-toggle="modal" data-bs-target="#languageModal" id="language_mobile">
                English
              </button>
            </div>
          </div>

          <div class="language-warning alert alert-warning py-1 mt-1" style="display: none; font-size: 0.875rem; padding-left: 10px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle me-1" viewBox="0 0 16 16" style="margin-bottom:2px">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
          </div>

          <ToggleControl
            v-if="layout === 'mobile'"
            id="auto_sync_url_mobile"
            :label="$t('simulator:settings.autoSyncUrl.title')"
            v-model="autoSyncUrl"
            :layout="layout"
          />

          <ToggleControl
            v-if="layout === 'mobile'"
            id="show_json_editor_mobile"
            :label="$t('simulator:settings.showJsonEditor.title')"
            v-model="showJsonEditor"
            :layout="layout"
          />

          <ToggleControl
            v-if="layout === 'mobile'"
            id="show_status_mobile"
            :label="$t('simulator:settings.showStatusBox.title')"
            :popoverContent="$t('simulator:settings.showStatusBox.description')"
            v-model="showStatus"
            :layout="layout"
          />

          <div class="row d-flex justify-content-between align-items-center" data-bs-placement="left">
            <div id="show_status_mobile_text" class="col-auto settings-label"></div>
            <div class="col-auto d-flex align-items-center">
              <div class="flex-grow-1 d-flex align-items-center">
                <div class="form-check form-switch align-items-center">
                  <input class="form-check-input" type="checkbox" id="show_status_mobile">
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { vTooltipPopover } from '../../directives/tooltip-popover'
import { useSceneStore } from '../../store/scene'
import { usePreferencesStore } from '../../store/preferences'
import ToggleControl from './controls/ToggleControl.vue'
import NumberControl from './controls/NumberControl.vue'
import ZoomControl from './controls/ZoomControl.vue'
import RayDensityBar from './RayDensityBar.vue'
import LayoutAidsBar from './LayoutAidsBar.vue'
import { computed, toRef } from 'vue'

export default {
  name: 'SettingsBar',
  components: {
    NumberControl,
    ToggleControl,
    ZoomControl,
    RayDensityBar,
    LayoutAidsBar
  },
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  props: {
    layout: String
  },
  setup() {
    const scene = useSceneStore()
    const preferences = usePreferencesStore()
    const colorMode = toRef(scene, 'colorMode')
    
    const correctBrightness = computed({
      get: () => colorMode.value !== 'default',
      set: (value) => {
        // Only change to linear if currently in default mode
        // This preserves other color modes when toggling off
        if (value && colorMode.value === 'default') {
          colorMode.value = 'linear'
        } else if (!value) {
          colorMode.value = 'default'
        }
        window.editor?.selectObj(window.editor.selectedObjIndex)
      }
    })

    return {
      colorMode: scene.colorMode,
      showRayArrows: scene.showRayArrows,
      showGrid: scene.showGrid,
      gridSize: scene.gridSize,
      snapToGrid: scene.snapToGrid,
      observerSize: scene.observerSize,
      lengthScale: scene.lengthScale,
      zoom: scene.zoom,
      simulateColors: scene.simulateColors,
      correctBrightness,
      autoSyncUrl: preferences.autoSyncUrl,
      showJsonEditor: preferences.showJsonEditor,
      showStatus: preferences.showStatus,
      help: preferences.help,
    }
  }
}
</script>