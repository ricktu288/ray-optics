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

/**
 * @typedef {Object} Point
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} Line
 * @property {Point} p1
 * @property {Point} p2
 */

/**
 * @typedef {Object} Circle
 * @property {Point} c
 * @property {number|Line} r
 */

/**
 * The geometry module, which provides basic geometric figures and operations.
 * @namespace geometry
 */
const geometry = {

  /**
   * Create a point
   * @param {number} x - The x-coordinate of the point.
   * @param {number} y - The y-coordinate of the point.
   * @returns {Point}
   */
  point: function (x, y) { return { x: x, y: y } },

  /**
   * Create a line, which also represents a ray or a segment.
   * When used as a line, p1 and p2 are two distinct points on the line.
   * When used as a ray, p1 is the starting point and p2 is another point on the ray.
   * When used as a segment, p1 and p2 are the two endpoints of the segment.
   * @param {Point} p1
   * @param {Point} p2
   * @returns {Line}
   */
  line: function (p1, p2) { return { p1: p1, p2: p2 } },

  /**
   * Create a circle
   * @param {Point} c - The center point of the circle.
   * @param {number|Point} r - The radius of the circle or a point on the circle.
   */
  circle: function (c, r) {
    if (typeof r == 'object') {
      return { c: c, r: geometry.line(c, r) }
    } else {
      return { c: c, r: r }
    }
  },

  /**
  * Calculate the dot product, where the two points are treated as vectors.
  * @param {Point} p1
  * @param {Point} p2
  * @return {Number}
  **/
  dot: function (p1, p2) {
    return p1.x * p2.x + p1.y * p2.y;
  },

  /**
  * Calculate the cross product, where the two points are treated as vectors.
  * @param {Point} p1
  * @param {Point} p2
  * @return {Number}
  **/
  cross: function (p1, p2) {
    return p1.x * p2.y - p1.y * p2.x;
  },

  /**
  * Calculate the intersection of two lines.
  * @param {Line} l1
  * @param {Line} l2
  * @return {Point}
  **/
  linesIntersection: function (l1, l2) {
    var A = l1.p2.x * l1.p1.y - l1.p1.x * l1.p2.y;
    var B = l2.p2.x * l2.p1.y - l2.p1.x * l2.p2.y;
    var xa = l1.p2.x - l1.p1.x;
    var xb = l2.p2.x - l2.p1.x;
    var ya = l1.p2.y - l1.p1.y;
    var yb = l2.p2.y - l2.p1.y;
    return geometry.point((A * xb - B * xa) / (xa * yb - xb * ya), (A * yb - B * ya) / (xa * yb - xb * ya));
  },

  /**
   * Calculate the intersections of a line and a circle.
   * @param {Line} l1
   * @param {Circle} c1
   * @return {Point[]}
   */
  lineCircleIntersections: function (l1, c1) {
    var xa = l1.p2.x - l1.p1.x;
    var ya = l1.p2.y - l1.p1.y;
    var cx = c1.c.x;
    var cy = c1.c.y;
    var r_sq = (typeof c1.r == 'object') ? ((c1.r.p1.x - c1.r.p2.x) * (c1.r.p1.x - c1.r.p2.x) + (c1.r.p1.y - c1.r.p2.y) * (c1.r.p1.y - c1.r.p2.y)) : (c1.r * c1.r);

    var l = Math.sqrt(xa * xa + ya * ya);
    var ux = xa / l;
    var uy = ya / l;

    var cu = ((cx - l1.p1.x) * ux + (cy - l1.p1.y) * uy);
    var px = l1.p1.x + cu * ux;
    var py = l1.p1.y + cu * uy;


    var d = Math.sqrt(r_sq - (px - cx) * (px - cx) - (py - cy) * (py - cy));

    var ret = [];
    ret[1] = geometry.point(px + ux * d, py + uy * d);
    ret[2] = geometry.point(px - ux * d, py - uy * d);

    return ret;
  },

  /**
   * Calculate the intersections of a line and a curve.
   * @param {Line} l1
   * @param {Bezier} c1
   * @return {Point[]}
   */
  lineCurveIntersections: function (l1, c1) {
    return c1.intersects(l1);
  },


  /**
   * Test if a point on the extension of a ray is actually on the ray.
   * @param {Point} p1
   * @param {Line} r1
   * @return {Boolean}
   */
  intersectionIsOnRay: function (p1, r1) {
    return (p1.x - r1.p1.x) * (r1.p2.x - r1.p1.x) + (p1.y - r1.p1.y) * (r1.p2.y - r1.p1.y) >= 0;
  },


  /**
   * Test if a point on the extension of a segment is actually on the segment.
   * @param {Point} p1
   * @param {Line} s1
   * @return {Boolean}
   */
  intersectionIsOnSegment: function (p1, s1) {
    return (p1.x - s1.p1.x) * (s1.p2.x - s1.p1.x) + (p1.y - s1.p1.y) * (s1.p2.y - s1.p1.y) >= 0 && (p1.x - s1.p2.x) * (s1.p1.x - s1.p2.x) + (p1.y - s1.p2.y) * (s1.p1.y - s1.p2.y) >= 0;
  },

  /**
   * Test if a point on the extension of a curve is actually on the curve.
   * @param {Point} p1
   * @param {Bezier} curve
   * @return {Boolean}
   */
  intersectionIsOnCurve: function (p1, curve, threshold) {
    var d_proj = curve.project(geometry.point(p1.x, p1.y)).d;
   
    return Math.pow(d_proj, 2) < threshold;
  },

  /**
   * Scale the ray based on the bounding box of the curve.
   * @param {Line} r1
   * @param {Bezier} curve
   * @return {Line} - Returns the vector pointing from r1.p1 to the farthest point on the curve's bounding box.
   */
  scaleRayForCurve: function (r1, curve) {
    var bbox = curve.bbox();

    // Offset each line from 0,0 by r1.p1
    bbox.x.min -= r1.p1.x;
    bbox.x.max -= r1.p1.x;
    bbox.y.min -= r1.p1.y;
    bbox.y.max -= r1.p1.y;

    // Get vector (as a point) pointing from r1.p1 to r1.p2
    var v1 = geometry.point(r1.p2.x - r1.p1.x, r1.p2.y - r1.p1.y);

    // Figure out which bounding box corner is farthest from r1.p1 based on what quadrant v1 is in after offsetting by p1
    var farthest = { x: Infinity, y: Infinity };
    if (Math.abs(bbox.x.min) > Math.abs(bbox.x.max)) {
      farthest.x = bbox.x.min;
    } else {
      farthest.x = bbox.x.max;
    }
    if (Math.abs(bbox.y.min) > Math.abs(bbox.y.max)) {
      farthest.y = bbox.y.min;
    } else {
      farthest.y = bbox.y.max;
    }

    // Get distance between p1 and farthest point
    var dist = Math.sqrt(farthest.x ** 2 + farthest.y ** 2);
    
    // Normalize v1 then scale it by dist
    var len_v1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
    v1.x = (v1.x / len_v1) * dist * 1.001;
    v1.y = (v1.y / len_v1) * dist * 1.001;

    return geometry.line(r1.p1, geometry.point(v1.x + r1.p1.x, v1.y + r1.p1.y));
  },

  /**
   * Calculate the length of a line segment.
   * @param {Line} seg
   * @return {Number}
   */
  segmentLength: function (seg) {
    return Math.sqrt(geometry.segmentLengthSquared(seg));
  },

  /**
   * Calculate the squared length of a line segment.
   * @param {Line} seg
   * @return {Number}
   */
  segmentLengthSquared: function (seg) {
    return geometry.distanceSquared(seg.p1, seg.p2);
  },

  /**
   * Calculate the distance between two points.
   * @param {Point} p1
   * @param {Point} p2
   * @return {Number}
   */
  distance: function (p1, p2) {
    return Math.sqrt(geometry.distanceSquared(p1, p2));
  },

  /**
   * Calculate the squared distance between two points.
   * @param {Point} p1
   * @param {Point} p2
   * @return {Number}
   */
  distanceSquared: function (p1, p2) {
    var dx = p1.x - p2.x;
    var dy = p1.y - p2.y;
    return dx * dx + dy * dy;
  },


  /**
   * Calculate the midpoint of a segment.
   * @param {Line} l1
   * @return {Point}
   */
  segmentMidpoint: function (l1) {
    var nx = (l1.p1.x + l1.p2.x) * 0.5;
    var ny = (l1.p1.y + l1.p2.y) * 0.5;
    return geometry.point(nx, ny);
  },


  /**
   * Calculate the midpoint between two points.
   * @param {Point} p1
   * @param {Point} p2
   * @return {Point}
   */
  midpoint: function (p1, p2) {
    var nx = (p1.x + p2.x) * 0.5;
    var ny = (p1.y + p2.y) * 0.5;
    return geometry.point(nx, ny);
  },

  /**
   * Calculate the perpendicular bisector of a segment.
   * @param {Line} l1
   * @return {Line}
   */
  perpendicularBisector: function (l1) {
    return geometry.line(
      geometry.point(
        (-l1.p1.y + l1.p2.y + l1.p1.x + l1.p2.x) * 0.5,
        (l1.p1.x - l1.p2.x + l1.p1.y + l1.p2.y) * 0.5
      ),
      geometry.point(
        (l1.p1.y - l1.p2.y + l1.p1.x + l1.p2.x) * 0.5,
        (-l1.p1.x + l1.p2.x + l1.p1.y + l1.p2.y) * 0.5
      )
    );
  },

  /**
  * Calculate the line though p1 and parallel to l1.
  * @param {Line} l1
  * @param {Point} p1
  * @return {Line}
  */
  parallelLineThroughPoint: function (l1, p1) {
    var dx = l1.p2.x - l1.p1.x;
    var dy = l1.p2.y - l1.p1.y;
    return geometry.line(p1, geometry.point(p1.x + dx, p1.y + dy));
  },

  /**
   * Normalize the given point as if it were a vector.
   * @param {Point} p1
   * @return {Point}
   */
  normalizeVec: function(p1) {
    var len = geometry.distance(geometry.point(0, 0), p1);

    return geometry.point(p1.x / len, p1.y / len);
  },

  /**
   * Rotate the given point as if it were a vector by the given angle in radians.
   * @param {Point} p1
   * @return {Point}
   */
  rotateVec: function(p1, angle) {
    // Rotate by the rotation matrix
    return {
      x: p1.x * Math.cos(angle) - p1.y * Math.sin(angle),
      y: p1.x * Math.sin(angle) + p1.y * Math.cos(angle)
    }
  }
};

export default geometry;