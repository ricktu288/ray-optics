/**
 * Beam splitter.
 * Tools -> Mirror -> Beam splitter
 * @property {Point} p1 - The first endpoint.
 * @property {Point} p2 - The second endpoint.
 * @property {number} transRatio - The transmission ratio.
 * @property {boolean} filter - Whether it is a dichroic beam splitter.
 * @property {boolean} invert - If true, the ray with wavelength outside the bandwidth interacts with the beam splitter. If false, the ray with wavelength inside the bandwidth interacts with the beam splitter.
 * @property {number} wavelength - The target wavelength if dichroic is enabled. The unit is nm.
 * @property {number} bandwidth - The bandwidth if dichroic is enabled. The unit is nm.
 */
objTypes['BeamSplitter'] = class extends LineObjMixin(BaseFilter) {
  static type = 'BeamSplitter';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    transRatio: 0.5,
    filter: false,
    invert: false,
    wavelength: Simulator.GREEN_WAVELENGTH,
    bandwidth: 10
  };

  populateObjBar(objBar) {
    objBar.createNumber(getMsg('transRatio'), 0, 1, 0.01, this.transRatio, function (obj, value) {
      obj.transRatio = value;
    });

    super.populateObjBar(objBar);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    if (this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
      ctx.fillStyle = 'rgb(128,128,128)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      return;
    }
    
    ctx.strokeStyle = isHovered ? 'cyan' : ('rgb(100,100,168)');
    ctx.lineWidth = 1 * ls;
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
    ctx.strokeStyle = isHovered ? 'cyan' : ((scene.simulateColors && this.wavelength && this.filter) ? Simulator.wavelengthToColor(this.wavelength || Simulator.GREEN_WAVELENGTH, 1) : 'rgb(100,100,168)');
    ctx.setLineDash([15 * ls, 15 * ls]);
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
    ctx.setLineDash([]);
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

    ray.p1 = incidentPoint;
    var mx = this.p2.x - this.p1.x;
    var my = this.p2.y - this.p1.y;
    ray.p2 = geometry.point(incidentPoint.x + rx * (my * my - mx * mx) - 2 * ry * mx * my, incidentPoint.y + ry * (mx * mx - my * my) - 2 * rx * mx * my);
    var ray2 = geometry.line(incidentPoint, geometry.point(incidentPoint.x - rx, incidentPoint.y - ry));
    var transmission = this.transRatio;
    ray2.brightness_s = transmission * ray.brightness_s;
    ray2.brightness_p = transmission * ray.brightness_p;
    ray2.wavelength = ray.wavelength;
    ray.brightness_s *= (1 - transmission);
    ray.brightness_p *= (1 - transmission);
    if (ray2.brightness_s + ray2.brightness_p > .01) {
      return {
        newRays: [ray2]
      };
    } else {
      return {
        truncation: ray2.brightness_s + ray2.brightness_p
      };
    }
  }
};
