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
  <li v-if="layout === 'desktop'" id="module_start"><button class="dropdown-item" type="button" id="import_modules" data-bs-toggle="modal" data-bs-target="#moduleModal"></button></li>
  <li v-if="layout === 'mobile'" id="module_start_mobile"><button class="dropdown-item" type="button" id="import_modules_mobile" data-bs-toggle="modal" data-bs-target="#moduleModal"></button></li>
</template>

<script>
export default {
  name: 'ModuleTools',
  props: {
    layout: String
  }
}
</script>