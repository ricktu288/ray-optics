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
  <div class="size-picker">
    <!-- Size slider with text input on the right -->
    <div class="slider-container">
      <div class="slider-track" ref="sliderTrack" @mousedown="startDrag" @touchstart="startDrag">
        <!-- Visual thickness indicator -->
        <div class="thickness-indicator">
          <div class="thickness-triangle"></div>
        </div>
        <!-- Slider handle -->
        <div class="slider-handle" :style="{ left: sliderPosition + '%' }" ref="sliderHandle">
          <div class="handle-dot"></div>
        </div>
      </div>
      <!-- Text input on the right -->
      <div class="size-input">
        <TextInput 
          :modelValue="modelValue.toFixed(1) + 'px'" 
          @update:modelValue="updateValue"
          inputClass="size-value"
          :min="min"
          :max="textInputMax"
          :step="step"
          :isNumeric="false"
        />
      </div>
    </div>
  </div>
</template>

<script>
/**
 * @module SizePicker
 * @description A size picker component with visual slider and numeric input.
 * @vue-prop {number} modelValue - The current size value.
 * @vue-prop {number} min - The minimum value (default: 0.1).
 * @vue-prop {number} max - The maximum value for the slider range (default: 10).
 * @vue-prop {number} textInputMax - The maximum value for text input validation (default: null, uses max).
 * @vue-prop {number} step - The step size (default: 0.1).
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import TextInput from './TextInput.vue'

export default {
  name: 'SizePicker',
  components: {
    TextInput
  },
  props: {
    modelValue: {
      type: Number,
      required: true
    },
    min: {
      type: Number,
      default: 0.1
    },
    max: {
      type: Number,
      default: 10
    },
    textInputMax: {
      type: Number,
      default: 100
    },
    step: {
      type: Number,
      default: 0.1
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const isDragging = ref(false)
    const sliderTrack = ref(null)
    const sliderHandle = ref(null)

    // Computed values
    const textInputMax = computed(() => {
      return props.textInputMax !== null ? props.textInputMax : props.max
    })

    const sliderPosition = computed(() => {
      // Clamp the modelValue to slider range for positioning
      const clampedValue = Math.max(props.min, Math.min(props.max, props.modelValue))
      const normalized = (clampedValue - props.min) / (props.max - props.min)
      return Math.max(0, Math.min(100, normalized * 100))
    })

    // Update method for TextInput
    const updateValue = (value) => {
      // Remove "px" suffix if present and parse the number
      const cleanValue = typeof value === 'string' ? value.replace(/px\s*$/i, '').trim() : value
      const rawValue = parseFloat(cleanValue)
      if (!isNaN(rawValue)) {
        let newValue = roundToStep(clampValueForTextInput(rawValue))
        // Round to 2 decimal places for storage (similar to color precision)
        newValue = Math.round(newValue * 100) / 100
        emit('update:modelValue', newValue)
      }
    }

    // Extract coordinates from mouse or touch event
    function getEventCoordinates(event) {
      if (event.touches && event.touches.length > 0) {
        return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY }
      }
      return { clientX: event.clientX, clientY: event.clientY }
    }

    // Clamp value to valid slider range (for slider interaction)
    function clampValue(value) {
      return Math.max(props.min, Math.min(props.max, value))
    }

    // Clamp value to valid text input range (for text input validation)
    function clampValueForTextInput(value) {
      return Math.max(props.min, Math.min(textInputMax.value, value))
    }

    // Round to step
    function roundToStep(value) {
      return Math.round(value / props.step) * props.step
    }

    // Start dragging
    function startDrag(event) {
      isDragging.value = true
      updateFromEvent(event)
      event.preventDefault()
    }

    // Update value from slider event
    function updateFromEvent(event) {
      if (!sliderTrack.value) return
      
      const coords = getEventCoordinates(event)
      const rect = sliderTrack.value.getBoundingClientRect()
      const x = Math.max(0, Math.min(rect.width, coords.clientX - rect.left))
      const normalized = x / rect.width
      const rawValue = props.min + normalized * (props.max - props.min)
      let newValue = roundToStep(clampValue(rawValue))
      // Round to 2 decimal places for storage (similar to color precision)
      newValue = Math.round(newValue * 100) / 100
      
      if (newValue !== props.modelValue) {
        emit('update:modelValue', newValue)
      }
    }

    // Global event handlers
    const handleGlobalMouseMove = (event) => {
      if (isDragging.value) {
        updateFromEvent(event)
      }
    }

    const handleGlobalTouchMove = (event) => {
      if (isDragging.value) {
        event.preventDefault() // Prevent scrolling while dragging
        updateFromEvent(event)
      }
    }

    const handleGlobalMouseUp = () => {
      isDragging.value = false
    }

    const handleGlobalTouchEnd = () => {
      isDragging.value = false
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
      isDragging,
      sliderTrack,
      sliderHandle,
      sliderPosition,
      textInputMax,
      startDrag,
      updateValue
    }
  }
}
</script>

<style scoped>
.size-picker {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 4px 0px;
}

.slider-container {
  position: relative;
  height: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  flex-grow: 1;
}

.size-input {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.size-value {
  width: 60px;
  background-color: transparent;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.5);
  text-align: center;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  padding: 2px 0;
}

.size-value:focus {
  outline: none;
  border-bottom-color: #007bff;
}

.slider-track {
  position: relative;
  width: 160px;
  height: 10px;
  border-radius: 6px;
  cursor: pointer;
}

.thickness-indicator {
  position: absolute;
  inset: 0;
  border-radius: 4px;
  overflow: hidden;
}

.thickness-triangle {
  width: 100%;
  height: 100%;
  background: linear-gradient(to right, 
    transparent 0%, 
    transparent 2px, 
    #000 0px, 
    #555 100%
  );
  clip-path: polygon(0% 50%, 100% 0%, 100% 100%);
}

.slider-handle {
  position: absolute;
  top: -2px;
  width: 4px;
  height: 16px;
  background: white;
  border: 1px solid #333;
  border-radius: 2px;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 1;
}
</style> 