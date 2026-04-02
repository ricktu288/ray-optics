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
    <div class="module-editor-section module-editor-vars">
      <div class="module-editor-title module-editor-title-plain">
        <span class="module-editor-title-label">
          {{ $t('simulator:sidebar.variableList.title') }}
          <InfoPopoverIcon
            :content="$t('simulator:sidebar.variableList.info')"
          />
        </span>
      </div>
      <div class="module-editor-body">
        <SidebarItemList
          :items="variableItems"
          :show-add-button="true"
          :add-label="$t('simulator:sidebar.variableList.newItem')"
          :show-checkbox="false"
          :active-id="variableActiveId"
          @remove="handleVarRemove"
          @duplicate="handleVarDuplicate"
          @reorder="handleVarReorder"
          @create="handleVarCreate"
          @select="handleVarSelect"
        >
          <template #content="{ item, index }">
            <ModuleVariableListItem
              :module-name="moduleName"
              :name="item.name"
              :expression="item.expression"
              @update:name="(v) => onVarNameUpdate(index, v)"
              @update:expression="(v) => onVarExprUpdate(index, v)"
              @commit="commitVariableDefs"
            />
          </template>
        </SidebarItemList>
      </div>
    </div>
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
          <ObjTemplateListItemContent
            :item="item"
            :index="index"
            :module-name="moduleName"
            @update:name="(v) => onNameUpdate(item, index, v)"
            @update:obj-data="(raw) => onObjDataUpdate(index, raw)"
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
        v-html="$t('simulator:sidebar.moduleEditor.moveIntoModule', { name: selectedMoveInLabel })"
      ></button>
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
import escapeHtml from 'escape-html'
import { useSceneStore } from '../../store/scene'
import { app } from '../../services/app'
import SidebarItemList from './SidebarItemList.vue'
import InfoPopoverIcon from '../InfoPopoverIcon.vue'
import ObjTemplateListItemContent from './ObjTemplateListItemContent.vue'
import ModuleVariableListItem from './ModuleVariableListItem.vue'

/** One sidebar list may have selection at a time; add keys when adding new lists (see clearOtherModuleSidebarLists). */
const MODULE_EDITOR_LIST = Object.freeze({
  OBJECTS: 'objects',
  VARIABLES: 'variables'
})

function parseVarDef(entry) {
  const str = typeof entry === 'string' ? entry : String(entry ?? '')
  const idx = str.indexOf('=')
  if (idx < 0) {
    return { name: '', expression: str.trim() }
  }
  return {
    name: str.slice(0, idx).trim(),
    expression: str.slice(idx + 1).trim()
  }
}

function serializeVarDef(name, expression) {
  const n = (name ?? '').trim()
  const e = (expression ?? '').trim()
  if (!n && !e) {
    return ''
  }
  if (!n) {
    return e
  }
  if (!e) {
    return n
  }
  return `${n} = ${e}`
}

function getNextModuleVarName(existingNames) {
  for (const name of ['a', 'b', 'c']) {
    if (!existingNames.includes(name)) return name
  }
  for (let c = 97; c <= 122; c++) {
    const name = String.fromCharCode(c)
    if (!existingNames.includes(name)) return name
  }
  return 'x'
}

export default {
  name: 'ModuleEditor',
  components: { SidebarItemList, InfoPopoverIcon, ObjTemplateListItemContent, ModuleVariableListItem },
  props: {
    moduleName: { type: String, required: true }
  },
  emits: ['module-renamed', 'module-removed'],
  setup(props, { emit }) {
    const scene = useSceneStore()
    const moduleIds = toRef(scene, 'moduleIds')
    const selectedIds = ref([])
    const moduleItems = ref([])
    const variableItems = ref([])
    const variableActiveId = ref(null)
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
      if (obj.name) return escapeHtml(obj.name)
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

    const syncVariableItems = () => {
      const raw = app.scene?.modules?.[props.moduleName]?.vars || []
      variableItems.value = raw.map((entry, index) => ({
        id: `${props.moduleName}-var-${index}`,
        ...parseVarDef(entry)
      }))
      if (!variableItems.value.some((item) => item.id === variableActiveId.value)) {
        variableActiveId.value = null
      }
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

    const commitVariableDefs = () => {
      if (!app.scene?.modules?.[props.moduleName]) {
        return
      }
      const next = variableItems.value
        .map((it) => serializeVarDef(it.name, it.expression))
        .filter((s) => s !== '')
      app.scene.modules[props.moduleName].vars = next
      app.scene.reloadModule?.(props.moduleName)
      syncVariableItems()
      app.simulator?.updateSimulation(false, true)
      app.editor?.onActionComplete()
    }

    const onVarNameUpdate = (index, value) => {
      const row = variableItems.value[index]
      if (row) {
        row.name = value
      }
    }

    const onVarExprUpdate = (index, value) => {
      const row = variableItems.value[index]
      if (row) {
        row.expression = value
      }
    }

    const handleVarRemove = (item, index) => {
      const next = variableItems.value.filter((_, i) => i !== index)
      variableItems.value = next
      commitVariableDefs()
    }

    const handleVarDuplicate = (item, index) => {
      const row = variableItems.value[index]
      if (!row) return
      const clone = { id: `${props.moduleName}-var-${variableItems.value.length}`, name: row.name, expression: row.expression }
      const next = [...variableItems.value]
      next.splice(index + 1, 0, clone)
      variableItems.value = next
      commitVariableDefs()
    }

    const handleVarReorder = ({ fromIndex, toIndex }) => {
      if (fromIndex === toIndex) {
        return
      }
      const next = [...variableItems.value]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      variableItems.value = next
      commitVariableDefs()
    }

    const handleVarCreate = () => {
      const names = variableItems.value.map((r) => r.name)
      variableItems.value = [
        ...variableItems.value,
        {
          id: `${props.moduleName}-var-${variableItems.value.length}`,
          name: getNextModuleVarName(names),
          expression: '1'
        }
      ]
      commitVariableDefs()
    }

    const updateModuleObjs = (nextObjs) => {
      if (!app.scene?.modules?.[props.moduleName]) {
        return
      }
      app.scene.modules[props.moduleName].objs = nextObjs
      app.scene.reloadModule?.(props.moduleName)
      syncModuleItems()
      console.log('updateModuleObjs', nextObjs)
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
      const activeInstances = app.editor?.getActiveModuleInstances?.(props.moduleName)
      const activeSet = activeInstances != null ? new Set(activeInstances) : null

      const applyToObj = (obj) => {
        if (!obj || obj.constructor?.type !== 'ModuleObj') {
          return
        }
        if (obj.module === props.moduleName) {
          if (activeSet && !activeSet.has(obj)) {
            obj.setHighlightedSourceIndices([])
          } else {
            obj.setHighlightedSourceIndices(indices)
          }
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

    /**
     * Clears all module sidebar lists except `keepKind` (when adding a new list, add another branch).
     * Pass `null` to clear every list.
     */
    const clearOtherModuleSidebarLists = (keepKind) => {
      if (keepKind !== MODULE_EDITOR_LIST.VARIABLES) {
        variableActiveId.value = null
      }
      if (keepKind !== MODULE_EDITOR_LIST.OBJECTS) {
        selectedIds.value = []
        activeId.value = null
        hoveredIndex.value = -1
        applyModuleHighlights([])
      }
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
      if (selectedIds.value.length > 0) {
        variableActiveId.value = null
      }
      updateHighlights()
    }

    const handleSelect = ({ item }) => {
      if (!item) {
        return
      }
      clearOtherModuleSidebarLists(MODULE_EDITOR_LIST.OBJECTS)
      if (selectedIds.value.length) {
        selectedIds.value = []
      }
      activeId.value = item.id
      updateHighlights()
    }

    const handleVarSelect = ({ item }) => {
      if (!item) {
        return
      }
      clearOtherModuleSidebarLists(MODULE_EDITOR_LIST.VARIABLES)
      variableActiveId.value = item.id
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
      variableActiveId.value = null
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

    const resetAllModuleSidebarListSelections = () => {
      if (
        !selectedIds.value.length &&
        activeId.value === null &&
        hoveredIndex.value < 0 &&
        variableActiveId.value === null
      ) {
        return
      }
      variableActiveId.value = null
      selectedIds.value = []
      activeId.value = null
      hoveredIndex.value = -1
      applyModuleHighlights([])
    }

    const handleEditorClick = (event) => {
      if (event?.target?.closest?.('.sidebar-item-list')) {
        return
      }
      resetAllModuleSidebarListSelections()
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

    const onObjDataUpdate = (index, raw) => {
      if (!app.scene?.modules?.[props.moduleName] || !raw) return
      const current = app.scene.modules[props.moduleName].objs || []
      const next = [...current]
      next[index] = raw
      updateModuleObjs(next)
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
      resetAllModuleSidebarListSelections()
    }

    const onEditorSelectionChange = (event) => {
      editorSelectedIndex.value = event?.detail?.index ?? -1
      updateHighlights()
    }

    watch(
      () => props.moduleName,
      () => {
        syncModuleItems()
        syncVariableItems()
        selectModuleInstance()
        hoveredIndex.value = -1
        variableActiveId.value = null
        applyModuleHighlights([])
      },
      { immediate: true }
    )

    const onSceneChanged = () => {
      syncModuleItems()
      syncVariableItems()
    }

    onMounted(() => {
      document.addEventListener('clearVisualEditorSelection', onClearVisualSelection)
      document.addEventListener('sceneObjSelectionChanged', onEditorSelectionChange)
      document.addEventListener('sceneChanged', onSceneChanged)
      document.addEventListener('sceneObjsChanged', onSceneChanged)
      editorSelectedIndex.value = app.editor?.selectedObjIndex ?? -1
    })

    onUnmounted(() => {
      applyModuleHighlights([])
      document.removeEventListener('clearVisualEditorSelection', onClearVisualSelection)
      document.removeEventListener('sceneObjSelectionChanged', onEditorSelectionChange)
      document.removeEventListener('sceneChanged', onSceneChanged)
      document.removeEventListener('sceneObjsChanged', onSceneChanged)
    })

    return {
      selectedIds,
      moduleItems,
      variableItems,
      variableActiveId,
      onVarNameUpdate,
      onVarExprUpdate,
      commitVariableDefs,
      handleVarRemove,
      handleVarDuplicate,
      handleVarReorder,
      handleVarCreate,
      handleVarSelect,
      onRenameClick,
      onRemoveClick,
      handleRemove,
      handleDuplicate,
      handleReorder,
      onNameUpdate,
      onObjDataUpdate,
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
      resetAllModuleSidebarListSelections,
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

.module-editor-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.module-editor-vars {
  margin-bottom: 4px;
}

.module-editor-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.92);
}

.module-editor-title-plain {
  justify-content: flex-start;
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


