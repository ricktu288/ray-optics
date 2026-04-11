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
        {{ $t('simulator:sidebar.visual.sceneObjects.title') }}
        <InfoPopoverIcon
          :content="$t('simulator:sidebar.visual.sceneObjects.info')"
        />
      </span>
      <div class="scene-objs-editor-actions">
        <div class="dropdown" @click.stop>
          <button
            ref="bindHandleDropdownToggleRef"
            class="dropdown-toggle scene-objs-editor-action-btn"
            type="button"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            :disabled="!bindToHandleEnabled"
          >
            {{ $t('simulator:sidebar.visual.sceneObjects.bindToHandle') }}
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li
              v-if="handleList.length === 0 && !anySelectedBoundToHandle"
              role="presentation"
            >
              <span class="dropdown-item-text scene-objs-editor-dropdown-hint">
                {{ $t('simulator:sidebar.visual.sceneObjects.noHandlesHint') }}
              </span>
            </li>
            <li v-for="handle in handleList" :key="handle.index">
              <button class="dropdown-item" type="button" @click="onBindToHandle(handle.index)">
                {{ handle.label }}
              </button>
            </li>
            <li v-if="anySelectedBoundToHandle">
              <button class="dropdown-item" type="button" @click="onUnbindFromHandles">
                {{ $t('simulator:sidebar.visual.sceneObjects.unbindHandle') }}
              </button>
            </li>
            <li>
              <button class="dropdown-item" type="button" @click="onCreateHandleForObjs">
                {{ $t('simulator:sidebar.visual.sceneObjects.createHandle') }}
              </button>
            </li>
          </ul>
        </div>
        <div class="dropdown" @click.stop>
          <button
            ref="moveModuleDropdownToggleRef"
            class="dropdown-toggle scene-objs-editor-action-btn"
            type="button"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            :disabled="!moveIntoModuleEnabled"
          >
            {{ $t('simulator:sidebar.visual.sceneObjects.moveIntoModule') }}
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li v-if="moduleNames.length === 0" role="presentation">
              <span class="dropdown-item-text scene-objs-editor-dropdown-hint">
                {{ $t('simulator:sidebar.visual.sceneObjects.noModulesHint') }}
              </span>
            </li>
            <li v-for="moduleName in moduleNames" :key="moduleName">
              <button class="dropdown-item" type="button" @click="onMoveToModule(moduleName)">
                <span class="scene-objs-editor-module-name">{{ moduleName }}</span>
              </button>
            </li>
            <li>
              <button class="dropdown-item" type="button" @click="onCreateModule">
                {{ $t('simulator:sidebar.visual.sceneObjects.createModule') }}
              </button>
            </li>
          </ul>
        </div>
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
          <SceneObjListItemContent
            :item="item"
            :index="index"
            @update:name="(v) => onNameUpdate(item, v)"
            @blur="commitName"
          />
        </template>
      </SidebarItemList>
      <p v-if="items.length === 0" class="scene-objs-editor-move-in-hint">
        {{ $t('simulator:sidebar.visual.sceneObjects.emptyHint') }}
      </p>
    </div>
  </div>
</template>

<script>
import { computed, nextTick, onMounted, onUnmounted, ref, toRef } from 'vue'
import i18next from 'i18next'
import SidebarItemList from './SidebarItemList.vue'
import InfoPopoverIcon from '../InfoPopoverIcon.vue'
import SceneObjListItemContent from './SceneObjListItemContent.vue'
import { useSceneStore } from '../../store/scene'
import { app } from '../../services/app'
import * as bootstrap from 'bootstrap'

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

    // Tick that increments whenever the scene objects change, for computed properties
    // that read scene internals (e.g. handle.objIndices) not captured by Vue's reactivity.
    const sceneChangeTick = ref(0)
    const bindHandleDropdownToggleRef = ref(null)
    const moveModuleDropdownToggleRef = ref(null)

    const hideBootstrapDropdown = (toggleRef) => {
      const el = toggleRef.value
      if (!el) return
      const inst = bootstrap.Dropdown.getInstance(el)
      inst?.hide()
    }

    const getSelectedIndices = () => {
      let indices = items.value
        .map((item, index) => (selectedIds.value.includes(item.id) ? index : -1))
        .filter((index) => index >= 0)
      if (!indices.length && activeId.value !== null) {
        const activeIndex = items.value.findIndex((item) => item.id === activeId.value)
        if (activeIndex >= 0) indices = [activeIndex]
      }
      return indices
    }

    const moveIntoModuleEnabled = computed(() => {
      if (!hasSelection.value) return false
      const list = items.value
      let indices = []
      if (selectedIds.value.length > 0) {
        indices = list
          .map((item, index) => (selectedIds.value.includes(item.id) ? index : -1))
          .filter((index) => index >= 0)
      } else if (activeId.value !== null) {
        const activeIndex = list.findIndex((item) => item.id === activeId.value)
        if (activeIndex >= 0) indices = [activeIndex]
      }
      if (indices.length === 0) return false
      if (indices.length === 1) {
        const obj = list[indices[0]]?.obj
        if (obj?.constructor?.type === 'Handle') return false
      }
      return true
    })

    const bindToHandleEnabled = computed(() => {
      if (!hasSelection.value) return false
      const indices = getSelectedIndices()
      return indices.some((i) => items.value[i]?.obj?.constructor?.type !== 'Handle')
    })

    const handleList = computed(() => {
      sceneChangeTick.value
      const selectedForBind = getSelectedIndices().filter(
        (i) => items.value[i]?.obj?.constructor?.type !== 'Handle'
      )
      let ordinal = 0
      const result = []
      items.value.forEach((item, index) => {
        if (item?.obj?.constructor?.type === 'Handle' && !item?.obj?.notDone) {
          ordinal++
          const h = item.obj
          const alreadyWholeBound =
            selectedForBind.length > 0 &&
            selectedForBind.every(
              (idx) => Array.isArray(h.objIndices) && h.objIndices.includes(idx)
            )
          if (alreadyWholeBound) return
          const name = typeof h.name === 'string' ? h.name.trim() : ''
          const label = name || i18next.t('simulator:sidebar.visual.sceneObjects.handleBadge', { n: ordinal })
          result.push({ index, label })
        }
      })
      return result
    })

    const anySelectedBoundToHandle = computed(() => {
      sceneChangeTick.value
      const indices = getSelectedIndices()
      if (!indices.length) return false
      const scene = app.scene
      if (!scene) return false
      for (const h of scene.objs) {
        if (!h || h.constructor?.type !== 'Handle') continue
        for (const idx of indices) {
          if (Array.isArray(h.objIndices) && h.objIndices.includes(idx)) return true
          if (Array.isArray(h.controlPoints) && h.controlPoints.some((cp) => cp?.targetObjIndex === idx)) return true
        }
      }
      return false
    })

    const onBindToHandle = (handleSceneIndex) => {
      hideBootstrapDropdown(bindHandleDropdownToggleRef)
      const scene = app.scene
      if (!scene) return
      const handle = scene.objs[handleSceneIndex]
      if (!handle || handle.constructor?.type !== 'Handle') return
      const indices = getSelectedIndices()
      for (const idx of indices) {
        if (scene.objs[idx]?.constructor?.type === 'Handle') continue
        handle.addObject(idx)
      }
      app.editor?.onActionComplete()
      app.simulator?.updateSimulation(false, true)
      document.dispatchEvent(new Event('sceneObjsChanged'))
    }

    const onUnbindFromHandles = () => {
      hideBootstrapDropdown(bindHandleDropdownToggleRef)
      const scene = app.scene
      if (!scene) return
      const indices = getSelectedIndices()
      for (const h of scene.objs) {
        if (!h || h.constructor?.type !== 'Handle') continue
        h.objIndices = h.objIndices.filter((idx) => !indices.includes(idx))
        h.controlPoints = h.controlPoints.filter((cp) => !indices.includes(cp?.targetObjIndex))
      }
      app.editor?.onActionComplete()
      app.simulator?.updateSimulation(false, true)
      document.dispatchEvent(new Event('sceneObjsChanged'))
    }

    const onCreateHandleForObjs = () => {
      hideBootstrapDropdown(bindHandleDropdownToggleRef)
      const scene = app.scene
      const editor = app.editor
      if (!scene || !editor) return
      const indices = getSelectedIndices().filter((i) => items.value[i]?.obj?.constructor?.type !== 'Handle')
      if (!indices.length) return
      editor.selectObj(-1)

      const hadNotDoneHandle = scene.objs[0]?.constructor?.type === 'Handle' && scene.objs[0]?.notDone

      // Add the first object — this also creates the notDone handle if none exists
      editor.addObjectForHandle(indices[0])

      // After the first call a new Handle was inserted at position 0 (shifting all indices by 1),
      // unless a notDone handle was already present.
      const offset = hadNotDoneHandle ? 0 : 1
      for (let i = 1; i < indices.length; i++) {
        editor.addObjectForHandle(indices[i] + offset)
      }

      // Clear sidebar selection so UI reflects that we are now in handle-placement mode
      selectedIds.value = []
      setEditorHighlights([])
      document.dispatchEvent(new Event('sceneObjsChanged'))
    }

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

    const onNameUpdate = (item, value) => {
      if (item?.obj) {
        item.obj.name = value
      }
    }

    const commitName = () => {
      app.editor?.onActionComplete()
    }

    const onMoveToModule = (moduleName) => {
      hideBootstrapDropdown(moveModuleDropdownToggleRef)
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
      app.editor?.selectObj(-1)
      app.simulator?.updateSimulation(false, true)
      app.editor?.onActionComplete()
      selectedIds.value = []
      setEditorHighlights([])
      nextTick(() => {
        document.dispatchEvent(new CustomEvent('selectVisualModuleTab', { detail: { moduleName } }))
      })
    }

    const onCreateModule = () => {
      hideBootstrapDropdown(moveModuleDropdownToggleRef)
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
      const proposed = window.prompt(i18next.t('simulator:sidebar.visual.moduleEditor.new.promptNewName'), defaultName)
      if (proposed == null) return
      const newName = proposed.trim()
      if (!newName) {
        window.alert(i18next.t('simulator:sidebar.visual.moduleEditor.new.errorEmptyName'))
        return
      }
      if (newName.includes(',')) {
        window.alert(i18next.t('simulator:sidebar.visual.moduleEditor.new.errorComma'))
        return
      }
      if (existing.includes(newName)) {
        window.alert(i18next.t('simulator:sidebar.visual.moduleEditor.new.errorNameExists', { name: newName }))
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
      // Selection updates run before `sceneObjsChanged` refreshes `objList` (e.g. right after
      // creating an object). Use the scene row as source of truth so `activeId` still matches
      // SidebarItemList keys once the list catches up.
      if (index >= 0 && app.scene?.objs?.[index]) {
        activeId.value = items.value[index]?.id ?? `scene-obj-${index}`
      } else {
        activeId.value = null
      }
    }

    const onSceneObjsChanged = () => {
      sceneChangeTick.value++
    }

    // `@click.stop` on these dropdown wrappers stops the toggle click from reaching `document`, so
    // Bootstrap's global close handler does not run when opening the other menu. Close the sibling
    // explicitly (same effect as toolbar dropdowns when focus moves).
    const onSceneObjDropdownShow = (event) => {
      const opening = event.target
      const bindEl = bindHandleDropdownToggleRef.value
      const modEl = moveModuleDropdownToggleRef.value
      if (opening === bindEl && modEl) {
        bootstrap.Dropdown.getInstance(modEl)?.hide()
      } else if (opening === modEl && bindEl) {
        bootstrap.Dropdown.getInstance(bindEl)?.hide()
      }
    }

    onMounted(() => {
      document.addEventListener('sceneObjSelectionChanged', onEditorSelectionChange)
      document.addEventListener('clearVisualEditorSelection', handleSceneTabClick)
      document.addEventListener('sceneObjsChanged', onSceneObjsChanged)
      nextTick(() => {
        bindHandleDropdownToggleRef.value?.addEventListener('show.bs.dropdown', onSceneObjDropdownShow)
        moveModuleDropdownToggleRef.value?.addEventListener('show.bs.dropdown', onSceneObjDropdownShow)
      })
    })

    onUnmounted(() => {
      document.removeEventListener('sceneObjSelectionChanged', onEditorSelectionChange)
      document.removeEventListener('clearVisualEditorSelection', handleSceneTabClick)
      document.removeEventListener('sceneObjsChanged', onSceneObjsChanged)
      bindHandleDropdownToggleRef.value?.removeEventListener('show.bs.dropdown', onSceneObjDropdownShow)
      moveModuleDropdownToggleRef.value?.removeEventListener('show.bs.dropdown', onSceneObjDropdownShow)
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
      onNameUpdate,
      commitName,
      moduleNames,
      hasSelection,
      moveIntoModuleEnabled,
      onMoveToModule,
      onCreateModule,
      bindToHandleEnabled,
      handleList,
      anySelectedBoundToHandle,
      onBindToHandle,
      onUnbindFromHandles,
      onCreateHandleForObjs,
      bindHandleDropdownToggleRef,
      moveModuleDropdownToggleRef
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

.scene-objs-editor-action-btn {
  font-size: 12px;
  line-height: 1.25;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(55, 60, 65, 0.22);
  color: rgba(255, 255, 255, 0.84);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

/* Match toggle and menu to the same size (Bootstrap defaults dropdown text to 1rem). */
.scene-objs-editor-actions :deep(.dropdown-toggle.scene-objs-editor-action-btn) {
  font-size: 12px;
  line-height: 1.25;
}

.scene-objs-editor-actions :deep(.dropdown-menu) {
  font-size: 14px;
}

.scene-objs-editor-actions :deep(.dropdown-item) {
  font-size: 14px;
  line-height: 1.25;
  padding-top: 0.35rem;
  padding-bottom: 0.35rem;
}

.scene-objs-editor-actions :deep(.scene-objs-editor-dropdown-hint) {
  display: block;
  max-width: 14rem;
  white-space: normal;
  color: #6c757d;
  font-weight: 400;
  font-size: 11px;
  line-height: 1.35;
}

.scene-objs-editor-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.scene-objs-editor-module-name {
  font-family: monospace;
  font-size: inherit;
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


