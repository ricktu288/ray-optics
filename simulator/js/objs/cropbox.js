/**
 * The crop box
 * File -> Export as PNG/SVG
 * @property {Point} p1 - The top left corner of the crop box.
 * @property {Point} p2 - The top right corner of the crop box.
 * @property {Point} p3 - The bottom left corner of the crop box.
 * @property {Point} p4 - The bottom right corner of the crop box.
 * @property {string} format - The format of the image to be exported.
 * @property {number} width - The width of the image to be exported. Not effective when the format is 'svg'.
 * @property {number} rayCountLimit - The maximum number of rays to be traced. This is to avoid infinite loop. If not set, the default value is determined by the simulator and depends on `format`. This is only intended for gallery auto-screenshot in the future and currently not shown in the UI.
 */
objTypes['cropbox'] = class extends BaseSceneObj {
  static type = 'cropbox';
  static serializableDefaults = {
    p1: null,
    p4: null,
    format: 'png',
    width: 1920,
    rayCountLimit: null
  };

  constructor(scene, jsonObj) {
    super(scene, jsonObj);

    // Infer `p2` and `p3` from `p1` and `p4`.
    if (this.p1 && this.p4) {
      this.p2 = geometry.point(this.p4.x, this.p1.y);
      this.p3 = geometry.point(this.p1.x, this.p4.y);
    }
  }

  populateObjBar(objBar) {
    var width = geometry.distance(this.p1, this.p2);
    var height = geometry.distance(this.p1, this.p3);

    objBar.createNumber(getMsg('cropbox_size'), 0, 1000, 1, width, function (obj, value) {
      obj.p2 = geometry.point(obj.p1.x + 1 * value, obj.p2.y);
      obj.p4 = geometry.point(obj.p3.x + 1 * value, obj.p4.y);
    }, null, true);
    objBar.createNumber('x', 0, 1000, 1, height, function (obj, value) {
      obj.p3 = geometry.point(obj.p3.x, obj.p1.y + 1 * value);
      obj.p4 = geometry.point(obj.p4.x, obj.p2.y + 1 * value);
    }, null, true);

    objBar.createDropdown(getMsg('image_format'), this.format, {
      'png': 'PNG',
      'svg': 'SVG'
    }, function (obj, value) {
      obj.format = value;
    }, null, true);

    if (this.format != 'svg') {
      objBar.createNumber(getMsg('image_width'), 0, 1000, 1, this.width, function (obj, value) {
        obj.width = 1 * value;
      }, null, true);
    } else {
      objBar.createInfoBox(getMsg('export_svg_popover'));
    }

    objBar.createButton(getMsg('save'), function (obj) {
      confirmCrop(obj);
    });
    objBar.createButton(getMsg('save_cancel'), function (obj) {
      cancelCrop();
    });
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    if (!cropMode) return;

    const ctx = canvasRenderer.ctx;
    ctx.strokeStyle = isHovered ? 'cyan' : 'white';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.lineTo(this.p4.x, this.p4.y);
    ctx.lineTo(this.p3.x, this.p3.y);
    ctx.lineTo(this.p1.x, this.p1.y);
    ctx.stroke();
    ctx.fillStyle = isHovered ? 'cyan' : 'white';
    ctx.beginPath();
    ctx.arc(this.p1.x, this.p1.y, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.p2.x, this.p2.y, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.p3.x, this.p3.y, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.p4.x, this.p4.y, 5, 0, 2 * Math.PI);
    ctx.fill();
  }

  move(diffX, diffY) {
    this.p1.x += diffX;
    this.p1.y += diffY;
    this.p2.x += diffX;
    this.p2.y += diffY;
    this.p3.x += diffX;
    this.p3.y += diffY;
    this.p4.x += diffX;
    this.p4.y += diffY;
  }

  checkMouseOver(mouse) {
    if (!cropMode) return false;
    if (mouse.isOnPoint(this.p1)) {
      return { part: 1, targetPoint: geometry.point(this.p1.x, this.p1.y), cursor: 'nwse-resize', requiresObjBarUpdate: true };
    }
    if (mouse.isOnPoint(this.p2)) {
      return { part: 2, targetPoint: geometry.point(this.p2.x, this.p2.y), cursor: 'nesw-resize', requiresObjBarUpdate: true };
    }
    if (mouse.isOnPoint(this.p3)) {
      return { part: 3, targetPoint: geometry.point(this.p3.x, this.p3.y), cursor: 'nesw-resize', requiresObjBarUpdate: true };
    }
    if (mouse.isOnPoint(this.p4)) {
      return { part: 4, targetPoint: geometry.point(this.p4.x, this.p4.y), cursor: 'nwse-resize', requiresObjBarUpdate: true };
    }
    if (mouse.isOnSegment(geometry.line(this.p1, this.p2))) {
      return { part: 5, cursor: 'ns-resize', requiresObjBarUpdate: true };
    }
    if (mouse.isOnSegment(geometry.line(this.p2, this.p4))) {
      return { part: 6, cursor: 'ew-resize', requiresObjBarUpdate: true };
    }
    if (mouse.isOnSegment(geometry.line(this.p3, this.p4))) {
      return { part: 7, cursor: 'ns-resize', requiresObjBarUpdate: true };
    }
    if (mouse.isOnSegment(geometry.line(this.p1, this.p3))) {
      return { part: 8, cursor: 'ew-resize', requiresObjBarUpdate: true };
    }
    const mousePos = mouse.getPosSnappedToGrid();
    if (this.p1.x < mousePos.x && mousePos.x < this.p2.x && this.p1.y < mousePos.y && mousePos.y < this.p3.y) {
      return { part: 0, mousePos0: mousePos, mousePos1: mousePos, snapContext: {} };
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();
    if (dragContext.part == 1) {
      this.p1.x = mousePos.x;
      this.p1.y = mousePos.y;
      this.p2.y = mousePos.y;
      this.p3.x = mousePos.x;
    } else if (dragContext.part == 2) {
      this.p2.x = mousePos.x;
      this.p2.y = mousePos.y;
      this.p1.y = mousePos.y;
      this.p4.x = mousePos.x;
    } else if (dragContext.part == 3) {
      this.p3.x = mousePos.x;
      this.p3.y = mousePos.y;
      this.p1.x = mousePos.x;
      this.p4.y = mousePos.y;
    } else if (dragContext.part == 4) {
      this.p4.x = mousePos.x;
      this.p4.y = mousePos.y;
      this.p2.x = mousePos.x;
      this.p3.y = mousePos.y;
    } else if (dragContext.part == 5) {
      this.p1.y = mousePos.y;
      this.p2.y = mousePos.y;
    } else if (dragContext.part == 6) {
      this.p2.x = mousePos.x;
      this.p4.x = mousePos.x;
    } else if (dragContext.part == 7) {
      this.p3.y = mousePos.y;
      this.p4.y = mousePos.y;
    } else if (dragContext.part == 8) {
      this.p1.x = mousePos.x;
      this.p3.x = mousePos.x;
    } else if (dragContext.part == 0) {
      const mousePosSnapped = shift ? mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext) : mouse.getPosSnappedToGrid();
      const mouseDiffX = dragContext.mousePos1.x - mousePosSnapped.x;
      const mouseDiffY = dragContext.mousePos1.y - mousePosSnapped.y;
      this.p1.x -= mouseDiffX;
      this.p1.y -= mouseDiffY;
      this.p2.x -= mouseDiffX;
      this.p2.y -= mouseDiffY;
      this.p3.x -= mouseDiffX;
      this.p3.y -= mouseDiffY;
      this.p4.x -= mouseDiffX;
      this.p4.y -= mouseDiffY;
      dragContext.mousePos1 = mousePosSnapped;
    }
  }
};
