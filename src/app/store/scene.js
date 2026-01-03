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
import geometry from '../../core/geometry'
import { app } from '../services/app'

// Map of properties to their update callbacks
const PROPERTY_CALLBACKS = {
  name: () => {
    app.rename?.()
  },
  mode: (value, state) => {
    // Initialize the observer when switching to observer mode
    if (value === 'observer' && !app.scene.observer) {
      app.scene.observer = geometry.circle(geometry.point((app.scene.width * 0.5 - app.scene.origin.x) / app.scene.scale, (app.scene.height * 0.5 - app.scene.origin.y) / app.scene.scale), state.observerSize * 0.5);
    }
    app.simulator?.updateSimulation(false, true)
  },
  rayModeDensity: (value) => {
    app.simulator?.updateSimulation(false, true)
  },
  imageModeDensity: (value) => {
    app.simulator?.updateSimulation(false, true)
  },
  showGrid: (value) => {
    app.simulator?.updateSimulation(true, false)
  },
  gridSize: (value) => {
    app.simulator?.updateSimulation(true, false)
  },
  snapToGrid: (value) => {
    // No need to update the simulation
  },
  lockObjs: (value) => {
    // No need to update the simulation
  },
  colorMode: (value) => {
    app.simulator?.updateSimulation(false, true)
  },
  redWavelength: (value) => {
    app.simulator?.updateSimulation(false, true)
  },
  violetWavelength: (value) => {
    app.simulator?.updateSimulation(false, true)
  },
  simulateColors: (value) => {
    app.editor.selectObj(app.editor.selectedObjIndex)
    app.simulator?.updateSimulation(false, true)
  },
  showRayArrows: (value) => {
    app.simulator?.updateSimulation(false, true)
  },
  observerSize: (value) => {
    if (app.simulator?.scene.observer) {
      app.simulator.scene.observer.r = value * 0.5
      app.simulator.updateSimulation(false, true)
    }
  },
  lengthScale: (value) => {
    app.simulator?.updateSimulation(false, false)
  },
  scale: (value) => {
    app.simulator?.updateSimulation(false, false)
  },
  zoom: (value) => {
    app.simulator?.updateSimulation(false, false)
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
    observerSize: app.simulator?.scene.observer ? app.simulator?.scene.observer.r * 2 : 40,
    zoom: app.simulator?.scene.scale || 1,
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
    if (app.scene) {
      Object.keys(Scene.serializableDefaults).forEach(key => {
        state[key] = app.scene[key] ?? Scene.serializableDefaults[key]
      })
      state.observerSize = app.simulator?.scene.observer ? app.simulator?.scene.observer.r * 2 : 40
      state.zoom = (app.scene.scale * app.scene.lengthScale) || 1
      state.moduleIds = Object.keys(app.scene.modules || {}).join(',')
    }
  }

  // Resize the scene
  const setViewportSize = (width, height, dpr) => {
    if (app.simulator) {
      app.simulator.dpr = dpr;
    }
    if (app.scene) {
      app.scene.setViewportSize(width, height);
      state.width = width;
      state.height = height;
    }
    if (app.simulator?.ctxAboveLight) {
      app.simulator.updateSimulation();
    }
  }

  // Create computed properties for all serializable properties
  const computedProps = Object.fromEntries(
    Object.keys(Scene.serializableDefaults).concat(['observerSize', 'zoom', 'moduleIds']).map(key => [
      key,
      computed({
        get: () => state[key],
        set: (newValue) => {
          if (app.scene) {
            if (key === 'observerSize') {
              if (app.scene.observer) {
                app.scene.observer.r = newValue * 0.5
              }
            } else if (key === 'zoom') {
              app.editor.setScale(newValue / app.scene.lengthScale)
            } else if (key === 'moduleIds') {
              // moduleIds is just for tracking, no need to sync back to scene
              state[key] = newValue
            } else {
              app.scene[key] = newValue
              // Update zoom when scale or lengthScale changes
              if (key === 'scale' || key === 'lengthScale') {
                state.zoom = app.scene.scale * app.scene.lengthScale
              }
            }
            if (key !== 'moduleIds') {
              state[key] = newValue
              PROPERTY_CALLBACKS[key]?.(newValue, state)
            }
          }
          app.editor.onActionComplete()
        }
      })
    ])
  )

  // Add module-specific methods
  const removeModule = (moduleName) => {
    if (app.scene) {
      app.scene.removeModule(moduleName)
      // Update moduleIds
      state.moduleIds = Object.keys(app.scene.modules).join(',')
      // Trigger necessary updates
      app.simulator?.updateSimulation(false, true)
      app.editor.onActionComplete()
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
