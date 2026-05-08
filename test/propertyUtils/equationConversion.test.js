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

/**
 * User-facing supported sets come from the equation info boxes in the object bar:
 * - sceneObjs.common.eqnInfo (constants / operators / functions labels) in locales
 * - BaseGrinGlass.js populateObjBar: n(x,y) uses a shorter function list; α(x,y) uses the full list
 * - BaseCustomSurface.js populateObjBar: same full function list + parameter descriptions
 *
 * Constants: pi, e
 * Operators: + - * / ^
 * Functions (minimal, n(x,y) help): sqrt sin cos tan sec csc cot sinh cosh tanh log arcsin arccos arctan
 * Functions (extended, α / custom surface help): also exp arcsinh arccosh arctanh floor round ceil trunc sgn max min abs
 *
 * Typical variables (math.js spellings after LaTeX import where supported):
 * x, y, lambda, t; custom surfaces: theta_0, P_0, theta_10, P_10, theta_j, P_j, p, n_0, n_1; modules may add phi, etc.
 */

import * as math from 'mathjs';
import {
  latexToMathJS,
  mathJSToLatex,
  equationValueToDisplay,
  equationValueForListDisplay,
  equationDisplayToValue
} from '../../src/core/propertyUtils/equationConversion.js';

describe('equationConversion', () => {
  describe('latexToMathJS – documented LaTeX forms', () => {
    it('maps documented constants', () => {
      expect(latexToMathJS(String.raw`\pi`)).toBe('pi');
      expect(latexToMathJS('e')).toBe('e');
    });

    it('maps minimal trig and hyperbolic set from n(x,y) help', () => {
      expect(latexToMathJS(String.raw`\sqrt{x}`)).toBe('sqrt(x)');
      expect(latexToMathJS(String.raw`\sin(x)`)).toBe('sin(x)');
      expect(latexToMathJS(String.raw`\cos(x)`)).toBe('cos(x)');
      expect(latexToMathJS(String.raw`\tan(x)`)).toBe('tan(x)');
      expect(latexToMathJS(String.raw`\sec(x)`)).toBe('sec(x)');
      expect(latexToMathJS(String.raw`\csc(x)`)).toBe('csc(x)');
      expect(latexToMathJS(String.raw`\cot(x)`)).toBe('cot(x)');
      expect(latexToMathJS(String.raw`\sinh(x)`)).toBe('sinh(x)');
      expect(latexToMathJS(String.raw`\cosh(x)`)).toBe('cosh(x)');
      expect(latexToMathJS(String.raw`\tanh(x)`)).toBe('tanh(x)');
    });

    it('maps inverse trig using arcsin-style LaTeX to mathjs asin/acos/atan', () => {
      expect(latexToMathJS(String.raw`\arcsin(x)`)).toBe('asin(x)');
      expect(latexToMathJS(String.raw`\arccos(x)`)).toBe('acos(x)');
      expect(latexToMathJS(String.raw`\arctan(x)`)).toBe('atan(x)');
    });

    it('maps log: \\log is natural log (log)', () => {
      expect(latexToMathJS(String.raw`\log(x)`)).toBe('log(x)');
    });

    it('replaces cdot and frac after parse (same post-process as init pipeline)', () => {
      expect(latexToMathJS('a\\cdot b')).toContain('*');
      expect(latexToMathJS('\\frac{1}{2}')).toContain('/');
    });

    it('parses combined expression with x and y', () => {
      const s = latexToMathJS('x+y');
      expect(s).toMatch(/x/);
      expect(s).toMatch(/y/);
    });
  });

  describe('latexToMathJS – redundant parenthesis normalization', () => {
    it('collapses nested parens around a sum', () => {
      const tex = String.raw`\left(\left(a+b\right)\right)`;
      expect(latexToMathJS(tex)).toBe('(a + b)');
    });

    it('collapses nested parens in a function argument', () => {
      const tex = String.raw`\sin\left(\left(\left(x\right)\right)\right)`;
      expect(latexToMathJS(tex)).toBe('sin(x)');
    });

    it('does not strip the outer pair around a product of parenthesized sums', () => {
      const tex = String.raw`\left(\left(a+b\right)\cdot\left(c+d\right)\right)`;
      expect(latexToMathJS(tex)).toBe('((a + b) * (c + d))');
    });
  });

  describe('mathJSToLatex – math.js spellings for documented functions', () => {
    const cases = [
      ['sin(x)', '\\sin'],
      ['cos(x)', '\\cos'],
      ['tan(x)', '\\tan'],
      ['sec(x)', '\\sec'],
      ['csc(x)', '\\csc'],
      ['cot(x)', '\\cot'],
      ['sinh(x)', '\\sinh'],
      ['cosh(x)', '\\cosh'],
      ['tanh(x)', '\\tanh'],
      ['sqrt(x)', '\\sqrt'],
      ['asin(x)', '\\arcsin'],
      ['acos(x)', '\\arccos'],
      ['atan(x)', '\\arctan'],
      ['log(x)', '\\log'],
      ['exp(x)', '\\exp'],
      ['abs(x)', '\\left|'],
      ['acosh(x)', '\\operatorname{acosh}'],
      ['asinh(x)', '\\operatorname{asinh}'],
      ['atanh(x)', '\\operatorname{atanh}'],
      ['floor(x)', '\\operatorname{floor}'],
      ['ceil(x)', '\\operatorname{ceil}'],
      ['round(x)', '\\operatorname{round}'],
      ['sign(x)', '\\operatorname{sign}'],
      ['max(x,y)', '\\max'],
      ['min(x,y)', '\\min'],
      ['fix(x)', '\\operatorname{trunc}']
    ];

    it.each(cases)('%s contains %s', (expr, needle) => {
      expect(mathJSToLatex(expr)).toContain(needle);
    });
  });

  describe('mathJSToLatex – variable names used in GRIN, parametrized curves, custom surfaces, modules', () => {
    const cases = [
      ['x', 'x'],
      ['y', 'y'],
      ['lambda', '\\lambda'],
      ['t', 't'],
      ['p', 'p'],
      ['phi', '\\phi'],
      ['j', 'j'],
      ['theta_0', '\\theta_{0}'],
      ['theta_1', '\\theta_{1}'],
      ['theta_10', '\\theta_{10}'],
      ['n_0', 'n_{0}'],
      ['n_1', 'n_{1}'],
      ['P_0', 'P_{0}'],
      ['P_1', 'P_{1}'],
      ['P_10', 'P_{10}']
    ];

    it.each(cases)('%s → TeX includes %s', (ident, fragment) => {
      expect(mathJSToLatex(ident)).toContain(fragment);
    });
  });

  describe('latexToMathJS ⇄ mathJSToLatex round-trip (LaTeX storage path)', () => {
    // TeX from mathJSToLatex uses \\mathrm, \\operatorname, \\left…\\right, Greek, subscripts — importer must accept that output.
    const stable = [
      'sin(x)',
      'cos(x)',
      'tan(x)',
      'sec(x)',
      'csc(x)',
      'cot(x)',
      'sinh(x)',
      'cosh(x)',
      'tanh(x)',
      'sqrt(x)',
      'asin(x)',
      'acos(x)',
      'atan(x)',
      'abs(x)',
      'x + y',
      'fix(x)'
    ];

    it.each(stable)('%s', (expr) => {
      const tex = mathJSToLatex(expr);
      const back = latexToMathJS(tex);
      expect(math.parse(expr).equals(math.parse(back))).toBe(true);
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

  describe('equationValueForListDisplay', () => {
    it('matches equationValueToDisplay for supported LaTeX', () => {
      expect(equationValueForListDisplay('x+y')).toBe(latexToMathJS('x+y'));
    });

    it('extracts math.js from double-backtick storage', () => {
      expect(equationValueForListDisplay('``a+b``')).toBe('a+b');
    });

    it('returns raw string when LaTeX conversion fails', () => {
      const bad = '\\notvalidlatex{{{';
      expect(equationValueForListDisplay(bad)).toBe(bad);
    });

    it('returns empty string for null and undefined', () => {
      expect(equationValueForListDisplay(null)).toBe('');
      expect(equationValueForListDisplay(undefined)).toBe('');
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

  describe('latexToMathJS – editor / mathJSToLatex alignment', () => {
    it('Greek lambda from \\lambda', () => {
      expect(latexToMathJS(String.raw`\lambda`)).toBe('lambda');
    });

    it('subscript identifiers from TeX', () => {
      expect(latexToMathJS(String.raw`\theta_{0}`)).toContain('theta');
      expect(latexToMathJS(String.raw`P_{0}`)).toContain('P');
    });

    it('round-trips operatorname output from mathJSToLatex', () => {
      expect(latexToMathJS(mathJSToLatex('floor(x)'))).toContain('floor');
      expect(latexToMathJS(mathJSToLatex('sign(x)'))).toContain('sign');
    });

    it('maps \\operatorname{trunc} from MathQuill to math.js fix', () => {
      expect(latexToMathJS(String.raw`\operatorname{trunc}\left(x\right)`)).toBe('fix(x)');
    });

    it('round-trips exp / max / min from mathJSToLatex', () => {
      expect(latexToMathJS(mathJSToLatex('exp(x)'))).toContain('exp');
      expect(latexToMathJS(mathJSToLatex('max(x,y)'))).toContain('max');
    });
  });
});
