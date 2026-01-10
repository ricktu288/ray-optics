<template>
  <div class="module-editor">
    <div class="module-editor-title">
      Module:
      <span class="module-editor-module-name">{{ moduleName }}</span>
    </div>
    <div class="module-editor-body">
      <div class="module-editor-dummy-row">
        <span>Dummy UI (coming soon).</span>
        <InfoPopoverIcon
          :content="dummyInfoHtml"
          aria-label="Module editor info"
        />
      </div>
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
import { computed, toRef } from 'vue'
import i18next from 'i18next'
import { useSceneStore } from '../../store/scene'
import InfoPopoverIcon from '../InfoPopoverIcon.vue'

export default {
  name: 'ModuleEditor',
  components: { InfoPopoverIcon },
  props: {
    moduleName: { type: String, required: true }
  },
  emits: ['module-renamed', 'module-removed'],
  setup(props, { emit }) {
    const scene = useSceneStore()
    const moduleIds = toRef(scene, 'moduleIds')

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

    return {
      dummyInfoHtml:
        'info box test',
      onRenameClick,
      onRemoveClick
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
  font-weight: 600;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.92);
}

.module-editor-module-name {
  font-family: monospace;
}

.module-editor-body {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
}

.module-editor-dummy-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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


