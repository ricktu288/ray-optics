import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import rayOptics from '../dist-node/main.js';
import { createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';

// Convert import.meta.url to a file path and determine the directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// List all existing languages, which are the directories in the /locales directory. Put English first.
const langs = ['en'].concat(fs.readdirSync(path.join(__dirname, '../locales')).filter((file) => !file.includes('.') && file !== 'en'));

// Load the locale routes data
const routesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/localeRoutes.json'), 'utf8'));

// Fill the rest of the locale rountes
for (const lang of langs) {
  if (routesData[lang] === undefined) {
    routesData[lang] = '/' + lang;
  }
}

// Get all the languages where the corresponding gallery directory exists
const galleryLangs = [];
const galleryDirs = {};
for (const lang of langs) {
  if (fs.existsSync(path.join(__dirname, '../dist' + routesData[lang] + '/gallery/'))) {
    galleryLangs.push(lang);
    galleryDirs[lang] = path.join(__dirname, '../dist' + routesData[lang] + '/gallery/');
  }
}

const modulesDir = path.join(__dirname, '../dist/modules/');

const canvasLight = createCanvas();
const canvasBelowLight = createCanvas();
const canvasAboveLight = createCanvas();
const canvasGrid = createCanvas();
const canvasVirtual = createCanvas();
const canvasFinal = createCanvas();

const ctxLight = canvasLight.getContext('2d');
const ctxBelowLight = canvasBelowLight.getContext('2d');
const ctxAboveLight = canvasAboveLight.getContext('2d');
const ctxGrid = canvasGrid.getContext('2d');
const ctxVirtual = canvasVirtual.getContext('2d');
const ctxFinal = canvasFinal.getContext('2d');

const scene = new rayOptics.Scene();
const simulator = new rayOptics.Simulator(scene, ctxLight, ctxBelowLight, ctxAboveLight, ctxGrid, ctxVirtual, false);

function loadScene(sceneJson, callback, backgroundImage) {
  if (sceneJson.backgroundImage) {
    loadImage(galleryDirs.en + sceneJson.backgroundImage).then((image) => {
      sceneJson.backgroundImage = null;
      loadScene(sceneJson, callback, image);
    });
    return;
  }

  if (backgroundImage) {
    scene.backgroundImage = backgroundImage;
  } else {
    scene.backgroundImage = null;
  }

  scene.loadJSON(JSON.stringify(sceneJson), function (needFullUpdate, completed) {
    if (!completed) {
      return;
    }
    callback();
  });
}

function initSimulatorForCropBox(cropBox, skipLight) {
  scene.scale = cropBox.width / (cropBox.p4.x - cropBox.p1.x);
  scene.origin = { x: -cropBox.p1.x * scene.scale, y: -cropBox.p1.y * scene.scale };

  if (!skipLight) {
    const imageWidth = cropBox.width;
    const imageHeight = cropBox.width * (cropBox.p4.y - cropBox.p1.y) / (cropBox.p4.x - cropBox.p1.x);

    canvasLight.width = imageWidth;
    canvasLight.height = imageHeight;
    canvasBelowLight.width = imageWidth;
    canvasBelowLight.height = imageHeight;
    canvasAboveLight.width = imageWidth;
    canvasAboveLight.height = imageHeight;
    canvasGrid.width = imageWidth;
    canvasGrid.height = imageHeight;
    canvasVirtual.width = imageWidth;
    canvasVirtual.height = imageHeight;
    canvasFinal.width = imageWidth;
    canvasFinal.height = imageHeight;
    simulator.rayCountLimit = cropBox.rayCountLimit || 1e7;
  }
}

function simulate(skipLight, callback) {
  simulator.eventListeners = {};
  simulator.on('simulationComplete', callback);
  simulator.on('simulationStop', callback);
  simulator.updateSimulation(skipLight, skipLight);
  if (skipLight) {
    callback();
  }
}

function exportImageFromCropBox(cropBox, filename, skipLight, callback) {
  initSimulatorForCropBox(cropBox, skipLight);
  simulate(skipLight, function () {
    // Clear final canvas
    ctxFinal.fillStyle = 'black';
    ctxFinal.fillRect(0, 0, canvasFinal.width, canvasFinal.height);

    // Draw the layers
    ctxFinal.drawImage(canvasBelowLight, 0, 0);
    ctxFinal.drawImage(canvasGrid, 0, 0);
    ctxFinal.drawImage(canvasLight, 0, 0);
    ctxFinal.drawImage(canvasAboveLight, 0, 0);

    // Save the final image as avif
    sharp(canvasFinal.toBuffer())
      .avif()
      .toFile(filename + '.avif', (err, info) => {
        if (err) {
          throw new Error(`Error processing image: ${err.message}`);
        }

        // Also save the final image as jpg for compatibility, but reduce the size of the image to 50%
        sharp(canvasFinal.toBuffer())
          .resize(Math.round(canvasFinal.width / 2), Math.round(canvasFinal.height / 2))
          .jpeg({ quality: 50 })
          .toFile(filename + '.jpg', (err, info) => {
            if (err) {
              throw new Error(`Error processing image: ${err.message}`);
            }

            callback();
          });
      });
  });
}

function exportImages(dir, itemId, lang, isThumbnail, callback) {
  const sceneJson = JSON.parse(fs.readFileSync(dir + itemId + '.json', 'utf8'));
  loadScene(sceneJson, function () {
    // Find crop boxes, where the preview one is rectangular and the thumbnail one is square
    let cropBoxPreview = null;
    let cropBoxThumbnail = null;
    for (const obj of scene.objs) {
      if (obj.constructor.type === 'CropBox') {
        if (Math.abs((obj.p4.x - obj.p1.x) - (obj.p4.y - obj.p1.y)) < 1e-6) {
          cropBoxThumbnail = obj;
        } else {
          cropBoxPreview = obj;
        }
      }
    }

    if (cropBoxPreview) {
      cropBoxPreview.width = 2280;
    } else if (!isThumbnail) {
      console.error('No preview crop box found for ' + itemId + ' in ' + lang);
      process.exit(1);
    }

    if (cropBoxThumbnail) {
      cropBoxThumbnail.width = 500;
    } else if (isThumbnail) {
      console.error('No thumbnail crop box found for ' + itemId + ' in ' + lang);
      process.exit(1);
    }

    const skipLight = lang !== 'en'; // Different languages only differs in text, so we only need to re-render the light layer for the first language in the list.

    // Export preview image
    exportImageFromCropBox(isThumbnail ? cropBoxThumbnail : cropBoxPreview, dir + itemId + (isThumbnail ? '-thumbnail' : ''), skipLight, function () {
      callback();
    });
  });
}

function exportImagesPromise(dir, itemId, lang, isThumbnail) {
  return new Promise((resolve) => {
    exportImages(dir, itemId, lang, isThumbnail, resolve);
  });
}

// Get all JSON files in the gallery directory
const galleryItems = fs.readdirSync(galleryDirs.en).filter(file => file.endsWith('.json') && file !== 'data.json').map(file => file.slice(0, -5)).filter(file => !file.startsWith('module-example-'));

async function exportAllGalleryImages() {
  const beginTime = Date.now();
  for (let item of galleryItems) {
    for (let isThumbnail of [false, true]) {
      for (let lang of galleryLangs) {
        if (fs.existsSync(galleryDirs[lang] + item + '.json')) {
          const time = Date.now();
          await exportImagesPromise(galleryDirs[lang], item, lang, isThumbnail);
          console.log('Exported ' + (isThumbnail ? 'thumbnail' : 'preview') + ' for ' + item + ' in ' + lang + ' in ' + (Date.now() - time) + 'ms');
        }
      }
    }
  }
  console.log('Exported all gallery images in ' + (Date.now() - beginTime) + 'ms');
}

// Get all JSON files in the modules directory, note that it is not multilingual
const moduleItems = fs.readdirSync(modulesDir).filter(file => file.endsWith('.json') && file !== 'data.json').map(file => file.slice(0, -5));

async function exportAllModuleImages() {
  const beginTime = Date.now();
  for (let item of moduleItems) {
    await exportImagesPromise(modulesDir, item, 'en', true);
  }
  console.log('Exported all module images in ' + (Date.now() - beginTime) + 'ms');
}

await exportAllGalleryImages();
await exportAllModuleImages();


