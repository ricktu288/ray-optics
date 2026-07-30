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

import {
  runTemporaryFirstRayMembership
} from '../../src/core/simulationEngines/temporaryFirstRayMembership';

describe('temporary first-ray membership retry', () => {
  it('reuses result storage and retains all four attempted rays', () => {
    const description = {
      sources: [{
        sourceTypeId: 0,
        params: {},
        rayCount: 1
      }]
    };
    const preparedScene = {
      description,
      sourceEvaluators: [() => ({
        x: 0,
        y: 0,
        d_x: 1,
        d_y: 0,
        P_s: 1,
        P_p: 0,
        lambda: 540
      })]
    };
    const findMembership = jest.fn((_, __, result) => {
      const output = result ?? {
        regionMask: Uint8Array.of(0),
        ambiguousRegionMask: Uint8Array.of(1),
        ambiguousCurveId: 3,
        nearestForwardS: 2
      };
      output.ambiguousCurveId = 3;
      output.nearestForwardS = 2;
      return output;
    });
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const membership = runTemporaryFirstRayMembership({
      preparedScene,
      findMembership
    });

    const { testRays } = description.temporaryFirstRayMembership;
    expect(membership.discardRay).toBe(true);
    expect(testRays).toHaveLength(4);
    expect(findMembership).toHaveBeenCalledTimes(4);
    expect(findMembership.mock.calls[0][2]).toBeUndefined();
    for (let attempt = 1; attempt < 4; attempt++) {
      expect(findMembership.mock.calls[attempt][2]).toBe(membership);
    }
    expect(testRays[0]).toMatchObject({
      originX: 0,
      originY: 0,
      directionX: 1,
      directionY: 0
    });
    expect(testRays[1]).toMatchObject({
      originX: 1,
      originY: 0,
      directionX: -0.737368878,
      directionY: 0.675490294
    });
    expect(warn).toHaveBeenLastCalledWith(
      '[Primitive CPU membership] Membership remains ambiguous after %d attempts; ray discarded.',
      4
    );
    log.mockRestore();
    warn.mockRestore();
  });
});
