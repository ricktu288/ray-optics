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
import { app } from '../../services/app'
import * as sceneObjs from '../../../core/sceneObjs.js'
import PropertyList from './PropertyList.vue'

export default {
  name: 'ObjListItemContent',
  components: { PropertyList },
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
