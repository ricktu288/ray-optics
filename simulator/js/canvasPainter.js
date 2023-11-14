class CanvasPainter {
  constructor(ctx, origin, scale, backgroundImage) {
      this.ctx = ctx;
      this.origin = origin;
      this.scale = scale;
      this.canvas = ctx.canvas;
      this.backgroundImage = backgroundImage;
  }

  /**
  * Draw a geometric figure from graph.js
  * @method draw
  * @param {graph} graph
  * @param {String} [color='black']
  **/
  draw(graph, color = 'black') {
      // point
      if (graph.type == 1) {
          this.ctx.fillStyle = color;
          this.ctx.fillRect(graph.x - 2.5, graph.y - 2.5, 5, 5);
      }
      // line
      else if (graph.type == 2) {
          this.ctx.strokeStyle = color;
          this.ctx.beginPath();
          let ang1 = Math.atan2((graph.p2.x - graph.p1.x), (graph.p2.y - graph.p1.y));
          let cvsLimit = (Math.abs(graph.p1.x + this.origin.x) + Math.abs(graph.p1.y + this.origin.y) + this.canvas.height + this.canvas.width) / Math.min(1, this.scale);
          this.ctx.moveTo(graph.p1.x - Math.sin(ang1) * cvsLimit, graph.p1.y - Math.cos(ang1) * cvsLimit);
          this.ctx.lineTo(graph.p1.x + Math.sin(ang1) * cvsLimit, graph.p1.y + Math.cos(ang1) * cvsLimit);
          this.ctx.stroke();
      }
      // ray
      else if (graph.type == 3) {
          this.ctx.strokeStyle = color;
          let ang1, cvsLimit;
          if (Math.abs(graph.p2.x - graph.p1.x) > 1e-5 || Math.abs(graph.p2.y - graph.p1.y) > 1e-5) {
              this.ctx.beginPath();
              ang1 = Math.atan2((graph.p2.x - graph.p1.x), (graph.p2.y - graph.p1.y));
              cvsLimit = (Math.abs(graph.p1.x + this.origin.x) + Math.abs(graph.p1.y + this.origin.y) + this.canvas.height + this.canvas.width) / Math.min(1, this.scale);
              this.ctx.moveTo(graph.p1.x, graph.p1.y);
              this.ctx.lineTo(graph.p1.x + Math.sin(ang1) * cvsLimit, graph.p1.y + Math.cos(ang1) * cvsLimit);
              this.ctx.stroke();
          }
      }
      // (line_)segment
      else if (graph.type == 4) {
          this.ctx.strokeStyle = color;
          this.ctx.beginPath();
          this.ctx.moveTo(graph.p1.x, graph.p1.y);
          this.ctx.lineTo(graph.p2.x, graph.p2.y);
          this.ctx.stroke();
      }
      // circle
      else if (graph.type == 5) {
          this.ctx.strokeStyle = color;
          this.ctx.beginPath();
          if (typeof graph.r === 'object') {
              let dx = graph.r.p1.x - graph.r.p2.x;
              let dy = graph.r.p1.y - graph.r.p2.y;
              this.ctx.arc(graph.c.x, graph.c.y, Math.sqrt(dx * dx + dy * dy), 0, Math.PI * 2, false);
          } else {
              this.ctx.arc(graph.c.x, graph.c.y, graph.r, 0, Math.PI * 2, false);
          }
          this.ctx.stroke();
      }
  }

  /**
  * Clean the canvas
  * @method cls
  **/
  cls() {
    console.log([this.scale, 0, 0, this.scale, this.origin.x, this.origin.y])
      if (this.ctx.constructor !== C2S) {
          // only do this when not being exported to SVG to avoid bug
          this.ctx.setTransform(1, 0, 0, 1, 0, 0);
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          this.ctx.setTransform(this.scale, 0, 0, this.scale, this.origin.x, this.origin.y);
          if (this.backgroundImage) {
              this.ctx.globalAlpha = 1;
              this.ctx.drawImage(this.backgroundImage, 0, 0);
          }
      }
  }
}
