# `scripts`
> [!NOTE]
> For the source code of the web app, see [`src/simulator`](../src/simulator) instead.

This directory contains the build scripts for the project.

 - `scripts/buildWebpages.mjs` is used to build the HTML pages for the home, about, gallery, and modules pages.
 - `scripts/buildScenes.mjs` is used to build the scenes (substitute the locale strings into the scenes) for gallery and modules.
 - `scripts/buildImages.mjs` is used to generate the images for the gallery and modules, which uses the node module version of the simulator.
 - `scripts/buildInlineLocaleData.mjs` is used to build the locale data to be injected into the HTML page for the simulator app.
 - `scripts/addToGallery.mjs` is an interactive script to add a new scene to the gallery page, which extracts the strings from the scene and adds them to the locale file.
 - `scripts/addToModules.mjs` is an interactive script to add a new module to the modules page, which extracts the strings from the module and adds them to the locale file.
 - `scripts/sortTranslations.mjs` is used to sort the translations in the `locales` directory according to the order of the gallery and module pages, and the English locale file.
