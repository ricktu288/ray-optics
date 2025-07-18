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
  <li>
    <button 
      v-if="!shouldShowMoreTools"
      class="dropdown-item" 
      type="button"
      id="showMoreTools"
      @click.stop="handleShowMoreTools"
    >
      <i>{{ $t('main:tools.moreTools.title') }}</i>
    </button>
    <Transition 
      :name="layout === 'desktop' ? 'more-tools' : ''"
      @after-enter="layout === 'desktop' ? undefined : handleMobileTransition"
      @after-leave="layout === 'desktop' ? undefined : handleMobileTransition"
    >
      <div v-show="shouldShowMoreTools" class="more-tools-container">
        <ul>
          <slot></slot>
        </ul>
      </div>
    </Transition>
  </li>
</template>

<script>
/**
 * @module MoreToolsCollapsible
 * @description A reusable Vue component for collapsible "More Tools..." sections in the toolbar.
 * Accepts content as a slot and handles the expand/collapse logic and mobile dropdown height updates.
 */
import { ref, nextTick, watch } from 'vue'

export default {
  name: 'MoreToolsCollapsible',
  props: {
    layout: {
      type: String,
      required: true
    }
  },
  setup(props) {
    // State for more tools visibility - always collapsed by default
    const shouldShowMoreTools = ref(false)
    
    const handleShowMoreTools = () => {
      shouldShowMoreTools.value = true
    }

    // Function to update mobile dropdown height - calls the same mechanism used in Toolbar.vue
    const updateMobileDropdownHeight = () => {
      // Only run in mobile layout and if the function exists
      if (props.layout === 'mobile' && typeof window !== 'undefined') {
        const list = document.getElementsByClassName('mobile-dropdown-menu');
        let maxScrollHeight = 0;
        for (let ele of list) {
          const inner = ele.children[0];
          if (inner.scrollHeight > maxScrollHeight) {
            maxScrollHeight = inner.scrollHeight;
          }
        }
        for (let ele of list) {
          ele.style.height = maxScrollHeight + 'px';
        }
      }
    }

    // Handle mobile transition - use nextTick to ensure DOM has updated
    const handleMobileTransition = () => {
      nextTick(() => {
        updateMobileDropdownHeight();
      });
    }

    // Watch for changes in shouldShowMoreTools for mobile layout
    if (props.layout === 'mobile') {
      watch(shouldShowMoreTools, () => {
        nextTick(() => {
          updateMobileDropdownHeight();
        });
      });
    }

    return {
      shouldShowMoreTools,
      handleShowMoreTools,
      updateMobileDropdownHeight,
      handleMobileTransition,
      layout: props.layout
    }
  }
}
</script>

<style scoped>
.more-tools-container {
  overflow: hidden;
}

.more-tools-container > ul {
  list-style-type: none;
  padding-left: 0;
  margin: 0;
}

/* More tools transition animations */
.more-tools-enter-active {
  transition: max-height 0.3s ease-out;
}

.more-tools-leave-active {
  transition: max-height 0.3s ease-in;
}

.more-tools-enter-from {
  max-height: 0;
}

.more-tools-leave-to {
  max-height: 0;
}

.more-tools-enter-to,
.more-tools-leave-from {
  max-height: 200px;
}
</style> 