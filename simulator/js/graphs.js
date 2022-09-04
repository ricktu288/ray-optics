var graphs = {
  /**
  * 基本圖型 Basic geometric figures
  **/
  point: function(x, y) {return {type: 1, x: x, y: y, exist: true}},

  line: function(p1, p2) {return {type: 2, p1: p1, p2: p2, exist: true}},

  ray: function(p1, p2) {return {type: 3, p1: p1, p2: p2, exist: true}},

  line_segment: function(p1, p2) {return {type: 4, p1: p1, p2: p2, exist: true}},

  segment: function(p1, p2) {return {type: 4, p1: p1, p2: p2, exist: true}},

  circle: function(c, r) {
    if (typeof r == 'object' && r.type == 1) {
      return {type: 5, c: c, r: this.line_segment(c, r), exist: true}
    } else {
      return {type: 5, c: c, r: r, exist: true}
    }
  },

  /**
  * inner product
  * @method dot
  * @param {graph.point} p1
  * @param {graph.point} p2
  * @return {Number}
  **/
  dot: function(p1, p2) {
    return p1.x * p2.x + p1.y * p2.y;
  },

  /**
  * cross product
  * @method cross
  * @param {graph.point} p1
  * @param {graph.point} p2
  * @return {Number}
  **/
  cross: function(p1, p2) {
    return p1.x * p2.y - p1.y * p2.x;
  },

  /**
  * 求交點 Find intersection
  * @method intersection
  * @param {graph} obj1
  * @param {graph} obj2
  * @return {graph.point}
  **/
  intersection: function(obj1, obj2) {
    // line & line
    if (obj1.type == 2 && obj2.type == 2) {
      return this.intersection_2line(obj1, obj2);
    }
    // line & circle
    else if (obj1.type == 2 && obj2.type == 5) {
      return this.intersection_line_circle(obj1, obj2);
    }
    // circle & line
    else if (obj1.type == 5 && obj2.type == 2) {
      return this.intersection_line_circle(obj2, obj1);
    }
  },

  /**
  * 兩直線交點 Intersection of two lines
  * @method intersection_2line
  * @param {graph.line} l1
  * @param {graph.line} l2
  * @return {graph.point}
  **/
  intersection_2line: function(l1, l2) {
    var A = l1.p2.x * l1.p1.y - l1.p1.x * l1.p2.y;
    var B = l2.p2.x * l2.p1.y - l2.p1.x * l2.p2.y;
    var xa = l1.p2.x - l1.p1.x;
    var xb = l2.p2.x - l2.p1.x;
    var ya = l1.p2.y - l1.p1.y;
    var yb = l2.p2.y - l2.p1.y;
    return graphs.point((A * xb - B * xa) / (xa * yb - xb * ya), (A * yb - B * ya) / (xa * yb - xb * ya));
  },

  /**
  * 直線與圓的交點 Intersection of a line and a circle
  * @method intersection_line_circle
  * @param {graph.line} l1
  * @param {graph.circle} c2
  * @return {graph.point}
  **/
  intersection_line_circle: function(l1, c1) {
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
    ret[1] = graphs.point(px + ux * d, py + uy * d);
    ret[2] = graphs.point(px - ux * d, py - uy * d);

    return ret;
  },


  /**
  * Test if a point is on a ray.
  * @method intersection_line_circle
  * @param {graph.point} p1
  * @param {graph.ray} r1
  * @return {Boolean}
  **/
  intersection_is_on_ray: function(p1, r1) {
    return (p1.x - r1.p1.x) * (r1.p2.x - r1.p1.x) + (p1.y - r1.p1.y) * (r1.p2.y - r1.p1.y) >= 0;
  },


  /**
  * Test if a point is on a line segment.
  * @method intersection_line_circle
  * @param {graph.point} p1
  * @param {graph.segment} s1
  * @return {Boolean}
  **/
  intersection_is_on_segment: function(p1, s1) {
    return (p1.x - s1.p1.x) * (s1.p2.x - s1.p1.x) + (p1.y - s1.p1.y) * (s1.p2.y - s1.p1.y) >= 0 && (p1.x - s1.p2.x) * (s1.p1.x - s1.p2.x) + (p1.y - s1.p2.y) * (s1.p1.y - s1.p2.y) >= 0;
  },

  /**
  * 線段長度 Length of a segment
  * @method length_segment
  * @param {graph.segment} seg
  * @return {Number}
  **/
  length_segment: function(seg) {
    return Math.sqrt(this.length_segment_squared(seg));
  },

  /**
  * 線段長度平方 Square of the length of a segment
  * @method length_segment_squared
  * @param {graph.segment} seg
  * @return {Number}
  **/
  length_segment_squared: function(seg) {
    return this.length_squared(seg.p1, seg.p2);
  },

  /**
  * 兩點距離 Distance between two points
  * @method length
  * @param {graph.point} p1
  * @param {graph.point} p2
  * @return {Number}
  **/
  length: function(p1, p2) {
    return Math.sqrt(this.length_squared(p1, p2));
  },

  /**
  * 兩點距離平方 Square of the distance between two points
  * @method length_squared
  * @param {graph.point} p1
  * @param {graph.point} p2
  * @return {Number}
  **/
  length_squared: function(p1, p2) {
    var dx = p1.x - p2.x;
    var dy = p1.y - p2.y;
    return dx * dx + dy * dy;
  },


  /*
  * 基本作圖函數 Basic geometric constructions
  */

  /**
  * 線段中點 Midpoint of a line segment
  * @method midpoint
  * @param {graph.line} l1
  * @return {graph.point}
  **/
  midpoint: function(l1) {
    var nx = (l1.p1.x + l1.p2.x) * 0.5;
    var ny = (l1.p1.y + l1.p2.y) * 0.5;
    return graphs.point(nx, ny);
  },

  /**
  * Midpoint of two points
  * @method midpoint_points
  * @param {graph.point} p1
  * @param {graph.point} p2
  * @return {graph.point}
  **/
  midpoint_points: function(p1, p2) {
    var nx = (p1.x + p2.x) * 0.5;
    var ny = (p1.y + p2.y) * 0.5;
    return graphs.point(nx, ny);
  },

  /**
  * 線段中垂線 Perpendicular bisector of a line segment
  * @method perpendicular_bisector
  * @param {graph.segment} l1
  * @return {graph.line}
  **/
  perpendicular_bisector: function(l1) {
    return graphs.line(
        graphs.point(
          (-l1.p1.y + l1.p2.y + l1.p1.x + l1.p2.x) * 0.5,
          (l1.p1.x - l1.p2.x + l1.p1.y + l1.p2.y) * 0.5
        ),
        graphs.point(
          (l1.p1.y - l1.p2.y + l1.p1.x + l1.p2.x) * 0.5,
          (-l1.p1.x + l1.p2.x + l1.p1.y + l1.p2.y) * 0.5
        )
      );
  },

  /**
  * Get the line though p1 and parallel to l1.
  * @method parallel
  * @param {graph.line} l1
  * @param {graph.point} p1
  * @return {graph.line}
  **/
  parallel: function(l1, p1) {
    var dx = l1.p2.x - l1.p1.x;
    var dy = l1.p2.y - l1.p1.y;
    return graphs.line(p1, graphs.point(p1.x + dx, p1.y + dy));
  }
};
