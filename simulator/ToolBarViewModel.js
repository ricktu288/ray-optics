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
      new ToolBarItem("Undo", "undo", undefined, "Undo last action. (Ctrl+Z)",
        ToolTypeEnum.BUTTON, undefined, function () { alert(""); }),
      new ToolBarItem("Redo", "redo", undefined, "Redo last action.",
        ToolTypeEnum.BUTTON, undefined, function () { alert(""); }),
      new ToolBarItem("Reset", "reset", undefined, "Create new file.",
        ToolTypeEnum.BUTTON, undefined, function () { alert(""); }),
      new ToolBarItem("Save", "save", undefined, "Save the current file. (Ctrl+S)",
        ToolTypeEnum.BUTTON, undefined, function () { alert(""); }),
      new ToolBarItem("Open", "open", undefined, "Open an existing file. (Ctrl+O)",
        ToolTypeEnum.BUTTON, undefined, function () { alert(""); })
    ]),
    new ToolBarGroup("Tools: ", [
      new ToolBarItem("Ray", "tool_laser", "ray", "A single ray of light defined by two points. (Drag or Click to create. First point is the source, shooting toward the second point.)",
        ToolTypeEnum.RADIO),
      new ToolBarItem("Beam", "tool_parallel", "beam", "A parallel beam of rays emerges from a line-segment, with density controlled by the 'Ray density' slider. (Drag or click to create.)",
        ToolTypeEnum.RADIO),
      new ToolBarItem("Point Source", "tool_radiant", "point_source", "Rays emerge from a single point, with number controlled by the 'Ray density' slider. (Click to create.)",
        ToolTypeEnum.RADIO),
      new ToolBarItem("Mirrors", "tool_mirror_", undefined, 4, ToolTypeEnum.RADIOLIST, [
        new ToolBarItem("Segment", "tool_mirror", "mirror", "Simulate the reflection of light on a mirror. (Drag or click to create.)",
          ToolTypeEnum.RADIO),
        new ToolBarItem("Circular Arc", "tool_arcmirror", "mirror_arc", "A mirror whose shape is part of a circle, which is defined by three points. (Drag or click to create. First 2 points define the gap between arc's edges, the last point defines the arc's size.)",
          ToolTypeEnum.RADIO),
        new ToolBarItem("Ideal Curved", "tool_idealmirror", "ideal_curved_mirror", "The idealized 'curved' mirror which obeys exactly the mirror equation (1/p + 1/q = 1/f). The focal length (in pixels) can be set directly. (Drag or click to create.)",
          ToolTypeEnum.RADIO)
      ]),
      new ToolBarItem("Glasses", "tool_refractor_", undefined, 3, ToolTypeEnum.RADIOLIST, [
        new ToolBarItem("Half-plane", "tool_halfplane", "glass_halfplane", "Simulate the the refraction and reflection of light on a surface. The intensities are calculated by assuming unpolarized. (Drag or click to create.)",
          ToolTypeEnum.RADIO),
        new ToolBarItem("Circle", "tool_circlelens", "glass_circle", "Glass with circle shape, defined by its center and a point on the surface. (Drag or click to create.)",
          ToolTypeEnum.RADIO),
        new ToolBarItem("Free-shape", "tool_refractor", "glass", "Glass with any shapes constructed from line segments and circular arcs, including prisms and 'spherical' lenses. (Click to create segment, drag to create arc, click on the starting point when finish drawing.)",
          ToolTypeEnum.RADIO),
        new ToolBarItem("Ideal Lens", "tool_lens", "ideal_lens", "An ideal lens which obeys exactly the thin lens equation (1/p + 1/q = 1/f). The focal length (in pixels) can be set directly. (Drag or click to create.)",
          ToolTypeEnum.RADIO)
      ]),
      new ToolBarItem("Blocker", "tool_blackline", "blocker", "A line-segment light blocker which absorbs the incident rays. (Drag or click to create.)",
        ToolTypeEnum.RADIO),
      new ToolBarItem("Ruler", "tool_ruler", "ruler", "A ruler from a point for zero and another point. The scale is in pixels. (Drag or click to create.)",
        ToolTypeEnum.RADIO),
      new ToolBarItem("Protractor", "tool_protractor", "protractor", "A protractor defined from center and another point for the zero direction. The scale is in degrees. (Drag or click to create.)",
        ToolTypeEnum.RADIO),
      new ToolBarItem("Move View", "tool_", undefined, "Drag to move view. (Mouse right button drag has the same function.",
        ToolTypeEnum.RADIO)
    ]),
    new ToolBarGroup("View: ", [
      new ToolBarItem("Rays", "mode_light", "normal", "Show the rays. When the 'Ray density' is high, they appears to be continuous.",
        ToolTypeEnum.RADIO),
      new ToolBarItem("Extended Rays", "mode_extended_light", "extended_rays", "Show both the rays and its extension. Orange indicates backward extensions, and gray indicates forward ones.",
        ToolTypeEnum.RADIO),
      new ToolBarItem("All Images", "mode_images", "all_images", "Show the position of all images. Yellow points indicate real images, orange indicate virtual images, and gray (none in this picture) indicate virtual objects. Note that some images cannot be detected if 'Ray density' is not high enough.",
        ToolTypeEnum.RADIO),
      new ToolBarItem("Seen by Observer", "mode_observer", "seen_by_observer", "Simulate the rays and images seen from some position. The blue circle is the observer. Any rays crossing it are considered to be 'observed'. The observer do not know where the rays actually begin, but may think they begin at some point(s) if they intersect there. The rays are shown in blue, and the point(s) in orange. (Drag the big blue dot to move the observer.)",
        ToolTypeEnum.RADIO)
    ]),
    new ToolBarGroup("Settings: ", [
      new ToolBarItem("Ray Density", "rayDensity", undefined, "Decides how dense should the lights be simulated.",
        ToolTypeEnum.SLIDE, undefined, undefined,
        -3, 3, 0.0001, -2.3026),
      new ToolBarItem("Grid", "showgrid", undefined, "Defines the visibility of the background grid.",
        ToolTypeEnum.CHECK),
      new ToolBarItem("Snap to Grid", "grid", undefined, "Defines whether to snap to grid.",
        ToolTypeEnum.CHECK),
      new ToolBarItem("Lock Objects", "lockobjs", undefined, "Defines whether the objects can be moved or not.",
        ToolTypeEnum.CHECK),
      new ToolBarItem("Zoom", "zoom", undefined, "Zoom the view with percentage.",
        ToolTypeEnum.SLIDE, undefined, undefined,
        25, 500, 25, 100),
      new ToolBarItem("Help", "help", undefined, "Toggle help popup. <br><br>Some other tips: <br>Click to select object, <br>Ctrl+D to duplicate, <br>Delete key to delete, <br>Arrow keys to move slowly. <br>When creating line objects, <br>Hold Shift to lock angle, <br>hold Ctrl to make the first point be the center point.",
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