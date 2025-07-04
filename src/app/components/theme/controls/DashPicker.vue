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
  <div class="dash-picker">
    <!-- Preset buttons (left side - visual selection) -->
    <div class="preset-buttons">
      <button 
        type="button"
        class="preset-button"
        :class="{ active: isCurrentPattern([]) }"
        @click="applyPreset([])"
      >
        <div class="dash-preview solid"></div>
      </button>
      <button 
        type="button"
        class="preset-button"
        :class="{ active: isCurrentPattern([2, 2]) }"
        @click="applyPreset([2, 2])"
      >
        <div class="dash-preview dashed"></div>
      </button>
      <button 
        type="button"
        class="preset-button"
        :class="{ active: isCurrentPattern(customOrDottedPattern) }"
        @click="applyPreset(customOrDottedPattern)"
      >
        <div class="dash-preview" :style="customDashStyle"></div>
      </button>
    </div>

    <!-- Text input (right side) -->
    <div class="dash-input">
      <TextInput 
        :modelValue="displayValue" 
        @update:modelValue="updatePattern"
        inputClass="dash-value"
        :isNumeric="false"
      />
    </div>
  </div>
</template>

<script>
/**
 * @module DashPicker
 * @description A dash pattern picker component with text input and preset buttons.
 * @vue-prop {Array<number>} modelValue - The current dash pattern array.
 */
import { computed, ref } from 'vue'
import TextInput from './TextInput.vue'

export default {
  name: 'DashPicker',
  components: {
    TextInput
  },
  props: {
    modelValue: {
      type: Array,
      required: true,
      validator: (value) => {
        return Array.isArray(value) && value.every(item => typeof item === 'number' && item >= 0)
      }
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    // Update method for TextInput
    const updatePattern = (value) => {
      const pattern = parseDashPattern(value)
      if (pattern !== null) {
        emit('update:modelValue', pattern)
      }
    }

    // Standard preset patterns
    const PRESETS = {
      SOLID: [],
      DASHED: [2, 2],
      DOTTED: [1, 2]
    }

    // Display value - show dash pattern as comma-separated string, "-" for empty
    const displayValue = computed(() => {
      if (props.modelValue.length === 0) {
        return '-'
      }
      return props.modelValue.join(',')
    })

    // Check if current pattern matches a specific pattern
    const isCurrentPattern = (pattern) => {
      if (props.modelValue.length !== pattern.length) return false
      return props.modelValue.every((value, index) => value === pattern[index])
    }

    // Determine what the third button should show
    const customOrDottedPattern = computed(() => {
      // If current pattern is not solid or dashed, use current pattern
      if (!isCurrentPattern(PRESETS.SOLID) && !isCurrentPattern(PRESETS.DASHED)) {
        return props.modelValue
      }
      // Otherwise default to dotted
      return PRESETS.DOTTED
    })

    // Visual style for the third button dash preview
    const customDashStyle = computed(() => {
      const pattern = customOrDottedPattern.value
      if (pattern.length === 0) {
        // Solid line
        return { background: '#333' }
      }
      
      // Create multi-segment dashed pattern
      const gradientStops = []
      let currentPos = 0
      
      for (let i = 0; i < pattern.length; i++) {
        const segmentLength = Math.max(i % 2 === 0 ? 1 : 0.5, pattern[i] || 1) // Minimum lengths for visibility
        const isDash = i % 2 === 0 // Even indices are dashes, odd are gaps
        const color = isDash ? '#333' : 'transparent'
        
        gradientStops.push(`${color} ${currentPos}px`)
        currentPos += segmentLength
        gradientStops.push(`${color} ${currentPos}px`)
      }
      
      const totalLength = currentPos
      
      return {
        background: `repeating-linear-gradient(to right, ${gradientStops.join(', ')})`
      }
    })

    // Apply a preset pattern
    const applyPreset = (pattern) => {
      emit('update:modelValue', [...pattern])
    }

    // Parse dash pattern from string input
    const parseDashPattern = (input) => {
      const trimmed = input.trim()
      
      // Handle empty string or "-" as solid line
      if (trimmed === '' || trimmed === '-') {
        return []
      }

      // Split by comma and parse numbers
      const parts = trimmed.split(',').map(part => part.trim()).filter(part => part !== '')
      const numbers = []
      
      for (const part of parts) {
        const num = parseFloat(part)
        if (isNaN(num) || num < 0) {
          return null // Invalid input
        }
        numbers.push(num)
      }

      return numbers
    }



    return {
      displayValue,
      isCurrentPattern,
      customOrDottedPattern,
      customDashStyle,
      applyPreset,
      updatePattern
    }
  }
}
</script>

<style scoped>
.dash-picker {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 4px 0px;
  justify-content: space-between;
}

.preset-buttons {
  display: flex;
  width: 160px;
  gap: 6px;
  flex-shrink: 0;
}

.dash-input {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.dash-value {
  width: 60px;
  background-color: transparent;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.5);
  text-align: center;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  padding: 2px 0;
}

.dash-value:focus {
  outline: none;
  border-bottom-color: #007bff;
}

.preset-button {
  width: 33%;
  height: 24px;
  padding: 4px;
  border: 1px solid rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preset-button:hover {
  border-color: rgba(0, 0, 0, 0.5);
  background: #f8f9fa;
}

.preset-button.active {
  border-color: #007bff;
  background: #e7f3ff;
}

.preset-button:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.dash-preview {
  width: 80%;
  height: 2px;
  background: #333;
}

.dash-preview.solid {
  background: #333;
}

.dash-preview.dashed {
  background: repeating-linear-gradient(to right, #333 0px, #333 3px, transparent 3px, transparent 6px);
}
</style> 