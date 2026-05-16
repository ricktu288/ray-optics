/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
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
 */

import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  findMatchingParenPair,
  buildParenHighlightHtml
} from '../utils/parenHighlightHtml.js'

/**
 * Matching-parenthesis overlay for a textarea (pair with a highlight layer + shared CSS).
 *
 * @param {() => HTMLTextAreaElement | null | undefined} getTextareaRef
 * @param {() => string} getText
 * @param {() => boolean} isFieldActive — e.g. the field is focused
 */
export function useParenHighlightLayer(getTextareaRef, getText, isFieldActive) {
  const parenMatchPair = ref(null)

  const highlightLayerHtml = computed(() =>
    buildParenHighlightHtml(getText(), parenMatchPair.value)
  )

  const updateParenHighlight = () => {
    const el = getTextareaRef()
    if (!el || !isFieldActive()) {
      parenMatchPair.value = null
      return
    }
    const caret = el.selectionStart ?? 0
    parenMatchPair.value = findMatchingParenPair(getText(), caret)
  }

  const clearParenHighlight = () => {
    parenMatchPair.value = null
  }

  const onDocumentSelectionChange = () => {
    if (document.activeElement === getTextareaRef()) {
      updateParenHighlight()
    }
  }

  onMounted(() => {
    document.addEventListener('selectionchange', onDocumentSelectionChange)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('selectionchange', onDocumentSelectionChange)
  })

  return {
    highlightLayerHtml,
    updateParenHighlight,
    clearParenHighlight
  }
}
