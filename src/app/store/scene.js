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

import { reactive, computed, onMounted, onUnmounted } from 'vue'
import Scene from '../../core/Scene'

// Map of properties to their update callbacks
const PROPERTY_CALLBACKS = {
  name: () => {
    window.rename?.()
  },
  mode: (value) => {
    window.modebtn_clicked?.(value)
    window.simulator?.updateSimulation(false, true)
  },
  colorMode: (value) => {
    window.colorModebtn_clicked?.(value)
    window.simulator?.updateSimulation(false, true)
  },
  rayModeDensity: (value) => {
    window.simulator?.updateSimulation(false, true)
  },
  imageModeDensity: (value) => {
    window.simulator?.updateSimulation(false, true)
  }
}

// Create a single instance of the store
let storeInstance = null

/**
 * Create a Vue store for the scene, which is a wrapper around the Ray Optics Simulation core library Scene class.
/**
 * Create a Vue store for the scene, which is a wrapper around the Ray Optics Simulation core library Scene class.
 *
 * @returns {Object} A Vue store for the scene
 */
export const useSceneStore = () => {
  if (storeInstance) return storeInstance

  // Create a reactive object for all serializable properties
  const state = reactive(Object.fromEntries(
    Object.entries(Scene.serializableDefaults).map(([key]) => [
      key,
      Scene.serializableDefaults[key]
    ])
  ))

  // Function to sync with scene
  const syncWithScene = () => {
    if (window.scene) {
      Object.keys(Scene.serializableDefaults).forEach(key => {
        state[key] = window.scene[key] ?? Scene.serializableDefaults[key]
      })
    }
  }

  // Resize the scene
  const setViewportSize = (width, height, dpr) => {
    if (window.simulator) {
      window.simulator.dpr = dpr;
    }
    if (window.scene) {
      window.scene.setViewportSize(width, height);
      state.width = width;
      state.height = height;
    }
    if (window.simulator?.ctxAboveLight) {
      window.simulator.updateSimulation();
    }
  }

  // Create computed properties for all serializable properties
  const computedProps = Object.fromEntries(
    Object.keys(Scene.serializableDefaults).map(key => [
      key,
      computed({
        get: () => state[key],
        set: (newValue) => {
          console.log(`Setting ${key} to ${newValue}`)
          if (window.scene) {
            window.scene[key] = newValue
            state[key] = newValue
            PROPERTY_CALLBACKS[key]?.(newValue)
            // Emit a change event to ensure all components update
            //document.dispatchEvent(new CustomEvent('sceneChanged'))
          }
          window.editor?.onActionComplete()
        }
      })
    ])
  )

  // Set up listeners
  onMounted(() => {
    syncWithScene()
    document.addEventListener('sceneChanged', syncWithScene)
  })

  onUnmounted(() => {
    document.removeEventListener('sceneChanged', syncWithScene)
  })

  storeInstance = {
    ...computedProps,
    setViewportSize,
    state
  }

  return storeInstance
}
