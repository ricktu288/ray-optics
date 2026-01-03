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
  <div id="simulator_controls" class="simulator-controls" v-show="showSimulatorControls" :style="controlStyle">
    <button class="btn-simulator-controls" id="refresh_scene" :style="unselectedIconStyle" v-tooltip-popover="{ title: $t('simulator:simulatorControls.refreshScene.title') }" @click="handleRefreshScene">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-box-arrow-in-right" viewBox="0 0 18 16">
        <path fill-rule="evenodd" d="M6 3.5a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 0-1 0v2A1.5 1.5 0 0 0 6.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-8A1.5 1.5 0 0 0 5 3.5v2a.5.5 0 0 0 1 0z"/>
        <path fill-rule="evenodd" d="M11.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5H1.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708z"/>
      </svg>
    </button>
    <button class="btn-simulator-controls" id="refresh_simulation" :style="unselectedIconStyle" v-tooltip-popover="{ title: $t('simulator:simulatorControls.refreshSimulation.title') }" @click="handleRefreshSimulation">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-play-fill" viewBox="0 0 16 16">
        <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393"/>
      </svg>
    </button>
    <button class="btn-simulator-controls" :class="{ 'active': isAutoRefreshEnabled }" :style="autoRefreshIconStyle" id="auto_refresh" v-tooltip-popover="{ title: $t('simulator:simulatorControls.autoRefresh.title') }" @click="handleAutoRefresh">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-repeat" viewBox="0 0 16 16">
        <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41m-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9"/>
        <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5 5 0 0 0 8 3M3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9z"/>
      </svg>
    </button>
  </div>
</template>

<script>
/**
 * @module SimulatorControls
 * @description The Vue component for the simulator controls (refresh, auto-refresh toggle, etc.) at the bottom center of the screen.
 */
import { vTooltipPopover } from '../directives/tooltip-popover'
import { useStatusStore } from '../store/status'
import { usePreferencesStore } from '../store/preferences'
import { useThemeStore } from '../store/theme'
import { computed, ref, toRef } from 'vue'
import { app } from '../services/app'
import { jsonEditorService } from '../services/jsonEditor'

export default {
  name: 'SimulatorControls',
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  setup() {
    const statusStore = useStatusStore()
    const preferences = usePreferencesStore()
    const themeStore = useThemeStore()
    const isSimulatorRunning = computed(() => statusStore.isSimulatorRunning)
    const isPlayButtonPaused = ref(false)
    const isAutoRefreshEnabled = ref(true) // Default to true
    const showSimulatorControls = toRef(preferences, 'showSimulatorControls')
    const showSidebar = toRef(preferences, 'showSidebar')
    const sidebarWidth = toRef(preferences, 'sidebarWidth')
    
    // Adjust position when sidebar is shown
    const controlStyle = computed(() => {
      const halfSidebarWidth = showSidebar.value ? sidebarWidth.value / 2 : 0 // Half of the sidebar width since we're translating from center
      return {
        transform: `translateX(calc(-50% + ${halfSidebarWidth}px))`
      }
    })

    // Computed style for unselected button icons that adapts to theme
    const unselectedIconStyle = computed(() => {
      const isLight = themeStore.backgroundIsLight.value
      // Use dark icons for light scenes, light icons for dark scenes
      return {
        color: isLight ? 'rgba(96, 96, 96, 0.6)' : 'rgba(255, 255, 255, 0.6)'
      }
    })

    // Computed style for auto-refresh button - only apply theme color when not active
    const autoRefreshIconStyle = computed(() => {
      if (isAutoRefreshEnabled.value) {
        // When active, let CSS handle the color (white)
        return {}
      } else {
        // When inactive, use theme-based color
        return unselectedIconStyle.value
      }
    })
    
    const handleRefreshScene = (event) => {
      event.target.blur()
      
      if (jsonEditorService.aceEditor && !jsonEditorService.isSynced) {
        // If the user is editing the JSON and has not synced it yet, just sync it.
        jsonEditorService.parse()
      } else if (app.editor) {
        // Otherwise, just reload the scene (useful if the scene contains randomization)
        app.editor.loadJSON(app.editor.lastActionJson)
      }
    }

    const handleRefreshSimulation = (event) => {
      event.target.blur()
      if (jsonEditorService.aceEditor && !jsonEditorService.isSynced) {
        jsonEditorService.parse()
      }
      app.simulator.manualRedrawLightLayer()
    }
    
    const handleAutoRefresh = (event) => {
      event.target.blur()
      
      isAutoRefreshEnabled.value = !isAutoRefreshEnabled.value
      
      app.simulator.manualLightRedraw = !isAutoRefreshEnabled.value
      jsonEditorService.manualParse = !isAutoRefreshEnabled.value
      
      if (isAutoRefreshEnabled.value) {
        if (jsonEditorService.aceEditor && !jsonEditorService.isSynced) {
          jsonEditorService.parse()
        }
        app.simulator.manualRedrawLightLayer()
      }
    }

    return {
      isSimulatorRunning,
      isAutoRefreshEnabled,
      showSimulatorControls,
      controlStyle,
      unselectedIconStyle,
      autoRefreshIconStyle,
      handleRefreshScene,
      handleRefreshSimulation,
      handleAutoRefresh
    }
  }
}
</script>

<style scoped>
.simulator-controls {
  position: fixed;
  bottom: 23px;
  left: 50%;
  /* transform is now applied dynamically via controlStyle */
  z-index: 100;
  background-color: rgba(168, 168, 168, 0.3);
  color: white;
  font-size: 12pt;
  padding: 5px 12px;
  border-radius: 0.5em;
  display: flex;
  gap: 10px;
}

.btn-simulator-controls {
  padding: 5px;
  background-color: rgba(192, 192, 192, 0.2);
  border-radius: 50%;
  border: none;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.btn-simulator-controls:hover {
  background-color: rgba(168, 168, 168, 0.8);
  color: white;
  box-shadow: none;
}

.btn-simulator-controls:focus {
  box-shadow: none;
}

/* Active state for toggle buttons */
.btn-simulator-controls.active {
  background-color: rgba(168, 168, 168, 0.7);
  color: rgba(255, 255, 255, 1);
}

.btn-simulator-controls.active:hover {
  background-color: rgba(168, 168, 168, 1.0);
  color: white;
}

/* Ensure all button SVGs have appropriate styling */
.simulator-controls button svg {
  background-color: transparent;
  border-radius: 50%;
}
</style>
