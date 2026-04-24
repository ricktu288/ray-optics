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
  <div class="modal fade" id="importShapesModal" data-bs-backdrop="false" data-bs-keyboard="false" tabindex="-1" aria-labelledby="staticBackdropLabel_importShapes" aria-hidden="true">
    <div class="modal-backdrop fade" :class="{ show: isModalOpen }" @click="closeModal"></div>
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="staticBackdropLabel_importShapes" v-text="$t('simulator:importShapesModal.title')"></h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" @click="reset"></button>
        </div>
        <div class="modal-body import-shapes-modal-body">
          <div v-if="errorMessage" class="alert alert-danger">
            {{ errorMessage }}
          </div>

          <div v-if="parsedPaths.length > 0" class="row g-3 align-items-start">
            <div class="col-md-5 d-flex flex-column">
              <div v-if="fileName" class="form-text mb-2">
                <span class="text-muted small">{{ fileName }}</span>
              </div>
              <div class="preview-container">
                <svg v-if="previewViewBox"
                  class="preview-svg"
                  :viewBox="previewViewBox"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden="true"
                >
                  <path
                    v-for="(p, i) in parsedPaths"
                    :key="i"
                    :d="pathSvgD[i]"
                    :stroke="previewStroke(p)"
                    :fill="previewFill(p)"
                    :stroke-width="previewStrokeWidth"
                    vector-effect="non-scaling-stroke"
                  />
                </svg>
              </div>
              <div class="form-text text-center mt-1">
                <span v-text="$t('simulator:importShapesModal.stats', {
                  count: parsedPaths.length,
                  total: parsedPaths.length,
                  closed: closedCount,
                  open: openCount,
                })"></span>
              </div>
            </div>

            <div class="col-md-7">
              <div v-if="strokeColors.length > 0" class="mb-3">
                <div class="form-label small fw-bold mb-2" v-text="$t('simulator:importShapesModal.strokeHeading')"></div>
                <div
                  v-for="entry in strokeColors"
                  :key="'s-' + entry.key"
                  class="d-flex align-items-center mb-2"
                >
                  <span class="color-swatch me-2" :style="{ backgroundColor: swatchCss(entry.color) }"></span>
                  <span class="small me-2 font-monospace" :title="swatchLabel(entry)">{{ entry.key }}</span>
                  <span class="small text-muted me-auto">×{{ entry.count }}</span>
                  <select class="form-select form-select-sm w-auto" v-model="strokeActions[entry.key]">
                    <option value="none" v-text="$t('simulator:importShapesModal.actions.ignore')"></option>
                    <option value="CurveMirror" v-text="$t('main:meta.parentheses', { main: $t('main:tools.categories.mirror'), sub: $t('main:tools.CurveMirror.title') })"></option>
                    <option value="CustomCurveSurface" v-text="$t('main:tools.CustomCurveSurface.title')"></option>
                    <option value="Drawing" v-text="$t('main:tools.Drawing.title')"></option>
                  </select>
                </div>
              </div>

              <div v-if="fillColors.length > 0" class="mb-3">
                <div class="form-label small fw-bold mb-2" v-text="$t('simulator:importShapesModal.fillHeading')"></div>
                <div v-for="entry in fillColors" :key="'f-' + entry.key" class="mb-2">
                  <div class="d-flex align-items-start">
                    <div class="d-flex align-items-center me-2 flex-shrink-0">
                      <span class="color-swatch me-2" :style="{ backgroundColor: swatchCss(entry.color) }"></span>
                      <span class="small me-2 font-monospace" :title="swatchLabel(entry)">{{ entry.key }}</span>
                      <span class="small text-muted">×{{ entry.count }}</span>
                    </div>
                    <div class="import-fill-action-group d-flex flex-column align-items-start ms-auto min-w-0 flex-shrink-0">
                      <select class="form-select form-select-sm w-auto" v-model="fillActions[entry.key].action">
                        <option value="none" v-text="$t('simulator:importShapesModal.actions.ignore')"></option>
                        <option value="CurveGlass" v-text="$t('main:meta.parentheses', { main: $t('main:tools.categories.glass'), sub: $t('main:tools.CurveGlass.title') })"></option>
                        <option value="CurveGrinGlass" v-text="$t('main:tools.CurveGrinGlass.title')"></option>
                      </select>
                      <div
                        v-if="fillActions[entry.key].action === 'CurveGlass'"
                        class="import-glass-params d-flex justify-content-start align-items-center flex-nowrap mt-1 gap-1"
                      >
                    <template v-if="!simulateColors">
                      <span class="small mb-0 text-nowrap">n=</span>
                      <input
                        type="number"
                        class="form-control form-control-sm import-glass-num-input"
                        min="0.5"
                        max="5"
                        v-model.number="fillActions[entry.key].refIndex"
                        @keydown.stop
                      >
                    </template>
                    <template v-else>
                      <span class="small mb-0 text-nowrap">A=</span>
                      <input
                        type="number"
                        class="form-control form-control-sm import-glass-num-input"
                        min="0.5"
                        max="5"
                        v-model.number="fillActions[entry.key].refIndex"
                        @keydown.stop
                      >
                      <span class="small mb-0 text-nowrap">,</span>
                      <span class="small mb-0 text-nowrap">B=</span>
                      <input
                        type="number"
                        class="form-control form-control-sm import-glass-b-input"
                        min="0"
                        v-model.number="fillActions[entry.key].cauchyB"
                        @keydown.stop
                      >
                      <span class="small text-muted mb-0 text-nowrap">μm²</span>
                    </template>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <hr class="my-2">

              <div class="import-placement-row d-flex align-items-center flex-wrap gap-2 mb-2">
                <div class="d-flex align-items-center gap-1 flex-shrink-0 import-placement-scale-group">
                  <label class="form-label small mb-0 text-nowrap import-placement-label" v-text="$t('simulator:importShapesModal.scale')"></label>
                  <input
                    type="text"
                    class="form-control form-control-sm import-placement-scale"
                    v-model="scaleStr"
                    inputmode="decimal"
                    @blur="commitScale"
                    @keydown.enter.prevent="commitScale"
                    @keydown.stop
                    autocomplete="off"
                    spellcheck="false"
                  >
                </div>
                <div class="d-flex align-items-center gap-1 flex-shrink-0 import-placement-offset-group">
                  <label class="form-label small mb-0 text-nowrap import-placement-label" v-text="$t('simulator:importShapesModal.offsetPair')"></label>
                  <input
                    type="text"
                    class="form-control form-control-sm import-placement-offset-pair"
                    v-model="offsetPairStr"
                    @blur="commitOffsetPair"
                    @keydown.enter.prevent="commitOffsetPair"
                    @keydown.stop
                    autocomplete="off"
                    spellcheck="false"
                  >
                </div>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary import-reset-viewport-btn ms-auto flex-shrink-0"
                  v-tooltip-popover="{ title: $t('simulator:importShapesModal.centerTooltip'), placement: 'top' }"
                  @click="resetPosition"
                  :aria-label="$t('simulator:importShapesModal.centerTooltip')"
                >
                  <span v-text="$t('simulator:importShapesModal.centerButton')"></span>
                </button>
              </div>

              <div class="import-tolerance-row d-flex align-items-center gap-1 mb-2 flex-wrap">
                <label class="form-label small mb-0 text-nowrap import-placement-label" v-text="$t('simulator:importShapesModal.tolerance')"></label>
                <InfoPopoverIcon
                  light-background
                  :content="$t('simulator:importShapesModal.toleranceInfo')"
                  placement="top"
                />
                <input
                  type="number"
                  class="form-control form-control-sm import-placement-tolerance"
                  v-model.number="tolerance"
                  min="0"
                  @keydown.stop
                >
              </div>

              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="importShapesGroupInHandle" v-model="groupInHandle">
                <label class="form-check-label small" for="importShapesGroupInHandle" v-text="$t('simulator:importShapesModal.groupInHandle')"></label>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-primary" :disabled="!canImport" @click="handleImport">
            <span v-text="$t('simulator:importShapesModal.importButton')"></span>
          </button>
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" @click="reset" v-text="$t('simulator:common.cancelButton')"></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * @module ImportShapesModal
 * @description The Vue component for the pop-up modal invoked by
 * File -> Import shapes. Lets the user pick a vector file (currently SVG)
 * and choose how each distinct stroke / fill color becomes a scene object.
 */
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import * as bootstrap from 'bootstrap'
import { app } from '../services/app.js'
import { pathToSvgPathD } from '../utils/svgImport.js'
import { collectShapeColors } from '../utils/shapeImport.js'
import { useSceneStore } from '../store/scene.js'
import { vTooltipPopover } from '../directives/tooltip-popover'
import InfoPopoverIcon from './InfoPopoverIcon.vue'

export default {
  name: 'ImportShapesModal',
  components: {
    InfoPopoverIcon,
  },
  directives: {
    'tooltip-popover': vTooltipPopover,
  },
  setup() {
    const sceneStore = useSceneStore()
    const isModalOpen = ref(false)
    const parsedPaths = ref([])
    const parsedViewBox = ref(null)
    const errorMessage = ref('')
    const fileName = ref('')

    const strokeColors = ref([])
    const fillColors = ref([])
    const strokeActions = reactive({})
    const fillActions = reactive({})

    const scaleFactor = ref(1)
    const scaleStr = ref('1')
    const offsetX = ref(0)
    const offsetY = ref(0)
    const offsetPairStr = ref('0, 0')
    const tolerance = ref(0.1)
    const groupInHandle = ref(true)

    const closedCount = computed(() => parsedPaths.value.filter((p) => p.closed).length)
    const openCount = computed(() => parsedPaths.value.filter((p) => !p.closed).length)

    const previewViewBox = computed(() => {
      if (parsedPaths.value.length === 0) return null
      if (parsedViewBox.value) {
        const vb = parsedViewBox.value
        return `${vb.x} ${vb.y} ${vb.width} ${vb.height}`
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const p of parsedPaths.value) {
        const pts = [p.start, ...p.segments.map((s) => s.end)]
        for (const pt of pts) {
          if (!pt) continue
          if (pt.x < minX) minX = pt.x
          if (pt.y < minY) minY = pt.y
          if (pt.x > maxX) maxX = pt.x
          if (pt.y > maxY) maxY = pt.y
        }
      }
      if (!isFinite(minX)) return null
      const w = Math.max(1e-3, maxX - minX)
      const h = Math.max(1e-3, maxY - minY)
      const pad = Math.max(w, h) * 0.05
      return `${minX - pad} ${minY - pad} ${w + 2 * pad} ${h + 2 * pad}`
    })

    const previewStrokeWidth = computed(() => {
      if (!previewViewBox.value) return 1
      const parts = previewViewBox.value.split(/\s+/).map(parseFloat)
      const dim = Math.max(parts[2] || 1, parts[3] || 1)
      return Math.max(1, dim * 0.002)
    })

    const pathSvgD = computed(() => parsedPaths.value.map((p) => pathToSvgPathD(p)))

    const swatchCss = (c) => {
      if (!c) return 'transparent'
      const r = Math.round((c.r || 0) * 255)
      const g = Math.round((c.g || 0) * 255)
      const b = Math.round((c.b || 0) * 255)
      return `rgb(${r}, ${g}, ${b})`
    }
    const swatchLabel = (entry) => {
      const a = (entry.color.a ?? 1)
      return a < 1 ? `${entry.key} (alpha=${a.toFixed(2)})` : entry.key
    }

    const canImport = computed(() => {
      if (parsedPaths.value.length === 0) return false
      const anyStroke = Object.values(strokeActions).some((v) => v && v !== 'none')
      const anyFill = Object.values(fillActions).some((v) => v && v.action && v.action !== 'none')
      return anyStroke || anyFill
    })

    const previewStroke = (p) => {
      if (!p.stroke) return 'none'
      const cfg = strokeActions[colorKey(p.stroke)]
      const opacity = cfg && cfg !== 'none' ? 1 : 0.2
      return previewColorCss(p.stroke, opacity)
    }
    const previewFill = (p) => {
      if (!p.closed || !p.fill) return 'none'
      const cfg = fillActions[colorKey(p.fill)]
      const opacity = cfg && cfg.action && cfg.action !== 'none' ? 0.35 : 0.08
      return previewColorCss(p.fill, opacity)
    }
    const previewColorCss = (c, alpha) => {
      if (!c) return 'rgba(0,0,0,0)'
      const r = Math.round((c.r || 0) * 255)
      const g = Math.round((c.g || 0) * 255)
      const b = Math.round((c.b || 0) * 255)
      return `rgba(${r}, ${g}, ${b}, ${alpha * (c.a ?? 1)})`
    }
    const colorKey = (c) => {
      if (!c) return null
      const r = Math.round(((c.r ?? 0) < 0 ? 0 : (c.r ?? 0) > 1 ? 1 : (c.r ?? 0)) * 255)
      const g = Math.round(((c.g ?? 0) < 0 ? 0 : (c.g ?? 0) > 1 ? 1 : (c.g ?? 0)) * 255)
      const b = Math.round(((c.b ?? 0) < 0 ? 0 : (c.b ?? 0) > 1 ? 1 : (c.b ?? 0)) * 255)
      return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
    }

    const reset = () => {
      parsedPaths.value = []
      parsedViewBox.value = null
      errorMessage.value = ''
      fileName.value = ''
      strokeColors.value = []
      fillColors.value = []
      for (const k of Object.keys(strokeActions)) delete strokeActions[k]
      for (const k of Object.keys(fillActions)) delete fillActions[k]
    }

    const syncScaleStr = () => {
      scaleStr.value = `${round(scaleFactor.value, 4)}`
    }

    const commitScale = () => {
      const v = parseFloat(scaleStr.value)
      if (Number.isFinite(v) && v >= 0.0001) {
        scaleFactor.value = round(v, 4)
      }
      syncScaleStr()
    }

    const syncOffsetPairStr = () => {
      offsetPairStr.value = `${round(offsetX.value, 2)}, ${round(offsetY.value, 2)}`
    }

    const commitOffsetPair = () => {
      const raw = offsetPairStr.value
      const parts = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
      if (parts.length >= 2) {
        const x = parseFloat(parts[0])
        const y = parseFloat(parts[1])
        if (Number.isFinite(x)) offsetX.value = x
        if (Number.isFinite(y)) offsetY.value = y
      } else if (parts.length === 1) {
        const x = parseFloat(parts[0])
        if (Number.isFinite(x)) offsetX.value = x
      }
      syncOffsetPairStr()
    }

    const resetPosition = () => {
      if (parsedPaths.value.length === 0) return
      const defaults = app.computeImportShapesDefaults(parsedPaths.value)
      scaleFactor.value = round(defaults.scale, 4)
      offsetX.value = round(defaults.offsetX, 2)
      offsetY.value = round(defaults.offsetY, 2)
      syncScaleStr()
      syncOffsetPairStr()
    }

    /**
     * Accept a parsed SVG result (from app.js's file-picker flow) and set
     * up the modal's reactive state. Called via the `importShapes:open`
     * custom event so the menu item never has to know about this component.
     */
    const applyParseResult = (result, incomingFileName) => {
      reset()
      fileName.value = incomingFileName || ''
      if (result && result.error) {
        errorMessage.value = result.error
        return
      }
      const paths = (result && result.paths) || []
      parsedPaths.value = paths
      parsedViewBox.value = (result && result.viewBox) || null
      if (paths.length === 0) {
        errorMessage.value = 'No supported geometry found in the SVG.'
        return
      }
      const colors = collectShapeColors(paths)
      strokeColors.value = colors.strokes
      fillColors.value = colors.fills
      // Most-used color becomes the primary target; all others default to
      // "ignore" so decorative strokes/fills don't silently explode into
      // hundreds of scene objects.
      colors.strokes.forEach((s, i) => { strokeActions[s.key] = defaultStrokeAction(s, i) })
      colors.fills.forEach((f, i) => { fillActions[f.key] = defaultFillAction(f, i) })
      resetPosition()
    }

    const handleImport = () => {
      if (!canImport.value) return
      commitScale()
      commitOffsetPair()
      const strokeMap = {}
      for (const key of Object.keys(strokeActions)) {
        strokeMap[key] = { action: strokeActions[key] }
      }
      const fillMap = {}
      for (const key of Object.keys(fillActions)) {
        const v = fillActions[key]
        fillMap[key] = { action: v.action, refIndex: v.refIndex, cauchyB: v.cauchyB }
      }
      app.importShapes(parsedPaths.value, {
        scale: scaleFactor.value || 1,
        offsetX: offsetX.value || 0,
        offsetY: offsetY.value || 0,
        tolerance: tolerance.value != null ? tolerance.value : 0.1,
        strokeActions: strokeMap,
        fillActions: fillMap,
        groupInHandle: groupInHandle.value,
        sourceFileName: fileName.value || '',
      })
      const modalEl = document.getElementById('importShapesModal')
      const instance = bootstrap.Modal.getInstance(modalEl) || bootstrap.Modal.getOrCreateInstance(modalEl)
      instance.hide()
      reset()
    }

    const closeModal = () => {
      const modal = document.getElementById('importShapesModal')
      modal.classList.remove('show')
      modal.setAttribute('aria-hidden', 'true')
      modal.style.display = 'none'
      isModalOpen.value = false
      reset()
    }

    const onImportShapesOpen = (e) => {
      const detail = e && e.detail ? e.detail : {}
      applyParseResult(detail.result, detail.fileName)
      const modalEl = document.getElementById('importShapesModal')
      const instance = bootstrap.Modal.getInstance(modalEl) || bootstrap.Modal.getOrCreateInstance(modalEl)
      instance.show()
    }

    onMounted(() => {
      const modal = document.getElementById('importShapesModal')
      modal.addEventListener('show.bs.modal', () => { isModalOpen.value = true })
      modal.addEventListener('hide.bs.modal', () => { isModalOpen.value = false })
      document.addEventListener('importShapes:open', onImportShapesOpen)
    })

    onBeforeUnmount(() => {
      document.removeEventListener('importShapes:open', onImportShapesOpen)
    })

    return {
      isModalOpen,
      parsedPaths,
      previewViewBox,
      previewStrokeWidth,
      pathSvgD,
      errorMessage,
      fileName,
      strokeColors,
      fillColors,
      strokeActions,
      fillActions,
      scaleFactor,
      scaleStr,
      commitScale,
      offsetX,
      offsetY,
      offsetPairStr,
      commitOffsetPair,
      tolerance,
      groupInHandle,
      closedCount,
      openCount,
      canImport,
      swatchCss,
      swatchLabel,
      previewStroke,
      previewFill,
      handleImport,
      closeModal,
      reset,
      resetPosition,
      simulateColors: sceneStore.simulateColors,
    }
  }
}

/** Top-ranked stroke color becomes a Bezier mirror; all others ignored. */
function defaultStrokeAction(_entry, index) {
  return index === 0 ? 'CurveMirror' : 'none'
}

/** Top-ranked fill color becomes a Bezier glass; all others ignored. */
function defaultFillAction(_entry, index) {
  return {
    action: index === 0 ? 'CurveGlass' : 'none',
    refIndex: 1.5,
    cauchyB: 0.004,
  }
}

function round(v, decimals) {
  if (!Number.isFinite(v)) return 0
  const m = Math.pow(10, decimals)
  return Math.round(v * m) / m
}
</script>

<style scoped>
.preview-container {
  width: 100%;
  aspect-ratio: 1 / 1;
  background-color: #fafafa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

.preview-svg {
  width: 100%;
  height: 100%;
}

.color-swatch {
  display: inline-block;
  width: 18px;
  height: 18px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  flex-shrink: 0;
}

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

/* Scroll inner content when tall (same pattern as ThemeModal — header/footer stay fixed). */
.import-shapes-modal-body {
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 8px;
}

/* All numeric fields in this modal: hide browser stepper arrows */
.import-shapes-modal-body input[type="number"] {
  -moz-appearance: textfield;
}

.import-shapes-modal-body input[type="number"]::-webkit-outer-spin-button,
.import-shapes-modal-body input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.import-glass-params {
  min-height: 30px;
}

.import-glass-num-input {
  width: 3.5rem;
}

.import-glass-b-input {
  width: 4.25rem;
}

.import-placement-row {
  row-gap: 0.35rem;
}

.import-placement-scale-group {
  margin-inline-end: 0.75rem;
}

.import-placement-scale {
  width: 4.75rem;
}

.import-placement-offset-pair {
  width: 7.5rem;
}

.import-placement-label {
  line-height: 1.5;
}

.import-reset-viewport-btn {
  padding: 0.25rem 0.5rem;
  line-height: 1.25;
}

.import-placement-tolerance {
  width: 3.5rem;
}
</style>
