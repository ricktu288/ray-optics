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
  <div class="number-property-control">
    <PropertyControlLabel
      class="number-property-control-label"
      :label="label"
      :info="info"
      :key-paths="[keyPath]"
    />
    <template v-if="unsupported">
      <PropertyControlError :message="$t('simulator:sidebar.visual.sceneObjects.unsupportedVisualValue')" />
    </template>
    <template v-else>
      <div class="number-property-control-input-wrap">
        <FormulaInput
          class="number-property-control-formula"
          :model-value="displayValue"
          :module-instance-key-paths="isTemplate ? keyPath : undefined"
          :module-name="moduleName"
          :template-source-index="templateSourceIndex"
          @update:model-value="onCommit"
        />
      </div>
      <PropertyControlError :message="error" />
    </template>
  </div>
</template>

<script>
import { computed, ref } from 'vue'
import i18next from 'i18next'
import { getByKeyPath } from '../../../../core/propertyUtils/keyPath.js'
import {
  valueToFormulaDisplay,
  formulaDisplayToValue,
  isFormula,
  isFormulaValueSupported
} from '../../../../core/propertyUtils/formulaParsing.js'
import PropertyControlLabel from './PropertyControlLabel.vue'
import FormulaInput from './FormulaInput.vue'
import PropertyControlError from './PropertyControlError.vue'

export default {
  name: 'NumberPropertyControl',
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
      required: true
    },
    default: {
      type: [Number, String],
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

    const rawValue = computed(() => {
      const v = getByKeyPath(props.objData, props.keyPath)
      return v !== undefined && v !== null ? v : props.default
    })

    const unsupported = computed(() => !isFormulaValueSupported(rawValue.value))

    const displayValue = computed(() => valueToFormulaDisplay(rawValue.value))

    const onCommit = (text) => {
      error.value = ''

      if (text === '') {
        emit('update:value', undefined)
        return
      }

      if (!props.isTemplate && isFormula(text)) {
        error.value = i18next.t('simulator:sidebar.visual.sceneObjects.formulaRequiresModule')
        return
      }

      emit('update:value', formulaDisplayToValue(text))
    }

    return {
      error,
      unsupported,
      displayValue,
      onCommit
    }
  }
}
</script>

<style scoped>
.number-property-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  width: 100%;
}

.number-property-control-label {
  flex: 0 0 35%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.number-property-control-input-wrap {
  flex: 1 1 0;
  min-width: 0;
}

.number-property-control-formula {
  flex: 1 1 0;
  min-width: 0;
}
</style>
