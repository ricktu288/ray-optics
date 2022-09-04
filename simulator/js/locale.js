
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

  //toolbar
  document.getElementById('toolbar_title').innerHTML = getMsg('toolbar_title');

  //Ray
  document.getElementById('tool_laser').value = getMsg('toolname_laser');
  document.getElementById('tool_laser').dataset['n'] = getMsg('toolname_laser');

  //Beam
  document.getElementById('tool_parallel').value = getMsg('toolname_parallel');
  document.getElementById('tool_parallel').dataset['n'] = getMsg('toolname_parallel');

  //Point source▼
  document.getElementById('tool_radiant_').value = getMsg('toolname_radiant_') + downarraw;

  //Point source->360 degrees
  document.getElementById('tool_radiant').value = getMsg('toolname_radiant');
  document.getElementById('tool_radiant').dataset['n'] = getMsg('toolname_radiant');
      
  //Point source->Finite angle
  document.getElementById('tool_led').value = getMsg('toolname_led');
  document.getElementById('tool_led').dataset['n'] = getMsg('toolname_led');

  //Mirror▼
  document.getElementById('tool_mirror_').value = getMsg('toolname_mirror_') + downarraw;

  //Mirror->Line
  document.getElementById('tool_mirror').value = getMsg('tooltitle_mirror');
  document.getElementById('tool_mirror').dataset['n'] = getMsg('toolname_mirror_');

  //Mirror->Circular Arc
  document.getElementById('tool_arcmirror').value = getMsg('tooltitle_arcmirror');
  document.getElementById('tool_arcmirror').dataset['n'] = getMsg('toolname_mirror_');

  //Mirror->Parabolic
  document.getElementById('tool_parabolicmirror').value = getMsg('tooltitle_parabolicmirror');
  document.getElementById('tool_parabolicmirror').dataset['n'] = getMsg('toolname_mirror_');

  //Mirror->Curve (ideal)
  document.getElementById('tool_idealmirror').value = getMsg('tooltitle_idealmirror');
  document.getElementById('tool_idealmirror').dataset['n'] = getMsg('toolname_idealmirror');

  //Mirror->Beam Splitter
  document.getElementById('tool_beamsplitter').value = getMsg('tooltitle_beamsplitter');
  document.getElementById('tool_beamsplitter').dataset['n'] = getMsg('toolname_beamsplitter');

  //Refractor▼
  document.getElementById('tool_refractor_').value = getMsg('toolname_refractor_') + downarraw;

  //Refractor->Half-plane
  document.getElementById('tool_halfplane').value = getMsg('tooltitle_halfplane');
  document.getElementById('tool_halfplane').dataset['n'] = getMsg('toolname_refractor_');

  //Refractor->Circle
  document.getElementById('tool_circlelens').value = getMsg('tooltitle_circlelens');
  document.getElementById('tool_circlelens').dataset['n'] = getMsg('toolname_refractor_');

  //Refractor->Other shape
  document.getElementById('tool_refractor').value = getMsg('tooltitle_refractor');
  document.getElementById('tool_refractor').dataset['n'] = getMsg('toolname_refractor_');

  //Refractor->Lens (ideal)
  document.getElementById('tool_lens').value = getMsg('tooltitle_lens');
  document.getElementById('tool_lens').dataset['n'] = getMsg('toolname_lens');

  //Refractor->Lens (real)
  document.getElementById('tool_sphericallens').value = getMsg('tooltitle_sphericallens');
  document.getElementById('tool_sphericallens').dataset['n'] = getMsg('toolname_sphericallens');

  //Blocker
  document.getElementById('tool_blackline').value = getMsg('toolname_blackline');
  document.getElementById('tool_blackline').dataset['n'] = getMsg('toolname_blackline');

  //Ruler
  document.getElementById('tool_ruler').value = getMsg('toolname_ruler');
  document.getElementById('tool_ruler').dataset['n'] = getMsg('toolname_ruler');

  //Protractor
  document.getElementById('tool_protractor').value = getMsg('toolname_protractor');
  document.getElementById('tool_protractor').dataset['n'] = getMsg('toolname_protractor');

  //Power Measurement
  document.getElementById('tool_power').value = getMsg('toolname_power');
  document.getElementById('tool_power').dataset['n'] = getMsg('toolname_power');
  
  //Text
  document.getElementById('tool_text').value = getMsg('toolname_text');
  document.getElementById('tool_text').dataset['n'] = getMsg('toolname_text');

  //Move view
  document.getElementById('tool_').value = getMsg('toolname_');



  //modebar
  document.getElementById('modebar_title').innerHTML = getMsg('modebar_title');
  document.getElementById('mode_light').value = getMsg('modename_light');
  document.getElementById('mode_extended_light').value = getMsg('modename_extended_light');
  document.getElementById('mode_images').value = getMsg('modename_images');
  document.getElementById('mode_observer').value = getMsg('modename_observer');
  document.getElementById('rayDensity_title').innerHTML = getMsg('raydensity');


  document.getElementById('undo').value = getMsg('undo');
  document.getElementById('redo').value = getMsg('redo');
  document.getElementById('reset').value = getMsg('reset');
  document.getElementById('save').value = getMsg('save');
  document.getElementById('save_name_title').innerHTML = getMsg('save_name');
  document.getElementById('save_confirm').value = getMsg('save');
  document.getElementById('save_cancel').value = getMsg('save_cancel');
  document.getElementById('save_description').innerHTML = getMsg('save_description');
  document.getElementById('open').value = getMsg('open');
  document.getElementById('lockobjs_title').innerHTML = getMsg('lockobjs');
  document.getElementById('grid_title').innerHTML = getMsg('snaptogrid');
  document.getElementById('showgrid_title').innerHTML = getMsg('grid');

  document.getElementById('setAttrAll_title').innerHTML = getMsg('applytoall');
  document.getElementById('copy').value = getMsg('duplicate');
  document.getElementById('delete').value = getMsg('delete');

  document.getElementById('forceStop').innerHTML = getMsg('processing');
  document.getElementById('restore').innerHTML = getMsg('restore');

  document.getElementById('homepage').innerHTML = getMsg('homepage');
  document.getElementById('source').innerHTML = getMsg('source');
  document.getElementById('language').innerHTML = document.getElementById('lang-'+lang).innerHTML + uparraw;
}

