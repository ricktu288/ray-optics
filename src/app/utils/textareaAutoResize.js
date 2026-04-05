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

import { nextTick } from 'vue'

/**
 * Whether the element participates in layout in a way that yields a real scrollHeight
 * (not e.g. `display: none` under a hidden sidebar tab).
 */
export function isTextareaAutoResizeMeasurable(el) {
  if (!el || typeof el.getClientRects !== 'function') {
    return false
  }
  return el.getClientRects().length > 0
}

/**
 * Sets textarea height from content. Returns false if skipped (hidden / not measurable);
 * does not write a zero height in that case.
 */
export function applyTextareaAutoResize(el) {
  if (!isTextareaAutoResizeMeasurable(el)) {
    return false
  }
  el.style.height = 'auto'
  const sh = el.scrollHeight
  if (!sh) {
    return false
  }
  el.style.height = `${sh}px`
  return true
}

/**
 * When a textarea lives under tabs / `v-show` / sidebar chrome, it can become visible after
 * `sidebarWidth` updates while hidden. Observe intersection and re-measure when shown.
 * @param {Function} getElements - Returns textareas to observe (may include null/undefined entries).
 * @param {Function} resizeAll - Re-measure all linked textareas.
 * @returns {Object} `{ disconnect }` — call `disconnect()` to stop observing.
 */
export function observeTextareasResizeWhenVisible(getElements, resizeAll) {
  if (typeof IntersectionObserver === 'undefined') {
    return { disconnect: () => {} }
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        nextTick(resizeAll)
      }
    },
    { threshold: 0 }
  )
  for (const el of getElements()) {
    if (el) {
      io.observe(el)
    }
  }
  return {
    disconnect: () => io.disconnect()
  }
}
