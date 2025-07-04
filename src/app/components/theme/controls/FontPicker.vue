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
  <div class="font-picker">
    <!-- Preset buttons (left side - visual selection) -->
    <div class="preset-buttons">
      <button 
        type="button"
        class="preset-button"
        :class="{ active: isCurrentFont(customOrSansFont) }"
        @click="applyPreset(customOrSansFont)"
      >
        <div class="font-preview" :style="customFontStyle">1.23</div>
      </button>
      <button 
        type="button"
        class="preset-button"
        :class="{ active: isCurrentFont('serif') }"
        @click="applyPreset('serif')"
      >
        <div class="font-preview" style="font-family: serif;">1.23</div>
      </button>
      <button 
        type="button"
        class="preset-button"
        :class="{ active: isCurrentFont('monospace') }"
        @click="applyPreset('monospace')"
      >
        <div class="font-preview" style="font-family: monospace;">1.23</div>
      </button>
    </div>

    <!-- Text input (right side) -->
    <div class="font-input">
      <TextInput 
        :modelValue="modelValue" 
        @update:modelValue="updateFont"
        inputClass="font-value"
        :isNumeric="false"
      />
    </div>
  </div>
</template>

<script>
/**
 * @module FontPicker
 * @description A font family picker component with text input and preset buttons.
 * @vue-prop {String} modelValue - The current font family name.
 */
import { computed } from 'vue'
import TextInput from './TextInput.vue'

export default {
  name: 'FontPicker',
  components: {
    TextInput
  },
  props: {
    modelValue: {
      type: String,
      required: true
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    // Update method for TextInput
    const updateFont = (value) => {
      emit('update:modelValue', value || 'sans-serif')
    }

    // Standard preset fonts
    const PRESETS = {
      SANS_SERIF: 'sans-serif',
      SERIF: 'serif',
      MONOSPACE: 'monospace'
    }

    // Check if current font matches a specific font
    const isCurrentFont = (font) => {
      return props.modelValue === font
    }

    // Determine what the first button should show
    const customOrSansFont = computed(() => {
      // If current font is not serif or monospace, use current font
      if (!isCurrentFont(PRESETS.SERIF) && !isCurrentFont(PRESETS.MONOSPACE)) {
        return props.modelValue
      }
      // Otherwise default to sans-serif
      return PRESETS.SANS_SERIF
    })

    // Style for the first button font preview
    const customFontStyle = computed(() => {
      return {
        fontFamily: customOrSansFont.value
      }
    })

    // Apply a preset font
    const applyPreset = (font) => {
      emit('update:modelValue', font)
    }

    return {
      isCurrentFont,
      customOrSansFont,
      customFontStyle,
      applyPreset,
      updateFont
    }
  }
}
</script>

<style scoped>
.font-picker {
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

.font-input {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.font-value {
  width: 60px;
  background-color: transparent;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.5);
  text-align: center;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  padding: 2px 0;
}

.font-value:focus {
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

.font-preview {
  font-size: 11px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
</style> 