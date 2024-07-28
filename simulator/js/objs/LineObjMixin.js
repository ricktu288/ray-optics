/**
 * The mixin for the scene objects that are defined by a line segment.
 * @mixin
 * @property {Point} p1 - The first endpoint of the line segment.
 * @property {Point} p2 - The second endpoint of the line segment.
 */
const LineObjMixin = Base => class extends Base {

  move(diffX, diffY) {
    // Move the first point
    this.p1.x = this.p1.x + diffX;
    this.p1.y = this.p1.y + diffY;
    // Move the second point
    this.p2.x = this.p2.x + diffX;
    this.p2.y = this.p2.y + diffY;
  }
  
  onConstructMouseDown(mouse, ctrl, shift) {
    if (!this.constructionPoint) {
      // Initialize the construction stage.
      this.constructionPoint = mouse.getPosSnappedToGrid();
      this.p1 = this.constructionPoint;
      this.p2 = this.constructionPoint;
    }
    if (shift) {
      this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
    } else {
      this.p2 = mouse.getPosSnappedToGrid();
    }
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    if (shift) {
      this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
    } else {
      this.p2 = mouse.getPosSnappedToGrid();
    }

    this.p1 = ctrl ? geometry.point(2 * this.constructionPoint.x - this.p2.x, 2 * this.constructionPoint.y - this.p2.y) : this.constructionPoint;
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    if (!mouse.isOnPoint(this.p1)) {
      delete this.constructionPoint;
      return {
        isDone: true
      };
    }
  }

  checkMouseOver(mouse) {
    let dragContext = {};
    if (mouse.isOnPoint(this.p1) && geometry.distanceSquared(mouse.pos, this.p1) <= geometry.distanceSquared(mouse.pos, this.p2)) {
      dragContext.part = 1;
      dragContext.targetPoint = geometry.point(this.p1.x, this.p1.y);
      return dragContext;
    }
    if (mouse.isOnPoint(this.p2)) {
      dragContext.part = 2;
      dragContext.targetPoint = geometry.point(this.p2.x, this.p2.y);
      return dragContext;
    }
    if (mouse.isOnSegment(this)) {
      const mousePos = mouse.getPosSnappedToGrid();
      dragContext.part = 0;
      dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
      dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
      dragContext.snapContext = {};
      return dragContext;
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    var basePoint;
    if (dragContext.part == 1) {
      // Dragging the first endpoint Dragging the first endpoint
      basePoint = ctrl ? geometry.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p2;

      this.p1 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
      this.p2 = ctrl ? geometry.point(2 * basePoint.x - this.p1.x, 2 * basePoint.y - this.p1.y) : basePoint;
    }
    if (dragContext.part == 2) {
      // Dragging the second endpoint Dragging the second endpoint
      basePoint = ctrl ? geometry.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p1;

      this.p2 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
      this.p1 = ctrl ? geometry.point(2 * basePoint.x - this.p2.x, 2 * basePoint.y - this.p2.y) : basePoint;
    }
    if (dragContext.part == 0) {
      // Dragging the entire line

      if (shift) {
        var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }, { x: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y), y: -(dragContext.originalObj.p2.x - dragContext.originalObj.p1.x) }], dragContext.snapContext);
      } else {
        var mousePos = mouse.getPosSnappedToGrid();
        dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
      }

      var mouseDiffX = dragContext.mousePos1.x - mousePos.x; // The X difference between the mouse position now and at the previous moment
      var mouseDiffY = dragContext.mousePos1.y - mousePos.y; // The Y difference between the mouse position now and at the previous moment The Y difference between the mouse position now and at the previous moment
      // Move the first point
      this.p1.x = this.p1.x - mouseDiffX;
      this.p1.y = this.p1.y - mouseDiffY;
      // Move the second point
      this.p2.x = this.p2.x - mouseDiffX;
      this.p2.y = this.p2.y - mouseDiffY;
      // Update the mouse position
      dragContext.mousePos1 = mousePos;
    }
  }

  /**
   * Check if a ray intersects the line segment.
   * In the child class, this can be called from the `checkRayIntersects` method.
   * @param {Ray} ray - The ray.
   * @returns {Point} The intersection point, or null if there is no intersection.
   */
  checkRayIntersectsShape(ray) {
    var rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(this.p1, this.p2));

    if (geometry.intersectionIsOnSegment(rp_temp, this) && geometry.intersectionIsOnRay(rp_temp, ray)) {
      return rp_temp;
    } else {
      return null;
    }
  }

  /**
   * Add normal-translation and angle options to the object bar.
   * These are both things that affect both points of the line segment.
   * @param {ObjectBar} objBar - The object bar.
   */
  populateObjBar(objBar) {
    if (this.p1.y == this.p2.y && this.p1.x == this.p2.x) {
      // If the lens is a point, don't show any other options
      return;
    }
    // Store the initial positions of p1 and p2
    var initialP1 = Object.assign({}, this.p1);
    var initialP2 = Object.assign({}, this.p2);
    // Calculate the normal vector
    var normal = geometry.normalVector(this.p1, this.p2);

    var normal_slider = objBar.createNumber(
      getMsg("normal translation"),
      -300 * this.scene.lengthScale,
      300 * this.scene.lengthScale,
      1 * this.scene.lengthScale,
      0,
      function (obj, value) {
        // Calculate the new positions based on the initial positions and the absolute value
        var deltaX = normal.x * value;
        var deltaY = normal.y * value;

        obj.p1.x = initialP1.x + deltaX;
        obj.p1.y = initialP1.y + deltaY;
        obj.p2.x = initialP2.x + deltaX;
        obj.p2.y = initialP2.y + deltaY;
      }
    );

    objBar.createNumber(
      getMsg("angle"),
      0,
      360,
      1,
      (geometry.angleBetweenPoints(this.p1, this.p2) * 180) / Math.PI,
      function (obj, value) {
        // Rotate the lens around the midpoint
        var new_points = geometry.rotatePointsToAngle(obj.p1, obj.p2, (value * Math.PI) / 180);
        obj.p1 = new_points[0];
        obj.p2 = new_points[1];

        // reset the normal vector translation
        initialP1 = Object.assign({}, obj.p1);
        initialP2 = Object.assign({}, obj.p2);
        normal = geometry.normalVector(obj.p1, obj.p2);
        normal_slider.value = 0;
        normal_slider.onchange();
      }
    );
  }
  
};
