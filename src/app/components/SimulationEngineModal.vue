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
  <div class="modal fade" id="simulationEngineModal" data-bs-backdrop="false" data-bs-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel_simulationEngine" aria-hidden="true">
    <div class="modal-backdrop fade" :class="{ show: isModalOpen }" @click="closeModal"></div>
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="staticBackdropLabel_simulationEngine" v-html="$t('simulator:settings.simulationEngine.title')"></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="form-check" v-for="engine in SIMULATION_ENGINES" :key="engine">
            <input class="form-check-input" type="radio" name="simulationEngine" :id="'simulationEngine_' + engine" :value="engine" v-model="simulationEngine">
            <label class="form-check-label" :for="'simulationEngine_' + engine" v-html="$t(`simulator:simulationEngineModal.${engine}.title`)"></label>
            <div class="form-text" v-html="$t(`simulator:simulationEngineModal.${engine}.description`)"></div>
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
/**
 * @module SimulationEngineModal
 * @description The Vue component for the pop-up modal for Settings -> Simulation Engine.
 */
import { ref, onMounted } from 'vue'
import { usePreferencesStore } from '../store/preferences'

const SIMULATION_ENGINES = ['default', 'webgpu', 'primitiveCpu']

export default {
  name: 'SimulationEngineModal',
  setup() {
    const preferences = usePreferencesStore()
    const isModalOpen = ref(false)

    onMounted(() => {
      const modal = document.getElementById('simulationEngineModal')
      modal.addEventListener('show.bs.modal', () => {
        isModalOpen.value = true
      })
      modal.addEventListener('hide.bs.modal', () => {
        isModalOpen.value = false
      })
    })

    const closeModal = () => {
      const modal = document.getElementById('simulationEngineModal')
      modal.classList.remove('show')
      modal.setAttribute('aria-hidden', 'true')
      modal.style.display = 'none'
      isModalOpen.value = false
    }

    return {
      simulationEngine: preferences.simulationEngine,
      SIMULATION_ENGINES,
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
