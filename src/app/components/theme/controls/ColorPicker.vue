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
  <div class="color-picker">
    <div class="picker-container">
      <!-- HSV Picker Area (left side - visual selection) -->
      <div class="hsv-picker">
        <!-- Hue bar -->
        <div class="hue-bar" @mousedown="startHueDrag" @touchstart="startHueDrag" ref="hueBarRef">
          <div class="hue-slider" :style="{ left: huePosition + '%' }"></div>
        </div>

        <!-- Saturation-Value picker -->
        <div 
          class="sv-picker" 
          :style="{ backgroundColor: hueColor }"
          @mousedown="startSVDrag" 
          @touchstart="startSVDrag"
          ref="svPickerRef"
        >
          <div class="sv-slider" :style="{ left: saturationPosition + '%', top: valuePosition + '%' }"></div>
        </div>

        <!-- Alpha bar (conditional) -->
        <div v-if="hasAlpha" class="alpha-bar" @mousedown="startAlphaDrag" @touchstart="startAlphaDrag" ref="alphaBarRef" :style="{ '--current-color': currentColor }">
          <div class="alpha-slider" :style="{ left: alphaPosition + '%' }"></div>
        </div>
      </div>

      <!-- Text inputs (right side) -->
      <div class="input-controls">
        <!-- Hex input at top -->
        <div class="hex-input-row">
          <TextInput 
            :modelValue="hexColor" 
            @update:modelValue="updateHex"
            inputClass="color-input hex-input"
            :isNumeric="false"
          />
        </div>

        <!-- RGB(A) inputs at bottom -->
        <div class="rgb-inputs">
          <div class="rgb-row">
            <span class="rgb-label">R</span>
            <TextInput 
              :modelValue="rgbColor.r.toFixed(2)" 
              @update:modelValue="updateRed"
              inputClass="color-input rgb-input"
              :min="0"
              :max="1"
              :step="0.01"
            />
          </div>

          <div class="rgb-row">
            <span class="rgb-label">G</span>
            <TextInput 
              :modelValue="rgbColor.g.toFixed(2)" 
              @update:modelValue="updateGreen"
              inputClass="color-input rgb-input"
              :min="0"
              :max="1"
              :step="0.01"
            />
          </div>

          <div class="rgb-row">
            <span class="rgb-label">B</span>
            <TextInput 
              :modelValue="rgbColor.b.toFixed(2)" 
              @update:modelValue="updateBlue"
              inputClass="color-input rgb-input"
              :min="0"
              :max="1"
              :step="0.01"
            />
          </div>

          <div v-if="hasAlpha" class="rgb-row">
            <span class="rgb-label">A</span>
            <TextInput 
              :modelValue="rgbColor.a.toFixed(2)" 
              @update:modelValue="updateAlpha"
              inputClass="color-input rgb-input"
              :min="0"
              :max="1"
              :step="0.01"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * @module ColorPicker
 * @description A continuous color picker component for floating point RGB values with HSV interface.
 * @vue-prop {Object} modelValue - The current RGB color object with r, g, b values (0.0-1.0).
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import TextInput from './TextInput.vue'

export default {
  name: 'ColorPicker',
  components: {
    TextInput
  },
  props: {
    modelValue: {
      type: Object,
      required: true,
      validator: (value) => {
        return value && typeof value.r === 'number' && typeof value.g === 'number' && typeof value.b === 'number'
      }
    },
    fillOptions: {
      type: Object,
      required: true
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const isDraggingHue = ref(false)
    const isDraggingSV = ref(false)
    const isDraggingAlpha = ref(false)
    const hueBarRef = ref(null)
    const svPickerRef = ref(null)
    const alphaBarRef = ref(null)
    
    // Flag to prevent feedback loop when we emit changes
    const isInternalUpdate = ref(false)

    // Check if alpha channel is supported
    const hasAlpha = computed(() => props.fillOptions && props.fillOptions.color && typeof props.fillOptions.color.a === 'number')

    // Use HSV as primary reactive state, with alpha preserved
    const hsvColor = ref(rgbToHsv(props.modelValue))
    const alphaValue = ref(props.modelValue.a || 1.0)

    // Watch for external RGB changes and update HSV
    watch(() => props.modelValue, (newRgb) => {
      // Avoid feedback loop - don't update HSV if this change came from us
      if (isInternalUpdate.value) {
        isInternalUpdate.value = false
        return
      }
      
      const newHsv = rgbToHsv(newRgb)
      // Preserve hue when saturation or value is 0 to avoid jumping to red
      if (newHsv.s === 0 || newHsv.v === 0) {
        hsvColor.value = { ...hsvColor.value, s: newHsv.s, v: newHsv.v }
      } else {
        hsvColor.value = newHsv
      }
      // Update alpha if present
      if (hasAlpha.value && typeof newRgb.a === 'number') {
        alphaValue.value = newRgb.a
      }
    })

    // Full precision RGB for internal calculations
    const rgbColor = computed(() => {
      const rgb = hsvToRgb(hsvColor.value)
      if (hasAlpha.value) {
        rgb.a = alphaValue.value
      }
      return rgb
    })

    // Truncated RGB for display in text inputs
    const displayRgbColor = computed(() => truncateRgb(rgbColor.value))

    const hexColor = computed(() => rgbToHex(displayRgbColor.value))

    const hueColor = computed(() => rgbToHex(hsvToRgb({ h: hsvColor.value.h, s: 1, v: 1 })))

    // Get the current color without alpha for the alpha slider background
    const currentColor = computed(() => {
      const rgb = hsvToRgb(hsvColor.value)
      return rgbToHex(rgb)
    })

    const huePosition = computed(() => hsvColor.value.h * 100)
    const saturationPosition = computed(() => hsvColor.value.s * 100)
    const valuePosition = computed(() => (1 - hsvColor.value.v) * 100)
    const alphaPosition = computed(() => alphaValue.value * 100)

    // Helper function to emit RGB with truncation while avoiding feedback
    function emitRgbUpdate() {
      isInternalUpdate.value = true
      const truncatedRgb = truncateRgb(rgbColor.value)
      emit('update:modelValue', truncatedRgb)
    }

    // Update methods for TextInput components
    const updateRed = (value) => {
      const newRgb = { ...displayRgbColor.value, r: clamp(value) }
      updateFromRgb(newRgb)
    }

    const updateGreen = (value) => {
      const newRgb = { ...displayRgbColor.value, g: clamp(value) }
      updateFromRgb(newRgb)
    }

    const updateBlue = (value) => {
      const newRgb = { ...displayRgbColor.value, b: clamp(value) }
      updateFromRgb(newRgb)
    }

    const updateAlpha = (value) => {
      alphaValue.value = clamp(value)
      emitRgbUpdate()
    }

    const updateHex = (value) => {
      const newRgb = hexToRgb(value)
      updateFromRgb(newRgb)
    }

    // Convert RGB (0.0-1.0) to HSV
    function rgbToHsv(rgb) {
      const { r, g, b } = rgb
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const diff = max - min

      let h = 0
      const s = max === 0 ? 0 : diff / max
      const v = max

      if (diff !== 0) {
        switch (max) {
          case r: h = ((g - b) / diff + (g < b ? 6 : 0)) / 6; break
          case g: h = ((b - r) / diff + 2) / 6; break
          case b: h = ((r - g) / diff + 4) / 6; break
        }
      }

      return { h: h, s: s, v: v }
    }

    // Convert HSV to RGB (0.0-1.0)
    function hsvToRgb(hsv) {
      const { h, s, v } = hsv
      const c = v * s
      const x = c * (1 - Math.abs(((h * 6) % 2) - 1))
      const m = v - c

      let r = 0, g = 0, b = 0

      if (h >= 0 && h < 1/6) { r = c; g = x; b = 0 }
      else if (h >= 1/6 && h < 2/6) { r = x; g = c; b = 0 }
      else if (h >= 2/6 && h < 3/6) { r = 0; g = c; b = x }
      else if (h >= 3/6 && h < 4/6) { r = 0; g = x; b = c }
      else if (h >= 4/6 && h < 5/6) { r = x; g = 0; b = c }
      else if (h >= 5/6 && h < 1) { r = c; g = 0; b = x }

      return {
        r: r + m,
        g: g + m,
        b: b + m
      }
    }

    // Convert RGB (0.0-1.0) to hex color
    function rgbToHex(rgb) {
      if (!rgb || typeof rgb !== 'object') return hasAlpha.value ? '#000000FF' : '#000000'
      const r = Math.round(Math.max(0, Math.min(1, rgb.r)) * 255)
      const g = Math.round(Math.max(0, Math.min(1, rgb.g)) * 255)
      const b = Math.round(Math.max(0, Math.min(1, rgb.b)) * 255)
      let hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
      
      // Add alpha channel if present
      if (hasAlpha.value && typeof rgb.a === 'number') {
        const a = Math.round(Math.max(0, Math.min(1, rgb.a)) * 255)
        hex += a.toString(16).padStart(2, '0')
      }
      
      return hex
    }

    // Convert hex color to RGB (0.0-1.0)
    function hexToRgb(hex) {
      // Try 8-character hex first (with alpha)
      let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      if (result) {
        const rgb = {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255
        }
        // Include alpha if supported
        if (hasAlpha.value) {
          rgb.a = parseInt(result[4], 16) / 255
        }
        return rgb
      }
      
      // Try 6-character hex (without alpha)
      result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      if (result) {
        const rgb = {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255
        }
        // Add default alpha if supported
        if (hasAlpha.value) {
          rgb.a = 1.0
        }
        return rgb
      }
      
      // Default fallback
      const fallback = { r: 0, g: 0, b: 0 }
      if (hasAlpha.value) {
        fallback.a = 1.0
      }
      return fallback
    }

    // Clamp value to 0.0-1.0 range
    function clamp(value) {
      return Math.max(0, Math.min(1, parseFloat(value) || 0))
    }

    // Truncate RGB values to 3 decimal places
    function truncateRgb(rgb) {
      const result = {
        r: Math.round(rgb.r * 1000) / 1000,
        g: Math.round(rgb.g * 1000) / 1000,
        b: Math.round(rgb.b * 1000) / 1000
      }
      if (typeof rgb.a === 'number') {
        result.a = Math.round(rgb.a * 1000) / 1000
      }
      return result
    }

    // Extract coordinates from mouse or touch event
    function getEventCoordinates(event) {
      if (event.touches && event.touches.length > 0) {
        return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY }
      }
      return { clientX: event.clientX, clientY: event.clientY }
    }

    // Hue bar drag handlers
    function startHueDrag(event) {
      isDraggingHue.value = true
      updateHueFromEvent(event)
      event.preventDefault()
    }

    function updateHueFromEvent(event) {
      if (!hueBarRef.value) return
      
      const coords = getEventCoordinates(event)
      const rect = hueBarRef.value.getBoundingClientRect()
      const x = Math.max(0, Math.min(rect.width, coords.clientX - rect.left))
      const hue = Math.min(x / rect.width, 0.999999)
      
      // Update HSV directly without truncation
      hsvColor.value = { ...hsvColor.value, h: hue }
      // Emit truncated RGB for parent
      emitRgbUpdate()
    }

    // Saturation-Value picker drag handlers
    function startSVDrag(event) {
      isDraggingSV.value = true
      updateSVFromEvent(event)
      event.preventDefault()
    }

    function updateSVFromEvent(event) {
      if (!svPickerRef.value) return
      
      const coords = getEventCoordinates(event)
      const rect = svPickerRef.value.getBoundingClientRect()
      const x = Math.max(0, Math.min(rect.width, coords.clientX - rect.left))
      const y = Math.max(0, Math.min(rect.height, coords.clientY - rect.top))
      
      const saturation = x / rect.width
      const value = 1 - (y / rect.height)
      
      // Update HSV directly without truncation
      hsvColor.value = { ...hsvColor.value, s: saturation, v: value }
      // Emit truncated RGB for parent
      emitRgbUpdate()
    }

    // Alpha bar drag handlers
    function startAlphaDrag(event) {
      isDraggingAlpha.value = true
      updateAlphaFromEvent(event)
      event.preventDefault()
    }

    function updateAlphaFromEvent(event) {
      if (!alphaBarRef.value) return
      
      const coords = getEventCoordinates(event)
      const rect = alphaBarRef.value.getBoundingClientRect()
      const x = Math.max(0, Math.min(rect.width, coords.clientX - rect.left))
      const alpha = x / rect.width
      
      // Update alpha directly without truncation
      alphaValue.value = alpha
      // Emit truncated RGB for parent
      emitRgbUpdate()
    }

    // Helper function to update HSV from RGB while preserving hue when possible
    function updateFromRgb(newRgb) {
      const newHsv = rgbToHsv(newRgb)
      // Preserve hue when saturation or value is 0 to avoid jumping to red
      if (newHsv.s === 0 || newHsv.v === 0) {
        hsvColor.value = { ...hsvColor.value, s: newHsv.s, v: newHsv.v }
      } else {
        hsvColor.value = newHsv
      }
      // Update alpha if present
      if (hasAlpha.value && typeof newRgb.a === 'number') {
        alphaValue.value = newRgb.a
      }
      emitRgbUpdate()
    }

    // Global mouse and touch event handlers for dragging
    const handleGlobalMouseMove = (event) => {
      if (isDraggingHue.value) {
        updateHueFromEvent(event)
      }
      if (isDraggingSV.value) {
        updateSVFromEvent(event)
      }
      if (isDraggingAlpha.value) {
        updateAlphaFromEvent(event)
      }
    }

    const handleGlobalTouchMove = (event) => {
      if (isDraggingHue.value || isDraggingSV.value || isDraggingAlpha.value) {
        event.preventDefault() // Prevent scrolling while dragging
      }
      if (isDraggingHue.value) {
        updateHueFromEvent(event)
      }
      if (isDraggingSV.value) {
        updateSVFromEvent(event)
      }
      if (isDraggingAlpha.value) {
        updateAlphaFromEvent(event)
      }
    }

    const handleGlobalMouseUp = () => {
      isDraggingHue.value = false
      isDraggingSV.value = false
      isDraggingAlpha.value = false
    }

    const handleGlobalTouchEnd = () => {
      isDraggingHue.value = false
      isDraggingSV.value = false
      isDraggingAlpha.value = false
    }

    onMounted(() => {
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false })
      document.addEventListener('touchend', handleGlobalTouchEnd)
    })

    onUnmounted(() => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
      document.removeEventListener('touchmove', handleGlobalTouchMove)
      document.removeEventListener('touchend', handleGlobalTouchEnd)
    })

    return {
      rgbColor: displayRgbColor, // Use truncated RGB for display
      hexColor,
      hueColor,
      currentColor,
      huePosition,
      saturationPosition,
      valuePosition,
      alphaPosition,
      hasAlpha,
      hueBarRef,
      svPickerRef,
      alphaBarRef,
      startHueDrag,
      startSVDrag,
      startAlphaDrag,
      updateRed,
      updateGreen,
      updateBlue,
      updateAlpha,
      updateHex
    }
  }
}
</script>

<style scoped>

.color-picker {
  padding: 4px 0px;
}

.picker-container {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.hsv-picker {
  flex: 1;
  min-width: 160px;
}

.hue-bar {
  position: relative;
  height: 12px;
  width: 160px;
  margin-bottom: 8px;
  background: linear-gradient(to right, 
    #ff0000 0%, 
    #ffff00 16.66%, 
    #00ff00 33.33%, 
    #00ffff 50%, 
    #0000ff 66.66%, 
    #ff00ff 83.33%, 
    #ff0000 100%
  );
  border-radius: 6px;
  cursor: pointer;
}

.hue-slider {
  position: absolute;
  top: -2px;
  width: 4px;
  height: 16px;
  background: white;
  border: 1px solid #333;
  border-radius: 2px;
  transform: translateX(-50%);
  pointer-events: none;
}

.alpha-bar {
  position: relative;
  height: 12px;
  width: 160px;
  margin-top: 8px;
  background: 
    linear-gradient(to right, transparent 0%, var(--current-color, #000) 100%),
    repeating-linear-gradient(45deg, #ccc 0, #ccc 4px, #fff 4px, #fff 8px);
  border-radius: 6px;
  cursor: pointer;
}

.alpha-slider {
  position: absolute;
  top: -2px;
  width: 4px;
  height: 16px;
  background: white;
  border: 1px solid #333;
  border-radius: 2px;
  transform: translateX(-50%);
  pointer-events: none;
}

.sv-picker {
  position: relative;
  width: 160px;
  height: 90px;
  background: 
    linear-gradient(to bottom, transparent, black),
    linear-gradient(to right, white, transparent);
  border-radius: 4px;
  cursor: crosshair;
}

.sv-slider {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 2px solid white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.7);
}

.input-controls {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 60px;
  width: 60px;
  height: 100%;
}

.hex-input-row {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  width: 100%;
  margin-bottom: 8px;
}

.rgb-inputs {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: auto;
}

.rgb-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
}

.rgb-label {
  font-size: 12px;
  color: #333;
  width: 12px;
  flex-shrink: 0;
  text-align: left;
}

.color-input {
  background-color: transparent;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.5);
  text-align: center;
  font-size: 11px;
  padding: 2px 0;
  flex-shrink: 0;
}

.color-input:focus {
  outline: none;
  border-bottom-color: #007bff;
}

.rgb-input {
  font-variant-numeric: tabular-nums;
  width: 45px;
}

.hex-input {
  width: 60px;
  font-family: monospace;
}
</style> 