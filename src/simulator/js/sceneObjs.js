/**
 * The types of objects (optical elements, decorations, etc) that can be added to the scene.
 * @namespace rayOptics.sceneObjs
 */
export const SingleRay = require('./sceneObjs/lightSource/SingleRay.js').SingleRay;
export const Beam = require('./sceneObjs/lightSource/Beam.js').Beam;
export const PointSource = require('./sceneObjs/lightSource/PointSource.js').PointSource;
export const AngleSource = require('./sceneObjs/lightSource/AngleSource.js').AngleSource;
export const Mirror = require('./sceneObjs/mirror/Mirror.js').Mirror;
export const ArcMirror = require('./sceneObjs/mirror/ArcMirror.js').ArcMirror;
export const ParabolicMirror = require('./sceneObjs/mirror/ParabolicMirror.js').ParabolicMirror;
export const CustomMirror = require('./sceneObjs/mirror/CustomMirror.js').CustomMirror;
export const IdealMirror = require('./sceneObjs/mirror/IdealMirror.js').IdealMirror;
export const BeamSplitter = require('./sceneObjs/mirror/BeamSplitter.js').BeamSplitter;
export const PlaneGlass = require('./sceneObjs/glass/PlaneGlass.js').PlaneGlass;
export const CircleGlass = require('./sceneObjs/glass/CircleGlass.js').CircleGlass;
export const Glass = require('./sceneObjs/glass/Glass.js').Glass;
export const CustomGlass = require('./sceneObjs/glass/CustomGlass.js').CustomGlass;
export const IdealLens = require('./sceneObjs/glass/IdealLens.js').IdealLens;
export const SphericalLens = require('./sceneObjs/glass/SphericalLens.js').SphericalLens;
export const CircleGrinGlass = require('./sceneObjs/glass/CircleGrinGlass.js').CircleGrinGlass;
export const GrinGlass = require('./sceneObjs/glass/GrinGlass.js').GrinGlass;
export const Blocker = require('./sceneObjs/blocker/Blocker.js').Blocker;
export const CircleBlocker = require('./sceneObjs/blocker/CircleBlocker.js').CircleBlocker;
export const Aperture = require('./sceneObjs/blocker/Aperture.js').Aperture;
export const DiffractionGrating = require('./sceneObjs/blocker/DiffractionGrating.js').DiffractionGrating;
export const Ruler = require('./sceneObjs/other/Ruler.js').Ruler;
export const Protractor = require('./sceneObjs/other/Protractor.js').Protractor;
export const Detector = require('./sceneObjs/other/Detector.js').Detector;
export const TextLabel = require('./sceneObjs/other/TextLabel.js').TextLabel;
export const LineArrow = require('./sceneObjs/other/LineArrow.js').LineArrow;
export const Drawing = require('./sceneObjs/other/Drawing.js').Drawing;
export const Handle = require('./sceneObjs/special/Handle.js').Handle;
export const CropBox = require('./sceneObjs/special/CropBox.js').CropBox;
export const ModuleObj = require('./sceneObjs/special/ModuleObj.js').ModuleObj;