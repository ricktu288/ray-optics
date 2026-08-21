/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
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

/*
 * These are embedded copies of the optical content of real Gallery/module
 * scenes. Decorations and crop boxes are omitted because they neither create
 * primitives nor draw rays. No Gallery file is fetched by calibration.
 */
const CIRCLE_SOURCE = {
  version: 5,
  name: 'CircleSource',
  modules: {
    CircleSource: {
      numPoints: 1,
      params: [
        'r=0:1:500:100', 'N=1:1:500:10', 'brightness=0.01:0.01:10:1',
      ],
      objs: [{
        for: 'theta=0:2pi/N:2pi-0.0001',
        type: 'AngleSource',
        p1: { x: '`x_1+r*cos(theta)`', y: '`y_1+r*sin(theta)`' },
        p2: {
          x: '`x_1+(r+1)*cos(theta)`',
          y: '`y_1+(r+1)*sin(theta)`',
        },
        brightness: '`brightness/N`',
        emisAngle: 180,
      }],
    },
  },
  objs: [{
    type: 'ModuleObj',
    module: 'CircleSource',
    points: [{ x: 580, y: 420 }],
    params: { r: 50, N: 200, brightness: 2 },
  }],
  width: 1500,
  height: 900,
  rayModeDensity: 0.8805575434761368,
  snapToGrid: true,
  origin: { x: 231.66666666666663, y: -18.000000000000014 },
};

const TWO_MIRROR_IMAGES = {
  version: 5,
  objs: [
    { type: 'PointSource', x: 494, y: 300 },
    { type: 'PointSource', x: 494, y: 320 },
    { type: 'PointSource', x: 494, y: 280 },
    { type: 'PointSource', x: 514, y: 320 },
    { type: 'Mirror', p1: { x: 395, y: 380 }, p2: { x: 674, y: 380 } },
    {
      type: 'Mirror',
      p1: { x: 533.1954312487626, y: 136.62256659554347 },
      p2: { x: 674, y: 380 },
    },
  ],
  width: 1286.3571428571433,
  height: 941.0142857142861,
  mode: 'images',
  origin: { x: -29.035714285714334, y: 100.47857142857148 },
  scale: 1,
};

const CAMERA_OBSCURA = {
  version: 5,
  objs: [
    { type: 'Blocker', p1: { x: 1060, y: 680 }, p2: { x: 760, y: 680 } },
    { type: 'Blocker', p1: { x: 1060, y: 400 }, p2: { x: 760, y: 400 } },
    { type: 'Blocker', p1: { x: 1060, y: 680 }, p2: { x: 1060, y: 400 } },
    {
      type: 'AngleSource', p1: { x: 60, y: 620 }, p2: { x: 720, y: 540 },
      brightness: '5', emisAngle: '4',
    },
    {
      type: 'AngleSource', p1: { x: 60, y: 480 }, p2: { x: 720, y: 540 },
      brightness: '5', emisAngle: '4',
    },
    {
      type: 'AngleSource', p1: { x: 60, y: 640 }, p2: { x: 720, y: 540 },
      brightness: '5', emisAngle: 4,
    },
    {
      type: 'AngleSource', p1: { x: 60, y: 400 }, p2: { x: 720, y: 540 },
      brightness: '5', emisAngle: '4',
    },
    {
      type: 'Aperture', p1: { x: 760, y: 400 }, p2: { x: 760, y: 680 },
      p3: { x: 760, y: 539.5 }, p4: { x: 760, y: 540.5 },
    },
  ],
  width: 1909.8947368421057,
  height: 1090.2315789473687,
  rayModeDensity: 20.08352846991968,
  origin: { x: 458.1544534412956, y: -8.005754960553588 },
  scale: 1,
};

const ZOOM_LENS = {
  version: 5,
  objs: [
    { type: 'Beam', p1: { x: 140, y: 420 }, p2: { x: 140, y: 500 } },
    {
      type: 'SphericalLens',
      path: [
        { x: 373, y: 358, arc: false }, { x: 387, y: 358, arc: false },
        { x: 392, y: 459, arc: true }, { x: 387, y: 560, arc: false },
        { x: 373, y: 560, arc: false }, { x: 369, y: 459, arc: true },
      ],
      refIndex: 1.7,
    },
    {
      type: 'SphericalLens',
      path: [
        { x: 854, y: 360, arc: false }, { x: 866, y: 360, arc: false },
        { x: 872.0143851941782, y: 460, arc: true },
        { x: 866, y: 560, arc: false }, { x: 854, y: 560, arc: false },
        { x: 852, y: 460, arc: true },
      ],
      refIndex: 1.82,
    },
    {
      type: 'SphericalLens',
      path: [
        { x: 603, y: 361, arc: false }, { x: 637, y: 361, arc: false },
        { x: 628, y: 460.5, arc: true }, { x: 637, y: 560, arc: false },
        { x: 603, y: 560, arc: false }, { x: 613, y: 460.5, arc: true },
      ],
      refIndex: 2.01,
    },
  ],
  width: 1438.4640926640927,
  height: 850.1281853281855,
  origin: { x: 142.4884169884171, y: -43.071428571428555 },
  scale: 1,
};

const BRANCHED_FLOW = {
  version: 5,
  objs: [
    {
      type: 'GrinGlass',
      path: [
        { x: 340, y: 180, arc: false }, { x: 340, y: 520, arc: false },
        { x: 780, y: 520, arc: false }, { x: 780, y: 180, arc: false },
      ],
      refIndexFn:
        '1+\\frac{\\cos(\\frac{x}{6.3}+\\frac{y}{6.7}+4.3)}{86}+' +
        '\\frac{\\cos(\\frac{x}{6.4}-\\frac{y}{3.2}+4.5)}{95}+' +
        '\\frac{\\cos(-\\frac{x}{3.4}-\\frac{y}{5.4}+3.4)}{82}+' +
        '\\frac{\\cos(-\\frac{x}{9.7}+\\frac{y}{5.4}+3.5)}{71}+' +
        '\\frac{\\cos(\\frac{x}{1.2}+\\frac{y}{3.5}+2.2)}{75}+' +
        '\\frac{\\cos(\\frac{x}{5.6}-\\frac{y}{1.8}+5.2)}{95}+' +
        '\\frac{\\cos(-\\frac{x}{5.4}-\\frac{y}{3.2}+5.4)}{82}+' +
        '\\frac{\\cos(-\\frac{x}{8.7}+\\frac{y}{6.5}+7.4)}{71}+' +
        '\\frac{\\cos(\\frac{x}{9.4}+\\frac{y}{4.2}+2.3)}{94}+' +
        '\\frac{\\cos(\\frac{x}{2.3}-\\frac{y}{6.4}+0.9)}{63}+' +
        '\\frac{\\cos(-\\frac{x}{7.5}-\\frac{y}{8.6}+5.7)}{81}+' +
        '\\frac{\\cos(-\\frac{x}{9.7}+\\frac{y}{10}+3.2)}{105}',
    },
    {
      type: 'AngleSource',
      p1: { x: 370.2510318821846, y: 219.920967054945 },
      p2: { x: 794.9478534860789, y: 482.07949890920065 },
      brightness: 0.25,
      emisAngle: 55,
    },
  ],
  width: 641.016813987311,
  height: 516.1829627838478,
  rayModeDensity: 3.7859619403392255,
  origin: { x: -240.95025652484844, y: -103.60224591966603 },
  scale: 1,
};

const HYPERBOLIC_LENS = {
  version: 5,
  objs: [
    {
      type: 'CustomGlass', p1: { x: 679, y: 20 }, p2: { x: 1079, y: 20 },
      eqn1: '0.1', eqn2: '1.5-\\sqrt{\\frac{0.8+x^2}{1.25}}',
    },
    {
      type: 'CustomGlass', p1: { x: 59, y: 80 }, p2: { x: 459, y: 80 },
      eqn2: '\\sqrt{1-x^2}',
    },
    { type: 'Blocker', p1: { x: 619, y: 1120 }, p2: { x: 619, y: -120 } },
    { type: 'Blocker', p1: { x: 619, y: -520 }, p2: { x: 619, y: -1520 } },
    { type: 'Beam', p1: { x: 79, y: 180 }, p2: { x: 439, y: 180 } },
    { type: 'Beam', p1: { x: 699, y: 180 }, p2: { x: 1059, y: 180 } },
  ],
  width: 4980.020128761425,
  height: 2596.3011403257747,
  rayModeDensity: 0.15785001009894917,
  observer: { c: { x: 577, y: 58 }, r: 20 },
  origin: { x: 1437.1640781191247, y: 1524.3702610244623 },
  scale: 1,
};

function benchmarkVariant(authoredScene, {
  colorMode = 'default',
  densityMultiplier = 1,
} = {}) {
  const scene = clone(authoredScene);
  const densityProperty = scene.mode === 'images' || scene.mode === 'observer'
    ? 'imageModeDensity'
    : 'rayModeDensity';
  const defaultDensity = densityProperty === 'imageModeDensity' ? 1 : 0.1;
  scene[densityProperty] = (scene[densityProperty] ?? defaultDensity) *
    densityMultiplier;
  scene.colorMode = colorMode;
  scene.numericalTolerances = {
    ...(scene.numericalTolerances ?? {}),
    rayPowerCutoff: colorMode === 'default' ? 0.01 : 1e-6,
  };
  return scene;
}

function probe(id, source, variant, scene) {
  return { id, source, variant, scene };
}

const COOPERATION_PROBES = Object.freeze([
  { id: 'intersection-very-small', scene: intersectionScene(128, 4) },
  { id: 'intersection-crossover', scene: intersectionScene(512, 4) },
  { id: 'intersection-many-curves', scene: intersectionScene(512, 96) },
  { id: 'intersection-wide', scene: intersectionScene(1024, 320) },
]);

const END_TO_END_PROBES = Object.freeze([
  probe('circle-source-authored', 'module/CircleSource', 'authored',
    benchmarkVariant(CIRCLE_SOURCE)),
  probe('two-mirror-images-authored', 'gallery/images-formed-by-two-mirrors',
    'authored', benchmarkVariant(TWO_MIRROR_IMAGES)),
  probe('two-mirror-images-5x-linear', 'gallery/images-formed-by-two-mirrors',
    '5x-linear', benchmarkVariant(TWO_MIRROR_IMAGES, {
      colorMode: 'linear', densityMultiplier: 5,
    })),
  probe('camera-obscura-authored', 'gallery/camera-obscura', 'authored',
    benchmarkVariant(CAMERA_OBSCURA)),
  probe('camera-obscura-5x-linear', 'gallery/camera-obscura', '5x-linear',
    benchmarkVariant(CAMERA_OBSCURA, {
      colorMode: 'linear', densityMultiplier: 5,
    })),
  probe('zoom-lens-5x-linear', 'gallery/zoom-lens', '5x-linear',
    benchmarkVariant(ZOOM_LENS, {
      colorMode: 'linear', densityMultiplier: 5,
    })),
  probe('branched-flow-0.01x', 'gallery/branched-flow', '0.01x',
    benchmarkVariant(BRANCHED_FLOW, { densityMultiplier: 0.01 })),
  probe('branched-flow-0.025x', 'gallery/branched-flow', '0.025x',
    benchmarkVariant(BRANCHED_FLOW, { densityMultiplier: 0.025 })),
  probe('branched-flow-0.05x', 'gallery/branched-flow', '0.05x',
    benchmarkVariant(BRANCHED_FLOW, { densityMultiplier: 0.05 })),
  probe('branched-flow-0.1x', 'gallery/branched-flow', '0.1x',
    benchmarkVariant(BRANCHED_FLOW, { densityMultiplier: 0.1 })),
  probe('branched-flow-authored', 'gallery/branched-flow', 'authored',
    benchmarkVariant(BRANCHED_FLOW)),
  probe('hyperbolic-lens-authored', 'gallery/hyperbolic-lens', 'authored',
    benchmarkVariant(HYPERBOLIC_LENS)),
]);

function cloneProbes(probes) {
  return probes.map(item => clone(item));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getRayCooperationCalibrationProbes() {
  return cloneProbes(COOPERATION_PROBES);
}

export function getEndToEndCalibrationProbes() {
  return cloneProbes(END_TO_END_PROBES);
}

export { HEADLESS_VIEWPORT as CALIBRATION_HEADLESS_VIEWPORT };
