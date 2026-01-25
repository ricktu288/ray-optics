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
  <div class="scene-objs-editor" @click="handleEditorClick">
    <div class="scene-objs-editor-title">
      <span class="scene-objs-editor-title-label">
        {{ $t('simulator:sidebar.objectList.title') }}
        <InfoPopoverIcon
          :content="$t('simulator:sidebar.objectList.sceneInfo')"
        />
      </span>
      <div class="scene-objs-editor-actions dropdown" @click.stop>
        <button
          class="dropdown-toggle scene-objs-editor-move-btn"
          type="button"
          data-bs-toggle="dropdown"
          aria-expanded="false"
          :disabled="!hasSelection"
        >
          {{ $t('simulator:sidebar.sceneObjsEditor.moveIntoModule') }}
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li v-for="moduleName in moduleNames" :key="moduleName">
            <button class="dropdown-item" type="button" @click="onMoveToModule(moduleName)">
              <span class="scene-objs-editor-module-name">{{ moduleName }}</span>
            </button>
          </li>
          <li>
            <button class="dropdown-item" type="button" @click="onCreateModule">
              {{ $t('simulator:sidebar.sceneObjsEditor.createModule') }}
            </button>
          </li>
        </ul>
      </div>
    </div>
    <div class="scene-objs-editor-body">
      <SidebarItemList
        :items="items"
        v-model:selectedIds="selectedIds"
        :showAddButton="false"
        :activeId="activeId"
        @remove="handleRemove"
        @duplicate="handleDuplicate"
        @reorder="handleReorder"
        @hover="handleHover"
        @select="handleSelect"
        @selection-change="handleSelectionChange"
      >
        <template #content="{ item, index }">
          <SceneObjListItemContent :obj="item.obj" :index="index" />
        </template>
      </SidebarItemList>
      <p v-if="items.length === 0" class="scene-objs-editor-move-in-hint">
        {{ $t('simulator:sidebar.sceneObjsEditor.emptyHint') }}
      </p>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref, toRef } from 'vue'
import i18next from 'i18next'
import SidebarItemList from './SidebarItemList.vue'
import InfoPopoverIcon from '../InfoPopoverIcon.vue'
import SceneObjListItemContent from './SceneObjListItemContent.vue'
import { useSceneStore } from '../../store/scene'
import { app } from '../../services/app'

export default {
  name: 'SceneObjsEditor',
  components: {
    SidebarItemList,
    InfoPopoverIcon,
    SceneObjListItemContent
  },
  setup() {
    const sceneStore = useSceneStore()
    const items = computed(() => sceneStore.state.objList)
    const selectedIds = ref([])
    const activeId = ref(null)
    const moduleIds = toRef(sceneStore, 'moduleIds')
    const moduleNames = computed(() => {
      const raw = moduleIds.value ? moduleIds.value.split(',') : []
      return raw.map((name) => name.trim()).filter(Boolean)
    })
    const hasSelection = computed(() => selectedIds.value.length > 0 || activeId.value !== null)

    const setEditorHighlights = (indices) => {
      app.editor?.setExternalHighlightIndices(indices)
      app.simulator?.updateSimulation(true, true)
    }

    const setEditorHover = (index) => {
      app.editor?.setExternalHoverIndex(index)
      app.simulator?.updateSimulation(true, true)
    }

    const handleRemove = (item, index) => {
      sceneStore.removeObj(index)
      selectedIds.value = selectedIds.value.filter((id) => id !== item.id)
    }

    const handleDuplicate = (item, index) => {
      sceneStore.duplicateObj(index)
    }

    const handleReorder = ({ fromIndex, toIndex }) => {
      sceneStore.reorderObjs(fromIndex, toIndex)
    }

    const handleHover = ({ index }) => {
      if (typeof index !== 'number' || index < 0) {
        setEditorHover(-1)
        return
      }
      setEditorHover(index)
    }

    const handleSelect = ({ index }) => {
      if (selectedIds.value.length) {
        selectedIds.value = []
        setEditorHighlights([])
      }
      if (typeof index === 'number') {
        app.editor?.selectObj(index)
      }
    }

    const handleSelectionChange = ({ selectedIds: nextSelectedIds }) => {
      const indices = items.value
        .map((item, index) => (nextSelectedIds.includes(item.id) ? index : -1))
        .filter((index) => index >= 0)
      if (indices.length) {
        app.editor?.selectObj(-1)
        activeId.value = null
      }
      setEditorHighlights(indices)
    }

    const handleSceneTabClick = () => {
      if (selectedIds.value.length) {
        selectedIds.value = []
        setEditorHighlights([])
      }
      app.editor?.selectObj(-1)
    }

    const handleEditorClick = (event) => {
      if (event?.target?.closest?.('.sidebar-item-list')) {
        return
      }
      handleSceneTabClick()
    }

    const onMoveToModule = (moduleName) => {
      if (!hasSelection.value) {
        return
      }
      let indices = items.value
        .map((item, index) => (selectedIds.value.includes(item.id) ? index : -1))
        .filter((index) => index >= 0)
      if (!indices.length && activeId.value !== null) {
        const activeIndex = items.value.findIndex((item) => item.id === activeId.value)
        if (activeIndex >= 0) {
          indices = [activeIndex]
        }
      }
      app.scene?.moveObjsToModule?.(indices, moduleName)
      app.simulator?.updateSimulation(false, true)
      app.editor?.onActionComplete()
      selectedIds.value = []
      setEditorHighlights([])
      document.dispatchEvent(new CustomEvent('selectVisualModuleTab', { detail: { moduleName } }))
    }

    const onCreateModule = () => {
      const base = 'NewModule'
      const existing = moduleNames.value
      const suggestNewModuleName = () => {
        if (!existing.includes(base)) return base
        for (let i = 2; i < 10000; i++) {
          const candidate = `${base}${i}`
          if (!existing.includes(candidate)) return candidate
        }
        return `${base}${Date.now()}`
      }
      const defaultName = suggestNewModuleName()
      const proposed = window.prompt(i18next.t('simulator:sidebar.moduleEditor.promptNewName'), defaultName)
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
      if (existing.includes(newName)) {
        window.alert(i18next.t('simulator:sidebar.moduleEditor.errorNameExists', { name: newName }))
        return
      }
      sceneStore.createModule(newName)
      onMoveToModule(newName)
    }

    const onEditorSelectionChange = (event) => {
      const index = event?.detail?.index ?? -1
      if (selectedIds.value.length) {
        return
      }
      if (index >= 0 && items.value[index]) {
        activeId.value = items.value[index].id
      } else {
        activeId.value = null
      }
    }

    onMounted(() => {
      document.addEventListener('sceneObjSelectionChanged', onEditorSelectionChange)
      document.addEventListener('clearVisualEditorSelection', handleSceneTabClick)
    })

    onUnmounted(() => {
      document.removeEventListener('sceneObjSelectionChanged', onEditorSelectionChange)
      document.removeEventListener('clearVisualEditorSelection', handleSceneTabClick)
    })

    return {
      items,
      selectedIds,
      activeId,
      handleRemove,
      handleDuplicate,
      handleReorder,
      handleHover,
      handleSelect,
      handleSelectionChange,
      handleSceneTabClick,
      handleEditorClick,
      moduleNames,
      hasSelection,
      onMoveToModule,
      onCreateModule
    }
  }
}
</script>

<style scoped>
.scene-objs-editor-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.92);
}

.scene-objs-editor-title-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.scene-objs-editor-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.scene-objs-editor-move-btn {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(55, 60, 65, 0.22);
  color: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.scene-objs-editor-move-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.scene-objs-editor-module-name {
  font-family: monospace;
}

.scene-objs-editor-body {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.scene-objs-editor-move-in-hint {
  margin: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
}
</style>


