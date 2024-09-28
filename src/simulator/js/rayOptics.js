/**
 * @file
 * This is the main entry for the ray optics simulator documentation. To begin, see the {@link rayOptics} namespace.
 */

/**
 * @namespace rayOptics
 * @description The main namespace for the ray optics simulator.
 */

import { Scene } from './Scene.js';
import { Simulator } from './Simulator.js';
import { Editor } from './Editor.js';
import { geometry } from './geometry.js';
import * as objTypes from './objTypes.js';

const rayOptics = {
  Scene,
  Simulator,
  Editor,
  geometry,
  objTypes
};

export default rayOptics;