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
  <!-- Footer buttons -->
  <div class="footer-right" id="footer-right">
    <a class="btn" href="https://phydemo.app/ray-optics/" target="_blank" id="home" v-tooltip-popover="{ title: $t('main:pages.home') }">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-house-door" viewBox="0 0 16 16">
        <path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4.5a.5.5 0 0 0 .5-.5v-4h2v4a.5.5 0 0 0 .5.5H14a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293L8.354 1.146ZM2.5 14V7.707l5.5-5.5 5.5 5.5V14H10v-4a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5v4H2.5Z"/>
      </svg>
    </a>
    <button class="btn" type="button" id="helpDropdown" data-bs-toggle="dropdown" aria-expanded="false">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-question-circle" viewBox="0 0 16 16">
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
        <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/>
      </svg>
    </button>
    <div class="dropdown-menu" id="help-dropdown" aria-labelledby="helpDropdown">
      <div class="container">
        <div id="help_popover_text">
          <div>
            <b v-html="$t('simulator:footer.helpPopup.constrainedDragging.title')"></b>
            <p v-html="$t('simulator:footer.helpPopup.constrainedDragging.description')"></p>
            <b v-html="$t('simulator:footer.helpPopup.groupRotateScale.title')"></b>
            <p v-html="$t('simulator:footer.helpPopup.groupRotateScale.description')"></p>
            <b v-html="$t('simulator:footer.helpPopup.editCoordinates.title')"></b>
            <p v-html="$t('simulator:footer.helpPopup.editCoordinates.description')"></p>
            <b v-html="$t('simulator:footer.helpPopup.keyboardShortcuts.title')"></b>
            <p v-html="$t('simulator:footer.helpPopup.keyboardShortcuts.description')"></p>
            <b v-html="$t('simulator:footer.helpPopup.runLocally.title')"></b>
            <p v-html="$t('simulator:footer.helpPopup.runLocally.description')"></p>
            <b v-html="$t('simulator:footer.helpPopup.contactUs.title')"></b>
            <p v-html="$t('simulator:footer.helpPopup.contactUs.description')"></p>
            <p v-html="$t('simulator:footer.helpPopup.contactUs.contribute')"></p>
          </div>
        </div>
        <hr class="dropdown-divider">
        <b><a href="https://phydemo.app/ray-optics/about" target="_blank" id="about" v-html="$t('main:pages.about')"></a></b>
      </div>
    </div>

    <a id="github" class="btn" href="https://github.com/ricktu288/ray-optics" target="_blank" v-tooltip-popover="{ title: $t('main:pages.github') }">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-github" viewBox="0 0 16 16">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
      </svg>
    </a>
  </div>
</template>

<script>
import { vTooltipPopover } from '../directives/tooltip-popover'

export default {
  directives: {
    'tooltip-popover': vTooltipPopover
  }
}
</script>

<style scoped>
.footer-right {
  position: absolute;
  right: 0;
  bottom: 0;
}

.footer-right .btn {
  color: gray;
  padding: 3px;
}

.footer-right .btn:focus {
  box-shadow: none;
}

#about {
  color: white;
}
</style>