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
  <div id="canvas-container" style="display:none">
    <canvas id="canvasGrid"></canvas>
    <canvas id="canvasBelowLight"></canvas>
    <canvas id="canvasLight" v-show="colorMode === 'default'"></canvas>
    <canvas id="canvasLightWebGL" v-show="colorMode !== 'default'"></canvas>
    <canvas id="canvasAboveLight"></canvas>
  </div>
</template>

<script>
/**
 * @module CanvasContainer
 * @description The Vue component for the container for the canvas layers. Rendering is done by the {@link Simulator} class (see there for the meaning of each canvas layer). Mouse events are only captured by the top-layered `canvasAboveLight` canvas, and is handled by the {@link Editor} class.
 */
import { ref, onMounted } from 'vue'
import { useSceneStore } from '../store/scene'

export default {
  name: 'CanvasContainer',
  setup() {
    const store = useSceneStore()
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
      store.setViewportSize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    }

    onMounted(() => {
      window.addEventListener('resize', onResize);
      onResize();
    });

    return {
      colorMode: store.colorMode,
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
</style>