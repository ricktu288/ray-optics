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

  describe('mathJSToLatex – redundant parenthesis stripping in power and fraction', () => {
    it('a ^ (b + c): exponent has no redundant \\left( \\right)', () => {
      const tex = mathJSToLatex('a ^ (b + c)');
      expect(tex).toContain('^{');
      expect(tex).not.toMatch(/\^{[^}]*\\left\(/);
    });

    it('a ^ (b * c): exponent has no redundant parens', () => {
      const tex = mathJSToLatex('a ^ (b * c)');
      expect(tex).toContain('^{');
      expect(tex).not.toMatch(/\^{[^}]*\\left\(/);
    });

    it('(a + b) / c: numerator has no redundant parens', () => {
      const tex = mathJSToLatex('(a + b) / c');
      expect(tex).toContain('\\frac{');
      expect(tex).not.toMatch(/\\left\(/);
    });

    it('a / (b + c): denominator has no redundant parens', () => {
      const tex = mathJSToLatex('a / (b + c)');
      expect(tex).toContain('\\frac{');
      expect(tex).not.toMatch(/\\left\(/);
    });

    it('(a + b) / (c + d): both numerator and denominator have no redundant parens', () => {
      const tex = mathJSToLatex('(a + b) / (c + d)');
      expect(tex).toContain('\\frac{');
      expect(tex).not.toMatch(/\\left\(/);
    });

    it('(a + b) ^ 2: base parens are preserved', () => {
      const tex = mathJSToLatex('(a + b) ^ 2');
      expect(tex).toMatch(/\\left\(/);
    });

    it('a ^ (b / c): fraction exponent, no redundant parens', () => {
      const tex = mathJSToLatex('a ^ (b / c)');
      expect(tex).not.toMatch(/\\left\(/);
      expect(tex).toContain('^{');
      expect(tex).toContain('\\frac{');
    });

    it('round-trip: a ^ (b + c)', () => {
      const tex = mathJSToLatex('a ^ (b + c)');
      const back = latexToMathJS(tex);
      expect(math.parse('a ^ (b + c)').equals(math.parse(back))).toBe(true);
    });

    it('round-trip: (a + b) / c', () => {
      const tex = mathJSToLatex('(a + b) / c');
      const back = latexToMathJS(tex);
      expect(math.parse('(a + b) / c').equals(math.parse(back))).toBe(true);
    });

    it('round-trip: a ^ (b / c)', () => {
      const tex = mathJSToLatex('a ^ (b / c)');
      const back = latexToMathJS(tex);
      expect(math.parse('a ^ (b / c)').equals(math.parse(back))).toBe(true);
    });

    it('round-trip: (a + b) / (c + d)', () => {
      const tex = mathJSToLatex('(a + b) / (c + d)');
      const back = latexToMathJS(tex);
      expect(math.parse('(a + b) / (c + d)').equals(math.parse(back))).toBe(true);
    });

    it('round-trip: (a + b) ^ 2', () => {
      const tex = mathJSToLatex('(a + b) ^ 2');
      const back = latexToMathJS(tex);
      expect(math.parse('(a + b) ^ 2').equals(math.parse(back))).toBe(true);
    });
  });

  describe('latexToMathJS ⇄ mathJSToLatex round-trip (LaTeX storage path)', () => {
    // TeX from mathJSToLatex uses \\mathrm, \\operatorname, \\left…\\right, Greek, subscripts — importer must accept that output.
    // Comparisons use structural math.parse().equals(); unparenthesized chains of / or ^ normalize (e.g. a/b/c → (a/b)/c) so those are covered with explicit parens below.
    const roundTripCases = [
      // documented constants
      ['constant pi', 'pi'],
      ['constant e', 'e'],
      // unary trig / hyperbolic (single-arg)
      ['sin(x)', 'sin(x)'],
      ['cos(x)', 'cos(x)'],
      ['tan(x)', 'tan(x)'],
      ['sec(x)', 'sec(x)'],
      ['csc(x)', 'csc(x)'],
      ['cot(x)', 'cot(x)'],
      ['sinh(x)', 'sinh(x)'],
      ['cosh(x)', 'cosh(x)'],
      ['tanh(x)', 'tanh(x)'],
      ['sqrt(x)', 'sqrt(x)'],
      ['asin(x)', 'asin(x)'],
      ['acos(x)', 'acos(x)'],
      ['atan(x)', 'atan(x)'],
      ['asinh(x)', 'asinh(x)'],
      ['acosh(x)', 'acosh(x)'],
      ['atanh(x)', 'atanh(x)'],
      ['log(x)', 'log(x)'],
      ['exp(x)', 'exp(x)'],
      ['abs(x)', 'abs(x)'],
      ['floor(x)', 'floor(x)'],
      ['ceil(x)', 'ceil(x)'],
      ['round(x)', 'round(x)'],
      ['sign(x)', 'sign(x)'],
      ['fix(x)', 'fix(x)'],
      ['max two args', 'max(a, b)'],
      ['min two args', 'min(x, y)'],
      // binary operators
      ['sum x + y', 'x + y'],
      ['difference x - y', 'x - y'],
      ['product', 'a * b * c'],
      ['left-assoc subtraction chain', 'a - b - c'],
      ['sum chain', 'a + b + c'],
      // precedence: * over +/-
      ['mul binds tighter than add', 'a * b + c'],
      ['mul binds tighter than sub', 'a + b * c'],
      ['sub and mul', 'a - b * c'],
      ['mul and sub', 'a * b - c'],
      // precedence: ^ over * (and right grouping in exponent)
      ['pow vs mul (pow first)', 'a ^ b * c'],
      ['pow vs mul (mul first)', 'a * b ^ c'],
      ['pow of sum', '(a + b) ^ 2'],
      // unary minus
      ['unary minus symbol', '-x'],
      ['unary minus on sum', '-(a + b)'],
      // explicit associativity for / and ^ (unparenthesized chains re-print with extra parens)
      ['division left-assoc explicit', '(a / b) / c'],
      ['division right-assoc explicit', 'a / (b / c)'],
      ['power right-assoc explicit', '3 ^ (2 ^ 2)'],
      ['power left-assoc explicit', '(3 ^ 2) ^ 2'],
      // parentheses / mixing
      ['product of sums', '(a + b) * (c + d)'],
      ['difference of sums', '(a - b) * (c + d)'],
      ['polynomial', 'x^2 + 2*x + 1'],
      // nested functions
      ['sin of cos', 'sin(cos(x))'],
      ['log of exp', 'log(exp(x))'],
      ['sqrt of sum of squares', 'sqrt(x^2 + y^2)'],
      ['scaled trig', '2 * sin(x)'],
      ['trig sum', 'sin(x) + cos(y)'],
      ['trig squared', 'sin(x)^2'],
      ['trig of sum', 'sin(x + y)'],
      ['quotient of trig', 'sin(x) / cos(x)'],
      ['abs of trig', 'abs(sin(x))'],
      ['fix offset', 'fix(x) + 1'],
      ['nested min/max', 'min(max(a, b), c)'],
      ['inverse trig mix', 'acos(x) + asin(y)'],
      // Greek and subscripts (output uses \\theta_{0} etc.)
      ['theta_0 linear', 'theta_0 + x'],
      ['lambda and phi', 'lambda + phi'],
      ['n_0 and theta_1', 'n_0 * theta_1'],
      ['P subscripts', 'P_10 + P_0']
    ];

    it.each(roundTripCases)('%s', (_label, expr) => {
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

  describe('latexToMathJS – fraction and power parenthesization', () => {
    it('simple fraction: no parens on atomic numerator and denominator', () => {
      expect(latexToMathJS(String.raw`\frac{a}{b}`)).toBe('a / b');
    });

    it('numeric fraction: no parens', () => {
      expect(latexToMathJS(String.raw`\frac{1}{2}`)).toBe('1 / 2');
    });

    it('sum in numerator gets parens', () => {
      expect(latexToMathJS(String.raw`\frac{a+b}{c}`)).toBe('(a + b) / c');
    });

    it('sum in denominator gets parens', () => {
      expect(latexToMathJS(String.raw`\frac{a}{b+c}`)).toBe('a / (b + c)');
    });

    it('sums in both numerator and denominator get parens', () => {
      expect(latexToMathJS(String.raw`\frac{a+b}{c+d}`)).toBe('(a + b) / (c + d)');
    });

    it('product in numerator gets parens: \\frac{a\\cdot b}{c}', () => {
      expect(latexToMathJS(String.raw`\frac{a\cdot b}{c}`)).toBe('(a * b) / c');
    });

    it('multiply by fraction has no unnecessary parens: a\\cdot\\frac{b}{c}', () => {
      expect(latexToMathJS(String.raw`a\cdot\frac{b}{c}`)).toBe('a * b / c');
    });

    it('simple exponent: no parens on atom', () => {
      expect(latexToMathJS(String.raw`a^{b}`)).toBe('a ^ b');
    });

    it('numeric exponent: no parens', () => {
      expect(latexToMathJS(String.raw`a^{2}`)).toBe('a ^ 2');
    });

    it('fraction as exponent is grouped: a^{\\frac{b}{c}}', () => {
      expect(latexToMathJS(String.raw`a^{\frac{b}{c}}`)).toBe('a ^ (b / c)');
    });

    it('sum as exponent is grouped', () => {
      expect(latexToMathJS(String.raw`a^{b+c}`)).toBe('a ^ (b + c)');
    });

    it('product as exponent is grouped', () => {
      expect(latexToMathJS(String.raw`a^{b\cdot c}`)).toBe('a ^ (b * c)');
    });

    it('fraction with power in numerator', () => {
      expect(latexToMathJS(String.raw`\frac{a^{2}}{b}`)).toBe('(a ^ 2) / b');
    });

    it('power of a fraction', () => {
      expect(latexToMathJS(String.raw`\left(\frac{a}{b}\right)^{2}`)).toBe('(a / b) ^ 2');
    });

    it('fraction multiplied by fraction', () => {
      expect(latexToMathJS(String.raw`\frac{a}{b}\cdot\frac{c}{d}`)).toBe('a / b * c / d');
    });

    it('nested fraction in numerator', () => {
      expect(latexToMathJS(String.raw`\frac{\frac{a}{b}}{c}`)).toBe('(a / b) / c');
    });

    it('nested fraction in denominator', () => {
      expect(latexToMathJS(String.raw`\frac{a}{\frac{b}{c}}`)).toBe('a / (b / c)');
    });

    it('function call in numerator: no parens', () => {
      expect(latexToMathJS(String.raw`\frac{\sin(x)}{2}`)).toBe('sin(x) / 2');
    });

    it('sum plus fraction: a+\\frac{b}{c}', () => {
      expect(latexToMathJS(String.raw`a+\frac{b}{c}`)).toBe('a + b / c');
    });

    it('fraction plus fraction', () => {
      expect(latexToMathJS(String.raw`\frac{a}{b}+\frac{c}{d}`)).toBe('a / b + c / d');
    });

    it('power with negative exponent', () => {
      expect(latexToMathJS(String.raw`a^{-b}`)).toBe('a ^ (-b)');
    });

    it('power with compound fraction exponent: a^{\\frac{b+c}{d}}', () => {
      expect(latexToMathJS(String.raw`a^{\frac{b+c}{d}}`)).toBe('a ^ ((b + c) / d)');
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
