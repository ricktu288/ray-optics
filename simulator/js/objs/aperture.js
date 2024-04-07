// Blocker -> Aperture
objTypes['aperture'] = {

  // Create the obj
  create: function (constructionPoint) {
    return { type: 'aperture', p1: constructionPoint, p2: constructionPoint, p3: constructionPoint, p4: constructionPoint };
  },

  // Mousedown when the obj is being constructed by the user
  onConstructMouseDown: function (obj, constructionPoint, mouse, ctrl, shift) {
    if (shift) {
      obj.p2 = mouse.getPosSnappedToDirection(constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
    }
    else {
      obj.p2 = mouse.getPosSnappedToGrid();
    }

    obj.p3 = geometry.point(obj.p1.x * 0.6 + obj.p2.x * 0.4, obj.p1.y * 0.6 + obj.p2.y * 0.4);
    obj.p4 = geometry.point(obj.p1.x * 0.4 + obj.p2.x * 0.6, obj.p1.y * 0.4 + obj.p2.y * 0.6);

  },

  // Mousemove when the obj is being constructed by the user
  onConstructMouseMove: function (obj, constructionPoint, mouse, ctrl, shift) {
    if (shift) {
      obj.p2 = mouse.getPosSnappedToDirection(constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
    }
    else {
      obj.p2 = mouse.getPosSnappedToGrid();
    }

    obj.p1 = ctrl ? geometry.point(2 * constructionPoint.x - obj.p2.x, 2 * constructionPoint.y - obj.p2.y) : constructionPoint;

    obj.p3 = geometry.point(obj.p1.x * 0.6 + obj.p2.x * 0.4, obj.p1.y * 0.6 + obj.p2.y * 0.4);
    obj.p4 = geometry.point(obj.p1.x * 0.4 + obj.p2.x * 0.6, obj.p1.y * 0.4 + obj.p2.y * 0.6);

    return {
      requiresObjBarUpdate: true
    }
  },
  // Mouseup when the obj is being constructed by the user
  onConstructMouseUp: function (obj, constructionPoint, mouse, ctrl, shift) {
    if (!mouse.isOnPoint(obj.p1)) {
      return {
        isDone: true,
        requiresObjBarUpdate: true
      };
    }
  },

  // Move the object
  move: function (obj, diffX, diffY) {
    // Move the first point
    obj.p1.x = obj.p1.x + diffX;
    obj.p1.y = obj.p1.y + diffY;
    // Move the second point
    obj.p2.x = obj.p2.x + diffX;
    obj.p2.y = obj.p2.y + diffY;

    obj.p3.x = obj.p3.x + diffX;
    obj.p3.y = obj.p3.y + diffY;

    obj.p4.x = obj.p4.x + diffX;
    obj.p4.y = obj.p4.y + diffY;
  },


  // When the drawing area is clicked (test which part of the obj is clicked)
  checkMouseOver: function (obj, mouse) {
    let dragContext = {};


    if (mouse.isOnPoint(obj.p1) && geometry.distanceSquared(mouse.pos, obj.p1) <= geometry.distanceSquared(mouse.pos, obj.p2)) {
      dragContext.part = 1;
      dragContext.targetPoint = geometry.point(obj.p1.x, obj.p1.y);
      return dragContext;
    }
    if (mouse.isOnPoint(obj.p2)) {
      dragContext.part = 2;
      dragContext.targetPoint = geometry.point(obj.p2.x, obj.p2.y);
      return dragContext;
    }
    if (mouse.isOnPoint(obj.p3) && geometry.distanceSquared(mouse.pos, obj.p3) <= geometry.distanceSquared(mouse.pos, obj.p4)) {
      dragContext.part = 3;
      dragContext.targetPoint = geometry.point(obj.p3.x, obj.p3.y);
      dragContext.requiresObjBarUpdate = true;
      return dragContext;
    }
    if (mouse.isOnPoint(obj.p4)) {
      dragContext.part = 4;
      dragContext.targetPoint = geometry.point(obj.p4.x, obj.p4.y);
      dragContext.requiresObjBarUpdate = true;
      return dragContext;
    }

    var segment1 = geometry.line(obj.p1, obj.p3);
    var segment2 = geometry.line(obj.p2, obj.p4);
    if (mouse.isOnSegment(segment1) || mouse.isOnSegment(segment2)) {
      const mousePos = mouse.getPosSnappedToGrid();
      dragContext.part = 0;
      dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
      dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
      dragContext.snapContext = {};
      return dragContext;
    }
  },

  // When the user is dragging the obj
  onDrag: function (obj, mouse, dragContext, ctrl, shift) {
    var basePoint;

    var originalDiameter = geometry.distance(obj.p3, obj.p4);
    if (dragContext.part == 1 || dragContext.part == 2) {
      if (dragContext.part == 1) {
        // Dragging the first endpoint Dragging the first endpoint
        basePoint = ctrl ? geometry.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p2;

        obj.p1 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
        obj.p2 = ctrl ? geometry.point(2 * basePoint.x - obj.p1.x, 2 * basePoint.y - obj.p1.y) : basePoint;
      }
      else {
        // Dragging the second endpoint Dragging the second endpoint
        basePoint = ctrl ? geometry.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p1;

        obj.p2 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
        obj.p1 = ctrl ? geometry.point(2 * basePoint.x - obj.p2.x, 2 * basePoint.y - obj.p2.y) : basePoint;
      }

      var t = 0.5 * (1 - originalDiameter / geometry.distance(obj.p1, obj.p2));
      obj.p3 = geometry.point(obj.p1.x * (1 - t) + obj.p2.x * t, obj.p1.y * (1 - t) + obj.p2.y * t);
      obj.p4 = geometry.point(obj.p1.x * t + obj.p2.x * (1 - t), obj.p1.y * t + obj.p2.y * (1 - t));
    }
    else if (dragContext.part == 3 || dragContext.part == 4) {
      if (dragContext.part == 3) {
        basePoint = geometry.segmentMidpoint(obj);

        obj.p3 = mouse.getPosSnappedToDirection(basePoint, [{ x: (dragContext.originalObj.p4.x - dragContext.originalObj.p3.x), y: (dragContext.originalObj.p4.y - dragContext.originalObj.p3.y) }]);
        obj.p4 = geometry.point(2 * basePoint.x - obj.p3.x, 2 * basePoint.y - obj.p3.y);
      }
      else {
        basePoint = geometry.segmentMidpoint(obj);

        obj.p4 = mouse.getPosSnappedToDirection(basePoint, [{ x: (dragContext.originalObj.p4.x - dragContext.originalObj.p3.x), y: (dragContext.originalObj.p4.y - dragContext.originalObj.p3.y) }]);
        obj.p3 = geometry.point(2 * basePoint.x - obj.p4.x, 2 * basePoint.y - obj.p4.y);
      }
    }
    else if (dragContext.part == 0) {
      // Dragging the entire line

      if (shift) {
        var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }, { x: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y), y: -(dragContext.originalObj.p2.x - dragContext.originalObj.p1.x) }], dragContext.snapContext);
      }
      else {
        var mousePos = mouse.getPosSnappedToGrid();
        dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
      }

      var mouseDiffX = dragContext.mousePos1.x - mousePos.x; // The X difference between the mouse position now and at the previous moment
      var mouseDiffY = dragContext.mousePos1.y - mousePos.y; // The Y difference between the mouse position now and at the previous moment
      // Move the first point
      obj.p1.x = obj.p1.x - mouseDiffX;
      obj.p1.y = obj.p1.y - mouseDiffY;
      // Move the second point
      obj.p2.x = obj.p2.x - mouseDiffX;
      obj.p2.y = obj.p2.y - mouseDiffY;

      obj.p3.x = obj.p3.x - mouseDiffX;
      obj.p3.y = obj.p3.y - mouseDiffY;

      obj.p4.x = obj.p4.x - mouseDiffX;
      obj.p4.y = obj.p4.y - mouseDiffY;

      // Update the mouse position
      dragContext.mousePos1 = mousePos;
    }
  },

  // Draw the obj on canvas
  draw: function (obj, canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    ctx.strokeStyle = isHovered ? 'cyan' : ((scene.colorMode && obj.wavelength && obj.isDichroic) ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(70,35,10)');
    ctx.lineWidth = 3;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p3.x, obj.p3.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(obj.p2.x, obj.p2.y);
    ctx.lineTo(obj.p4.x, obj.p4.y);
    ctx.stroke();
    ctx.lineWidth = 1;
    if (isHovered) {
      ctx.fillStyle = 'magenta';
      ctx.fillRect(obj.p3.x - 1.5, obj.p3.y - 1.5, 3, 3);
      ctx.fillRect(obj.p4.x - 1.5, obj.p4.y - 1.5, 3, 3);
    }
  },

  // Show the property box
  populateObjBar: function (obj, objBar) {
    var originalDiameter = geometry.distance(obj.p3, obj.p4);

    objBar.createNumber(getMsg('diameter'), 0, 100, 1, originalDiameter, function (obj, value) {
      var t = 0.5 * (1 - value / geometry.distance(obj.p1, obj.p2));
      obj.p3 = geometry.point(obj.p1.x * (1 - t) + obj.p2.x * t, obj.p1.y * (1 - t) + obj.p2.y * t);
      obj.p4 = geometry.point(obj.p1.x * t + obj.p2.x * (1 - t), obj.p1.y * t + obj.p2.y * (1 - t));
    });
    dichroicSettings(obj, objBar);
  },

  checkRayIntersects: function (obj, ray) {
    if (wavelengthInteraction(obj, ray)) {
      var segment1 = geometry.line(obj.p1, obj.p3);
      var segment2 = geometry.line(obj.p2, obj.p4);
      var rp_temp1 = objTypes['lineobj'].checkRayIntersects(segment1, ray);
      if (rp_temp1) {
        return rp_temp1;
      }
      var rp_temp2 = objTypes['lineobj'].checkRayIntersects(segment2, ray);
      if (rp_temp2) {
        return rp_temp2;
      }
    }

    return false;
  },

  // When the obj is shot by a ray
  onRayIncident: function (obj, ray, rayIndex, incidentPoint) {
    return {
      isAbsorbed: true
    };
  }

};
