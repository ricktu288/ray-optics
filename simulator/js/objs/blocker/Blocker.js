/**
 * Line blocker / filter.
 * Tools -> Blocker -> Line Blocker
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {boolean} filter - Whether it is a filter.
 * @property {boolean} invert - If true, the ray with wavelength outside the bandwidth is blocked. If false, the ray with wavelength inside the bandwidth is blocked.
 * @property {number} wavelength - The target wavelength if filter is enabled. The unit is nm.
 * @property {number} bandwidth - The bandwidth if filter is enabled. The unit is nm.
 */
objTypes['Blocker'] = class extends LineObjMixin(BaseFilter) {
  static type = 'Blocker';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    filter: false,
    invert: false,
    wavelength: GREEN_WAVELENGTH,
    bandwidth: 10
  };

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;

    if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
      ctx.fillStyle = 'rgb(128,128,128)';
      ctx.fillRect(this.p1.x - 1.5, this.p1.y - 1.5, 3, 3);
      return;
    }

    ctx.strokeStyle = isHovered ? 'cyan' : ((scene.simulateColors && this.wavelength && this.filter) ? wavelengthToColor(this.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(70,35,10)');
    ctx.lineWidth = 3;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  checkRayIntersects(ray) {
    if (this.checkRayIntersectFilter(ray)) {
      return this.checkRayIntersectsShape(ray);
    } else {
      return null;
    }
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    return {
      isAbsorbed: true
    };
  }
};
