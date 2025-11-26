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
  <!-- Light Source Tools -->
  <ToolsCategory
    id="lightSource"
    :title="$t('main:tools.categories.lightSource')"
    :layout="layout"
  >
    <ToolItem
      id="SingleRay"
      :title="$t('main:tools.SingleRay.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.SingleRay.description'), sub: $t('main:tools.SingleRay.instruction')})"
      popoverImage="SingleRay.svg"
      :layout="layout"
    />
    <ToolItem
      id="Beam"
      :title="$t('main:tools.Beam.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.Beam.description'), sub: $t('main:tools.common.lineInstruction')})"
      popoverImage="Beam.svg"
      :layout="layout"
    />
    <ToolItem
      id="PointSource"
      :title="$t('main:tools.PointSource.title') + ' (360°)'"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.PointSource.description'), sub: $t('main:tools.common.clickInstruction')})"
      popoverImage="PointSource.svg"
      :layout="layout"
    />
    <ToolItem
      id="AngleSource"
      :title="$t('main:tools.PointSource.title') + ' (<360°)'"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.AngleSource.description'), sub: $t('main:tools.SingleRay.instruction')})"
      popoverImage="AngleSource.svg"
      :layout="layout"
    />
  </ToolsCategory>

  <!-- Mirror Tools -->
  <ToolsCategory
    id="mirror"
    :title="$t('main:tools.categories.mirror')"
    :layout="layout"
  >
    <ToolItem
      id="Mirror"
      :title="$t('main:tools.Mirror.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.Mirror.description'), sub: $t('main:tools.common.lineInstruction')})"
      popoverImage="Mirror.svg"
      :layout="layout"
    />
    <ToolItem
      id="ArcMirror"
      :title="$t('main:tools.ArcMirror.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.ArcMirror.description'), sub: $t('main:tools.ArcMirror.instruction')})"
      popoverImage="ArcMirror.svg"
      :layout="layout"
    />
    <ToolItem
      id="ParabolicMirror"
      :title="$t('main:tools.ParabolicMirror.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.ParabolicMirror.description'), sub: $t('main:tools.ParabolicMirror.instruction')})"
      popoverImage="ParabolicMirror.svg"
      :layout="layout"
    />

    <li><hr class="dropdown-divider"></li>
    <ToolItem
      id="IdealMirror"
      :title="$t('main:tools.IdealMirror.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.IdealMirror.description'), sub: $t('main:tools.common.lineInstruction')})"
      popoverImage="IdealMirror.svg"
      :layout="layout"
    />
    <ToolItem
      id="BeamSplitter"
      :title="$t('main:tools.BeamSplitter.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.BeamSplitter.description'), sub: $t('main:tools.common.lineInstruction')})"
      popoverImage="BeamSplitter.svg"
      :layout="layout"
    />
    <li><hr class="dropdown-divider"></li>
    <MoreToolsCollapsible :layout="layout">
      <ToolItem
        id="CustomMirror"
        :title="$t('main:tools.CustomMirror.title')"
        :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.CustomMirror.description'), sub: $t('main:tools.common.lineInstruction')})"
        popoverImage="CustomMirror.svg"
        :layout="layout"
      />
      <ToolItem
        id="ParamMirror"
        :title="$t('main:tools.ParamMirror.title')"
        :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.ParamMirror.description'), sub: $t('main:tools.common.clickInstruction')})"
        :verticalOffset="0"
        :layout="layout"
      />
      <ToolItem
        id="ConcaveDiffractionGrating"
        :title="$t('main:tools.ConcaveDiffractionGrating.title')"
        :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.ConcaveDiffractionGrating.description'), sub: $t('main:tools.ArcMirror.instruction')})"
        popoverImage="ConcaveDiffractionGrating.svg"
        :layout="layout"
      />
    </MoreToolsCollapsible>
  </ToolsCategory>

  <!-- Glass Tools -->
  <ToolsCategory
    id="glass"
    :title="$t('main:tools.categories.glass')"
    :layout="layout"
  >
    <ToolItem
      id="PlaneGlass"
      :title="$t('main:tools.PlaneGlass.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.PlaneGlass.description'), sub: $t('main:tools.PlaneGlass.instruction')})"
      popoverImage="PlaneGlass.svg"
      :layout="layout"
    />
    <ToolItem
      id="CircleGlass"
      :title="$t('main:tools.CircleGlass.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.CircleGlass.description'), sub: $t('main:tools.common.circleInstruction')})"
      popoverImage="CircleGlass.svg"
      :layout="layout"
    />
    <ToolItem
      id="Glass"
      :title="$t('main:tools.Glass.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.Glass.description'), sub: $t('main:tools.Glass.instruction')})"
      popoverImage="Glass.svg"
      :layout="layout"
    />
    <li><hr class="dropdown-divider"></li>
    <ToolItem
      id="IdealLens"
      :title="$t('main:tools.IdealLens.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.IdealLens.description'), sub: $t('main:tools.common.lineInstruction')})"
      popoverImage="IdealLens.svg"
      :layout="layout"
    />
    <ToolItem
      id="SphericalLens"
      :title="$t('main:tools.SphericalLens.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.SphericalLens.description'), sub: $t('main:tools.common.lineInstruction')})"
      popoverImage="SphericalLens.svg"
      :layout="layout"
    />
    <li><hr class="dropdown-divider"></li>
    <MoreToolsCollapsible :layout="layout">
      <ToolItem
        id="CustomGlass"
        :title="$t('main:tools.CustomGlass.title')"
        :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.CustomGlass.description'), sub: $t('main:tools.common.lineInstruction')})"
        popoverImage="CustomGlass.svg"
        :layout="layout"
      />
      <ToolItem
        id="ParamGlass"
        :title="$t('main:tools.ParamGlass.title')"
        :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.ParamGlass.description'), sub: $t('main:tools.common.clickInstruction')})"
        :verticalOffset="0"
        :layout="layout"
      />
      <ToolItem
        id="CurveGlass"
        :title="$t('main:tools.CurveGlass.title')"
        :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.CurveGlass.description'), sub: $t('main:tools.CurveGlass.instruction')})"
        :verticalOffset="0"
        :layout="layout"
      />
      <ToolItem
        id="CircleGrinGlass"
        :title="$t('main:tools.CircleGrinGlass.title')"
        :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.CircleGrinGlass.description'), sub: $t('main:tools.common.circleInstruction')})"
        popoverImage="CircleGrinGlass.svg"
        :layout="layout"
      />
      <ToolItem
        id="GrinGlass"
        :title="$t('main:tools.GrinGlass.title')"
        :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.GrinGlass.description'), sub: $t('main:tools.GrinGlass.instruction')}) + '<br>' + $t('main:tools.GrinGlass.warning')"
        popoverImage="GrinGlass.svg"
        :layout="layout"
      />
      <ToolItem
        id="ParamGrinGlass"
        :title="$t('main:tools.ParamGrinGlass.title')"
        :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.ParamGrinGlass.description'), sub: $t('main:tools.common.clickInstruction')})"
        :verticalOffset="0"
        :layout="layout"
      />
      <ToolItem
        id="CurveGrinGlass"
        :title="$t('main:tools.CurveGrinGlass.title')"
        :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.CurveGrinGlass.description'), sub: $t('main:tools.CurveGlass.instruction')})"
        :verticalOffset="0"
        :layout="layout"
      />
    </MoreToolsCollapsible>
  </ToolsCategory>

  <!-- Blocker Tools -->
  <ToolsCategory
    id="blocker"
    :title="$t('main:tools.categories.blocker')"
    :layout="layout"
  >
    <ToolItem
      id="Blocker"
      :title="$t('main:tools.Blocker.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.Blocker.description'), sub: $t('main:tools.common.lineInstruction')})"
      popoverImage="Blocker.svg"
      :layout="layout"
    />
    <ToolItem
      id="CircleBlocker"
      :title="$t('main:tools.CircleBlocker.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.CircleBlocker.description'), sub: $t('main:tools.common.circleInstruction')})"
      popoverImage="CircleBlocker.svg"
      :layout="layout"
    />
    <ToolItem
      id="Aperture"
      :title="$t('main:tools.Aperture.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.Aperture.description'), sub: $t('main:tools.Aperture.instruction')})"
      popoverImage="Aperture.svg"
      :layout="layout"
    />
    <li><hr class="dropdown-divider"></li>
    <ToolItem
      id="DiffractionGrating"
      :title="$t('main:tools.DiffractionGrating.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.DiffractionGrating.description'), sub: $t('main:tools.common.lineInstruction')})"
      popoverImage="DiffractionGrating.svg"
      :layout="layout"
    />
  </ToolsCategory>

  <!-- More Tools -->
  <ToolsCategory
    id="other"
    :title="$t('main:tools.categories.other')"
    :layout="layout"
  >
    <ToolItem
      id="Ruler"
      :title="$t('main:tools.Ruler.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.Ruler.description'), sub: $t('main:tools.common.lineInstruction')})"
      popoverImage="Ruler.svg"
      :verticalOffset="60"
      :layout="layout"
    />
    <ToolItem
      id="Protractor"
      :title="$t('main:tools.Protractor.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.Protractor.description'), sub: $t('main:tools.common.circleInstruction')})"
      popoverImage="Protractor.svg"
      :verticalOffset="60"
      :layout="layout"
    />
    <ToolItem
      id="Detector"
      :title="$t('main:tools.Detector.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.Detector.description'), sub: $t('main:tools.Detector.instruction')})"
      popoverImage="Detector.svg"
      :verticalOffset="60"
      :layout="layout"
    />
    <li><hr class="dropdown-divider"></li>
    <ToolItem
      id="TextLabel"
      :title="$t('main:tools.TextLabel.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.TextLabel.description'), sub: $t('main:tools.common.clickInstruction')})"
      :verticalOffset="0"
      :layout="layout"
    />
    <ToolItem
      id="LineArrow"
      :title="$t('main:tools.LineArrow.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.LineArrow.description'), sub: $t('main:tools.common.lineInstruction')})"
      :verticalOffset="0"
      :layout="layout"
    />
    <ToolItem
      id="Drawing"
      :title="$t('main:tools.Drawing.title')"
      :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.Drawing.description'), sub: $t('main:tools.Drawing.instruction')})"
      :verticalOffset="0"
      :layout="layout"
    />
    <li><hr class="dropdown-divider"></li>
    <MoreToolsCollapsible :layout="layout">
      <ToolItem
        id="CustomSurface"
        :title="$t('main:tools.CustomSurface.title')"
        :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.CustomSurface.description'), sub: $t('main:tools.common.lineInstruction')})"
        :verticalOffset="0"
        :layout="layout"
      />
      <ToolItem
        id="CustomArcSurface"
        :title="$t('main:tools.CustomArcSurface.title')"
        :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.CustomArcSurface.description'), sub: $t('main:tools.ArcMirror.instruction')})"
        :verticalOffset="0"
        :layout="layout"
      />
      <ToolItem
        id="CustomParamSurface"
        :title="$t('main:tools.CustomParamSurface.title')"
        :popoverContent="$t('main:meta.parentheses', {main: $t('main:tools.CustomParamSurface.description'), sub: $t('main:tools.common.clickInstruction')})"
        :verticalOffset="0"
        :layout="layout"
      />
      <li><hr class="dropdown-divider"></li>
    </MoreToolsCollapsible>
    <ModuleTools :layout="layout" />
  </ToolsCategory>
</template>

<script>
/**
 * @module ToolsList
 * @description The Vue component for the list of tools in the toolbar.
 * @vue-prop {String} layout - The layout of the toolbar. Can be 'mobile' or 'desktop'.
 */
import ToolsCategory from './ToolsCategory.vue'
import ToolItem from './controls/ToolItem.vue'
import ModuleTools from './ModuleTools.vue'
import MoreToolsCollapsible from './controls/MoreToolsCollapsible.vue'

export default {
  name: 'ToolsList',
  components: {
    ToolsCategory,
    ToolItem,
    ModuleTools,
    MoreToolsCollapsible
  },
  props: {
    layout: {
      type: String,
      required: true
    }
  }
}
</script>