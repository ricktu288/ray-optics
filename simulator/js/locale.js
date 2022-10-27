
function getMsg(msg) {
  var m = locales[lang][msg];
  if (m == null) {
    console.log("undefined message: " + msg);
    return msg;
  }
  return m.message;
}

function init_i18n() {
  var downarraw = '\u25BC';
  var uparraw = '\u25B2';
  //var downarraw="\u25BE";
  document.title = getMsg('appName');

  document.getElementById('save_name_title').innerHTML = getMsg('save_name');
  document.getElementById('save_confirm').value = getMsg('save');
  document.getElementById('save_cancel').value = getMsg('save_cancel');
  document.getElementById('save_description').innerHTML = getMsg('save_description');

  document.getElementById('setAttrAll_title').innerHTML = getMsg('applytoall');
  document.getElementById('copy').value = getMsg('duplicate');
  document.getElementById('delete').value = getMsg('delete');

  document.getElementById('forceStop').innerHTML = getMsg('processing');
  document.getElementById('restore').innerHTML = getMsg('restore');

  document.getElementById('contribute').innerHTML = getMsg('contribute');
  document.getElementById('issues').innerHTML = getMsg('issues');
  document.getElementById('about').innerHTML = getMsg('about');
  document.getElementById('translate').innerHTML = getMsg('translate');

  console.log("start")
  for (var lang1 in locales) {
    var translated = 0;
    var total = 0;
    for (var item in locales[lang1]) {
      total++;
      if (!locales[lang1][item].incomplete) {
        translated++;
      }
    }
    console.log([lang1, total, translated]);
    if (translated != total) {
      document.getElementById('lang-' + lang1).innerHTML += `<span style="color:gray"> (${translated}/${total} ${getMsg('translated')})</span>`;
    }
  }

  document.getElementById('language').innerHTML = document.getElementById('lang-' + lang).innerHTML + uparraw;

}

