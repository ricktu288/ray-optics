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

    //Warning: Dirty code below.
    if (this.name == "Mirrors")
      this.description = 4;
    else if (this.name == "Glasses")
      this.description = 3;
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
      image = "<img src='../img/" + this.img + ".png' align='left' style='margin-right: 10px; margin-bottom: 4px; max-width: 250px'>";
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