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

import { reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import Scene from '../../core/Scene'
import { app } from '../services/app'

// Theme properties grouped by their simulation update requirements
// Default group (object layers only - skip light and grid) properties are not listed
// updateSimulation(skipLight, skipGrid, forceRedraw)

// Properties that affect grid (skip light only) - updateSimulation(true, false)
const GRID_PROPERTIES = new Set([
  'grid'
])

// Properties that affect light (skip grid only) - updateSimulation(false, true)  
const LIGHT_PROPERTIES = new Set([
  'ray', 'colorRay', 'extendedRay', 'colorExtendedRay', 'forwardExtendedRay', 'colorForwardExtendedRay',
  'observedRay', 'colorObservedRay', 'realImage', 'colorRealImage', 'virtualImage', 'colorVirtualImage',
  'virtualObject', 'colorVirtualObject'
])

// Flag to prevent callbacks during bulk scene updates or resets
let preventCallbacks = false

// Properties that should auto-adjust between white/black based on background
const AUTO_ADJUST_PROPERTIES = [
  'grid',
  'glass',
  'irradMapBorder',
  'decoration', 
  'handleArrow'
]

// Helper function to check if a color is pure white
const isPureWhite = (color) => {
  return color && color.r === 1 && color.g === 1 && color.b === 1
}

// Helper function to check if a color is pure black  
const isPureBlack = (color) => {
  return color && color.r === 0 && color.g === 0 && color.b === 0
}

// Helper function to determine if background is light or dark
const isBackgroundLight = (bgColor) => {
  if (!bgColor) return false
  
  // Use luminance formula: 0.299*R + 0.587*G + 0.114*B
  const luminance = 0.299 * bgColor.r + 0.587 * bgColor.g + 0.114 * bgColor.b
  return luminance > 0.5 // Threshold at 50%
}

// Function to get appropriate update callback for a property
const getPropertyCallback = (topLevelKey) => {
  if (preventCallbacks) return null
  
  if (GRID_PROPERTIES.has(topLevelKey)) {
    return () => app.simulator?.updateSimulation(true, false)
  }
  if (LIGHT_PROPERTIES.has(topLevelKey)) {
    return () => app.simulator?.updateSimulation(false, true)
  }
  // Default: object layers only (skip light and grid)
  return () => app.simulator?.updateSimulation(true, true)
}



// Create a single instance of the store
let themeStoreInstance = null

/**
 * Create a Vue store for theme properties, which manages the nested theme structure from Scene.
 *
 * @returns {Object} A Vue store for theme properties
 */
export const useThemeStore = () => {
  if (themeStoreInstance) return themeStoreInstance

  // Get the theme defaults from Scene
  const themeDefaults = Scene.serializableDefaults.theme

  // Create reactive state for theme properties
  const state = reactive({
    theme: JSON.parse(JSON.stringify(themeDefaults))
  })

  // Computed property to determine if background is light or dark
  const backgroundIsLight = computed(() => {
    return isBackgroundLight(state.theme.background?.color)
  })

  // Computed property to check if theme is default
  const isDefaultTheme = computed(() => {
    return JSON.stringify(state.theme) === JSON.stringify(themeDefaults)
  })

  // Function to sync with scene
  const syncWithScene = () => {
    if (app.scene && app.scene.theme) {
      preventCallbacks = true
      state.theme = JSON.parse(JSON.stringify(app.scene.theme))
      preventCallbacks = false
    }
  }

  // Function to auto-adjust white/black properties based on background
  const autoAdjustColorsForBackground = () => {
    if (preventCallbacks) return
    
    const isLight = backgroundIsLight.value
    let hasChanges = false
    
    // Prevent recursive callbacks during auto-adjustment
    preventCallbacks = true
    
    try {
      // Check each property in the auto-adjust list
      AUTO_ADJUST_PROPERTIES.forEach(propertyPath => {
        const property = getNestedProperty(propertyPath)
        if (!property?.color) return
        
        let needsUpdate = false
        let newColor = { ...property.color }
        
        if (isLight && isPureWhite(property.color)) {
          // Background is light and property is pure white -> change to black
          newColor.r = 0
          newColor.g = 0  
          newColor.b = 0
          needsUpdate = true
        } else if (!isLight && isPureBlack(property.color)) {
          // Background is dark and property is pure black -> change to white
          newColor.r = 1
          newColor.g = 1
          newColor.b = 1
          needsUpdate = true
        }
        
        if (needsUpdate) {
          // Update the property directly in state and scene
          const keys = propertyPath.split('.')
          const lastKey = keys.pop()
          const target = keys.reduce((obj, key) => obj[key], state.theme)
          target[lastKey] = { ...property, color: newColor }
          
          // Update the scene
          if (app.scene) {
            app.scene.theme = JSON.parse(JSON.stringify(state.theme))
          }
          
          hasChanges = true
        }
      })
    } finally {
      preventCallbacks = false
    }
    
    // Trigger a single update after all adjustments
    if (hasChanges) {
      // These properties don't require light refresh
      app.simulator?.updateSimulation(true, false)
      app.editor?.onActionComplete()
    }
    
    return hasChanges
  }

  // Helper function to get nested property
  const getNestedProperty = (path) => {
    return path.split('.').reduce((obj, key) => obj?.[key], state.theme)
  }

  // Helper function to set nested property
  const setNestedProperty = (path, value) => {
    const keys = path.split('.')
    const lastKey = keys.pop()
    const target = keys.reduce((obj, key) => obj[key], state.theme)
    target[lastKey] = value
    
    // Update the scene
    if (app.scene) {
      app.scene.theme = JSON.parse(JSON.stringify(state.theme))
    }
    
    // Trigger appropriate callback
    const topLevelKey = keys[0] || path
    const callback = getPropertyCallback(topLevelKey)
    callback?.()
    
    app.editor?.onActionComplete()
  }

  // Function to reset all theme properties to defaults
  const resetToDefaults = () => {
    preventCallbacks = true
    state.theme = JSON.parse(JSON.stringify(themeDefaults))
    
    // Update the scene
    if (app.scene) {
      app.scene.theme = JSON.parse(JSON.stringify(state.theme))
    }
    
    preventCallbacks = false
    
    // Single full refresh after reset
    app.simulator?.updateSimulation()
    app.editor?.onActionComplete()
  }

  // Get theme object at specified path
  const getThemeObject = (path) => {
    return getNestedProperty(path)
  }

  // Set entire theme object at specified path
  const setThemeObject = (path, object) => {
    const keys = path.split('.')
    const lastKey = keys.pop()
    const target = keys.reduce((obj, key) => obj[key], state.theme)
    target[lastKey] = object
    
    // Update the scene
    if (app.scene) {
      app.scene.theme = JSON.parse(JSON.stringify(state.theme))
    }
    
    // Trigger appropriate callback
    const topLevelKey = keys[0] || path
    const callback = getPropertyCallback(topLevelKey)
    callback?.()
    
    app.editor?.onActionComplete()
  }

  // Set up watchers
  watch(backgroundIsLight, () => {
    // Auto-adjust colors when background light/dark state changes
    autoAdjustColorsForBackground()
  })

  // Set up listeners
  onMounted(() => {
    syncWithScene()
    document.addEventListener('sceneChanged', syncWithScene)
  })

  onUnmounted(() => {
    document.removeEventListener('sceneChanged', syncWithScene)
  })

  themeStoreInstance = {
    state,
    backgroundIsLight,
    isDefaultTheme,
    syncWithScene,
    getNestedProperty,
    setNestedProperty,
    getThemeObject,
    setThemeObject,
    resetToDefaults,
    autoAdjustColorsForBackground
  }

  return themeStoreInstance
} 