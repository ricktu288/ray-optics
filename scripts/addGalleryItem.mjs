import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jsonUrl from 'json-url';


// Convert import.meta.url to a file path and determine the directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the gallery data.
const galleryList = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/galleryList.json'), 'utf8'));
const categoryIDs = galleryList.map((category) => category.id);

// List all existing scenes IDs, which are the file name of the json files in the /data/galleryScenes directory.
const sceneFiles = fs.readdirSync(path.join(__dirname, '../data/galleryScenes'));
const sceneIDs = sceneFiles.filter((file) => file.endsWith('.json')).map((file) => file.replace('.json', ''));

// Create a dictionary converting the scene IDs to the camelCase format.
const sceneIDToCamelCase = {};
sceneIDs.forEach((id) => {
  sceneIDToCamelCase[id] = id.toLowerCase().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
});

// Load the English data of the gallery.
const galleryLocaleData = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en/gallery.json'), 'utf8'));
const galleryStrings = galleryLocaleData.galleryData;
const galleryCagegories = galleryLocaleData.galleryPage.categories;

// Create a dictionary converting the category IDs to the camelCase format.
const categoryIDToCamelCase = {};
categoryIDs.forEach((id) => {
  categoryIDToCamelCase[id] = id.toLowerCase().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
});

// Create a dictionary mapping the IDs to the English titles.
const sceneIDToTitle = {};
sceneIDs.forEach((id) => {
  sceneIDToTitle[id] = galleryStrings[sceneIDToCamelCase[id]].title;
});

// Create a dictionary mapping the category IDs to the English titles.
const categoryIDToTitle = {};
categoryIDs.forEach((id) => {
  categoryIDToTitle[id] = galleryCagegories[categoryIDToCamelCase[id]];
});

// Create an object mapping all string keys to the English values, with reserved keys mapping to null.
const reservedKeys = ["title", "description"];
const stringKeys = {};
reservedKeys.forEach((key) => {
  stringKeys[key] = null;
});
sceneIDs.forEach((id) => {
  const scene = galleryStrings[sceneIDToCamelCase[id]];
  for (const key in scene) {
    if (!reservedKeys.includes(key)) {
      stringKeys[key] = {string: scene[key], source: id};
    }
  }
});

// Add the common keys to stringKeys.
for (const key in galleryStrings.common) {
  stringKeys[key] = {string: galleryStrings.common[key], source: 'common'};
}

// Prompt the requirement to the user.
console.log('Welcome to the gallery item creation tool.');
console.log('');
console.log('Please read the requirements for the new gallery item:');
console.log('1. All translatable text must be in English. If you want to provide a version in some other language, you can do this with the translation tool after the scene is added.');
console.log('3. The scene must have a title. You can set the title in the simulator using FIle -> Save -> Rename.');
console.log('4. The scene must have two CropBox objects, one is square (for the thumbnail in the Gallery list) and the other is rectangular (for the preview in the item page). To create a CropBox object, click File -> Export PNG/SVG (but no need to actually export the image). To create the second CropBox, click Duplicate in the object bar while the first CropBox is selected. To make it square, set the two coordinates of the crop box to the same value in the object bar. If your scene involves infinite numbers of rays (e.g. repeated reflection in a cavity), you should click "More options..." and set a suitable "Ray count limit" for both CropBox objects to avoid infinite loops. Do not adjust other properties.');
console.log('5. All translatable text in the scene must have an appropriate aligment, as the length of the text may vary in different languages but the coordinates of the TextLabel will not change with the language. To set the alignment, select the text label, click "More options..." in the object bar. You should avoid placing the text labels at some length-sensitive positions, so if the text becomes too long in some languages, it will not overlap with other objects or go out of some CropBox.');
console.log('6. When the scene is ready, click File -> Copy Sharable Link. The shared URL will be used to provide the scene data. Ignore the warning if the URL is too long.');
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

// Ensure that the scene data has a title.
let title = sceneData.name;
if (!title) {
  console.log('Error: The scene does not have a title.');
  process.exit(1);
}

// The title is not stored in the extracted scene data.
delete sceneData.name;

// Ensure that the scene data contains two CropBox objects, one is square (for thumbnail) and the other is rectangular (for preview).
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

if (!cropBoxPreview) {
  console.log('Error: No preview crop box found.');
  process.exit(1);
}

if (!cropBoxThumbnail) {
  console.log('Error: No thumbnail crop box found.');
  process.exit(1);
}

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

// Convert the title into an kebab-case ID.
let id = title.toLowerCase().replace(/ /g, '-');
const MAX_ID_LENGTH = 55;
if (id.length > MAX_ID_LENGTH) {
  id = id.substring(0, MAX_ID_LENGTH);
}

// Prompt the user for the id of the scene, with the above title as a default. The length of the ID must not exceed 55 characters.
console.log('Please provide the ID of the scene, which is used in the URL of the scene page. The ID is usually the title (or some shortened form) in the kebab-case format. It cannot be changed after the scene is published.');
let idInput = await inquirer.prompt({
  type: 'text',
  name: 'id',
  message: "The ID of the scene:",
  default: id,
  validate: (input) => {
    if (input.length > MAX_ID_LENGTH) {
      return `The ID must not exceed ${MAX_ID_LENGTH} characters.`;
    }
    if (sceneIDs.includes(input)) {
      return 'The ID is already in use.';
    }
    return true;
  }
});
console.log('');

id = idInput.id;

const newSceneIdCamelCase = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
sceneIDToCamelCase[id] = newSceneIdCamelCase;
sceneIDToTitle[id] = title;

const newSceneStrings = {};
newSceneStrings.title = title;

// Prompt the user for the description of the scene, which can be multi-line.
console.log('Please provide the description of the scene in markdown format. To include inline LaTeX equations, use the \\( and \\) delimiters. To include displayed LaTeX equation, use \\begin{equation} and \\end{equaion}. The equation will be rendered using MathJax. To include a link to another scene in the gallery, use the format [title](/gallery/SCENE_ID).');
const descriptionPrompt = await inquirer.prompt({
  type: 'editor',
  name: 'description',
  message: "The description of the scene:",
});

const description = descriptionPrompt.description;
newSceneStrings.description = description;
console.log('');
console.log(description);
console.log('');

// Extract the TextLabel objects from the scene data recursively. Store the references to an array.
const textLabels = [];
function extractTextLabels(obj) {
  if (obj.type === 'TextLabel') {
    textLabels.push(obj);
  } else {
    // Loop through all the properties of the object.
    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        extractTextLabels(obj[key]);
      }
    }
  }
}
extractTextLabels(sceneData);

if (textLabels.length > 0) {
  const MAX_PREVIEW_CHARACTERS = 50;

  // Collect all texts. Truncate the text if too long.
  const textPreviews = textLabels.map((textLabel) => {
    const text = textLabel.text;
    const firstLine = text.split('\n')[0];
    const truncated = firstLine.length > MAX_PREVIEW_CHARACTERS ? firstLine.substring(0, MAX_PREVIEW_CHARACTERS) + '...' : firstLine;
    return text.includes('\n') || firstLine.length > MAX_PREVIEW_CHARACTERS ? truncated + '...' : truncated;
  });

  // Ask the user for each text if it is translatable. Use one prompt including all texts.
  console.log('Please select which texts in the scene are translatable to other languages. If a text contains at least one English word, it should be marked as translatable. However, if the only words are part of a variable name of some module (e.g. "N_slice=20"), it should not be marked as translatable.');
  const translatablePrompt = await inquirer.prompt({
    type: 'checkbox',
    name: 'translatable',
    message: "Which texts are translatable?",
    choices: textPreviews.map((text, index) => ({ name: text, value: index, checked: text.length >= 3 })),
  });
  console.log('');

  const translatableIndexes = translatablePrompt.translatable;

  // Ask if any of those translatable texts should be stored in the common gallery strings.
  console.log('Please select which translatable texts are common strings. Common strings are shared among multiple scenes. Please mark the text as common only if it is truly general and does not depend on the context of the scene. The current convension is to only mark long warning-type texts as common strings.');
  const commonStringsPrompt = await inquirer.prompt({
    type: 'checkbox',
    name: 'commonStrings',
    message: "Which translatable texts are common strings?",
    choices: translatableIndexes.map(index => ({
      name: textPreviews[index],
      value: index,
      checked: false
    })),
  });
  console.log('');

  const commonStringsIndexes = commonStringsPrompt.commonStrings;
  const nonCommonStringsIndexes = translatableIndexes.filter(index => !commonStringsIndexes.includes(index));

  let hasMultipleInstances = false;
  for (const index of translatableIndexes) {
    const textLabel = textLabels[index];
    const text = textLabel.text;

    // Generate a default key from the letters and digits of the English version with all lowercase and no spaces, clipped to 20 characters.
    let tempKey = text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 20);

    // If the key is empty or starts with a digit, prepend a letter.
    if (tempKey.length === 0 || tempKey[0].match(/[0-9]/)) {
      tempKey = 't' + tempKey;
    }

    // If the key is already in use, append a number to it.
    let number = 1;
    let newKey = tempKey;
    while (Object.keys(stringKeys).includes(newKey)) {
      newKey = tempKey + number;
      number++;
    }

    // Search if the text appears in some existing items. List all instances.
    const instances = [];
    for (const key in stringKeys) {
      if (stringKeys[key] && stringKeys[key].string === text) {
        instances.push(key);
      }
    }

    let key = newKey;

    // Ask the user if the text should be linked to an existing string key.
    if (instances.length > 0) {
      if (!hasMultipleInstances) {
        hasMultipleInstances = true;
        console.log('Some translatable texts are identical to existing strings. Please select which string key should be used for each text. If the identical string is from another scene (i.e. not the current scene or a common string), you should only link it if the two scenes are parallel in content. Otherwise, create a new key even if the strings are identical.');
      }

      const keyPrompt = await inquirer.prompt({
        type: 'list',
        name: 'key',
        message: `The text "${textPreviews[index]}" appears in the following items. Which one should be used?`,
        choices: [
          { name: 'Create a new key', value: newKey },
          ...instances.map(instance => ({
            name: `{{${instance}}} in "${sceneIDToTitle[stringKeys[instance].source] || 'common'}"`,
            value: instance
          }))
        ],
      });
      console.log('');
      key = keyPrompt.key;
    }

    // Replace the text in the scene data with {{key}}.
    textLabel.text = `{{${key}}}`;

    // Store the text in the new scene strings.
    if (key === newKey) {
      if (commonStringsIndexes.includes(index)) {
        stringKeys[key] = { string: text, source: 'common' };
        galleryStrings.common[key] = text;
      } else {
        stringKeys[key] = { string: text, source: id };
        newSceneStrings[key] = text;
      }
    }
  }
}

// Ask if the scene contains a background image.
console.log('If your scene contains a background image, the image file must be provided manually in /data/galleryScenes directory. The image file must be in the PNG format and the file name must be the ID of the scene followed by "-background.png".');
const backgroundImagePrompt = await inquirer.prompt({
  type: 'confirm',
  name: 'backgroundImage',
  message: "Does the scene contain a background image?",
  default: false,
});
console.log('');

if (backgroundImagePrompt.backgroundImage) {
  sceneData.backgroundImage = `${id}-background.png`;
}

// Ask the user for the category of the scene.
console.log('Please select the category of the scene. By the current convention, if the simulation is about a general principle or commonly used optical instrument, it is placed in the category corresponding in the most important optical principle. If there is no specific optical principle, the most important principle is not listed, or if the simulation is about an application of optics, then it should be placed in the "Miscellaneous" category.');
const categoryPrompt = await inquirer.prompt({
  type: 'list',
  name: 'category',
  message: "The category of the scene:",
  choices: categoryIDs.map((id) => ({ name: categoryIDToTitle[id], value: id })),
});
console.log('');

const category = categoryPrompt.category;
const categoryCamelCase = categoryIDToCamelCase[category];

// Ask the user for the position of the scene in the category. The position is stored as the id of the scene before the new scene. One should not put the new scene in the first position.
console.log('Please select the position of the scene in the category. The new scene will be placed after the selected scene. If there are existing scenes in the category related to the new scene, you can place the new scene after them. Otherwise, it is recommended to place the new scene at the end of the category.');
const categoryScenes = galleryList.find((category1) => category1.id === category).content;
const categorySceneTitles = categoryScenes.map((scene) => sceneIDToTitle[scene.id]);
const categoryScenePrompt = await inquirer.prompt({
  type: 'list',
  name: 'position',
  message: "The position of the scene in the category:",
  choices: categorySceneTitles.map((title, index) => ({ name: title, value: index })),
  loop: false,
});
console.log('');

const position = categoryScenePrompt.position;
const positionID = categoryScenes[position].id;
const positionCamelCase = sceneIDToCamelCase[positionID];

// Ask the name of the contributors.
console.log('Please provide the name of the contributor(s) of the scene. The name will be displayed in the scene page as well as the About page. The name can be a pseudonym or a real name, but must be in Latin characters. If the contributor has contributed before, please use the same name. If the author has a GitHub account, it is recommended to use the GitHub username or the "name" field in the GitHub profile if it is in Latin characters. If the scene has multiple contributors, separate the names by semicolons, and should sort by the chronological order of the contributions.')
const contributorsPrompt = await inquirer.prompt({
  type: 'text',
  name: 'contributors',
  message: "The name of the contributor(s):",
});
console.log('');

const contributors = contributorsPrompt.contributors;
const contributorList = contributors.split(';').map((name) => name.trim());

// Insert the new scene into the category.
categoryScenes.splice(position + 1, 0, { id: id, title: title, contributors: contributorList });

// Update the gallery strings, inserting the new item next to the selected item.
const newGalleryStrings = {};
for (const key in galleryStrings) {
  newGalleryStrings[key] = galleryStrings[key];
  if (key === positionCamelCase) {
    newGalleryStrings[newSceneIdCamelCase] = newSceneStrings;
  }
}

const newGalleryLocaleData = {
  galleryPage: galleryLocaleData.galleryPage,
  galleryData: newGalleryStrings,
};

// Output the gallery scene.
const scenePath = path.join(__dirname, `../data/galleryScenes/${id}.json`);
fs.writeFileSync(scenePath, JSON.stringify(sceneData, null, 2));

// Output the gallery list.
const galleryListPath = path.join(__dirname, '../data/galleryList.json');
fs.writeFileSync(galleryListPath, JSON.stringify(galleryList, null, 2));

// Output the gallery locale data.
const galleryLocalePath = path.join(__dirname, '../locales/en/gallery.json');
fs.writeFileSync(galleryLocalePath, JSON.stringify(newGalleryLocaleData, null, 2));

console.log('The scene has been successfully added to the gallery.');
console.log('If some of the contributors are new, please add their names manually to the /data/contributors.json file.');