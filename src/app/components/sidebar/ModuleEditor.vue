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
  <div class="module-editor" @click.capture="selectModuleInstance" @click="handleEditorClick">
    <p v-if="!hasModuleInstance" class="module-editor-warning is-highlighted">
      {{ $t('simulator:sidebar.moduleEditor.noInstances', { name: moduleName }) }}
    </p>
    <div class="module-editor-title">
      <span class="module-editor-title-label">
        {{ $t('simulator:sidebar.objectList.title') }}
        <InfoPopoverIcon
          :content="$t('simulator:sidebar.objectList.moduleInfo')"
        />
      </span>
      <button
        class="module-editor-move-out-btn"
        type="button"
        :disabled="!hasSelection"
        @click.stop="onMoveOut"
      >
        {{ $t('simulator:sidebar.moduleEditor.moveOut') }}
      </button>
    </div>
    <div class="module-editor-body">
      <SidebarItemList
        :items="moduleItems"
        v-model:selectedIds="selectedIds"
        :showAddButton="false"
        :activeId="activeId"
        @remove="handleRemove"
        @duplicate="handleDuplicate"
        @reorder="handleReorder"
        @hover="handleHover"
        @selection-change="handleSelectionChange"
        @select="handleSelect"
      >
        <template #content="{ item, index }">
          <ObjListItemContent
            :item="item"
            :index="index"
            :isTemplate="true"
            @update:name="(v) => onNameUpdate(item, index, v)"
            @blur="commitName"
          />
        </template>
      </SidebarItemList>
      <p v-if="!canMoveSelectedObjIn" class="module-editor-move-in-hint">
        {{ $t('simulator:sidebar.moduleEditor.moveInHint') }}
      </p>
      <button
        v-else
        class="module-editor-move-in-btn is-highlighted"
        type="button"
        @click.stop="moveSelectedObjIn"
      >
        {{ $t('simulator:sidebar.moduleEditor.moveIntoModule', { name: selectedMoveInLabel }) }}
      </button>
    </div>
    <div class="module-editor-footer">
      <button type="button" class="module-editor-btn" @click="onRenameClick">
        {{ $t('simulator:sidebar.moduleEditor.renameButton') }}
      </button>
      <button type="button" class="module-editor-btn is-danger" @click="onRemoveClick">
        {{ $t('simulator:sidebar.moduleEditor.removeButton') }}
      </button>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import i18next from 'i18next'
import { useSceneStore } from '../../store/scene'
import { app } from '../../services/app'
import SidebarItemList from './SidebarItemList.vue'
import InfoPopoverIcon from '../InfoPopoverIcon.vue'
import ObjListItemContent from './ObjListItemContent.vue'

export default {
  name: 'ModuleEditor',
  components: { SidebarItemList, InfoPopoverIcon, ObjListItemContent },
  props: {
    moduleName: { type: String, required: true }
  },
  emits: ['module-renamed', 'module-removed'],
  setup(props, { emit }) {
    const scene = useSceneStore()
    const moduleIds = toRef(scene, 'moduleIds')
    const selectedIds = ref([])
    const moduleItems = ref([])
    const hoveredIndex = ref(-1)
    const activeId = ref(null)
    const hasSelection = computed(() => selectedIds.value.length > 0 || activeId.value !== null)
    const editorSelectedIndex = ref(-1)
    const selectedMoveInObj = computed(() => {
      const selectedIndex = editorSelectedIndex.value
      if (selectedIndex < 0) return null
      return app.scene?.objs?.[selectedIndex] ?? null
    })

    const hasModuleInstance = computed(() => {
      // Use objList length to ensure reactive updates.
      const objList = scene.state?.objList || []
      void objList.length
      const moduleName = props.moduleName
      const visited = new Set()
      const hasInstanceInObjs = (objs) => {
        if (!Array.isArray(objs)) return false
        for (const obj of objs) {
          if (!obj || visited.has(obj)) continue
          visited.add(obj)
          if (obj.constructor?.type === 'ModuleObj') {
            if (obj.module === moduleName) {
              return true
            }
            if (hasInstanceInObjs(obj.objs)) {
              return true
            }
          }
        }
        return false
      }
      return hasInstanceInObjs(app.scene?.objs || [])
    })

    const hasNestedModuleInstance = (obj, moduleName) => {
      const visited = new Set()
      const hasInstanceInObjs = (objs) => {
        if (!Array.isArray(objs)) return false
        for (const child of objs) {
          if (!child || visited.has(child)) continue
          visited.add(child)
          if (child.constructor?.type === 'ModuleObj') {
            if (child.module === moduleName) {
              return true
            }
            if (hasInstanceInObjs(child.objs)) {
              return true
            }
          }
        }
        return false
      }
      return hasInstanceInObjs(obj?.objs || [])
    }

    const canMoveSelectedObjIn = computed(() => {
      const selectedIndex = editorSelectedIndex.value
      if (selectedIndex < 0) return false
      const obj = selectedMoveInObj.value
      if (!obj) return false
      if (obj.constructor?.type === 'ModuleObj' && obj.module === props.moduleName) {
        return false
      }
      if (
        obj.constructor?.type === 'ModuleObj' &&
        obj.module !== props.moduleName &&
        hasNestedModuleInstance(obj, props.moduleName)
      ) {
        return false
      }
      return true
    })

    const selectedMoveInLabel = computed(() => {
      const obj = selectedMoveInObj.value
      const fallback = i18next.t('simulator:sidebar.objectList.unknownType')
      if (!obj) return fallback
      if (obj.name) return obj.name
      const Ctor = obj?.constructor
      const scene = app.scene
      if (Ctor && scene && typeof Ctor.getDescription === 'function') {
        return Ctor.getDescription(obj, scene, false) || fallback
      }
      return Ctor?.type || fallback
    })

    const moduleNames = computed(() => {
      const raw = moduleIds.value ? moduleIds.value.split(',') : []
      return raw.map(s => s.trim()).filter(Boolean)
    })

    const onRenameClick = () => {
      const oldName = props.moduleName
      const proposed = window.prompt(i18next.t('simulator:sidebar.moduleEditor.promptNewName'), oldName)
      if (proposed == null) return

      const newName = proposed.trim()
      if (!newName) {
        window.alert(i18next.t('simulator:sidebar.moduleEditor.errorEmptyName'))
        return
      }

      if (newName.includes(',')) {
        window.alert(i18next.t('simulator:sidebar.moduleEditor.errorComma'))
        return
      }

      if (newName === oldName) return

      // Conflict check must live in ModuleEditor (not in the store).
      if (moduleNames.value.includes(newName)) {
        window.alert(i18next.t('simulator:sidebar.moduleEditor.errorNameExists', { name: newName }))
        return
      }

      scene.renameModule(oldName, newName)
      emit('module-renamed', newName)
    }

    const onRemoveClick = () => {
      const name = props.moduleName
      const ok = window.confirm(i18next.t('simulator:sidebar.moduleEditor.confirmRemove', { name }))
      if (!ok) return
      scene.removeModule(name)
      emit('module-removed', name)
    }

    const syncModuleItems = () => {
      const objs = app.scene?.modules?.[props.moduleName]?.objs || []
      moduleItems.value = objs.map((obj, index) => ({
        id: `${props.moduleName}-obj-${index}`,
        obj
      }))
      selectedIds.value = selectedIds.value.filter((id) =>
        moduleItems.value.some((item) => item.id === id)
      )
    }

    const updateModuleObjs = (nextObjs) => {
      if (!app.scene?.modules?.[props.moduleName]) {
        return
      }
      app.scene.modules[props.moduleName].objs = nextObjs
      app.scene.reloadModule?.(props.moduleName)
      syncModuleItems()
      app.simulator?.updateSimulation(false, true)
      app.editor?.onActionComplete()
    }

    const handleRemove = (item, index) => {
      const current = app.scene?.modules?.[props.moduleName]?.objs || []
      const next = [...current]
      next.splice(index, 1)
      updateModuleObjs(next)
    }

    const handleDuplicate = (item, index) => {
      const current = app.scene?.modules?.[props.moduleName]?.objs || []
      const cloned = JSON.parse(JSON.stringify(item.obj))
      const next = [...current]
      next.splice(index + 1, 0, cloned)
      updateModuleObjs(next)
    }

    const handleReorder = ({ fromIndex, toIndex }) => {
      if (fromIndex === toIndex) {
        return
      }
      const current = app.scene?.modules?.[props.moduleName]?.objs || []
      const next = [...current]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      updateModuleObjs(next)
    }

    const getSelectedIndices = () => moduleItems.value
      .map((item, index) => (selectedIds.value.includes(item.id) ? index : -1))
      .filter((index) => index >= 0)

    const applyModuleHighlights = (indices) => {
      const visited = new Set()
      const applyToObj = (obj) => {
        if (!obj || obj.constructor?.type !== 'ModuleObj') {
          return
        }
        if (obj.module === props.moduleName && typeof obj.setHighlightedSourceIndices === 'function') {
          obj.setHighlightedSourceIndices(indices)
          visited.add(obj)
        }
        if (Array.isArray(obj.objs)) {
          for (const child of obj.objs) {
            if (child?.constructor?.type === 'ModuleObj') {
              applyToObj(child)
            }
          }
        }
      }
      const rootObjs = app.scene?.objs || []
      for (const obj of rootObjs) {
        applyToObj(obj)
      }
      app.simulator?.updateSimulation(true, true)
    }

    const updateHighlights = () => {
      const indices = getSelectedIndices()
      if (hoveredIndex.value >= 0 && !indices.includes(hoveredIndex.value)) {
        indices.push(hoveredIndex.value)
      }
      applyModuleHighlights(indices)
    }

    const handleHover = ({ index }) => {
      hoveredIndex.value = typeof index === 'number' ? index : -1
      updateHighlights()
    }

    const handleSelectionChange = () => {
      updateHighlights()
    }

    const handleSelect = ({ item }) => {
      if (!item) {
        return
      }
      if (selectedIds.value.length) {
        selectedIds.value = []
      }
      activeId.value = item.id
      updateHighlights()
    }

    const onMoveOut = () => {
      if (!hasSelection.value) {
        return
      }
      let indices = getSelectedIndices()
      if (!indices.length && activeId.value !== null) {
        const activeIndex = moduleItems.value.findIndex((item) => item.id === activeId.value)
        if (activeIndex >= 0) {
          indices = [activeIndex]
        }
      }
      if (!indices.length) {
        return
      }
      app.scene?.moveModuleObjsToScene?.(props.moduleName, indices)
      app.simulator?.updateSimulation(false, true)
      app.editor?.onActionComplete()
      syncModuleItems()
      scene.syncObjList?.()
      selectedIds.value = []
      activeId.value = null
      hoveredIndex.value = -1
      applyModuleHighlights([])
    }

    const moveSelectedObjIn = () => {
      if (!canMoveSelectedObjIn.value) {
        return
      }
      const selectedIndex = editorSelectedIndex.value
      if (selectedIndex < 0) {
        return
      }
      app.scene?.moveObjsToModule?.([selectedIndex], props.moduleName)
      app.simulator?.updateSimulation(false, true)
      app.editor?.onActionComplete()
      app.editor?.selectObj(-1)
      syncModuleItems()
      selectModuleInstance()
    }

    const resetListSelection = () => {
      if (!selectedIds.value.length && activeId.value === null) {
        return
      }
      selectedIds.value = []
      activeId.value = null
      hoveredIndex.value = -1
      applyModuleHighlights([])
    }

    const handleEditorClick = (event) => {
      if (event?.target?.closest?.('.sidebar-item-list')) {
        return
      }
      resetListSelection()
    }

    const onNameUpdate = (item, index, value) => {
      if (!item?.obj || !app.scene?.modules?.[props.moduleName]) {
        return
      }
      item.obj.name = value
      const moduleObj = app.scene.modules[props.moduleName].objs[index]
      if (moduleObj) {
        moduleObj.name = value
      }
    }

    const commitName = () => {
      app.simulator?.updateSimulation(true, true)
      app.editor?.onActionComplete()
    }

    const commitAndBlur = (event) => {
      commitName()
      if (event?.target?.blur) event.target.blur()
    }

    const selectModuleInstance = (event) => {
      if (event?.target?.closest?.('.module-editor-move-in-btn')) {
        return
      }
      const selectedIndex = app.editor?.selectedObjIndex ?? -1
      const selectedObj = selectedIndex >= 0 ? app.scene?.objs?.[selectedIndex] : null
      if (selectedObj?.constructor?.type === 'ModuleObj' && selectedObj?.module === props.moduleName) {
        return
      }
      const objs = app.scene?.objs || []
      let lastIndex = -1
      for (let i = 0; i < objs.length; i++) {
        if (objs[i]?.constructor?.type === 'ModuleObj' && objs[i]?.module === props.moduleName) {
          lastIndex = i
        }
      }
      app.editor?.selectObj(lastIndex)
    }

    const onClearVisualSelection = () => {
      resetListSelection()
    }

    const onEditorSelectionChange = (event) => {
      editorSelectedIndex.value = event?.detail?.index ?? -1
    }

    watch(
      () => props.moduleName,
      () => {
        syncModuleItems()
        selectModuleInstance()
        hoveredIndex.value = -1
        applyModuleHighlights([])
      },
      { immediate: true }
    )

    onMounted(() => {
      document.addEventListener('clearVisualEditorSelection', onClearVisualSelection)
      document.addEventListener('sceneObjSelectionChanged', onEditorSelectionChange)
      editorSelectedIndex.value = app.editor?.selectedObjIndex ?? -1
    })

    onUnmounted(() => {
      applyModuleHighlights([])
      document.removeEventListener('clearVisualEditorSelection', onClearVisualSelection)
      document.removeEventListener('sceneObjSelectionChanged', onEditorSelectionChange)
    })

    return {
      selectedIds,
      moduleItems,
      onRenameClick,
      onRemoveClick,
      handleRemove,
      handleDuplicate,
      handleReorder,
      onNameUpdate,
      commitName,
      commitAndBlur,
      handleHover,
      handleSelectionChange,
      handleSelect,
      onMoveOut,
      hasSelection,
      activeId,
      canMoveSelectedObjIn,
      selectedMoveInLabel,
      hasModuleInstance,
      moveSelectedObjIn,
      resetListSelection,
      handleEditorClick,
      selectModuleInstance
    }
  }
}
</script>

<style scoped>
.module-editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.module-editor-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.92);
}

.module-editor-title-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.module-editor-module-name {
  font-family: monospace;
}

.module-editor-move-out-btn {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(55, 60, 65, 0.22);
  color: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.module-editor-move-out-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.module-editor-move-in-btn {
  align-self: stretch;
  width: 100%;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(55, 60, 65, 0.22);
  color: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.module-editor-move-in-btn.is-highlighted {
  background: rgba(86, 219, 240, 0.35);
  border-color: rgba(86, 219, 240, 0.7);
  color: rgba(255, 255, 255, 0.96);
  box-shadow: 0 0 0 1px rgba(86, 219, 240, 0.25);
}

.module-editor-move-in-btn.is-highlighted:hover {
  background: rgba(96, 230, 250, 0.5);
  border-color: rgba(96, 230, 250, 0.8);
}

.module-editor-move-in-hint {
  margin: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
}

.module-editor-warning {
  margin: 0;
  padding: 6px 8px;
  border-radius: 6px;
  margin-bottom: 6px;
  font-size: 12px;
  color: rgba(255, 235, 215, 0.96);
  background: rgba(255, 160, 60, 0.2);
  border: 1px solid rgba(255, 160, 60, 0.4);
  box-shadow: 0 0 0 1px rgba(255, 160, 60, 0.12);
}

.module-editor-warning.is-highlighted {
  background: rgba(255, 175, 70, 0.28);
  border-color: rgba(255, 190, 90, 0.6);
  color: rgba(255, 245, 235, 0.98);
}

.module-editor-module-id {
  font-family: monospace;
}

.module-editor-body {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.module-editor-footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.10);
  display: flex;
  gap: 8px;
}

.module-editor-btn {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(55, 60, 65, 0.22);
  color: rgba(255, 255, 255, 0.84);
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.module-editor-btn:hover {
  background: rgba(60, 65, 70, 0.32);
  border-color: rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.92);
}

.module-editor-btn:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.22);
  outline-offset: 2px;
}

.module-editor-btn.is-danger {
  border-color: rgba(255, 90, 90, 0.35);
  color: rgba(255, 200, 200, 0.92);
}

.module-editor-btn.is-danger:hover {
  background: rgba(120, 40, 40, 0.22);
  border-color: rgba(255, 90, 90, 0.50);
}
</style>


