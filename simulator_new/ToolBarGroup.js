/* exported ToolTypeEnum, ToolBarItem, ToolBarGroup */
var ToolTypeEnum = {
  RADIO : 1,
  RADIOLIST : 2,
  BUTTON : 3,
  CHECK : 4,
  SLIDE : 5,
};

/**
 * ToolBarItem can be any type listed in ToolTypeEnum.
 * @param {string|string[]} name 
 * @param {number|ToolTypeEnum} type 
 * @param {ToolBarItem[]|function|{min, max, step, value}|undefined} content
 */
function ToolBarItem(name, type, content) {
  this.name = name;
  this.type = type;
  this.selected = "";
  // RADIOLIST: content is the array of dropdown items.
  // BUTTON   : content is the click function.
  // SLIDE    : content is {min, max, step, value}
  this.content = content;
  if (this.type == ToolTypeEnum.RADIOLIST) {
    for (var i = 0; i < content.length; i++) {
      this.selected = ko.observable(content[i].name);
      break;
    }
  } else if (this.type == ToolTypeEnum.SLIDE) {
    this.content = {};
    this.content.min = ko.observable(content.min);
    this.content.max = ko.observable(content.max);
    this.content.step = ko.observable(content.step);
    this.content.value = ko.observable(content.value);
  }
  //console.log(this);
}
/**
 * ToolBarGroup that results in a new toolgroup row in toolbar.
 * @param {string} title 
 * @param {ToolBarItem[]} tools 
 * @constructor
 */
function ToolBarGroup(title, tools) {
  this.title = title;
  this.tools = tools;
  for (var i = 0; i < tools.length; i++) {
    this.selected = ko.observable(tools[i].name);
    break;
  }
  //console.log(this);
}