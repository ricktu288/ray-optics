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
  <div class="formula-input-host" @mouseleave="onModuleInstancesMouseLeave">
    <textarea
      ref="textareaRef"
      class="formula-input"
      :value="localValue"
      rows="1"
      spellcheck="false"
      @keydown.stop
      @keydown.enter.prevent="commitEnter"
      @focus="onFocus"
      @blur="onBlur"
      @input="onInput"
    ></textarea>
  </div>
</template>

<script>
import { ref, watch, toRef, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as bootstrap from 'bootstrap'
import escapeHtml from 'escape-html'
import { usePreferencesStore } from '../../../store/preferences'
import { useSceneStore } from '../../../store/scene'
import { app } from '../../../services/app'

/** Mantissa decimal places as shown by Number#toString (handles scientific notation). */
function tooltipMantissaDecimalPlaces(n) {
  const s = n.toString().toLowerCase()
  const eIdx = s.indexOf('e')
  const mantissa = eIdx >= 0 ? s.slice(0, eIdx) : s
  const dot = mantissa.indexOf('.')
  return dot < 0 ? 0 : mantissa.length - dot - 1
}

/** If the value shows 4+ digits after the decimal point, round for display to 3 places. */
function formatTooltipNumber(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    return String(n)
  }
  if (tooltipMantissaDecimalPlaces(n) < 4) {
    return String(n)
  }
  const rounded = Math.round(n * 1000) / 1000
  let t = rounded.toFixed(3)
  if (t.includes('.')) {
    t = t.replace(/0+$/, '').replace(/\.$/, '')
  }
  return t
}

function formatExpandedInstanceValue(v) {
  if (v === undefined || v === null) {
    return '—'
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return formatTooltipNumber(v)
  }
  if (typeof v === 'boolean') {
    return v ? 'true' : 'false'
  }
  if (typeof v === 'string') {
    return v
  }
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

/** Equality for tooltip collapse; uses raw values (not rounded / not display-truncated). */
function tooltipValueEqualForCollapse(x, y) {
  if (Object.is(x, y)) return true
  if (typeof x !== typeof y) return false
  if (x === null || y === null) return x === y
  if (typeof x !== 'object') return false
  if (Array.isArray(x) && Array.isArray(y)) {
    if (x.length !== y.length) return false
    for (let i = 0; i < x.length; i++) {
      if (!tooltipValueEqualForCollapse(x[i], y[i])) return false
    }
    return true
  }
  if (Array.isArray(x) || Array.isArray(y)) return false
  try {
    return JSON.stringify(x) === JSON.stringify(y)
  } catch {
    return false
  }
}

/** One expansion row as a tuple (e.g. point x,y); whole tuple must match to collapse. */
function tooltipPointTupleEqual(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!tooltipValueEqualForCollapse(a[i], b[i])) return false
  }
  return true
}

function tooltipTupleAllCellsMissing(tuple) {
  return tuple.every((cell) => cell === undefined || cell === null)
}

/** True if every collected tuple row equals row 0 (raw values). */
function tooltipAllTupleRowsConstant(rows) {
  if (rows.length <= 1) return true
  const first = rows[0]
  for (let j = 1; j < rows.length; j++) {
    if (!tooltipPointTupleEqual(first, rows[j])) {
      return false
    }
  }
  return true
}

/** Single JS-style numeric token (no thousands separators). */
const LITERAL_NUMERIC_TOKEN =
  /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

/**
 * Max tooltip lines when listing distinct expanded values across instances/rows.
 * When exceeded, shows first (this − 2) value rows, an ellipsis line, then the last row.
 */
const FORMULA_MODULE_TOOLTIP_MAX_LINES = 4

/**
 * True when the field is a plain number or comma-separated list of numbers (literal user input).
 * In that case we skip the expanded-instance tooltip.
 */
function isLiteralNumericFieldValue(text) {
  if (typeof text !== 'string') {
    return false
  }
  const t = text.trim()
  if (t === '' || t.includes('`')) {
    return false
  }
  const parts = t.split(',')
  for (const p of parts) {
    const s = p.trim()
    if (s === '' || !LITERAL_NUMERIC_TOKEN.test(s)) {
      return false
    }
  }
  return true
}

/**
 * True when the field is the boolean literals `true` or `false` only (after trim).
 * Same escape hatch as numeric literals: skip expanded-instance tooltip.
 */
function isLiteralBooleanFieldValue(text) {
  if (typeof text !== 'string') {
    return false
  }
  const t = text.trim()
  if (t === '' || t.includes('`')) {
    return false
  }
  return t === 'true' || t === 'false'
}

export default {
  name: 'FormulaInput',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    /** Property key path(s) relative to the template object (same as PropertyControlLabel keyPaths). */
    moduleInstanceKeyPaths: {
      type: [String, Array],
      default: undefined
    },
    moduleName: {
      type: String,
      default: ''
    },
    templateSourceIndex: {
      type: Number,
      default: -1
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const textareaRef = ref(null)
    const localValue = ref(props.modelValue)
    /** Snapshot when focus started; blur skips emit if text unchanged. */
    const valueAtFocus = ref('')
    let focused = false

    const sceneStore = useSceneStore()
    const preferences = usePreferencesStore()
    const sidebarWidth = toRef(preferences, 'sidebarWidth')
    const editorSelectedObjIndex = ref(-1)

    const normalizedModuleKeyPaths = computed(() => {
      const p = props.moduleInstanceKeyPaths
      if (p == null || p === '') {
        return []
      }
      return (Array.isArray(p) ? p : [p]).filter((s) => s != null && s !== '')
    })

    const moduleInstancesTooltipContent = computed(() => {
      if (
        !props.moduleName ||
        props.templateSourceIndex < 0 ||
        normalizedModuleKeyPaths.value.length === 0
      ) {
        return ''
      }
      void localValue.value
      if (
        isLiteralNumericFieldValue(localValue.value) ||
        isLiteralBooleanFieldValue(localValue.value)
      ) {
        return ''
      }
      void sceneStore.state.objList.length
      void editorSelectedObjIndex.value
      const instances = app.editor?.getActiveModuleInstances?.(props.moduleName)
      if (!instances?.length) {
        return ''
      }
      const paths = normalizedModuleKeyPaths.value

      const formatTooltipTupleRow = (tuple) => {
        const parts = tuple.map((cell) =>
          escapeHtml(formatExpandedInstanceValue(cell))
        )
        return parts.join(', ')
      }

      /** @type {Array<Array<*>>} One row per expanded slot: tuple of raw cells per key path */
      const allRows = []
      for (const inst of instances) {
        if (!inst || typeof inst.getExpandedPropertyValues !== 'function') {
          continue
        }
        const valueArrays = paths.map((kp) => {
          const sourceKeyPath = `${props.templateSourceIndex}.${kp}`
          return inst.getExpandedPropertyValues(sourceKeyPath)
        })
        const maxLen = Math.max(...valueArrays.map((a) => a.length), 0)
        for (let j = 0; j < maxLen; j++) {
          const tuple = valueArrays.map((arr) => arr[j])
          if (!tooltipTupleAllCellsMissing(tuple)) {
            allRows.push(tuple)
          }
        }
      }
      if (!allRows.length) {
        return ''
      }

      const maxLines = Math.max(3, FORMULA_MODULE_TOOLTIP_MAX_LINES)
      const n = allRows.length
      let lines
      if (n > 1 && tooltipAllTupleRowsConstant(allRows)) {
        lines = ['=' + formatTooltipTupleRow(allRows[0])]
      } else if (n <= maxLines) {
        lines = [
          '=' + formatTooltipTupleRow(allRows[0]),
          ...allRows.slice(1).map((row) => '&nbsp;' + formatTooltipTupleRow(row))
        ]
      } else {
        const headLen = maxLines - 2
        const head = allRows.slice(0, headLen)
        const last = allRows[n - 1]
        lines = [
          '=' + formatTooltipTupleRow(head[0]),
          ...head.slice(1).map((row) => '&nbsp;' + formatTooltipTupleRow(row)),
          '&nbsp;...',
          '&nbsp;' + formatTooltipTupleRow(last)
        ]
      }
      return lines.join('<br>')
    })

    let moduleInstancesTooltip = null

    const disposeModuleInstancesTooltip = () => {
      if (moduleInstancesTooltip) {
        moduleInstancesTooltip.dispose()
        moduleInstancesTooltip = null
      }
    }

    const showModuleInstancesTooltip = (el) => {
      const content = moduleInstancesTooltipContent.value
      if (!content || !el) {
        return
      }
      disposeModuleInstancesTooltip()
      moduleInstancesTooltip = new bootstrap.Tooltip(el, {
        title: content,
        html: true,
        trigger: 'manual',
        placement: 'right',
        customClass: 'formula-input-module-tooltip'
      })
      nextTick(() => {
        moduleInstancesTooltip?.show()
      })
    }

    const onModuleInstancesMouseLeave = () => {
      disposeModuleInstancesTooltip()
    }

    watch(() => props.modelValue, (v) => {
      if (!focused) {
        localValue.value = v
        nextTick(autoResize)
      }
    })

    watch(sidebarWidth, () => nextTick(autoResize))

    const autoResize = () => {
      const el = textareaRef.value
      if (!el) return
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }

    const syncEditorSelection = () => {
      editorSelectedObjIndex.value = app.editor?.selectedObjIndex ?? -1
    }

    const onSceneObjSelectionChanged = (event) => {
      editorSelectedObjIndex.value = event?.detail?.index ?? -1
    }

    const onSceneStructureMaybeChanged = () => {
      syncEditorSelection()
    }

    onMounted(() => {
      syncEditorSelection()
      document.addEventListener('sceneObjSelectionChanged', onSceneObjSelectionChanged)
      document.addEventListener('sceneChanged', onSceneStructureMaybeChanged)
      document.addEventListener('sceneObjsChanged', onSceneStructureMaybeChanged)
      autoResize()
    })

    onBeforeUnmount(() => {
      document.removeEventListener('sceneObjSelectionChanged', onSceneObjSelectionChanged)
      document.removeEventListener('sceneChanged', onSceneStructureMaybeChanged)
      document.removeEventListener('sceneObjsChanged', onSceneStructureMaybeChanged)
      disposeModuleInstancesTooltip()
    })

    const onFocus = () => {
      valueAtFocus.value = localValue.value
      focused = true
      showModuleInstancesTooltip(textareaRef.value)
    }

    const onBlur = () => {
      commitBlur()
    }

    const onInput = (e) => {
      localValue.value = e.target.value
      autoResize()
      disposeModuleInstancesTooltip()
    }

    const commitBlur = () => {
      focused = false
      disposeModuleInstancesTooltip()
      if (localValue.value !== valueAtFocus.value) {
        emit('update:modelValue', localValue.value)
      }
    }

    /**
     * Enter: parent may reject the edit. Only reshow the instance tooltip when the model syncs
     * (accepted) and the field is still focused.
     */
    const commitEnter = () => {
      focused = false
      disposeModuleInstancesTooltip()
      emit('update:modelValue', localValue.value)
      nextTick(() => {
        if (localValue.value !== props.modelValue) {
          return
        }
        const el = textareaRef.value
        if (!el || document.activeElement !== el) {
          return
        }
        if (
          isLiteralNumericFieldValue(localValue.value) ||
          isLiteralBooleanFieldValue(localValue.value)
        ) {
          return
        }
        focused = true
        showModuleInstancesTooltip(el)
      })
    }

    return {
      textareaRef,
      localValue,
      onFocus,
      onBlur,
      onInput,
      commit: commitBlur,
      commitEnter,
      onModuleInstancesMouseLeave
    }
  }
}
</script>

<style scoped>
.formula-input-host {
  flex: 1 1 0;
  min-width: 0;
  display: block;
}

.formula-input {
  width: 100%;
  box-sizing: border-box;
  font-size: 11px;
  font-family: monospace;
  line-height: 1.4;
  padding: 3px 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.9);
  resize: none;
  overflow: hidden;
  field-sizing: content;
}

.formula-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.formula-input:focus {
  outline: none;
  border-color: rgba(120, 198, 255, 0.6);
}
</style>

<!-- Tooltips are mounted on body; override Bootstrap .tooltip-inner defaults -->
<style>
.tooltip.formula-input-module-tooltip .tooltip-inner {
  text-align: left;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.4;
}
</style>
