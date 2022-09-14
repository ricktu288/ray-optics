Pull requests are welcome. Possible contribution includes but not limited to the following.

# Contributing a tool

1. Add a script <code><var>TOOL_ID</var>.js</code> in `simulator/js/objs` and write the code there. See the README there for a correspondence between the id with the name of the existing tool on the toolbar. See [the structure of a tool](https://github.com/ricktu288/ray-optics/wiki/The-structure-of-a-tool-(obj)) for documentation.

2. Add a script tag in `simulator/index.html` for the new tool.

3. Add the locale strings for the tool to at least one of `en`, `zh_TW` or `zh_CN` locale scripts in `simulator/locales/`:
   - <code>toolname_<var>TOOL_ID</var></code>: the label on the parameter bar when the object is selected
   - If the tool has some new parameters, add the strings for them.

After the steps above, The new tool can be tested by executing <code>AddingObjType = '<var>TOOL_ID</var>'</code> with the developer tool to choose the tool without being on the toolbar. The steps below are not required for a pull request.

4. Add the corresponding lines in:
   - `self.tools` of `simulator/js/ToolBarViewModel.js`
   - The constructor of `ToolBarItem` in `simulator/js/ToolBarGroup.js` (if the dropdown structure is modified)
   - `tools_normal`, `tools_withList` or `tools_inlist` in `simulator/index.js`
   - `toolbtn_clicked` in `simulator/index.js` (if inside a dropdown)

3. Add the locale strings for the tool to at least one of `en`, `zh_TW` or `zh_CN` locale scripts in `simulator/locales/`:
   - <code>tool_<var>TOOL_ID</var></code>: the title on the toolbar (or dropdown item)
   - <code>tool_<var>TOOL_ID</var>_popover</code>: the text in the popover when the user hover the item on the toolbar

5. Add an exported SVG image (use the "export" button) of your tools in <code>img/<var>TOOL_ID</var>.svg</code>. You may first open an existing image as background so that the exported SVG will be cropped automatically.


# Contributing a locale

1. Add a script <code><var>LOCALE_ID</var>.js</code> in `simulator/locales/` and translate the strings from an existing locale.
2. Add a folder in the repo root with the name being the country/region code, and copy `index.html` (the homepage) inside that folder. Translate the text in the new homepage. Replace all `img/` with `../img/` in the new homepage.

The steps below are not required for a pull request.

3. Add the corresponding lines in `init_i18n` of `simulator/js/locale.js` and the `<ul class="dropdown-menu"` in `simulator/index.html`
4. Add/modify the language-related metadata and the language dropdowns of the homepages in all locales for the new locale.

# Contributing an example

1. Add the example file in `samples/`, with the name being the name of the example. Currently the "text" tool does not support locales, so if your the example contains text, they should be in English.

The steps below are not required for a pull request.

2. Modify the number of samples in `sampleList` of `simulator/js/ToolBarViewModel.js`.

3. Add the locale key <code>sample<var>N</var></code> into at least one of `en`, `zh_TW` or `zh_CN` locale scripts in `simulator/locales/` with the name of the example.

4. Add the file name of the example to the `samples` array in `simulator/js/index.js`.

# Other contribution

Such as adding a new parameter to a tool, adding a new mode of viewing light, etc. If you modified some existing tools/components, make sure that the following requirements are satisfied.

## Requirements on compatibility

1. If a file is saved before the modification, it should be readable by the app after the modification, with the logic unmodified.
2. After opening such a file, the appearance within the canvas when none of the objects are selected and the mouse is not over any object should be essentially the same as before the modification (except for quality improvement and bug fixing.)
3. If the default appearance of a tool (the appearance of an object newly created with the tool, without selection or mouse hovering) is modified, there should be a way to recover the original appearance, such as with a checkbox in the parameter box.

For a feature marked as "beta", 2. and 3. do not apply.
