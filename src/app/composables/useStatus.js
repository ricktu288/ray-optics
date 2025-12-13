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

import { ref, computed } from 'vue'
import i18next from 'i18next'
import { app } from '../services/app'

// Event names for status updates
export const STATUS_EVENT_NAMES = {
  MOUSE_POSITION: 'mousePositionChange',
  SIMULATOR_STATUS: 'simulatorStatusChange',
  SYSTEM_STATUS: 'systemStatusChange',
  DEVICE_CHANGE: 'deviceChange',
  RESET_VIRTUAL_KEYS: 'resetVirtualKeys'
}

// Event emitter for status updates
class StatusEventEmitter {
  constructor() {
    this.listeners = {}
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data))
    }
  }
}

// Create a single instance of the emitter to be shared
export const statusEmitter = new StatusEventEmitter()

/**
 * Composable for handling application status including mouse position,
 * simulator metrics, and system status (errors/warnings)
 * 
 * @returns {Object} Reactive status state and computed properties
 */
export function useStatus() {
  // Mouse position state
  const mousePosition = ref({ x: undefined, y: undefined })
  
  // Simulator status state
  const simulatorStatus = ref({
    rayCount: 0,
    totalTruncation: 0,
    brightnessScale: 0,
    timeElapsed: 0,
    isSimulatorRunning: false,
    isForceStop: false
  })
  
  // System status state
  const systemStatus = ref({
    app: { error: null, warning: null },
    scene: { error: null, warning: null },
    simulator: { error: null, warning: null },
    objects: []
  })

  // Computed properties
  const formattedMousePosition = computed(() => {
    const pos = mousePosition.value
    if (pos.x !== undefined && pos.y !== undefined) {
      return i18next.t('main:meta.colon', {
        name: i18next.t('simulator:statusBox.mouseCoordinates'),
        value: `(${pos.x}, ${pos.y})`
      })
    }
    return i18next.t('main:meta.colon', {
      name: i18next.t('simulator:statusBox.mouseCoordinates'),
      value: '-'
    })
  })

  const formattedSimulatorStatus = computed(() => {
    const status = simulatorStatus.value
    return [
      i18next.t('main:meta.colon', {
        name: i18next.t('simulator:statusBox.rayCount'), 
        value: status.rayCount
      }),
      i18next.t('main:meta.colon', {
        name: i18next.t('simulator:statusBox.totalTruncation'), 
        value: status.totalTruncation.toFixed(3)
      }),
      app.scene.colorMode === 'default' ? 
        i18next.t('main:meta.colon', {
          name: i18next.t('simulator:statusBox.brightnessScale'), 
          value: status.brightnessScale <= 0 ? "-" : status.brightnessScale.toFixed(3)
        }) : null,
      i18next.t('main:meta.colon', {
        name: i18next.t('simulator:statusBox.timeElapsed') + ' (ms)', 
        value: status.timeElapsed
      }),
      status.isForceStop ? i18next.t('simulator:statusBox.forceStopped') : null
    ].filter(Boolean)
  })

  const activeErrors = computed(() => {
    const status = systemStatus.value
    const errors = []
    
    if (status.app.error) errors.push(`App: ${status.app.error}`)
    if (status.scene.error) errors.push(`Scene: ${status.scene.error}`)
    if (status.simulator.error) errors.push(`Simulator: ${status.simulator.error}`)
    
    status.objects.forEach(obj => {
      if (obj.error) {
        errors.push(`objs[${obj.index}] ${obj.type}: ${obj.error}`)
      }
    })
    
    return errors
  })

  const activeWarnings = computed(() => {
    const status = systemStatus.value
    const warnings = []
    
    if (status.app.warning) warnings.push(`App: ${status.app.warning}`)
    if (status.scene.warning) warnings.push(`Scene: ${status.scene.warning}`)
    if (status.simulator.warning) warnings.push(`Simulator: ${status.simulator.warning}`)
    
    status.objects.forEach(obj => {
      if (obj.warning) {
        warnings.push(`objs[${obj.index}] ${obj.type}: ${obj.warning}`)
      }
    })
    
    return warnings
  })

  // Set up event listeners
  statusEmitter.on(STATUS_EVENT_NAMES.MOUSE_POSITION, (pos) => {
    mousePosition.value = pos
  })

  statusEmitter.on(STATUS_EVENT_NAMES.SIMULATOR_STATUS, (status) => {
    simulatorStatus.value = { ...simulatorStatus.value, ...status }
  })

  statusEmitter.on(STATUS_EVENT_NAMES.SYSTEM_STATUS, (status) => {
    systemStatus.value = status
  })

  return {
    // State
    mousePosition,
    simulatorStatus,
    systemStatus,
    // Computed
    formattedMousePosition,
    formattedSimulatorStatus,
    activeErrors,
    activeWarnings
  }
}
