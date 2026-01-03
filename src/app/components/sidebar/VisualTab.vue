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
    </div>

    <div class="visual-subtab-content" role="tabpanel">
      <SceneObjsEditor v-if="activeTabId === 'scene'" />
      <ModuleEditor v-else :moduleName="activeTabId.slice('module:'.length)" />
    </div>
  </div>
</template>

<script>
import { computed, ref, toRef, watch } from 'vue'
import { useSceneStore } from '../../store/scene'
import SceneObjsEditor from './SceneObjsEditor.vue'
import ModuleEditor from './ModuleEditor.vue'

export default {
  name: 'VisualTab',
  components: { SceneObjsEditor, ModuleEditor },
  setup() {
    const scene = useSceneStore()
    const moduleIds = toRef(scene, 'moduleIds')

    const moduleNames = computed(() => {
      const raw = moduleIds.value ? moduleIds.value.split(',') : []
      return raw.map(s => s.trim()).filter(Boolean)
    })

    // NOTE: kept local per request (no store binding)
    const activeTabId = ref('scene')

    // If the selected module disappears, fall back to Scene.
    watch(moduleNames, (names) => {
      if (activeTabId.value === 'scene') return
      const currentModule = activeTabId.value.startsWith('module:') ? activeTabId.value.slice('module:'.length) : ''
      if (!names.includes(currentModule)) {
        activeTabId.value = 'scene'
      }
    })

    return {
      activeTabId,
      moduleNames
    }
  }
}
</script>

<style scoped>
.visual-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.visual-subtabs {
  display: flex;
  gap: 4px;
  padding: 10px 8px 0 8px;
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

.visual-subtab:hover {
  background: rgba(60, 65, 70, 0.32);
  color: rgba(255, 255, 255, 0.82);
  z-index: 2;
}

.visual-subtab.active {
  background: rgba(80, 85, 90, 0.55);
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
  padding: 12px;
  background: rgba(80, 85, 90, 0.55); /* same as active tab, but dim */
  overflow: auto;
}
</style>


