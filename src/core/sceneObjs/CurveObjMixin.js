/*
 * Copyright 2025 The Ray Optics Simulation authors and contributors
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

import geometry from '../geometry.js';
import Simulator from '../Simulator.js';
import BaseSceneObj from './BaseSceneObj.js';
import i18next from 'i18next';
import { Bezier } from 'bezier-js';

/**
 * The mixin for the scene objects whose boundary is defined by a sequence of
 * cubic Bezier curves, either forming a closed loop or an open polyline.
 *
 * Subclasses that extend this mixin may override:
 * - `static allowOpen` (default `false`): whether construction allows the user
 *   to finish with an open (non-closed) curve by double-clicking the last
 *   committed point. When `false`, the only way to finish is to click on the
 *   first anchor point (closed shape), matching the legacy {@link CurveGlass}
 *   behavior.
 *
 * @template {typeof BaseSceneObj} T
 * @param {T} Base
 * @returns {T}
 */
const CurveObjMixin = Base => class extends Base {

  static allowOpen = false;

  static getPropertySchema(objData, scene) {
    return [
      { key: 'points', type: 'array', label: i18next.t('simulator:sceneObjs.common.bezierControlPoints'),
        itemSchema: [
          { key: 'a1', type: 'point', label: 'a' },
          { key: 'c1', type: 'point', label: 'c1' },
          { key: 'c2', type: 'point', label: 'c2' },
        ],
      },
      ...super.getPropertySchema(objData, scene),
    ];
  }

  /**
   * @param {Scene} scene - The scene the object belongs to.
   * @param {Object|null} jsonObj - The JSON object to be deserialized, if any.
   */
  constructor(scene, jsonObj) {
    super(scene, jsonObj);

    // Initialize curves and bboxes
    this.curves = [];
    this.bboxes = [];

    // Default `isClosed` to true (for backward compatibility with the legacy
    // CurveGlass/CurveGrinGlass, which did not store this flag).
    if (this.isClosed === undefined) {
      this.isClosed = (jsonObj && jsonObj.isClosed !== undefined) ? jsonObj.isClosed : true;
    }

    // Rebuild the Bezier curves from the serialized `points` array.
    if (jsonObj && jsonObj.points && jsonObj.points.length > 0) {
      const pts = jsonObj.points;
      const numCurves = this.isClosed ? pts.length : Math.max(0, pts.length - 1);
      for (let i = 0; i < numCurves; i++) {
        const next = this.isClosed ? pts[(i + 1) % pts.length] : pts[i + 1];
        this.newCurve([pts[i].a1, pts[i].c1, pts[i].c2, next.a1], -1);
      }
    }
  }

  serialize() {
    let jsonObj = super.serialize();

    if (this.curves && this.curves.length > 0) {
      const pts = this.curves.map(curve => {
        const points = JSON.parse(JSON.stringify(curve)).points.slice(0, 3).map(p => geometry.point(p.x, p.y));
        return { a1: points[0], c1: points[1], c2: points[2] };
      });
      if (!this.isClosed) {
        // For an open curve append the final anchor (second endpoint of the
        // last curve). It has no outgoing c1/c2 since no further curve follows.
        const lastCurve = this.curves[this.curves.length - 1];
        const lastEndpoint = JSON.parse(JSON.stringify(lastCurve)).points[3];
        pts.push({ a1: geometry.point(lastEndpoint.x, lastEndpoint.y) });
      }
      jsonObj.points = pts;
    } else {
      jsonObj.points = [];
    }
    delete jsonObj.curves;
    delete jsonObj.bboxes;
    if (jsonObj.path) delete jsonObj.path;

    return jsonObj;
  }

  move(diffX, diffY) {
    for (let i = 0; i < this.curves.length; i++) {
      for (let j = 0; j < this.curves[i].points.length; j++) {
        this.curves[i].points[j].x += diffX;
        this.curves[i].points[j].y += diffY;
      }
      this.newCurve(this.curves[i].points, i);
    }

    return true;
  }

  rotate(angle, center) {
    const rotationCenter = center || this.getDefaultCenter();
    const pointsInCurve = 4;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let i = 0; i < this.curves.length; i++) {
      for (let j = 0; j < pointsInCurve; j++) {
        const dx = this.curves[i].points[j].x - rotationCenter.x;
        const dy = this.curves[i].points[j].y - rotationCenter.y;
        this.curves[i].points[j].x = rotationCenter.x + dx * cosA - dy * sinA;
        this.curves[i].points[j].y = rotationCenter.y + dx * sinA + dy * cosA;
      }
      this.newCurve(this.curves[i].points, i);
    }

    return true;
  }

  scale(scale, center) {
    const scalingCenter = center || this.getDefaultCenter();
    const pointsInCurve = 4;

    for (let i = 0; i < this.curves.length; i++) {
      for (let j = 0; j < pointsInCurve; j++) {
        const dx = this.curves[i].points[j].x - scalingCenter.x;
        const dy = this.curves[i].points[j].y - scalingCenter.y;
        this.curves[i].points[j].x = scalingCenter.x + dx * scale;
        this.curves[i].points[j].y = scalingCenter.y + dy * scale;
      }
      this.newCurve(this.curves[i].points, i);
    }

    return true;
  }

  getDefaultCenter() {
    // Use the average of the anchor points (endpoints of each curve).
    const anchors = [];
    for (let i = 0; i < this.curves.length; i++) {
      anchors.push(this.curves[i].points[0]);
    }
    if (!this.isClosed && this.curves.length > 0) {
      // Include the trailing endpoint in the open case.
      anchors.push(this.curves[this.curves.length - 1].points[3]);
    }
    if (anchors.length === 0) {
      return geometry.point(0, 0);
    }
    return geometry.point(
      Math.round(anchors.reduce((s, p) => s + p.x, 0) / anchors.length),
      Math.round(anchors.reduce((s, p) => s + p.y, 0) / anchors.length)
    );
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();

    if (!this.notDone) {
      this.notDone = true;
      this.curves = [];
      this.bboxes = [];
      this.path = [{ x: mousePos.x, y: mousePos.y }];
    }

    if (this.path.length > 0) {
      // Close the shape when clicking on the first anchor point.
      if (this.path.length > 3 && mouse.snapsOnPoint(this.path[0])) {
        this.path.length--; // Remove the trailing preview point
        this.notDone = false;
        this.isClosed = true;
        this.generatePolyBezier();

        return { isDone: true };
      }
      // Finish as an open curve when double-clicking the last committed point.
      if (this.constructor.allowOpen && this.path.length > 2 && mouse.snapsOnPoint(this.path[this.path.length - 2])) {
        this.path.length--; // Remove the trailing preview point
        this.notDone = false;
        this.isClosed = false;
        this.generatePolyBezier();

        return { isDone: true };
      }
      this.path.push({ x: mousePos.x, y: mousePos.y });
    }
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    if (!this.notDone) return { isDone: true };
    const mousePos = mouse.getPosSnappedToGrid();
    this.path[this.path.length - 1] = { x: mousePos.x, y: mousePos.y };
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    if (!this.notDone) return { isDone: true };
  }

  onConstructUndo() {
    if (this.path.length <= 2) {
      return { isCancelled: true };
    } else {
      if (this.curves) {
        this.curves.pop();
        this.path.pop();
      } else {
        this.path.pop();
      }
    }
  }

  checkMouseOver(mouse) {
    var dragContext = {};

    const mousePos = mouse.getPosSnappedToGrid();
    dragContext.mousePos0 = mousePos;
    dragContext.mousePos1 = mousePos;
    dragContext.snapContext = {};

    // Anchor points (starts of each curve).
    for (let c = 0; c < this.curves.length; c++) {
      if (mouse.isOnPoint(this.curves[c].points[0])) {
        dragContext.part = 1;
        dragContext.targetPoint = this.curves[c].points[0];
        dragContext.index = c;
        return dragContext;
      }
      // Control points of each curve.
      for (let i = 1; i < this.curves[c].points.length - 1; i++) {
        if (mouse.isOnPoint(this.curves[c].points[i])) {
          dragContext.part = i + 1;
          dragContext.targetPoint = this.curves[c].points[i];
          dragContext.index = c;
          return dragContext;
        }
      }
    }
    // For the open case, the trailing endpoint of the last curve has no
    // associated "next curve", so check it explicitly.
    if (!this.isClosed && this.curves.length > 0) {
      const last = this.curves[this.curves.length - 1];
      if (mouse.isOnPoint(last.points[3])) {
        dragContext.part = 1;
        dragContext.targetPoint = last.points[3];
        // Use index equal to curves.length to denote "trailing endpoint".
        dragContext.index = this.curves.length;
        return dragContext;
      }
    }
    // On the curve itself. Done outside of the previous loop to avoid
    // conflicts with the anchor-point detection.
    for (let c = 0; c < this.curves.length; c++) {
      if (mouse.isOnCurve(this.curves[c])) {
        dragContext.part = 0;
        return dragContext;
      }
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    var mousePos;
    var mod = 0;

    if (shift) mod++;
    if (ctrl) mod += 2;

    if (dragContext.part === 1) {
      const isTrailingEndpoint = (dragContext.index === this.curves.length);
      const curIdx = isTrailingEndpoint ? -1 : dragContext.index;
      const prevIdx = isTrailingEndpoint
        ? this.curves.length - 1
        : (this.isClosed ? (dragContext.index - 1 + this.curves.length) % this.curves.length : dragContext.index - 1);
      const hasCur = curIdx >= 0;
      const hasPrev = prevIdx >= 0;

      switch (mod) {
        default:
          mousePos = mouse.getPosSnappedToGrid();
          dragContext.snapContext = {};
          break;

        case 1:
          mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
          break;

        case 2: {
          mousePos = mouse.getPosSnappedToGrid();
          dragContext.snapContext = {};

          // Drag the adjacent control points along with the anchor point.
          const anchor = hasCur ? this.curves[curIdx].points[0] : this.curves[prevIdx].points[3];
          const diffX = mousePos.x - anchor.x;
          const diffY = mousePos.y - anchor.y;

          if (hasCur) {
            this.curves[curIdx].points[1].x += diffX;
            this.curves[curIdx].points[1].y += diffY;
          }
          if (hasPrev) {
            this.curves[prevIdx].points[2].x += diffX;
            this.curves[prevIdx].points[2].y += diffY;
          }

          if (hasCur) this.newCurve(this.curves[curIdx].points, curIdx);
          if (hasPrev) this.newCurve(this.curves[prevIdx].points, prevIdx);

          break;
        }
      }

      // Move the shared anchor point on both adjacent curves.
      if (hasCur) {
        this.curves[curIdx].points[0].x = mousePos.x;
        this.curves[curIdx].points[0].y = mousePos.y;
        this.newCurve(this.curves[curIdx].points, curIdx);
      }
      if (hasPrev) {
        this.curves[prevIdx].points[3].x = mousePos.x;
        this.curves[prevIdx].points[3].y = mousePos.y;
        this.newCurve(this.curves[prevIdx].points, prevIdx);
      }
    }

    else if (dragContext.part === 2 || dragContext.part === 3) {
      if (shift) {
        mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
      } else {
        mousePos = mouse.getPosSnappedToGrid();
        dragContext.snapContext = {};
      }
      this.curves[dragContext.index].points[dragContext.part - 1].x = mousePos.x;
      this.curves[dragContext.index].points[dragContext.part - 1].y = mousePos.y;
      this.newCurve(this.curves[dragContext.index].points, dragContext.index);
    }

    else if (dragContext.part === 0) {
      if (shift) {
        mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
      } else {
        mousePos = mouse.getPosSnappedToGrid();
        dragContext.snapContext = {};
      }
      this.move(mousePos.x - dragContext.mousePos1.x, mousePos.y - dragContext.mousePos1.y);
      dragContext.mousePos1 = mousePos;
    }
  }

  /**
   * Counts intersections between the line segment (or ray) from `p3` to `p4`
   * and the boundary curves. When `p4` is omitted, this is used as a
   * crossing-number test (for closed shapes) and returns the number of
   * intersections from `p3` with a pseudo-ray going outside the bounding box.
   * When `p4` is provided, it also records per-curve intersections and the
   * nearest one in `this.curIntersections`.
   */
  countIntersections(p3, p4) {
    var cnt = 0;

    if (typeof p4 === "undefined") {
      let minX = Infinity;
      for (let i = 0; i < this.bboxes.length; i++) {
        if (this.bboxes[i].x.min < minX) {
          minX = this.bboxes[i].x.min;
        }
      }
      const offset = (this.scene && typeof this.scene.rng === 'function') ? this.scene.rng() : 1.23456789;
      const outsidePoint = { x: minX - offset - 100, y: p3.y + offset };

      for (let i = 0; i < this.curves.length; i++) {
        cnt += this.curves[i].lineIntersects(geometry.line(geometry.point(p3.x, p3.y), outsidePoint)).length;
      }
    } else {
      this.curIntersections = {
        curves: [],
        shortest: { val: Infinity, i: -1, j: -1 }
      };

      let mod_len = 0;
      for (let i = 0; i < this.bboxes.length; i++) {
        mod_len += Math.abs(this.bboxes[i].x.max) > Math.abs(this.bboxes[i].y.max) ? Math.abs(this.bboxes[i].x.max) : Math.abs(this.bboxes[i].y.max);
      }

      for (let i = 0; i < this.curves.length; i++) {
        this.curIntersections.curves.push(
          this.curves[i].lineIntersects(geometry.line(p3, geometry.point(p4.x + ((p4.x - p3.x) * mod_len), p4.y + ((p4.y - p3.y) * mod_len))))
        );

        for (let j = 0; j < this.curIntersections.curves[i].length; j++) {
          if (geometry.distanceSquared(p3, this.curves[i].get(this.curIntersections.curves[i][j])) < Simulator.MIN_RAY_SEGMENT_LENGTH_SQUARED * this.scene.lengthScale * this.scene.lengthScale) {
            this.curIntersections.curves[i].splice(j, 1);
          }
        }

        cnt += this.curIntersections.curves[i].length;

        for (let j = 0; j < this.curIntersections.curves[i].length; j++) {
          let tmp = geometry.distanceSquared(p3, this.curves[i].get(this.curIntersections.curves[i][j]));
          if (tmp < this.curIntersections.shortest.val) {
            this.curIntersections.shortest = { val: tmp, i: i, j: j };
          }
        }
      }
    }
    return cnt;
  }

  /* Rendering helpers */

  drawPoint(p1, canvasRenderer) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;
    ctx.fillRect(p1.x - 1.5 * ls, p1.y - 1.5 * ls, 3 * ls, 3 * ls);
  }

  drawLine(p1, p2, canvasRenderer, strokeStyle) {
    const ctx = canvasRenderer.ctx;
    ctx.strokeStyle = strokeStyle || 'rgb(128,128,128)';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.closePath();

    ctx.fillStyle = 'rgb(255,0,0)';
    [p1, p2].forEach((cur) => this.drawPoint(cur, canvasRenderer));
  }

  drawCurve(curve, canvasRenderer) {
    const ctx = canvasRenderer.ctx;
    const p = curve.points;
    ctx.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y);
  }

  /**
   * Draw the (polygonal) construction preview of the curve path while the
   * user is still adding anchor points.
   * @param {CanvasRenderer} canvasRenderer
   */
  drawConstruction(canvasRenderer) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;
    if (!this.path) return;
    if (this.path.length === 2 && this.path[0].x === this.path[1].x && this.path[0].y === this.path[1].y) {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(this.path[0].x - 1.5 * ls, this.path[0].y - 1.5 * ls, 3 * ls, 3 * ls);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(this.path[0].x, this.path[0].y);

    for (let i = 0; i < this.path.length - 1; i++) {
      ctx.lineTo(this.path[i + 1].x, this.path[i + 1].y);
      ctx.fillStyle = 'rgb(255,0,0)';
      this.drawPoint(this.path[i], canvasRenderer);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgb(128,128,128)';
    ctx.lineWidth = 1 * ls;
    ctx.setLineDash([5 * ls, 5 * ls]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /**
   * Build a sub-path on the current canvas context that traces all Bezier
   * curves from the first anchor to the last anchor. The caller is expected to
   * have already called `ctx.beginPath()`. When the shape is closed, callers
   * may additionally call `ctx.closePath()` before filling.
   * @param {CanvasRenderer} canvasRenderer
   */
  tracePath(canvasRenderer) {
    const ctx = canvasRenderer.ctx;
    if (this.curves.length === 0) return;
    const first = this.curves[0].points[0];
    ctx.moveTo(first.x, first.y);
    for (let i = 0; i < this.curves.length; i++) {
      this.drawCurve(this.curves[i], canvasRenderer);
    }
  }

  /**
   * Draw the anchor and control points with tangent guide lines.
   * @param {CanvasRenderer} canvasRenderer
   */
  drawControlHandles(canvasRenderer) {
    const ctx = canvasRenderer.ctx;
    if (this.curves.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(this.curves[0].points[0].x, this.curves[0].points[0].y);
    for (let i = 0; i < this.curves.length; i++) {
      const p = this.curves[i].points;
      ctx.strokeStyle = 'rgb(255,0,0)';
      this.drawLine(p[0], p[1], canvasRenderer, ctx.strokeStyle);
      this.drawLine(p[2], p[3], canvasRenderer, ctx.strokeStyle);
      p.forEach((cur) => this.drawPoint(cur, canvasRenderer));
    }
  }

  /* Curve construction helpers */

  // Generate default control points from path.
  generateDefaultControlPoints(pts) {
    const cpVec1 = geometry.normalizeVec(geometry.point(pts[2].x - pts[0].x, pts[2].y - pts[0].y));
    const cpVec2 = geometry.normalizeVec(geometry.point(pts[3].x - pts[1].x, pts[3].y - pts[1].y));

    return [
      geometry.point(pts[1].x + Math.floor(cpVec1.x * 50 + 0.5), pts[1].y + Math.floor(cpVec1.y * 50 + 0.5)),
      geometry.point(pts[2].x - Math.floor(cpVec2.x * 50 + 0.5), pts[2].y - Math.floor(cpVec2.y * 50 + 0.5))
    ];
  }

  // Generate the set of Bezier curves from the polyline path.
  generatePolyBezier() {
    const isClosed = this.isClosed !== false;
    const n = this.path.length;
    const numCurves = isClosed ? n : Math.max(0, n - 1);
    for (let i = 0; i < numCurves; i++) {
      // Get neighbors (used to estimate tangent directions at the anchors).
      // For the open case, mirror the endpoint back onto itself to avoid
      // reaching beyond the path.
      let prev, a, b, next;
      if (isClosed) {
        prev = this.path[(i - 1 + n) % n];
        a = this.path[i];
        b = this.path[(i + 1) % n];
        next = this.path[(i + 2) % n];
      } else {
        a = this.path[i];
        b = this.path[i + 1];
        prev = this.path[i - 1] || a;
        next = this.path[i + 2] || b;
      }
      const ctrl = this.generateDefaultControlPoints([prev, a, b, next]);
      this.newCurve([
        { x: a.x, y: a.y },
        { x: ctrl[0].x, y: ctrl[0].y },
        { x: ctrl[1].x, y: ctrl[1].y },
        { x: b.x, y: b.y }
      ]);
    }
  }

  // Create or replace a Bezier curve, keeping the cached bounding box in sync.
  newCurve(pts, i) {
    if (typeof i === "undefined" || i === -1) {
      this.curves.push(new Bezier(pts));
      this.bboxes.push(this.curves[this.curves.length - 1].bbox());
      return this.curves[this.curves.length - 1];
    } else {
      this.curves[i] = new Bezier(pts);
      this.bboxes[i] = this.curves[i].bbox();
      return this.curves[i];
    }
  }
};

export default CurveObjMixin;
