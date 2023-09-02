
f = function(e) {
  list = document.getElementsByClassName('mobile-dropdown-menu');
  let maxScrollHeight = 0;
  for (ele of list) {
    inner = ele.children[0];
    if(inner.scrollHeight > maxScrollHeight){
      maxScrollHeight = inner.scrollHeight;
    }
  }
  for (ele of list) {
    ele.style.height = maxScrollHeight + 'px';
  }
}
document.getElementById('toolbar-mobile').addEventListener('shown.bs.dropdown', f);
document.getElementById('toolbar-mobile').addEventListener('hidden.bs.dropdown', f);

document.addEventListener('DOMContentLoaded', function() {
  
  
  
  

  document.getElementById('more-options-dropdown').addEventListener('click', function(e) {
    e.stopPropagation();
  });
  


  function resetDropdownButtons() {
    // Remove the 'selected' class from all dropdown buttons
    document.querySelectorAll('.btn.dropdown-toggle.selected').forEach(function(button) {
        button.classList.remove('selected');
    });
  }

  // Listen for changes to any radio input within a dropdown
  document.querySelectorAll('.dropdown-menu input[type="radio"]').forEach(function(input) {
    input.addEventListener('change', function() {
        if (input.checked) {
            // Reset other dropdown buttons
            resetDropdownButtons();

            // Get the associated dropdown button using the aria-labelledby attribute
            let dropdownButton = document.getElementById(input.closest('.dropdown-menu').getAttribute('aria-labelledby'));

            // Style the button to indicate selection. Change as needed.
            dropdownButton.classList.add('selected');
        }
    });
  });

  // Listen for changes to standalone radio inputs (outside dropdowns)
  document.querySelectorAll('input[type="radio"].btn-check').forEach(function(input) {
    if (!input.closest('.dropdown-menu')) { // Check if the radio is not inside a dropdown
        input.addEventListener('change', function() {
            if (input.checked) {
                // Reset dropdown buttons
                resetDropdownButtons();
            }
        });
    }
  });



});





function getMsg(msg) {
  var m = locales[lang][msg];
  if (m == null) {
    console.log("undefined message: " + msg);
    return msg;
  }
  return m.message;
}

function updateUIText(elememt = document) {
  const elements = elememt.querySelectorAll('[data-text]');
  
  elements.forEach(el => {
    const key = el.getAttribute('data-text');
    const text = getMsg(key);
    el.innerHTML = text;
  });
}

function updateUIWithPopovers(elememt = document) {
  const elements = elememt.querySelectorAll('[data-title], [data-popover]');
  
  elements.forEach(el => {
    const titleKey = el.getAttribute('data-title');
    const title = getMsg(titleKey);
    if (title != null) {
      el.setAttribute('title', title);
    }

    const contentKey = el.getAttribute('data-popover');
    if (contentKey == null) {
      // Tooltip
      el.setAttribute('data-bs-toggle', 'tooltip');
      el.setAttribute('data-bs-trigger', 'hover');
      el.setAttribute('data-bs-placement', 'bottom');
    } else {
      const image = el.getAttribute('data-image');
      if (image != null) {
        // Popover with image
        const content = '<img src="../img/' + image + '" class="popover-image" id="dynamic-popover-image">' + getMsg(contentKey);
        el.setAttribute('data-bs-toggle', 'popover');
        el.setAttribute('data-bs-trigger', 'hover');
        el.setAttribute('data-bs-html', 'true');
        el.setAttribute('data-bs-content', content);

        let imgLoaded = false;
        el.addEventListener('inserted.bs.popover', function() {
          if (!imgLoaded) {
            const imgElement = document.querySelector('#dynamic-popover-image');
            imgElement.addEventListener('load', function() {
              imgLoaded = true;
              bootstrap.Popover.getInstance(el).update();
            });
          }
        });
      } else {
        // Popover without image
        const content = getMsg(contentKey);
        el.setAttribute('data-bs-toggle', 'popover');
        el.setAttribute('data-bs-trigger', 'hover');
        el.setAttribute('data-bs-html', 'true');
        el.setAttribute('data-bs-content', content);
      }
    }
  });

  // Initialize Tooltips
  var tooltipTriggerList = [].slice.call(elememt.querySelectorAll('[data-bs-toggle="tooltip"]'))
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Initialize Popovers
  var popoverTriggerList = [].slice.call(elememt.querySelectorAll('[data-bs-toggle="popover"]'))
  var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });
}


function updateUIWithoutPopovers(elememt = document) {
  const elements = elememt.querySelectorAll('[data-title]');
  
  elements.forEach(el => {
    const textKey = el.getAttribute('data-text');

    if (textKey == null) {
      const titleKey = el.getAttribute('data-title');
      const title = getMsg(titleKey);
      el.setAttribute('title', title);
      el.setAttribute('data-bs-toggle', 'tooltip');
      el.setAttribute('data-bs-trigger', 'hover');
      el.setAttribute('data-bs-placement', 'bottom');
    }
  });

  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl)
  })
}

function disablePopoversAndTooltips() {
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.forEach(function (tooltipTriggerEl) {
    tooltipTriggerEl.setAttribute('data-bs-toggle', '');
  });
  
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl)
  });

  tooltipList.forEach(function (tooltip) {
    tooltip.disable();
  });

  var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
  var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
  return new bootstrap.Popover(popoverTriggerEl)
  });

  popoverTriggerList.forEach(function (popoverTriggerEl) {
    popoverTriggerEl.setAttribute('data-bs-toggle', '');
  });

  popoverList.forEach(function (popover) {
    popover.disable();
  });
}

updateUIText();
updateUIWithPopovers();

