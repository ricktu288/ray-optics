const fs = require('fs');
const path = require('path');
const { Scene, Simulator, sceneObjs, geometry } = require(path.join(__dirname, '../dist-node/main.js'));

const { createCanvas, loadImage } = require('canvas');
const { config } = require('process');

const inputDir = path.join(__dirname, '../src/webpages/tw/gallery/');
const outputDir = path.join(__dirname, '../dist/img_test/');

// If the output directory does not exist, create it
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
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
    loadImage(inputDir + sceneJson.backgroundImage).then((image) => {
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

function initSimulatorForCropBox(cropBox) {
  scene.scale = cropBox.width / (cropBox.p4.x - cropBox.p1.x);
  scene.origin = { x: -cropBox.p1.x * scene.scale, y: -cropBox.p1.y * scene.scale };

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

function simulate(skipLight, callback) {
  simulator.eventListeners = {};
  simulator.on('simulationComplete', callback);
  simulator.on('simulationStop', callback);
  simulator.updateSimulation(skipLight, skipLight);
}

function exportImageFromCropBox(cropBox, filename, callback) {
  initSimulatorForCropBox(cropBox);
  simulate(false, function () {
    // Clear final canvas
    ctxFinal.fillStyle = 'black';
    ctxFinal.fillRect(0, 0, canvasFinal.width, canvasFinal.height);

    // Draw the layers
    ctxFinal.drawImage(canvasBelowLight, 0, 0);
    ctxFinal.drawImage(canvasGrid, 0, 0);
    ctxFinal.drawImage(canvasLight, 0, 0);
    ctxFinal.drawImage(canvasAboveLight, 0, 0);

    // Save the final image as jpg
    const out = fs.createWriteStream(outputDir + filename);
    const stream = canvasFinal.createJPEGStream({ quality: 0.75 });
    stream.pipe(out);
    out.on('finish', callback);
  });
}

function exportImages(itemId, callback) {
  const sceneJson = JSON.parse(fs.readFileSync(inputDir + itemId + '.json', 'utf8'));
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
      console.error('No preview crop box found');
      return;
    }

    if (!cropBoxThumbnail) {
      console.error('No thumbnail crop box found');
      return;
    }

    cropBoxPreview.width = 1140;
    cropBoxThumbnail.width = 500;

    // Export preview image
    exportImageFromCropBox(cropBoxPreview, itemId + '.jpg', function () {
      // Export thumbnail image
      exportImageFromCropBox(cropBoxThumbnail, itemId + '-thumbnail.jpg', function () {
        callback();
      });
    });
  });
}

function exportImagesPromise(itemId) {
  return new Promise((resolve) => {
    exportImages(itemId, resolve);
  });
}

// Get all JSON files in the input directory
//const items = fs.readdirSync(inputDir).filter(file => file.endsWith('.json') && file !== 'data.json').map(file => file.slice(0, -5));

const items = ['apparent-depth', 'chaff-countermeasure', 'rainbows', 'branched-flow'];

async function exportAllImages() {
  for (let item of items) {
    console.log('Exporting images for ' + item + '...');
    const time = Date.now();
    await exportImagesPromise(item);
    console.log('Images exported in ' + (Date.now() - time) + ' ms' + '\n');
  }
}

exportAllImages();