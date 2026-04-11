/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import escapeHtml from 'escape-html'

/** Inner length (between `{` and `}`) above which we collapse the segment in the UI. */
export const JSON_INNER_COLLAPSE_THRESHOLD = 48

/**
 * HTML ignores newline characters in text; convert them to line breaks for status display.
 * @param {string} html
 * @returns {string}
 */
function newlinesToBr(html) {
  return html.replace(/\r\n|\r|\n/g, '<br>')
}

/**
 * Index of the matching `}` for `{` at openIdx, or -1. Ignores `{` / `}` inside JSON strings.
 * @param {string} s
 * @param {number} openIdx
 * @returns {number}
 */
export function findMatchingBraceEnd(s, openIdx) {
  if (openIdx < 0 || openIdx >= s.length || s[openIdx] !== '{') return -1
  let depth = 1
  let inString = false
  let i = openIdx + 1
  while (i < s.length) {
    const c = s[i]
    if (inString) {
      if (c === '\\') {
        i++
        if (i >= s.length) return -1
        if (s[i] === 'u') {
          i++
          for (let k = 0; k < 4; k++) {
            if (i >= s.length) return -1
            if (!/[0-9a-fA-F]/.test(s[i])) return -1
            i++
          }
          continue
        }
        i++
        continue
      }
      if (c === '"') {
        inString = false
      }
      i++
      continue
    }
    if (c === '"') {
      inString = true
      i++
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

/**
 * Non-overlapping `{ ... }` spans that parse as JSON.
 * @param {string} line
 * @returns {{ start: number, end: number, json: string }[]}
 */
export function findValidJsonObjectSpans(line) {
  const spans = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '{') {
      const end = findMatchingBraceEnd(line, i)
      if (end === -1) {
        i++
        continue
      }
      const json = line.slice(i, end + 1)
      try {
        JSON.parse(json)
        spans.push({ start: i, end: end, json })
      } catch {
        /* not valid JSON */
      }
      i = end + 1
    } else {
      i++
    }
  }
  return spans
}

const TOGGLE_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" class="status-alert__json-toggle-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 0 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 0 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>'

/**
 * HTML for one status line with long JSON segments collapsed to `{ [icon] }`.
 * @param {string} line
 * @param {object} options
 * @param {Record<string, boolean>} options.expanded
 * @param {string} options.keyPrefix e.g. 'w' or 'e'
 * @param {number} options.lineIdx
 * @param {{ expand: string }} options.labels
 * @param {number} [options.threshold]
 * @returns {string}
 */
export function formatStatusLineHtml(line, options) {
  const {
    expanded,
    keyPrefix,
    lineIdx,
    labels,
    threshold = JSON_INNER_COLLAPSE_THRESHOLD
  } = options

  const spans = findValidJsonObjectSpans(line)
  if (spans.length === 0) {
    return newlinesToBr(escapeHtml(line))
  }

  let out = ''
  let last = 0
  for (let spanIdx = 0; spanIdx < spans.length; spanIdx++) {
    const span = spans[spanIdx]
    out += escapeHtml(line.slice(last, span.start))

    const inner = line.slice(span.start + 1, span.end)
    const key = `${keyPrefix}-${lineIdx}-${spanIdx}`
    const collapsed = inner.length > threshold

    if (!collapsed) {
      out += escapeHtml(span.json)
    } else if (expanded[key]) {
      out += `<span class="status-alert__json-expanded">${escapeHtml(span.json)}</span>`
    } else {
      const tip = escapeHtml(labels.expand)
      out += `{<button type="button" class="status-alert__json-toggle" data-json-key="${escapeHtml(key)}" title="${tip}" aria-label="${tip}" aria-expanded="false">${TOGGLE_ICON_SVG}</button>}`
    }

    last = span.end + 1
  }
  out += escapeHtml(line.slice(last))
  return newlinesToBr(out)
}
