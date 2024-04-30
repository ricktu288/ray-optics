/**
 * The handle created when holding ctrl and click several points.
 * @property {Point} p1 - The position of the handle.
 * @property {Point} p2 - The position of the rotation/scale center.
 * @property {Array<ControlPoint>} controlPoints - The control points bound to the handle.
 * @property {boolean} notDone - Whether the construction of the handle is complete.
 */
objTypes['handle'] = class extends BaseSceneObj {
  static type = 'handle';
  static isOptical = true; // As the handle may bind to objects which are optical, this should be regarded as true.
  static serializableDefaults = {
    p1: null,
    p2: null,
    controlPoints: [],
    notDone: false
  };

  serialize() {
    let jsonObj = super.serialize();

    if (!this.notDone) {
      // Remove some redundent properties in the control points to reduce the size of the JSON.
      jsonObj.controlPoints = jsonObj.controlPoints.map(controlPoint => {
        let controlPointCopy = JSON.parse(JSON.stringify(controlPoint));
        delete controlPointCopy.mousePart.originalObj; // This should be inferred from `scene.objs[controlPoint.targetObj_index]` directly.
        delete controlPointCopy.mousePart.hasDuplicated; // Always false.
        delete controlPointCopy.mousePart.isByHandle; // Always true.
        delete controlPointCopy.mousePart.targetPoint; // The target point is already stored in the newPoint.
        delete controlPointCopy.mousePart.snapContext; // Snapping is not possible with the handle.
        
        return controlPointCopy;
      });
    }

    return jsonObj;
  }

  getZIndex() {
    return -Infinity;
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    for (var i in this.controlPoints) {
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.strokeStyle = this.notDone ? 'cyan' : isHovered ? 'cyan' : ('gray');
      ctx.setLineDash([2, 2]);
      ctx.arc(this.controlPoints[i].newPoint.x, this.controlPoints[i].newPoint.y, 5, 0, Math.PI * 2, false);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (!this.notDone) {
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.strokeStyle = isHovered ? 'cyan' : ('gray');
      ctx.arc(this.p1.x, this.p1.y, 2, 0, Math.PI * 2, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.p1.x, this.p1.y, 5, 0, Math.PI * 2, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.p2.x - 5, this.p2.y);
      ctx.lineTo(this.p2.x + 5, this.p2.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.p2.x, this.p2.y - 5);
      ctx.lineTo(this.p2.x, this.p2.y + 5);
      ctx.stroke();
    }
  }

  move(diffX, diffY) {
    this.p1.x = this.p1.x + diffX;
    this.p1.y = this.p1.y + diffY;
    this.p2.x = this.p2.x + diffX;
    this.p2.y = this.p2.y + diffY;
    for (var i in this.controlPoints) {
      this.controlPoints[i].mousePart.originalObj = this.scene.objs[this.controlPoints[i].targetObj_index].serialize();
      this.controlPoints[i].mousePart.isByHandle = true;
      this.controlPoints[i].mousePart.hasDuplicated = false;
      this.controlPoints[i].mousePart.targetPoint = {x:this.controlPoints[i].newPoint.x, y:this.controlPoints[i].newPoint.y};
      this.controlPoints[i].mousePart.snapContext = {};

      this.controlPoints[i].newPoint.x = this.controlPoints[i].newPoint.x + diffX;
      this.controlPoints[i].newPoint.y = this.controlPoints[i].newPoint.y + diffY;
      this.scene.objs[this.controlPoints[i].targetObj_index].onDrag(new Mouse(JSON.parse(JSON.stringify(this.controlPoints[i].newPoint)), this.scene, false, 2), JSON.parse(JSON.stringify(this.controlPoints[i].mousePart)), false, false);
    }
  }

  checkMouseOver(mouse) {
    let dragContext = {};
    if (this.notDone) return;
    if (mouse.isOnPoint(this.p1)) {
      dragContext.part = 1;
      dragContext.targetPoint_ = geometry.point(this.p1.x, this.p1.y);
      dragContext.mousePos0 = geometry.point(this.p1.x, this.p1.y);
      dragContext.snapContext = {};
      return dragContext;
    }
    if (mouse.isOnPoint(this.p2)) {
      dragContext.part = 2;
      dragContext.targetPoint = geometry.point(this.p2.x, this.p2.y);
      dragContext.mousePos0 = geometry.point(this.p2.x, this.p2.y);
      dragContext.snapContext = {};
      return dragContext;
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    if (this.notDone) return;
    if (shift) {
      var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
    } else {
      var mousePos = mouse.getPosSnappedToGrid();
      dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
    }
    if (dragContext.part == 1) {
      if (ctrl && shift) {
        // Scaling
        var factor = geometry.distance(this.p2, mouse.pos) / geometry.distance(this.p2, dragContext.targetPoint_)
        if (factor < 1e-5) return;
        var center = this.p2;
        var trans = function (p) {
          p.x = (p.x - center.x) * factor + center.x;
          p.y = (p.y - center.y) * factor + center.y;
        };
      } else if (ctrl) {
        // Rotation
        var theta = Math.atan2(this.p2.y - mouse.pos.y, this.p2.x - mouse.pos.x) - Math.atan2(this.p2.y - dragContext.targetPoint_.y, this.p2.x - dragContext.targetPoint_.x);
        var center = this.p2;
        var trans = function (p) {
          var x = p.x - center.x;
          var y = p.y - center.y;
          p.x = Math.cos(theta) * x - Math.sin(theta) * y + center.x;
          p.y = Math.sin(theta) * x + Math.cos(theta) * y + center.y;
        };
      } else {
        // Translation
        var diffX = mousePos.x - dragContext.targetPoint_.x;
        var diffY = mousePos.y - dragContext.targetPoint_.y;
        var trans = function (p) {
          p.x += diffX;
          p.y += diffY;
        };
      }

      // Do the transformation
      trans(this.p1);
      trans(this.p2);
      for (var i in this.controlPoints) {
        this.controlPoints[i].mousePart.originalObj = scene.objs[this.controlPoints[i].targetObj_index].serialize();
        this.controlPoints[i].mousePart.isByHandle = true;
        this.controlPoints[i].mousePart.hasDuplicated = false;
        this.controlPoints[i].mousePart.targetPoint = {x:this.controlPoints[i].newPoint.x, y:this.controlPoints[i].newPoint.y};
        this.controlPoints[i].mousePart.snapContext = {};
        trans(this.controlPoints[i].newPoint);
        this.scene.objs[this.controlPoints[i].targetObj_index].onDrag(new Mouse(JSON.parse(JSON.stringify(this.controlPoints[i].newPoint)), this.scene, false, 2), JSON.parse(JSON.stringify(this.controlPoints[i].mousePart)), false, false);
      }
      dragContext.targetPoint_.x = this.p1.x;
      dragContext.targetPoint_.y = this.p1.y;
    }

    if (dragContext.part == 2) {
      this.p2.x = mousePos.x;
      this.p2.y = mousePos.y;
    }
  }

  /* This typedef will eventually be moved elsewhere. */
  /**
   * @typedef {Object} ControlPoint
   * @property {DragContext} mousePart - The drag context of the virtual mouse that is dragging the control point.
   * @property {Point} newPoint - The new position of the control point.
   */

  /**
   * Add (bind) a control point to the handle.
   * @param {ControlPoint} controlPoint - The control point to be bound.
   */
  addControlPoint(controlPoint) {
    controlPoint.mousePart.originalObj = this.scene.objs[controlPoint.targetObj_index];
    controlPoint.mousePart.isByHandle = true;
    controlPoint.mousePart.hasDuplicated = false;
    controlPoint.newPoint = controlPoint.mousePart.targetPoint;
    controlPoint = JSON.parse(JSON.stringify(controlPoint));
    this.controlPoints.push(controlPoint);
  }

  /**
   * Finish creating the handle.
   * @param {Point} point - The position of the handle.
   */
  finishHandle(point) {
    this.p1 = point;
    var totalX = 0;
    var totalY = 0;
    for (var i in this.controlPoints) {
      totalX += this.controlPoints[i].newPoint.x;
      totalY += this.controlPoints[i].newPoint.y;
    }
    this.p2 = geometry.point(totalX / this.controlPoints.length, totalY / this.controlPoints.length);
    this.notDone = false;
  }
};
