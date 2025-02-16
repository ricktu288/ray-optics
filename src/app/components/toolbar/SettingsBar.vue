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
          <button class="btn shadow-none btn-secondary dropdown-toggle" type="button" id="optionsDropdown" data-bs-toggle="dropdown" aria-expanded="false">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-gear" viewBox="0 0 16 16">
              <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
              <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
            </svg>
          </button>
          <div class="dropdown-menu" id="more-options-dropdown" aria-labelledby="optionsDropdown">
            <div class="container">
              <RayDensityBar layout="tablet" />

              <div class="row d-flex d-xxl-none justify-content-between align-items-center">
                <div class="col-auto settings-label" id="layoutAids_more_text"></div>
                <div class="col-auto d-flex align-items-center">
                  <div class="btn-group" role="group">
                    <input type="checkbox" class="btn-check" id="showGrid_more" autocomplete="off">
                    <label id="showGrid_more_label" class="btn shadow-none btn-outline-secondary" for="showGrid_more">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grid-3x3" viewBox="0 0 16 16">
                        <path d="M0 1.5A1.5 1.5 0 0 1 1.5 0h13A1.5 1.5 0 0 1 16 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 14.5v-13zM1.5 1a.5.5 0 0 0-.5.5V5h4V1H1.5zM5 6H1v4h4V6zm1 4h4V6H6v4zm-1 1H1v3.5a.5.5 0 0 0 .5.5H5v-4zm1 0v4h4v-4H6zm5 0v4h3.5a.5.5 0 0 0 .5-.5V11h-4zm0-1h4V6h-4v4zm0-5h4V1.5a.5.5 0 0 0-.5-.5H11v4zm-1 0V1H6v4h4z"/>
                      </svg>                    
                    </label>
                    <input type="checkbox" class="btn-check" id="snapToGrid_more" autocomplete="off">
                    <label id="snapToGrid_more_label" class="btn shadow-none btn-outline-secondary" for="snapToGrid_more">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-magnet" viewBox="0 0 16 16">
                        <path d="M8 1a7 7 0 0 0-7 7v3h4V8a3 3 0 0 1 6 0v3h4V8a7 7 0 0 0-7-7Zm7 11h-4v3h4v-3ZM5 12H1v3h4v-3ZM0 8a8 8 0 1 1 16 0v8h-6V8a2 2 0 1 0-4 0v8H0V8Z"/>
                      </svg>                 
                    </label>
                    <input type="checkbox" class="btn-check" id="lockObjs_more" autocomplete="off">
                    <label id="lockObjs_more_label" class="btn shadow-none btn-outline-secondary" for="lockObjs_more">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-lock" viewBox="0 0 16 16">
                        <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 8h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
                      </svg>
                    </label>
                  </div>
                </div>
                <hr class="dropdown-divider">
              </div>

              <div class="row d-flex justify-content-between align-items-center" data-bs-placement="left" data-bs-offset="75,20">
                <div class="col-auto settings-label" id="showRayArrows_text"></div>
                <div class="col-auto d-flex align-items-center">
                  <div class="flex-grow-1 d-flex align-items-center">
                    <div class="form-check form-switch align-items-center">
                      <input class="form-check-input" type="checkbox" id="showRayArrows">
                    </div>
                  </div>
                </div>
              </div>
              <div id="correct_brightness_popover" class="row d-flex justify-content-between align-items-center" data-bs-placement="left" data-bs-offset="25,20">
                <div id="correct_brightness_text" class="col-auto settings-label"></div>
                <div class="col-auto d-flex align-items-center">
                  <div class="flex-grow-1 d-flex align-items-center">
                    <div class="form-check form-switch align-items-center">
                      <input class="form-check-input" type="checkbox" id="correct_brightness">
                    </div>
                  </div>
                </div>
              </div>
              <div id="simulateColors_popover" class="row d-flex justify-content-between align-items-center" data-bs-placement="left" data-bs-offset="50,20">
                <div class="col-auto settings-label" id="simulateColors_text"></div>
                <div class="col-auto d-flex align-items-center">
                  <div class="flex-grow-1 d-flex align-items-center">
                    <div class="form-check form-switch align-items-center">
                      <input class="form-check-input" type="checkbox" id="simulateColors">
                    </div>
                  </div>
                </div>
              </div>
              <div class="row d-flex justify-content-between align-items-center" data-bs-placement="left" data-bs-offset="20,20" id="colorMode_popover">
                <div class="col-auto settings-label" id="colorMode_text"></div>
                <div class="col-auto d-flex align-items-center">
                  <button class="btn shadow-none dropdown-toggle" type="button" data-bs-toggle="modal" data-bs-target="#colorModeModal" id="colorMode" disabled>
                  </button>
                </div>
              </div>
              <div class="row d-flex justify-content-between align-items-center" id="gridSize_popover" data-bs-placement="left" data-bs-offset="20,20">
                <div id="gridSize_text" class="col-auto settings-label"></div>
                <div class="col-auto d-flex align-items-center">
                  <div class="flex-grow-1 d-flex align-items-center">
                    <input type="text" class="settings-number" id="gridSize" value="20">
                  </div>
                </div>
              </div>

              <div class="row d-flex justify-content-between align-items-center" id="observer_size_popover" data-bs-placement="left" data-bs-offset="0,20">
                <div id="observer_size_text" class="col-auto settings-label"></div>
                <div class="col-auto d-flex align-items-center">
                  <div class="flex-grow-1 d-flex align-items-center">
                    <input type="text" class="settings-number" id="observer_size" value="40">
                  </div>
                </div>
              </div>

              <div id="lengthScale_popover" class="row d-flex justify-content-between align-items-center" data-bs-placement="left" data-bs-offset="0,20">
                <div id="lengthScale_text" class="col-auto settings-label"></div>
                <div class="col-auto d-flex align-items-center">
                  <div class="flex-grow-1 d-flex align-items-center">
                    <input type="text" class="settings-number" id="lengthScale" value="1">
                  </div>
                </div>
              </div>

              <div class="row d-flex justify-content-between align-items-center">
                <div id="zoom_text" class="col-auto settings-label"></div>
                <div class="col-auto d-flex align-items-center">
                  <button class="btn shadow-none range-minus-btn" id="zoomMinus">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-dash" viewBox="0 0 16 16">
                      <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>
                    </svg>
                  </button>
                  <span class="mx-2" id="zoom">100%</span>
                  <button class="btn shadow-none range-plus-btn" id="zoomPlus">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus" viewBox="0 0 16 16">
                      <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                    </svg>
                  </button>
                </div>
              </div>
              <hr class="dropdown-divider">
              <div class="row d-flex justify-content-between align-items-center">
                <div class="col-auto settings-label" id="language_text"></div>
                <div class="col-auto d-flex align-items-center">
                  <button class="btn shadow-none dropdown-toggle" type="button" data-bs-toggle="modal" data-bs-target="#languageModal" id="language">
                    English
                  </button>
                </div>
              </div>
              <div class="language-warning alert alert-warning py-1 mt-1" style="display: none; font-size: 0.875rem; padding-left: 10px; margin-right: 5px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle me-1" viewBox="0 0 16 16" style="margin-bottom:2px">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                  <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                </svg>
              </div>

              <div id="auto_sync_url_popover" class="row d-flex justify-content-between align-items-center" data-bs-placement="left" data-bs-offset="0,20">
                <div id="auto_sync_url_text" class="col-auto settings-label"></div>
                <div class="col-auto d-flex align-items-center">
                  <div class="flex-grow-1 d-flex align-items-center">
                    <div class="form-check form-switch align-items-center">
                      <input class="form-check-input" type="checkbox" id="auto_sync_url">
                    </div>
                  </div>
                </div>
              </div>

              <div id="show_json_editor_popover" class="row d-flex justify-content-between align-items-center" data-bs-placement="left" data-bs-offset="0,20">
                <div id="show_json_editor_text" class="col-auto settings-label"></div>
                <div class="col-auto d-flex align-items-center">
                  <div class="flex-grow-1 d-flex align-items-center">
                    <div class="form-check form-switch align-items-center">
                      <input class="form-check-input" type="checkbox" id="show_json_editor">
                    </div>
                  </div>
                </div>
              </div>

              <div id="show_status_popover" class="row d-flex justify-content-between align-items-center" data-bs-placement="left" data-bs-offset="0,20">
                <div id="show_status_text" class="col-auto settings-label"></div>
                <div class="col-auto d-flex align-items-center">
                  <div class="flex-grow-1 d-flex align-items-center">
                    <div class="form-check form-switch align-items-center">
                      <input class="form-check-input" type="checkbox" id="show_status">
                    </div>
                  </div>
                </div>
              </div>
              
              <div id="show_help_popups_popover" class="row d-flex justify-content-between align-items-center" data-bs-placement="left" data-bs-offset="0,20">
                <div id="show_help_popups_text" class="col-auto settings-label"></div>
                <div class="col-auto d-flex align-items-center">
                  <div class="flex-grow-1 d-flex align-items-center">
                    <div class="form-check form-switch align-items-center">
                      <input class="form-check-input" type="checkbox" id="show_help_popups">
                    </div>
                  </div>
                </div>
              </div>
              <div class="reload-warning alert alert-warning py-1 mt-1" style="display: none; font-size: 0.875rem; padding-left: 10px; margin-right: 5px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle me-1" viewBox="0 0 16 16" style="margin-bottom:2px">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                  <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                </svg>
              </div>

              <div id="advanced-help"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div id="settings_text" class="row justify-content-center title d-none d-xxl-flex"></div>
    <div class="row justify-content-center title d-flex d-xxl-none" id="moreSettings_text"></div>
  </div>

  <div v-if="layout === 'mobile'" class="col p-1">
    <button type="button" class="btn shadow-none btn-secondary w-100" data-bs-toggle="dropdown" data-bs-display="static">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-gear" viewBox="0 0 16 16">
        <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
        <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
      </svg>
      <span class="d-none d-md-inline" id="moreSettings_text_mobile"></span>
    </button>
    <div class="dropdown-menu mobile-dropdown-menu">
      <div id="mobile-dropdown-options" class="mobile-dropdown">
        <div class="container" style="padding-bottom: 15px;">
          <RayDensityBar layout="mobile" />

          <hr class="dropdown-divider">

          <div class="row d-flex justify-content-between align-items-center">
            <div id="showGrid_text" class="col-auto settings-label"></div>
            <div class="col-auto d-flex align-items-center">
              <div class="flex-grow-1 d-flex align-items-center">
                <div class="form-check form-switch align-items-center">
                  <input class="form-check-input" type="checkbox" id="showGrid_mobile">
                </div>
              </div>
            </div>
          </div>
          <div class="row d-flex justify-content-between align-items-center">
            <div id="snapToGrid_text" class="col-auto settings-label"></div>
            <div class="col-auto d-flex align-items-center">
              <div class="flex-grow-1 d-flex align-items-center">
                <div class="form-check form-switch align-items-center">
                  <input class="form-check-input" type="checkbox" id="snapToGrid_mobile">
                </div>
              </div>
            </div>
          </div>
          <div class="row d-flex justify-content-between align-items-center">
            <div id="lockObjs_text" class="col-auto settings-label"></div>
            <div class="col-auto d-flex align-items-center">
              <div class="flex-grow-1 d-flex align-items-center">
                <div class="form-check form-switch align-items-center">
                  <input class="form-check-input" type="checkbox" id="lockObjs_mobile">
                </div>
              </div>
            </div>
          </div>

          <hr class="dropdown-divider">

          <div class="row d-flex justify-content-between align-items-center">
            <div class="col-auto settings-label" id="showRayArrows_mobile_text"></div>
            <div class="col-auto d-flex align-items-center">
              <div class="flex-grow-1 d-flex align-items-center">
                <div class="form-check form-switch align-items-center">
                  <input class="form-check-input" type="checkbox" id="showRayArrows_mobile">
                </div>
              </div>
            </div>
          </div>
          <div class="row d-flex justify-content-between align-items-center" data-bs-placement="left">
            <div id="correct_brightness_mobile_text" class="col-auto settings-label"></div>
            <div class="col-auto d-flex align-items-center">
              <div class="flex-grow-1 d-flex align-items-center">
                <div class="form-check form-switch align-items-center">
                  <input class="form-check-input" type="checkbox" id="correct_brightness_mobile">
                </div>
              </div>
            </div>
          </div>
          <div class="row d-flex justify-content-between align-items-center">
            <div class="col-auto settings-label" id="simulateColors_mobile_text"></div>
            <div class="col-auto d-flex align-items-center">
              <div class="flex-grow-1 d-flex align-items-center">
                <div class="form-check form-switch align-items-center">
                  <input class="form-check-input" type="checkbox" id="simulateColors_mobile">
                </div>
              </div>
            </div>
          </div>
          <div class="row d-flex justify-content-between align-items-center">
            <div class="col-auto settings-label" id="colorMode_mobile_text"></div>
            <div class="col-auto d-flex align-items-center">
              <button class="btn dropdown-toggle" type="button" data-bs-toggle="modal" data-bs-target="#colorModeModal" id="colorMode_mobile" disabled>
              </button>
            </div>
          </div>
          <div class="row d-flex justify-content-between align-items-center" data-bs-placement="left" data-bs-offset="75,0">
            <div id="gridSize_mobile_text" class="col-auto settings-label"></div>
            <div class="col-auto d-flex align-items-center">
              <div class="flex-grow-1 d-flex align-items-center">
                <input type="text" class="settings-number" id="gridSize_mobile" value="20">
              </div>
            </div>
          </div>

          <div class="row d-flex justify-content-between align-items-center" data-bs-placement="left" data-bs-offset="75,0">
            <div id="observer_size_mobile_text" class="col-auto settings-label"></div>
            <div class="col-auto d-flex align-items-center">
              <div class="flex-grow-1 d-flex align-items-center">
                <input type="text" class="settings-number" id="observer_size_mobile" value="40">
              </div>
            </div>
          </div>

          <div class="row d-flex justify-content-between align-items-center" data-bs-placement="left" data-bs-offset="75,0">
            <div id="lengthScale_mobile_text" class="col-auto settings-label"></div>
            <div class="col-auto d-flex align-items-center">
              <div class="flex-grow-1 d-flex align-items-center">
                <input type="text" class="settings-number" id="lengthScale_mobile" value="1">
              </div>
            </div>
          </div>
          <div class="row d-flex justify-content-between align-items-center">
            <div id="zoom_mobile_text" class="col-auto settings-label"></div>
            <div class="col-auto d-flex align-items-center">
              <button class="btn range-minus-btn" id="zoomMinus_mobile">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-dash" viewBox="0 0 16 16">
                  <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>
                </svg>
              </button>
              <span class="mx-2" id="zoom_mobile">100%</span>
              <button class="btn range-plus-btn" id="zoomPlus_mobile">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus" viewBox="0 0 16 16">
                  <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                </svg>
              </button>
            </div>
          </div>

          <hr class="dropdown-divider">

          <div class="row d-flex justify-content-between align-items-center">
            <div class="col-auto settings-label" id="language_mobile_text"></div>
            <div class="col-auto d-flex align-items-center">
              <button class="btn dropdown-toggle" type="button" data-bs-toggle="modal" data-bs-target="#languageModal" id="language_mobile">
                English
              </button>
            </div>
          </div>

          <div class="language-warning alert alert-warning py-1 mt-1" style="display: none; font-size: 0.875rem; padding-left: 10px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle me-1" viewBox="0 0 16 16" style="margin-bottom:2px">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
          </div>



          <div class="row d-flex justify-content-between align-items-center" data-bs-placement="left">
            <div id="auto_sync_url_mobile_text" class="col-auto settings-label"></div>
            <div class="col-auto d-flex align-items-center">
              <div class="flex-grow-1 d-flex align-items-center">
                <div class="form-check form-switch align-items-center">
                  <input class="form-check-input" type="checkbox" id="auto_sync_url_mobile">
                </div>
              </div>
            </div>
          </div>

          <div class="row d-flex justify-content-between align-items-center" data-bs-placement="left">
            <div id="show_json_editor_mobile_text" class="col-auto settings-label"></div>
            <div class="col-auto d-flex align-items-center">
              <div class="flex-grow-1 d-flex align-items-center">
                <div class="form-check form-switch align-items-center">
                  <input class="form-check-input" type="checkbox" id="show_json_editor_mobile">
                </div>
              </div>
            </div>
          </div>

          <div class="row d-flex justify-content-between align-items-center" data-bs-placement="left">
            <div id="show_status_mobile_text" class="col-auto settings-label"></div>
            <div class="col-auto d-flex align-items-center">
              <div class="flex-grow-1 d-flex align-items-center">
                <div class="form-check form-switch align-items-center">
                  <input class="form-check-input" type="checkbox" id="show_status_mobile">
                </div>
              </div>
            </div>
          </div>
          <div class="reload-warning alert alert-warning py-1 mt-1" style="display: none; font-size: 0.875rem; padding-left: 10px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle me-1" viewBox="0 0 16 16" style="margin-bottom:2px">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>
          </div>


        </div>
      </div>
    </div>
  </div>
</template>

<script>
import RayDensityBar from './RayDensityBar.vue';

export default {
  name: 'SettingsBar',
  props: {
    layout: String
  },
  components: {
    RayDensityBar
  }
}
</script>