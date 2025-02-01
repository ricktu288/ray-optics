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

  <!-- Actual toolbar -->
  <div id="toolbar-wrapper" style="display: none;">
    <div id="toolbar" class="container-fluid d-none d-lg-block">
      <div class="container-xxl">
        <div class="row justify-content-between">
          <div class="col-auto">
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

          <div class="col-auto">
            <div class="row">
              <div class="btn-group" role="group">
                <div class="dropdown">
                  <button class="btn shadow-none btn-primary dropdown-toggle" type="button" id="sourceToolsDropdown" data-bs-toggle="dropdown" aria-expanded="false"></button>
                  <ul class="dropdown-menu" aria-labelledby="sourceToolsDropdown">
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_SingleRay">
                      <label id="tool_SingleRay_label" class="btn shadow-none btn-primary dropdown-item" for="tool_SingleRay" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_Beam">
                      <label id="tool_Beam_label" class="btn shadow-none btn-primary dropdown-item" for="tool_Beam" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_PointSource">
                      <label id="tool_PointSource_label" class="btn shadow-none btn-primary dropdown-item" for="tool_PointSource" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_AngleSource">
                      <label id="tool_AngleSource_label" class="btn shadow-none btn-primary dropdown-item" for="tool_AngleSource" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                  </ul>
                </div>
                
                <div class="dropdown">
                  <button class="btn shadow-none btn-primary dropdown-toggle" type="button" id="mirrorToolsDropdown" data-bs-toggle="dropdown" aria-expanded="false"></button>
                  <ul class="dropdown-menu" aria-labelledby="mirrorToolsDropdown">
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_Mirror">
                      <label id="tool_Mirror_label" class="btn shadow-none btn-primary dropdown-item" for="tool_Mirror" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_ArcMirror">
                      <label id="tool_ArcMirror_label" class="btn shadow-none btn-primary dropdown-item" for="tool_ArcMirror" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_ParabolicMirror">
                      <label id="tool_ParabolicMirror_label" class="btn shadow-none btn-primary dropdown-item" for="tool_ParabolicMirror" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_CustomMirror">
                      <label id="tool_CustomMirror_label" class="btn shadow-none btn-primary dropdown-item" for="tool_CustomMirror" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_IdealMirror">
                      <label id="tool_IdealMirror_label" class="btn shadow-none btn-primary dropdown-item" for="tool_IdealMirror" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_BeamSplitter">
                      <label id="tool_BeamSplitter_label" class="btn shadow-none btn-primary dropdown-item" for="tool_BeamSplitter" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                  </ul>
                </div>
                <div class="dropdown">
                  <button class="btn shadow-none btn-primary dropdown-toggle" type="button" id="glassToolsDropdown" data-bs-toggle="dropdown" aria-expanded="false"></button>
                  <ul class="dropdown-menu" aria-labelledby="glassToolsDropdown">
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_PlaneGlass">
                      <label id="tool_PlaneGlass_label" class="btn shadow-none btn-primary dropdown-item" for="tool_PlaneGlass" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_CircleGlass">
                      <label id="tool_CircleGlass_label" class="btn shadow-none btn-primary dropdown-item" for="tool_CircleGlass" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_Glass">
                      <label id="tool_Glass_label" class="btn shadow-none btn-primary dropdown-item" for="tool_Glass" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_CustomGlass">
                      <label id="tool_CustomGlass_label" class="btn shadow-none btn-primary dropdown-item" for="tool_CustomGlass" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_IdealLens">
                      <label id="tool_IdealLens_label" class="btn shadow-none btn-primary dropdown-item" for="tool_IdealLens" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_SphericalLens">
                      <label id="tool_SphericalLens_label" class="btn shadow-none btn-primary dropdown-item" for="tool_SphericalLens" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_CircleGrinGlass">
                      <label id="tool_CircleGrinGlass_label" class="btn shadow-none btn-primary dropdown-item" for="tool_CircleGrinGlass" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_GrinGlass">
                      <label id="tool_GrinGlass_label" class="btn shadow-none btn-primary dropdown-item" for="tool_GrinGlass" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                  </ul>
                </div>
                <div class="dropdown">
                  <button class="btn shadow-none btn-primary dropdown-toggle" type="button" id="blockerToolsDropdown" data-bs-toggle="dropdown" aria-expanded="false"></button>
                  <ul class="dropdown-menu" aria-labelledby="blockerToolsDropdown">
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_Blocker">
                      <label id="tool_Blocker_label" class="btn shadow-none btn-primary dropdown-item" for="tool_Blocker" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_CircleBlocker">
                      <label id="tool_CircleBlocker_label" class="btn shadow-none btn-primary dropdown-item" for="tool_CircleBlocker" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_Aperture">
                      <label id="tool_Aperture_label" class="btn shadow-none btn-primary dropdown-item" for="tool_Aperture" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_DiffractionGrating">
                      <label id="tool_DiffractionGrating_label" class="btn shadow-none btn-primary dropdown-item" for="tool_DiffractionGrating" data-bs-placement="right" data-bs-offset="40,8"></label>
                    </li>
                  </ul>
                </div>
                <div class="dropdown">
                  <button class="btn shadow-none btn-primary dropdown-toggle" type="button" id="moreToolsDropdown" data-bs-toggle="dropdown" aria-expanded="false"></button>
                  <ul class="dropdown-menu" aria-labelledby="moreToolsDropdown">
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_Ruler">
                      <label id="tool_Ruler_label" class="btn shadow-none btn-primary dropdown-item" for="tool_Ruler" data-bs-placement="right" data-bs-offset="60,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_Protractor">
                      <label id="tool_Protractor_label" class="btn shadow-none btn-primary dropdown-item" for="tool_Protractor" data-bs-placement="right" data-bs-offset="60,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_Detector">
                      <label id="tool_Detector_label" class="btn shadow-none btn-primary dropdown-item" for="tool_Detector" data-bs-placement="right" data-bs-offset="60,8"></label>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_TextLabel">
                      <label id="tool_TextLabel_label" class="btn shadow-none btn-primary dropdown-item" for="tool_TextLabel" data-bs-placement="right" data-bs-offset="0,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_LineArrow">
                      <label id="tool_LineArrow_label" class="btn shadow-none btn-primary dropdown-item" for="tool_LineArrow" data-bs-placement="right" data-bs-offset="0,8"></label>
                    </li>
                    <li>
                      <input type="radio" class="btn-check" name="toolsradio" autocomplete="off" id="tool_Drawing">
                      <label id="tool_Drawing_label" class="btn shadow-none btn-primary dropdown-item" for="tool_Drawing" data-bs-placement="right" data-bs-offset="0,8"></label>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    <li id="module_start"><button class="dropdown-item" type="button" id="import_modules" data-bs-toggle="modal" data-bs-target="#moduleModal"></button></li>
                  </ul>
                </div>
                <input type="radio" class="btn-check" name="toolsradio" id="tool_" autocomplete="off" checked>
                <label id="tool__label" class="btn shadow-none btn-primary" for="tool_">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrows-move" viewBox="0 0 16 16">
                    <path fill-rule="evenodd" d="M7.646.146a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L8.5 1.707V5.5a.5.5 0 0 1-1 0V1.707L6.354 2.854a.5.5 0 1 1-.708-.708l2-2zM8 10a.5.5 0 0 1 .5.5v3.793l1.146-1.147a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 .708-.708L7.5 14.293V10.5A.5.5 0 0 1 8 10zM.146 8.354a.5.5 0 0 1 0-.708l2-2a.5.5 0 1 1 .708.708L1.707 7.5H5.5a.5.5 0 0 1 0 1H1.707l1.147 1.146a.5.5 0 0 1-.708.708l-2-2zM10 8a.5.5 0 0 1 .5-.5h3.793l-1.147-1.146a.5.5 0 0 1 .708-.708l2 2a.5.5 0 0 1 0 .708l-2 2a.5.5 0 0 1-.708-.708L14.293 8.5H10.5A.5.5 0 0 1 10 8z"/>
                  </svg>
                </label>
              </div>
            </div>
            <div class="row justify-content-center title" id="tools_text"></div>
          </div>
          <div class="col-auto">
            <div class="row">
              <div class="btn-group" role="group">
                <input type="radio" class="btn-check" name="viewradio" id="mode_rays" autocomplete="off" checked>
                <label id="mode_rays_label" class="btn shadow-none btn-primary" for="mode_rays" data-bs-placement="bottom">
                  <img src="../../img/rays_icon.svg" alt="Ray" width="16" height="20">                        
                </label>
                <input type="radio" class="btn-check" name="viewradio" id="mode_extended" autocomplete="off">
                <label id="mode_extended_label" class="btn shadow-none btn-primary" for="mode_extended" data-bs-placement="bottom">
                  <img src="../../img/extended_icon.svg" alt="Extended" width="16" height="20">
                </label>
                <input type="radio" class="btn-check" name="viewradio" id="mode_images" autocomplete="off">
                <label id="mode_images_label" class="btn shadow-none btn-primary" for="mode_images" data-bs-placement="bottom">
                  <img src="../../img/images_icon.svg" alt="Images" width="16" height="20">
                </label>
                <input type="radio" class="btn-check" name="viewradio" id="mode_observer" autocomplete="off">
                <label id="mode_observer_label" class="btn shadow-none btn-primary" for="mode_observer" data-bs-placement="bottom">
                  <img src="../../img/observer_icon.svg" alt="Observer" width="16" height="20">
                </label>
              </div>
            </div>
            <div class="row justify-content-center title" id="view_text"></div>
          </div>

          <div class="col-auto d-none d-xl-block">
            <div class="row justify-content-center">
              <div class="btn-group d-flex align-items-center" id="rayDensity_popover" role="group" data-bs-offset="0,25">
                <button class="btn shadow-none range-minus-btn" id="rayDensityMinus">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-dash" viewBox="0 0 16 16">
                    <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>
                  </svg>
                </button>
                <input type="range" class="form-range toolbar-range" min="-3" max="3" step="0.0001" value="-2.3026" id="rayDensity">
                <button class="btn shadow-none range-plus-btn" id="rayDensityPlus">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus" viewBox="0 0 16 16">
                    <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="row justify-content-center title" id="rayDensity_text"></div>
          </div>
          <div class="col-auto d-none d-xxl-block">
            <div class="row">
              <div class="btn-group" role="group">
                <input type="checkbox" class="btn-check" id="showGrid" autocomplete="off">
                <label id="showGrid_label" class="btn shadow-none btn-secondary" for="showGrid">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grid-3x3" viewBox="0 0 16 16">
                    <path d="M0 1.5A1.5 1.5 0 0 1 1.5 0h13A1.5 1.5 0 0 1 16 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 14.5v-13zM1.5 1a.5.5 0 0 0-.5.5V5h4V1H1.5zM5 6H1v4h4V6zm1 4h4V6H6v4zm-1 1H1v3.5a.5.5 0 0 0 .5.5H5v-4zm1 0v4h4v-4H6zm5 0v4h3.5a.5.5 0 0 0 .5-.5V11h-4zm0-1h4V6h-4v4zm0-5h4V1.5a.5.5 0 0 0-.5-.5H11v4zm-1 0V1H6v4h4z"/>
                  </svg>                    
                </label>
                <input type="checkbox" class="btn-check" id="snapToGrid" autocomplete="off">
                <label id="snapToGrid_label" class="btn shadow-none btn-secondary" for="snapToGrid">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-magnet" viewBox="0 0 16 16">
                    <path d="M8 1a7 7 0 0 0-7 7v3h4V8a3 3 0 0 1 6 0v3h4V8a7 7 0 0 0-7-7Zm7 11h-4v3h4v-3ZM5 12H1v3h4v-3ZM0 8a8 8 0 1 1 16 0v8h-6V8a2 2 0 1 0-4 0v8H0V8Z"/>
                  </svg>                 
                </label>
                <input type="checkbox" class="btn-check" id="lockObjs" autocomplete="off">
                <label id="lockObjs_label" class="btn shadow-none btn-secondary" for="lockObjs">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-lock" viewBox="0 0 16 16">
                    <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 8h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
                  </svg>
                </label>
              </div>
            </div>
            <div class="row justify-content-center title" id="layoutAids_text"></div>
          </div>
          <div class="col-auto">
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
                      <div class="row d-flex d-xl-none justify-content-between align-items-center" id="rayDensity_more_popover" data-bs-placement="left" data-bs-offset="0,20">
                        <div class="col-auto" id="rayDensity_more_text"></div>
                        <div class="btn-group col-auto d-flex align-items-center" role="group">
                          <button class="btn shadow-none range-minus-btn" id="rayDensityMinus_more">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-dash" viewBox="0 0 16 16">
                              <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>
                            </svg>
                          </button>
                          <input type="range" class="form-range toolbar-range" min="-3" max="3" step="0.0001" value="-2.3026" id="rayDensity_more">
                          <button class="btn shadow-none range-plus-btn" id="rayDensityPlus_more">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus" viewBox="0 0 16 16">
                              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                            </svg>
                          </button>
                        </div>
                        <hr class="dropdown-divider">
                      </div>

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
          
        </div>
      </div>
    </div>

    <!-- mobile tool bar -->

    <div id="toolbar-mobile-collapse" class="d-block d-lg-none">
      <div>
        <div id="toolbar-mobile" class="container-fluid p-0 position-relative">
          <div class="container-sm p-0">
            <div class="row justify-content-between m-0">
              <div class="col p-1">
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
              <div class="col p-1">
                <button type="button" class="btn shadow-none btn-primary w-100" data-bs-toggle="dropdown" data-bs-display="static" id="mobile-tools">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-tools" viewBox="0 0 16 16">
                    <path d="M1 0 0 1l2.2 3.081a1 1 0 0 0 .815.419h.07a1 1 0 0 1 .708.293l2.675 2.675-2.617 2.654A3.003 3.003 0 0 0 0 13a3 3 0 1 0 5.878-.851l2.654-2.617.968.968-.305.914a1 1 0 0 0 .242 1.023l3.27 3.27a.997.997 0 0 0 1.414 0l1.586-1.586a.997.997 0 0 0 0-1.414l-3.27-3.27a1 1 0 0 0-1.023-.242L10.5 9.5l-.96-.96 2.68-2.643A3.005 3.005 0 0 0 16 3c0-.269-.035-.53-.102-.777l-2.14 2.141L12 4l-.364-1.757L13.777.102a3 3 0 0 0-3.675 3.68L7.462 6.46 4.793 3.793a1 1 0 0 1-.293-.707v-.071a1 1 0 0 0-.419-.814L1 0Zm9.646 10.646a.5.5 0 0 1 .708 0l2.914 2.915a.5.5 0 0 1-.707.707l-2.915-2.914a.5.5 0 0 1 0-.708ZM3 11l.471.242.529.026.287.445.445.287.026.529L5 13l-.242.471-.026.529-.445.287-.287.445-.529.026L3 15l-.471-.242L2 14.732l-.287-.445L1.268 14l-.026-.529L1 13l.242-.471.026-.529.445-.287.287-.445.529-.026L3 11Z"/>
                  </svg>
                  <span class="d-none d-md-inline" id="tools_mobile_text"></span>
                </button>
                <div class="dropdown-menu mobile-dropdown-menu">
                  <div class="mobile-dropdown">
                    <ul id="mobile-dropdown-tools-root">
                      <li>
                        <button class="btn btn-primary dropdown-item mobile-dropdown-trigger d-flex w-100" id="mobile-dropdown-trigger-source">
                          <div id="tool_lightSource__text" class="col"></div>
                          <div class="col text-end">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
                              <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                            </svg>
                          </div>
                        </button>
                      </li>
                      <li>
                        <button class="btn btn-primary dropdown-item mobile-dropdown-trigger d-flex w-100" id="mobile-dropdown-trigger-mirror">
                          <div id="tool_mirror__text" class="col"></div>
                          <div class="col text-end">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
                              <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                            </svg>
                          </div>
                        </button>
                      </li>
                      <li>
                        <button class="btn btn-primary dropdown-item  mobile-dropdown-trigger d-flex w-100" id="mobile-dropdown-trigger-glass">
                          <div id="tool_glass__text" class="col"></div>
                          <div class="col text-end">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
                              <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                            </svg>
                          </div>
                        </button>
                      </li>
                      <li>
                        <button class="btn btn-primary dropdown-item mobile-dropdown-trigger d-flex w-100" id="mobile-dropdown-trigger-blocker">
                          <div id="tool_blocker__text" class="col"></div>
                          <div class="col text-end">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
                              <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                            </svg>
                          </div>
                        </button>
                      </li>
                      <li>
                        <button class="btn btn-primary dropdown-item mobile-dropdown-trigger d-flex w-100" id="mobile-dropdown-trigger-more">
                          <div id="tool_more__text" class="col"></div>
                          <div class="col text-end">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
                              <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
                            </svg>
                          </div>
                        </button>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool__mobile" checked>
                        <label id="tool__mobile_label" class="btn btn-primary dropdown-item" for="tool__mobile"></label>
                      </li>
                    </ul>

                    <ul id="mobile-dropdown-source" style="display:none">
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_SingleRay_mobile">
                        <label id="tool_SingleRay_mobile_label" class="btn btn-primary dropdown-item" for="tool_SingleRay_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_Beam_mobile">
                        <label id="tool_Beam_mobile_label" class="btn btn-primary dropdown-item" for="tool_Beam_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_PointSource_mobile">
                        <label id="tool_PointSource_mobile_label" class="btn btn-primary dropdown-item" for="tool_PointSource_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_AngleSource_mobile">
                        <label id="tool_AngleSource_mobile_label" class="btn btn-primary dropdown-item" for="tool_AngleSource_mobile"></label>
                      </li>
                    </ul>
                    
                    <ul id="mobile-dropdown-mirror" style="display:none">
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_Mirror_mobile">
                        <label id="tool_Mirror_mobile_label" class="btn btn-primary dropdown-item" for="tool_Mirror_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_ArcMirror_mobile">
                        <label id="tool_ArcMirror_mobile_label" class="btn btn-primary dropdown-item" for="tool_ArcMirror_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_ParabolicMirror_mobile">
                        <label id="tool_ParabolicMirror_mobile_label" class="btn btn-primary dropdown-item" for="tool_ParabolicMirror_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_CustomMirror_mobile">
                        <label id="tool_CustomMirror_mobile_label" class="btn btn-primary dropdown-item" for="tool_CustomMirror_mobile"></label>
                      </li>
                      <li><hr class="dropdown-divider"></li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_IdealMirror_mobile">
                        <label id="tool_IdealMirror_mobile_label" class="btn btn-primary dropdown-item" for="tool_IdealMirror_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_BeamSplitter_mobile">
                        <label id="tool_BeamSplitter_mobile_label" class="btn btn-primary dropdown-item" for="tool_BeamSplitter_mobile"></label>
                      </li>
                    </ul>
                    
                    <ul id="mobile-dropdown-glass" style="display:none">
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_PlaneGlass_mobile">
                        <label id="tool_PlaneGlass_mobile_label" class="btn btn-primary dropdown-item" for="tool_PlaneGlass_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_CircleGlass_mobile">
                        <label id="tool_CircleGlass_mobile_label" class="btn btn-primary dropdown-item" for="tool_CircleGlass_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_Glass_mobile">
                        <label id="tool_Glass_mobile_label" class="btn btn-primary dropdown-item" for="tool_Glass_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_CustomGlass_mobile">
                        <label id="tool_CustomGlass_mobile_label" class="btn btn-primary dropdown-item" for="tool_CustomGlass_mobile"></label>
                      </li>
                      <li><hr class="dropdown-divider"></li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_IdealLens_mobile">
                        <label id="tool_IdealLens_mobile_label" class="btn btn-primary dropdown-item" for="tool_IdealLens_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_SphericalLens_mobile">
                        <label id="tool_SphericalLens_mobile_label" class="btn btn-primary dropdown-item" for="tool_SphericalLens_mobile"></label>
                      </li>
                      <li><hr class="dropdown-divider"></li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_CircleGrinGlass_mobile">
                        <label id="tool_CircleGrinGlass_mobile_label" class="btn btn-primary dropdown-item" for="tool_CircleGrinGlass_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_GrinGlass_mobile">
                        <label id="tool_GrinGlass_mobile_label" class="btn btn-primary dropdown-item" for="tool_GrinGlass_mobile"></label>
                      </li>
                    </ul>
                    
                    <ul id="mobile-dropdown-blocker" style="display:none">
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_Blocker_mobile">
                        <label id="tool_Blocker_mobile_label" class="btn btn-primary dropdown-item" for="tool_Blocker_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_CircleBlocker_mobile">
                        <label id="tool_CircleBlocker_mobile_label" class="btn btn-primary dropdown-item" for="tool_CircleBlocker_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_Aperture_mobile">
                        <label id="tool_Aperture_mobile_label" class="btn btn-primary dropdown-item" for="tool_Aperture_mobile"></label>
                      </li>
                      <li><hr class="dropdown-divider"></li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_DiffractionGrating_mobile">
                        <label id="tool_DiffractionGrating_mobile_label" class="btn btn-primary dropdown-item" for="tool_DiffractionGrating_mobile"></label>
                      </li>
                    </ul>
                    
                    <ul id="mobile-dropdown-more" style="display:none">
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_Ruler_mobile">
                        <label id="tool_Ruler_mobile_label" class="btn btn-primary dropdown-item" for="tool_Ruler_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_Protractor_mobile">
                        <label id="tool_Protractor_mobile_label" class="btn btn-primary dropdown-item" for="tool_Protractor_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_Detector_mobile">
                        <label id="tool_Detector_mobile_label" class="btn btn-primary dropdown-item" for="tool_Detector_mobile"></label>
                      </li>
                      <li><hr class="dropdown-divider"></li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_TextLabel_mobile">
                        <label id="tool_TextLabel_mobile_label" class="btn btn-primary dropdown-item" for="tool_TextLabel_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_LineArrow_mobile">
                        <label id="tool_LineArrow_mobile_label" class="btn btn-primary dropdown-item" for="tool_LineArrow_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="toolsradio_mobile" autocomplete="off" id="tool_Drawing_mobile">
                        <label id="tool_Drawing_mobile_label" class="btn btn-primary dropdown-item" for="tool_Drawing_mobile"></label>
                      </li>
                      <li><hr class="dropdown-divider"></li>
                      <li id="module_start_mobile"><button class="dropdown-item" type="button" id="import_modules_mobile" data-bs-toggle="modal" data-bs-target="#moduleModal"></button></li>
                    </ul>                      
                  </div>
                  
                </div>
              </div>
              <div class="col p-1">
                <button type="button" class="btn shadow-none btn-primary w-100" data-bs-toggle="dropdown" data-bs-display="static">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-eye" viewBox="0 0 16 16">
                    <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
                    <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
                  </svg>
                  <span class="d-none d-md-inline" id="view_mobile_text"></span>
                </button>
                <div class="dropdown-menu mobile-dropdown-menu">
                  <div id="mobile-dropdown-view" class="mobile-dropdown">
                    <ul>
                      <li>
                        <input type="radio" class="btn-check" name="viewradio_mobile" autocomplete="off" id="mode_rays_mobile" checked>
                        <label id="mode_rays_mobile_label" class="btn btn-primary dropdown-item" for="mode_rays_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="viewradio_mobile" autocomplete="off" id="mode_extended_mobile">
                        <label id="mode_extended_mobile_label" class="btn btn-primary dropdown-item" for="mode_extended_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="viewradio_mobile" autocomplete="off" id="mode_images_mobile">
                        <label id="mode_images_mobile_label" class="btn btn-primary dropdown-item" for="mode_images_mobile"></label>
                      </li>
                      <li>
                        <input type="radio" class="btn-check" name="viewradio_mobile" autocomplete="off" id="mode_observer_mobile">
                        <label id="mode_observer_mobile_label" class="btn btn-primary dropdown-item" for="mode_observer_mobile"></label>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div class="col p-1">
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
                      <div class="row d-flex justify-content-between align-items-center">
                        <div class="col-auto settings-label" id="rayDensity_mobile_text"></div>
                        <div class="col-auto d-flex align-items-center">
                          <button class="btn range-minus-btn" id="rayDensityMinus_mobile">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-dash" viewBox="0 0 16 16">
                              <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>
                            </svg>
                          </button>
                          <input type="range" class="form-range toolbar-range" min="-3" max="3" step="0.0001" value="-2.3026" id="rayDensity_mobile">
                          <button class="btn range-plus-btn" id="rayDensityPlus_mobile">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus" viewBox="0 0 16 16">
                              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                            </svg>
                          </button>
                        </div>
                      </div>

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
  </div>
  <div id="obj_bar" class="obj-bar" style="display: none;">
    <span class="d-none d-lg-inline" id="obj_name"></span><span id="obj_bar_main">
    </span>
    <span>
      <nobr>
        <span class="d-none d-lg-inline">
          <span id="showAdvanced"></span>
          <span id="apply_to_all_box">
            <input type="checkbox" class="btn-check" id="apply_to_all" autocomplete="off">
            <label id="apply_to_all_label" class="btn btn-outline-secondary" for="apply_to_all">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="m11.5 11.932a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-2.45 1a2.5 2.5 0 0 1 4.9 0h2.05v1h-2.05a2.5 2.5 0 0 1-4.9 0h-9.05v-1z"/>
                <path d="m11.5 1.1864a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-2.45 1a2.5 2.5 0 0 1 4.9 0h2.05v1h-2.05a2.5 2.5 0 0 1-4.9 0h-9.05v-1z"/>
                <path d="m10.049 6.3809v3.1367h1v-3.1367z"/>
                <path d="m11.82 6.3809v3.1367h1v-3.1367z"/>
              </svg>
            </label>
          </span>
          <button class="btn" id="copy">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 9.766 9.766">
              <g transform="matrix(.01973 0 0 .01973 .0020532 .061476)">
                <path d="m314.25 85.4h-227c-21.3 0-38.6 17.3-38.6 38.6v325.7c0 21.3 17.3 38.6 38.6 38.6h227c21.3 0 38.6-17.3 38.6-38.6v-325.7c-0.1-21.3-17.4-38.6-38.6-38.6zm11.5 364.2c0 6.4-5.2 11.6-11.6 11.6h-227c-6.4 0-11.6-5.2-11.6-11.6v-325.6c0-6.4 5.2-11.6 11.6-11.6h227c6.4 0 11.6 5.2 11.6 11.6z"/>
                <path d="m401.05 0h-227c-21.3 0-38.6 17.3-38.6 38.6 0 7.5 6 13.5 13.5 13.5s13.5-6 13.5-13.5c0-6.4 5.2-11.6 11.6-11.6h227c6.4 0 11.6 5.2 11.6 11.6v325.7c0 6.4-5.2 11.6-11.6 11.6-7.5 0-13.5 6-13.5 13.5s6 13.5 13.5 13.5c21.3 0 38.6-17.3 38.6-38.6v-325.7c0-21.3-17.3-38.6-38.6-38.6z"/>
              </g>
            </svg>
          </button>
          <button class="btn" id="delete">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16">
              <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/>
            </svg>
          </button>
          <button class="btn" id="unselect" data-bs-placement="bottom">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x" viewBox="0 0 16 16">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </span>
        
        <span class="d-inline d-lg-none">
          <button class="btn shadow-none" type="button" data-bs-toggle="dropdown" aria-expanded="false" id="selectedToolDropdownMobile" style="color:white; padding-left:0px;padding-right:5px">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-three-dots" viewBox="0 0 16 16">
              <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
            </svg>
          </button>
          <ul class="dropdown-menu" aria-labelledby="selectedToolDropdownMobile">
            <li id="showAdvanced_mobile_container" style="display: none">
              <button class="dropdown-item" id="showAdvanced_mobile"></button>
            </li>
            <li id="apply_to_all_mobile_container" style="display: none">
              <input type="checkbox" class="btn-check" autocomplete="off" id="apply_to_all_mobile" checked>
              <label id="apply_to_all_mobile_label" class="dropdown-item" for="apply_to_all_mobile"></label>
            </li>
            <li><button class="dropdown-item" id="copy_mobile"></button></li>
            <li><button class="dropdown-item" id="delete_mobile"></button></li>
            <li><button class="dropdown-item" id="unselect_mobile"></button></li>
          </ul>
        </span>
      </nobr>
    </span>
  </div>

  <!-- Coordinates entering popup -->
  <input type="text" id="xybox" style="display:none;" value="">

  <!-- Footer buttons -->
  <div class="footer-right" id="footer-right" style="display: none">
    <a class="btn" href="https://phydemo.app/ray-optics/" target="_blank" id="home">
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
        <div id="help_popover_text"></div>
        <hr class="dropdown-divider">
        <b><a href="https://phydemo.app/ray-optics/about" target="_blank" id="about"></a></b>
      </div>
    </div>

    <a id="github" class="btn" href="https://github.com/ricktu288/ray-optics" target="_blank">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-github" viewBox="0 0 16 16">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
      </svg>
    </a>
  </div>
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

.toolbar-range {
  width: 100px;
  padding-top: 3px;
}

.toolbar-range::-webkit-slider-thumb {
  background: gray;
  border: 2px solid darkgray;
}

.toolbar-range::-moz-range-thumb {
  background: rgb(96, 96, 96);
  border: 2px solid gray;
}

.toolbar-range::-webkit-slider-runnable-track {
  background: rgba(128,128,128,0.5);
}

.toolbar-range::-moz-range-track {
  background-color: rgba(128,128,128,0.5);
}

.range-minus-btn {
  padding-left: 0px;
  padding-right: 7px;
}

.range-plus-btn {
  padding-left: 7px;
  padding-right: 0px;
}

.settings-number {
  background-color: transparent;
  border: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.5);
  width: 40px;
  text-align: center;
}

.settings-label {
  padding-right: 0px;
}

#more-options-dropdown {
  width:350px;
  max-height: 80vh;
  overflow-y: auto;
}

#advanced-help {
  font-size: 9pt;
}


#mobile-dropdown-options .container {
  max-height: 75vh;
  overflow-y: auto;
}

#mobile-dropdown-options .row {
  padding-top: 3px;
  padding-bottom: 3px;
}

#mobile-dropdown-options .form-check-input {
  height: 1.2em;
  width: 2.4em;
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

.saveBox {
  text-align: center;
  position:absolute;
  top: calc(50% - 40px);
  z-index:0;
}

#xybox {
  background-color:rgba(0,0,0,0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  color:white;
  position:absolute;
  border:none;
}

#status {
  color: gray;
  background-color:rgba(0,0,0,0.7);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border-top-right-radius: 0.5em;
  width: fit-content;
  pointer-events: auto;
}

#warning {
  color: black;
  font-family: monospace;
  padding-right: 0.5em;
  background-color:rgb(255,255,0,0.8);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border-top-right-radius: 0.5em;
  pointer-events: auto;
}

#error {
  color: white;
  font-family: monospace;
  padding-right: 0.5em;
  background-color:rgba(255,0,0,0.7);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  border-top-right-radius: 0.5em;
  pointer-events: auto;
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