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
  <div
    class="point-property-control"
    @mouseenter="onHostMouseEnter"
    @mouseleave="onHostMouseLeave"
  >
    <PropertyControlLabel
      class="point-property-control-label"
      :label="label"
      :info="info"
      :key-paths="[xPath, yPath]"
    />
    <template v-if="unsupported">
      <PropertyControlError :message="$t('simulator:sidebar.objectList.unsupportedVisualValue')" />
    </template>
    <template v-else>
      <FormulaInput
        :model-value="displayValue"
        :module-instance-key-paths="isTemplate ? [xPath, yPath] : undefined"
        :module-name="moduleName"
        :template-source-index="templateSourceIndex"
        @update:model-value="onCommit"
      />
      <PropertyControlError :message="error" />
    </template>
  </div>
</template>

<script>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import i18next from 'i18next'
import { getByKeyPath } from '../../../../core/propertyUtils/keyPath.js'
import {
  splitTopLevelCommas,
  valueToFormulaDisplay,
  formulaDisplayToValue,
  isFormula,
  isFormulaValueSupported
} from '../../../../core/propertyUtils/formulaParsing.js'
import { app } from '../../../services/app'
import { useSceneStore } from '../../../store/scene'
import PropertyControlLabel from './PropertyControlLabel.vue'
import FormulaInput from './FormulaInput.vue'
import PropertyControlError from './PropertyControlError.vue'

const LITERAL_NUMERIC_TOKEN =
  /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

function isLiteralNumericPair(display) {
  if (typeof display !== 'string') {
    return false
  }
  const parts = splitTopLevelCommas(display.trim())
  if (parts.length !== 2) {
    return false
  }
  return parts.every((p) => LITERAL_NUMERIC_TOKEN.test(p.trim()))
}

function parseLiteralPoint(display) {
  const parts = splitTopLevelCommas(display.trim())
  if (parts.length !== 2) {
    return []
  }
  const x = Number(parts[0].trim())
  const y = Number(parts[1].trim())
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return []
  }
  return [{ x, y }]
}

function tupleCellsAllMissing(tuple) {
  return tuple.every((cell) => cell === undefined || cell === null)
}

function collectExpandedTemplatePoints(displayValue, moduleName, templateSourceIndex, xPathStr, yPathStr) {
  if (isLiteralNumericPair(displayValue)) {
    return parseLiteralPoint(displayValue)
  }
  if (!moduleName || templateSourceIndex < 0) {
    return []
  }
  const instances = app.editor?.getActiveModuleInstances?.(moduleName)
  if (!instances?.length) {
    return []
  }
  const paths = [xPathStr, yPathStr]
  /** @type {{ x: number, y: number }[]} */
  const out = []
  for (const inst of instances) {
    if (!inst || typeof inst.getExpandedPropertyValues !== 'function') {
      continue
    }
    const valueArrays = paths.map((kp) => {
      const sourceKeyPath = `${templateSourceIndex}.${kp}`
      return inst.getExpandedPropertyValues(sourceKeyPath)
    })
    const maxLen = Math.max(...valueArrays.map((a) => a.length), 0)
    for (let j = 0; j < maxLen; j++) {
      const tuple = valueArrays.map((arr) => arr[j])
      if (tupleCellsAllMissing(tuple)) {
        continue
      }
      const x = tuple[0]
      const y = tuple[1]
      if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
        out.push({ x, y })
      }
    }
  }
  return out
}

export default {
  name: 'PointPropertyControl',
  components: { PropertyControlLabel, FormulaInput, PropertyControlError },
  props: {
    label: {
      type: String,
      default: ''
    },
    info: {
      type: String,
      default: ''
    },
    objData: {
      type: Object,
      default: () => ({})
    },
    keyPath: {
      type: String,
      default: ''
    },
    default: {
      type: Object,
      default: undefined
    },
    isTemplate: {
      type: Boolean,
      default: false
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
  emits: ['update:value'],
  setup(props, { emit }) {
    const error = ref('')
    const hoveringHost = ref(false)
    const sceneStore = useSceneStore()

    const xPath = computed(() => props.keyPath ? `${props.keyPath}.x` : 'x')
    const yPath = computed(() => props.keyPath ? `${props.keyPath}.y` : 'y')

    const xRaw = computed(() => {
      const v = getByKeyPath(props.objData, xPath.value)
      return v !== undefined && v !== null ? v : props.default?.x
    })
    const yRaw = computed(() => {
      const v = getByKeyPath(props.objData, yPath.value)
      return v !== undefined && v !== null ? v : props.default?.y
    })

    const unsupported = computed(() =>
      !isFormulaValueSupported(xRaw.value) || !isFormulaValueSupported(yRaw.value)
    )

    const displayValue = computed(() =>
      `${valueToFormulaDisplay(xRaw.value)}, ${valueToFormulaDisplay(yRaw.value)}`
    )

    const onCommit = (text) => {
      error.value = ''

      const parts = splitTopLevelCommas(text)
      if (parts.length !== 2) {
        error.value = i18next.t('simulator:sidebar.objectList.invalidPointFormat')
        return
      }

      const [xText, yText] = parts

      if (!props.isTemplate && (isFormula(xText) || isFormula(yText))) {
        error.value = i18next.t('simulator:sidebar.objectList.formulaRequiresModule')
        return
      }

      const currentPt = props.keyPath
        ? getByKeyPath(props.objData, props.keyPath)
        : props.objData
      const pt = currentPt != null && typeof currentPt === 'object'
        ? { ...currentPt }
        : {}
      pt.x = formulaDisplayToValue(xText)
      pt.y = formulaDisplayToValue(yText)

      emit('update:value', pt)
    }

    const pushHoveredPointsToEditor = () => {
      if (!hoveringHost.value) {
        return
      }
      if (unsupported.value) {
        app.editor?.setExternalHighlightPoints([])
        app.simulator?.updateSimulation(true, true)
        return
      }
      let points
      if (!props.isTemplate) {
        points = parseLiteralPoint(displayValue.value)
      } else {
        points = collectExpandedTemplatePoints(
          displayValue.value,
          props.moduleName,
          props.templateSourceIndex,
          xPath.value,
          yPath.value
        )
      }
      app.editor?.setExternalHighlightPoints(points)
      app.simulator?.updateSimulation(true, true)
    }

    const onHostMouseEnter = () => {
      hoveringHost.value = true
      pushHoveredPointsToEditor()
    }

    const onHostMouseLeave = () => {
      hoveringHost.value = false
      app.editor?.setExternalHighlightPoints([])
      app.simulator?.updateSimulation(true, true)
    }

    watch(
      [
        displayValue,
        unsupported,
        xPath,
        yPath,
        () => props.isTemplate,
        () => props.moduleName,
        () => props.templateSourceIndex,
        () => sceneStore.state.objList.length
      ],
      () => {
        pushHoveredPointsToEditor()
      }
    )

    onBeforeUnmount(() => {
      if (hoveringHost.value) {
        app.editor?.setExternalHighlightPoints([])
        app.simulator?.updateSimulation(true, true)
      }
    })

    return {
      error,
      xPath,
      yPath,
      unsupported,
      displayValue,
      onCommit,
      onHostMouseEnter,
      onHostMouseLeave
    }
  }
}
</script>

<style scoped>
.point-property-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  width: 100%;
}

.point-property-control-label {
  flex: 0 0 35%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
