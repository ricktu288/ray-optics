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
  <div class="module-var-item" @focusin="onRowFocusIn" @focusout="onRowFocusOut">
    <div class="module-var-name-wrap">
      <textarea
        ref="nameRef"
        class="module-var-name"
        :value="name"
        rows="1"
        spellcheck="false"
        @keydown.stop
        @keydown.enter.prevent="onEnterCommit"
        @input="onNameInput"
        @focus="onNameFocus"
        @blur="onNameBlur"
      ></textarea>
    </div>
    <span class="module-var-equals" aria-hidden="true">=</span>
    <div class="module-var-tooltip-host" @mouseleave="onModuleInstancesMouseLeave">
      <div class="module-var-expr-wrap">
        <textarea
          ref="exprRef"
          class="module-var-expr"
          :value="expression"
          rows="1"
          spellcheck="false"
          @keydown.stop
          @keydown.enter.prevent="onEnterCommit"
          @input="onExprInput"
          @focus="onExprFocus"
          @blur="onExprBlur"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, nextTick, onMounted, onBeforeUnmount, toRef, computed } from 'vue'
import * as bootstrap from 'bootstrap'
import { usePreferencesStore } from '../../store/preferences'
import { useSceneStore } from '../../store/scene'
import { app } from '../../services/app'
import {
  buildModuleInstanceTooltipHtml,
  isLiteralBooleanFieldValue,
  isLiteralNumericFieldValue,
  tooltipTupleAllCellsMissing
} from '../../utils/moduleInstanceTooltipHtml.js'

export default {
  name: 'ModuleVariableListItem',
  props: {
    moduleName: { type: String, default: '' },
    name: { type: String, default: '' },
    expression: { type: String, default: '' }
  },
  emits: ['update:name', 'update:expression', 'commit'],
  setup(props, { emit }) {
    const nameRef = ref(null)
    const exprRef = ref(null)
    const preferences = usePreferencesStore()
    const sidebarWidth = toRef(preferences, 'sidebarWidth')
    const sceneStore = useSceneStore()
    const editorSelectedObjIndex = ref(-1)

    /** JSON snapshot at row focus-in; same idea as for-loop drafts in PropertyList. */
    const committedSnapshotAtFocus = ref('')

    const rowSnapshot = () => JSON.stringify({ name: props.name, expression: props.expression })

    const moduleInstancesTooltipContent = computed(() => {
      void props.name
      void props.expression
      void sceneStore.state.objList.length
      void editorSelectedObjIndex.value

      const nameTrim = props.name.trim()
      if (!props.moduleName || !nameTrim) {
        return ''
      }
      /** Function-style vars (`f(...) =`): skip tooltip; values are not shown in this UI. */
      if (nameTrim.includes('(')) {
        return ''
      }
      if (
        isLiteralNumericFieldValue(props.expression) ||
        isLiteralBooleanFieldValue(props.expression)
      ) {
        return ''
      }

      const instances = app.editor?.getActiveModuleInstances?.(props.moduleName)
      if (!instances?.length) {
        return ''
      }

      const allRows = []
      for (const inst of instances) {
        const v = inst?.getModuleVarValue(nameTrim)
        const tuple = [v]
        if (!tooltipTupleAllCellsMissing(tuple)) {
          allRows.push(tuple)
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

    const onRowFocusIn = () => {
      committedSnapshotAtFocus.value = rowSnapshot()
    }

    const onRowFocusOut = (event) => {
      const container = event.currentTarget
      if (container && !container.contains(event.relatedTarget)) {
        if (rowSnapshot() !== committedSnapshotAtFocus.value) {
          emit('commit')
        }
      }
    }

    const reshowTooltipIfFocused = () => {
      nextTick(() => {
        const ae = document.activeElement
        if (ae !== exprRef.value) {
          return
        }
        if (
          isLiteralNumericFieldValue(props.expression) ||
          isLiteralBooleanFieldValue(props.expression)
        ) {
          return
        }
        if (!moduleInstancesTooltipContent.value) {
          return
        }
        showModuleInstancesTooltip(ae)
      })
    }

    const onEnterCommit = () => {
      disposeModuleInstancesTooltip()
      emit('commit')
      reshowTooltipIfFocused()
    }

    const autoResize = () => {
      for (const el of [nameRef.value, exprRef.value]) {
        if (!el) continue
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
      }
    }

    const onNameFocus = () => {
      autoResize()
    }

    const onNameBlur = () => {
      nextTick(autoResize)
    }

    const onExprFocus = (e) => {
      autoResize()
      nextTick(() => {
        const el = e?.target
        if (el) {
          showModuleInstancesTooltip(el)
        }
      })
    }

    const onExprBlur = () => {
      disposeModuleInstancesTooltip()
      nextTick(autoResize)
    }

    const onNameInput = (e) => {
      emit('update:name', e.target.value)
      nextTick(autoResize)
    }

    const onExprInput = (e) => {
      emit('update:expression', e.target.value)
      disposeModuleInstancesTooltip()
      nextTick(autoResize)
    }

    watch(
      () => props.name,
      () => nextTick(autoResize)
    )

    watch(
      () => props.expression,
      () => nextTick(autoResize)
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
      nextTick(autoResize)
    })

    onBeforeUnmount(() => {
      document.removeEventListener('sceneObjSelectionChanged', onSceneObjSelectionChanged)
      document.removeEventListener('sceneChanged', onSceneStructureMaybeChanged)
      document.removeEventListener('sceneObjsChanged', onSceneStructureMaybeChanged)
      disposeModuleInstancesTooltip()
    })

    return {
      nameRef,
      exprRef,
      onNameInput,
      onExprInput,
      autoResize,
      onRowFocusIn,
      onRowFocusOut,
      onEnterCommit,
      onNameFocus,
      onNameBlur,
      onExprFocus,
      onExprBlur,
      onModuleInstancesMouseLeave
    }
  }
}
</script>

<style scoped>
.module-var-item {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-start;
  gap: 4px 8px;
  width: 100%;
  padding-left: 3px;
  padding-right: 4px;
  box-sizing: border-box;
}

.module-var-name-wrap {
  flex: 0 0 25%;
  min-width: 0;
}

.module-var-tooltip-host {
  flex: 1 1 0;
  min-width: 0;
}

.module-var-expr-wrap {
  width: 100%;
  min-width: 0;
}

.module-var-equals {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: 12px;
  font-family: monospace;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.4;
  padding: 3px 0;
}

.module-var-name,
.module-var-expr {
  display: block;
  width: 100%;
  margin: 0;
  box-sizing: border-box;
  font-size: 12px;
  font-family: monospace;
  line-height: 1.4;
  padding: 3px 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.9);
  resize: none;
  overflow: hidden;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.module-var-name {
  border-radius: 3px;
}

.module-var-name:focus,
.module-var-expr:focus {
  outline: none;
  border-color: rgba(120, 198, 255, 0.6);
}
</style>

<!-- Tooltips mount on body; match FormulaInput -->
<style>
.tooltip.formula-input-module-tooltip .tooltip-inner {
  text-align: left;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.4;
}
</style>
