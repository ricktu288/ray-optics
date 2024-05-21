/**
 * Line or arrow decoration
 * Tools -> Other -> Line / Arrow
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {boolean} arrow - Whether an arrow is pointing from the first endpoint.
 * @property {boolean} backArrow - Whether an arrow is pointing from the second endpoint.
 */
objTypes['LineArrow'] = class extends LineObjMixin(BaseSceneObj) {
  static type = 'LineArrow';
  static serializableDefaults = {
    p1: null,
    p2: null,
    arrow: false,
    backArrow: false
  };

  populateObjBar(objBar) {
    objBar.createBoolean(getMsg('arrow'), this.arrow, function (obj, value) {
      obj.arrow = value;
    });

    objBar.createBoolean(getMsg('backArrow'), this.backArrow, function (obj, value) {
      obj.backArrow = value;
    });
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    ctx.strokeStyle = isHovered ? 'cyan' : 'white';
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
    if (this.arrow) {
      this.drawArrow(canvasRenderer, this.p1, this.p2);
    }
    if (this.backArrow) {
      this.drawArrow(canvasRenderer, this.p2, this.p1);
    }
  }
  

  /** Utility method */

  drawArrow(canvasRenderer, p1, p2) {
    const ctx = canvasRenderer.ctx;
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const len = 10;
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - len * Math.cos(angle - Math.PI / 6), p2.y - len * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - len * Math.cos(angle + Math.PI / 6), p2.y - len * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }
};