
var lang = 'en';
function getMsg(msg) {
  var m = locales[lang][msg];
  if (m == null) {
    console.log("undefined message: " + msg);
    return msg;
  }
  return m.message;
}

function init_i18n() {
  if (navigator.language) {
    var browser_lang = navigator.language;
    if (browser_lang.toLowerCase() == 'zh-tw') {
      lang = 'zh-TW';
    }
    if (browser_lang.toLowerCase() == 'zh-cn') {
      lang = 'zh-CN';
    }
  }

  var url_lang = location.search.substr(1)
  if (url_lang && locales[url_lang]) {
    lang = url_lang;
  }


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
  document.getElementById('language').innerHTML = document.getElementById('lang-'+lang).innerHTML + uparraw;
}

