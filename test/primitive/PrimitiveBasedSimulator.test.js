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

import PrimitiveBasedSimulator from '../../src/core/PrimitiveBasedSimulator';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric';
import i18next from 'i18next';
import Detector from '../../src/core/sceneObjs/other/Detector.js';

function createScene() {
  return {
    lengthScale: 1,
    numericalTolerances: {
      rayPowerCutoff: 1e-6,
      rayPowerCutoffMode: 'truncate'
    },
    colorMode: 'default',
    simulateColors: false,
    opticalObjs: []
  };
}

function createSimulator(engineKind, drawBvh) {
  return new PrimitiveBasedSimulator({
    scene: createScene(),
    engine: {
      kind: engineKind,
      numericEpsilon: FLOAT32_EPSILON
    },
    drawBvh
  });
}

function createProviderEngine(kind) {
  return {
    kind,
    numericEpsilon: kind === 'webgpu' ? FLOAT32_EPSILON : Number.EPSILON,
    dispose: jest.fn()
  };
}

describe('PrimitiveBasedSimulator engine registry', () => {
  it('lazily creates and retains engines when selection changes', () => {
    const cpu = createProviderEngine('primitiveCpu');
    const gpu = createProviderEngine('webgpu');
    const createCpu = jest.fn(() => cpu);
    const createGpu = jest.fn(() => gpu);
    const simulator = new PrimitiveBasedSimulator({
      scene: createScene(),
      enginePreference: 'automatic',
      engineProviders: {
        primitiveCpu: createCpu,
        webgpu: createGpu
      }
    });

    expect(simulator.engine).toBe(cpu);
    expect(createCpu).toHaveBeenCalledTimes(1);
    expect(createGpu).not.toHaveBeenCalled();

    simulator.activateEngine('webgpu');
    simulator.activateEngine('primitiveCpu');
    simulator.activateEngine('webgpu');

    expect(createCpu).toHaveBeenCalledTimes(1);
    expect(createGpu).toHaveBeenCalledTimes(1);
    expect(cpu.dispose).not.toHaveBeenCalled();
    simulator.destroy();
    expect(cpu.dispose).toHaveBeenCalledTimes(1);
    expect(gpu.dispose).toHaveBeenCalledTimes(1);
  });

  it('restarts a failed WebGPU scene revision on CPU', async () => {
    const cpu = createProviderEngine('primitiveCpu');
    const gpu = createProviderEngine('webgpu');
    const engineChanges = [];
    const simulator = new PrimitiveBasedSimulator({
      scene: createScene(),
      enginePreference: 'webgpu',
      engineProviders: {
        primitiveCpu: () => cpu,
        webgpu: () => gpu
      }
    });
    simulator.on('engineChange', event => engineChanges.push(event));
    simulator.runEngine = jest.fn()
      .mockRejectedValueOnce(new Error('storage limit'))
      .mockResolvedValueOnce(undefined);

    await simulator.startEngineRun(0);

    expect(simulator.runEngine).toHaveBeenCalledTimes(2);
    expect(simulator.engine).toBe(cpu);
    expect(simulator.engineFallbackActive).toBe(true);
    expect(engineChanges.at(-1)).toMatchObject({
      kind: 'primitiveCpu',
      previousKind: 'webgpu',
      fallback: true
    });
    expect(simulator.engineFallbackWarning).toBeTruthy();
    expect(gpu.dispose).not.toHaveBeenCalled();
  });
});

describe('PrimitiveBasedSimulator BVH diagnostics', () => {
  it('attaches diagnostics to the CPU scene object when visualization is enabled', () => {
    const simulator = createSimulator('primitiveCpu', true);

    simulator.collectAndPreprocessPrimitives();

    expect(simulator.processedScene.cpuBvhTraversalDiagnostics)
      .toMatchObject({
        nodeStates: expect.any(Uint8Array),
        testedCurves: expect.any(Uint8Array)
      });
  });

  it.each([
    ['primitiveCpu', false],
    ['webgpu', true]
  ])(
    'does not attach shared diagnostics for %s with drawBvh=%s',
    (engineKind, drawBvh) => {
      const simulator = createSimulator(engineKind, drawBvh);

      simulator.collectAndPreprocessPrimitives();

      expect(simulator.processedScene.cpuBvhTraversalDiagnostics)
        .toBeUndefined();
    }
  );

  it('publishes completed detector arrays through their result bindings', async () => {
    const simulator = createSimulator('primitiveCpu', false);
    const result = { values: null };
    simulator.detectorResultBindings = [{
      resultId: 0,
      result,
      resultSize: 2
    }];
    simulator.scene.origin = { x: 0, y: 0 };
    simulator.scene.scale = 1;
    simulator.scene.colorMode = 'default';
    simulator.scene.mode = 'rays';
    simulator.scene.simulateColors = false;
    simulator.scene.showRayArrows = false;
    simulator.scene.observer = null;
    const run = {
      advance: jest.fn(async () => ({
        status: 'complete',
        progress: {
          processedRayCount: 1,
          totalTruncation: 0
        },
        result: {
          detectors: [Float64Array.of(2, 3)]
        }
      })),
      dispose: jest.fn()
    };
    simulator.engine.prepare = jest.fn(async description => ({
      description
    }));
    simulator.engine.createRun = jest.fn(async () => run);
    simulator.updateSimulation = jest.fn();

    await simulator.runEngine(0);

    expect(simulator.engine.createRun).toHaveBeenCalledWith(
      expect.objectContaining({
        rayPowerCutoff: 1e-6,
        rayPowerCutoffMode: 'truncate'
      })
    );
    expect(result.values).toEqual(Float64Array.of(2, 3));
    expect(simulator.updateSimulation).toHaveBeenCalledWith(true, true);
    expect(run.dispose).toHaveBeenCalled();
  });

  it('publishes progress and detector readings on every paused update', async () => {
    const simulator = createSimulator('primitiveCpu', false);
    simulator.enableTimer = true;
    const result = { values: null };
    simulator.detectorResultBindings = [{
      resultId: 0,
      result,
      resultSize: 1
    }];
    simulator.scene.origin = { x: 0, y: 0 };
    simulator.scene.scale = 1;
    simulator.scene.colorMode = 'default';
    simulator.scene.mode = 'rays';
    simulator.scene.simulateColors = false;
    simulator.scene.showRayArrows = false;
    simulator.scene.observer = null;
    const updates = [{
      status: 'running',
      progress: {
        processedRayCount: 4,
        totalTruncation: 0.25
      },
      result: {
        detectors: [Float64Array.of(2)]
      }
    }, {
      status: 'complete',
      progress: {
        processedRayCount: 7,
        totalTruncation: 0.5
      },
      result: {
        detectors: [Float64Array.of(3)]
      }
    }];
    const run = {
      advance: jest.fn(async () => updates.shift()),
      dispose: jest.fn()
    };
    simulator.engine.prepare = jest.fn(async description => ({
      description
    }));
    simulator.engine.createRun = jest.fn(async () => run);
    simulator.updateSimulation = jest.fn();
    const pauseSnapshots = [];
    simulator.on('simulationPause', () => {
      pauseSnapshots.push({
        processedRayCount: simulator.processedRayCount,
        totalTruncation: simulator.totalTruncation,
        brightnessScale: simulator.brightnessScale,
        detectorValues: Array.from(result.values)
      });
    });

    await simulator.runEngine(0);

    expect(pauseSnapshots).toEqual([{
      processedRayCount: 4,
      totalTruncation: 0.25,
      brightnessScale: 0,
      detectorValues: [2]
    }]);
    expect(simulator.updateSimulation).toHaveBeenNthCalledWith(
      1,
      true,
      true
    );
    expect(simulator.updateSimulation).toHaveBeenNthCalledWith(
      2,
      true,
      true
    );
    expect(result.values).toEqual(Float64Array.of(3));
    expect(simulator.processedRayCount).toBe(7);
    expect(simulator.totalTruncation).toBe(0.5);
    expect(simulator.brightnessScale).toBe(0);
  });

  it('reports a consistent mapped brightness scale to simulator status', () => {
    const simulator = createSimulator('primitiveCpu', false);
    simulator.scene.opticalObjs = [
      createMappedObject('PointSource', 0.5),
      createMappedObject('Beam', 0.5)
    ];

    simulator.collectAndPreprocessPrimitives();

    expect(simulator.brightnessScale).toBe(0.5);
    expect(simulator.warning).toBeNull();
  });

  it('reports the legacy inconsistent-brightness warning after mapping', () => {
    const simulator = createSimulator('primitiveCpu', false);
    simulator.scene.opticalObjs = [
      createMappedObject('PointSource', 0.5),
      createMappedObject('Beam', 0.25),
      createDetector(simulator.scene)
    ];

    simulator.collectAndPreprocessPrimitives();

    expect(simulator.brightnessScale).toBe(-1);
    expect(simulator.warning).toBe(
      i18next.t('simulator:generalWarnings.brightnessInconsistent')
    );
  });

  it('does not count a Detector object which produces no detector primitive', () => {
    const simulator = createSimulator('primitiveCpu', false);
    simulator.scene.opticalObjs = [
      createMappedObject('PointSource', 0.5),
      createMappedObject('Beam', 0.25),
      createMappedObject('Detector', null)
    ];

    simulator.collectAndPreprocessPrimitives();

    expect(simulator.brightnessScale).toBe(-1);
    expect(simulator.warning).toBeNull();
  });

  it('ignores mapped brightness scales outside legacy color mode', () => {
    const simulator = createSimulator('primitiveCpu', false);
    simulator.scene.colorMode = 'linear';
    simulator.scene.opticalObjs = [
      createMappedObject('PointSource', 0.5),
      createMappedObject('Beam', 0.25)
    ];

    simulator.collectAndPreprocessPrimitives();

    expect(simulator.brightnessScale).toBe(0);
    expect(simulator.warning).toBeNull();
  });
});

describe('PrimitiveBasedSimulator engine warnings', () => {
  it('surfaces a structured tolerance warning', () => {
    const simulator = createSimulator('primitiveCpu', false);

    simulator.publishRunUpdate({
      progress: {},
      result: {
        warning: {
          rayIndex: 3,
          curveId: 4,
          conflictingCurveId: 7,
          tolerance: {
            kind: 'interactionMerging',
            unit: 'sceneUnits',
            value: 2e-4
          }
        }
      }
    });

    expect(simulator.engineWarning.tolerance).toEqual({
      kind: 'interactionMerging',
      unit: 'sceneUnits',
      value: 2e-4
    });
    expect(simulator.warning).toBe(
      '{{simulator:generalWarnings.primitiveInteractionConflict}}'
    );
  });

  it('marks curve IDs with namespaced diagnostic references', () => {
    const simulator = createSimulator('primitiveCpu', false);
    const originalTranslate = i18next.t;
    i18next.t = (key, options = {}) => {
      if (key === 'simulator:generalWarnings.primitiveInteractionConflict') {
        return `curves ${options.curveId} and ${options.conflictingCurveId}`;
      }
      return `{{${key}}}`;
    };

    try {
      simulator.publishRunUpdate({
        progress: {},
        result: {
          warning: {
            rayIndex: 3,
            curveId: 4,
            conflictingCurveId: 7,
            tolerance: {
              kind: 'interactionMerging',
              unit: 'sceneUnits',
              value: 2e-4
            }
          }
        }
      });

      expect(simulator.warning).toBe(
        'curves ⟦pc:4⟧ and ⟦pc:7⟧'
      );
    } finally {
      i18next.t = originalTranslate;
    }
  });

  it('shows the accumulated ambiguous power', () => {
    const simulator = createSimulator('primitiveCpu', false);
    const originalTranslate = i18next.t;
    i18next.t = (key, options = {}) => {
      if (key === 'simulator:generalWarnings.primitiveInteractionConflict') {
        return 'ambiguous interaction';
      }
      if (key === 'simulator:generalWarnings.primitiveAmbiguousPower') {
        return `ambiguous power ${options.power}`;
      }
      return `{{${key}}}`;
    };

    try {
      simulator.publishRunUpdate({
        progress: {},
        result: {
          warning: {
            rayIndex: 3,
            curveId: 4,
            conflictingCurveId: 7,
            ambiguousPower: 0.00125,
            tolerance: {
              kind: 'interactionMerging',
              unit: 'sceneUnits',
              value: 2e-4
            }
          }
        }
      });

      expect(simulator.warning).toBe(
        'ambiguous interaction ambiguous power 1.250000e-3'
      );
    } finally {
      i18next.t = originalTranslate;
    }
  });
});

function createMappedObject(type, brightnessScale) {
  return {
    brightnessScale: null,
    constructor: { type },
    getPrimitives() {
      this.brightnessScale = brightnessScale;
      return [];
    }
  };
}

function createDetector(scene) {
  const detector = new Detector(scene);
  detector.p1 = { x: 0, y: 0 };
  detector.p2 = { x: 10, y: 0 };
  return detector;
}
