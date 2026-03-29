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

import { parseTex } from 'tex-math-parser';
import * as math from 'mathjs';

const DOUBLE_BACKTICK_RE = /^``([\s\S]*)``$/;

/**
 * Convert a LaTeX equation string to a math.js expression string.
 * Uses the same approach as BaseGrinGlass.initFns().
 * @param {string} latex - A LaTeX equation string.
 * @returns {string} The equivalent math.js expression string.
 * @throws If the LaTeX cannot be parsed.
 */
export function latexToMathJS(latex) {
  return parseTex(latex).toString()
    .replaceAll('\\cdot', '*')
    .replaceAll('\\frac', '/');
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
