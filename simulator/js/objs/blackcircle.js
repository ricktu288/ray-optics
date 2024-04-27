/**
 * Circle blocker / filter.
 * Tools -> Blocker -> Circle Blocker
 * @property {Point} p1 - The center of the circle.
 * @property {Point} p2 - A point on the circle.
 * @property {boolean} isDichroic - Whether it is a filter.
 * @property {boolean} isDichroicFilter - If true, the ray with wavelength outside the bandwidth is blocked. If false, the ray with wavelength inside the bandwidth is blocked.
 * @property {number} wavelength - The target wavelength if filter is enabled. The unit is nm.
 * @property {number} bandwidth - The bandwidth if filter is enabled. The unit is nm.
 */
objTypes['blackcircle'] = class extends CircleObjMixin(BaseFilter) {
  static type = 'blackcircle';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    isDichroic: false,
    isDichroicFilter: false,
    wavelength: GREEN_WAVELENGTH,
    bandwidth: 10
  };

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    ctx.beginPath();
    ctx.arc(this.p1.x, this.p1.y, geometry.segmentLength(this), 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = isHovered ? 'cyan' : ((scene.colorMode && this.wavelength && this.isDichroic) ? wavelengthToColor(this.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(70,35,10)');
    //ctx.fillStyle="indigo";

    ctx.stroke();
    ctx.fillStyle = 'red';
    ctx.fillRect(this.p1.x - 1.5, this.p1.y - 1.5, 3, 3);

    ctx.lineWidth = 1;
    if (isHovered) {
      ctx.fillStyle = 'magenta';
      ctx.fillRect(this.p2.x - 1.5, this.p2.y - 1.5, 3, 3);
    }
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
