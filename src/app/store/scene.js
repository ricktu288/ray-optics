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
  mode: (value, state) => {
    window.modebtn_clicked?.(value)
    window.simulator?.updateSimulation(false, true)
    // When switching to observer mode, set the observer size to the stored value
    if (value === 'observer' && window.simulator?.scene.observer) {
      window.simulator.scene.observer.r = state.observerSize * 0.5
      window.simulator?.updateSimulation(false, true)
    }
  },
  rayModeDensity: (value) => {
    window.simulator?.updateSimulation(false, true)
  },
  imageModeDensity: (value) => {
    window.simulator?.updateSimulation(false, true)
  },
  showGrid: (value) => {
    window.simulator?.updateSimulation(true, false)
  },
  gridSize: (value) => {
    window.simulator?.updateSimulation(true, false)
  },
  snapToGrid: (value) => {
    // No need to update the simulation
  },
  lockObjs: (value) => {
    // No need to update the simulation
  },
  colorMode: (value) => {
    window.colorModebtn_clicked?.(value)
    window.simulator?.updateSimulation(false, true)
  },
  simulateColors: (value) => {
    window.editor?.selectObj(window.editor.selectedObjIndex)
    window.simulator?.updateSimulation(false, true)
  },
  showRayArrows: (value) => {
    window.simulator?.updateSimulation(false, true)
  },
  observerSize: (value) => {
    if (window.simulator?.scene.observer) {
      window.simulator.scene.observer.r = value * 0.5
      window.simulator?.updateSimulation(false, true)
    }
  },
  lengthScale: (value) => {
    window.simulator?.updateSimulation(false, false)
  },
  scale: (value) => {
    window.simulator?.updateSimulation(false, false)
  },
  zoom: (value) => {
    window.simulator?.updateSimulation(false, false)
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
  const state = reactive({
    observerSize: window.simulator?.scene.observer ? window.simulator.scene.observer.r * 2 : 40,
    zoom: window.simulator?.scene.scale || 1,
    moduleIds: '',
    ...Object.fromEntries(
      Object.entries(Scene.serializableDefaults).map(([key]) => [
        key,
        Scene.serializableDefaults[key]
      ])
    )
  })

  // Function to sync with scene
  const syncWithScene = () => {
    if (window.scene) {
      Object.keys(Scene.serializableDefaults).forEach(key => {
        state[key] = window.scene[key] ?? Scene.serializableDefaults[key]
      })
      state.observerSize = window.simulator?.scene.observer ? window.simulator.scene.observer.r * 2 : 40
      state.zoom = (window.scene.scale * window.scene.lengthScale) || 1
      state.moduleIds = Object.keys(window.scene.modules || {}).join(',')
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
    Object.keys(Scene.serializableDefaults).concat(['observerSize', 'zoom', 'moduleIds']).map(key => [
      key,
      computed({
        get: () => state[key],
        set: (newValue) => {
          console.log(`Setting ${key} to ${newValue}`)
          if (window.scene) {
            if (key === 'observerSize') {
              if (window.scene.observer) {
                window.scene.observer.r = newValue * 0.5
              }
            } else if (key === 'zoom') {
              console.log(`Setting zoom to ${newValue}`)
              window.editor?.setScale(newValue / window.scene.lengthScale)
            } else if (key === 'moduleIds') {
              // moduleIds is just for tracking, no need to sync back to scene
              state[key] = newValue
            } else {
              window.scene[key] = newValue
              // Update zoom when scale or lengthScale changes
              if (key === 'scale' || key === 'lengthScale') {
                state.zoom = window.scene.scale * window.scene.lengthScale
              }
            }
            if (key !== 'moduleIds') {
              state[key] = newValue
              PROPERTY_CALLBACKS[key]?.(newValue, state)
            }
          }
          window.editor?.onActionComplete()
        }
      })
    ])
  )

  // Add module-specific methods
  const removeModule = (moduleName) => {
    if (window.scene) {
      window.scene.removeModule(moduleName)
      // Update moduleIds
      state.moduleIds = Object.keys(window.scene.modules).join(',')
      // Trigger necessary updates
      window.simulator?.updateSimulation(false, true)
      window.editor?.onActionComplete()
    }
  }

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
    removeModule,
    state
  }

  return storeInstance
}
