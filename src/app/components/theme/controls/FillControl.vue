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
        <div class="color-trigger" data-bs-toggle="dropdown" aria-expanded="false" :style="backgroundStyle">
          <div class="fill-preview" :style="previewStyle"></div>
        </div>
        <div class="dropdown-menu">
          <div class="dropdown-item-text">
            <ColorPicker 
              v-model="currentColor"
              :fillOptions="fillOptions"
              @update:modelValue="handleColorChange"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * @module FillControl
 * @description A theme control component for selecting fill options (color, texture, etc.).
 * @vue-prop {String} label - The label text for the control.
 * @vue-prop {Object} fillOptions - The fill options object containing color.
 */
import { computed } from 'vue'
import ColorPicker from './ColorPicker.vue'
import { useThemeStore } from '../../../store/theme'

export default {
  name: 'FillControl',
  components: {
    ColorPicker
  },
  props: {
    label: {
      type: String,
      required: true
    },
    fillOptions: {
      type: Object,
      required: true
    }
  },
  emits: ['update'],
  setup(props, { emit }) {
    const themeStore = useThemeStore()

    const currentColor = computed({
      get: () => props.fillOptions?.color || { r: 0, g: 0, b: 0 },
      set: (value) => {
        // This setter is used by v-model but we handle updates through the event
      }
    })

    const hexColor = computed(() => {
      return rgbToHex(props.fillOptions.color)
    })

    const backgroundStyle = computed(() => {
      // Always show the background color for the container
      const backgroundOptions = themeStore.getThemeObject('background')
      const backgroundColor = backgroundOptions && backgroundOptions.color ? backgroundOptions.color : { r: 1, g: 1, b: 1 }
      return { backgroundColor: rgbToHex(backgroundColor) }
    })

    const previewStyle = computed(() => {
      const fillColor = props.fillOptions?.color
      if (!fillColor) return { backgroundColor: '#000000' }

      // Get background color for compositing
      const backgroundOptions = themeStore.getThemeObject('background')
      const backgroundColor = backgroundOptions && backgroundOptions.color ? backgroundOptions.color : { r: 1, g: 1, b: 1 }
      const backgroundHex = rgbToHex(backgroundColor)

      // Check if alpha channel is present
      const hasAlpha = typeof fillColor.a === 'number'
      
      if (!hasAlpha) {
        // No alpha channel - show alpha gradient from 0 to 1 over background
        const fillColorHex = rgbToHex(fillColor)
        return {
          background: `linear-gradient(to right, ${backgroundHex} 0%, ${fillColorHex} 100%)`
        }
      }

      // With alpha channel, composite over background color
      const alpha = fillColor.a
      const blendedColor = {
        r: alpha * fillColor.r + (1 - alpha) * backgroundColor.r,
        g: alpha * fillColor.g + (1 - alpha) * backgroundColor.g,
        b: alpha * fillColor.b + (1 - alpha) * backgroundColor.b
      }

      return { backgroundColor: rgbToHex(blendedColor) }
    })

    // Convert RGB object (0.0-1.0) to hex color
    const rgbToHex = (rgb) => {
      if (!rgb || typeof rgb !== 'object') return '#000000'
      const r = Math.round(Math.max(0, Math.min(1, rgb.r)) * 255)
      const g = Math.round(Math.max(0, Math.min(1, rgb.g)) * 255)
      const b = Math.round(Math.max(0, Math.min(1, rgb.b)) * 255)
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }

    const handleColorChange = (newColor) => {
      const updatedFillOptions = {
        ...props.fillOptions,
        color: newColor
      }
      emit('update', updatedFillOptions)
    }

    return {
      currentColor,
      hexColor,
      backgroundStyle,
      previewStyle,
      handleColorChange
    }
  }
}
</script>

<style scoped>
.dropdown {
  display: flex;
  justify-content: flex-end;
}

.color-trigger {
  width: 40px;
  height: 24px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-trigger:hover {
  border-color: #999;
}

.fill-preview {
  width: 32px;
  height: 16px;
  border-radius: 2px;
}

.dropdown-item-text {
  padding: 0px 12px;
}
</style> 