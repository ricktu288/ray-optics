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

// List all existing scenes IDs, which are the file name of the json files in the /data/galleryScenes directory.
const sceneFiles = fs.readdirSync(path.join(__dirname, '../data/galleryScenes'));
const sceneIDs = sceneFiles.filter((file) => file.endsWith('.json')).map((file) => file.replace('.json', ''));

// Create a dictionary converting the scene IDs to the camelCase format.
const sceneIDToCamelCase = {};
sceneIDs.forEach((id) => {
  sceneIDToCamelCase[id] = id.toLowerCase().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
});

// List all existing languages, which are the directories in the /locales directory.
const langs = fs.readdirSync(path.join(__dirname, '../locales')).filter((file) => !file.includes('.'));

// Load the locale routes.
const localeRoutes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/localeRoutes.json')).toString());

// Create the stringsKeys dictionary to store the extracted strings in the format stringsKeys[lang][string_id] = string.
const stringKeys = {};
langs.forEach((lang) => {
  stringKeys[lang] = {};

  // Load the strings from /locales/{lang}/gallery.json if it exists.
  const galleryStringsPath = path.join(__dirname, `../locales/${lang}/gallery.json`);
  if (fs.existsSync(galleryStringsPath)) {
    const galleryData = JSON.parse(fs.readFileSync(galleryStringsPath).toString());
    if (!galleryData.galleryData) {
      return;
    }
    const galleryStrings = galleryData.galleryData;
    // Extract the strings from the galleryStrings object.
    sceneIDs.forEach((id) => {
      if (galleryStrings[sceneIDToCamelCase[id]] && galleryStrings[sceneIDToCamelCase[id]].title) {
        const scene = galleryStrings[sceneIDToCamelCase[id]];
        for (const key in scene) {
          if (key === 'title') {
            stringKeys[lang][`${id}.title`] = scene[key];
          } else if (key === 'description') {
            stringKeys[lang][`${id}.description`] = scene[key];
          } else {
            if (!stringKeys[lang][key]) {
              stringKeys[lang][key] = scene[key];
            } else {
              console.log(`Duplicate string key found: ${key} in lang ${lang}, scene ${id}.`);
            }
          }
        }
      }
    });

    // Extract the common strings.
    if (galleryStrings.common) {
      for (const key in galleryStrings.common) {
        if (!stringKeys[lang][key]) {
          stringKeys[lang][key] = galleryStrings.common[key];
        } else {
          console.log(`Duplicate string key found: ${key} in lang ${lang}, common strings.`);
        }
      }
    }
  }
});

sceneIDs.forEach((id) => {
  // Load the scene data from /data/galleryScenes/{id}.json.
  const sceneData = JSON.parse(fs.readFileSync(path.join(__dirname, `../data/galleryScenes/${id}.json`)).toString());

  // Find the CropBox objects.
  let cropBoxPreview = null;
  let cropBoxThumbnail = null;
  for (const obj of sceneData.objs) {
    if (obj.type === 'CropBox') {
      if (Math.abs((obj.p4.x - obj.p1.x) - (obj.p4.y - obj.p1.y)) < 1e-6) {
        cropBoxThumbnail = obj;
      } else {
        cropBoxPreview = obj;
      }
    }
  }

  if (cropBoxPreview) {
    // Adjust the width, height, origin, and scale of the scene based on he rectangular crop box
    let effectiveWidth = cropBoxPreview.p4.x - cropBoxPreview.p1.x;
    let effectiveHeight = cropBoxPreview.p4.y - cropBoxPreview.p1.y;
    let effectiveOriginX = cropBoxPreview.p1.x;
    let effectiveOriginY = cropBoxPreview.p1.y;

    let padding = effectiveWidth * 0.25;
    effectiveWidth += padding * 2;
    effectiveHeight += padding * 2;
    effectiveOriginX -= padding;
    effectiveOriginY -= padding;

    sceneData.width = effectiveWidth;
    sceneData.height = effectiveHeight;
    sceneData.origin = {x: -effectiveOriginX, y: -effectiveOriginY};
    sceneData.scale = 1;
  }

  langs.forEach((lang) => {
    // The scene should be built in the language iff the title is translated.
    if (stringKeys[lang][`${id}.title`]) {
      // The title (name) of the scene should be put first.
      const outputData = {
        name: stringKeys[lang][`${id}.title`],
      };

      // Copy the rest of the scene data.
      for (const key in sceneData) {
        outputData[key] = JSON.parse(JSON.stringify(sceneData[key]));
      }

      // Search for all TextLabel objects recursively and replace the text with the translated strings.
      const replaceText = (obj) => {
        if (obj.type === 'TextLabel') {
          if (obj.text && obj.text.startsWith('{{') && obj.text.endsWith('}}')) {
            const stringID = obj.text.substring(2, obj.text.length - 2);
            if (stringKeys[lang][stringID]) {
              obj.text = stringKeys[lang][stringID];
            } else if (stringKeys.en[stringID]) {
              obj.text = stringKeys.en[stringID];
            } else {
              console.log(`String not found: ${stringID} in ${id}.json`);
            }
          }
        } else {
          for (const key in obj) {
            if (typeof obj[key] === 'object') {
              replaceText(obj[key]);
            }
          }
        }
      };
      replaceText(outputData);

      // Save the outputData to /dist/{locale}/gallery/{id}.json.
      const outputFolder = path.join(__dirname, `../dist${localeRoutes[lang] !== undefined ? localeRoutes[lang] : ('/' + lang)}/gallery`);
      if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder, { recursive: true });
      }
      fs.writeFileSync(path.join(outputFolder, `${id}.json`), JSON.stringify(outputData, null, 2));
    }
  });
});

// Copy all PNG files (background images) in /data/galleryScenes to /dist/gallery.
const imageFiles = sceneFiles.filter((file) => file.endsWith('.png'));
imageFiles.forEach((file) => {
  fs.copyFileSync(path.join(__dirname, `../data/galleryScenes/${file}`), path.join(__dirname, `../dist/gallery/${file}`));
});

console.log('All Gallery scenes built successfully.');

// Build the scenes for the modules. Currently just copy the files from /data/moduleScenes to /dist/modules.
const moduleFiles = fs.readdirSync(path.join(__dirname, '../data/moduleScenes'));
moduleFiles.forEach((file) => {
  fs.copyFileSync(path.join(__dirname, `../data/moduleScenes/${file}`), path.join(__dirname, `../dist/modules/${file}`));
});

console.log('All Module scenes built successfully.');
