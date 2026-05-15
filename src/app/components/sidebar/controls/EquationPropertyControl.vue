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
  <div class="equation-property-control">
    <PropertyControlLabel
      class="equation-property-control-label"
      :label="label"
      :info="info"
      :key-paths="[keyPath]"
    />
    <template v-if="unsupported">
      <PropertyControlError :message="$t('simulator:sidebar.visual.sceneObjects.unsupportedVisualValue')" />
    </template>
    <template v-else>
      <FormulaInput
        :model-value="displayValue"
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
  equationValueToDisplay,
  equationDisplayToValue
} from '../../../../core/propertyUtils/equationConversion.js'
import PropertyControlLabel from './PropertyControlLabel.vue'
import FormulaInput from './FormulaInput.vue'
import PropertyControlError from './PropertyControlError.vue'

export default {
  name: 'EquationPropertyControl',
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
      type: String,
      default: undefined
    },
    isTemplate: {
      type: Boolean,
      default: false
    },
    moduleName: {
      type: String,
      default: ''
    }
  },
  emits: ['update:value'],
  setup(props, { emit }) {
    const error = ref('')

    const rawValue = computed(() => {
      const v = getByKeyPath(props.objData, props.keyPath)
      return v !== undefined && v !== null ? v : props.default
    })

    const parsed = computed(() => equationValueToDisplay(rawValue.value))

    const unsupported = computed(() => !parsed.value.supported)

    const displayValue = computed(() => parsed.value.display || '')

    const onCommit = (text) => {
      error.value = ''

      if (text.trim() === '') {
        return
      }

      try {
        emit('update:value', equationDisplayToValue(text, props.isTemplate))
      } catch {
        error.value = i18next.t('simulator:sidebar.visual.sceneObjects.latexConversionFailed')
      }
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
.equation-property-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  width: 100%;
}

.equation-property-control-label {
  flex: 0 0 35%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
