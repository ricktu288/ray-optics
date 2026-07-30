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
  allocateInteractionIndexBuffers,
  createInteractionIndexBuffers,
  createInteractionTypeLayout,
  getInteractionTypeIndex
} from '../../src/core/simulationEngines/interactionIndexBuffers.js';

function createDescription() {
  return {
    types: {
      surfaces: [{
        definition: {
          name: 'Two-ray surface',
          outRayCount: 2
        }
      }],
      detectors: [{
        definition: {
          name: 'Power detector'
        }
      }]
    },
    surfaces: [{ surfaceTypeId: 0 }],
    detectors: [{ detectorTypeId: 0 }],
    regions: [
      { partialReflect: false },
      { partialReflect: true }
    ],
    curves: [
      { ownerKind: 'surface', ownerId: 0 },
      { ownerKind: 'detector', ownerId: 0 },
      { ownerKind: 'region', ownerId: 0 },
      { ownerKind: 'region', ownerId: 1 }
    ]
  };
}

describe('interaction index buffers', () => {
  it('creates fixed special and registered-type metadata', () => {
    const layout = createInteractionTypeLayout(
      createDescription()
    );

    expect(layout.types).toEqual([
      expect.objectContaining({
        kind: 'grinStep',
        outRayCount: 1
      }),
      expect.objectContaining({
        kind: 'regionBoundary',
        fresnel: false,
        outRayCount: 1
      }),
      expect.objectContaining({
        kind: 'regionBoundary',
        fresnel: true,
        outRayCount: 2
      }),
      expect.objectContaining({
        kind: 'surface',
        typeId: 0,
        name: 'Two-ray surface',
        outRayCount: 2
      }),
      expect.objectContaining({
        kind: 'detector',
        typeId: 0,
        name: 'Power detector',
        outRayCount: 1
      })
    ]);
  });

  it('classifies only interactions which produce outgoing slots', () => {
    const description = createDescription();
    const layout = createInteractionTypeLayout(description);
    const hit = (curveId, s, regionCrossingMask = Uint8Array.of(0, 0)) => ({
      curveId,
      s,
      regionCrossingMask
    });

    expect([
      getInteractionTypeIndex(
        description,
        layout,
        hit(-1, 2)
      ),
      getInteractionTypeIndex(
        description,
        layout,
        hit(-1, Infinity)
      ),
      getInteractionTypeIndex(
        description,
        layout,
        hit(-2, 2)
      ),
      getInteractionTypeIndex(
        description,
        layout,
        hit(0, 2)
      ),
      getInteractionTypeIndex(
        description,
        layout,
        hit(1, 2)
      ),
      getInteractionTypeIndex(
        description,
        layout,
        hit(2, 2, Uint8Array.of(1, 0))
      ),
      getInteractionTypeIndex(
        description,
        layout,
        hit(3, 2, Uint8Array.of(0, 1))
      )
    ]).toEqual([0, -1, -1, 3, 4, 1, 2]);
  });

  it('allocates slot-major destination ranges per type', () => {
    const layout = createInteractionTypeLayout(
      createDescription()
    );
    const buffers = createInteractionIndexBuffers(layout);
    const counts = [2, 1, 1, 2, 1];
    buffers.forEach((buffer, index) => {
      buffer.interactionCount = counts[index];
    });

    const destinationRayCount =
      allocateInteractionIndexBuffers(buffers);

    expect(destinationRayCount).toBe(10);
    expect(buffers.map(buffer =>
      Array.from(buffer.destinationRayStarts)
    )).toEqual([
      [0],
      [2],
      [3, 4],
      [5, 7],
      [9]
    ]);
    expect(buffers.map(buffer =>
      buffer.sourceRayIndices.length
    )).toEqual(counts);
  });
});
