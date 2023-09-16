function createNumberAttr(label, min, max, step, value, func, elem, info) {
  var nobr = document.createElement('span');
  nobr.className = 'selected-tool-bar-nobr';



  if (info) {
    var p_name = document.createElement('span');
    p_name.innerHTML = label;
    nobr.appendChild(p_name);
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
    nobr.appendChild(infoIcon);
    new bootstrap.Popover(infoIcon);
  } else {
    var p_name = document.createElement('span');
    p_name.innerHTML = label + '&nbsp;';
    nobr.appendChild(p_name);
  }


  var objAttr_text = document.createElement('input');
  objAttr_text.type = 'text';
  objAttr_text.value = value;
  objAttr_text.style.width = '40px';
  objAttr_text.className = 'selected-tool-bar-editable';
  nobr.appendChild(objAttr_text);

  var objAttr_range = document.createElement('input');
  objAttr_range.type = 'range';
  objAttr_range.min = min;
  objAttr_range.max = max;
  objAttr_range.step = step;
  objAttr_range.value = value;
  objAttr_range.className = 'form-range';
  nobr.appendChild(objAttr_range);

  elem.appendChild(nobr);

  var space = document.createTextNode(' ');
  elem.appendChild(space);

  objAttr_range.oninput = function()
  {
    objAttr_text.value = objAttr_range.value;
    setAttr(function(obj) {
      func(obj, objAttr_range.value * 1);
    });
  };

  objAttr_range.onmouseup = function()
  {
    createUndoPoint();
  };

  objAttr_range.ontouchend = function()
  {
    setAttr(function(obj) {
      func(obj, objAttr_range.value * 1);
    });
    createUndoPoint();
  };
  objAttr_text.onchange = function()
  {
    objAttr_range.value = objAttr_text.value;
    setAttr(function(obj) {
      func(obj, objAttr_text.value);
    });
  };
  objAttr_text.onkeydown = function(e)
  {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  objAttr_text.onclick = function(e)
  {
    this.select();
  };
}

function createStringAttr(label, value, func, elem) {
  var p_name = document.createElement('span');
  p_name.innerHTML = '&nbsp;' + label + '&nbsp;';
  elem.appendChild(p_name);
  var objAttr_text = document.createElement('input');
  objAttr_text.type = 'text';
  objAttr_text.value = value;
  objAttr_text.style.width = '200px';
  elem.appendChild(objAttr_text);
  objAttr_text.onchange = function()
  {
    setAttr(function(obj) {
      func(obj, objAttr_text.value);
    });
  };
  objAttr_text.onkeydown = function(e)
  {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  objAttr_text.onclick = function(e)
  {
    this.select();
  };
}

function createTextAttr(label, value, func, elem) {
  var p_name = document.createElement('span');
  p_name.innerHTML = '&nbsp;' + label + '&nbsp;';
  elem.appendChild(p_name);
  var objAttr_text = document.createElement('textarea');
  objAttr_text.className = 'selected-tool-bar-editable';
  objAttr_text.value = value;
  objAttr_text.cols = 25;
  objAttr_text.rows = 1;
  elem.appendChild(objAttr_text);
  var space = document.createTextNode(' ');
  elem.appendChild(space);
  objAttr_text.oninput = function()
  {
    // if user starts adding more than one line, auto expand the text area
    if (objAttr_text.value.split('\n').length > 1 && objAttr_text.rows==1) {
      objAttr_text.rows = 3;
    }
    setAttr(function(obj) {
      func(obj, objAttr_text.value);
    });
  };
  objAttr_text.onkeydown = function(e)
  {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  };
  objAttr_text.onclick = function(e)
  {
    this.select();
  };
}

function createBooleanAttr(label, value, func, elem) {
  var nobr = document.createElement('span');
  nobr.className = 'selected-tool-bar-nobr';

  var p_name = document.createElement('span');
  p_name.innerHTML = label + '&nbsp;';
  nobr.appendChild(p_name);

  var wrapper = document.createElement('span');
  wrapper.className = 'form-switch';

  var objAttr_checkbox = document.createElement('input');
  objAttr_checkbox.className = 'form-check-input';
  objAttr_checkbox.type = 'checkbox';
  objAttr_checkbox.checked = value;

  wrapper.appendChild(objAttr_checkbox);
  nobr.appendChild(wrapper);
  elem.appendChild(nobr);
  var space = document.createTextNode(' ');
  elem.appendChild(space);

  objAttr_checkbox.onchange = function() {
    setAttr(function(obj) {
      func(obj, objAttr_checkbox.checked);
    });
  };
}



function createEquationAttr(label, value, func, elem) {
  var nobr = document.createElement('span');
  nobr.className = 'selected-tool-bar-nobr';

  var p_name = document.createElement('span');
  p_name.innerHTML = label + '&nbsp;';
  nobr.appendChild(p_name);
  var eqnContainer = document.createElement('span');
  var eqnSpan = document.createElement('span');
  eqnSpan.className = 'selected-tool-bar-editable';
  eqnSpan.style.paddingLeft = '3px';
  eqnSpan.style.paddingRight = '3px';
  eqnContainer.appendChild(eqnSpan);
  eqnContainer.addEventListener('keydown', function(e) {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  });
  nobr.appendChild(eqnContainer);
  elem.appendChild(nobr);
  var space = document.createTextNode(' ');
  elem.appendChild(space);
  var mathField = MQ.MathField(eqnSpan, {
    spaceBehavesLikeTab: true,
    leftRightIntoCmdGoes: 'up',
    restrictMismatchedBrackets: true,
    sumStartsWithNEquals: true,
    supSubsRequireOperand: true,
    charsThatBreakOutOfSupSub: '+-=<>',
    autoSubscriptNumerals: true,
    autoCommands: 'pi theta sqrt sum',
    autoOperatorNames: 'sin cos tan sec csc cot log exp arcsin arccos arctan asin acos atan floor round ceil trunc sign sgn max min abs',
    maxDepth: 10,
    handlers: {
      edit: function() {
        setAttr(function(obj) {
          func(obj, mathField.latex());
        });
      }
    }
  });
  setTimeout(function() {
    mathField.latex(value);
  }, 1);
}

function createDropdownAttr(label, value, options, func, elem) {
  var nobr = document.createElement('span');
  nobr.className = 'selected-tool-bar-nobr';

  var p_name = document.createElement('span');
  p_name.innerHTML = label + '&nbsp;';
  nobr.appendChild(p_name);

  isArray = Array.isArray(options);
  var dropdown = document.createElement('select');
  dropdown.className = 'selected-tool-bar-editable';
  for (key in options) {
    var option = document.createElement('option');
    option.value = isArray ? options[key] : key;
    option.textContent = options[key];
    option.style.color = 'black';
    if (option.value == value) option.selected = true;
    dropdown.appendChild(option);
  }

  nobr.appendChild(dropdown);
  elem.appendChild(nobr);
  var space = document.createTextNode(' ');
  elem.appendChild(space);
  dropdown.onchange = function()
  {
    setAttr(function(obj) {
      func(obj, dropdown.value);
    });
    createUndoPoint();
  };
  dropdown.onclick = function(e)
  {
    this.select();
  };
}

function hasSameAttrType(obj1, obj2)
{
  return obj1.type==obj2.type;
}

function setAttr(func)
{
  if (!document.getElementById('setAttrAll').checked)
  {
    func(objs[selectedObj]);
  }
  else
  {
    for (var i = 0; i < objs.length; i++)
    {
      if (hasSameAttrType(objs[i], objs[selectedObj]))
      {
        func(objs[i]);
      }
    }
  }
  draw();
}

function createAdvancedOptions(condition) {
  if (showAdvancedOn || condition) {
    return true
  } else {
    document.getElementById('showAdvanced').style.display = '';
    document.getElementById('showAdvanced_mobile_container').style.display = '';
    return false
  }
}
