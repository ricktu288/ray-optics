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

import CpuSimulationEngine from '../../src/core/simulationEngines/CpuSimulationEngine';
import { parseFormula } from '../../src/core/formula/formula-parser';
import {
  attachCpuBvhTraversalDiagnostics
} from '../../src/core/primitive/bvhTraversal';
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
    'P'
  ],
  dag: parseFormula(
    `
      x = x_0 + i * delta_x;
      y = y_0;
      d_x = d_x_0;
      d_y = d_y_0;
      P_s = P;
      P_p = P;
      lambda = 540;
    `,
    ['i', 'N', 'x_0', 'y_0', 'delta_x', 'd_x_0', 'd_y_0', 'P']
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

function source({
  x = 5,
  y = 5,
  deltaX = 0,
  directionX = 1,
  directionY = 0,
  power = 0.5,
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
      P: power
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

describe('CpuSimulationEngine initial ray buffers', () => {
  it('uses binary64 numerical tolerances by default', () => {
    const engine = new CpuSimulationEngine();

    expect(engine.numericEpsilon).toBe(Number.EPSILON);
  });

  it('populates every source ray and stores each initial membership', async () => {
    const processedScene = createProcessedScene(rectangleCurves(), [
      source({ rayCount: 2, deltaX: 10 }),
      source({ x: 2, y: 2 })
    ]);
    const diagnostics = attachCpuBvhTraversalDiagnostics(processedScene);
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);

    const run = await engine.createRun({ preparedScene });
    const update = await advanceUntilPhase(run, 'render');

    expect(preparedScene.description).toBe(processedScene);
    expect(update.status).toBe('running');
    expect(update.outputUpdated).toBe(false);
    expect(run.rayBuffers[0]).toHaveLength(3);
    expect(run.rayBuffers[1]).toEqual([]);
    expect(run.hitBuffer).toHaveLength(3);
    expect(run.hitBuffer).toEqual([
      expect.objectContaining({
        s: 1,
        curveId: -1
      }),
      expect.objectContaining({
        s: Infinity,
        curveId: -1
      }),
      expect.objectContaining({
        s: 1,
        curveId: -1
      })
    ]);
    expect(run.destinationRayCount).toBe(2);
    expect(run.interactionIndexBuffers).toEqual([
      expect.objectContaining({
        kind: 'grinStep',
        interactionCount: 2,
        sourceRayIndices: Uint32Array.of(0, 2),
        destinationRayStart: 0
      }),
      expect.objectContaining({
        kind: 'regionBoundary',
        partialReflect: false,
        interactionCount: 0
      }),
      expect.objectContaining({
        kind: 'regionBoundary',
        partialReflect: true,
        interactionCount: 0
      })
    ]);
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
    expect(Array.from(diagnostics.testedCurves)).toContain(1);
    expect(log).toHaveBeenCalledWith(
      '[Primitive CPU initialization] sources=%d slots=%d active=%d inactive=%d invalid=%d membershipRetries=%d membershipDiscarded=%d regions=%d',
      2,
      3,
      3,
      0,
      0,
      0,
      0,
      1
    );
    expect(log.mock.calls[1]).toEqual([
      '[Primitive CPU initial rays]\n' +
      '  first:\n' +
      '    #0 o=(5,5) d=(1,0) P=(0.5,0.5) lambda=540 regions=[0]\n' +
      '    #1 o=(15,5) d=(1,0) P=(0.5,0.5) lambda=540 regions=[]\n' +
      '    #2 o=(2,2) d=(1,0) P=(0.5,0.5) lambda=540 regions=[0]\n' +
      '  last:\n' +
      '    #0 o=(5,5) d=(1,0) P=(0.5,0.5) lambda=540 regions=[0]\n' +
      '    #1 o=(15,5) d=(1,0) P=(0.5,0.5) lambda=540 regions=[]\n' +
      '    #2 o=(2,2) d=(1,0) P=(0.5,0.5) lambda=540 regions=[0]'
    ]);
    expect(log.mock.calls[2]).toEqual([
      '[Primitive CPU interaction indices] ' +
      'types=3 activeTypes=1 interactions=2 destinationSlots=2\n' +
      '  grinStep out#0 hits=2 [0->0 2->1]\n' +
      '  regionBoundary[noPartialReflect] hits=0 out=1\n' +
      '  regionBoundary[partialReflect] hits=0 out=2'
    ]);
    log.mockRestore();
  });

  it('retries an ambiguous cast from half the nearest distance', async () => {
    const processedScene = createProcessedScene(rectangleCurves(), [
      source({ directionX: 1, directionY: 1 })
    ]);
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);

    const run = await engine.createRun({ preparedScene });
    await run.advance();

    expect(run.summary.membershipRetryCount).toBe(1);
    expect(run.summary.membershipDiscardedRayCount).toBe(0);
    expect(Array.from(run.currentRayBuffer[0].membership)).toEqual([1]);
    expect(engine.beginRenderer).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it('pauses and resumes population and membership using the time budget', async () => {
    const processedScene = createProcessedScene(rectangleCurves(), [
      source({ rayCount: 2, deltaX: 1 })
    ]);
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
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
      'intersection',
      'interactionIndexCount',
      'interactionIndexFill',
      'render',
      'outgoing',
      'complete'
    ]));
    expect(run.passIndex).toBeGreaterThan(0);
    expect(run.processedRayCount).toBeGreaterThanOrEqual(2);
    expect(log.mock.calls.length).toBeGreaterThanOrEqual(3);
    log.mockRestore();
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
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({ preparedScene });

    await advanceUntilPhase(run, 'render');

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
    expect(run.destinationRayCount).toBe(2);
    expect(run.interactionIndexBuffers[2]).toMatchObject({
      interactionCount: 1,
      sourceRayIndices: Uint32Array.of(0),
      destinationRayStart: 0
    });
    log.mockRestore();
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
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({ preparedScene });

    await advanceUntilPhase(run, 'render');

    expect(run.hitBuffer[0]).toMatchObject({
      s: 5,
      curveId: expect.any(Number)
    });
    expect(run.hitBuffer[0].curveId).toBeGreaterThanOrEqual(0);
    expect(run.summary.finiteHitCount).toBe(1);
    expect(run.summary.grinStepCount).toBe(0);
    log.mockRestore();
  });

  it('uses the scene cutoff for a weak Correct Brightness source ray', async () => {
    const processedScene = createProcessedScene(rectangleCurves(), [
      source({ power: 2e-7 })
    ]);
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({
      preparedScene,
      colorMode: 'linear',
      rayPowerCutoff: 1e-6
    });

    const update = await advanceUntilPhase(run, 'render');

    expect(run.currentRayBuffer[0]).toMatchObject({
      powerS: 2e-7,
      powerP: 2e-7
    });
    expect(run.hitBuffer[0]).toMatchObject({
      s: 0,
      curveId: -1
    });
    expect(update.result.totalTruncation).toBeCloseTo(4e-7);
    expect(run.summary.weakRayCount).toBe(1);
    log.mockRestore();
  });

  it('overrides the scene cutoff when Correct Brightness is off', async () => {
    const processedScene = createProcessedScene(rectangleCurves(), [
      source({ power: 2e-7 })
    ]);
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({
      preparedScene,
      colorMode: 'default',
      rayPowerCutoff: 1e-6
    });

    const update = await advanceUntilPhase(run, 'render');

    expect(run.hitBuffer[0]).toMatchObject({
      s: 1,
      curveId: -1
    });
    expect(update.result.totalTruncation).toBe(0);
    expect(run.summary.weakRayCount).toBe(0);
    log.mockRestore();
  });

  it('does not apply the legacy cutoff while producing source rays', async () => {
    const processedScene = createProcessedScene(rectangleCurves(), [
      source({ power: 0.004, rayCount: 3 })
    ]);
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({
      preparedScene,
      colorMode: 'default'
    });

    const update = await advanceUntilPhase(run, 'render');

    expect(run.currentRayBuffer.map(ray => [
      ray.powerS,
      ray.powerP
    ])).toEqual([
      [0.004, 0.004],
      [0.004, 0.004],
      [0.004, 0.004]
    ]);
    expect(run.hitBuffer[0].s).toBe(1);
    expect(update.result.totalTruncation).toBe(0);
    log.mockRestore();
  });

  it('legacy-subsamples every output of a nominally branching interaction', async () => {
    const processedScene = createProcessedScene(
      rectangleCurves(),
      [source({ power: 0.004, rayCount: 2 })],
      0
    );
    const engine = new CpuSimulationEngine({
      numericEpsilon: FLOAT32_EPSILON
    });
    engine.beginRenderer = jest.fn();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({
      preparedScene,
      colorMode: 'default'
    });

    const update = await advanceUntilPass(run, 1);

    const outgoingBrightness = run.currentRayBuffer.map(ray => [
      ray.powerS,
      ray.powerP
    ]);
    expect(outgoingBrightness[0][0]).toBeCloseTo(0.00768);
    expect(outgoingBrightness[0][1]).toBeCloseTo(0.00768);
    expect(outgoingBrightness[1]).toEqual([0, 0]);
    expect(outgoingBrightness[2][0]).toBeCloseTo(0.00512);
    expect(outgoingBrightness[2][1]).toBeCloseTo(0.00512);
    expect(outgoingBrightness[3]).toEqual([0, 0]);
    expect(update.result.totalTruncation).toBeCloseTo(0.016);
    log.mockRestore();
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
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
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

    const update = await advanceUntilPhase(run, 'outgoing');

    expect(renderer.drawSegment).toHaveBeenCalledWith({
      p1: { x: 5, y: 5 },
      p2: { x: 10, y: 5 }
    }, [1, 0, 0, 1], true, []);
    expect(renderer.drawRay).not.toHaveBeenCalled();
    expect(update.outputUpdated).toBe(true);
    log.mockRestore();
  });

  it('traces surface outputs through the completed ping-pong loop', async () => {
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
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({ preparedScene });

    const update = await run.advance();

    expect(update.status).toBe('complete');
    expect(run.passIndex).toBe(1);
    expect(run.processedRayCount).toBe(2);
    expect(run.currentRayBuffer).toEqual([
      expect.objectContaining({
        originX: 10,
        originY: 5,
        directionX: -1,
        directionY: 0,
        powerS: 0.004,
        powerP: 0.004,
        membership: new Uint8Array(0)
      })
    ]);
    expect(run.hitBuffer[0]).toMatchObject({
      s: Infinity,
      curveId: -1
    });
    log.mockRestore();
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
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({ preparedScene });

    const update = await advanceUntilPhase(run, 'render');

    expect(update.result.warning).toMatchObject({
      rayIndex: 0,
      curveId: 0,
      conflictingCurveId: 1,
      tolerance: {
        kind: 'interactionMerging',
        unit: 'sceneUnits',
        value: 0.001
      }
    });
    log.mockRestore();
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
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const preparedScene = await engine.prepare(processedScene);
    const run = await engine.createRun({ preparedScene });

    const update = await run.advance();

    expect(update.status).toBe('complete');
    expect(Array.from(update.result.detectors[0])).toEqual([1]);
    expect(run.currentRayBuffer[0]).toMatchObject({
      originX: 10,
      originY: 5,
      directionX: 1,
      directionY: 0
    });
    expect(run.hitBuffer[0]).toMatchObject({
      s: Infinity,
      curveId: -1
    });
    log.mockRestore();
  });
});
