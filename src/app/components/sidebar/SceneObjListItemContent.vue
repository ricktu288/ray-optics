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
        <div class="obj-list-item-description" v-html="objDescription"></div>
      </div>
      <button
        type="button"
        class="obj-list-item-lock"
        :class="{ 'obj-list-item-lock--default': isLockDefault }"
        :aria-label="lockAriaLabel"
        @click.stop="onLockClick"
      >
        <svg v-if="isEffectivelyLocked" class="obj-list-item-lock-svg" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="currentColor" d="M8 0a4 4 0 0 1 4 4v2.05a2.5 2.5 0 0 1 2 2.45v5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 13.5v-5a2.5 2.5 0 0 1 2-2.45V4a4 4 0 0 1 4-4M4.5 7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7zM8 1a3 3 0 0 0-3 3v2h6V4a3 3 0 0 0-3-3"/>
        </svg>
        <svg v-else class="obj-list-item-lock-svg" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <path fill-rule="evenodd" fill="currentColor" d="M8 0c1.07 0 2.041.42 2.759 1.104l.14.14.062.08a.5.5 0 0 1-.71.675l-.076-.066-.216-.205A3 3 0 0 0 5 4v2h6.5A2.5 2.5 0 0 1 14 8.5v5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 13.5v-5a2.5 2.5 0 0 1 2-2.45V4a4 4 0 0 1 4-4M4.5 7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7z"/>
        </svg>
      </button>
    </div>
    <Transition name="drawer">
      <div v-if="expanded && schema.length > 0" class="obj-list-item-expanded">
        <PropertyList
          :schema="schema"
          :obj-data="objData"
          :is-template="false"
          base-path=""
          :serializable-defaults="serializableDefaults"
          @update:obj-data="onObjDataUpdate"
        />
      </div>
    </Transition>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import i18next from 'i18next'
import { app } from '../../services/app'
import { useSceneStore } from '../../store/scene'
import { sceneObjs } from '../../../core/index.js'
import PropertyList from './PropertyList.vue'

export default {
  name: 'SceneObjListItemContent',
  components: { PropertyList },
  props: {
    item: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      required: true
    }
  },
  emits: ['update:name', 'blur'],
  setup(props, { emit }) {
    const expanded = ref(false)
    const sceneStore = useSceneStore()

    const obj = computed(() => props.item?.obj)

    const objData = ref({})
    const updateObjData = () => {
      const instance = obj.value
      objData.value = (instance && typeof instance.serialize === 'function')
        ? instance.serialize()
        : {}
    }

    watch(obj, updateObjData, { immediate: true })

    onMounted(() => {
      document.addEventListener('sceneObjsChanged', updateObjData)
    })

    onUnmounted(() => {
      document.removeEventListener('sceneObjsChanged', updateObjData)
    })

    const objDescription = computed(() => {
      const instance = obj.value
      const scene = app.scene
      if (!instance || !scene) return ''
      const Ctor = instance?.constructor
      if (!Ctor || typeof Ctor.getDescription !== 'function') {
        return instance?.constructor?.type || ''
      }
      const detailed = !expanded.value
      return Ctor.getDescription(instance, scene, detailed) || ''
    })

    const nameValue = computed(() => obj.value?.name ?? '')

    const schema = computed(() => {
      const instance = obj.value
      const scene = app.scene
      if (!instance || !scene) return []
      const Ctor = instance?.constructor
      if (!Ctor || typeof Ctor.getPropertySchema !== 'function') return []
      return Ctor.getPropertySchema(instance, scene) || []
    })

    const serializableDefaults = computed(() => {
      const instance = obj.value
      if (!instance) return {}
      const Ctor = instance?.constructor
      if (!Ctor?.serializableDefaults) return {}
      return { name: '', ...Ctor.serializableDefaults }
    })

    const isEffectivelyLocked = computed(() => {
      const instance = obj.value
      if (!instance) return false
      if (instance.locked === 'locked') return true
      if (instance.locked === 'unlocked') return false
      return !!sceneStore.lockObjs.value
    })

    const isLockDefault = computed(() => {
      const instance = obj.value
      return !instance || (instance.locked ?? 'default') === 'default'
    })

    const lockAriaLabel = computed(() => {
      const instance = obj.value
      if (!instance) return ''
      const state = instance.locked ?? 'default'
      if (state === 'locked') return i18next.t('simulator:sidebar.objectList.lockLocked')
      if (state === 'unlocked') return i18next.t('simulator:sidebar.objectList.lockUnlocked')
      return i18next.t('simulator:sidebar.objectList.lockDefault')
    })

    const onObjDataUpdate = (raw) => {
      if (!raw?.type || !app.scene || !sceneObjs[raw.type]) return
      const newObj = new sceneObjs[raw.type](app.scene, raw)
      app.scene.objs[props.index] = newObj
      document.dispatchEvent(new Event('sceneObjsChanged'))
      app.simulator?.updateSimulation(!sceneObjs[raw.type]?.isOptical, true)
      app.editor?.onActionComplete()
    }

    const onLockClick = () => {
      const instance = obj.value
      if (!instance) return
      const current = instance.locked ?? 'default'
      const lockObjsOn = !!sceneStore.lockObjs.value
      let next
      if (lockObjsOn) {
        next = current === 'unlocked' ? 'default' : 'unlocked'
      } else {
        next = current === 'locked' ? 'default' : 'locked'
      }
      instance.locked = next
      app.editor?.onActionComplete()
      app.simulator?.updateSimulation(!instance.constructor?.isOptical, true)
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
      obj,
      objData,
      objDescription,
      nameValue,
      schema,
      serializableDefaults,
      isEffectivelyLocked,
      isLockDefault,
      lockAriaLabel,
      onObjDataUpdate,
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
  color: #fff;
  font-weight: 600;
  font-size: 12px;
  line-height: 1.2;
  padding: 0;
  width: 100%;
  min-width: 0;
  transition: color 120ms ease;
  margin-top: 2px;
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
