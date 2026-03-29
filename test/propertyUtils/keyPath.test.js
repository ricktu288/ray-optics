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
  getForIfDefault,
  getByKeyPath,
  setByKeyPath,
  formatKeyPath,
  isNonDefault
} from '../../src/core/propertyUtils/keyPath.js';

describe('keyPath', () => {
  describe('getForIfDefault', () => {
    it('returns built-in defaults for reserved keys', () => {
      expect(getForIfDefault('for')).toEqual([]);
      expect(getForIfDefault('if')).toBe(true);
    });

    it('returns undefined for unknown keys', () => {
      expect(getForIfDefault('x')).toBeUndefined();
    });
  });

  describe('getByKeyPath', () => {
    it('returns root for empty path', () => {
      const o = { a: 1 };
      expect(getByKeyPath(o, '')).toBe(o);
    });

    it('reads nested properties and numeric array indices', () => {
      const o = { params: { r1: 2 }, path: [10, 20] };
      expect(getByKeyPath(o, 'params.r1')).toBe(2);
      expect(getByKeyPath(o, 'path.1')).toBe(20);
    });

    it('falls back to defaults when segment is missing', () => {
      const o = {};
      const defaults = { focalLength: 100 };
      expect(getByKeyPath(o, 'focalLength', defaults)).toBe(100);
    });

    it('uses for/if defaults when chain breaks on null parent', () => {
      expect(getByKeyPath({ x: null }, 'x.if')).toBe(true);
    });
  });

  describe('setByKeyPath', () => {
    it('rejects empty path', () => {
      expect(() => setByKeyPath({}, '', 1)).toThrow(/empty path/);
    });

    it('creates object intermediates and sets leaf', () => {
      const o = {};
      setByKeyPath(o, 'a.b', 7);
      expect(o).toEqual({ a: { b: 7 } });
    });

    it('creates array when next segment is numeric', () => {
      const o = {};
      setByKeyPath(o, 'items.0.val', 3);
      expect(o).toEqual({ items: [{ val: 3 }] });
    });

    it('materializes intermediate from defaults when missing', () => {
      const o = {};
      const defaults = { nested: { k: 1 } };
      setByKeyPath(o, 'nested.k', 2, defaults);
      expect(o.nested.k).toBe(2);
    });

    it('deletes property when value equals explicit default', () => {
      const o = { x: 5 };
      const defaults = { x: 5 };
      setByKeyPath(o, 'x', 5, defaults);
      expect(o).toEqual({});
    });

    it('deletes when value matches built-in if default', () => {
      const o = { branch: { if: false } };
      setByKeyPath(o, 'branch.if', true);
      expect(o.branch).toEqual({});
    });
  });

  describe('formatKeyPath', () => {
    it('returns empty string for falsy path', () => {
      expect(formatKeyPath('')).toBe('');
    });

    it('uses bracket notation for indices and reserved keys', () => {
      expect(formatKeyPath('path.0.x')).toBe('path[0].x');
      expect(formatKeyPath('obj.if')).toBe('obj["if"]');
      expect(formatKeyPath('obj.for')).toBe('obj["for"]');
    });
  });

  describe('isNonDefault', () => {
    const serializableDefaults = { w: 1, n: 2 };

    it('is always true for non-basic descriptor types', () => {
      expect(
        isNonDefault({ p: { x: 0, y: 0 } }, { key: 'p', type: 'point' }, {})
      ).toBe(true);
      expect(isNonDefault({ e: 'x' }, { key: 'e', type: 'equation' }, {})).toBe(
        true
      );
    });

    it('compares basic values against serializableDefaults', () => {
      const d = { key: 'w', type: 'number' };
      expect(isNonDefault({ w: 1 }, d, serializableDefaults)).toBe(false);
      expect(isNonDefault({ w: 2 }, d, serializableDefaults)).toBe(true);
    });

    it('returns false when descriptor has no key', () => {
      expect(isNonDefault({ w: 9 }, { type: 'number' }, serializableDefaults)).toBe(
        false
      );
    });
  });
});
