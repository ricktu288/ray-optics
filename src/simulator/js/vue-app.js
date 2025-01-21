/*
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
 */

import { createApp } from 'vue'
import LanguageModal from '../components/LanguageModal.vue'
import i18next from 'i18next'

// Create a Vue app just for the language modal
const languageApp = createApp({
  components: {
    LanguageModal
  },
  template: '<language-modal ref="modal" />'
})

// Export these functions for the Vue component to use
export const handleLanguageChange = (locale) => {
  // If there are unsaved changes, navigate directly
  if (window.hasUnsavedChange) {
    window.location.href = '?' + locale + window.location.hash;
    return;
  }

  // Get the base URL without query or hash
  const currentUrl = window.location.href;
  const baseUrl = currentUrl.split('?')[0].split('#')[0];
  const hash = window.location.hash;
  const newUrl = baseUrl + '?' + locale + hash;

  // Update URL and reload
  window.location.href = newUrl;
}

// Wait for both DOM and required data to be ready
const initVueApp = () => {
  // Check if i18next is initialized and localeData is available
  if (!window.localeData || !i18next.isInitialized) {
    // If not ready, try again in 100ms
    setTimeout(initVueApp, 100);
    return;
  }

  // Create a container for the Vue app
  const container = document.createElement('div')
  container.id = 'language-modal-app'
  document.body.appendChild(container)
  
  // Mount the Vue app
  const app = languageApp.mount('#language-modal-app')
  
  // Make the Vue instance accessible globally for existing JS code
  window.languageModalVue = app.$refs.modal
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', initVueApp)
