/**
 * Diffraction Grating
 * Tools -> Blocker -> Diffraction Grating
 * It is in the blocker category since the model we use is a blocker with slits.
 * @property {Point} p1 - The first endpoint of the line segment.
 * @property {Point} p2 - The second endpoint of the line segment.
 * @property {number} line_density - The number of lines per millimeter.
 * @property {number} slit_ratio - The ratio of the slit width to the line interval.
 * @property {boolean} mirrored - Whether the diffraction grating is reflective.
 */
objTypes['diffractiongrating'] = class extends LineObjMixin(BaseSceneObj) {
  static type = 'diffractiongrating';
  static isOptical = true;
  static serializableDefaults = {
    p1: null,
    p2: null,
    line_density: 1000,
    slit_ratio: 0.5,
    mirrored: false
  };

  populateObjBar(objBar) {
    objBar.createNumber(getMsg('lines/mm'), 1, 2500, 5, this.line_density, function (obj, value) {
      obj.line_density = value;
    });

    if (objBar.showAdvanced(!this.arePropertiesDefault(['slit_ratio']))) {
      objBar.createNumber(getMsg('slit_ratio'), 0, 1, 0.001, this.slit_ratio, function (obj, value) {
        obj.slit_ratio = value;
      });
    }

    if (objBar.showAdvanced(!this.arePropertiesDefault(['mirrored']))) {
      objBar.createBoolean(getMsg('mirrored'), this.mirrored, function (obj, value) {
        obj.mirrored = value;
      });
    }

    if (this.scene.mode == 'images' || this.scene.mode == 'observer') {
      objBar.createNote(getMsg('image_detection_warning'));
    }

    if (!this.scene.colorMode) {
      objBar.createNote(getMsg('non_color_mode_warning'));
    }
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    if (this.mirrored) {
      ctx.strokeStyle = getMouseStyle(this, 'rgb(168,168,168)');
      ctx.beginPath();
      ctx.moveTo(this.p1.x, this.p1.y);
      ctx.lineTo(this.p2.x, this.p2.y);
      ctx.stroke();
    }
    ctx.strokeStyle = getMouseStyle(this, 'rgb(124,62,18)');
    ctx.lineWidth = 2;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.setLineDash([4 * (1 - this.slit_ratio), 4 * this.slit_ratio]);
    ctx.moveTo(this.p1.x, this.p1.y);
    ctx.lineTo(this.p2.x, this.p2.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
  }

  checkRayIntersects(ray) {
    return this.checkRayIntersectsShape(ray);
  }

  onRayIncident(ray, rayIndex, incidentPoint) {
    const mm_in_nm = 1 / 1000000;
    var rx = ray.p1.x - incidentPoint.x;
    var ry = ray.p1.y - incidentPoint.y;
    var mx = this.p2.x - this.p1.x;
    var my = this.p2.y - this.p1.y;

    var wavelength = (ray.wavelength || GREEN_WAVELENGTH) * mm_in_nm;
    var interval = 1 / this.line_density;
    var slit_width = interval * this.slit_ratio;

    //Find which side the incoming ray is hitting the diffraction line segment
    var crossProduct = rx * my - ry * mx;
    var left_point = crossProduct > 0 ? this.p1 : this.p2;

    //If mirrored, reflect the rays rather than pass them
    var mirror = this.mirrored ? -1 : 1;

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

      // This formula may not be accurate when `diffracted_angle` is large. This is warned in the popover of the tool.
      var intensity = slit_width * slit_width / (interval * interval) * Math.pow(sinc_arg, 2);
      
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
  }
};