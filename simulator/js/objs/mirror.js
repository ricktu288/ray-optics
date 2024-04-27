/**
 * Mirror with shape of a line segment.
 * Tools -> Mirror -> Segment
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {boolean} isDichroic - Whether it is a dichroic mirror.
 * @property {boolean} isDichroicFilter - If true, the ray with wavelength outside the bandwidth is reflected. If false, the ray with wavelength inside the bandwidth is reflected.
 * @property {number} wavelength - The target wavelength if dichroic is enabled. The unit is nm.
 * @property {number} bandwidth - The bandwidth if dichroic is enabled. The unit is nm.
 */
objTypes['mirror'] = class extends LineObjMixin(BaseFilter) {
  static type = 'mirror';
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
    ctx.strokeStyle = isHovered ? 'cyan' : ((scene.colorMode && this.wavelength && this.isDichroic) ? wavelengthToColor(this.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(168,168,168)');
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
  }

  checkRayIntersects(ray) {
    if (this.checkRayIntersectFilter(ray)) {
      return this.checkRayIntersectsShape(ray);
    } else {
      return null;
    }
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    var rx = ray.p1.x - incidentPoint.x;
    var ry = ray.p1.y - incidentPoint.y;
    var mx = this.p2.x - this.p1.x;
    var my = this.p2.y - this.p1.y;

    ray.p1 = incidentPoint;
    ray.p2 = geometry.point(incidentPoint.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, incidentPoint.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
  }
};
