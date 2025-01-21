<!--
 * Copyright 2025 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
-->

<template>
  <span>{{ translatedText }}</span>
</template>

<script>
import i18next from 'i18next';

export default {
  name: 'TranslatedText',
  props: {
    path: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      isI18nInitialized: i18next.isInitialized
    }
  },
  computed: {
    translatedText() {
      if (!this.isI18nInitialized) {
        return '';
      }
      return i18next.t(this.path);
    }
  },
  mounted() {
    if (!this.isI18nInitialized) {
      // If i18next is not initialized, wait for it
      const checkI18n = () => {
        if (i18next.isInitialized) {
          this.isI18nInitialized = true;
        } else {
          setTimeout(checkI18n, 100);
        }
      };
      checkI18n();
    }
  }
}
</script>
