/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import { normalizeRayPowerSampling } from './rayPower.js';

/**
 * Match the deterministic phase used by the WebGPU stable queue collector.
 * All integer operations deliberately wrap to u32.
 */
export function stableRaySamplingPhase(generation) {
  let value = (
    Math.imul(generation >>> 0, 747796405) + 2891336453
  ) >>> 0;
  value = Math.imul(
    ((value >>> ((value >>> 28) + 4)) ^ value) >>> 0,
    277803737
  ) >>> 0;
  value = ((value >>> 22) ^ value) >>> 0;
  return (value >>> 8) / 16777216;
}

/**
 * Apply the selected weak-ray policy while compacting an outgoing queue.
 * Stable sampling matches the WebGPU weight/prefix/fill collector: weak rays
 * contribute fractional weight and retained representatives are amplified.
 * Truncation instead omits every weak ray. Both policies return the original
 * weak power for conservative error accounting.
 *
 * @param {Object[]} rays
 * @param {number} targetPower
 * @param {number} generation
 * @param {boolean} [sampling=false]
 * @returns {{rays:Object[], weakRayCount:number,weakRayPower:number}}
 */
export function collectRayPowerQueue(
  rays,
  targetPower,
  generation,
  sampling = false
) {
  const shouldSample = normalizeRayPowerSampling(sampling);
  const selected = [];
  let weakRayCount = 0;
  let weakRayPower = 0;
  let cumulative = 0;
  const phase = stableRaySamplingPhase(generation);

  for (const ray of rays) {
    const power = ray.powerS + ray.powerP;
    if (!(power > 0)) continue;
    const weight = targetPower > 0
      ? Math.min(1, power / targetPower)
      : 1;
    if (weight < 1) {
      weakRayCount++;
      weakRayPower += power;
      if (!shouldSample) continue;
    }
    const before = Math.floor(cumulative + phase);
    cumulative += weight;
    const after = Math.floor(cumulative + phase);
    if (after <= before) continue;
    if (weight < 1) {
      ray.powerS /= weight;
      ray.powerP /= weight;
    }
    selected.push(ray);
  }

  return { rays: selected, weakRayCount, weakRayPower };
}
