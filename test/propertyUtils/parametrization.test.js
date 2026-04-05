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
  isPointHardcoded,
  templatePointLockState
} from '../../src/core/propertyUtils/parametrization.js';

describe('parametrization', () => {
  describe('isPointHardcoded', () => {
    it('returns false for nullish or non-objects', () => {
      expect(isPointHardcoded(undefined)).toBe(false);
      expect(isPointHardcoded(null)).toBe(false);
      expect(isPointHardcoded('p')).toBe(false);
    });

    it('returns false when x or y are not numbers', () => {
      expect(isPointHardcoded({ x: 1, y: '`a`' })).toBe(false);
      expect(isPointHardcoded({ x: '1', y: 2 })).toBe(false);
    });

    it('treats origin as not hardcoded', () => {
      expect(isPointHardcoded({ x: 0, y: 0 })).toBe(false);
    });

    it('returns true for non-origin numeric pair', () => {
      expect(isPointHardcoded({ x: 1, y: 2 })).toBe(true);
    });
  });

  describe('templatePointLockState', () => {
    const schema = [
      { key: 'p', type: 'point' },
      { key: 'q', type: 'point' }
    ];

    it('reports no points when schema has none', () => {
      expect(
        templatePointLockState({}, [{ key: 'n', type: 'number' }])
      ).toEqual({ hasPointProperties: false, allHardcoded: false });
    });

    it('returns allHardcoded when every point is numeric non-origin', () => {
      const data = { p: { x: 1, y: 0 }, q: { x: 0, y: 2 } };
      expect(templatePointLockState(data, schema)).toEqual({
        hasPointProperties: true,
        allHardcoded: true
      });
    });

    it('returns not allHardcoded when any point uses formulas or origin', () => {
      expect(
        templatePointLockState(
          { p: { x: 1, y: 2 }, q: { x: '`a`', y: 1 } },
          schema
        )
      ).toEqual({ hasPointProperties: true, allHardcoded: false });

      expect(
        templatePointLockState({ p: { x: 0, y: 0 } }, [{ key: 'p', type: 'point' }])
      ).toEqual({ hasPointProperties: true, allHardcoded: false });
    });

    it('expands array itemSchema to concrete indices', () => {
      const arrSchema = [
        {
          key: 'pts',
          type: 'array',
          itemSchema: [{ key: 'c', type: 'point' }]
        }
      ];
      const data = { pts: [{ c: { x: 3, y: 4 } }] };
      expect(templatePointLockState(data, arrSchema)).toEqual({
        hasPointProperties: true,
        allHardcoded: true
      });
    });
  });
});
