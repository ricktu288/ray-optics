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
  <div class="point-property-control">
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
import { computed, ref } from 'vue'
import i18next from 'i18next'
import { getByKeyPath } from '../../../../core/propertyUtils/keyPath.js'
import {
  splitTopLevelCommas,
  valueToFormulaDisplay,
  formulaDisplayToValue,
  isFormula,
  isFormulaValueSupported
} from '../../../../core/propertyUtils/formulaParsing.js'
import PropertyControlLabel from './PropertyControlLabel.vue'
import FormulaInput from './FormulaInput.vue'
import PropertyControlError from './PropertyControlError.vue'

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

    return {
      error,
      xPath,
      yPath,
      unsupported,
      displayValue,
      onCommit
    }
  }
}
</script>

<style scoped>
.point-property-control {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
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
