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
  <textarea
    ref="textareaRef"
    class="formula-input"
    :value="localValue"
    rows="1"
    spellcheck="false"
    @keydown.stop
    @keydown.enter.prevent="commit"
    @focus="onFocus"
    @blur="commit"
    @input="onInput"
  ></textarea>
</template>

<script>
import { ref, watch, toRef, onMounted, nextTick } from 'vue'
import { usePreferencesStore } from '../../../store/preferences'

export default {
  name: 'FormulaInput',
  props: {
    modelValue: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const textareaRef = ref(null)
    const localValue = ref(props.modelValue)
    let focused = false

    const preferences = usePreferencesStore()
    const sidebarWidth = toRef(preferences, 'sidebarWidth')

    watch(() => props.modelValue, (v) => {
      if (!focused) {
        localValue.value = v
        nextTick(autoResize)
      }
    })

    watch(sidebarWidth, () => nextTick(autoResize))

    const autoResize = () => {
      const el = textareaRef.value
      if (!el) return
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }

    onMounted(autoResize)

    const onFocus = () => {
      focused = true
    }

    const onInput = (e) => {
      localValue.value = e.target.value
      autoResize()
    }

    const commit = () => {
      focused = false
      emit('update:modelValue', localValue.value)
    }

    return {
      textareaRef,
      localValue,
      onFocus,
      onInput,
      commit
    }
  }
}
</script>

<style scoped>
.formula-input {
  flex: 1 1 0;
  min-width: 0;
  font-size: 11px;
  font-family: monospace;
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

.formula-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.formula-input:focus {
  outline: none;
  border-color: rgba(120, 198, 255, 0.6);
}
</style>
