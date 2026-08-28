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

jest.unmock('../../src/core/Simulator');

import Scene from '../../src/core/Scene';
import Simulator from '../../src/core/Simulator';

describe('Simulator wavelength colors', () => {
  it('only clamps non-visible colors when the option is enabled', () => {
    const scene = new Scene();
    const simulator = new Simulator(scene);

    expect(simulator.wavelengthToColor(300, 1, false))
      .toEqual([0, 0, 0, 1]);
    expect(simulator.wavelengthToColor(800, 1, false))
      .toEqual([0, 0, 0, 1]);

    scene.keepNonVisibleLight = true;
    expect(simulator.wavelengthToColor(300, 1, false))
      .toEqual([0.125, 0, 0.25, 1]);
    expect(simulator.wavelengthToColor(800, 1, false))
      .toEqual([0.25, 0, 0, 1]);
    expect(simulator.wavelengthToColor(0, 1, false))
      .toEqual([0, 0, 0, 1]);
    expect(simulator.wavelengthToColor(Infinity, 1, false))
      .toEqual([0, 0, 0, 1]);
  });

  it('serializes the beta option only when enabled', () => {
    const scene = new Scene();

    expect(JSON.parse(scene.toJSON())).not.toHaveProperty(
      'keepNonVisibleLight'
    );
    scene.keepNonVisibleLight = true;
    expect(JSON.parse(scene.toJSON()).keepNonVisibleLight).toBe(true);
  });
});
