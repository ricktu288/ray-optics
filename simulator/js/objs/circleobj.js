// the prototype of circular objects
objTypes['circleobj'] = {

  // Mousedown when the obj is being constructed by the user
  onConstructMouseDown: function (obj, constructionPoint, mouse, ctrl, shift) {
    if (shift) {
      obj.p2 = mouse.getPosSnappedToDirection(constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
    }
    else {
      obj.p2 = mouse.getPosSnappedToGrid();
    }
  },

  // Mousemove when the obj is being constructed by the user
  onConstructMouseMove: function (obj, constructionPoint, mouse, ctrl, shift) {
    if (shift) {
      obj.p2 = mouse.getPosSnappedToDirection(constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
    }
    else {
      obj.p2 = mouse.getPosSnappedToGrid();
    }

    obj.p1 = constructionPoint;
  },
  // Mouseup when the obj is being constructed by the user
  onConstructMouseUp: function (obj, constructionPoint, mouse, ctrl, shift) {
    if (!mouse.isOnPoint(obj.p1)) {
      return {
        isDone: true
      };
    }
  },

  // Move the object
  move: function (obj, diffX, diffY) {
    // Move the center point
    obj.p1.x = obj.p1.x + diffX;
    obj.p1.y = obj.p1.y + diffY;
    // Move the point on the radius
    obj.p2.x = obj.p2.x + diffX;
    obj.p2.y = obj.p2.y + diffY;
  },


  // When the drawing area is clicked (test which part of the obj is clicked)
  // When the drawing area is pressed (to determine the part of the object being pressed)
  checkMouseOver: function (obj, mouse) {
    let dragContext = {};
    // clicking on p1 (center)?
    if (mouse.isOnPoint(obj.p1) && geometry.distanceSquared(mouse.pos, obj.p1) <= geometry.distanceSquared(mouse.pos, obj.p2)) {
      dragContext.part = 1;
      dragContext.targetPoint = geometry.point(obj.p1.x, obj.p1.y);
      return dragContext;
    }
    // clicking on p2 (edge)?
    if (mouse.isOnPoint(obj.p2)) {
      dragContext.part = 2;
      dragContext.targetPoint = geometry.point(obj.p2.x, obj.p2.y);
      return dragContext;
    }
    // clicking on outer edge of circle?  then drag entire circle
    if (Math.abs(geometry.distance(obj.p1, mouse.pos) - geometry.segmentLength(obj)) < mouse.getClickExtent()) {
      const mousePos = mouse.getPosSnappedToGrid();
      dragContext.part = 0;
      dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
      dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
      dragContext.snapContext = {};
      return dragContext;
    }
  },

  // When the user is dragging the obj
  onDrag: function (obj, mouse, dragContext, ctrl, shift) {
    var basePoint;
    if (dragContext.part == 1) {
      // Dragging the center point
      basePoint = ctrl ? geometry.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p2;

      obj.p1 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
      obj.p2 = ctrl ? geometry.point(2 * basePoint.x - obj.p1.x, 2 * basePoint.y - obj.p1.y) : basePoint;
    }
    if (dragContext.part == 2) {
      // Dragging the point on the radius
      basePoint = dragContext.originalObj.p1;

      obj.p2 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
      obj.p1 = ctrl ? geometry.point(2 * basePoint.x - obj.p2.x, 2 * basePoint.y - obj.p2.y) : basePoint;
    }
    if (dragContext.part == 0) {
      // Dragging the entire circle

      if (shift) {
        var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }, { x: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y), y: -(dragContext.originalObj.p2.x - dragContext.originalObj.p1.x) }], dragContext.snapContext);
      }
      else {
        var mousePos = mouse.getPosSnappedToGrid();
        dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
      }

      var mouseDiffX = dragContext.mousePos1.x - mousePos.x; // The X difference between the mouse position now and at the previous moment
      var mouseDiffY = dragContext.mousePos1.y - mousePos.y; // The Y difference between the mouse position now and at the previous moment The Y difference between the mouse position now and at the previous moment
      // Move the center point
      obj.p1.x = obj.p1.x - mouseDiffX;
      obj.p1.y = obj.p1.y - mouseDiffY;
      // Move the point on the radius
      obj.p2.x = obj.p2.x - mouseDiffX;
      obj.p2.y = obj.p2.y - mouseDiffY;
      // Update the mouse position
      dragContext.mousePos1 = mousePos;
    }
  },

  // Test if a ray may shoot on this object (if yes, return the intersection)
  checkRayIntersects: function (obj, ray) {
    var rp_temp = geometry.lineCircleIntersections(geometry.line(ray.p1, ray.p2), geometry.circle(obj.p1, obj.p2));
    var rp_exist = [];
    var rp_lensq = [];
    for (var i = 1; i <= 2; i++) {

      rp_exist[i] = geometry.intersectionIsOnRay(rp_temp[i], ray) && geometry.distanceSquared(rp_temp[i], ray.p1) > minShotLength_squared;


      rp_lensq[i] = geometry.distanceSquared(ray.p1, rp_temp[i]);
    }

    if (rp_exist[1] && ((!rp_exist[2]) || rp_lensq[1] < rp_lensq[2])) {
      return rp_temp[1];
    }
    if (rp_exist[2] && ((!rp_exist[1]) || rp_lensq[2] < rp_lensq[1])) {
      return rp_temp[2];
    }
  },
};
