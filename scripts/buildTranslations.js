const fs = require('fs');
const path = require('path');

function calculateCompleteness(localeDir) {
  const completeness = {};
  const files = fs.readdirSync(localeDir);

  files.forEach(file => {
    if (path.extname(file) === '.json' && file !== 'template.json' && file !== 'completeness.json') {
      const language = path.basename(file, '.json');
      const content = JSON.parse(fs.readFileSync(path.join(localeDir, file), 'utf8'));
      
      let total = 0;
      let incomplete = 0;

      Object.values(content).forEach(item => {
        total++;
        if (item.incomplete) {
          incomplete++;
        }
      });

      const completePercentage = Math.round((total - incomplete) / total * 100);
      completeness[language] = completePercentage;
    }
  });

  return completeness;
}

const localeDir = path.join(__dirname, '../locales');

const completeness = calculateCompleteness(localeDir);
fs.writeFileSync(
  path.join(localeDir, 'completeness.json'),
  JSON.stringify(completeness, null, 2)
);
console.log('Translation completeness calculated and saved.');