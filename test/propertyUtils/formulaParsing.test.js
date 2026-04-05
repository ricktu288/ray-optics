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
  splitTopLevelCommas,
  valueToFormulaDisplay,
  formulaDisplayToValue,
  isFormula,
  isFormulaValueSupported
} from '../../src/core/propertyUtils/formulaParsing.js';

describe('formulaParsing', () => {
  describe('splitTopLevelCommas', () => {
    it('splits only commas at nesting depth zero', () => {
      expect(splitTopLevelCommas('a, b(c,d), e')).toEqual(['a', 'b(c,d)', 'e']);
    });

    it('respects bracket and brace nesting', () => {
      expect(splitTopLevelCommas('[1,2],{x:3, y:4}')).toEqual(['[1,2]', '{x:3, y:4}']);
    });

    it('trims parts and handles no commas', () => {
      expect(splitTopLevelCommas('  foo  ')).toEqual(['foo']);
      expect(splitTopLevelCommas('')).toEqual(['']);
    });

    it('never lets depth go negative on extra closers', () => {
      expect(splitTopLevelCommas('a),b')).toEqual(['a)', 'b']);
    });
  });

  describe('valueToFormulaDisplay', () => {
    it('unwraps single backtick formula strings', () => {
      expect(valueToFormulaDisplay('`x+1`')).toBe('x+1');
    });

    it('returns plain numbers and other primitives as strings', () => {
      expect(valueToFormulaDisplay(3.5)).toBe('3.5');
      expect(valueToFormulaDisplay(true)).toBe('true');
    });

    it('returns empty string for nullish', () => {
      expect(valueToFormulaDisplay(undefined)).toBe('');
      expect(valueToFormulaDisplay(null)).toBe('');
    });
  });

  describe('formulaDisplayToValue', () => {
    it('returns undefined for empty text', () => {
      expect(formulaDisplayToValue('')).toBeUndefined();
    });

    it('parses numeric literals for number type', () => {
      expect(formulaDisplayToValue('-2.5')).toBe(-2.5);
    });

    it('wraps non-numeric number-type text in backticks', () => {
      expect(formulaDisplayToValue('x+1')).toBe('`x+1`');
    });

    it('parses boolean literals', () => {
      expect(formulaDisplayToValue('true', 'boolean')).toBe(true);
      expect(formulaDisplayToValue('false', 'boolean')).toBe(false);
    });

    it('wraps other boolean-type text', () => {
      expect(formulaDisplayToValue('maybe', 'boolean')).toBe('`maybe`');
    });
  });

  describe('isFormula', () => {
    it('returns false for empty text', () => {
      expect(isFormula('')).toBe(false);
    });

    it('detects non-numeric number display as formula', () => {
      expect(isFormula('2+2')).toBe(true);
      expect(isFormula('42')).toBe(false);
    });

    it('detects non-boolean boolean display as formula', () => {
      expect(isFormula('true', 'boolean')).toBe(false);
      expect(isFormula('0', 'boolean')).toBe(true);
    });
  });

  describe('isFormulaValueSupported', () => {
    it('allows nullish and matching native types', () => {
      expect(isFormulaValueSupported(undefined)).toBe(true);
      expect(isFormulaValueSupported(null)).toBe(true);
      expect(isFormulaValueSupported(1)).toBe(true);
      expect(isFormulaValueSupported(true, 'boolean')).toBe(true);
    });

    it('allows only backtick-wrapped strings', () => {
      expect(isFormulaValueSupported('`x`')).toBe(true);
      expect(isFormulaValueSupported('plain')).toBe(false);
    });
  });
});
