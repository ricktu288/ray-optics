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

import CpuSimulationEngine from '../../src/core/simulationEngines/cpu/CpuSimulationEngine';
import { parseFormula } from '../../src/core/formula/formula-parser';
import { preprocessPrimitives } from '../../src/core/primitive/preprocess';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric';

const bulkType = {
  name: 'Test bulk',
  paramNames: [],
  dag: parseFormula('n = 1.5; alpha = 0;', ['x', 'y', 'lambda'])
};

const sourceType = {
  name: 'Test source',
  paramNames: [
    'x_0',
    'y_0',
    'delta_x',
    'd_x_0',
    'd_y_0',
    'P',
    'lambda_0'
  ],
  dag: parseFormula(
    `
      x = x_0 + i * delta_x;
      y = y_0;
      d_x = d_x_0;
      d_y = d_y_0;
      P_s = P;
      P_p = P;
      lambda = lambda_0;
    `,
    [
      'i', 'N', 'x_0', 'y_0', 'delta_x', 'd_x_0', 'd_y_0', 'P',
      'lambda_0'
    ]
  )
};

const mirrorSurfaceType = {
  name: 'Test mirror',
  paramNames: [],
  outRayCount: 1,
  mergesWithBoundary: false,
  dag: parseFormula(
    `
      d_1x = d_0x;
      d_1y = -d_0y;
      P_1s = P_0s;
      P_1p = P_0p;
    `,
    ['d_0x', 'd_0y', 'P_0s', 'P_0p']
  )
};

const splitterSurfaceType = {
  name: 'Test splitter',
  paramNames: [],
  outRayCount: 2,
  mergesWithBoundary: false,
  dag: parseFormula(
    `
      d_1x = 0; d_1y = -1;
      P_1s = P_0s * 0.5; P_1p = P_0p * 0.5;
      d_2x = 0; d_2y = 1;
      P_2s = P_0s * 0.5; P_2p = P_0p * 0.5;
    `,
    ['P_0s', 'P_0p']
  )
};

const weakSurfaceType = {
  name: 'Test weak output',
  paramNames: [],
  outRayCount: 1,
  mergesWithBoundary: false,
  dag: parseFormula(
    `
      d_1x = d_0x; d_1y = d_0y;
      P_1s = P_0s * 0.001; P_1p = P_0p * 0.001;
    `,
    ['d_0x', 'd_0y', 'P_0s', 'P_0p']
  )
};

function source({
  x = 5,
  y = 5,
  deltaX = 0,
  directionX = 1,
  directionY = 0,
  power = 0.5,
  wavelength = 540,
  rayCount = 1
} = {}) {
  return {
    kind: 'source',
    sourceType,
    params: {
      x_0: x,
      y_0: y,
      delta_x: deltaX,
      d_x_0: directionX,
      d_y_0: directionY,
      P: power,
      lambda_0: wavelength
    },
    rayCount
  };
}

function createProcessedScene(
  curves,
  sources = [source()],
  stepSize = 1
) {
  return preprocessPrimitives([
    ...sources,
    {
      kind: 'region',
      curves,
      bulkType,
      params: {},
      stepSize,
      partialReflect: true
    }
  ], {
    numericEpsilon: FLOAT32_EPSILON
  }).processedScene;
}

function rectangleCurves() {
  return [
    {
      kind: 'lineSegment',
      params: {
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 }
      }
    },
    {
      kind: 'lineSegment',
      params: {
        start: { x: 10, y: 0 },
        end: { x: 10, y: 10 }
      }
    },
    {
      kind: 'lineSegment',
      params: {
        start: { x: 10, y: 10 },
        end: { x: 0, y: 10 }
      }
    },
    {
      kind: 'lineSegment',
      params: {
        start: { x: 0, y: 10 },
        end: { x: 0, y: 0 }
      }
    }
  ];
}

async function advanceUntilPhase(run, phase) {
  let update;
  while (run.phase !== phase && !run.isComplete) {
    update = await run.advance({ timeBudgetMs: 0 });
  }
  return update;
}

async function advanceUntilPass(run, passIndex) {
  let update;
  while (run.passIndex < passIndex && !run.isComplete) {
    update = await run.advance({ timeBudgetMs: 0 });
  }
  return update;
}

async function advanceUntil(run, predicate) {
  let update;
  while (!predicate(run) && !run.isComplete) {
    update = await run.advance({ timeBudgetMs: 0 });
  }
  return update;
}

describe('CpuSimulationEngine initial ray buffers', () => {
  it('uses binary64 numerical tolerances by default', () => {
    const engine = new CpuSimulationEngine();

    expect(engine.numericEpsilon).toBe(Number.EPSILON);
    expect(engine.maxLocalIterations).toBe(256);
    expect(engine.timeBudgetMs).toBe(200);
  });

  it('does not require a renderer for headless color simulations', () => {
    const engine = new CpuSimulationEngine();

    expect(engine.beginRenderer({ colorMode: 'linear' })).toBeNull();
    expect(engine.canvasRenderer).toBeNull();
  });

  it('still requires WebGL when a non-default color output is requested', () => {
    const engine = new CpuSimulationEngine({ ctxMain: {} });

    expect(() => engine.beginRenderer({ colorMode: 'linear' }))
      .toThrow(/WebGL is unavailable/);
  });

  it('validates and updates the local interaction limit', () => {
    expect(() => new CpuSimulationEngine({
      config: { maxLocalIterations: 0 }
    })).toThrow(/maxLocalIterations/);
    const engine = new CpuSimulationEngine({
      config: { maxLocalIterations: 4 }
    });

    engine.configure({ maxLocalIterations: 12 });

    expect(engine.maxLocalIterations).toBe(12);
  });

  it('compiles prepared CPU DAG evaluators to native JavaScript', async () => {
    const processedScene = createProcessedScene(rectangleCurves());
    const prepared = await new CpuSimulationEngine().prepare(processedScene);
    const outgoing = prepared.outgoingRayData;
    const evaluators = [
      ...prepared.sourceEvaluators,
      ...outgoing.bulkTypes.flatMap(type => [
        type.evaluateIndex,
        type.evaluateGrin
      ]),
      ...outgoing.surfaceTypes.map(type => type.evaluate),
      ...outgoing.detectorTypes.map(type => type.evaluate),
    ];

    expect(evaluators.length).toBeGreaterThan(2);
    expect(evaluators.every(
      evaluator => evaluator.evaluationMode === 'compiled'
    )).toBe(true);
  });

  it('populates every source ray and stores each initial membership', async () => {
    const processedScene = createProcessedScene(rectangleCurves(), [
      source({ rayCount: 2, deltaX: 10 }),
      source({ x: 2, y: 2 })
    ]);
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);

    const run = await engine.createRun({ preparedScene });
    const update = await advanceUntilPhase(run, 'megakernel');

    expect(preparedScene.description).toBe(processedScene);
    expect(update.status).toBe('running');
    expect(update.outputUpdated).toBe(false);
    expect(run.rayBuffers[0]).toHaveLength(3);
    expect(run.rayBuffers[1]).toEqual([]);
    expect(run.rayBuffers[0]).toEqual([
      expect.objectContaining({
        originX: 5,
        originY: 5,
        directionX: 1,
        directionY: 0,
        powerS: 0.5,
        powerP: 0.5,
        wavelength: 540,
        membership: Uint8Array.of(1)
      }),
      expect.objectContaining({
        originX: 15,
        membership: Uint8Array.of(0)
      }),
      expect.objectContaining({
        originX: 2,
        originY: 2,
        membership: Uint8Array.of(1)
      })
    ]);
    expect(run.megakernelLanes).toHaveLength(3);
  });

  it('rejects source wavelengths outside the WebGPU UV-to-IR range',
    async () => {
      const processedScene = createProcessedScene([], [
        source({ wavelength: 470 }),
        source({ wavelength: 500 })
      ]);
      const engine = new CpuSimulationEngine({
        numericEpsilon: FLOAT32_EPSILON
      });
      engine.beginRenderer = jest.fn();
      const preparedScene = await engine.prepare(processedScene, {
        violetWavelength: 500,
        redWavelength: 600
      });
      const run = await engine.createRun({ preparedScene });

      await advanceUntilPhase(run, 'membership');

      expect(preparedScene.wavelengthRange[0]).toBeCloseTo(480);
      expect(preparedScene.wavelengthRange[1]).toBeCloseTo(640);
      expect(run.currentRayBuffer[0]).toMatchObject({
        powerS: 0,
        powerP: 0,
        wavelength: 470
      });
      expect(run.currentRayBuffer[1]).toMatchObject({
        powerS: 0.5,
        powerP: 0.5,
        wavelength: 500
      });
      expect(run.summary.invalidSourceRayCount).toBe(1);
    });

  it('keeps every positive finite source wavelength when requested',
    async () => {
      const processedScene = createProcessedScene([], [
        source({ wavelength: 1 }),
        source({ wavelength: Number.MAX_VALUE }),
        source({ wavelength: 0 }),
        source({ wavelength: -1 }),
        source({ wavelength: Infinity })
      ]);
      const engine = new CpuSimulationEngine({
        numericEpsilon: FLOAT32_EPSILON
      });
      engine.beginRenderer = jest.fn();
      const preparedScene = await engine.prepare(processedScene, {
        keepNonVisibleLight: true
      });
      const run = await engine.createRun({ preparedScene });

      await advanceUntilPhase(run, 'membership');

      expect(preparedScene.keepNonVisibleLight).toBe(true);
      expect(run.currentRayBuffer.map(ray => ray.powerS)).toEqual([
        0.5, 0.5, 0, 0, 0
      ]);
      expect(run.summary.invalidSourceRayCount).toBe(3);
    });

  it('retries an ambiguous cast from half the nearest distance', async () => {
    const processedScene = createProcessedScene(rectangleCurves(), [
      source({ directionX: 1, directionY: 1 })
    ]);
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);

    const run = await engine.createRun({ preparedScene });
    await advanceUntilPhase(run, 'megakernel');

    expect(run.summary.membershipRetryCount).toBe(1);
    expect(run.summary.membershipDiscardedRayCount).toBe(0);
    expect(Array.from(run.currentRayBuffer[0].membership)).toEqual([1]);
    expect(engine.beginRenderer).toHaveBeenCalledTimes(1);
  });

  it('pauses and resumes population and membership using the time budget', async () => {
    const processedScene = createProcessedScene(rectangleCurves(), [
      source({ rayCount: 2, deltaX: 1 })
    ]);
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({ preparedScene });
    const visitedPhases = new Set([run.phase]);

    let update = await run.advance({ timeBudgetMs: 0 });
    visitedPhases.add(run.phase);
    expect(update.status).toBe('running');
    expect(run.currentRayBuffer).toHaveLength(1);

    let advanceCount = 1;
    while (update.status !== 'complete') {
      update = await run.advance({ timeBudgetMs: 0 });
      visitedPhases.add(run.phase);
      advanceCount++;
    }

    expect(advanceCount).toBeGreaterThan(2);
    expect(visitedPhases).toEqual(new Set([
      'populate',
      'membership',
      'megakernel',
      'complete'
    ]));
    expect(run.passIndex).toBeGreaterThan(0);
    expect(run.processedRayCount).toBeGreaterThanOrEqual(2);
  });

  it('stores the nearest boundary hit when no GRIN step limits the ray', async () => {
    const processedScene = createProcessedScene(
      rectangleCurves(),
      [source()],
      0
    );
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({ preparedScene });

    await advanceUntil(run, current => current.processedRayCount >= 1);

    expect(run.hitBuffer).toHaveLength(1);
    expect(run.hitBuffer[0]).toMatchObject({
      s: 5,
      u: 0.5,
      curveId: expect.any(Number),
      normalX: -1,
      normalY: 0,
      sigma: 1
    });
    expect(run.hitBuffer[0].curveId).toBeGreaterThanOrEqual(0);
    expect(run.summary.finiteHitCount).toBe(1);
    expect(run.summary.grinStepCount).toBe(0);
  });

  it('prefers a boundary exactly at the GRIN step endpoint', async () => {
    const processedScene = createProcessedScene(
      rectangleCurves(),
      [source()],
      5
    );
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({ preparedScene });

    await advanceUntil(run, current => current.processedRayCount >= 1);

    expect(run.hitBuffer[0]).toMatchObject({
      s: 5,
      curveId: expect.any(Number)
    });
    expect(run.hitBuffer[0].curveId).toBeGreaterThanOrEqual(0);
    expect(run.summary.finiteHitCount).toBe(1);
    expect(run.summary.grinStepCount).toBe(0);
  });

  it('traces a weak source ray before outgoing queue sampling', async () => {
    const processedScene = createProcessedScene(rectangleCurves(), [
      source({ power: 2e-7 })
    ]);
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({
      preparedScene,
      colorMode: 'linear',
      rayPowerCutoff: 1e-6,
      rayPowerSampling: true
    });

    const update = await advanceUntil(
      run,
      current => current.processedRayCount >= 1
    );

    expect(run.currentRayBuffer[0]).toMatchObject({
      powerS: 2e-7,
      powerP: 2e-7
    });
    expect(run.hitBuffer[0]).toMatchObject({
      s: 1,
      curveId: -1
    });
    expect(update.result.totalTruncation).toBe(0);
    expect(run.summary.weakRayCount).toBe(0);
  });

  it('immediately truncates a weak working ray when sampling is disabled', async () => {
    const processedScene = createProcessedScene(rectangleCurves(), [
      source({ power: 0.004 })
    ]);
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({
      preparedScene,
      colorMode: 'linear',
      rayPowerCutoff: 0.01,
      rayPowerSampling: false
    });

    const update = await advanceUntil(run, current => current.isComplete);

    expect(run.rayPowerCutoff).toBe(0.01);
    expect(run.rayPowerSampling).toBe(false);
    expect(run.processedRayCount).toBe(0);
    expect(run.summary.weakRayCount).toBe(1);
    expect(update.result.totalTruncation).toBeCloseTo(0.008);
  });

  it.each([true, false])(
    'accounts for weak collector outputs when sampling is %s',
    async rayPowerSampling => {
      const processedScene = preprocessPrimitives([
        source({ x: 0, y: 0 }),
        {
          kind: 'surface',
          curve: {
            kind: 'lineSegment',
            params: {
              start: { x: 1, y: -1 },
              end: { x: 1, y: 1 }
            }
          },
          twoSided: true,
          surfaceType: weakSurfaceType,
          params: {}
        }
      ], { numericEpsilon: FLOAT32_EPSILON }).processedScene;
      const engine = new CpuSimulationEngine({
        numericEpsilon: FLOAT32_EPSILON,
        config: { maxLocalIterations: 1 }
      });
      engine.beginRenderer = jest.fn();
      const preparedScene = await engine.prepare(processedScene);
      const run = await engine.createRun({
        preparedScene,
        colorMode: 'linear',
        rayPowerCutoff: 0.01,
        rayPowerSampling
      });

      const update = await advanceUntilPass(run, 1);

      expect(run.currentRayBuffer).toEqual([]);
      expect(run.summary.weakRayCount).toBe(1);
      expect(update.result.totalTruncation).toBeCloseTo(0.001);
    }
  );

  it('rejects a non-boolean ray-power sampling option', async () => {
    const processedScene = createProcessedScene([], [source()]);
    const engine = new CpuSimulationEngine();
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);

    await expect(engine.createRun({
      preparedScene,
      colorMode: 'linear',
      rayPowerSampling: 'sometimes'
    })).rejects.toThrow('rayPowerSampling');
  });

  it.each([
    ['default', 1e-6, 0.01],
    ['default', 0.02, 0.01],
    ['linear', 1e-6, 1e-6],
    ['colorizedIntensity', 0, 0]
  ])('uses an effective %s cutoff of %s as %s', async (
    colorMode,
    configuredCutoff,
    effectiveCutoff
  ) => {
    const processedScene = createProcessedScene([], [source()]);
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({
      preparedScene,
      colorMode,
      rayPowerCutoff: configuredCutoff
    });

    expect(run.rayPowerCutoff).toBe(effectiveCutoff);
  });

  it('disables sampling by default with correct brightness', async () => {
    const processedScene = createProcessedScene([], [source()]);
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({
      preparedScene,
      colorMode: 'linear'
    });

    expect(run.rayPowerCutoff).toBe(1e-6);
    expect(run.rayPowerSampling).toBe(false);
  });

  it('does not sample while producing the initial source queue', async () => {
    const processedScene = createProcessedScene(rectangleCurves(), [
      source({ power: 0.004, rayCount: 3 })
    ]);
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({
      preparedScene,
      colorMode: 'default'
    });

    const update = await advanceUntilPhase(run, 'megakernel');

    expect(run.currentRayBuffer.map(ray => [
      ray.powerS,
      ray.powerP
    ])).toEqual([
      [0.004, 0.004],
      [0.004, 0.004],
      [0.004, 0.004]
    ]);
    expect(run.processedRayCount).toBe(0);
    expect(update.result.totalTruncation).toBe(0);
  });

  it.each(['default', 'linear'])(
    'prefix-samples the stable outgoing queue in %s mode',
    async colorMode => {
    const processedScene = createProcessedScene(
      rectangleCurves(),
      [source({ power: 0.004, rayCount: 2 })],
      0
    );
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON,
      config: { maxLocalIterations: 1 }
    });
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({
      preparedScene,
      colorMode,
      rayPowerCutoff: 0.01,
      rayPowerSampling: true
    });

    const update = await advanceUntilPass(run, 1);

    const outgoingBrightness = run.currentRayBuffer.map(ray => [
      ray.powerS,
      ray.powerP
    ]);
    expect(outgoingBrightness).toHaveLength(2);
    for (const powers of outgoingBrightness) {
      expect(powers[0]).toBeCloseTo(0.005);
      expect(powers[1]).toBeCloseTo(0.005);
    }
    expect(run.summary.weakRayCount).toBe(4);
    expect(update.result.totalTruncation).toBeGreaterThan(0);
  });

  it('queues branches before the locally retained continuation', async () => {
    const processedScene = preprocessPrimitives([
      source({ x: 0, y: 0 }),
      {
        kind: 'surface',
        curve: {
          kind: 'lineSegment',
          params: {
            start: { x: 1, y: -1 },
            end: { x: 1, y: 1 }
          }
        },
        twoSided: true,
        surfaceType: splitterSurfaceType,
        params: {}
      }
    ], {
      numericEpsilon: FLOAT32_EPSILON
    }).processedScene;
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON,
      config: { maxLocalIterations: 1 }
    });
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({
      preparedScene,
      colorMode: 'linear',
      rayPowerCutoff: 0
    });

    await advanceUntilPass(run, 1);

    expect(run.currentRayBuffer).toHaveLength(2);
    expect(run.currentRayBuffer[0]).toMatchObject({
      directionX: -1,
      directionY: 0,
      depth: 1
    });
    expect(run.currentRayBuffer[1]).toMatchObject({
      directionX: 1,
      directionY: 0,
      depth: 1
    });
  });

  it('renders the initial finite ray from the ray and hit buffers', async () => {
    const processedScene = createProcessedScene(
      rectangleCurves(),
      [source()],
      0
    );
    const renderer = {
      isSVG: false,
      drawSegment: jest.fn(),
      drawRay: jest.fn(),
      drawPoint: jest.fn(),
      applyColorTransformation: jest.fn(),
      flush: jest.fn()
    };
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn(() => {
      engine.canvasRenderer = renderer;
      return renderer;
    });
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({
      preparedScene,
      colorMode: 'default',
      rendering: {
        mode: 'rays',
        simulateColors: false,
        showRayArrows: true,
        getThemeRayColor: (_type, alpha) => [1, 0, 0, alpha],
        getThemeRayDash: () => []
      }
    });

    const update = await advanceUntil(
      run,
      current => current.processedRayCount >= 1
    );

    expect(renderer.drawSegment).toHaveBeenCalledWith({
      p1: { x: 5, y: 5 },
      p2: { x: 10, y: 5 }
    }, [1, 0, 0, 1], true, []);
    expect(renderer.drawRay).not.toHaveBeenCalled();
    expect(update.outputUpdated).toBe(true);
  });

  it('traces the first active child locally through escape', async () => {
    const processedScene = preprocessPrimitives([
      source({ x: 5, y: 5, power: 0.004 }),
      {
        kind: 'surface',
        curve: {
          kind: 'lineSegment',
          params: {
            start: { x: 10, y: 0 },
            end: { x: 10, y: 10 }
          }
        },
        twoSided: true,
        surfaceType: mirrorSurfaceType,
        params: {}
      }
    ], {
      numericEpsilon: FLOAT32_EPSILON
    }).processedScene;
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({ preparedScene });

    const update = await run.advance();

    expect(update.status).toBe('complete');
    expect(run.passIndex).toBe(1);
    expect(run.processedRayCount).toBe(2);
    expect(run.currentRayBuffer).toEqual([]);
    expect(run.hitBuffer[0]).toMatchObject({
      s: Infinity,
      curveId: -1
    });
  });

  it('stops before an interaction beyond the legacy maximum ray depth',
    async () => {
      const mirror = x => ({
        kind: 'surface',
        curve: {
          kind: 'lineSegment',
          params: {
            start: { x, y: -10 },
            end: { x, y: 10 }
          }
        },
        twoSided: true,
        surfaceType: mirrorSurfaceType,
        params: {}
      });
      const processedScene = preprocessPrimitives([
        source({ x: 0, y: 0 }),
        mirror(1),
        mirror(-1)
      ], {
        numericEpsilon: FLOAT32_EPSILON
      }).processedScene;
      const engine = new CpuSimulationEngine({
        numericEpsilon: FLOAT32_EPSILON
      });
      engine.beginRenderer = jest.fn();
      const preparedScene = await engine.prepare(processedScene);
      const run = await engine.createRun({
        preparedScene,
        maxRayDepth: 1
      });

      const update = await run.advance();

      expect(update.status).toBe('complete');
      expect(run.passIndex).toBe(1);
      expect(run.processedRayCount).toBe(2);
      expect(run.currentRayBuffer).toEqual([]);
      expect(run.hitBuffer[0]).toMatchObject({
        s: 2,
        curveId: expect.any(Number)
      });
      expect(update.result.totalTruncation).toBeCloseTo(1);
    });

  it('includes the effective tolerance in an interaction warning', async () => {
    const surface = x => ({
      kind: 'surface',
      curve: {
        kind: 'lineSegment',
        params: {
          start: { x, y: 0 },
          end: { x, y: 10 }
        }
      },
      twoSided: true,
      surfaceType: mirrorSurfaceType,
      params: {}
    });
    const processedScene = preprocessPrimitives([
      source({ x: 5, y: 5 }),
      surface(10),
      surface(10.0005)
    ], {
      numericEpsilon: FLOAT32_EPSILON,
      numericalTolerances: {
        interactionMerging: 0.001
      }
    }).processedScene;
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({ preparedScene });

    const update = await advanceUntil(
      run,
      current => current.processedRayCount >= 1
    );

    expect(update.result.warning).toMatchObject({
      rayIndex: 0,
      curveId: 0,
      conflictingCurveId: 1,
      ambiguousPower: 1,
      tolerance: {
        kind: 'interactionMerging',
        unit: 'sceneUnits',
        value: 0.001
      }
    });
    expect(update.result.warningPower).toBe(1);
  });

  it('counts a normal-conflict discarded ray as truncation', async () => {
    const surface = (start, end) => ({
      kind: 'surface',
      curve: { kind: 'lineSegment', params: { start, end } },
      twoSided: true,
      surfaceType: mirrorSurfaceType,
      params: {}
    });
    const processedScene = preprocessPrimitives([
      source({ x: 5, y: 5 }),
      surface({ x: 10, y: 0 }, { x: 10, y: 10 }),
      surface({ x: 9, y: 4 }, { x: 11, y: 6 })
    ], { numericEpsilon: FLOAT32_EPSILON }).processedScene;
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON,
      config: { ambiguousRayWarningSafetyFactor: 0 }
    });
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({ preparedScene });

    const update = await advanceUntil(
      run,
      current => current.status === 'complete'
    );

    expect(run.hitBuffer[0].curveId).toBe(-2);
    expect(update.result.warningPower).toBe(1);
    expect(update.result.warning?.ambiguousPower).toBe(1);
    expect(update.result.totalTruncation).toBe(1);
  });

  it('accumulates detector results and continues the incident ray', async () => {
    const detectorType = {
      name: 'Test detector',
      paramNames: [],
      writeCount: 1,
      dag: parseFormula(
        'k_1 = 0; v_1 = P_0s + P_0p',
        ['P_0s', 'P_0p']
      )
    };
    const processedScene = preprocessPrimitives([
      source({ x: 5, y: 5 }),
      {
        kind: 'detector',
        curve: {
          kind: 'lineSegment',
          params: {
            start: { x: 10, y: 0 },
            end: { x: 10, y: 10 }
          }
        },
        twoSided: true,
        detectorType,
        params: {},
        resultId: 0,
        resultSize: 1,
        result: { values: null }
      }
    ], {
      numericEpsilon: FLOAT32_EPSILON
    }).processedScene;
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({ preparedScene });

    const update = await run.advance();

    expect(update.status).toBe('complete');
    expect(Array.from(update.result.detectors[0])).toEqual([1]);
    expect(run.currentRayBuffer).toEqual([]);
    expect(run.hitBuffer[0]).toMatchObject({
      s: Infinity,
      curveId: -1
    });
  });
});
