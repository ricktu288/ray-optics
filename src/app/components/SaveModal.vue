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
  <div class="modal fade" id="saveModal" data-bs-backdrop="false" data-bs-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel_save" aria-hidden="true">
    <div class="modal-backdrop fade" :class="{ show: isModalOpen }" @click="closeModal"></div>
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="staticBackdropLabel_save" v-html="$t('simulator:file.save.title')"></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label for="save_name" class="form-label" v-html="$t('simulator:saveModal.fileName')"></label>
            <input 
              type="text" 
              class="form-control" 
              id="save_name" 
              v-model="modalName"
            >
            <div class="form-text">
              <ul>
                <li v-html="$t('simulator:saveModal.description.autoSync')"></li>
                <li v-html="$t('simulator:saveModal.description.rename')"></li>
                <li v-html="$t('simulator:saveModal.description.contribute')"></li>
              </ul>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-primary" data-bs-dismiss="modal" @click="handleSave" v-html="$t('simulator:file.save.title')">
          </button>
          <button type="button" class="btn btn-primary" data-bs-dismiss="modal" @click="handleRename" v-html="$t('simulator:saveModal.rename')">
          </button>
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" v-html="$t('simulator:common.cancelButton')">
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * @module SaveModal
 * @description The Vue component for the pop-up modal for File -> Save.
 */
import { ref, onMounted } from 'vue'
import { useSceneStore } from '../store/scene'

export default {
  name: 'SaveModal',
  setup() {
    const store = useSceneStore()
    const modalName = ref('')
    const isModalOpen = ref(false)
    
    // Update name from store when modal is shown
    onMounted(() => {
      const modal = document.getElementById('saveModal')
      modal.addEventListener('show.bs.modal', () => {
        modalName.value = store.name.value
        isModalOpen.value = true
      })
      modal.addEventListener('hide.bs.modal', () => {
        isModalOpen.value = false
      })
    })

    const handleSave = () => {
      store.name.value = modalName.value
      if (window.save) {
        window.save()
      }
    }

    const handleRename = () => {
      store.name.value = modalName.value
    }

    const closeModal = () => {
      const modal = document.getElementById('saveModal')
      modal.classList.remove('show')
      modal.setAttribute('aria-hidden', 'true')
      modal.style.display = 'none'
      isModalOpen.value = false
    }

    return {
      modalName,
      isModalOpen,
      handleSave,
      handleRename,
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
