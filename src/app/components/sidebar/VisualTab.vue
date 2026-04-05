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
  <div class="visual-tab">
    <div class="visual-subtabs" role="tablist" aria-label="Visual editor tabs">
      <button
        type="button"
        class="visual-subtab is-scene"
        :class="{ active: activeTabId === 'scene' }"
        role="tab"
        :aria-selected="activeTabId === 'scene'"
        @click="activeTabId = 'scene'"
      >
        {{ $t('simulator:sidebar.visualSubTabs.scene') }}
      </button>

      <button
        v-for="moduleName in moduleNames"
        :key="moduleName"
        type="button"
        class="visual-subtab is-module"
        :class="{ active: activeTabId === `module:${moduleName}` }"
        role="tab"
        :aria-selected="activeTabId === `module:${moduleName}`"
        @click="activeTabId = `module:${moduleName}`"
      >
        {{ moduleName }}
      </button>

      <div class="visual-create-module">
        <button
          type="button"
          class="visual-subtab is-create-module"
          role="tab"
          aria-selected="false"
          @click="onCreateModuleClick"
        >
          {{ $t('simulator:sidebar.visualSubTabs.createModule') }}
        </button>
        <InfoPopoverIcon
          :content="$t('simulator:sidebar.visualSubTabs.createModuleInfo')"
          aria-label="Modules info"
        />
      </div>
    </div>

    <div class="visual-subtab-content" role="tabpanel" @click="handleContentClick">
      <div ref="scenePanelEl" class="visual-subtab-panel" v-show="activeTabId === 'scene'">
        <SceneObjsEditor />
      </div>
      <div ref="modulePanelEl" class="visual-subtab-panel" v-show="activeModuleName != null">
        <KeepAlive :max="16">
          <ModuleEditor
            v-if="activeModuleName != null"
            :key="activeModuleName"
            :moduleName="activeModuleName"
            @module-renamed="onModuleRenamed"
            @module-removed="onModuleRemoved"
          />
        </KeepAlive>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, nextTick, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import { useSceneStore } from '../../store/scene'
import { promptNewModuleName } from '../../utils/promptNewModuleName.js'
import SceneObjsEditor from './SceneObjsEditor.vue'
import ModuleEditor from './ModuleEditor.vue'
import InfoPopoverIcon from '../InfoPopoverIcon.vue'

export default {
  name: 'VisualTab',
  components: { SceneObjsEditor, ModuleEditor, InfoPopoverIcon },
  setup() {
    const scene = useSceneStore()
    const moduleIds = toRef(scene, 'moduleIds')

    const moduleNames = computed(() => {
      const raw = moduleIds.value ? moduleIds.value.split(',') : []
      return raw.map(s => s.trim()).filter(Boolean)
    })

    // NOTE: kept local per request (no store binding)
    const activeTabId = ref('scene')

    const activeModuleName = computed(() => {
      const id = activeTabId.value
      if (!id.startsWith('module:')) return null
      const name = id.slice('module:'.length)
      return name || null
    })

    const scenePanelEl = ref(null)
    const modulePanelEl = ref(null)
    const sceneScrollTop = ref(0)
    const moduleScrollByName = new Map()

    const stashSubtabScroll = (prevTabId) => {
      if (prevTabId === 'scene' && scenePanelEl.value) {
        sceneScrollTop.value = scenePanelEl.value.scrollTop
      } else if (prevTabId?.startsWith('module:') && modulePanelEl.value) {
        moduleScrollByName.set(prevTabId.slice('module:'.length), modulePanelEl.value.scrollTop)
      }
    }

    const restoreSubtabScrollSoon = () => {
      nextTick(() => {
        requestAnimationFrame(() => {
          const id = activeTabId.value
          if (id === 'scene' && scenePanelEl.value) {
            scenePanelEl.value.scrollTop = sceneScrollTop.value
          } else if (id.startsWith('module:') && modulePanelEl.value) {
            const name = id.slice('module:'.length)
            modulePanelEl.value.scrollTop = moduleScrollByName.get(name) ?? 0
          }
        })
      })
    }

    watch(activeTabId, (next, prev) => {
      const prevMod = prev?.startsWith('module:') ? prev.slice('module:'.length) : null
      const nextMod = next.startsWith('module:') ? next.slice('module:'.length) : null
      const renamedAway =
        prevMod &&
        nextMod &&
        prevMod !== nextMod &&
        !moduleNames.value.includes(prevMod)

      if (renamedAway && modulePanelEl.value) {
        moduleScrollByName.delete(prevMod)
        moduleScrollByName.set(nextMod, modulePanelEl.value.scrollTop)
      } else {
        stashSubtabScroll(prev)
      }

      restoreSubtabScrollSoon()
    })

    const onModuleRenamed = (newName) => {
      activeTabId.value = `module:${newName}`
    }

    const onModuleRemoved = (name) => {
      moduleScrollByName.delete(name)
      if (activeTabId.value === `module:${name}`) {
        activeTabId.value = 'scene'
      }
    }

    const applyNewModule = (moduleName) => {
      scene.createModule(moduleName)
      activeTabId.value = `module:${moduleName}`
    }

    const onCreateModuleClick = () => {
      const newName = promptNewModuleName(moduleNames.value)
      if (newName == null) return
      applyNewModule(newName)
    }

    const handleApplyVisualNewModule = (event) => {
      const moduleName = event?.detail?.moduleName
      if (!moduleName) return
      applyNewModule(moduleName)
    }

    const handleSelectModuleTab = (event) => {
      const moduleName = event?.detail?.moduleName
      if (moduleName) {
        activeTabId.value = `module:${moduleName}`
      }
    }

    const handleSelectSceneTab = () => {
      activeTabId.value = 'scene'
    }

    const handleContentClick = (event) => {
      if (event?.target?.closest?.('.sidebar-item-list') || event?.target?.closest?.('.scene-objs-editor-actions')) {
        return
      }
      document.dispatchEvent(new CustomEvent('clearVisualEditorSelection'))
    }

    // If the selected module disappears, fall back to Scene.
    watch(moduleNames, (names) => {
      if (activeTabId.value === 'scene') return
      const currentModule = activeTabId.value.startsWith('module:') ? activeTabId.value.slice('module:'.length) : ''
      if (!names.includes(currentModule)) {
        activeTabId.value = 'scene'
      }
    })

    onMounted(() => {
      document.addEventListener('selectVisualModuleTab', handleSelectModuleTab)
      document.addEventListener('selectVisualSceneTab', handleSelectSceneTab)
      document.addEventListener('applyVisualNewModule', handleApplyVisualNewModule)
    })

    onUnmounted(() => {
      document.removeEventListener('selectVisualModuleTab', handleSelectModuleTab)
      document.removeEventListener('selectVisualSceneTab', handleSelectSceneTab)
      document.removeEventListener('applyVisualNewModule', handleApplyVisualNewModule)
    })

    return {
      activeTabId,
      activeModuleName,
      moduleNames,
      scenePanelEl,
      modulePanelEl,
      onCreateModuleClick,
      onModuleRenamed,
      onModuleRemoved,
      handleContentClick
    }
  }
}
</script>

<style scoped>
.visual-tab {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.visual-subtabs {
  display: flex;
  gap: 4px;
  padding: 6px 8px 0 8px;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  flex-shrink: 0;
}

.visual-subtabs::-webkit-scrollbar {
  height: 8px;
}

.visual-subtabs::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.14);
  border-radius: 999px;
}

.visual-subtabs::-webkit-scrollbar-track {
  background: transparent;
}

.visual-create-module {
  margin-left: auto; /* right-align when tabs fit; scrolls with tabs when overflow */
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.visual-subtab {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-bottom: none;
  background: rgba(55, 60, 65, 0.22);
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
  padding: 2px 12px; /* thinner tabs */
  height: 22px;
  display: flex;
  align-items: center;
  line-height: 1.1;
  border-radius: 0; /* trapezoid tabs */
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  white-space: nowrap;
  flex: 0 0 auto;
  margin-bottom: -1px; /* visually connects active tab to content panel */
  /* trapezoid shape (angled sides) */
  clip-path: polygon(10px 0%, calc(100% - 10px) 0%, 100% 100%, 0% 100%);
  position: relative;
  z-index: 1;
}

.visual-subtab + .visual-subtab {
  margin-left: -6px; /* slight overlap between trapezoids */
}

.visual-subtab.is-module {
  font-family: monospace;
}

.visual-subtab.is-create-module {
  clip-path: none; /* not a trapezoid */
  border: none; /* no border for the new module button */
  background: transparent;
  padding-left: 5px;
  padding-right: 0px;
}

.visual-subtab:hover {
  background: rgba(60, 65, 70, 0.32);
  color: rgba(255, 255, 255, 0.82);
  z-index: 2;
}

.visual-subtab.is-create-module:hover {
  border: none;
}

.visual-subtab.active {
  background: rgba(80, 85, 90, 0.5);
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.12);
  z-index: 3;
}

.visual-subtab:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.22);
  outline-offset: 2px;
}

.visual-subtab-content {
  flex-grow: 1;
  min-height: 0;
  position: relative;
  background: rgba(80, 85, 90, 0.5); /* same as active tab, but dim */
  overflow: hidden;
}

/* Separate scroll surfaces per subtab so scene/module switches do not reset scroll. */
.visual-subtab-panel {
  position: absolute;
  inset: 0;
  overflow: auto;
  padding: 8px;
  -webkit-overflow-scrolling: touch;
}

/* Sidebar contrast; link decoration is global. */
.visual-tab :deep(a) {
  color: #8ec5ff;
}

.visual-tab :deep(a:hover),
.visual-tab :deep(a:focus-visible) {
  color: #b8d9ff;
}
</style>


