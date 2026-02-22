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
  <div id="sidebar" :class="{ 'sidebar-visible': showSidebar }" :style="{ width: sidebarWidth + 'px' }" :data-width="sidebarWidth">
    <div id="sidebarMobileHeightDiff" class="d-none d-lg-block sidebar-mobile-height-diff"></div>
    <div id="jsonEditorContainer">
      <div class="sidebar-tabs" role="tablist" aria-label="Sidebar tabs">
        <div class="sidebar-tabs-left">
          <button
            type="button"
            class="sidebar-tab"
            :class="{ active: activeTab === 'visual' }"
            role="tab"
            :aria-selected="activeTab === 'visual'"
            @click="setActiveTab('visual')"
          >
            {{ $t('simulator:sidebar.tabs.visual') }}<sup>Alpha</sup>
          </button>
          <button
            type="button"
            class="sidebar-tab"
            :class="{ active: activeTab === 'code' }"
            role="tab"
            :aria-selected="activeTab === 'code'"
            @click="setActiveTab('code')"
          >
            {{ $t('simulator:sidebar.tabs.code') }}
          </button>
          <button
            type="button"
            class="sidebar-tab"
            :class="{ active: activeTab === 'ai' }"
            role="tab"
            :aria-selected="activeTab === 'ai'"
            @click="setActiveTab('ai')"
          >
            {{ $t('simulator:sidebar.tabs.ai') }}
          </button>
        </div>

        <button
          type="button"
          class="sidebar-collapse-btn"
          aria-label="Hide sidebar"
          @click.stop="hideSidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M12 2.8L7.2 8 12 13.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7.2 2.8L2.4 8 7.2 13.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <div class="sidebar-tab-content">
        <VisualTab v-if="showSidebar && activeTab === 'visual'" />
        <div id="jsonEditor" v-show="activeTab === 'code'"></div>
        <AITab v-show="activeTab === 'ai'" />
      </div>
    </div>
    <div 
      class="resize-handle"
      @mousedown="startResize"
      @touchstart="startResize"
    ></div>
  </div>

  <!-- Hidden state hover region -->
  <div
    class="drawer-hover-region"
    :class="{ 'drawer-hover-region-active': !showSidebar }"
  >
    <div class="d-none d-lg-block sidebar-mobile-height-diff"></div>
    <button
      type="button"
      class="drawer-toggle-expand"
      aria-label="Show sidebar"
      @click="expandSidebar"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 2.8L8.8 8 4 13.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8.8 2.8L13.6 8 8.8 13.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</template>

<script>
/**
 * @module Sidebar
 * @description The Vue component for the sidebar containing the JSON editor.
 */
import { usePreferencesStore } from '../store/preferences'
import { toRef, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { jsonEditorService } from '../services/jsonEditor'
import VisualTab from './sidebar/VisualTab.vue'
import AITab from './sidebar/AITab.vue'

export default {
  name: 'Sidebar',
  components: { VisualTab, AITab },
  setup() {
    const preferences = usePreferencesStore()
    const sidebarWidth = toRef(preferences, 'sidebarWidth')
    const showSidebar = toRef(preferences, 'showSidebar')
    const activeTab = toRef(preferences, 'sidebarTab')
    
    const isResizing = ref(false)
    const startX = ref(0)
    const startWidth = ref(0)
    
    // Keyboard event handler to prevent propagation
    const handleKeyboardEvent = (e) => {
      // Stop the event from propagating to the body
      e.stopPropagation()
    }
    
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

    const hideSidebar = () => {
      showSidebar.value = false
    }

    const expandSidebar = () => {
      showSidebar.value = true
      // Helps Ace re-measure if it was off-screen during the transition.
      setTimeout(() => {
        if (jsonEditorService.aceEditor) {
          jsonEditorService.aceEditor.resize()
        }
      }, 350)
    }

    const setActiveTab = (tab) => {
      activeTab.value = tab
    }

    // If we show the code editor after being hidden or after being on another tab,
    // ask Ace to re-measure.
    const resizeAceSoon = async () => {
      await nextTick()
      setTimeout(() => {
        if (jsonEditorService.aceEditor) {
          jsonEditorService.aceEditor.resize()
        }
      }, 0)
    }

    watch(activeTab, (tab) => {
      if (tab === 'code') {
        resizeAceSoon()
      }
    })

    watch(showSidebar, (isShown) => {
      if (isShown && activeTab.value === 'code') {
        // Wait for the drawer slide-in transition as well.
        setTimeout(() => resizeAceSoon(), 320)
      }
    })
    
    onMounted(() => {
      // Add keyboard event listeners to prevent propagation from JSON editor
      const jsonEditor = document.getElementById('jsonEditor')
      
      if (jsonEditor) {
        jsonEditor.addEventListener('keydown', handleKeyboardEvent, false)
        jsonEditor.addEventListener('keyup', handleKeyboardEvent, false)
        jsonEditor.addEventListener('keypress', handleKeyboardEvent, false)
      }
    })
    
    onUnmounted(() => {
      // Clean up event listeners if component is destroyed during resize
      document.removeEventListener('mousemove', handleResize)
      document.removeEventListener('mouseup', stopResize)
      document.removeEventListener('touchmove', handleResize)
      document.removeEventListener('touchend', stopResize)
      
      // Clean up keyboard event listeners
      const jsonEditor = document.getElementById('jsonEditor')
      
      if (jsonEditor) {
        jsonEditor.removeEventListener('keydown', handleKeyboardEvent, false)
        jsonEditor.removeEventListener('keyup', handleKeyboardEvent, false)
        jsonEditor.removeEventListener('keypress', handleKeyboardEvent, false)
      }
    })
    
    return {
      showSidebar,
      sidebarWidth,
      activeTab,
      startResize,
      hideSidebar,
      expandSidebar,
      setActiveTab
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
  transform: translateX(-100%);
  transition: transform 0.3s ease-in-out;
  pointer-events: none;
}

#sidebar.sidebar-visible {
  transform: translateX(0);
  pointer-events: auto;
}

.sidebar-mobile-height-diff {
  height: 22px;
}

#jsonEditorContainer {
  width: 100%;
  flex-grow: 1;
  background-color:rgba(45, 51, 57,0.8);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  position: relative;
  display: flex;
  flex-direction: column;
}

.sidebar-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 6px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.sidebar-tabs-left {
  display: flex;
  gap: 4px;
}

.sidebar-collapse-btn {
  margin-left: auto;
  appearance: none;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.sidebar-collapse-btn:hover {
  background: rgba(60, 65, 70, 0.55);
  color: rgba(255, 255, 255, 0.95);
}

.sidebar-collapse-btn:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.22);
  outline-offset: 2px;
}

.sidebar-collapse-btn svg {
  display: block;
  width: 14px;
  height: 14px;
}

.sidebar-tab {
  appearance: none;
  border: none;
  background: rgba(60, 65, 70, 0.35);
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.sidebar-tab:hover {
  background: rgba(60, 65, 70, 0.55);
  color: rgba(255, 255, 255, 0.9);
}

.sidebar-tab.active {
  background: rgba(90, 95, 100, 0.9);
  color: rgba(255, 255, 255, 0.95);
}

.sidebar-tab:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.22);
  outline-offset: 2px;
}

.sidebar-tab-content {
  flex-grow: 1;
  min-height: 0;
  position: relative;
}

#jsonEditor {
  width: 100%;
  height: 100%
}

.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: ew-resize;
  background-color: transparent;
  transition: background-color 0.2s ease;
}

.resize-handle:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

/* Drawer toggle button on resize handle */
.drawer-toggle {
  position: absolute;
  top: 50%;
  right: -5px;
  transform: translateY(-50%);
  background-color: rgb(80, 84, 88);
  border: none;
  border-radius: 4px;
  width: 14px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: opacity 0.2s ease, background-color 0.2s ease, color 0.2s ease, width 0.2s ease, right 0.2s ease;
  pointer-events: auto;
  opacity: 0;
}

.resize-handle:hover .drawer-toggle,
.drawer-toggle:hover,
.drawer-toggle:focus-visible {
  opacity: 1;
}

.drawer-toggle:hover,
.drawer-toggle:focus-visible {
  background-color: rgb(90, 95, 100);
  color: rgba(255, 255, 255, 0.9);
  width: 16px;
  right: -6px;
}

/* Hidden state hover region */
.drawer-hover-region {
  position: absolute;
  top: 46px;
  left: 0;
  width: 10px;
  height: calc(100% - 46px);
  z-index: 1000;
  opacity: 0;
  pointer-events: none;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding-top: 8px;
}

.drawer-hover-region-active {
  opacity: 1;
  pointer-events: auto;
}

.drawer-toggle-expand {
  position: relative;
  left: 0;
  background-color: rgb(55, 60, 65);
  border: none;
  border-radius: 0 4px 4px 0;
  width: 14px;
  height: 40px;
  margin-top: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.25);
  cursor: pointer;
  transition: opacity 0.2s ease, background-color 0.2s ease, color 0.2s ease, width 0.2s ease;
  opacity: 0;
}

.drawer-toggle-expand svg {
  display: block;
  width: 14px;
  height: 14px;
}

.drawer-hover-region:hover .drawer-toggle-expand,
.drawer-toggle-expand:focus-visible {
  opacity: 1;
  background-color: rgba(60, 65, 70, 0.85);
  color: rgba(255, 255, 255, 0.7);
  width: 18px;
}

.drawer-toggle-expand:hover,
.drawer-toggle-expand:focus-visible {
  background-color: rgba(70, 75, 80, 0.95);
  color: rgba(255, 255, 255, 0.9);
  width: 20px;
}

.drawer-toggle-expand:active {
  background-color: rgba(85, 90, 95, 1);
}
</style>
