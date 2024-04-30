/**
 * 360 degree point source
 * Tools -> Light Source -> Point source (360deg)
 * @property {number} x - The x coordinate of the point source.
 * @property {number} y - The y coordinate of the point source.
 * @property {number} p - The brightness of the point source.
 * @property {number} wavelength - The wavelength of the light emitted by the point source in nm. Only effective in color mode.
 */
objTypes['radiant'] = class extends BaseSceneObj {
  static type = 'radiant';
  static isOptical = true;
  static serializableDefaults = {
    x: null,
    y: null,
    p: 0.5,
    wavelength: GREEN_WAVELENGTH
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
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    ctx.fillStyle = this.scene.colorMode ? wavelengthToColor(this.wavelength, 1) : isHovered ? 'cyan' : ('rgb(0,255,0)');
    ctx.fillRect(this.x - 2.5, this.y - 2.5, 5, 5);
    if (this.scene.colorMode) {
      ctx.fillStyle = isHovered ? 'cyan' : ('rgb(255,255,255)');
      ctx.fillRect(this.x - 1.5, this.y - 1.5, 3, 3);
    }
  }

  move(diffX, diffY) {
    this.x += diffX;
    this.y += diffY;
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();
    this.x = mousePos.x;
    this.y = mousePos.y;
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    return {
      isDone: true
    };
  }

  checkMouseOver(mouse) {
    let dragContext = {};
    if (mouse.isOnPoint(this)) {
      dragContext.part = 0;
      dragContext.targetPoint = geometry.point(this.x, this.y);
      dragContext.snapContext = {};
      return dragContext;
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    if (shift) {
      var mousePos = mouse.getPosSnappedToDirection(dragContext.targetPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
    } else {
      var mousePos = mouse.getPosSnappedToGrid();
      dragContext.snapContext = {};
    }

    this.x = mousePos.x;
    this.y = mousePos.y;
  }

  onSimulationStart() {
    let newRays = [];

    var s = Math.PI * 2 / parseInt(this.scene.rayDensity * 500);
    var i0 = (this.scene.mode == 'observer') ? (-s * 2 + 1e-6) : 0;
    for (var i = i0; i < (Math.PI * 2 - 1e-5); i = i + s) {
      var ray1 = geometry.line(geometry.point(this.x, this.y), geometry.point(this.x + Math.sin(i), this.y + Math.cos(i)));
      ray1.brightness_s = Math.min(this.p / this.scene.rayDensity, 1) * 0.5;
      ray1.brightness_p = Math.min(this.p / this.scene.rayDensity, 1) * 0.5;
      ray1.isNew = true;
      if (this.scene.colorMode) {
        ray1.wavelength = this.wavelength;
      }
      if (i == i0) {
        ray1.gap = true;
      }
      newRays.push(ray1);
    }

    return {
      newRays: newRays
    };
  }
};
