/**
 * A class to render geometric figures from geometry.js on a canvas, and to handle the transformation and background image of the canvas.
 */
class CanvasRenderer {
  constructor(ctx, origin, scale, backgroundImage) {

    /** @property {Object} ctx - The context of the canvas. */
    this.ctx = ctx;

    /** @property {Object} origin - The origin of the scene in the viewport. */
    this.origin = origin;

    /** @property {number} scale - The scale factor (the viewport physical pixel per internal length unit) of the scene. */
    this.scale = scale;

    /** @property {Object} canvas - The canvas of the scene. */
    this.canvas = ctx.canvas;

    /** @property {Object|null} backgroundImage - The background image of the scene, null if not set. */
    this.backgroundImage = backgroundImage;

    /** @property {boolean} isSVG - Whether the canvas is being exported to SVG. */
    this.isSVG = ctx.constructor === C2S;
  }
  
  /**
   * Draw a point.
   * @param {Point} p
   * @param {String} [color='black']
   */
  drawPoint(p, color = 'black') {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
  }

  /**
   * Draw a line.
   * @param {Line} l
   * @param {String} [color='black']
   */
  drawLine(l, color = 'black') {
    this.ctx.strokeStyle = color;
    this.ctx.beginPath();
    let ang1 = Math.atan2((l.p2.x - l.p1.x), (l.p2.y - l.p1.y));
    let cvsLimit = (Math.abs(l.p1.x + this.origin.x) + Math.abs(l.p1.y + this.origin.y) + this.canvas.height + this.canvas.width) / Math.min(1, this.scale);
    this.ctx.moveTo(l.p1.x - Math.sin(ang1) * cvsLimit, l.p1.y - Math.cos(ang1) * cvsLimit);
    this.ctx.lineTo(l.p1.x + Math.sin(ang1) * cvsLimit, l.p1.y + Math.cos(ang1) * cvsLimit);
    this.ctx.stroke();
  }

  /**
   * Draw a ray.
   * @param {Line} r
   * @param {String} [color='black']
   */
  drawRay(r, color = 'black') {
    this.ctx.strokeStyle = color;
    let ang1, cvsLimit;
    if (Math.abs(r.p2.x - r.p1.x) > 1e-5 || Math.abs(r.p2.y - r.p1.y) > 1e-5) {
      this.ctx.beginPath();
      ang1 = Math.atan2((r.p2.x - r.p1.x), (r.p2.y - r.p1.y));
      cvsLimit = (Math.abs(r.p1.x + this.origin.x) + Math.abs(r.p1.y + this.origin.y) + this.canvas.height + this.canvas.width) / Math.min(1, this.scale);
      this.ctx.moveTo(r.p1.x, r.p1.y);
      this.ctx.lineTo(r.p1.x + Math.sin(ang1) * cvsLimit, r.p1.y + Math.cos(ang1) * cvsLimit);
      this.ctx.stroke();
    }
  }

  /**
   * Draw a segment.
   * @param {Line} s
   * @param {String} [color='black']
   */
  drawSegment(s, color = 'black') {
    this.ctx.strokeStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(s.p1.x, s.p1.y);
    this.ctx.lineTo(s.p2.x, s.p2.y);
    this.ctx.stroke();
  }

  /**
   * Draw a circle.
   * @param {Circle} c
   * @param {String} [color='black']
   */
  drawCircle(c, color = 'black') {
    this.ctx.strokeStyle = color;
    this.ctx.beginPath();
    if (typeof c.r === 'object') {
      let dx = c.r.p1.x - c.r.p2.x;
      let dy = c.r.p1.y - c.r.p2.y;
      this.ctx.arc(c.c.x, c.c.y, Math.sqrt(dx * dx + dy * dy), 0, Math.PI * 2, false);
    } else {
      this.ctx.arc(c.c.x, c.c.y, c.r, 0, Math.PI * 2, false);
    }
    this.ctx.stroke();
  }

  /**
  * Clear the canvas, and draw the background image if there is one.
  **/
  clear() {
    //console.log([this.scale, 0, 0, this.scale, this.origin.x, this.origin.y])
    if (this.ctx.constructor !== C2S) {
      // only do this when not being exported to SVG to avoid bug
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.setTransform(this.scale, 0, 0, this.scale, this.origin.x, this.origin.y);
      if (this.ctx.constructor !== C2S && this.backgroundImage) {
        this.ctx.globalAlpha = 1;
        this.ctx.drawImage(this.backgroundImage, 0, 0);
      }
    }
  }
}
