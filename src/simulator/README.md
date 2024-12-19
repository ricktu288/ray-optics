# `src/simulator`

This directory contains the source code for the simulator app, which is to be built by webpack.

- `src/simulator/index.html` is the HTML page for the simulator app. It includes an inline script tag for fast initial loading. The locale data is generated at build time by `scripts/buildInlineLocaleData.mjs` and injected into the script tag.
- `src/simulator/js` is the source code for the simulator app. Please see the [documentation](https://phydemo.app/ray-optics/docs/) for more information. The documentation is generated from the jsdoc comments in the code.
