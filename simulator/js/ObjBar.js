
class ObjBar {
  constructor(elem) {

    /** @property {HTMLElement} elem - The element the inputs will be populated to */
    this.elem = elem;

    /** @property {function|null} pendingEvent - The pending event to be called in case the scene object loses focus before the input is finished */
    this.pendingEvent = null;
  }

  /**
   * The callback function for when a value changes.
   * If "Apply to all" is checked, this function will be called for each scene object of the same type.
   * @callback objBarValueChangeCallback
   * @param {Object} obj - The scene object whose value changed.
   * @param {any} value - The new value.
   */

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

    const setOption = this.setOption;

    objOption_range.oninput = function () {
      objOption_text.value = objOption_range.value;
      setOption(function (obj) {
        func(obj, objOption_range.value * 1);
      });
    };

    objOption_range.onmouseup = function () {
      this.blur();
      createUndoPoint();
    };

    objOption_range.ontouchend = function () {
      this.blur();
      setOption(function (obj) {
        func(obj, objOption_range.value * 1);
      });
      createUndoPoint();
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
      setOption(function (obj) {
        func(obj, value);
      });
      createUndoPoint();
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

    const setOption = this.setOption;

    objOption_text.onchange = function () {
      setOption(function (obj) {
        func(obj, objOption_text.value);
      });
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

    const setOption = this.setOption;

    objOption_text.oninput = function () {
      // if user starts adding more than one line, auto expand the text area
      if (objOption_text.value.split('\n').length > 1 && objOption_text.rows == 1) {
        objOption_text.rows = 3;
      }
      setOption(function (obj) {
        func(obj, objOption_text.value);
      });
    };
    objOption_text.onkeydown = function (e) {
      e.cancelBubble = true;
      if (e.stopPropagation) e.stopPropagation();
    };
    objOption_text.onclick = function (e) {
      //this.select();
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

    const setOption = this.setOption;

    objOption_checkbox.onchange = function () {
      this.blur();
      setOption(function (obj) {
        func(obj, objOption_checkbox.checked);
      });
      if (updateOnChange) {
        setTimeout(function () {
          selectObj(selectedObj);
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

    const setOption = this.setOption;

    var mathField = MQ.MathField(eqnSpan, {
      spaceBehavesLikeTab: true,
      leftRightIntoCmdGoes: 'up',
      restrictMismatchedBrackets: true,
      sumStartsWithNEquals: true,
      supSubsRequireOperand: true,
      charsThatBreakOutOfSupSub: '+-=<>',
      autoSubscriptNumerals: true,
      autoCommands: 'pi theta sqrt sum',
      autoOperatorNames: 'sin cos tan sec csc cot sinh cosh tanh log exp arcsin arccos arctan asin acos atan arcsinh arccosh arctanh asinh acosh atanh floor round ceil trunc sign sgn max min abs',
      maxDepth: 10,
      handlers: {
        enter: function () {
          setOption(function (obj) {
            func(obj, mathField.latex());
          });
        }
      }
    });

    const self = this;

    mathField.el().querySelector('textarea').addEventListener('focusout', function () {
      if (self.pendingEvent) {
        self.pendingEvent();
      }
      self.pendingEvent = null;
    });

    mathField.el().querySelector('textarea').addEventListener('focusin', function () {
      self.pendingEvent = function () {
        setOption(function (obj) {
          func(obj, mathField.latex());
        });
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

    const setOption = this.setOption;

    dropdown.onchange = function () {
      setOption(function (obj) {
        func(obj, dropdown.value);
      });
      if (updateOnChange) {
        selectObj(selectedObj);
      }
      createUndoPoint();
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
   */
  createButton(label, func, updateOnChange = false) {
    var button = document.createElement('button');
    button.className = 'btn btn-secondary';
    button.innerHTML = label;
    button.onclick = function () {
      this.blur();
      func(scene.objs[selectedObj]);
      if (updateOnChange) {
        selectObj(selectedObj);
      }
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
    note.id = "beam_warning";
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
    if (!document.getElementById('apply_to_all').checked) {
      func(scene.objs[selectedObj]);
    }
    else {
      for (var i = 0; i < scene.objs.length; i++) {
        if (scene.objs[i].constructor.type == scene.objs[selectedObj].constructor.type) {
          func(scene.objs[i]);
        }
      }
    }
    draw(!scene.objs[selectedObj].constructor.isOptical, true);
  }

  /**
   * Determine whether to create the advanced options ("More options...") in the object bar.
   * If this function is called, either it means that the advanced options should be populated, or the "More options..." button will be shown.
   * @param {boolean} condition - The condition (of the scene object itself or some global option) to determine whether to show the advanced options.
   * @returns {boolean} Whether the advanced options should be populated.
   */
  showAdvanced(condition) {
    if (showAdvancedOn || condition) {
      return true
    } else {
      document.getElementById('showAdvanced').style.display = '';
      document.getElementById('showAdvanced_mobile_container').style.display = '';
      return false
    }
  }

}

var objBar = new ObjBar(document.getElementById('obj_bar_main'));



