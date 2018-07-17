export var ToolTypeEnum = {
  RADIO: 1,
  RADIOLIST: 2,
  BUTTON: 3,
  CHECK: 4,
  SLIDE: 5,
  HELP: 6
};
Object.freeze(ToolTypeEnum);

export class ToolBarItem {
  /**
   * Create a ToolBarItem that can be any type listed in ToolTypeEnum.
   * @param {string|String[]} name
   * @param {number|ToolTypeEnum} type any type listed in ToolTypeEnum.
   * @param {ToolBarItem[]|undefined} content the list of items in RADIOLIST.
   * @param {function|undefined} action the action that triggers on BUTTON click.
   * @param {number|undefined} min the minimum value in SLIDE.
   * @param {number|undefined} max the maximum value in SLIDE.
   * @param {number|undefined} step the step size in SLIDE.
   * @param {number|undefined} value the current value in SLIDE.
   */
  constructor(name, type, content, action, min, max, step, value) {
    this.name = name;
    this.type = type;
    this.selected = "";
    this.content = content;
    if (this.type == ToolTypeEnum.RADIOLIST) {
      for (var i = 0; i < content.length; i++) {
        this.selected = ko.observable(content[i].name);
        break;
      }
    } else if (this.type == ToolTypeEnum.BUTTON) {
      this.action = action;
    } else if (this.type == ToolTypeEnum.SLIDE) {
      this.min = ko.observable(min);
      this.max = ko.observable(max);
      this.step = ko.observable(step);
      this.value = ko.observable(value);
    }
    //console.log(this);
  }
}

export class ToolBarGroup {
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
}