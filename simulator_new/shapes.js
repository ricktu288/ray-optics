export class PointShape {
  /**
   * Create a PointShape for controlling other shapes.
   * @param {number} x
   * @param {number} y
   * @param {string} color
   */
  constructor(x, y, color) {
    var self = this;
    self.visible = true;
    self.x = x;
    self.y = y;
    self.color = color ? color : "red";
  }
  Draw(ctx) {
    if (!self.visible) return;
    ctx.fillStyle = self.color;
    ctx.fillRect(self.x - 2, self.y - 2, 5, 5);
  }
}

/**
 * LineShape.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {string} color
 */
export function LineShape(x1, y1, x2, y2, color) {
  var self = this;
  self.visible = true;
  self.p1 = new PointShape(x1, y1);
  self.p2 = new PointShape(x2, y2);
  self.color = color ? color : "yellow";
  self.Draw = function (ctx) {
    if (!self.visible) return;
    // TODO: Make it to a static function to save memory?
    // TODO: Calculate the exact point.
    // Vector of ray (not normalized).
    var vx = self.p2.x - self.p1.x;
    var vy = self.p2.y - self.p1.y;
    // Get angle between points.
    //var angle = Math.atan2(vx, vy);
    var max_len = ctx.canvas.width + ctx.canvas.height;
    //Start, Terminal points instead of p2.
    var sx = self.p1.x - vx * max_len;
    var sy = self.p1.y - vy * max_len;
    var tx = self.p1.x + vx * max_len;
    var ty = self.p1.y + vy * max_len;
    // Draw line.
    ctx.strokeStyle = self.color;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    // Draw control points.
    self.p1.Draw(ctx);
    self.p2.Draw(ctx);
  };
}

/**
 * RayShape.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {string} color
 * @constructor
 */
export function RayShape(x1, y1, x2, y2, color) {
  LineShape.call(this, x1, y1, x2, y2, color);
  var self = this;
  self.Draw = function (ctx) {
    if (!self.visible) return;
    // TODO: Make it to a static function to save memory?
    // TODO: Calculate the exact point.
    // Vector of ray (not normalized).
    var vx = self.p2.x - self.p1.x;
    var vy = self.p2.y - self.p1.y;
    // Get angle between points.
    //var angle = Math.atan2(vx, vy);
    var max_len = ctx.canvas.width + ctx.canvas.height;
    //Terminal points instead of p2.
    var tx = self.p1.x + vx * max_len;
    var ty = self.p1.y + vy * max_len;
    // Draw ray.
    ctx.strokeStyle = self.color;
    ctx.beginPath();
    ctx.moveTo(self.p1.x, self.p1.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    // Draw control points.
    self.p1.Draw(ctx);
    self.p2.Draw(ctx);
  };
}

/**
 * SegmentShape.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {string} color
 * @constructor
 */
export function SegmentShape(x1, y1, x2, y2, color) {
  LineShape.call(this, x1, y1, x2, y2, color);
  var self = this;
  self.Draw = function (ctx) {
    if (!self.visible) return;
    // TODO: Make it to a static function to save memory?
    // Draw segment.
    ctx.strokeStyle = self.color;
    ctx.beginPath();
    ctx.moveTo(self.p1.x, self.p1.y);
    ctx.lineTo(self.p2.x, self.p2.y);
    ctx.stroke();
    // Draw control points.
    self.p1.Draw(ctx);
    self.p2.Draw(ctx);
  };
}

/**
 * CircleShape.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {string} color
 * @constructor
 */
export function CircleShape(x1, y1, x2, y2, color) {
  LineShape.call(this, x1, y1, x2, y2, color);
  var self = this;
  self.Draw = function (ctx) {
    if (!self.visible) return;
    // TODO: Make it to a static function to save memory?
    // Draw circle.
    ctx.strokeStyle = self.color;
    ctx.beginPath();
    var dx = self.p2.x - self.p1.x;
    var dy = self.p2.y - self.p1.y;
    var r = Math.sqrt(dx * dx + dy * dy);
    ctx.arc(self.p1.x, self.p1.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Draw control points.
    self.p1.Draw(ctx);
    self.p2.Draw(ctx);
  };
}