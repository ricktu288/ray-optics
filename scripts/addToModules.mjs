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

import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jsonUrl from 'json-url';
import { type } from 'os';
import { index } from 'mathjs';


// Convert import.meta.url to a file path and determine the directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the module data.
const moduleList = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/moduleList.json')).toString());

// List all existing modules IDs, which are the file name of the json files in the /data/moduleScenes directory.
const sceneFiles = fs.readdirSync(path.join(__dirname, '../data/moduleScenes'));
const sceneIDs = sceneFiles.filter((file) => file.endsWith('.json')).map((file) => file.replace('.json', ''));

// Load the English data of the modules.
const moduleLocaleData = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en/modules.json'), 'utf8'));
const moduleStrings = moduleLocaleData.moduleData;

// Create a dictionary mapping the IDs to the English titles.
const moduleIDToTitle = {};
sceneIDs.forEach((id) => {
  moduleIDToTitle[id] = moduleStrings[id].title;
});

// Prompt the requirement to the user.
console.log('Welcome to the module item creation tool.');
console.log('');
console.log('Plrease read the requirements for the new module item:');
console.log('1. The ID of the module (and its dependencies if any) should be in PascalCase English. The ID of the main module (not including dependencies) should not be the same as one already in the module list.');
console.log('2. All parameter names should contains only letters, numbers, and underscores, and should not start with a number, and should not cause conflicts when underscores are removed.');
console.log('3. You should make a scene containing the module (and its dependencies if any), with a minimal example of the module usage to be used in the thumbnail.');
console.log('4. The module and the example usage should not contain translatable text (put them in the description instead). If variable names contain words, they should be in English.');
console.log('5. The scene must contain one square CropBox object. To create a CropBox object, click File -> Export PNG/SVG (but no need to actually export the image). To make it square, set the two coordinates of the crop box to the same value in the object bar. Do not adjust image format and resolution.')
console.log('6. If the scene involves infinite numbers of rays (e.g. repeated reflection in a cavity), you should click "More options..." and set a suitable "Ray count limit" for the CropBox to avoid infinite loops.')
console.log('7. When the scene is ready, click File -> Copy Sharable Link. The shared URL will be used to provide the scene data. Ignore the warning if the URL is too long.');
console.log('');

// Prompt the user for the scene data (the shared URL).
const sceneURLInput = await inquirer.prompt({
  type: 'editor',
  name: 'sceneURL',
  message: "The shared URL of the scene:",
});
console.log('');

// Decode the hash part of the URL (LZMA compressed JSON) using json-url.
const sceneData = await jsonUrl('lzma').decompress(sceneURLInput.sceneURL.split('#')[1]);

const moduleIDsInScene = Object.keys(sceneData.modules);

// Ensure that all module names are in PascalCase and contains only letters and numbers, and is not starting with a number, and the parameter names conatins only letters, numbers, and underscores, and is not starting with a number.
moduleIDsInScene.forEach((moduleID) => {
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(moduleID)) {
    console.log(`Error: The module name "${moduleID}" is not in PascalCase or contains invalid characters.`);
    process.exit(1);
  }
});

// See if there are any modules in the scene. If there are more than one, prompt the user to choose one (unless the name of the scene matches one of the module IDs).
let moduleID;
if (moduleIDsInScene.length === 1) {
  moduleID = moduleIDsInScene[0];
} else if (moduleIDsInScene.length > 1) {
  if (sceneData.name in moduleIDsInScene) {
    moduleID = sceneData.name;
  } else {
    const moduleIDInput = await inquirer.prompt({
      type: 'list',
      name: 'moduleID',
      message: "Choose the main module of the scene:",
      choices: moduleIDsInScene,
    });
    console.log('');

    moduleID = moduleIDInput.moduleID;
  }
} else {
  console.log('Error: No modules found in the scene.');
  process.exit(1);
}

// Ensure that the module ID is not already in the module list.
if (sceneIDs.includes(moduleID)) {
  console.log(`Error: The module ID "${moduleID}" is already in the module list.`);
  process.exit(1);
}

// Set the name of the scene to the module ID.
sceneData.name = moduleID;

// Ensure that the scene data contains a square CropBox object.
let cropBoxThumbnail;
for (const obj of sceneData.objs) {
  if (obj.type === 'CropBox') {
    if (Math.abs((obj.p4.x - obj.p1.x) - (obj.p4.y - obj.p1.y)) < 1e-6) {
      cropBoxThumbnail = obj;
    }
  }
}

if (!cropBoxThumbnail) {
  console.log('Error: No square CropBox object found in the scene.');
  process.exit(1);
}

// Collect the keys for the new module.
const newKeys = ['title', 'description'];
for (let i = 1; i <= (sceneData.modules[moduleID].numPoints || 0); i++) {
  newKeys.push(`point${i}`);
}
for (const param of sceneData.modules[moduleID].params) {
  const paramName = param.split('=')[0];
  
  // The key is the parameter name with underscores removed.
  const key = paramName.replace(/_/g, '');

  // Ensure that the key contains only letters and numbers, and is not starting with a number.
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) {
    console.log(`Error: The parameter name "${paramName}" contains invalid characters.`);
    process.exit(1);
  }

  // Ensure that the key does not conflict with existing keys.
  if (newKeys.includes(key)) {
    console.log(`Error: The parameter name "${paramName}" conflicts with an existing key "${key}".`);
    process.exit(1);
  }
}

// Prompt the user for the title, description, and specification of the module.
console.log('Please provide the title, description, and specificaiton of the module. They must be in English. If you want to provide translations, please do it after the module is added to the module list. The description and specification are in Markdown format, with each item in the specification having only a single line (do not include the bullet point). To include inline LaTeX equations, use the \\( and \\) delimiters. To include displayed LaTeX equation, use \\begin{equation} and \\end{equaion}. The equation will be rendered using MathJax. To include a link to a scene in the gallery, use the format [title](/gallery/SCENE_ID).');

const fields = [
  {
    type: 'text',
    name: 'title',
    message: 'Title of the module:',
    default: moduleID.replace(/([A-Z])/g, ' $1').trim()
  },
  {
    type: 'editor',
    name: 'description',
    message: 'Description of the module:'
  }
];

for (let i = 1; i <= (sceneData.modules[moduleID].numPoints || 0); i++) {
  fields.push({
    type: 'text',
    name: `point${i}`,
    message: `Description of the ${i}${i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th'} control point:`
  });
}

for (const param of sceneData.modules[moduleID].params) {
  const paramName = param.split('=')[0];
  fields.push({
    type: 'text',
    name: paramName.replace(/_/g, ''),
    message: `Description of the parameter "${paramName}":`
  });
}

const moduleInput = await inquirer.prompt(fields);
console.log('');

const newStrings = {};
for (const key of newKeys) {
  newStrings[key] = moduleInput[key];
}
newStrings.description = newStrings.description.trim();

// Ask the user for the position of the module in the module list. There is no category for now. One should not put the new module in the first position of the list.
const category = 'defaultCategory';
console.log('Please provide the position of the module in the module list. The module will be placed after the selected module. If there are existing modules related to the new module, you can place the new module after them. Otherwise, it is recommended to place the new module at the end of the list.');
const categoryModules = moduleList.find((category1) => category1.id === category).content;
const categoryModuleTitles = categoryModules.map((module1) => moduleIDToTitle[module1.id]);
const modulePositionInput = await inquirer.prompt({
  type: 'list',
  name: 'position',
  message: 'The position of the module in the module list:',
  choices: categoryModuleTitles.map((title, index) => ({name: title, value: index})),
  loop: false,
});
console.log('');

const position = modulePositionInput.position;
const positionID = categoryModules[position].id;

// Ask the name of the contributors.
console.log('Please provide the name of the contributor(s) of the module. The name will be displayed in the module list as well as the About page. The name can be a pseudonym or a real name, but must be in Latin characters. If the contributor has contributed before, please use the same name. If the author has a GitHub account, it is recommended to use the GitHub username or the "name" field in the GitHub profile if it is in Latin characters. If the module has multiple contributors, separate the names by semicolons, and should sort by the chronological order of the contributions. If a dependency is used, the name of the contributor(s) of the dependency should only be included if the dependency is not in the module list.');
const contributorsPrompt = await inquirer.prompt({
  type: 'text',
  name: 'contributors',
  message: "The name of the contributor(s):",
});
console.log('');

const contributors = contributorsPrompt.contributors;
const contributorList = contributors.split(';').map((name) => name.trim());

// Insert the new module into the category.
categoryModules.splice(position + 1, 0, {id: moduleID, contributors: contributorList});

// Update the module strings, inserting the new keys next to the selected module.
const newModuleStrings = {};
for (const key in moduleStrings) {
  newModuleStrings[key] = moduleStrings[key];
  if (key === positionID) {
    newModuleStrings[moduleID] = newStrings;
  }
}
moduleLocaleData.moduleData = newModuleStrings;

// Output the module scene.
const moduleScenePath = path.join(__dirname, `../data/moduleScenes/${moduleID}.json`);
fs.writeFileSync(moduleScenePath, JSON.stringify(sceneData, null, 2));

// Output the module list.
const moduleListPath = path.join(__dirname, '../data/moduleList.json');
fs.writeFileSync(moduleListPath, JSON.stringify(moduleList, null, 2));

// Output the module locale data.
const moduleLocalePath = path.join(__dirname, '../locales/en/modules.json');
fs.writeFileSync(moduleLocalePath, JSON.stringify(moduleLocaleData, null, 2));

console.log('The module item has been successfully added.');
console.log('If some of the contributors are new, please add their names manually to the /data/contributors.json file.');