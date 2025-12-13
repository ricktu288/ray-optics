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
  <canvas id="canvasGrid"></canvas>
  <canvas id="canvasBelowLight"></canvas>
  <canvas id="canvasLight" v-show="colorMode === 'default'"></canvas>
  <canvas id="canvasLightWebGL" v-show="colorMode !== 'default'"></canvas>
  <canvas id="canvasAboveLight"></canvas>

  <!-- Coordinates entering popup -->
  <div id="xybox-container" style="display:none;">
    <span 
      class="xybox-info-icon" 
      v-tooltip-popover:popover="{ 
        content: $t('simulator:editor.coordinatesHint'), 
        trigger: 'click',
        placement: 'bottom',
        html: true 
      }"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle" viewBox="0 0 16 16">
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
        <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
      </svg>
    </span>
    <input type="text" id="xybox" value="">
  </div>

  <!-- Object body hint popup (triggered on double-click/right-click on object body) -->
  <span id="object-body-hint-anchor" style="display:none;"></span>
</template>

<script>
/**
 * @module CanvasContainer
 * @description The Vue component for the container for the canvas layers and the coordinates entering popup. Rendering is done by the {@link Simulator} class (see there for the meaning of each canvas layer). Mouse events are only captured by the top-layered `canvasAboveLight` canvas, and is handled by the {@link Editor} class.
 */
import { ref, onMounted } from 'vue'
import { useSceneStore } from '../store/scene'
import { vTooltipPopover } from '../directives/tooltip-popover'

export default {
  name: 'CanvasContainer',
  directives: {
    'tooltip-popover': vTooltipPopover
  },
  setup() {
    const sceneStore = useSceneStore()
    function resizeCanvas(canvas) {
      canvas.width = window.innerWidth * (window.devicePixelRatio || 1);
      canvas.height = window.innerHeight * (window.devicePixelRatio || 1);
    }

    function onResize() {
      resizeCanvas(document.getElementById('canvasGrid'));
      resizeCanvas(document.getElementById('canvasBelowLight'));
      resizeCanvas(document.getElementById('canvasLight'));
      resizeCanvas(document.getElementById('canvasLightWebGL'));
      resizeCanvas(document.getElementById('canvasAboveLight'));
      sceneStore.setViewportSize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    }

    onMounted(() => {
      window.addEventListener('resize', onResize);
      onResize();
    });

    return {
      colorMode: sceneStore.colorMode,
    };
  },
};
</script>

<style scoped>
#canvasBelowLight {
  background-color: #000;
  position: absolute;
  width: 100%;
  height: 100%;
  margin: 0;
  z-index: -7;
}

#canvasGrid {
  background-color: transparent;
  position: absolute;
  width: 100%;
  height: 100%;
  margin: 0;
  z-index: -6;
}

#canvasLight {
  background-color: transparent;
  position: absolute;
  width: 100%;
  height: 100%;
  margin: 0;
  z-index: -5;
}

#canvasLightWebGL {
  background-color: transparent;
  position: absolute;
  width: 100%;
  height: 100%;
  margin: 0;
  z-index: -5;
}

#canvasAboveLight {
  background-color: transparent;
  position: absolute;
  width: 100%;
  height: 100%;
  margin: 0;
  z-index: -4;
}

#xybox-container {
  position: absolute;
}

#xybox {
  background-color:rgba(0,0,0,0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  color:white;
  border:none;
}

.xybox-info-icon {
  position: absolute;
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-right: 4px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  padding: 2px;
  border-radius: 3px;
}

.xybox-info-icon:hover {
  color: rgba(255, 255, 255, 1);
}

#object-body-hint-anchor {
  position: absolute;
  width: 40px;
  height: 40px;
  transform: translate(-50%, -50%);
  user-select: none;
}

</style>