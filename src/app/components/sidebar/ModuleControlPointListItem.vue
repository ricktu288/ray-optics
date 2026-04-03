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
    class="module-cp-item"
    @click="onItemClick"
    @mouseleave="onItemMouseLeave"
  >
    <span class="module-cp-label">{{ $t('simulator:sceneObjs.common.pointN', { i: pointNumber }) }}</span>
    <span class="module-cp-formula">x_{{ pointNumber }}, y_{{ pointNumber }}</span>
  </div>
</template>

<script>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import * as bootstrap from 'bootstrap'
import { useSceneStore } from '../../store/scene'
import { app } from '../../services/app'
import { buildModuleInstanceTooltipHtml, tooltipTupleAllCellsMissing } from '../../utils/moduleInstanceTooltipHtml.js'

export default {
  name: 'ModuleControlPointListItem',
  props: {
    moduleName: { type: String, default: '' },
    /** 0-based index into each instance's `points` array */
    pointIndex: { type: Number, default: 0 }
  },
  setup(props) {
    const tooltipHostRef = ref(null)
    const sceneStore = useSceneStore()
    const editorSelectedObjIndex = ref(-1)

    let moduleInstancesTooltip = null

    const pointNumber = computed(() => props.pointIndex + 1)

    const moduleInstancesTooltipContent = computed(() => {
      void props.pointIndex
      void sceneStore.state.objList.length
      void editorSelectedObjIndex.value

      if (!props.moduleName || props.pointIndex < 0) {
        return ''
      }

      const instances = app.editor?.getActiveModuleInstances?.(props.moduleName)
      if (!instances?.length) {
        return ''
      }

      const allRows = []
      for (const inst of instances) {
        const p = inst?.points?.[props.pointIndex]
        const tuple = [p?.x, p?.y]
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
      pointNumber,
      onItemClick,
      onItemMouseLeave
    }
  }
}
</script>

<style scoped>
.module-cp-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding-left: 4px;
  padding-right: 6px;
  box-sizing: border-box;
  gap: 8px;
}

.module-cp-label {
  flex-shrink: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
}

.module-cp-formula {
  margin-left: auto;
  text-align: right;
  font-size: 12px;
  font-family: monospace;
  color: rgba(255, 255, 255, 0.88);
  white-space: nowrap;
}
</style>
