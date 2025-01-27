<!--
 * Copyright 2025 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
-->

<template>
  <div class="modal fade" id="languageModal" data-bs-backdrop="false" data-bs-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel_language" aria-hidden="true">
    <div class="modal-backdrop fade" :class="{ show: isModalOpen }" @click="closeModal"></div>
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="staticBackdropLabel_language" v-html="$t('simulator:settings.language.title')"></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="d-flex align-items-center">
            <div class="d-flex w-100">
              <div class="col" v-html="$t('simulator:settings.language.title')"></div>
              <div class="col text-end" v-html="$t('simulator:languageModal.translatedFraction')"></div>
            </div>
          </div>

          <!-- Language list -->
          <div class="language-list">
            <a v-for="(data, locale) in localeData" 
               :key="locale"
               :href="getLanguageUrl(locale)"
               class="btn btn-primary dropdown-item d-flex align-items-center">
              <div class="d-flex w-100">
                <div class="col" v-html="data.name"></div>
                <div class="col text-end" v-html="getCompleteness(data) + '%'"></div>
              </div>
            </a>
          </div>

          <small>
            <a href="https://hosted.weblate.org/engage/ray-optics-simulation/" target="_blank" v-html="$t('simulator:languageModal.helpTranslate')">
            </a>
          </small>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" v-html="$t('simulator:common.closeButton')">
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * @module LanguageModal
 * @description The Vue component for the pop-up modal for Settings -> Language.
 */
import { ref, onMounted } from 'vue'
import i18next from 'i18next';
import { getLocaleData } from '../main'
import { useSceneStore } from '../store/scene'

export default {
  name: 'LanguageModal',
  setup() {
    const store = useSceneStore()
    const localeData = getLocaleData()
    const currentHash = ref('')
    const currentSearch = ref('')
    const isModalOpen = ref(false)

    // Update URL parts when modal is shown
    onMounted(() => {
      const modal = document.getElementById('languageModal')
      modal.addEventListener('show.bs.modal', () => {
        // Get current URL parts
        const url = new URL(window.location.href)
        currentHash.value = url.hash || ''
        // Remove any existing language parameter
        const search = url.search.replace(/^\?[a-zA-Z-]+/, '')
        currentSearch.value = search
        isModalOpen.value = true
      })
      modal.addEventListener('hide.bs.modal', () => {
        isModalOpen.value = false
      })
    })

    const getLanguageUrl = (locale) => {
      // Format is ?[lang][existing-search-params][hash]
      return '?' + locale + currentSearch.value + currentHash.value
    }

    const closeModal = () => {
      const modal = document.getElementById('languageModal')
      modal.classList.remove('show')
      modal.setAttribute('aria-hidden', 'true')
      modal.style.display = 'none'
      isModalOpen.value = false
    }

    return {
      localeData,
      getLanguageUrl,
      getCompleteness: (langData) => {
        if (!langData || !localeData.en) {
          return 0;
        }
        return Math.round(langData.numStrings / localeData.en.numStrings * 100);
      },
      isModalOpen,
      closeModal
    }
  }
}
</script>

<style scoped>
.language-list {
  margin: 1rem 0;
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
