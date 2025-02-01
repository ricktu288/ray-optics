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
  <div id="sidebar" v-show="showJsonEditor">
    <div id="sidebarMobileHeightDiff" class="d-none d-lg-block"></div>
    <div id="jsonEditorContainer">
      <div id="jsonEditor"></div>
    </div>
  </div>
</template>

<script>
/**
 * @module Sidebar
 * @description The Vue component for the sidebar containing the JSON editor.
 */
import { usePreferencesStore } from '../store/preferences'

export default {
  name: 'Sidebar',
  setup() {
    const preferences = usePreferencesStore()
    return {
      showJsonEditor: preferences.showJsonEditor
    }
  }
}
</script>

<style scoped>
#sidebar {
  position: absolute;
  z-index: -2;
  top: 46px;
  left: 0;
  width: 400px;
  max-width: 100%;
  height: calc(100% - 46px);
  display: flex;
  flex-direction: column;
}

#sidebarMobileHeightDiff {
  height: 22px;
}

#jsonEditorContainer {
  width: 100%;
  flex-grow: 1;
  background-color:rgba(45, 51, 57,0.8);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

#jsonEditor {
  width: 100%;
  height: 100%
}
</style>
