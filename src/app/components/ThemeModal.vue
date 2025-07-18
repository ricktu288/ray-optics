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
  <div class="modal fade" id="themeModal" data-bs-backdrop="false" data-bs-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel_theme" aria-hidden="true">
    <div class="modal-backdrop fade" :class="{ show: isModalOpen }" @click="closeModal"></div>
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="staticBackdropLabel_theme" v-html="$t('simulator:themeModal.title')"></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body theme-modal-body">
          <ThemeOptionsList />
        </div>
        <div class="modal-footer d-flex justify-content-between">
          <div>
            <button type="button" class="btn btn-outline-secondary me-2" v-tooltip-popover:[tooltipType]="{ content: $t('simulator:themeModal.import.description'), placement: 'top' }" @click="importTheme" v-html="$t('simulator:themeModal.import.title')"></button>
            <input type="file" ref="fileInput" @change="handleFileSelect" accept=".json" style="display: none;">
            <button type="button" class="btn btn-outline-secondary" @click="reset" v-html="$t('simulator:common.resetButton')"></button>
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
 * @module ThemeModal
 * @description The Vue component for the pop-up modal for Settings -> Theme.
 */
import { ref, onMounted, computed, toRef } from 'vue'
import ThemeOptionsList from './theme/ThemeOptionsList.vue'
import { useThemeStore } from '../store/theme.js'
import { usePreferencesStore } from '../store/preferences.js'
import { vTooltipPopover } from '../directives/tooltip-popover.js'
import i18next from 'i18next'
import { app } from '../services/app.js'
import { jsonEditorService } from '../services/jsonEditor.js'

export default {
  name: 'ThemeModal',
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  components: {
    ThemeOptionsList
  },
  setup() {
    const isModalOpen = ref(false)
    const fileInput = ref(null)
    const themeStore = useThemeStore()
    const preferences = usePreferencesStore()
    const help = toRef(preferences, 'help')
    const tooltipType = computed(() => help.value ? 'popover' : null)

    onMounted(() => {
      const modal = document.getElementById('themeModal')
      modal.addEventListener('show.bs.modal', () => {
        isModalOpen.value = true
      })
      modal.addEventListener('hide.bs.modal', () => {
        isModalOpen.value = false
      })
    })

    const closeModal = () => {
      const modal = document.getElementById('themeModal')
      modal.classList.remove('show')
      modal.setAttribute('aria-hidden', 'true')
      modal.style.display = 'none'
      isModalOpen.value = false
    }

    const reset = () => {
      themeStore.resetToDefaults()
    }

    const importTheme = () => {
      fileInput.value.click()
    }

    const handleFileSelect = (event) => {
      const file = event.target.files[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target.result)
          
          if (typeof jsonData !== 'object' || jsonData === null || !jsonData.hasOwnProperty('theme')) {
            alert(i18next.t('simulator:themeModal.import.error'))
            return
          }

          const sceneObject = JSON.parse(app.editor.lastActionJson)
          sceneObject.theme = jsonData.theme
          app.editor.loadJSON(JSON.stringify(sceneObject))
          app.editor.onActionComplete()
          jsonEditorService.updateContent(app.editor.lastActionJson);
          
        } catch (error) {
          console.error(error)
          alert(i18next.t('simulator:themeModal.import.error'))
        }
      }
      
      reader.onerror = () => {
        alert(i18next.t('simulator:themeModal.import.error'))
      }
      
      reader.readAsText(file)
      
      // Reset the file input
      event.target.value = ''
    }

    return {
      isModalOpen,
      closeModal,
      reset,
      tooltipType,
      fileInput,
      importTheme,
      handleFileSelect
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

.theme-modal-body {
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 8px;
}
</style> 