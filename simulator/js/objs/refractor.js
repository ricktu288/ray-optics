/**
 * Glass of the shape consists of line segments or circular arcs.
 * Tools -> Glass -> Polygon / Circular Arcs
 * @property {Array<object>} path - The path of the glass. Each element is an object with `x` and `y` properties for coordinates, and a boolean `arc`. If `path[i].arc === false`, it means that `path[i-1]`--`path[i]` and `path[i]`--`path[i+1]` are line segments, if `path[i].arc === true`, it means that `path[i-1]`--`path[i]`--`path[i+1]` is a circular arc.
 * @property {boolean} notDone - Whether the user is still drawing the glass.
 * @property {number} p - The refractive index of the glass, or the Cauchy coefficient A of the glass if color mode is on.
 * @property {number} cauchyCoeff - The Cauchy coefficient B of the glass if color mode is on, in micrometer squared.
 */
objTypes['refractor'] = class extends BaseGlass {
  static type = 'refractor';
  static isOptical = true;
  static supportsSurfaceMerging = true;
  static serializableDefaults = {
    path: [],
    notDone: false,
    p: 1.5,
    cauchyCoeff: 0.004
  };

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    var p1;
    var p2;
    var p3;
    var center;
    var r;
    var a1;
    var a2;
    var a3;
    var acw;

    if (this.notDone) {
      // The user has not finish drawing the object yet

      ctx.beginPath();
      ctx.moveTo(this.path[0].x, this.path[0].y);

      for (var i = 0; i < this.path.length - 1; i++) {
        if (this.path[(i + 1)].arc && !this.path[i].arc && i < this.path.length - 2) {
          p1 = geometry.point(this.path[i].x, this.path[i].y);
          p2 = geometry.point(this.path[(i + 2)].x, this.path[(i + 2)].y);
          p3 = geometry.point(this.path[(i + 1)].x, this.path[(i + 1)].y);
          center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(p1, p3)), geometry.perpendicularBisector(geometry.line(p2, p3)));
          if (isFinite(center.x) && isFinite(center.y)) {
            r = geometry.distance(center, p3);
            a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
            a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
            a3 = Math.atan2(p3.y - center.y, p3.x - center.x);
            acw = (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2); // The rotation direction of p1->p3->p2. True indicates counterclockwise

            ctx.arc(center.x, center.y, r, a1, a2, acw);
          } else {
            // The three points on the arc is colinear. Treat as a line segment.
            ctx.lineTo(this.path[(i + 2)].x, this.path[(i + 2)].y);
          }
        } else {
          ctx.lineTo(this.path[(i + 1)].x, this.path[(i + 1)].y);
        }
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgb(128,128,128)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // The user has completed drawing the object
      ctx.beginPath();
      ctx.moveTo(this.path[0].x, this.path[0].y);

      for (var i = 0; i < this.path.length; i++) {
        if (this.path[(i + 1) % this.path.length].arc && !this.path[i % this.path.length].arc) {
          p1 = geometry.point(this.path[i % this.path.length].x, this.path[i % this.path.length].y);
          p2 = geometry.point(this.path[(i + 2) % this.path.length].x, this.path[(i + 2) % this.path.length].y);
          p3 = geometry.point(this.path[(i + 1) % this.path.length].x, this.path[(i + 1) % this.path.length].y);
          center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(p1, p3)), geometry.perpendicularBisector(geometry.line(p2, p3)));
          if (isFinite(center.x) && isFinite(center.y)) {
            r = geometry.distance(center, p3);
            a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
            a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
            a3 = Math.atan2(p3.y - center.y, p3.x - center.x);
            acw = (a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2); // The rotation direction of p1->p3->p2. True indicates counterclockwise

            ctx.arc(center.x, center.y, r, a1, a2, acw);
          } else {
            // The three points on the arc is colinear. Treat as a line segment.
            ctx.lineTo(this.path[(i + 2) % this.path.length].x, this.path[(i + 2) % this.path.length].y);
          }
        } else if (!this.path[(i + 1) % this.path.length].arc && !this.path[i % this.path.length].arc) {
          ctx.lineTo(this.path[(i + 1) % this.path.length].x, this.path[(i + 1) % this.path.length].y);
        }
      }
      this.fillGlass(canvasRenderer, isAboveLight, isHovered);
    }
    ctx.lineWidth = 1;

    if (isHovered) {
      for (var i = 0; i < this.path.length; i++) {
        if (typeof this.path[i].arc != 'undefined') {
          if (this.path[i].arc) {
            ctx.fillStyle = 'rgb(255,0,255)';
            ctx.fillRect(this.path[i].x - 1.5, this.path[i].y - 1.5, 3, 3);
          } else {
            ctx.fillStyle = 'rgb(255,0,0)';
            ctx.fillRect(this.path[i].x - 1.5, this.path[i].y - 1.5, 3, 3);
          }
        }
      }
    }
  }

  move(diffX, diffY) {
    for (var i = 0; i < this.path.length; i++) {
      this.path[i].x += diffX;
      this.path[i].y += diffY;
    }
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();
    if (!this.notDone) {
      // Initialize the construction stage
      this.notDone = true;
      this.path = [{ x: mousePos.x, y: mousePos.y, arc: false }];
    }

    if (this.path.length > 1) {
      if (this.path.length > 3 && mouse.isOnPoint(this.path[0])) {
        // Clicked the first point
        this.path.length--;
        this.notDone = false;
        return;
      }
      this.path[this.path.length - 1] = { x: mousePos.x, y: mousePos.y }; // Move the last point
      this.path[this.path.length - 1].arc = true;
    }
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    if (!this.notDone) { return; }
    const mousePos = mouse.getPosSnappedToGrid();
    if (typeof this.path[this.path.length - 1].arc != 'undefined') {
      if (this.path[this.path.length - 1].arc && Math.sqrt(Math.pow(this.path[this.path.length - 1].x - mousePos.x, 2) + Math.pow(this.path[this.path.length - 1].y - mousePos.y, 2)) >= 5) {
        this.path[this.path.length] = mousePos;
      }
    } else {
      this.path[this.path.length - 1] = { x: mousePos.x, y: mousePos.y }; // Move the last point
    }
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    if (!this.notDone) {
      return {
        isDone: true
      };
    }
    if (this.path.length > 3 && mouse.isOnPoint(this.path[0])) {
      // Mouse released at the first point
      this.path.length--;
      this.notDone = false;
      return {
        isDone: true
      };
    }
    if (this.path[this.path.length - 2] && !this.path[this.path.length - 2].arc && mouse.isOnPoint(this.path[this.path.length - 2])) {
      delete this.path[this.path.length - 1].arc;
    } else {
      const mousePos = mouse.getPosSnappedToGrid();
      this.path[this.path.length - 1] = { x: mousePos.x, y: mousePos.y }; // Move the last point
      this.path[this.path.length - 1].arc = false;
      this.path[this.path.length] = { x: mousePos.x, y: mousePos.y }; // Create a new point
    }
  }

  checkMouseOver(mouse) {
    let dragContext = {};

    var p1;
    var p2;
    var p3;
    var center;
    var r;
    var a1;
    var a2;
    var a3;


    var click_lensq = Infinity;
    var click_lensq_temp;
    var targetPoint_index = -1;
    for (var i = 0; i < this.path.length; i++) {
      if (mouse.isOnPoint(this.path[i])) {
        click_lensq_temp = geometry.distanceSquared(mouse.pos, this.path[i]);
        if (click_lensq_temp <= click_lensq) {
          click_lensq = click_lensq_temp;
          targetPoint_index = i;
        }
      }
    }
    if (targetPoint_index != -1) {
      dragContext.part = 1;
      dragContext.index = targetPoint_index;
      dragContext.targetPoint = geometry.point(this.path[targetPoint_index].x, this.path[targetPoint_index].y);
      return dragContext;
    }

    for (var i = 0; i < this.path.length; i++) {
      if (this.path[(i + 1) % this.path.length].arc && !this.path[i % this.path.length].arc) {
        p1 = geometry.point(this.path[i % this.path.length].x, this.path[i % this.path.length].y);
        p2 = geometry.point(this.path[(i + 2) % this.path.length].x, this.path[(i + 2) % this.path.length].y);
        p3 = geometry.point(this.path[(i + 1) % this.path.length].x, this.path[(i + 1) % this.path.length].y);
        center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(p1, p3)), geometry.perpendicularBisector(geometry.line(p2, p3)));
        if (isFinite(center.x) && isFinite(center.y)) {
          r = geometry.distance(center, p3);
          a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
          a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
          a3 = Math.atan2(p3.y - center.y, p3.x - center.x);
          var a_m = Math.atan2(mouse.pos.y - center.y, mouse.pos.x - center.x);
          if (Math.abs(geometry.distance(center, mouse.pos) - r) < mouse.getClickExtent() && (((a2 < a3 && a3 < a1) || (a1 < a2 && a2 < a3) || (a3 < a1 && a1 < a2)) == ((a2 < a_m && a_m < a1) || (a1 < a2 && a2 < a_m) || (a_m < a1 && a1 < a2)))) {
            // Dragging the entire this
            const mousePos = mouse.getPosSnappedToGrid();
            dragContext.part = 0;
            dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
            dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
            dragContext.snapContext = {};
            return dragContext;
          }
        } else {
          // The three points on the arc is colinear. Treat as a line segment.
          if (mouse.isOnSegment(geometry.line(this.path[(i) % this.path.length], this.path[(i + 2) % this.path.length]))) {
            // Dragging the entire this
            const mousePos = mouse.getPosSnappedToGrid();
            dragContext.part = 0;
            dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
            dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
            dragContext.snapContext = {};
            return dragContext;
          }
        }
      } else if (!this.path[(i + 1) % this.path.length].arc && !this.path[i % this.path.length].arc) {
        if (mouse.isOnSegment(geometry.line(this.path[(i) % this.path.length], this.path[(i + 1) % this.path.length]))) {
          // Dragging the entire this
          const mousePos = mouse.getPosSnappedToGrid();
          dragContext.part = 0;
          dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
          dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
          dragContext.snapContext = {};
          return dragContext;
        }
      }
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();

    if (dragContext.part == 1) {
      this.path[dragContext.index].x = mousePos.x;
      this.path[dragContext.index].y = mousePos.y;
    }

    if (dragContext.part == 0) {
      if (shift) {
        var mousePosSnapped = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
      } else {
        var mousePosSnapped = mouse.getPosSnappedToGrid();
        dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
      }
      this.move(mousePosSnapped.x - dragContext.mousePos1.x, mousePosSnapped.y - dragContext.mousePos1.y);
      dragContext.mousePos1 = mousePosSnapped;
    }
  }

  checkRayIntersects(ray) {
    if (this.notDone || this.p <= 0) return;

    var s_lensq = Infinity;
    var s_lensq_temp;
    var s_point = null;
    var s_point_temp = null;
    var rp_exist = [];
    var rp_lensq = [];
    var rp_temp;

    var p1;
    var p2;
    var p3;
    var center;
    var r;

    for (var i = 0; i < this.path.length; i++) {
      s_point_temp = null;
      if (this.path[(i + 1) % this.path.length].arc && !this.path[i % this.path.length].arc) {
        // The arc i->i+1->i+2
        p1 = geometry.point(this.path[i % this.path.length].x, this.path[i % this.path.length].y);
        p2 = geometry.point(this.path[(i + 2) % this.path.length].x, this.path[(i + 2) % this.path.length].y);
        p3 = geometry.point(this.path[(i + 1) % this.path.length].x, this.path[(i + 1) % this.path.length].y);
        center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(p1, p3)), geometry.perpendicularBisector(geometry.line(p2, p3)));
        if (isFinite(center.x) && isFinite(center.y)) {
          r = geometry.distance(center, p3);
          rp_temp = geometry.lineCircleIntersections(geometry.line(ray.p1, ray.p2), geometry.circle(center, p2));
          for (var ii = 1; ii <= 2; ii++) {
            rp_exist[ii] = !geometry.intersectionIsOnSegment(geometry.linesIntersection(geometry.line(p1, p2), geometry.line(p3, rp_temp[ii])), geometry.line(p3, rp_temp[ii])) && geometry.intersectionIsOnRay(rp_temp[ii], ray) && geometry.distanceSquared(rp_temp[ii], ray.p1) > minShotLength_squared;
            rp_lensq[ii] = geometry.distanceSquared(ray.p1, rp_temp[ii]);
          }
          if (rp_exist[1] && ((!rp_exist[2]) || rp_lensq[1] < rp_lensq[2]) && rp_lensq[1] > minShotLength_squared) {
            s_point_temp = rp_temp[1];
            s_lensq_temp = rp_lensq[1];
          }
          if (rp_exist[2] && ((!rp_exist[1]) || rp_lensq[2] < rp_lensq[1]) && rp_lensq[2] > minShotLength_squared) {
            s_point_temp = rp_temp[2];
            s_lensq_temp = rp_lensq[2];
          }
        } else {
          // The three points on the arc is colinear. Treat as a line segment.
          var rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(this.path[i % this.path.length], this.path[(i + 2) % this.path.length]));

          if (geometry.intersectionIsOnSegment(rp_temp, geometry.line(this.path[i % this.path.length], this.path[(i + 2) % this.path.length])) && geometry.intersectionIsOnRay(rp_temp, ray) && geometry.distanceSquared(ray.p1, rp_temp) > minShotLength_squared) {
            s_lensq_temp = geometry.distanceSquared(ray.p1, rp_temp);
            s_point_temp = rp_temp;
          }
        }
      } else if (!this.path[(i + 1) % this.path.length].arc && !this.path[i % this.path.length].arc) {
        //Line segment i->i+1
        var rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(this.path[i % this.path.length], this.path[(i + 1) % this.path.length]));

        if (geometry.intersectionIsOnSegment(rp_temp, geometry.line(this.path[i % this.path.length], this.path[(i + 1) % this.path.length])) && geometry.intersectionIsOnRay(rp_temp, ray) && geometry.distanceSquared(ray.p1, rp_temp) > minShotLength_squared) {
          s_lensq_temp = geometry.distanceSquared(ray.p1, rp_temp);
          s_point_temp = rp_temp;
        }
      }
      if (s_point_temp) {
        if (s_lensq_temp < s_lensq) {
          s_lensq = s_lensq_temp;
          s_point = s_point_temp;
        }
      }
    }
    if (s_point) {
      return s_point;
    }
  }

  onRayIncident(ray, rayIndex, incidentPoint, surfaceMergingObjs) {
    if (this.notDone) { return; }

    var incidentData = this.getIncidentData(ray);
    var incidentType = incidentData.incidentType;
    if (incidentType == 1) {
      // From inside to outside
      var n1 = this.getRefIndexAt(incidentPoint, ray);
    } else if (incidentType == -1) {
      // From outside to inside
      var n1 = 1 / this.getRefIndexAt(incidentPoint, ray);
    } else if (incidentType == 0) {
      // Equivalent to not intersecting with the object (e.g. two interfaces overlap)
      var n1 = 1;
    } else {
      // The situation that may cause bugs (e.g. incident on an edge point)
      // To prevent shooting the ray to a wrong direction, absorb the ray
      return {
        isAbsorbed: true
      };
    }

    return this.refract(ray, rayIndex, incidentPoint, incidentData.normal, n1, surfaceMergingObjs, ray.bodyMergingthis);
  }

  getIncidentType(ray) {
    return this.getIncidentData(ray).incidentType;
  }

  
  /* Utility function */

  getIncidentData(ray) {
    var s_lensq = Infinity;
    var s_lensq_temp;
    var s_point = null;
    var s_point_temp = null;
    var s_point_index;

    var surfaceMultiplicity = 1; // How many time the surfaces coincide

    var rp_on_ray = [];
    var rp_exist = [];
    var rp_lensq = [];
    var rp_temp;

    var rp2_exist = [];
    var rp2_lensq = [];
    var rp2_temp;

    var normal_x;
    var normal_x_temp;

    var normal_y;
    var normal_y_temp;

    var rdots;
    var ssq;

    var nearEdge = false;
    var nearEdge_temp = false;

    var p1;
    var p2;
    var p3;
    var center;
    var ray2 = geometry.line(ray.p1, geometry.point(ray.p2.x + Math.random() * 1e-5, ray.p2.y + Math.random() * 1e-5)); // The ray to test the inside/outside (the test ray)
    var ray_intersect_count = 0; // The intersection count (odd means from outside)

    for (var i = 0; i < this.path.length; i++) {
      s_point_temp = null;
      nearEdge_temp = false;
      if (this.path[(i + 1) % this.path.length].arc && !this.path[i % this.path.length].arc) {
        // The arc i->i+1->i+2
        p1 = geometry.point(this.path[i % this.path.length].x, this.path[i % this.path.length].y);
        p2 = geometry.point(this.path[(i + 2) % this.path.length].x, this.path[(i + 2) % this.path.length].y);
        p3 = geometry.point(this.path[(i + 1) % this.path.length].x, this.path[(i + 1) % this.path.length].y);
        center = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(p1, p3)), geometry.perpendicularBisector(geometry.line(p2, p3)));
        if (isFinite(center.x) && isFinite(center.y)) {
          rp_temp = geometry.lineCircleIntersections(geometry.line(ray.p1, ray.p2), geometry.circle(center, p2));
          rp2_temp = geometry.lineCircleIntersections(geometry.line(ray2.p1, ray2.p2), geometry.circle(center, p2));
          for (var ii = 1; ii <= 2; ii++) {
            rp_on_ray[ii] = geometry.intersectionIsOnRay(rp_temp[ii], ray);
            rp_exist[ii] = rp_on_ray[ii] && !geometry.intersectionIsOnSegment(geometry.linesIntersection(geometry.line(p1, p2), geometry.line(p3, rp_temp[ii])), geometry.line(p3, rp_temp[ii])) && geometry.distanceSquared(rp_temp[ii], ray.p1) > minShotLength_squared;
            rp_lensq[ii] = geometry.distanceSquared(ray.p1, rp_temp[ii]);

            rp2_exist[ii] = !geometry.intersectionIsOnSegment(geometry.linesIntersection(geometry.line(p1, p2), geometry.line(p3, rp2_temp[ii])), geometry.line(p3, rp2_temp[ii])) && geometry.intersectionIsOnRay(rp2_temp[ii], ray2) && geometry.distanceSquared(rp2_temp[ii], ray2.p1) > minShotLength_squared;
            rp2_lensq[ii] = geometry.distanceSquared(ray2.p1, rp2_temp[ii]);
          }

          if (rp_exist[1] && ((!rp_exist[2]) || rp_lensq[1] < rp_lensq[2]) && rp_lensq[1] > minShotLength_squared) {
            s_point_temp = rp_temp[1];
            s_lensq_temp = rp_lensq[1];
            if (rp_on_ray[2] && rp_lensq[1] < rp_lensq[2]) {
              //The ray is from outside to inside (with respect to the arc itself)
              normal_x_temp = s_point_temp.x - center.x;
              normal_y_temp = s_point_temp.y - center.y;
            } else {
              normal_x_temp = center.x - s_point_temp.x;
              normal_y_temp = center.y - s_point_temp.y;
            }
          }
          if (rp_exist[2] && ((!rp_exist[1]) || rp_lensq[2] < rp_lensq[1]) && rp_lensq[2] > minShotLength_squared) {
            s_point_temp = rp_temp[2];
            s_lensq_temp = rp_lensq[2];
            if (rp_on_ray[1] && rp_lensq[2] < rp_lensq[1]) {
              //The ray is from outside to inside (with respect to the arc itself)
              normal_x_temp = s_point_temp.x - center.x;
              normal_y_temp = s_point_temp.y - center.y;
            } else {
              normal_x_temp = center.x - s_point_temp.x;
              normal_y_temp = center.y - s_point_temp.y;
            }
          }
          if (rp2_exist[1] && rp2_lensq[1] > minShotLength_squared) {
            ray_intersect_count++;
          }
          if (rp2_exist[2] && rp2_lensq[2] > minShotLength_squared) {
            ray_intersect_count++;
          }

          // Test if too close to an edge
          if (s_point_temp && (geometry.distanceSquared(s_point_temp, p1) < minShotLength_squared || geometry.distanceSquared(s_point_temp, p2) < minShotLength_squared)) {
            nearEdge_temp = true;
          }

        } else {
          // The three points on the arc is colinear. Treat as a line segment.
          rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(this.path[i % this.path.length], this.path[(i + 2) % this.path.length]));

          rp2_temp = geometry.linesIntersection(geometry.line(ray2.p1, ray2.p2), geometry.line(this.path[i % this.path.length], this.path[(i + 2) % this.path.length]));
          if (geometry.intersectionIsOnSegment(rp_temp, geometry.line(this.path[i % this.path.length], this.path[(i + 2) % this.path.length])) && geometry.intersectionIsOnRay(rp_temp, ray) && geometry.distanceSquared(ray.p1, rp_temp) > minShotLength_squared) {
            s_lensq_temp = geometry.distanceSquared(ray.p1, rp_temp);
            s_point_temp = rp_temp;

            rdots = (ray.p2.x - ray.p1.x) * (this.path[(i + 2) % this.path.length].x - this.path[i % this.path.length].x) + (ray.p2.y - ray.p1.y) * (this.path[(i + 2) % this.path.length].y - this.path[i % this.path.length].y);
            ssq = (this.path[(i + 2) % this.path.length].x - this.path[i % this.path.length].x) * (this.path[(i + 2) % this.path.length].x - this.path[i % this.path.length].x) + (this.path[(i + 2) % this.path.length].y - this.path[i % this.path.length].y) * (this.path[(i + 2) % this.path.length].y - this.path[i % this.path.length].y);

            normal_x_temp = rdots * (this.path[(i + 2) % this.path.length].x - this.path[i % this.path.length].x) - ssq * (ray.p2.x - ray.p1.x);
            normal_y_temp = rdots * (this.path[(i + 2) % this.path.length].y - this.path[i % this.path.length].y) - ssq * (ray.p2.y - ray.p1.y);


          }

          if (geometry.intersectionIsOnSegment(rp2_temp, geometry.line(this.path[i % this.path.length], this.path[(i + 2) % this.path.length])) && geometry.intersectionIsOnRay(rp2_temp, ray2) && geometry.distanceSquared(ray2.p1, rp2_temp) > minShotLength_squared) {
            ray_intersect_count++;
          }

          // Test if too close to an edge
          if (s_point_temp && (geometry.distanceSquared(s_point_temp, this.path[i % this.path.length]) < minShotLength_squared || geometry.distanceSquared(s_point_temp, this.path[(i + 2) % this.path.length]) < minShotLength_squared)) {
            nearEdge_temp = true;
          }
        }
      } else if (!this.path[(i + 1) % this.path.length].arc && !this.path[i % this.path.length].arc) {
        //Line segment i->i+1
        rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(this.path[i % this.path.length], this.path[(i + 1) % this.path.length]));

        rp2_temp = geometry.linesIntersection(geometry.line(ray2.p1, ray2.p2), geometry.line(this.path[i % this.path.length], this.path[(i + 1) % this.path.length]));
        if (geometry.intersectionIsOnSegment(rp_temp, geometry.line(this.path[i % this.path.length], this.path[(i + 1) % this.path.length])) && geometry.intersectionIsOnRay(rp_temp, ray) && geometry.distanceSquared(ray.p1, rp_temp) > minShotLength_squared) {
          s_lensq_temp = geometry.distanceSquared(ray.p1, rp_temp);
          s_point_temp = rp_temp;

          rdots = (ray.p2.x - ray.p1.x) * (this.path[(i + 1) % this.path.length].x - this.path[i % this.path.length].x) + (ray.p2.y - ray.p1.y) * (this.path[(i + 1) % this.path.length].y - this.path[i % this.path.length].y);
          ssq = (this.path[(i + 1) % this.path.length].x - this.path[i % this.path.length].x) * (this.path[(i + 1) % this.path.length].x - this.path[i % this.path.length].x) + (this.path[(i + 1) % this.path.length].y - this.path[i % this.path.length].y) * (this.path[(i + 1) % this.path.length].y - this.path[i % this.path.length].y);

          normal_x_temp = rdots * (this.path[(i + 1) % this.path.length].x - this.path[i % this.path.length].x) - ssq * (ray.p2.x - ray.p1.x);
          normal_y_temp = rdots * (this.path[(i + 1) % this.path.length].y - this.path[i % this.path.length].y) - ssq * (ray.p2.y - ray.p1.y);


        }

        if (geometry.intersectionIsOnSegment(rp2_temp, geometry.line(this.path[i % this.path.length], this.path[(i + 1) % this.path.length])) && geometry.intersectionIsOnRay(rp2_temp, ray2) && geometry.distanceSquared(ray2.p1, rp2_temp) > minShotLength_squared) {
          ray_intersect_count++;
        }

        // Test if too close to an edge
        if (s_point_temp && (geometry.distanceSquared(s_point_temp, this.path[i % this.path.length]) < minShotLength_squared || geometry.distanceSquared(s_point_temp, this.path[(i + 1) % this.path.length]) < minShotLength_squared)) {
          nearEdge_temp = true;
        }
      }
      if (s_point_temp) {
        if (s_point && geometry.distanceSquared(s_point_temp, s_point) < minShotLength_squared) {
          // Self surface merging
          surfaceMultiplicity++;
        } else if (s_lensq_temp < s_lensq) {
          s_lensq = s_lensq_temp;
          s_point = s_point_temp;
          s_point_index = i;
          normal_x = normal_x_temp;
          normal_y = normal_y_temp;
          nearEdge = nearEdge_temp;
          surfaceMultiplicity = 1;
        }
      }
    }


    if (nearEdge) {
      var incidentType = NaN; // Incident on an edge point
    } else if (surfaceMultiplicity % 2 == 0) {
      var incidentType = 0; // Equivalent to not intersecting with the object
    } else if (ray_intersect_count % 2 == 1) {
      var incidentType = 1; // From inside to outside
    } else {
      var incidentType = -1; // From outside to inside
    }

    return { s_point: s_point, normal: { x: normal_x, y: normal_y }, incidentType: incidentType };
  }
};
