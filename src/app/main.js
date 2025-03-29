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
import HttpBackend from 'i18next-http-backend'
import { mapURL, parseLinks } from './utils/links.js'
import { app } from './services/app'

const isDevelopment = process.env.NODE_ENV === 'development'

// Create i18n plugin for Vue that uses i18next
const i18nPlugin = {
  install: (app) => {
    // Add global $t method that includes parseLinks
    app.config.globalProperties.$t = (key, options) => {
      const translated = i18next.t(key, options)
      return parseLinks(translated)
    }

    // Add composable for use in setup functions
    app.provide('i18n', {
      t: (key, options) => {
        const translated = i18next.t(key, options)
        return parseLinks(translated)
      }
    })
  }
}

export const getLocaleData = () => {
  return window.localeData
}

async function initApp() {
  await i18next.use(HttpBackend).init({
    lng: window.lang,
    debug: isDevelopment,
    fallbackLng: 'en',
    load: 'currentOnly',
    ns: ['main', 'simulator'],
    backend: {
      loadPath: '../locales/{{lng}}/{{ns}}.json',
    },
    interpolation: {
      escapeValue: false
    }
  });

  // Initialize the scene (note that this must be done before creating the Vue app, since the controls will directly bind to the scene's properties)
  app.initScene()

  // Create the Vue app
  const vueApp = createApp(App)

  // Install i18n plugin
  vueApp.use(i18nPlugin)

  // Mount the Vue app
  vueApp.mount('#vue-root')

  // Initialize the app service (this must be done after the Vue app is mounted, since it accesses the Vue app's DOM)
  app.initAppService()

}

// Start the application
initApp()
