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
  <!-- Desktop Toolbar -->
  <div id="toolbar" class="container-fluid d-none d-lg-block">
    <div class="container-xxl">
      <div class="row justify-content-between">
        <FileBar layout="desktop" />
        <ToolsBar layout="desktop" />
        <ViewBar layout="desktop" />
        <RayDensityBar />
        <LayoutAidsBar />
        <SettingsBar layout="desktop" />
      </div>
    </div>
  </div>

  <!-- Mobile Toolbar -->
  <div id="toolbar-mobile-collapse" class="d-block d-lg-none">
    <div>
      <div id="toolbar-mobile" class="container-fluid p-0 position-relative">
        <div class="container-sm p-0">
          <div class="row justify-content-between m-0">
            <FileBar layout="mobile" />
            <ToolsBar layout="mobile" />
            <ViewBar layout="mobile" />
            <SettingsBar layout="mobile" />
          </div>
        </div>
        <div class="dropdown-menu mobile-dropdown-menu" style="display: block; z-index: 1;">
          <!--dummy background for collapse transition-->
          <div>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>

<script>
import FileBar from './FileBar.vue';
import ToolsBar from './ToolsBar.vue';
import ViewBar from './ViewBar.vue';
import SettingsBar from './SettingsBar.vue';
import RayDensityBar from './RayDensityBar.vue';
import LayoutAidsBar from './LayoutAidsBar.vue';

export default {
  name: 'Toolbar',
  components: {
    FileBar,
    ToolsBar,
    ViewBar,
    SettingsBar,
    RayDensityBar,
    LayoutAidsBar
  }
}
</script>

<style>
#toolbar, #toolbar-mobile {
  padding-top: 7px;
  padding-bottom: 3px;
  padding-left: 7px;
  padding-right: 7px;
}

#toolbar {
  background-color: rgba(255,255,255,0.88);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

#toolbar-mobile {
  background-color: rgb(255,255,255);
}


#non-toolbar-space {
  position: relative;
  flex-grow: 1;
}


.mobile-dropdown-menu {
  height: 0;
  transition: height .3s ease;
  overflow: hidden;

  top: 100%;
  left: 0;
  right: 0;
  margin: 0 !important;
  padding: 0;  
  overflow: hidden; 
  
  border: none;
  border-radius: 0;
  background-color: rgb(255,255,255);
}



#mobile-dropdown-collpase {
  position: absolute;
  top: 0;
  width: 100%;

  height: 0;
  transition: height .3s ease;
  background-color: rgb(255,255,255);
}

</style>