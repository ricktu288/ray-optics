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
  <div v-if="layout === 'desktop'" class="col-auto">
    <div class="row">
      <div class="btn-group" role="group">
        <div class="dropdown">
          <button class="btn shadow-none btn-secondary dropdown-toggle" type="button" id="fileDropdown" data-bs-toggle="dropdown" aria-expanded="false">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark" viewBox="0 0 16 16">
              <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
            </svg>
          </button>
          <ul class="dropdown-menu" aria-labelledby="fileDropdown">
            <li><button class="dropdown-item" type="reset" id="reset"></button></li>
            <li><hr class="dropdown-divider"></li>
            <li><button class="dropdown-item" type="button" id="save" data-bs-toggle="modal" data-bs-target="#saveModal"></button></li>
            <li><button class="dropdown-item" type="button" id="open"></button></li>
            <li><button class="dropdown-item" type="button" id="export_svg"></button></li>
            <li><button class="dropdown-item" type="button" id="get_link"></button></li>
            <li><hr class="dropdown-divider"></li>
            <li><button class="dropdown-item" type="button" id="view_gallery"></button></li>
          </ul>
        </div>
        <button type="button" class="btn shadow-none btn-secondary" id="undo">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-return-left" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M14.5 1.5a.5.5 0 0 1 .5.5v4.8a2.5 2.5 0 0 1-2.5 2.5H2.707l3.347 3.346a.5.5 0 0 1-.708.708l-4.2-4.2a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 8.3H12.5A1.5 1.5 0 0 0 14 6.8V2a.5.5 0 0 1 .5-.5z"/>
          </svg>
        </button>
        <button type="button" class="btn shadow-none btn-secondary" id="redo">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-return-right" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M1.5 1.5A.5.5 0 0 0 1 2v4.8a2.5 2.5 0 0 0 2.5 2.5h9.793l-3.347 3.346a.5.5 0 0 0 .708.708l4.2-4.2a.5.5 0 0 0 0-.708l-4-4a.5.5 0 0 0-.708.708L13.293 8.3H3.5A1.5 1.5 0 0 1 2 6.8V2a.5.5 0 0 0-.5-.5z"/>
          </svg>
        </button>
      </div>
    </div>
    <div id="file_text" class="row justify-content-center title"></div>
  </div>

  <div v-if="layout === 'mobile'" class="col p-1">
    <div class="btn-group w-100 position-static" role="group">
      <button type="button" class="btn shadow-none btn-secondary flex-fill" data-bs-toggle="dropdown" data-bs-display="static">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark" viewBox="0 0 16 16">
          <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
        </svg>
      </button>
      <div class="dropdown-menu mobile-dropdown-menu">
        <div id="mobile-dropdown-file" class="mobile-dropdown">
          <li><button class="dropdown-item" type="button" id="reset_mobile"></button></li>
          <li><hr class="dropdown-divider"></li>
          <li><button id="save_button" class="dropdown-item" data-bs-toggle="modal" data-bs-target="#saveModal"></button></li>
          <li><button class="dropdown-item" type="button" id="open_mobile"></button></li>
          <li><button class="dropdown-item" type="button" id="export_svg_mobile"></button></li>
          <li><button class="dropdown-item" type="button" id="get_link_mobile"></button></li>
          <li><hr class="dropdown-divider"></li>
          <li><button class="dropdown-item" type="button" id="view_gallery_mobile"></button></li>
        </div>
      </div>
      <button type="button" class="btn shadow-none btn-secondary" id="undo_mobile">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-return-left" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M14.5 1.5a.5.5 0 0 1 .5.5v4.8a2.5 2.5 0 0 1-2.5 2.5H2.707l3.347 3.346a.5.5 0 0 1-.708.708l-4.2-4.2a.5.5 0 0 1 0-.708l4-4a.5.5 0 1 1 .708.708L2.707 8.3H12.5A1.5 1.5 0 0 0 14 6.8V2a.5.5 0 0 1 .5-.5z"/>
        </svg>
      </button>
      <button type="button" class="btn shadow-none btn-secondary" id="redo_mobile">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-return-right" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M1.5 1.5A.5.5 0 0 0 1 2v4.8a2.5 2.5 0 0 0 2.5 2.5h9.793l-3.347 3.346a.5.5 0 0 0 .708.708l4.2-4.2a.5.5 0 0 0 0-.708l-4-4a.5.5 0 0 0-.708.708L13.293 8.3H3.5A1.5 1.5 0 0 1 2 6.8V2a.5.5 0 0 0-.5-.5z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FileBar',
  props: {
    layout: String
  }
}
</script>