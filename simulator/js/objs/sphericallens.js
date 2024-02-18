// Glass -> Spherical Lens
objTypes['sphericallens'] = {

  supportSurfaceMerging: true,

  create: function(mouse) {
    return {type: 'sphericallens', p1: mouse, p2: mouse, p: 1.5, tmp_params: {r1: NaN, r2: NaN, d: 40}};
  },

  // Show the property box
  populateObjBar: function(obj, elem) {
    

    if (!isConstructing) {
      createDropdownAttr('', obj.definedBy || 'DR1R2', {
        'DR1R2': getMsg('radii_of_curvature'),
        'DFfdBfd': getMsg('focal_distances')
      }, function(obj, value) {
        obj.definedBy = value;
        selectObj(selectedObj);
      }, elem);
    }

    if (!isConstructing && (!obj.definedBy || obj.definedBy == 'DR1R2')) {
      var params = this.getDR1R2(obj);
      var r1 = params.r1;
      var r2 = params.r2;
      var d = params.d;

      createNumberAttr('R<sub>1</sub>', 0, 100, 1, r1, function(obj, value) {
        var params = objTypes['sphericallens'].getDR1R2(obj);
        var r1 = params.r1;
        var r2 = params.r2;
        var d = params.d;
        objTypes['sphericallens'].createLensWithDR1R2(obj, d, value, r2);
      }, elem, null, true);
      createNumberAttr('R<sub>2</sub>', 0, 100, 1, r2, function(obj, value) {
        var params = objTypes['sphericallens'].getDR1R2(obj);
        var r1 = params.r1;
        var r2 = params.r2;
        var d = params.d;
        objTypes['sphericallens'].createLensWithDR1R2(obj, d, r1, value);
      }, elem, null, true);
      createNumberAttr('d', 0, 100, 1, d, function(obj, value) {
        var params = objTypes['sphericallens'].getDR1R2(obj);
        var r1 = params.r1;
        var r2 = params.r2;
        var d = params.d;
        objTypes['sphericallens'].createLensWithDR1R2(obj, value, r1, r2);
      }, elem, null, true);
    } else if (obj.definedBy == 'DFfdBfd') {
      createInfoBox(elem, '<img src="../img/FFD_BFD.svg" width=100%>');

      var params = this.getDFfdBfd(obj);
      var d = params.d;
      var ffd = params.ffd;
      var bfd = params.bfd;

      createNumberAttr('FFD', 0, 100, 1, ffd, function(obj, value) {
        var params = objTypes['sphericallens'].getDFfdBfd(obj);
        var d = params.d;
        var bfd = params.bfd;
        objTypes['sphericallens'].createLensWithDFfdBfd(obj, d, value, bfd);
      }, elem, null, true);
      createNumberAttr('BFD', 0, 100, 1, bfd, function(obj, value) {
        var params = objTypes['sphericallens'].getDFfdBfd(obj);
        var d = params.d;
        var ffd = params.ffd;
        objTypes['sphericallens'].createLensWithDFfdBfd(obj, d, ffd, value);
      }, elem, null, true);
      createNumberAttr('d', 0, 100, 1, d, function(obj, value) {
        var params = objTypes['sphericallens'].getDFfdBfd(obj);
        var ffd = params.ffd;
        var bfd = params.bfd;
        objTypes['sphericallens'].createLensWithDFfdBfd(obj, value, ffd, bfd);
      }, elem, null, true);
    }
    

    if (scene.colorMode) {
      createNumberAttr(getMsg('cauchycoeff') + " A", 1, 3, 0.01, obj.p, function(obj, value) {
        var old_params = objTypes['sphericallens'].getDFfdBfd(obj);
        obj.p = value * 1;
        if (obj.definedBy == 'DFfdBfd') {
          // If the lens is defined by d,ffd,bfd, we need to rebuild the lens with the new refractive index so that the focal distances are correct.
          objTypes['sphericallens'].createLensWithDFfdBfd(obj, old_params.d, old_params.ffd, old_params.bfd);
        }
      }, elem, getMsg('refractiveindex_note_popover'));
      createNumberAttr("B(μm²)", 0.0001, 0.02, 0.0001, (obj.cauchyCoeff || 0.004), function(obj, value) {
        var old_params = objTypes['sphericallens'].getDFfdBfd(obj);
        obj.cauchyCoeff = value;
        if (obj.definedBy == 'DFfdBfd') {
          // If the lens is defined by d,ffd,bfd, we need to rebuild the lens with the new refractive index so that the focal distances are correct.
          objTypes['sphericallens'].createLensWithDFfdBfd(obj, old_params.d, old_params.ffd, old_params.bfd);
        }
      }, elem);
    } else {
      createNumberAttr(getMsg('refractiveindex'), 0.5, 2.5, 0.01, obj.p, function(obj, value) {
        var old_params = objTypes['sphericallens'].getDFfdBfd(obj);
        obj.p = value * 1;
        if (obj.definedBy == 'DFfdBfd') {
          // If the lens is defined by d,ffd,bfd, we need to rebuild the lens with the new refractive index so that the focal distances are correct.
          objTypes['sphericallens'].createLensWithDFfdBfd(obj, old_params.d, old_params.ffd, old_params.bfd);
        }
      }, elem, getMsg('refractiveindex_note_popover'));
    }
  },


  // Mousedown when the obj is being constructed by the user
  c_mousedown: function(obj, mouse, ctrl, shift)
  {
    if (shift)
    {
      obj.p2 = snapToDirection(mouse, constructionPoint, [{x: 1, y: 0},{x: 0, y: 1},{x: 1, y: 1},{x: 1, y: -1}]);
    }
    else
    {
      obj.p2 = mouse;
    }

    this.createLens(obj);
  },

  // Mousemove when the obj is being constructed by the user
  c_mousemove: function(obj, mouse, ctrl, shift)
  {
    if (shift)
    {
      obj.p2 = snapToDirection(mouse, constructionPoint, [{x: 1, y: 0},{x: 0, y: 1},{x: 1, y: 1},{x: 1, y: -1}]);
    }
    else
    {
      obj.p2 = mouse;
    }

    obj.p1 = ctrl ? geometry.point(2 * constructionPoint.x - obj.p2.x, 2 * constructionPoint.y - obj.p2.y) : constructionPoint;

    this.createLens(obj);
  },
  // Mouseup when the obj is being constructed by the user
  c_mouseup: function(obj, mouse, ctrl, shift)
  {
    if (!mouseOnPoint_construct(mouse, obj.p1))
    {
      isConstructing = false;
      delete obj.p1;
      delete obj.p2;
      delete obj.tmp_params;
      selectObj(selectedObj);
    }
  },

  createLens: function(obj) {
    var p1 = obj.p1 || geometry.midpoint_points(obj.path[0], obj.path[1]);
    var p2 = obj.p2 || geometry.midpoint_points(obj.path[3], obj.path[4]);
    var len = Math.hypot(p1.x-p2.x, p1.y-p2.y);
    var dx = (p2.x-p1.x)/len;
    var dy = (p2.y-p1.y)/len;
    var dpx = dy;
    var dpy = -dx;
    var cx = (p1.x+p2.x)*.5;
    var cy = (p1.y+p2.y)*.5;
    const thick = 10;
    // create lens
    if (!obj.path) obj.path = [];
    obj.path[0] = {x: p1.x-dpx*thick, y: p1.y-dpy*thick, arc: false};
    obj.path[1] = {x: p1.x+dpx*thick, y: p1.y+dpy*thick, arc: false};
    obj.path[2] = {x: cx+dpx*thick*2, y: cy+dpy*thick*2, arc: true};
    obj.path[3] = {x: p2.x+dpx*thick, y: p2.y+dpy*thick, arc: false};
    obj.path[4] = {x: p2.x-dpx*thick, y: p2.y-dpy*thick, arc: false};
    obj.path[5] = {x: cx-dpx*thick*2, y: cy-dpy*thick*2, arc: true};
  },

  createLensWithDR1R2: function(obj, d, r1, r2) {
    if (!obj.path) {
      var p1 = obj.p1;
      var p2 = obj.p2;
    } else {
      var old_params = this.getDR1R2(obj);
      var p1 = geometry.midpoint_points(obj.path[0], obj.path[1]);
      var p2 = geometry.midpoint_points(obj.path[3], obj.path[4]);
      var old_d = old_params.d;
      var old_r1 = old_params.r1;
      var old_r2 = old_params.r2;
      var old_length = Math.hypot(p1.x-p2.x, p1.y-p2.y);
      
      if (old_r1 < Infinity && old_r1 > -Infinity) {
        var old_curveShift1 = old_r1 - Math.sqrt(old_r1*old_r1 - old_length*old_length/4) * Math.sign(old_r1);
      } else {
        var old_curveShift1 = 0;
      }

      if (old_r2 < Infinity && old_r2 > -Infinity) {
        var old_curveShift2 = old_r2 - Math.sqrt(old_r2*old_r2 - old_length*old_length/4) * Math.sign(old_r2);
      } else {
        var old_curveShift2 = 0;
      }
      
      var old_edgeShift1 = old_d/2 - old_curveShift1;
      var old_edgeShift2 = old_d/2 + old_curveShift2;
    }

    var len = Math.hypot(p1.x-p2.x, p1.y-p2.y);
    var dx = (p2.x-p1.x)/len;
    var dy = (p2.y-p1.y)/len;
    var dpx = dy;
    var dpy = -dx;

    if (old_params) {
      // Correct p1 and p2 so that obj.path[2] and obj.path[5] will move symmetrically from the old lens.
      var correction = (old_edgeShift1 - old_edgeShift2) / 2;
      p1.x += dpx*correction;
      p1.y += dpy*correction;
      p2.x += dpx*correction;
      p2.y += dpy*correction;
    }



    var cx = (p1.x+p2.x)*.5;
    var cy = (p1.y+p2.y)*.5;

    
    if (r1 < Infinity && r1 > -Infinity) {
      var curveShift1 = r1 - Math.sqrt(r1*r1 - len*len/4) * Math.sign(r1);
    } else {
      var curveShift1 = 0;
    }

    if (r2 < Infinity && r2 > -Infinity) {
      var curveShift2 = r2 - Math.sqrt(r2*r2 - len*len/4) * Math.sign(r2);
    } else {
      var curveShift2 = 0;
    }

    var edgeShift1 = d/2 - curveShift1;
    var edgeShift2 = d/2 + curveShift2;

    //console.log([edgeShift1,edgeShift2,d])

    if (isNaN(curveShift1) || isNaN(curveShift2)) {
      // invalid lens. Store the parameters so we can restore them later.
      obj.p1 = p1;
      obj.p2 = p2;
      delete obj.path;
      obj.tmp_params = {r1: r1, r2: r2, d: d};
    } else {
      // create lens
      if (!obj.path) obj.path = [];
      obj.path[0] = {x: p1.x-dpx*edgeShift1, y: p1.y-dpy*edgeShift1, arc: false};
      obj.path[1] = {x: p1.x+dpx*edgeShift2, y: p1.y+dpy*edgeShift2, arc: false};
      obj.path[2] = {x: cx+dpx*(d/2), y: cy+dpy*(d/2), arc: true};
      obj.path[3] = {x: p2.x+dpx*edgeShift2, y: p2.y+dpy*edgeShift2, arc: false};
      obj.path[4] = {x: p2.x-dpx*edgeShift1, y: p2.y-dpy*edgeShift1, arc: false};
      obj.path[5] = {x: cx-dpx*(d/2), y: cy-dpy*(d/2), arc: true};
      if (obj.p1) {
        delete obj.p1;
        delete obj.p2;
      }
      if (obj.tmp_params) delete obj.tmp_params;
    }
  },

  createLensWithDFfdBfd: function(obj, d, ffd, bfd) {
    if (!obj.path) {
      var p1 = obj.p1;
      var p2 = obj.p2;
    } else {
      var old_params = this.getDR1R2(obj);
      var p1 = geometry.midpoint_points(obj.path[0], obj.path[1]);
      var p2 = geometry.midpoint_points(obj.path[3], obj.path[4]);
      var old_d = old_params.d;
      var old_r1 = old_params.r1;
      var old_r2 = old_params.r2;
      var old_length = Math.hypot(p1.x-p2.x, p1.y-p2.y);
      
      if (old_r1 < Infinity && old_r1 > -Infinity) {
        var old_curveShift1 = old_r1 - Math.sqrt(old_r1*old_r1 - old_length*old_length/4) * Math.sign(old_r1);
      } else {
        var old_curveShift1 = 0;
      }

      if (old_r2 < Infinity && old_r2 > -Infinity) {
        var old_curveShift2 = old_r2 - Math.sqrt(old_r2*old_r2 - old_length*old_length/4) * Math.sign(old_r2);
      } else {
        var old_curveShift2 = 0;
      }
      
      var old_edgeShift1 = old_d/2 - old_curveShift1;
      var old_edgeShift2 = old_d/2 + old_curveShift2;
    }

    var len = Math.hypot(p1.x-p2.x, p1.y-p2.y);
    var dx = (p2.x-p1.x)/len;
    var dy = (p2.y-p1.y)/len;
    var dpx = dy;
    var dpy = -dx;

    if (old_params) {
      // Correct p1 and p2 so that obj.path[2] and obj.path[5] will move symmetrically from the old lens.
      var correction = (old_edgeShift1 - old_edgeShift2) / 2;
      p1.x += dpx*correction;
      p1.y += dpy*correction;
      p2.x += dpx*correction;
      p2.y += dpy*correction;
    }

    var n = (!scene.colorMode)?obj.p:(obj.p + (obj.cauchyCoeff || 0.004) / (546*546*0.000001));

    // Solve for r1 and r2

    var r1_1 = (d * (-1 + n) * (d + 2 * ffd * n - Math.sqrt(d**2 + 4 * bfd * ffd * n**2))) / (2 * n * (d + (-bfd + ffd) * n));
    var r2_1 = -(d * (-1 + n) * (d + 2 * bfd * n - Math.sqrt(d**2 + 4 * bfd * ffd * n**2))) / (2 * n * (d + (bfd - ffd) * n));

    var r1_2 = (d * (-1 + n) * (d + 2 * ffd * n + Math.sqrt(d**2 + 4 * bfd * ffd * n**2))) / (2 * n * (d + (-bfd + ffd) * n));
    var r2_2 = -(d * (-1 + n) * (d + 2 * bfd * n + Math.sqrt(d**2 + 4 * bfd * ffd * n**2))) / (2 * n * (d + (bfd - ffd) * n));


    if (!isNaN(r1_1) && !isNaN(r2_1) && (isNaN(r1_2) || isNaN(r2_2))) {
      // If only the first solution is valid, use that.
      var r1 = r1_1;
      var r2 = r2_1;
      this.createLensWithDR1R2(obj, d, r1, r2);
      if (!obj.path) {
        // If the lens is invalid as defined by d,r1,r2, still store the d,ffl,bfl parameters instead so the user may enter another set of d,ffl,bfl to get a valid lens.
        obj.tmp_params = {d: d, ffd: ffd, bfd: bfd};
      }
    } else if (!isNaN(r1_2) && !isNaN(r2_2) && (isNaN(r1_1) || isNaN(r2_1))) {
      // If only the second solution is valid, use that.
      var r1 = r1_2;
      var r2 = r2_2;
      this.createLensWithDR1R2(obj, d, r1, r2);
      if (!obj.path) {
        // If the lens is invalid as defined by d,r1,r2, still store the d,ffl,bfl parameters instead so the user may enter another set of d,ffl,bfl to get a valid lens.
        obj.tmp_params = {d: d, ffd: ffd, bfd: bfd};
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
      this.createLensWithDR1R2(obj, d, r1, r2);
      if (!obj.path) {
        // Try the other solution if the preferred solution gives an invalid set of d,r1,r2.
        r1 = r1_b;
        r2 = r2_b;
        this.createLensWithDR1R2(obj, d, r1, r2);
        if (!obj.path) {
          // If the lens is still invalid, still store the d,ffl,bfl parameters instead so the user may enter another set of d,ffl,bfl to get a valid lens.
          obj.tmp_params = {d: d, ffd: ffd, bfd: bfd};
        }
      }
    } else {
      // invalid lens. Store the parameters so we can restore them later.
      obj.p1 = p1;
      obj.p2 = p2;
      delete obj.path;
      obj.tmp_params = {d: d, ffd: ffd, bfd: bfd};
      return;
    }



  },

  getDR1R2: function(obj) {
    if (obj.tmp_params) return obj.tmp_params;

    // get radii of curvature
    var center1 = geometry.intersection_2line(geometry.perpendicular_bisector(geometry.line(obj.path[1], obj.path[2])),
                                            geometry.perpendicular_bisector(geometry.line(obj.path[3], obj.path[2])));
    var r2 = geometry.length(center1, obj.path[2]);
    var center2 = geometry.intersection_2line(geometry.perpendicular_bisector(geometry.line(obj.path[4], obj.path[5])),
                                            geometry.perpendicular_bisector(geometry.line(obj.path[0], obj.path[5])));
    var r1 = geometry.length(center2, obj.path[5]);

    var p1 = geometry.midpoint_points(obj.path[0], obj.path[1]);
    var p2 = geometry.midpoint_points(obj.path[3], obj.path[4]);
    var len = Math.hypot(p1.x-p2.x, p1.y-p2.y);
    var dx = (p2.x-p1.x)/len;
    var dy = (p2.y-p1.y)/len;
    var dpx = dy;
    var dpy = -dx;
    var cx = (p1.x+p2.x)*.5;
    var cy = (p1.y+p2.y)*.5;
    var d = geometry.length(obj.path[2], obj.path[5]);

    // correct sign
    if (dpx*(center1.x-obj.path[2].x)+dpy*(center1.y-obj.path[2].y) < 0)
      r2 = -r2;
    if (dpx*(center2.x-obj.path[5].x)+dpy*(center2.y-obj.path[5].y) < 0)
      r1 = -r1;

    if (isNaN(r1)) {
      r1 = Infinity;
    }
    if (isNaN(r2)) {
      r2 = Infinity;
    }
    return {d: d, r1: r1, r2: r2};
  },

  getDFfdBfd: function(obj) {
    if (obj.tmp_params) return obj.tmp_params;

    var dR1R2 = this.getDR1R2(obj);
    var r1 = dR1R2.r1;
    var r2 = dR1R2.r2;
    var d = dR1R2.d;
    var n = (!scene.colorMode)?obj.p:(obj.p + (obj.cauchyCoeff || 0.004) / (546*546*0.000001));

    var f = 1/((n-1)*(1/r1-1/r2+(n-1)*d/(n*r1*r2)));
    var ffd = f*(1+(n-1)*d/(n*r2));
    var bfd = f*(1-(n-1)*d/(n*r1));

    return {d: d, ffd: ffd, bfd: bfd};
  },

  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    if (draggingPart.part == -1) return;
    var p1 = geometry.midpoint_points(obj.path[0], obj.path[1]);
    var p2 = geometry.midpoint_points(obj.path[3], obj.path[4]);
    var len = Math.hypot(p1.x-p2.x, p1.y-p2.y);
    var dx = (p2.x-p1.x)/len;
    var dy = (p2.y-p1.y)/len;
    var dpx = dy;
    var dpy = -dx;
    var cx = (p1.x+p2.x)*.5;
    var cy = (p1.y+p2.y)*.5;
    var othick = Math.hypot(obj.path[0].x-p1.x, obj.path[0].y-p1.y);
    var cthick2 = Math.hypot(obj.path[2].x-cx, obj.path[2].y-cy);
    var cthick5 = Math.hypot(obj.path[5].x-cx, obj.path[5].y-cy);
    var oldx, oldy;
    if (draggingPart.part == 1) {
      oldx = obj.path[draggingPart.index].x;
      oldy = obj.path[draggingPart.index].y;
    }

    objTypes['refractor'].dragging(obj, mouse, draggingPart, ctrl, shift);
    if (draggingPart.byHandle) return;
    if (draggingPart.part != 1)
      return;
    if (draggingPart.index == 2 || draggingPart.index == 5) {
      // keep center points on optical axis
      var off = (mouse.x-cx)*dpx + (mouse.y-cy)*dpy;
      obj.path[draggingPart.index] = {x: cx+dpx*off, y: cy+dpy*off, arc: true };
    } else {
      var thick = Math.abs(((mouse.x-cx)*dpx + (mouse.y-cy)*dpy));
      // adjust center thickness to match so curvature is the same
      cthick2 += thick-othick;
      cthick5 += thick-othick;
      var mpt = obj.path[draggingPart.index];
      var lchange = (mpt.x-oldx)*dx + (mpt.y-oldy)*dy;
      // adjust length
      if (draggingPart.index < 2) {
        p1.x += lchange*dx;
        p1.y += lchange*dy;
      } else {
        p2.x += lchange*dx;
        p2.y += lchange*dy;
      }

      len = Math.hypot(p1.x-p2.x, p1.y-p2.y);
      dx = (p2.x-p1.x)/len;
      dy = (p2.y-p1.y)/len;
      dpx = dy;
      dpy = -dx;
      cx = (p1.x+p2.x)*.5;
      cy = (p1.y+p2.y)*.5;

      // recreate lens
      obj.path[0] = {x: p1.x-dpx*thick, y: p1.y-dpy*thick, arc: false};
      obj.path[1] = {x: p1.x+dpx*thick, y: p1.y+dpy*thick, arc: false};
      obj.path[2] = {x: cx+dpx*cthick2, y: cy+dpy*cthick2, arc: true};
      obj.path[3] = {x: p2.x+dpx*thick, y: p2.y+dpy*thick, arc: false};
      obj.path[4] = {x: p2.x-dpx*thick, y: p2.y-dpy*thick, arc: false};
      obj.path[5] = {x: cx-dpx*cthick5, y: cy-dpy*cthick5, arc: true};
    }
  },

  zIndex: objTypes['refractor'].zIndex,

  draw: function(obj, ctx, aboveLight) {
    if (!obj.path) {
      if (obj.p1 && obj.p2) {
        ctx.fillStyle = 'rgb(255,0,0)';
        ctx.fillRect(obj.p1.x-1.5, obj.p1.y-1.5, 3, 3);
        ctx.fillRect(obj.p2.x-1.5, obj.p2.y-1.5, 3, 3);
      }
      return;
    }
    objTypes['refractor'].draw(obj, ctx, aboveLight);
    
    var p1 = geometry.midpoint_points(obj.path[0], obj.path[1]);
    var p2 = geometry.midpoint_points(obj.path[3], obj.path[4]);
    var len = Math.hypot(p1.x-p2.x, p1.y-p2.y);
    var dx = (p2.x-p1.x)/len;
    var dy = (p2.y-p1.y)/len;
    var dpx = dy;
    var dpy = -dx;

    if (obj == mouseObj) {
      // Draw the focal points

      var params = this.getDFfdBfd(obj);
      var ffd = params.ffd;
      var bfd = params.bfd;
      
      ctx.fillStyle = 'rgb(255,0,255)';
      ctx.fillRect(obj.path[2].x+bfd*dpx - 1.5, obj.path[2].y+bfd*dpy - 1.5, 3, 3);
      ctx.fillRect(obj.path[5].x-ffd*dpx - 1.5, obj.path[5].y-ffd*dpy - 1.5, 3, 3);
    }
  },

  move: objTypes['refractor'].move,
  clicked: function(obj, mouse_nogrid, mouse, draggingPart) {
    if (!obj.path) {
      if (obj.p1 && obj.p2) {
        if (mouseOnPoint(mouse_nogrid, obj.p1)) {
          draggingPart.part = -1;
          draggingPart.targetPoint = obj.p1;
          return true;
        }
        if (mouseOnPoint(mouse_nogrid, obj.p2)) {
          draggingPart.part = -1;
          draggingPart.targetPoint = obj.p2;
          return true;
        }
      }
      return false;
    };
    if(objTypes['refractor'].clicked(obj, mouse_nogrid, mouse, draggingPart)) {
      if (draggingPart.part != 0) {
        draggingPart.requiresObjBarUpdate = true;
      }
      return true;
    }
    return false;
  },
  rayIntersection: function(obj, ray) {
    if (!obj.path) return false;
    return objTypes['refractor'].rayIntersection(obj, ray);
  },
  shot: objTypes['refractor'].shot,
  fillGlass: objTypes['refractor'].fillGlass,
  getShotData: objTypes['refractor'].getShotData,
  refract: objTypes['refractor'].refract,
  getShotType: objTypes['refractor'].getShotType,

};
