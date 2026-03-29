<!--
  Copyright 2026 The Ray Optics Simulation authors and contributors

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
  <span v-if="message" class="property-control-error">{{ message }}</span>
</template>

<script>
export default {
  name: 'PropertyControlError',
  props: {
    message: {
      type: String,
      default: ''
    }
  }
}
</script>

<style scoped>
.property-control-error {
  width: 100%;
  font-size: 10px;
  line-height: 1.3;
  color: rgba(255, 140, 140, 0.9);
  word-break: break-word;
}
</style>
