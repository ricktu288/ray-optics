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
  <div class="scene-obj-list-item-content">
    <input
      class="scene-obj-list-item-name-input"
      type="text"
      :value="nameValue"
      :placeholder="$t('simulator:sidebar.objectList.unnamedObject')"
      @input="onNameInput"
      @blur="commitName"
      @keydown.enter.prevent="commitAndBlur"
      @keydown.stop
    >
    <div class="scene-obj-list-item-type">{{ objType }}</div>
  </div>
</template>

<script>
import { app } from '../../services/app'

export default {
  name: 'SceneObjListItemContent',
  props: {
    obj: {
      type: Object,
      required: true
    },
    index: {
      type: Number,
      required: true
    }
  },
  computed: {
    objType() {
      return this.obj?.constructor?.type || this.$t('simulator:sidebar.objectList.unknownType')
    },
    nameValue() {
      return this.obj?.name || ''
    }
  },
  methods: {
    onNameInput(event) {
      if (this.obj) {
        this.obj.name = event.target.value
      }
    },
    commitName() {
      app.editor?.onActionComplete()
    },
    commitAndBlur(event) {
      this.commitName()
      event.target.blur()
    }
  }
}
</script>

<style scoped>
.scene-obj-list-item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  width: 100%;
}

.scene-obj-list-item-name-input {
  background: transparent;
  border: none;
  border-radius: 0;
  color: rgba(255, 255, 255, 0.92);
  font-weight: 600;
  font-size: 12px;
  line-height: 1.2;
  padding: 0;
  width: 100%;
  min-width: 0;
  transition: color 120ms ease;
}

.scene-obj-list-item-name-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.scene-obj-list-item-name-input:focus {
  outline: none;
}

.scene-obj-list-item-type {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.92);
}
</style>
