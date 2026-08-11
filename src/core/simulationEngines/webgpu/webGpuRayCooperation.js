/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

/**
 * Select a scene-specialized tracing strategy from the current active-ray
 * count and primitive count. The constants are deliberately supplied by the
 * engine config: the useful saturation point and direct/BVH crossover are
 * adapter-dependent.
 */
export function selectWebGpuRayCooperationStrategy({
  activeRayCount,
  primitiveCount,
  workgroupSize,
  neighborMode = false,
  config,
}) {
  if (!config.rayCooperationEnabled || activeRayCount <= 0) {
    return Object.freeze({ acceleration: 'bvh4', lanesPerRay: 1 });
  }
  const saturation = config.rayCooperationSaturationRayCount;
  let desiredLanes = Math.min(
    largestPowerOfTwoAtMost(Math.floor(saturation / activeRayCount)),
    largestPowerOfTwoAtMost(primitiveCount),
    largestPowerOfTwoAtMost(
      config.rayCooperationMaximumLanesPerRay
    ),
    largestPowerOfTwoDivisor(workgroupSize)
  );
  if (neighborMode) {
    while (
      desiredLanes > 1 &&
      haloFraction(workgroupSize, desiredLanes) >
        config.rayCooperationMaximumHaloFraction
    ) {
      desiredLanes /= 2;
    }
  }

  const directTestsPerLane = primitiveCount / desiredLanes;
  const useDirect = directTestsPerLane <=
    config.rayCooperationDirectMaxTestsPerLane;
  return Object.freeze({
    acceleration: useDirect ? 'direct' : 'bvh4',
    lanesPerRay: desiredLanes,
  });
}

export function cooperativeRayPayload(
  workgroupSize,
  lanesPerRay,
  neighborMode = false
) {
  const raySlots = Math.floor(workgroupSize / lanesPerRay);
  return Math.max(0, raySlots - (neighborMode ? 2 : 0));
}

function haloFraction(workgroupSize, lanesPerRay) {
  return 2 / Math.floor(workgroupSize / lanesPerRay);
}

function largestPowerOfTwoDivisor(value) {
  let result = 1;
  while (value % (result * 2) === 0) result *= 2;
  return result;
}

function largestPowerOfTwoAtMost(value) {
  let result = 1;
  while (result * 2 <= value) result *= 2;
  return result;
}
