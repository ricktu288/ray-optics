// Run this script with node.js whenever some new items are added into en.js

locale_name = ['en', 'zh-TW', 'zh-CN', 'ru', 'nl', 'fr', 'de', 'pl', 'ja', 'si', 'ko', 'LOCALE_ID'];
locale_files = ['en.js', 'zh_TW.js', 'zh_CN.js', 'ru.js', 'nl.js', 'fr.js', 'de.js', 'pl.js', 'ja.js', 'si.js', 'ko.js', 'template.js'];
fs = require('fs');

var locales = {};
for (var i in locale_name) {
    eval(fs.readFileSync(locale_files[i]).toString());
}

var locales_new = {};

for (var i in locale_name) {
    var locale = {};
    for (var key in locales['en']) {
        if (locales[locale_name[i]][key]) {
            locale[key] = locales[locale_name[i]][key];
        } else {
            locale[key] = { incomplete: true, message: locales['en'][key].message };
        }
    }
    fs.writeFileSync(locale_files[i],
        "if (typeof locales == 'undefined') locales = {};\n" +
        "locales[\"" + locale_name[i] + "\"] = " +
        JSON.stringify(locale, null, 2));
}
