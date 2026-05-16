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

/** Class name for v-html mirror spans; style with `:deep(.paren-highlight-match)` in the host. */
export const PAREN_HIGHLIGHT_MATCH_CLASS = 'paren-highlight-match'

const PAREN_OPEN = { '(': ')', '[': ']', '{': '}' }
const PAREN_CLOSE = { ')': '(', ']': '[', '}': '{' }

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function matchParenForward(text, start, openCh, closeCh) {
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (c === openCh) depth++
    else if (c === closeCh) {
      depth--
      if (depth === 0) return [start, i]
    }
  }
  return null
}

function matchParenBackward(text, start, closeCh, openCh) {
  let depth = 0
  for (let i = start; i >= 0; i--) {
    const c = text[i]
    if (c === closeCh) depth++
    else if (c === openCh) {
      depth--
      if (depth === 0) return [i, start]
    }
  }
  return null
}

/**
 * @param {string} text
 * @param {number} caret
 * @returns {[number, number] | null} indices of matching pair [open, close] inclusive
 */
export function findMatchingParenPair(text, caret) {
  if (!text || caret < 0) {
    return null
  }
  let idx = -1
  if (caret > 0 && PAREN_CLOSE[text[caret - 1]]) {
    idx = caret - 1
  } else if (caret < text.length && PAREN_OPEN[text[caret]]) {
    idx = caret
  } else if (caret > 0 && PAREN_OPEN[text[caret - 1]]) {
    idx = caret - 1
  }
  if (idx < 0) {
    return null
  }
  const ch = text[idx]
  if (PAREN_OPEN[ch]) {
    return matchParenForward(text, idx, ch, PAREN_OPEN[ch])
  }
  const openCh = PAREN_CLOSE[ch]
  return matchParenBackward(text, idx, ch, openCh)
}

/**
 * Safe HTML for a pre-wrapped highlight layer under a textarea (escape + optional match spans).
 * @param {string|null|undefined} text
 * @param {[number, number]|null} pair
 * @param {string} [matchClass]
 */
export function buildParenHighlightHtml(
  text,
  pair,
  matchClass = PAREN_HIGHLIGHT_MATCH_CLASS
) {
  if (text == null) {
    return ''
  }
  if (!pair) {
    return escapeHtml(text)
  }
  const [openIdx, closeIdx] = pair[0] <= pair[1] ? pair : [pair[1], pair[0]]
  const marked = new Set([openIdx, closeIdx])
  const parts = []
  for (let i = 0; i < text.length; ) {
    if (marked.has(i)) {
      parts.push(
        `<span class="${matchClass}">${escapeHtml(text[i])}</span>`
      )
      i++
    } else {
      let j = i + 1
      while (j < text.length && !marked.has(j)) j++
      parts.push(escapeHtml(text.slice(i, j)))
      i = j
    }
  }
  return parts.join('')
}
