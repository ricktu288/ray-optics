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
  buildBvh,
  DEFAULT_BVH_OPTIONS
} from '../../src/core/primitive/bvh.js';

function lineEntry(id, x1, y1, x2, y2, objectId = id) {
  return {
    id,
    objectId,
    curve: {
      kind: 'lineSegment',
      params: {
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 }
      }
    }
  };
}

function getLeafEntryIds(tree) {
  return tree.nodes
    .filter(node => node.count > 0)
    .map(node => tree.entries
      .slice(node.start, node.start + node.count)
      .map(entry => entry.id)
      .sort());
}

describe('primitive BVH', () => {
  it('exposes the adaptive-builder defaults', () => {
    expect(DEFAULT_BVH_OPTIONS).toEqual({
      maxLeafSize: 4,
      maxGroupExtent: 100,
      consecutiveLocalityFactor: 2
    });
  });

  it('groups spatially local, non-touching curves across object boundaries', () => {
    const tree = buildBvh([
      lineEntry('front', 0, 0, 8, 0, 'cell-front'),
      lineEntry('back', 0, 4, 8, 4, 'cell-back'),
      lineEntry('distant', 1000, 0, 1008, 0, 'other')
    ], {
      maxGroupExtent: 2000
    });

    expect(getLeafEntryIds(tree)).toEqual(expect.arrayContaining([
      ['back', 'front'],
      ['distant']
    ]));
  });

  it('uses bounds locality for curves without endpoints', () => {
    const tree = buildBvh([
      {
        id: 'circle-a',
        curve: {
          kind: 'circle',
          params: {
            center: { x: 0, y: 0 },
            radius: 2
          }
        }
      },
      {
        id: 'circle-b',
        curve: {
          kind: 'circle',
          params: {
            center: { x: 6, y: 0 },
            radius: 2
          }
        }
      }
    ], {
      maxGroupExtent: 100
    });

    expect(getLeafEntryIds(tree)).toEqual([['circle-a', 'circle-b']]);
  });

  it('splits a spatial run at the configured maximum group extent', () => {
    const entries = [
      lineEntry(0, 0, 0, 10, 0),
      lineEntry(1, 10, 0, 20, 0),
      lineEntry(2, 20, 0, 30, 0),
      lineEntry(3, 30, 0, 40, 0)
    ];

    const smallGroups = buildBvh(entries, {
      maxGroupExtent: 10
    });
    const oneGroup = buildBvh(entries, {
      maxGroupExtent: 40
    });

    expect(getLeafEntryIds(smallGroups)).toEqual([
      [0],
      [1],
      [2],
      [3]
    ]);
    expect(getLeafEntryIds(oneGroup)).toEqual([[0, 1, 2, 3]]);
  });

  it('assigns depth from the final Morton root', () => {
    const tree = buildBvh([
      lineEntry(0, 0, 0, 1, 0),
      lineEntry(1, 100, 0, 101, 0),
      lineEntry(2, 200, 0, 201, 0)
    ]);

    expect(tree.nodes[tree.root].depth).toBe(0);
    for (const node of tree.nodes) {
      if (node.count > 0) continue;
      expect(tree.nodes[node.left].depth).toBe(node.depth + 1);
      expect(tree.nodes[node.right].depth).toBe(node.depth + 1);
    }
  });
});
