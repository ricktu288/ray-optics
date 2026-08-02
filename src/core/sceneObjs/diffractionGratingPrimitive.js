/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import Simulator from '../Simulator.js';
import { parseFormula } from '../formula/formula-parser.js';

const NM_TO_MM = 1e-6;

export function createDiffractionGratingPrimitive(
  obj,
  curve,
  mirrored,
  localOrderSign
) {
  if (!(obj.lineDensity > 0) || !Number.isFinite(obj.lineDensity)) return null;
  const maxOutRayCount = Math.floor(
    2 / (obj.lineDensity * Simulator.UV_WAVELENGTH * NM_TO_MM)
  ) + 1;
  const params = {
    line_density: obj.lineDensity,
    slit_ratio: obj.slitRatio
  };
  const customIntensityTerms = [];
  if (obj.customBrightness) {
    for (let brightnessIndex = 0;
      brightnessIndex < obj.brightnesses.length;
      brightnessIndex++) {
      const order = brightnessIndex === 0
        ? 0
        : (brightnessIndex % 2 === 1
          ? (brightnessIndex + 1) / 2
          : -brightnessIndex / 2);
      const name = `intensity_${brightnessIndex}`;
      params[name] = obj.brightnesses[brightnessIndex] || 0;
      customIntensityTerms.push(
        `${name} * (1 - sign(abs(m_ORDER - (${order}))))`
      );
    }
  }
  const statements = [];
  // The legacy straight and concave tools assign opposite signs to an order
  // after their directions are expressed in the adjusted local surface frame.
  const minimumOrderExpression = localOrderSign > 0
    ? '(-1 - d_0x)'
    : '(d_0x - 1)';
  const orderOperator = localOrderSign > 0 ? '+' : '-';
  statements.push(
    'c = lambda * 0.000001 * line_density',
    `m_min = ceil(${minimumOrderExpression} / c)`
  );
  for (let index = 0; index < maxOutRayCount; index++) {
    let intensityExpression;
    if (obj.customBrightness) {
      intensityExpression = customIntensityTerms.length > 0
        ? customIntensityTerms.join(' + ')
        : '0';
    } else {
      intensityExpression =
        'fallback(guardNonzero(m_ORDER, (sin(pi * slit_ratio * m_ORDER) / (pi * slit_ratio * m_ORDER)) ^ 2 * slit_ratio * slit_ratio), slit_ratio * slit_ratio)';
    }
    const slot = index + 1;
    const preferredOrder = index === 0
      ? 0
      : (index % 2 === 1 ? (index + 1) / 2 : -index / 2);
    intensityExpression = intensityExpression.replaceAll(
      'm_ORDER',
      `m_${slot}`
    );
    statements.push(
      // Keep a physical diffraction order in the same output slot as the
      // incident angle changes. Orders separated by maxOutRayCount may share
      // a slot because they can never be valid simultaneously.
      `m_${slot} = ${preferredOrder} + ${maxOutRayCount} * ` +
        `ceil((m_min - (${preferredOrder})) / ${maxOutRayCount})`,
      `q_${slot} = d_0x ${orderOperator} m_${slot} * c`,
      `d_${slot}x = q_${slot}`,
      `d_${slot}y = ${mirrored ? '' : '-'}sqrt(1 - q_${slot} * q_${slot})`,
      `P_${slot}s = P_0s * (${intensityExpression})`,
      `P_${slot}p = P_0p * (${intensityExpression})`
    );
  }

  return {
    kind: 'surface',
    curve,
    twoSided: true,
    surfaceType: {
      name: mirrored
        ? 'Reflective diffraction grating'
        : 'Transmissive diffraction grating',
      paramNames: Object.keys(params),
      dag: parseFormula(
        statements.join('; '),
        [
          'd_0x', 'P_0s', 'P_0p', 'lambda',
          ...Object.keys(params)
        ]
      ),
      outRayCount: maxOutRayCount,
      mergesWithBoundary: false
    },
    params
  };
}
