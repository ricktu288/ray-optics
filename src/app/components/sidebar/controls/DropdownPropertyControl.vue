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
  <div class="dropdown-property-control">
    <PropertyControlLabel
      class="dropdown-property-control-label"
      :label="label"
      :info="info"
      :key-paths="[keyPath]"
    />
    <template v-if="unsupported">
      <PropertyControlError :message="$t('simulator:sidebar.objectList.unsupportedVisualValue')" />
    </template>
    <template v-else>
      <select
        class="dropdown-property-control-select"
        :value="rawValue"
        @change="onChange"
      >
        <option
          v-for="(displayLabel, optionValue) in options"
          :key="optionValue"
          :value="optionValue"
        >{{ displayLabel }}</option>
      </select>
    </template>
  </div>
</template>

<script>
import { computed } from 'vue'
import { getByKeyPath } from '../../../../core/propertyUtils/keyPath.js'
import PropertyControlLabel from './PropertyControlLabel.vue'
import PropertyControlError from './PropertyControlError.vue'

export default {
  name: 'DropdownPropertyControl',
  components: { PropertyControlLabel, PropertyControlError },
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
    options: {
      type: Object,
      default: () => ({})
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
    const rawValue = computed(() => {
      const v = getByKeyPath(props.objData, props.keyPath)
      return v !== undefined && v !== null ? v : props.default
    })

    const unsupported = computed(() => {
      if (!props.isTemplate) return false
      const v = rawValue.value
      if (v === undefined || v === null) return false
      return !(String(v) in props.options)
    })

    const onChange = (e) => {
      emit('update:value', e.target.value)
    }

    return {
      rawValue,
      unsupported,
      onChange
    }
  }
}
</script>

<style scoped>
.dropdown-property-control {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  width: 100%;
}

.dropdown-property-control-label {
  flex: 0 0 35%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-property-control-select {
  flex: 1 1 0;
  min-width: 0;
  font-size: 11px;
  padding: 3px 6px;
  color: rgba(255, 255, 255, 0.9);
  background-color: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.dropdown-property-control-select:focus {
  outline: none;
  border-color: rgba(120, 198, 255, 0.6);
}

.dropdown-property-control-select option {
  color: black;
}
</style>
