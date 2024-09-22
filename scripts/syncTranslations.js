const fs = require('fs');
const path = require('path');

function syncTranslations(localeDir) {
  const enContent = JSON.parse(fs.readFileSync(path.join(localeDir, 'en.json'), 'utf8'));
  const files = fs.readdirSync(localeDir);

  files.forEach(file => {
    if (path.extname(file) === '.json' && file !== 'en.json' && file !== 'completeness.json') {
      const content = JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf8'));
      const newContent = {};
      for (const key in enContent) {
        if (content[key]) {
          if (content[key].incomplete) {
            newContent[key] = { incomplete: true, message: enContent[key].message };
          } else {
            newContent[key] = { message: content[key].message };
          }
        } else {
          newContent[key] = { incomplete: true, message: enContent[key].message };
        }
      }
      fs.writeFileSync(path.join(localeDir, file), JSON.stringify(newContent, null, 2));
    }
  });
}


const localeDir = path.join(__dirname, '../locales');

syncTranslations(localeDir);
console.log('Translations synchronized.');
