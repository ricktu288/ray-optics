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
      new ToolBarItem("Undo", undefined, "Undo last action. (Ctrl+Z)",
        ToolTypeEnum.BUTTON, undefined, function () { alert(""); }),
      new ToolBarItem("Redo", undefined, "Redo last action.",
        ToolTypeEnum.BUTTON, undefined, function () { alert(""); }),
      new ToolBarItem("Reset", undefined, "Create new file.",
        ToolTypeEnum.BUTTON, undefined, function () { alert(""); }),
      new ToolBarItem("Save", undefined, "Save the current file. (Ctrl+S)",
        ToolTypeEnum.BUTTON, undefined, function () { alert(""); }),
      new ToolBarItem("Open", undefined, "Open an existing file. (Ctrl+O)",
        ToolTypeEnum.BUTTON, undefined, function () { alert(""); })
    ]),
    new ToolBarGroup("Tools: ", [
      new ToolBarItem("Ray", "ray", "A single ray of light defined by two points. (Drag or Click to create. First point is the source, shooting toward the second point.)",
        ToolTypeEnum.RADIO),
      new ToolBarItem("Beam", "beam", "A parallel beam of rays emerges from a line-segment, with density controlled by the 'Ray density' slider. (Drag or click to create.)",
        ToolTypeEnum.RADIO),
      new ToolBarItem("Point Source", "point_source", "Rays emerge from a single point, with number controlled by the 'Ray density' slider. (Click to create.)",
        ToolTypeEnum.RADIO),
      new ToolBarItem("Mirrors", undefined, 4, ToolTypeEnum.RADIOLIST, [
        new ToolBarItem("Segment", "mirror", "Simulate the reflection of light on a mirror. (Drag or click to create.)",
          ToolTypeEnum.RADIO),
        new ToolBarItem("Circular Arc", "mirror_arc", "A mirror whose shape is part of a circle, which is defined by three points. (Drag or click to create. First 2 points define the gap between arc's edges, the last point defines the arc's size.)",
          ToolTypeEnum.RADIO),
        new ToolBarItem("Ideal Curved", "ideal_curved_mirror", "The idealized 'curved' mirror which obeys exactly the mirror equation (1/p + 1/q = 1/f). The focal length (in pixels) can be set directly. (Drag or click to create.)",
          ToolTypeEnum.RADIO)
      ]),
      new ToolBarItem("Glasses", undefined, 3, ToolTypeEnum.RADIOLIST, [
        new ToolBarItem("Half-plane", "glass_halfplane", "Simulate the the refraction and reflection of light on a surface. The intensities are calculated by assuming unpolarized. (Drag or click to create.)",
          ToolTypeEnum.RADIO),
        new ToolBarItem("Circle", "glass_circle", "Glass with circle shape, defined by its center and a point on the surface. (Drag or click to create.)",
          ToolTypeEnum.RADIO),
        new ToolBarItem("Free-shape", "glass", "Glass with any shapes constructed from line segments and circular arcs, including prisms and 'spherical' lenses. (Click to create segment, drag to create arc, click on the starting point when finish drawing.)",
          ToolTypeEnum.RADIO),
        new ToolBarItem("Ideal Lens", "ideal_lens", "An ideal lens which obeys exactly the thin lens equation (1/p + 1/q = 1/f). The focal length (in pixels) can be set directly. (Drag or click to create.)",
          ToolTypeEnum.RADIO)
      ]),
      new ToolBarItem("Blocker", "blocker", "A line-segment light blocker which absorbs the incident rays. (Drag or click to create.)",
        ToolTypeEnum.RADIO),
      new ToolBarItem("Ruler", "ruler", "A ruler from a point for zero and another point. The scale is in pixels. (Drag or click to create.)",
        ToolTypeEnum.RADIO),
      new ToolBarItem("Protractor", "protractor", "A protractor defined from center and another point for the zero direction. The scale is in degrees. (Drag or click to create.)",
        ToolTypeEnum.RADIO),
      new ToolBarItem("Move View", undefined, "Drag to move view. (Mouse right button drag has the same function.",
        ToolTypeEnum.RADIO)
    ]),
    new ToolBarGroup("View: ", [
      new ToolBarItem("Rays", "normal", "Show the rays. When the 'Ray density' is high, they appears to be continuous.",
        ToolTypeEnum.RADIO),
      new ToolBarItem("Extended Rays", "extended_rays", "Show both the rays and its extension. Orange indicates backward extensions, and gray indicates forward ones.",
        ToolTypeEnum.RADIO),
      new ToolBarItem("All Images", "all_images", "Show the position of all images. Yellow points indicate real images, orange indicate virtual images, and gray (none in this picture) indicate virtual objects. Note that some images cannot be detected if 'Ray density' is not high enough.",
        ToolTypeEnum.RADIO),
      new ToolBarItem("Seen by Observer", "seen_by_observer", "Simulate the rays and images seen from some position. The blue circle is the observer. Any rays crossing it are considered to be 'observed'. The observer do not know where the rays actually begin, but may think they begin at some point(s) if they intersect there. The rays are shown in blue, and the point(s) in orange. (Drag the big blue dot to move the observer.)",
        ToolTypeEnum.RADIO)
    ]),
    new ToolBarGroup("Settings: ", [
      new ToolBarItem("Ray Density", undefined, "Decides how dense should the lights be simulated.",
        ToolTypeEnum.SLIDE, undefined, undefined,
        -3, 3, 0.0001, -2.3026),
      new ToolBarItem("Grid", undefined, "Defines the visibility of the background grid.",
        ToolTypeEnum.CHECK),
      new ToolBarItem("Snap to Grid", undefined, "Defines whether to snap to grid.",
        ToolTypeEnum.CHECK),
      new ToolBarItem("Lock Objects", undefined, "Defines whether the objects can be moved or not.",
        ToolTypeEnum.CHECK),
      new ToolBarItem("Zoom", undefined, "Zoom the view with percentage.",
        ToolTypeEnum.SLIDE, undefined, undefined,
        25, 500, 25, 100),
      new ToolBarItem("Help", undefined, "Toggle help popup. <br><br>Some other tips: <br>Click to select object, <br>Ctrl+D to duplicate, <br>Delete key to delete, <br>Arrow keys to move slowly. <br>When creating line objects, <br>Hold Shift to lock angle, <br>hold Ctrl to make the first point be the center point.",
        ToolTypeEnum.HELP, undefined)
    ])
  ];
}

var toolBarViewModel = new ToolBarViewModel();
ko.applyBindings(toolBarViewModel);

$("#help").click(function () {
  if (this.checked)
    $("[data-toggle=popover]").popover("enable");
  else
    $("[data-toggle=popover]").popover("disable");
});