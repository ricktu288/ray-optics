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
          <div class="form-check form-switch">
            <input
              class="form-check-input"
              type="checkbox"
              role="switch"
              id="usePrimitiveSimulationEngine"
              v-model="usePrimitiveEngine"
            >
            <label
              class="form-check-label fw-semibold text-body"
              for="usePrimitiveSimulationEngine"
              v-text="$t('simulator:simulationEngineModal.accelerated.title')"
            ></label>
            <div
              class="form-text"
              v-text="$t('simulator:simulationEngineModal.accelerated.description')"
            ></div>
          </div>
          <template v-if="isPrimitiveEngine">
            <div class="mt-3">
              <label
                class="form-label fw-semibold text-body"
                for="primitiveEnginePreference"
                v-text="$t('simulator:simulationEngineModal.enginePreference.title')"
              ></label>
              <select
                id="primitiveEnginePreference"
                class="form-select"
                v-model="primitiveEnginePreference"
              >
                <option
                  v-for="engine in PRIMITIVE_ENGINE_PREFERENCES"
                  :key="engine"
                  :value="engine"
                  v-text="$t(`simulator:simulationEngineModal.${engine}.title`)"
                ></option>
              </select>
              <div
                class="form-text"
                v-text="$t(`simulator:simulationEngineModal.${primitiveEnginePreference}.description`)"
              ></div>
            </div>
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
              <div class="engine-calibration-panel mt-3 p-3 rounded">
                <div class="fw-semibold text-body" v-text="$t('simulator:simulationEngineModal.calibration.title')"></div>
                <div class="form-text mt-1" v-text="$t('simulator:simulationEngineModal.calibration.description')"></div>
                <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
                  <button
                    type="button"
                    class="btn btn-sm btn-primary"
                    :disabled="calibrationState === 'running'"
                    @click="startCalibration"
                    v-text="$t('simulator:simulationEngineModal.calibration.start')"
                  ></button>
                  <button
                    v-if="calibrationReport"
                    type="button"
                    class="btn btn-sm btn-outline-secondary"
                    @click="downloadCalibrationReport"
                    v-text="$t('simulator:simulationEngineModal.calibration.download')"
                  ></button>
                </div>
                <div
                  v-if="calibrationReport"
                  class="form-text mt-2"
                  v-text="$t('simulator:simulationEngineModal.calibration.lastRun', { date: calibrationReportDate })"
                ></div>
              </div>
              <div v-if="isPrimitiveEngine" class="form-text mt-2">
                <span
                  v-text="$t('simulator:simulationEngineModal.numericalTolerances.description')"
                ></span>
                <button
                  type="button"
                  class="btn btn-link btn-sm p-0 ms-1 align-baseline"
                  data-bs-toggle="modal"
                  data-bs-target="#numericalToleranceModal"
                  v-text="$t('simulator:simulationEngineModal.numericalTolerances.open')"
                ></button>
              </div>
              <section
                v-for="(section, sectionIndex) in engineConfigSections"
                :key="section.key"
                class="mt-3"
              >
                <hr v-if="sectionIndex > 0">
                <div
                  class="form-label fw-semibold text-body mb-1"
                  v-text="$t(`simulator:simulationEngineModal.configuration.sections.${section.key}.title`)"
                ></div>
                <div
                  v-if="section.hasDescription"
                  class="form-text mt-0 mb-2"
                  v-text="$t(`simulator:simulationEngineModal.configuration.sections.${section.key}.description`)"
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
                <div
                  v-if="section.key === 'bvh'"
                  class="form-check mt-2 mb-2"
                >
                  <input
                    class="form-check-input"
                    type="checkbox"
                    id="simulationEngineDrawBvh"
                    :checked="getEngineConfigValue('primitive', ['bvh', 'drawBounds'])"
                    @change="setEngineConfigOverride('primitive', ['bvh', 'drawBounds'], $event.target.checked)"
                  >
                  <div class="d-flex align-items-center gap-1">
                    <label
                      class="form-check-label fw-semibold text-body"
                      for="simulationEngineDrawBvh"
                      v-text="$t('simulator:simulationEngineModal.configuration.fields.drawBounds.title')"
                    ></label>
                    <InfoPopoverIcon
                      light-background
                      placement="left"
                      :content="$t('simulator:simulationEngineModal.configuration.fields.drawBounds.description')"
                    />
                  </div>
                </div>
              </section>
              <hr>
              <div class="form-check mb-1">
                <input
                  class="form-check-input"
                  type="checkbox"
                  id="simulationEngineLogDebugInfo"
                  :checked="getEngineConfigValue('primitive', 'logDebugInfo')"
                  @change="setEngineConfigOverride('primitive', 'logDebugInfo', $event.target.checked)"
                >
                <label
                  class="form-check-label fw-semibold text-body"
                  for="simulationEngineLogDebugInfo"
                  v-text="$t('simulator:simulationEngineModal.configuration.logDebugInfo.title')"
                ></label>
                <div
                  class="form-text"
                  v-text="$t('simulator:simulationEngineModal.configuration.logDebugInfo.description')"
                ></div>
              </div>
            </div>
          </template>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" v-html="$t('simulator:common.closeButton')"></button>
        </div>
      </div>
    </div>
  </div>
  <Teleport to="body">
    <div
      v-if="calibrationState !== 'idle'"
      class="engine-calibration-splash"
      role="dialog"
      aria-modal="true"
      aria-labelledby="engineCalibrationSplashTitle"
    >
      <div class="engine-calibration-card shadow-lg rounded p-4">
        <h4
          id="engineCalibrationSplashTitle"
          class="mb-3"
          v-text="$t(`simulator:simulationEngineModal.calibration.${calibrationState}.title`)"
        ></h4>
        <template v-if="calibrationState === 'running'">
          <p v-text="$t('simulator:simulationEngineModal.calibration.warning')"></p>
          <div class="progress mb-2" role="progressbar" :aria-valuenow="calibrationPercent" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar progress-bar-striped progress-bar-animated" :style="{ width: calibrationPercent + '%' }"></div>
          </div>
          <div class="small text-body-secondary" v-text="calibrationProgressText"></div>
          <button
            type="button"
            class="btn btn-outline-secondary mt-4"
            @click="cancelCalibration"
            v-text="$t('simulator:simulationEngineModal.calibration.cancel')"
          ></button>
        </template>
        <template v-else-if="calibrationState === 'complete'">
          <p v-text="$t('simulator:simulationEngineModal.calibration.complete.description')"></p>
          <div class="d-flex flex-wrap gap-2">
            <button
              type="button"
              class="btn btn-primary"
              @click="dismissCalibrationSplash"
              v-text="$t('simulator:simulationEngineModal.calibration.returnToSettings')"
            ></button>
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="downloadCalibrationReport"
              v-text="$t('simulator:simulationEngineModal.calibration.download')"
            ></button>
          </div>
        </template>
        <template v-else>
          <p class="text-danger" v-text="calibrationError"></p>
          <button
            type="button"
            class="btn btn-secondary"
            @click="dismissCalibrationSplash"
            v-text="$t('simulator:simulationEngineModal.calibration.returnToSettings')"
          ></button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script>
/**
 * @module SimulationEngineModal
 * @description The Vue component for the pop-up modal for Settings -> Simulation Engine.
 */
import { ref, computed, onMounted } from 'vue'
import i18next from 'i18next'
import { usePreferencesStore } from '../store/preferences'
import {
  DEFAULT_PRIMITIVE_SIMULATOR_CONFIG,
  DEFAULT_SIMULATION_ENGINE_CONFIGS
} from '../../core/simulationEngines/config.js'
import {
  calibrateSimulationEngines,
  loadSimulationEngineCalibrationReport
} from '../../core/simulationEngines/calibration/index.js'
import InfoPopoverIcon from './InfoPopoverIcon.vue'

const PRIMITIVE_ENGINE_PREFERENCES = [
  'automatic',
  'primitiveCpu',
  'webgpu'
]

const getPathValue = (object, path) => {
  const keys = Array.isArray(path) ? path : [path]
  return keys.reduce((value, key) => value?.[key], object)
}

const ENGINE_CONFIG_SECTIONS = [
  {
    key: 'engineSelection',
    configKey: 'primitive',
    hasDescription: true,
    fields: [
      { key: 'webGpuWorkloadThreshold', path: ['engineSelection', 'webGpuWorkloadThreshold'], min: 1, step: 1, integer: true, hasInfo: true },
      { key: 'outgoingCoefficient', path: ['engineSelection', 'outgoingCoefficient'], min: 0, step: 0.01, hasInfo: true },
      { key: 'defaultRenderCoefficient', path: ['engineSelection', 'defaultRenderCoefficient'], min: 0, step: 0.01, hasInfo: true },
      { key: 'nonDefaultRenderCoefficient', path: ['engineSelection', 'nonDefaultRenderCoefficient'], min: 0, step: 0.01, hasInfo: true },
      { key: 'grinStepCoefficient', path: ['engineSelection', 'grinStepCoefficient'], min: 0, step: 0.001, hasInfo: true }
    ]
  },
  {
    key: 'bvh',
    configKey: 'primitive',
    hasDescription: true,
    fields: [
      { key: 'lineLeafSize', path: ['bvh', 'lineLeafSize'], min: 1, step: 1, integer: true, hasInfo: true },
      { key: 'arcLeafSize', path: ['bvh', 'arcLeafSize'], min: 1, step: 1, integer: true, hasInfo: true },
      { key: 'cubicBezierLeafSize', path: ['bvh', 'cubicBezierLeafSize'], min: 1, step: 1, integer: true, hasInfo: true },
      { key: 'directPrimitiveThreshold', path: ['bvh', 'directPrimitiveThreshold'], min: 0, step: 1, integer: true, hasInfo: true },
      { key: 'consecutiveLocalityFactor', path: ['bvh', 'consecutiveLocalityFactor'], min: 0, step: 'any', hasInfo: true },
      { key: 'maxGroupExtent', path: ['bvh', 'maxGroupExtent'], min: 0, step: 'any', positive: true, hasInfo: true }
    ]
  },
  {
    key: 'primitiveCpu',
    configKey: 'primitiveCpu',
    fields: [
      { key: 'timeBudgetMs', path: ['timeBudgetMs'], min: 1, step: 1, hasInfo: true },
      { key: 'maxLocalIterations', path: ['maxLocalIterations'], min: 1, step: 1, integer: true, hasInfo: true }
    ]
  },
  {
    key: 'webgpuCooperation',
    configKey: 'webgpu',
    hasDescription: true,
    fields: [
      { key: 'rayCooperationEnabled', path: ['rayCooperationEnabled'], type: 'boolean', hasInfo: true },
      { key: 'rayCooperationSaturationRayCount', path: ['rayCooperationSaturationRayCount'], min: 1, step: 1, integer: true, hasInfo: true },
      { key: 'rayCooperationDirectMaxTestsPerLane', path: ['rayCooperationDirectMaxTestsPerLane'], min: 0, step: 1, hasInfo: true },
      { key: 'rayCooperationMaximumLanesPerRay', path: ['rayCooperationMaximumLanesPerRay'], min: 1, step: 1, integer: true, hasInfo: true },
      { key: 'rayCooperationMaximumHaloFraction', path: ['rayCooperationMaximumHaloFraction'], min: 0, max: 0.999, step: 0.01, hasInfo: true }
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
    hasDescription: true,
    fields: [
      { key: 'maxBatchRayEvents', path: ['maxBatchRayEvents'], min: 1, step: 1, integer: true, hasInfo: true },
      { key: 'maxReadyLineRecords', path: ['maxReadyLineRecords'], min: 1, step: 1, integer: true, hasInfo: true },
      { key: 'maxReadyPointRecords', path: ['maxReadyPointRecords'], min: 1, step: 1, integer: true, hasInfo: true }
    ]
  },
  {
    key: 'webgpuNumerics',
    configKey: 'webgpu',
    hasDescription: true,
    fields: [
      { key: 'atomicFixedPointScale', path: ['atomicFixedPointScale'], min: 1, max: 16777216, step: 1, integer: true, hasInfo: true }
    ]
  }
]

const defaultConfigFor = configKey => configKey === 'primitive'
  ? DEFAULT_PRIMITIVE_SIMULATOR_CONFIG
  : DEFAULT_SIMULATION_ENGINE_CONFIGS[configKey]

export default {
  name: 'SimulationEngineModal',
  components: {
    InfoPopoverIcon
  },
  setup() {
    const preferences = usePreferencesStore()
    const isModalOpen = ref(false)
    const isEngineSettingsOpen = ref(false)
    const calibrationState = ref('idle')
    const calibrationProgress = ref({
      phase: 'preparing', completed: 0, total: 1, fraction: 0
    })
    const calibrationError = ref('')
    const calibrationReport = ref(null)
    let calibrationController = null
    const isPrimitiveEngine = computed(
      () => preferences.simulationEngine.value !== 'default'
    )
    const usePrimitiveEngine = computed({
      get: () => isPrimitiveEngine.value,
      set: enabled => {
        preferences.simulationEngine.value = enabled
          ? 'automatic'
          : 'default'
      }
    })
    const primitiveEnginePreference = computed({
      get: () => isPrimitiveEngine.value
        ? preferences.simulationEngine.value
        : 'automatic',
      set: value => {
        if (PRIMITIVE_ENGINE_PREFERENCES.includes(value)) {
          preferences.simulationEngine.value = value
        }
      }
    })
    const isEngineConfigDefault = computed(() => {
      const configs = preferences.simulationEngineConfigs.value
      return ['primitive', 'primitiveCpu', 'webgpu'].every(configKey => {
        const overrides = configs?.[configKey]
        return !overrides || Object.keys(overrides).length === 0
      })
    })
    const calibrationPercent = computed(() => Math.max(
      0,
      Math.min(100, Math.round(calibrationProgress.value.fraction * 100))
    ))
    const calibrationProgressText = computed(() => {
      const progress = calibrationProgress.value
      return i18next.t(
        `simulator:simulationEngineModal.calibration.phases.${progress.phase}`,
        {
          completed: progress.completed,
          total: progress.total,
          probe: progress.probeId ?? '',
          configuration: progress.configurationId ?? ''
        }
      )
    })
    const calibrationReportDate = computed(() => {
      const date = calibrationReport.value?.finishedAt
      return date ? new Date(date).toLocaleString() : ''
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
      calibrationReport.value = loadSimulationEngineCalibrationReport()
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
      delete nextConfigs.primitive
      delete nextConfigs.primitiveCpu
      delete nextConfigs.webgpu
      preferences.simulationEngineConfigs.value = nextConfigs
    }

    const applyCalibrationOverrides = overrides => {
      const configs = preferences.simulationEngineConfigs.value
      const nextConfigs = configs && typeof configs === 'object'
        ? { ...configs }
        : {}
      nextConfigs.primitive = {
        ...(nextConfigs.primitive ?? {}),
        engineSelection: {
          ...(nextConfigs.primitive?.engineSelection ?? {}),
          ...overrides.primitive.engineSelection
        }
      }
      nextConfigs.webgpu = {
        ...(nextConfigs.webgpu ?? {}),
        ...overrides.webgpu
      }
      preferences.simulationEngineConfigs.value = nextConfigs
    }

    const startCalibration = async () => {
      if (calibrationState.value === 'running') return
      calibrationController = new AbortController()
      calibrationError.value = ''
      calibrationProgress.value = {
        phase: 'preparing', completed: 0, total: 1, fraction: 0
      }
      calibrationState.value = 'running'
      try {
        const result = await calibrateSimulationEngines({
          currentConfigs: preferences.simulationEngineConfigs.value,
          signal: calibrationController.signal,
          onProgress: progress => {
            calibrationProgress.value = progress
          }
        })
        applyCalibrationOverrides(result.overrides)
        calibrationReport.value = result.report
        calibrationState.value = 'complete'
      } catch (error) {
        calibrationError.value = error?.message ?? String(error)
        calibrationState.value = 'failed'
      } finally {
        calibrationController = null
      }
    }

    const cancelCalibration = () => {
      calibrationController?.abort(new Error(
        i18next.t('simulator:simulationEngineModal.calibration.cancelled')
      ))
    }

    const dismissCalibrationSplash = () => {
      if (calibrationState.value !== 'running') calibrationState.value = 'idle'
    }

    const downloadCalibrationReport = () => {
      if (!calibrationReport.value) return
      const blob = new Blob(
        [JSON.stringify(calibrationReport.value, null, 2)],
        { type: 'application/json' }
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `simulation-engine-calibration-${
        calibrationReport.value.finishedAt.replaceAll(':', '-').replaceAll('.', '-')
      }.json`
      link.click()
      URL.revokeObjectURL(url)
    }

    return {
      usePrimitiveEngine,
      primitiveEnginePreference,
      isPrimitiveEngine,
      PRIMITIVE_ENGINE_PREFERENCES,
      isEngineSettingsOpen,
      engineConfigSections: ENGINE_CONFIG_SECTIONS,
      isEngineConfigDefault,
      getEngineConfigValue,
      setEngineConfigOverride,
      setEngineConfigValue,
      resetEngineConfig,
      calibrationState,
      calibrationPercent,
      calibrationProgressText,
      calibrationError,
      calibrationReport,
      calibrationReportDate,
      startCalibration,
      cancelCalibration,
      dismissCalibrationSplash,
      downloadCalibrationReport,
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

.engine-calibration-panel {
  border: 1px solid var(--bs-border-color, #dee2e6);
  background: var(--bs-tertiary-bg, #f8f9fa);
}

.engine-calibration-splash {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.72);
}

.engine-calibration-card {
  width: min(34rem, 100%);
  background: var(--bs-body-bg, #fff);
  color: var(--bs-body-color, #212529);
}
</style>
