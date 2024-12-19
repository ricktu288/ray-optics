/*
 * Copyright 2024 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';


// Convert import.meta.url to a file path and determine the directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the gallery data.
const galleryList = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/galleryList.json'), 'utf8'));

// Load the module data.
const moduleList = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/moduleList.json'), 'utf8'));

// Load the English strings for the gallery.
const galleryStrings = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en/gallery.json'), 'utf8'));

// Load the English strings for the modules.
const moduleStrings = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en/modules.json'), 'utf8'));

// Sort the gallery strings by the order in the gallery list.
const galleryData = galleryStrings.galleryData;
const newGalleryData = { common: galleryData.common };
for (const category of galleryList) {
  for (const item of category.content) {
    const idCamelCase = item.id.toLowerCase().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    if (galleryData[idCamelCase]) {
      newGalleryData[idCamelCase] = galleryData[idCamelCase];
    }
  }
}

// Add the items in galleryData but not in galleryList.
for (const id in galleryData) {
  if (!newGalleryData[id]) {
    newGalleryData[id] = galleryData[id];
  }
}

galleryStrings.galleryData = newGalleryData;

// Sort the module strings by the order in the module list.
const moduleData = moduleStrings.moduleData;
const newModuleData = {};
for (const module of moduleList) {
  const idCamelCase = module.id.toLowerCase().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  if (moduleData[idCamelCase]) {
    newModuleData[idCamelCase] = moduleData[idCamelCase];
  }
}

// Add the items in moduleData but not in moduleList.
for (const id in moduleData) {
  if (!newModuleData[id]) {
    newModuleData[id] = moduleData[id];
  }
}

moduleStrings.moduleData = newModuleData;

// Write the sorted gallery strings to the gallery file.
fs.writeFileSync(path.join(__dirname, '../locales/en/gallery.json'), JSON.stringify(galleryStrings, null, 2));

// Write the sorted module strings to the module file.
fs.writeFileSync(path.join(__dirname, '../locales/en/modules.json'), JSON.stringify(moduleStrings, null, 2));


// Sort the keys in other languages according to the English strings.
// List all existing languages, which are the directories in the /locales directory.
const langs = fs.readdirSync(path.join(__dirname, '../locales')).filter((file) => !file.includes('.'));

// List all existing namespaces, which are the json files in the /locales/en directory.
const namespaces = fs.readdirSync(path.join(__dirname, '../locales/en')).filter((file) => file.endsWith('.json'));

// Define the recursive function to sort the keys in the JSON object from the corresponding English object. Some keys are in the format {{key}}_{{suffix}}, which should be treated as a single key {{key}}. The suffix is for grammatical inflection. The relative order of the keys with the same {{key}} should not be changed.
function sortKeys(obj, enObj) {
  const newObj = {};
  const keyRoots = [];
  for (const key in enObj) {
    const keyRoot = key.replace(/_.*$/, '');
    if (!keyRoots.includes(keyRoot)) {
      keyRoots.push(keyRoot);
    }
  }

  for (const keyRoot of keyRoots) {
    const keys = [];
    for (const key in obj) {
      const keyRoot2 = key.replace(/_.*$/, '');
      if (keyRoot2 === keyRoot) {
        keys.push(key);
      }
    }

    for (const key of keys) {
      if (typeof obj[key] !== 'object') {
        newObj[key] = obj[key];
      } else {
        newObj[key] = sortKeys(obj[key], enObj[key]);
      }
    }
  }

  return newObj;
}

// Sort the keys in the JSON files for each language for each namespace.
for (const namespace of namespaces) {
  const enObj = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en', namespace), 'utf8'));
  for (const lang of langs) {
    if (lang === 'en') {
      continue;
    }

    // Load the JSON object for the language, which may not exist.
    const langPath = path.join(__dirname, '../locales', lang, namespace);
    if (!fs.existsSync(langPath)) {
      continue;
    }

    const langObj = JSON.parse(fs.readFileSync(langPath, 'utf8'));
    const newLangObj = sortKeys(langObj, enObj);
    fs.writeFileSync(langPath, JSON.stringify(newLangObj, null, 2));
  }
}