// Run this script with node.js whenever some items in the gallery change

langs = ['en', 'zh-CN', 'zh-TW'];
lang_names = ['English', '简体中文', '正體中文'];
translated_str = ['translated', '已翻译', '已翻譯'];
paths = ['', '../cn/modules/', '../tw/modules/'];

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
      // The category of the item may have been changed, so we need to search for all categories.
      for (category_old of data_old) {
        for (item_old of category_old.content) {
          if (item_old.id == item_new.id) {
            item_new.title = item_old.title
            item_new.description = item_old.description
            item_new.points = item_old.points
            item_new.params = item_old.params
          }
        }
      }
    }
  }
  fs.writeFileSync(paths[i] + "data.json", JSON.stringify(data_new, null, 2));
}

// Build the gallery in each language.
for (i in langs) {
  data = JSON.parse(fs.readFileSync(paths[i] + "data.json").toString());
  template = fs.readFileSync(paths[i] + "template.html").toString();
  templateLink = fs.readFileSync(paths[i] + "template-link.html").toString();
  templateCategory = fs.readFileSync(paths[i] + "template-category.html").toString();
  templateItem = fs.readFileSync(paths[i] + "template-item.html").toString();

  codeLinks = "";
  codeCategories = "";

  for (category of data) {
    codeLink = templateLink
        .replaceAll("{ID}", category.id)
        .replaceAll("{TITLE}", category.title);
    codeCategory = templateCategory
        .replaceAll("{ID}", category.id)
        .replaceAll("{TITLE}", category.title);
    codeItems = "";
    for (item of category.content) {
      //console.log(item.id);
      alt = item.title;
      itemTranslated = fs.existsSync(paths[i] + item.id + '.json')
      codeItem = templateItem
        .replaceAll("{ID}", item.id)
        .replaceAll("{TITLE}", item.title)
        .replaceAll("{CONTRIBUTORS}", item.contributors.join(", "))
        .replaceAll("{DESCRIPTION}", item.description)
        .replaceAll("{POINTS}", item.points.map(value => `<li>${value}</li>`).join('') || '-')
        .replaceAll("{PARAMS}", Object.entries(item.params).map(([key, value]) => `<li><code>${key}</code>: ${value}</li>`).join('') || '-')
      codeItems += codeItem;
    }
    codeCategory = codeCategory
        .replaceAll("{ITEMS}", codeItems);
    codeLinks += codeLink;
    codeCategories += codeCategory;
  }

  fs.writeFileSync(paths[i] + "modules.html", template
    .replaceAll("{LINKS}", codeLinks)
    .replaceAll("{CATEGORIES}", codeCategories)
  )
}
