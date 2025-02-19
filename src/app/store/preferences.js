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

import { ref, computed, onMounted } from 'vue'
import { jsonEditorService } from '../services/jsonEditor'

// Define default preferences and their callbacks
const PREFERENCES_DEFAULTS = {
  autoSyncUrl: false,
  showJsonEditor: false,
  showStatus: false,
  help: true,
}

// Callbacks for preference changes
const PREFERENCES_CALLBACKS = {
  help: (value) => {
    window.popoversEnabled = value
  },
  autoSyncUrl: (value) => {
    console.log('autoSyncUrl', value)
    window.autoSyncUrl = value
  },
  showJsonEditor: (value) => {
    console.log('showJsonEditor', value)
    if (value) {
      // Initialize JSON editor
      jsonEditorService.initialize()
    } else {
      // Clean up JSON editor
      jsonEditorService.cleanup()
    }
  }
}

// Create a single instance of the store
let storeInstance = null

/**
 * Create a Vue store for application preferences that persist to localStorage
 * 
 * @returns {Object} A Vue store for application preferences
 */
export const usePreferencesStore = () => {
  if (storeInstance) return storeInstance

  // Create refs for all preferences
  const refs = Object.fromEntries(
    Object.entries(PREFERENCES_DEFAULTS).map(([key]) => [
      `_${key}`,
      ref((() => {
        const storedValue = localStorage.getItem(`rayOptics${key.charAt(0).toUpperCase()}${key.slice(1)}`)
        if (storedValue === null) return PREFERENCES_DEFAULTS[key]
        if (storedValue === "on") return true
        if (storedValue === "off") return false
        try {
          return JSON.parse(storedValue)
        } catch {
          return PREFERENCES_DEFAULTS[key]
        }
      })())
    ])
  )

  // Create computed properties for all preferences
  const computedProps = Object.fromEntries(
    Object.keys(PREFERENCES_DEFAULTS).map(key => [
      key,
      computed({
        get: () => refs[`_${key}`].value,
        set: (newValue) => {
          console.log(`Setting preference ${key} to ${newValue}`)
          refs[`_${key}`].value = newValue
          localStorage.setItem(
            `rayOptics${key.charAt(0).toUpperCase()}${key.slice(1)}`, 
            newValue ? "on" : "off"
          )
          PREFERENCES_CALLBACKS[key]?.(newValue)
        }
      })
    ])
  )

  // Set up listeners and trigger initial callbacks
  onMounted(() => {
    // Trigger callbacks for initial values
    Object.keys(PREFERENCES_DEFAULTS).forEach(key => {
      PREFERENCES_CALLBACKS[key]?.(refs[`_${key}`].value)
    })
  })

  storeInstance = {
    ...computedProps
  }

  return storeInstance
}
