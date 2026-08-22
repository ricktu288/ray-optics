/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
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

import { spawnSync } from 'child_process';

const SUPPORTED_ENGINES = new Set([
  'default', 'primitiveCpu'
]);

function readOption(args, index, name) {
  const argument = args[index];
  const prefix = `${name}=`;
  if (argument.startsWith(prefix)) {
    return { value: argument.slice(prefix.length), consumed: 1 };
  }
  if (argument === name) {
    if (index + 1 >= args.length) {
      throw new Error(`${name} requires a value.`);
    }
    return { value: args[index + 1], consumed: 2 };
  }
  return null;
}

function parseArguments(args) {
  let engine = 'default';
  let engineSettings = {};
  const jestArgs = [];

  for (let index = 0; index < args.length;) {
    const engineOption = readOption(args, index, '--engine');
    if (engineOption) {
      engine = engineOption.value;
      index += engineOption.consumed;
      continue;
    }

    const settingsOption = readOption(args, index, '--engine-settings');
    if (settingsOption) {
      try {
        engineSettings = JSON.parse(settingsOption.value);
      } catch (error) {
        throw new Error(`--engine-settings must be valid JSON: ${error.message}`);
      }
      index += settingsOption.consumed;
      continue;
    }

    jestArgs.push(args[index]);
    index++;
  }

  if (!SUPPORTED_ENGINES.has(engine)) {
    throw new Error(
      `Unsupported scene-test engine ${JSON.stringify(engine)}. ` +
      `Expected one of: ${Array.from(SUPPORTED_ENGINES).join(', ')}.`
    );
  }
  if (!engineSettings || typeof engineSettings !== 'object' || Array.isArray(engineSettings)) {
    throw new Error('--engine-settings must decode to a JSON object.');
  }

  return { engine, engineSettings, jestArgs };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

let options;
try {
  options = parseArguments(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

run('npm', ['run', 'build-node']);
run('jest', ['test/scenes', ...options.jestArgs], {
  env: {
    ...process.env,
    SCENE_TEST_ENGINE: options.engine,
    SCENE_TEST_ENGINE_SETTINGS: JSON.stringify(options.engineSettings)
  }
});
