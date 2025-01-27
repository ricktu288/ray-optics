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

/**
 * @file `src/app/main.js` is the main entry point for the Ray Optics Simulation web app. It uses Vue to build the web UI for the simulator, and uses the Ray Optics Simulation core library to do the simulation and editing of optical scenes on the canvas layers.
 * 
 * An instance of the {@link Scene} class is created and used throughout the session. The state of the scene is stored in the Vue store and bound to the UI elements via {@link useSceneStore}.
 */

import { createApp } from 'vue'
import App from './components/App.vue'
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
      App
    },
    template: '<App />'
  })

  // Install i18n plugin
  app.use(i18nPlugin)

  // Mount the Vue app
  const mountedApp = app.mount('#vue-root')
}
