/**
 * Mirror with shape of a circular arc.
 * Tools -> Mirror -> Circular Arc
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {Point} p3 - The control point on the arc.
 * @property {boolean} isDichroic - Whether it is a dichroic mirror.
 * @property {boolean} isDichroicFilter - If true, the ray with wavelength outside the bandwidth is reflected. If false, the ray with wavelength inside the bandwidth is reflected.
 * @property {number} wavelength - The target wavelength if dichroic is enabled. The unit is nm.
 * @property {number} bandwidth - The bandwidth if dichroic is enabled. The unit is nm.
 */
objTypes['arcmirror'] = class extends BaseFilter {
  static type = 'arcmirror';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    p3: null,
    isDichroic: false,
    isDichroicFilter: false,
    wavelength: GREEN_WAVELENGTH,
    bandwidth: 10
  };

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    ctx.fillStyle = 'rgb(255,0,255)';
    if (this.p3 && this.p2) {
      var center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(this.p1, this.p3)), geometry.perpendicularBisector(geometry.line(this.p2, this.p3)));
      if (isFinite(center.x) && isFinite(center.y)) {
        var r = geometry.distance(center, this.p3);
        var a1 = Math.atan2(this.p1.y - center.y, this.p1.x - center.x);
        var a2 = Math.atan2(this.p2.y - center.y, this.p2.x - center.x);
        var a3 = Math.atan2(this.p3.y - center.y, this.p3.x - center.x);
        ctx.strokeStyle = isHovered ? 'cyan' : ((scene.colorMode && this.wavelength && this.isDichroic) ? wavelengthToColor(this.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(168,168,168)');
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, a1, a2, (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2));
        ctx.stroke();
        if (isHovered) {
          ctx.fillRect(this.p3.x - 1.5, this.p3.y - 1.5, 3, 3);
          ctx.fillStyle = 'rgb(255,0,0)';
          ctx.fillRect(this.p1.x - 1.5, this.p1.y - 1.5, 3, 3);
          ctx.fillRect(this.p2.x - 1.5, this.p2.y - 1.5, 3, 3);
        }
      } else {
        // The three points on the arc is colinear. Treat as a line segment.
        ctx.strokeStyle = isHovered ? 'cyan' : ((scene.colorMode && this.wavelength && this.isDichroic) ? wavelengthToColor(this.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(168,168,168)');
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.stroke();

        ctx.fillRect(this.p3.x - 1.5, this.p3.y - 1.5, 3, 3);
        ctx.fillStyle = 'rgb(255,0,0)';
        ctx.fillRect(this.p1.x - 1.5, this.p1.y - 1.5, 3, 3);
        ctx.fillRect(this.p2.x - 1.5, this.p2.y - 1.5, 3, 3);
      }
    } else if (this.p2) {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(this.p1.x - 1.5, this.p1.y - 1.5, 3, 3);
      ctx.fillRect(this.p2.x - 1.5, this.p2.y - 1.5, 3, 3);
    } else {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(this.p1.x - 1.5, this.p1.y - 1.5, 3, 3);
    }
  }

  move(diffX, diffY) {
    this.p1.x = this.p1.x + diffX;
    this.p1.y = this.p1.y + diffY;
    this.p2.x = this.p2.x + diffX;
    this.p2.y = this.p2.y + diffY;
    this.p3.x = this.p3.x + diffX;
    this.p3.y = this.p3.y + diffY;
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    if (!this.constructionPoint) {
      // Initialize the construction stage.
      this.constructionPoint = mouse.getPosSnappedToGrid();
      this.p1 = this.constructionPoint;
      this.p2 = null;
      this.p3 = null;
    }

    if (!this.p2 && !this.p3) {
      this.p2 = mouse.getPosSnappedToGrid();
      return;
    }

    if (this.p2 && !this.p3 && !mouse.isOnPoint(this.p1)) {
      if (shift) {
        this.p2 = mouse.getPosSnappedToDirection(this.p1, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
      } else {
        this.p2 = mouse.getPosSnappedToGrid();
      }
      this.p3 = mouse.getPosSnappedToGrid();
      return;
    }
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    if (!this.p3 && !mouse.isOnPoint(this.p1)) {
      if (shift) {
        this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
      } else {
        this.p2 = mouse.getPosSnappedToGrid();
      }

      this.p1 = ctrl ? geometry.point(2 * this.constructionPoint.x - this.p2.x, 2 * this.constructionPoint.y - this.p2.y) : this.constructionPoint;

      return;
    }
    if (this.p3) {
      this.p3 = mouse.getPosSnappedToGrid();
      return;
    }
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    if (this.p2 && !this.p3 && !mouse.isOnPoint(this.p1)) {
      this.p3 = mouse.getPosSnappedToGrid();
      return;
    }
    if (this.p3 && !mouse.isOnPoint(this.p2)) {
      this.p3 = mouse.getPosSnappedToGrid();
      delete this.constructionPoint;
      return {
        isDone: true
      };
    }
  }

  checkMouseOver(mouse) {
    let dragContext = {};
    if (mouse.isOnPoint(this.p1) && geometry.distanceSquared(mouse.pos, this.p1) <= geometry.distanceSquared(mouse.pos, this.p2) && geometry.distanceSquared(mouse.pos, this.p1) <= geometry.distanceSquared(mouse.pos, this.p3)) {
      dragContext.part = 1;
      dragContext.targetPoint = geometry.point(this.p1.x, this.p1.y);
      return dragContext;
    }
    if (mouse.isOnPoint(this.p2) && geometry.distanceSquared(mouse.pos, this.p2) <= geometry.distanceSquared(mouse.pos, this.p3)) {
      dragContext.part = 2;
      dragContext.targetPoint = geometry.point(this.p2.x, this.p2.y);
      return dragContext;
    }
    if (mouse.isOnPoint(this.p3)) {
      dragContext.part = 3;
      dragContext.targetPoint = geometry.point(this.p3.x, this.p3.y);
      return dragContext;
    }

    var center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(this.p1, this.p3)), geometry.perpendicularBisector(geometry.line(this.p2, this.p3)));
    const mousePos = mouse.getPosSnappedToGrid();
    if (isFinite(center.x) && isFinite(center.y)) {
      var r = geometry.distance(center, this.p3);
      var a1 = Math.atan2(this.p1.y - center.y, this.p1.x - center.x);
      var a2 = Math.atan2(this.p2.y - center.y, this.p2.x - center.x);
      var a3 = Math.atan2(this.p3.y - center.y, this.p3.x - center.x);
      var a_m = Math.atan2(mouse.pos.y - center.y, mouse.pos.x - center.x);
      if (Math.abs(geometry.distance(center, mouse.pos) - r) < mouse.getClickExtent() && (((a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2)) == ((a2 < a_m && a_m < a1) || (a1 < a2 && a2 < a_m) || (a_m < a1 && a1 < a2)))) {
        // Dragging the entire obj
        dragContext.part = 0;
        dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
        dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
        dragContext.snapContext = {};
        return dragContext;
      }
    } else {
      // The three points on the arc is colinear. Treat as a line segment.
      if (mouse.isOnSegment(this)) {
        dragContext.part = 0;
        dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
        dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
        dragContext.snapContext = {};
        return dragContext;
      }
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    var basePoint;
    if (dragContext.part == 1) {
      // Dragging the first endpoint
      basePoint = ctrl ? geometry.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p2;

      this.p1 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
      this.p2 = ctrl ? geometry.point(2 * basePoint.x - this.p1.x, 2 * basePoint.y - this.p1.y) : basePoint;
    }
    if (dragContext.part == 2) {
      // Dragging the second endpoint
      basePoint = ctrl ? geometry.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p1;

      this.p2 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
      this.p1 = ctrl ? geometry.point(2 * basePoint.x - this.p2.x, 2 * basePoint.y - this.p2.y) : basePoint;
    }
    if (dragContext.part == 3) {
      // Dragging the third endpoint
      this.p3 = mouse.getPosSnappedToGrid();
    }
    if (dragContext.part == 0) {
      // Dragging the entire obj
      if (shift) {
        var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }, { x: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y), y: -(dragContext.originalObj.p2.x - dragContext.originalObj.p1.x) }], dragContext.snapContext);
      } else {
        var mousePos = mouse.getPosSnappedToGrid();;
        dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
      }

      var mouseDiffX = dragContext.mousePos1.x - mousePos.x; // The X difference between the mouse position now and at the previous moment
      var mouseDiffY = dragContext.mousePos1.y - mousePos.y; // The Y difference between the mouse position now and at the previous moment
      // Move the first point
      this.p1.x = this.p1.x - mouseDiffX;
      this.p1.y = this.p1.y - mouseDiffY;
      // Move the second point
      this.p2.x = this.p2.x - mouseDiffX;
      this.p2.y = this.p2.y - mouseDiffY;

      this.p3.x = this.p3.x - mouseDiffX;
      this.p3.y = this.p3.y - mouseDiffY;

      // Update the mouse position
      dragContext.mousePos1 = mousePos;
    }
  }

  checkRayIntersects(ray) {
    if (this.checkRayIntersectFilter(ray)) {
      if (!this.p3) { return null; }
      var center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(this.p1, this.p3)), geometry.perpendicularBisector(geometry.line(this.p2, this.p3)));
      if (isFinite(center.x) && isFinite(center.y)) {
        var rp_temp = geometry.lineCircleIntersections(geometry.line(ray.p1, ray.p2), geometry.circle(center, this.p2));
        var rp_exist = [];
        var rp_lensq = [];
        for (var i = 1; i <= 2; i++) {
          rp_exist[i] = !geometry.intersectionIsOnSegment(geometry.linesIntersection(geometry.line(this.p1, this.p2), geometry.line(this.p3, rp_temp[i])), geometry.line(this.p3, rp_temp[i])) && geometry.intersectionIsOnRay(rp_temp[i], ray) && geometry.distanceSquared(rp_temp[i], ray.p1) > minShotLength_squared;
          rp_lensq[i] = geometry.distanceSquared(ray.p1, rp_temp[i]);
        }
        if (rp_exist[1] && ((!rp_exist[2]) || rp_lensq[1] < rp_lensq[2])) { return rp_temp[1]; }
        if (rp_exist[2] && ((!rp_exist[1]) || rp_lensq[2] < rp_lensq[1])) { return rp_temp[2]; }
      } else {
        // The three points on the arc is colinear. Treat as a line segment.
        var rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(this.p1, this.p2));

        if (geometry.intersectionIsOnSegment(rp_temp, this) && geometry.intersectionIsOnRay(rp_temp, ray)) {
          return rp_temp;
        } else {
          return null;
        }
      }
    }
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    var rx = ray.p1.x - incidentPoint.x;
    var ry = ray.p1.y - incidentPoint.y;
    var mx = this.p2.x - this.p1.x;
    var my = this.p2.y - this.p1.y;

    var center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(this.p1, this.p3)), geometry.perpendicularBisector(geometry.line(this.p2, this.p3)));
    if (isFinite(center.x) && isFinite(center.y)) {
      var cx = center.x - incidentPoint.x;
      var cy = center.y - incidentPoint.y;
      var c_sq = cx * cx + cy * cy;
      var r_dot_c = rx * cx + ry * cy;
      ray.p1 = incidentPoint;
      ray.p2 = geometry.point(incidentPoint.x - c_sq * rx + 2 * r_dot_c * cx, incidentPoint.y - c_sq * ry + 2 * r_dot_c * cy);
    } else {
      // The three points on the arc is colinear. Treat as a line segment.
      
      var rx = ray.p1.x - incidentPoint.x;
      var ry = ray.p1.y - incidentPoint.y;
      var mx = this.p2.x - this.p1.x;
      var my = this.p2.y - this.p1.y;

      ray.p1 = incidentPoint;
      ray.p2 = geometry.point(incidentPoint.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, incidentPoint.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
    }
  }
};
