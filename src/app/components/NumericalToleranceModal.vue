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
  <div
    class="modal fade"
    id="numericalToleranceModal"
    data-bs-backdrop="false"
    data-bs-keyboard="false"
    tabindex="-1"
    aria-labelledby="staticBackdropLabel_numericalTolerance"
    aria-hidden="true"
  >
    <div class="modal-backdrop fade" :class="{ show: isModalOpen }" @click="closeModal"></div>
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5
            class="modal-title"
            id="staticBackdropLabel_numericalTolerance"
            v-text="$t('simulator:numericalToleranceModal.title')"
          ></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <p
            class="form-text mt-0"
            v-text="$t('simulator:numericalToleranceModal.description')"
          ></p>

          <div
            v-for="field in TOLERANCE_FIELDS"
            :key="field"
            class="numerical-tolerance-field mb-3"
          >
            <div class="d-flex align-items-center justify-content-between gap-3">
              <label
                class="form-label fw-semibold text-body mb-0"
                :for="'numericalTolerance_' + field"
                v-text="$t(`simulator:numericalToleranceModal.fields.${field}.title`)"
              ></label>
              <input
                type="number"
                class="form-control form-control-sm numerical-tolerance-input"
                :id="'numericalTolerance_' + field"
                :value="numericalTolerances[field]"
                min="0"
                step="any"
                @change="setTolerance(field, $event)"
                @keydown.stop
              >
            </div>
            <div
              class="form-text"
              v-text="$t(`simulator:numericalToleranceModal.fields.${field}.description`)"
            ></div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-outline-secondary"
            :disabled="isDefault"
            @click="resetToDefaults"
            v-text="$t('simulator:numericalToleranceModal.backToDefaults')"
          ></button>
          <button
            type="button"
            class="btn btn-secondary"
            data-bs-dismiss="modal"
            v-text="$t('simulator:common.closeButton')"
          ></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * @module NumericalToleranceModal
 * @description Scene-level numerical tolerance settings for primitive-based
 * simulation engines.
 */
import { computed, onMounted, ref } from 'vue'
import Scene from '../../core/Scene.js'
import { useSceneStore } from '../store/scene.js'

const TOLERANCE_FIELDS = [
  'curveEndpoint',
  'surfaceMerging',
  'surfaceNormal',
  'forwardDistance'
]

const DEFAULT_TOLERANCES = Scene.serializableDefaults.numericalTolerances

export default {
  name: 'NumericalToleranceModal',
  setup() {
    const sceneStore = useSceneStore()
    const isModalOpen = ref(false)
    const numericalTolerances = sceneStore.numericalTolerances
    const isDefault = computed(() =>
      TOLERANCE_FIELDS.every(
        field => numericalTolerances.value[field] === DEFAULT_TOLERANCES[field]
      )
    )

    onMounted(() => {
      const modal = document.getElementById('numericalToleranceModal')
      modal.addEventListener('show.bs.modal', () => {
        isModalOpen.value = true
      })
      modal.addEventListener('hide.bs.modal', () => {
        isModalOpen.value = false
      })
    })

    const closeModal = () => {
      const modal = document.getElementById('numericalToleranceModal')
      modal.classList.remove('show')
      modal.setAttribute('aria-hidden', 'true')
      modal.style.display = 'none'
      isModalOpen.value = false
    }

    const setTolerance = (field, event) => {
      const value = Number(event.target.value)
      if (
        event.target.value.trim() === '' ||
        !Number.isFinite(value) ||
        value < 0
      ) {
        event.target.value = numericalTolerances.value[field]
        return
      }
      numericalTolerances.value = {
        ...numericalTolerances.value,
        [field]: value
      }
    }

    const resetToDefaults = () => {
      numericalTolerances.value = { ...DEFAULT_TOLERANCES }
    }

    return {
      TOLERANCE_FIELDS,
      numericalTolerances,
      isDefault,
      isModalOpen,
      closeModal,
      setTolerance,
      resetToDefaults
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

.numerical-tolerance-input {
  width: 8rem;
  flex-shrink: 0;
}
</style>
