// Mirror -> Ideal curved mirror
objTypes['idealmirror'] = {

  // Create the obj
  create: function(mouse) {
    return {type: 'idealmirror', p1: mouse, p2: graphs.point(mouse.x + scene.gridSizeRefactored, mouse.y), p: 100};
  },

  dichroicSettings: objTypes['mirror'].dichroicSettings,

  // Show the property box
  p_box: function(obj, elem) {
    createNumberAttr(getMsg('focallength'), -1000, 1000, 1, obj.p * (cartesianSign?-1:1), function(obj, value) {
      obj.p = value * (cartesianSign?-1:1);
    }, elem);
    if (createAdvancedOptions(cartesianSign)) {
      createBooleanAttr(getMsg('cartesiansign'), cartesianSign, function(obj, value) {
        if (obj == scene.objsRefactored[selectedObj]) {
          cartesianSign = value;
          localStorage.rayOpticsCartesianSign = value?"true":"false";
          selectObj(selectedObj);
        }
      }, elem);
    }
    dichroicSettings(obj,elem);
  },

  // Use the prototype lineobj
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,

  // Draw the obj on canvas
  draw: function(obj, ctx, aboveLight) {
  var len = Math.sqrt((obj.p2.x - obj.p1.x) * (obj.p2.x - obj.p1.x) + (obj.p2.y - obj.p1.y) * (obj.p2.y - obj.p1.y));
  var par_x = (obj.p2.x - obj.p1.x) / len;
  var par_y = (obj.p2.y - obj.p1.y) / len;
  var per_x = par_y;
  var per_y = -par_x;

  var arrow_size_per = 5;
  var arrow_size_par = 5;
  var center_size = 1;

  // Draw the line segment
  ctx.strokeStyle = getMouseStyle(obj, (scene.colorModeRefactored && obj.wavelength && obj.isDichroic) ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(168,168,168)');
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(obj.p1.x, obj.p1.y);
  ctx.lineTo(obj.p2.x, obj.p2.y);
  ctx.stroke();
  ctx.lineWidth = 1;


  // Draw the center point of the mirror
  var center = graphs.midpoint(obj);
  ctx.strokeStyle = 'rgb(255,255,255)';
  ctx.beginPath();
  ctx.moveTo(center.x - per_x * center_size, center.y - per_y * center_size);
  ctx.lineTo(center.x + per_x * center_size, center.y + per_y * center_size);
  ctx.stroke();


  ctx.fillStyle = 'rgb(255,0,0)';

  // Draw the arrow for one-sided version (the focal lengths on the two sides are opposite)
  /*
  if(obj.p>0)
  {
    // Draw the arrow (p1)
    ctx.beginPath();
    ctx.moveTo(obj.p1.x+per_x*arrow_size_per2,obj.p1.y+per_y*arrow_size_per2);
    ctx.lineTo(obj.p1.x-per_x*arrow_size_per,obj.p1.y-per_y*arrow_size_per);
    ctx.lineTo(obj.p1.x+per_x*arrow_size_per2+par_x*arrow_size_par,obj.p1.y+per_y*arrow_size_per2+par_y*arrow_size_par);
    ctx.fill();

    // Draw the arrow (p2)
    ctx.beginPath();
    ctx.moveTo(obj.p2.x+per_x*arrow_size_per2,obj.p2.y+per_y*arrow_size_per2);
    ctx.lineTo(obj.p2.x-per_x*arrow_size_per,obj.p2.y-per_y*arrow_size_per);
    ctx.lineTo(obj.p2.x+per_x*arrow_size_per2-par_x*arrow_size_par,obj.p2.y+per_y*arrow_size_per2-par_y*arrow_size_par);
    ctx.fill();
  }
  if(obj.p<0)
  {
    // Draw the arrow (p1)
    ctx.beginPath();
    ctx.moveTo(obj.p1.x-per_x*arrow_size_per2,obj.p1.y-per_y*arrow_size_per2);
    ctx.lineTo(obj.p1.x+per_x*arrow_size_per,obj.p1.y+per_y*arrow_size_per);
    ctx.lineTo(obj.p1.x-per_x*arrow_size_per2+par_x*arrow_size_par,obj.p1.y-per_y*arrow_size_per2+par_y*arrow_size_par);
    ctx.fill();

    // Draw the arrow (p2)
    ctx.beginPath();
    ctx.moveTo(obj.p2.x-per_x*arrow_size_per2,obj.p2.y-per_y*arrow_size_per2);
    ctx.lineTo(obj.p2.x+per_x*arrow_size_per,obj.p2.y+per_y*arrow_size_per);
    ctx.lineTo(obj.p2.x-per_x*arrow_size_per2-par_x*arrow_size_par,obj.p2.y-per_y*arrow_size_per2-par_y*arrow_size_par);
    ctx.fill();
  }
  */

  // Draw the arrow for the two-sided version
  if (obj.p < 0)
  {
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
  if (obj.p > 0)
  {
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

  },

  rayIntersection: function(mirror, ray) {
    return objTypes['mirror'].rayIntersection(mirror, ray);
  },

  // When the obj is shot by a ray
  shot: function(mirror, ray, rayIndex, shootPoint) {
    // Treat as a combination of an ideal lens and a planar mirror
    objTypes['lens'].shot(mirror, ray, rayIndex, graphs.point(shootPoint.x, shootPoint.y));

    // Pull the ray backwards
    ray.p1.x = 2 * ray.p1.x - ray.p2.x;
    ray.p1.y = 2 * ray.p1.y - ray.p2.y;

    objTypes['mirror'].shot(mirror, ray, rayIndex, shootPoint);
  },

};
