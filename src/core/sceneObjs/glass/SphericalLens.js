/*
 * Copyright 2024 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Glass from './Glass.js';
import geometry from '../../geometry.js';
import i18next from 'i18next';

/**
 * Spherical lens.
 * 
 * Tools -> Glass -> Spherical Lens
 * 
 * It is essentially a special case of `sceneObjs['Glass']` that has the shape of a lens, but it provides a more user-friendly interface to create a lens using more familliar parameters.
 * In the state where the lens is built, it behaves exactly like `sceneObjs['Glass']`, and `p1`, `p2`, and `parames` are null. But when the lens is not built (which happens when the user enters a set of invalid parameters, or if the JSON data is defined using parameters directly), it is defined using `p1`, `p2`, and `params`, and `path` is null.
 * @class
 * @extends sceneObjs.Glass
 * @memberof sceneObjs
 * @property {Array<object>} path - The path of the lens if it is built.
 * @property {string} defBy - The way the lens is defined. Either 'DR1R2' or 'DFfdBfd'.
 * @property {Point} p1 - The intersection of the perpendicular bisector of the segment for the `d` parameter with the top edge of the lens, if it is not built.
 * @property {Point} p2 - The intersection of the perpendicular bisector of the segment for the `d` parameter with the bottom edge of the lens, if it is not built.
 * @property {object} params - The parameters of the lens if it is not built. It has the following properties: `d`, `r1`, and `r2` if `defBy` is 'DR1R2', and `d`, `ffd`, and `bfd` if `defBy` is 'DFfdBfd'.
 * @property {number} refIndex - The refractive index of the glass, or the Cauchy coefficient A of the glass if "Simulate Colors" is on.
 * @property {number} cauchyB - The Cauchy coefficient B of the glass if "Simulate Colors" is on, in micrometer squared.
 */
class SphericalLens extends Glass {
  static type = 'SphericalLens';
  static isOptical = true;
  static mergesWithGlass = true;
  static serializableDefaults = {
    path: null,
    defBy: 'DR1R2',
    p1: null,
    p2: null,
    params: null,
    refIndex: 1.5,
    cauchyB: 0.004
  };

  constructor(scene, jsonObj) {
    super(scene, jsonObj);

    if (!this.path && this.p1 && this.p2) {
      // If the lens is not built in the JSON data, build the lens here.
      if (this.defBy == 'DR1R2') {
        this.createLensWithDR1R2(this.params.d, this.params.r1, this.params.r2);
      } else if (this.defBy == 'DFfdBfd') {
        this.createLensWithDFfdBfd(this.params.d, this.params.ffd, this.params.bfd);
      }
    }
  }

  populateObjBar(objBar) {
    objBar.setTitle(i18next.t('main:tools.SphericalLens.title'));
    objBar.createDropdown('', this.defBy, {
      'DR1R2': i18next.t('simulator:sceneObjs.SphericalLens.defBy.radiiOfCurvature'),
      'DFfdBfd': i18next.t('simulator:sceneObjs.SphericalLens.defBy.focalDistances')
    }, function (obj, value) {
      obj.defBy = value;
    }, null, true);

    if (this.defBy == 'DR1R2') {
      var params = this.getDR1R2();
      var r1 = params.r1;
      var r2 = params.r2;
      var d = params.d;

      objBar.createNumber('R<sub>1</sub>', 0, 100, 1, r1, function (obj, value) {
        var params = obj.getDR1R2();
        var r2 = params.r2;
        var d = params.d;
        obj.createLensWithDR1R2(d, value, r2);
      }, null, true);
      objBar.createNumber('R<sub>2</sub>', 0, 100, 1, r2, function (obj, value) {
        var params = obj.getDR1R2();
        var r1 = params.r1;
        var d = params.d;
        obj.createLensWithDR1R2(d, r1, value);
      }, null, true);
      objBar.createNumber('d', 0, 100, 1, d, function (obj, value) {
        var params = obj.getDR1R2();
        var r1 = params.r1;
        var r2 = params.r2;
        obj.createLensWithDR1R2(value, r1, r2);
      }, null, true);
    } else if (this.defBy == 'DFfdBfd') {
      objBar.createInfoBox('<img src="../img/FFD_BFD.svg" width=100%>');

      var params = this.getDFfdBfd();
      var d = params.d;
      var ffd = params.ffd;
      var bfd = params.bfd;

      objBar.createNumber('FFD', 0, 100, 1, ffd, function (obj, value) {
        var params = obj.getDFfdBfd();
        var d = params.d;
        var bfd = params.bfd;
        obj.createLensWithDFfdBfd(d, value, bfd);
      }, null, true);
      objBar.createNumber('BFD', 0, 100, 1, bfd, function (obj, value) {
        var params = obj.getDFfdBfd();
        var d = params.d;
        var ffd = params.ffd;
        obj.createLensWithDFfdBfd(d, ffd, value);
      }, null, true);
      objBar.createNumber('d', 0, 100, 1, d, function (obj, value) {
        var params = obj.getDFfdBfd();
        var ffd = params.ffd;
        var bfd = params.bfd;
        obj.createLensWithDFfdBfd(value, ffd, bfd);
      }, null, true);
    }

    if (this.scene.simulateColors) {
      objBar.createNumber(i18next.t('simulator:sceneObjs.BaseGlass.cauchyCoeff') + " A", 1, 3, 0.01, this.refIndex, function (obj, value) {
        var old_params = obj.getDFfdBfd();
        obj.refIndex = value * 1;
        if (obj.defBy == 'DFfdBfd') {
          // If the lens is defined by d,ffd,bfd, we need to rebuild the lens with the new refractive index so that the focal distances are correct.
          obj.createLensWithDFfdBfd(old_params.d, old_params.ffd, old_params.bfd);
        }
      }, '<p>*' + i18next.t('simulator:sceneObjs.BaseGlass.refIndexInfo.relative') + '</p><p>' + i18next.t('simulator:sceneObjs.BaseGlass.refIndexInfo.effective') + '</p>');
      objBar.createNumber("B(μm²)", 0.0001, 0.02, 0.0001, this.cauchyB, function (obj, value) {
        var old_params = obj.getDFfdBfd();
        obj.cauchyB = value;
        if (obj.defBy == 'DFfdBfd') {
          // If the lens is defined by d,ffd,bfd, we need to rebuild the lens with the new refractive index so that the focal distances are correct.
          obj.createLensWithDFfdBfd(old_params.d, old_params.ffd, old_params.bfd);
        }
      });
    } else {
      objBar.createNumber(i18next.t('simulator:sceneObjs.BaseGlass.refIndex') + '*', 0.5, 2.5, 0.01, this.refIndex, function (obj, value) {
        var old_params = obj.getDFfdBfd();
        obj.refIndex = value * 1;
        if (obj.defBy == 'DFfdBfd') {
          // If the lens is defined by d,ffd,bfd, we need to rebuild the lens with the new refractive index so that the focal distances are correct.
          obj.createLensWithDFfdBfd(old_params.d, old_params.ffd, old_params.bfd);
        }
      }, '<p>*' + i18next.t('simulator:sceneObjs.BaseGlass.refIndexInfo.relative') + '</p><p>' + i18next.t('simulator:sceneObjs.BaseGlass.refIndexInfo.effective') + '</p>');
    }
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

    if (this.p1 && this.p2 && this.p1.x == this.p2.x && this.p1.y == this.p2.y) {
      ctx.fillStyle = 'rgb(128,128,128)';
      ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
      return;
    }

    if (!this.path) {
      if (this.p1 && this.p2) {
        ctx.fillStyle = 'rgb(255,0,0)';
        ctx.fillRect(this.p1.x - 1.5 * ls, this.p1.y - 1.5 * ls, 3 * ls, 3 * ls);
        ctx.fillRect(this.p2.x - 1.5 * ls, this.p2.y - 1.5 * ls, 3 * ls, 3 * ls);
      }
      return;
    }
    super.draw(canvasRenderer, isAboveLight, isHovered);

    var p1 = geometry.midpoint(this.path[0], this.path[1]);
    var p2 = geometry.midpoint(this.path[3], this.path[4]);
    var len = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    var dx = (p2.x - p1.x) / len;
    var dy = (p2.y - p1.y) / len;
    var dpx = dy;
    var dpy = -dx;

    if (isHovered) {
      // Draw the focal points

      var params = this.getDFfdBfd();
      var ffd = params.ffd;
      var bfd = params.bfd;

      ctx.fillStyle = 'rgb(255,0,255)';
      ctx.fillRect(this.path[2].x + bfd * dpx - 1.5 * ls, this.path[2].y + bfd * dpy - 1.5 * ls, 3 * ls, 3 * ls);
      ctx.fillRect(this.path[5].x - ffd * dpx - 1.5 * ls, this.path[5].y - ffd * dpy - 1.5 * ls, 3 * ls, 3 * ls);
    }
  }

  move(diffX, diffY) {
    if (this.path) {
      super.move(diffX, diffY);
    } else if (this.p1 && this.p2) {
      this.p1.x += diffX;
      this.p1.y += diffY;
      this.p2.x += diffX;
      this.p2.y += diffY;
    }
    return true;
  }

  rotate(angle, center = null) {
    if (this.path) {
      return super.rotate(angle, center);
    }
    return false;
  }

  scale(scale, center = null) {
    if (this.path) {
      return super.scale(scale, center);
    }
    return false;
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    if (!this.constructionPoint) {
      // Initialize the construction stage.
      this.constructionPoint = mouse.getPosSnappedToGrid();
      this.p1 = this.constructionPoint;
      this.p2 = this.constructionPoint;
      this.path = null;
      this.params = null;
    }
    if (shift) {
      this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
    } else {
      this.p2 = mouse.getPosSnappedToGrid();
    }

    this.createLens();

    return {
      requiresObjBarUpdate: true
    }
  }

  onConstructMouseMove(mouse, ctrl, shift) {
    if (shift) {
      this.p2 = mouse.getPosSnappedToDirection(this.constructionPoint, [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }]);
    } else {
      this.p2 = mouse.getPosSnappedToGrid();
    }

    this.p1 = ctrl ? geometry.point(2 * this.constructionPoint.x - this.p2.x, 2 * this.constructionPoint.y - this.p2.y) : this.constructionPoint;

    this.createLens();

    return {
      requiresObjBarUpdate: true
    }
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    if (!mouse.snapsOnPoint(this.p1)) {
      this.p1 = null;
      this.p2 = null;
      this.params = null;
      delete this.constructionPoint;
      return {
        isDone: true,
        requiresObjBarUpdate: true
      };
    }
  }
  
  onConstructUndo() {
    return {
      isCancelled: true
    }
  }

  checkMouseOver(mouse) {
    let dragContext = {};
    if (!this.path) {
      if (this.p1 && this.p2) {
        if (mouse.isOnPoint(this.p1)) {
          dragContext.part = -1;
          dragContext.targetPoint = this.p1;
          return dragContext;
        }
        if (mouse.isOnPoint(this.p2)) {
          dragContext.part = -1;
          dragContext.targetPoint = this.p2;
          return dragContext;
        }
      }
      return null;
    };
    dragContext = super.checkMouseOver(mouse);
    if (dragContext) {
      if (dragContext.part != 0) {
        dragContext.requiresObjBarUpdate = true;
      }
      
      return dragContext;
    }
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    if (dragContext.part == -1) return;
    var p1 = geometry.midpoint(this.path[0], this.path[1]);
    var p2 = geometry.midpoint(this.path[3], this.path[4]);
    var len = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    var dx = (p2.x - p1.x) / len;
    var dy = (p2.y - p1.y) / len;
    var dpx = dy;
    var dpy = -dx;
    var cx = (p1.x + p2.x) * .5;
    var cy = (p1.y + p2.y) * .5;
    var othick = Math.hypot(this.path[0].x - p1.x, this.path[0].y - p1.y);
    var cthick2 = Math.hypot(this.path[2].x - cx, this.path[2].y - cy);
    var cthick5 = Math.hypot(this.path[5].x - cx, this.path[5].y - cy);
    var oldx, oldy;
    if (dragContext.part == 1) {
      oldx = this.path[dragContext.index].x;
      oldy = this.path[dragContext.index].y;
    }

    super.onDrag(mouse, dragContext, ctrl, shift);

    if (dragContext.isByHandle) return;
    if (dragContext.part != 1)
      return;
    const mousePos = mouse.getPosSnappedToGrid();
    if (dragContext.index == 2 || dragContext.index == 5) {
      // keep center points on optical axis
      var off = (mousePos.x - cx) * dpx + (mousePos.y - cy) * dpy;
      this.path[dragContext.index] = { x: cx + dpx * off, y: cy + dpy * off, arc: true };
    } else {
      var thick = Math.abs(((mousePos.x - cx) * dpx + (mousePos.y - cy) * dpy));
      // adjust center thickness to match so curvature is the same
      cthick2 += thick - othick;
      cthick5 += thick - othick;
      var mpt = this.path[dragContext.index];
      var lchange = (mpt.x - oldx) * dx + (mpt.y - oldy) * dy;
      // adjust length
      if (dragContext.index < 2) {
        p1.x += lchange * dx;
        p1.y += lchange * dy;
      } else {
        p2.x += lchange * dx;
        p2.y += lchange * dy;
      }

      len = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      dx = (p2.x - p1.x) / len;
      dy = (p2.y - p1.y) / len;
      dpx = dy;
      dpy = -dx;
      cx = (p1.x + p2.x) * .5;
      cy = (p1.y + p2.y) * .5;

      // recreate lens
      this.path[0] = { x: p1.x - dpx * thick, y: p1.y - dpy * thick, arc: false };
      this.path[1] = { x: p1.x + dpx * thick, y: p1.y + dpy * thick, arc: false };
      this.path[2] = { x: cx + dpx * cthick2, y: cy + dpy * cthick2, arc: true };
      this.path[3] = { x: p2.x + dpx * thick, y: p2.y + dpy * thick, arc: false };
      this.path[4] = { x: p2.x - dpx * thick, y: p2.y - dpy * thick, arc: false };
      this.path[5] = { x: cx - dpx * cthick5, y: cy - dpy * cthick5, arc: true };
    }
  }

  checkRayIntersects(ray) {
    if (!this.path) return false;
    return super.checkRayIntersects(ray);
  }

  /* Utility methods */


  createLens() {
    var p1 = this.p1 || geometry.midpoint(this.path[0], this.path[1]);
    var p2 = this.p2 || geometry.midpoint(this.path[3], this.path[4]);
    var len = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    var dx = (p2.x - p1.x) / len;
    var dy = (p2.y - p1.y) / len;
    var dpx = dy;
    var dpy = -dx;
    var cx = (p1.x + p2.x) * .5;
    var cy = (p1.y + p2.y) * .5;
    const thick = 10 * this.scene.lengthScale;
    // create lens
    if (!this.path) this.path = [];
    this.path[0] = { x: p1.x - dpx * thick, y: p1.y - dpy * thick, arc: false };
    this.path[1] = { x: p1.x + dpx * thick, y: p1.y + dpy * thick, arc: false };
    this.path[2] = { x: cx + dpx * thick * 2, y: cy + dpy * thick * 2, arc: true };
    this.path[3] = { x: p2.x + dpx * thick, y: p2.y + dpy * thick, arc: false };
    this.path[4] = { x: p2.x - dpx * thick, y: p2.y - dpy * thick, arc: false };
    this.path[5] = { x: cx - dpx * thick * 2, y: cy - dpy * thick * 2, arc: true };
  }

  createLensWithDR1R2(d, r1, r2) {
    this.error = null;

    if (!this.path) {
      var p1 = this.p1;
      var p2 = this.p2;
    } else {
      var old_params = this.getDR1R2();
      var p1 = geometry.midpoint(this.path[0], this.path[1]);
      var p2 = geometry.midpoint(this.path[3], this.path[4]);
      var old_d = old_params.d;
      var old_r1 = old_params.r1;
      var old_r2 = old_params.r2;
      var old_length = Math.hypot(p1.x - p2.x, p1.y - p2.y);

      if (old_r1 < Infinity && old_r1 > -Infinity) {
        var old_curveShift1 = old_r1 - Math.sqrt(old_r1 * old_r1 - old_length * old_length / 4) * Math.sign(old_r1);
      } else {
        var old_curveShift1 = 0;
      }

      if (old_r2 < Infinity && old_r2 > -Infinity) {
        var old_curveShift2 = old_r2 - Math.sqrt(old_r2 * old_r2 - old_length * old_length / 4) * Math.sign(old_r2);
      } else {
        var old_curveShift2 = 0;
      }

      var old_edgeShift1 = old_d / 2 - old_curveShift1;
      var old_edgeShift2 = old_d / 2 + old_curveShift2;
    }

    var len = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    var dx = (p2.x - p1.x) / len;
    var dy = (p2.y - p1.y) / len;
    var dpx = dy;
    var dpy = -dx;

    if (old_params) {
      // Correct p1 and p2 so that this.path[2] and this.path[5] will move symmetrically from the old lens.
      var correction = (old_edgeShift1 - old_edgeShift2) / 2;
      p1.x += dpx * correction;
      p1.y += dpy * correction;
      p2.x += dpx * correction;
      p2.y += dpy * correction;
    }



    var cx = (p1.x + p2.x) * .5;
    var cy = (p1.y + p2.y) * .5;


    if (r1 < Infinity && r1 > -Infinity) {
      var curveShift1 = r1 - Math.sqrt(r1 * r1 - len * len / 4) * Math.sign(r1);
    } else {
      var curveShift1 = 0;
    }

    if (r2 < Infinity && r2 > -Infinity) {
      var curveShift2 = r2 - Math.sqrt(r2 * r2 - len * len / 4) * Math.sign(r2);
    } else {
      var curveShift2 = 0;
    }

    var edgeShift1 = d / 2 - curveShift1;
    var edgeShift2 = d / 2 + curveShift2;

    //console.log([edgeShift1,edgeShift2,d])

    if (isNaN(curveShift1) || isNaN(curveShift2)) {
      // invalid lens. Store the parameters so we can restore them later.
      this.p1 = p1;
      this.p2 = p2;
      this.path = null;
      this.params = { r1: r1, r2: r2, d: d };
      this.error = i18next.t('simulator:sceneObjs.SphericalLens.invalidParameters');
    } else {
      // create lens
      if (!this.path) this.path = [];
      this.path[0] = { x: p1.x - dpx * edgeShift1, y: p1.y - dpy * edgeShift1, arc: false };
      this.path[1] = { x: p1.x + dpx * edgeShift2, y: p1.y + dpy * edgeShift2, arc: false };
      this.path[2] = { x: cx + dpx * (d / 2), y: cy + dpy * (d / 2), arc: true };
      this.path[3] = { x: p2.x + dpx * edgeShift2, y: p2.y + dpy * edgeShift2, arc: false };
      this.path[4] = { x: p2.x - dpx * edgeShift1, y: p2.y - dpy * edgeShift1, arc: false };
      this.path[5] = { x: cx - dpx * (d / 2), y: cy - dpy * (d / 2), arc: true };
      if (this.p1) {
        this.p1 = null;
        this.p2 = null;
      }
      if (this.params) this.params = null;
    }
  }

  createLensWithDFfdBfd(d, ffd, bfd) {
    this.error = null;

    if (!this.path) {
      var p1 = this.p1;
      var p2 = this.p2;
    } else {
      var old_params = this.getDR1R2();
      var p1 = geometry.midpoint(this.path[0], this.path[1]);
      var p2 = geometry.midpoint(this.path[3], this.path[4]);
      var old_d = old_params.d;
      var old_r1 = old_params.r1;
      var old_r2 = old_params.r2;
      var old_length = Math.hypot(p1.x - p2.x, p1.y - p2.y);

      if (old_r1 < Infinity && old_r1 > -Infinity) {
        var old_curveShift1 = old_r1 - Math.sqrt(old_r1 * old_r1 - old_length * old_length / 4) * Math.sign(old_r1);
      } else {
        var old_curveShift1 = 0;
      }

      if (old_r2 < Infinity && old_r2 > -Infinity) {
        var old_curveShift2 = old_r2 - Math.sqrt(old_r2 * old_r2 - old_length * old_length / 4) * Math.sign(old_r2);
      } else {
        var old_curveShift2 = 0;
      }

      var old_edgeShift1 = old_d / 2 - old_curveShift1;
      var old_edgeShift2 = old_d / 2 + old_curveShift2;
    }

    var len = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    var dx = (p2.x - p1.x) / len;
    var dy = (p2.y - p1.y) / len;
    var dpx = dy;
    var dpy = -dx;

    if (old_params) {
      // Correct p1 and p2 so that this.path[2] and this.path[5] will move symmetrically from the old lens.
      var correction = (old_edgeShift1 - old_edgeShift2) / 2;
      p1.x += dpx * correction;
      p1.y += dpy * correction;
      p2.x += dpx * correction;
      p2.y += dpy * correction;
    }

    var n = this.getRefIndexAt(null, {wavelength: 546});

    // Solve for r1 and r2

    var r1_1 = (d * (-1 + n) * (d + 2 * ffd * n - Math.sqrt(d ** 2 + 4 * bfd * ffd * n ** 2))) / (2 * n * (d + (-bfd + ffd) * n));
    var r2_1 = -(d * (-1 + n) * (d + 2 * bfd * n - Math.sqrt(d ** 2 + 4 * bfd * ffd * n ** 2))) / (2 * n * (d + (bfd - ffd) * n));

    var r1_2 = (d * (-1 + n) * (d + 2 * ffd * n + Math.sqrt(d ** 2 + 4 * bfd * ffd * n ** 2))) / (2 * n * (d + (-bfd + ffd) * n));
    var r2_2 = -(d * (-1 + n) * (d + 2 * bfd * n + Math.sqrt(d ** 2 + 4 * bfd * ffd * n ** 2))) / (2 * n * (d + (bfd - ffd) * n));

    

    if (!isNaN(r1_1) && !isNaN(r2_1) && (isNaN(r1_2) || isNaN(r2_2))) {
      // If only the first solution is valid, use that.
      var r1 = r1_1;
      var r2 = r2_1;
      this.createLensWithDR1R2(d, r1, r2);
      if (!this.path) {
        // If the lens is invalid as defined by d,r1,r2, still store the d,ffl,bfl parameters instead so the user may enter another set of d,ffl,bfl to get a valid lens.
        this.params = { d: d, ffd: ffd, bfd: bfd };
        this.error = i18next.t('simulator:sceneObjs.SphericalLens.invalidParameters');
      }
    } else if (!isNaN(r1_2) && !isNaN(r2_2) && (isNaN(r1_1) || isNaN(r2_1))) {
      // If only the second solution is valid, use that.
      var r1 = r1_2;
      var r2 = r2_2;
      this.createLensWithDR1R2(d, r1, r2);
      if (!this.path) {
        // If the lens is invalid as defined by d,r1,r2, still store the d,ffl,bfl parameters instead so the user may enter another set of d,ffl,bfl to get a valid lens.
        this.params = { d: d, ffd: ffd, bfd: bfd };
        this.error = i18next.t('simulator:sceneObjs.SphericalLens.invalidParameters');
      }
    } else if (!isNaN(r1_1) && !isNaN(r2_1) && !isNaN(r1_2) && !isNaN(r2_2)) {
      // If both solutions are valid, and if the old lens is valid, prefer the solution that is closest to the old lens.
      if (old_params) {
        var old_r1_1_diff = Math.abs(old_r1 - r1_1);
        var old_r2_1_diff = Math.abs(old_r2 - r2_1);
        var old_r1_2_diff = Math.abs(old_r1 - r1_2);
        var old_r2_2_diff = Math.abs(old_r2 - r2_2);

        if (old_r1_1_diff + old_r2_1_diff < old_r1_2_diff + old_r2_2_diff) {
          var r1_a = r1_1;
          var r2_a = r2_1;
          var r1_b = r1_2;
          var r2_b = r2_2;
        } else {
          var r1_a = r1_2;
          var r2_a = r2_2;
          var r1_b = r1_1;
          var r2_b = r2_1;
        }
      } else {
        // If the old lens is invalid, prefer the solution with the smaller radius of curvature.
        if (Math.abs(r1_1) + Math.abs(r2_1) < Math.abs(r1_2) + Math.abs(r2_2)) {
          var r1_a = r1_1;
          var r2_a = r2_1;
          var r1_b = r1_2;
          var r2_b = r2_2;
        } else {
          var r1_a = r1_2;
          var r2_a = r2_2;
          var r1_b = r1_1;
          var r2_b = r2_1;
        }
      }

      // Try the preferred solution first.
      var r1 = r1_a;
      var r2 = r2_a;
      this.createLensWithDR1R2(d, r1, r2);
      if (!this.path) {
        // Try the other solution if the preferred solution gives an invalid set of d,r1,r2.
        r1 = r1_b;
        r2 = r2_b;
        this.createLensWithDR1R2(d, r1, r2);
        if (!this.path) {
          // If the lens is still invalid, still store the d,ffl,bfl parameters instead so the user may enter another set of d,ffl,bfl to get a valid lens.
          this.params = { d: d, ffd: ffd, bfd: bfd };
          this.error = i18next.t('simulator:sceneObjs.SphericalLens.invalidParameters');
        }
      }
    } else {
      // invalid lens. Store the parameters so we can restore them later.
      this.p1 = p1;
      this.p2 = p2;
      this.path = null;
      this.params = { d: d, ffd: ffd, bfd: bfd };
      this.error = i18next.t('simulator:sceneObjs.SphericalLens.invalidParameters');
      return;
    }
  }

  getDR1R2() {
    if (this.params) return this.params;

    // get radii of curvature
    var center1 = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(this.path[1], this.path[2])),
      geometry.perpendicularBisector(geometry.line(this.path[3], this.path[2])));
    var r2 = geometry.distance(center1, this.path[2]);
    var center2 = geometry.linesIntersection(geometry.perpendicularBisector(geometry.line(this.path[4], this.path[5])),
      geometry.perpendicularBisector(geometry.line(this.path[0], this.path[5])));
    var r1 = geometry.distance(center2, this.path[5]);

    var p1 = geometry.midpoint(this.path[0], this.path[1]);
    var p2 = geometry.midpoint(this.path[3], this.path[4]);
    var len = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    var dx = (p2.x - p1.x) / len;
    var dy = (p2.y - p1.y) / len;
    var dpx = dy;
    var dpy = -dx;
    var cx = (p1.x + p2.x) * .5;
    var cy = (p1.y + p2.y) * .5;
    var d = geometry.distance(this.path[2], this.path[5]);

    // correct sign
    if (dpx * (center1.x - this.path[2].x) + dpy * (center1.y - this.path[2].y) < 0)
      r2 = -r2;
    if (dpx * (center2.x - this.path[5].x) + dpy * (center2.y - this.path[5].y) < 0)
      r1 = -r1;

    if (isNaN(r1)) {
      r1 = Infinity;
    }
    if (isNaN(r2)) {
      r2 = Infinity;
    }
    return { d: d, r1: r1, r2: r2 };
  }

  getDFfdBfd() {
    if (this.params) return this.params;

    var dR1R2 = this.getDR1R2();
    var r1 = dR1R2.r1;
    var r2 = dR1R2.r2;
    var d = dR1R2.d;
    var n = this.getRefIndexAt(null, {wavelength: 546});

    var f = 1 / ((n - 1) * (1 / r1 - 1 / r2 + (n - 1) * d / (n * r1 * r2)));
    var ffd = f * (1 + (n - 1) * d / (n * r2));
    var bfd = f * (1 - (n - 1) * d / (n * r1));

    return { d: d, ffd: ffd, bfd: bfd };
  }
};

export default SphericalLens;