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
    <TransitionGroup name="property-drawer" tag="div" class="property-list-items">
      Property editor is oncoming... Below is a dummy list of properties.
      <div
        v-for="descriptor in visibleProperties"
        :key="descriptor.key"
        class="property-list-item property-list-item-dummy"
      >
        <span class="property-list-item-label" v-html="descriptor.label || descriptor.key"></span>
        <span class="property-list-item-value">({{ descriptor.type }})</span>
      </div>
    </TransitionGroup>
    <button
      v-if="schema && schema.length > 0"
      type="button"
      class="property-list-visibility-link"
      @click="showAllProperties = !showAllProperties"
    >
      {{ showAllProperties ? $t('simulator:sidebar.objectList.hideDefaultProperties') : $t('simulator:sidebar.objectList.showAllProperties') }}
    </button>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { isNonDefault } from '../../../core/propertyUtils/keyPath.js'

export default {
  name: 'PropertyList',
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
    }
  },
  setup(props) {
    const showAllProperties = ref(false)
    const refreshTrigger = ref(0)

    const visibleProperties = computed(() => {
      refreshTrigger.value
      const schema = props.schema || []
      if (showAllProperties.value) {
        return schema
      }
      return schema.filter((d) => isNonDefault(props.objData, d, props.serializableDefaults, props.basePath))
    })

    onMounted(() => {
      document.addEventListener('sceneObjsChanged', bumpRefresh)
    })

    onUnmounted(() => {
      document.removeEventListener('sceneObjsChanged', bumpRefresh)
    })

    const bumpRefresh = () => {
      refreshTrigger.value += 1
    }

    return {
      showAllProperties,
      visibleProperties
    }
  }
}
</script>

<style scoped>
.property-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 8px;
  margin-top: 6px;
  border-left: 1px solid rgba(255, 255, 255, 0.15);
}

.property-list-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
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
  max-height: 28px;
  opacity: 1;
}

.property-drawer-move {
  transition: transform 0.2s ease;
}

.property-list-item {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  display: flex;
  align-items: baseline;
  gap: 6px;
  overflow: hidden;
}

.property-list-item-label {
  flex-shrink: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.property-list-item-value {
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
}

.property-list-visibility-link {
  margin-top: 4px;
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
</style>
