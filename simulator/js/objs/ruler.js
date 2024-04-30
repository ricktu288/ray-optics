/**
 * The ruler tool
 * Tools -> Other -> Ruler
 * @property {Point} p1 - The first endpoint of the line segment.
 * @property {Point} p2 - The second endpoint of the line segment.
 * @property {number} p - The scale interval of the ruler.
 */
objTypes['ruler'] = class extends LineObjMixin(BaseSceneObj) {
  static type = 'ruler';
  static serializableDefaults = {
    p1: null,
    p2: null,
    p: 10
  };

  populateObjBar(objBar) {
    objBar.createNumber(getMsg('ruler_scale'), 0, 10, 1, this.p, function (obj, value) {
      obj.p = value;
    }, null, true);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    if (isAboveLight) return;

    const ctx = canvasRenderer.ctx;
    ctx.globalCompositeOperation = 'lighter';
    var len = Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
    var par_x = (this.p2.x - this.p1.x) / len;
    var par_y = (this.p2.y - this.p1.y) / len;
    var per_x = par_y;
    var per_y = -par_x;
    var ang = Math.atan2(this.p2.y - this.p1.y, this.p2.x - this.p1.x);

    var scale_step = this.p;
    var scale_step_mid = scale_step * 5;
    var scale_step_long = scale_step * 10;
    var scale_len = 10;
    var scale_len_mid = 15;

    ctx.strokeStyle = isHovered ? 'cyan' : ('rgb(128,128,128)');
    ctx.font = '14px Arial';
    ctx.fillStyle = 'rgb(128,128,128)';
    if (ang > Math.PI * (-0.25) && ang <= Math.PI * 0.25) {
      //↘~↗
      var scale_direction = -1;
      var scale_len_long = 20;
      var text_ang = ang;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
    } else if (ang > Math.PI * (-0.75) && ang <= Math.PI * (-0.25)) {
      //↗~↖
      var scale_direction = 1;
      var scale_len_long = 15;
      var text_ang = ang - Math.PI * (-0.5);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
    } else if (ang > Math.PI * 0.75 || ang <= Math.PI * (-0.75)) {
      //↖~↙
      var scale_direction = 1;
      var scale_len_long = 20;
      var text_ang = ang - Math.PI;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
    } else {
      //↙~↘
      var scale_direction = -1;
      var scale_len_long = 15;
      var text_ang = ang - Math.PI * 0.5;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
    }

    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    var x, y;
    for (var i = 0; i <= len; i += scale_step) {
      ctx.moveTo(this.p1.x + i * par_x, this.p1.y + i * par_y);
      if (i % scale_step_long == 0) {
        x = this.p1.x + i * par_x + scale_direction * scale_len_long * per_x;
        y = this.p1.y + i * par_y + scale_direction * scale_len_long * per_y;
        ctx.lineTo(x, y);
        if (canvasRenderer.isSVG) ctx.stroke();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(text_ang);
        ctx.fillText(i, 0, 0);
        ctx.restore();
      } else if (i % scale_step_mid == 0) {
        ctx.lineTo(this.p1.x + i * par_x + scale_direction * scale_len_mid * per_x, this.p1.y + i * par_y + scale_direction * scale_len_mid * per_y);
      } else {
        ctx.lineTo(this.p1.x + i * par_x + scale_direction * scale_len * per_x, this.p1.y + i * par_y + scale_direction * scale_len * per_y);
      }
    }
    ctx.stroke();

    ctx.globalCompositeOperation = 'source-over';
  }
};
