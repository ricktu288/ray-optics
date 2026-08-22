/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

export const DEFAULT_RAY_POWER_CUTOFF = 1e-6;
export const DEFAULT_RAY_POWER_SAMPLING = false;
export const DEFAULT_COLOR_RAY_POWER_CUTOFF = 0.01;

export function normalizeRayPowerCutoff(value) {
  const cutoff = value ?? DEFAULT_RAY_POWER_CUTOFF;
  if (
    typeof cutoff !== 'number' ||
    Number.isNaN(cutoff) ||
    cutoff < 0
  ) {
    throw new RangeError('rayPowerCutoff must be a nonnegative number.');
  }
  return cutoff;
}

export function normalizeRayPowerSampling(value) {
  const sampling = value ?? DEFAULT_RAY_POWER_SAMPLING;
  if (typeof sampling !== 'boolean') {
    throw new TypeError('rayPowerSampling must be a boolean.');
  }
  return sampling;
}

/**
 * Resolve the scene-facing weak-ray options. The default color renderer has
 * fixed effective values because it cannot faithfully display weaker rays.
 */
export function getEffectiveRayPowerOptions(options = {}) {
  if ((options.colorMode ?? 'default') === 'default') {
    return {
      rayPowerCutoff: DEFAULT_COLOR_RAY_POWER_CUTOFF,
      rayPowerSampling: true
    };
  }
  return {
    rayPowerCutoff: normalizeRayPowerCutoff(options.rayPowerCutoff),
    rayPowerSampling: normalizeRayPowerSampling(options.rayPowerSampling)
  };
}
