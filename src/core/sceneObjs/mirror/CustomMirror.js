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
import LineObjMixin from '../LineObjMixin.js';
import i18next from 'i18next';
import Simulator from '../../Simulator.js';
import geometry from '../../geometry.js';
import { evaluateLatex } from '../../equation.js';

/**
 * Mirror with shape defined by a custom equation.
 * 
 * Tools -> Mirror -> Custom equation
 * @class
 * @extends BaseFilter
 * @memberof sceneObjs
 * @property {Point} p1 - The point corresponding to (-1,0) in the coordinate system of the equation.
 * @property {Point} p2 - The point corresponding to (1,0) in the coordinate system of the equation.
 * @property {string} eqn - The equation of the mirror. The variable is x.
 * @property {boolean} filter - Whether it is a dichroic mirror.
 * @property {boolean} invert - If true, the ray with wavelength outside the bandwidth is reflected. If false, the ray with wavelength inside the bandwidth is reflected.
 * @property {number} wavelength - The target wavelength if dichroic is enabled. The unit is nm.
 * @property {number} bandwidth - The bandwidth if dichroic is enabled. The unit is nm.
 * @property {Array<Point>} tmp_points - The points on the curve.
 * @property {number} tmp_i - The index of the point on the curve where the ray is incident.
 */
class CustomMirror extends LineObjMixin(BaseFilter) {
  static type = 'CustomMirror';
  static isOptical = true;
  static mergesWithGlass = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    eqn: "0.5\\cdot\\sqrt{1-x^2}",
    filter: false,
    invert: false,
    wavelength: Simulator.GREEN_WAVELENGTH,
    bandwidth: 10
  };

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.categories.mirror'));
    objBar.createEquation('y = ', this.eqn, function (obj, value) {
      obj.eqn = value;
      // Invalidate points when equation changes
      delete obj.tmp_points;
    }, '<ul><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.constants') + '<br><code>pi e</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.operators') + '<br><code>+ - * / ^</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.functions') + '<br><code>sqrt sin cos tan sec csc cot sinh cosh tanh log exp arcsin arccos arctan arcsinh arccosh arctanh floor round ceil trunc sgn max min abs</code></li><li>' + i18next.t('simulator:sceneObjs.common.eqnInfo.useModuleWithArrays') + '</li></ul>');
    
    super.populateObjBar(objBar);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
      ctx.fillStyle = 'rgb(128,128,128)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      return;
    }

    // Initialize points if needed
    if (!this.tmp_points) {
      if (!this.initPoints()) {
        // If initialization failed, draw error indicators
        ctx.fillStyle = "red";
        ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
        ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
        return;
      }
    }

    // Draw the curve
    const colorArray = Simulator.wavelengthToColor(this.wavelength || Simulator.GREEN_WAVELENGTH, 1);
    ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.simulateColors && this.wavelength && this.filter ? colorArray : this.scene.theme.mirror.color);
    ctx.lineWidth = this.scene.theme.mirror.width * ls;
    ctx.beginPath();
    
    var pts = this.tmp_points;
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    
    ctx.stroke();
    
    if (isHovered) {
      ctx.fillStyle = 'rgb(255,0,0)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
    }
  }

  move(diffX, diffY) {
    super.move(diffX, diffY);
    // Invalidate points after moving
    delete this.tmp_points;
    return true;
  }

  rotate(angle, center = null) {
    super.rotate(angle, center);
    // Invalidate points after rotating
    delete this.tmp_points;
    return true;
  }

  scale(scale, center = null) {
    super.scale(scale, center);
    // Invalidate points after scaling
    delete this.tmp_points;
    return true;
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    super.onConstructMouseDown(mouse, ctrl, shift);
    // Invalidate points during construction
    delete this.tmp_points;
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    super.onConstructMouseMove(mouse, ctrl, shift);
    // Invalidate points during construction
    delete this.tmp_points;
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    const result = super.onConstructMouseUp(mouse, ctrl, shift);
    // Invalidate points after construction
    delete this.tmp_points;
    return result;
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

    // Initialize points if needed
    if (!this.tmp_points) {
      if (!this.initPoints()) {
        return;
      }
    }
    
    var i;
    var pts = this.tmp_points;
    for (i = 0; i < pts.length - 1; i++) {
      var seg = geometry.line(pts[i], pts[i + 1]);
      if (mouse.isOnSegment(seg)) {
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
    super.onDrag(mouse, dragContext, ctrl, shift);
    // Invalidate points after any dragging operation
    delete this.tmp_points;
  }

  checkRayIntersects(ray) {
    // Initialize points if needed
    if (!this.tmp_points) {
      if (!this.initPoints() || !this.checkRayIntersectFilter(ray)) {
        return;
      }
    } else if (!this.checkRayIntersectFilter(ray)) {
      return;
    }
    
    var i, j;
    var pts = this.tmp_points;
    var dir = geometry.distance(this.p2, ray.p1) > geometry.distance(this.p1, ray.p1);
    var incidentPoint;
    for (j = 0; j < pts.length - 1; j++) {
      i = dir ? j : (pts.length - 2 - j);
      var rp_temp = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), geometry.line(pts[i], pts[i + 1]));
      var seg = geometry.line(pts[i], pts[i + 1]);
      // need Simulator.MIN_RAY_SEGMENT_LENGTH check to handle a ray that reflects off mirror multiple times
      if (geometry.distance(ray.p1, rp_temp) < Simulator.MIN_RAY_SEGMENT_LENGTH * this.scene.lengthScale)
        continue;
      if (geometry.intersectionIsOnSegment(rp_temp, seg) && geometry.intersectionIsOnRay(rp_temp, ray)) {
        if (!incidentPoint || geometry.distance(ray.p1, rp_temp) < geometry.distance(ray.p1, incidentPoint)) {
          incidentPoint = rp_temp;
          this.tmp_i = i;
        }
      }
    }
    if (incidentPoint) return incidentPoint;
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    var rx = ray.p1.x - incidentPoint.x;
    var ry = ray.p1.y - incidentPoint.y;
    var i = this.tmp_i;
    var pts = this.tmp_points;
    var seg = geometry.line(pts[i], pts[i + 1]);
    var mx = seg.p2.x - seg.p1.x;
    var my = seg.p2.y - seg.p1.y;


    ray.p1 = incidentPoint;
    var frac;
    if (Math.abs(mx) > Math.abs(my)) {
      frac = (incidentPoint.x - seg.p1.x) / mx;
    } else {
      frac = (incidentPoint.y - seg.p1.y) / my;
    }

    if ((i == 0 && frac < 0.5) || (i == pts.length - 2 && frac >= 0.5)) {
      ray.p2 = geometry.point(incidentPoint.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, incidentPoint.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
    } else {
      // Use a simple trick to smooth out the slopes of outgoing rays so that image detection works.
      // However, a more proper numerical algorithm from the beginning (especially to handle singularities) is still desired.

      var outx = incidentPoint.x + rx * (my * my - mx * mx) - 2 * ry * mx * my;
      var outy = incidentPoint.y + ry * (mx * mx - my * my) - 2 * rx * mx * my;

      var segA;
      if (frac < 0.5) {
        segA = geometry.line(pts[i - 1], pts[i]);
      } else {
        segA = geometry.line(pts[i + 1], pts[i + 2]);
      }
      var mxA = segA.p2.x - segA.p1.x;
      var myA = segA.p2.y - segA.p1.y;

      var outxA = incidentPoint.x + rx * (myA * myA - mxA * mxA) - 2 * ry * mxA * myA;
      var outyA = incidentPoint.y + ry * (mxA * mxA - myA * myA) - 2 * rx * mxA * myA;

      var outxFinal;
      var outyFinal;

      if (frac < 0.5) {
        outxFinal = outx * (0.5 + frac) + outxA * (0.5 - frac);
        outyFinal = outy * (0.5 + frac) + outyA * (0.5 - frac);
      } else {
        outxFinal = outxA * (frac - 0.5) + outx * (1.5 - frac);
        outyFinal = outyA * (frac - 0.5) + outy * (1.5 - frac);
      }
      //console.log(frac);
      ray.p2 = geometry.point(outxFinal, outyFinal);
    }
  }
  
  /** Utility method */

  /**
   * Initialize the points on the curve based on the equation.
   * This method is called by draw() and checkRayIntersects() when needed.
   * @returns {boolean} Whether the initialization was successful.
   */
  initPoints() {
    if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
      delete this.tmp_points;
      //this.error = "Invalid mirror: endpoints are the same";
      return false;
    }

    var fn;
    try {
      fn = evaluateLatex(this.eqn);
    } catch (e) {
      delete this.tmp_points;
      this.error = e.toString();
      return false;
    }

    var p12d = geometry.distance(this.p1, this.p2);
    // unit vector from p1 to p2
    var dir1 = [(this.p2.x - this.p1.x) / p12d, (this.p2.y - this.p1.y) / p12d];
    // perpendicular direction
    var dir2 = [dir1[1], -dir1[0]];
    // get height of (this section of) parabola
    var x0 = p12d / 2;
    var i;
    
    this.tmp_points = [];
    var lastError = "";
    for (i = -0.1000001 * this.scene.lengthScale; i < p12d + 0.09 * this.scene.lengthScale; i += 0.1000001 * this.scene.lengthScale) {
      // avoid using exact integers to avoid problems with detecting intersections
      var ix = i + 0.05 * this.scene.lengthScale;
      if (ix < 0) ix = 0;
      if (ix > p12d) ix = p12d;
      var x = ix - x0;
      var scaled_x = 2 * x / p12d;
      var scaled_y;
      try {
        scaled_y = fn({ x: scaled_x, "pi": Math.PI });
        var y = scaled_y * p12d * 0.5;
        var pt = geometry.point(this.p1.x + dir1[0] * ix + dir2[0] * y, this.p1.y + dir1[1] * ix + dir2[1] * y);
        this.tmp_points.push(pt);
      } catch (e) {
        lastError = e;
      }
    }
    
    if (this.tmp_points.length == 0) {
      delete this.tmp_points;
      this.error = lastError.toString();
      return false;
    }
    
    this.error = null;
    return true;
  }
};

export default CustomMirror;