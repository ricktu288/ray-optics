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
 * Get a value from an object by a dot-separated key path.
 * Numeric segments are treated as array indices.
 * @param {Object} obj - The object to read from (root).
 * @param {string} path - Dot-separated path (e.g. 'focalLength', 'path.0', 'params.r1').
 *   Empty string returns the root object.
 * @param {Object} [defaults] - Optional defaults. When value is undefined, returns getByKeyPath(defaults, path).
 * @returns {*} The value at the path, or undefined (or default) if any segment is missing.
 */
const FOR_IF_DEFAULTS = { for: [], if: true };

export function getForIfDefault(key) {
  return key in FOR_IF_DEFAULTS ? FOR_IF_DEFAULTS[key] : undefined;
}

export function getByKeyPath(obj, path, defaults) {
  if (path === '') {
    return obj;
  }
  const segments = path.split('.');
  const lastSeg = segments[segments.length - 1];
  let current = obj;
  for (const seg of segments) {
    if (current == null) {
      if (defaults != null) {
        return getByKeyPath(defaults, path);
      }
      const forIfDef = getForIfDefault(lastSeg);
      return forIfDef !== undefined ? forIfDef : undefined;
    }
    const num = Number(seg);
    const key = Number.isNaN(num) ? seg : num;
    current = current[key];
  }
  if (current === undefined && defaults != null) {
    return getByKeyPath(defaults, path);
  }
  if (current === undefined) {
    const forIfDef = getForIfDefault(lastSeg);
    return forIfDef !== undefined ? forIfDef : undefined;
  }
  return current;
}

/**
 * Set a value in an object by a dot-separated key path.
 * Creates intermediate objects/arrays as needed.
 * When a parent is undefined (using default), materializes it from defaults before modifying.
 * @param {Object} obj - The object to mutate (root).
 * @param {string} path - Dot-separated path (e.g. 'focalLength', 'path.0', 'params.r1').
 *   Empty string is not valid for set (would replace root).
 * @param {*} value - The value to set.
 * @param {Object} [defaults] - Optional defaults. When an intermediate is null/undefined, materializes from defaults first.
 * When the value being set matches the default (from `defaults` or the built-in for/if defaults), the property is deleted instead of set.
 */
export function setByKeyPath(obj, path, value, defaults) {
  if (path === '') {
    throw new Error('keyPath: empty path is not valid for setByKeyPath');
  }
  const segments = path.split('.');
  let current = obj;
  let partialPath = '';
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const num = Number(seg);
    const key = Number.isNaN(num) ? seg : num;
    const nextKey = segments[i + 1];
    const nextNum = Number(nextKey);
    const isNextArray = !Number.isNaN(nextNum);
    if (current[key] == null) {
      if (defaults != null) {
        const nextPartial = partialPath ? `${partialPath}.${seg}` : seg;
        const defVal = getByKeyPath(defaults, nextPartial);
        if (defVal != null) {
          current[key] = JSON.parse(JSON.stringify(defVal));
        } else {
          current[key] = isNextArray ? [] : {};
        }
      } else {
        current[key] = isNextArray ? [] : {};
      }
    }
    partialPath = partialPath ? `${partialPath}.${seg}` : seg;
    current = current[key];
  }
  const lastSeg = segments[segments.length - 1];
  const lastNum = Number(lastSeg);
  const lastKey = Number.isNaN(lastNum) ? lastSeg : lastNum;

  let isDefault = false;
  const forIfDef = getForIfDefault(lastSeg);
  if (forIfDef !== undefined && JSON.stringify(value) === JSON.stringify(forIfDef)) {
    isDefault = true;
  } else if (defaults != null) {
    const defVal = getByKeyPath(defaults, path);
    if (defVal !== undefined && JSON.stringify(value) === JSON.stringify(defVal)) {
      isDefault = true;
    }
  }

  if (isDefault && current != null && typeof current === 'object' && !Array.isArray(current)) {
    delete current[lastKey];
  } else {
    current[lastKey] = value;
  }
}

const RESERVED_KEYS = new Set(['for', 'if']);

/**
 * Format a dot-separated key path into a more familiar bracket notation.
 * Numeric segments become array indices: path.1.x → path[1].x
 * Reserved JS keywords (for, if) use bracket notation: obj.if → obj["if"]
 * @param {string} path - Dot-separated key path.
 * @returns {string} The formatted path.
 */
export function formatKeyPath(path) {
  if (!path) return '';
  const segments = path.split('.');
  let result = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const num = Number(seg);
    if (!Number.isNaN(num)) {
      result += `[${seg}]`;
    } else if (RESERVED_KEYS.has(seg)) {
      result += `["${seg}"]`;
    } else {
      result += (i === 0 ? '' : '.') + seg;
    }
  }
  return result;
}

/**
 * Check whether a property is "non-basic" (always shown in partial view).
 * Non-basic: points, equations, and arrays of objects (arrays whose itemSchema
 * is not just a single number or string). Styles are basic.
 * @param {Object} descriptor - PropertyDescriptor.
 * @returns {boolean} True if the property is non-basic.
 */
function isNonBasicProperty(descriptor) {
  const t = descriptor?.type;
  if (t === 'point' || t === 'equation') {
    return true;
  }
  if (t === 'array') {
    const itemSchema = descriptor?.itemSchema;
    if (!Array.isArray(itemSchema) || itemSchema.length === 0) {
      return true;
    }
    const isSimplePrimitiveArray =
      itemSchema.length === 1 &&
      (itemSchema[0]?.type === 'number' || itemSchema[0]?.type === 'text');
    return !isSimplePrimitiveArray;
  }
  return false;
}

/**
 * Check whether the value at the given descriptor key path differs from the default.
 * Non-basic properties (points, equations, arrays of objects) are always treated as non-default.
 * Basic properties use serializableDefaults for comparison.
 * @param {Object} objData - Raw/serialized object data (plain object with type and properties; never a class instance).
 * @param {Object} descriptor - PropertyDescriptor with a `key` property (dot-separated path).
 * @param {Object} serializableDefaults - The default values structure (e.g. from constructor.serializableDefaults).
 * @param {string} [basePath=''] - Optional base path when used in nested contexts (e.g. array items).
 * @returns {boolean} True if the value is different from the default (or if non-basic, always true).
 */
export function isNonDefault(objData, descriptor, serializableDefaults, basePath = '') {
  if (isNonBasicProperty(descriptor)) {
    return true;
  }
  const key = descriptor?.key;
  if (key == null) {
    return false;
  }
  const fullPath = [basePath, key].filter(Boolean).join('.');
  const current = getByKeyPath(objData, fullPath, serializableDefaults);
  const def = getByKeyPath(serializableDefaults, fullPath);
  return JSON.stringify(current) !== JSON.stringify(def);
}
