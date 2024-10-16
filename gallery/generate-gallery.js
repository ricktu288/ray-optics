// Run this script with node.js whenever some items in the gallery change

langs = ['en', 'pl', 'zh-CN', 'zh-TW'];
lang_names = ['English', 'polski', '简体中文', '正體中文'];
translated_str = ['translated', 'przetłumaczone', '已翻译', '已翻譯'];
paths = ['', '../pl/gallery/', '../cn/gallery/', '../tw/gallery/'];
urls = ['https://phydemo.app/ray-optics/gallery/', 'https://phydemo.app/ray-optics/pl/gallery/', 'https://phydemo.app/ray-optics/cn/gallery/', 'https://phydemo.app/ray-optics/tw/gallery/'];
available_in = {};

fs = require('fs');
data_en_str = fs.readFileSync("data.json").toString()
data_en = JSON.parse(data_en_str);

// Sync the data.json file in each language other than English, and create a table of which items are available in which languages.
for (i in langs) {
  if (langs[i] == 'en') continue;
  data_old = JSON.parse(fs.readFileSync(paths[i] + "data.json").toString());
  data_new = JSON.parse(data_en_str)

  for (category_new of data_new) {
    for (category_old of data_old) {
      if (category_old.id == category_new.id) {
        category_new.title = category_old.title
      }
    }
    for (item_new of category_new.content) {
      if (!available_in[item_new.id]) available_in[item_new.id] = [0];
      itemTranslated = fs.existsSync(paths[i] + item_new.id + '.json')
      if (itemTranslated) {
        available_in[item_new.id].push(parseInt(i));
        // The category of the item may have been changed, so we need to search for all categories.
        for (category_old of data_old) {
          for (item_old of category_old.content) {
            if (item_old.id == item_new.id) {
              item_new.title = item_old.title
              item_new.description = item_old.description
            }
          }
        }
      }
    }
  }
  fs.writeFileSync(paths[i] + "data.json", JSON.stringify(data_new, null, 2));
}

console.log(JSON.stringify(available_in, null, 2))

// Build the gallery in each language.
for (i in langs) {
  data = JSON.parse(fs.readFileSync(paths[i] + "data.json").toString());
  template = fs.readFileSync(paths[i] + "template.html").toString();
  indexTemplate = fs.readFileSync(paths[i] + "index-template.html").toString();
  indexTemplateLink = fs.readFileSync(paths[i] + "index-template-link.html").toString();
  indexTemplateCategory = fs.readFileSync(paths[i] + "index-template-category.html").toString();
  indexTemplateItem = fs.readFileSync(paths[i] + "index-template-item.html").toString();

  codeLinks = "";
  codeCategories = "";

  for (category of data) {
    codeLink = indexTemplateLink
        .replaceAll("{ID}", category.id)
        .replaceAll("{TITLE}", category.title);
    codeCategory = indexTemplateCategory
        .replaceAll("{ID}", category.id)
        .replaceAll("{TITLE}", category.title);
    codeItems = "";
    for (item of category.content) {
      //console.log(item.id);
      alt = item.title;
      itemTranslated = fs.existsSync(paths[i] + item.id + '.json')
      if (itemTranslated) {
        codeItem = indexTemplateItem
          .replaceAll("{ID}", item.id)
          .replaceAll("{TITLE}", item.title)
          .replaceAll("{CONTRIBUTORS}", item.contributors.join(", "))
        codeItems += codeItem;

        lang_tags = ""
        lang_dropdown = ""
        for (avail_lang of available_in[item.id]) {
          lang_tags += `<link rel="alternate" href="${urls[avail_lang]}${item.id}" hreflang="${langs[avail_lang]}">\n`
          lang_dropdown += `<li><a href="${urls[avail_lang]}${item.id}">${lang_names[avail_lang]}</a></li>`
        }
        fs.writeFileSync(paths[i] + item.id + ".html", template
          .replaceAll("{ID}", item.id)
          .replaceAll("{TITLE}", item.title)
          .replaceAll("{CONTRIBUTORS}", (langs[i]=="en"?((item.contributors.length==1)?"Contributor: ":"Contributors: "):"") + item.contributors.join(", "))
          .replaceAll("{LANGTAGS}", lang_tags)
          .replaceAll("{LANGDROPDOWN}", lang_dropdown)
          .replaceAll("{ALT}", alt)
          .replaceAll("{DESCRIPTION}", item.description || "")
        )
      } else {
        codeItem = indexTemplateItem
          .replaceAll("{ID}", "../../gallery/" + item.id)
          .replaceAll("{TITLE}", item.title)
          .replaceAll("{CONTRIBUTORS}", item.contributors.join(", "))
        codeItems += codeItem;
      }
    }
    codeCategory = codeCategory
        .replaceAll("{ITEMS}", codeItems);
    codeLinks += codeLink;
    codeCategories += codeCategory;
  }

  lang_tags = ""
  lang_dropdown = ""
  for (avail_lang in langs) {
    translated = 0;
    total = 0;

    for (item in available_in) {
      total++;
      if (available_in[item].indexOf(parseInt(avail_lang)) != -1) {
        translated++;
      }
    }
    lang_tags += `<link rel="alternate" href="${urls[avail_lang]}" hreflang="${langs[avail_lang]}">\n`
    if (avail_lang == '0') {
      lang_dropdown += `<li><a href="${urls[avail_lang]}">${lang_names[avail_lang]}</a></li>`
    } else {
      lang_dropdown += `<li><a href="${urls[avail_lang]}">${lang_names[avail_lang]} <span style="color:gray">(${Math.round(translated/total*100)}% ${translated_str[i]})</span></a></li>`
    }
  }
  fs.writeFileSync(paths[i] + "index.html", indexTemplate
    .replaceAll("{LINKS}", codeLinks)
    .replaceAll("{CATEGORIES}", codeCategories)
    .replaceAll("{LANGTAGS}", lang_tags)
    .replaceAll("{LANGDROPDOWN}", lang_dropdown)
  )
}
