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
  <div v-if="layout === 'desktop'" class="col-auto d-none d-xl-block">
    <div class="row justify-content-center">
      <div 
        class="btn-group d-flex align-items-center" 
        role="group" 
        v-tooltip-popover:[tooltipType]="{
          content: $t('simulator:settings.rayDensity.description'),
          offset: [0, 25]
        }"
      >
        <button class="btn shadow-none range-minus-btn" id="rayDensityMinus" @click="(e) => { decreaseDensity(); e.target.blur(); }">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-dash" viewBox="0 0 16 16">
            <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>
          </svg>
        </button>
        <input type="range" 
          class="form-range toolbar-range" 
          min="-3" 
          max="3" 
          step="0.0001" 
          v-model="rayDensity"
          @click="e => e.target.blur()"
        >
        <button class="btn shadow-none range-plus-btn" id="rayDensityPlus" @click="(e) => { increaseDensity(); e.target.blur(); }">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus" viewBox="0 0 16 16">
            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="row justify-content-center title">{{ $t('simulator:settings.rayDensity.title') }}</div>
  </div>

  <div v-if="layout === 'tablet'" 
    class="row d-flex d-xl-none justify-content-between align-items-center" 
    v-tooltip-popover:[tooltipType]="{
      content: $t('simulator:settings.rayDensity.description'),
      placement: 'left',
      offset: [0, 20]
    }" 
  >
    <div class="col-auto">{{ $t('simulator:settings.rayDensity.title') }}</div>
    <div class="btn-group col-auto d-flex align-items-center" role="group">
      <button class="btn shadow-none range-minus-btn" id="rayDensityMinus_more" @click="(e) => { decreaseDensity(); e.target.blur(); }">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-dash" viewBox="0 0 16 16">
          <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>
        </svg>
      </button>
      <input type="range" 
        class="form-range toolbar-range" 
        min="-3" 
        max="3" 
        step="0.0001" 
        v-model="rayDensity"
        @click="e => e.target.blur()"
      >
      <button class="btn shadow-none range-plus-btn" id="rayDensityPlus_more" @click="(e) => { increaseDensity(); e.target.blur(); }">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus" viewBox="0 0 16 16">
          <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
        </svg>
      </button>
    </div>
    <hr class="dropdown-divider">
  </div>

  <div v-if="layout === 'mobile'" class="row d-flex justify-content-between align-items-center">
    <div class="col-auto settings-label">{{ $t('simulator:settings.rayDensity.title') }}</div>
    <div class="col-auto d-flex align-items-center">
      <button class="btn range-minus-btn" id="rayDensityMinus_mobile" @click="(e) => { decreaseDensity(); e.target.blur(); }">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-dash" viewBox="0 0 16 16">
          <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>
        </svg>
      </button>
      <input type="range" 
        class="form-range toolbar-range" 
        min="-3" 
        max="3" 
        step="0.0001" 
        v-model="rayDensity"
        @click="e => e.target.blur()"
      >
      <button class="btn range-plus-btn" id="rayDensityPlus_mobile" @click="(e) => { increaseDensity(); e.target.blur(); }">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus" viewBox="0 0 16 16">
          <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
        </svg>
      </button>
    </div>
  </div>
  <hr v-if="layout === 'mobile'" class="dropdown-divider">
</template>

<script>
/**
 * @module RayDensityBar
 * @description The vue component for the 'Ray Density' section of the toolbar (desktop) or the ray density controls in the SettingsBar component (mobile or tablet).
 * @vue-prop {String} layout - The layout of the toolbar. Can be 'mobile', 'tablet', or 'desktop'. Here 'tablet' means middle-sized screen where this control is to be shown inside the SettingsBar component.
 */
import { vTooltipPopover } from '../../directives/tooltip-popover'
import { usePreferencesStore } from '../../store/preferences'
import { useSceneStore } from '../../store/scene'
import { computed, toRef } from 'vue'

export default {
  name: 'RayDensityBar',
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  props: {
    layout: String
  },
  setup() {
    const preferences = usePreferencesStore()
    const scene = useSceneStore()
    const help = toRef(preferences, 'help')
    const mode = toRef(scene, 'mode')
    const imageModeDensity = toRef(scene, 'imageModeDensity')
    const rayModeDensity = toRef(scene, 'rayModeDensity')
    const tooltipType = computed(() => help.value ? 'popover' : null)

    const rayDensity = computed({
      get: () => {
        if (mode.value === 'images' || mode.value === 'observer') {
          return Math.log(imageModeDensity.value)
        } else {
          return Math.log(rayModeDensity.value)
        }
      },
      set: (value) => {
        if (mode.value === 'images' || mode.value === 'observer') {
          imageModeDensity.value = Math.exp(value)
        } else {
          rayModeDensity.value = Math.exp(value)
        }
      }
    })

    const increaseDensity = () => {
      const newValue = rayDensity.value + 0.1
      rayDensity.value = newValue
    }

    const decreaseDensity = () => {
      const newValue = rayDensity.value - 0.1
      rayDensity.value = newValue
    }

    return {
      tooltipType,
      rayDensity,
      increaseDensity,
      decreaseDensity
    }
  }
}
</script>