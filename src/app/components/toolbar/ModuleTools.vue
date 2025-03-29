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
  <li :id="'module_start' + (layout === 'mobile' ? '_mobile' : '')">
    <button class="dropdown-item" type="button" :id="'import_modules' + (layout === 'mobile' ? '_mobile' : '')" data-bs-toggle="modal" data-bs-target="#moduleModal">
      <i>{{ $t('main:tools.modules.import') }}</i>
    </button>
  </li>
  <template v-for="moduleName in moduleNames" :key="moduleName">
    <li>
      <input 
        type="radio" 
        class="btn-check" 
        :name="'toolsradio' + (layout === 'mobile' ? '_mobile' : '')" 
        :id="'moduleTool_' + moduleName + (layout === 'mobile' ? '_mobile' : '')"
        autocomplete="off"
        @change="onModuleSelect(moduleName, $event)"
      >
      <label 
        class="btn shadow-none btn-primary dropdown-item d-flex w-100" 
        :for="'moduleTool_' + moduleName + (layout === 'mobile' ? '_mobile' : '')"
      >
        <div class="col" style="font-family: monospace;">{{ moduleName }}</div>
        <div class="col text-end">
          <button class="btn" style="color: gray; padding: 0px; font-size: 10px;" @click="removeModule(moduleName)">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="-4 0 16 20">
              <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5ZM11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H2.506a.58.58 0 0 0-.01 0H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1h-.995a.59.59 0 0 0-.01 0H11Zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5h9.916Zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47ZM8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5Z"/>
            </svg>
          </button>
        </div>
      </label>
    </li>
  </template>
</template>

<script>
import { useSceneStore } from '../../store/scene'
import { computed, toRef } from 'vue'
import { app } from '../../services/app.js'

export default {
  name: 'ModuleTools',
  props: {
    layout: String
  },
  setup() {
    const scene = useSceneStore()
    const moduleIds = toRef(scene, 'moduleIds')

    // Compute module names from scene's moduleIds
    const moduleNames = computed(() => {
      return moduleIds.value ? moduleIds.value.split(',') : []
    })

    // Handle module selection
    const onModuleSelect = (moduleName, event) => {
      if (event.target.checked) {
        app.resetDropdownButtons?.()
        document.getElementById('otherToolsDropdown')?.classList.add('selected')
        document.getElementById('mobile-dropdown-trigger-other')?.classList.add('selected')
        app.hideWelcome()
        app.editor.addingObjType = 'ModuleObj'
        app.editor.addingModuleName = moduleName
      }
    }

    // Handle module removal
    const handleRemoveModule = (moduleName) => {
      scene.removeModule(moduleName)
      app.editor.addingObjType = ''
    }

    return {
      moduleNames,
      onModuleSelect,
      removeModule: handleRemoveModule
    }
  }
}
</script>