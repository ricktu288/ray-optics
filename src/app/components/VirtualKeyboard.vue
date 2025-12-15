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
  <div class="virtual-keyboard" v-show="isVisible">
    <button 
      class="virtual-key" 
      :class="{ active: ctrlActive }"
      type="button"
      @click="ctrlActive = !ctrlActive"
    >Ctrl</button>
    <button 
      class="virtual-key" 
      :class="{ active: shiftActive }"
      type="button"
      @click="shiftActive = !shiftActive"
    >Shift</button>
  </div>
</template>

<script>
/**
 * @module VirtualKeyboard
 * @description The Vue component for virtual Ctrl and Shift keys for touchscreen use.
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { statusEmitter, STATUS_EVENT_NAMES } from '../composables/useStatus'
import { app } from '../services/app'

export default {
  name: 'VirtualKeyboard',
  setup() {
    const ctrlActive = ref(false)
    const shiftActive = ref(false)
    
    // Check if mobile layout is shown (Bootstrap lg breakpoint is 992px)
    const isMobileLayout = () => window.matchMedia('(max-width: 991.98px)').matches
    const lastDeviceIsTouch = ref(isMobileLayout())
    
    // Delayed visibility based on device (with 500ms delay when switching to non-touch)
    const shouldShowForDevice = ref(isMobileLayout())
    let hideTimeout = null
    
    // Show if device says so OR any key is active
    const isVisible = computed(() => shouldShowForDevice.value || ctrlActive.value || shiftActive.value)

    // Update editor's lastDeviceIsTouch if available
    onMounted(() => {
      if (isMobileLayout() && app.editor) {
        app.editor._lastDeviceIsTouch = true
      }
    })
    
    // Cleanup timeout on unmount
    onUnmounted(() => {
      if (hideTimeout) {
        clearTimeout(hideTimeout)
      }
    })

    statusEmitter.on(STATUS_EVENT_NAMES.DEVICE_CHANGE, (e) => {
      lastDeviceIsTouch.value = e.lastDeviceIsTouch
      
      if (e.lastDeviceIsTouch) {
        // Switching to touch - show immediately
        if (hideTimeout) {
          clearTimeout(hideTimeout)
          hideTimeout = null
        }
        shouldShowForDevice.value = true
      } else {
        // Switching to non-touch - hide after 500ms
        if (hideTimeout) {
          clearTimeout(hideTimeout)
        }
        hideTimeout = setTimeout(() => {
          shouldShowForDevice.value = false
          hideTimeout = null
        }, 500)
      }
    })

    statusEmitter.on(STATUS_EVENT_NAMES.RESET_VIRTUAL_KEYS, () => {
      ctrlActive.value = false
      shiftActive.value = false
    })

    // Sync virtual key states with the editor
    watch(ctrlActive, (newValue) => {
      if (app.editor) {
        app.editor.virtualCtrlKey = newValue
      }
    })

    watch(shiftActive, (newValue) => {
      if (app.editor) {
        app.editor.virtualShiftKey = newValue
      }
    })

    return {
      ctrlActive,
      shiftActive,
      isVisible
    }
  }
}
</script>

<style scoped>
.virtual-keyboard {
  display: flex;
  gap: 7px;
  padding: 4px;
  pointer-events: auto;
}

.virtual-key {
  color: gray;
  background-color: transparent;
  border: 1px solid gray;
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
  line-height: 1;
}

.virtual-key:focus {
  outline: none;
  box-shadow: none;
}

.virtual-key.active {
  color: white;
  background-color: gray;
}

.virtual-key.active:hover {
  background-color: gray;
}
</style>

