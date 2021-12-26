/* This is a template for making your own tools. See README.md for more instructions. */

objTypes['id_of_your_tool'] = {
  
  // If your tool has a property to be adjusted with a slider, include the following four properties:
  p_name: 'name_for_the_slider',
  p_min: the_minimum_value,
  p_max: the_maximum_value,
  p_step: the_step_for_the_slider,

  create: function(mouse) {
    // Return the initial status of the object when the user first click the view to create it (the construction may or may not be completed at this stage). the coordinates of the mouse are (mouse.x, mouse.y). The following line is for a linear object with a slider as an example.
    return {type: 'id_of_your_tool', p1: mouse, p2: mouse, p: default_value_for_the_slider_if_any};
  },
  
  /* INTERACTIONS WITH THE USER */
  // If your object has the shape of a line segment, then use the followings:
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,
  // Or you may look at if there are existing objTypes your tool can inherit. Otherwise, you need to implement your own:
  c_mousedown: function(obj, mouse) {
    // Called when mousedown occurs on the view when the user is still constructing the object. Modify obj here if necessary. No return value is needed. An example of adding a control point to obj is:
    obj.some_control_point = mouse;
    draw(); // Call to redraw the canvas.
    // If the constructing is done, set:
    isConstructing = false;
  },
  c_mousemove: function(obj, mouse, ctrl, shift) {
    // Similar to c_mousedown. You can access whether the user is holding the ctrl and the shift keys.
  },
  c_mousedown: function(obj, mouse) {
    // Similar to c_mousedown.
  },
  move: function(obj, diffX, diffY) {
    // Move the position of obj by (diffX, diffY). An example of moving a point is
    obj.some_control_point.x += diffX;
    obj.some_control_point.y += diffY;
    // Make sure all control points are moved. No return value is needed.
  },
  clicked: function(obj, mouse_nogrid, mouse, draggingPart) {
    // Called when need to check whether the mouse is on the object, and if so, which part of it the user would be dragging if the user really clicked it. Note that this method may be called even if no click is actually performed.
    // mouse_nogrid is the real position of the mouse, mouse is the nearest snapping point if "snap to grid" is on.
    // To test if the mouse is on some control point:
    if (mouseOnPoint(mouse_nogrid, obj.some_control_point)) {
      draggingPart.part = part_id; // a number to indicate the control point.
      draggingPart.targetPoint = graphs.point(obj.some_control_point.x, obj.some_control_point.y);
      return true;
    }
    // Use mouseOnSegment(mouse_nogrid, some_segment) to test if the mouse is on the segment from some_segment.p1 to some_segment.p2, and use the following:
    if (mouse_on_some_non_point_part) {
        draggingPart.part = part_id; // a number to indicate the part the user would be dragging. In particular, if the user would be dragging the entire object, part_id should be 0.
        draggingPart.mouse0 = mouse;
        draggingPart.mouse1 = mouse;
        draggingPart.snapData = {};
        return true;
    }
    // If the mouse is not on the object:
    return false;
  },
  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    // Called when the user is really dragging obj. Modify obj here according to the draggingPart you set in clicked and the coordinate of the mouse and whether the user is holding ctrl or shift. No return value is needed. Some examples are:
    if (draggingPart.part == part_id_for_some_control_point) {
      obj.some_control_point = mouse;
    }
    if (draggingPart.part == 0) {
      var mouse_snapped = some_snapping_of_mouse_if_needed; // You can see objTypes['lineobj'] in index.js as an example. If you do not need snapping support, just set it to mouse.
      var mouseDiffX = draggingPart.mouse1.x - mouse_snapped.x;
      var mouseDiffY = draggingPart.mouse1.y - mouse_snapped.y;

      // Move obj by (mouseDiffX, mouseDiffY) here.

      draggingPart.mouse1 = mouse_snapped;
    }
  },


  /* DRAW THE OBJECT */
  draw: function(obj, canvas, aboveLight) {
    // Called when the obj is to be drawn on canvas. It is called once before rendering the light with aboveLight == false and once after with aboveLight == true. No return value is needed.
    // You should directly use the global variable ctx here, rather than from the canvas parameter.
    ctx.some_color_style = getMouseStyle(obj, some_color); // Use this when the color is to be replaced by a highlighted color if the mouse is above the object.
    ctx.some_drawing_commands
    // Note that when the scene is being exported to SVG, the ctx is temporarily replaced by that provided by canvas2svg, which does not support certain commands and some behaviors are different from the real ctx. Use ctx.constructor == C2S to detect and do some workaround if needed.
    // In case that some temporary data is needed to be stored in obj, you can use the prefix "tmp_" to avoid being exported as JSON.
  }

  /* INTERACTIONS WITH THE SIMULATOR */
  // If your object is a light source, include the following method:
  shoot: function(obj) {
    // Called when the object is to shoot rays. For each rays to be shot, use the following:
    var ray1 = graphs.ray(initial_point, second_point_to_indicate_direction); // The points can be created by graphs.point(x, y).
    ray1.brightness_s = intensity_of_s_polarization;
    ray1.brightness_p = intensity_of_p_polarization;
    // Note that the alpha value when the ray is drawn is the sum of them.
    ray1.gap = true; // True if it is the first ray in a bunch of rays shot by the object, false otherwise. This is for the detection of images to work currectly.
    ray1.isNew = true;
    addRay(ray1);
  },
  
  // If your object is a device that interacts with incoming light, include the following two methods:
  // For the detection of intersection with an incoming ray, if your object has a shape of a line segment, use
  rayIntersection: objTypes['lineobj'].rayIntersection,
  // Or you may look at if there are existing objTypes your tool can inherit. Otherwise, you need to implement your own:
  rayIntersection: function(obj, ray) {
    // Called when ray is to be tested whether it intersects with obj. The origin of the ray is at (ray.p1.x, ray.p1.y), with a second point (ray.p2.x, ray.p2.y) indicating its direction. Return the intersection point which is nearest the origin of the ray. Return nothing if there is no intersection.
    // You can use the geometric functions in the object "graphs" to help calculate the intersection.
    // If the intersection is calculated to be at (x, y), you may use:
    return graphs.point(x, y);
  },
  shot: function(obj, ray, rayIndex, rp) {
    // Called when ray has been calculated to be shot on obj at the intersection rp and the interaction between ray and obj is to be performed. You should modify the ray or create more rays here. No return value is needed.
    // NOTE: If your object contains some refracting surface, You may need the "surface merging" feature so that if there is another surface overlapping with it, the interaction will only be calculated once with the two (or even more) surfaces combined. Note that treating them as two very close surfaces does not work. This is an essential discontinuity of ray optics. (In reality, this discontinuity is smoothed out at the scale of the wavelength, but this is not the purpose of this simulation.) However, the "surface merging" feature is very complicated (search for "Merging" in index.js). If you don't want to deal with it, you can choose to parametrize your surface with lines and circular arcs, and let the rayIntersection, shot, along with some other methods be inherited from objTypes['refractor']. See objTypes['sphericallens'] in index.js for an example.

    // To modify the original ray, you may use:
    ray.p1 = new_initial_point; // Usually equals rp.
    ray.p2 = graphs.point(x, y); // where (x, y) is the point indicating the new direction of the ray.
    ray.brightness_s = new_intensity_of_s_polarization;
    ray.brightness_p = new_intensity_of_p_polarization;
    // Note that the alpha value when the ray is drawn is the sum of them.
    // If the ray is to be absorbed, set:
    ray.exist = false;

    // To create a new ray, you may use:
    var ray1 = graphs.ray(initial_point, second_point_to_indicate_direction); // The points can be created by graphs.point(x, y)
    ray1.brightness_s = intensity_of_s_polarization;
    ray1.brightness_p = intensity_of_p_polarization;
    ray1.gap = ray.gap;
    addRay(ray1);

    // Sometimes keeping tracks of all the rays may result in infinite loop. Depending on the situation, some rays with brightness below a certain threshold (such as 0.01) may be neglected. If you neglect a ray, use the following code for the "detector" tool to estimate the error:
    totalTruncation += neglected_intensity_of_s_polarization + neglected_intensity_of_p_polarization;

    // If the incoming rays are in a continuous bunch, sometimes you may want to do something on every other incoming rays (or every nth). In such case, use:
    if (!ray.gap && rayIndex % n == 0) {
      // do something
    }
  }
};
