/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

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
 * Stable systematic sampling equivalent to the WebGPU weight/prefix/fill
 * collector. Inactive slots have zero weight. Rays below `targetPower`
 * contribute a fractional weight; a retained representative is amplified so
 * that its expected power equals the power of the sampled interval.
 *
 * @param {Object[]} rays
 * @param {number} targetPower
 * @param {number} generation
 * @returns {{rays:Object[], weakRayCount:number}}
 */
export function stableSampleRayQueue(rays, targetPower, generation) {
  const selected = [];
  let weakRayCount = 0;
  let cumulative = 0;
  const phase = stableRaySamplingPhase(generation);

  for (const ray of rays) {
    const power = ray.powerS + ray.powerP;
    if (!(power > 0)) continue;
    const weight = targetPower > 0
      ? Math.min(1, power / targetPower)
      : 1;
    if (weight < 1) weakRayCount++;
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

  return { rays: selected, weakRayCount };
}
