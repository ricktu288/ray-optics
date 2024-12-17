![Example figure](https://raw.githubusercontent.com/ricktu288/ray-optics/master/src/img/spherical-lens-and-mirror.jpg)

# Ray Optics Simulation
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.6386611.svg)](https://doi.org/10.5281/zenodo.6386611)
[![Deploy to GitHub Pages](https://github.com/ricktu288/ray-optics/actions/workflows/deploy.yml/badge.svg)](https://github.com/ricktu288/ray-optics/actions/workflows/deploy.yml)
[![Translation status](https://hosted.weblate.org/widget/ray-optics-simulation/svg-badge.svg)](https://hosted.weblate.org/engage/ray-optics-simulation/)

A web app for creating and simulating 2D geometric optical scenes. Our goal is to make it easy for students to build physical intuition by "playing around", for teachers to do dynamical demonstrations, and at the same time also include tools for more advanced usage.

## Features
- Simulate various light sources: ray, parallel/divergent beam, and point source
- Simulate reflection in linear or curved mirrors, which can be defined by a custom equation
- Simulate beam splitters and dichroic mirrors
- Simulate refraction in linear or curved interfaces, which can be defined by a custom equation
- Simulate ideal lens/mirror, which obey the lens/mirror equation
- Simulate spherical lens defined by front/back focal distances
- Simulate gradient-index material defined by a custom refractive index function
- Simulate mixture of colors, color filtering, and chromatic dispersion
- Simulate diffraction gratings.
- View extensions of rays to see if they converge to a virtual image
- View real images, virtual images, and virtual objects directly
- View images that can be observed from some given position
- Distance, angular, energy flow, and momentum flow measurements
- Draw irradiance map and export as CSV data
- Export as SVG diagram
- Create modularized combinations of optical elements with custom parameters.
- Use the simulator as a node module in your own project.

## Links
- [**Launch the Web App**](https://phydemo.app/ray-optics/simulator/)
- [Gallery](https://phydemo.app/ray-optics/gallery/)
- [Documentation](https://phydemo.app/ray-optics/docs/)
- [About](https://phydemo.app/ray-optics/about)
- [Run Locally](https://github.com/ricktu288/ray-optics/blob/master/run-locally/README.md)

## Cite this project

If you use this project in your research, please cite it using the metadata in the [CITATION.bib](https://github.com/ricktu288/ray-optics/blob/master/CITATION.bib) file.

You can also include the URL https://phydemo.app/ray-optics/ in the citation. The URL will not change in the foreseeable future (at least until 2032).

# Contributing

Contributions are welcome. For the following types of contributions, no (or little) programming knowledge is required:

- New items in the [gallery](https://phydemo.app/ray-optics/gallery/)
- New translations
- New modules (as in Tools -> Other -> Import Modules)

See [CONTRIBUTING.md](https://github.com/ricktu288/ray-optics/blob/master/CONTRIBUTING.md) for the tutorial.

For translations, note that this project uses Weblate. Please visit https://hosted.weblate.org/engage/ray-optics-simulation/ to translate.

[![Translation status](https://hosted.weblate.org/widget/ray-optics-simulation/287x66-grey.png)](https://hosted.weblate.org/engage/ray-optics-simulation/)

To contribute code, you need to have some knowledge of JavaScript and module bundling. The code is written in ES6 and bundled with Webpack. The code structure is documented in the [documentation](https://phydemo.app/ray-optics/docs/). See the following section for installation instructions.

# Installation

> [!NOTE]
> The following instructions are for developers. If you just want to use the web app, you can launch it directly from [here](https://phydemo.app/ray-optics/simulator/).
> If you just want to run the project locally, please see [Run Locally](https://github.com/ricktu288/ray-optics/blob/master/run-locally/README.md).

To run the web app locally for development, you need to have Node.js installed. Then, run the following commands in the terminal:
```bash
git clone https://github.com/ricktu288/ray-optics.git
cd ray-optics
npm install --no-optional
npm run start
```
After that, the simulator web app should be running at `http://localhost:8080/simulator/`. Note however that some links and the "import module" window will not work because the other part of the project is not built.

If you want to build the entire project, including the home pages, gallery, modules, documentation, and the node version of the simulator, you can run the following command:
```bash
npm install
npm run build
```
After that, the entire content for the [https://phydemo.app/ray-optics/](https://phydemo.app/ray-optics/) website will be in the `dist` folder. You can again run `npm run start` to run the simulator locally, and now all the links and the "import module" window should work.

If an error occurs during the installation, some common reasons are:
- The version of Node.js is too old. You can update Node.js to version 18 or later.
- Some system dependencies for node-canvas are missing. You can find the instructions for installing the dependencies in the [node-canvas repository](https://github.com/Automattic/node-canvas).

The full build may takes about half an hour to complete due to the generation of the large numbers of images for the gallery.

## Development

For development of the web app, you can just use `npm run start`, and the web app will be automatically reloaded when some code for the simulator is modified. However, to rebuild some other part of this project, you need to run the following commands:
```bash
# build home pages, about pages, gallery, and modules pages (not including scenes and image generation).
npm run build-webpages

# build the scenes for the gallery and modules pages.
npm run build-scenes

# build the node module version of the simulator, which is required for the image generation.
npm run build-node

# generate images for the gallery, which may take a long time.
npm run build-images

# build the web app version of simulator (unlike npm run start, this command builds the simulator in production mode)
npm run build-simulator

# build documentation
npm run build-docs
```
Note that `npm run build` is equivalent to running all the above commands.

## Project structure

- `src` contains the source code for the project.
- `src/simulator` contains the source code for the simulator app, which is to be built by webpack. To understand the structure of the code, see the [documentation](https://phydemo.app/ray-optics/docs/) for more information. The documentation is generated from the jsdoc comments in the code.
- `src/simulator-node` contains the source code for the node module version of the simulator.
- `src/webpages` contains the handlebars templates for the home, about, gallery and module pages, to be built by `scripts/buildWebpages.mjs`.
- `data` contains the data for gallery, modules, and the list of contributors.
- `locales` contains the translations for the project in i18next format.
- `scripts` contains the scripts for custom build steps.
- `dist` contains the built files for the project (the entire content for the [https://phydemo.app/ray-optics](https://phydemo.app/ray-optics) website).
- `dist-node` contains the built files for the node module version of the simulator, which is required for the image generation, and can also be used in your own project.

## Use this project as a Node Module

The simulator can be used as a node module in your own project. The node module version of the simulator is built with the following command:
```bash
npm run build-node
```
After that, you can use the simulator in your own project by importing the module:
```javascript
const { Scene, Simulator, sceneObjs, geometry } = require('path/to/ray-optics/dist-node/main.js');
```

See the [documentation](https://phydemo.app/ray-optics/docs/) for more information about the API. For a usage example, see the [image generation script](https://github.com/ricktu288/ray-optics/blob/master/scripts/buildImages.mjs).


# License
Copyright 2016–2024 Yi-Ting Tu

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
