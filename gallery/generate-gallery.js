// Run this script with node.js whenever some items in the gallery change

fs = require('fs');
data = JSON.parse(fs.readFileSync("data.json").toString());
template = fs.readFileSync("template.html").toString();
indexTemplate = fs.readFileSync("index-template.html").toString();
indexTemplateLink = fs.readFileSync("index-template-link.html").toString();
indexTemplateCategory = fs.readFileSync("index-template-category.html").toString();
indexTemplateItem = fs.readFileSync("index-template-item.html").toString();

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
    console.log(item.id);
    alt = item.title;
    /*
    objs = JSON.parse(fs.readFileSync(item.id + ".json").toString()).objs;
    for (obj of objs) {
      if (obj.type == "text") {
        if ((alt +  ", " + obj.p).length <= 125) {
          alt += ", " + obj.p;
        }
      }
    }
    console.log(alt);
    */
    codeItem = indexTemplateItem
      .replaceAll("{ID}", item.id)
      .replaceAll("{TITLE}", item.title)
      .replaceAll("{CONTRIBUTORS}", item.contributors.join(", "))
    codeItems += codeItem;
    fs.writeFileSync(item.id + ".html", template
      .replaceAll("{ID}", item.id)
      .replaceAll("{TITLE}", item.title)
      .replaceAll("{CONTRIBUTORS}", ((item.contributors.length==1)?"Contributor: ":"Contributors: ") + item.contributors.join(", "))
      .replaceAll("{ALT}", alt)
      .replaceAll("{DESCRIPTION}", item.description || "")
    )
  }
  codeCategory = codeCategory
      .replaceAll("{ITEMS}", codeItems);
  codeLinks += codeLink;
  codeCategories += codeCategory;
}

fs.writeFileSync("index.html", indexTemplate
  .replaceAll("{LINKS}", codeLinks)
  .replaceAll("{CATEGORIES}", codeCategories)
)
