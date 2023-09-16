// Beam
objTypes['parallel'] = {

  tmp_randomNumbers: [],

  //建立物件 Create the obj
  create: function(mouse) {
    return {type: 'parallel', p1: mouse, p2: mouse, p: 0.5, divergence: 0.0, lambert: false, random: false};
  },

  //顯示屬性方塊 Show the property box
  p_box: function(obj, elem) {
    createNumberAttr(getMsg('brightness'), 0, 1, 0.01, obj.p || 1, function(obj, value) {
      obj.p = value;
    }, elem, getMsg('brightness_note_popover'));
    if (colorMode) {
      createNumberAttr(getMsg('wavelength'), UV_WAVELENGTH, INFRARED_WAVELENGTH, 1, obj.wavelength || GREEN_WAVELENGTH, function(obj, value) {
        obj.wavelength = value;
      }, elem);
    }
    
    if (createAdvancedOptions(typeof obj.divergence != 'undefined' && (obj.divergence != 0.0 || obj.random))) {
      createNumberAttr(getMsg('emissionangle'), 0, 180, 1, obj.divergence || 0.0, function(obj, value) {
        obj.divergence = value;
      }, elem);
      createBooleanAttr(getMsg('lambertian'), obj.lambert, function(obj, value) {
        obj.lambert = value;
      }, elem);
      createBooleanAttr(getMsg('random'), obj.random, function(obj, value) {
        obj.random = value;
      }, elem);
      if (mode == 'images' || mode == 'observer') {
        var note = document.createElement('span');
        note.innerHTML = getMsg('beam_warning');
        note.id = "beam_warning";
        note.style.marginLeft = "0.2em";
        note.style.marginRight = "0.2em";
        note.style.color = "white";
        elem.appendChild(note);
      }
    }
},

  //使用lineobj原型 Use the prototype lineobj
  c_mousedown: objTypes['lineobj'].c_mousedown,
  c_mousemove: objTypes['lineobj'].c_mousemove,
  c_mouseup: objTypes['lineobj'].c_mouseup,
  move: objTypes['lineobj'].move,
  clicked: objTypes['lineobj'].clicked,
  dragging: objTypes['lineobj'].dragging,

  //將物件畫到Canvas上 Draw the obj on canvas
  draw: function(obj, canvas) {
    //var ctx = canvas.getContext('2d');
    var a_l = Math.atan2(obj.p1.x - obj.p2.x, obj.p1.y - obj.p2.y) - Math.PI / 2;
    ctx.strokeStyle = getMouseStyle(obj, colorMode ? wavelengthToColor(obj.wavelength || GREEN_WAVELENGTH, 1) : 'rgb(0,255,0)');
    
    ctx.lineWidth = 4;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(obj.p1.x + Math.sin(a_l) * 2, obj.p1.y + Math.cos(a_l) * 2);
    ctx.lineTo(obj.p2.x + Math.sin(a_l) * 2, obj.p2.y + Math.cos(a_l) * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(128,128,128,255)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(obj.p1.x, obj.p1.y);
    ctx.lineTo(obj.p2.x, obj.p2.y);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
  },

  initRandom: function (obj) {
    if (obj.tmp_randomNumbers == undefined || !obj.random){
      this.clearRandom(obj);
    }
  },

  clearRandom: function (obj) {
    obj.tmp_randomNumbers = [];
  },

  getRandom: function (obj, i) {
    for(j=obj.tmp_randomNumbers.length; j<=i; j++) {
      obj.tmp_randomNumbers.push(Math.random());
    }
    return obj.tmp_randomNumbers[i];
  },

  newRay: function(obj, x, y, normal, angle, gap, brightness_factor=1.0) {
    var ray1 = graphs.ray(graphs.point(x, y), graphs.point(x + Math.sin(normal+angle), y + Math.cos(normal+angle)));
    ray1.brightness_s = Math.min(obj.p / getRayDensity() * brightness_factor, 1) * 0.5;
    ray1.brightness_p = Math.min(obj.p / getRayDensity() * brightness_factor, 1) * 0.5;
    if (obj.lambert) {
      lambert = Math.cos(angle)
      ray1.brightness_s *= lambert;
      ray1.brightness_p *= lambert;
    }
    ray1.isNew = true;
    if (colorMode) {
      ray1.wavelength = obj.wavelength || GREEN_WAVELENGTH;
    }
    ray1.gap = gap;
    addRay(ray1);
  },

  //射出光線 Shoot rays
  shoot: function(obj) {
    var n = graphs.length_segment(obj) * getRayDensity();
    var stepX = (obj.p2.x - obj.p1.x) / n;
    var stepY = (obj.p2.y - obj.p1.y) / n;
    var s = Math.PI * 2 / parseInt(getRayDensity() * 500);
    var sizeX = (obj.p2.x - obj.p1.x);
    var sizeY = (obj.p2.y - obj.p1.y);
    var normal = Math.atan2(stepX, stepY) + Math.PI / 2.0;
    var halfAngle = (obj.divergence || 0.0) / 180.0 * Math.PI * 0.5;
    var numnAngledRays = 1.0 + Math.floor(halfAngle/s) * 2.0;
    var rayBrightness = 1.0 / numnAngledRays;
    this.initRandom(obj);


    if (!obj.random) {
      for (var i = 0.5; i <= n; i++)
      {
        var x = obj.p1.x + i * stepX;
        var y = obj.p1.y + i * stepY;
        this.newRay(obj, x, y, normal, 0.0, i==0, rayBrightness);
        for (var angle = s; angle < halfAngle; angle += s)
        {
          this.newRay(obj, x, y, normal,  angle, i==0, rayBrightness);
          this.newRay(obj, x, y, normal, -angle, i==0, rayBrightness); 
        }
      }
    } else {
      for (var i = 0; i < n*numnAngledRays; i++){
        position = this.getRandom(obj, i*2);
        angle = this.getRandom(obj, i*2+1);
        this.newRay(
          obj,
          obj.p1.x + position * sizeX,
          obj.p1.y + position * sizeY,
          normal,
          (angle*2-1) * halfAngle,
          i==0,
          rayBrightness);
      }
    }
  }

};
