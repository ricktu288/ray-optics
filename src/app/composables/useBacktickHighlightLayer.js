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

import { computed } from 'vue'
import { buildBacktickHighlightHtml } from '../utils/backtickHighlightHtml.js'

/**
 * Backtick math-block overlay for a textarea (pair with a highlight layer + shared CSS).
 * All backtick blocks in the text are always highlighted.
 *
 * @param {function(): string} getText
 */
export function useBacktickHighlightLayer(getText) {
  const highlightLayerHtml = computed(() => buildBacktickHighlightHtml(getText()))

  return { highlightLayerHtml }
}
