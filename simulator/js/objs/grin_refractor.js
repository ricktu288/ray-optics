/**
 * Gradient-index glass of the shape of a polygon
 * Tools -> Glass -> Gradient-index polygon
 * @property {Array<Point>} path - The path of the glass. Each element is an object with `x` and `y` properties for coordinates.
 * @property {boolean} notDone - Whether the user is still drawing the glass.
 * @property {string} p_tex - The refractive index function in x and y in LaTeX format.
 * @property {Point} origin - The origin of the (x,y) coordinates used in the refractive index function.
 * @property {number} step_size - The step size for the ray trajectory equation.
 * @property {number} eps - The epsilon for the intersection calculations.
 */
objTypes['grin_refractor'] = class extends BaseGrinGlass {
  static type = 'grin_refractor';
  static isOptical = true;
  static supportsSurfaceMerging = true;
  static serializableDefaults = {
    path: [],
    notDone: false,
    p_tex: '1.1+0.1\\cdot\\cos\\left(0.1\\cdot y\\right)',
    origin: { x: 0, y: 0 },
    step_size: 1,
    eps: 1e-3
  };
  
  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;

    if (this.error) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.font = '12px serif';
      ctx.fillStyle = "red"
      ctx.fillText(this.error.toString(), this.path[0].x, this.path[0].y);
    }

    if (this.notDone) {
      // The user has not finish drawing the object yet
      ctx.beginPath();
      ctx.moveTo(this.path[0].x, this.path[0].y);

      for (var i = 0; i < this.path.length - 1; i++) {
        ctx.lineTo(this.path[(i + 1)].x, this.path[(i + 1)].y);
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
        ctx.lineTo(this.path[(i + 1) % this.path.length].x, this.path[(i + 1) % this.path.length].y);
      }
      this.fillGlass(canvasRenderer, isAboveLight, isHovered);
    }
    ctx.lineWidth = 1;


    if (isHovered) {
      for (var i = 0; i < this.path.length; i++) {
        ctx.fillStyle = 'rgb(255,0,0)';
        ctx.fillRect(this.path[i].x - 1.5, this.path[i].y - 1.5, 3, 3);
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
      this.path = [{ x: mousePos.x, y: mousePos.y }];
    }

    if (this.path.length > 3 && mouse.isOnPoint(this.path[0])) {
      // Clicked the first point
      this.path.length--;
      this.notDone = false;
      return {
        isDone: true
      };
    }
    this.path.push({ x: mousePos.x, y: mousePos.y }); // Create a new point
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    this.path[this.path.length - 1] = { x: mousePos.x, y: mousePos.y }; // Move the last point
  }

  checkMouseOver(mouse) {
    let dragContext = {};

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
    if (this.notDone) return;

    if (!this.fn_p) {
      this.initFns();
    }
    if (this.isInsideGlass(ray.p1) || this.isOnBoundary(ray.p1)) // if the first point of the ray is inside the circle, or on its boundary
    {
      let len = geometry.distance(ray.p1, ray.p2);
      let x = ray.p1.x + (this.step_size / len) * (ray.p2.x - ray.p1.x);
      let y = ray.p1.y + (this.step_size / len) * (ray.p2.y - ray.p1.y);
      const intersection_point = geometry.point(x, y);
      if (this.isInsideGlass(intersection_point)) // if intersection_point is inside the circle
        return intersection_point;
    }

    var s_lensq = Infinity;
    var s_lensq_temp;
    var s_point = null;
    var s_point_temp = null;
    var rp_temp;

    for (var i = 0; i < this.path.length; i++) {
      s_point_temp = null;
      
      //Line segment i->i+1
      var rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(this.path[i % this.path.length], this.path[(i + 1) % this.path.length]));

      if (geometry.intersectionIsOnSegment(rp_temp, geometry.line(this.path[i % this.path.length], this.path[(i + 1) % this.path.length])) && geometry.intersectionIsOnRay(rp_temp, ray) && geometry.distanceSquared(ray.p1, rp_temp) > minShotLength_squared) {
        s_lensq_temp = geometry.distanceSquared(ray.p1, rp_temp);
        s_point_temp = rp_temp;
      
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
    try {
      if ((this.isInsideGlass(ray.p1) || this.isOutsideGlass(ray.p1)) && this.isOnBoundary(incidentPoint)) // if the ray is hitting the circle from the outside, or from the inside (meaning that the point incidentPoint is on the boundary of the circle, and the point ray.p1 is inside/outside the circle)
      {
        let r_bodyMerging_obj = ray.bodyMergingObj; // save the current bodyMergingObj of the ray, to pass it later to the reflected ray in the 'refract' function

        var incidentData = this.getIncidentData(ray);
        var incidentType = incidentData.incidentType;
        if (incidentType == 1) {
          // From inside to outside
          var n1 = this.getRefIndexAt(incidentPoint, ray);
          this.onRayExit(ray);
        } else if (incidentType == -1) {
          // From outside to inside
          var n1 = 1 / this.getRefIndexAt(incidentPoint, ray);
          this.onRayEnter(ray);
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
        return this.refract(ray, rayIndex, incidentData.s_point, incidentData.normal, n1, surfaceMergingObjs, r_bodyMerging_obj);
      } else {
        if (ray.bodyMergingObj === undefined)
          ray.bodyMergingObj = this.initRefIndex(ray); // Initialize the bodyMerging object of the ray
        const next_point = this.step(ray.p1, incidentPoint, ray);
        ray.p1 = incidentPoint;
        ray.p2 = next_point;
      }
    } catch (e) {
      //throw e
      console.log("Error in onRayIncident of GRIN glass: " + e.toString());
      return {
        isAbsorbed: true
      };
    }
  }

  getIncidentType(ray) {
    return this.getIncidentData(ray).incidentType;
  }

  isOutsideGlass(point) {
    return (!this.isOnBoundary(point) && this.countIntersections(point) % 2 == 0)
  }

  isInsideGlass(point) {
    return (!this.isOnBoundary(point) && this.countIntersections(point) % 2 == 1)
  }
  
  isOnBoundary(p3) {
    for (let i = 0; i < this.path.length; i++) {
      let p1 = this.path[i];
      let p2 = this.path[(i + 1) % this.path.length];
      let p1_p2 = geometry.point(p2.x - p1.x, p2.y - p1.y);
      let p1_p3 = geometry.point(p3.x - p1.x, p3.y - p1.y);
      if (geometry.cross(p1_p2, p1_p3) - this.eps < 0 && geometry.cross(p1_p2, p1_p3) + this.eps > 0) // if p1_p2 and p1_p3 are collinear
      {
        let dot_p2_p3 = geometry.dot(p1_p2, p1_p3);
        let p1_p2_squared = geometry.distanceSquared(p1, p2);
        if (p1_p2_squared - dot_p2_p3 + this.eps >= 0 && dot_p2_p3 + this.eps >= 0) // if the projection of the segment p1_p3 onto the segment p1_p2, is contained in the segment p1_p2
          return true;
      }
    }
    return false;
  }

  /* Utility methods */

  getIncidentData(ray) {
    var s_lensq = Infinity;
    var s_lensq_temp;
    var s_point = null;
    var s_point_temp = null;
    var s_point_index;

    var surfaceMultiplicity = 1; // How many time the surfaces coincide

    var rp_temp;

    var rp2_temp;

    var normal_x;
    var normal_x_temp;

    var normal_y;
    var normal_y_temp;

    var rdots;
    var ssq;

    var nearEdge = false;
    var nearEdge_temp = false;

    var ray2 = geometry.line(ray.p1, geometry.point(ray.p2.x + Math.random() * 1e-5, ray.p2.y + Math.random() * 1e-5)); // The ray to test the inside/outside (the test ray)
    var ray_intersect_count = 0; // The intersection count (odd means from outside)

    for (var i = 0; i < this.path.length; i++) {
      s_point_temp = null;
      nearEdge_temp = false;
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

  // Implementation of the "crossing number algorithm" (see - https://en.wikipedia.org/wiki/Point_in_polygon)
  countIntersections(p3) {
    var cnt = 0;
    for (let i = 0; i < this.path.length; i++) {
      let p1 = this.path[i];
      let p2 = this.path[(i + 1) % this.path.length];
      let y_max = Math.max(p1.y, p2.y);
      let y_min = Math.min(p1.y, p2.y);
      if ((y_max - p3.y - this.eps > 0 && y_max - p3.y + this.eps > 0) && (y_min - p3.y - this.eps < 0 && y_min - p3.y + this.eps < 0)) {
        if (p1.x == p2.x && (p1.x - p3.x + this.eps > 0 && p1.x - p3.x - this.eps > 0)) // in case the current segment is vertical
          cnt++;
        else if ((p1.x + ((p3.y - p1.y) / (p2.y - p1.y)) * (p2.x - p1.x)) - p3.x - this.eps > 0 && (p1.x + ((p3.y - p1.y) / (p2.y - p1.y)) * (p2.x - p1.x)) - p3.x + this.eps > 0)
          cnt++;
      }
    }
    return cnt; // Returns the number of intersections between a horizontal ray (that originates from the point - p3) and the Free-shape glass object - this.
  }
};
