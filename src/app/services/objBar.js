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

import * as bootstrap from 'bootstrap';
import MathQuill from 'mathquill';

const MQ = MathQuill.getInterface(2);

/**
 * The object bar class, which is used to create the options/controls for the selected scene object.
 * @class
 */
class ObjBar {
  /**
   * Initialize the object bar.
   * @param {HTMLElement} elem - The element the inputs will be populated to
   * @param {HTMLElement} titleElem - The element that contains the title of the object bar
   */
  initialize(elem, titleElem) {

    /** @property {HTMLElement} elem - The element the inputs will be populated to */
    this.elem = elem;

    /** @property {HTMLElement} titleElem - The element that contains the title of the object bar */
    this.titleElem = titleElem;

    /** @property {boolean} shouldApplyToAll - Whether the "Apply to all" checkbox is checked */
    this.shouldApplyToAll = false;

    /** @property {boolean} shouldShowAdvanced - Whether the advanced options should be shown */
    this.shouldShowAdvanced = false;

    /** @property {SceneObject|null} targetObj - The scene object whose options are being edited */
    this.targetObj = null;

    /** @property {function|null} pendingEvent - The pending event to be called in case the scene object loses focus before the input is finished */
    this.pendingEvent = null;

    /** @property {object} eventListeners - The event listeners of the obj bar. */
    this.eventListeners = {};
  }

  /**
   * Add an event listener to the obj bar.
   * @param {string} eventName - The name of the event.
   * @param {function} callback - The callback function.
   */
  on(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  }

  /**
   * Emit an event.
   * @param {string} eventName - The name of the event.
   * @param {any} data - The data to be passed to the callback functions.
   */
  emit(eventName, data) {
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName].forEach(callback => callback(data));
    }
  }

  /**
   * The event when some value is changed but the editing may not be finished yet.
   * @event ObjBar#edit
   */

  /**
   * The event when the editing is finished.
   * @event ObjBar#editEnd
   */

  /**
   * The event when the entire obj bar should be updated.
   * @event ObjBar#requestUpdate
   */

  /**
   * The event when the advanced options should be enabled.
   * @event ObjBar#showAdvancedEnabled
   * @param {boolean} enabled - Whether the advanced options should be enabled.
   */

  /**
   * The callback function for when a value changes.
   * If "Apply to all" is checked, this function will be called for each scene object of the same type.
   * @callback objBarValueChangeCallback
   * @param {Object} obj - The scene object whose value changed.
   * @param {any} value - The new value.
   */

  /**
   * Set the title of the object bar. If the title is empty, the title element is hidden.
   * @param {string} title - The title of the object bar.
   */
  setTitle(title) {
    if (title) {
      this.titleElem.style.display = 'inline';
      this.titleElem.innerHTML = title;
    } else {
      this.titleElem.style.display = 'none';
    }

    // If the title ends with the full-width parentheses, change the padding-right to avoid over-spacing.
    if (title.endsWith('\uFF09')) {
      this.titleElem.style.paddingRight = '0em';
    } else {
      this.titleElem.style.paddingRight = '0.4em';
    }
  }

  /**
   * Create a number input in the object bar.
   * @param {string} label - The label for the input.
   * @param {number} min - The minimum value for the slider.
   * @param {number} max - The maximum value for the slider.
   * @param {number} step - The step value for the slider.
   * @param {number} value - The initial value.
   * @param {objBarValueChangeCallback} func - The function to call when the value changes.
   * @param {string|null} info - The HTML content for the popover info box. If null (default), no info box is created.
   * @param {boolean} hideSlider - Whether to hide the slider (that is, only show the text input). Default is false.
   */
  createNumber(label, min, max, step, value, func, info, hideSlider) {
    var nobr = document.createElement('span');
    nobr.className = 'obj-bar-nobr';

    if (info) {
      var p_name = document.createElement('span');
      p_name.innerHTML = label;
      nobr.appendChild(p_name);
      this.createInfoBox(info, nobr);
    } else {
      var p_name = document.createElement('span');
      p_name.innerHTML = label + '&nbsp;';
      nobr.appendChild(p_name);
    }


    var objOption_text = document.createElement('input');
    objOption_text.type = 'text';
    if (value == Infinity) {
      objOption_text.value = 'inf';
    } else if (value == -Infinity) {
      objOption_text.value = '-inf';
    } else {
      // Round to 6 decimal places
      objOption_text.value = Math.round(value * 1000000) / 1000000;
    }
    objOption_text.className = 'obj-bar-editable obj-bar-number';
    nobr.appendChild(objOption_text);

    var objOption_range = document.createElement('input');
    objOption_range.type = 'range';
    objOption_range.min = min;
    objOption_range.max = max;
    objOption_range.step = step;
    objOption_range.value = value;
    objOption_range.className = 'form-range';
    if (hideSlider) {
      objOption_range.style.display = 'none';
    }
    nobr.appendChild(objOption_range);

    this.elem.appendChild(nobr);

    var space = document.createTextNode(' ');
    this.elem.appendChild(space);

    const self = this;

    objOption_range.oninput = function () {
      objOption_text.value = objOption_range.value;
      self.setOption(function (obj) {
        func(obj, objOption_range.value * 1);
      });
    };

    objOption_range.onmouseup = function () {
      this.blur();
      self.emit('editEnd', null);
    };

    objOption_range.ontouchend = function () {
      this.blur();
      self.setOption(function (obj) {
        func(obj, objOption_range.value * 1);
      });
      self.emit('editEnd', null);
    };
    objOption_text.onchange = function () {
      if (objOption_text.value.toLowerCase().startsWith('inf')) {
        var value = Infinity;
      } else if (objOption_text.value.toLowerCase().startsWith('-inf')) {
        var value = -Infinity;
      } else {
        var value = objOption_text.value * 1;
      }
      objOption_range.value = value;
      self.setOption(function (obj) {
        func(obj, value);
      });
      self.emit('editEnd', null);
    };
    objOption_text.onkeydown = function (e) {
      e.cancelBubble = true;
      if (e.stopPropagation) e.stopPropagation();
    };
    objOption_text.onclick = function (e) {
      this.select();
    };
  }


  /**
   * Create a tuple input in the object bar.
   * @param {string} label - The label for the input.
   * @param {string} value - The initial value.
   * @param {objBarValueChangeCallback} func - The function to call when the value changes.
   * @param {string|null} info - The HTML content for the popover info box. If null (default), no info box is created.
   */
  createTuple(label, value, func, info) {
    var nobr = document.createElement('span');
    nobr.className = 'obj-bar-nobr';



    if (info) {
      var p_name = document.createElement('span');
      p_name.innerHTML = label;
      nobr.appendChild(p_name);
      this.createInfoBox(info, nobr);
    } else {
      var p_name = document.createElement('span');
      p_name.innerHTML = label + '&nbsp;';
      nobr.appendChild(p_name);
    }


    var objOption_text = document.createElement('input');
    objOption_text.type = 'text';
    objOption_text.value = value;
    objOption_text.style.width = '100px';
    objOption_text.className = 'obj-bar-editable';
    nobr.appendChild(objOption_text);

    this.elem.appendChild(nobr);

    var space = document.createTextNode(' ');
    this.elem.appendChild(space);

    const self = this;

    objOption_text.onchange = function () {
      self.setOption(function (obj) {
        func(obj, objOption_text.value);
      });
    };
    objOption_text.onkeydown = function (e) {
      e.cancelBubble = true;
      if (e.stopPropagation) e.stopPropagation();
    };
    objOption_text.onblur = function () {
      self.emit('editEnd', null);
    };
  }

  /**
   * Create a text input in the object bar.
   * @param {string} label - The label for the input.
   * @param {string} value - The initial value.
   * @param {objBarValueChangeCallback} func - The function to call when the value changes.
   */
  createText(label, value, func) {
    var p_name = document.createElement('span');
    p_name.innerHTML = '&nbsp;' + label + '&nbsp;';
    this.elem.appendChild(p_name);
    var objOption_text = document.createElement('textarea');
    objOption_text.className = 'obj-bar-editable';
    objOption_text.value = value;
    objOption_text.cols = 25;
    objOption_text.rows = 1;
    this.elem.appendChild(objOption_text);
    var space = document.createTextNode(' ');
    this.elem.appendChild(space);

    const self = this;

    var textEditEndTimerId = null;

    objOption_text.oninput = function () {
      // if user starts adding more than one line, auto expand the text area
      if (objOption_text.value.split('\n').length > 1 && objOption_text.rows == 1) {
        objOption_text.rows = 3;
      }
      self.setOption(function (obj) {
        func(obj, objOption_text.value);
      });

      if (textEditEndTimerId) {
        clearTimeout(textEditEndTimerId);
      }
      textEditEndTimerId = setTimeout(function () {
        self.emit('editEnd', null);
      }, 1000);
    };
    objOption_text.onkeydown = function (e) {
      e.cancelBubble = true;
      if (e.stopPropagation) e.stopPropagation();
    };
    objOption_text.onblur = function () {
      self.emit('editEnd', null);
    };
    this.pendingEvent = function () {
      if (textEditEndTimerId) {
        clearTimeout(textEditEndTimerId);
      }
      self.emit('editEnd', null);
    };
  }

  /**
   * Create a boolean input in the object bar.
   * @param {string} label - The label for the input.
   * @param {boolean} value - The initial value.
   * @param {objBarValueChangeCallback} func - The function to call when the value changes.
   * @param {string|null} info - The HTML content for the popover info box. If null (default), no info box is created.
   * @param {boolean} [updateOnChange=false] - Whether to update the entire obj bar (e.g. show different options) when the checkbox changes.
   */
  createBoolean(label, value, func, info, updateOnChange = false) {
    var nobr = document.createElement('span');
    nobr.className = 'obj-bar-nobr';

    if (info) {
      var p_name = document.createElement('span');
      p_name.innerHTML = label;
      nobr.appendChild(p_name);
      this.createInfoBox(info, nobr);
    } else {
      var p_name = document.createElement('span');
      p_name.innerHTML = label + '&nbsp;';
      nobr.appendChild(p_name);
    }

    var wrapper = document.createElement('span');
    wrapper.className = 'form-switch';

    var objOption_checkbox = document.createElement('input');
    objOption_checkbox.className = 'form-check-input';
    objOption_checkbox.type = 'checkbox';
    objOption_checkbox.checked = value;

    wrapper.appendChild(objOption_checkbox);
    nobr.appendChild(wrapper);
    this.elem.appendChild(nobr);
    var space = document.createTextNode(' ');
    this.elem.appendChild(space);

    const self = this;

    objOption_checkbox.onchange = function () {
      this.blur();
      self.setOption(function (obj) {
        func(obj, objOption_checkbox.checked);
      });
      self.emit('editEnd', null);
      if (updateOnChange) {
        setTimeout(function () {
          self.emit('requestUpdate', null);
        }, 250);
      }
    };
  }

  /**
   * Create an equation input (where the value is a LaTeX string) in the object bar.
   * @param {string} label - The label for the input.
   * @param {string} value - The initial value.
   * @param {objBarValueChangeCallback} func - The function to call when the value changes.
   * @param {string|null} info - The HTML content for the popover info box. If null (default), no info box is created.
   */
  createEquation(label, value, func, info) {
    var nobr = document.createElement('span');
    nobr.className = 'obj-bar-nobr';

    if (info) {
      var p_name = document.createElement('span');
      p_name.innerHTML = label;
      nobr.appendChild(p_name);
      this.createInfoBox(info, nobr);
    } else {
      var p_name = document.createElement('span');
      p_name.innerHTML = label + '&nbsp;';
      nobr.appendChild(p_name);
    }

    var eqnContainer = document.createElement('span');
    var eqnSpan = document.createElement('span');
    eqnSpan.className = 'obj-bar-editable';
    eqnSpan.style.paddingLeft = '3px';
    eqnSpan.style.paddingRight = '3px';
    eqnContainer.appendChild(eqnSpan);
    eqnContainer.addEventListener('keydown', function (e) {
      e.cancelBubble = true;
      if (e.stopPropagation) e.stopPropagation();
    });
    nobr.appendChild(eqnContainer);
    this.elem.appendChild(nobr);
    var space = document.createTextNode(' ');
    this.elem.appendChild(space);

    const self = this;

    var mathField = MQ.MathField(eqnSpan, {
      spaceBehavesLikeTab: true,
      leftRightIntoCmdGoes: 'up',
      restrictMismatchedBrackets: true,
      sumStartsWithNEquals: true,
      supSubsRequireOperand: true,
      charsThatBreakOutOfSupSub: '+-=<>',
      autoSubscriptNumerals: true,
      autoCommands: 'pi theta lambda sqrt sum',
      autoOperatorNames: 'sin cos tan sec csc cot sinh cosh tanh log exp arcsin arccos arctan asin acos atan arcsinh arccosh arctanh asinh acosh atanh floor round ceil trunc sign sgn max min abs',
      maxDepth: 10,
      handlers: {
        enter: function () {
          self.setOption(function (obj) {
            func(obj, mathField.latex());
          });
          self.emit('editEnd', null);
        }
      }
    });

    mathField.el().querySelector('textarea').addEventListener('focusout', function () {
      if (self.pendingEvent) {
        self.pendingEvent();
      }
      self.pendingEvent = null;
    });

    mathField.el().querySelector('textarea').addEventListener('focusin', function () {
      self.pendingEvent = function () {
        self.setOption(function (obj) {
          func(obj, mathField.latex());
        });
        self.emit('editEnd', null);
      };
    });

    setTimeout(function () {
      mathField.latex(value);
    }, 1);
  }


  /**
   * Create a dropdown input in the object bar.
   * @param {string} label - The label for the input.
   * @param {string} value - The initial value.
   * @param {Object|Array} options - The options for the dropdown. If an array, the keys are the same as the values.
   * @param {objBarValueChangeCallback} func - The function to call when the value changes.
   * @param {string|null} info - The HTML content for the popover info box. If null (default), no info box is created.
   * @param {boolean} [updateOnChange=false] - Whether to update the entire obj bar (e.g. show different options) when the dropdown changes.
   */
  createDropdown(label, value, options, func, info, updateOnChange = false) {
    var nobr = document.createElement('span');
    nobr.className = 'obj-bar-nobr';

    if (info) {
      var p_name = document.createElement('span');
      p_name.innerHTML = label;
      nobr.appendChild(p_name);
      this.createInfoBox(info, nobr);
    } else {
      var p_name = document.createElement('span');
      p_name.innerHTML = label + '&nbsp;';
      nobr.appendChild(p_name);
    }

    const isArray = Array.isArray(options);
    var dropdown = document.createElement('select');
    dropdown.className = 'obj-bar-editable';
    for (let key in options) {
      var option = document.createElement('option');
      option.value = isArray ? options[key] : key;
      option.textContent = options[key];
      option.style.color = 'black';
      if (option.value == value) option.selected = true;
      dropdown.appendChild(option);
    }

    nobr.appendChild(dropdown);
    this.elem.appendChild(nobr);
    var space = document.createTextNode(' ');
    this.elem.appendChild(space);

    const self = this;

    dropdown.onchange = function () {
      self.setOption(function (obj) {
        func(obj, dropdown.value);
      });
      if (updateOnChange) {
        self.emit('requestUpdate', null);
      }
      self.emit('editEnd', null);
    };
    dropdown.onclick = function (e) {
      //this.select();
    };
  }

  /**
   * Create a button in the object bar.
   * @param {string} label - The label for the button.
   * @param {function} func - The function to call when the button is clicked.
   * @param {boolean} [updateOnChange=false] - Whether to update the entire obj bar (e.g. show different options) when the button is clicked.
   * @param {string|null} [icon=null] - The svg icon for the button. If null (default), a default button is created.
   */
  createButton(label, func, updateOnChange = false, icon = null) {
    var button = document.createElement('button');
    if (icon) {
      button.innerHTML = icon;
      button.className = 'btn';
      button.style.paddingLeft = '4px';
      button.style.paddingRight = '4px';
      button.setAttribute('data-bs-toggle', 'tooltip');
      button.setAttribute('title', label);
      button.setAttribute('data-bs-placement', 'bottom');
      new bootstrap.Tooltip(button);
    } else {
      button.className = 'btn btn-secondary';
      button.innerHTML = label;
    }

    const self = this;

    button.onclick = function () {
      const isOptical = self.targetObj.constructor.isOptical;
      this.blur();
      func(self.targetObj);
      if (updateOnChange) {
        self.emit('requestUpdate', null);
      }
      self.emit('edit', null);
      self.emit('editEnd', null);
    };
    this.elem.appendChild(button);
    var space = document.createTextNode(' ');
    this.elem.appendChild(space);
  }

  /**
   * Create an popover info icon in the object bar.
   * @param {string} info - The HTML content for the popover info box.
   * @param {HTMLElement} [elem] - The element to append the info icon to. If not provided, the object bar element is used.
   */
  createInfoBox(info, elem) {
    var infoIcon = document.createElement('span');
    infoIcon.className = 'info-icon';
    infoIcon.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle" viewBox="0 0 16 16">
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
      <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
    </svg>
    `;
    infoIcon.style.cursor = 'pointer';
    infoIcon.setAttribute('data-bs-toggle', 'popover');
    infoIcon.setAttribute('data-bs-trigger', 'click');
    infoIcon.setAttribute('data-bs-placement', 'bottom');
    infoIcon.setAttribute('data-bs-html', 'true');
    infoIcon.setAttribute('data-bs-content', info);

    if (!elem) elem = this.elem;

    elem.appendChild(infoIcon);
    new bootstrap.Popover(infoIcon);
  }

  /**
   * Create a note in the object bar.
   * @param {string} content - The HTML content for the note.
   */
  createNote(content) {
    var note = document.createElement('span');
    note.innerHTML = content;
    note.style.marginLeft = "0.2em";
    note.style.marginRight = "0.2em";
    note.style.color = "white";
    this.elem.appendChild(note);
  }

  /**
   * Do the callback function that set the option.
   * Whether it is for all objects or just the selected one depends on the "Apply to all" checkbox.
   * @param {objBarValueChangeCallback} func - The function to call.
   */
  setOption(func) {
    if (!this.shouldApplyToAll) {
      func(this.targetObj);
    }
    else {
      for (var i = 0; i < this.targetObj.scene.objs.length; i++) {
        if (this.targetObj.scene.objs[i].constructor.type == this.targetObj.constructor.type) {
          func(this.targetObj.scene.objs[i]);
        }
      }
    }
    this.emit('edit', null);
  }

  /**
   * Determine whether to create the advanced options ("More options...") in the object bar.
   * If this function is called, either it means that the advanced options should be populated, or the "More options..." button will be shown.
   * @param {boolean} condition - The condition (of the scene object itself or some global option) to determine whether to show the advanced options.
   * @returns {boolean} Whether the advanced options should be populated.
   */
  showAdvanced(condition) {
    if (this.shouldShowAdvanced || condition) {
      return true
    } else {
      this.emit('showAdvancedEnabled', true);
      return false
    }
  }

}

export const objBar = new ObjBar();