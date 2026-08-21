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

const VIEWPORT = Object.freeze({ width: 640, height: 420 });

function baseScene(overrides = {}) {
  return {
    version: 5,
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    mode: 'rays',
    rayModeDensity: 1,
    maxRayDepth: 64,
    numericalTolerances: { rayPowerCutoff: 0.01 },
    ...overrides,
  };
}

function pointSource(rayCount, overrides = {}) {
  return {
    type: 'PointSource',
    x: 105,
    y: 210,
    brightness: 1,
    ...overrides,
    _rayModeDensity: rayCount / 500,
  };
}

function mirrorGrid(count) {
  const columns = Math.ceil(Math.sqrt(count * 1.5));
  const rows = Math.ceil(count / columns);
  const result = [];
  for (let index = 0; index < count; index++) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 185 + column * (390 / Math.max(1, columns - 1));
    const y = 35 + row * (350 / Math.max(1, rows - 1));
    const slope = index % 2 === 0 ? 7 : -7;
    result.push({
      type: 'Mirror',
      p1: { x: x - 6, y: y - slope },
      p2: { x: x + 6, y: y + slope },
    });
  }
  return result;
}

function intersectionScene(rayCount, curveCount) {
  const source = pointSource(rayCount, {
    x: 110,
    y: 210,
    // Non-default color modes raise density when one ray would carry more
    // than unit power. Keep this below the smallest probe density so the
    // requested ray counts remain exact.
    brightness: 0.05,
  });
  const rayModeDensity = source._rayModeDensity;
  delete source._rayModeDensity;
  return baseScene({
    colorMode: 'linear',
    rayModeDensity,
    numericalTolerances: { rayPowerCutoff: 1e-6 },
    objs: [source, ...mirrorGrid(curveCount)],
  });
}

function sourceOnlyScene({ colorMode, rayCount }) {
  const source = pointSource(rayCount, { x: 320, y: 210 });
  const rayModeDensity = source._rayModeDensity;
  delete source._rayModeDensity;
  return baseScene({
    colorMode,
    rayModeDensity,
    numericalTolerances: {
      rayPowerCutoff: colorMode === 'default' ? 0.01 : 1e-6,
    },
    objs: [source],
  });
}

function staticScene({ colorMode, rayCount, curveCount }) {
  const source = pointSource(rayCount);
  const rayModeDensity = source._rayModeDensity;
  delete source._rayModeDensity;
  return baseScene({
    colorMode,
    rayModeDensity,
    numericalTolerances: {
      rayPowerCutoff: colorMode === 'default' ? 0.01 : 1e-6,
    },
    objs: [source, ...mirrorGrid(curveCount)],
  });
}

function branchingScene() {
  const splitters = Array.from({ length: 7 }, (_, index) => ({
    type: 'BeamSplitter',
    p1: { x: 190 + index * 52, y: 90 },
    p2: { x: 190 + index * 52, y: 330 },
    transRatio: 0.5,
  }));
  return baseScene({
    colorMode: 'default',
    rayModeDensity: 0.35,
    maxRayDepth: 20,
    objs: [
      {
        type: 'Beam',
        p1: { x: 95, y: 135 },
        p2: { x: 95, y: 285 },
        brightness: 1,
      },
      ...splitters,
    ],
  });
}

// This is a compact, deterministic version of the branched-flow workload.
// It is intentionally embedded here rather than loaded from the Gallery so a
// Gallery edit cannot silently change a device's calibration.
function grinScene() {
  return baseScene({
    colorMode: 'linear',
    rayModeDensity: 1.2,
    numericalTolerances: { rayPowerCutoff: 1e-6 },
    maxRayDepth: 32,
    objs: [
      {
        type: 'GrinGlass',
        path: [
          { x: 180, y: 80, arc: false },
          { x: 180, y: 340, arc: false },
          { x: 540, y: 340, arc: false },
          { x: 540, y: 80, arc: false },
        ],
        refIndexFn:
          '1+\\frac{\\cos(\\frac{x}{6.3}+\\frac{y}{6.7}+4.3)}{86}+' +
          '\\frac{\\cos(\\frac{x}{3.4}-\\frac{y}{5.4}+3.4)}{82}+' +
          '\\frac{\\cos(\\frac{x}{1.2}+\\frac{y}{3.5}+2.2)}{75}',
        origin: { x: 0, y: 0 },
        stepSize: 1,
        partialReflect: false,
      },
      {
        type: 'AngleSource',
        p1: { x: 210, y: 120 },
        p2: { x: 500, y: 300 },
        brightness: 0.5,
        emisAngle: 55,
      },
    ],
  });
}

function imageScene() {
  return baseScene({
    mode: 'images',
    colorMode: 'linear',
    imageModeDensity: 1.5,
    numericalTolerances: { rayPowerCutoff: 1e-6 },
    objs: [
      { type: 'PointSource', x: 170, y: 210, brightness: 0.4 },
      {
        type: 'IdealLens',
        p1: { x: 330, y: 100 },
        p2: { x: 330, y: 320 },
        focalLength: 100,
      },
      ...mirrorGrid(32),
    ],
  });
}

const COOPERATION_PROBES = Object.freeze([
  { id: 'intersection-very-small', scene: intersectionScene(128, 4) },
  { id: 'intersection-crossover', scene: intersectionScene(512, 4) },
  { id: 'intersection-many-curves', scene: intersectionScene(512, 96) },
  { id: 'intersection-wide', scene: intersectionScene(1024, 320) },
]);

const END_TO_END_PROBES = Object.freeze([
  { id: 'source-default', scene: sourceOnlyScene({ colorMode: 'default', rayCount: 3000 }) },
  { id: 'source-linear', scene: sourceOnlyScene({ colorMode: 'linear', rayCount: 5000 }) },
  { id: 'static-default', scene: staticScene({ colorMode: 'default', rayCount: 900, curveCount: 24 }) },
  { id: 'static-linear', scene: staticScene({ colorMode: 'linear', rayCount: 1200, curveCount: 96 }) },
  { id: 'branching', scene: branchingScene() },
  { id: 'grin', scene: grinScene() },
  { id: 'images', scene: imageScene() },
]);

function cloneProbes(probes) {
  return probes.map(probe => ({
    id: probe.id,
    scene: JSON.parse(JSON.stringify(probe.scene)),
  }));
}

export function getRayCooperationCalibrationProbes() {
  return cloneProbes(COOPERATION_PROBES);
}

export function getEndToEndCalibrationProbes() {
  return cloneProbes(END_TO_END_PROBES);
}

export { VIEWPORT as CALIBRATION_VIEWPORT };
