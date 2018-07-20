/* Open dropdown menu on mouse hover. */
$(".dropdown-toggle").mouseenter(function () {
  $(this).find(".dropdown-menu").show();
}).mouseleave(function () {
  $(this).find(".dropdown-menu").hide();
});
/* Simulate click on parent radio when dropdown menu item clicked. */
$(".dropdown-menu > div > label").click(function (e) {
  $(this).parent().parent().prev().click();
  $(this).parent().parent().hide();
  e.stopPropagation();
});

/* Initialize Bootstrap Popover */
$("[data-toggle=popover]").popover();