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
  <div class="footer-left" id="footer-left" :style="notificationStyle">
    <div id="forceStop" v-show="simulatorStatus?.isSimulatorRunning" @click="handleForceStop" :style="forceStopStyle">
      <div class="spinner-border text-secondary" role="status"></div>
      <span v-html="$t('simulator:footer.processing')"></span>
    </div>
    <div id="status" v-show="showStatus" :style="statusStyle">
      <div v-html="formattedMousePosition"></div>
      <div v-html="formattedSimulatorStatus.join('<br>')"></div>
    </div>
    <div id="warning" v-show="warnings.length > 0">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-triangle-fill" viewBox="0 0 16 20">
        <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>
      </svg>
      <span v-html="warnings.join('<br>')"></span>
    </div>
    <div id="error" v-show="errors.length > 0">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-circle-fill" viewBox="0 0 16 20">
        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4m.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2"/>
      </svg>
      <span v-html="errors.join('<br>')"></span>
    </div>
    <VirtualKeyboard />
  </div>
</template>

<script>
/**
 * @module StatusArea
 * @description The Vue component for the status area (including mouse coordinates, simulator status, warnings and errors) at the lower left corner.
 */
import { usePreferencesStore } from '../store/preferences'
import { useThemeStore } from '../store/theme'
import { useStatus } from '../composables/useStatus'
import { computed, toRef } from 'vue'
import { app } from '../services/app'
import VirtualKeyboard from './VirtualKeyboard.vue'

export default {
  name: 'StatusArea',
  components: {
    VirtualKeyboard
  },
  setup() {
    const preferences = usePreferencesStore()
    const themeStore = useThemeStore()
    const status = useStatus()
    const showJsonEditor = toRef(preferences, 'showJsonEditor')
    const sidebarWidth = toRef(preferences, 'sidebarWidth')
    
    const notificationStyle = computed(() => ({
      left: showJsonEditor.value ? `${sidebarWidth.value}px` : '0px'
    }))

    // Computed styles that adapt to theme - status overlay uses scene background color
    const statusStyle = computed(() => {
      const isLight = themeStore.backgroundIsLight.value
      const bgColor = themeStore.getThemeObject('background')?.color || { r: 1, g: 1, b: 1 }
      
      // Use actual scene background color with transparency
      const backgroundColor = `rgba(${Math.round(bgColor.r * 255)}, ${Math.round(bgColor.g * 255)}, ${Math.round(bgColor.b * 255)}, 0.8)`
      
      return {
        color: isLight ? '#333333' : 'gray',
        backgroundColor: backgroundColor
      }
    })

    const forceStopStyle = computed(() => {
      const isLight = themeStore.backgroundIsLight.value
      // Force stop button should be visible in both themes
      return {
        color: isLight ? '#666666' : 'gray'
      }
    })

    const handleForceStop = () => {
      app.simulator.stopSimulation()
    }

    return {
      showStatus: preferences.showStatus,
      notificationStyle,
      statusStyle,
      forceStopStyle,
      // From status composable
      formattedMousePosition: status.formattedMousePosition,
      formattedSimulatorStatus: status.formattedSimulatorStatus,
      errors: status.activeErrors,
      warnings: status.activeWarnings,
      simulatorStatus: status.simulatorStatus,
      // Methods
      handleForceStop
    }
  }
}
</script>

<style scoped>
.footer-left {
  position: absolute;
  bottom: 0;
  z-index: -2;
  padding-right: 80px;
  pointer-events: none;
}

#forceStop {
  cursor: pointer;
  pointer-events: auto;
}

#forceStop .spinner-border {
  width: 1rem;
  height: 1rem;
}

#status {
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border-top-right-radius: 0.5em;
  width: fit-content;
  pointer-events: auto;
}

#warning {
  color: black;
  font-family: monospace;
  padding-right: 0.5em;
  background-color:rgb(255,255,0,0.8);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border-top-right-radius: 0.5em;
  pointer-events: auto;
}

#error {
  color: white;
  font-family: monospace;
  padding-right: 0.5em;
  background-color:rgba(255,0,0,0.7);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border-top-right-radius: 0.5em;
  pointer-events: auto;
}

</style>
