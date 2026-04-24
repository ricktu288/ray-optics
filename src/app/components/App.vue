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
  <CanvasContainer />
  <WelcomeMessage />
  <Sidebar />
  <StatusArea />
  <Toolbar />
  <ObjBar />
  <SimulatorControls />
  <Footer />
  <ModuleModal />
  <SaveModal />
  <ImportShapesModal />
  <ColorModeModal />
  <ThemeModal />
  <LanguageModal />

  <input type="file" id="openfile" style="display:none">
  <input type="file" id="importShapesFile" accept=".svg,image/svg+xml" style="display:none">
</template>

<script>
/**
 * @module App
 * @description The Vue component for the entire web application.
 */
import CanvasContainer from './CanvasContainer.vue';
import WelcomeMessage from './WelcomeMessage.vue';
import Sidebar from './Sidebar.vue';
import StatusArea from './StatusArea.vue';
import Toolbar from './toolbar/Toolbar.vue';
import ObjBar from './ObjBar.vue';
import SimulatorControls from './SimulatorControls.vue';
import Footer from './Footer.vue';
import ModuleModal from './ModuleModal.vue';
import SaveModal from './SaveModal.vue';
import ImportShapesModal from './ImportShapesModal.vue';
import ColorModeModal from './ColorModeModal.vue';
import ThemeModal from './ThemeModal.vue';
import LanguageModal from './LanguageModal.vue';


export default {
  components: {
    CanvasContainer,
    WelcomeMessage,
    Sidebar,
    StatusArea,
    Toolbar,
    ObjBar,
    SimulatorControls,
    Footer,
    ModuleModal,
    SaveModal,
    ImportShapesModal,
    ColorModeModal,
    ThemeModal,
    LanguageModal
  }
}
</script>

<style>
.popover-image {
  float:left;
  margin-right: 10px;
  margin-bottom: 4px;
  max-width: 245px;
}

.popover {
  padding-bottom:10px;
}

.popover-body {
  padding-bottom:0px;
  max-height: 80vh;
  overflow-y: auto;
  overflow-x: hidden;
}

.popover-body ul {
  padding-left: 10px;
}

#main-flex-wrapper {
  position: fixed;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* modifications to Bootstrap style */

/* Underline links on hover / keyboard focus only; colors stay Bootstrap defaults. */
a {
  text-decoration: none;
  text-underline-offset: 2px;
}

a:hover,
a:focus-visible {
  text-decoration: underline;
}

a.btn-link {
  text-decoration: none;
}

a.btn-link:hover,
a.btn-link:focus-visible {
  text-decoration: underline;
}

.btn-group {
  padding-left: 0px;
  padding-right: 0px;
}

.btn-group>.dropdown:not(:last-child)>.btn {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.btn-group>.dropdown:nth-child(n+3)>.btn, .btn-group>:not(.btn-check)+.dropdown>.btn {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.dropdown-menu>li>.btn {
  border-radius: 0;
}

.dropdown-menu>li>div>ul>li>.btn {
  border-radius: 0;
}

.mobile-dropdown>ul {
  list-style-type: none;
  padding-left: 0;
}

.mobile-dropdown>ul>li>.btn {
  border-radius: 0;
}

.mobile-dropdown>ul>li>div>ul>li>.btn {
  border-radius: 0;
}

.modal-backdrop {
  background-color: rgba(0, 0, 0, 0.3);
  z-index: 1040;
}

/* Make selected tool dropdown look like a selected radio button */

.btn.selected {
  background-color: #0a58ca;
  color: white;
}

.btn.selected {
  background-color: #0a58ca;
  color: white;
}


.title {
  font-size: 10pt;
  color: rgba(0, 0, 0, 0.5);
}

/* Opaque fill = rgba(45, 51, 57, 0.8) composited over black (matches sidebar on dark canvas). */
#help-dropdown {
  width: 300px;
  background-color: rgb(36, 41, 46);
  color: rgba(255, 255, 255, 0.82);
  max-height: 80vh;
  overflow: hidden;
  padding: 0;
}

#help-dropdown b {
  color: rgba(255, 255, 255, 0.92);
}

#help-dropdown .help-dropdown-inner {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  padding-right: 0px;
}

#help-dropdown .help-popup-body-wrapper {
  flex: 1;
  min-height: 0;
}

#help-dropdown .help-popup-body {
  overflow-y: auto;
  height: 100%;
  padding: 0.5rem 0;
  padding-right: 0.5rem;
}

#help-dropdown .help-popup-footer {
  flex-shrink: 0;
  padding: 0 0 0.5rem;
}

#help-dropdown a {
  color: #8ec5ff;
}

#help-dropdown a:hover {
  color: #b8d9ff;
}

#welcome_instruction a:hover {
  color: #3685f9 !important;
}

::-webkit-scrollbar {
  background: none;
  width: 12px;
  height: 12px;
}
::-webkit-scrollbar-thumb {
   border: solid 0 rgba(0, 0, 0, 0);
   border-right-width: 4px;
   border-left-width: 4px;
   -webkit-border-radius: 6px 2px;
   -webkit-box-shadow:
   inset 0 0 0 0px rgba(112, 112, 112, 0.35),
   inset 0 0 0 4px rgba(112, 112, 112, 0.35);
}
::-webkit-scrollbar-track-piece {
   margin: 4px 0;
}
::-webkit-scrollbar-thumb:hover {
    border-right-width: 3px;
    border-left-width: 3px;
   -webkit-box-shadow:
     inset 0 0 0 0px rgba(128,128,128,0.9),
     inset 0 0 0 4px rgba(128,128,128,0.9);
}
::-webkit-scrollbar-corner {
   background: transparent;
}
.ace_scrollbar-h{
  margin: 0 2px
}

/* Custom syntax highlighting for math.js template expressions */
.ace_support.ace_function {
  color: #d4ffa9 !important;
}

/* Fix bracket highlighting visibility for GitHub Dark theme */
.ace-github-dark .ace_marker-layer .ace_bracket {
  border: 1px solid rgba(255, 255, 255, 0.5) !important;
  border-radius: 0 !important;
  background: none !important;
}

.ace-github-dark .ace_marker-layer .ace_bracket-start {
  border: 1px solid rgba(255, 255, 255, 0.5) !important;
  border-radius: 0 !important;
  background: none !important;
}

/* Fix variable name highlighting visibility for GitHub Dark theme */
.ace-github-dark .ace_marker-layer .ace_selected-word {
  border: none !important;
  border-radius: 0 !important;
  background: rgba(255, 255, 255, 0.2) !important;
}
</style>