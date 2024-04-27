/**
 * A single ray of light.
 * Tools -> Light source -> Single ray
 * @property {Point} p1 - The start point of the ray.
 * @property {Point} p2 - Another point on the ray.
 * @property {number} p - The brightness of the ray.
 * @property {number} wavelength - The wavelength of the ray in nm. Only effective in color mode.
 */
objTypes['laser'] = class extends LineObjMixin(BaseSceneObj) {
  static type = 'laser';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    p: 1,
    wavelength: GREEN_WAVELENGTH
  };

  populateObjBar(objBar) {
    objBar.createNumber(getMsg('brightness'), 0.01, 1, 0.01, this.p, function (obj, value) {
      obj.p = value;
    });
    if (this.scene.colorMode) {
      objBar.createNumber(getMsg('wavelength'), UV_WAVELENGTH, INFRARED_WAVELENGTH, 1, this.wavelength, function (obj, value) {
        obj.wavelength = value;
      });
    }
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    ctx.fillStyle = isHovered ? 'cyan' : (this.scene.colorMode ? wavelengthToColor(this.wavelength, 1) : 'rgb(255,0,0)');
    ctx.fillRect(this.p1.x - 2.5, this.p1.y - 2.5, 5, 5);
    ctx.fillStyle = isHovered ? 'cyan' : ('rgb(255,0,0)');
    ctx.fillRect(this.p2.x - 1.5, this.p2.y - 1.5, 3, 3);
  }

  onSimulationStart() {
    var ray1 = geometry.line(this.p1, this.p2);
    ray1.brightness_s = 0.5 * this.p;
    ray1.brightness_p = 0.5 * this.p;
    if (this.scene.colorMode) {
      ray1.wavelength = this.wavelength;
    }
    ray1.gap = true;
    ray1.isNew = true;
    return {
      newRays: [ray1]
    };
  }
};
