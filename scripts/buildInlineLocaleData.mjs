import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert import.meta.url to a file path and determine the directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Given a json object, calculate the total number of strings in the object, but string keys of the form key_suffix are treated as the same string as key.
function countStrings(json) {
  const stringKeys = new Set();
  let count = 0;
  for (const key in json) {
    if (typeof json[key] === 'string') {
      if (key.includes('_')) {
        stringKeys.add(key.split('_')[0]);
      } else {
        stringKeys.add(key);
      }
    } else if (typeof json[key] === 'object') {
      count += countStrings(json[key]);
    }
  }
  return count + stringKeys.size;
}

export default function() {
  const localeData = {};

  // List all existing languages, which are the directories in the /locales directory. Put English first.
  const langs = ['en'].concat(fs.readdirSync(path.join(__dirname, '../locales')).filter((file) => !file.includes('.') && file !== 'en'));

  // Load the locale routes data
  const routesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/localeRoutes.json'), 'utf8'));

  for (const lang of langs) {
    // See if main.json and simulator.json both exist in the language directory. Otherwise, skip this language.
    const mainPath = path.join(__dirname, '../locales', lang, 'main.json');
    const simulatorPath = path.join(__dirname, '../locales', lang, 'simulator.json');
    if (!fs.existsSync(mainPath) || !fs.existsSync(simulatorPath) || 
        Object.keys(JSON.parse(fs.readFileSync(mainPath, 'utf8'))).length === 0 ||
        Object.keys(JSON.parse(fs.readFileSync(simulatorPath, 'utf8'))).length === 0) {
      continue;
    }

    localeData[lang] = {};

    // Load the JSON data for the language.
    const mainData = JSON.parse(fs.readFileSync(mainPath, 'utf8'));
    const simulatorData = JSON.parse(fs.readFileSync(simulatorPath, 'utf8'));

    // Set the name of the language
    localeData[lang].name = mainData.meta.languageName || lang;
    
    // Set the total number of strings in the language
    localeData[lang].numStrings = countStrings(mainData) + countStrings(simulatorData);

    // Set the routes for the language
    if (routesData[lang] !== undefined) {
      localeData[lang].route = routesData[lang];
    }

    // Set whether the gallery page is available.
    const galleryPath = path.join(__dirname, '../locales', lang, 'gallery.json');
    if (fs.existsSync(galleryPath) && JSON.parse(fs.readFileSync(galleryPath, 'utf8')).galleryPage) {
      localeData[lang].gallery = true;
    }

    // Set whether the modules list is available.
    const modulePath = path.join(__dirname, '../locales', lang, 'modules.json');
    if (fs.existsSync(modulePath) && JSON.parse(fs.readFileSync(modulePath, 'utf8')).modulesPage) {
      localeData[lang].modules = true;
    }

    // Set whether the module tutorial is available.
    if (fs.existsSync(modulePath) && JSON.parse(fs.readFileSync(modulePath, 'utf8')).moduleTutorial) {
      localeData[lang].moduleTutorial = true;
    }

    // Set whether the about page is available
    if (mainData.aboutPage) {
      localeData[lang].about = true;
    }

    // Set the welcome message
    if (simulatorData.welcome) {
      localeData[lang].welcome = simulatorData.welcome;
    }
  }

  return localeData;
}
