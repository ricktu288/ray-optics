import { BaseFilter } from '../BaseFilter.js';
import { getMsg } from '../../translations.js';
import { Simulator } from '../../Simulator.js';
import { geometry } from '../../geometry.js';

/**
 * Aperture / filter with a hole.
 * 
 * Tools -> Blocker -> Aperture
 * @class
 * @extends BaseFilter
 * @alias rayOptics.sceneObjs.Aperture
 * @property {Point} p1 - The first endpoint of the aperture.
 * @property {Point} p2 - The second endpoint of the aperture.
 * @property {Point} p3 - The first endpoint of the hole.
 * @property {Point} p4 - The second endpoint of the hole.
 * @property {boolean} filter - Whether it is a filter.
 * @property {boolean} invert - If true, the ray with wavelength outside the bandwidth is blocked. If false, the ray with wavelength inside the bandwidth is blocked.
 * @property {number} wavelength - The target wavelength if filter is enabled. The unit is nm.
 * @property {number} bandwidth - The bandwidth if filter is enabled. The unit is nm.
 */
export class Aperture extends BaseFilter {
  static type = 'Aperture';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    p3: null,
    p4: null,
    filter: false,
    invert: false,
    wavelength: Simulator.GREEN_WAVELENGTH,
    bandwidth: 10
  };

  populateObjBar(objBar) {
    var originalDiameter = geometry.distance(this.p3, this.p4);

    objBar.createNumber(getMsg('diameter'), 0, 100 * this.scene.lengthScale, 1 * this.scene.lengthScale, originalDiameter, function (obj, value) {
      var t = 0.5 * (1 - value / geometry.distance(obj.p1, obj.p2));
      obj.p3 = geometry.point(obj.p1.x * (1 - t) + obj.p2.x * t, obj.p1.y * (1 - t) + obj.p2.y * t);
      obj.p4 = geometry.point(obj.p1.x * t + obj.p2.x * (1 - t), obj.p1.y * t + obj.p2.y * (1 - t));
    }, getMsg('length_unit_popover'));

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
    
    ctx.strokeStyle = isHovered ? 'cyan' : ((this.scene.simulateColors && this.wavelength && this.filter) ? Simulator.wavelengthToColor(this.wavelength || Simulator.GREEN_WAVELENGTH, 1) : 'rgb(70,35,10)');
    ctx.lineWidth = 3 * ls;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p3.x, this.p3.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(this.p2.x, this.p2.y);
    ctx.lineTo(this.p4.x, this.p4.y);
    ctx.stroke();
    ctx.lineWidth = 1 * ls;
    if (isHovered) {
      ctx.fillStyle = 'magenta';
      ctx.fillRect(this.p3.x - 1.5 * ls, this.p3.y - 1.5 * ls, 3 * ls, 3 * ls);
      ctx.fillRect(this.p4.x - 1.5 * ls, this.p4.y - 1.5 * ls, 3 * ls, 3 * ls);
    }
  }

  move(diffX, diffY) {
    this.p1.x = this.p1.x + diffX;
    this.p1.y = this.p1.y + diffY;
    this.p2.x = this.p2.x + diffX;
    this.p2.y = this.p2.y + diffY;
    this.p3.x = this.p3.x + diffX;
    this.p3.y = this.p3.y + diffY;
    this.p4.x = this.p4.x + diffX;
    this.p4.y = this.p4.y + diffY;
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    if (!this.constructionPoint) {
      // Initialize the construction stage.
      this.constructionPoint = mouse.getPosSnappedToGrid();
      this.p1 = this.constructionPoint;
      this.p2 = this.constructionPoint;
    }

    if (shift) {
      this.p2 = mouse.getPosSnappedToDirection(this.p1, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
    } else {
      this.p2 = mouse.getPosSnappedToGrid();
    }

    this.p3 = geometry.point(this.p1.x * 0.6 + this.p2.x * 0.4, this.p1.y * 0.6 + this.p2.y * 0.4);
    this.p4 = geometry.point(this.p1.x * 0.4 + this.p2.x * 0.6, this.p1.y * 0.4 + this.p2.y * 0.6);
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    if (shift) {
      this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
    } else {
      this.p2 = mouse.getPosSnappedToGrid();
    }

    this.p1 = ctrl ? geometry.point(2 * this.constructionPoint.x - this.p2.x, 2 * this.constructionPoint.y - this.p2.y) : this.constructionPoint;

    this.p3 = geometry.point(this.p1.x * 0.6 + this.p2.x * 0.4, this.p1.y * 0.6 + this.p2.y * 0.4);
    this.p4 = geometry.point(this.p1.x * 0.4 + this.p2.x * 0.6, this.p1.y * 0.4 + this.p2.y * 0.6);

    return {
      requiresObjBarUpdate: true
    }
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    if (!mouse.isOnPoint(this.p1)) {
      delete this.constructionPoint;
      return {
        isDone: true,
        requiresObjBarUpdate: true
      };
    }
  }

  checkMouseOver(mouse) {
    if (mouse.isOnPoint(this.p1) && geometry.distanceSquared(mouse.pos, this.p1) <= geometry.distanceSquared(mouse.pos, this.p2)) {
      return {
        part: 1,
        targetPoint: geometry.point(this.p1.x, this.p1.y)
      };
    }
    if (mouse.isOnPoint(this.p2)) {
      return {
        part: 2,
        targetPoint: geometry.point(this.p2.x, this.p2.y)
      };
    }
    if (mouse.isOnPoint(this.p3) && geometry.distanceSquared(mouse.pos, this.p3) <= geometry.distanceSquared(mouse.pos, this.p4)) {
      return {
        part: 3,
        targetPoint: geometry.point(this.p3.x, this.p3.y),
        requiresObjBarUpdate: true
      };
    }
    if (mouse.isOnPoint(this.p4)) {
      return {
        part: 4,
        targetPoint: geometry.point(this.p4.x, this.p4.y),
        requiresObjBarUpdate: true
      };
    }

    var segment1 = geometry.line(this.p1, this.p3);
    var segment2 = geometry.line(this.p2, this.p4);
    if (mouse.isOnSegment(segment1) || mouse.isOnSegment(segment2)) {
      const mousePos = mouse.getPosSnappedToGrid();
      return {
        part: 0,
        mousePos0: mousePos,
        mousePos1: mousePos,
        snapContext: {}
      };
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    var basePoint;

    var originalDiameter = geometry.distance(this.p3, this.p4);
    if (dragContext.part == 1 || dragContext.part == 2) {
      if (dragContext.part == 1) {
        // Dragging the first endpoint Dragging the first endpoint
        basePoint = ctrl ? geometry.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p2;

        this.p1 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
        this.p2 = ctrl ? geometry.point(2 * basePoint.x - this.p1.x, 2 * basePoint.y - this.p1.y) : basePoint;
      } else {
        // Dragging the second endpoint Dragging the second endpoint
        basePoint = ctrl ? geometry.segmentMidpoint(dragContext.originalObj) : dragContext.originalObj.p1;

        this.p2 = shift ? mouse.getPosSnappedToDirection(basePoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }]) : mouse.getPosSnappedToGrid();
        this.p1 = ctrl ? geometry.point(2 * basePoint.x - this.p2.x, 2 * basePoint.y - this.p2.y) : basePoint;
      }

      var t = 0.5 * (1 - originalDiameter / geometry.distance(this.p1, this.p2));
      this.p3 = geometry.point(this.p1.x * (1 - t) + this.p2.x * t, this.p1.y * (1 - t) + this.p2.y * t);
      this.p4 = geometry.point(this.p1.x * t + this.p2.x * (1 - t), this.p1.y * t + this.p2.y * (1 - t));
    } else if (dragContext.part == 3 || dragContext.part == 4) {
      if (dragContext.part == 3) {
        basePoint = geometry.segmentMidpoint(this);

        this.p3 = mouse.getPosSnappedToDirection(basePoint, [{ x: (dragContext.originalObj.p4.x - dragContext.originalObj.p3.x), y: (dragContext.originalObj.p4.y - dragContext.originalObj.p3.y) }]);
        this.p4 = geometry.point(2 * basePoint.x - this.p3.x, 2 * basePoint.y - this.p3.y);
      } else {
        basePoint = geometry.segmentMidpoint(this);

        this.p4 = mouse.getPosSnappedToDirection(basePoint, [{ x: (dragContext.originalObj.p4.x - dragContext.originalObj.p3.x), y: (dragContext.originalObj.p4.y - dragContext.originalObj.p3.y) }]);
        this.p3 = geometry.point(2 * basePoint.x - this.p4.x, 2 * basePoint.y - this.p4.y);
      }
    } else if (dragContext.part == 0) {
      // Dragging the entire line

      if (shift) {
        var mousePos = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: (dragContext.originalObj.p2.x - dragContext.originalObj.p1.x), y: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y) }, { x: (dragContext.originalObj.p2.y - dragContext.originalObj.p1.y), y: -(dragContext.originalObj.p2.x - dragContext.originalObj.p1.x) }], dragContext.snapContext);
      } else {
        var mousePos = mouse.getPosSnappedToGrid();
        dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
      }

      var mouseDiffX = dragContext.mousePos1.x - mousePos.x; // The X difference between the mouse position now and at the previous moment
      var mouseDiffY = dragContext.mousePos1.y - mousePos.y; // The Y difference between the mouse position now and at the previous moment
      // Move the first point
      this.p1.x = this.p1.x - mouseDiffX;
      this.p1.y = this.p1.y - mouseDiffY;
      // Move the second point
      this.p2.x = this.p2.x - mouseDiffX;
      this.p2.y = this.p2.y - mouseDiffY;

      this.p3.x = this.p3.x - mouseDiffX;
      this.p3.y = this.p3.y - mouseDiffY;

      this.p4.x = this.p4.x - mouseDiffX;
      this.p4.y = this.p4.y - mouseDiffY;

      // Update the mouse position
      dragContext.mousePos1 = mousePos;
    }
  }

  checkRayIntersects(ray) {
    if (this.checkRayIntersectFilter(ray)) {
      var segment1 = geometry.line(this.p1, this.p3);
      var segment2 = geometry.line(this.p2, this.p4);

      var rp_temp1 = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), segment1);
      if (geometry.intersectionIsOnSegment(rp_temp1, segment1) && geometry.intersectionIsOnRay(rp_temp1, ray)) {
        return rp_temp1;
      }

      var rp_temp2 = geometry.linesIntersection(geometry.line(ray.p1, ray.p2), segment2);
      if (geometry.intersectionIsOnSegment(rp_temp2, segment2) && geometry.intersectionIsOnRay(rp_temp2, ray)) {
        return rp_temp2;
      }
    }

    return null;
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    return {
      isAbsorbed: true
    };
  }
};
