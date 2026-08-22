/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import {
  findPrimitiveCurveReferenceSpans,
  formatPrimitiveCurveReference
} from '../../src/core/primitive/diagnosticReference'
import { formatStatusLineHtml } from
  '../../src/app/utils/compactJsonInStatusMessage'

describe('primitive diagnostic references', () => {
  it('uses a compact syntax distinct from JSON and i18next interpolation', () => {
    expect(formatPrimitiveCurveReference(42)).toBe(
      '⟦pc:42⟧'
    )
    expect(() => formatPrimitiveCurveReference(-1)).toThrow(TypeError)
  })

  it('only detects canonical non-negative safe-integer curve IDs', () => {
    const message = [
      '⟦pc:0⟧',
      '⟦pc:07⟧',
      '⟦pc:-1⟧',
      '⟦pc:12⟧'
    ].join(' ')

    expect(findPrimitiveCurveReferenceSpans(message).map(span => span.curveId))
      .toEqual([0, 12])
  })

  it('lets malformed text coexist with a later valid reference', () => {
    const message =
      '⟦pc:not-an-id ' +
      formatPrimitiveCurveReference(8)

    expect(findPrimitiveCurveReferenceSpans(message).map(span => span.curveId))
      .toEqual([8])
  })

  it('renders references as controls alongside independently folded JSON', () => {
    const json = JSON.stringify({ payload: 'x'.repeat(60) })
    const html = formatStatusLineHtml(
      `curve ${formatPrimitiveCurveReference(4)} data ${json}`,
      {
        expanded: {},
        keyPrefix: 'w',
        lineIdx: 0,
        labels: {
          expand: 'Expand',
          primitiveCurve: curveId => `Highlight curve ${curveId}`
        }
      }
    )

    expect(html).toContain('data-primitive-curve-id="4"')
    expect(html).toContain('aria-label="Highlight curve 4"')
    expect(html).not.toContain(formatPrimitiveCurveReference(4))
    expect(html).toContain('data-json-key="w-0-0"')
  })

  it('does not activate reference-like text embedded inside JSON', () => {
    const json = JSON.stringify({
      note: formatPrimitiveCurveReference(9)
    })
    const html = formatStatusLineHtml(json, {
      expanded: {},
      keyPrefix: 'e',
      lineIdx: 0,
      labels: { expand: 'Expand' },
      threshold: Infinity
    })

    expect(html).not.toContain('data-primitive-curve-id')
    expect(html).toContain('pc:9')
  })
})
