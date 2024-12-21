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
import { compareImages, compareCSV, runScene } from './helpers/sceneTestHelper.js';

// Function to recursively find all JSON files in a directory
function findJsonFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...findJsonFiles(fullPath));
    } else if (item.endsWith('.json')) {
      files.push(fullPath);
    }
  });
  
  return files;
}

// Get all test scene directories (excluding helpers)
const SCENES_DIR = path.join(__dirname);
const TEST_DIRS = fs.readdirSync(SCENES_DIR)
  .filter(name => {
    const fullPath = path.join(SCENES_DIR, name);
    return fs.statSync(fullPath).isDirectory() && name !== 'helpers';
  });

describe('Scene Tests', () => {
  // Test each scene in each directory
  TEST_DIRS.forEach(dirName => {
    describe(dirName, () => {
      const dirPath = path.join(SCENES_DIR, dirName);
      const sceneFiles = findJsonFiles(dirPath);

      test.each(sceneFiles)('%s', async (jsonPath) => {
        const baseName = path.basename(jsonPath, '.json');
        const dirName = path.dirname(jsonPath);
        const pngPath = path.join(dirName, `${baseName}.png`);
        const csvPath = path.join(dirName, `${baseName}.csv`);

        // Run the scene and get outputs
        const writeOutput = process.env.WRITE_OUTPUT === 'true';
        const { imageBuffer, detectorData } = await runScene(jsonPath, writeOutput);

        // If we're writing outputs, skip comparisons
        if (writeOutput) {
          return;
        }

        // Compare image if it exists
        if (imageBuffer) {
          expect(fs.existsSync(pngPath)).toBe(true, 
            `Expected PNG file ${pngPath} to exist for scene with CropBox`);
          
          const expectedImage = fs.readFileSync(pngPath);
          const result = await compareImages(imageBuffer, expectedImage);
          
          // If there are differences, format them nicely
          if (!result.match) {
            throw new Error(
              ['Image comparison failed:',
               `Matching pixels: ${result.matchPercentage.toFixed(2)}% (threshold: ${95}%)`,
               `Average pixel difference: ${result.avgDifference.toFixed(2)}`,
               result.error ? `Error: ${result.error}` : ''
              ].filter(Boolean).join('\n')
            );
          }
        }

        // Compare detector data if it exists
        if (detectorData) {
          expect(fs.existsSync(csvPath)).toBe(true, 
            `Expected CSV file ${csvPath} to exist for scene with Detector`);
          
          const expectedData = fs.readFileSync(csvPath, 'utf8');
          const result = compareCSV(detectorData, expectedData);
          
          // If there are errors, format them nicely
          if (!result.match) {
            throw new Error(
              ['Detector data mismatch:',
               `Max relative error: ${result.maxError}`,
               'Detailed errors:',
               ...result.errorDetails.map(err => 
                 `  Row ${err.row}: expected=${err.expected}, actual=${err.actual}, error=${err.error}`
               )
              ].join('\n')
            );
          }
        }
      });
    });
  });
});
