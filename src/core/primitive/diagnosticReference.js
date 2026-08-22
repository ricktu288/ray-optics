/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

/**
 * Unicode diagnostic delimiters keep references distinct from JSON, i18next
 * interpolation, HTML, and the Markdown-like link syntax used by the app.
 * The short `pc` type tag keeps raw console/integration warnings readable.
 */
export const PRIMITIVE_CURVE_REFERENCE_PREFIX = '⟦pc:'
export const PRIMITIVE_CURVE_REFERENCE_SUFFIX = '⟧'

/**
 * Format a processed primitive curve ID for detection by diagnostic UIs.
 *
 * @param {number} curveId
 * @returns {string}
 */
export function formatPrimitiveCurveReference(curveId) {
  if (!Number.isSafeInteger(curveId) || curveId < 0) {
    throw new TypeError(`Invalid primitive curve ID: ${curveId}`)
  }
  return `${PRIMITIVE_CURVE_REFERENCE_PREFIX}${curveId}${PRIMITIVE_CURVE_REFERENCE_SUFFIX}`
}

/**
 * Find namespaced primitive-curve references in a diagnostic message.
 *
 * @param {string} message
 * @returns {Array<{start: number, end: number, curveId: number, reference: string}>}
 */
export function findPrimitiveCurveReferenceSpans(message) {
  const spans = []
  let searchStart = 0
  while (searchStart < message.length) {
    const start = message.indexOf(
      PRIMITIVE_CURVE_REFERENCE_PREFIX,
      searchStart
    )
    if (start === -1) break

    const idStart = start + PRIMITIVE_CURVE_REFERENCE_PREFIX.length
    const suffixStart = message.indexOf(
      PRIMITIVE_CURVE_REFERENCE_SUFFIX,
      idStart
    )
    if (suffixStart === -1) break

    const idText = message.slice(idStart, suffixStart)
    const curveId = Number(idText)
    const isCanonicalId =
      /^(0|[1-9]\d*)$/.test(idText) &&
      Number.isSafeInteger(curveId)
    if (isCanonicalId) {
      spans.push({
        start,
        end: suffixStart,
        curveId,
        reference: message.slice(start, suffixStart + 1)
      })
      searchStart = suffixStart + 1
    } else {
      // Resume after this prefix so malformed text cannot hide a later valid
      // reference which happens to precede its closing delimiter.
      searchStart = idStart
    }
  }
  return spans
}
