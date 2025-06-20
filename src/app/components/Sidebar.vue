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
  <div id="sidebar" v-show="showJsonEditor" :style="{ width: sidebarWidth + 'px' }" :data-width="sidebarWidth">
    <div id="sidebarMobileHeightDiff" class="d-none d-lg-block"></div>
    <div id="jsonEditorContainer">
      <div id="jsonEditor"></div>
      <div class="json-editor-button">
        <a href="https://chatgpt.com/g/g-6777588b53708191b66722e353e95125-ray-optics-coder" target="_blank" class="btn btn-ai-assistant" v-tooltip-popover:[tooltipType]="{ title: $t('simulator:sidebar.aiAssistant.title'), content: $t('simulator:sidebar.aiAssistant.description'), placement: 'left' }">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-magic" viewBox="0 0 16 16">
            <path d="M9.5 2.672a.5.5 0 1 0 1 0V.843a.5.5 0 0 0-1 0zm4.5.035A.5.5 0 0 0 13.293 2L12 3.293a.5.5 0 1 0 .707.707zM7.293 4A.5.5 0 1 0 8 3.293L6.707 2A.5.5 0 0 0 6 2.707zm-.621 2.5a.5.5 0 1 0 0-1H4.843a.5.5 0 1 0 0 1zm8.485 0a.5.5 0 1 0 0-1h-1.829a.5.5 0 0 0 0 1zM13.293 10A.5.5 0 1 0 14 9.293L12.707 8a.5.5 0 1 0-.707.707zM9.5 11.157a.5.5 0 0 0 1 0V9.328a.5.5 0 0 0-1 0zm1.854-5.097a.5.5 0 0 0 0-.706l-.708-.708a.5.5 0 0 0-.707 0L8.646 5.94a.5.5 0 0 0 0 .707l.708.708a.5.5 0 0 0 .707 0l1.293-1.293Zm-3 3a.5.5 0 0 0 0-.706l-.708-.708a.5.5 0 0 0-.707 0L.646 13.94a.5.5 0 0 0 0 .707l.708.708a.5.5 0 0 0 .707 0z"/>
          </svg>
        </a>
      </div>
    </div>
    <div 
      class="resize-handle"
      @mousedown="startResize"
      @touchstart="startResize"
    ></div>
  </div>
</template>

<script>
/**
 * @module Sidebar
 * @description The Vue component for the sidebar containing the JSON editor.
 */
import { usePreferencesStore } from '../store/preferences'
import { vTooltipPopover } from '../directives/tooltip-popover'
import { computed, toRef, ref, onMounted, onUnmounted } from 'vue'
import { jsonEditorService } from '../services/jsonEditor'

export default {
  name: 'Sidebar',
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  setup() {
    const preferences = usePreferencesStore()
    const help = toRef(preferences, 'help')
    const sidebarWidth = toRef(preferences, 'sidebarWidth')
    const tooltipType = computed(() => help.value ? 'popover' : undefined)
    
    const isResizing = ref(false)
    const startX = ref(0)
    const startWidth = ref(0)
    
    const startResize = (e) => {
      e.preventDefault() // Prevent default touch behavior
      const initialWidth = sidebarWidth.value
      isResizing.value = true
      
      // Handle both mouse and touch events
      const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX
      startX.value = clientX
      startWidth.value = initialWidth
      
      // Add both mouse and touch event listeners
      document.addEventListener('mousemove', handleResize)
      document.addEventListener('mouseup', stopResize)
      document.addEventListener('touchmove', handleResize, { passive: false })
      document.addEventListener('touchend', stopResize)
      
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
    }
    
    const handleResize = (e) => {
      if (!isResizing.value) return
      
      // Prevent default touch behavior
      if (e.type === 'touchmove') {
        e.preventDefault()
      }
      
      // Handle both mouse and touch events
      const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX
      const deltaX = clientX - startX.value
      const newWidth = Math.max(250, Math.min(800, startWidth.value + deltaX))
      
      sidebarWidth.value = newWidth
      
      // Trigger Ace editor resize with a small delay
      setTimeout(() => {
        if (jsonEditorService.aceEditor) {
          jsonEditorService.aceEditor.resize()
        }
      }, 0)
    }
    
    const stopResize = () => {
      isResizing.value = false
      
      // Remove both mouse and touch event listeners
      document.removeEventListener('mousemove', handleResize)
      document.removeEventListener('mouseup', stopResize)
      document.removeEventListener('touchmove', handleResize)
      document.removeEventListener('touchend', stopResize)
      
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    
    onUnmounted(() => {
      // Clean up event listeners if component is destroyed during resize
      document.removeEventListener('mousemove', handleResize)
      document.removeEventListener('mouseup', stopResize)
      document.removeEventListener('touchmove', handleResize)
      document.removeEventListener('touchend', stopResize)
    })
    
    return {
      showJsonEditor: preferences.showJsonEditor,
      sidebarWidth,
      tooltipType,
      startResize
    }
  }
}
</script>

<style scoped>
#sidebar {
  position: absolute;
  z-index: -2;
  top: 46px;
  left: 0;
  max-width: 100%;
  height: calc(100% - 46px);
  display: flex;
  flex-direction: column;
}

#sidebarMobileHeightDiff {
  height: 22px;
}

#jsonEditorContainer {
  width: 100%;
  flex-grow: 1;
  background-color:rgba(45, 51, 57,0.8);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  position: relative;
}

#jsonEditor {
  width: 100%;
  height: 100%
}

.json-editor-button {
  position: absolute;
  right: 15px;
  bottom: 15px;
  z-index: 10;
}

.btn-ai-assistant {
  color: gray;
  padding: 5px;
  background-color: rgba(60, 65, 70, 0.7);
  border-radius: 50%;
  border: none;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.btn-ai-assistant:hover, .btn-ai-assistant:focus {
  background-color: rgba(80, 85, 90, 0.8);
  color: white;
  box-shadow: none;
}

.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: ew-resize;
  background: transparent;
}

.resize-handle:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
