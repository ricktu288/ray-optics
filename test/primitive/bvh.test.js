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

function cubicBezierEntry(id, x1, x2) {
  const third = (x2 - x1) / 3;
  return {
    id,
    curve: {
      kind: 'cubicBezier',
      params: {
        start: { x: x1, y: 0 },
        control1: { x: x1 + third, y: 0 },
        control2: { x: x2 - third, y: 0 },
        end: { x: x2, y: 0 }
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
  it('exposes the builder defaults', () => {
    expect(DEFAULT_BVH_OPTIONS).toEqual({
      lineLeafSize: 4,
      arcLeafSize: 2,
      cubicBezierLeafSize: 1,
      maxGroupExtent: 100,
      consecutiveLocalityFactor: 2
    });
  });

  it('packs line segments up to the configured leaf size', () => {
    const tree = buildBvh([
      lineEntry('front', 0, 0, 8, 0, 'cell-front'),
      lineEntry('back', 0, 4, 8, 4, 'cell-back'),
      lineEntry('distant', 1000, 0, 1008, 0, 'other')
    ], {
      maxGroupExtent: 2000
    });

    expect(getLeafEntryIds(tree)).toEqual([
      ['back', 'distant', 'front']
    ]);
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

  it('uses the configured maximum group extent to control spatial reordering', () => {
    const entries = [
      lineEntry(0, 0, 0, 10, 0),
      lineEntry(1, 100, 0, 110, 0),
      lineEntry(2, 10, 0, 20, 0),
      lineEntry(3, 110, 0, 120, 0)
    ];

    const smallGroups = buildBvh(entries, {
      maxGroupExtent: 20,
      consecutiveLocalityFactor: 1000
    });
    const oneGroup = buildBvh(entries, {
      maxGroupExtent: 1000,
      consecutiveLocalityFactor: 1000
    });

    expect(smallGroups.entries.map(entry => entry.id)).toEqual([0, 2, 1, 3]);
    expect(oneGroup.entries.map(entry => entry.id)).toEqual([0, 1, 2, 3]);
  });

  it('can pack curves into one leaf across consecutive-group boundaries', () => {
    const tree = buildBvh([
      lineEntry('first', 0, 0, 200, 0),
      lineEntry('second', 0, 0, 200, 0)
    ], {
      maxGroupExtent: 100
    });

    expect(getLeafEntryIds(tree)).toEqual([['first', 'second']]);
  });

  it('uses the configured size for each curve kind', () => {
    const lineEntries = [];
    const cubicEntries = [];
    for (let index = 0; index < 4; index++) {
      lineEntries.push(lineEntry(index, index * 10, 0, (index + 1) * 10, 0));
      cubicEntries.push(cubicBezierEntry(index, index * 10, (index + 1) * 10));
    }

    const lineTree = buildBvh(lineEntries);
    const cubicTree = buildBvh(cubicEntries);
    const largerCubicLeaves = buildBvh(cubicEntries, {
      cubicBezierLeafSize: 4
    });

    expect(getLeafEntryIds(lineTree)).toEqual([[0, 1, 2, 3]]);
    expect(getLeafEntryIds(cubicTree)).toEqual([[0], [1], [2], [3]]);
    expect(getLeafEntryIds(largerCubicLeaves)).toEqual([[0, 1, 2, 3]]);
  });

  it('combines per-kind capacities for mixed leaves', () => {
    const tree = buildBvh([
      lineEntry(0, 0, 0, 10, 0),
      lineEntry(1, 10, 0, 20, 0),
      {
        id: 2,
        curve: {
          kind: 'circle',
          params: {
            center: { x: 25, y: 0 },
            radius: 5
          }
        }
      },
      lineEntry(3, 30, 0, 40, 0)
    ]);

    expect(getLeafEntryIds(tree)).toEqual([
      [0, 1, 2],
      [3]
    ]);
  });

  it('assigns depth from the final Morton root', () => {
    const tree = buildBvh(Array.from(
      { length: 9 },
      (_, index) => lineEntry(index, index * 100, 0, index * 100 + 1, 0)
    ));

    expect(tree.nodes[tree.root].depth).toBe(0);
    for (const node of tree.nodes) {
      if (node.count > 0) continue;
      expect(tree.nodes[node.left].depth).toBe(node.depth + 1);
      expect(tree.nodes[node.right].depth).toBe(node.depth + 1);
    }
  });
});
