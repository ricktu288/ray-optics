/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

// The megakernel extracts its geometry helpers from the staged trace shader.
// Keep this compatibility entry point without maintaining a second copy.
export {
  WebGpuRawTraceStage,
  createWebGpuRawTraceShader,
} from '../webgpu/webGpuTrace.js';
