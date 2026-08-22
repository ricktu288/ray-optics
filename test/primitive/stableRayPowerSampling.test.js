/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import {
  stableRaySamplingPhase,
  collectRayPowerQueue
} from '../../src/core/simulationEngines/stableRayPowerSampling.js';

describe('stable ray-power prefix sampling', () => {
  it('matches the WebGPU collector phase sequence', () => {
    expect(stableRaySamplingPhase(1)).toBeCloseTo(0.6591631174087524);
    expect(stableRaySamplingPhase(2)).toBeCloseTo(0.4784972667694092);
  });

  it('selects a stable representative from cumulative fractional weights', () => {
    const rays = Array.from({ length: 3 }, () => ({
      powerS: 0.001,
      powerP: 0.001
    }));

    const sampled = collectRayPowerQueue(rays, 0.01, 1, true);

    expect(sampled.rays).toEqual([rays[1]]);
    expect(sampled.rays[0]).toMatchObject({
      powerS: 0.005,
      powerP: 0.005
    });
    expect(sampled.weakRayCount).toBe(3);
    expect(sampled.weakRayPower).toBeCloseTo(0.006);
  });

  it('deterministically truncates weak rays without amplifying them', () => {
    const weak = { powerS: 0.001, powerP: 0.002 };
    const strong = { powerS: 0.006, powerP: 0.005 };

    const sampled = collectRayPowerQueue(
      [weak, strong], 0.01, 1, false
    );

    expect(sampled.rays).toEqual([strong]);
    expect(weak).toEqual({ powerS: 0.001, powerP: 0.002 });
    expect(sampled.weakRayCount).toBe(1);
    expect(sampled.weakRayPower).toBeCloseTo(0.003);
  });

  it('rejects non-boolean sampling options', () => {
    expect(() => collectRayPowerQueue([], 0.01, 1, 'sometimes'))
      .toThrow('rayPowerSampling');
  });

  it('stably compacts active full-weight rays and inactive holes', () => {
    const active = { powerS: 0.4, powerP: 0.1 };
    const sampled = collectRayPowerQueue([
      { powerS: 0, powerP: 0 },
      active,
      { powerS: 0, powerP: 0 }
    ], 0.01, 1);

    expect(sampled.rays).toEqual([active]);
    expect(sampled.weakRayCount).toBe(0);
    expect(sampled.weakRayPower).toBe(0);
  });
});
