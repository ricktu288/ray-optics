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
        <template v-for="mode in viewModes" :key="mode">
          <input 
            type="radio" 
            class="btn-check" 
            :id="'mode_' + mode" 
            name="viewradio" 
            :value="mode"
            v-model="currentMode"
            @click="e => e.target.blur()"
          >
          <label 
            :id="'mode_' + mode + '_label'" 
            class="btn shadow-none btn-primary" 
            :for="'mode_' + mode"
            v-tooltip-popover:[tooltipType]="getConfig(mode)"
          >
            <img :src="require(`../../../img/${mode}_icon.svg`)" :alt="mode" width="16" height="20">
          </label>
        </template>
      </div>
    </div>
    <div class="row justify-content-center title">{{ $t('main:view.title') }}</div>
  </div>

  <div v-if="layout === 'mobile'" class="col p-1">
    <button type="button" class="btn shadow-none btn-primary w-100" data-bs-toggle="dropdown" data-bs-display="static">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye" viewBox="0 0 16 16">
        <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
        <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
      </svg>
      <span class="d-none d-md-inline">{{ ' ' + $t('main:view.title') }}</span>
    </button>
    <div class="dropdown-menu mobile-dropdown-menu">
      <div id="mobile-dropdown-view" class="mobile-dropdown">
        <ul>
          <li v-for="mode in viewModes" :key="mode">
            <input 
              type="radio" 
              class="btn-check" 
              name="viewradio_mobile" 
              :id="'mode_' + mode + '_mobile'" 
              :value="mode"
              v-model="currentMode"
            >
            <label 
              :id="'mode_' + mode + '_mobile_label'" 
              class="btn btn-primary dropdown-item" 
              :for="'mode_' + mode + '_mobile'"
            >
              {{ $t(`main:view.${mode}.title`) }}
            </label>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * @module ViewBar
 * @description The vue component for the 'View' section of the toolbar.
 * @vue-prop {String} layout - The layout of the toolbar. Can be 'mobile' or 'desktop'.
 */
import { vTooltipPopover } from '../../directives/tooltip-popover'
import i18next from 'i18next'
import { usePreferencesStore } from '../../store/preferences'
import { useSceneStore } from '../../store/scene'
import { useThemeStore } from '../../store/theme'
import { computed, toRef } from 'vue'

export default {
  name: 'ViewBar',
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  props: {
    layout: String
  },
  setup() {
    const preferences = usePreferencesStore()
    const help = toRef(preferences, 'help')
    const tooltipType = computed(() => help.value ? 'popover' : undefined)

    const scene = useSceneStore()
    const themeStore = useThemeStore()
    
    return {
      tooltipType,
      currentMode: scene.mode,
      viewModes: ['rays', 'extended', 'images', 'observer'],
      themeStore
    }
  },
  methods: {
    getConfig(mode) {
      const customThemeWarning = !this.themeStore.isDefaultTheme.value ? `<br>${i18next.t('main:view.customThemeNote')}` : ''
      
      const configs = {
        rays: {
          title: i18next.t('main:view.rays.title'),
          content: i18next.t('main:view.rays.description'),
          popoverImage: 'normal.svg'
        },
        extended: {
          title: i18next.t('main:view.extended.title'),
          content: `${i18next.t('main:view.extended.description')}<br>${i18next.t('main:view.extended.simulateColorsNote')}${customThemeWarning}`,
          popoverImage: 'extended_rays.svg'
        },
        images: {
          title: i18next.t('main:view.images.title'),
          content: `${i18next.t('main:view.images.description')}<br>${i18next.t('main:view.images.simulateColorsNote')}${customThemeWarning}`,
          popoverImage: 'all_images.svg'
        },
        observer: {
          title: i18next.t('main:view.observer.title'),
          content: `${i18next.t('main:meta.parentheses', {
            main: i18next.t('main:view.observer.description'),
            sub: i18next.t('main:view.observer.instruction')
          })}<br>${i18next.t('main:view.observer.simulateColorsNote')}${customThemeWarning}`,
          popoverImage: 'seen_by_observer.svg'
        }
      }
      return configs[mode]
    }
  }
}
</script>