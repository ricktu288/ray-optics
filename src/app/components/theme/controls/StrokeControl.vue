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
        <div class="stroke-trigger" data-bs-toggle="dropdown" aria-expanded="false" :style="strokePreviewStyle">
          <!-- When no color control, show RGB lines -->
          <div v-if="!hasColorControl" class="stroke-rgb-lines">
            <div class="stroke-line-vertical" :style="redLineStyle"></div>
            <div class="stroke-line-vertical" :style="greenLineStyle"></div>
            <div class="stroke-line-vertical" :style="blueLineStyle"></div>
          </div>
          <!-- When has color control, show single colored line -->
          <div v-else class="stroke-line" :style="strokeLineStyle"></div>
        </div>
        <div class="dropdown-menu">
          <div class="dropdown-item-text">
          <ColorPicker 
            v-if="hasColorControl"
            :modelValue="strokeOptions.color" 
            :fillOptions="strokeOptions"
            @update:modelValue="updateColor"
          />
          <SizePicker 
            v-if="hasWidthControl"
            :modelValue="strokeOptions.width"
            :min="0.1"
            :max="10"
            :textInputMax="100"
            :step="0.1"
            @update:modelValue="updateWidth"
          />
          <DashPicker 
            v-if="strokeOptions.dash !== undefined"
            :modelValue="strokeOptions.dash" 
            @update:modelValue="updateDash"
          />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * @module StrokeControl
 * @description A stroke control component with color and width picker.
 * @vue-prop {string} label - The label for the stroke control.
 * @vue-prop {Object} strokeOptions - The stroke options containing color and width.
 */
import { computed } from 'vue'
import ColorPicker from './ColorPicker.vue'
import SizePicker from './SizePicker.vue'
import DashPicker from './DashPicker.vue'
import { useThemeStore } from '../../../store/theme'

export default {
  name: 'StrokeControl',
  components: {
    ColorPicker,
    SizePicker,
    DashPicker
  },
  props: {
    label: {
      type: String,
      required: true
    },
    strokeOptions: {
      type: Object,
      required: true,
      validator: (value) => {
        return value && 
               (value.width === undefined || typeof value.width === 'number') &&
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

    // Effective width - use provided width or default to 1
    const effectiveWidth = computed(() => {
      return props.strokeOptions.width !== undefined ? props.strokeOptions.width : 1
    })

    // Check if width control should be shown
    const hasWidthControl = computed(() => {
      return props.strokeOptions.width !== undefined
    })

    // Check if color control should be shown
    const hasColorControl = computed(() => {
      return props.strokeOptions.color !== undefined
    })

    // Convert RGB object (0.0-1.0) to hex color
    const rgbToHex = (rgb) => {
      if (!rgb || typeof rgb !== 'object') return '#000000'
      const r = Math.round(Math.max(0, Math.min(1, rgb.r)) * 255)
      const g = Math.round(Math.max(0, Math.min(1, rgb.g)) * 255)
      const b = Math.round(Math.max(0, Math.min(1, rgb.b)) * 255)
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }

    // Convert RGB to hex for display
    const strokeColorHex = computed(() => {
      return rgbToHex(props.strokeOptions.color)
    })

    // Background style for stroke preview - matches FillControl logic
    const strokePreviewStyle = computed(() => {
      // Get background color from theme store for proper alpha blending
      const backgroundOptions = themeStore.getThemeObject('background')
      const backgroundColor = backgroundOptions && backgroundOptions.color ? backgroundOptions.color : { r: 1, g: 1, b: 1 }
      return { backgroundColor: rgbToHex(backgroundColor) }
    })

    // Individual RGB line styles for wavelength-dependent colors (no color property)
    const lineHeight = computed(() => {
      return effectiveWidth.value + 'px'
    })

    const redLineStyle = computed(() => {
      const style = {
        height: lineHeight.value,
        backgroundColor: '#ff0000'
      }
      
      // Add dash pattern if present
      if (props.strokeOptions.dash && props.strokeOptions.dash.length > 0) {
        const gradientStops = []
        let currentPos = 0
        
        for (let i = 0; i < props.strokeOptions.dash.length; i++) {
          const segmentLength = props.strokeOptions.dash[i]
          const isDash = i % 2 === 0 // Even indices are dashes, odd are gaps
          const color = isDash ? '#ff0000' : 'transparent'
          
          gradientStops.push(`${color} ${currentPos}px`)
          currentPos += segmentLength
          gradientStops.push(`${color} ${currentPos}px`)
        }
        
        style.background = `repeating-linear-gradient(to right, ${gradientStops.join(', ')})`
      }
      
      return style
    })

    const greenLineStyle = computed(() => {
      const style = {
        height: lineHeight.value,
        backgroundColor: '#00ff00'
      }
      
      // Add dash pattern if present
      if (props.strokeOptions.dash && props.strokeOptions.dash.length > 0) {
        const gradientStops = []
        let currentPos = 0
        
        for (let i = 0; i < props.strokeOptions.dash.length; i++) {
          const segmentLength = props.strokeOptions.dash[i]
          const isDash = i % 2 === 0 // Even indices are dashes, odd are gaps
          const color = isDash ? '#00ff00' : 'transparent'
          
          gradientStops.push(`${color} ${currentPos}px`)
          currentPos += segmentLength
          gradientStops.push(`${color} ${currentPos}px`)
        }
        
        style.background = `repeating-linear-gradient(to right, ${gradientStops.join(', ')})`
      }
      
      return style
    })

    const blueLineStyle = computed(() => {
      const style = {
        height: lineHeight.value,
        backgroundColor: '#0000ff'
      }
      
      // Add dash pattern if present
      if (props.strokeOptions.dash && props.strokeOptions.dash.length > 0) {
        const gradientStops = []
        let currentPos = 0
        
        for (let i = 0; i < props.strokeOptions.dash.length; i++) {
          const segmentLength = props.strokeOptions.dash[i]
          const isDash = i % 2 === 0 // Even indices are dashes, odd are gaps
          const color = isDash ? '#0000ff' : 'transparent'
          
          gradientStops.push(`${color} ${currentPos}px`)
          currentPos += segmentLength
          gradientStops.push(`${color} ${currentPos}px`)
        }
        
        style.background = `repeating-linear-gradient(to right, ${gradientStops.join(', ')})`
      }
      
      return style
    })

    // Stroke line style with proper alpha blending (when color property exists)
    const strokeLineStyle = computed(() => {
      const strokeColor = props.strokeOptions.color
      
      // This should only be called when hasColorControl is true
      if (!strokeColor) {
        return {}
      }

      // Get background color for compositing
      const backgroundOptions = themeStore.getThemeObject('background')
      const backgroundColor = backgroundOptions && backgroundOptions.color ? backgroundOptions.color : { r: 1, g: 1, b: 1 }
      const backgroundHex = rgbToHex(backgroundColor)

      // Check if alpha channel is present
      const hasAlpha = typeof strokeColor.a === 'number'
      
      let finalColor
      if (!hasAlpha) {
        // No alpha channel - use solid stroke color
        finalColor = rgbToHex(strokeColor)
      } else {
        // With alpha channel, composite over background color
        const alpha = strokeColor.a
        const blendedColor = {
          r: alpha * strokeColor.r + (1 - alpha) * backgroundColor.r,
          g: alpha * strokeColor.g + (1 - alpha) * backgroundColor.g,
          b: alpha * strokeColor.b + (1 - alpha) * backgroundColor.b
        }
        finalColor = rgbToHex(blendedColor)
      }

      const style = {
        height: effectiveWidth.value + 'px',
        backgroundColor: finalColor
      }
      
      // Add dash pattern if present
      if (props.strokeOptions.dash && props.strokeOptions.dash.length > 0) {
        // Create multi-segment dashed pattern
        const gradientStops = []
        let currentPos = 0
        
        for (let i = 0; i < props.strokeOptions.dash.length; i++) {
          const segmentLength = props.strokeOptions.dash[i]
          const isDash = i % 2 === 0 // Even indices are dashes, odd are gaps
          const color = isDash ? finalColor : 'transparent'
          
          gradientStops.push(`${color} ${currentPos}px`)
          currentPos += segmentLength
          gradientStops.push(`${color} ${currentPos}px`)
        }
        
        style.background = `repeating-linear-gradient(to right, ${gradientStops.join(', ')})`
      }
      
      return style
    })



    // Update color
    const updateColor = (newColor) => {
      const updatedStroke = {
        ...props.strokeOptions,
        color: newColor
      }
      emit('update', updatedStroke)
    }

    // Update width
    const updateWidth = (newWidth) => {
      // Round to 2 decimal places for storage (similar to color precision)
      const roundedWidth = Math.round(newWidth * 100) / 100
      const updatedStroke = {
        ...props.strokeOptions,
        width: roundedWidth
      }
      emit('update', updatedStroke)
    }

    // Update dash pattern
    const updateDash = (newDash) => {
      const updatedStroke = {
        ...props.strokeOptions,
        dash: newDash
      }
      emit('update', updatedStroke)
    }

    return {
      effectiveWidth,
      hasWidthControl,
      hasColorControl,
      strokePreviewStyle,
      strokeLineStyle,
      redLineStyle,
      greenLineStyle,
      blueLineStyle,
      updateColor,
      updateWidth,
      updateDash
    }
  }
}
</script>

<style scoped>
.dropdown {
  display: flex;
  justify-content: flex-end;
}

.stroke-trigger {
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

.stroke-trigger:hover {
  border-color: #999;
}

.stroke-line {
  width: 24px;
  border-radius: 1px;
}

.stroke-rgb-lines {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 3px;
}

.stroke-line-vertical {
  width: 24px;
  border-radius: 1px;
  flex-shrink: 0;
}

.dropdown-item-text {
  padding: 0px 12px;
}
</style> 