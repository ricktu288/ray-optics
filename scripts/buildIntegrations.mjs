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
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const integrationsDir = path.join(rootDir, 'integrations');
const distIntegrationsDir = path.join(rootDir, 'dist-integrations');
const distNodeDir = path.join(rootDir, 'dist-node');

// Create dist-integrations directory if it doesn't exist
if (!fs.existsSync(distIntegrationsDir)) {
  fs.mkdirSync(distIntegrationsDir, { recursive: true });
}

// Generate version information
console.log('Generating version information...');
const packageVersion = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'))).version.replace('-dev', '');
let commitDate = '';
let commitHash = '';

try {
  // Get the last commit info
  const gitLog = execSync('git log -1 --format="%H|%an|%ae|%ad"', { encoding: 'utf8' });
  const lastCommit = gitLog.split('\n')[0].split('|');
  commitDate = new Date(lastCommit[3]).toISOString().slice(0,10).replace(/-/g,'');
  commitHash = lastCommit[0].slice(0,7);
} catch (error) {
  console.warn('Could not get git commit information:', error.message);
  // Fallback to current date if git info is not available
  commitDate = new Date().toISOString().slice(0,10).replace(/-/g,'');
  commitHash = 'unknown';
}

const fullVersion = `${packageVersion}+${commitDate}.${commitHash}`;
console.log(`Version: ${fullVersion}`);

// Process README template and inject version information
console.log('Processing README.md template...');
const readmeTemplatePath = path.join(integrationsDir, 'README.md.template');
if (fs.existsSync(readmeTemplatePath)) {
  let readmeContent = fs.readFileSync(readmeTemplatePath, 'utf8');
  
  // Replace template variables
  readmeContent = readmeContent
    .replace(/\{\{VERSION\}\}/g, fullVersion);
  
  // Write processed README to dist-integrations
  fs.writeFileSync(path.join(distIntegrationsDir, 'README.md'), readmeContent);
} else {
  console.warn('README.md.template not found in integrations directory');
}

// Create combined LICENSE file
console.log('Creating combined LICENSE file...');
const mainLicense = fs.readFileSync(path.join(rootDir, 'LICENSE'), 'utf8');
let combinedLicense = mainLicense;

// Check for webpack-generated license file
const licenseFilePath = path.join(distNodeDir, 'rayOptics.js.LICENSE.txt');
if (fs.existsSync(licenseFilePath)) {
  const thirdPartyLicenses = fs.readFileSync(licenseFilePath, 'utf8');
  combinedLicense += '\n\n' + 
    '------------------------------------------------------------------------------\n' +
    'THIRD-PARTY LICENSES\n' +
    '------------------------------------------------------------------------------\n\n' +
    thirdPartyLicenses;
}

// Write the combined license file
fs.writeFileSync(path.join(distIntegrationsDir, 'LICENSE'), combinedLicense);

// Copy rayOptics.js from dist-node to dist-integrations
console.log('Copying rayOptics.js to dist-integrations...');
fs.copyFileSync(
  path.join(distNodeDir, 'rayOptics.js'),
  path.join(distIntegrationsDir, 'rayOptics.js')
);

// Copy everything from integrations to dist-integrations
console.log('Copying integrations to dist-integrations...');
copyFiles(integrationsDir, distIntegrationsDir);

console.log('Integration build complete!');

// Function to copy files and directories
function copyFiles(source, destination) {
  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    // Skip README.md.template
    if (entry.name === 'README.md.template' || entry.name === 'README.md') {
      continue;
    }
    
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copyFiles(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}
