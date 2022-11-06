function createNumberAttr(label, min, max, step, value, func, elem) {
  var p_name = document.createElement('span');
  p_name.innerHTML = '&nbsp;' + label + '&nbsp;';
  elem.appendChild(p_name);
  var objAttr_range = document.createElement('input');
  objAttr_range.type = 'range';
  objAttr_range.min = min;
  objAttr_range.max = max;
  objAttr_range.step = step;
  objAttr_range.value = value;
  elem.appendChild(objAttr_range);
  var objAttr_text = document.createElement('input');
  objAttr_text.type = 'text';
  objAttr_text.value = value;
  objAttr_text.style.width = '40px';
  objAttr_text.style.marginLeft = '0.2em';
  elem.appendChild(objAttr_text);
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
  cancelMousedownEvent_(objAttr_range);
  objAttr_text.onchange = function()
  {
    objAttr_range.value = objAttr_text.value;
    setAttr(function(obj) {
      func(obj, objAttr_text.value);
    });
  };
  cancelMousedownEvent_(objAttr_text);
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
  cancelMousedownEvent_(objAttr_text);
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
  var label_elem = document.createElement('label');
  label_elem.style.marginLeft = '0.2em';
  label_elem.style.marginRight = '0.2em';
  elem.appendChild(label_elem);
  var objAttr_checkbox = document.createElement('input');
  objAttr_checkbox.type = 'checkbox';
  objAttr_checkbox.style.display = 'inline';
  objAttr_checkbox.checked = value;
  label_elem.appendChild(objAttr_checkbox);
  var p_name = document.createElement('span');
  p_name.innerHTML = '&nbsp;' + label;
  label_elem.appendChild(p_name);
  objAttr_checkbox.onchange = function()
  {
    setAttr(function(obj) {
      func(obj, objAttr_checkbox.checked);
    });
  };
  cancelMousedownEvent_(label_elem);
}

function createEquationAttr(label, value, func, elem) {

  var p_name = document.createElement('span');
  p_name.innerHTML = '&nbsp;' + label + '&nbsp;';
  elem.appendChild(p_name);
  var eqnContainer = document.createElement('span');
  var eqnSpan = document.createElement('span');
  eqnSpan.style.backgroundColor = 'white';
  eqnSpan.style.color = 'black';
  eqnSpan.style.paddingLeft = '3px';
  eqnSpan.style.paddingRight = '3px';
  eqnContainer.appendChild(eqnSpan);
  eqnContainer.addEventListener('keydown', function(e) {
    e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
  });
  elem.appendChild(eqnContainer);
  cancelMousedownEvent_(eqnSpan);
  var mathField = MQ.MathField(eqnSpan, {
    spaceBehavesLikeTab: true,
    leftRightIntoCmdGoes: 'up',
    restrictMismatchedBrackets: true,
    sumStartsWithNEquals: true,
    supSubsRequireOperand: true,
    charsThatBreakOutOfSupSub: '+-=<>',
    autoSubscriptNumerals: true,
    autoCommands: 'pi theta sqrt sum',
    autoOperatorNames: 'sin cos tan csc sec cot log exp arcsin arccos arctan floor max min abs',
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
