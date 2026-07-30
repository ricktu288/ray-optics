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

const RAY_COLOR = [1, 0.75, 0.1, 0.8];
const TEMPORARY_SEGMENT_LENGTH = 10;

/**
 * Temporary first-ray path used until the CPU engine performs full tracing.
 * BVH diagnostics are deliberately recorded by the traversal itself and drawn
 * by PrimitiveBasedSimulator, so removing this function will not remove the
 * diagnostic implementation.
 *
 * @param {Object} options
 * @returns {Object|null|undefined} The temporary interaction candidate.
 */
export function drawTemporaryFirstRay({
  preparedScene,
  viewport = {},
  colorMode = 'default',
  beginRenderer,
  findCandidate,
  conflictNames,
  normalConflictType
}) {
  const renderer = beginRenderer({
    origin: viewport.origin || { x: 0, y: 0 },
    scale: viewport.scale ?? 1,
    lengthScale: viewport.lengthScale ?? 1,
    colorMode
  });
  const ray = createFirstRay(preparedScene);
  if (!ray) {
    console.log('[Primitive CPU intersection] The first source has no valid first ray.');
    renderer?.flush?.();
    return;
  }

  const maximumDistance =
    TEMPORARY_SEGMENT_LENGTH * (viewport.lengthScale ?? 1);
  const candidate = findCandidate(
    preparedScene.description,
    ray,
    maximumDistance
  );
  if (renderer) {
    renderer.drawSegment({
      p1: { x: ray.originX, y: ray.originY },
      p2: {
        x: ray.originX + maximumDistance * ray.directionX,
        y: ray.originY + maximumDistance * ray.directionY
      }
    }, RAY_COLOR);
    renderer.flush?.();
  }

  if (!candidate) {
    console.log('[Primitive CPU intersection] No potential hits.');
    return null;
  }

  logCandidate(
    preparedScene.description,
    candidate,
    conflictNames,
    normalConflictType
  );
  return candidate;
}

function logCandidate(
  description,
  candidate,
  conflictNames,
  normalConflictType
) {
  const representativeCurve = description.curves[candidate.curveId];
  const discardRay = candidate.conflictType === normalConflictType;
  console.log(
    '[Primitive CPU candidate] curve %d (%s), owner=%s:%d, s=%s, u=%s, sigma=%s, regions=%s%s',
    candidate.curveId,
    representativeCurve.geometry.kind,
    representativeCurve.ownerKind,
    representativeCurve.ownerId,
    candidate.s,
    candidate.u,
    candidate.sigma,
    formatRegionIds(candidate.regionCrossingMask),
    discardRay ? ' [discard ray]' : ''
  );
  if (candidate.conflictType !== 0) {
    console.warn(
      '[Primitive CPU candidate] %s conflict at curve %d%s',
      conflictNames[candidate.conflictType],
      candidate.conflictCurveId,
      discardRay ? ' [discard ray]' : ''
    );
  }
}

function formatRegionIds(regionCrossingMask) {
  const regionIds = [];
  for (let regionId = 0; regionId < regionCrossingMask.length; regionId++) {
    if (regionCrossingMask[regionId]) regionIds.push(regionId);
  }
  return regionIds.length > 0 ? regionIds.join(',') : 'none';
}

function createFirstRay(preparedScene) {
  const source = preparedScene?.description?.sources?.[0];
  if (!source || !(source.rayCount > 0)) return null;

  const evaluate = preparedScene.sourceEvaluators[source.sourceTypeId];
  const output = evaluate({
    ...source.params,
    i: 0,
    N: source.rayCount
  });
  const directionLength = Math.hypot(output.d_x, output.d_y);
  if (
    !Number.isFinite(output.x) ||
    !Number.isFinite(output.y) ||
    !(directionLength > 0) ||
    !Number.isFinite(directionLength)
  ) {
    return null;
  }

  return {
    originX: output.x,
    originY: output.y,
    directionX: output.d_x / directionLength,
    directionY: output.d_y / directionLength,
    brightnessS: output.P_s,
    brightnessP: output.P_p,
    wavelength: output.lambda
  };
}
