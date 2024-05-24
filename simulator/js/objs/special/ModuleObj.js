/**
 * @typedef {Object} ModuleDef
 * @property {number} numPoints - The number of control points of the module.
 * @property {Array<string>} params - The parameters of the module.
 * @property {Array<Object>} objs - The objects in the module in the form of JSON objects with template syntax.
 */

/**
 * The class for a module object.
 * This feature is experimental and may be changed in the future without backward compatibility.
 * Currently, there is no UI for creating a module object. You can create a module object by directly editing the JSON data of the scene.
 * @property {string} module - The name of the module.
 * @property {ModuleDef} moduleDef - The definition of the module.
 * @property {Array<Point>} points - The control points of the module.
 * @property {Object} params - The parameters of the module.
 * @property {Array<BaseSceneObj>} objs - The expanded objects in the module.
 * @property {number} maxLoopLength - The maximum length of the list in for loops to prevent infinite loops.
 */
objTypes['ModuleObj'] = class extends BaseSceneObj {
  static type = 'ModuleObj';
  static isOptical = true;
  static serializableDefaults = {
    module: null,
    points: null,
    params: null,
    maxLoopLength: 1000,
  };

  constructor(scene, jsonObj) {
    super(scene, jsonObj);

    this.moduleDef = this.scene.modules[this.module];

    // Initialize the control points if not defined
    if (!this.points) {
      this.points = [];
      for (let i = 0; i < this.moduleDef.numPoints; i++) {
        this.points.push(geometry.point(0, 0));
      }
    }

    // Initialize the parameters if not defined
    if (!this.params) {
      this.params = {};
      for (let param of this.moduleDef.params) {
        const parsed = this.parseVariableRange(param, {});
        this.params[parsed.name] = parsed.defaultVal;
      }
    }

    // Expand the objects
    this.objs = [];
    this.expandObjs();
  }

  populateObjBar(objBar) {
    objBar.createNote(this.module);

    for (let param of this.moduleDef.params) {
      const parsed = this.parseVariableRange(param, {});
      objBar.createNumber(parsed.name, parsed.start, parsed.end, parsed.step, this.params[parsed.name], function (obj, value) {
        obj.params[parsed.name] = value;
        obj.expandObjs();
      });
    }

    objBar.createButton(getMsg('demodulize'), function (obj) {
      obj.demodulize();
    });
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    // Sort the expanded objects with z-index.
    let mapped = this.objs.map(function(obj, i) {
      return {index: i, value: obj.getZIndex()};
    });
    mapped.sort(function(a, b) {
      return a.value - b.value;
    });
    // Draw the expanded objects
    for (let j = 0; j < this.objs.length; j++) {
      let i = mapped[j].index;
      this.objs[i].draw(canvasRenderer, isAboveLight, isHovered);
    }

    // Draw the control points
    for (let point of this.points) {
      ctx.beginPath();
      ctx.strokeStyle = isHovered ? 'cyan' : ('gray');
      ctx.arc(point.x, point.y, 2, 0, Math.PI * 2, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2, false);
      ctx.stroke();
    }
  }

  move(diffX, diffY) {
    // Note that translational symmetry is not guaranteed for the module. Some may have absolute positions. So instead of calling `move` of the expanded objects, we move the control points directly to maintain consistency of expansion.

    if (this.points.length === 0) {
      return;
    }

    // Move the control points
    for (let point of this.points) {
      point.x += diffX;
      point.y += diffY;
    }
    this.expandObjs();
  }

  checkMouseOver(mouse) {
    let dragContext = {};

    // Check if the mouse is on any control point
    let click_lensq = Infinity;
    let click_lensq_temp;
    let targetPoint_index = -1;
    for (var i = 0; i < this.points.length; i++) {
      if (mouse.isOnPoint(this.points[i])) {
        click_lensq_temp = geometry.distanceSquared(mouse.pos, this.points[i]);
        if (click_lensq_temp <= click_lensq) {
          click_lensq = click_lensq_temp;
          targetPoint_index = i;
        }
      }
    }
    if (targetPoint_index != -1) {
      dragContext.part = 1;
      dragContext.index = targetPoint_index;
      dragContext.targetPoint = geometry.point(this.points[targetPoint_index].x, this.points[targetPoint_index].y);
      return dragContext;
    }

    // Check if the mouse is on any expanded object
    for (let obj of this.objs) {
      let dragContext1 = obj.checkMouseOver(mouse);
      if (dragContext1) {
        // If the mouse is on any expanded object, then the entire module is considered to be hovered. However, dragging the entire module object is allowed only when there are control points. Otherwise the module is defined with absolute positions and hence cannot be dragged.

        if (this.points.length === 0) {
          dragContext.part = -1;
          if (dragContext1.targetPoint) {
            // Here the mouse is on a control point of the expanded object which is not a control point of the module. The user may expect that the control point is draggable but it is not. So we change the cursor to not-allowed to warn the user.
            dragContext.cursor = 'not-allowed';
          } else {
            dragContext.cursor = 'pointer';
          }
          return dragContext;
        } else {
          const mousePos = mouse.getPosSnappedToGrid();
          dragContext.part = 0;
          dragContext.mousePos0 = mousePos; // Mouse position when the user starts dragging
          dragContext.mousePos1 = mousePos; // Mouse position at the last moment during dragging
          dragContext.snapContext = {};
          return dragContext;
        }
      }
    }

    return null;
  }

  onDrag(mouse, dragContext, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();

    if (dragContext.part == 1) {
      this.points[dragContext.index].x = mousePos.x;
      this.points[dragContext.index].y = mousePos.y;
    }

    if (dragContext.part == 0) {
      if (shift) {
        var mousePosSnapped = mouse.getPosSnappedToDirection(dragContext.mousePos0, [{ x: 1, y: 0 }, { x: 0, y: 1 }], dragContext.snapContext);
      } else {
        var mousePosSnapped = mouse.getPosSnappedToGrid();
        dragContext.snapContext = {}; // Unlock the dragging direction when the user release the shift key
      }
      this.move(mousePosSnapped.x - dragContext.mousePos1.x, mousePosSnapped.y - dragContext.mousePos1.y);
      dragContext.mousePos1 = mousePosSnapped;
    }

    this.expandObjs();
  }

  // Optical methods are not implemented for the module class, since the simulator operates on `scene.opticalObjs` which already expands all the modules.

  /* Utility methods */


  /**
   * Parse the variable range description of the form "name=start:step:end" or "name=start:step:end:default", where start, step, and end are math.js strings.
   * @param {string} str - The variable range description.
   * @param {Object} params - The parameters to be used for evaluating the expressions.
   * @returns {Object} The parsed variable range.
   */
  parseVariableRange(str, params) {
    try {
      let parts = str.split('=');
      let name = parts[0].trim();
      let parts2 = parts[1].split(':');
      let start = parts2[0];
      let step = parts2[1];
      let end = parts2[2];
      let defaultVal = parts2.length == 4 ? parts2[3] : null;
      let startVal = math.evaluate(start, params);
      let stepVal = math.evaluate(step, params);
      let endVal = math.evaluate(end, params);
      return {name: name, start: startVal, step: stepVal, end: endVal, defaultVal: defaultVal};
    } catch (e) {
      console.log(`Error parsing variable range "${str}" with parameters ${JSON.stringify(params)}: ${e}`);
    }
  }

  /**
   * Expand a string with template syntax, where the format "`eqn`" is replaced with the value of "eqn" interpreted as an ASCIIMath expression with a given set of parameters. If the entire string is a single equation, then the result is a number. Otherwise, the result is a string.
   * @param {string} str - The string with template syntax.
   * @param {Object} params - The parameters to be used for evaluating the expressions.
   * @returns {number|string} The expanded string.
   */
  expandString(str, params) {
    try {
      let parts = str.split('`');
      if (parts.length == 3 && parts[0] == '' && parts[2] == '') {

        return math.evaluate(parts[1], params);
      } else {
        let result = '';
        for (let i = 0; i < parts.length; i++) {
          if (i % 2 == 0) {
            result += parts[i];
          } else {
            result += math.evaluate(parts[i], params);
          }
        }
        return result;
      }
    } catch (e) {
      console.log(`Error expanding string "${str}" with parameters ${JSON.stringify(params)}: ${e}`);
    }
  }

  /**
   * Expand a (JavaScript) object with template syntax, where the string values of the object are interpreted with template syntax. Arrays and other objects are expanded recursively.
   * @param {Object} obj - The object with template syntax.
   * @param {Object} params - The parameters to be used for evaluating the expressions.
   * @returns {Object} The expanded object.
   */
  expandObject(obj, params) {
    let result = {};
    for (let key in obj) {
      if (key === 'for' || key === 'if') {
        continue;
      } else if (typeof obj[key] === 'string') {
        result[key] = this.expandString(obj[key], params);
      } else if (Array.isArray(obj[key])) {
        result[key] = this.expandArray(obj[key], params);
      } else if (typeof obj[key] === 'object') {
        result[key] = this.expandObject(obj[key], params);
      } else {
        result[key] = obj[key];
      }
    }
    return result;
  }

  /**
   * Expand an array with template syntax, where the string values of the array are interpreted with template syntax. Arrays and objects are expanded recursively. If an object in the array has a key "for", then the object is expanded multiple times with the given range of values. If the value of "for" is a string, then the range is interpreted with `parseVariableRange`. If the value of "for" is an array of strings, then each string is witn `parseVariableRange` and there are multiple loop variable. If an object in the array has a key "if", then the object is included only if the condition is true.
   * @param {Array} arr - The array with template syntax.
   * @param {Object} params - The parameters to be used for evaluating the expressions.
   * @returns {Array} The expanded array.
   */
  expandArray(arr, params) {
    let result = [];
    for (let obj of arr) {
      try {
        if ('for' in obj) {
          let forObj = obj['for'];
          let loopVars = [];
          if (typeof forObj === 'string') {
            loopVars.push(this.parseVariableRange(forObj, params));
          } else if (Array.isArray(forObj)) {
            for (let forObj1 of forObj) {
              loopVars.push(this.parseVariableRange(forObj1, params));
            }
          }

          const self = this;

          // Expand `loopVars` to a list of objects, each a key-value pair of loop variable names and values (the Cartesian product of the ranges)
          function expandLoopVars(loopVars) {
            if (loopVars.length == 0) {
              return [params];
            } else {
              let result = [];
              let loopVars1 = loopVars.slice(1);
              const loopLength = (loopVars[0].end - loopVars[0].start) / loopVars[0].step + 1;
              if (loopLength > self.maxLoopLength) {
                throw `The length of the loop variable "${loopVars[0].name}" is too large. Please set maxListLength to a larger value.`;
              }
              for (let value = loopVars[0].start; value <= loopVars[0].end; value += loopVars[0].step) {
                for (let obj of expandLoopVars(loopVars1)) {
                  let obj1 = Object.assign({}, obj);
                  obj1[loopVars[0].name] = value;
                  result.push(obj1);
                }
              }
              return result;
            }
          }

          const loopParams = expandLoopVars(loopVars);

          if (loopParams.length > this.maxLoopLength) {
            throw `The length of the loop is too large. Please set maxListLength to a larger value.`;
          }

          for (let loopParam of loopParams) {
            if ('if' in obj && !math.evaluate(obj['if'], loopParam)) {
              continue;
            }
            result.push(this.expandObject(obj, loopParam));
          }

        } else if ('if' in obj) {
          if (math.evaluate(obj['if'], params)) {
            result.push(this.expandObject(obj, params));
          }
        } else if (typeof obj === 'string') {
          result.push(this.expandString(obj, params));
        } else if (Array.isArray(obj)) {
          result.push(this.expandArray(obj, params));
        } else if (typeof obj === 'object') {
          result.push(this.expandObject(obj, params));
        } else {
          result.push(obj);
        }
      } catch (e) {
        console.log(`Error expanding object ${JSON.stringify(obj)} in array with parameters ${JSON.stringify(params)}: ${e}`);
      }
    }
    return result;
  }

  /**
   * Expand the objects in the module.
   */
  expandObjs() {
    // Construct the full parameters including the coordinates of points with names "x_1", "y_1", "x_2", "y_2", ...
    const fullParams = {};
    for (let name in this.params) {
      fullParams[name] = this.params[name];
    }
    for (let i = 0; i < this.points.length; i++) {
      fullParams['x_' + (i+1)] = this.points[i].x;
      fullParams['y_' + (i+1)] = this.points[i].y;
    }
    

    const expandedObjs = this.expandArray(this.moduleDef.objs, fullParams);

    this.objs = expandedObjs.map(objData =>
      new objTypes[objData.type](this.scene, objData)
    );
  }

  /**
   * Demodulize the module object.
   */
  demodulize() {
    // Remove the module object and add the expanded objects to the scene
    removeObj(this.scene.objs.indexOf(this));
    for (let obj of this.objs) {
      this.scene.objs.push(obj);
    }
    draw(false, true);
  }
}
