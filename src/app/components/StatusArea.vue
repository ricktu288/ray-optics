<!--
  Copyright 2025 The Ray Optics Simulation authors and contributors

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
  <div class="footer-left" id="footer-left" :style="notificationStyle">
    <div class="status-inline">
      <span
        v-show="betaFeatures.length > 0"
        class="beta-icon"
        v-tooltip-popover:popover="{
          title: $t('simulator:footer.betaFeatures.title'),
          content: betaPopoverContent,
          trigger: 'click',
          placement: 'top',
          html: true
        }"
        @click.stop
      >
        Beta
      </span>
      <div id="forceStop" v-show="simulatorStatus?.isSimulatorRunning" @click="handleForceStop" :style="forceStopStyle">
        <div class="spinner-border text-secondary" role="status"></div>
        <span v-html="$t('simulator:footer.processing')"></span>
      </div>
    </div>
    <div id="status" v-show="showStatus" :style="statusStyle">
      <div v-html="formattedMousePosition"></div>
      <div v-html="formattedSimulatorStatus.join('<br>')"></div>
    </div>
    <div id="warning" class="status-alert" v-show="warnings.length > 0" @click="onJsonToggleClick" @mouseover="onPrimitiveCurveReferenceEnter" @mouseout="onPrimitiveCurveReferenceLeave" @focusin="onPrimitiveCurveReferenceEnter" @focusout="onPrimitiveCurveReferenceLeave"><svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="status-alert__lead-icon bi bi-exclamation-triangle-fill" viewBox="0 0 16 20">
        <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>
      </svg><span class="status-alert__message">
        <span class="status-alert__text" v-html="formattedWarningsHtml"></span><button
          type="button"
          class="status-alert__copy"
          v-tooltip-popover="{ title: $t('simulator:footer.copyStatusMessage.title') }"
          :aria-label="warningsCopied ? $t('simulator:footer.copyStatusMessage.copied') : $t('simulator:footer.copyStatusMessage.title')"
          @click="copyWarnings"
        >
          <svg v-show="!warningsCopied" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="status-alert__copy-icon bi bi-copy" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"/>
          </svg>
          <svg v-show="warningsCopied" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="status-alert__copy-icon status-alert__copy-icon--success bi bi-check-lg" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022Z"/>
          </svg>
        </button>
      </span>
    </div>
    <div id="error" class="status-alert" v-show="errors.length > 0" @click="onJsonToggleClick" @mouseover="onPrimitiveCurveReferenceEnter" @mouseout="onPrimitiveCurveReferenceLeave" @focusin="onPrimitiveCurveReferenceEnter" @focusout="onPrimitiveCurveReferenceLeave"><svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="status-alert__lead-icon bi bi-exclamation-circle-fill" viewBox="0 0 16 20">
        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4m.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2"/>
      </svg><span class="status-alert__message">
        <span class="status-alert__text" v-html="formattedErrorsHtml"></span><button
          type="button"
          class="status-alert__copy"
          v-tooltip-popover="{ title: $t('simulator:footer.copyStatusMessage.title') }"
          :aria-label="errorsCopied ? $t('simulator:footer.copyStatusMessage.copied') : $t('simulator:footer.copyStatusMessage.title')"
          @click="copyErrors"
        >
          <svg v-show="!errorsCopied" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="status-alert__copy-icon bi bi-copy" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"/>
          </svg>
          <svg v-show="errorsCopied" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="status-alert__copy-icon status-alert__copy-icon--success bi bi-check-lg" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022Z"/>
          </svg>
        </button>
      </span>
    </div>
    <VirtualKeyboard />
  </div>
</template>

<script>
/**
 * @module StatusArea
 * @description The Vue component for the status area (including mouse coordinates, simulator status, warnings and errors) at the lower left corner.
 */
import { usePreferencesStore } from '../store/preferences'
import { useThemeStore } from '../store/theme'
import { useStatus } from '../composables/useStatus'
import { computed, onBeforeUnmount, ref, toRef, watch } from 'vue'
import i18next from 'i18next'
import { app } from '../services/app'
import VirtualKeyboard from './VirtualKeyboard.vue'
import { vTooltipPopover } from '../directives/tooltip-popover'
import { parseLinks } from '../utils/links.js'
import { formatStatusLineHtml } from '../utils/compactJsonInStatusMessage.js'

export default {
  name: 'StatusArea',
  components: {
    VirtualKeyboard
  },
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  setup() {
    const preferences = usePreferencesStore()
    const themeStore = useThemeStore()
    const status = useStatus()
    const showSidebar = toRef(preferences, 'showSidebar')
    const sidebarWidth = toRef(preferences, 'sidebarWidth')
    
    const notificationStyle = computed(() => ({
      left: showSidebar.value ? `${sidebarWidth.value}px` : '0px'
    }))

    // Computed styles that adapt to theme - status overlay uses scene background color
    const statusStyle = computed(() => {
      const isLight = themeStore.backgroundIsLight.value
      const bgColor = themeStore.getThemeObject('background')?.color || { r: 1, g: 1, b: 1 }
      
      // Use actual scene background color with transparency
      const backgroundColor = `rgba(${Math.round(bgColor.r * 255)}, ${Math.round(bgColor.g * 255)}, ${Math.round(bgColor.b * 255)}, 0.8)`
      
      return {
        color: isLight ? '#333333' : 'gray',
        backgroundColor: backgroundColor
      }
    })

    const forceStopStyle = computed(() => {
      const isLight = themeStore.backgroundIsLight.value
      // Force stop button should be visible in both themes
      return {
        color: isLight ? '#666666' : 'gray'
      }
    })

    const handleForceStop = () => {
      app.simulator.stopSimulation()
    }

    const betaPopoverContent = computed(() => {
      if (!status.activeBetaFeatures.value?.length) {
        return ''
      }

      const listItems = status.activeBetaFeatures.value
        .map((feature) => `<li>${feature}</li>`)
        .join('')

      const description = i18next.t('simulator:footer.betaFeatures.description')
      const details = i18next.t('simulator:footer.betaFeatures.details')
      return parseLinks(`${description}<ul>${listItems}</ul>${details}`)
    })

    const expandedJsonWarnings = ref({})
    const expandedJsonErrors = ref({})

    watch(
      () => (status.activeWarnings.value ?? []).join('\u0000'),
      () => {
        expandedJsonWarnings.value = {}
      }
    )
    watch(
      () => (status.activeErrors.value ?? []).join('\u0000'),
      () => {
        expandedJsonErrors.value = {}
      }
    )

    const formattedWarningsHtml = computed(() => {
      const labels = {
        expand: i18next.t('simulator:footer.jsonFold.expand'),
        primitiveCurve: curveId => i18next.t(
          'simulator:footer.primitiveCurveReference.highlight',
          { curveId }
        )
      }
      return status.activeWarnings.value
        .map((line, lineIdx) =>
          formatStatusLineHtml(String(line), {
            expanded: expandedJsonWarnings.value,
            keyPrefix: 'w',
            lineIdx,
            labels
          })
        )
        .join('<br>')
    })

    const formattedErrorsHtml = computed(() => {
      const labels = {
        expand: i18next.t('simulator:footer.jsonFold.expand'),
        primitiveCurve: curveId => i18next.t(
          'simulator:footer.primitiveCurveReference.highlight',
          { curveId }
        )
      }
      return status.activeErrors.value
        .map((line, lineIdx) =>
          formatStatusLineHtml(String(line), {
            expanded: expandedJsonErrors.value,
            keyPrefix: 'e',
            lineIdx,
            labels
          })
        )
        .join('<br>')
    })

    const onJsonToggleClick = (e) => {
      const btn = e.target.closest?.('.status-alert__json-toggle')
      if (!btn) return
      const key = btn.getAttribute('data-json-key')
      if (!key) return
      e.preventDefault()
      e.stopPropagation()
      btn.blur()
      if (key.startsWith('w-')) {
        expandedJsonWarnings.value = { ...expandedJsonWarnings.value, [key]: true }
      } else if (key.startsWith('e-')) {
        expandedJsonErrors.value = { ...expandedJsonErrors.value, [key]: true }
      }
    }

    let highlightedPrimitiveCurveId = null

    const getPrimitiveCurveReference = (target) =>
      target.closest?.('.status-alert__primitive-curve-ref') ?? null

    const referenceContainsTarget = (reference, target) =>
      Boolean(target?.nodeType) && reference.contains(target)

    const setPrimitiveCurveHighlight = (curveId) => {
      if (highlightedPrimitiveCurveId === curveId) return
      highlightedPrimitiveCurveId = curveId
      app.editor?.setExternalHighlightPrimitiveCurveIds(
        curveId === null ? [] : [curveId]
      )
      app.simulator?.updateSimulation(true, true)
    }

    const onPrimitiveCurveReferenceEnter = (e) => {
      const reference = getPrimitiveCurveReference(e.target)
      if (!reference) return
      if (referenceContainsTarget(reference, e.relatedTarget)) return
      const curveId = Number(reference.dataset.primitiveCurveId)
      if (!Number.isSafeInteger(curveId) || curveId < 0) return
      setPrimitiveCurveHighlight(curveId)
    }

    const onPrimitiveCurveReferenceLeave = (e) => {
      const reference = getPrimitiveCurveReference(e.target)
      if (
        !reference ||
        referenceContainsTarget(reference, e.relatedTarget)
      ) return
      setPrimitiveCurveHighlight(null)
    }

    watch(
      [
        () => (status.activeWarnings.value ?? []).join('\u0000'),
        () => (status.activeErrors.value ?? []).join('\u0000')
      ],
      () => setPrimitiveCurveHighlight(null)
    )

    const warningsCopied = ref(false)
    const errorsCopied = ref(false)
    let warningsCopiedTimer = null
    let errorsCopiedTimer = null

    const COPIED_FEEDBACK_MS = 2000

    const copyWarnings = async () => {
      const text = status.activeWarnings.value.map((line) => String(line)).join('\n')
      try {
        await navigator.clipboard.writeText(text)
        warningsCopied.value = true
        if (warningsCopiedTimer !== null) clearTimeout(warningsCopiedTimer)
        warningsCopiedTimer = setTimeout(() => {
          warningsCopied.value = false
          warningsCopiedTimer = null
        }, COPIED_FEEDBACK_MS)
      } catch {
        /* clipboard unavailable */
      }
    }

    const copyErrors = async () => {
      const text = status.activeErrors.value.map((line) => String(line)).join('\n')
      try {
        await navigator.clipboard.writeText(text)
        errorsCopied.value = true
        if (errorsCopiedTimer !== null) clearTimeout(errorsCopiedTimer)
        errorsCopiedTimer = setTimeout(() => {
          errorsCopied.value = false
          errorsCopiedTimer = null
        }, COPIED_FEEDBACK_MS)
      } catch {
        /* clipboard unavailable */
      }
    }

    onBeforeUnmount(() => {
      if (warningsCopiedTimer !== null) clearTimeout(warningsCopiedTimer)
      if (errorsCopiedTimer !== null) clearTimeout(errorsCopiedTimer)
      if (highlightedPrimitiveCurveId !== null) {
        setPrimitiveCurveHighlight(null)
      }
    })

    return {
      showStatus: preferences.showStatus,
      notificationStyle,
      statusStyle,
      forceStopStyle,
      // From status composable
      formattedMousePosition: status.formattedMousePosition,
      formattedSimulatorStatus: status.formattedSimulatorStatus,
      errors: status.activeErrors,
      warnings: status.activeWarnings,
      betaFeatures: status.activeBetaFeatures,
      simulatorStatus: status.simulatorStatus,
      betaPopoverContent,
      formattedWarningsHtml,
      formattedErrorsHtml,
      // Methods
      handleForceStop,
      copyWarnings,
      copyErrors,
      warningsCopied,
      errorsCopied,
      onJsonToggleClick,
      onPrimitiveCurveReferenceEnter,
      onPrimitiveCurveReferenceLeave
    }
  }
}
</script>

<style scoped>
.footer-left {
  position: absolute;
  bottom: 0;
  z-index: -2;
  padding-right: 80px;
  pointer-events: none;
}

#forceStop {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  pointer-events: auto;
}

.status-inline {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  pointer-events: auto;
}

.beta-icon {
  border: 1px solid currentColor;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  padding: 0 6px;
  margin: 3px;
  box-sizing: border-box;
  font-size: 0.7em;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}

.beta-icon {
  color: #f28d28d0;
}

#forceStop .spinner-border {
  width: 1rem;
  height: 1rem;
}

#status {
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border-top-right-radius: 0.5em;
  width: fit-content;
  pointer-events: auto;
}

.status-alert {
  /* Inline flow (like the original): icon + text share one line box so size/align match monospace. */
  display: inline-block;
  width: fit-content;
  max-width: 100%;
  font-family: monospace;
  padding-right: 0.35em;
  padding-left: 0.35em;
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border-top-right-radius: 0.5em;
  pointer-events: auto;
}

.status-alert__lead-icon {
  display: inline-block;
  vertical-align: middle;
  height: 1em;
  width: 0.8em;
  margin-right: 0.35em;
  box-sizing: content-box;
}

.status-alert__message {
  display: inline;
}

.status-alert__text {
  padding-right: 0.15em;
}

.status-alert__copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 0.15em;
  margin-bottom: 3px;
  border: none;
  background: transparent;
  cursor: pointer;
  line-height: inherit;
  vertical-align: middle;
}

.status-alert__copy:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 1px;
}

.status-alert__copy .status-alert__copy-icon {
  display: block;
  width: 14px;
  height: 14px;
  opacity: 0.88;
}

.status-alert__copy:hover .status-alert__copy-icon:not(.status-alert__copy-icon--success) {
  opacity: 1;
}

.status-alert__copy .status-alert__copy-icon--success {
  opacity: 1;
  color: #198754;
}

#warning {
  color: black;
  background-color:rgb(255,255,0,0.8);
}

#warning .status-alert__copy {
  color: rgba(0, 0, 0, 0.92);
}

#error {
  color: white;
  background-color:rgba(255,0,0,0.7);
}

#error .status-alert__copy {
  color: rgba(255, 255, 255, 0.95);
}

#error .status-alert__copy-icon--success {
  color: #20c997;
}

/* Injected via v-html (JSON fold); :deep so scoped attrs apply */
:deep(.status-alert__json-toggle) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0 2px;
  padding: 2px 5px;
  box-sizing: border-box;
  min-width: 1.35em;
  min-height: 1.25em;
  border: 1px solid currentColor;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  vertical-align: middle;
  line-height: 0;
}

#warning :deep(.status-alert__json-toggle) {
  border-color: rgba(0, 0, 0, 0.38);
  background: rgba(0, 0, 0, 0.06);
}

#error :deep(.status-alert__json-toggle) {
  border-color: rgba(255, 255, 255, 0.45);
  background: rgba(255, 255, 255, 0.12);
}

:deep(.status-alert__json-toggle:focus-visible) {
  outline: 2px solid currentColor;
  outline-offset: 1px;
}

:deep(.status-alert__json-toggle-icon) {
  display: block;
  opacity: 0.9;
}

:deep(.status-alert__json-expanded) {
  overflow-wrap: anywhere;
  word-break: break-word;
}

:deep(.status-alert__primitive-curve-ref) {
  display: inline-block;
  margin: 0 1px;
  padding: 0 0.3em;
  border: 1px solid currentColor;
  border-radius: 0.35em;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  line-height: 1.25;
  cursor: crosshair;
  vertical-align: baseline;
}

#warning :deep(.status-alert__primitive-curve-ref) {
  border-color: rgba(0, 0, 0, 0.45);
  background: rgba(0, 0, 0, 0.08);
}

#error :deep(.status-alert__primitive-curve-ref) {
  border-color: rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.14);
}

:deep(.status-alert__primitive-curve-ref:hover),
:deep(.status-alert__primitive-curve-ref:focus-visible) {
  outline: 2px solid currentColor;
  outline-offset: 1px;
}

</style>
