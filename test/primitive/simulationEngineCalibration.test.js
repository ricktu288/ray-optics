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
    expect(estimateIntersectionCrossover({
      cpuResults,
      gpuResults,
      defaultThreshold: 1024,
    })).toBe(521);
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
    expect(fitted.outgoingCoefficient).toBe(1);
  });
});

describe('embedded calibration probes', () => {
  it('keeps a small, independent probe population with unique ids', () => {
    const cooperation = getRayCooperationCalibrationProbes();
    const endToEnd = getEndToEndCalibrationProbes();
    const ids = [...cooperation, ...endToEnd].map(probe => probe.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(cooperation).toHaveLength(4);
    expect(endToEnd).toHaveLength(8);
    expect(endToEnd.some(probe =>
      probe.id === 'branched-flow-authored'
    )).toBe(true);
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
