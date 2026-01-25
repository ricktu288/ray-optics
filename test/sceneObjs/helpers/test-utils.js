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

import Mouse from '../../../src/core/Mouse.js';

// Test utilities for sceneObj tests

/**
 * Creates a mock objBar for testing property modifications
 * @returns {Object} Mock objBar that stores callbacks and can trigger them
 */
export function createMockObjBar() {
  return {
    controls: [],
    targetObj: null,
    setTitle: function() {},
    eventListeners: {},
    setOption: function(func) {
      func(this.targetObj);
      this.emit('edit', null);
    },

    on: function(eventName, callback) {
      if (!this.eventListeners[eventName]) {
        this.eventListeners[eventName] = [];
      }
      this.eventListeners[eventName].push(callback);
    },

    emit: function(eventName, data) {
      if (this.eventListeners[eventName]) {
        this.eventListeners[eventName].forEach(callback => callback(data));
      }
    },

    createNumber: function(label, min, max, step, initValue, callback) {
      const control = {
        label,
        value: initValue,
        updateOnChange: false,
        setValue: (value) => {
          control.value = value;
          callback(this.targetObj, value);
        }
      };
      this.controls.push(control);
      return control;
    },

    createBoolean: function(label, initValue, callback, info, updateOnChange = false) {
      const control = {
        label,
        value: initValue,
        updateOnChange,
        setValue: (value) => {
          control.value = value;
          callback(this.targetObj, value);
          if (updateOnChange) {
            this.emit('requestUpdate', null);
          }
        }
      };
      this.controls.push(control);
      return control;
    },

    createText: function(label, initValue, callback) {
      const control = {
        label,
        value: initValue,
        updateOnChange: false,
        setValue: (value) => {
          control.value = value;
          callback(this.targetObj, value);
        }
      };
      this.controls.push(control);
      return control;
    },

    createDropdown: function(label, value, options, callback, info, updateOnChange = false) {
      const control = {
        label,
        value,
        options,
        updateOnChange,
        setValue: (value) => {
          control.value = value;
          callback(this.targetObj, value);
          if (updateOnChange) {
            this.emit('requestUpdate', null);
          }
        }
      };
      this.controls.push(control);
      return control;
    },

    createTuple: function(label, initValue, callback, info) {
      const control = {
        label,
        value: initValue,
        updateOnChange: false,
        setValue: (value) => {
          control.value = value;
          callback(this.targetObj, value);
        }
      };
      this.controls.push(control);
      return control;
    },

    createEquation: function(label, initValue, callback, info) {
      const control = {
        label,
        value: initValue,
        updateOnChange: false,
        setValue: (value) => {
          control.value = value;
          callback(this.targetObj, value);
        }
      };
      this.controls.push(control);
      return control;
    },

    createButton: function(label, callback, updateOnChange = false, icon = null) {
      const control = {
        label,
        updateOnChange,
        click: () => {
          callback(this.targetObj);
          if (updateOnChange) {
            this.emit('requestUpdate', null);
          }
        }
      };
      this.controls.push(control);
      return control;
    },

    createStrokeStyleControl: function(label, currentStyle, themeStyle, onUpdate, onReset) {
      const control = {
        label,
        value: currentStyle || themeStyle || {},
        setValue: (value) => {
          control.value = value;
          onUpdate(value);
        },
        reset: () => {
          onReset(this.targetObj);
        }
      };
      this.controls.push(control);
      return control;
    },

    createFillStyleControl: function(label, currentStyle, themeStyle, onUpdate, onReset) {
      const control = {
        label,
        value: currentStyle || themeStyle || {},
        setValue: (value) => {
          control.value = value;
          onUpdate(value);
        },
        reset: () => {
          onReset(this.targetObj);
        }
      };
      this.controls.push(control);
      return control;
    },

    createNote: function(content) {
      const control = {
        type: 'note',
        content
      };
      this.controls.push(control);
      return control;
    },

    createInfoBox: function(info, elem) {
      // Mock implementation - no need to actually create popover in tests
      return null;
    },

    showAdvanced: function() {
      return true;
    }
  };

}

/**
 * Creates a mock editor for testing
 * @returns {Object} Mock editor with isConstructing state
 */
export function createMockEditor() {
  return {
    isConstructing: true
  };
}

/**
 * A mock user for simulating interactions with scene objects
 */
export class MockUser {
  constructor(targetObj) {
    this.targetObj = targetObj;
    this.objBar = createMockObjBar();
    this.objBar.targetObj = targetObj;
    this.targetObj.scene.editor = createMockEditor();
    this.isFirstConstructMouseDown = true;

    // Listen for object bar updates
    this.objBar.on('requestUpdate', () => {
      this.updateObjBar();
    });
  }

  /**
 * Creates a Mouse instance at the specified position
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Mouse} Mouse instance at the specified position
 */
  mouse(x, y) {
    return new Mouse(
      { x, y },
      {
        scale: this.targetObj.scene.scale,
        gridSize: this.targetObj.scene.gridSize,
        snapToGrid: this.targetObj.scene.snapToGrid,
      }
    );
  }

  /**
   * Update the object bar controls
   */
  updateObjBar() {
    // Clear existing controls
    this.objBar.controls = [];
    // Populate with new controls
    this.targetObj.populateObjBar(this.objBar);
  }

  /**
   * Get the current value of a control
   * @param {string} label - Property label
   * @returns {any} Current value
   * @throws {Error} If control is not found or multiple controls match
   */
  getValue(label) {
    const matches = this.objBar.controls.filter(c => c.label.includes(label));
    if (matches.length === 0) {
      throw new Error(`No control found with label containing "${label}"`);
    }
    if (matches.length > 1) {
      throw new Error(`Multiple controls found with label containing "${label}": ${matches.map(c => c.label).join(', ')}`);
    }
    return matches[0].value;
  }

  /**
   * Simulate a click at the given coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {boolean} ctrl - If true, simulate a Ctrl + click
   * @param {boolean} shift - If true, simulate a Shift + click
   * @returns {Object|undefined} Result from the mouse event
   */
  click(x, y, ctrl = false, shift = false) {
    const m = this.mouse(x, y);
    if (this.targetObj.scene.editor.isConstructing) {
      if (!this.isFirstConstructMouseDown) {
        this.targetObj.onConstructMouseMove(m, ctrl, shift);
      }
      const downResult = this.targetObj.onConstructMouseDown(m, ctrl, shift);
      if (this.isFirstConstructMouseDown) {
        this.updateObjBar();
        this.isFirstConstructMouseDown = false;
      } else if (downResult?.requiresObjBarUpdate) {
        this.updateObjBar();
      }
      if (downResult?.isDone) {
        this.targetObj.scene.editor.isConstructing = false;
        return downResult;
      }
      const upResult = this.targetObj.onConstructMouseUp(m, ctrl, shift);
      if (upResult?.requiresObjBarUpdate) {
        this.updateObjBar();
      }
      if (upResult?.isDone) {
        this.targetObj.scene.editor.isConstructing = false;
        return upResult;
      }
    } else {
      return this.targetObj.checkMouseOver(m);
    }
  }

  /**
   * Simulate Ctrl + click at the given coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object|undefined} Result from the mouse event
   */
  ctrlClick(x, y) {
    return this.click(x, y, true);
  }

  /**
   * Simulate Shift + click at the given coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object|undefined} Result from the mouse event
   */
  shiftClick(x, y) {
    return this.click(x, y, false, true);
  }

  /**
   * Simulate Ctrl + Shift + click at the given coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object|undefined} Result from the mouse event
   */
  ctrlShiftClick(x, y) {
    return this.click(x, y, true, true);
  }

  /**
   * Simulate a hover at the given coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object|undefined} Result from the mouse event
   */
  hover(x, y) {
    return this.targetObj.checkMouseOver(this.mouse(x, y));
  }

  /**
   * Simulate a mouse down at the given coordinates during construction
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {boolean} ctrl - If true, simulate a Ctrl press
   * @param {boolean} shift - If true, simulate a Shift press
   * @returns {Object|undefined} Result from the mouse event
   */
  mouseDown(x, y, ctrl = false, shift = false) {
    const m = this.mouse(x, y);
    if (this.targetObj.scene.editor.isConstructing) {
      const result = this.targetObj.onConstructMouseDown(m, ctrl, shift);
      if (this.isFirstConstructMouseDown) {
        this.updateObjBar();
        this.isFirstConstructMouseDown = false;
      } else if (result?.requiresObjBarUpdate) {
        this.updateObjBar();
      }
      if (result?.isDone) {
        this.targetObj.scene.editor.isConstructing = false;
      }
      return result;
    }
  }

  /**
   * Simulate a mouse up at the given coordinates during construction
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {boolean} ctrl - If true, simulate a Ctrl press
   * @param {boolean} shift - If true, simulate a Shift press
   * @returns {Object|undefined} Result from the mouse event
   */
  mouseUp(x, y, ctrl = false, shift = false) {
    const m = this.mouse(x, y);
    if (this.targetObj.scene.editor.isConstructing) {
      const result = this.targetObj.onConstructMouseUp(m, ctrl, shift);
      if (result?.requiresObjBarUpdate) {
        this.updateObjBar();
      }
      if (result?.isDone) {
        this.targetObj.scene.editor.isConstructing = false;
      }
      return result;
    }
  }

  /**
   * Simulate a mouse move to the given coordinates during construction
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {boolean} ctrl - If true, simulate a Ctrl press
   * @param {boolean} shift - If true, simulate a Shift press
   * @returns {Object|undefined} Result from the mouse event
   */
  mouseMove(x, y, ctrl = false, shift = false) {
    const m = this.mouse(x, y);
    if (this.targetObj.scene.editor.isConstructing) {
      const result = this.targetObj.onConstructMouseMove(m, ctrl, shift);
      if (result?.requiresObjBarUpdate) {
        this.updateObjBar();
      }
      if (result?.isDone) {
        this.targetObj.scene.editor.isConstructing = false;
      }
      return result;
    }
  }

  /**
   * Simulate a drag from (x1,y1) to (x2,y2)
   * @param {number} x1 - Start X coordinate
   * @param {number} y1 - Start Y coordinate
   * @param {number} x2 - End X coordinate
   * @param {number} y2 - End Y coordinate
   * @param {boolean} initCtrl - Initial Ctrl state
   * @param {boolean} initShift - Initial Shift state
   * @param {boolean} finalCtrl - Final Ctrl state
   * @param {boolean} finalShift - Final Shift state
   * @returns {Object|undefined} Result from the mouse event
   */
  drag(x1, y1, x2, y2, initCtrl = false, initShift = false, finalCtrl = false, finalShift = false) {
    const m1 = this.mouse(x1, y1);
    const m2 = this.mouse(x2, y2);

    if (this.targetObj.scene.editor.isConstructing) {
      const downResult = this.targetObj.onConstructMouseDown(m1, initCtrl, initShift);
      if (this.isFirstConstructMouseDown) {
        this.updateObjBar();
        this.isFirstConstructMouseDown = false;
      } else if (downResult?.requiresObjBarUpdate) {
        this.updateObjBar();
      }
      if (downResult?.isDone) {
        this.targetObj.scene.editor.isConstructing = false;
        return;
      }
      const moveResult = this.targetObj.onConstructMouseMove(m2, initCtrl, initShift);
      if (moveResult?.requiresObjBarUpdate) {
        this.updateObjBar();
      }
      if (moveResult?.isDone) {
        this.targetObj.scene.editor.isConstructing = false;
        return;
      }
      const upResult = this.targetObj.onConstructMouseUp(m2, finalCtrl, finalShift);
      if (upResult?.requiresObjBarUpdate) {
        this.updateObjBar();
      }
      if (upResult?.isDone) {
        this.targetObj.scene.editor.isConstructing = false;
        return;
      }
    } else {
      const dragContext = this.targetObj.checkMouseOver(m1);
      if (dragContext) {
        dragContext.originalObj = this.targetObj.serialize();
        this.targetObj.onDrag(m2, dragContext, finalCtrl, finalShift);
        if (dragContext.requiresObjBarUpdate) {
          this.updateObjBar();
        }
        return dragContext;
      } else {
        return false;
      }
    }
  }

  /**
   * Simulate a ctrl + drag from (x1,y1) to (x2,y2)
   * @param {number} x1 - Start X coordinate
   * @param {number} y1 - Start Y coordinate
   * @param {number} x2 - End X coordinate
   * @param {number} y2 - End Y coordinate
   * @returns {Object|undefined} Result from the mouse event
   */
  ctrlDrag(x1, y1, x2, y2) {
    return this.drag(x1, y1, x2, y2, true, false, true, false);
  }

  /**
   * Simulate a shift + drag from (x1,y1) to (x2,y2)
   * @param {number} x1 - Start X coordinate
   * @param {number} y1 - Start Y coordinate
   * @param {number} x2 - End X coordinate
   * @param {number} y2 - End Y coordinate
   * @returns {Object|undefined} Result from the mouse event
   */
  shiftDrag(x1, y1, x2, y2) {
    return this.drag(x1, y1, x2, y2, false, true, false, true);
  }

  /**
   * Simulate a ctrl + shift + drag from (x1,y1) to (x2,y2)
   * @param {number} x1 - Start X coordinate
   * @param {number} y1 - Start Y coordinate
   * @param {number} x2 - End X coordinate
   * @param {number} y2 - End Y coordinate
   * @returns {Object|undefined} Result from the mouse event
   */
  ctrlShiftDrag(x1, y1, x2, y2) {
    return this.drag(x1, y1, x2, y2, true, true, true, true);
  }

  /**
   * Simulate a move by a vector (dx, dy)
   * @param {number} dx - X coordinate
   * @param {number} dy - Y coordinate
   * @returns {Object|undefined} Result from the mouse event
   */
  move(dx, dy) {
    return this.targetObj.move(dx, dy);
  }

  /**
   * Simulate a rotation by an angle around a center
   * @param {number} angle - Rotation angle in radians
   * @param {Object|null} center - Center of rotation {x, y}, or null for default center
   * @returns {boolean} Result from the rotation
   */
  rotate(angle, center = null) {
    return this.targetObj.rotate(angle, center);
  }

  /**
   * Simulate a scaling by a factor around a center
   * @param {number} scale - Scale factor
   * @param {Object|null} center - Center of scaling {x, y}, or null for default center
   * @returns {boolean} Result from the scaling
   */
  scale(scale, center = null) {
    return this.targetObj.scale(scale, center);
  }

  /**
   * Set a property value through the object bar
   * @param {string} label - Property label
   * @param {any} value - New value
   * @param {integer} index - Index of the control to set after the label
   * @throws {Error} If control is not found or multiple controls match
   */
  set(label, value, index = 0) {
    const matches = this.objBar.controls.filter(c => c.label.includes(label));
    if (matches.length === 0) {
      throw new Error(`No control found with label containing "${label}"`);
    }
    // The control to change is the one in controls with index that of the first match plus the index
    const control = this.objBar.controls[this.objBar.controls.indexOf(matches[0]) + index];
    control.setValue(value);
    if (control.updateOnChange) {
      this.updateObjBar();
    }
  }

  /**
   * Get the current value of a scene property
   * @param {string} label - Property label
   * @returns {any} Current value
   */
  get(label) {
    const matches = this.objBar.controls.filter(c => c.label === label);
    if (matches.length === 0) {
      return null;
    }
    return matches[0].value;
  }

  /**
   * Set a property of the scene.
   * @param {string} label - Property label
   * @param {any} value - New value
   */
  setScene(label, value) {
    this.targetObj.scene[label] = value;
    this.updateObjBar();
  }

  /**
   * Click a button in the object bar with the given label
   * @param {string} label - Button label to find and click
   * @throws {Error} If button is not found or multiple buttons match
   */
  clickButton(label) {
    const matches = this.objBar.controls.filter(c => c.label === label && c.click);
    if (matches.length === 0) {
      throw new Error(`No button found with label "${label}"`);
    }
    if (matches.length > 1) {
      throw new Error(`Multiple buttons found with label "${label}"`);
    }
    matches[0].click();
  }

  /**
   * Simulate an undo action during construction
   * @returns {Object|undefined} Result from the undo event
   */
  undo() {
    if (this.targetObj.scene.editor.isConstructing) {
      const result = this.targetObj.onConstructUndo();
      if (result?.isCancelled) {
        this.targetObj.scene.editor.isConstructing = false;
      }
      return result;
    }
  }
}
