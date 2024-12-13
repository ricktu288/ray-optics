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

    // Set the routes for the language
    let route = routesData[lang];
    if (route === undefined) {
      route = '/' + lang;
    }

    localeData[lang] = {};

    // Load the JSON data for the language.
    const mainLocalePath = path.join(__dirname, '../locales', lang, 'main.json');
    const simulatorLocalePath = path.join(__dirname, '../locales', lang, 'simulator.json');
    const mainData = JSON.parse(fs.readFileSync(mainLocalePath, 'utf8'));
    const simulatorData = JSON.parse(fs.readFileSync(simulatorLocalePath, 'utf8'));

    // Set the name of the language
    localeData[lang].name = mainData.meta.languageName || lang;
    
    // Set the total number of strings in the language
    localeData[lang].numStrings = countStrings(mainData) + countStrings(simulatorData);

    // Set the routes for the language if it is not the default route.
    if (routesData[lang] !== undefined) {
      localeData[lang].route = routesData[lang];
    }
    
    // Set whether the home page is available.
    const homePath = path.join(__dirname, `../dist${route}/index.html`);
    if (fs.existsSync(homePath)) {
      localeData[lang].home = true;
    }

    // Set whether the gallery page is available.
    const galleryPath = path.join(__dirname, `../dist${route}/gallery/index.html`);
    if (fs.existsSync(galleryPath)) {
      localeData[lang].gallery = true;
    }

    // Set whether the modules list is available.
    const modulePath = path.join(__dirname, `../dist${route}/modules/modules.html`);
    if (fs.existsSync(modulePath)) {
      localeData[lang].modules = true;
    }

    // Set whether the module tutorial is available.
    const moduleTutorialPath = path.join(__dirname, `../dist${route}/modules/tutorial.html`);
    if (fs.existsSync(moduleTutorialPath)) {
      localeData[lang].moduleTutorial = true;
    }

    // Set whether the about page is available
    const aboutPath = path.join(__dirname, `../dist${route}/about.html`);
    if (fs.existsSync(aboutPath)) {
      localeData[lang].about = true;
    }

    // Set the welcome message
    if (simulatorData.welcome) {
      localeData[lang].welcome = simulatorData.welcome;
    }
  }

  return localeData;
}
