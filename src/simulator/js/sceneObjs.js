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
 * @file {@link sceneObjs} is the namespace for all the classes representing objects that can be added to the scene. Scene objects include optical elements (e.g. mirrors, lenses), detectors, decorations (e.g. rulers, text labels), and special objects (e.g. handles, cropboxes).
 */

/**
 * The namespace for all the classes representing objects that can be added to the scene. Scene objects include optical elements (e.g. mirrors, lenses), detectors, decorations (e.g. rulers, text labels), and special objects (e.g. handles, cropboxes).
 * 
 * Each class represents a type of objects, and defines the rendering of the object, the options in the object bar when selected, how the mouse interacts with the object, and how the object interacts with light rays. The base class for all scene objects is {@link BaseSceneObj}, which provides common properties and methods for all scene objects. Child base classes are used for common optical interactions: {@link BaseFilter} (for mirrors and blockes), {@link BaseGlass}, and {@link BaseGrinGlass}.
 * Mixins are used for common user interactions based on shapes: {@link LineObjMixin} and {@link CircleObjMixin}.
 * The directory structure in `src/simulator/js/sceneObjs` is organized according to the toolbars in the app, which is not always the same as the class inheritance structure. For example, `IdealLens` is categorized under "Glass" in the app, but is not a subclass of `BaseGlass`.
 * 
 * In the Ray Optics Simulator web app, a single instance of {@link Scene} is used. The scene objects created by the users are stored in the `objs` property of that instance, each a instance of a class defined in this namespace.
 * 
 * The classes can also be used by other projects, including those running in a standalone environment (e.g. Node.js).
 * @namespace sceneObjs
 */
export const SingleRay = require('./sceneObjs/lightSource/SingleRay.js').default;
export const Beam = require('./sceneObjs/lightSource/Beam.js').default;
export const PointSource = require('./sceneObjs/lightSource/PointSource.js').default;
export const AngleSource = require('./sceneObjs/lightSource/AngleSource.js').default;
export const Mirror = require('./sceneObjs/mirror/Mirror.js').default;
export const ArcMirror = require('./sceneObjs/mirror/ArcMirror.js').default;
export const ConcaveDiffractionGrating = require('./sceneObjs/mirror/ConcaveDiffractionGrating.js').default;
export const ParabolicMirror = require('./sceneObjs/mirror/ParabolicMirror.js').default;
export const CustomMirror = require('./sceneObjs/mirror/CustomMirror.js').default;
export const IdealMirror = require('./sceneObjs/mirror/IdealMirror.js').default;
export const BeamSplitter = require('./sceneObjs/mirror/BeamSplitter.js').default;
export const PlaneGlass = require('./sceneObjs/glass/PlaneGlass.js').default;
export const CircleGlass = require('./sceneObjs/glass/CircleGlass.js').default;
export const Glass = require('./sceneObjs/glass/Glass.js').default;
export const CustomGlass = require('./sceneObjs/glass/CustomGlass.js').default;
export const IdealLens = require('./sceneObjs/glass/IdealLens.js').default;
export const SphericalLens = require('./sceneObjs/glass/SphericalLens.js').default;
export const CircleGrinGlass = require('./sceneObjs/glass/CircleGrinGlass.js').default;
export const GrinGlass = require('./sceneObjs/glass/GrinGlass.js').default;
export const Blocker = require('./sceneObjs/blocker/Blocker.js').default;
export const CircleBlocker = require('./sceneObjs/blocker/CircleBlocker.js').default;
export const Aperture = require('./sceneObjs/blocker/Aperture.js').default;
export const DiffractionGrating = require('./sceneObjs/blocker/DiffractionGrating.js').default;
export const Ruler = require('./sceneObjs/other/Ruler.js').default;
export const Protractor = require('./sceneObjs/other/Protractor.js').default;
export const Detector = require('./sceneObjs/other/Detector.js').default;
export const TextLabel = require('./sceneObjs/other/TextLabel.js').default;
export const LineArrow = require('./sceneObjs/other/LineArrow.js').default;
export const Drawing = require('./sceneObjs/other/Drawing.js').default;
export const Handle = require('./sceneObjs/special/Handle.js').default;
export const CropBox = require('./sceneObjs/special/CropBox.js').default;
export const ModuleObj = require('./sceneObjs/special/ModuleObj.js').default;