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

const BACKTICK_RE = /^`([\s\S]*)`$/;

/**
 * Split a string by commas that are not inside (), [], or {}.
 * @param {string} str
 * @returns {string[]} The parts, each trimmed.
 */
export function splitTopLevelCommas(str) {
  const result = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      current += ch;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth = Math.max(0, depth - 1);
      current += ch;
    } else if (ch === ',' && depth === 0) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Convert a stored value (number or backtick-wrapped formula string) to a
 * display string with backticks stripped.
 * @param {*} value
 * @returns {string}
 */
export function valueToFormulaDisplay(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') {
    const m = value.match(BACKTICK_RE);
    if (m) return m[1];
  }
  return String(value);
}

/**
 * Convert a display string (user-entered text) back to a stored value.
 * For numbers: numeric text becomes a number; anything else is wrapped in backticks.
 * For booleans: "true"/"false" become boolean literals; anything else is wrapped in backticks.
 * Empty string always returns undefined.
 * @param {string} text
 * @param {'number'|'boolean'} [type='number']
 * @returns {number|boolean|string|undefined}
 */
export function formulaDisplayToValue(text, type = 'number') {
  if (text === '') return undefined;
  switch (type) {
    case 'number': {
      const num = Number(text);
      if (!Number.isNaN(num)) return num;
      break;
    }
    case 'boolean':
      if (text === 'true') return true;
      if (text === 'false') return false;
      break;
  }
  return '`' + text + '`';
}

/**
 * Check whether a display string represents a formula (not a literal of the given type).
 * @param {string} text
 * @param {'number'|'boolean'} [type='number']
 * @returns {boolean}
 */
export function isFormula(text, type = 'number') {
  if (text === '') return false;
  switch (type) {
    case 'number':
      return Number.isNaN(Number(text));
    case 'boolean':
      return text !== 'true' && text !== 'false';
    default:
      return true;
  }
}

/**
 * Check whether a stored value can be displayed/edited by the visual formula editor
 * for the given property type.
 * Supported: undefined, null, backtick-wrapped formula strings, and the native JS type
 * matching `type` (number for 'number', boolean for 'boolean').
 * @param {*} value
 * @param {'number'|'boolean'} [type='number']
 * @returns {boolean}
 */
export function isFormulaValueSupported(value, type = 'number') {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return BACKTICK_RE.test(value);
  switch (type) {
    case 'number': return typeof value === 'number';
    case 'boolean': return typeof value === 'boolean';
    default: return false;
  }
}
