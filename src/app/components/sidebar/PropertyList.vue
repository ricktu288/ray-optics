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
  <div class="property-list">
    <TransitionGroup name="property-drawer" tag="div" class="property-list-items">
      <!-- Module for/if: shown at beginning when in template and not primitive array -->
      <template v-if="canShowForIf && showForIf">
        <div class="property-list-item" key="for-if-for">
          <span class="property-list-item-label">for</span>
          <div class="property-list-item-editor">
            <input
              type="text"
              class="property-list-input"
              :value="getForIfValueString('for')"
              @keydown.stop
              @input="(e) => onForIfInput('for', e.target.value)"
            >
          </div>
        </div>
        <div class="property-list-item" key="for-if-if">
          <span class="property-list-item-label">if</span>
          <div class="property-list-item-editor">
            <input
              type="text"
              class="property-list-input"
              :value="getForIfValueString('if')"
              @keydown.stop
              @input="(e) => onForIfInput('if', e.target.value)"
            >
          </div>
        </div>
      </template>
      <div
        v-for="(descriptor, idx) in visibleProperties"
        :key="fullPath(descriptor) || `prop-${idx}`"
        class="property-list-item"
      >
        <span class="property-list-item-label" v-html="descriptor.label || descriptor.key"></span>
        <div class="property-list-item-editor">
          <!-- Non-point, non-array: text box with JSON.stringify value -->
          <template v-if="descriptor.type !== 'point' && descriptor.type !== 'array'">
            <input
              type="text"
              class="property-list-input"
              :value="getValueString(descriptor)"
              @keydown.stop
              @input="(e) => onValueInput(descriptor, e.target.value)"
            >
          </template>
          <!-- Point: two text boxes for x and y -->
          <template v-else-if="descriptor.type === 'point'">
            <input
              type="text"
              class="property-list-input property-list-input--coord"
              :placeholder="fullPath(descriptor) + '.x'"
              :value="getPointCoord(descriptor, 'x')"
              @keydown.stop
              @input="(e) => onPointCoordInput(descriptor, 'x', e.target.value)"
            >
            <input
              type="text"
              class="property-list-input property-list-input--coord"
              :placeholder="fullPath(descriptor) + '.y'"
              :value="getPointCoord(descriptor, 'y')"
              @keydown.stop
              @input="(e) => onPointCoordInput(descriptor, 'y', e.target.value)"
            >
          </template>
          <!-- Array: SidebarItemList with recursive PropertyList -->
          <template v-else-if="descriptor.type === 'array' && Array.isArray(descriptor.itemSchema)">
            <SidebarItemList
              :items="getArrayItems(descriptor)"
              :show-add-button="true"
              @remove="(item, index) => onArrayRemove(descriptor, index)"
              @duplicate="(item, index) => onArrayDuplicate(descriptor, index)"
              @reorder="onArrayReorder(descriptor, $event)"
              @create="onArrayCreate(descriptor)"
            >
              <template #content="{ item, index }">
                <PropertyList
                  :schema="descriptor.itemSchema"
                  :obj-data="objData"
                  :is-template="isTemplate"
                  :base-path="fullPath(descriptor) + '.' + index"
                  :serializable-defaults="serializableDefaults"
                  @update:obj-data="onNestedUpdate"
                />
              </template>
            </SidebarItemList>
          </template>
          <template v-else>
            <span class="property-list-item-value">({{ descriptor.type }})</span>
          </template>
        </div>
      </div>
    </TransitionGroup>
    <div v-if="(schema && schema.length > 0 && !basePath) || showForIfToggle" class="property-list-visibility-row">
      <button
        v-if="schema && schema.length > 0 && !basePath"
        type="button"
        class="property-list-visibility-link"
        @click="showAllProperties = !showAllProperties"
      >
        {{ showAllProperties ? $t('simulator:sidebar.objectList.hideDefaultProperties') : $t('simulator:sidebar.objectList.showAllProperties') }}
      </button>
      <button
        v-if="showForIfToggle"
        type="button"
        class="property-list-visibility-link"
        @click="onToggleForIf"
      >
        {{ showForIf ? $t('simulator:sidebar.objectList.removeArrayAndConditional') : $t('simulator:sidebar.objectList.createArrayAndConditional') }}
      </button>
    </div>
  </div>
</template>

<script>
import { computed, ref } from 'vue'
import { isNonDefault, getByKeyPath, setByKeyPath, getForIfDefault } from '../../../core/propertyUtils/keyPath.js'
import SidebarItemList from './SidebarItemList.vue'

function isPrimitiveArrayItem(schema) {
  return schema?.length === 1 &&
    (schema[0]?.type === 'number' || schema[0]?.type === 'text')
}

export default {
  name: 'PropertyList',
  components: { SidebarItemList },
  emits: ['update:objData'],
  props: {
    schema: {
      type: Array,
      default: () => []
    },
    objData: {
      type: Object,
      default: () => ({})
    },
    isTemplate: {
      type: Boolean,
      default: false
    },
    basePath: {
      type: String,
      default: ''
    },
    serializableDefaults: {
      type: Object,
      default: () => ({})
    }
  },
  setup(props, { emit }) {
    const showAllProperties = ref(false)

    const canShowForIf = computed(() => {
      return props.isTemplate && !isPrimitiveArrayItem(props.schema)
    })

    const isAtTopLevel = computed(() => !props.basePath)

    const isLastArrayItem = computed(() => {
      const path = props.basePath
      if (!path) return true
      const segments = path.split('.')
      const last = segments[segments.length - 1]
      const idx = Number(last)
      if (Number.isNaN(idx)) return true
      const arrayPath = segments.slice(0, -1).join('.')
      const arr = getByKeyPath(props.objData, arrayPath, props.serializableDefaults)
      return Array.isArray(arr) && idx === arr.length - 1
    })

    const showForIfToggle = computed(() => {
      if (!canShowForIf.value) return false
      if (showForIf.value) return true
      return isAtTopLevel.value || isLastArrayItem.value
    })

    const baseObj = computed(() => {
      return getByKeyPath(props.objData, props.basePath)
    })

    const hasForOrIfInData = computed(() => {
      const obj = baseObj.value
      return obj && typeof obj === 'object' && !Array.isArray(obj) &&
        ('for' in obj || 'if' in obj)
    })

    const showForIf = ref(false)
    const initShowForIf = () => {
      showForIf.value = hasForOrIfInData.value
    }
    initShowForIf()

    const forIfPath = (key) => {
      return props.basePath ? `${props.basePath}.${key}` : key
    }

    const getForIfValue = (key) => getByKeyPath(props.objData, forIfPath(key))

    const getForIfValueString = (key) => {
      const v = getForIfValue(key)
      if (v === undefined) return ''
      try {
        return JSON.stringify(v)
      } catch {
        return String(v)
      }
    }

    const onForIfInput = (key, raw) => {
      const path = forIfPath(key)
      let value
      try {
        value = JSON.parse(raw)
      } catch {
        value = raw
      }
      const next = JSON.parse(JSON.stringify(props.objData || {}))
      setByKeyPath(next, path, value, props.serializableDefaults)
      emit('update:objData', next)
    }

    const onToggleForIf = () => {
      if (showForIf.value) {
        showForIf.value = false
        const next = JSON.parse(JSON.stringify(props.objData || {}))
        setByKeyPath(next, forIfPath('for'), getForIfDefault('for'), props.serializableDefaults)
        setByKeyPath(next, forIfPath('if'), getForIfDefault('if'), props.serializableDefaults)
        emit('update:objData', next)
      } else {
        showForIf.value = true
      }
    }

    const visibleProperties = computed(() => {
      const schema = props.schema || []
      if (props.basePath) {
        return schema
      }
      if (showAllProperties.value) {
        return schema
      }
      return schema.filter((d) => isNonDefault(props.objData, d, props.serializableDefaults, props.basePath))
    })

    const fullPath = (descriptor) => {
      const key = descriptor?.key
      if (key == null) return props.basePath
      return [props.basePath, key].filter(Boolean).join('.')
    }

    const getValue = (descriptor) => {
      const path = fullPath(descriptor)
      return getByKeyPath(props.objData, path, props.serializableDefaults)
    }

    const getValueString = (descriptor) => {
      const v = getValue(descriptor)
      if (v === undefined) return ''
      try {
        return JSON.stringify(v)
      } catch {
        return String(v)
      }
    }

    const getPointCoord = (descriptor, coord) => {
      const base = fullPath(descriptor)
      const coordPath = base ? `${base}.${coord}` : coord
      const v = getByKeyPath(props.objData, coordPath, props.serializableDefaults)
      if (v === undefined) return ''
      return typeof v === 'string' ? v : String(v)
    }

    const applyUpdate = (path, value) => {
      const next = JSON.parse(JSON.stringify(props.objData || {}))
      if (path === '') {
        Object.assign(next, value)
      } else {
        setByKeyPath(next, path, value, props.serializableDefaults)
      }
      emit('update:objData', next)
    }

    const onValueInput = (descriptor, raw) => {
      const path = fullPath(descriptor)
      let value
      try {
        value = JSON.parse(raw)
      } catch {
        value = raw
      }
      applyUpdate(path, value)
    }

    const onPointCoordInput = (descriptor, coord, raw) => {
      const base = fullPath(descriptor)
      const pt = getValue(descriptor)
      const existing = pt != null && typeof pt === 'object' ? { ...pt } : {}
      const num = Number(raw)
      existing[coord] = Number.isNaN(num) ? raw : num
      applyUpdate(base || '', existing)
    }

    const getArrayItems = (descriptor) => {
      const arr = getValue(descriptor)
      if (!Array.isArray(arr)) return []
      return arr.map((el, i) => ({
        id: `${fullPath(descriptor)}-${i}`,
        obj: el
      }))
    }

    const onArrayRemove = (descriptor, index) => {
      const path = fullPath(descriptor)
      const arr = getValue(descriptor)
      if (!Array.isArray(arr)) return
      const next = [...arr]
      next.splice(index, 1)
      applyUpdate(path, next)
    }

    const onArrayDuplicate = (descriptor, index) => {
      const path = fullPath(descriptor)
      const arr = getValue(descriptor)
      if (!Array.isArray(arr)) return
      const next = [...arr]
      const cloned = JSON.parse(JSON.stringify(arr[index] ?? {}))
      next.splice(index + 1, 0, cloned)
      applyUpdate(path, next)
    }

    const onArrayReorder = (descriptor, { fromIndex, toIndex }) => {
      if (fromIndex === toIndex) return
      const path = fullPath(descriptor)
      const arr = getValue(descriptor)
      if (!Array.isArray(arr)) return
      const next = [...arr]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      applyUpdate(path, next)
    }

    const onArrayCreate = (descriptor) => {
      const path = fullPath(descriptor)
      const arr = getValue(descriptor)
      const next = Array.isArray(arr) ? [...arr] : []
      const defaultItem = next.length > 0
        ? JSON.parse(JSON.stringify(next[next.length - 1]))
        : {}
      next.push(defaultItem)
      applyUpdate(path, next)
    }

    const onNestedUpdate = (updated) => {
      emit('update:objData', updated)
    }

    return {
      showAllProperties,
      showForIf,
      canShowForIf,
      showForIfToggle,
      getForIfValueString,
      onForIfInput,
      onToggleForIf,
      visibleProperties,
      fullPath,
      getValueString,
      getPointCoord,
      onValueInput,
      onPointCoordInput,
      getArrayItems,
      onArrayRemove,
      onArrayDuplicate,
      onArrayReorder,
      onArrayCreate,
      onNestedUpdate
    }
  }
}
</script>

<style scoped>
.property-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 8px;
  margin-top: 6px;
  border-left: 1px solid rgba(255, 255, 255, 0.15);
}

.property-list-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

/* Show all / hide default properties transition */
.property-drawer-enter-active,
.property-drawer-leave-active {
  transition: max-height 0.2s ease, opacity 0.2s ease;
}

.property-drawer-enter-from,
.property-drawer-leave-to {
  max-height: 0;
  opacity: 0;
}

.property-drawer-enter-to,
.property-drawer-leave-from {
  max-height: 500px;
  opacity: 1;
}

.property-drawer-move {
  transition: transform 0.2s ease;
}

.property-list-item {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.property-list-item-label {
  flex-shrink: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.property-list-item-editor {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.property-list-input {
  flex: 1;
  min-width: 80px;
  max-width: 180px;
  font-size: 11px;
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.9);
}

.property-list-input--coord {
  flex: 0 1 70px;
  max-width: 70px;
}

.property-list-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.property-list-input:focus {
  outline: none;
  border-color: rgba(120, 198, 255, 0.6);
}

.property-list-item-value {
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
}

.property-list-visibility-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 4px 8px;
  margin-top: 4px;
  min-width: 0;
}

.property-list-visibility-link {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 0;
  font-size: 11px;
  color: rgba(120, 198, 255, 0.9);
  cursor: pointer;
  text-decoration: underline;
}

.property-list-visibility-link:hover {
  color: rgba(140, 218, 255, 0.95);
}
</style>
