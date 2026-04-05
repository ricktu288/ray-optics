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

import i18next from 'i18next'

/**
 * @param {string[]} names - Existing module names in the scene.
 * @returns {string}
 */
export function suggestNewModuleName(names) {
  const base = 'NewModule'
  if (!names.includes(base)) return base
  for (let i = 2; i < 10000; i++) {
    const candidate = `${base}${i}`
    if (!names.includes(candidate)) return candidate
  }
  return `${base}${Date.now()}`
}

/**
 * Prompts for a new module name. Shows alerts on invalid input.
 * @param {string[]} moduleNames - Existing module names.
 * @returns {string|null} The chosen name, or null if cancelled / invalid.
 */
export function promptNewModuleName(moduleNames) {
  const defaultName = suggestNewModuleName(moduleNames)
  const proposed = window.prompt(
    i18next.t('simulator:sidebar.visual.moduleEditor.new.promptNewName'),
    defaultName
  )
  if (proposed == null) return null

  const newName = proposed.trim()
  if (!newName) {
    window.alert(i18next.t('simulator:sidebar.visual.moduleEditor.new.errorEmptyName'))
    return null
  }
  if (newName.includes(',')) {
    window.alert(i18next.t('simulator:sidebar.visual.moduleEditor.new.errorComma'))
    return null
  }
  if (moduleNames.includes(newName)) {
    window.alert(
      i18next.t('simulator:sidebar.visual.moduleEditor.new.errorNameExists', { name: newName })
    )
    return null
  }

  return newName
}
