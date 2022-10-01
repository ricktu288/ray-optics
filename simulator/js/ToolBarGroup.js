var ToolTypeEnum = {
  RADIO: 1,
  RADIOLIST: 2,
  BUTTON: 3,
  CHECK: 4,
  SLIDE: 5,
  HELP: 6
};
Object.freeze(ToolTypeEnum);

class ToolBarItem {
  /**
   * Create a ToolBarItem that can be any type listed in ToolTypeEnum.
   * @param {string|String[]} name
   * @param {string} id
   * @param {string} img popover image.
   * @param {number|ToolTypeEnum} type any type listed in ToolTypeEnum.
   * @param {ToolBarItem[]|undefined} content the list of items in RADIOLIST.
   * @param {function|undefined} action the action that triggers on BUTTON click.
   * @param {number|undefined} min the minimum value in SLIDE.
   * @param {number|undefined} max the maximum value in SLIDE.
   * @param {number|undefined} step the step size in SLIDE.
   * @param {number|undefined} value the current value in SLIDE.
   */
  constructor(name, id, img, type, content, action, min, max, step, value) {
    this.name = name;
    this.id = id;
    this.img = img;

    //@param {string|number} description popover description or z-index for RADIOLIST.
    this.description = "";//description;

    // Currently, a hack is used to make the RADIOLIST dropdown menu appear
    // above other toolbar buttons. This hack requires setting the
    // `description` of the RADIOLIST to represent its z-index. This
    // value should monotonically decrease for each RADIOLIST
    // (from left to right, top to bottom).
    //
    // This works because a higher z-index button will always appear above a
    // lower z-index one, and a button will never be covered by a dropdown menu
    // of another RADIOLIST button at its right or below it. Therefore, the
    // z-index of a button must be higher than all buttons at its right or
    // below.
    //
    // The current approach is far from ideal. A better approach is to make
    // the buttons in the dropdown menu to have higher z-indices than normal
    // buttons. However, this is currently not possible due to unknown reasons.
    //
    // TL;DR: For each RADIOLIST button, its `description` must be set to a
    //        value higher than all RADIOLIST buttons at its right or below.
    //        This value should be updated whenever a new RADIOLIST button is
    //        added or reordered.
    if (this.name == "Glasses")
      this.description = 3;
    else if (this.name == "Mirrors")
      this.description = 4;
    else if (this.name == "Blockers")
      this.description = 5;
    else if (this.name == "Point Source")
      this.description = 6;
    else if (this.name == "Samples")
      this.description = 7;
    else
      this.description = getMsg(this.id + "_popover");

    this.type = type;
    this.selected = "";
    this.content = content;
    if (this.type == ToolTypeEnum.RADIOLIST) {
      for (var i = 0; i < content.length; i++) {
        this.selected = ko.observable(content[i].name);
        break;
      }
    } else if (this.type == ToolTypeEnum.CHECK) {
      this.selected = ko.observable(false);
    } else if (this.type == ToolTypeEnum.BUTTON) {
      this.action = action;
    } else if (this.type == ToolTypeEnum.SLIDE) {
      this.min = ko.observable(min);
      this.max = ko.observable(max);
      this.step = ko.observable(step);
      this.value = ko.observable(value);
    }
    else if (this.type == ToolTypeEnum.HELP) {
      this.selected = ko.observable(true);
    }
    //console.log(this);
  }
  getTitle() {
    return "<b>" + this.getLocaleName() + "</b>";
  }
  getLocaleName() {
    return getMsg(this.id);
  }
  getContent() {
    var image = "";
    if (this.img != undefined)
      image = "<img src='../img/" + this.img + ".svg' align='left' style='margin-right: 10px; margin-bottom: 4px; max-width: 250px'>";
    return image + "<b>" + this.description + "</b>";
  }
}

class ToolBarGroup {
  /**
   * Creates a ToolBarGroup that results in a new toolgroup row in toolbar.
   * @param {string} title
   * @param {ToolBarItem[]} tools
   * @constructor
   */
  constructor(title, tools) {
    this.title = title;
    this.tools = tools;
    for (var i = 0; i < tools.length; i++) {
      this.selected = ko.observable(tools[i].name);
      break;
    }
  }
  getLocaleName() {
    return getMsg(this.title);
  }
}
