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

import * as math from 'mathjs';

const DOUBLE_BACKTICK_RE = /^``([\s\S]*)``$/;

/** LaTeX math-mode command (no leading \) → math.js symbol name */
const GREEK_SYMBOL = {
  // lowercase
  alpha: 'alpha',
  beta: 'beta',
  gamma: 'gamma',
  delta: 'delta',
  epsilon: 'epsilon',
  varepsilon: 'varepsilon',
  zeta: 'zeta',
  eta: 'eta',
  theta: 'theta',
  vartheta: 'vartheta',
  iota: 'iota',
  kappa: 'kappa',
  lambda: 'lambda',
  mu: 'mu',
  nu: 'nu',
  xi: 'xi',
  pi: 'pi',
  varpi: 'varpi',
  rho: 'rho',
  varrho: 'varrho',
  sigma: 'sigma',
  varsigma: 'varsigma',
  tau: 'tau',
  upsilon: 'upsilon',
  phi: 'phi',
  varphi: 'varphi',
  chi: 'chi',
  psi: 'psi',
  omega: 'omega',
  // uppercase (\Pi etc. — product symbol not distinguished here)
  Gamma: 'Gamma',
  Delta: 'Delta',
  Theta: 'Theta',
  Lambda: 'Lambda',
  Xi: 'Xi',
  Pi: 'Pi',
  Sigma: 'Sigma',
  Upsilon: 'Upsilon',
  Phi: 'Phi',
  Psi: 'Psi',
  Omega: 'Omega'
};

/** One-argument functions: LaTeX command → math.js name */
const FN1 = {
  sin: 'sin',
  cos: 'cos',
  tan: 'tan',
  sec: 'sec',
  csc: 'csc',
  cot: 'cot',
  sinh: 'sinh',
  cosh: 'cosh',
  tanh: 'tanh',
  arcsin: 'asin',
  arccos: 'acos',
  arctan: 'atan',
  arcsinh: 'asinh',
  arccosh: 'acosh',
  arctanh: 'atanh',
  asinh: 'asinh',
  acosh: 'acosh',
  atanh: 'atanh',
  ln: 'log',
  log: 'log10',
  exp: 'exp',
  sqrt: 'sqrt',
  floor: 'floor',
  ceil: 'ceil',
  round: 'round',
  sign: 'sign',
  sgn: 'sign',
  trunc: 'trunc'
};

const FN2 = new Set(['max', 'min']);

/**
 * Split a TeX fragment on commas that separate arguments at the current fence level:
 * `{…}` / `()` / `\left…\right` nesting increments/decrements; commas only split when all depths are 0.
 * @param {string} inner
 * @returns {string[]}
 */
function splitTexCommaArgs(inner) {
  const parts = [];
  let segStart = 0;
  let i = 0;
  let brace = 0;
  let rawParen = 0;
  let lr = 0;

  const skipSpaces = (j) => {
    let k = j;
    while (k < inner.length && /\s/.test(inner[k])) k++;
    return k;
  };

  while (i < inner.length) {
    const ch = inner[i];
    if (ch === '{') {
      brace++;
      i++;
      continue;
    }
    if (ch === '}') {
      brace--;
      i++;
      continue;
    }
    if (ch === '(') {
      rawParen++;
      i++;
      continue;
    }
    if (ch === ')') {
      rawParen--;
      i++;
      continue;
    }
    if (inner.startsWith('\\left', i)) {
      lr++;
      i += 5;
      i = skipSpaces(i);
      if (i < inner.length) i++;
      continue;
    }
    if (inner.startsWith('\\right', i)) {
      lr--;
      i += 6;
      i = skipSpaces(i);
      if (i < inner.length) i++;
      continue;
    }
    if (ch === ',' && brace === 0 && rawParen === 0 && lr === 0) {
      parts.push(inner.slice(segStart, i).trim());
      segStart = i + 1;
    }
    i++;
  }
  parts.push(inner.slice(segStart).trim());
  return parts;
}

class TexExprParser {
  /**
   * @param {string} s
   * @param {number} [start]
   * @param {number} [end]
   */
  constructor(s, start = 0, end = s.length) {
    this.s = s;
    this.i = start;
    this.end = end;
  }

  throwUnexpected() {
    throw new Error('Invalid or unsupported LaTeX in equation');
  }

  skipSpace() {
    while (this.i < this.end && /\s/.test(this.s[this.i])) {
      this.i++;
    }
  }

  atEnd() {
    this.skipSpace();
    return this.i >= this.end;
  }

  peek() {
    this.skipSpace();
    return this.i < this.end ? this.s[this.i] : '';
  }

  consumeExpected(c) {
    this.skipSpace();
    if (this.i >= this.end || this.s[this.i] !== c) this.throwUnexpected();
    this.i++;
  }

  startsWithWord(word) {
    return (
      this.s.startsWith(word, this.i) &&
      (this.i + word.length >= this.end || !/[a-zA-Z]/.test(this.s[this.i + word.length]))
    );
  }

  readBraceGroupRaw() {
    this.skipSpace();
    this.consumeExpected('{');
    let depth = 1;
    const outStart = this.i;
    while (this.i < this.end && depth > 0) {
      const ch = this.s[this.i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      this.i++;
    }
    if (depth !== 0) this.throwUnexpected();
    return this.s.slice(outStart, this.i - 1);
  }

  /** Parse one delimiter character after \left / \right (e.g. ( ) [ ] | .) */
  readOneDelim() {
    this.skipSpace();
    if (this.i >= this.end) this.throwUnexpected();
    return this.s[this.i++];
  }

  /**
   * After the `\\left` keyword has been consumed (`\\` + name), read the opening delimiter
   * and the body up to the matching `\\right`.
   * @returns {{ inner: string, open: string }}
   */
  readLeftRightBodyAfterLeftKeyword() {
    const open = this.readOneDelim();
    const innerStart = this.i;
    let depth = 1;
    while (depth > 0 && this.i < this.end) {
      if (this.startsWithWord('\\left')) {
        depth++;
        this.i += 5;
        this.readOneDelim();
        continue;
      }
      if (this.startsWithWord('\\right')) {
        depth--;
        if (depth === 0) {
          const inner = this.s.slice(innerStart, this.i).trim();
          this.i += 6;
          this.readOneDelim();
          return { inner, open };
        }
        this.i += 6;
        this.readOneDelim();
        continue;
      }
      this.i++;
    }
    this.throwUnexpected();
  }

  /** @returns {string} math.js subexpression */
  parseTop() {
    return this.parseAddSub();
  }

  parseAddSub() {
    let left = this.parseMulDiv();
    while (true) {
      this.skipSpace();
      if (this.i >= this.end) break;
      const op = this.s[this.i];
      if (op !== '+' && op !== '-') break;
      this.i++;
      const right = this.parseMulDiv();
      left = `${left} ${op} ${right}`;
    }
    return left;
  }

  parseMulDiv() {
    let left = this.parsePow();
    while (true) {
      this.skipSpace();
      if (this.i < this.end && this.startsWithWord('\\cdot')) {
        this.i += 5;
        left = `${left} * ${this.parsePow()}`;
        continue;
      }
      if (this.i < this.end && this.startsWithWord('\\times')) {
        this.i += 6;
        left = `${left} * ${this.parsePow()}`;
        continue;
      }
      if (this.i < this.end && this.s[this.i] === '*') {
        this.i++;
        left = `${left} * ${this.parsePow()}`;
        continue;
      }
      if (this.i < this.end && this.s[this.i] === '/') {
        this.i++;
        left = `${left} / ${this.parsePow()}`;
        continue;
      }
      if (this.implicitMultFollows()) {
        left = `${left} * ${this.parsePow()}`;
        continue;
      }
      break;
    }
    return left;
  }

  implicitMultFollows() {
    if (this.i >= this.end) return false;
    const c = this.s[this.i];
    if (c === '+' || c === '-' || c === ')' || c === '}' || c === ',' || c === '^' || c === '_') {
      return false;
    }
    if (c === '\\') {
      if (this.startsWithWord('\\cdot') || this.startsWithWord('\\times')) return false;
      return true;
    }
    return /[0-9(.]/.test(c) || /[a-zA-Z]/.test(c);
  }

  parsePow() {
    let left = this.parseUnary();
    this.skipSpace();
    if (this.i < this.end && this.s[this.i] === '^') {
      this.i++;
      let exp;
      this.skipSpace();
      if (this.peek() === '{') {
        const inner = this.readBraceGroupRaw();
        exp = new TexExprParser(inner, 0, inner.length).parseTop();
      } else if (this.i < this.end) {
        exp = this.parseUnary();
      } else this.throwUnexpected();
      left = `${left} ^ ${exp}`;
    }
    return left;
  }

  parseUnary() {
    this.skipSpace();
    let neg = false;
    while (this.i < this.end && (this.s[this.i] === '+' || this.s[this.i] === '-')) {
      if (this.s[this.i] === '-') neg = !neg;
      this.i++;
      this.skipSpace();
    }
    const v = this.parsePostfixScripts();
    return neg ? `- ${v}` : v;
  }

  parsePostfixScripts() {
    let v = this.parsePrimary();
    while (true) {
      this.skipSpace();
      if (this.i < this.end && this.s[this.i] === '_') {
        this.i++;
        this.skipSpace();
        let sub;
        if (this.peek() === '{') {
          const raw = this.readBraceGroupRaw();
          sub = new TexExprParser(raw, 0, raw.length).parseTop();
        } else if (this.i < this.end && /[a-zA-Z0-9]/.test(this.s[this.i])) {
          sub = this.s[this.i++];
        } else this.throwUnexpected();
        v = `${v}_${sub}`;
        continue;
      }
      break;
    }
    return v;
  }

  parsePrimary() {
    this.skipSpace();
    if (this.i >= this.end) this.throwUnexpected();

    if (this.s[this.i] === '(') {
      this.i++;
      const inner = this.parseTop();
      this.consumeExpected(')');
      return `(${inner})`;
    }

    if (this.s[this.i] === '{') {
      const raw = this.readBraceGroupRaw();
      return new TexExprParser(raw, 0, raw.length).parseTop();
    }

    if (/[0-9.]/.test(this.s[this.i])) return this.readNumber();

    if (/[a-zA-Z]/.test(this.s[this.i])) return this.readAsciiIdentifier();

    if (this.s[this.i] === '\\') return this.parseBackslash();

    this.throwUnexpected();
  }

  readNumber() {
    const start = this.i;
    while (this.i < this.end && /[0-9.]/.test(this.s[this.i])) this.i++;
    return this.s.slice(start, this.i);
  }

  readAsciiIdentifier() {
    const start = this.i;
    while (this.i < this.end && /[a-zA-Z0-9]/.test(this.s[this.i])) this.i++;
    return this.s.slice(start, this.i);
  }

  readCommandName() {
    if (this.s[this.i] !== '\\') this.throwUnexpected();
    this.i++;
    const start = this.i;
    while (this.i < this.end && /[a-zA-Z]/.test(this.s[this.i])) this.i++;
    if (start === this.i) this.throwUnexpected();
    return this.s.slice(start, this.i);
  }

  parseBackslash() {
    const cmd = this.readCommandName();

    if (cmd === 'left') {
      const { inner, open } = this.readLeftRightBodyAfterLeftKeyword();
      const p = new TexExprParser(inner, 0, inner.length);
      const body = p.parseTop();
      if (open === '|') return `abs(${body})`;
      return `(${body})`;
    }

    if (cmd === 'frac') {
      const a = this.readBraceGroupRaw();
      const b = this.readBraceGroupRaw();
      const ea = new TexExprParser(a, 0, a.length).parseTop();
      const eb = new TexExprParser(b, 0, b.length).parseTop();
      return `(${ea}) / (${eb})`;
    }

    if (cmd === 'sqrt') {
      this.skipSpace();
      if (this.peek() === '[') {
        this.i++;
        let idx = '';
        while (this.i < this.end && this.s[this.i] !== ']') idx += this.s[this.i++];
        this.consumeExpected(']');
        const raw = this.readBraceGroupRaw();
        const arg = new TexExprParser(raw, 0, raw.length).parseTop();
        return `nthRoot(${idx}, ${arg})`;
      }
      const raw = this.readBraceGroupRaw();
      const arg = new TexExprParser(raw, 0, raw.length).parseTop();
      return `sqrt(${arg})`;
    }

    if (cmd === 'cdot' || cmd === 'times') this.throwUnexpected();

    if (cmd === 'pi') return 'pi';

    if (cmd === 'operatorname') {
      const raw = this.readBraceGroupRaw().trim();
      if (FN1[raw]) {
        return this.parseFnCall(FN1[raw], raw);
      }
      if (FN2.has(raw)) {
        return this.parseFnCall(raw, raw);
      }
      this.throwUnexpected();
    }

    if (cmd === 'mathrm') {
      const raw = this.readBraceGroupRaw().trim();
      if (raw !== 'trunc') this.throwUnexpected();
      return this.parseFnCall('trunc', 'trunc');
    }

    if (Object.prototype.hasOwnProperty.call(GREEK_SYMBOL, cmd)) {
      return GREEK_SYMBOL[cmd];
    }

    if (FN2.has(cmd)) {
      return this.parseFnCall(cmd, cmd);
    }

    if (FN1[cmd]) {
      return this.parseFnCall(FN1[cmd], cmd);
    }

    this.throwUnexpected();
  }

  /**
   * Parse `\name` + arguments (brace or parens or \left...\right).
   * @param {string} jsFn
   * @param {string} texName
   */
  parseFnCall(jsFn, texName) {
    this.skipSpace();
    let innerList;
    if (this.peek() === '{') {
      const raw = this.readBraceGroupRaw();
      innerList = [raw.trim()];
    } else if (this.peek() === '(') {
      this.i++;
      const start = this.i;
      let depth = 1;
      while (this.i < this.end && depth > 0) {
        if (this.s[this.i] === '(') depth++;
        else if (this.s[this.i] === ')') depth--;
        this.i++;
      }
      if (depth !== 0) this.throwUnexpected();
      const inner = this.s.slice(start, this.i - 1);
      innerList = splitTexCommaArgs(inner);
    } else if (this.startsWithWord('\\left')) {
      this.i += 5;
      const { inner } = this.readLeftRightBodyAfterLeftKeyword();
      innerList = splitTexCommaArgs(inner);
    } else {
      const atom = this.parsePostfixScripts();
      innerList = [atom];
    }

    if (FN2.has(texName)) {
      if (innerList.length < 2) this.throwUnexpected();
      return `${jsFn}(${innerList.map((t) => new TexExprParser(t, 0, t.length).parseTop()).join(', ')})`;
    }
    if (innerList.length !== 1) this.throwUnexpected();
    const arg = new TexExprParser(innerList[0], 0, innerList[0].length).parseTop();
    return `${jsFn}(${arg})`;
  }
}

/**
 * Convert a LaTeX equation string to a math.js expression string.
 * @param {string} latex - A LaTeX equation string.
 * @returns {string} The equivalent math.js expression string.
 * @throws If the LaTeX cannot be parsed.
 */
export function latexToMathJS(latex) {
  const s = String(latex).trim();
  if (!s) {
    throw new Error('Invalid or unsupported LaTeX in equation');
  }
  const p = new TexExprParser(s, 0, s.length);
  const expr = p.parseTop();
  p.skipSpace();
  if (!p.atEnd()) {
    throw new Error('Invalid or unsupported LaTeX in equation');
  }
  return math.parse(expr).toString();
}

/**
 * Convert a math.js expression string to a LaTeX equation string.
 * Uses the same toTex handler as ModuleObj.expandEquation().
 * @param {string} mathJSStr - A math.js expression string.
 * @returns {string} The equivalent LaTeX equation string.
 * @throws If the expression cannot be parsed or converted.
 */
export function mathJSToLatex(mathJSStr) {
  const expr = math.parse(mathJSStr);
  return expr.toTex({
    handler: function (node, options) {
      if (node.type === 'SymbolNode') {
        const name = node.name;
        if (name.includes('_')) {
          const parts = name.split('_');
          const base = parts[0];
          const subscript = parts.slice(1).join('_');
          const formattedBase = base.length === 1 ? ' ' + base : '\\' + base;
          return formattedBase + '_{' + subscript + '}';
        }
        return name.length === 1 ? ' ' + name : '\\' + name;
      }

      if (node.type === 'FunctionNode') {
        const name = node.fn.name || node.fn;
        const args = node.args || [];
        switch (name) {
          case 'log':
            return '\\log\\left(' + args[0].toTex(options) + '\\right)';
          case 'asin':
            return '\\arcsin\\left(' + args[0].toTex(options) + '\\right)';
          case 'acos':
            return '\\arccos\\left(' + args[0].toTex(options) + '\\right)';
          case 'atan':
            return '\\arctan\\left(' + args[0].toTex(options) + '\\right)';
          case 'asinh':
            return '\\operatorname{asinh}\\left(' + args[0].toTex(options) + '\\right)';
          case 'acosh':
            return '\\operatorname{acosh}\\left(' + args[0].toTex(options) + '\\right)';
          case 'atanh':
            return '\\operatorname{atanh}\\left(' + args[0].toTex(options) + '\\right)';
          case 'floor':
            return '\\operatorname{floor}\\left(' + args[0].toTex(options) + '\\right)';
          case 'ceil':
            return '\\operatorname{ceil}\\left(' + args[0].toTex(options) + '\\right)';
          case 'round':
            return '\\operatorname{round}\\left(' + args[0].toTex(options) + '\\right)';
          case 'sign':
            return '\\operatorname{sign}\\left(' + args[0].toTex(options) + '\\right)';
        }
        return undefined;
      }

      return undefined;
    }
  });
}

/**
 * Check whether a stored equation value is supported by the visual editor
 * and extract the math.js display string.
 *
 * Supported formats:
 *  - A string without backticks: interpreted as LaTeX, converted to math.js.
 *  - A string that is a single double-backtick block (``expr``): the inner
 *    part is already math.js.
 *
 * @param {*} value - The stored equation value.
 * @returns {{ supported: true, display: string } | { supported: false }}
 */
export function equationValueToDisplay(value) {
  if (value === undefined || value === null) {
    return { supported: true, display: '' };
  }
  if (typeof value !== 'string') {
    return { supported: false };
  }
  if (!value.includes('`')) {
    try {
      return { supported: true, display: latexToMathJS(value) };
    } catch {
      return { supported: false };
    }
  }
  const m = value.match(DOUBLE_BACKTICK_RE);
  if (m) {
    return { supported: true, display: m[1] };
  }
  return { supported: false };
}

/**
 * Plain-text equation for object list descriptions (matches EquationPropertyControl /
 * equationValueToDisplay): LaTeX → math.js string; ``expr`` → inner expr; unsupported → raw stored value.
 * @param {*} value - The stored equation value.
 * @returns {string}
 */
export function equationValueForListDisplay(value) {
  const r = equationValueToDisplay(value);
  if (r.supported) {
    return r.display;
  }
  if (value === undefined || value === null) {
    return '';
  }
  return typeof value === 'string' ? value : String(value);
}

/**
 * Convert a display string (user-entered math.js text) back to a stored
 * equation value.
 *
 * In template mode the value is wrapped in double backticks.
 * In non-template mode the value is converted to LaTeX.
 *
 * @param {string} text - The user-entered math.js expression.
 * @param {boolean} isTemplate - Whether the current context is a template.
 * @returns {string|undefined} The stored value, or undefined for empty input.
 * @throws If non-template conversion to LaTeX fails.
 */
export function equationDisplayToValue(text, isTemplate) {
  if (text === '') return undefined;
  if (isTemplate) {
    return '``' + text + '``';
  }
  return mathJSToLatex(text);
}
