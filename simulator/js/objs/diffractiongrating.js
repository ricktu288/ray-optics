// Blocker -> Diffraction Grating
objTypes['diffractiongrating'] = {

  // Create the obj
  create: function (constructionPoint) {
    return { type: 'diffractiongrating', p1: constructionPoint, p2: constructionPoint, line_density: 1000, slit_ratio: 0.5, mirrored: false };
  },


  // Use the prototype lineobj
  onConstructMouseDown: objTypes['lineobj'].onConstructMouseDown,
  onConstructMouseMove: objTypes['lineobj'].onConstructMouseMove,
  onConstructMouseUp: objTypes['lineobj'].onConstructMouseUp,
  move: objTypes['lineobj'].move,
  checkMouseOver: objTypes['lineobj'].checkMouseOver,
  onDrag: objTypes['lineobj'].onDrag,
  checkRayIntersects: objTypes['lineobj'].checkRayIntersects,

  // Draw the obj on canvas
  draw: function (obj, canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    if (obj.mirrored) {
      ctx.strokeStyle = getMouseStyle(obj, 'rgb(168,168,168)');
      ctx.beginPath();
      ctx.moveTo(obj.p1.x, obj.p1.y);
      ctx.lineTo(obj.p2.x, obj.p2.y);
      ctx.stroke();
    }
    ctx.strokeStyle = getMouseStyle(obj, 'rgb(124,62,18)');
    ctx.lineWidth = 2;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.setLineDash([4 * (1 - obj.slit_ratio), 4 * obj.slit_ratio]);
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p2.x, obj.p2.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
  },

  // Show the property box
  populateObjBar: function (obj, objBar) {
    objBar.createNumber(getMsg('lines/mm'), 1, 2500, 5, obj.line_density, function (obj, value) {
      obj.line_density = value;
    });

    if (objBar.showAdvanced(obj.slit_ratio != 0.5 || obj.mirrored)) {
      objBar.createNumber(getMsg('slit_ratio'), 0, 1, 0.001, obj.slit_ratio, function (obj, value) {
        obj.slit_ratio = value;
      });
      objBar.createBoolean(getMsg('mirrored'), obj.mirrored, function (obj, value) {
        obj.mirrored = value;
      });
    }

    if (scene.mode == 'images' || scene.mode == 'observer') {
      objBar.createNote(getMsg('image_detection_warning'));
    }

    if (!scene.colorMode) {
      objBar.createNote(getMsg('non_color_mode_warning'));
    }
  },

  // When the obj is shot by a ray
  onRayIncident: function (obj, ray, rayIndex, incidentPoint) {
    const mm_in_nm = 1 / 1000000;
    var rx = ray.p1.x - incidentPoint.x;
    var ry = ray.p1.y - incidentPoint.y;
    var mx = obj.p2.x - obj.p1.x;
    var my = obj.p2.y - obj.p1.y;

    var wavelength = (ray.wavelength || GREEN_WAVELENGTH) * mm_in_nm;
    var interval = 1 / obj.line_density;
    var slit_width = interval * obj.slit_ratio;

    //Find which side the incoming ray is hitting the diffraction line segment
    var crossProduct = rx * my - ry * mx;
    var left_point = crossProduct > 0 ? obj.p1 : obj.p2;

    //If mirrored, reflect the rays rather than pass them
    var mirror = obj.mirrored ? -1 : 1;

    //Find angles
    var theta_left = Math.PI - Math.atan2(left_point.y - incidentPoint.y, left_point.x - incidentPoint.x);
    var theta_i = Math.PI - Math.atan2(ry, rx);
    var incidence_angle = Math.PI / 2 - (theta_left < theta_i ? theta_left + 2 * Math.PI - theta_i : theta_left - theta_i);

    var m_min = -Math.floor(interval / wavelength * (1 - Math.sin(incidence_angle)));
    var m_max = -Math.ceil(interval / wavelength * (-1 - Math.sin(incidence_angle)));

    let newRays = [];

    for (var m = m_min; m <= m_max; m++) {
      var diffracted_angle = Math.asin(Math.sin(incidence_angle) - m * wavelength / interval);

      var rot_c = Math.cos(mirror * (-Math.PI / 2 - diffracted_angle));
      var rot_s = Math.sin(mirror * (-Math.PI / 2 - diffracted_angle));
      var diffracted_ray = geometry.line(incidentPoint, geometry.point(incidentPoint.x + (left_point.x - incidentPoint.x) * rot_c - (left_point.y - incidentPoint.y) * rot_s, incidentPoint.y + (left_point.x - incidentPoint.x) * rot_s + (left_point.y - incidentPoint.y) * rot_c));

      var phase_diff = 2 * Math.PI * slit_width / wavelength * (Math.sin(incidence_angle) - Math.sin(diffracted_angle))
      var sinc_arg = (phase_diff == 0) ? 1 : Math.sin(phase_diff / 2) / (phase_diff / 2);
      var intensity = slit_width * slit_width / (interval * interval) * Math.pow(sinc_arg, 2);

      if (m == 0) {
        console.log(intensity)
      }
      diffracted_ray.wavelength = ray.wavelength;
      diffracted_ray.brightness_s = ray.brightness_s * intensity;
      diffracted_ray.brightness_p = ray.brightness_p * intensity;

      // There is currently no good way to make image detection work here. So just set gap to true to disable image detection for the diffracted rays.
      diffracted_ray.gap = true;

      newRays.push(diffracted_ray);
    }

    return {
      isAbsorbed: true,
      newRays: newRays
    };
  },
};