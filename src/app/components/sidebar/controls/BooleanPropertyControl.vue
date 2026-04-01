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
  <div class="boolean-property-control">
    <PropertyControlLabel
      class="boolean-property-control-label"
      :label="label"
      :info="info"
      :key-paths="[keyPath]"
    />
    <template v-if="unsupported">
      <PropertyControlError :message="$t('simulator:sidebar.objectList.unsupportedVisualValue')" />
    </template>
    <template v-else-if="isTemplate">
      <FormulaInput
        :model-value="displayValue"
        :module-instance-key-paths="keyPath"
        :module-name="moduleName"
        :template-source-index="templateSourceIndex"
        @update:model-value="onCommit"
      />
      <PropertyControlError :message="error" />
    </template>
    <template v-else>
      <select
        class="boolean-property-control-select"
        :value="rawValue === true ? 'true' : 'false'"
        @change="onSelect"
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
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
  name: 'BooleanPropertyControl',
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
      type: [Boolean, String],
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

    const unsupported = computed(() => !isFormulaValueSupported(rawValue.value, 'boolean'))

    const displayValue = computed(() => valueToFormulaDisplay(rawValue.value))

    const onCommit = (text) => {
      error.value = ''

      if (text === '') {
        emit('update:value', undefined)
        return
      }

      if (!props.isTemplate && isFormula(text, 'boolean')) {
        error.value = i18next.t('simulator:sidebar.objectList.formulaRequiresModule')
        return
      }

      emit('update:value', formulaDisplayToValue(text, 'boolean'))
    }

    const onSelect = (e) => {
      emit('update:value', e.target.value === 'true')
    }

    return {
      error,
      rawValue,
      unsupported,
      displayValue,
      onCommit,
      onSelect
    }
  }
}
</script>

<style scoped>
.boolean-property-control {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  width: 100%;
}

.boolean-property-control-label {
  flex: 0 0 35%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.boolean-property-control-select {
  flex: 1 1 0;
  min-width: 0;
  font-size: 11px;
  font-family: monospace;
  padding: 3px 6px;
  color: rgba(255, 255, 255, 0.9);
  background-color: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.boolean-property-control-select:focus {
  outline: none;
  border-color: rgba(120, 198, 255, 0.6);
}

.boolean-property-control-select option {
  color: black;
  font-family: monospace;
}
</style>
