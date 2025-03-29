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
  <Footer />
  <ModuleModal />
  <SaveModal />
  <ColorModeModal />
  <LanguageModal />

  <input type="file" id="openfile" style="display:none">
</template>

<script>
import CanvasContainer from './CanvasContainer.vue';
import WelcomeMessage from './WelcomeMessage.vue';
import Sidebar from './Sidebar.vue';
import StatusArea from './StatusArea.vue';
import Toolbar from './toolbar/Toolbar.vue';
import ObjBar from './ObjBar.vue';
import Footer from './Footer.vue';
import ModuleModal from './ModuleModal.vue';
import SaveModal from './SaveModal.vue';
import ColorModeModal from './ColorModeModal.vue';
import LanguageModal from './LanguageModal.vue';


export default {
  components: {
    CanvasContainer,
    WelcomeMessage,
    Sidebar,
    StatusArea,
    Toolbar,
    ObjBar,
    Footer,
    ModuleModal,
    SaveModal,
    ColorModeModal,
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
}


#main-flex-wrapper {
  position: fixed;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

#obj-bar {
  background-color: rgba(255, 255, 255, 0.3);
}

/* modifications to Bootstrap style */

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

.mobile-dropdown>ul {
  list-style-type: none;
  padding-left: 0;
}

.mobile-dropdown>ul>li>.btn {
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

#help-dropdown {
  width:300px;
  background: rgb(64, 64, 64);
  color: white;
  max-height: 80vh;
  overflow-y: auto
}

#help-dropdown a {
  color: white;
}

.obj-bar {
  z-index: -1;
  background-color:rgba(23,162,184, 0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  color:white;
  font-size:12pt;
  
  padding-top: 3px;
  padding-left: 12px;
  padding-right: 7px;
  padding-bottom: 3px;
  margin: auto;
  margin-top: 16px;
  text-align: center;
  border-radius: 0.5em;
}

.obj-bar .btn {
  padding-top: 0;
  padding-left: 7px;
  padding-right: 7px;
  color: white;
}

.obj-bar-nobr {
  white-space: nowrap;
  padding-left: 3px;
  padding-right: 3px;
}

.obj-bar .form-range {
  width: 125px;
  padding-top:15px;
  padding-left: 3px;
}

.obj-bar .form-range::-webkit-slider-thumb {
  background: gray;
  border: 2px solid white;
}

.obj-bar .form-range::-moz-range-thumb {
  background: gray;
  border: 2px solid white;
}

.obj-bar .form-range::-ms-thumb {
  background: gray;
  border: 2px solid white;
}

.obj-bar .form-range::-webkit-slider-runnable-track {
  background: rgba(255,255,255, 0.5);
}

.obj-bar .form-range::-moz-range-track {
  background-color: rgba(255,255,255, 0.5);
}

.obj-bar-editable {
  color: white;
  background-color: rgba(255,255,255,0.2);
  border: none;
  text-align: center;
}

.obj-bar-editable::selection {
  background-color: gray;
  color: white;
}

.obj-bar-number {
  width: 40px;
  padding-left: 1px;
  padding-right: 1px;
  font-size: 15px;
}

.mq-cursor {
  border-color: white !important;
}

.info-icon {
  color: rgba(255, 255, 255, 0.6);
  padding-left:0px;
  padding-right:0px;
}


.obj-bar .form-switch .form-check-input {
  margin-top: 0px;
  background-color: rgba(255,255,255, 0.3);
  border: none;
  vertical-align: middle;
}

.obj-bar .form-switch .form-check-input {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23f0f0f0'/%3e%3c/svg%3e");
}

.obj-bar .form-switch .form-check-input:focus {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23ffffff'/%3e%3c/svg%3e");
}

.obj-bar .form-switch .form-check-input:checked {
  background-color: gray;
  border: none;
}

.obj-bar .form-switch .form-check-input:checked {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23ffffff'/%3e%3c/svg%3e");
}

.obj-bar .form-switch .form-check-input:checked:focus {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='3' fill='%23ffffff'/%3e%3c/svg%3e");
}

#showAdvanced {
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
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
   inset 0 0 0 0px rgba(128, 128, 128, 0.2),
   inset 0 0 0 4px rgba(128, 128, 128, 0.2);
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
</style>