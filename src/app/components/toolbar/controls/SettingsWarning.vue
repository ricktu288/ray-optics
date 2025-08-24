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
  <div 
    class="settings-warning alert alert-warning py-1 mt-1" 
    :style="{
      alignItems: 'center',
      fontSize: '0.875rem',
      paddingLeft: '10px',
      width: '300px',
      marginLeft: 'auto',
      marginRight: 'auto'
    }"
  >
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="14" 
      height="14" 
      fill="currentColor" 
      class="bi bi-info-circle" 
      viewBox="0 0 16 16" 
      style="flex-shrink: 0"
    >
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
      <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
    </svg>
    <span style="margin-left: 6px; flex: 1">
      <slot></slot>
    </span>
  </div>
</template>

<script>
/**
 * @module SettingsWarning
 * @description The vue component for the warning message in the settings dropdown.
 * @vue-prop {String} layout - The layout of the control. Can be 'mobile' or 'desktop'.
 */
export default {
  name: 'SettingsWarning',
  props: {
    layout: {
      type: String,
      default: 'desktop'
    }
  }
}
</script>
