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
  <span
    ref="labelRef"
    class="property-control-label"
    @dblclick="showKeyPath"
  >
    <span class="property-control-label-text" v-html="label"></span>
    <InfoPopoverIcon
      v-if="info"
      class="property-control-label-info"
      :content="info"
    />
  </span>
</template>

<script>
import { ref, computed, onBeforeUnmount } from 'vue'
import * as bootstrap from 'bootstrap'
import { formatKeyPath } from '../../../../core/propertyUtils/keyPath.js'
import InfoPopoverIcon from '../../InfoPopoverIcon.vue'

export default {
  name: 'PropertyControlLabel',
  components: { InfoPopoverIcon },
  props: {
    label: {
      type: String,
      default: ''
    },
    info: {
      type: String,
      default: ''
    },
    keyPaths: {
      type: Array,
      default: () => []
    }
  },
  setup(props) {
    const labelRef = ref(null)
    let hideTimer = null
    let activeTooltip = null

    const formattedKeyPaths = computed(() =>
      props.keyPaths.map(formatKeyPath).filter(Boolean).join(', ')
    )

    const cleanup = () => {
      clearTimeout(hideTimer)
      if (activeTooltip) {
        activeTooltip.dispose()
        activeTooltip = null
      }
    }

    const showKeyPath = () => {
      const el = labelRef.value
      const text = formattedKeyPaths.value
      if (!el || !text) return

      cleanup()

      activeTooltip = new bootstrap.Tooltip(el, {
        title: `<code>${text}</code>`,
        html: true,
        trigger: 'manual',
        placement: 'top'
      })
      activeTooltip.show()

      hideTimer = setTimeout(() => {
        if (activeTooltip) {
          activeTooltip.dispose()
          activeTooltip = null
        }
      }, 2000)
    }

    onBeforeUnmount(cleanup)

    return {
      labelRef,
      showKeyPath
    }
  }
}
</script>

<style scoped>
.property-control-label {
  min-width: 0;
  cursor: default;
}

.property-control-label-text {
  word-break: break-word;
}

.property-control-label-info {
  display: inline-flex;
  vertical-align: middle;
  margin-left: 3px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.property-control-label-info:hover {
  color: rgba(255, 255, 255, 0.8);
}
</style>
