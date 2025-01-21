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
  <div class="modal fade" id="languageModal" style="display: none;" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel_language" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="staticBackdropLabel_language">
            <translated-text path="simulator:settings.language.title" />
          </h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="d-flex align-items-center">
            <div class="d-flex w-100">
              <div class="col">
                <translated-text path="simulator:settings.language.title" />
              </div>
              <div class="col text-end">
                <translated-text path="simulator:languageModal.translatedFraction" />
              </div>
            </div>
          </div>

          <!-- Language list -->
          <div class="language-list">
            <a v-for="(data, locale) in localeData" 
               :key="locale"
               :href="'?' + locale + currentHash"
               class="btn btn-primary dropdown-item d-flex align-items-center"
               @click="handleLanguageClick($event, locale)">
              <div class="d-flex w-100">
                <div class="col">{{ data.name }}</div>
                <div class="col text-end">{{ getCompleteness(data) }}%</div>
              </div>
            </a>
          </div>

          <small>
            <a href="https://hosted.weblate.org/engage/ray-optics-simulation/" target="_blank">
              <translated-text path="simulator:languageModal.helpTranslate" />
            </a>
          </small>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
            <translated-text path="simulator:common.closeButton" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import i18next from 'i18next';
import TranslatedText from './TranslatedText.vue';
import { handleLanguageChange } from '../js/vue-app.js';

export default {
  name: 'LanguageModal',
  components: {
    TranslatedText
  },
  data() {
    return {
      localeData: {},
      currentLang: ''
    }
  },
  computed: {
    currentHash() {
      return window.location.hash;
    }
  },
  mounted() {
    // Initialize data after the component is mounted
    this.localeData = window.localeData || {};
    this.currentLang = i18next.language;
  },
  methods: {
    getCompleteness(langData) {
      if (!langData || !this.localeData.en) {
        return 0;
      }
      return Math.round(langData.numStrings / this.localeData.en.numStrings * 100);
    },
    handleLanguageClick(event, locale) {
      event.preventDefault();
      event.stopPropagation();
      handleLanguageChange(locale);
    }
  }
}
</script>

<style scoped>
.language-list {
  margin: 1rem 0;
}
</style>
