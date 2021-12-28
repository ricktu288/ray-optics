# Ray Optics Simulation
Simulate reflection and refraction of light.

## Features
- Simulate various light sources: ray, beam, and point source
- Simulate reflection in linear, circular, and parabolic mirror
- Simulate beam splitter
- Simulate refraction in linear or circular interfaces, including both refracted and reflected rays
- Simulate ideal lens/mirror, which obeys lens/mirror equation
- View extensions of rays to see if they converge to a virtual image
- View real images, virtual images, and virtual objects directly
- View images that can be observed from some given position
- Distance, angular, energy flow, and momentum flow measurements
- Export as SVG diagram

## Links
- [Project Page](https://ricktu288.github.io/ray-optics/)
- [Sample file folder](/samples)

If you created a good sample, please submit a pull request to let others see your work!

# Quick Start

Clone the repo: `git clone https://github.com/ricktu288/ray-optics.git`

Open `simulator/index.html` locally in you browser (or start an http server in the repo directory if "Sample" does not work).

# Making your own tools

The structure of a tool is described in [the template here](tool_template.js). You can also search for `objTypes['id_of_existing_tool']` in `simulator/index.js` for reference. (I'm sorry that the code is not well-organized and most of the comments in `index.js` are in Chinese since this was from a very old project of my own (Yi-Ting Tu) when I just learn to code in JavaScript.)

## A way to quickly test your own tools

After you complete the code `objTypes['id_of_your_tool'] = {...};`, a quick way to test it without modifying the toolbar is to execute the code directly in your browser's developer tool. And when you want to choose the tool, execute `AddingObjType = 'id_of_your_tool'`.

## Putting your own tools into the toolbar

You can just search for an existing tool id such as `protractor` or `beamsplitter` in `simulator/ToolBarViewModel.js`, `simulator/index.html`, `simulator/index.js`, and `simulator/locales/en.js` and add the corresponding lines for your tools. And also include an exported SVG image (use the "export" button) of your tools in `img/id_of_your_tool.svg` cropped to a suitable size.

If you create a useful tool, please submit a pull request to let others use your tool! (We will add the Chinese locales for it.)

# License
Copyright 2016–2021 Yi-Ting Tu, Johnson

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

## Third-Party Software

Ray Optics Simulation includes or depends upon the following third-party software, either in whole or in part. Each third-party software package is provided under its own license.

### FileSaver.js

FileSaver.js is distributed under the [MIT license](https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md).
The source code is available at: https://github.com/eligrey/FileSaver.js

### canvas2svg

canvas2svg is distributed under the [MIT license](https://github.com/gliffy/canvas2svg/blob/master/LICENSE).
The source code is available at: https://github.com/gliffy/canvas2svg

### Bootstrap

Bootstrap is distributed under the [MIT license](https://raw.githubusercontent.com/twbs/bootstrap/master/LICENSE).
The source code is available at: https://github.com/twbs/bootstrap

### jQuery

jQuery is distributed under the [MIT license](https://github.com/jquery/jquery/blob/master/LICENSE.txt).
The source code is available at: https://github.com/jquery/jquery

### Knockout

Knockout is distributed under the [MIT license](https://opensource.org/licenses/mit-license.php).
The source code is available at: https://github.com/knockout/knockout
