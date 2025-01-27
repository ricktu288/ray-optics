# `src/app`

This directory contains the source code for the simulator app, which is to be built by webpack.

- `src/app/index.html` is the HTML page for the simulator app. It includes an inline script tag for fast initial loading. The locale data is generated at build time by `scripts/buildInlineLocaleData.mjs` and injected into the script tag.

- `src/app/components` contains the Vue components for the simulator app.

- `src/app/store` contains the store for the simulator app.