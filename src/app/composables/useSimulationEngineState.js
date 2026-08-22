/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import { readonly, ref } from 'vue'

const activeEngineKind = ref('default')
const activeEngineFallback = ref(false)

export function setActiveEngineKind(kind, { fallback = false } = {}) {
  activeEngineKind.value = kind
  activeEngineFallback.value = fallback
}

export function useSimulationEngineState() {
  return {
    activeEngineKind: readonly(activeEngineKind),
    activeEngineFallback: readonly(activeEngineFallback)
  }
}
