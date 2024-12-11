# Contributing

Contributions are welcome.

To report bugs, request new features, or share your ideas, feel free to open [issues](https://github.com/ricktu288/ray-optics/issues) or [discussion](https://github.com/ricktu288/ray-optics/discussions).  You can also send an email to ray-optics@phydemo.app if you are not familiar with GitHub.

For direct contributions, see the following guidelines.

## Contributing items to the Gallery

**Method 1: By e-mail**

1. Save you work as a `.json` file using the "Save" button. If your work contains a background image (which can be loaded with "Open"), it should be in a separate file.
2. Send the files to ray-optics@phydemo.app. Include the title of your work, a description of your work (to show on the webpage), and your name to appear on the [list of contributors](https://phydemo.app/ray-optics/about).

**Method 2: Via GitHub** (preferred if you use GitHub)

1. Fork this repo and clone locally. If you have forked previously, sync to get the latest changes.
2. Run `npm install` (you don't need to run build).
3. Run `npm run add-to-gallery` and follow the instructions there.
4. Commit your changes, push to your fork, and create a pull request.

## Contributing translations

> [!NOTE]
> There will likely be an online collaboration tool for translation in the near future.

You can submit a complete or partial translation for a new language, make progress to an incomplete language, or improve translation for an existing language. The locale strings are in the `locales/` folder and is in the json format of i18next. Currently the best way to do the translation is to use an offline translation editor such as the i18n Ally extension for VSCode.

For each language, there are four json files:

- `main.json`: The strings for the homepage and the "Tools" and "View" toolbar of the simulator.
- `simulator.json`: The resto of the strings for the simulator.
- `gallery.json`: The strings for the Gallery page and of all the items in the Gallery.
- `modules.json`: The strings for the modules page, the module items, and the module tutorial page.

The `main.json` and `simulator.json` are the most important ones, and should be translated first.

If you already started the translation with the old json format before Dec 11, 2024, you can still submit that (which will be converted to the new format by some automatic script). But please do not start a new translation with the old format.

You can submit the translated file with either method below:

**Method 1: By e-mail**

Send the resulting files to ray-optics@phydemo.app. Include the name of the language and your name to appear on the [list of contributors](https://phydemo.app/ray-optics/about).

**Method 2: Via GitHub** (preferred if you use GitHub)

1. Fork this repo and clone locally. If you have forked previously, sync to get the latest changes.
2. Save/replace the locale files. If it is a new language, just create the new folder in `locales/` with the locale ID as the name.
3. Commit your changes, push to your fork, and create a pull request.

## Contributing modules

See Tools -> Others -> Import Modules for more information about modules. See [this tutorial](https://phydemo.app/ray-optics/modules/tutorial) for how to create a new module.

**Method 1: By e-mail**

1. Save you scene with the new module as a `.json` file using the "Save" button.
2. Send the files to ray-optics@phydemo.app. Include the title of your module, a description of your module, and your name to appear on the [list of contributors](https://phydemo.app/ray-optics/about).

**Method 2: Via GitHub** (preferred if you use GitHub)

1. Fork this repo and clone locally. If you have forked previously, sync to get the latest changes.
2. Run `npm install` (you don't need to run build).
3. Run `npm run add-to-modules` and follow the instructions there.
4. Commit your changes, push to your fork, and create a pull request.

## More contributions

Such as creating a new tool, adding a new parameter to a tool, adding a new mode of viewing light, etc. For significant changes such as a new framework or a new toolbar design, please open a new discussion first.

See the [installation instructions](https://github.com/ricktu288/ray-optics/blob/master/README.md#installation) for how to set up the project locally.

### Requirements on compatibility

If you modified some existing tools/components, make sure that the following are satisfied:

1. If a file is saved before the modification, it should be readable by the app after the modification, with the logic unmodified.
2. After opening such a file, the appearance within the canvas when none of the objects are selected and the mouse is not over any object should be essentially the same as before the modification (except for quality improvement and bug fixing.)
3. If the default appearance of a tool (the appearance of an object newly created with the tool, without selection or mouse hovering) is modified, there should be a way to recover the original appearance, such as with a checkbox in the object bar.

For a feature marked as "beta" and for parameters outside the range of the sliders, 2. and 3. do not apply.
