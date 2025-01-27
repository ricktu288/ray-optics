/*
 * Copyright 2024 The Ray Optics Simulation authors and contributors
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
 * @file `src/core/index.js` is the main entry point for the Ray Optics Simulation core library that does the simulation and editing of optical scenes. It exports the main classes and some utility functions, and is used by the web app (which adds the web UI for it with Vue). This library is also built directly by Webpack into the `rayOptics.js` node module, which is used in the automatic image generation of the Gallery, and can also be used in other projects.
 * 
 * Here are the classes and functions exported by this module:
 * 
 * - {@link Scene} - The class representing the optical scene for simulation, containing the instances from {@link sceneObjs} (optical elements, decorations, etc) and the settings of the scene. It is the main data structure of the app and can be serialized to (and deserialized from) JSON.
 * 
 * - {@link Simulator} - The class for simulating the optical system described by the {@link Scene} class and rendering the scene (optical elements, decorations, rays, etc) on the canvas layers. The actual canvas rendering is done by the {@link CanvasRenderer} or {@link FloatColorRenderer} class depending on the render mode, instead of this class.
 * 
 * - {@link Editor} - The main class for visually editing the {@link Scene} data. It manages the user interactions with the canvas, such as dragging objects, selecting objects, and adding objects. Rendering of the objects is done by the {@link Simulator} class instead of this class. Also, since the UI is separated from the core library, the UI update (e.g. object bar) is not done by this class. When UI update is needed, this class emits events to notify the UI to update.
 * 
 * - {@link sceneObjs} - The namespace for all the classes representing objects that can be added to the scene. Scene objects include optical elements (e.g. mirrors, lenses), detectors, decorations (e.g. rulers, text labels), and special objects (e.g. handles, cropboxes).
 * 
 * - {@link geometry} - The namespace for functions for 2D geometry operations (e.g. distance, intersection, etc).
 */

import Scene from './Scene.js';
import Simulator from './Simulator.js';
import Editor from './Editor.js';
import * as sceneObjs from './sceneObjs.js';
import geometry from './geometry.js';

export { Scene, Simulator, Editor, sceneObjs, geometry };