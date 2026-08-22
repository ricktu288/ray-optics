<!--
  Copyright 2026 The Ray Optics Simulation authors and contributors

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
-->

<template>
  <div class="modal fade" id="simulationEngineModal" data-bs-backdrop="false" data-bs-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel_simulationEngine" aria-hidden="true">
    <div class="modal-backdrop fade" :class="{ show: isModalOpen }" @click="closeModal"></div>
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="staticBackdropLabel_simulationEngine" v-html="$t('simulator:settings.simulationEngine.title')"></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="form-check" v-for="engine in SIMULATION_ENGINES" :key="engine">
            <input
              class="form-check-input"
              type="radio"
              name="simulationEngine"
              :id="'simulationEngine_' + engine"
              :value="engine"
              v-model="simulationEngine"
            >
            <label
              class="form-check-label"
              :for="'simulationEngine_' + engine"
              v-html="$t(`simulator:simulationEngineModal.${engine}.title`) + (engine === 'default' ? '' : '<sup style=\'color: #0006;\'>Beta</sup>')"
            ></label>
            <div
              class="form-text"
              v-text="$t(`simulator:simulationEngineModal.${engine}.description`)"
            ></div>
          </div>
          <template v-if="isPrimitiveEngine">
            <hr>
            <button
              type="button"
              class="engine-settings-toggle d-flex align-items-center justify-content-between w-100"
              :aria-expanded="isEngineSettingsOpen"
              aria-controls="simulationEngineSettings"
              @click="isEngineSettingsOpen = !isEngineSettingsOpen"
            >
              <span class="fw-semibold text-body" v-text="$t('simulator:simulationEngineModal.configuration.title')"></span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                fill="currentColor"
                class="engine-settings-chevron"
                :class="{ 'engine-settings-chevron--open': isEngineSettingsOpen }"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708"/>
              </svg>
            </button>
            <div v-if="isEngineSettingsOpen" id="simulationEngineSettings" class="mt-3">
              <div class="d-flex align-items-start justify-content-between gap-3 mb-1">
                <div class="form-text mt-0" v-text="$t('simulator:simulationEngineModal.configuration.description')"></div>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary flex-shrink-0"
                  :disabled="isEngineConfigDefault"
                  @click="resetEngineConfig"
                  v-text="$t('simulator:simulationEngineModal.configuration.backToDefaults')"
                ></button>
              </div>
              <section
                v-for="(section, sectionIndex) in engineConfigSections"
                :key="section.key"
                class="mt-3"
              >
                <hr v-if="sectionIndex > 0">
                <div
                  class="form-label fw-bold text-body mb-1"
                  v-text="$t(`simulator:simulationEngineModal.configuration.sections.${section.key}.title`)"
                ></div>
                <div
                  v-for="field in section.fields"
                  :key="field.key"
                  class="engine-config-field mb-2"
                >
                  <div class="d-flex align-items-center gap-3">
                    <div class="d-flex align-items-center gap-1 flex-grow-1">
                      <label
                        class="form-label fw-semibold text-body mb-0"
                        :for="'simulationEngineConfig_' + section.key + '_' + field.key"
                        v-text="$t(`simulator:simulationEngineModal.configuration.fields.${field.key}.title`)"
                      ></label>
                      <InfoPopoverIcon
                        v-if="field.hasInfo"
                        light-background
                        placement="left"
                        :content="$t(`simulator:simulationEngineModal.configuration.fields.${field.key}.description`)"
                      />
                    </div>
                    <input
                      v-if="field.type === 'boolean'"
                      type="checkbox"
                      class="form-check-input"
                      :id="'simulationEngineConfig_' + section.key + '_' + field.key"
                      :checked="getEngineConfigValue(section.configKey, field.path)"
                      @change="setEngineConfigOverride(section.configKey, field.path, $event.target.checked)"
                    >
                    <input
                      v-else
                      type="number"
                      class="form-control form-control-sm engine-config-input"
                      :id="'simulationEngineConfig_' + section.key + '_' + field.key"
                      :value="getEngineConfigValue(section.configKey, field.path)"
                      :min="field.min"
                      :max="field.max"
                      :step="field.step"
                      @change="setEngineConfigValue(section.configKey, field, $event)"
                      @keydown.stop
                    >
                  </div>
                </div>
              </section>
            </div>
          </template>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" v-html="$t('simulator:common.closeButton')"></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * @module SimulationEngineModal
 * @description The Vue component for the pop-up modal for Settings -> Simulation Engine.
 */
import { ref, computed, onMounted } from 'vue'
import { usePreferencesStore } from '../store/preferences'
import { DEFAULT_SIMULATION_ENGINE_CONFIGS } from '../../core/simulationEngines/config.js'
import InfoPopoverIcon from './InfoPopoverIcon.vue'

const SIMULATION_ENGINES = [
  'default',
  'primitiveCpu',
  'webgpu',
  'automatic'
]

const getPathValue = (object, path) => {
  const keys = Array.isArray(path) ? path : [path]
  return keys.reduce((value, key) => value?.[key], object)
}

const ENGINE_CONFIG_SECTIONS = [
  {
    key: 'primitiveCpu',
    configKey: 'primitiveCpu',
    fields: [
      { key: 'timeBudgetMs', path: ['timeBudgetMs'], min: 1, step: 1, hasInfo: true },
      { key: 'maxLocalIterations', path: ['maxLocalIterations'], min: 1, step: 1, integer: true, hasInfo: true }
    ]
  },
  {
    key: 'webgpuScheduling',
    configKey: 'webgpu',
    fields: [
      { key: 'workgroupSize', path: ['workgroupSize'], min: 3, step: 1, integer: true, hasInfo: true },
      { key: 'maxLocalIterations', path: ['maxLocalIterations'], min: 1, step: 1, integer: true, hasInfo: true },
      { key: 'maxPingPongsPerSubmission', path: ['maxPingPongsPerSubmission'], min: 1, step: 1, integer: true, hasInfo: true }
    ]
  },
  {
    key: 'webgpuMemory',
    configKey: 'webgpu',
    fields: [
      { key: 'maxBatchRayEvents', path: ['maxBatchRayEvents'], min: 1, step: 1, integer: true, hasInfo: true },
      { key: 'maxReadyGeometryRecords', path: ['maxReadyGeometryRecords'], min: 1, step: 1, integer: true, hasInfo: true }
    ]
  },
  {
    key: 'webgpuNumerics',
    configKey: 'webgpu',
    fields: [
      { key: 'atomicFixedPointScale', path: ['atomicFixedPointScale'], min: 1, max: 16777216, step: 1, integer: true, hasInfo: true }
    ]
  }
]

const defaultConfigFor = configKey => DEFAULT_SIMULATION_ENGINE_CONFIGS[configKey]

export default {
  name: 'SimulationEngineModal',
  components: {
    InfoPopoverIcon
  },
  setup() {
    const preferences = usePreferencesStore()
    const isModalOpen = ref(false)
    const isEngineSettingsOpen = ref(false)
    const isPrimitiveEngine = computed(
      () => preferences.simulationEngine.value !== 'default'
    )
    const engineConfigSections = computed(() => {
      const selectedEngine = preferences.simulationEngine.value
      return ENGINE_CONFIG_SECTIONS.filter(section =>
        selectedEngine === 'automatic' || section.configKey === selectedEngine
      )
    })
    const visibleEngineConfigKeys = computed(() => [
      ...new Set(engineConfigSections.value.map(section => section.configKey))
    ])
    const isEngineConfigDefault = computed(() => {
      const configs = preferences.simulationEngineConfigs.value
      return visibleEngineConfigKeys.value.every(configKey => {
        const overrides = configs?.[configKey]
        return !overrides || Object.keys(overrides).length === 0
      })
    })
    onMounted(() => {
      const modal = document.getElementById('simulationEngineModal')
      modal.addEventListener('show.bs.modal', () => {
        isModalOpen.value = true
        isEngineSettingsOpen.value = false
      })
      modal.addEventListener('hide.bs.modal', () => {
        isModalOpen.value = false
      })
    })

    const closeModal = () => {
      const modal = document.getElementById('simulationEngineModal')
      modal.classList.remove('show')
      modal.setAttribute('aria-hidden', 'true')
      modal.style.display = 'none'
      isModalOpen.value = false
    }

    const getEngineConfigValue = (configKey, path) => {
      const overrides = preferences.simulationEngineConfigs.value?.[configKey]
      return getPathValue(overrides, path) ??
        getPathValue(defaultConfigFor(configKey), path)
    }

    const setEngineConfigOverride = (configKey, path, value) => {
      const keys = Array.isArray(path) ? path : [path]
      const defaultValue = getPathValue(
        defaultConfigFor(configKey),
        keys
      )
      const configs = preferences.simulationEngineConfigs.value
      const nextConfigs = configs && typeof configs === 'object'
        ? { ...configs }
        : {}
      const currentOverrides = nextConfigs[configKey]
      const nextOverrides = currentOverrides && typeof currentOverrides === 'object'
        ? { ...currentOverrides }
        : {}

      if (keys.length === 1) {
        if (value === defaultValue) {
          delete nextOverrides[keys[0]]
        } else {
          nextOverrides[keys[0]] = value
        }
      } else {
        const [groupKey, settingKey] = keys
        const currentGroup = nextOverrides[groupKey]
        const nextGroup = currentGroup && typeof currentGroup === 'object'
          ? { ...currentGroup }
          : {}
        if (value === defaultValue) {
          delete nextGroup[settingKey]
        } else {
          nextGroup[settingKey] = value
        }
        if (Object.keys(nextGroup).length === 0) {
          delete nextOverrides[groupKey]
        } else {
          nextOverrides[groupKey] = nextGroup
        }
      }

      if (Object.keys(nextOverrides).length === 0) {
        delete nextConfigs[configKey]
      } else {
        nextConfigs[configKey] = nextOverrides
      }
      preferences.simulationEngineConfigs.value = nextConfigs
    }

    const setEngineConfigValue = (configKey, field, event) => {
      const parsedValue = Number(event.target.value)
      const isValid =
        event.target.value.trim() !== '' &&
        Number.isFinite(parsedValue) &&
        (!field.integer || Number.isInteger(parsedValue)) &&
        (!field.positive || parsedValue > 0) &&
        (field.min === undefined || parsedValue >= field.min) &&
        (field.max === undefined || parsedValue <= field.max)

      if (!isValid) {
        event.target.value = getEngineConfigValue(configKey, field.path)
        return
      }

      setEngineConfigOverride(configKey, field.path, parsedValue)
    }

    const resetEngineConfig = () => {
      const configs = preferences.simulationEngineConfigs.value
      if (!configs || typeof configs !== 'object') return

      const nextConfigs = { ...configs }
      for (const configKey of visibleEngineConfigKeys.value) {
        delete nextConfigs[configKey]
      }
      preferences.simulationEngineConfigs.value = nextConfigs
    }

    return {
      simulationEngine: preferences.simulationEngine,
      isPrimitiveEngine,
      SIMULATION_ENGINES,
      isEngineSettingsOpen,
      engineConfigSections,
      isEngineConfigDefault,
      getEngineConfigValue,
      setEngineConfigOverride,
      setEngineConfigValue,
      resetEngineConfig,
      isModalOpen,
      closeModal
    }
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.3);
  z-index: 1040;
}

.modal-backdrop.show {
  opacity: 1;
}

.modal-dialog {
  z-index: 1045;
}

.modal-body > .form-check + .form-check {
  margin-top: 1rem;
}

.engine-settings-toggle {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--bs-secondary-color, #6c757d);
}

.engine-settings-toggle:hover .engine-settings-chevron {
  color: var(--bs-body-color, #212529);
}

.engine-settings-toggle:focus-visible {
  outline: 2px solid var(--bs-primary, #0d6efd);
  outline-offset: 3px;
}

.engine-settings-chevron {
  transition: transform 0.15s ease;
}

.engine-settings-chevron--open {
  transform: rotate(180deg);
}

.engine-config-input {
  width: 7rem;
  flex-shrink: 0;
}

</style>
