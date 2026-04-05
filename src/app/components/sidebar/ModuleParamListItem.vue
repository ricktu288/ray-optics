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
  <div
    ref="tooltipHostRef"
    class="module-param-item"
    @focusout="onRowFocusOut"
    @click="onItemClick"
    @mouseleave="onItemMouseLeave"
  >
    <input
      class="module-param-input module-param-input--name"
      :value="name"
      :style="{ width: Math.max(name.length, 1) + 'ch' }"
      spellcheck="false"
      @keydown.stop
      @keydown.enter.prevent="onEnterCommit"
      @input="(e) => $emit('update:name', e.target.value)"
    />
    <div class="module-param-right">
      <div class="module-param-field">
        <span class="module-param-keyword">{{ $t('simulator:sidebar.visual.moduleEditor.parameters.min') }}</span>
        <input
          class="module-param-input"
          :value="min"
          :style="{ width: Math.max(min.length, 1) + 'ch' }"
          spellcheck="false"
          @keydown.stop
          @keydown.enter.prevent="onEnterCommit"
          @input="(e) => $emit('update:min', e.target.value)"
        />
      </div>
      <div class="module-param-field">
        <span class="module-param-keyword">{{ $t('simulator:sidebar.visual.moduleEditor.parameters.max') }}</span>
        <input
          class="module-param-input"
          :value="max"
          :style="{ width: Math.max(max.length, 1) + 'ch' }"
          spellcheck="false"
          @keydown.stop
          @keydown.enter.prevent="onEnterCommit"
          @input="(e) => $emit('update:max', e.target.value)"
        />
      </div>
      <div class="module-param-field">
        <span class="module-param-keyword">{{ $t('simulator:sidebar.visual.moduleEditor.parameters.step') }}</span>
        <input
          class="module-param-input"
          :value="step"
          :style="{ width: Math.max(step.length, 1) + 'ch' }"
          spellcheck="false"
          @keydown.stop
          @keydown.enter.prevent="onEnterCommit"
          @input="(e) => $emit('update:step', e.target.value)"
        />
      </div>
      <div class="module-param-field">
        <span class="module-param-keyword">{{ $t('simulator:sidebar.visual.moduleEditor.parameters.default') }}</span>
        <input
          class="module-param-input"
          :value="defaultVal"
          :style="{ width: Math.max(defaultVal.length, 1) + 'ch' }"
          spellcheck="false"
          @keydown.stop
          @keydown.enter.prevent="onEnterCommit"
          @input="(e) => $emit('update:defaultVal', e.target.value)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import * as bootstrap from 'bootstrap'
import { useSceneStore } from '../../store/scene'
import { app } from '../../services/app'
import { buildModuleInstanceTooltipHtml, tooltipTupleAllCellsMissing } from '../../utils/moduleInstanceTooltipHtml.js'

export default {
  name: 'ModuleParamListItem',
  props: {
    moduleName: { type: String, default: '' },
    name: { type: String, default: '' },
    min: { type: String, default: '0' },
    step: { type: String, default: '1' },
    max: { type: String, default: '0' },
    defaultVal: { type: String, default: '0' }
  },
  emits: ['update:name', 'update:min', 'update:step', 'update:max', 'update:defaultVal', 'commit'],
  setup(props, { emit }) {
    const tooltipHostRef = ref(null)
    const sceneStore = useSceneStore()
    const editorSelectedObjIndex = ref(-1)
    /** Last row state that matches the parent store; blur commits only when the row differs from this (Enter updates this nextTick so a later blur does not double-commit). */
    const lastCommittedSnapshot = ref('')

    let moduleInstancesTooltip = null

    const rowSnapshot = () =>
      JSON.stringify({
        name: props.name,
        min: props.min,
        step: props.step,
        max: props.max,
        defaultVal: props.defaultVal
      })

    const moduleInstancesTooltipContent = computed(() => {
      void props.name
      void sceneStore.state.objList.length
      void editorSelectedObjIndex.value

      const nameTrim = props.name.trim()
      if (!props.moduleName || !nameTrim) {
        return ''
      }

      const instances = app.editor?.getActiveModuleInstances?.(props.moduleName)
      if (!instances?.length) {
        return ''
      }

      const allRows = []
      for (const inst of instances) {
        const v = inst?.params?.[nameTrim]
        const tuple = [v]
        if (!tooltipTupleAllCellsMissing(tuple)) {
          allRows.push(tuple)
        }
      }
      return buildModuleInstanceTooltipHtml(allRows)
    })

    const disposeModuleInstancesTooltip = () => {
      if (moduleInstancesTooltip) {
        moduleInstancesTooltip.dispose()
        moduleInstancesTooltip = null
      }
    }

    const showModuleInstancesTooltip = () => {
      const content = moduleInstancesTooltipContent.value
      const el = tooltipHostRef.value
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
      const onShown = () => {
        const tip = moduleInstancesTooltip?.getTipElement?.()
        tip?.addEventListener(
          'mouseleave',
          () => {
            disposeModuleInstancesTooltip()
          },
          { once: true }
        )
      }
      el.addEventListener('shown.bs.tooltip', onShown, { once: true })
      nextTick(() => {
        moduleInstancesTooltip?.show()
      })
    }

    const onItemClick = () => {
      nextTick(() => {
        showModuleInstancesTooltip()
      })
    }

    const onItemMouseLeave = (event) => {
      const rel = event.relatedTarget
      if (rel instanceof Element && typeof rel.closest === 'function' && rel.closest('.tooltip')) {
        return
      }
      disposeModuleInstancesTooltip()
    }

    const onRowFocusOut = (event) => {
      const container = event.currentTarget
      if (container && !container.contains(event.relatedTarget)) {
        if (rowSnapshot() !== lastCommittedSnapshot.value) {
          emit('commit')
          nextTick(() => {
            lastCommittedSnapshot.value = rowSnapshot()
          })
        }
      }
    }

    const onEnterCommit = () => {
      disposeModuleInstancesTooltip()
      emit('commit')
      nextTick(() => {
        lastCommittedSnapshot.value = rowSnapshot()
      })
    }

    const syncEditorSelection = () => {
      editorSelectedObjIndex.value = app.editor?.selectedObjIndex ?? -1
    }

    const onSceneObjSelectionChanged = (event) => {
      editorSelectedObjIndex.value = event?.detail?.index ?? -1
    }

    const onSceneStructureMaybeChanged = () => {
      syncEditorSelection()
      disposeModuleInstancesTooltip()
    }

    onMounted(() => {
      lastCommittedSnapshot.value = rowSnapshot()
      syncEditorSelection()
      document.addEventListener('sceneObjSelectionChanged', onSceneObjSelectionChanged)
      document.addEventListener('sceneChanged', onSceneStructureMaybeChanged)
      document.addEventListener('sceneObjsChanged', onSceneStructureMaybeChanged)
    })

    onBeforeUnmount(() => {
      document.removeEventListener('sceneObjSelectionChanged', onSceneObjSelectionChanged)
      document.removeEventListener('sceneChanged', onSceneStructureMaybeChanged)
      document.removeEventListener('sceneObjsChanged', onSceneStructureMaybeChanged)
      disposeModuleInstancesTooltip()
    })

    return {
      tooltipHostRef,
      onRowFocusOut,
      onEnterCommit,
      onItemClick,
      onItemMouseLeave
    }
  }
}
</script>

<style scoped>
.module-param-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px 8px;
  width: 100%;
  padding-left: 2px;
  padding-right: 3px;
  box-sizing: border-box;
}

.module-param-right {
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 5px 10px;
  min-width: 0;
}

.module-param-field {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  flex-shrink: 0;
}

.module-param-input {
  font-size: 12px;
  font-family: monospace;
  padding: 2px 4px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  color: #fff;
  box-sizing: content-box;
  min-width: 24px;
}

.module-param-input:focus {
  outline: none;
  border-color: rgba(120, 198, 255, 0.6);
}

.module-param-keyword {
  white-space: nowrap;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
}
</style>

<style>
.tooltip.formula-input-module-tooltip .tooltip-inner {
  text-align: left;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.4;
}
</style>
