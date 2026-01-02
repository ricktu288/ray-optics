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
    class="row settings-control-row d-flex justify-content-between align-items-center"
    v-tooltip-popover:[tooltipType]="layout === 'desktop' && popoverContent ? { 
      content: popoverContent,
      html: true,
      placement: 'left',
      offset: [verticalOffset, 20]
    } : undefined"
  >
    <div class="col-auto settings-label" v-html="label"></div>
    <div class="col-auto d-flex align-items-center">
      <button class="btn shadow-none range-minus-btn" @click="handleMinus">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-dash" viewBox="0 0 16 16">
          <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>
        </svg>
      </button>
      <span class="percentage-value">{{ displayValue }}</span>
      <button class="btn shadow-none range-plus-btn" @click="handlePlus">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus" viewBox="0 0 16 16">
          <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script>
/**
 * @module ZoomControl
 * @description The vue component for the zoom control in the setting dropdown.
 * @vue-prop {String} label - The label for the zoom control.
 * @vue-prop {Number} modelValue - The current value of the zoom control.
 * @vue-prop {String} layout - The layout of the control. Can be 'mobile' or 'desktop'.
 * @vue-prop {String} [popoverContent=''] - The content of the popover.
 * @vue-prop {Number} [verticalOffset=0] - The vertical offset of the popover.
 * @vue-prop {Number} [step=1.1] - The step of the zoom control.
 */
import { computed, toRef } from 'vue'
import { vTooltipPopover } from '../../../directives/tooltip-popover'
import { usePreferencesStore } from '../../../store/preferences'

export default {
  name: 'ZoomControl',
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
    step: {
      type: Number,
      default: 1.1
    }
  },
  setup(props, { emit }) {
    const preferences = usePreferencesStore()
    const help = toRef(preferences, 'help')
    const tooltipType = computed(() => help.value ? 'popover' : null)

    const displayValue = computed(() => {
      return Math.round(props.modelValue * 100) + '%'
    })

    const handlePlus = (e) => {
      emit('update:modelValue', props.modelValue * props.step)
      e.target.blur()
    }

    const handleMinus = (e) => {
      emit('update:modelValue', props.modelValue / props.step)
      e.target.blur()
    }

    return {
      tooltipType,
      displayValue,
      handlePlus,
      handleMinus
    }
  },
  emits: ['update:modelValue']
}
</script>

<style scoped>
.range-minus-btn,
.range-plus-btn {
  height: 30px;
  padding-top: 0;
  padding-bottom: 0;
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
}

.percentage-value {
  padding-right: 2px;
  padding-left: 2px;
}
</style>
