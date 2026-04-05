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

import { getByKeyPath } from './keyPath.js'

/**
 * Check whether a point value has hardcoded coordinates.
 * Hardcoded means both x and y are numbers (not formula strings).
 * The special coordinates (0, 0) are NOT considered hardcoded.
 * @param {{ x: *, y: * } | undefined} value - Point value from template (may have x/y as number or string).
 * @returns {boolean} True if the point is hardcoded (numeric x, y, and not (0,0)).
 */
export function isPointHardcoded(value) {
  if (value == null || typeof value !== 'object') {
    return false
  }
  const x = value.x
  const y = value.y
  if (typeof x !== 'number' || typeof y !== 'number') {
    return false
  }
  if (x === 0 && y === 0) {
    return false
  }
  return true
}

/**
 * Recursively collect all point-type property paths from schema and objData.
 * Handles arrays with itemSchema by expanding to concrete indices from objData.
 * @param {Object} objData - Template object data.
 * @param {Array} schema - Property schema descriptors.
 * @param {string} [basePath=''] - Base path for nested contexts.
 * @returns {Array<string>} List of full dot-separated paths to point values.
 */
function collectPointPaths(objData, schema, basePath = '') {
  const paths = []
  if (!Array.isArray(schema)) return paths

  for (const descriptor of schema) {
    const key = descriptor?.key
    const fullPath = [basePath, key].filter(Boolean).join('.')
    const value = getByKeyPath(objData, fullPath)
    const type = descriptor?.type

    if (type === 'point') {
      paths.push(fullPath)
    } else if (type === 'array' && Array.isArray(descriptor?.itemSchema)) {
      const arr = value
      if (!Array.isArray(arr)) continue
      const itemSchema = descriptor.itemSchema
      for (let i = 0; i < arr.length; i++) {
        const itemPath = fullPath ? `${fullPath}.${i}` : String(i)
        const nestedPaths = collectPointPaths(objData, itemSchema, itemPath)
        paths.push(...nestedPaths)
      }
    }
  }
  return paths
}

/**
 * Check whether all point-type properties in a module template have hardcoded coordinates.
 * Used to determine if a template object will be movable in the canvas when placed in a module.
 * @param {Object} objData - Template object data (raw JSON from module objs).
 * @param {Array} schema - Property schema from getPropertySchema.
 * @param {string} [basePath=''] - Base path for nested contexts.
 * @returns {{ hasPointProperties: boolean, allHardcoded: boolean }}
 */
export function templatePointLockState(objData, schema, basePath = '') {
  const pointPaths = collectPointPaths(objData, schema, basePath)
  const hasPointProperties = pointPaths.length > 0
  if (!hasPointProperties) {
    return { hasPointProperties: false, allHardcoded: false }
  }
  for (const path of pointPaths) {
    const value = getByKeyPath(objData, path)
    if (!isPointHardcoded(value)) {
      return { hasPointProperties: true, allHardcoded: false }
    }
  }
  return { hasPointProperties: true, allHardcoded: true }
}
