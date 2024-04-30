/**
 * Text label
 * Tools -> Other -> Text
 * @property {number} x - The x coordinate.
 * @property {number} y - The y coordinate.
 * @property {string} p - The text content.
 * @property {number} fontSize - The font size in CSS pixels.
 * @property {string} fontName - The font name.
 * @property {string} fontStyle - The font style.
 * @property {string} fontAlignment - The font alignment.
 * @property {boolean} fontSmallCaps - Whether the text is in small caps.
 * @property {number} fontAngle - The angle of the text in degrees.
 */
objTypes['text'] = class extends BaseSceneObj {
  static type = 'text';
  static serializableDefaults = {
    x: null,
    y: null,
    p: '',
    fontSize: 24,
    fontName: 'Serif',
    fontStyle: 'Normal',
    fontAlignment: 'left',
    fontSmallCaps: false,
    fontAngle: 0
  };

  // generic list of web safe fonts
  static fonts = [
    'Serif',
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Georgia',
    'Courier New',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Impact',
    'Lucida Sans'
  ];

  static fontStyles = {
    'Normal': getMsg('normal'),
    'Bold': getMsg('bold'),
    'Italic': getMsg('italic'),
    'Bold Italic': getMsg('bolditalic'),
    'Oblique': getMsg('oblique'),
    'Bold Oblique': getMsg('boldoblique')
  };

  static fontAlignments = {
    'left': getMsg('left'),
    'center': getMsg('center'),
    'right': getMsg('right')
  };

  populateObjBar(objBar) {
    objBar.createText('', this.p, function (obj, value) {
      obj.p = value;
    });

    if (objBar.showAdvanced(!this.arePropertiesDefault(['fontSize']))) {
      objBar.createNumber(getMsg('fontsize'), 6, 96, 1, this.fontSize, function (obj, value) {
        obj.fontSize = value;
      }, null, true);
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['fontName']))) {
      objBar.createDropdown(getMsg('fontname'), this.fontName, this.constructor.fonts, function (obj, value) {
        obj.fontName = value;
      });
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['fontStyle']))) {
      objBar.createDropdown(getMsg('fontstyle'), this.fontStyle, this.constructor.fontStyles, function (obj, value) {
        obj.fontStyle = value;
      });
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['fontAlignment']))) {
      objBar.createDropdown(getMsg('fontalignment'), this.fontAlignment, this.constructor.fontAlignments, function (obj, value) {
        obj.fontAlignment = value;
      });
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['fontSmallCaps']))) {
      objBar.createBoolean(getMsg('smallcaps'), this.fontSmallCaps, function (obj, value) {
        obj.fontSmallCaps = value;
      });
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['fontAngle']))) {
      objBar.createNumber(getMsg('angle'), 0, 360, 1, this.fontAngle, function (obj, value) {
        obj.fontAngle = value;
      }, null, true);
    }
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    ctx.fillStyle = isHovered ? 'cyan' : ('white');
    ctx.textAlign = this.fontAlignment;
    ctx.textBaseline = 'bottom';

    let fontName = '';
    if (this.fontStyle && this.fontStyle != 'Normal') fontName += this.fontStyle + ' ';
    if (this.fontSmallCaps) fontName += 'small-caps '
    fontName += this.fontSize + 'px ' + this.fontName;
    ctx.font = fontName;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(-this.fontAngle / 180 * Math.PI);
    let y_offset = 0;
    this.left = 0;
    this.right = 0;
    this.up = 0;
    this.down = 0;
    this.p.split('\n').forEach(line => {
      ctx.fillText(line, 0, y_offset);
      let lineDimensions = ctx.measureText(line);
      this.left = Math.max(this.left, lineDimensions.actualBoundingBoxLeft);
      this.right = Math.max(this.right, lineDimensions.actualBoundingBoxRight);
      this.up = Math.max(this.up, lineDimensions.actualBoundingBoxAscent - y_offset);
      this.down = Math.max(this.down, -lineDimensions.actualBoundingBoxDescent + y_offset);
      if (lineDimensions.fontBoundingBoxAscent) {
        y_offset += lineDimensions.fontBoundingBoxAscent + lineDimensions.fontBoundingBoxDescent;
      } else {
        y_offset += this.fontSize * 1.5;
      }
    });
    ctx.restore();
    // precompute triganometry for faster calculations in 'clicked' function
    this.sin_angle = Math.sin(this.fontAngle / 180 * Math.PI);
    this.cos_angle = Math.cos(this.fontAngle / 180 * Math.PI);
  }

  move(diffX, diffY) {
    this.x = this.x + diffX;
    this.y = this.y + diffY;
  }
  
  onConstructMouseDown(mouse, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();
    this.x = mousePos.x;
    this.y = mousePos.y;
    this.p = getMsg('text_here');
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    return {
      isDone: true
    };
  }

  checkMouseOver(mouse) {
    let dragContext = {};

    // translate and rotate the mouse point into the text's reference frame for easy comparison
    let relativeMouseX = mouse.pos.x - this.x
    let relativeMouseY = mouse.pos.y - this.y
    let rotatedMouseX = relativeMouseX * this.cos_angle - relativeMouseY * this.sin_angle;
    let rotatedMouseY = relativeMouseY * this.cos_angle + relativeMouseX * this.sin_angle;
    if (rotatedMouseX >= -this.left && rotatedMouseX <= this.right &&
      rotatedMouseY <= this.down && rotatedMouseY >= -this.up) {
      dragContext.part = 0;
      dragContext.mousePos0 = geometry.point(mouse.pos.x, mouse.pos.y);
      dragContext.mousePos0Snapped = mouse.getPosSnappedToGrid();
      dragContext.targetPoint_ = geometry.point(this.x, this.y); // Avoid setting 'targetPoint' (otherwise the xybox will appear and move the text to incorrect coordinates).
      dragContext.snapContext = {};
      return dragContext;
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    if (shift) {
      var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
    } else {
      var mousePos = mouse.getPosSnappedToGrid();
      dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
    }

    // 'dragContext.targetPoint_' object placement position (bottom left)
    // 'dragContext.mousePos0' is coordiates of where the drag started, not snapped
    // 'dragContext.mousePos0Snapped' is coordiates of where the drag started, snapped to grid
    // new location  =  current location (snapped)  +  object placement location  -  where drag started (snapped)
    this.x = mousePos.x + dragContext.targetPoint_.x - dragContext.mousePos0Snapped.x;
    this.y = mousePos.y + dragContext.targetPoint_.y - dragContext.mousePos0Snapped.y;
  }
};