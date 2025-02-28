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
  <template v-if="layout === 'desktop'">
    <div class="dropdown">
      <button 
        class="btn shadow-none btn-primary dropdown-toggle" 
        type="button" 
        :id="id + 'ToolsDropdown'" 
        data-bs-toggle="dropdown" 
        aria-expanded="false"
      >{{ title }}</button>
      <ul class="dropdown-menu" :aria-labelledby="id + 'ToolsDropdown'">
        <slot></slot>
      </ul>
    </div>
  </template>

  <template v-if="layout === 'mobile'">
    <ul :id="'mobile-dropdown-' + id" style="display:none">
      <slot></slot>
    </ul>
  </template>
</template>

<script>
/**
 * @module ToolsCategory
 * @description The Vue component for a category in the list of tools in the toolbar. The actual tools are in the `slot` of the component.
 * @vue-prop {String} id - The ID of the category.
 * @vue-prop {String} title - The title of the category.
 * @vue-prop {String} layout - The layout of the toolbar. Can be 'mobile' or 'desktop'.
 */
export default {
  name: 'ToolsCategory',
  props: {
    id: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    layout: {
      type: String,
      required: true
    }
  }
}
</script>
