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
  <input 
    type="text" 
    :class="inputClass"
    v-model="inputValue"
    @keydown="handleKeydown"
    @keyup.enter="handleEnter"
    @blur="handleBlur"
    @click="$event.target.select()"
  />
</template>

<script>
/**
 * @module TextInput
 * @description A text input component that properly handles keyboard events without interfering with the scene editor. Supports both string values (like hex colors, dash patterns) and numeric values with validation.
 * @vue-prop {Number|String} modelValue - The current value.
 * @vue-prop {String} [inputClass=''] - CSS class for the input element.

 * @vue-prop {Number} [min=null] - The minimum value (for numeric inputs).
 * @vue-prop {Number} [max=null] - The maximum value (for numeric inputs).
 * @vue-prop {Number} [step=null] - The step size for rounding (for numeric inputs).
 * @vue-prop {Boolean} [isNumeric=true] - Whether to apply numeric validation and constraints.
 */
import { ref, watch } from 'vue'

export default {
  name: 'TextInput',
  props: {
    modelValue: {
      type: [Number, String],
      required: true
    },
    inputClass: {
      type: String,
      default: ''
    },
    min: {
      type: Number,
      default: null
    },
    max: {
      type: Number,
      default: null
    },
    step: {
      type: Number,
      default: null
    },
    isNumeric: {
      type: Boolean,
      default: true
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    // Create a local input value ref
    const inputValue = ref(props.modelValue?.toString() || '')

    // Watch for external changes to modelValue
    watch(() => props.modelValue, (newVal) => {
      inputValue.value = newVal?.toString() || ''
    })

    const validateAndEmit = (value) => {
      // Handle empty input
      if (value === '') {
        emit('update:modelValue', '')
        return
      }

      // For non-numeric inputs (like hex colors, dash patterns), pass through as-is
      if (!props.isNumeric) {
        emit('update:modelValue', value)
        return
      }

      // For numeric inputs, apply validation and constraints
      let numValue = parseFloat(value)

      // Handle invalid numbers
      if (isNaN(numValue)) {
        // For numeric inputs, keep original input for user to correct
        return
      }

      // Apply min/max constraints
      if (props.min !== null && numValue < props.min) {
        numValue = props.min
      }
      if (props.max !== null && numValue > props.max) {
        numValue = props.max
      }

      // Apply step rounding if specified
      if (props.step !== null) {
        numValue = Math.round(numValue / props.step) * props.step
      }

      // Update both local value and emit change
      inputValue.value = numValue.toString()
      emit('update:modelValue', numValue)
    }

    const handleKeydown = (e) => {
      // Prevent keyboard events from bubbling up to the scene editor
      e.stopPropagation()
    }

    const handleEnter = (e) => {
      validateAndEmit(e.target.value)
      e.target.select() // Re-select the text after validation
    }

    const handleBlur = (e) => {
      validateAndEmit(e.target.value)
    }

    return {
      inputValue,
      handleKeydown,
      handleEnter,
      handleBlur
    }
  }
}
</script>

<style scoped>
/* No default styles - use inputClass prop for styling */
</style> 