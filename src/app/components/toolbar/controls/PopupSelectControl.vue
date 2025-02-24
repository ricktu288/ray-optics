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
    <div class="col-auto settings-label" :id="`${id}_text`" v-html="label"></div>
    <div class="col-auto d-flex align-items-center">
      <button 
        class="btn shadow-none dropdown-toggle" 
        type="button" 
        :data-bs-toggle="popupType"
        :data-bs-target="`#${popupTarget}`"
        :id="id"
        :disabled="disabled"
      >
        {{ displayText }}
      </button>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { vTooltipPopover } from '../../../directives/tooltip-popover'

export default {
  name: 'PopupSelectControl',
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
    tooltipType: {
      type: String,
      default: 'popover'
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
    const displayText = computed(() => {
      return props.displayFn(props.value)
    })

    return {
      displayText
    }
  }
}
</script>
