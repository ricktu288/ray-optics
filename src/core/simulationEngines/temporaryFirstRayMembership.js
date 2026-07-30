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

const MAX_MEMBERSHIP_ATTEMPTS = 4;
const GOLDEN_ANGLE_COS = -0.737368878;
const GOLDEN_ANGLE_SIN = 0.675490294;

/**
 * Temporary first-source-ray membership path used until the CPU engine
 * performs full tracing. Ambiguous casts are reported but not retried.
 *
 * @param {Object} options
 * @returns {Object|null|undefined}
 */
export function runTemporaryFirstRayMembership({
  preparedScene,
  findMembership
}) {
  const ray = createFirstRay(preparedScene);
  if (!ray) {
    console.log('[Primitive CPU membership] The first source has no valid first ray.');
    return;
  }

  const testRays = [ray];
  let testRay = ray;
  let membership;
  for (let attempt = 0; attempt < MAX_MEMBERSHIP_ATTEMPTS; attempt++) {
    membership = findMembership(
      preparedScene.description,
      testRay,
      membership
    );
    if (membership.ambiguousCurveId < 0) break;

    console.warn(
      '[Primitive CPU membership] Ambiguous crossing for regions %s at curve %d on attempt %d.',
      formatRegionIds(membership.ambiguousRegionMask),
      membership.ambiguousCurveId,
      attempt + 1
    );
    if (attempt + 1 >= MAX_MEMBERSHIP_ATTEMPTS) break;

    const nextDirectionX =
      GOLDEN_ANGLE_COS * testRay.directionX -
      GOLDEN_ANGLE_SIN * testRay.directionY;
    const nextDirectionY =
      GOLDEN_ANGLE_SIN * testRay.directionX +
      GOLDEN_ANGLE_COS * testRay.directionY;
    testRay = {
      originX:
        testRay.originX +
        0.5 * membership.nearestForwardS * testRay.directionX,
      originY:
        testRay.originY +
        0.5 * membership.nearestForwardS * testRay.directionY,
      directionX: nextDirectionX,
      directionY: nextDirectionY
    };
    testRays.push(testRay);
  }
  preparedScene.description.temporaryFirstRayMembership = {
    testRays,
    membership
  };

  const regionIds = formatRegionIds(membership.regionMask);
  console.log(
    '[Primitive CPU membership] ray origin is inside regions: %s',
    regionIds
  );
  if (membership.ambiguousCurveId >= 0) {
    membership.discardRay = true;
    console.warn(
      '[Primitive CPU membership] Membership remains ambiguous after %d attempts; ray discarded.',
      testRays.length
    );
  }
  return membership;
}

function formatRegionIds(regionMask) {
  const regionIds = [];
  for (let regionId = 0; regionId < regionMask.length; regionId++) {
    if (regionMask[regionId]) regionIds.push(regionId);
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
