![Example figure](https://raw.githubusercontent.com/ricktu288/ray-optics/master/src/img/spherical-lens-and-mirror.jpg)

# Ray Optics Simulation
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.6386611.svg)](https://doi.org/10.5281/zenodo.6386611)
[![translated](https://hosted.weblate.org/widget/ray-optics-simulation/svg-badge.svg)](https://hosted.weblate.org/engage/ray-optics-simulation/)
[![Deploy website](https://github.com/ricktu288/ray-optics/actions/workflows/deploy.yml/badge.svg)](https://github.com/ricktu288/ray-optics/actions/workflows/deploy.yml)
[![Deploy integrations](https://github.com/ricktu288/ray-optics/actions/workflows/deploy-integrations.yml/badge.svg)](https://github.com/ricktu288/ray-optics/actions/workflows/deploy-integrations.yml)

A web app for creating and simulating 2D geometric optical scenes, with a gallery of (interactive) demos.

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
- Use the simulator as a node module in your own project and integrate with other programming languages.

## Links
- [**Launch the Web App**](https://phydemo.app/ray-optics/simulator/)
- [Gallery](https://phydemo.app/ray-optics/gallery/)
- [Documentation](https://phydemo.app/ray-optics/docs/index.html)
- [About](https://phydemo.app/ray-optics/about)
- [Run Locally](https://github.com/ricktu288/ray-optics/blob/master/run-locally/README.md)

## Cite this project

If you use this project in your research, please cite it according to the metadata:
```bibtex
@misc{RayOptics,
  author = {Tu, Yi-Ting and others},
  title = {{Ray Optics Simulation}},
  year = {2016},
  doi = {10.5281/zenodo.6386611},
  url = {https://phydemo.app/ray-optics/}
}
```

The DOI shown above is for the project, not for a specific version. If you want to cite a versioned DOI, please use the [latest release](https://github.com/ricktu288/ray-optics/releases/latest), which is slightly older than the online version and without beta features. You can then replace the project DOI above with the versioned DOI shown on that page, and the year by the year of the release.

The URL field above is optional and not supported by all citation formats. You may also use the Zenodo URL or the GitHub URL.

## Contributing

Contributions are welcome. For the following types of contributions, no (or little) programming knowledge is required:

- New items in the [gallery](https://phydemo.app/ray-optics/gallery/)
- New translations
- New modules (as in Tools -> Other -> Import Modules)

See [CONTRIBUTING.md](https://github.com/ricktu288/ray-optics/blob/master/CONTRIBUTING.md) for the tutorial.

For translations, note that this project uses Weblate. Please visit https://hosted.weblate.org/engage/ray-optics-simulation/ to translate.

[![Translation status](https://hosted.weblate.org/widget/ray-optics-simulation/287x66-grey.png)](https://hosted.weblate.org/engage/ray-optics-simulation/)

To contribute code, you need to have some knowledge of JavaScript and module bundling. The code is written in ES6 and bundled with Webpack. The code structure is documented in the [documentation](https://phydemo.app/ray-optics/docs/index.html). See the following section for installation instructions.

## Installation

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

## Project structure

- `src` contains the source code for the project.
- `data` contains the data for gallery, modules, and the list of contributors.
- `locales` contains the translations for the project in i18next format, managed by Weblate.
- `scripts` contains the scripts for custom build steps.
- `test` contains the automatic tests for the project.
- `integrations` contains the integration tools for the simulator with other programming languages.
- `dist` (generated at build time) contains the built files for the project (the entire content for the [https://phydemo.app/ray-optics](https://phydemo.app/ray-optics) website).
- `dist-node` (generated at build time) contains the built files for the node module version of the simulator, which is required for the image generation, and can also be used in your own project.
- `dist-integrations` (generated at build time) contains the built files for the integration tools.

See the README.md in each directory for more information.

## Development

For development of the web app, you can just use `npm run start`, and the web app will be automatically reloaded when some code for the simulator is modified. However, to rebuild some other part of this project, you need to run the following commands:
```bash
# build home pages, about pages, gallery, and modules pages (not including scenes and image generation).
npm run build-pages

# build the scenes for the gallery and modules pages.
npm run build-scenes

# build the node module version of the simulator, which is required for the image generation.
npm run build-node

# generate images for the gallery, which may take a long time.
npm run build-images

# build the web app version of simulator (unlike npm run start, this command builds the simulator in production mode)
npm run build-app

# build documentation
npm run build-docs
```
Note that `npm run build` is equivalent to running all the above commands.

## Testing

To run the automatic tests,
```bash
npm run test
```
The tests are run automatically when you commit your changes.

The above command will run the following tests:
```bash
npm run test:sceneObjs
npm run test:scenes
```
the first one tests the user creation, dragging, and changing properties for each scene object in the source code.
the second one runs the scene JSONs in `test/scenes/` with the node module version of the simulator, and compares the output of `CropBox`/`Detector` with the corresponding PNG/CSV files.

If you modify the appearance of some objects or rays, the images in `test/scenes/` may need to be updated. Also if you add new scene tests, the corresponding PNG and CSV files nees to be initialized. In these cases, run the following command to regenerate all the PNG/CSV files after you make sure that all the failing tests are due to the changes you made:
```bash
env WRITE_OUTPUT=true npm run test:scenes
```
Please do not run this command if you are not sure that all the failing tests are due to the changes you made, since after running it, all scene tests will pass vacuously.

Currently there is no automatic end-to-end test for the web app. So please manually check that the UI works as expected if you make any changes.

## Use as a Node Module

The simulator can be used as a node module in your own project and integrated with other programming languages.
The easiest way is to use the built [integration tools](https://github.com/ricktu288/ray-optics/tree/dist-integrations). You don't need to clone this repo and build anything, but you still need to have Node.js installed.

For more advanced usage, the node module version of the simulator is built with the following command:
```bash
npm run build-node
```
After that, you can use the simulator in your own project by importing the module:
```javascript
const { Scene, Simulator, sceneObjs, geometry } = require('path/to/ray-optics/dist-node/rayOptics.js');
```

See the [documentation](https://phydemo.app/ray-optics/docs/index.html) for more information about the API. For a usage example, see the [image generation script](https://github.com/ricktu288/ray-optics/blob/master/scripts/buildImages.mjs).

To build the integration tools by yourself, run the following command:
```bash
npm run build-integrations
```

## License

```
Copyright 2016–2025 The Ray Optics Simulation authors and contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
