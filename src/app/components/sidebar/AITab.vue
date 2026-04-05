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
  <div class="ai-tab" role="region" :aria-label="$t('simulator:sidebar.ai.title')">
    <h2 class="ai-tab-title">{{ $t('simulator:sidebar.ai.title') }}</h2>
    <p class="ai-tab-p" v-html="descriptionHtml"></p>
    <p class="ai-tab-p" v-html="limitationHtml"></p>
    <p class="ai-tab-p" v-html="otherServicesHtml"></p>
  </div>
</template>

<script>
import { computed } from 'vue'
import i18next from 'i18next'
import { parseLinks } from '../../utils/links.js'

export default {
  name: 'AITab',
  setup() {
    const descriptionHtml = computed(() =>
      parseLinks(i18next.t('simulator:sidebar.ai.description'))
    )
    const limitationHtml = computed(() =>
      parseLinks(i18next.t('simulator:sidebar.ai.limitation'))
    )
    const otherServicesHtml = computed(() =>
      parseLinks(i18next.t('simulator:sidebar.ai.otherServices'))
    )

    return {
      descriptionHtml,
      limitationHtml,
      otherServicesHtml
    }
  }
}
</script>

<style scoped>
.ai-tab {
  position: absolute;
  inset: 0;
  overflow: auto;
  padding: 12px;
  -webkit-overflow-scrolling: touch;
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
  line-height: 1.45;
}

.ai-tab-title {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
}

.ai-tab-p {
  margin: 0 0 10px 0;
}

.ai-tab-p:last-child {
  margin-bottom: 0;
}

/* Sidebar contrast; link decoration is global (underline on hover / :focus-visible). */
.ai-tab :deep(a) {
  color: #8ec5ff;
}

.ai-tab :deep(a:hover),
.ai-tab :deep(a:focus-visible) {
  color: #b8d9ff;
}
</style>
