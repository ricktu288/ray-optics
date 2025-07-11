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
import { createCanvas } from 'canvas';
import sharp from 'sharp';
const rayOptics = require('../../../dist-node/rayOptics.js');

/**
 * Compare two PNG images pixel by pixel
 * @param {Buffer} actualImage - The actual image buffer
 * @param {Buffer} expectedImage - The expected image buffer
 * @param {number} threshold - Similarity threshold (0-1), default 0.95
 * @returns {Promise<{match: boolean, matchPercentage: number, avgDifference: number}>} Comparison results
 */
export async function compareImages(actualImage, expectedImage, threshold = 0.95) {
  const actual = await sharp(actualImage).raw().toBuffer();
  const expected = await sharp(expectedImage).raw().toBuffer();
  
  if (actual.length !== expected.length) {
    return {
      match: false,
      matchPercentage: 0,
      avgDifference: Infinity,
      error: `Size mismatch: actual ${actual.length} bytes vs expected ${expected.length} bytes`
    };
  }

  let matchingPixels = 0;
  let totalDifference = 0;
  const totalPixels = actual.length / 4; // RGBA format

  for (let i = 0; i < actual.length; i += 4) {
    const rDiff = Math.abs(actual[i] - expected[i]);
    const gDiff = Math.abs(actual[i + 1] - expected[i + 1]);
    const bDiff = Math.abs(actual[i + 2] - expected[i + 2]);
    const pixelDiff = (rDiff + gDiff + bDiff) / 3;
    totalDifference += pixelDiff;
    
    if (pixelDiff < 5) matchingPixels++;
  }

  const matchPercentage = matchingPixels / totalPixels;
  const avgDifference = totalDifference / totalPixels;

  return {
    match: matchPercentage >= threshold,
    matchPercentage: matchPercentage * 100,
    avgDifference
  };
}

/**
 * Compare two CSV data strings with numerical tolerance
 * @param {string} actualData - The actual CSV data
 * @param {string} expectedData - The expected CSV data
 * @param {number} tolerance - Relative error tolerance, default 1e-3
 * @returns {{match: boolean, maxError: number, errorDetails: Array<{row: number, expected: number, actual: number, error: number}>}} Comparison results
 */
export function compareCSV(actualData, expectedData, tolerance = 1e-3) {
  const actualLines = actualData.trim().split('\n');
  const expectedLines = expectedData.trim().split('\n');

  // Check header
  if (actualLines[0] !== expectedLines[0]) {
    return {
      match: false,
      maxError: Infinity,
      errorDetails: [{
        row: 0,
        expected: expectedLines[0],
        actual: actualLines[0],
        error: 'Header mismatch'
      }]
    };
  }

  // Check data rows
  const errors = [];
  let maxError = 0;

  for (let i = 1; i < Math.min(actualLines.length, expectedLines.length); i++) {
    const [actualPos, actualVal] = actualLines[i].split(',').map(Number);
    const [expectedPos, expectedVal] = expectedLines[i].split(',').map(Number);

    // Check position
    if (Math.abs(actualPos - expectedPos) > tolerance) {
      errors.push({
        row: i,
        expected: expectedPos,
        actual: actualPos,
        error: Math.abs(actualPos - expectedPos)
      });
      maxError = Math.max(maxError, Math.abs(actualPos - expectedPos));
    }

    // Check value
    const relError = Math.abs((actualVal - expectedVal) / (Math.abs(expectedVal) + tolerance));
    if (relError > tolerance) {
      errors.push({
        row: i,
        expected: expectedVal,
        actual: actualVal,
        error: relError
      });
      maxError = Math.max(maxError, relError);
    }
  }

  // Check length mismatch
  if (actualLines.length !== expectedLines.length) {
    errors.push({
      row: Math.min(actualLines.length, expectedLines.length),
      expected: expectedLines.length,
      actual: actualLines.length,
      error: 'Length mismatch'
    });
  }

  return {
    match: errors.length === 0,
    maxError,
    errorDetails: errors
  };
}

/**
 * Run a scene and generate outputs
 * @param {string} jsonPath - Path to the scene JSON file
 * @param {boolean} writeOutput - Whether to write output files
 * @returns {Promise<{imageBuffer?: Buffer, detectorData?: string}>} Generated outputs
 */
export async function runScene(jsonPath, writeOutput = false) {
  // Load and parse scene
  const sceneJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const outputBase = path.basename(jsonPath, '.json');
  const outputDir = path.dirname(jsonPath);
  const outputs = {};

  // Initialize scene first
  const scene = new rayOptics.Scene();
  
  // Load the scene
  await new Promise((resolve) => {
    scene.loadJSON(JSON.stringify(sceneJson), function (needFullUpdate, completed) {
      if (!completed) return;
      resolve();
    });
  });

  // Find CropBox and Detector
  const cropBox = scene.objs.find(obj => obj.constructor.type === 'CropBox');
  const detector = scene.objs.find(obj => obj.constructor.type === 'Detector');

  // Create simulator - with or without canvases depending on whether there's a cropbox
  let simulator;
  let canvasLight, canvasBelowLight, canvasAboveLight, canvasGrid, canvasVirtual, canvasFinal;
  let ctxLight, ctxBelowLight, ctxAboveLight, ctxGrid, ctxVirtual, ctxFinal;

  if (cropBox) {
    // Only create canvases if there's a cropbox
    canvasLight = createCanvas();
    canvasBelowLight = createCanvas();
    canvasAboveLight = createCanvas();
    canvasGrid = createCanvas();
    canvasVirtual = createCanvas();
    canvasFinal = createCanvas();

    ctxLight = canvasLight.getContext('2d');
    ctxBelowLight = canvasBelowLight.getContext('2d');
    ctxAboveLight = canvasAboveLight.getContext('2d');
    ctxGrid = canvasGrid.getContext('2d');
    ctxVirtual = canvasVirtual.getContext('2d');
    ctxFinal = canvasFinal.getContext('2d');

    // Set canvas sizes
    const imageWidth = cropBox.width;
    const imageHeight = cropBox.width * (cropBox.p4.y - cropBox.p1.y) / (cropBox.p4.x - cropBox.p1.x);

    [canvasLight, canvasBelowLight, canvasAboveLight, canvasGrid, canvasVirtual, canvasFinal].forEach(canvas => {
      canvas.width = imageWidth;
      canvas.height = imageHeight;
    });

    // Initialize simulator with canvases
    simulator = new rayOptics.Simulator(
      scene, 
      ctxLight, 
      ctxBelowLight, 
      ctxAboveLight, 
      ctxGrid, 
      ctxVirtual, 
      false
    );

    // Set cropbox settings
    scene.scale = cropBox.width / (cropBox.p4.x - cropBox.p1.x);
    scene.origin = { x: -cropBox.p1.x * scene.scale, y: -cropBox.p1.y * scene.scale };
    simulator.rayCountLimit = cropBox.rayCountLimit || 1e7;
  } else {
    // Create simulator without canvases
    simulator = new rayOptics.Simulator(scene);
  }

  // Run simulation
  await new Promise((resolve) => {
    simulator.eventListeners = {};
    simulator.on('simulationComplete', () => {
      resolve();
    });
    simulator.on('simulationStop', () => {
      resolve();
    });
    simulator.updateSimulation(false, false);
  });

  // Generate detector data
  if (detector && detector.irradMap) {
    // Generate detector data in the same format as Detector.js
    const binSize = detector.binSize;
    const rows = detector.binData.map((value, i) => 
      `${i * binSize},${value / binSize}`
    );
    outputs.detectorData = `Position,Irradiance\n${rows.join('\n')}`;
    
    if (writeOutput) {
      fs.writeFileSync(
        path.join(outputDir, `${outputBase}.csv`),
        outputs.detectorData
      );
    }
  }

  // Generate image output if cropbox exists
  if (cropBox) {
    // Draw layers to final canvas
    ctxFinal.fillStyle = 'black';
    ctxFinal.fillRect(0, 0, canvasFinal.width, canvasFinal.height);

    ctxFinal.drawImage(canvasBelowLight, 0, 0);
    ctxFinal.drawImage(canvasGrid, 0, 0);
    ctxFinal.drawImage(canvasLight, 0, 0);
    ctxFinal.drawImage(canvasAboveLight, 0, 0);
    
    outputs.imageBuffer = canvasFinal.toBuffer('image/png');
    if (writeOutput) {
      fs.writeFileSync(path.join(outputDir, `${outputBase}.png`), outputs.imageBuffer);
    }
  }

  outputs.simulatorError = simulator.error;
  outputs.simulatorWarning = simulator.warning;

  return outputs;
}
