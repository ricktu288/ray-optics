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
  <div class="style-property-control">
    <PropertyControlLabel
      class="style-property-control-label"
      :label="label"
      :info="info"
      :key-paths="[keyPath]"
    />
    <select
      class="style-property-control-select"
      :value="isCustom ? 'custom' : 'default'"
      @change="onModeChange"
    >
      <option value="default">{{ $t('simulator:common.defaultOption') }}</option>
      <option value="custom">{{ $t('simulator:common.customOption') }}</option>
    </select>
    <template v-if="isCustom">
      <template v-if="unsupported">
        <PropertyControlError :message="$t('simulator:sidebar.visual.sceneObjects.unsupportedVisualValue')" />
      </template>
      <template v-else>
        <div class="style-property-control-children">
          <NumberPropertyControl
            :label="$t('simulator:sceneObjs.common.styleRed')"
            :obj-data="objData"
            :key-path="keyPath + '.color.r'"
            :is-template="isTemplate"
            :module-name="moduleName"
            :template-source-index="templateSourceIndex"
            @update:value="(v) => onSubUpdate('color.r', v)"
          />
          <NumberPropertyControl
            :label="$t('simulator:sceneObjs.common.styleGreen')"
            :obj-data="objData"
            :key-path="keyPath + '.color.g'"
            :is-template="isTemplate"
            :module-name="moduleName"
            :template-source-index="templateSourceIndex"
            @update:value="(v) => onSubUpdate('color.g', v)"
          />
          <NumberPropertyControl
            :label="$t('simulator:sceneObjs.common.styleBlue')"
            :obj-data="objData"
            :key-path="keyPath + '.color.b'"
            :is-template="isTemplate"
            :module-name="moduleName"
            :template-source-index="templateSourceIndex"
            @update:value="(v) => onSubUpdate('color.b', v)"
          />
          <NumberPropertyControl
            :label="$t('simulator:sceneObjs.common.styleAlpha')"
            :obj-data="objData"
            :key-path="keyPath + '.color.a'"
            :is-template="isTemplate"
            :module-name="moduleName"
            :template-source-index="templateSourceIndex"
            @update:value="(v) => onSubUpdate('color.a', v)"
          />
          <NumberPropertyControl
            v-if="styleKind === 'stroke'"
            :label="$t('simulator:sceneObjs.common.styleWidth')"
            :obj-data="objData"
            :key-path="keyPath + '.width'"
            :is-template="isTemplate"
            :module-name="moduleName"
            :template-source-index="templateSourceIndex"
            @update:value="(v) => onSubUpdate('width', v)"
          />
        </div>
      </template>
    </template>
  </div>
</template>

<script>
import { computed } from 'vue'
import { getByKeyPath } from '../../../../core/propertyUtils/keyPath.js'
import PropertyControlLabel from './PropertyControlLabel.vue'
import PropertyControlError from './PropertyControlError.vue'
import NumberPropertyControl from './NumberPropertyControl.vue'

export default {
  name: 'StylePropertyControl',
  components: { PropertyControlLabel, PropertyControlError, NumberPropertyControl },
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
      type: Object,
      default: undefined
    },
    styleKind: {
      type: String,
      required: true,
      validator: (v) => v === 'stroke' || v === 'fill'
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
    const rawValue = computed(() => {
      const v = getByKeyPath(props.objData, props.keyPath)
      return v !== undefined ? v : props.default
    })

    const isCustom = computed(() => rawValue.value != null)

    const unsupported = computed(() => {
      const v = rawValue.value
      if (v == null) return false
      return typeof v !== 'object' || Array.isArray(v)
    })

    const createDefaultStyle = () => {
      const style = { color: { r: 1, g: 1, b: 1, a: 1 } }
      if (props.styleKind === 'stroke') {
        style.width = 1
      }
      return style
    }

    const onModeChange = (e) => {
      if (e.target.value === 'default') {
        emit('update:value', null)
      } else {
        emit('update:value', createDefaultStyle())
      }
    }

    const onSubUpdate = (subKey, value) => {
      const current = rawValue.value
      const style = (current && typeof current === 'object' && !Array.isArray(current))
        ? JSON.parse(JSON.stringify(current))
        : createDefaultStyle()

      const parts = subKey.split('.')
      let target = style
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]] || typeof target[parts[i]] !== 'object') {
          target[parts[i]] = {}
        }
        target = target[parts[i]]
      }
      target[parts[parts.length - 1]] = value

      emit('update:value', style)
    }

    return {
      isCustom,
      unsupported,
      onModeChange,
      onSubUpdate
    }
  }
}
</script>

<style scoped>
.style-property-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  width: 100%;
}

.style-property-control-label {
  flex: 0 0 35%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.style-property-control-select {
  flex: 1 1 0;
  min-width: 0;
  font-size: 11px;
  padding: 3px 6px;
  color: rgba(255, 255, 255, 0.9);
  background-color: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.style-property-control-select:focus {
  outline: none;
  border-color: rgba(120, 198, 255, 0.6);
}

.style-property-control-select option {
  color: black;
}

.style-property-control-children {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 8px;
  margin-top: 2px;
  border-left: 1px solid rgba(255, 255, 255, 0.15);
}
</style>
