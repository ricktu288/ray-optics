/*
 * Copyright 2024 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import BaseFilter from '../BaseFilter.js';
import i18next from 'i18next';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';

/**
 * Parabolic mirror.
 * 
 * Tools -> Mirror -> Parabolic
 * 
 * The current implementation is based on `CustomMirror.js`, but this should be changed to an analytical solution in the future.
 * @class
 * @extends BaseFilter
 * @memberof sceneObjs
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {Point} p3 - The vertex.
 * @property {boolean} filter - Whether it is a dichroic mirror.
 * @property {boolean} invert - If true, the ray with wavelength outside the bandwidth is reflected. If false, the ray with wavelength inside the bandwidth is reflected.
 * @property {number} wavelength - The target wavelength if dichroic is enabled. The unit is nm.
 * @property {number} bandwidth - The bandwidth if dichroic is enabled. The unit is nm.
 * @property {Array<Point>} tmp_points - The points on the parabola.
 * @property {number} tmp_i - The index of the point on the parabola where the ray is incident.
 */
class ParabolicMirror extends BaseFilter {
  static type = 'ParabolicMirror';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    p3: null,
    filter: false,
    invert: false,
    wavelength: Simulator.GREEN_WAVELENGTH,
    bandwidth: 10
  };

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:meta.parentheses', { main: i18next.t('main:tools.categories.mirror'), sub: i18next.t('main:tools.ParabolicMirror.title') }));
    super.populateObjBar(objBar);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    ctx.fillStyle = 'rgb(255,0,255)';
    if (this.p3 && this.p2) {
      var p12d = geometry.distance(this.p1, this.p2);
      // unit vector from p1 to p2
      var dir1 = [(this.p2.x - this.p1.x) / p12d, (this.p2.y - this.p1.y) / p12d];
      // perpendicular direction
      var dir2 = [dir1[1], -dir1[0]];
      // get height of (this section of) parabola
      var height = (this.p3.x - this.p1.x) * dir2[0] + (this.p3.y - this.p1.y) * dir2[1];
      // reposition p3 to be at vertex
      this.p3 = geometry.point((this.p1.x + this.p2.x) * .5 + dir2[0] * height, (this.p1.y + this.p2.y) * .5 + dir2[1] * height);

      var x0 = p12d / 2;
      var a = height / (x0 * x0); // y=ax^2
      var i;
      ctx.strokeStyle = isHovered ? 'cyan' : ((this.scene.simulateColors && this.wavelength && this.filter) ? canvasRenderer.rgbaToCssColor(Simulator.wavelengthToColor(this.wavelength || Simulator.GREEN_WAVELENGTH, 1)) : 'rgb(168,168,168)');
      ctx.lineWidth = 1 * ls;
      ctx.beginPath();
      this.tmp_points = [geometry.point(this.p1.x, this.p1.y)];
      ctx.moveTo(this.p1.x, this.p1.y);
      for (i = 0.1 * this.scene.lengthScale; i < p12d; i += 0.1 * this.scene.lengthScale) {
        // avoid using exact integers to avoid problems with detecting intersections
        var ix = i + .001 * this.scene.lengthScale;
        var x = ix - x0;
        var y = height - a * x * x;
        var pt = geometry.point(this.p1.x + dir1[0] * ix + dir2[0] * y, this.p1.y + dir1[1] * ix + dir2[1] * y);
        ctx.lineTo(pt.x, pt.y);
        this.tmp_points.push(pt);
      }
      ctx.stroke();
      if (isHovered) {
        ctx.fillRect(this.p3.x - 1.5 * ls, this.p3.y - 1.5 * ls, 3 * ls, 3 * ls);
        var focusx = (this.p1.x + this.p2.x) * .5 + dir2[0] * (height - 1 / (4 * a));
        var focusy = (this.p1.y + this.p2.y) * .5 + dir2[1] * (height - 1 / (4 * a));
        ctx.fillRect(focusx - 1.5 * ls, focusy - 1.5 * ls, 3 * ls, 3 * ls);
        ctx.fillStyle = 'rgb(255,0,0)';
        ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
        ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
      }
    } else if (this.p2) {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
    } else {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
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

    if (this.p2 && !this.p3 && !mouse.snapsOnPoint(this.p1)) {
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
    if (this.p2 && mouse.isOnPoint(this.p2) && geometry.distanceSquared(mouse.pos, this.p2) <= geometry.distanceSquared(mouse.pos, this.p3)) {
      dragContext.part = 2;
      dragContext.targetPoint = geometry.point(this.p2.x, this.p2.y);
      return dragContext;
    }
    if (this.p3 && mouse.isOnPoint(this.p3)) {
      dragContext.part = 3;
      dragContext.targetPoint = geometry.point(this.p3.x, this.p3.y);
      return dragContext;
    }

    if (!this.tmp_points) return;
    var i;
    var pts = this.tmp_points;
    for (i = 0; i < pts.length - 1; i++) {
      var seg = geometry.line(pts[i], pts[i + 1]);
      if (mouse.isOnSegment(seg)) {
        const mousePos = mouse.getPosSnappedToGrid();
        dragContext.part = 0;
        dragContext.mousePos0 = mousePos;
        dragContext.mousePos1 = mousePos;
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

  /**
   * Transform a point from global coordinates to local parabola coordinates
   * where the origin is at p3 (vertex), x-axis along p1-p2,
   * and y-axis perpendicular to p1-p2
   * @param {Point} point - Point in global coordinates
   * @returns {Object} Transformed point {x, y}
   */
  transformToLocal(point) {
    const p12d = geometry.distance(this.p1, this.p2);
    // unit vector from p1 to p2
    const dir1 = [(this.p2.x - this.p1.x) / p12d, (this.p2.y - this.p1.y) / p12d];
    // perpendicular direction
    const dir2 = [dir1[1], -dir1[0]];
    
    // Use p3 as origin instead of midpoint
    const dx = point.x - this.p3.x;
    const dy = point.y - this.p3.y;
    
    return {
      x: dx * dir1[0] + dy * dir1[1],
      y: dx * dir2[0] + dy * dir2[1]
    };
  }

  /**
   * Transform a point from local parabola coordinates back to global coordinates
   * @param {Object} point - Point in local coordinates {x, y}
   * @returns {Point} Point in global coordinates
   */
  transformToGlobal(point) {
    const p12d = geometry.distance(this.p1, this.p2);
    // unit vector from p1 to p2
    const dir1 = [(this.p2.x - this.p1.x) / p12d, (this.p2.y - this.p1.y) / p12d];
    // perpendicular direction
    const dir2 = [dir1[1], -dir1[0]];

    return geometry.point(
      this.p3.x + point.x * dir1[0] + point.y * dir2[0],
      this.p3.y + point.x * dir1[1] + point.y * dir2[1]
    );
  }

  /**
   * Get the parabola coefficient 'a' in y = ax²
   * @returns {number} Coefficient a
   */
  getParabolaCoefficient() {
    const p12d = geometry.distance(this.p1, this.p2);
    const p1Local = this.transformToLocal(this.p1);
    // Calculate a from the fact that p1 lies on the parabola
    return p1Local.y / (p1Local.x * p1Local.x);
  }

  /**
   * Check if the parabola is degenerate (p1, p2, p3 are collinear)
   * @returns {boolean} True if degenerate
   */
  isDegenerate() {
    // Calculate area of triangle formed by p1, p2, p3
    // If area is close to 0, points are collinear
    const area = Math.abs(
      (this.p2.x - this.p1.x) * (this.p3.y - this.p1.y) -
      (this.p3.x - this.p1.x) * (this.p2.y - this.p1.y)
    );
    return area < 1e-10;
  }

  checkRayIntersects(ray) {
    if (!this.p3 || !this.checkRayIntersectFilter(ray)) return;

    // Handle degenerate case (linear mirror)
    if (this.isDegenerate()) {
      const intersection = geometry.linesIntersection(
        geometry.line(ray.p1, ray.p2),
        geometry.line(this.p1, this.p2)
      );
      if (intersection &&
          geometry.intersectionIsOnSegment(intersection, geometry.line(this.p1, this.p2)) &&
          geometry.intersectionIsOnRay(intersection, ray) &&
          geometry.distance(ray.p1, intersection) >= Simulator.MIN_RAY_SEGMENT_LENGTH * this.scene.lengthScale) {
        return intersection;
      }
      return null;
    }

    // Normal parabolic case
    // Transform ray to local coordinates
    const p1Local = this.transformToLocal(ray.p1);
    const p2Local = this.transformToLocal(ray.p2);
    
    // Get normalized direction vector
    const dx = p2Local.x - p1Local.x;
    const dy = p2Local.y - p1Local.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const vx = dx / d;
    const vy = dy / d;

    // Get parabola coefficient
    const a = this.getParabolaCoefficient();

    // Handle the case where ray is parallel to axis of symmetry
    // In this case, vx ≈ 0 and the quadratic equation becomes degenerate
    if (Math.abs(vx) < 1e-10) {
      // For vertical rays, x stays constant
      const x = p1Local.x;
      // Intersection occurs at y = ax²
      const y = a * x * x;
      // Calculate time to reach intersection
      const t = (y - p1Local.y) / vy;
      if (t > Simulator.MIN_RAY_SEGMENT_LENGTH * this.scene.lengthScale &&
          Math.abs(x) <= geometry.distance(this.p1, this.p2) / 2) {
        return this.transformToGlobal({x, y});
      }
      return null;
    }

    // Solve quadratic equation: a·dx²·t² + (2a·x₁·dx - dy)·t + (a·x₁² - y₁) = 0
    const A = a * vx * vx;
    const B = 2 * a * p1Local.x * vx - vy;
    const C = a * p1Local.x * p1Local.x - p1Local.y;

    const discriminant = B * B - 4 * A * C;
    if (discriminant < 0) return null;

    // Get solutions
    const t1 = (-B + Math.sqrt(discriminant)) / (2 * A);
    const t2 = (-B - Math.sqrt(discriminant)) / (2 * A);

    // Get intersection points
    const intersections = [];
    if (t1 > Simulator.MIN_RAY_SEGMENT_LENGTH * this.scene.lengthScale) {
      const x = p1Local.x + t1 * vx;
      const y = p1Local.y + t1 * vy;
      // Check if point is within the mirror bounds
      if (Math.abs(x) <= geometry.distance(this.p1, this.p2) / 2) {
        intersections.push({t: t1, point: this.transformToGlobal({x, y})});
      }
    }
    if (t2 > Simulator.MIN_RAY_SEGMENT_LENGTH * this.scene.lengthScale) {
      const x = p1Local.x + t2 * vx;
      const y = p1Local.y + t2 * vy;
      // Check if point is within the mirror bounds
      if (Math.abs(x) <= geometry.distance(this.p1, this.p2) / 2) {
        intersections.push({t: t2, point: this.transformToGlobal({x, y})});
      }
    }

    // Return closest intersection
    if (intersections.length === 0) return null;
    return intersections.reduce((closest, current) => 
      current.t < closest.t ? current : closest
    ).point;
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    // Handle degenerate case (linear mirror)
    if (this.isDegenerate()) {
      const dir = [(this.p2.x - this.p1.x), (this.p2.y - this.p1.y)];
      const len = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1]);
      const nx = -dir[1] / len;  // Normal vector
      const ny = dir[0] / len;

      // Calculate incident vector
      const dx = incidentPoint.x - ray.p1.x;
      const dy = incidentPoint.y - ray.p1.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const vx = dx / d;
      const vy = dy / d;

      // Calculate reflection using r = v - 2(v·n)n
      const dot = vx * nx + vy * ny;
      const rx = vx - 2 * dot * nx;
      const ry = vy - 2 * dot * ny;

      ray.p1 = incidentPoint;
      ray.p2 = geometry.point(
        incidentPoint.x + rx,
        incidentPoint.y + ry
      );
      return;
    }

    // Normal parabolic case
    // Transform to local coordinates
    const incidentLocal = this.transformToLocal(incidentPoint);
    const rayStartLocal = this.transformToLocal(ray.p1);

    // Get incident direction
    const dx = incidentLocal.x - rayStartLocal.x;
    const dy = incidentLocal.y - rayStartLocal.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const vx = dx / d;
    const vy = dy / d;

    // Get parabola coefficient
    const a = this.getParabolaCoefficient();

    // Calculate normal vector at intersection point (-2ax, 1)
    const nx = -2 * a * incidentLocal.x;
    const ny = 1;
    const nlen = Math.sqrt(nx * nx + ny * ny);
    const nnx = nx / nlen;
    const nny = ny / nlen;

    // Calculate reflection direction: r = v - 2(v·n)n
    const dot = vx * nnx + vy * nny;
    const rx = vx - 2 * dot * nnx;
    const ry = vy - 2 * dot * nny;

    // Set new ray endpoint in global coordinates
    ray.p1 = incidentPoint;
    const reflectedPoint = this.transformToGlobal({
      x: incidentLocal.x + rx,
      y: incidentLocal.y + ry
    });
    ray.p2 = reflectedPoint;
  }

};

export default ParabolicMirror;