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
        <div class="modal-footer">
          <a class="btn btn-success me-auto" :href="tutorialUrl" target="_blank" v-html="$t('simulator:moduleModal.makeCustomModules')"></a>
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" v-html="$t('simulator:common.closeButton')"></button>
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
import { ref, onMounted } from 'vue'
import { mapURL } from '../main'

export default {
  name: 'ModuleModal',
  setup() {
    const isModalOpen = ref(false)

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
    const tutorialUrl = mapURL('/modules/tutorial')

    return {
      modulesUrl,
      tutorialUrl,
      isModalOpen,
      closeModal
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
