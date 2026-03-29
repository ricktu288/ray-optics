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
  latexToMathJS,
  mathJSToLatex,
  equationValueToDisplay,
  equationDisplayToValue
} from '../../src/core/propertyUtils/equationConversion.js';

describe('equationConversion', () => {
  describe('latexToMathJS', () => {
    it('converts simple LaTeX to math.js text', () => {
      const s = latexToMathJS('x+y');
      expect(s).toMatch(/x/);
      expect(s).toMatch(/y/);
    });

    it('replaces cdot and frac markers', () => {
      expect(latexToMathJS('a\\cdot b')).toContain('*');
      expect(latexToMathJS('\\frac{1}{2}')).toContain('/');
    });
  });

  describe('mathJSToLatex', () => {
    it('round-trips a simple expression to TeX', () => {
      const tex = mathJSToLatex('a + b');
      expect(tex.length).toBeGreaterThan(0);
      expect(tex).toMatch(/a/i);
    });
  });

  describe('equationValueToDisplay', () => {
    it('treats nullish as supported empty display', () => {
      expect(equationValueToDisplay(undefined)).toEqual({
        supported: true,
        display: ''
      });
      expect(equationValueToDisplay(null)).toEqual({
        supported: true,
        display: ''
      });
    });

    it('rejects non-string values', () => {
      expect(equationValueToDisplay(1)).toEqual({ supported: false });
    });

    it('parses plain LaTeX without backticks', () => {
      const r = equationValueToDisplay('x+y');
      expect(r.supported).toBe(true);
      expect(typeof r.display).toBe('string');
    });

    it('extracts math.js from double-backtick storage', () => {
      expect(equationValueToDisplay('``sin(x)``')).toEqual({
        supported: true,
        display: 'sin(x)'
      });
    });

    it('returns unsupported for invalid LaTeX', () => {
      expect(equationValueToDisplay('\\notvalidlatex{{{')).toEqual({
        supported: false
      });
    });

    it('returns unsupported for malformed backtick usage', () => {
      expect(equationValueToDisplay('`single`')).toEqual({ supported: false });
    });
  });

  describe('equationDisplayToValue', () => {
    it('returns undefined for empty text', () => {
      expect(equationDisplayToValue('', false)).toBeUndefined();
    });

    it('wraps in double backticks for template mode', () => {
      expect(equationDisplayToValue('1+1', true)).toBe('``1+1``');
    });

    it('converts to LaTeX when not template', () => {
      const v = equationDisplayToValue('2+3', false);
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    });
  });
});
