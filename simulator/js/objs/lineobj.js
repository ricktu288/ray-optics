// the prototype of linear objects
objTypes['lineobj'] = {

  // Mousedown when the obj is being constructed by the user
  c_mousedown: function (obj, mouse, ctrl, shift) {
    if (shift) {
      obj.p2 = mouse.getPosSnappedToDirection(constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
    }
    else {
      obj.p2 = mouse.getPosSnappedToGrid();
    }
  },

  // Mousemove when the obj is being constructed by the user
  c_mousemove: function (obj, mouse, ctrl, shift) {
    if (shift) {
      obj.p2 = mouse.getPosSnappedToDirection(constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
    }
    else {
      obj.p2 = mouse.getPosSnappedToGrid();
    }

    obj.p1 = ctrl ? geometry.point(2 * constructionPoint.x - obj.p2.x, 2 * constructionPoint.y - obj.p2.y) : constructionPoint;
  },
  // Mouseup when the obj is being constructed by the user
  c_mouseup: function (obj, mouse, ctrl, shift) {
    if (!mouse.isOnPoint(obj.p1)) {
      return {
        isDone: true
      };
    }
  },

  // Move the object
  move: function (obj, diffX, diffY) {
    // Move the first point
    obj.p1.x = obj.p1.x + diffX;
    obj.p1.y = obj.p1.y + diffY;
    // Move the second point
    obj.p2.x = obj.p2.x + diffX;
    obj.p2.y = obj.p2.y + diffY;
  },


  // When the drawing area is clicked (test which part of the obj is clicked)
  clicked: function (obj, mouse, draggingPart) {
    if (mouse.isOnPoint(obj.p1) && geometry.length_squared(mouse.pos, obj.p1) <= geometry.length_squared(mouse.pos, obj.p2)) {
      draggingPart.part = 1;
      draggingPart.targetPoint = geometry.point(obj.p1.x, obj.p1.y);
      return true;
    }
    if (mouse.isOnPoint(obj.p2)) {
      draggingPart.part = 2;
      draggingPart.targetPoint = geometry.point(obj.p2.x, obj.p2.y);
      return true;
    }
    if (mouse.isOnSegment(obj)) {
      const mousePos = mouse.getPosSnappedToGrid();
      draggingPart.part = 0;
      draggingPart.mousePos0 = mousePos; // Mouse position when the user starts dragging
      draggingPart.mousePos1 = mousePos; // Mouse position at the last moment during dragging
      draggingPart.snapData = {};
      return true;
    }
    return false;
  },

  // When the user is dragging the obj
  dragging: function (obj, mouse, draggingPart, ctrl, shift) {
    var basePoint;
    if (draggingPart.part == 1) {
      // Dragging the first endpoint Dragging the first endpoint
      basePoint = ctrl ? geometry.midpoint(draggingPart.originalObj) : draggingPart.originalObj.p2;

      obj.p1 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
      obj.p2 = ctrl ? geometry.point(2 * basePoint.x - obj.p1.x, 2 * basePoint.y - obj.p1.y) : basePoint;
    }
    if (draggingPart.part == 2) {
      // Dragging the second endpoint Dragging the second endpoint
      basePoint = ctrl ? geometry.midpoint(draggingPart.originalObj) : draggingPart.originalObj.p1;

      obj.p2 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
      obj.p1 = ctrl ? geometry.point(2 * basePoint.x - obj.p2.x, 2 * basePoint.y - obj.p2.y) : basePoint;
    }
    if (draggingPart.part == 0) {
      // Dragging the entire line

      if (shift) {
        var mousePos = mouse.getPosSnappedToDirection(draggingPart.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: (draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x), y: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y) }, { x: (draggingPart.originalObj.p2.y - draggingPart.originalObj.p1.y), y: -(draggingPart.originalObj.p2.x - draggingPart.originalObj.p1.x) }], draggingPart.snapData);
      }
      else {
        var mousePos = mouse.getPosSnappedToGrid();
        draggingPart.snapData = {}; // Unlock the dragging direction when the user release the shift key
      }

      var mouseDiffX = draggingPart.mousePos1.x - mousePos.x; // The X difference between the mouse position now and at the previous moment
      var mouseDiffY = draggingPart.mousePos1.y - mousePos.y; // The Y difference between the mouse position now and at the previous moment The Y difference between the mouse position now and at the previous moment
      // Move the first point
      obj.p1.x = obj.p1.x - mouseDiffX;
      obj.p1.y = obj.p1.y - mouseDiffY;
      // Move the second point
      obj.p2.x = obj.p2.x - mouseDiffX;
      obj.p2.y = obj.p2.y - mouseDiffY;
      // Update the mouse position
      draggingPart.mousePos1 = mousePos;
    }
  },

  // Test if a ray may shoot on this object (if yes, return the intersection)
  rayIntersection: function (obj, ray) {
    var rp_temp = geometry.intersection_2line(geometry.line(ray.p1, ray.p2), geometry.line(obj.p1, obj.p2));

    if (geometry.intersection_is_on_segment(rp_temp, obj) && geometry.intersection_is_on_ray(rp_temp, ray)) {
      return rp_temp;
    }
  }


};
