/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {
  getPrimitiveEngineWorkloadScore,
  selectPrimitiveEngineKind,
  summarizePrimitiveWorkload
} from '../../src/core/simulationEngines/primitiveEngineSelection';

describe('primitive engine selection', () => {
  it('counts source rays and every primitive curve in regions', () => {
    const workload = summarizePrimitiveWorkload([
      { kind: 'source', rayCount: 64 },
      { kind: 'surface', surfaceType: { outRayCount: 3 } },
      { kind: 'detector' },
      {
        kind: 'region', curves: [{
          kind: 'circle',
          params: { center: { x: 0, y: 0 }, radius: 100 }
        }, {}, {}], partialReflect: true,
        stepSize: 0.5
      }
    ]);
    expect(workload).toEqual({
      initialRayCount: 64,
      primitiveCurveCount: 5
    });
  });

  it('keeps source-only workloads on CPU because they have no intersections', () => {
    const choose = initialRayCount => selectPrimitiveEngineKind({
      workload: {
        primitiveCurveCount: 0,
        initialRayCount
      },
      isAvailable: () => true
    });
    expect(choose(1023)).toBe('primitiveCpu');
    expect(choose(1024)).toBe('primitiveCpu');
  });

  it('ignores branching, rendering, and GRIN metadata', () => {
    const base = { primitiveCurveCount: 4, initialRayCount: 500 };
    expect(getPrimitiveEngineWorkloadScore({
      ...base,
      additionalOutgoingRaySlotCount: 1000,
      grinStepFactor: 1000,
      colorMode: 'linear'
    })).toBe(1000);
    expect(selectPrimitiveEngineKind({
      workload: base,
      isAvailable: () => true
    })).toBe('primitiveCpu');
  });

  it('uses the calibrated ray-count times square-root-curve-count rule', () => {
    const choose = (primitiveCurveCount, initialRayCount) =>
      selectPrimitiveEngineKind({
        workload: { primitiveCurveCount, initialRayCount },
        isAvailable: () => true
      });
    expect(choose(1, 1023)).toBe('primitiveCpu');
    expect(choose(1, 1024)).toBe('webgpu');
    expect(choose(16, 255)).toBe('primitiveCpu');
    expect(choose(16, 256)).toBe('webgpu');
    expect(choose(0, 1023)).toBe('primitiveCpu');
    expect(choose(0, 1024)).toBe('primitiveCpu');
  });

  it('honors forced engines and avoids unavailable WebGPU automatically', () => {
    const workload = { primitiveCurveCount: 4096, initialRayCount: 4096 };
    expect(selectPrimitiveEngineKind({
      preference: 'primitiveCpu', workload, isAvailable: () => true
    })).toBe('primitiveCpu');
    expect(selectPrimitiveEngineKind({
      preference: 'webgpu', workload, isAvailable: () => false
    })).toBe('webgpu');
    expect(selectPrimitiveEngineKind({
      workload, isAvailable: () => false
    })).toBe('primitiveCpu');
  });
});
