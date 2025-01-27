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

// Mock Simulator
jest.mock('../../../src/core/Simulator', () => ({
  __esModule: true,
  default: {
    GREEN_WAVELENGTH: 540,
    UV_WAVELENGTH: 380,
    INFRARED_WAVELENGTH: 700
  }
}));

// Mock i18next
jest.mock('i18next', () => ({
  __esModule: true,
  default: {
    t: (key) => `{{${key}}}`
  }
}));

global.localStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn()
};
