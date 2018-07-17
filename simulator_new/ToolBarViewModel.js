import { ToolBarGroup, ToolBarItem, ToolTypeEnum } from "./ToolBarGroup.js";

function ToolBarViewModel() {
  var self = this;
  /**
   * All ToolBarGroups and Items are created here.
   * Knockout.js will automatically draw these and
   * maintain the events ocurred and automatically
   * update the value here.
   */
  self.toolbarGroups = [
    new ToolBarGroup("File: ", [
      new ToolBarItem("Undo", ToolTypeEnum.BUTTON, undefined, function () { alert(""); }),
      new ToolBarItem("Redo", ToolTypeEnum.BUTTON, undefined, function () { alert(""); }),
      new ToolBarItem("Reset", ToolTypeEnum.BUTTON, undefined, function () { alert(""); }),
      new ToolBarItem("Save", ToolTypeEnum.BUTTON, undefined, function () { alert(""); }),
      new ToolBarItem("Open", ToolTypeEnum.BUTTON, undefined, function () { alert(""); })
    ]),
    new ToolBarGroup("Tools: ", [
      new ToolBarItem("Ray", ToolTypeEnum.RADIO),
      new ToolBarItem("Beam", ToolTypeEnum.RADIO),
      new ToolBarItem("Point Light", ToolTypeEnum.RADIO),
      new ToolBarItem("Mirrors", ToolTypeEnum.RADIOLIST, [
        new ToolBarItem("Segment", ToolTypeEnum.RADIO),
        new ToolBarItem("Circular Arc", ToolTypeEnum.RADIO),
        new ToolBarItem("Ideal Curved", ToolTypeEnum.RADIO)
      ]),
      new ToolBarItem("Glasses", ToolTypeEnum.RADIOLIST, [
        new ToolBarItem("Half-plane", ToolTypeEnum.RADIO),
        new ToolBarItem("Circle", ToolTypeEnum.RADIO),
        new ToolBarItem("Free-shape", ToolTypeEnum.RADIO),
        new ToolBarItem("Ideal Lens", ToolTypeEnum.RADIO)
      ]),
      new ToolBarItem("Blocker", ToolTypeEnum.RADIO),
      new ToolBarItem("Ruler", ToolTypeEnum.RADIO),
      new ToolBarItem("Protractor", ToolTypeEnum.RADIO),
      new ToolBarItem("Move View", ToolTypeEnum.RADIO)
    ]),
    new ToolBarGroup("View: ", [
      new ToolBarItem("Rays", ToolTypeEnum.RADIO),
      new ToolBarItem("Extended Rays", ToolTypeEnum.RADIO),
      new ToolBarItem("All Images", ToolTypeEnum.RADIO),
      new ToolBarItem("Seen by Observer", ToolTypeEnum.RADIO)
    ]),
    new ToolBarGroup("Settings: ", [
      new ToolBarItem("Ray Density", ToolTypeEnum.SLIDE, undefined, undefined,
        -3, 3, 0.0001, -2.3026),
      new ToolBarItem("Grid", ToolTypeEnum.CHECK),
      new ToolBarItem("Snap to Grid", ToolTypeEnum.CHECK),
      new ToolBarItem("Lock Objects", ToolTypeEnum.CHECK),
      new ToolBarItem("Zoom", ToolTypeEnum.SLIDE, undefined, undefined,
        25, 500, 25, 100),
      new ToolBarItem("Help", ToolTypeEnum.HELP)
    ])
  ];
}

var toolBarViewModel = new ToolBarViewModel();
ko.applyBindings(toolBarViewModel);
