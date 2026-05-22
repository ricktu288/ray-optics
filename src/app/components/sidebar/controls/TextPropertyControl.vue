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
    <div class="text-property-control-input-wrap">
      <div class="text-property-control-stack">
        <textarea
          ref="textareaRef"
          class="text-property-control-input"
          :value="localValue"
          :readonly="readOnly"
          rows="1"
          spellcheck="false"
          @keydown.stop="onKeydown"
          @focus="onFocus"
          @blur="onBlur"
          @input="onInput"
        ></textarea>
        <div
          class="text-property-control-highlight-layer"
          aria-hidden="true"
          v-html="highlightLayerHtml"
        ></div>
      </div>
      <PropertyControlError :message="error" />
    </div>
  </div>
</template>

<script>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick, toRef } from 'vue'
import i18next from 'i18next'
import { getByKeyPath } from '../../../../core/propertyUtils/keyPath.js'
import { usePreferencesStore } from '../../../store/preferences'
import {
  applyTextareaAutoResize,
  observeTextareasResizeWhenVisible
} from '../../../utils/textareaAutoResize.js'
import { textHasBacktickBlocks } from '../../../utils/backtickHighlightHtml.js'
import { useBacktickHighlightLayer } from '../../../composables/useBacktickHighlightLayer.js'
import PropertyControlLabel from './PropertyControlLabel.vue'
import PropertyControlError from './PropertyControlError.vue'

export default {
  name: 'TextPropertyControl',
  components: { PropertyControlLabel, PropertyControlError },
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
    /** Last value aligned with parent data / last emit; blur skips emit if unchanged. */
    const lastCommittedValue = ref('')
    const error = ref('')
    let focused = false

    const { highlightLayerHtml } = useBacktickHighlightLayer(() => localValue.value)

    const preferences = usePreferencesStore()
    const sidebarWidth = toRef(preferences, 'sidebarWidth')

    const rawValue = computed(() => {
      const v = getByKeyPath(props.objData, props.keyPath)
      return v !== undefined && v !== null ? v : props.default
    })

    const committedDisplayString = computed(() => {
      const v = rawValue.value
      if (v === undefined || v === null) return ''
      return String(v)
    })

    const autoResize = () => {
      applyTextareaAutoResize(textareaRef.value)
    }

    let visibilityResizeObserver = null

    watch(
      committedDisplayString,
      (s) => {
        if (!focused) {
          localValue.value = s
          lastCommittedValue.value = s
          nextTick(autoResize)
        }
      },
      { immediate: true }
    )

    watch(sidebarWidth, () => nextTick(autoResize))

    onMounted(() => {
      autoResize()
      visibilityResizeObserver = observeTextareasResizeWhenVisible(
        () => [textareaRef.value],
        autoResize
      )
    })

    onBeforeUnmount(() => {
      visibilityResizeObserver?.disconnect()
      visibilityResizeObserver = null
    })

    const tryCommit = (text) => {
      error.value = ''

      if (text.trim() === '') {
        return true
      }

      if (!props.isTemplate && textHasBacktickBlocks(text)) {
        error.value = i18next.t('simulator:sidebar.visual.sceneObjects.formulaRequiresModule')
        return false
      }

      emit('update:value', text)
      return true
    }

    const onFocus = () => {
      focused = true
      localValue.value = committedDisplayString.value
    }

    const onInput = (e) => {
      localValue.value = e.target.value
      error.value = ''
      autoResize()
    }

    const commitBlur = () => {
      focused = false
      if (props.readOnly) return
      const draft = localValue.value
      if (draft.trim() === '') {
        localValue.value = committedDisplayString.value
      } else if (draft !== lastCommittedValue.value) {
        tryCommit(draft)
      }
      nextTick(() => {
        lastCommittedValue.value = committedDisplayString.value
        autoResize()
      })
    }

    /** Enter commits (FormulaInput); Shift+Enter inserts a newline. Restore `focused` if still in field after accept. */
    const commitEnter = () => {
      if (props.readOnly) return
      focused = false
      const draft = localValue.value
      if (draft.trim() === '') {
        localValue.value = committedDisplayString.value
        nextTick(() => {
          lastCommittedValue.value = committedDisplayString.value
          autoResize()
        })
        return
      }
      const accepted = tryCommit(draft)
      nextTick(() => {
        lastCommittedValue.value = committedDisplayString.value
        autoResize()
        if (!accepted || localValue.value !== committedDisplayString.value) {
          return
        }
        const el = textareaRef.value
        if (!el || document.activeElement !== el) {
          return
        }
        focused = true
      })
    }

    const onKeydown = (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return
      e.preventDefault()
      commitEnter()
    }

    return {
      textareaRef,
      localValue,
      error,
      highlightLayerHtml,
      onFocus,
      onInput,
      onBlur: commitBlur,
      onKeydown
    }
  }
}
</script>

<style scoped>
.text-property-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  width: 100%;
}

.text-property-control-label {
  flex: 0 0 35%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.text-property-control-input-wrap {
  flex: 1 1 0;
  min-width: 0;
}

.text-property-control-stack {
  position: relative;
  display: block;
  width: 100%;
  min-width: 0;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.text-property-control-stack:focus-within {
  border-color: rgba(120, 198, 255, 0.6);
}

.text-property-control-highlight-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  box-sizing: border-box;
  font-size: 12px;
  font-family: monospace;
  line-height: 1.4;
  padding: 3px 6px;
  white-space: pre-wrap;
  overflow: hidden;
  word-wrap: break-word;
  overflow-wrap: break-word;
  color: transparent;
  pointer-events: none;
}

.text-property-control-highlight-layer :deep(.backtick-highlight-match) {
  background: rgba(120, 198, 255, 0.35);
  border-radius: 2px;
}

.text-property-control-input {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  box-sizing: border-box;
  font-size: 12px;
  font-family: monospace;
  line-height: 1.4;
  padding: 3px 6px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #fff;
  resize: none;
  overflow: hidden;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  field-sizing: content;
}

.text-property-control-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.text-property-control-input:focus {
  outline: none;
}

.text-property-control-input[readonly] {
  opacity: 0.6;
  cursor: default;
}
</style>
