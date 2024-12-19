# `src`

This directory contains the source code for the project.

- `src/simulator` contains the source code for the simulator app, which is to be built by webpack. To understand the structure of the code, see the [documentation](https://phydemo.app/ray-optics/docs/) for more information. The documentation is generated from the jsdoc comments in the code.
- `src/simulator-node` contains the source code for the node module version of the simulator, to be built using Webpack.
- `src/webpages` contains the handlebars templates for the home, about, gallery and module pages, to be built by `scripts/buildWebpages.mjs`.
- `src/img` contains the images for the home page and simulator app. Gallery and module images are generated at build time instead.
