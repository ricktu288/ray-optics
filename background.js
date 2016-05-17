chrome.app.runtime.onLaunched.addListener(function(launchData) {
  chrome.app.window.create('light.html', {
    bounds: {
      width: 1000,
      height: 600
    },
    state: 'normal',
    minWidth: 950,
    minHeight: 250
  }, function(win) {

  });
});
