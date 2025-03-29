# `src`

This directory contains the source code for the project.

- `src/app` contains the source code for the simulator app, which is to be built by webpack. The UI is written in Vue.js.
- `src/core` contains the source code for the core modules of the simulator, which is to be built using Webpack. To understand the structure of the code, see the [documentation](https://phydemo.app/ray-optics/docs/index.html) for more information. The documentation is generated from the jsdoc comments in the code.
- `src/pages` contains the handlebars templates for the home, about, gallery and module pages, to be built by `scripts/buildPages.mjs`.
- `src/img` contains the images for the home page and simulator app. Gallery and module images are generated at build time instead.
