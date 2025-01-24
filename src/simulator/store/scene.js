import { ref, onMounted, onUnmounted, computed } from 'vue'

export const useSceneStore = () => {
  // Private ref for internal state
  const _sceneName = ref('')
  
  // Function to sync with the existing global scene object
  const syncWithScene = () => {
    if (window.scene) {
      _sceneName.value = window.scene.name || ''
    }
  }

  // Public methods for components to interact with scene
  const updateSceneName = (newName) => {
    if (window.scene) {
      window.scene.name = newName
      _sceneName.value = newName
      if (window.rename) {
        window.rename()
      }
    }
  }

  // Computed property for read-only access
  const sceneName = computed(() => _sceneName.value)

  // Set up listeners when a component using this store is mounted
  onMounted(() => {
    // Initial sync
    syncWithScene()
    
    // Listen for scene changes
    document.addEventListener('sceneChanged', syncWithScene)
  })

  // Clean up listeners when component is unmounted
  onUnmounted(() => {
    document.removeEventListener('sceneChanged', syncWithScene)
  })

  return {
    sceneName,
    updateSceneName
  }
}
