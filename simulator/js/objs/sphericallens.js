// Glasses -> Spherical Lens
// Originally contributed by Paul Falstad (pfalstad)
objTypes['sphericallens'] = {

  supportSurfaceMerging: true,

  create: function(mouse) {
    return {type: 'sphericallens', path: [{x: mouse.x, y: mouse.y, arc: false}], notDone: true, p: 1.5};
  },

  p_box: objTypes['refractor'].p_box,

  c_mousedown: objTypes['refractor'].c_mousedown,
  c_mousemove: objTypes['refractor'].c_mousemove,

  c_mouseup: function(obj, mouse, ctrl, shift) {
    objTypes['refractor'].c_mouseup(obj, mouse);
    if (obj.path.length > 2 && obj.notDone) {
      var p1 = obj.path[0];
      var p2 = obj.path[1];
      var len = Math.hypot(p1.x-p2.x, p1.y-p2.y);
      var dx = (p2.x-p1.x)/len;
      var dy = (p2.y-p1.y)/len;
      var dpx = dy;
      var dpy = -dx;
      var cx = (p1.x+p2.x)*.5;
      var cy = (p1.y+p2.y)*.5;
      const thick = 10;
      // create lens
      obj.path[0] = {x: p1.x-dpx*thick, y: p1.y-dpy*thick, arc: false};
      obj.path[1] = {x: p1.x+dpx*thick, y: p1.y+dpy*thick, arc: false};
      obj.path[2] = {x: cx+dpx*thick*2, y: cy+dpy*thick*2, arc: true};
      obj.path[3] = {x: p2.x+dpx*thick, y: p2.y+dpy*thick, arc: false};
      obj.path[4] = {x: p2.x-dpx*thick, y: p2.y-dpy*thick, arc: false};
      obj.path[5] = {x: cx-dpx*thick*2, y: cy-dpy*thick*2, arc: true};
      obj.notDone = false;
      isConstructing = false;
      draw();
    }
  },

  dragging: function(obj, mouse, draggingPart, ctrl, shift) {
    var p1 = graphs.midpoint_points(obj.path[0], obj.path[1]);
    var p2 = graphs.midpoint_points(obj.path[3], obj.path[4]);
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

  draw: function(obj, canvas, aboveLight) {
    objTypes['refractor'].draw(obj, canvas, aboveLight);
    if (obj.path.length < 6)
      return;

    // get radii of curvature
    var center1 = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(obj.path[1], obj.path[2])),
                                            graphs.perpendicular_bisector(graphs.line(obj.path[3], obj.path[2])));
    var r2 = graphs.length(center1, obj.path[2]);
    var center2 = graphs.intersection_2line(graphs.perpendicular_bisector(graphs.line(obj.path[4], obj.path[5])),
                                            graphs.perpendicular_bisector(graphs.line(obj.path[0], obj.path[5])));
    var r1 = graphs.length(center2, obj.path[5]);

    var p1 = graphs.midpoint_points(obj.path[0], obj.path[1]);
    var p2 = graphs.midpoint_points(obj.path[3], obj.path[4]);
    var len = Math.hypot(p1.x-p2.x, p1.y-p2.y);
    var dx = (p2.x-p1.x)/len;
    var dy = (p2.y-p1.y)/len;
    var dpx = dy;
    var dpy = -dx;
    var cx = (p1.x+p2.x)*.5;
    var cy = (p1.y+p2.y)*.5;
    var thick = graphs.length(obj.path[2], obj.path[5]);

    // correct sign
    if (dpx*(center1.x-obj.path[2].x)+dpy*(center1.y-obj.path[2].y) < 0)
      r2 = -r2;
    if (dpx*(center2.x-obj.path[5].x)+dpy*(center2.y-obj.path[5].y) < 0)
      r1 = -r1;

    if (obj == mouseObj) {
      // the lensmaker's equation is apparently not accurate enough at the scale of this simulator so we
      // do some extra work to get an accurate focal length.  still not quite exact
      var n = (!colorMode)?obj.p:(obj.p + (obj.cauchyCoeff || 0.004) / (565*565*0.000001));
      var si1 = n*r1/(n-1);
      var power = (1-n)/r2 - n/(thick-si1);
      var focalLength = 1/power;
      ctx.fillStyle = 'rgb(255,0,255)';
      ctx.fillRect(obj.path[2].x+focalLength*dpx - 1.5, obj.path[2].y+focalLength*dpy - 1.5, 3, 3);

      // other side is slightly different
      si1 = -n*r2/(n-1);
      power = -(1-n)/r1 - n/(thick-si1);
      focalLength = 1/power;
      ctx.fillRect(obj.path[5].x-focalLength*dpx - 1.5, obj.path[5].y-focalLength*dpy - 1.5, 3, 3);
    }
  },

  move: objTypes['refractor'].move,
  clicked: objTypes['refractor'].clicked,
  rayIntersection: objTypes['refractor'].rayIntersection,
  shot: objTypes['refractor'].shot,
  fillGlass: objTypes['refractor'].fillGlass,
  getShotData: objTypes['refractor'].getShotData,
  refract: objTypes['refractor'].refract,
  getShotType: objTypes['refractor'].getShotType,

};
