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
 * @param {Object} obj - The object to read from.
 * @param {string} path - Dot-separated path (e.g. 'focalLength', 'path.0', 'params.r1').
 *   Empty string returns the root object.
 * @returns {*} The value at the path, or undefined if any segment is missing.
 */
export function getByKeyPath(obj, path) {
  if (path === '') {
    return obj;
  }
  const segments = path.split('.');
  let current = obj;
  for (const seg of segments) {
    if (current == null) {
      return undefined;
    }
    const num = Number(seg);
    const key = Number.isNaN(num) ? seg : num;
    current = current[key];
  }
  return current;
}

/**
 * Set a value in an object by a dot-separated key path.
 * Creates intermediate objects/arrays as needed.
 * @param {Object} obj - The object to mutate.
 * @param {string} path - Dot-separated path (e.g. 'focalLength', 'path.0', 'params.r1').
 *   Empty string is not valid for set (would replace root).
 * @param {*} value - The value to set.
 */
export function setByKeyPath(obj, path, value) {
  if (path === '') {
    throw new Error('keyPath: empty path is not valid for setByKeyPath');
  }
  const segments = path.split('.');
  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const num = Number(seg);
    const key = Number.isNaN(num) ? seg : num;
    const nextKey = segments[i + 1];
    const nextNum = Number(nextKey);
    const isNextArray = !Number.isNaN(nextNum);
    if (current[key] == null) {
      current[key] = isNextArray ? [] : {};
    }
    current = current[key];
  }
  const lastSeg = segments[segments.length - 1];
  const lastNum = Number(lastSeg);
  const lastKey = Number.isNaN(lastNum) ? lastSeg : lastNum;
  current[lastKey] = value;
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
 * @param {Object} objData - The object data (scene object or template JSON).
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
  let current = getByKeyPath(objData, fullPath);
  const def = getByKeyPath(serializableDefaults, fullPath);
  // For raw objects (e.g. module templates), absent properties mean "use default".
  // Treat undefined current as equal to default so we don't mark everything non-default.
  if (current === undefined) {
    current = def;
  }
  return JSON.stringify(current) !== JSON.stringify(def);
}
