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
  drawTemporaryFirstRay
} from '../../src/core/simulationEngines/temporaryFirstRayIntersection';

describe('temporary first-ray intersection', () => {
  it('uses a ten-scene-unit segment', () => {
    const renderer = {
      drawSegment: jest.fn(),
      flush: jest.fn()
    };
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
        x: 3,
        y: 4,
        d_x: 0,
        d_y: 2,
        P_s: 1,
        P_p: 0,
        lambda: 540
      })]
    };
    const findCandidate = jest.fn(() => null);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    drawTemporaryFirstRay({
      preparedScene,
      viewport: { lengthScale: 2 },
      beginRenderer: () => renderer,
      findCandidate,
      conflictNames: [],
      normalConflictType: 3
    });

    expect(findCandidate).toHaveBeenCalledWith(
      description,
      expect.objectContaining({
        originX: 3,
        originY: 4,
        directionX: 0,
        directionY: 1
      }),
      20
    );
    expect(renderer.drawSegment.mock.calls[0][0]).toEqual({
      p1: { x: 3, y: 4 },
      p2: { x: 3, y: 24 }
    });
    log.mockRestore();
  });
});
