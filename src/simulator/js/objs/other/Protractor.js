import { BaseSceneObj } from '../BaseSceneObj.js';
import { CircleObjMixin } from '../CircleObjMixin.js';

/**
 * The protractor tool
 * 
 * Tools -> Other -> Protractor
 * @property {Point} p1 - The center of the protractor.
 * @property {Point} p2 - The zero point on the protractor.
 */
export class Protractor extends CircleObjMixin(BaseSceneObj) {
  static type = 'Protractor';
  static serializableDefaults = {
    p1: null,
    p2: null
  };

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    if (!isAboveLight) {
      ctx.globalCompositeOperation = 'lighter';
      var r = Math.sqrt((this.p2.x - this.p1.x) * (this.p2.x - this.p1.x) + (this.p2.y - this.p1.y) * (this.p2.y - this.p1.y));
      var scale_width_limit = 5 * ls;

      var scale_step = 1;
      var scale_step_mid = 5;
      var scale_step_long = 10;
      var scale_len = 10 * ls;
      var scale_len_mid = 15 * ls;
      var scale_len_long = 20 * ls;

      ctx.strokeStyle = isHovered ? 'cyan' : ('rgb(128,128,128)');
      ctx.font = 'bold ' + (14 * ls) + 'px Arial';
      ctx.fillStyle = 'rgb(128,128,128)';

      if (r * scale_step * Math.PI / 180 < scale_width_limit) {
        // The scale is too small
        scale_step = 2;
        scale_step_mid = 10;
        scale_step_long = 30;
      }
      if (r * scale_step * Math.PI / 180 < scale_width_limit) {
        // The scale is too small
        scale_step = 5;
        scale_step_mid = 10;
        scale_step_long = 30;
        scale_len = 5 * ls;
        scale_len_mid = 8 * ls;
        scale_len_long = 10 * ls;
        ctx.font = 'bold ' + (10 * ls) + 'px Arial';
      }
      if (r * scale_step * Math.PI / 180 < scale_width_limit) {
        // The scale is too small
        scale_step = 10;
        scale_step_mid = 30;
        scale_step_long = 90;
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      ctx.lineWidth = 1 * ls;

      ctx.beginPath();
      ctx.arc(this.p1.x, this.p1.y, r, 0, Math.PI * 2, false);

      var ang, x, y;
      for (var i = 0; i < 360; i += scale_step) {
        ang = i * Math.PI / 180 + Math.atan2(this.p2.y - this.p1.y, this.p2.x - this.p1.x);
        ctx.moveTo(this.p1.x + r * Math.cos(ang), this.p1.y + r * Math.sin(ang));
        if (i % scale_step_long == 0) {
          x = this.p1.x + (r - scale_len_long) * Math.cos(ang);
          y = this.p1.y + (r - scale_len_long) * Math.sin(ang);
          ctx.lineTo(x, y);
          if (canvasRenderer.isSVG) ctx.stroke();
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(ang + Math.PI * 0.5);
          ctx.fillText((i > 180) ? (360 - i) : i, 0, 0);
          ctx.restore();
        } else if (i % scale_step_mid == 0) {
          ctx.lineTo(this.p1.x + (r - scale_len_mid) * Math.cos(ang), this.p1.y + (r - scale_len_mid) * Math.sin(ang));
        } else {
          ctx.lineTo(this.p1.x + (r - scale_len) * Math.cos(ang), this.p1.y + (r - scale_len) * Math.sin(ang));
        }
      }
      ctx.stroke();

      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = 'red';
    ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
    if (isHovered) {
      ctx.fillStyle = 'magenta';
      ctx.fillRect(this.p2.x - 2.5 * ls, this.p2.y - 2.5 * ls, 5 * ls, 5 * ls);
    }
  }
};
