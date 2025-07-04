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
  <div class="row d-flex justify-content-between align-items-center">
    <div class="col-auto settings-label" v-html="label"></div>
    <div class="col-auto d-flex align-items-center">
      <div class="dropdown">
        <div class="text-trigger" data-bs-toggle="dropdown" aria-expanded="false" :style="textPreviewStyle">
          <div class="text-preview" :style="textContentStyle">1.23</div>
        </div>
        <div class="dropdown-menu">
          <div class="dropdown-item-text">
          <ColorPicker 
            v-if="hasColorControl"
            :modelValue="textOptions.color" 
            :fillOptions="textOptions"
            @update:modelValue="updateColor"
          />
          <SizePicker 
            v-if="hasSizeControl"
            :modelValue="textOptions.size"
            :min="0.1"
            :max="20"
            :textInputMax="100"
            :step="0.1"
            @update:modelValue="updateSize"
          />
          <div v-if="hasFontControl" class="font-control">
            <FontPicker 
              :modelValue="textOptions.font || 'sans-serif'" 
              @update:modelValue="updateFont"
            />
          </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * @module TextControl
 * @description A text control component with color, size, and font picker.
 * @vue-prop {string} label - The label for the text control.
 * @vue-prop {Object} textOptions - The text options containing color, size, and font.
 */
import { computed } from 'vue'
import ColorPicker from './ColorPicker.vue'
import SizePicker from './SizePicker.vue'
import TextInput from './TextInput.vue'
import FontPicker from './FontPicker.vue'
import { useThemeStore } from '../../../store/theme'

export default {
  name: 'TextControl',
  components: {
    ColorPicker,
    SizePicker,
    TextInput,
    FontPicker
  },
  props: {
    label: {
      type: String,
      required: true
    },
    textOptions: {
      type: Object,
      required: true,
      validator: (value) => {
        return value && 
               (value.size === undefined || typeof value.size === 'number') &&
               (value.font === undefined || typeof value.font === 'string') &&
               (value.color === undefined || (
                 value.color &&
                 typeof value.color.r === 'number' && 
                 typeof value.color.g === 'number' && 
                 typeof value.color.b === 'number'
               ))
      }
    }
  },
  emits: ['update'],
  setup(props, { emit }) {
    const themeStore = useThemeStore()

    // Effective size - use provided size or default to 12
    const effectiveSize = computed(() => {
      return props.textOptions.size !== undefined ? props.textOptions.size : 12
    })

    // Check if size control should be shown
    const hasSizeControl = computed(() => {
      return props.textOptions.size !== undefined
    })

    // Check if color control should be shown
    const hasColorControl = computed(() => {
      return props.textOptions.color !== undefined
    })

    // Check if font control should be shown
    const hasFontControl = computed(() => {
      return props.textOptions.font !== undefined
    })

    // Convert RGB object (0.0-1.0) to hex color
    const rgbToHex = (rgb) => {
      if (!rgb || typeof rgb !== 'object') return '#000000'
      const r = Math.round(Math.max(0, Math.min(1, rgb.r)) * 255)
      const g = Math.round(Math.max(0, Math.min(1, rgb.g)) * 255)
      const b = Math.round(Math.max(0, Math.min(1, rgb.b)) * 255)
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }

    // Background style for text preview
    const textPreviewStyle = computed(() => {
      // Get background color from theme store for proper alpha blending
      const backgroundOptions = themeStore.getThemeObject('background')
      const backgroundColor = backgroundOptions && backgroundOptions.color ? backgroundOptions.color : { r: 1, g: 1, b: 1 }
      return { backgroundColor: rgbToHex(backgroundColor) }
    })

    // Text content style with proper alpha blending
    const textContentStyle = computed(() => {
      const textColor = props.textOptions.color
      const fontFamily = props.textOptions.font || 'sans-serif'
      
      if (!textColor) {
        // No color property - use gray
        return {
          fontSize: effectiveSize.value + 'px',
          fontFamily: fontFamily,
          color: '#808080'
        }
      }

      // Get background color for compositing
      const backgroundOptions = themeStore.getThemeObject('background')
      const backgroundColor = backgroundOptions && backgroundOptions.color ? backgroundOptions.color : { r: 1, g: 1, b: 1 }

      // Check if alpha channel is present
      const hasAlpha = typeof textColor.a === 'number'
      
      let finalColor
      if (!hasAlpha) {
        // No alpha channel - use solid text color
        finalColor = rgbToHex(textColor)
      } else {
        // With alpha channel, composite over background color
        const alpha = textColor.a
        const blendedColor = {
          r: alpha * textColor.r + (1 - alpha) * backgroundColor.r,
          g: alpha * textColor.g + (1 - alpha) * backgroundColor.g,
          b: alpha * textColor.b + (1 - alpha) * backgroundColor.b
        }
        finalColor = rgbToHex(blendedColor)
      }

      return {
        fontSize: effectiveSize.value + 'px',
        fontFamily: fontFamily,
        color: finalColor
      }
    })



    // Update color
    const updateColor = (newColor) => {
      const updatedText = {
        ...props.textOptions,
        color: newColor
      }
      emit('update', updatedText)
    }

    // Update size
    const updateSize = (newSize) => {
      // Round to 2 decimal places for storage (similar to color precision)
      const roundedSize = Math.round(newSize * 100) / 100
      const updatedText = {
        ...props.textOptions,
        size: roundedSize
      }
      emit('update', updatedText)
    }

    // Update font
    const updateFont = (newFont) => {
      const updatedText = {
        ...props.textOptions,
        font: newFont || 'sans-serif'
      }
      emit('update', updatedText)
    }

    return {
      effectiveSize,
      hasSizeControl,
      hasColorControl,
      hasFontControl,
      textPreviewStyle,
      textContentStyle,
      updateColor,
      updateSize,
      updateFont
    }
  }
}
</script>

<style scoped>
.dropdown {
  display: flex;
  justify-content: flex-end;
}

.text-trigger {
  width: 40px;
  height: 24px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.text-trigger:hover {
  border-color: #999;
}

.text-preview {
  white-space: nowrap;
  user-select: none;
  pointer-events: none;
}

.dropdown-item-text {
  padding: 0px 12px;
}
</style> 