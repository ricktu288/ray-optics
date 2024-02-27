// Glass -> Ideal Lens
objTypes['lens'] = {

  // Create the obj
  create: function (constructionPoint) {
    return { type: 'lens', p1: constructionPoint, p2: constructionPoint, p: 100 };
  },

  // Show the property box
  populateObjBar: function (obj, objBar) {
    objBar.createNumber(getMsg('focallength'), -1000, 1000, 1, obj.p, function (obj, value) {
      obj.p = value;
    });
  },

  // Use the prototype lineobj
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,
  rayIntersection: objTypes['lineobj'].rayIntersection,

  // Draw the obj on canvas
  draw: function (obj, ctx, aboveLight) {
    var len = Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));
    var par_x = (obj.p2.x - obj.p1.x) / len;
    var par_y = (obj.p2.y - obj.p1.y) / len;
    var per_x = par_y;
    var per_y = -par_x;

    var arrow_size_per = 5;
    var arrow_size_par = 5;
    var center_size = 2;

    // Draw the line segment
    ctx.strokeStyle = getMouseStyle(obj, 'rgb(128,128,128)');
    ctx.globalAlpha = 1 / ((Math.abs(obj.p) / 100) + 1);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p2.x, obj.p2.y);
    ctx.stroke();
    ctx.lineWidth = 1;

    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgb(255,0,0)';

    // Draw the center point of the lens
    var center = geometry.midpoint(obj);
    ctx.strokeStyle = 'rgb(255,255,255)';
    ctx.beginPath();
    ctx.moveTo(center.x - per_x * center_size, center.y - per_y * center_size);
    ctx.lineTo(center.x + per_x * center_size, center.y + per_y * center_size);
    ctx.stroke();

    if (obj.p > 0) {
      // Draw the arrow (p1)
      ctx.beginPath();
      ctx.moveTo(obj.p1.x - par_x * arrow_size_par, obj.p1.y - par_y * arrow_size_par);
      ctx.lineTo(obj.p1.x + par_x * arrow_size_par + per_x * arrow_size_per, obj.p1.y + par_y * arrow_size_par + per_y * arrow_size_per);
      ctx.lineTo(obj.p1.x + par_x * arrow_size_par - per_x * arrow_size_per, obj.p1.y + par_y * arrow_size_par - per_y * arrow_size_per);
      ctx.fill();

      // Draw the arrow (p2)
      ctx.beginPath();
      ctx.moveTo(obj.p2.x + par_x * arrow_size_par, obj.p2.y + par_y * arrow_size_par);
      ctx.lineTo(obj.p2.x - par_x * arrow_size_par + per_x * arrow_size_per, obj.p2.y - par_y * arrow_size_par + per_y * arrow_size_per);
      ctx.lineTo(obj.p2.x - par_x * arrow_size_par - per_x * arrow_size_per, obj.p2.y - par_y * arrow_size_par - per_y * arrow_size_per);
      ctx.fill();
    }
    if (obj.p < 0) {
      // Draw the arrow (p1)
      ctx.beginPath();
      ctx.moveTo(obj.p1.x + par_x * arrow_size_par, obj.p1.y + par_y * arrow_size_par);
      ctx.lineTo(obj.p1.x - par_x * arrow_size_par + per_x * arrow_size_per, obj.p1.y - par_y * arrow_size_par + per_y * arrow_size_per);
      ctx.lineTo(obj.p1.x - par_x * arrow_size_par - per_x * arrow_size_per, obj.p1.y - par_y * arrow_size_par - per_y * arrow_size_per);
      ctx.fill();

      // Draw the arrow (p2)
      ctx.beginPath();
      ctx.moveTo(obj.p2.x - par_x * arrow_size_par, obj.p2.y - par_y * arrow_size_par);
      ctx.lineTo(obj.p2.x + par_x * arrow_size_par + per_x * arrow_size_per, obj.p2.y + par_y * arrow_size_par + per_y * arrow_size_per);
      ctx.lineTo(obj.p2.x + par_x * arrow_size_par - per_x * arrow_size_per, obj.p2.y + par_y * arrow_size_par - per_y * arrow_size_per);
      ctx.fill();
    }

    if (obj == mouseObj) {
      // show focal length
      var mp = geometry.midpoint(obj);
      ctx.fillStyle = 'rgb(255,0,255)';
      ctx.fillRect(mp.x + obj.p * per_x - 1.5, mp.y + obj.p * per_y - 1.5, 3, 3);
      ctx.fillRect(mp.x - obj.p * per_x - 1.5, mp.y - obj.p * per_y - 1.5, 3, 3);
    }
  },



  // When the obj is shot by a ray
  shot: function (lens, ray, rayIndex, shootPoint) {

    var lens_length = geometry.length_segment(lens);
    var main_line_unitvector_x = (-lens.p1.y + lens.p2.y) / lens_length;
    var main_line_unitvector_y = (lens.p1.x - lens.p2.x) / lens_length;
    var mid_point = geometry.midpoint(lens);

    var twoF_point_1 = geometry.point(mid_point.x + main_line_unitvector_x * 2 * lens.p, mid_point.y + main_line_unitvector_y * 2 * lens.p);  // The first point at two focal lengths
    var twoF_point_2 = geometry.point(mid_point.x - main_line_unitvector_x * 2 * lens.p, mid_point.y - main_line_unitvector_y * 2 * lens.p);  // The second point at two focal lengths

    var twoF_line_near, twoF_line_far;
    if (geometry.length_squared(ray.p1, twoF_point_1) < geometry.length_squared(ray.p1, twoF_point_2)) {
      // The first point at two focal lengths is on the same side as the ray
      twoF_line_near = geometry.parallel(lens, twoF_point_1);
      twoF_line_far = geometry.parallel(lens, twoF_point_2);
    }
    else {
      // The second point at two focal lengths is on the same side as the ray
      twoF_line_near = geometry.parallel(lens, twoF_point_2);
      twoF_line_far = geometry.parallel(lens, twoF_point_1);
    }


    if (lens.p > 0) {
      // Converging lens
      ray.p2 = geometry.intersection_2line(twoF_line_far, geometry.line(mid_point, geometry.intersection_2line(twoF_line_near, ray)));
      ray.p1 = shootPoint;
    }
    else {
      // Diverging lens
      ray.p2 = geometry.intersection_2line(twoF_line_far, geometry.line(shootPoint, geometry.intersection_2line(twoF_line_near, geometry.line(mid_point, geometry.intersection_2line(twoF_line_far, ray)))));
      ray.p1 = shootPoint;
    }
  }

};
