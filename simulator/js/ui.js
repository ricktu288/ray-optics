
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

var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
return new bootstrap.Tooltip(tooltipTriggerEl)
})

var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
return new bootstrap.Popover(popoverTriggerEl)
})
