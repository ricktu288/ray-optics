<template>
  <li>
    <input 
      type="radio" 
      class="btn-check" 
      :name="layout === 'mobile' ? 'toolsradio_mobile' : 'toolsradio'" 
      autocomplete="off" 
      :id="toolId"
    >
    <label 
      :id="toolLabelId" 
      class="btn shadow-none btn-primary dropdown-item" 
      :for="toolId"
      v-tooltip-popover:[tooltipType]="layout === 'desktop' && popoverContent ? { 
        content: popoverContent,
        html: true,
        placement: 'right',
        offset: [verticalOffset || 40, 8],
        popoverImage
      } : undefined"
      v-html="title"
    ></label>
  </li>
</template>

<script>
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

    return {
      tooltipType,
      toolId,
      toolLabelId
    }
  }
}
</script>
