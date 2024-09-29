/**
 * The types of objects (optical elements, decorations, etc) that can be added to the scene.
 * @namespace rayOptics.sceneObjs
 */
export const SingleRay = require('./sceneObjs/lightSource/SingleRay.js').default;
export const Beam = require('./sceneObjs/lightSource/Beam.js').default;
export const PointSource = require('./sceneObjs/lightSource/PointSource.js').default;
export const AngleSource = require('./sceneObjs/lightSource/AngleSource.js').default;
export const Mirror = require('./sceneObjs/mirror/Mirror.js').default;
export const ArcMirror = require('./sceneObjs/mirror/ArcMirror.js').default;
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