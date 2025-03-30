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
  <div 
    class="row d-flex justify-content-between align-items-center"
    v-tooltip-popover:[tooltipType]="layout === 'desktop' && popoverContent ? { 
      content: popoverContent,
      html: true,
      placement: 'left',
      offset: [verticalOffset, 20]
    } : undefined"
  >
    <div class="col-auto settings-label" v-html="label"></div>
    <div class="col-auto d-flex align-items-center">
      <div class="flex-grow-1 d-flex align-items-center">
        <input 
          type="text" 
          class="settings-number" 
          v-model="inputValue"
          @keyup.enter="handleEnter"
          @keydown="handleKeydown"
          @blur="handleBlur"
          @click="$event.target.select()"
        >
      </div>
    </div>
  </div>
</template>

<script>
/**
 * @module NumberControl
 * @description The vue component for a number control in the setting dropdown.
 * @vue-prop {String} label - The label for the number control.
 * @vue-prop {Number} modelValue - The current value of the number control.
 * @vue-prop {String} layout - The layout of the control. Can be 'mobile' or 'desktop'.
 * @vue-prop {String} [popoverContent=''] - The content of the popover.
 * @vue-prop {Number} [verticalOffset=0] - The vertical offset of the popover.
 * @vue-prop {Number} [min=null] - The minimum value of the number control.
 * @vue-prop {Number} [max=null] - The maximum value of the number control.
 * @vue-prop {Number} [defaultValue=null] - The default value of the number control.
 */
import { computed, toRef, ref, watch } from 'vue'
import { vTooltipPopover } from '../../../directives/tooltip-popover'
import { usePreferencesStore } from '../../../store/preferences'

export default {
  name: 'NumberControl',
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  props: {
    label: {
      type: String,
      required: true
    },
    modelValue: {
      type: Number,
      required: true
    },
    layout: {
      type: String,
      required: true
    },
    popoverContent: {
      type: String,
      default: ''
    },
    verticalOffset: {
      type: Number,
      default: 0
    },
    min: {
      type: Number,
      default: null
    },
    max: {
      type: Number,
      default: null
    },
    defaultValue: {
      type: Number,
      default: null
    }
  },
  setup(props, { emit }) {
    const preferences = usePreferencesStore()
    const help = toRef(preferences, 'help')
    const tooltipType = computed(() => help.value ? 'popover' : null)
    
    // Create a local input value ref
    const inputValue = ref(props.modelValue?.toString() || '')

    // Watch for external changes to modelValue
    watch(() => props.modelValue, (newVal) => {
      inputValue.value = newVal?.toString() || ''
    })

    const validateAndEmit = (value) => {
      // Handle empty or invalid input
      if (value === '' || isNaN(parseFloat(value))) {
        const defaultVal = props.defaultValue !== null ? props.defaultValue : 0
        inputValue.value = defaultVal.toString()
        emit('update:modelValue', defaultVal)
        return
      }

      let numValue = parseFloat(value)

      // Apply min/max constraints
      if (props.min !== null && numValue < props.min) {
        numValue = props.min
      }
      if (props.max !== null && numValue > props.max) {
        numValue = props.max
      }

      // Update both local value and emit change
      inputValue.value = numValue.toString()
      emit('update:modelValue', numValue)
    }

    return {
      tooltipType,
      inputValue,
      validateAndEmit
    }
  },
  methods: {
    handleKeydown(e) {
      e.stopPropagation()
    },
    handleEnter(e) {
      this.validateAndEmit(e.target.value)
      e.target.select() // Re-select the text after validation
    },
    handleBlur(e) {
      this.validateAndEmit(e.target.value)
    }
  },
  emits: ['update:modelValue']
}
</script>

<style scoped>
.settings-number {
  background-color: transparent;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.5);
  width: 40px;
  text-align: center;
}
</style>
