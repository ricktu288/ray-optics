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
      offset: [verticalOffset || 0, 20]
    } : undefined"
  >
    <div class="col-auto settings-label" v-html="label"></div>
    <div class="col-auto d-flex align-items-center">
      <button 
        class="btn shadow-none dropdown-toggle settings-popup-btn" 
        type="button" 
        :data-bs-toggle="popupType"
        :data-bs-target="`#${popupTarget}`"
        :disabled="disabled"
      >
        {{ displayText }}
      </button>
    </div>
  </div>
</template>

<script>
/**
 * @module PopupSelectControl
 * @description The vue component for a popup select control in the setting dropdown.
 * @vue-prop {String} label - The label for the popup select control.
 * @vue-prop {String} value - The current value of the popup select control.
 * @vue-prop {String} layout - The layout of the control. Can be 'mobile' or 'desktop'.
 * @vue-prop {String} [popoverContent=''] - The content of the popover.
 * @vue-prop {Number} [verticalOffset=0] - The vertical offset of the popover.
 * @vue-prop {Boolean} [disabled=false] - Whether the control is disabled.
 */
import { computed, toRef } from 'vue'
import { vTooltipPopover } from '../../../directives/tooltip-popover'
import { usePreferencesStore } from '../../../store/preferences'

export default {
  name: 'PopupSelectControl',
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  props: {
    label: {
      type: String,
      required: true
    },
    value: {
      type: [String, Number],
      required: true
    },
    displayFn: {
      type: Function,
      required: true
    },
    disabled: {
      type: Boolean,
      default: false
    },
    popupType: {
      type: String,
      default: 'modal'
    },
    popupTarget: {
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
    layout: {
      type: String,
      default: 'desktop'
    }
  },
  setup(props) {
    const preferences = usePreferencesStore()
    const help = toRef(preferences, 'help')
    const tooltipType = computed(() => help.value ? 'popover' : null)

    const displayText = computed(() => {
      return props.displayFn(props.value)
    })

    return {
      displayText,
      tooltipType
    }
  }
}
</script>

<style scoped>
.settings-popup-btn {
  height: 30px;
  padding-top: 0;
  padding-bottom: 0;
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  padding-right: 4px;
}
</style>
