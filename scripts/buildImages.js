const fs = require('fs');
const path = require('path');
const { Scene, Simulator, sceneObjs, geometry } = require(path.join(__dirname, '../dist-node/main.js'));

const { createCanvas, loadImage } = require('canvas');
const sharp = require('sharp');
const { info } = require('console');

const langs = ['en', 'pl', 'zh-CN', 'zh-TW'];
const dirs = {
  'en': path.join(__dirname, '../dist/gallery/'),
  'pl': path.join(__dirname, '../dist/pl/gallery/'),
  'zh-CN': path.join(__dirname, '../dist/cn/gallery/'),
  'zh-TW': path.join(__dirname, '../dist/tw/gallery/')
}

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

const scene = new Scene();
const simulator = new Simulator(scene, ctxLight, ctxBelowLight, ctxAboveLight, ctxGrid, ctxVirtual, false);

function loadScene(sceneJson, callback, backgroundImage) {
  if (sceneJson.backgroundImage) {
    loadImage(dirs.en + sceneJson.backgroundImage).then((image) => {
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
      .toFile(filename, (err, info) => {
        if (err) {
          throw new Error(`Error processing image: ${err.message}`);
        }
        callback();
      });
  });
}

function exportImages(itemId, lang, isThumbnail, callback) {
  const sceneJson = JSON.parse(fs.readFileSync(dirs[lang] + itemId + '.json', 'utf8'));
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

    if (!cropBoxPreview) {
      throw new Error('No preview crop box found');
    }

    if (!cropBoxThumbnail) {
      throw new Error('No thumbnail crop box found');
    }

    cropBoxPreview.width = 2280;
    cropBoxThumbnail.width = 500;

    const skipLight = lang !== 'en'; // Different languages only differs in text, so we only need to re-render the light layer for the first language in the list.

    // Export preview image
    exportImageFromCropBox(isThumbnail ? cropBoxThumbnail : cropBoxPreview, dirs[lang] + itemId + (isThumbnail ? '-thumbnail.avif' : '.avif'), skipLight, function () {
      callback();
    });
  });
}

function exportImagesPromise(itemId, lang, isThumbnail) {
  return new Promise((resolve) => {
    exportImages(itemId, lang, isThumbnail, resolve);
  });
}

// Get all JSON files in the input directory
const items = fs.readdirSync(dirs.en).filter(file => file.endsWith('.json') && file !== 'data.json').map(file => file.slice(0, -5));

async function exportAllImages() {
  const beginTime = Date.now();
  for (let item of items) {
    for (isThumbnail of [false, true]) {
      for (let lang of langs) {
        if (fs.existsSync(dirs[lang] + item + '.json')) {
          const time = Date.now();
          await exportImagesPromise(item, lang, isThumbnail);
          console.log('Exported ' + (isThumbnail ? 'thumbnail' : 'preview') + ' for ' + item + ' in ' + lang + ' in ' + (Date.now() - time) + 'ms');
        }
      }
    }
  }
  console.log('Exported all images in ' + (Date.now() - beginTime) + 'ms');
}

exportAllImages();