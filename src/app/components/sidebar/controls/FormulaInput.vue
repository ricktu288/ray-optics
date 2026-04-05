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
  <div class="formula-input-host" @mouseleave="onModuleInstancesMouseLeave">
    <textarea
      ref="textareaRef"
      class="formula-input"
      :value="localValue"
      rows="1"
      spellcheck="false"
      @keydown.stop
      @keydown.enter.prevent="commitEnter"
      @focus="onFocus"
      @blur="onBlur"
      @input="onInput"
    ></textarea>
  </div>
</template>

<script>
import { ref, watch, toRef, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as bootstrap from 'bootstrap'
import { usePreferencesStore } from '../../../store/preferences'
import { useSceneStore } from '../../../store/scene'
import { app } from '../../../services/app'
import {
  buildModuleInstanceTooltipHtml,
  isLiteralBooleanFieldValue,
  isLiteralNumericFieldValue,
  tooltipTupleAllCellsMissing
} from '../../../utils/moduleInstanceTooltipHtml.js'
import {
  applyTextareaAutoResize,
  observeTextareasResizeWhenVisible
} from '../../../utils/textareaAutoResize.js'

export default {
  name: 'FormulaInput',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    /** Property key path(s) relative to the template object (same as PropertyControlLabel keyPaths). */
    moduleInstanceKeyPaths: {
      type: [String, Array],
      default: undefined
    },
    moduleName: {
      type: String,
      default: ''
    },
    templateSourceIndex: {
      type: Number,
      default: -1
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const textareaRef = ref(null)
    const localValue = ref(props.modelValue)
    /** Last value aligned with parent `modelValue` / last emit; blur skips emit if unchanged (avoids double-emit after Enter). */
    const lastCommittedValue = ref(props.modelValue)
    let focused = false

    const sceneStore = useSceneStore()
    const preferences = usePreferencesStore()
    const sidebarWidth = toRef(preferences, 'sidebarWidth')
    const editorSelectedObjIndex = ref(-1)

    const normalizedModuleKeyPaths = computed(() => {
      const p = props.moduleInstanceKeyPaths
      if (p == null || p === '') {
        return []
      }
      return (Array.isArray(p) ? p : [p]).filter((s) => s != null && s !== '')
    })

    const moduleInstancesTooltipContent = computed(() => {
      if (
        !props.moduleName ||
        props.templateSourceIndex < 0 ||
        normalizedModuleKeyPaths.value.length === 0
      ) {
        return ''
      }
      void localValue.value
      if (
        isLiteralNumericFieldValue(localValue.value) ||
        isLiteralBooleanFieldValue(localValue.value)
      ) {
        return ''
      }
      void sceneStore.state.objList.length
      void editorSelectedObjIndex.value
      const instances = app.editor?.getActiveModuleInstances?.(props.moduleName)
      if (!instances?.length) {
        return ''
      }
      const paths = normalizedModuleKeyPaths.value

      /** @type {Array<Array<*>>} One row per expanded slot: tuple of raw cells per key path */
      const allRows = []
      for (const inst of instances) {
        if (!inst || typeof inst.getExpandedPropertyValues !== 'function') {
          continue
        }
        const valueArrays = paths.map((kp) => {
          const sourceKeyPath = `${props.templateSourceIndex}.${kp}`
          return inst.getExpandedPropertyValues(sourceKeyPath)
        })
        const maxLen = Math.max(...valueArrays.map((a) => a.length), 0)
        for (let j = 0; j < maxLen; j++) {
          const tuple = valueArrays.map((arr) => arr[j])
          if (!tooltipTupleAllCellsMissing(tuple)) {
            allRows.push(tuple)
          }
        }
      }
      return buildModuleInstanceTooltipHtml(allRows)
    })

    let moduleInstancesTooltip = null

    const disposeModuleInstancesTooltip = () => {
      if (moduleInstancesTooltip) {
        moduleInstancesTooltip.dispose()
        moduleInstancesTooltip = null
      }
    }

    const showModuleInstancesTooltip = (el) => {
      const content = moduleInstancesTooltipContent.value
      if (!content || !el) {
        return
      }
      disposeModuleInstancesTooltip()
      moduleInstancesTooltip = new bootstrap.Tooltip(el, {
        title: content,
        html: true,
        trigger: 'manual',
        placement: 'right',
        customClass: 'formula-input-module-tooltip'
      })
      nextTick(() => {
        moduleInstancesTooltip?.show()
      })
    }

    const onModuleInstancesMouseLeave = () => {
      disposeModuleInstancesTooltip()
    }

    const autoResize = () => {
      applyTextareaAutoResize(textareaRef.value)
    }

    let visibilityResizeObserver = null

    watch(
      () => props.modelValue,
      (v) => {
        if (!focused) {
          localValue.value = v
          lastCommittedValue.value = v
          nextTick(autoResize)
        }
      },
      { immediate: true }
    )

    watch(sidebarWidth, () => nextTick(autoResize))

    const syncEditorSelection = () => {
      editorSelectedObjIndex.value = app.editor?.selectedObjIndex ?? -1
    }

    const onSceneObjSelectionChanged = (event) => {
      editorSelectedObjIndex.value = event?.detail?.index ?? -1
    }

    const onSceneStructureMaybeChanged = () => {
      syncEditorSelection()
    }

    onMounted(() => {
      syncEditorSelection()
      document.addEventListener('sceneObjSelectionChanged', onSceneObjSelectionChanged)
      document.addEventListener('sceneChanged', onSceneStructureMaybeChanged)
      document.addEventListener('sceneObjsChanged', onSceneStructureMaybeChanged)
      autoResize()
      visibilityResizeObserver = observeTextareasResizeWhenVisible(
        () => [textareaRef.value],
        autoResize
      )
    })

    onBeforeUnmount(() => {
      visibilityResizeObserver?.disconnect()
      visibilityResizeObserver = null
      document.removeEventListener('sceneObjSelectionChanged', onSceneObjSelectionChanged)
      document.removeEventListener('sceneChanged', onSceneStructureMaybeChanged)
      document.removeEventListener('sceneObjsChanged', onSceneStructureMaybeChanged)
      disposeModuleInstancesTooltip()
    })

    const onFocus = () => {
      focused = true
      showModuleInstancesTooltip(textareaRef.value)
    }

    const onBlur = () => {
      commitBlur()
    }

    const onInput = (e) => {
      localValue.value = e.target.value
      autoResize()
      disposeModuleInstancesTooltip()
    }

    const commitBlur = () => {
      focused = false
      disposeModuleInstancesTooltip()
      if (localValue.value !== lastCommittedValue.value) {
        emit('update:modelValue', localValue.value)
      }
      nextTick(() => {
        lastCommittedValue.value = props.modelValue
      })
    }

    /**
     * Enter: parent may reject the edit. Only reshow the instance tooltip when the model syncs
     * (accepted) and the field is still focused.
     */
    const commitEnter = () => {
      focused = false
      disposeModuleInstancesTooltip()
      emit('update:modelValue', localValue.value)
      nextTick(() => {
        lastCommittedValue.value = props.modelValue
        if (localValue.value !== props.modelValue) {
          return
        }
        const el = textareaRef.value
        if (!el || document.activeElement !== el) {
          return
        }
        if (
          isLiteralNumericFieldValue(localValue.value) ||
          isLiteralBooleanFieldValue(localValue.value)
        ) {
          return
        }
        focused = true
        showModuleInstancesTooltip(el)
      })
    }

    return {
      textareaRef,
      localValue,
      onFocus,
      onBlur,
      onInput,
      commit: commitBlur,
      commitEnter,
      onModuleInstancesMouseLeave
    }
  }
}
</script>

<style scoped>
.formula-input-host {
  flex: 1 1 0;
  min-width: 0;
  display: block;
}

.formula-input {
  width: 100%;
  box-sizing: border-box;
  font-size: 12px;
  font-family: monospace;
  line-height: 1.4;
  padding: 3px 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: #fff;
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

<!-- Tooltips are mounted on body; override Bootstrap .tooltip-inner defaults -->
<style>
.tooltip.formula-input-module-tooltip .tooltip-inner {
  text-align: left;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.4;
}
</style>
