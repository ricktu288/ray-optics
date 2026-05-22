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

/** Class name for v-html mirror spans; style with `:deep(.backtick-highlight-match)` in the host. */
export const BACKTICK_HIGHLIGHT_MATCH_CLASS = 'backtick-highlight-match'

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Ranges [start, end] inclusive for each math block delimited by backticks (`` first, then `).
 * @param {string} text
 * @returns {Array.<Array.<number>>}
 */
export function findMathBlockRanges(text) {
  if (!text) {
    return []
  }
  const ranges = []
  let i = 0
  while (i < text.length) {
    if (text[i] !== '`') {
      i++
      continue
    }
    if (i + 1 < text.length && text[i + 1] === '`') {
      const start = i
      i += 2
      let found = false
      while (i < text.length - 1) {
        if (text[i] === '`' && text[i + 1] === '`') {
          ranges.push([start, i + 1])
          i += 2
          found = true
          break
        }
        i++
      }
      if (!found) {
        ranges.push([start, text.length - 1])
        break
      }
      continue
    }
    const start = i
    i++
    while (i < text.length && text[i] !== '`') {
      i++
    }
    if (i < text.length) {
      ranges.push([start, i])
      i++
    } else {
      ranges.push([start, text.length - 1])
    }
  }
  return ranges
}

/**
 * True when the display string contains backtick-delimited math blocks.
 * @param {string} text
 * @returns {boolean}
 */
export function textHasBacktickBlocks(text) {
  return typeof text === 'string' && text.includes('`')
}

function isInMathBlock(ranges, index) {
  return ranges.some(([start, end]) => index >= start && index <= end)
}

/**
 * Safe HTML for a pre-wrapped highlight layer; all backtick math blocks are highlighted.
 * @param {string|null|undefined} text
 * @param {string} [matchClass]
 */
export function buildBacktickHighlightHtml(
  text,
  matchClass = BACKTICK_HIGHLIGHT_MATCH_CLASS
) {
  if (text == null) {
    return ''
  }
  const ranges = findMathBlockRanges(text)
  if (ranges.length === 0) {
    return escapeHtml(text)
  }
  const parts = []
  for (let i = 0; i < text.length; ) {
    const highlighted = isInMathBlock(ranges, i)
    let j = i + 1
    while (j < text.length && isInMathBlock(ranges, j) === highlighted) {
      j++
    }
    const slice = text.slice(i, j)
    if (highlighted) {
      parts.push(`<span class="${matchClass}">${escapeHtml(slice)}</span>`)
    } else {
      parts.push(escapeHtml(slice))
    }
    i = j
  }
  return parts.join('')
}
