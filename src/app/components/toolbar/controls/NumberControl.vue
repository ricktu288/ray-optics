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
      console.log(inputValue.value)
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
