<!--
  Copyright 2025 The Ray Optics Simulation authors and contributors

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
  <div class="modal fade" id="colorModeModal" data-bs-backdrop="false" data-bs-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel_colorMode" aria-hidden="true">
    <div class="modal-backdrop fade" :class="{ show: isModalOpen }" @click="closeModal"></div>
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="staticBackdropLabel_colorMode" v-html="$t('simulator:settings.colorMode.title')"></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="form-check" v-for="mode in COLOR_MODES" :key="mode">
            <input class="form-check-input" type="radio" name="colorMode" :id="'colorMode_' + mode" :value="mode"
              v-model="colorMode">
            <label class="form-check-label" :for="'colorMode_' + mode" v-html="$t(`simulator:colorModeModal.${mode}.title`)"></label>
            <div class="form-text" v-html="$t(`simulator:colorModeModal.${mode}.description`)"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" v-html="$t('simulator:common.closeButton')"></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useSceneStore } from '../store/scene'

const COLOR_MODES = [
  'linear',
  'linearRGB',
  'reinhard',
  'colorizedIntensity'
]

export default {
  name: 'ColorModeModal',
  setup() {
    const store = useSceneStore()
    const isModalOpen = ref(false)

    onMounted(() => {
      const modal = document.getElementById('colorModeModal')
      modal.addEventListener('show.bs.modal', () => {
        isModalOpen.value = true
      })
      modal.addEventListener('hide.bs.modal', () => {
        isModalOpen.value = false
      })
    })

    const closeModal = () => {
      const modal = document.getElementById('colorModeModal')
      modal.classList.remove('show')
      modal.setAttribute('aria-hidden', 'true')
      modal.style.display = 'none'
      isModalOpen.value = false
    }

    return {
      colorMode: store.colorMode,
      COLOR_MODES,
      isModalOpen,
      closeModal
    }
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.3);
  z-index: 1040;
}

.modal-backdrop.show {
  opacity: 1;
}

.modal-dialog {
  z-index: 1045;
}
</style>
