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

import BaseSceneObj from '../BaseSceneObj.js';
import geometry from '../../geometry.js';
import i18next from 'i18next';
import * as sceneObjs from '../../sceneObjs.js';
import * as math from 'mathjs';

/**
 * @typedef {Object} ModuleDef
 * @property {number} numPoints - The number of control points of the module.
 * @property {Array<string>} params - The parameters of the module.
 * @property {Array<string>} vars - Mathematical variable definitions that can be used in the objects.
 * @property {Array<Object>} objs - The objects in the module in the form of JSON objects with template syntax.
 * @property {number} maxLoopLength - The maximum length of the list in for loops to prevent infinite loops.
 */

/**
 * The class for a module object.
 * Currently, there is no UI for creating a module object. You can create a module object by directly editing the JSON data of the scene.
 * @class
 * @memberof sceneObjs
 * @extends BaseSceneObj
 * @property {string} module - The name of the module.
 * @property {ModuleDef} moduleDef - The definition of the module.
 * @property {Array<Point>} points - The control points of the module.
 * @property {Object} params - The parameters of the module.
 * @property {Array<BaseSceneObj>} objs - The expanded objects in the module.
 */
class ModuleObj extends BaseSceneObj {
  static type = 'ModuleObj';
  static isOptical = true;
  static serializableDefaults = {
    module: null,
    points: null,
    params: null,
    notDone: false
  };

  constructor(scene, jsonObj) {
    super(scene, jsonObj);

    if (!this.module) return;
    this.moduleDef = this.scene.modules[this.module];

    // Check if the module definition exists
    if (!this.moduleDef) {
      this.scene.error = i18next.t('simulator:generalErrors.unknownModule', { module: this.module }); // Here the error is stored in the scene, not the object, as it is logically similar to an unknown object type in the scene.
      
      // Create an empty module definition
      this.moduleDef = {
        numPoints: 0,
        params: [],
        objs: []
      };
    }

    // Check for unknown keys in the module definition
    const knownModuleKeys = ['importedFromBeta', 'numPoints', 'params', 'vars', 'objs', 'maxLoopLength'];
    for (const key in this.moduleDef) {
      if (!knownModuleKeys.includes(key)) {
        this.scene.error = i18next.t('simulator:generalErrors.unknownModuleKey', { key, module: this.module }); // Here the error is stored in the scene, not the object, to prevent further errors occurring in the module from replacing it, and also because this error likely indicates an incompatible scene version.
      }
    }

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
    objBar.setTitle(i18next.t('main:meta.colon', { name: i18next.t('simulator:sceneObjs.ModuleObj.module'), value: '<span style="font-family: monospace; padding-right:2px">' + this.module + '</span>' }));

    if (this.notDone) return;

    try {
      for (let param of this.moduleDef.params) {
        const parsed = this.parseVariableRange(param, {});
        objBar.createNumber('<span style="font-family: monospace;">' + parsed.name + '</span>', parsed.start, parsed.end, parsed.step, this.params[parsed.name], function (obj, value) {
          obj.params[parsed.name] = value;
          obj.expandObjs();
        });
      }
    } catch (e) {
      this.error = e;
    }

    objBar.createButton(i18next.t('simulator:sceneObjs.ModuleObj.demodulize'), function (obj) {
      obj.demodulize();
    }, false, `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-box-arrow-down-left" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M7.364 12.5a.5.5 0 0 0 .5.5H14.5a1.5 1.5 0 0 0 1.5-1.5v-10A1.5 1.5 0 0 0 14.5 0h-10A1.5 1.5 0 0 0 3 1.5v6.636a.5.5 0 1 0 1 0V1.5a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 .5.5v10a.5.5 0 0 1-.5.5H7.864a.5.5 0 0 0-.5.5"/>
      <path fill-rule="evenodd" d="M0 15.5a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 0-1H1.707l8.147-8.146a.5.5 0 0 0-.708-.708L1 14.293V10.5a.5.5 0 0 0-1 0z"/>
    </svg>
    `);
  }

  draw(canvasRenderer, isAboveLight, isHovered) {
    const ctx = canvasRenderer.ctx;
    const ls = canvasRenderer.lengthScale;

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

    // Draw the control points if not nested in another module
    if (!this.isInModule) {
      ctx.lineWidth = 1 * ls;
      for (let point of this.points) {
        ctx.beginPath();
        ctx.strokeStyle = isHovered ? this.scene.highlightColorCss : canvasRenderer.rgbaToCssColor(this.scene.theme.handlePoint.color);
        ctx.arc(point.x, point.y, 2 * ls, 0, Math.PI * 2, false);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5 * ls, 0, Math.PI * 2, false);
        ctx.stroke();
      }
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

    return false; // It should depend on how the module is implemented. In the future there will be an automatic way to handle coordinate transformations within the module.
  }

  rotate(angle, center = null) {
    // Similar to move(), we operate on control points directly rather than expanded objects
    if (this.points.length === 0) {
      return false;
    }

    // Use the geometric center of control points if no center is provided
    center = center || this.getDefaultCenter();
    
    // Apply rotation to each control point
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    
    for (let point of this.points) {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      
      point.x = center.x + dx * cos - dy * sin;
      point.y = center.y + dx * sin + dy * cos;
    }
    
    // Regenerate the expanded objects with new control point positions
    this.expandObjs();
    
    return false; // Always return false as coordinated transformations are module-dependent
  }

  scale(scale, center = null) {
    // Similar to move(), we operate on control points directly rather than expanded objects
    if (this.points.length === 0) {
      return false;
    }

    // Use the geometric center of control points if no center is provided
    center = center || this.getDefaultCenter();
    
    // Apply scaling to each control point
    for (let point of this.points) {
      point.x = center.x + (point.x - center.x) * scale;
      point.y = center.y + (point.y - center.y) * scale;
    }
    
    // Regenerate the expanded objects with new control point positions
    this.expandObjs();
    
    return false; // Always return false as coordinated transformations are module-dependent
  }

  getDefaultCenter() {
    // Calculate the center as the average of all control points
    if (this.points.length === 0) {
      return;
    }
    
    let sumX = 0;
    let sumY = 0;
    
    for (const point of this.points) {
      sumX += point.x;
      sumY += point.y;
    }
    
    return {
      x: sumX / this.points.length,
      y: sumY / this.points.length
    };
  }

  onConstructMouseDown(mouse, ctrl, shift) {
    const mousePos = mouse.getPosSnappedToGrid();
    if (!this.notDone) {
      // Initialize the construction stage
      this.notDone = true;
      if (this.module !== this.scene.editor.addingModuleName) {
        this.module = this.scene.editor.addingModuleName;
        this.moduleDef = this.scene.modules[this.module];
        // Initialize the parameters
        this.params = {};
        for (let param of this.moduleDef.params) {
          const parsed = this.parseVariableRange(param, {});
          this.params[parsed.name] = parsed.defaultVal;
        }
      }
      this.points = [];
      this.objs = [];
    }

    if (this.points.length < this.moduleDef.numPoints) {
      this.points.push({ x: mousePos.x, y: mousePos.y });
    }
    if (this.points.length == this.moduleDef.numPoints) {
      // All control points have been added.
      this.notDone = false;

      // Expand the objects
      this.expandObjs();
      return {
        requiresObjBarUpdate: true
      };
    }
  }

  onConstructMouseUp(mouse, ctrl, shift) {
    if (this.points.length == this.moduleDef.numPoints) {
      return {
        isDone: true
      };
    }
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

  getError() {
    if (this.error) {
      return this.error;
    } else {
      let errors = [];
      for (let i in this.objs) {
        let error = this.objs[i].getError();
        if (error) {
          errors.push(`obj.objs[${i}] ${this.objs[i].constructor.type}: ${error}`);
        }
      }
      
      if (errors.length > 0) {
        return "In expanded objects:\n" + errors.join("\n");
      }
    }

    return null;
  }

  getWarning() {
    if (this.warning) {
      return this.warning;
    } else {
      let warnings = [];
      for (let i in this.objs) {
        let warning = this.objs[i].getWarning();
        if (warning) {
          warnings.push(`obj.objs[${i}] ${this.objs[i].constructor.type}: ${warning}`);
        }
      }

      if (warnings.length > 0) {
        return "In expanded objects:\n" + warnings.join("\n");
      }
    }
    return null;
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
      let default_ = parts2.length == 4 ? parts2[3] : null;
      let startVal = math.evaluate(start, params);
      let stepVal = math.evaluate(step, params);
      let endVal = math.evaluate(end, params);
      let defaultVal = default_ === null ? startVal : math.evaluate(default_, params);
      return {name: name, start: startVal, step: stepVal, end: endVal, defaultVal: defaultVal};
    } catch (e) {
      throw i18next.t('simulator:sceneObjs.ModuleObj.variableRangeError', { str, params: JSON.stringify(params), error: e });
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
      
      if ((parts.length == 3 && parts[0] == '' && parts[2] == '') || (parts.length == 2 && parts[0] == '')) {
        // The string is a single single-backtick block. Evaluate to a number.
        if (parts.length == 2) {
          // Use warning instead of error, since in earlier version it was unintentionally allowed.
          this.warning = i18next.t('simulator:sceneObjs.ModuleObj.unclosedMathBlock', { str: "`" + parts[1] });
        }
        return math.evaluate(parts[1], params);
      } else {
        let result = '';
        let inText = true;

        for (let i = 0; i < parts.length; i++) {
          if (inText) {
            // Text part
            result += parts[i];
          } else {
            // Math part. Check if it is a double backtick block.
            if (parts[i] === '' && i < parts.length - 1) {
              // Double backtick begins
              if (i < parts.length - 3 && parts[i+2] === '') {
                // The double backtick block is correctly closed.
                result += this.expandEquation(parts[i+1], params);
                i += 2; // Skip to the next text part
              } else {
                throw new Error(i18next.t('simulator:sceneObjs.ModuleObj.unclosedMathBlock', { str: "``" + parts[i+1] }));
              }
            } else {
              // Single backtick block
              result += math.evaluate(parts[i], params);

              if (i == parts.length - 1) {
                this.warning = i18next.t('simulator:sceneObjs.ModuleObj.unclosedMathBlock', { str: "`" + parts[i] });
              }
            }
          }
          inText = !inText;
        }
        return result;
      }
    } catch (e) {
      throw i18next.t('simulator:sceneObjs.ModuleObj.stringExpansionError', { str, params: JSON.stringify(params), error: e });
    }
  }

  /**
   * Expand an equation with template syntax for double backticks to a LaTeX string.
   * @param {string} str - The equation string to evaluate.
   * @param {Object} params - The parameters to be used for evaluating the expressions.
   * @returns {string} The expanded equation as a LaTeX string.
   */
  expandEquation(str, params) {
    // Parse the expression
    const expr = math.parse(str);
    
    // Define the transform function with a name for recursion
    const transformNode = function (node, path, parent) {
      // Handle variable substitution
      if (node.isSymbolNode && params.hasOwnProperty(node.name)) {
        const value = params[node.name];
        if (typeof value === 'number') {
          return math.parse(value.toString());
        } else if (typeof value === 'string') {
          return math.parse(value);
        }
      }
      // Handle function substitution using this.funcDefs
      else if (node.isFunctionNode && this.funcDefs && this.funcDefs.hasOwnProperty(node.fn.name)) {
        const funcInfo = this.funcDefs[node.fn.name];
        
        if (node.args && node.args.length > 0) {
          // Parse the function body
          let funcExpr = math.parse(funcInfo.body);
          
          // Replace parameters in the function body with the actual arguments
          funcExpr = funcExpr.transform(function (innerNode) {
            if (innerNode.isSymbolNode) {
              // Check if this symbol matches any of the function parameters
              const paramIndex = funcInfo.params.indexOf(innerNode.name);
              if (paramIndex !== -1 && paramIndex < node.args.length) {
                return node.args[paramIndex].clone();
              }
              // Also substitute any other parameters that exist in params
              if (params.hasOwnProperty(innerNode.name)) {
                const value = params[innerNode.name];
                if (typeof value === 'number') {
                  return math.parse(value.toString());
                }
              }
            }
            return innerNode;
          });
          
          // Recursively apply transformation to handle nested functions
          return funcExpr.transform(transformNode);
        }
      }
      return node;
    }.bind(this); // Bind this context so we can access this.funcDefs
    
    // Transform the expression to substitute parameters and functions
    const transformedExpr = expr.transform(transformNode);
    
    // Convert to LaTeX using toTex() method with custom handler
    const latex = transformedExpr.toTex({
      handler: function(node, options) {
        if (node.type === 'SymbolNode') {
          let name = node.name;
          
          // Handle underscores as subscripts for variable names
          if (name.includes('_')) {
            const parts = name.split('_');
            const base = parts[0];
            const subscript = parts.slice(1).join('_'); // Everything after first underscore
            // Apply backslash rule to base: single letter stays as-is, multi-letter gets backslash. The space is added to avoid, e.g., "2*x" from becoming "2\\cdotx".
            const formattedBase = base.length === 1 ? ' ' + base : '\\' + base;
            return formattedBase + '_{' + subscript + '}';
          } else {
            // No underscore - apply backslash rule to entire name
            const formattedName = name.length === 1 ? ' ' + name : '\\' + name;
            return formattedName;
          }
        }
        
        else if (node.type === 'FunctionNode') {
          const name = node.fn.name || node.fn;
          const args = node.args || [];
          
          // Handle special function name replacements
          switch (name) {
            case 'log':
              return '\\log\\left(' + args[0].toTex(options) + '\\right)';
              
            case 'asin':
              return '\\arcsin\\left(' + args[0].toTex(options) + '\\right)';
              
            case 'acos':
              return '\\arccos\\left(' + args[0].toTex(options) + '\\right)';
              
            case 'atan':
              return '\\arctan\\left(' + args[0].toTex(options) + '\\right)';
              
            case 'asinh':
              return '\\operatorname{asinh}\\left(' + args[0].toTex(options) + '\\right)';
              
            case 'acosh':
              return '\\operatorname{acosh}\\left(' + args[0].toTex(options) + '\\right)';
              
            case 'atanh':
              return '\\operatorname{atanh}\\left(' + args[0].toTex(options) + '\\right)';
              
            case 'floor':
              return '\\operatorname{floor}\\left(' + args[0].toTex(options) + '\\right)';
              
            case 'ceil':
              return '\\operatorname{ceil}\\left(' + args[0].toTex(options) + '\\right)';

            case 'round':
              return '\\operatorname{round}\\left(' + args[0].toTex(options) + '\\right)';
              
            case 'sign':
              return '\\operatorname{sign}\\left(' + args[0].toTex(options) + '\\right)';
          }
          
          // Fall back to default behavior for other functions
          return undefined; // This tells math.js to use default rendering
        }

        // Fall back to default behavior for other node types
        return undefined;
      }
    });
    
    return latex;
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
        const isPlainObject = typeof obj === 'object' && obj !== null && !Array.isArray(obj);
        if (isPlainObject && 'for' in obj) {
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
              if (loopLength > (self.moduleDef.maxLoopLength || 1000)) {
                throw i18next.t('simulator:sceneObjs.ModuleObj.loopVariableTooLarge', { name: loopVars[0].name });
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

          if (loopParams.length > (this.moduleDef.maxLoopLength || 1000)) {
            throw i18next.t('simulator:sceneObjs.ModuleObj.loopTooLarge');
          } else {
            for (let loopParam of loopParams) {
              if ('if' in obj && !math.evaluate(obj['if'], loopParam)) {
                continue;
              }
              result.push(this.expandObject(obj, loopParam));
            }
          }

        } else if (isPlainObject && 'if' in obj) {
          if (math.evaluate(obj['if'], params)) {
            result.push(this.expandObject(obj, params));
          }
        } else if (typeof obj === 'string') {
          result.push(this.expandString(obj, params));
        } else if (Array.isArray(obj)) {
          result.push(this.expandArray(obj, params));
        } else if (isPlainObject) {
          result.push(this.expandObject(obj, params));
        } else {
          result.push(obj);
        }
      } catch (e) {
        throw i18next.t('simulator:sceneObjs.ModuleObj.objectExpansionError', { obj: JSON.stringify(obj), params: JSON.stringify(params), error: e });
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

    fullParams['random'] = this.scene.rng;
    
    // Process variable definitions
    if (this.moduleDef.vars && Array.isArray(this.moduleDef.vars)) {
      try {
        // Initialize function definitions storage
        this.funcDefs = {};
        
        // Extract function definitions for equation template expansion
        for (const varDef of this.moduleDef.vars) {
          // Check if this is a function definition
          const funcDefMatch = varDef.match(/^(\w+)\s*\(\s*([^)]+)\s*\)\s*=\s*(.+)$/);
          if (funcDefMatch) {
            const [, funcName, paramString, funcBody] = funcDefMatch;
            const params = paramString.split(',').map(p => p.trim());
            this.funcDefs[funcName] = {
              params: params,
              body: funcBody
            };
          }
          
          math.evaluate(varDef, fullParams);
        }
      } catch (e) {
        this.error = i18next.t('simulator:sceneObjs.ModuleObj.variableDefinitionError', { params: JSON.stringify(fullParams), error: e });
        return;
      }
    }
    this.warning = null;
    this.error = null;

    try {
      const expandedObjs = this.expandArray(this.moduleDef.objs, fullParams);

      this.objs = [];
      for (const objData of expandedObjs) {
        if (!sceneObjs[objData.type]) {
          this.error = i18next.t('simulator:generalErrors.unknownObjectType', { type: objData.type });
          return;
        }
        this.objs.push(new sceneObjs[objData.type](this.scene, objData));
        this.objs[this.objs.length - 1].isInModule = true;
      }
    } catch (e) {
      this.error = e;
    }
  }

  /**
   * Demodulize the module object.
   */
  demodulize() {
    // Remove the module object and add the expanded objects to the scene
    this.scene.removeObj(this.scene.objs.indexOf(this));
    for (let obj of this.objs) {
      obj.isInModule = false;
      this.scene.objs.push(obj);
      if (this.scene.editor) {
        this.scene.editor.selectObj(-1);
      }
    }
  }
}

export default ModuleObj;