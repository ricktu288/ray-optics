<!--
  Copyright 2026 The Ray Optics Simulation authors and contributors

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
  <div class="text-property-control">
    <PropertyControlLabel
      class="text-property-control-label"
      :label="label"
      :info="info"
      :key-paths="[keyPath]"
    />
    <textarea
      ref="textareaRef"
      class="text-property-control-input"
      :value="displayValue"
      :readonly="readOnly"
      rows="1"
      spellcheck="false"
      @keydown.stop
      @focus="onFocus"
      @blur="onBlur"
      @input="onInput"
    ></textarea>
  </div>
</template>

<script>
import { computed, ref, watch, onMounted, nextTick, toRef } from 'vue'
import { getByKeyPath } from '../../../../core/propertyUtils/keyPath.js'
import { usePreferencesStore } from '../../../store/preferences'
import PropertyControlLabel from './PropertyControlLabel.vue'

export default {
  name: 'TextPropertyControl',
  components: { PropertyControlLabel },
  props: {
    label: {
      type: String,
      default: ''
    },
    info: {
      type: String,
      default: ''
    },
    objData: {
      type: Object,
      default: () => ({})
    },
    keyPath: {
      type: String,
      required: true
    },
    default: {
      type: String,
      default: undefined
    },
    readOnly: {
      type: Boolean,
      default: false
    },
    isTemplate: {
      type: Boolean,
      default: false
    },
    moduleName: {
      type: String,
      default: ''
    }
  },
  emits: ['update:value'],
  setup(props, { emit }) {
    const textareaRef = ref(null)
    const localValue = ref('')
    let focused = false

    const preferences = usePreferencesStore()
    const sidebarWidth = toRef(preferences, 'sidebarWidth')

    const rawValue = computed(() => {
      const v = getByKeyPath(props.objData, props.keyPath)
      return v !== undefined && v !== null ? v : props.default
    })

    const displayValue = computed(() => {
      if (focused) return localValue.value
      const v = rawValue.value
      if (v === undefined || v === null) return ''
      return String(v)
    })

    const autoResize = () => {
      const el = textareaRef.value
      if (!el) return
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }

    watch(() => rawValue.value, () => {
      if (!focused) nextTick(autoResize)
    })

    watch(sidebarWidth, () => nextTick(autoResize))

    onMounted(autoResize)

    const onFocus = () => {
      focused = true
      localValue.value = displayValue.value
    }

    const onInput = (e) => {
      localValue.value = e.target.value
      autoResize()
      emit('update:value', e.target.value)
    }

    const onBlur = () => {
      focused = false
    }

    return {
      textareaRef,
      displayValue,
      onFocus,
      onInput,
      onBlur
    }
  }
}
</script>

<style scoped>
.text-property-control {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  width: 100%;
}

.text-property-control-label {
  flex: 0 0 35%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.text-property-control-input {
  flex: 1 1 0;
  min-width: 0;
  font-size: 11px;
  line-height: 1.4;
  padding: 3px 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.9);
  resize: none;
  overflow: hidden;
  field-sizing: content;
}

.text-property-control-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.text-property-control-input:focus {
  outline: none;
  border-color: rgba(120, 198, 255, 0.6);
}

.text-property-control-input[readonly] {
  opacity: 0.6;
  cursor: default;
}
</style>
