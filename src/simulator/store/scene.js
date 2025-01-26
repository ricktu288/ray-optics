import { ref, computed, onMounted, onUnmounted } from 'vue'
import Scene from '../js/Scene'

// Map of properties to their callback functions
const PROPERTY_CALLBACKS = {
  name: (value) => {
    window.rename?.()
    window.editor?.onActionComplete()
  },
  colorMode: (value) => {
    window.colorModebtn_clicked?.(value)
    window.editor?.onActionComplete()
    window.simulator?.updateSimulation()
  },
  mode: () => {
    window.editor?.onActionComplete()
    window.simulator?.updateSimulation()
  },
  rayModeDensity: () => {
    window.editor?.onActionComplete()
    window.simulator?.updateSimulation()
  },
  imageModeDensity: () => {
    window.editor?.onActionComplete()
    window.simulator?.updateSimulation()
  },
  showGrid: () => {
    window.editor?.onActionComplete()
  },
  snapToGrid: () => {
    window.editor?.onActionComplete()
  },
  lockObjs: () => {
    window.editor?.onActionComplete()
  },
  gridSize: () => {
    window.editor?.onActionComplete()
  },
  simulateColors: () => {
    window.editor?.onActionComplete()
    window.simulator?.updateSimulation()
  },
  showRayArrows: () => {
    window.editor?.onActionComplete()
    window.simulator?.updateSimulation()
  },
  symbolicBodyMerging: () => {
    window.editor?.onActionComplete()
    window.simulator?.updateSimulation()
  }
}

export const useSceneStore = () => {
  // Create refs for all serializable properties
  const refs = Object.fromEntries(
    Object.entries(Scene.serializableDefaults).map(([key]) => [
      `_${key}`,
      ref(Scene.serializableDefaults[key])
    ])
  )

  // Function to sync with scene
  const syncWithScene = () => {
    if (window.scene) {
      Object.keys(Scene.serializableDefaults).forEach(key => {
        refs[`_${key}`].value = window.scene[key] ?? Scene.serializableDefaults[key]
      })
    }
  }

  // Create computed properties for all serializable properties
  const computedProps = Object.fromEntries(
    Object.keys(Scene.serializableDefaults).map(key => [
      key,
      computed({
        get: () => refs[`_${key}`].value,
        set: (newValue) => {
          if (window.scene) {
            window.scene[key] = newValue
            refs[`_${key}`].value = newValue
            PROPERTY_CALLBACKS[key]?.(newValue)
          }
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

  return computedProps
}
