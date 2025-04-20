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
  <ToggleControl
    :label="$t('simulator:settings.showRayArrows.title')"
    v-model="showRayArrows"
    :layout="layout"
  />

  <ToggleControl
    :label="$t('simulator:settings.correctBrightness.title')"
    :popoverContent="$t('simulator:settings.correctBrightness.description')"
    v-model="correctBrightness"
    :layout="layout"
    :verticalOffset="25"
  />

  <ToggleControl
    :label="$t('main:simulateColors.title')"
    :popoverContent="$t('main:simulateColors.description') + '<br>' + $t('main:simulateColors.instruction') + '<br>' + $t('main:simulateColors.warning')"
    v-model="simulateColors"
    :layout="layout"
    :verticalOffset="50"
  />

  <PopupSelectControl
    :label="$t('simulator:settings.colorMode.title')"
    :value="colorMode"
    :display-fn="value => value === 'default' ? $t('simulator:common.defaultOption') : $t(`simulator:colorModeModal.${value}.title`)"
    :disabled="colorMode === 'default'"
    popup-target="colorModeModal"
    :popover-content="$t('simulator:settings.colorMode.description')"
    :layout="layout"
  />

  <NumberControl
    :label="$t('simulator:settings.gridSize.title')"
    :popover-content="$t('simulator:sceneObjs.common.lengthUnitInfo')"
    v-model="gridSize"
    :min="1"
    :default-value="20"
    :layout="layout"
  />

  <NumberControl
    :label="$t('simulator:settings.observerSize.title')"
    v-model="observerSize"
    :min="1"
    :default-value="40"
    :layout="layout"
    :popover-content="$t('simulator:sceneObjs.common.lengthUnitInfo')"
  />

  <NumberControl
    :label="$t('simulator:settings.lengthScale.title')"
    :popover-content="$t('simulator:settings.lengthScale.description')"
    v-model="lengthScale"
    :min="0.1"
    :max="10"
    :default-value="1"
    :layout="layout"
  />

  <ZoomControl
    :label="$t('simulator:settings.zoom.title')"
    v-model="zoom"
    :layout="layout"
  />

  <hr class="dropdown-divider">

  <PopupSelectControl
    :label="$t('simulator:settings.language.title')"
    :value="lang"
    :display-fn="value => localeData[value]?.name || value"
    popup-target="languageModal"
    :layout="layout"
  />

  <SettingsWarning
    v-show="showLanguageWarning"
    :layout="layout"
  >
    <span v-html="warningText"></span>
  </SettingsWarning>
              
  <ToggleControl
    :label="$t('simulator:settings.autoSyncUrl.title')"
    :popoverContent="$t('simulator:settings.autoSyncUrl.description')"
    v-model="autoSyncUrl"
    :layout="layout"
  />

  <ToggleControl
    :label="$t('simulator:settings.showJsonEditor.title')"
    :popoverContent="$t('simulator:settings.showJsonEditor.description')"
    v-model="showJsonEditor"
    :layout="layout"
  />

  <ToggleControl
    :label="$t('simulator:settings.showStatusBox.title')"
    :popoverContent="$t('simulator:settings.showStatusBox.description')"
    v-model="showStatus"
    :layout="layout"
  />

  <ToggleControl
    v-if="layout === 'desktop'"
    id="show_help_popups"
    :label="$t('simulator:settings.showHelpPopups.title')"
    :popoverContent="$t('simulator:settings.showHelpPopups.description')"
    v-model="help"
    :layout="layout"
  />

  <div v-if="layout === 'desktop'" class="advanced-help" v-html="$t('simulator:settings.advancedHelp')"></div>

</template>

<script>
/**
 * @module SettingsList
 * @description The Vue component for the list of settings in the SettingsBar component.
 * @vue-prop {String} layout - The layout of the toolbar. Can be 'mobile' or 'desktop'.
 */
import { vTooltipPopover } from '../../directives/tooltip-popover'
import { useSceneStore } from '../../store/scene'
import { usePreferencesStore } from '../../store/preferences'
import ToggleControl from './controls/ToggleControl.vue'
import NumberControl from './controls/NumberControl.vue'
import ZoomControl from './controls/ZoomControl.vue'
import PopupSelectControl from './controls/PopupSelectControl.vue'
import RayDensityBar from './RayDensityBar.vue'
import LayoutAidsBar from './LayoutAidsBar.vue'
import SettingsWarning from './controls/SettingsWarning.vue'
import { computed, toRef, ref } from 'vue'
import i18next from 'i18next'
import { parseLinks } from '../../utils/links.js'
import { app } from '../../services/app.js'

export default {
  name: 'SettingsList',
  components: {
    NumberControl,
    ToggleControl,
    ZoomControl,
    PopupSelectControl,
    RayDensityBar,
    SettingsWarning,
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
    const lang = ref(window.lang)
    const localeData = ref(window.localeData)
    
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
        app.editor.selectObj(app.editor.selectedObjIndex)
      }
    })

    const showLanguageWarning = computed(() => {
      const TRANSLATION_THRESHOLD = 70
      const completeness = Math.round(localeData.value[lang.value].numStrings / localeData.value.en.numStrings * 100)
      return completeness < TRANSLATION_THRESHOLD
    })

    const warningText = computed(() => {
      const completeness = Math.round(localeData.value[lang.value].numStrings / localeData.value.en.numStrings * 100)
      return parseLinks(i18next.t('simulator:settings.language.lowFraction', { fraction: completeness + '%' }))
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
      lang,
      localeData,
      showLanguageWarning,
      warningText,
    }
  }
}
</script>

<style scoped>
.advanced-help {
  font-size: 9pt;
}
</style>