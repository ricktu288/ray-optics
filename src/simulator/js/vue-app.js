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
import SaveModal from '../components/SaveModal.vue'
import ColorModeModal from '../components/ColorModeModal.vue'
import ModuleModal from '../components/ModuleModal.vue'
import i18next from 'i18next'

let app = null

// Create i18n plugin for Vue that uses i18next
const i18nPlugin = {
  install: (app) => {
    // Add global $t method that includes parseLinks
    app.config.globalProperties.$t = (key) => {
      const translated = i18next.t(key)
      return window.parseLinks ? window.parseLinks(translated) : translated
    }

    // Add composable for use in setup functions
    app.provide('i18n', {
      t: (key) => {
        const translated = i18next.t(key)
        return window.parseLinks ? window.parseLinks(translated) : translated
      }
    })
  }
}

export const getLocaleData = () => {
  return window.localeData
}

export function mapURL(url) {
  return window.mapURL(url)
}

export function initVueApp() {
  // Create the Vue app
  app = createApp({
    components: {
      LanguageModal,
      SaveModal,
      ColorModeModal,
      ModuleModal
    },
    template: '<language-modal ref="languageModal" /><save-modal ref="saveModal" /><color-mode-modal ref="colorModeModal" /><module-modal ref="moduleModal" />'
  })

  // Install i18n plugin
  app.use(i18nPlugin)

  // Create a container for the Vue app
  const container = document.createElement('div')
  container.id = 'vue-app'
  document.body.appendChild(container)
  
  // Mount the Vue app
  const mountedApp = app.mount('#vue-app')
  
  // Make the Vue instances accessible globally for existing JS code
  window.languageModalVue = mountedApp.$refs.languageModal
  window.saveModalVue = mountedApp.$refs.saveModal
}
