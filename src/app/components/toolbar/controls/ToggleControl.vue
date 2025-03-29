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
        <div class="form-check form-switch align-items-center">
          <input 
            class="form-check-input" 
            type="checkbox" 
            :checked="modelValue"
            @click="e => e.target.blur()"
            @change="$emit('update:modelValue', $event.target.checked)"
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * @module ToggleControl
 * @description The vue component for a toggle control in the setting dropdown.
 * @vue-prop {String} label - The label for the toggle control.
 * @vue-prop {Boolean} modelValue - The current value of the toggle control.
 * @vue-prop {String} layout - The layout of the control. Can be 'mobile' or 'desktop'.
 * @vue-prop {String} [popoverContent=''] - The content of the popover.
 * @vue-prop {Number} [verticalOffset=0] - The vertical offset of the popover.
 */
import { computed, toRef } from 'vue'
import { vTooltipPopover } from '../../../directives/tooltip-popover'
import { usePreferencesStore } from '../../../store/preferences'

export default {
  name: 'ToggleControl',
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  props: {
    label: {
      type: String,
      required: true
    },
    modelValue: {
      type: Boolean,
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
    }
  },
  setup() {
    const preferences = usePreferencesStore()
    const help = toRef(preferences, 'help')
    const tooltipType = computed(() => help.value ? 'popover' : null)

    return {
      tooltipType
    }
  },
  emits: ['update:modelValue']
}
</script>
