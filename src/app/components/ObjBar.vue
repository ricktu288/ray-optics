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
  <div id="obj_bar" class="obj-bar" :style="[objBarStyle, { display: 'none' }]">
    <span class="d-none d-lg-inline" id="obj_name"></span><span id="obj_bar_main">
    </span>
    <span>
      <nobr>
        <span class="d-none d-lg-inline">
          <span id="showAdvanced" v-text="$t('simulator:objBar.showAdvanced.title')" @click="handleShowAdvanced"></span>
          <span id="apply_to_all_box">
            <input type="checkbox" class="btn-check" id="apply_to_all" autocomplete="off" v-model="applyToAll">
            <label id="apply_to_all_label" class="btn btn-outline-secondary" for="apply_to_all" v-tooltip-popover="{ title: $t('simulator:objBar.applyToAll.title') }">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="m11.5 11.932a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-2.45 1a2.5 2.5 0 0 1 4.9 0h2.05v1h-2.05a2.5 2.5 0 0 1-4.9 0h-9.05v-1z"/>
                <path d="m11.5 1.1864a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-2.45 1a2.5 2.5 0 0 1 4.9 0h2.05v1h-2.05a2.5 2.5 0 0 1-4.9 0h-9.05v-1z"/>
                <path d="m10.049 6.3809v3.1367h1v-3.1367z"/>
                <path d="m11.82 6.3809v3.1367h1v-3.1367z"/>
              </svg>
            </label>
          </span>
          <button class="btn" id="copy" v-tooltip-popover="{ title: $t('simulator:objBar.duplicate.title') }" @click="handleClone">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 9.766 9.766">
              <g transform="matrix(.01973 0 0 .01973 .0020532 .061476)">
                <path d="m314.25 85.4h-227c-21.3 0-38.6 17.3-38.6 38.6v325.7c0 21.3 17.3 38.6 38.6 38.6h227c21.3 0 38.6-17.3 38.6-38.6v-325.7c-0.1-21.3-17.4-38.6-38.6-38.6zm11.5 364.2c0 6.4-5.2 11.6-11.6 11.6h-227c-6.4 0-11.6-5.2-11.6-11.6v-325.6c0-6.4 5.2-11.6 11.6-11.6h227c6.4 0 11.6 5.2 11.6 11.6z"/>
                <path d="m401.05 0h-227c-21.3 0-38.6 17.3-38.6 38.6 0 7.5 6 13.5 13.5 13.5s13.5-6 13.5-13.5c0-6.4 5.2-11.6 11.6-11.6h227c6.4 0 11.6 5.2 11.6 11.6v325.7c0 6.4-5.2 11.6-11.6 11.6-7.5 0-13.5 6-13.5 13.5s6 13.5 13.5 13.5c21.3 0 38.6-17.3 38.6-38.6v-325.7c0-21.3-17.3-38.6-38.6-38.6z"/>
              </g>
            </svg>
          </button>
          <button class="btn" id="delete" v-tooltip-popover="{ title: $t('simulator:objBar.delete.title') }" @click="handleDelete">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16">
              <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/>
            </svg>
          </button>
          <button class="btn" id="unselect" v-tooltip-popover:[tooltipType]="{ content: $t('simulator:objBar.unselect.description'), placement: 'bottom' }" @click="handleUnselect">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x" viewBox="0 0 16 16">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </span>
        
        <span class="d-inline d-lg-none">
          <button class="btn shadow-none" type="button" data-bs-toggle="dropdown" aria-expanded="false" id="selectedToolDropdownMobile" style="color:white; padding-left:0px;padding-right:5px">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-three-dots" viewBox="0 0 16 16">
              <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
            </svg>
          </button>
          <ul class="dropdown-menu" aria-labelledby="selectedToolDropdownMobile">
            <li id="showAdvanced_mobile_container" style="display: none">
              <button class="dropdown-item" id="showAdvanced_mobile" v-text="$t('simulator:objBar.showAdvanced.title')" @click="handleShowAdvanced"></button>
            </li>
            <li id="apply_to_all_mobile_container" style="display: none">
              <input type="checkbox" class="btn-check" autocomplete="off" id="apply_to_all_mobile" v-model="applyToAll">
              <label id="apply_to_all_mobile_label" class="dropdown-item" for="apply_to_all_mobile" v-text="$t('simulator:objBar.applyToAll.title')"></label>
            </li>
            <li>
              <button class="dropdown-item" id="copy_mobile" v-text="$t('simulator:objBar.duplicate.title')" @click="handleClone"></button>
            </li>
            <li>
              <button class="dropdown-item" id="delete_mobile" v-text="$t('simulator:objBar.delete.title')" @click="handleDelete"></button>
            </li>
            <li>
              <button class="dropdown-item" id="unselect_mobile" v-text="$t('simulator:objBar.unselect.title')" @click="handleUnselect"></button>
            </li>
          </ul>
        </span>
      </nobr>
    </span>
  </div>
</template>

<script>
/**
 * @module ObjBar
 * @description The Vue component for the object bar. It is mixed-paradigm code that combines Vue and vanilla JavaScript due to historical reasons.
 */
import { computed, toRef } from 'vue'
import { vTooltipPopover } from '../directives/tooltip-popover'
import { usePreferencesStore } from '../store/preferences'
import { useThemeStore } from '../store/theme'
import { app } from '../services/app'

export default {
  name: 'ObjBar',
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  setup() {
    const preferences = usePreferencesStore()
    const themeStore = useThemeStore()
    const help = toRef(preferences, 'help')
    const tooltipType = computed(() => help.value ? 'popover' : null)

    const applyToAll = computed({
      get: () => app.objBar?.shouldApplyToAll ?? false,
      set: (value) => app.objBar.shouldApplyToAll = value
    })

    // Computed style that adapts to theme
    const objBarStyle = computed(() => {
      const isLight = themeStore.backgroundIsLight.value
      // Use higher alpha for light backgrounds for better visibility
      if (isLight) {
        return {
          backgroundColor: 'rgba(60, 150, 164, 0.9)'
        }
      } else {
        return {
          backgroundColor: 'rgba(23, 162, 184, 0.5)'
        }
      }
    })

    return {
      tooltipType,
      applyToAll,
      objBarStyle
    }
  },
  methods: {
    handleClone(event) {
      event.target.blur()
      app.cloneSelectedObj()
    },
    handleDelete(event) {
      event.target.blur()
      app.deleteSelectedObj()
    },
    handleUnselect(event) {
      event.target.blur()
      app.unselect()
    },
    handleShowAdvanced(event) {
      event.target.blur()
      app.showAdvanced()
    }
  }
}
</script>

<style>
#obj-bar {
  background-color: rgba(255, 255, 255, 0.3);
}

.obj-bar {
  z-index: -1;
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  color:white;
  font-size:12pt;
  
  padding-top: 3px;
  padding-left: 12px;
  padding-right: 7px;
  padding-bottom: 3px;
  margin: auto;
  margin-top: 16px;
  text-align: center;
  border-radius: 0.5em;
}

.obj-bar .btn {
  padding-top: 0;
  padding-left: 7px;
  padding-right: 7px;
  color: white;
}

.obj-bar .btn:focus {
  box-shadow: none;
}

.obj-bar-nobr {
  white-space: nowrap;
  padding-left: 3px;
  padding-right: 3px;
}

.obj-bar .form-range {
  width: 125px;
  padding-top:15px;
  padding-left: 3px;
}

.obj-bar .form-range::-webkit-slider-thumb {
  background: gray;
  border: 2px solid white;
}

.obj-bar .form-range::-moz-range-thumb {
  background: gray;
  border: 2px solid white;
}

.obj-bar .form-range::-ms-thumb {
  background: gray;
  border: 2px solid white;
}

.obj-bar .form-range::-webkit-slider-runnable-track {
  background: rgba(255,255,255, 0.5);
}

.obj-bar .form-range::-moz-range-track {
  background-color: rgba(255,255,255, 0.5);
}

.obj-bar-editable {
  color: white;
  background-color: rgba(255,255,255,0.2);
  border: none;
  text-align: center;
}

.obj-bar-editable::selection {
  background-color: gray;
  color: white;
}

.obj-bar-number {
  width: 40px;
  padding-left: 1px;
  padding-right: 1px;
  font-size: 15px;
}

.mq-cursor {
  border-color: white !important;
}

.info-icon {
  color: rgba(255, 255, 255, 0.6);
  padding-left:0px;
  padding-right:0px;
}


.obj-bar .form-switch .form-check-input {
  margin-top: 0px;
  background-color: rgba(255,255,255, 0.3);
  border: none;
  vertical-align: middle;
}

.obj-bar .form-switch .form-check-input {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23f0f0f0'/%3e%3c/svg%3e");
}

.obj-bar .form-switch .form-check-input:focus {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23ffffff'/%3e%3c/svg%3e");
}

.obj-bar .form-switch .form-check-input:checked {
  background-color: gray;
  border: none;
}

.obj-bar .form-switch .form-check-input:checked {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23ffffff'/%3e%3c/svg%3e");
}

.obj-bar .form-switch .form-check-input:checked:focus {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23ffffff'/%3e%3c/svg%3e");
}

#showAdvanced {
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
}
</style>
