[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.6386611.svg)](https://doi.org/10.5281/zenodo.6386611)

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

The structure of a tool is described in [the template here](tool_template.js). To view the code of an existing tool, you can search for `objTypes['id_of_the_tool'] =` in [`index.js`](simulator/index.js).

| Name on the toolbar | ID of the tool |
| --- | --- |
| Ray | `laser` |
| Beam | `parallel` |
| Point source -> 360 degrees | `radiant` |
| Point source -> Finite angle | `led` |
| Mirrors -> Segment | `mirror` |
| Mirrors -> Circular Arc | `arcmirror` |
| Mirrors -> Ideal Curved | `idealmirror` |
| Mirrors -> Parabolic | `parabolicmirror` |
| Mirrors -> Beam Splitter | `beamsplitter` |
| Glasses -> Half-plane | `halfplane` |
| Glasses -> Circle | `circlelens` |
| Glasses -> Free-shape | `refractor` |
| Glasses -> Ideal Lens | `lens` |
| Glasses -> Spherical Lens | `sphericallens` |
| Blocker | `blackline` |
| Ruler | `ruler` |
| Protractor | `protractor` |
| Detector | `power` |
| Text | `text` |

I'm sorry that most of the comments in [`index.js`](simulator/index.js) are in Chinese. For now, you can see [the template](tool_template.js) for some explanations in English.

## A way to quickly test your own tools

After you complete the code `objTypes['id_of_your_tool'] = {...};`, a quick way to test it without modifying the toolbar is to execute the code directly in your browser's developer tool. And when you want to choose the tool, execute `AddingObjType = 'id_of_your_tool'`.

## Putting your own tools into the toolbar

You can just search for an existing tool id such as `protractor` or `beamsplitter` in `simulator/ToolBarViewModel.js`, `simulator/index.html`, `simulator/index.js`, and `simulator/locales/en.js` and add the corresponding lines for your tools. And also include an exported SVG image (use the "export" button) of your tools in `img/id_of_your_tool.svg` cropped to a suitable size.

If you create a useful tool, please submit a pull request to let others use your tool! (We will add the Chinese locales for it.)

# License
Copyright 2016–2022 Yi-Ting Tu, Wei-Fang Sun

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


# 幾何光學模擬
模擬光的反射與折射

## 功能
- 模擬多種光源：光線、平行光、點光源
- 模擬直線形、弧形、拋物線形鏡子的反射
- 模擬分光鏡(beam splitter)
- 模擬直線型與弧形界面的折射，包括反射光與折射光
- 模擬理想透鏡/面鏡（符合透鏡/面鏡公式）
- 顯示光線的延長線以觀察是否成虛像
- 直接檢視實像、虛像與虛物
- 顯示從某一位置能觀察到的像
- 距離、角度、能量流與動量流量測
- 匯出為SVG圖形

## 連結
- [正體中文首頁](https://ricktu288.github.io/ray-optics/tw/)
- [簡體中文首頁](https://ricktu288.gitlab.io/ray-optics/cn/)
- [範例檔案夾](/samples)

如果您建立了有意義的範例，歡迎發pull request給我們！

