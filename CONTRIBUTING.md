# Contributing

Contributions are welcome.

To report bugs, request new features, or share your ideas, feel free to [open issues here](https://github.com/ricktu288/ray-optics/issues).  You can also send an email to yttu@duck.com if you are not familiar with GitHub.

For direct contributions, see the following guidelines.

## Contributing a tool

1. Fork this repo and clone locally. If you have forked previously, sync to get the latest changes.

2. Add a script <code><var>TOOL_ID</var>.js</code> in `simulator/js/objs`, where <code><var>TOOL_ID</var></code> is the id of the new tool, and write the code there. See the README there for a correspondence between the id with the name of the existing tools on the toolbar. See [the structure of a tool](https://github.com/ricktu288/ray-optics/wiki/The-structure-of-a-tool-(obj)) for documentation.

3. Add a script tag in `simulator/index.html` for the new tool.

4. Add the locale strings for the tool to `simulator/locales/en.js`:
   - <code>toolname_<var>TOOL_ID</var></code>: the label on the parameter bar when the object is selected
   - If the tool has some new parameters, add the strings for them.

After the steps above, The new tool can be tested by opening `simulator/index.html` locally in your browser and executing <code>AddingObjType = '<var>TOOL_ID</var>'</code> with the developer tool to choose the tool, without being on the toolbar.

5. _(optional)_ Add the corresponding lines in:
   - `self.tools` of `simulator/js/ToolBarViewModel.js`
   - The constructor of `ToolBarItem` in `simulator/js/ToolBarGroup.js` (if the dropdown structure is modified)
   - `tools_normal`, `tools_withList` or `tools_inlist` in `simulator/index.js`
   - `toolbtn_clicked` in `simulator/index.js` (if inside a dropdown)

6. _(optional)_ Add the locale strings for the tool to `simulator/locales/en.js`:
   - <code>tool_<var>TOOL_ID</var></code>: the title on the toolbar (or dropdown item)
   - <code>tool_<var>TOOL_ID</var>_popover</code>: the text in the popover when the user hover the item on the toolbar

7. _(optional)_ Run `node sync.js` in `simulator/locales/` to sync to other locales. Translate the added strings to other locales if you speak that language (follow the translation guidelines).

8. _(optional)_ Add an exported SVG image (use the "export" button) of your tools in <code>img/<var>TOOL_ID</var>.svg</code>. You may first open an existing image as the background so that the exported SVG will be cropped automatically.

9. Commit your changes (several times maybe), push to your fork, and create a pull request.

## Contributing an example

**Method 1: By e-mail**

1. Save you work as a `.json` file using the "Save" button. If your work contains text labels, the text should be in English. If your work contains a background image (which can be loaded with "Open"), it should be in a separate file.
2. Send the files to yttu@duck.com. Include the name of the example and your name to  be appear on the [list of contributors](https://github.com/ricktu288/ray-optics/wiki/About).

**Method 2: Via GitHub**

1. Fork this repo and clone locally. If you have forked previously, sync to get the latest changes.

2. Add the example file in `samples/`, with the name being the name of the example. Currently, the "text" tool does not support locales, so if the example contains texts, they should be in English.

3. If the work contains a background image, put it also in `samples/`, and edit the `.json` file to include <code>backgroundImage": "<var>IMAGE_FILENAME</var>"</code>.

4. _(optional)_ Modify the number of samples in `sampleList` of `simulator/js/ToolBarViewModel.js`.

5. _(optional)_ Add the locale key <code>sample<var>N</var></code> into `simulator/locales/en.js` with the name of the example. Run `node sync.js` to sync to other locales. Translate the name to other locales if you speak that language (follow the translation guidelines).

6. _(optional)_ Add the file name of the example to the `samples` array in `simulator/js/index.js`.

7. Commit your changes, push to your fork, and create a pull request.

## Contributing translations

You can submit a complete or partial translation for a new language, make progress to an incomplete language, or improve translation for an existing language. You don't need to understand the code to do the translation.
1. Download the target locale file:
   - Traditional Chinese (completed): https://raw.githubusercontent.com/ricktu288/ray-optics/master/simulator/locales/zh_TW.js
   - Simplified Chinese (completed): https://raw.githubusercontent.com/ricktu288/ray-optics/master/simulator/locales/zh_CN.js
   - Russian (incomplete): https://raw.githubusercontent.com/ricktu288/ray-optics/master/simulator/locales/ru.js
   - Dutch (incomplete): https://raw.githubusercontent.com/ricktu288/ray-optics/master/simulator/locales/nl.js
   - French (incomplete): https://raw.githubusercontent.com/ricktu288/ray-optics/master/simulator/locales/fr.js
   - Template for a new language:  https://raw.githubusercontent.com/ricktu288/ray-optics/master/simulator/locales/template.js
2. Translate the phrase/sentence in the quotation after `"message":` to the target language. If you encounter `<` and `>`, leave the text between them untouched; `&amp;` means the "&" symbol; `\"` means a quote, and `&nbsp;` means an extra space.  If the translation of an item is completed, remove the line `"incomplete": true,`. For example,
```javascript
  "save_description": {
    "incomplete": true,
    "message": "To share your work, you can <a href=\"https://github.com/ricktu288/ray-optics/blob/master/CONTRIBUTING.md#contributing-an-example\" target=\"_blank\">contribute a new item in the Examples menu</a>."
  },
```
becomes (for Traditional Chinese)
```javascript
  "save_description": {
    "message": "如欲分享您的作品，可以<a href=\"https://github.com/ricktu288/ray-optics/blob/master/CONTRIBUTING.md#contributing-an-example\" target=\"_blank\">貢獻新的項目到「範例」選單中</a>。"
  },

```
After that, you can submit the translated file with either method below:

**Method 1: By e-mail**

3. Send the resulting file to yttu@duck.com (you may need to replace the `.js` with `.txt` in the filename to make it attachable). Include the name of the language and your name to be appear on the [list of contributors](https://github.com/ricktu288/ray-optics/wiki/About).

**Method 2: Via GitHub**

3. Fork this repo and clone locally. If you have forked previously, sync to get the latest changes.

4. Save/replace the file as <code><var>LOCALE_ID</var>.js</code> in `simulator/locales/`.
5. _(optional)_ If it is a new language, modify the locale list in `simulator/locales/sync.js`.
6. _(optional)_ Add/modify the translation of the welcome message in `simulator/index.html`.
7. _(optional)_ Add/modify <code><var>LOCALE_ID/index.html</var>.js</code> in the repo root (if not exist, copy from `index.html` and replace all `img/` with `../img/`).
8. _(optional)_ Add the corresponding lines in `init_i18n` of `simulator/js/locale.js` and the `<ul class="dropdown-menu"` in `simulator/index.html`
9. _(optional)_ Add/modify the language-related metadata and the language dropdowns of the homepages in all locales for the new locale.

10. Commit your changes, push to your fork, and create a pull request.

## More contributions

Such as adding a new parameter to a tool, adding a new mode of viewing light, etc. See [the wiki](https://github.com/ricktu288/ray-optics/wiki) for documentation. For significant changes such as a new framework or a new toolbar design, please open an issue to discuss with the project's developers first.

### Requirements on compatibility

If you modified some existing tools/components, make sure that the following are satisfied:

1. If a file is saved before the modification, it should be readable by the app after the modification, with the logic unmodified.
2. After opening such a file, the appearance within the canvas when none of the objects are selected and the mouse is not over any object should be essentially the same as before the modification (except for quality improvement and bug fixing.)
3. If the default appearance of a tool (the appearance of an object newly created with the tool, without selection or mouse hovering) is modified, there should be a way to recover the original appearance, such as with a checkbox in the parameter box.

For a feature marked as "beta" and for parameters outside the range of the sliders, 2. and 3. do not apply.
