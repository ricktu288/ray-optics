import { ref, computed, onMounted, onUnmounted } from 'vue'
import Scene from '../js/Scene'

// Map of properties to their update callbacks
const PROPERTY_CALLBACKS = {
  name: () => {
    window.rename?.()
  },
  colorMode: (value) => {
    window.colorModebtn_clicked?.(value)
    window.simulator?.updateSimulation()
  },
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
          console.log(`Setting ${key} to ${newValue}`)
          if (window.scene) {
            window.scene[key] = newValue
            refs[`_${key}`].value = newValue
            PROPERTY_CALLBACKS[key]?.(newValue)
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

  return computedProps
}
