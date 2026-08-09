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

import {
  createCpuRayRenderState,
  finishCpuRayRendering,
  renderCpuRay
} from '../../src/core/simulationEngines/cpu/cpuRayRenderer';

function createRenderer() {
  return {
    isSVG: false,
    drawSegment: jest.fn(),
    drawRay: jest.fn(),
    drawPoint: jest.fn(),
    applyColorTransformation: jest.fn(),
    flush: jest.fn()
  };
}

function createRendering(overrides = {}) {
  return {
    mode: 'rays',
    simulateColors: false,
    showRayArrows: false,
    observer: null,
    colorMode: 'default',
    wavelengthToColor: jest.fn(() => [1, 0, 0, 1]),
    getThemeRayColor: jest.fn((_type, alpha) => [1, 1, 1, alpha]),
    getThemeRayDash: jest.fn(() => []),
    getThemeImageColor:
      jest.fn((_type, alpha) => [1, 1, 1, alpha]),
    getThemeImageSize: jest.fn(() => 5),
    ...overrides
  };
}

function ray(originX, originY, directionX, directionY, power = 0.5) {
  return {
    originX,
    originY,
    directionX,
    directionY,
    powerS: power,
    powerP: power,
    wavelength: 540,
    membership: new Uint8Array(0)
  };
}

function render(options) {
  return renderCpuRay({
    ctxMain: null,
    lengthScale: 1,
    firstPass: true,
    ...options
  });
}

describe('CPU primitive ray rendering', () => {
  it('does not draw extensions during the initial ping-pong pass', () => {
    const renderer = createRenderer();
    const rendering = createRendering({ mode: 'extended' });
    const state = createCpuRayRenderState();
    const inputRay = ray(0, 0, 1, 0);
    const hit = { s: 2 };

    render({ ray: inputRay, hit, renderer, rendering, state });

    expect(renderer.drawSegment).toHaveBeenCalledTimes(1);
    expect(renderer.drawRay).not.toHaveBeenCalled();
  });

  it('breaks nearby-ray adjacency at inactive source slots', () => {
    const renderer = createRenderer();
    const rendering = createRendering({ mode: 'images' });
    const state = createCpuRayRenderState();
    const rays = [
      ray(0, -1, 10, 1),
      ray(0, 0, 1, 0),
      ray(0, 1, 10, -1)
    ];

    for (const inputRay of rays) {
      render({
        ray: inputRay,
        hit: { s: Infinity },
        renderer,
        rendering,
        state
      });
    }
    expect(renderer.drawPoint).toHaveBeenCalledTimes(1);

    renderer.drawPoint.mockClear();
    const stateWithGap = createCpuRayRenderState();
    render({
      ray: rays[0],
      hit: { s: Infinity },
      renderer,
      rendering,
      state: stateWithGap
    });
    render({
      ray: rays[1],
      hit: { s: Infinity },
      renderer,
      rendering,
      state: stateWithGap
    });
    render({
      ray: ray(0, 0, 1, 0, 0),
      hit: { s: 0 },
      renderer,
      rendering,
      state: stateWithGap
    });
    render({
      ray: rays[2],
      hit: { s: Infinity },
      renderer,
      rendering,
      state: stateWithGap
    });

    expect(renderer.drawPoint).not.toHaveBeenCalled();
    expect(stateWithGap.lastRay).toMatchObject({
      p1: { x: 0, y: 1 },
      p2: { x: 10, y: 0 }
    });
  });

  it('applies nearby-ray power once to default-color images', () => {
    const renderer = createRenderer();
    const rendering = createRendering({
      mode: 'images',
      simulateColors: false,
      colorMode: 'default'
    });
    const state = createCpuRayRenderState();
    const ctxMain = { globalAlpha: 1 };
    const rays = [
      ray(0, -1, 10, 1, 0.4),
      ray(0, 0, 1, 0, 0.3),
      ray(0, 1, 10, -1, 0.1)
    ];

    for (const inputRay of rays) {
      render({
        ray: inputRay,
        hit: { s: Infinity },
        renderer,
        ctxMain,
        rendering,
        state
      });
    }

    expect(renderer.drawPoint).toHaveBeenCalledTimes(1);
    expect(rendering.getThemeImageColor)
      .toHaveBeenCalledWith(expect.any(String), 1);
    expect(ctxMain.globalAlpha).toBeCloseTo(0.4);
  });

  it('requests legacy color mapping and applies the image-data transform', () => {
    const renderer = createRenderer();
    const rendering = createRendering({
      simulateColors: true,
      colorMode: 'default'
    });
    const state = createCpuRayRenderState();

    render({
      ray: ray(0, 0, 1, 0),
      hit: { s: Infinity },
      renderer,
      rendering,
      state
    });
    finishCpuRayRendering({
      renderer,
      ctxMain: null,
      rendering,
      colorMode: 'default'
    });

    expect(rendering.wavelengthToColor)
      .toHaveBeenCalledWith(540, 1, true);
    expect(renderer.applyColorTransformation).toHaveBeenCalledTimes(1);
    expect(renderer.flush).not.toHaveBeenCalled();
  });

  it('uses the legacy observer reconstruction for nearby rays', () => {
    const renderer = createRenderer();
    const rendering = createRendering({
      mode: 'observer',
      observer: {
        c: { x: 5, y: 0 },
        r: 2
      }
    });
    const state = createCpuRayRenderState();
    const rays = [
      ray(0, -1, 10, -1),
      ray(0, 0, 1, 0),
      ray(0, 1, 10, 1)
    ];

    for (const inputRay of rays) {
      render({
        ray: inputRay,
        hit: { s: Infinity },
        renderer,
        rendering,
        state
      });
    }

    expect(renderer.drawPoint).toHaveBeenCalledTimes(1);
    expect(renderer.drawSegment).toHaveBeenCalledTimes(1);
  });
});
