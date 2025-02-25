<template>
  <div 
    class="row d-flex justify-content-between align-items-center"
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
        class="btn shadow-none dropdown-toggle" 
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
