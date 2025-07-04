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
  <div id="welcome-wrapper-vue"></div>
</template>

<script>
/**
 * @module WelcomeMessage
 * @description The Vue component for the wrapper of the welcome message after the page is loaded. The original welcome message (which is loaded inline from index.html) is moved into this component.
 */
import { onMounted, computed, watchEffect } from 'vue'
import { useThemeStore } from '../store/theme'

export default {
  setup() {
    const themeStore = useThemeStore()

    // Computed style for welcome message text color
    const welcomeTextColor = computed(() => {
      const isLight = themeStore.backgroundIsLight.value
      // Use black text for light themes, white text for dark themes
      return isLight ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)'
    })

    onMounted(() => {
      // Move the welcome message (which is loaded inline from index.html) to the Vue component
      document.getElementById('welcome-wrapper-vue').appendChild(document.getElementById('welcome-wrapper'));
      
      // Apply initial theme-based styling
      const welcomeElement = document.getElementById('welcome')
      if (welcomeElement) {
        welcomeElement.style.color = welcomeTextColor.value
      }
    })

    // Watch for theme changes and update text color
    watchEffect(() => {
      const welcomeElement = document.getElementById('welcome')
      if (welcomeElement) {
        welcomeElement.style.color = welcomeTextColor.value
      }
    })
  },
  name: 'WelcomeMessage'
}
</script>