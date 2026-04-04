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
  <div class="modal fade" id="moduleModal" data-bs-backdrop="false" data-bs-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel_module" aria-hidden="true">
    <div class="modal-backdrop fade" :class="{ show: isModalOpen }" @click="closeModal"></div>
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="staticBackdropLabel_module" v-html="$t('simulator:moduleModal.title')"></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body module-modal-body">
          <iframe id="moduleIframe" loading="lazy" :src="modulesUrl"></iframe>
        </div>
        <div class="modal-footer d-flex justify-content-between">
          <div>
            <button
              type="button"
              class="btn btn-outline-secondary me-2"
              v-tooltip-popover:[tooltipType]="{ content: $t('simulator:moduleModal.importFromFile.description'), placement: 'top' }"
              @click="importFromFile"
              v-html="$t('simulator:moduleModal.importFromFile.title')"
            ></button>
            <input type="file" ref="fileInput" accept=".json" style="display: none" @change="handleFileSelect" />
          </div>
          <div>
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" v-html="$t('simulator:common.closeButton')"></button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * @module ModuleModal
 * @description The Vue component for the pop-up modal for Tools -> Other -> Import Modules.
 */
import { ref, onMounted, computed, toRef } from 'vue'
import { mapURL } from '../utils/links.js'
import { vTooltipPopover } from '../directives/tooltip-popover.js'
import { usePreferencesStore } from '../store/preferences.js'
import * as bootstrap from 'bootstrap'
import i18next from 'i18next'
import { app } from '../services/app.js'

export default {
  name: 'ModuleModal',
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  setup() {
    const isModalOpen = ref(false)
    const fileInput = ref(null)
    const preferences = usePreferencesStore()
    const help = toRef(preferences, 'help')
    const tooltipType = computed(() => (help.value ? 'popover' : null))

    onMounted(() => {
      const modal = document.getElementById('moduleModal')
      modal.addEventListener('show.bs.modal', () => {
        isModalOpen.value = true
      })
      modal.addEventListener('hide.bs.modal', () => {
        isModalOpen.value = false
      })
    })

    const closeModal = () => {
      const modal = document.getElementById('moduleModal')
      modal.classList.remove('show')
      modal.setAttribute('aria-hidden', 'true')
      modal.style.display = 'none'
      isModalOpen.value = false
    }

    const modulesUrl = mapURL('/modules/modules')

    const importFromFile = () => {
      fileInput.value.click()
    }

    const handleFileSelect = (event) => {
      const file = event.target.files[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target.result)
          if (app.importModulesFromSceneFile(jsonData)) {
            const modalEl = document.getElementById('moduleModal')
            const bsModal = bootstrap.Modal.getInstance(modalEl)
            if (bsModal) {
              bsModal.hide()
            } else {
              closeModal()
            }
          } else {
            alert(i18next.t('simulator:moduleModal.importFromFile.error'))
          }
        } catch (err) {
          console.error(err)
          alert(i18next.t('simulator:moduleModal.importFromFile.error'))
        }
      }
      reader.onerror = () => {
        alert(i18next.t('simulator:moduleModal.importFromFile.error'))
      }
      reader.readAsText(file)
      event.target.value = ''
    }

    return {
      modulesUrl,
      isModalOpen,
      closeModal,
      fileInput,
      tooltipType,
      importFromFile,
      handleFileSelect
    }
  }
}
</script>

<style scoped>
#moduleIframe {
  width: 100%;
  height: 500px;
  max-height: 70vh;
  border: none;
}

.module-modal-body {
  padding: 0 !important;
}

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
