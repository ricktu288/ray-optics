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
  <div class="container-fluid">
    <div class="theme-option-row">
      <FillControl
        :label="$t('simulator:themeModal.background.title')"
        :fillOptions="backgroundOptions"
        @update="updateBackground"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.ray.title')"
        :strokeOptions="rayOptions"
        @update="updateRay"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.colorRay.title')"
        :strokeOptions="colorRayOptions"
        @update="updateColorRay"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.extendedRay.title')"
        :strokeOptions="extendedRayOptions"
        @update="updateExtendedRay"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.colorExtendedRay.title')"
        :strokeOptions="colorExtendedRayOptions"
        @update="updateColorExtendedRay"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.forwardExtendedRay.title')"
        :strokeOptions="forwardExtendedRayOptions"
        @update="updateForwardExtendedRay"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.colorForwardExtendedRay.title')"
        :strokeOptions="colorForwardExtendedRayOptions"
        @update="updateColorForwardExtendedRay"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.observedRay.title')"
        :strokeOptions="observedRayOptions"
        @update="updateObservedRay"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.colorObservedRay.title')"
        :strokeOptions="colorObservedRayOptions"
        @update="updateColorObservedRay"
      />
    </div>

    <div class="theme-option-row">
      <PointControl
        :label="$t('simulator:themeModal.realImage.title')"
        :pointOptions="realImageOptions"
        @update="updateRealImage"
      />
    </div>

    <div class="theme-option-row">
      <PointControl
        :label="$t('simulator:themeModal.colorRealImage.title')"
        :pointOptions="colorRealImageOptions"
        @update="updateColorRealImage"
      />
    </div>

    <div class="theme-option-row">
      <PointControl
        :label="$t('simulator:themeModal.virtualImage.title')"
        :pointOptions="virtualImageOptions"
        @update="updateVirtualImage"
      />
    </div>

    <div class="theme-option-row">
      <PointControl
        :label="$t('simulator:themeModal.colorVirtualImage.title')"
        :pointOptions="colorVirtualImageOptions"
        @update="updateColorVirtualImage"
      />
    </div>

    <div class="theme-option-row">
      <PointControl
        :label="$t('simulator:themeModal.virtualObject.title')"
        :pointOptions="virtualObjectOptions"
        @update="updateVirtualObject"
      />
    </div>

    <div class="theme-option-row">
      <PointControl
        :label="$t('simulator:themeModal.colorVirtualObject.title')"
        :pointOptions="colorVirtualObjectOptions"
        @update="updateColorVirtualObject"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.grid.title')"
        :strokeOptions="gridOptions"
        @update="updateGrid"
      />
    </div>

    <div class="theme-option-row">
      <PointControl
        :label="$t('simulator:themeModal.observer.title')"
        :pointOptions="observerOptions"
        pointType="circle"
        @update="updateObserver"
      />
    </div>

    <div class="theme-option-row">
      <PointControl
        :label="$t('simulator:themeModal.sourcePoint.title')"
        :pointOptions="sourcePointOptions"
        @update="updateSourcePoint"
      />
    </div>

    <div class="theme-option-row">
      <PointControl
        :label="$t('simulator:themeModal.directionPoint.title')"
        :pointOptions="directionPointOptions"
        @update="updateDirectionPoint"
      />
    </div>

    <div class="theme-option-row">
      <PointControl
        :label="$t('simulator:themeModal.centerPoint.title')"
        :pointOptions="centerPointOptions"
        @update="updateCenterPoint"
      />
    </div>

    <div class="theme-option-row">
      <PointControl
        :label="$t('simulator:themeModal.lightSource.title')"
        :pointOptions="lightSourceOptions"
        @update="updateLightSource"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.beamShield.title')"
        :strokeOptions="beamShieldOptions"
        @update="updateBeamShield"
      />
    </div>

    <div class="theme-option-row">
      <PointControl
        :label="$t('simulator:themeModal.colorSourceCenter.title')"
        :pointOptions="colorSourceCenterOptions"
        @update="updateColorSourceCenter"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.mirror.title')"
        :strokeOptions="mirrorOptions"
        @update="updateMirror"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.beamSplitter.title')"
        :strokeOptions="beamSplitterOptions"
        @update="updateBeamSplitter"
      />
    </div>

    <div class="theme-option-row">
      <PointControl
        :label="$t('simulator:themeModal.idealCurveCenter.title')"
        :pointOptions="idealCurveCenterOptions"
        @update="updateIdealCurveCenter"
      />
    </div>

    <div class="theme-option-row">
      <PointControl
        :label="$t('simulator:themeModal.idealCurveArrow.title')"
        :pointOptions="idealCurveArrowOptions"
        pointType="triangle"
        @update="updateIdealCurveArrow"
      />
    </div>

    <div class="theme-option-row">
      <FillControl
        :label="$t('simulator:themeModal.glass.title')"
        :fillOptions="glassOptions"
        @update="updateGlass"
      />
    </div>

    <div class="theme-option-row">
      <FillControl
        :label="$t('simulator:themeModal.grinGlass.title')"
        :fillOptions="grinGlassOptions"
        @update="updateGrinGlass"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.blocker.title')"
        :strokeOptions="blockerOptions"
        @update="updateBlocker"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.diffractionGrating.title')"
        :strokeOptions="diffractionGratingOptions"
        @update="updateDiffractionGrating"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.detector.title')"
        :strokeOptions="detectorOptions"
        @update="updateDetector"
      />
    </div>

    <div class="theme-option-row">
      <TextControl
        :label="$t('simulator:themeModal.detectorText.title')"
        :textOptions="detectorTextOptions"
        @update="updateDetectorText"
      />
    </div>

    <div class="theme-option-row">
      <FillControl
        :label="$t('simulator:themeModal.irradMap.title')"
        :fillOptions="irradMapOptions"
        @update="updateIrradMap"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.irradMapBorder.title')"
        :strokeOptions="irradMapBorderOptions"
        @update="updateIrradMapBorder"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.ruler.title')"
        :strokeOptions="rulerOptions"
        @update="updateRuler"
      />
    </div>

    <div class="theme-option-row">
      <TextControl
        :label="$t('simulator:themeModal.rulerText.title')"
        :textOptions="rulerTextOptions"
        @update="updateRulerText"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.decoration.title')"
        :strokeOptions="decorationOptions"
        @update="updateDecoration"
      />
    </div>

    <div class="theme-option-row">
      <PointControl
        :label="$t('simulator:themeModal.handlePoint.title')"
        :pointOptions="handlePointOptions"
        pointType="concentric"
        @update="updateHandlePoint"
      />
    </div>

    <div class="theme-option-row">
      <PointControl
        :label="$t('simulator:themeModal.handleArrow.title')"
        :pointOptions="handleArrowOptions"
        pointType="triangle"
        @update="updateHandleArrow"
      />
    </div>

    <div class="theme-option-row">
      <StrokeControl
        :label="$t('simulator:themeModal.customSurface.title')"
        :strokeOptions="customSurfaceOptions"
        @update="updateCustomSurface"
      />
    </div>
  </div>
</template>

<script>
/**
 * @module ThemeOptionsList
 * @description The Vue component for the list of theme options in the ThemeModal component.
 */
import { computed, onMounted } from 'vue'
import FillControl from './controls/FillControl.vue'
import StrokeControl from './controls/StrokeControl.vue'
import PointControl from './controls/PointControl.vue'
import TextControl from './controls/TextControl.vue'
import { useThemeStore } from '../../store/theme'

export default {
  name: 'ThemeOptionsList',
  components: {
    FillControl,
    StrokeControl,
    PointControl,
    TextControl
  },
  setup() {
    const themeStore = useThemeStore()

    // Prevent dropdown auto-close when clicking inside dropdown menus
    onMounted(() => {
      // Add event listeners to dropdown menus within the theme modal
      // This prevents Bootstrap from auto-closing dropdowns when clicking inside them
      setTimeout(() => {
        const themeModal = document.getElementById('themeModal')
        if (themeModal) {
          const dropdownMenus = themeModal.querySelectorAll('.dropdown-menu')
          dropdownMenus.forEach(menu => {
            menu.addEventListener('click', function (e) {
              e.stopPropagation()
            })
          })
        }
      }, 100) // Small delay to ensure dropdowns are rendered
    })

    // All theme options computed properties
    const backgroundOptions = computed(() => themeStore.getThemeObject('background'))
    const rayOptions = computed(() => themeStore.getThemeObject('ray'))
    const colorRayOptions = computed(() => themeStore.getThemeObject('colorRay'))
    const extendedRayOptions = computed(() => themeStore.getThemeObject('extendedRay'))
    const colorExtendedRayOptions = computed(() => themeStore.getThemeObject('colorExtendedRay'))
    const forwardExtendedRayOptions = computed(() => themeStore.getThemeObject('forwardExtendedRay'))
    const colorForwardExtendedRayOptions = computed(() => themeStore.getThemeObject('colorForwardExtendedRay'))
    const observedRayOptions = computed(() => themeStore.getThemeObject('observedRay'))
    const colorObservedRayOptions = computed(() => themeStore.getThemeObject('colorObservedRay'))
    const realImageOptions = computed(() => themeStore.getThemeObject('realImage'))
    const colorRealImageOptions = computed(() => themeStore.getThemeObject('colorRealImage'))
    const virtualImageOptions = computed(() => themeStore.getThemeObject('virtualImage'))
    const colorVirtualImageOptions = computed(() => themeStore.getThemeObject('colorVirtualImage'))
    const virtualObjectOptions = computed(() => themeStore.getThemeObject('virtualObject'))
    const colorVirtualObjectOptions = computed(() => themeStore.getThemeObject('colorVirtualObject'))
    const gridOptions = computed(() => themeStore.getThemeObject('grid'))
    const observerOptions = computed(() => themeStore.getThemeObject('observer'))
    const sourcePointOptions = computed(() => themeStore.getThemeObject('sourcePoint'))
    const directionPointOptions = computed(() => themeStore.getThemeObject('directionPoint'))
    const centerPointOptions = computed(() => themeStore.getThemeObject('centerPoint'))
    const lightSourceOptions = computed(() => themeStore.getThemeObject('lightSource'))
    const beamShieldOptions = computed(() => themeStore.getThemeObject('beamShield'))
    const colorSourceCenterOptions = computed(() => themeStore.getThemeObject('colorSourceCenter'))
    const mirrorOptions = computed(() => themeStore.getThemeObject('mirror'))
    const beamSplitterOptions = computed(() => themeStore.getThemeObject('beamSplitter'))
    const idealCurveCenterOptions = computed(() => themeStore.getThemeObject('idealCurveCenter'))
    const idealCurveArrowOptions = computed(() => themeStore.getThemeObject('idealCurveArrow'))
    const glassOptions = computed(() => themeStore.getThemeObject('glass'))
    const grinGlassOptions = computed(() => themeStore.getThemeObject('grinGlass'))
    const blockerOptions = computed(() => themeStore.getThemeObject('blocker'))
    const diffractionGratingOptions = computed(() => themeStore.getThemeObject('diffractionGrating'))
    const detectorOptions = computed(() => themeStore.getThemeObject('detector'))
    const detectorTextOptions = computed(() => themeStore.getThemeObject('detectorText'))
    const irradMapOptions = computed(() => themeStore.getThemeObject('irradMap'))
    const irradMapBorderOptions = computed(() => themeStore.getThemeObject('irradMapBorder'))
    const rulerOptions = computed(() => themeStore.getThemeObject('ruler'))
    const rulerTextOptions = computed(() => themeStore.getThemeObject('rulerText'))
    const decorationOptions = computed(() => themeStore.getThemeObject('decoration'))
    const handlePointOptions = computed(() => themeStore.getThemeObject('handlePoint'))
    const handleArrowOptions = computed(() => themeStore.getThemeObject('handleArrow'))
    const customSurfaceOptions = computed(() => themeStore.getThemeObject('customSurface'))

    // All theme options update functions
    const updateBackground = (newBackground) => themeStore.setThemeObject('background', newBackground)
    const updateRay = (newRay) => themeStore.setThemeObject('ray', newRay)
    const updateColorRay = (newColorRay) => themeStore.setThemeObject('colorRay', newColorRay)
    const updateExtendedRay = (newExtendedRay) => themeStore.setThemeObject('extendedRay', newExtendedRay)
    const updateColorExtendedRay = (newColorExtendedRay) => themeStore.setThemeObject('colorExtendedRay', newColorExtendedRay)
    const updateForwardExtendedRay = (newForwardExtendedRay) => themeStore.setThemeObject('forwardExtendedRay', newForwardExtendedRay)
    const updateColorForwardExtendedRay = (newColorForwardExtendedRay) => themeStore.setThemeObject('colorForwardExtendedRay', newColorForwardExtendedRay)
    const updateObservedRay = (newObservedRay) => themeStore.setThemeObject('observedRay', newObservedRay)
    const updateColorObservedRay = (newColorObservedRay) => themeStore.setThemeObject('colorObservedRay', newColorObservedRay)
    const updateRealImage = (newRealImage) => themeStore.setThemeObject('realImage', newRealImage)
    const updateColorRealImage = (newColorRealImage) => themeStore.setThemeObject('colorRealImage', newColorRealImage)
    const updateVirtualImage = (newVirtualImage) => themeStore.setThemeObject('virtualImage', newVirtualImage)
    const updateColorVirtualImage = (newColorVirtualImage) => themeStore.setThemeObject('colorVirtualImage', newColorVirtualImage)
    const updateVirtualObject = (newVirtualObject) => themeStore.setThemeObject('virtualObject', newVirtualObject)
    const updateColorVirtualObject = (newColorVirtualObject) => themeStore.setThemeObject('colorVirtualObject', newColorVirtualObject)
    const updateGrid = (newGrid) => themeStore.setThemeObject('grid', newGrid)
    const updateObserver = (newObserver) => themeStore.setThemeObject('observer', newObserver)
    const updateSourcePoint = (newSourcePoint) => themeStore.setThemeObject('sourcePoint', newSourcePoint)
    const updateDirectionPoint = (newDirectionPoint) => themeStore.setThemeObject('directionPoint', newDirectionPoint)
    const updateCenterPoint = (newCenterPoint) => themeStore.setThemeObject('centerPoint', newCenterPoint)
    const updateLightSource = (newLightSource) => themeStore.setThemeObject('lightSource', newLightSource)
    const updateBeamShield = (newBeamShield) => themeStore.setThemeObject('beamShield', newBeamShield)
    const updateColorSourceCenter = (newColorSourceCenter) => themeStore.setThemeObject('colorSourceCenter', newColorSourceCenter)
    const updateMirror = (newMirror) => themeStore.setThemeObject('mirror', newMirror)
    const updateBeamSplitter = (newBeamSplitter) => themeStore.setThemeObject('beamSplitter', newBeamSplitter)
    const updateIdealCurveCenter = (newIdealCurveCenter) => themeStore.setThemeObject('idealCurveCenter', newIdealCurveCenter)
    const updateIdealCurveArrow = (newIdealCurveArrow) => themeStore.setThemeObject('idealCurveArrow', newIdealCurveArrow)
    const updateGlass = (newGlass) => themeStore.setThemeObject('glass', newGlass)
    const updateGrinGlass = (newGrinGlass) => themeStore.setThemeObject('grinGlass', newGrinGlass)
    const updateBlocker = (newBlocker) => themeStore.setThemeObject('blocker', newBlocker)
    const updateDiffractionGrating = (newDiffractionGrating) => themeStore.setThemeObject('diffractionGrating', newDiffractionGrating)
    const updateDetector = (newDetector) => themeStore.setThemeObject('detector', newDetector)
    const updateDetectorText = (newDetectorText) => themeStore.setThemeObject('detectorText', newDetectorText)
    const updateIrradMap = (newIrradMap) => themeStore.setThemeObject('irradMap', newIrradMap)
    const updateIrradMapBorder = (newIrradMapBorder) => themeStore.setThemeObject('irradMapBorder', newIrradMapBorder)
    const updateRuler = (newRuler) => themeStore.setThemeObject('ruler', newRuler)
    const updateRulerText = (newRulerText) => themeStore.setThemeObject('rulerText', newRulerText)
    const updateDecoration = (newDecoration) => themeStore.setThemeObject('decoration', newDecoration)
    const updateHandlePoint = (newHandlePoint) => themeStore.setThemeObject('handlePoint', newHandlePoint)
    const updateHandleArrow = (newHandleArrow) => themeStore.setThemeObject('handleArrow', newHandleArrow)
    const updateCustomSurface = (newCustomSurface) => themeStore.setThemeObject('customSurface', newCustomSurface)

    return {
      // Theme options
      backgroundOptions,
      rayOptions,
      colorRayOptions,
      extendedRayOptions,
      colorExtendedRayOptions,
      forwardExtendedRayOptions,
      colorForwardExtendedRayOptions,
      observedRayOptions,
      colorObservedRayOptions,
      realImageOptions,
      colorRealImageOptions,
      virtualImageOptions,
      colorVirtualImageOptions,
      virtualObjectOptions,
      colorVirtualObjectOptions,
      gridOptions,
      observerOptions,
      sourcePointOptions,
      directionPointOptions,
      centerPointOptions,
      lightSourceOptions,
      beamShieldOptions,
      colorSourceCenterOptions,
      mirrorOptions,
      beamSplitterOptions,
      idealCurveCenterOptions,
      idealCurveArrowOptions,
      glassOptions,
      grinGlassOptions,
      blockerOptions,
      diffractionGratingOptions,
      detectorOptions,
      detectorTextOptions,
      irradMapOptions,
      irradMapBorderOptions,
      rulerOptions,
      rulerTextOptions,
      decorationOptions,
      handlePointOptions,
      handleArrowOptions,
      customSurfaceOptions,
      // Update functions
      updateBackground,
      updateRay,
      updateColorRay,
      updateExtendedRay,
      updateColorExtendedRay,
      updateForwardExtendedRay,
      updateColorForwardExtendedRay,
      updateObservedRay,
      updateColorObservedRay,
      updateRealImage,
      updateColorRealImage,
      updateVirtualImage,
      updateColorVirtualImage,
      updateVirtualObject,
      updateColorVirtualObject,
      updateGrid,
      updateObserver,
      updateSourcePoint,
      updateDirectionPoint,
      updateCenterPoint,
      updateLightSource,
      updateBeamShield,
      updateColorSourceCenter,
      updateMirror,
      updateBeamSplitter,
      updateIdealCurveCenter,
      updateIdealCurveArrow,
      updateGlass,
      updateGrinGlass,
      updateBlocker,
      updateDiffractionGrating,
      updateDetector,
      updateDetectorText,
      updateIrradMap,
      updateIrradMapBorder,
      updateRuler,
      updateRulerText,
      updateDecoration,
      updateHandlePoint,
      updateHandleArrow,
      updateCustomSurface
    }
  }
}
</script>

<style scoped>
.theme-option-row {
  padding-top: 3px;
  padding-bottom: 3px;
}
</style> 