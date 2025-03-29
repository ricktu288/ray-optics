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
  <div v-if="layout === 'desktop'" class="col-auto d-none d-xxl-block">
    <div class="row justify-content-center">
      <div class="btn-group" role="group">
        <input type="checkbox" class="btn-check" id="showGrid" autocomplete="off" v-model="showGrid" @click="e => e.target.blur()">
        <label id="showGrid_label" class="btn shadow-none btn-secondary" for="showGrid" v-tooltip-popover="{ title: $t('simulator:settings.layoutAids.showGrid') }">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grid-3x3" viewBox="0 0 16 16">
            <path d="M0 1.5A1.5 1.5 0 0 1 1.5 0h13A1.5 1.5 0 0 1 16 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 14.5v-13zM1.5 1a.5.5 0 0 0-.5.5V5h4V1H1.5zM5 6H1v4h4V6zm1 4h4V6H6v4zm-1 1H1v3.5a.5.5 0 0 0 .5.5H5v-4zm1 0v4h4v-4H6zm5 0v4h3.5a.5.5 0 0 0 .5-.5V11h-4zm0-1h4V6h-4v4zm0-5h4V1.5a.5.5 0 0 0-.5-.5H11v4zm-1 0V1H6v4h4z"/>
          </svg>                    
        </label>
        <input type="checkbox" class="btn-check" id="snapToGrid" autocomplete="off" v-model="snapToGrid" @click="e => e.target.blur()">
        <label id="snapToGrid_label" class="btn shadow-none btn-secondary" for="snapToGrid" v-tooltip-popover="{ title: $t('simulator:settings.layoutAids.snapToGrid') }">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-magnet" viewBox="0 0 16 16">
            <path d="M8 1a7 7 0 0 0-7 7v3h4V8a3 3 0 0 1 6 0v3h4V8a7 7 0 0 0-7-7Zm7 11h-4v3h4v-3ZM5 12H1v3h4v-3ZM0 8a8 8 0 1 1 16 0v8h-6V8a2 2 0 1 0-4 0v8H0V8Z"/>
          </svg>                 
        </label>
        <input type="checkbox" class="btn-check" id="lockObjs" autocomplete="off" v-model="lockObjs" @click="e => e.target.blur()">
        <label id="lockObjs_label" class="btn shadow-none btn-secondary" for="lockObjs" v-tooltip-popover="{ title: $t('simulator:settings.layoutAids.lockObjs') }">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-lock" viewBox="0 0 16 16">
            <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 8h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
          </svg>
        </label>
      </div>
    </div>
    <div class="row justify-content-center title">{{ $t('simulator:settings.layoutAids.title') }}</div>
  </div>

  <div v-if="layout === 'tablet'" class="row d-flex d-xxl-none justify-content-between align-items-center">
    <div class="col-auto settings-label" id="layoutAids_more_text">{{ $t('simulator:settings.layoutAids.title') }}</div>
    <div class="col-auto d-flex align-items-center">
      <div class="btn-group" role="group">
        <input type="checkbox" class="btn-check" id="showGrid_more" autocomplete="off" v-model="showGrid" @click="e => e.target.blur()">
        <label id="showGrid_more_label" class="btn shadow-none btn-outline-secondary" for="showGrid_more" v-tooltip-popover="{ title: $t('simulator:settings.layoutAids.showGrid') }">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grid-3x3" viewBox="0 0 16 16">
            <path d="M0 1.5A1.5 1.5 0 0 1 1.5 0h13A1.5 1.5 0 0 1 16 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 14.5v-13zM1.5 1a.5.5 0 0 0-.5.5V5h4V1H1.5zM5 6H1v4h4V6zm1 4h4V6H6v4zm-1 1H1v3.5a.5.5 0 0 0 .5.5H5v-4zm1 0v4h4v-4H6zm5 0v4h3.5a.5.5 0 0 0 .5-.5V11h-4zm0-1h4V6h-4v4zm0-5h4V1.5a.5.5 0 0 0-.5-.5H11v4zm-1 0V1H6v4h4z"/>
          </svg>                    
        </label>
        <input type="checkbox" class="btn-check" id="snapToGrid_more" autocomplete="off" v-model="snapToGrid" @click="e => e.target.blur()">
        <label id="snapToGrid_more_label" class="btn shadow-none btn-outline-secondary" for="snapToGrid_more" v-tooltip-popover="{ title: $t('simulator:settings.layoutAids.snapToGrid') }">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-magnet" viewBox="0 0 16 16">
            <path d="M8 1a7 7 0 0 0-7 7v3h4V8a3 3 0 0 1 6 0v3h4V8a7 7 0 0 0-7-7Zm7 11h-4v3h4v-3ZM5 12H1v3h4v-3ZM0 8a8 8 0 1 1 16 0v8h-6V8a2 2 0 1 0-4 0v8H0V8Z"/>
          </svg>                 
        </label>
        <input type="checkbox" class="btn-check" id="lockObjs_more" autocomplete="off" v-model="lockObjs" @click="e => e.target.blur()">
        <label id="lockObjs_more_label" class="btn shadow-none btn-outline-secondary" for="lockObjs_more" v-tooltip-popover="{ title: $t('simulator:settings.layoutAids.lockObjs') }">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-lock" viewBox="0 0 16 16">
            <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 8h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
          </svg>
        </label>
      </div>
    </div>
    <hr class="dropdown-divider">
  </div>

  <div v-if="layout === 'mobile'">
    <ToggleControl
      :label="$t('simulator:settings.layoutAids.showGrid')"
      v-model="showGrid"
    />
    <ToggleControl
      :label="$t('simulator:settings.layoutAids.snapToGrid')"
      v-model="snapToGrid"
    />
    <ToggleControl
      :label="$t('simulator:settings.layoutAids.lockObjs')"
      v-model="lockObjs"
    />
    <hr class="dropdown-divider">
  </div>
</template>

<script>
/**
 * @module LayoutAidsBar
 * @description The vue component for the 'Layout Aids' section of the toolbar (desktop) or the layout aids controls in the SettingsBar component (mobile or tablet).
 * @vue-prop {String} layout - The layout of the toolbar. Can be 'mobile', 'tablet', or 'desktop'. Here 'tablet' means middle-sized screen where this control is to be shown inside the SettingsBar component.
 */
import { vTooltipPopover } from '../../directives/tooltip-popover'
import { useSceneStore } from '../../store/scene'
import ToggleControl from './controls/ToggleControl.vue'

export default {
  name: 'LayoutAidsBar',
  components: {
    ToggleControl
  },
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  props: {
    layout: String
  },
  setup() {
    const scene = useSceneStore()
    
    return {
      showGrid: scene.showGrid,
      snapToGrid: scene.snapToGrid,
      lockObjs: scene.lockObjs
    }
  }
}
</script>