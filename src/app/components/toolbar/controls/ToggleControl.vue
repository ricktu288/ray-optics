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
            :id="id" 
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
import { computed, toRef } from 'vue'
import { vTooltipPopover } from '../../../directives/tooltip-popover'
import { usePreferencesStore } from '../../../store/preferences'

export default {
  name: 'ToggleControl',
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  props: {
    id: {
      type: String,
      required: true
    },
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
