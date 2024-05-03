/**
 * The base class for glasses.
 * @property {string} p - The refractive index function (a function of x and y, related to `origin`) of the glass in math.js string.
 * @property {string} p_tex - The refractive index function of the glass in LaTeX.
 * @property {string} p_der_x - The x derivative of `p` in math.js string.
 * @property {string} p_der_x_tex - The x derivative of `p` in LaTeX.
 * @property {string} p_der_y - The y derivative of `p` in math.js string.
 * @property {string} p_der_y_tex - The y derivative of `p` in LaTeX.
 * @property {Point} origin - The origin of (x,y) used in the above equationns.
 * @property {function} fn_p - The evaluatex function for `p`, where (x,y) has been shifted to the absolute coordinates.
 * @property {function} fn_p_der_x - The evaluatex function for `p_der_x`, where (x,y) has been shifted to the absolute coordinates.
 * @property {function} fn_p_der_y - The evaluatex function for `p_der_y`, where (x,y) has been shifted to the absolute coordinates.
 * @property {number} step_size - The step size for the ray trajectory equation.
 * @property {number} eps - The epsilon for the intersection calculations.
 */
class BaseGrinGlass extends BaseGlass {

  constructor(scene, jsonObj) {
    super(scene, jsonObj);
    this.initFns();
  }

  populateObjBar(objBar) {
    if (!this.fn_p) {
      this.initFns();
    }
    objBar.createEquation('n(x,y) = ', this.p_tex, function (obj, value) {
      obj.p_tex = value;
      obj.initFns();
    }, getMsg('grin_refractive_index'));

    objBar.createTuple(getMsg('refractiveindex_origin'), '(' + this.origin.x + ',' + this.origin.y + ')', function (obj, value) {
      const commaPosition = value.indexOf(',');
      if (commaPosition != -1) {
        const n_origin_x = parseFloat(value.slice(1, commaPosition));
        const n_origin_y = parseFloat(value.slice(commaPosition + 1, -1));
        obj.origin = geometry.point(n_origin_x, n_origin_y);
        obj.initFns();
      }
    });

    if (objBar.showAdvanced(!this.arePropertiesDefault(['step_size']))) {
      objBar.createNumber(getMsg('step_size'), 0.1, 1, 0.1, this.step_size, function (obj, value) {
        obj.step_size = parseFloat(value);
      }, getMsg('step_size_note_popover'));
    }
    if (objBar.showAdvanced(!this.arePropertiesDefault(['eps']))) {
      objBar.createNumber(getMsg('eps'), 1e-3, 1e-2, 1e-3, this.eps, function (obj, value) {
        obj.eps = parseFloat(value);
      }, getMsg('eps_' + this.constructor.type + '_note_popover'));
    }

    const scene = this.scene;
    if (objBar.showAdvanced(this.scene.symbolicGrin)) {
      objBar.createBoolean(getMsg('symbolic_grin'), this.scene.symbolicGrin, function (obj, value) {
        scene.symbolicGrin = value;
      }, getMsg('symbolic_grin_note_popover'));
    }
  }

  getZIndex() {
    return 0;
  }

  fillGlass(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;

    if (isAboveLight) {
      // Draw the highlight only
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = isHovered ? 'cyan' : ('transparent');
      ctx.fill('evenodd');
      ctx.globalAlpha = 1;
      return;
    }
    ctx.fillStyle = "rgba(255,0,255,0.15)";
    ctx.fill('evenodd');
    ctx.globalAlpha = 1;
  }

  getRefIndexAt(point, ray) {
    return this.fn_p({ x: point.x, y: point.y });
  }

  onRayEnter(ray) {
    if (!ray.bodyMergingObj) {
      ray.bodyMergingObj = this.initRefIndex(ray);
    }
    ray.bodyMergingObj = this.multRefIndex(ray.bodyMergingObj);
  }

  onRayExit(ray) {
    if (!ray.bodyMergingObj) {
      ray.bodyMergingObj = this.initRefIndex(ray);
    }
    ray.bodyMergingObj = this.devRefIndex(ray.bodyMergingObj);
  }


  /* Utility Methods */

  /**
   * Do the partial derivatives of the refractive index function and parse the functions.
   */
  initFns() {
    try {
      this.p = parseTex(this.p_tex).toString().replaceAll("\\cdot", "*").replaceAll("\\frac", "/");
      this.p_der_x = math.derivative(this.p, 'x').toString();
      this.p_der_x_tex = math.parse(this.p_der_x).toTex().replaceAll("{+", "{"); // 'evaluateLatex' function can't and can handle expressions of the form '...num^{+exp}...' and '...num^{exp}...', respectively, where num and exp are numbers
      this.p_der_y = math.derivative(this.p, 'y').toString();
      this.p_der_y_tex = math.parse(this.p_der_y).toTex().replaceAll("{+", "{");
      this.fn_p = evaluateLatex(this.shiftOrigin(this.p_tex));
      this.fn_p_der_x = evaluateLatex(this.shiftOrigin(this.p_der_x_tex));
      this.fn_p_der_y = evaluateLatex(this.shiftOrigin(this.p_der_y_tex));
    } catch (e) {
      console.log("Error initializing functions for GRIN glass: " + e.toString());
      this.error = e.toString();
      delete this.fn_p;
      delete this.fn_p_der_x;
      delete this.fn_p_der_y;
      return;
    }
  }

  /**
   * Shifts the x and y variables in `equation` from related to `this.origin` to  the absolute coordinates.
   * @param {string} equation
   * @returns {string} 
   */
  shiftOrigin(equation) {
    return equation.replaceAll("x", "(x-" + this.origin.x + ")").replaceAll("y", "(y-" + this.origin.y + ")");
  }

  /**
   * @typedef {Object} BodyMergingObj
   * Every ray has a temporary bodyMerging object ("bodyMergingObj") as a property (this property exists only while the ray is inside a region of one or several overlapping grin objects - e.g. grin_circlelens and grin_refractor), which gets updated as the ray enters/exits into/from grin objects, using the "multRefIndex"/"devRefIndex" function, respectively.
   * @property {function} fn_p - The refractive index function for the equivalent region of the simulation.
   * @property {function} fn_p_der_x - The x derivative of `fn_p` for the equivalent region of the simulation.
   * @property {function} fn_p_der_y - The y derivative of `fn_p` for the equivalent region of the simulation.
   */
  
  /**
   * Receives a bodyMerging object and returns a new bodyMerging object for the overlapping region of `bodyMergingObj` and the current GRIN glass.
   * @param {BodyMergingObj} bodyMergingObj 
   * @returns {BodyMergingObj}
   */
  multRefIndex(bodyMergingObj) {
    if (this.scene.symbolicGrin) {
      let mul_p = math.simplify('(' + bodyMergingObj.p + ')*' + '(' + this.shiftOrigin(this.p) + ')').toString();

      let mul_fn_p = evaluateLatex(math.parse(mul_p).toTex());

      let mul_fn_p_der_x = evaluateLatex(math.derivative(mul_p, 'x').toTex());

      let mul_fn_p_der_y = evaluateLatex(math.derivative(mul_p, 'y').toTex());

      return { p: mul_p, fn_p: mul_fn_p, fn_p_der_x: mul_fn_p_der_x, fn_p_der_y: mul_fn_p_der_y };
    } else {
      let [fn_p, fn_p_der_x, fn_p_der_y, new_fn_p, new_fn_p_der_x, new_fn_p_der_y] = [this.fn_p, this.fn_p_der_x, this.fn_p_der_y, bodyMergingObj.fn_p, bodyMergingObj.fn_p_der_x, bodyMergingObj.fn_p_der_y];

      let mul_fn_p = (function (fn_p, new_fn_p) {
        return function (param) {
          return fn_p(param) * new_fn_p(param);
        };
      })(fn_p, new_fn_p);

      let mul_fn_p_der_x = (function (fn_p, fn_p_der_x, new_fn_p, new_fn_p_der_x) {
        return function (param) {
          return fn_p(param) * new_fn_p_der_x(param) + fn_p_der_x(param) * new_fn_p(param); // product chain rule
        };
      })(fn_p, fn_p_der_x, new_fn_p, new_fn_p_der_x);

      let mul_fn_p_der_y = (function (fn_p, fn_p_der_y, new_fn_p, new_fn_p_der_y) {
        return function (param) {
          return fn_p(param) * new_fn_p_der_y(param) + fn_p_der_y(param) * new_fn_p(param); // product chain rule
        };
      })(fn_p, fn_p_der_y, new_fn_p, new_fn_p_der_y);

      return { fn_p: mul_fn_p, fn_p_der_x: mul_fn_p_der_x, fn_p_der_y: mul_fn_p_der_y };
    }
  }

  /**
   * Receives a bodyMerging object and returns a new bodyMerging object for the region of `bodyMergingObj` excluding current GRIN glass.
   * @param {BodyMergingObj} bodyMergingObj 
   * @returns {BodyMergingObj}
   */
  devRefIndex(bodyMergingObj) {
    if (this.scene.symbolicGrin) {
      let dev_p = math.simplify('(' + bodyMergingObj.p + ')/' + '(' + this.shiftOrigin(this.p) + ')').toString();

      let dev_fn_p = evaluateLatex(math.parse(dev_p).toTex());

      let dev_fn_p_der_x = evaluateLatex(math.derivative(dev_p, 'x').toTex());

      let dev_fn_p_der_y = evaluateLatex(math.derivative(dev_p, 'y').toTex());

      return { p: dev_p, fn_p: dev_fn_p, fn_p_der_x: dev_fn_p_der_x, fn_p_der_y: dev_fn_p_der_y };
    } else {
      let [fn_p, fn_p_der_x, fn_p_der_y, new_fn_p, new_fn_p_der_x, new_fn_p_der_y] = [this.fn_p, this.fn_p_der_x, this.fn_p_der_y, bodyMergingObj.fn_p, bodyMergingObj.fn_p_der_x, bodyMergingObj.fn_p_der_y];

      let dev_fn_p = (function (fn_p, new_fn_p) {
        return function (param) {
          return new_fn_p(param) / fn_p(param);
        };
      })(fn_p, new_fn_p);

      let dev_fn_p_der_x = (function (fn_p, fn_p_der_x, new_fn_p, new_fn_p_der_x) {
        return function (param) {
          return new_fn_p_der_x(param) / fn_p(param) - new_fn_p(param) * fn_p_der_x(param) / (fn_p(param) ** 2); // product chain rule
        };
      })(fn_p, fn_p_der_x, new_fn_p, new_fn_p_der_x);

      let dev_fn_p_der_y = (function (fn_p, fn_p_der_y, new_fn_p, new_fn_p_der_y) {
        return function (param) {
          return new_fn_p_der_y(param) / fn_p(param) - new_fn_p(param) * fn_p_der_y(param) / (fn_p(param) ** 2); // product chain rule
        };
      })(fn_p, fn_p_der_y, new_fn_p, new_fn_p_der_y);

      return { fn_p: dev_fn_p, fn_p_der_x: dev_fn_p_der_x, fn_p_der_y: dev_fn_p_der_y };
    }
  }

  /**
   * Receives a ray, and returns a bodyMerging object for the point ray.p1
   * @param {Ray} ray 
   * @returns {BodyMergingObj}
   */
  initRefIndex(ray) {
    let obj_tmp;
    for (let i = 0; i < this.scene.objs.length; i++) {
      if ((this.scene.objs[i] instanceof BaseGrinGlass) && (scene.objs[i].isOnBoundary(ray.p1) || scene.objs[i].isInsideGlass(ray.p1))) {
        if (!obj_tmp) {
          obj_tmp = {};
          obj_tmp.p = scene.objs[i].shiftOrigin(scene.objs[i].p);
          obj_tmp.fn_p = scene.objs[i].fn_p;
          obj_tmp.fn_p_der_x = scene.objs[i].fn_p_der_x;
          obj_tmp.fn_p_der_y = scene.objs[i].fn_p_der_y;
        } else {
          obj_tmp = scene.objs[i].multRefIndex(obj_tmp);
        }
      }
    }
    if (!obj_tmp) {
      obj_tmp = { p: 1, fn_p: function () { return 1; }, fn_p_der_x: function () { return 0; }, fn_p_der_y: function () { return 0; } };
    }
    return obj_tmp;
  }

  /**
   * Receives two points inside this lens, and returns the next point to where the ray, connecting these two points, will travel, based on the ray trajectory equation (equation 11.1 in the cited text below)
   * Using Euler's method to solve the ray trajectory equation (based on sections 11.1 and 11.2, in the following text: https://doi.org/10.1007/BFb0012092)
  x_der_s and x_der_s_prev are the x-coordinate derivatives with respect to the arc-length parameterization, at two different points (similarly for y_der_s and y_der_s_prev)
   * @param {Point} p1
   * @param {Point} p2
   * @param {Ray} ray
   * @returns 
   */
  step(p1, p2, ray) {
    const len = geometry.distance(p1, p2);
    const x = p2.x;
    const y = p2.y;
    const x_der_s_prev = (p2.x - p1.x) / len;
    const y_der_s_prev = Math.sign(p2.y - p1.y) * Math.sqrt(1 - x_der_s_prev ** 2);

    const x_der_s = x_der_s_prev + this.step_size * (ray.bodyMergingObj.fn_p_der_x({ x: x, y: y }) * (1 - x_der_s_prev ** 2) - ray.bodyMergingObj.fn_p_der_y({ x: x, y: y }) * x_der_s_prev * y_der_s_prev) / ray.bodyMergingObj.fn_p({ x: x, y: y });
    const y_der_s = y_der_s_prev + this.step_size * (ray.bodyMergingObj.fn_p_der_y({ x: x, y: y }) * (1 - y_der_s_prev ** 2) - ray.bodyMergingObj.fn_p_der_x({ x: x, y: y }) * x_der_s_prev * y_der_s_prev) / ray.bodyMergingObj.fn_p({ x: x, y: y });

    const x_new = x + this.step_size * x_der_s;
    const y_new = y + this.step_size * y_der_s;

    return geometry.point(x_new, y_new);
  }




  /* Abstract methods */

  /**
   * Returns `true` if `point` is outside the glass, otherwise returns `false`
   * @param {Point} point 
   */
  isOutsideGlass(point) {
    // To be implemented in subclasses.
  }

  /**
   * Returns `true` if `point` is inside the glass, otherwise returns `false`
   * @param {Point} point 
   */
  isInsideGlass(point) {
    // To be implemented in subclasses.
  }

  /**
   * Returns `true` if `point` is on the boundary of the glass, otherwise returns `false`
   * @param {Point} point 
   */
  isOnBoundary(point) {
    // To be implemented in subclasses.
  }

};
