/**
 * A parallel or divergent beam of light.
 * Tools -> Light source -> beam
 * @property {Point} p1 - The first endpoint of the segment perpendicular to the beam.
 * @property {Point} p2 - The second endpoint of the segment perpendicular to the beam.
 * @property {number} p - The brightness of the beam.
 * @property {number} wavelength - The wavelength of the beam in nm. Only effective in color mode.
 * @property {number} divergence - The angle of divergence in degrees.
 * @property {boolean} lambert - Whether the beam is Lambertian.
 * @property {boolean} random - Whether the beam is random.
 * @property {Array<number>} randomNumbers - Random numbers used for random beam.
 */
objTypes['parallel'] = class extends LineObjMixin(BaseSceneObj) {
  static type = 'parallel';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    p: 0.5,
    wavelength: GREEN_WAVELENGTH,
    divergence: 0.0,
    lambert: false,
    random: false
  };

  populateObjBar(objBar) {
    objBar.createNumber(getMsg('brightness'), 0.01, 1, 0.01, this.p, function (obj, value) {
      obj.p = value;
    }, getMsg('brightness_note_popover'));
    if (this.scene.colorMode) {
      objBar.createNumber(getMsg('wavelength'), UV_WAVELENGTH, INFRARED_WAVELENGTH, 1, this.wavelength, function (obj, value) {
        obj.wavelength = value;
      });
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['divergence', 'lambert', 'random']))) {
      objBar.createNumber(getMsg('emissionangle'), 0, 180, 1, this.divergence, function (obj, value) {
        obj.divergence = value;
      });
      objBar.createBoolean(getMsg('lambertian'), this.lambert, function (obj, value) {
        obj.lambert = value;
      });
      objBar.createBoolean(getMsg('random'), this.random, function (obj, value) {
        obj.random = value;
      });
      if (this.scene.mode == 'images' || this.scene.mode == 'observer') {
        objBar.createNote(getMsg('beam_warning'));
      }
    }
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    var a_l = Math.atan2(this.p1.x - this.p2.x, this.p1.y - this.p2.y) - Math.PI / 2;
    ctx.strokeStyle = isHovered ? 'cyan' : (this.scene.colorMode ? wavelengthToColor(this.wavelength, 1) : 'rgb(0,255,0)');
    ctx.lineWidth = 4;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(this.p1.x + Math.sin(a_l) * 2, this.p1.y + Math.cos(a_l) * 2);
    ctx.lineTo(this.p2.x + Math.sin(a_l) * 2, this.p2.y + Math.cos(a_l) * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(128,128,128,255)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
  }

  onSimulationStart() {
    var n = geometry.segmentLength(this) * this.scene.rayDensity;
    var stepX = (this.p2.x - this.p1.x) / n;
    var stepY = (this.p2.y - this.p1.y) / n;
    var s = Math.PI * 2 / parseInt(this.scene.rayDensity * 500);
    var sizeX = (this.p2.x - this.p1.x);
    var sizeY = (this.p2.y - this.p1.y);
    var normal = Math.atan2(stepX, stepY) + Math.PI / 2.0;
    var halfAngle = this.divergence / 180.0 * Math.PI * 0.5;
    var numnAngledRays = 1.0 + Math.floor(halfAngle / s) * 2.0;
    var rayBrightness = 1.0 / numnAngledRays;
    this.initRandom();

    let newRays = [];

    if (!this.random) {
      for (var i = 0.5; i <= n; i++) {
        var x = this.p1.x + i * stepX;
        var y = this.p1.y + i * stepY;
        newRays.push(this.newRay(x, y, normal, 0.0, i == 0, rayBrightness));
        for (var angle = s; angle < halfAngle; angle += s) {
          newRays.push(this.newRay(x, y, normal, angle, i == 0, rayBrightness));
          newRays.push(this.newRay(x, y, normal, -angle, i == 0, rayBrightness));
        }
      }
    } else {
      for (var i = 0; i < n * numnAngledRays; i++) {
        const position = this.getRandom(i * 2);
        const angle = this.getRandom(i * 2 + 1);
        newRays.push(this.newRay(
          this.p1.x + position * sizeX,
          this.p1.y + position * sizeY,
          normal,
          (angle * 2 - 1) * halfAngle,
          i == 0,
          rayBrightness));
      }
    }

    return {
      newRays: newRays
    };
  }


  /** Utility methods */

  initRandom() {
    if (this.randomNumbers == undefined || !this.random) {
      this.clearRandom();
    }
  }

  clearRandom() {
    this.randomNumbers = [];
  }

  getRandom(i) {
    for (let j = this.randomNumbers.length; j <= i; j++) {
      this.randomNumbers.push(Math.random());
    }
    return this.randomNumbers[i];
  }

  newRay(x, y, normal, angle, gap, brightness_factor = 1.0) {
    var ray1 = geometry.line(geometry.point(x, y), geometry.point(x + Math.sin(normal + angle), y + Math.cos(normal + angle)));
    ray1.brightness_s = Math.min(this.p / this.scene.rayDensity * brightness_factor, 1) * 0.5;
    ray1.brightness_p = Math.min(this.p / this.scene.rayDensity * brightness_factor, 1) * 0.5;
    if (this.lambert) {
      const lambert = Math.cos(angle)
      ray1.brightness_s *= lambert;
      ray1.brightness_p *= lambert;
    }
    ray1.isNew = true;
    if (this.scene.colorMode) {
      ray1.wavelength = this.wavelength;
    }
    ray1.gap = gap;

    return ray1;
  }
};
