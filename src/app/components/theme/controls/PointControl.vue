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
        <div class="point-trigger" data-bs-toggle="dropdown" aria-expanded="false" :style="pointPreviewStyle">
          <!-- When no color control, show RGB dots -->
          <div v-if="!hasColorControl" class="point-dots">
            <div class="point-dot" :style="redDotStyle"></div>
            <div class="point-dot" :style="greenDotStyle"></div>
            <div class="point-dot" :style="blueDotStyle"></div>
          </div>
          <!-- When has color control, show single colored shape -->
          <div v-else-if="pointType === 'triangle'" class="triangle-preview" :style="triangleStyle"></div>
          <div v-else-if="pointType === 'circle'" class="circle-preview" :style="circleStyle"></div>
          <div v-else-if="pointType === 'concentric'" class="concentric-preview">
            <div class="concentric-inner" :style="concentricInnerStyle"></div>
            <div class="concentric-outer" :style="concentricOuterStyle"></div>
          </div>
          <div v-else class="square-preview" :style="squareStyle"></div>
        </div>
        <div class="dropdown-menu">
          <div class="dropdown-item-text">
            <ColorPicker
              v-if="hasColorControl"
              :modelValue="pointOptions.color" 
              :fillOptions="pointOptions"
              @update:modelValue="updateColor"
            />
            <SizePicker
              v-if="hasSizeControl"
              :modelValue="pointOptions.size"
              :min="0.1"
              :max="10"
              :textInputMax="100"
              :step="0.1"
              @update:modelValue="updateSize"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * @module PointControl
 * @description A point control component with color and size picker.
 * @vue-prop {string} label - The label for the point control.
 * @vue-prop {Object} pointOptions - The point options containing color and size.
 * @vue-prop {string} pointType - The type of point to show in preview window ('square', 'triangle', 'circle', 'concentric').
 */
import { computed } from 'vue'
import ColorPicker from './ColorPicker.vue'
import SizePicker from './SizePicker.vue'
import { useThemeStore } from '../../../store/theme'

export default {
  name: 'PointControl',
  components: {
    ColorPicker,
    SizePicker
  },
  props: {
    label: {
      type: String,
      required: true
    },
    pointOptions: {
      type: Object,
      required: true,
      validator: (value) => {
        return value && 
               (value.size === undefined || typeof value.size === 'number') &&
               (value.color === undefined || (
                 value.color &&
                 typeof value.color.r === 'number' && 
                 typeof value.color.g === 'number' && 
                 typeof value.color.b === 'number'
               ))
      }
    },
    pointType: {
      type: String,
      default: 'square',
      validator: value => ['square', 'triangle', 'circle', 'concentric'].includes(value)
    }
  },
  emits: ['update'],
  setup(props, { emit }) {
    const themeStore = useThemeStore()

    // Default sizes for different point types
    const getDefaultSize = () => {
      switch (props.pointType) {
        case 'circle':
          return 18 // Default size for filled circles - almost as large as preview window (40x24)
        case 'concentric':
          return 5 // Default outer radius for concentric circles (matching Handle class with ls=1)
        default:
          return 1 // Default for square/triangle
      }
    }

    // Effective size - use provided size or default based on point type
    const effectiveSize = computed(() => {
      return props.pointOptions.size !== undefined ? props.pointOptions.size : getDefaultSize()
    })

    // Check if size control should be shown
    const hasSizeControl = computed(() => {
      return props.pointOptions.size !== undefined
    })

    // Check if color control should be shown
    const hasColorControl = computed(() => {
      return props.pointOptions.color !== undefined
    })

    // Convert RGB object (0.0-1.0) to hex color
    const rgbToHex = (rgb) => {
      if (!rgb || typeof rgb !== 'object') return '#000000'
      const r = Math.round(Math.max(0, Math.min(1, rgb.r)) * 255)
      const g = Math.round(Math.max(0, Math.min(1, rgb.g)) * 255)
      const b = Math.round(Math.max(0, Math.min(1, rgb.b)) * 255)
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    }

    // Background style for point preview
    const pointPreviewStyle = computed(() => {
      // Get background color from theme store for proper alpha blending
      const backgroundOptions = themeStore.getThemeObject('background')
      const backgroundColor = backgroundOptions && backgroundOptions.color ? backgroundOptions.color : { r: 1, g: 1, b: 1 }
      return { backgroundColor: rgbToHex(backgroundColor) }
    })

    // Individual dot styles for wavelength-dependent colors (no color property)
    const dotSize = computed(() => {
      return effectiveSize.value + 'px'
    })

    const redDotStyle = computed(() => ({
      width: dotSize.value,
      height: dotSize.value,
      backgroundColor: '#ff0000'
    }))

    const greenDotStyle = computed(() => ({
      width: dotSize.value,
      height: dotSize.value,
      backgroundColor: '#00ff00'
    }))

    const blueDotStyle = computed(() => ({
      width: dotSize.value,
      height: dotSize.value,
      backgroundColor: '#0000ff'
    }))

    // Get final color with alpha blending
    const getFinalColor = () => {
      const pointColor = props.pointOptions.color
      
      // If no color is defined, return default black
      if (!pointColor) {
        return '#000000'
      }

      // Get background color for compositing
      const backgroundOptions = themeStore.getThemeObject('background')
      const backgroundColor = backgroundOptions && backgroundOptions.color ? backgroundOptions.color : { r: 1, g: 1, b: 1 }

      // Check if alpha channel is present
      const hasAlpha = typeof pointColor.a === 'number'
      
      if (!hasAlpha) {
        // No alpha channel - use solid point color
        return rgbToHex(pointColor)
      } else {
        // With alpha channel, composite over background color
        const alpha = pointColor.a
        const blendedColor = {
          r: alpha * pointColor.r + (1 - alpha) * backgroundColor.r,
          g: alpha * pointColor.g + (1 - alpha) * backgroundColor.g,
          b: alpha * pointColor.b + (1 - alpha) * backgroundColor.b
        }
        return rgbToHex(blendedColor)
      }
    }

    // Point square style with proper alpha blending (when color property exists)
    const squareStyle = computed(() => {
      const squareSize = effectiveSize.value + 'px'
      const finalColor = getFinalColor()

      return {
        width: squareSize,
        height: squareSize,
        backgroundColor: finalColor
      }
    })

    // Point circle style for filled circles
    const circleStyle = computed(() => {
      const circleSize = effectiveSize.value + 'px'
      const finalColor = getFinalColor()

      return {
        width: circleSize,
        height: circleSize,
        backgroundColor: finalColor,
        borderRadius: '50%'
      }
    })

    // Point triangle style for arrow types (equilateral triangle with side length as size)
    const triangleStyle = computed(() => {
      const sideLength = effectiveSize.value
      const finalColor = getFinalColor()

      // Calculate triangle dimensions
      // For equilateral triangle: height = side * sqrt(3) / 2
      const triangleHeight = sideLength * Math.sqrt(3) / 2

      return {
        width: sideLength + 'px',
        height: triangleHeight + 'px',
        borderLeft: (sideLength / 2) + 'px solid transparent',
        borderRight: (sideLength / 2) + 'px solid transparent',
        borderBottom: triangleHeight + 'px solid ' + finalColor
      }
    })

    // Concentric circles styles (like Handle class)
    const concentricInnerStyle = computed(() => {
      const finalColor = getFinalColor()
      // Handle class draws inner circle with radius = 2*ls, outer with radius = 5*ls
      // So inner radius = (2/5) * outer radius = 0.4 * effectiveSize
      const innerRadius = effectiveSize.value * (2/5)
      const innerDiameter = (innerRadius * 2) + 'px'

      return {
        width: innerDiameter,
        height: innerDiameter,
        border: '1px solid ' + finalColor,
        borderRadius: '50%',
        backgroundColor: 'transparent',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }
    })

    const concentricOuterStyle = computed(() => {
      const finalColor = getFinalColor()
      // effectiveSize represents the outer radius (5*ls in Handle class)
      const outerRadius = effectiveSize.value
      const outerDiameter = (outerRadius * 2) + 'px'

      return {
        width: outerDiameter,
        height: outerDiameter,
        border: '1px solid ' + finalColor,
        borderRadius: '50%',
        backgroundColor: 'transparent',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }
    })

    // Update color
    const updateColor = (newColor) => {
      const updatedPoint = {
        ...props.pointOptions,
        color: newColor
      }
      emit('update', updatedPoint)
    }

    // Update size
    const updateSize = (newSize) => {
      // Round to 2 decimal places for storage (similar to color precision)
      const roundedSize = Math.round(newSize * 100) / 100
      const updatedPoint = {
        ...props.pointOptions,
        size: roundedSize
      }
      emit('update', updatedPoint)
    }

    return {
      effectiveSize,
      hasSizeControl,
      hasColorControl,
      pointPreviewStyle,
      squareStyle,
      circleStyle,
      triangleStyle,
      concentricInnerStyle,
      concentricOuterStyle,
      redDotStyle,
      greenDotStyle,
      blueDotStyle,
      updateColor,
      updateSize
    }
  }
}
</script>

<style scoped>
.dropdown {
  display: flex;
  justify-content: flex-end;
}

.point-trigger {
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

.point-trigger:hover {
  border-color: #999;
}

.point-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.point-dot {
  flex-shrink: 0;
  /* Exact square shape - no rounding */
}

.square-preview {
  flex-shrink: 0;
  /* Exact square shape */
}

.circle-preview {
  flex-shrink: 0;
  /* Circular shape */
}

.triangle-preview {
  width: 0;
  height: 0;
  flex-shrink: 0;
  /* Triangle created with borders */
}

.concentric-preview {
  position: relative;
  width: 100%;
  height: 100%;
  flex-shrink: 0;
}

.concentric-inner,
.concentric-outer {
  box-sizing: border-box;
}

.dropdown-item-text {
  padding: 0px 12px;
}
</style> 