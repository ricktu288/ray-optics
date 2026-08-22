/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

const HEADLESS_VIEWPORT = Object.freeze({ width: 640, height: 420 });

function intersectionScene(rayCount, curveCount) {
  const columns = Math.ceil(Math.sqrt(curveCount * 1.5));
  const rows = Math.ceil(curveCount / columns);
  const mirrors = Array.from({ length: curveCount }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 185 + column * (390 / Math.max(1, columns - 1));
    const y = 35 + row * (350 / Math.max(1, rows - 1));
    const slope = index % 2 === 0 ? 7 : -7;
    return {
      type: 'Mirror',
      p1: { x: x - 6, y: y - slope },
      p2: { x: x + 6, y: y + slope },
    };
  });
  return {
    version: 5,
    width: HEADLESS_VIEWPORT.width,
    height: HEADLESS_VIEWPORT.height,
    mode: 'rays',
    colorMode: 'linear',
    rayModeDensity: rayCount / 500,
    maxRayDepth: 64,
    numericalTolerances: { rayPowerCutoff: 1e-6 },
    objs: [{
      type: 'PointSource', x: 110, y: 210, brightness: 0.05,
    }, ...mirrors],
  };
}

const COOPERATION_PROBES = Object.freeze([
  { id: 'intersection-very-small', scene: intersectionScene(128, 4) },
  { id: 'intersection-crossover', scene: intersectionScene(512, 4) },
  { id: 'intersection-many-curves', scene: intersectionScene(512, 96) },
  { id: 'intersection-wide', scene: intersectionScene(1024, 320) },
]);

export function getRayCooperationCalibrationProbes() {
  return JSON.parse(JSON.stringify(COOPERATION_PROBES));
}

export { HEADLESS_VIEWPORT as CALIBRATION_HEADLESS_VIEWPORT };
