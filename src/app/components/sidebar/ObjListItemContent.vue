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
  <div class="obj-list-item-content">
    <div class="obj-list-item-header">
      <template v-if="schema.length > 0">
      <button
        type="button"
        class="obj-list-item-chevron"
        :aria-label="expanded ? $t('simulator:sidebar.objectList.collapse') : $t('simulator:sidebar.objectList.expand')"
        @click="onChevronClick"
      >
        <svg
          class="obj-list-item-chevron-svg"
          :class="{ 'is-expanded': expanded }"
          viewBox="0 0 10 10"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon points="2,1 2,9 9,5" fill="currentColor" />
        </svg>
      </button>
      </template>
      <span v-else class="obj-list-item-chevron-spacer" aria-hidden="true"></span>
      <div class="obj-list-item-main">
        <input
          class="obj-list-item-name-input"
          type="text"
          :value="nameValue"
          :placeholder="$t('simulator:sidebar.objectList.unnamedObject')"
          @input="onNameInput"
          @blur="onBlur"
          @keydown.enter.prevent="commitAndBlur"
          @keydown.stop
        >
        <div class="obj-list-item-description">{{ objDescription }}</div>
      </div>
      <button
        v-if="!isTemplate"
        type="button"
        class="obj-list-item-lock"
        :class="{ 'obj-list-item-lock--default': isLockDefault }"
        :aria-label="lockAriaLabel"
        v-tooltip-popover="{ title: lockAriaLabel }"
        @click.stop="onLockClick"
      >
        <svg v-if="isEffectivelyLocked" class="obj-list-item-lock-svg" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="currentColor" d="M8 0a4 4 0 0 1 4 4v2.05a2.5 2.5 0 0 1 2 2.45v5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 13.5v-5a2.5 2.5 0 0 1 2-2.45V4a4 4 0 0 1 4-4M4.5 7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7zM8 1a3 3 0 0 0-3 3v2h6V4a3 3 0 0 0-3-3"/>
        </svg>
        <svg v-else class="obj-list-item-lock-svg" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="currentColor" d="M8 0c1.07 0 2.041.42 2.759 1.104l.14.14.062.08a.5.5 0 0 1-.71.675l-.076-.066-.216-.205A3 3 0 0 0 5 4v2h6.5A2.5 2.5 0 0 1 14 8.5v5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 13.5v-5a2.5 2.5 0 0 1 2-2.45V4a4 4 0 0 1 4-4M4.5 7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7z"/>
        </svg>
      </button>
      <span
        v-if="isTemplate && templateLockVisible"
        ref="templateLockEl"
        class="obj-list-item-lock obj-list-item-lock--template"
        role="button"
        tabindex="0"
        :aria-label="$t('simulator:sidebar.objectList.templateLockInfo')"
        v-tooltip-popover:popover="templateLockPopoverOptions"
        @keydown.enter.prevent="onTemplateLockKeyActivate"
        @keydown.space.prevent="onTemplateLockKeyActivate"
      >
        <svg class="obj-list-item-lock-svg" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="currentColor" d="M8 0a4 4 0 0 1 4 4v2.05a2.5 2.5 0 0 1 2 2.45v5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 13.5v-5a2.5 2.5 0 0 1 2-2.45V4a4 4 0 0 1 4-4M4.5 7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7zM8 1a3 3 0 0 0-3 3v2h6V4a3 3 0 0 0-3-3"/>
        </svg>
      </span>
    </div>
    <Transition name="drawer">
      <div v-if="expanded && schema.length > 0" class="obj-list-item-expanded">
        <PropertyList
        :schema="schema"
        :obj-data="objData"
        :is-template="isTemplate"
        base-path=""
        :serializable-defaults="serializableDefaults"
      />
      </div>
    </Transition>
  </div>
</template>

<script>
import { computed, ref } from 'vue'
import i18next from 'i18next'
import { app } from '../../services/app'
import { useSceneStore } from '../../store/scene'
import * as sceneObjs from '../../../core/sceneObjs.js'
import { templatePointLockState } from '../../../core/propertyUtils/parametrization.js'
import { vTooltipPopover } from '../../directives/tooltip-popover'
import PropertyList from './PropertyList.vue'

export default {
  name: 'ObjListItemContent',
  components: { PropertyList },
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  props: {
    item: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      required: true
    },
    isTemplate: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:name', 'blur'],
  setup(props, { emit }) {
    const expanded = ref(false)
    const sceneStore = useSceneStore()

    const objData = computed(() => props.item?.obj)

    const objDescription = computed(() => {
      const obj = objData.value
      const scene = app.scene
      if (!obj || !scene) return ''
      const Ctor = props.isTemplate ? sceneObjs[obj.type] : obj?.constructor
      if (!Ctor || typeof Ctor.getDescription !== 'function') {
        return props.isTemplate ? (obj.type || '') : (obj?.constructor?.type || '')
      }
      const detailed = !expanded.value
      return Ctor.getDescription(obj, scene, detailed) || ''
    })

    const nameValue = computed(() => objData.value?.name ?? '')

    const schema = computed(() => {
      const obj = objData.value
      const scene = app.scene
      if (!obj || !scene) return []
      if (props.isTemplate) {
        const Ctor = sceneObjs[obj.type]
        if (!Ctor || typeof Ctor.getPropertySchema !== 'function') return []
        return Ctor.getPropertySchema(obj, scene) || []
      }
      const Ctor = obj?.constructor
      if (!Ctor || typeof Ctor.getPropertySchema !== 'function') return []
      return Ctor.getPropertySchema(obj, scene) || []
    })

    const serializableDefaults = computed(() => {
      const obj = objData.value
      if (!obj) return {}
      if (props.isTemplate) {
        const Ctor = sceneObjs[obj.type]
        if (!Ctor?.serializableDefaults) return {}
        return { name: '', ...Ctor.serializableDefaults }
      }
      const Ctor = obj?.constructor
      if (!Ctor?.serializableDefaults) return {}
      return { name: '', ...Ctor.serializableDefaults }
    })

    const isEffectivelyLocked = computed(() => {
      const obj = objData.value
      if (!obj) return false
      if (obj.locked === 'locked') return true
      if (obj.locked === 'unlocked') return false
      return !!sceneStore.lockObjs.value
    })

    const isLockDefault = computed(() => {
      const obj = objData.value
      return !obj || (obj.locked ?? 'default') === 'default'
    })

    const lockAriaLabel = computed(() => {
      const obj = objData.value
      if (!obj) return ''
      const state = obj.locked ?? 'default'
      if (state === 'locked') return i18next.t('simulator:sidebar.objectList.lockLocked')
      if (state === 'unlocked') return i18next.t('simulator:sidebar.objectList.lockUnlocked')
      return i18next.t('simulator:sidebar.objectList.lockDefault')
    })

    const templateLockState = computed(() => {
      if (!props.isTemplate) return { hasPointProperties: false, allHardcoded: false }
      const obj = objData.value
      const sch = schema.value
      if (!obj || !Array.isArray(sch)) return { hasPointProperties: false, allHardcoded: false }
      return templatePointLockState(obj, sch)
    })

    const templateLockVisible = computed(() => {
      const { hasPointProperties, allHardcoded } = templateLockState.value
      return hasPointProperties && allHardcoded
    })

    const templateLockPopoverOptions = computed(() => ({
      title: '',
      content: i18next.t('simulator:sidebar.objectList.templateLockInfo'),
      trigger: 'click',
      placement: 'bottom',
      html: true
    }))

    const templateLockEl = ref(null)
    const onTemplateLockKeyActivate = () => {
      templateLockEl.value?.click?.()
    }

    const onLockClick = () => {
      const obj = objData.value
      if (!obj || props.isTemplate) return
      const current = obj.locked ?? 'default'
      const lockObjsOn = !!sceneStore.lockObjs.value
      let next
      if (lockObjsOn) {
        next = current === 'unlocked' ? 'default' : 'unlocked'
      } else {
        next = current === 'locked' ? 'default' : 'locked'
      }
      obj.locked = next
      app.editor?.onActionComplete()
      app.simulator?.updateSimulation(true, true)
    }

    const toggleExpanded = () => {
      expanded.value = !expanded.value
    }

    const onChevronClick = () => {
      toggleExpanded()
    }

    const onNameInput = (event) => {
      emit('update:name', event.target.value)
    }

    const onBlur = () => {
      emit('blur')
    }

    const commitAndBlur = (event) => {
      emit('blur')
      event.target.blur()
    }

    return {
      expanded,
      objData,
      objDescription,
      nameValue,
      schema,
      serializableDefaults,
      isEffectivelyLocked,
      isLockDefault,
      lockAriaLabel,
      templateLockVisible,
      templateLockPopoverOptions,
      templateLockEl,
      onTemplateLockKeyActivate,
      onLockClick,
      toggleExpanded,
      onChevronClick,
      onNameInput,
      onBlur,
      commitAndBlur
    }
  }
}
</script>

<style scoped>
.obj-list-item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  width: 100%;
}

.obj-list-item-header {
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 32px;
}

.obj-list-item-chevron {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.obj-list-item-chevron:hover {
  color: rgba(255, 255, 255, 0.85);
}

.obj-list-item-chevron-spacer {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.obj-list-item-lock {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  margin: 0;
  margin-left: auto;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.obj-list-item-lock--default {
  color: rgba(255, 255, 255, 0.45);
}

.obj-list-item-lock:hover {
  color: rgba(255, 255, 255, 0.95);
}

.obj-list-item-lock--default:hover {
  color: rgba(255, 255, 255, 0.65);
}

.obj-list-item-lock--template {
  cursor: pointer;
  color: rgba(135, 206, 250, 0.95);
}

.obj-list-item-lock--template:hover {
  color: rgba(135, 206, 250, 0.95);
}

.obj-list-item-lock-svg {
  width: 14px;
  height: 14px;
}

.obj-list-item-chevron-svg {
  width: 10px;
  height: 10px;
  transition: transform 0.2s ease;
}

.obj-list-item-chevron-svg.is-expanded {
  transform: rotate(90deg);
}

.obj-list-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.obj-list-item-name-input {
  background: transparent;
  border: none;
  border-radius: 0;
  color: rgba(255, 255, 255, 0.92);
  font-weight: 600;
  font-size: 12px;
  line-height: 1.2;
  padding: 0;
  width: 100%;
  min-width: 0;
  transition: color 120ms ease;
}

.obj-list-item-name-input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.obj-list-item-name-input:focus {
  outline: none;
}

.obj-list-item-description {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.obj-list-item-expanded {
  margin-top: 2px;
  overflow: hidden;
}

/* Drawer expand/collapse transition */
.drawer-enter-active,
.drawer-leave-active {
  transition: max-height 0.25s ease, opacity 0.2s ease, margin-top 0.2s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  max-height: 0;
  opacity: 0;
  margin-top: 0;
}

.drawer-enter-to,
.drawer-leave-from {
  max-height: 600px;
  opacity: 1;
  margin-top: 2px;
}
</style>
