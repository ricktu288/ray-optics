// TODO: Change to real singleton.
export class Painter {
  /**
   * Singleton class for rendering on canvas.
   * @param  {CanvasRenderingContext2D} ctx
   * @param  {number} width
   * @param  {number} height
   */
  constructor(ctx, width, height) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.objs = [];
  }
  Draw() {
    // Settings draw.
    // TODO: Draw current Settings.
    // View draw.
    // TODO: Draw current View.
    this.ctx.clearRect(0, 0, this.width, this.height);
    // Draw objects.
    for (var i = 0; i < this.objs.length; i++) {
      this.objs[i].Draw(this.ctx);
    }
    this.ctx.restore();
  }
  Reset() {
    this.objs = [];
    this.Draw();
  }
}