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

import escapeHtml from 'escape-html'

/** Mantissa decimal places as shown by Number#toString (handles scientific notation). */
function tooltipMantissaDecimalPlaces(n) {
  const s = n.toString().toLowerCase()
  const eIdx = s.indexOf('e')
  const mantissa = eIdx >= 0 ? s.slice(0, eIdx) : s
  const dot = mantissa.indexOf('.')
  return dot < 0 ? 0 : mantissa.length - dot - 1
}

/** If the value shows 4+ digits after the decimal point, round for display to 3 places. */
function formatTooltipNumber(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    return String(n)
  }
  if (tooltipMantissaDecimalPlaces(n) < 4) {
    return String(n)
  }
  const rounded = Math.round(n * 1000) / 1000
  let t = rounded.toFixed(3)
  if (t.includes('.')) {
    t = t.replace(/0+$/, '').replace(/\.$/, '')
  }
  return t
}

export function formatExpandedInstanceValue(v) {
  if (v === undefined || v === null) {
    return '—'
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return formatTooltipNumber(v)
  }
  if (typeof v === 'boolean') {
    return v ? 'true' : 'false'
  }
  if (typeof v === 'string') {
    return v
  }
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

/** Equality for tooltip collapse; uses raw values (not rounded / not display-truncated). */
function tooltipValueEqualForCollapse(x, y) {
  if (Object.is(x, y)) return true
  if (typeof x !== typeof y) return false
  if (x === null || y === null) return x === y
  if (typeof x !== 'object') return false
  if (Array.isArray(x) && Array.isArray(y)) {
    if (x.length !== y.length) return false
    for (let i = 0; i < x.length; i++) {
      if (!tooltipValueEqualForCollapse(x[i], y[i])) return false
    }
    return true
  }
  if (Array.isArray(x) || Array.isArray(y)) return false
  try {
    return JSON.stringify(x) === JSON.stringify(y)
  } catch {
    return false
  }
}

/** One expansion row as a tuple (e.g. point x,y); whole tuple must match to collapse. */
function tooltipPointTupleEqual(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!tooltipValueEqualForCollapse(a[i], b[i])) return false
  }
  return true
}

export function tooltipTupleAllCellsMissing(tuple) {
  return tuple.every((cell) => cell === undefined || cell === null)
}

/** True if every collected tuple row equals row 0 (raw values). */
function tooltipAllTupleRowsConstant(rows) {
  if (rows.length <= 1) return true
  const first = rows[0]
  for (let j = 1; j < rows.length; j++) {
    if (!tooltipPointTupleEqual(first, rows[j])) {
      return false
    }
  }
  return true
}

/** Single JS-style numeric token (no thousands separators). */
const LITERAL_NUMERIC_TOKEN =
  /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

/**
 * Max tooltip lines when listing distinct expanded values across instances/rows.
 * When exceeded, shows first (this − 2) value rows, an ellipsis line, then the last row.
 */
const FORMULA_MODULE_TOOLTIP_MAX_LINES = 4

/**
 * True when the field is a plain number or comma-separated list of numbers (literal user input).
 * In that case we skip the expanded-instance tooltip.
 */
export function isLiteralNumericFieldValue(text) {
  if (typeof text !== 'string') {
    return false
  }
  const t = text.trim()
  if (t === '' || t.includes('`')) {
    return false
  }
  const parts = t.split(',')
  for (const p of parts) {
    const s = p.trim()
    if (s === '' || !LITERAL_NUMERIC_TOKEN.test(s)) {
      return false
    }
  }
  return true
}

/**
 * True when the field is the boolean literals `true` or `false` only (after trim).
 */
export function isLiteralBooleanFieldValue(text) {
  if (typeof text !== 'string') {
    return false
  }
  const t = text.trim()
  if (t === '' || t.includes('`')) {
    return false
  }
  return t === 'true' || t === 'false'
}

/**
 * Build Bootstrap tooltip `title` HTML from rows of cell tuples (same shape as FormulaInput).
 * @param {Array<Array<*>>} allRows
 * @returns {string}
 */
export function buildModuleInstanceTooltipHtml(allRows) {
  if (!allRows.length) {
    return ''
  }
  const formatTooltipTupleRow = (tuple) => {
    const parts = tuple.map((cell) =>
      escapeHtml(formatExpandedInstanceValue(cell))
    )
    return parts.join(', ')
  }
  const maxLines = Math.max(3, FORMULA_MODULE_TOOLTIP_MAX_LINES)
  const n = allRows.length
  let lines
  if (n > 1 && tooltipAllTupleRowsConstant(allRows)) {
    lines = ['=' + formatTooltipTupleRow(allRows[0])]
  } else if (n <= maxLines) {
    lines = [
      '=' + formatTooltipTupleRow(allRows[0]),
      ...allRows.slice(1).map((row) => '&nbsp;' + formatTooltipTupleRow(row))
    ]
  } else {
    const headLen = maxLines - 2
    const head = allRows.slice(0, headLen)
    const last = allRows[n - 1]
    lines = [
      '=' + formatTooltipTupleRow(head[0]),
      ...head.slice(1).map((row) => '&nbsp;' + formatTooltipTupleRow(row)),
      '&nbsp;...',
      '&nbsp;' + formatTooltipTupleRow(last)
    ]
  }
  return lines.join('<br>')
}
