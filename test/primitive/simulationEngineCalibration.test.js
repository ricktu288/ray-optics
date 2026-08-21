/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import {
  estimateIntersectionCrossover,
  fitEngineSelectionCorrections,
  median,
  selectRayCooperationProfile,
} from '../../src/core/simulationEngines/calibration/fitCalibration.js';
import {
  getEndToEndCalibrationProbes,
  getRayCooperationCalibrationProbes,
} from '../../src/core/simulationEngines/calibration/probeScenes.js';
import Scene from '../../src/core/Scene.js';
import PrimitiveBasedSimulator from '../../src/core/PrimitiveBasedSimulator.js';
import CpuSimulationEngine from
  '../../src/core/simulationEngines/cpu/CpuSimulationEngine.js';

describe('simulation engine calibration fitting', () => {
  it('uses the median of measured samples', () => {
    expect(median([9, 1, 5])).toBe(5);
    expect(median([8, 2, 4, 6])).toBe(5);
  });

  it('selects the ray-cooperation profile by geometric mean', () => {
    const selected = selectRayCooperationProfile([
      {
        id: 'a',
        results: [{ medianMs: 4 }, { medianMs: 9 }],
      },
      {
        id: 'b',
        results: [{ medianMs: 5 }, { medianMs: 5 }],
      },
    ]);
    expect(selected.id).toBe('b');
  });

  it('estimates the intersection crossover from CPU/WebGPU ratios', () => {
    const cpuResults = [
      result('low', 10, 128, 4),
      result('high', 40, 2048, 4),
    ];
    const gpuResults = [
      result('low', 20, 128, 4),
      result('high', 20, 2048, 4),
    ];
    expect(estimateIntersectionCrossover({
      cpuResults,
      gpuResults,
      defaultThreshold: 1024,
    })).toBe(1024);
  });

  it('does not constrain the fitted crossover to a power of two', () => {
    const cpuResults = [
      result('low', 10, 100, 3),
      result('high', 40, 700, 5),
    ];
    const gpuResults = [
      result('low', 20, 100, 3),
      result('high', 20, 700, 5),
    ];
    const crossover = estimateIntersectionCrossover({
      cpuResults,
      gpuResults,
      defaultThreshold: 1024,
    });
    const expected = Math.sqrt(
      100 * Math.sqrt(3) * 700 * Math.sqrt(5)
    );
    expect(crossover).toBeCloseTo(expected);
    expect(Number.isInteger(crossover)).toBe(false);
  });

  it('moves the crossover below the probes when WebGPU wins throughout', () => {
    const cpuResults = [
      result('low', 30, 128, 4),
      result('high', 60, 512, 4),
    ];
    const gpuResults = [
      result('low', 10, 128, 4),
      result('high', 10, 512, 4),
    ];
    expect(estimateIntersectionCrossover({
      cpuResults,
      gpuResults,
      defaultThreshold: 1024,
    })).toBe(128);
  });

  it('fits an outgoing correction when branching makes WebGPU faster', () => {
    const cpuResults = [{
      ...result('branching', 240, 100, 1),
      colorMode: 'default',
      workload: {
        initialRayCount: 100,
        primitiveCurveCount: 1,
        additionalOutgoingRaySlotCount: 10,
        grinStepFactor: 0,
      },
    }];
    const gpuResults = [result('branching', 40, 100, 1)];
    const fitted = fitEngineSelectionCorrections({
      cpuResults,
      gpuResults,
      threshold: 1000,
      defaults: {
        outgoingCoefficient: 0,
        defaultRenderCoefficient: 0,
        nonDefaultRenderCoefficient: 0,
        grinStepCoefficient: 0,
      },
    });
    expect(fitted.outgoingCoefficient).toBeCloseTo(0.9);
  });

  it('fits a measured non-default rendering cost above the former cap', () => {
    const cpuResults = [{
      ...result('expensive-transfer', 240, 100, 1),
      colorMode: 'linear',
    }];
    const gpuResults = [result('expensive-transfer', 40, 100, 1)];
    const fitted = fitEngineSelectionCorrections({
      cpuResults,
      gpuResults,
      threshold: 2101,
      defaults: {
        outgoingCoefficient: 0,
        defaultRenderCoefficient: 0,
        nonDefaultRenderCoefficient: 0,
        grinStepCoefficient: 0,
      },
    });
    expect(fitted.nonDefaultRenderCoefficient).toBeCloseTo(20.01);
  });

  it('uses a low-density GRIN transition to prefer WebGPU', () => {
    const grinWorkload = initialRayCount => ({
      initialRayCount,
      primitiveCurveCount: 4,
      additionalOutgoingRaySlotCount: 4,
      grinStepFactor: 340,
    });
    const cpuResults = [{
      ...result('grin-small', 200, 5, 4),
      colorMode: 'default',
      workload: grinWorkload(5),
    }, {
      ...result('grin-authored', 1200, 290, 4),
      colorMode: 'default',
      workload: grinWorkload(290),
    }, {
      ...result('zoom', 1436, 40, 12),
      workload: {
        initialRayCount: 40,
        primitiveCurveCount: 12,
        additionalOutgoingRaySlotCount: 12,
        grinStepFactor: 0,
      },
    }];
    const gpuResults = [
      result('grin-small', 40, 5, 4),
      result('grin-authored', 68, 290, 4),
      result('zoom', 108, 40, 12),
    ];
    const threshold = 9586;
    const fitted = fitEngineSelectionCorrections({
      cpuResults,
      gpuResults,
      threshold,
      defaults: {
        outgoingCoefficient: 0,
        defaultRenderCoefficient: 0.25,
        nonDefaultRenderCoefficient: 0.25,
        grinStepCoefficient: 0.05,
      },
    });
    const smallGrinScore = grinWorkload(5).initialRayCount * (
      Math.sqrt(4) + fitted.outgoingCoefficient * 4 +
      fitted.defaultRenderCoefficient + fitted.grinStepCoefficient * 340
    );
    expect(fitted.grinStepCoefficient).toBeGreaterThan(1);
    expect(smallGrinScore).toBeGreaterThanOrEqual(threshold);
  });
});

describe('embedded calibration probes', () => {
  it('keeps a small, independent probe population with unique ids', () => {
    const cooperation = getRayCooperationCalibrationProbes();
    const endToEnd = getEndToEndCalibrationProbes();
    const ids = [...cooperation, ...endToEnd].map(probe => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(cooperation).toHaveLength(4);
    expect(endToEnd).toHaveLength(12);
    expect(endToEnd.some(probe =>
      probe.id === 'branched-flow-authored'
    )).toBe(true);
    expect(endToEnd.filter(probe =>
      probe.source === 'gallery/branched-flow'
    )).toHaveLength(5);
    expect(endToEnd.some(probe =>
      probe.id === 'circle-source-authored'
    )).toBe(true);
    expect(endToEnd.every(probe => probe.source && probe.variant)).toBe(true);
  });

  it('returns fresh scene data for every calibration run', () => {
    const first = getEndToEndCalibrationProbes();
    first[0].scene.objs.length = 0;
    expect(getEndToEndCalibrationProbes()[0].scene.objs.length).toBeGreaterThan(0);
  });

  it('loads and expands every embedded probe through the actual simulator', async () => {
    const probes = [
      ...getRayCooperationCalibrationProbes(),
      ...getEndToEndCalibrationProbes(),
    ];
    for (const probe of probes) {
      const scene = await loadScene(probe.scene);
      const simulator = new PrimitiveBasedSimulator({
        scene,
        engine: new CpuSimulationEngine(),
      });
      simulator.collectAndPreprocessPrimitives();
      expect(simulator.workload.initialRayCount).toBeGreaterThan(0);
      if (probe.id === 'intersection-very-small') {
        expect(simulator.workload.initialRayCount).toBe(128);
      }
      if (probe.id === 'branched-flow-0.01x') {
        expect(simulator.workload.initialRayCount).toBeLessThan(10);
        expect(simulator.workload.grinStepFactor).toBeGreaterThan(0);
      }
      expect(simulator.primitives.length).toBeGreaterThan(0);
      simulator.destroy();
    }
  });
});

function result(probeId, medianMs, initialRayCount, primitiveCurveCount) {
  return {
    probeId,
    medianMs,
    colorMode: 'linear',
    workload: {
      initialRayCount,
      primitiveCurveCount,
      additionalOutgoingRaySlotCount: 0,
      grinStepFactor: 0,
    },
  };
}

function loadScene(sceneJson) {
  const scene = new Scene();
  scene.setViewportSize(sceneJson.width, sceneJson.height);
  return new Promise(resolve => {
    scene.loadJSON(JSON.stringify(sceneJson), (_needFullUpdate, completed) => {
      if (completed) resolve(scene);
    });
  });
}
