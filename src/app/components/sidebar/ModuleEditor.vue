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
    <div class="module-editor-section module-editor-control-points">
      <div class="module-editor-title module-editor-title-plain">
        <span class="module-editor-title-label">
          {{ $t('simulator:sidebar.controlPointList.title') }}
          <InfoPopoverIcon
            :content="$t('simulator:sidebar.controlPointList.info')"
          />
        </span>
      </div>
      <div class="module-editor-body">
        <SidebarItemList
          :items="controlPointItems"
          :show-add-button="true"
          :add-label="$t('simulator:sidebar.controlPointList.newItem')"
          :show-checkbox="false"
          :active-id="controlPointListActiveId"
          @remove="handleControlPointRemove"
          @duplicate="handleControlPointDuplicate"
          @reorder="handleControlPointReorder"
          @create="handleControlPointCreate"
          @hover="handleControlPointHover"
          @select="handleControlPointSelect"
        >
          <template #content="{ item, index }">
            <ModuleControlPointListItem
              :module-name="moduleName"
              :point-index="index"
            />
          </template>
        </SidebarItemList>
      </div>
    </div>
    <div class="module-editor-section module-editor-params">
      <div class="module-editor-title module-editor-title-plain">
        <span class="module-editor-title-label">
          {{ $t('simulator:sidebar.parameterList.title') }}
          <InfoPopoverIcon
            :content="$t('simulator:sidebar.parameterList.info')"
          />
        </span>
      </div>
      <div class="module-editor-body">
        <SidebarItemList
          :items="paramItems"
          :show-add-button="true"
          :add-label="$t('simulator:sidebar.parameterList.newItem')"
          :show-checkbox="false"
          :active-id="paramActiveId"
          @remove="handleParamRemove"
          @duplicate="handleParamDuplicate"
          @reorder="handleParamReorder"
          @create="handleParamCreate"
          @select="handleParamSelect"
        >
          <template #content="{ item, index }">
            <ModuleParamListItem
              :module-name="moduleName"
              :name="item.name"
              :min="item.min"
              :max="item.max"
              :step="item.step"
              :default-val="item.defaultVal"
              @update:name="(v) => onParamNameUpdate(index, v)"
              @update:min="(v) => onParamMinUpdate(index, v)"
              @update:max="(v) => onParamMaxUpdate(index, v)"
              @update:step="(v) => onParamStepUpdate(index, v)"
              @update:default-val="(v) => onParamDefaultUpdate(index, v)"
              @commit="commitParamDefs"
            />
          </template>
        </SidebarItemList>
      </div>
    </div>
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
    <div class="module-editor-section module-editor-settings">
      <div class="module-editor-title module-editor-title-plain">
        <span class="module-editor-title-label">
          {{ $t('simulator:sidebar.moduleEditor.settingsTitle') }}
        </span>
      </div>
      <div class="module-editor-body module-editor-settings-body">
        <div
          class="module-editor-max-loop-section"
          @focusin="onMaxLoopLengthFocusIn"
          @focusout="onMaxLoopLengthFocusOut"
        >
          <div class="module-param-field">
            <span class="module-param-keyword">{{ $t('simulator:sidebar.moduleEditor.maxLoopLength') }}</span>
            <input
              class="module-param-input"
              v-model="maxLoopLengthInput"
              :style="{ width: Math.max(maxLoopLengthInput.length, 1) + 'ch' }"
              spellcheck="false"
              @keydown.stop
              @keydown.enter.prevent="onMaxLoopLengthEnter"
            />
          </div>
        </div>
        <div class="module-editor-settings-actions">
          <button type="button" class="module-editor-btn" @click="onRenameClick">
            {{ $t('simulator:sidebar.moduleEditor.renameButton') }}
          </button>
          <button type="button" class="module-editor-btn is-danger" @click="onRemoveClick">
            {{ $t('simulator:sidebar.moduleEditor.removeButton') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import i18next from 'i18next'
import escapeHtml from 'escape-html'
import * as math from 'mathjs'
import { useSceneStore } from '../../store/scene'
import { app } from '../../services/app'
import SidebarItemList from './SidebarItemList.vue'
import InfoPopoverIcon from '../InfoPopoverIcon.vue'
import ObjTemplateListItemContent from './ObjTemplateListItemContent.vue'
import ModuleVariableListItem from './ModuleVariableListItem.vue'
import ModuleParamListItem from './ModuleParamListItem.vue'
import ModuleControlPointListItem from './ModuleControlPointListItem.vue'

/** One sidebar list may have selection at a time; add keys when adding new lists (see clearOtherModuleSidebarLists). */
const MODULE_EDITOR_LIST = Object.freeze({
  OBJECTS: 'objects',
  VARIABLES: 'variables',
  PARAMS: 'params',
  CONTROL_POINTS: 'controlPoints'
})

function parseParamString(str) {
  const s = typeof str === 'string' ? str : String(str ?? '')
  const eq = s.indexOf('=')
  if (eq < 0) {
    return { name: '', min: '0', step: '1', max: '1', defaultExpr: '0', raw: s }
  }
  const name = s.slice(0, eq).trim()
  const rhs = s.slice(eq + 1).trim()
  const parts = rhs.split(':')
  const min = (parts[0] ?? '0').trim()
  const step = (parts[1] ?? '1').trim()
  const max = (parts[2] ?? min).trim()
  const defaultExpr = parts.length >= 4 ? (parts[3] ?? min).trim() : min
  return { name, min, step, max, defaultExpr, raw: s }
}

function serializeParamRow(row) {
  const n = (row.name ?? '').trim()
  if (!n) return null
  const min = (row.min ?? '').trim()
  const st = (row.step ?? '').trim()
  const max = (row.max ?? '').trim()
  const d = (row.defaultVal ?? '').trim()
  const defaultPart = d === '' ? min : d
  return `${n}=${min}:${st}:${max}:${defaultPart}`
}

function evalDefaultNumeric(paramStr) {
  const p = parseParamString(typeof paramStr === 'string' ? paramStr : String(paramStr ?? ''))
  try {
    return math.evaluate(p.defaultExpr, {})
  } catch {
    return NaN
  }
}

function nameSetFromParamStrings(strs) {
  const set = new Set()
  for (const s of strs || []) {
    const n = parseParamString(s).name
    if (n) set.add(n)
  }
  return set
}

function ensureModuleObjParams(ref) {
  if (!ref.params) {
    ref.params = {}
  }
}

function ensureModuleObjPointsArray(ref) {
  if (!Array.isArray(ref.points)) {
    ref.points = []
  }
}

function cloneModuleObjPoint(p) {
  const x = p != null && typeof p === 'object' ? Number(p.x) : 0
  const y = p != null && typeof p === 'object' ? Number(p.y) : 0
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0
  }
}

/**
 * Scene-space point at the viewport center (same formula as observer init when switching to observer mode).
 * @see app/store/scene.js — mode callback
 */
function viewportCenterSceneCoords(scene) {
  if (!scene) {
    return { x: 0, y: 0 }
  }
  const ox = scene.origin?.x ?? 0
  const oy = scene.origin?.y ?? 0
  const scale = scene.scale || 1
  return {
    x: (scene.width * 0.5 - ox) / scale,
    y: (scene.height * 0.5 - oy) / scale
  }
}

function controlPointId(moduleName, index) {
  return `${moduleName}-cp-${index}`
}

const DEFAULT_MODULE_MAX_LOOP_LENGTH = 1000

/** Index `s` after moving one item from `from` to `to`. */
function controlPointIndexAfterReorder(s, from, to) {
  if (s === from) {
    return to
  }
  if (from < to) {
    if (s > from && s <= to) {
      return s - 1
    }
    return s
  }
  if (from > to) {
    if (s >= to && s < from) {
      return s + 1
    }
    return s
  }
  return s
}

function dedupeParamName(base, occupied) {
  const b = (base ?? '').trim() || 'p'
  if (!occupied.includes(b)) return b
  for (let i = 1; i < 100000; i++) {
    const c = `${b}${i}`
    if (!occupied.includes(c)) return c
  }
  return `${b}x`
}

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

/** Next unused single-letter `a`–`z`, then `n0`, `n1`, … — `existingNames` should include both module parameters and variables. */
function getNextModuleIdentifierName(existingNames) {
  const set = new Set(
    (existingNames ?? []).map((n) => String(n ?? '').trim()).filter(Boolean)
  )
  for (let c = 97; c <= 122; c++) {
    const name = String.fromCharCode(c)
    if (!set.has(name)) return name
  }
  for (let i = 0; i < 1_000_000; i++) {
    const name = `n${i}`
    if (!set.has(name)) return name
  }
  return 'n0'
}

export default {
  name: 'ModuleEditor',
  components: {
    SidebarItemList,
    InfoPopoverIcon,
    ObjTemplateListItemContent,
    ModuleVariableListItem,
    ModuleParamListItem,
    ModuleControlPointListItem
  },
  props: {
    moduleName: { type: String, required: true }
  },
  emits: ['module-renamed', 'module-removed'],
  setup(props, { emit }) {
    const scene = useSceneStore()
    const moduleIds = toRef(scene, 'moduleIds')
    const selectedIds = ref([])
    const moduleItems = ref([])
    const controlPointItems = ref([])
    /** Hovered control-point row — drives canvas highlight only. */
    const controlPointHoverIndex = ref(-1)
    /** Click-selected control-point row — drives list `active-id` / row background only. */
    const controlPointSelectedIndex = ref(-1)
    const controlPointListActiveId = computed(() => {
      const i = controlPointSelectedIndex.value
      if (!Number.isInteger(i) || i < 0 || i >= controlPointItems.value.length) {
        return null
      }
      return controlPointItems.value[i]?.id ?? null
    })
    const paramItems = ref([])
    const paramActiveId = ref(null)
    const variableItems = ref([])
    const variableActiveId = ref(null)
    const maxLoopLengthInput = ref(String(DEFAULT_MODULE_MAX_LOOP_LENGTH))
    const maxLoopLengthCommittedSnapshot = ref(maxLoopLengthInput.value)

    const syncMaxLoopLengthField = () => {
      const mod = app.scene?.modules?.[props.moduleName]
      const v = mod?.maxLoopLength
      maxLoopLengthInput.value = String(
        v !== undefined && v !== null ? v : DEFAULT_MODULE_MAX_LOOP_LENGTH
      )
    }

    const commitMaxLoopLength = () => {
      const mod = app.scene?.modules?.[props.moduleName]
      if (!mod) {
        return
      }
      const trimmed = maxLoopLengthInput.value.trim()
      const n = parseInt(trimmed, 10)
      if (trimmed === '' || !Number.isFinite(n) || n < 1) {
        syncMaxLoopLengthField()
        maxLoopLengthCommittedSnapshot.value = maxLoopLengthInput.value
        return
      }
      const had = Object.prototype.hasOwnProperty.call(mod, 'maxLoopLength')
      const beforeVal = mod.maxLoopLength
      if (n === DEFAULT_MODULE_MAX_LOOP_LENGTH) {
        if (had) {
          delete mod.maxLoopLength
        }
      } else {
        mod.maxLoopLength = n
      }
      const changed =
        (n === DEFAULT_MODULE_MAX_LOOP_LENGTH && had) ||
        (n !== DEFAULT_MODULE_MAX_LOOP_LENGTH && (!had || beforeVal !== n))
      syncMaxLoopLengthField()
      maxLoopLengthCommittedSnapshot.value = maxLoopLengthInput.value
      if (changed) {
        app.scene.reloadAllModules?.()
        app.simulator?.updateSimulation(false, true)
        app.editor?.onActionComplete()
      }
    }

    const onMaxLoopLengthFocusIn = () => {
      maxLoopLengthCommittedSnapshot.value = maxLoopLengthInput.value
    }

    const onMaxLoopLengthFocusOut = (event) => {
      const container = event.currentTarget
      if (container && !container.contains(event.relatedTarget)) {
        if (maxLoopLengthInput.value !== maxLoopLengthCommittedSnapshot.value) {
          commitMaxLoopLength()
        }
      }
    }

    const onMaxLoopLengthEnter = () => {
      commitMaxLoopLength()
    }

    const getOccupiedModuleNames = () => {
      const paramNames = paramItems.value.map((r) => String(r.name ?? '').trim()).filter(Boolean)
      const varNames = variableItems.value.map((r) => String(r.name ?? '').trim()).filter(Boolean)
      return [...paramNames, ...varNames]
    }

    const reselectEditorModuleInstanceIfNeeded = () => {
      const editor = app.editor
      const idx = editor?.selectedObjIndex ?? -1
      const objs = app.scene?.objs
      if (editor && Array.isArray(objs) && idx >= 0 && idx < objs.length) {
        const sel = objs[idx]
        if (sel?.constructor?.type === 'ModuleObj' && sel.module === props.moduleName) {
          editor.selectObj(idx)
        }
      }
    }

    const applyModuleParamHighlight = (paramName) => {
      const trimmed =
        paramName != null && String(paramName).trim() ? String(paramName).trim() : null
      const applyToObj = (obj) => {
        if (!obj || obj.constructor?.type !== 'ModuleObj') {
          return
        }
        if (obj.module === props.moduleName) {
          obj.setHighlightedParamName?.(trimmed)
        }
        if (Array.isArray(obj.objs)) {
          for (const child of obj.objs) {
            if (child?.constructor?.type === 'ModuleObj') {
              applyToObj(child)
            }
          }
        }
      }
      for (const obj of app.scene?.objs || []) {
        applyToObj(obj)
      }
      reselectEditorModuleInstanceIfNeeded()
    }

    const applyModulePointHighlight = (pointIndex) => {
      const idx =
        Number.isInteger(pointIndex) && pointIndex >= 0 ? pointIndex : null
      const applyToObj = (obj) => {
        if (!obj || obj.constructor?.type !== 'ModuleObj') {
          return
        }
        if (obj.module === props.moduleName) {
          obj.setHighlightedPointIndex?.(idx)
        }
        if (Array.isArray(obj.objs)) {
          for (const child of obj.objs) {
            if (child?.constructor?.type === 'ModuleObj') {
              applyToObj(child)
            }
          }
        }
      }
      for (const obj of app.scene?.objs || []) {
        applyToObj(obj)
      }
      reselectEditorModuleInstanceIfNeeded()
      app.simulator?.updateSimulation?.(true, true)
    }

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

    const syncParamItems = () => {
      const raw = app.scene?.modules?.[props.moduleName]?.params || []
      paramItems.value = raw.map((entry, index) => {
        const p = parseParamString(typeof entry === 'string' ? entry : String(entry ?? ''))
        return {
          id: `${props.moduleName}-param-${index}`,
          name: p.name,
          min: p.min,
          step: p.step,
          max: p.max,
          defaultVal: p.defaultExpr
        }
      })
      if (!paramItems.value.some((item) => item.id === paramActiveId.value)) {
        paramActiveId.value = null
        applyModuleParamHighlight(null)
      }
    }

    const syncControlPointItems = () => {
      const mod = app.scene?.modules?.[props.moduleName]
      const n = mod?.numPoints ?? 0
      const safeN = Math.max(0, Number.isFinite(n) ? Math.floor(n) : 0)
      if (mod) {
        mod.numPoints = safeN
      }
      controlPointItems.value = Array.from({ length: safeN }, (_, i) => ({
        id: controlPointId(props.moduleName, i)
      }))
      if (controlPointHoverIndex.value >= controlPointItems.value.length) {
        controlPointHoverIndex.value = -1
        applyModulePointHighlight(null)
      }
      if (controlPointSelectedIndex.value >= controlPointItems.value.length) {
        controlPointSelectedIndex.value = -1
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
      syncVariableItems()
      app.scene.reloadAllModules?.()
      app.simulator?.updateSimulation(false, true)
      app.editor?.onActionComplete()
    }

    const commitControlPointGeometry = () => {
      if (!app.scene?.modules?.[props.moduleName]) {
        return
      }
      syncControlPointItems()
      app.scene.reloadAllModules?.()
      const activeN = controlPointHoverIndex.value >= 0 ? controlPointHoverIndex.value : null
      applyModulePointHighlight(activeN)
      app.simulator?.updateSimulation(false, true)
      app.editor?.onActionComplete()
    }

    const commitParamDefs = () => {
      if (!app.scene?.modules?.[props.moduleName]) {
        return
      }
      const mod = app.scene.modules[props.moduleName]
      const nextStrs = paramItems.value.map(serializeParamRow).filter(Boolean)
      const oldStrs = [...(mod.params || [])]
      const oldSet = nameSetFromParamStrings(oldStrs)
      const newSet = nameSetFromParamStrings(nextStrs)
      const refs = app.scene.getModuleObjRefsById?.(props.moduleName) || []

      const removed = [...oldSet].filter((n) => !newSet.has(n))
      const added = [...newSet].filter((n) => !oldSet.has(n))

      for (const n of oldSet) {
        if (!newSet.has(n)) continue
        const oldSpec = oldStrs.find((s) => parseParamString(s).name === n)
        const newSpec = nextStrs.find((s) => parseParamString(s).name === n)
        const dOld = evalDefaultNumeric(oldSpec)
        const dNew = evalDefaultNumeric(newSpec)
        if (dOld === dNew || Number.isNaN(dOld) || Number.isNaN(dNew)) continue
        for (const ref of refs) {
          if (ref.params && Object.prototype.hasOwnProperty.call(ref.params, n) && ref.params[n] === dOld) {
            ref.params[n] = dNew
          }
        }
      }

      if (removed.length === 1 && added.length === 1) {
        const oldN = removed[0]
        const newN = added[0]
        const oldSpec = oldStrs.find((s) => parseParamString(s).name === oldN)
        const newSpec = nextStrs.find((s) => parseParamString(s).name === newN)
        const dOld = evalDefaultNumeric(oldSpec)
        const dNew = evalDefaultNumeric(newSpec)
        for (const ref of refs) {
          ensureModuleObjParams(ref)
          const had = Object.prototype.hasOwnProperty.call(ref.params, oldN)
          let v = had ? ref.params[oldN] : dNew
          delete ref.params[oldN]
          if (had && dOld !== dNew && !Number.isNaN(dOld) && !Number.isNaN(dNew) && v === dOld) {
            v = dNew
          }
          ref.params[newN] = v
        }
      } else {
        for (const n of removed) {
          for (const ref of refs) {
            if (ref.params && Object.prototype.hasOwnProperty.call(ref.params, n)) {
              delete ref.params[n]
            }
          }
        }
        for (const n of added) {
          const specStr = nextStrs.find((s) => parseParamString(s).name === n)
          const dNew = evalDefaultNumeric(specStr)
          for (const ref of refs) {
            ensureModuleObjParams(ref)
            if (!(n in ref.params)) {
              ref.params[n] = dNew
            }
          }
        }
      }

      mod.params = nextStrs
      syncParamItems()
      app.scene.reloadAllModules?.()
      const activeParamRow = paramItems.value.find((r) => r.id === paramActiveId.value)
      applyModuleParamHighlight(activeParamRow?.name ?? null)

      app.simulator?.updateSimulation(false, true)
      app.editor?.onActionComplete()
    }

    const onParamNameUpdate = (index, value) => {
      const row = paramItems.value[index]
      if (row) row.name = value
    }
    const onParamMinUpdate = (index, value) => {
      const row = paramItems.value[index]
      if (row) row.min = value
    }
    const onParamMaxUpdate = (index, value) => {
      const row = paramItems.value[index]
      if (row) row.max = value
    }
    const onParamStepUpdate = (index, value) => {
      const row = paramItems.value[index]
      if (row) row.step = value
    }
    const onParamDefaultUpdate = (index, value) => {
      const row = paramItems.value[index]
      if (row) row.defaultVal = value
    }

    const handleParamRemove = (item, index) => {
      paramItems.value = paramItems.value.filter((_, i) => i !== index)
      commitParamDefs()
    }

    const handleParamDuplicate = (item, index) => {
      const row = paramItems.value[index]
      if (!row) return
      const newName = dedupeParamName(row.name, getOccupiedModuleNames())
      const clone = {
        id: `${props.moduleName}-param-${paramItems.value.length}`,
        name: newName,
        min: row.min,
        step: row.step,
        max: row.max,
        defaultVal: row.defaultVal
      }
      const next = [...paramItems.value]
      next.splice(index + 1, 0, clone)
      paramItems.value = next
      commitParamDefs()
    }

    const handleParamReorder = ({ fromIndex, toIndex }) => {
      if (fromIndex === toIndex) return
      const next = [...paramItems.value]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      paramItems.value = next
      commitParamDefs()
    }

    const handleControlPointRemove = (item, index) => {
      const mod = app.scene?.modules?.[props.moduleName]
      if (!mod) {
        return
      }
      const refs = app.scene.getModuleObjRefsById?.(props.moduleName) || []
      const n = Math.max(0, (mod.numPoints ?? 0) - 1)
      mod.numPoints = n
      for (const ref of refs) {
        ensureModuleObjPointsArray(ref)
        if (ref.points.length > index) {
          ref.points.splice(index, 1)
        }
      }
      const hov = controlPointHoverIndex.value
      if (hov === index) {
        controlPointHoverIndex.value = -1
      } else if (hov > index) {
        controlPointHoverIndex.value = hov - 1
      }
      const sel = controlPointSelectedIndex.value
      if (sel === index) {
        controlPointSelectedIndex.value = -1
      } else if (sel > index) {
        controlPointSelectedIndex.value = sel - 1
      }
      commitControlPointGeometry()
    }

    const handleControlPointDuplicate = (item, index) => {
      const mod = app.scene?.modules?.[props.moduleName]
      if (!mod) {
        return
      }
      const refs = app.scene.getModuleObjRefsById?.(props.moduleName) || []
      mod.numPoints = (mod.numPoints ?? 0) + 1
      for (const ref of refs) {
        ensureModuleObjPointsArray(ref)
        const copy = cloneModuleObjPoint(ref.points[index])
        ref.points.splice(index + 1, 0, copy)
      }
      const hov = controlPointHoverIndex.value
      if (hov > index) {
        controlPointHoverIndex.value = hov + 1
      }
      const sel = controlPointSelectedIndex.value
      if (sel > index) {
        controlPointSelectedIndex.value = sel + 1
      }
      commitControlPointGeometry()
    }

    const handleControlPointReorder = ({ fromIndex, toIndex }) => {
      if (fromIndex === toIndex) {
        return
      }
      const mod = app.scene?.modules?.[props.moduleName]
      if (!mod) {
        return
      }
      const count = Math.max(0, mod.numPoints ?? 0)
      const refs = app.scene.getModuleObjRefsById?.(props.moduleName) || []
      for (const ref of refs) {
        ensureModuleObjPointsArray(ref)
        while (ref.points.length < count) {
          ref.points.push({ x: 0, y: 0 })
        }
        while (ref.points.length > count) {
          ref.points.pop()
        }
        if (ref.points.length <= Math.max(fromIndex, toIndex)) {
          continue
        }
        const next = [...ref.points]
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        ref.points = next
      }
      const hov = controlPointHoverIndex.value
      if (hov >= 0) {
        controlPointHoverIndex.value = controlPointIndexAfterReorder(hov, fromIndex, toIndex)
      }
      const sel = controlPointSelectedIndex.value
      if (sel >= 0) {
        controlPointSelectedIndex.value = controlPointIndexAfterReorder(sel, fromIndex, toIndex)
      }
      commitControlPointGeometry()
    }

    const handleControlPointCreate = () => {
      const mod = app.scene?.modules?.[props.moduleName]
      if (!mod) {
        return
      }
      const scene = app.scene
      const refs = scene?.getModuleObjRefsById?.(props.moduleName) || []
      const prevCount = mod.numPoints ?? 0
      const isFirst = prevCount === 0
      const gridSize = scene?.gridSize ?? 20
      mod.numPoints = prevCount + 1
      for (const ref of refs) {
        ensureModuleObjPointsArray(ref)
        if (isFirst) {
          const c = viewportCenterSceneCoords(scene)
          ref.points.push({ x: c.x, y: c.y })
        } else {
          const last = ref.points.length > 0 ? ref.points[ref.points.length - 1] : null
          const b = cloneModuleObjPoint(last)
          ref.points.push({ x: b.x + gridSize, y: b.y + gridSize })
        }
      }
      commitControlPointGeometry()
    }

    const handleControlPointHover = ({ item, index }) => {
      if (item == null || typeof index !== 'number' || index < 0) {
        controlPointHoverIndex.value = -1
        applyModulePointHighlight(null)
        return
      }
      controlPointHoverIndex.value = index
      applyModulePointHighlight(index)
    }

    const handleControlPointSelect = ({ item, index }) => {
      if (!item) {
        return
      }
      clearOtherModuleSidebarLists(MODULE_EDITOR_LIST.CONTROL_POINTS)
      controlPointSelectedIndex.value = typeof index === 'number' ? index : -1
    }

    const handleParamCreate = () => {
      const name = getNextModuleIdentifierName(getOccupiedModuleNames())
      paramItems.value = [
        ...paramItems.value,
        {
          id: `${props.moduleName}-param-${paramItems.value.length}`,
          name,
          min: '1',
          step: '1',
          max: '10',
          defaultVal: '1'
        }
      ]
      commitParamDefs()
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
      const newName = dedupeParamName(row.name, getOccupiedModuleNames())
      const clone = { id: `${props.moduleName}-var-${variableItems.value.length}`, name: newName, expression: row.expression }
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
      variableItems.value = [
        ...variableItems.value,
        {
          id: `${props.moduleName}-var-${variableItems.value.length}`,
          name: getNextModuleIdentifierName(getOccupiedModuleNames()),
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
      syncModuleItems()
      app.scene.reloadAllModules?.()
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
      if (keepKind !== MODULE_EDITOR_LIST.PARAMS) {
        paramActiveId.value = null
        applyModuleParamHighlight(null)
      }
      if (keepKind !== MODULE_EDITOR_LIST.CONTROL_POINTS) {
        controlPointHoverIndex.value = -1
        controlPointSelectedIndex.value = -1
        applyModulePointHighlight(null)
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
        paramActiveId.value = null
        applyModuleParamHighlight(null)
        controlPointHoverIndex.value = -1
        controlPointSelectedIndex.value = -1
        applyModulePointHighlight(null)
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

    const handleParamSelect = ({ item }) => {
      if (!item) {
        return
      }
      clearOtherModuleSidebarLists(MODULE_EDITOR_LIST.PARAMS)
      paramActiveId.value = item.id
      applyModuleParamHighlight(item.name)
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
      paramActiveId.value = null
      controlPointHoverIndex.value = -1
      controlPointSelectedIndex.value = -1
      hoveredIndex.value = -1
      applyModuleHighlights([])
      applyModuleParamHighlight(null)
      applyModulePointHighlight(null)
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
        variableActiveId.value === null &&
        paramActiveId.value === null &&
        controlPointHoverIndex.value < 0 &&
        controlPointSelectedIndex.value < 0
      ) {
        return
      }
      variableActiveId.value = null
      paramActiveId.value = null
      controlPointHoverIndex.value = -1
      controlPointSelectedIndex.value = -1
      selectedIds.value = []
      activeId.value = null
      hoveredIndex.value = -1
      applyModuleHighlights([])
      applyModuleParamHighlight(null)
      applyModulePointHighlight(null)
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
        syncControlPointItems()
        syncParamItems()
        syncVariableItems()
        syncMaxLoopLengthField()
        maxLoopLengthCommittedSnapshot.value = maxLoopLengthInput.value
        selectModuleInstance()
        hoveredIndex.value = -1
        variableActiveId.value = null
        paramActiveId.value = null
        controlPointHoverIndex.value = -1
        controlPointSelectedIndex.value = -1
        applyModuleHighlights([])
        applyModuleParamHighlight(null)
        applyModulePointHighlight(null)
      },
      { immediate: true }
    )

    const onSceneChanged = () => {
      syncModuleItems()
      syncControlPointItems()
      syncParamItems()
      syncVariableItems()
      syncMaxLoopLengthField()
      maxLoopLengthCommittedSnapshot.value = maxLoopLengthInput.value
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
      applyModuleParamHighlight(null)
      applyModulePointHighlight(null)
      document.removeEventListener('clearVisualEditorSelection', onClearVisualSelection)
      document.removeEventListener('sceneObjSelectionChanged', onEditorSelectionChange)
      document.removeEventListener('sceneChanged', onSceneChanged)
      document.removeEventListener('sceneObjsChanged', onSceneChanged)
    })

    return {
      selectedIds,
      moduleItems,
      controlPointItems,
      controlPointListActiveId,
      handleControlPointRemove,
      handleControlPointDuplicate,
      handleControlPointReorder,
      handleControlPointCreate,
      handleControlPointHover,
      handleControlPointSelect,
      paramItems,
      paramActiveId,
      variableItems,
      variableActiveId,
      commitParamDefs,
      onParamNameUpdate,
      onParamMinUpdate,
      onParamMaxUpdate,
      onParamStepUpdate,
      onParamDefaultUpdate,
      handleParamRemove,
      handleParamDuplicate,
      handleParamReorder,
      handleParamCreate,
      handleParamSelect,
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
      selectModuleInstance,
      maxLoopLengthInput,
      onMaxLoopLengthFocusIn,
      onMaxLoopLengthFocusOut,
      onMaxLoopLengthEnter
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

/* Rhythm between major blocks only (not above the first block). */
.module-editor > .module-editor-warning + .module-editor-section,
.module-editor > .module-editor-section + .module-editor-section,
.module-editor > .module-editor-section + .module-editor-title,
.module-editor > .module-editor-body + .module-editor-section {
  margin-top: 14px;
}

.module-editor-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
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

.module-editor-settings-actions {
  display: flex;
  flex-wrap: wrap;
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

.module-editor-max-loop-section {
  padding-left: 2px;
  padding-right: 3px;
}

.module-editor-max-loop-section .module-param-field {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 5px;
  flex-shrink: 0;
}

.module-editor-max-loop-section .module-param-keyword {
  white-space: nowrap;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
}

.module-editor-max-loop-section .module-param-input {
  font-size: 12px;
  font-family: monospace;
  padding: 2px 4px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.9);
  box-sizing: content-box;
  min-width: 24px;
}

.module-editor-max-loop-section .module-param-input:focus {
  outline: none;
  border-color: rgba(120, 198, 255, 0.6);
}
</style>


