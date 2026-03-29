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
    <!-- Module for/if: shown before properties, outside the vertical line -->
    <div v-if="canShowForIf && showForIf" class="for-if-box">
        <div class="property-list-item">
          <PropertyControlLabel
            :label="$t('simulator:sidebar.objectList.arrayAndConditional.repeatFor')"
            :info="$t('simulator:sidebar.objectList.arrayAndConditional.info')"
          />
          <div class="property-list-array-body">
            <SidebarItemList
              :items="forDrafts"
              :show-add-button="true"
              :add-label="$t('simulator:sidebar.objectList.arrayAndConditional.newLoopVariable')"
              @remove="(item, index) => onForLoopRemove(index)"
              @duplicate="(item, index) => onForLoopDuplicate(index)"
              @reorder="onForLoopReorder"
              @create="onForLoopCreate"
            >
              <template #content="{ item, index }">
                <div class="for-loop-item" @focusout="onForItemFocusOut">
                  <input
                    class="for-loop-input"
                    :value="item.name"
                    :style="{ width: Math.max(item.name.length, 1) + 'ch' }"
                    @keydown.stop
                    @keydown.enter="commitForDrafts"
                    @input="(e) => onForFieldInput(index, 'name', e.target.value)"
                  />
                  <span class="for-loop-keyword">{{ $t('simulator:sidebar.objectList.arrayAndConditional.forFrom') }}</span>
                  <input
                    class="for-loop-input"
                    :value="item.start"
                    :style="{ width: Math.max(item.start.length, 1) + 'ch' }"
                    @keydown.stop
                    @keydown.enter="commitForDrafts"
                    @input="(e) => onForFieldInput(index, 'start', e.target.value)"
                  />
                  <span class="for-loop-keyword">{{ $t('simulator:sidebar.objectList.arrayAndConditional.forTo') }}</span>
                  <input
                    class="for-loop-input"
                    :value="item.end"
                    :style="{ width: Math.max(item.end.length, 1) + 'ch' }"
                    @keydown.stop
                    @keydown.enter="commitForDrafts"
                    @input="(e) => onForFieldInput(index, 'end', e.target.value)"
                  />
                  <span class="for-loop-keyword">{{ $t('simulator:sidebar.objectList.arrayAndConditional.forStep') }}</span>
                  <input
                    class="for-loop-input"
                    :value="item.step"
                    :style="{ width: Math.max(item.step.length, 1) + 'ch' }"
                    @keydown.stop
                    @keydown.enter="commitForDrafts"
                    @input="(e) => onForFieldInput(index, 'step', e.target.value)"
                  />
                </div>
              </template>
            </SidebarItemList>
          </div>
        </div>
        <div class="property-list-item">
          <BooleanPropertyControl
            :label="$t('simulator:sidebar.objectList.arrayAndConditional.withCondition')"
            :obj-data="conditionObjData"
            key-path="__if"
            :default="true"
            :is-template="true"
            :module-name="moduleName"
            @update:value="onConditionUpdate"
          />
        </div>
      </div>
    <TransitionGroup name="property-drawer" tag="div" class="property-list-items">
      <div
        v-for="(descriptor, idx) in visibleProperties"
        :key="fullPath(descriptor) || `prop-${idx}`"
        class="property-list-item"
      >
        <!-- Number: component handles its own label -->
        <template v-if="descriptor.type === 'number'">
          <NumberPropertyControl
            :label="descriptor.label || descriptor.key"
            :info="descriptor.info || ''"
            :obj-data="objData"
            :key-path="fullPath(descriptor)"
            :default="getDefaultValue(descriptor)"
            :is-template="isTemplate"
            :module-name="moduleName"
            @update:value="(v) => onPropertyUpdate(descriptor, v)"
          />
        </template>
        <!-- Boolean: component handles its own label -->
        <template v-else-if="descriptor.type === 'boolean'">
          <BooleanPropertyControl
            :label="descriptor.label || descriptor.key"
            :info="descriptor.info || ''"
            :obj-data="objData"
            :key-path="fullPath(descriptor)"
            :default="getDefaultValue(descriptor)"
            :is-template="isTemplate"
            :module-name="moduleName"
            @update:value="(v) => onPropertyUpdate(descriptor, v)"
          />
        </template>
        <!-- Dropdown: component handles its own label -->
        <template v-else-if="descriptor.type === 'dropdown'">
          <DropdownPropertyControl
            :label="descriptor.label || descriptor.key"
            :info="descriptor.info || ''"
            :obj-data="objData"
            :key-path="fullPath(descriptor)"
            :options="descriptor.options || {}"
            :default="getDefaultValue(descriptor)"
            :is-template="isTemplate"
            :module-name="moduleName"
            @update:value="(v) => onPropertyUpdate(descriptor, v)"
          />
        </template>
        <!-- Text: component handles its own label -->
        <template v-else-if="descriptor.type === 'text'">
          <TextPropertyControl
            :label="descriptor.label || descriptor.key"
            :info="descriptor.info || ''"
            :obj-data="objData"
            :key-path="fullPath(descriptor)"
            :default="getDefaultValue(descriptor)"
            :read-only="!!descriptor.readOnly"
            :is-template="isTemplate"
            :module-name="moduleName"
            @update:value="(v) => onPropertyUpdate(descriptor, v)"
          />
        </template>
        <!-- Point: component handles its own label -->
        <template v-else-if="descriptor.type === 'point'">
          <PointPropertyControl
            :label="descriptor.label || descriptor.key"
            :info="descriptor.info || ''"
            :obj-data="objData"
            :key-path="fullPath(descriptor)"
            :default="getDefaultValue(descriptor)"
            :is-template="isTemplate"
            :module-name="moduleName"
            @update:value="(v) => onPropertyUpdate(descriptor, v)"
          />
        </template>
        <!-- Style: component handles its own label -->
        <template v-else-if="descriptor.type === 'style'">
          <StylePropertyControl
            :label="descriptor.label || descriptor.key"
            :info="descriptor.info || ''"
            :obj-data="objData"
            :key-path="fullPath(descriptor)"
            :default="getDefaultValue(descriptor)"
            :style-kind="descriptor.styleKind || 'stroke'"
            :is-template="isTemplate"
            :module-name="moduleName"
            @update:value="(v) => onPropertyUpdate(descriptor, v)"
          />
        </template>
        <!-- Equation: component handles its own label -->
        <template v-else-if="descriptor.type === 'equation'">
          <EquationPropertyControl
            :label="descriptor.label || descriptor.key"
            :info="descriptor.info || ''"
            :obj-data="objData"
            :key-path="fullPath(descriptor)"
            :default="getDefaultValue(descriptor)"
            :is-template="isTemplate"
            :module-name="moduleName"
            @update:value="(v) => onPropertyUpdate(descriptor, v)"
          />
        </template>
        <!-- Array: PropertyControlLabel + indented SidebarItemList -->
        <template v-else-if="descriptor.type === 'array' && Array.isArray(descriptor.itemSchema)">
          <PropertyControlLabel
            :label="descriptor.label || descriptor.key"
            :info="descriptor.info || ''"
            :key-paths="[fullPath(descriptor)]"
          />
          <div class="property-list-array-body">
            <SidebarItemList
              :items="getArrayItems(descriptor)"
              :show-add-button="true"
              :add-label="$t('simulator:sidebar.objectList.newItem')"
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
                  :module-name="moduleName"
                  @update:obj-data="onNestedUpdate"
                />
              </template>
            </SidebarItemList>
          </div>
        </template>
        <template v-else>
        <span class="property-list-item-label" v-html="descriptor.label || descriptor.key"></span>
        <div class="property-list-item-editor">
            <input
              type="text"
              class="property-list-input"
              :value="getValueString(descriptor)"
              @keydown.stop
              @input="(e) => onValueInput(descriptor, e.target.value)"
            >
        </div>
        </template>
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
        {{ showForIf ? $t('simulator:sidebar.objectList.arrayAndConditional.remove') : $t('simulator:sidebar.objectList.arrayAndConditional.create') }}
      </button>
    </div>
  </div>
</template>

<script>
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { isNonDefault, getByKeyPath, setByKeyPath, getForIfDefault } from '../../../core/propertyUtils/keyPath.js'
import SidebarItemList from './SidebarItemList.vue'
import NumberPropertyControl from './controls/NumberPropertyControl.vue'
import BooleanPropertyControl from './controls/BooleanPropertyControl.vue'
import DropdownPropertyControl from './controls/DropdownPropertyControl.vue'
import TextPropertyControl from './controls/TextPropertyControl.vue'
import PointPropertyControl from './controls/PointPropertyControl.vue'
import StylePropertyControl from './controls/StylePropertyControl.vue'
import EquationPropertyControl from './controls/EquationPropertyControl.vue'
import PropertyControlLabel from './controls/PropertyControlLabel.vue'
import { app } from '../../services/app'

function isPrimitiveArrayItem(schema) {
  return schema?.length === 1 &&
    (schema[0]?.type === 'number' || schema[0]?.type === 'text')
}

function parseForString(str) {
  try {
    const parts = str.split('=')
    const name = parts[0].trim()
    const parts2 = (parts[1] || '').split(':')
    return {
      name,
      start: parts2[0]?.trim() || '',
      step: parts2[1]?.trim() || '',
      end: parts2[2]?.trim() || ''
    }
  } catch {
    return { name: '', start: '', step: '', end: '' }
  }
}

function formatForString(item) {
  return `${item.name}=${item.start}:${item.step}:${item.end}`
}

function normalizeForValue(value) {
  if (!value || (Array.isArray(value) && value.length === 0)) return []
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.filter(s => typeof s === 'string')
  return []
}

function getNextVarName(existingNames) {
  for (const name of ['i', 'j', 'k']) {
    if (!existingNames.includes(name)) return name
  }
  for (let c = 97; c <= 122; c++) {
    const name = String.fromCharCode(c)
    if (!existingNames.includes(name)) return name
  }
  return 'x'
}

export default {
  name: 'PropertyList',
  components: { SidebarItemList, NumberPropertyControl, BooleanPropertyControl, DropdownPropertyControl, TextPropertyControl, PointPropertyControl, StylePropertyControl, EquationPropertyControl, PropertyControlLabel },
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
    },
    moduleName: {
      type: String,
      default: ''
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

    watch(
      () => props.basePath,
      () => {
        initShowForIf()
      },
      { immediate: true }
    )

    watch(hasForOrIfInData, (has, prev) => {
      if (has) {
        showForIf.value = true
      } else if (prev === true) {
        showForIf.value = false
      }
    })

    const onSceneDocumentEvent = () => {
      nextTick(() => {
        if (hasForOrIfInData.value || !showForIf.value) {
          initShowForIf()
        }
      })
    }

    onMounted(() => {
      document.addEventListener('sceneChanged', onSceneDocumentEvent)
      document.addEventListener('sceneObjsChanged', onSceneDocumentEvent)
    })

    onUnmounted(() => {
      document.removeEventListener('sceneChanged', onSceneDocumentEvent)
      document.removeEventListener('sceneObjsChanged', onSceneDocumentEvent)
    })

    const forIfPath = (key) => {
      return props.basePath ? `${props.basePath}.${key}` : key
    }

    const getForIfValue = (key) => getByKeyPath(props.objData, forIfPath(key))

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

    // --- For loop drafts ---
    const forDrafts = ref([])
    const currentForValue = computed(() => getForIfValue('for'))

    watch(currentForValue, (forValue) => {
      forDrafts.value = normalizeForValue(forValue).map(parseForString)
    }, { immediate: true, deep: true })

    const onForFieldInput = (index, field, value) => {
      if (forDrafts.value[index]) {
        forDrafts.value[index][field] = value
      }
    }

    const commitForDrafts = () => {
      const strings = forDrafts.value.map(formatForString)
      let value
      if (strings.length === 0) {
        value = []
      } else if (strings.length === 1) {
        value = strings[0]
      } else {
        value = strings
      }
      applyUpdate(forIfPath('for'), value)
    }

    const onForItemFocusOut = (event) => {
      const container = event.currentTarget
      if (container && !container.contains(event.relatedTarget)) {
        commitForDrafts()
      }
    }

    const onForLoopCreate = () => {
      const existingNames = forDrafts.value.map(d => d.name)
      const name = getNextVarName(existingNames)
      forDrafts.value = [...forDrafts.value, { name, start: '1', step: '1', end: '5' }]
      commitForDrafts()
    }

    const onForLoopRemove = (index) => {
      forDrafts.value = forDrafts.value.filter((_, i) => i !== index)
      commitForDrafts()
    }

    const onForLoopDuplicate = (index) => {
      const item = { ...forDrafts.value[index] }
      const next = [...forDrafts.value]
      next.splice(index + 1, 0, item)
      forDrafts.value = next
      commitForDrafts()
    }

    const onForLoopReorder = ({ fromIndex, toIndex }) => {
      const next = [...forDrafts.value]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      forDrafts.value = next
      commitForDrafts()
    }

    // --- Condition (if) adapter for BooleanPropertyControl ---
    const conditionObjData = computed(() => {
      const v = getForIfValue('if')
      let displayed = v
      if (typeof v === 'string' && !v.startsWith('`')) {
        displayed = '`' + v + '`'
      }
      return { __if: displayed }
    })

    const onConditionUpdate = (value) => {
      if (value === undefined) {
        applyUpdate(forIfPath('if'), true)
        return
      }
      if (typeof value === 'string' && value.startsWith('`') && value.endsWith('`')) {
        value = value.slice(1, -1)
      }
      applyUpdate(forIfPath('if'), value)
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

    const getDefaultValue = (descriptor) => {
      const path = fullPath(descriptor)
      return getByKeyPath(props.serializableDefaults, path)
    }

    const onPropertyUpdate = (descriptor, value) => {
      applyUpdate(fullPath(descriptor), value)
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

    const applyUpdate = (path, value) => {
      const next = JSON.parse(JSON.stringify(props.objData || {}))
      if (path === '') {
        Object.assign(next, value)
      } else {
        setByKeyPath(next, path, value, props.serializableDefaults)
      }
      const prevSelection = app.editor?.selectedObjIndex ?? -1
      emit('update:objData', next)
      if (!props.isTemplate && prevSelection >= 0) {
        app.editor?.selectObj(prevSelection)
      }
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
      onToggleForIf,
      forDrafts,
      onForFieldInput,
      commitForDrafts,
      onForItemFocusOut,
      onForLoopCreate,
      onForLoopRemove,
      onForLoopDuplicate,
      onForLoopReorder,
      conditionObjData,
      onConditionUpdate,
      visibleProperties,
      fullPath,
      getDefaultValue,
      getValueString,
      onPropertyUpdate,
      onValueInput,
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
  margin-top: 6px;
  width: 100%;
  min-width: 0;
}

.property-list-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
  padding-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.15);
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

.property-list-array-body {
  width: 100%;
  margin-top: 2px;
}

.for-if-box {
  background: rgba(120, 198, 255, 0.15);
  border: 1px solid rgba(120, 198, 255, 0.5);
  border-radius: 6px;
  padding: 10px 8px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.for-loop-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  width: 100%;
}

.for-loop-input {
  font-size: 11px;
  font-family: monospace;
  padding: 2px 4px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.9);
  box-sizing: content-box;
  min-width: 25px;
}

.for-loop-input:focus {
  outline: none;
  border-color: rgba(120, 198, 255, 0.6);
}

.for-loop-keyword {
  white-space: nowrap;
}
</style>
