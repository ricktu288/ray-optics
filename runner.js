/*
 * Copyright 2025 The Ray Optics Simulation authors and contributors
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

const rayOptics = require('./rayOptics.js');

// Read JSON input from stdin
let inputData = '';
process.stdin.on('data', (chunk) => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    // Parse the JSON input
    const sceneJson = JSON.parse(inputData);
    
    // Create scene and load JSON
    const scene = new rayOptics.Scene();
    scene.loadJSON(JSON.stringify(sceneJson), function(needFullUpdate, completed) {
      if (completed) {
        // Find all cropboxes and detectors
        const cropBoxes = scene.objs.filter(obj => obj.constructor.type === 'CropBox');
        const detectors = scene.objs.filter(obj => obj.constructor.type === 'Detector');

        // Check if node-canvas is available
        const hasCanvas = (function() {
          try {
            require('canvas');
            return true;
          } catch (e) {
            return false;
          }
        })();

        // Prepare result object
        const result = {
          detectors: [],
          images: [],
          error: null,
          warning: null
        };

        // Collect error and warning information
        const errors = [];
        const warnings = [];

        // Check for canvas requirement
        if (cropBoxes.length > 0 && !hasCanvas) {
          result.error = "Canvas module not found. To use image generation, install node-canvas.";
          console.log(JSON.stringify(result));
          process.exit(1);
        }

        // Main simulation function
        async function runSimulation() {
          // If no cropboxes, run a simple simulation for detector readings
          if (cropBoxes.length === 0) {
            await simulateWithoutCanvas();
          } else {
            // Has cropboxes, run with canvas
            const { createCanvas } = require('canvas');
            
            // Process each cropbox
            for (let i = 0; i < cropBoxes.length; i++) {
              await simulateWithCanvas(cropBoxes[i], createCanvas, i);
            }
            
            // Run one more time for detector readings if there are any detectors
            if (detectors.length > 0) {
              await simulateWithoutCanvas();
            }
          }
          
          // Scene errors and warnings
          if (scene.error) errors.push(`Scene: ${scene.error}`);
          if (scene.warning) warnings.push(`Scene: ${scene.warning}`);

          // Object errors and warnings
          scene.objs.forEach((obj, i) => {
            if (obj.getError()) {
              errors.push(`objs[${i}] ${obj.constructor.type}: ${obj.getError()}`);
            }
            if (obj.getWarning()) {
              warnings.push(`objs[${i}] ${obj.constructor.type}: ${obj.getWarning()}`);
            }
          });

          // Set final error and warning messages
          result.error = errors.length > 0 ? errors.join('\n') : null;
          result.warning = warnings.length > 0 ? warnings.join('\n') : null;

          // Output the final result
          console.log(JSON.stringify(result));
        }

        // Simulation without canvas (for detector readings)
        function simulateWithoutCanvas() {
          return new Promise((resolve) => {
            // Create simulator without canvas
            const simulator = new rayOptics.Simulator(scene);
            
            simulator.on('simulationComplete', () => {
              // Process all detectors
              for (let i = 0; i < detectors.length; i++) {
                const detector = detectors[i];
                const detectorData = {
                  name: detector.name || `Detector ${i + 1}`,
                  power: detector.power,
                  normal: detector.normal,
                  shear: detector.shear
                };
                
                // Add irradiance map data if enabled
                if (detector.irradMap && detector.binData) {
                  detectorData.irradianceMap = detector.binData.map(value => value / detector.binSize);
                  detectorData.binPositions = detector.binData.map((_, j) => j * detector.binSize);
                }
                
                result.detectors.push(detectorData);

                // Add simulator statistics
                result.totalTruncation = simulator.totalTruncation;
                result.processedRayCount = simulator.processedRayCount;
                result.brightnessScale = simulator.brightnessScale;
              }
              
              // Simulator errors and warnings
              if (simulator.error) errors.push(`Simulator: ${simulator.error}`);
              if (simulator.warning) warnings.push(`Simulator: ${simulator.warning}`);
              
              resolve();
            });
            
            simulator.updateSimulation(false, false);
          });
        }

        // Simulation with canvas (for cropbox images)
        function simulateWithCanvas(cropBox, createCanvas, index) {
          return new Promise((resolve) => {
            // Set up canvas for this cropbox
            const imageWidth = cropBox.width;
            const imageHeight = cropBox.width * (cropBox.p4.y - cropBox.p1.y) / (cropBox.p4.x - cropBox.p1.x);
            
            const canvasLight = createCanvas(imageWidth, imageHeight);
            const canvasBelowLight = createCanvas(imageWidth, imageHeight);
            const canvasAboveLight = createCanvas(imageWidth, imageHeight);
            const canvasGrid = createCanvas(imageWidth, imageHeight);
            const canvasVirtual = createCanvas(imageWidth, imageHeight);
            const canvasFinal = createCanvas(imageWidth, imageHeight);
            
            const ctxLight = canvasLight.getContext('2d');
            const ctxBelowLight = canvasBelowLight.getContext('2d');
            const ctxAboveLight = canvasAboveLight.getContext('2d');
            const ctxGrid = canvasGrid.getContext('2d');
            const ctxVirtual = canvasVirtual.getContext('2d');
            const ctxFinal = canvasFinal.getContext('2d');
            
            // Set cropbox settings
            const originalScale = scene.scale;
            const originalOrigin = { ...scene.origin };
            const originalBackgroundColor = { ...scene.theme.background.color };
            
            scene.scale = cropBox.width / (cropBox.p4.x - cropBox.p1.x);
            scene.origin = { x: -cropBox.p1.x * scene.scale, y: -cropBox.p1.y * scene.scale };

            if (cropBox.transparent && scene.theme.background.color.r == 0 && scene.theme.background.color.g == 0 && scene.theme.background.color.b == 0) {
              // Use a non-black background color so that some rendering (e.g. glass) will not assume the background is black.
              scene.theme.background.color = { r: 0.01, g: 0.01, b: 0.01 };
            }

            // Create simulator with canvas
            const simulator = new rayOptics.Simulator(
              scene, 
              ctxLight, 
              ctxBelowLight, 
              ctxAboveLight, 
              ctxGrid, 
              ctxVirtual, 
              false
            );
            
            simulator.rayCountLimit = cropBox.rayCountLimit || Infinity;
            
            simulator.on('simulationComplete', () => {
              // Draw layers to final canvas

              if (!cropBox.transparent) {
                ctxFinal.fillStyle = `rgb(${Math.round(scene.theme.background.color.r * 255)}, ${Math.round(scene.theme.background.color.g * 255)}, ${Math.round(scene.theme.background.color.b * 255)})`;
                ctxFinal.fillRect(0, 0, canvasFinal.width, canvasFinal.height);
              }
              
              ctxFinal.drawImage(canvasBelowLight, 0, 0);
              ctxFinal.drawImage(canvasGrid, 0, 0);
              ctxFinal.drawImage(canvasLight, 0, 0);
              ctxFinal.drawImage(canvasAboveLight, 0, 0);
              
              // Add image to results
              result.images.push({
                name: cropBox.name || `CropBox ${index + 1}`,
                dataUrl: canvasFinal.toDataURL('image/png')
              });
              
              // Restore original scene settings
              scene.scale = originalScale;
              scene.origin = originalOrigin;
              scene.theme.background.color = originalBackgroundColor;
              
              // Add simulator statistics
              result.totalTruncation = simulator.totalTruncation;
              result.processedRayCount = simulator.processedRayCount;
              result.brightnessScale = simulator.brightnessScale;

              // Simulator errors and warnings
              if (simulator.error) errors.push(`Simulator: ${simulator.error}`);
              if (simulator.warning) warnings.push(`Simulator: ${simulator.warning}`);

              resolve();
            });
            
            simulator.updateSimulation(false, false);
          });
        }

        // Run the simulation
        runSimulation();
      }
    });
  } catch (error) {
    const result = {
      error: error.message
    };
    console.log(JSON.stringify(result));
    process.exit(1);
  }
});