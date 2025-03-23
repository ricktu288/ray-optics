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
  <li>
    <input 
      type="radio" 
      class="btn-check" 
      :name="layout === 'mobile' ? 'toolsradio_mobile' : 'toolsradio'" 
      autocomplete="off" 
      :id="toolId"
      @change="handleClick"
    >
    <label 
      :id="toolLabelId" 
      class="btn shadow-none btn-primary dropdown-item" 
      :for="toolId"
      v-tooltip-popover:[tooltipType]="layout === 'desktop' && popoverContent ? { 
        content: popoverContent,
        html: true,
        placement: 'right',
        offset: [verticalOffset, 8],
        popoverImage
      } : undefined"
      v-html="title"
    ></label>
  </li>
</template>

<script>
/**
 * @module ToolItem
 * @description The Vue component for a single tool item in the toolbar.
 * @vue-prop {String} id - The ID of the item.
 * @vue-prop {String} title - The title of the item.
 * @vue-prop {String} [popoverContent] - The content of the popover.
 * @vue-prop {String} [popoverImage] - The image of the popover.
 * @vue-prop {Number} [verticalOffset=40] - The vertical offset of the popover.
 * @vue-prop {String} [layout='desktop'] - The layout of the control. Can be 'mobile' or 'desktop'.
 * @vue-prop {Boolean} [disabled=false] - Whether the item is disabled. 
 */
import { computed, toRef } from 'vue'
import { vTooltipPopover } from '../../../directives/tooltip-popover'
import { usePreferencesStore } from '../../../store/preferences'

export default {
  name: 'ToolItem',
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  props: {
    id: {
      type: String,
      required: true
    },
    title: {
      type: String,
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
    popoverImage: {
      type: String,
      default: ''
    },
    verticalOffset: {
      type: Number,
      default: 40
    }
  },
  setup(props) {
    const preferences = usePreferencesStore()
    const help = toRef(preferences, 'help')
    const tooltipType = computed(() => help.value ? 'popover' : null)

    // Compute IDs based on layout
    const mobileSuffix = computed(() => props.layout === 'mobile' ? '_mobile' : '')
    const toolId = computed(() => `tool_${props.id}${mobileSuffix.value}`)
    const toolLabelId = computed(() => `${toolId.value}_label`)

    const handleClick = (event) => {
      const toolId = props.id
      window.hideWelcome()
      window.editor.addingObjType = toolId
    };

    return {
      tooltipType,
      toolId,
      toolLabelId,
      handleClick
    }
  }
}
</script>
