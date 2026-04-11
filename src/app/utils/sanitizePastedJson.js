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

/**
 * Remove leading markdown fence (e.g. ```json) and trailing ``` from AI-style pastes.
 * @param {string} text
 * @returns {string}
 */
export function stripMarkdownCodeFence(text) {
  let s = text.trim()
  if (!s.startsWith('```')) return text

  let i = 3
  while (i < s.length && /[a-zA-Z0-9_-]/.test(s[i])) i++
  while (i < s.length && /\s/.test(s[i])) {
    const ch = s[i]
    i++
    if (ch === '\n' || (ch === '\r' && s[i] === '\n')) {
      if (ch === '\r' && s[i] === '\n') i++
      break
    }
  }

  s = s.slice(i)
  s = s.replace(/\s*```\s*$/, '')
  return s.trim()
}

/**
 * Strip // and /* *\/ comments from pasted text while respecting string literals.
 * `://` is not treated as a line comment (e.g. http://).
 * @param {string} text
 * @returns {string}
 */
export function stripJsonComments(text) {
  let result = ''
  let i = 0
  let inString = false
  let stringQuote = ''
  let escape = false

  while (i < text.length) {
    const c = text[i]

    if (inString) {
      result += c
      if (escape) {
        escape = false
      } else if (c === '\\') {
        escape = true
      } else if (c === stringQuote) {
        inString = false
        stringQuote = ''
      }
      i++
      continue
    }

    if (c === '"' || c === "'") {
      inString = true
      stringQuote = c
      result += c
      i++
      continue
    }

    if (c === '/' && text[i + 1] === '*') {
      i += 2
      while (i < text.length - 1) {
        if (text[i] === '*' && text[i + 1] === '/') {
          i += 2
          break
        }
        i++
      }
      continue
    }

    if (c === '/' && text[i + 1] === '/') {
      if (i > 0 && text[i - 1] === ':') {
        result += '/'
        i++
        continue
      }
      i += 2
      while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i++
      continue
    }

    result += c
    i++
  }

  return result
}

/**
 * Prepare clipboard text for the scene JSON editor (fences + comments).
 * @param {string} text
 * @returns {string}
 */
export function sanitizePastedJson(text) {
  if (text == null || text === '') return text
  const unfenced = stripMarkdownCodeFence(text)
  return stripJsonComments(unfenced)
}
