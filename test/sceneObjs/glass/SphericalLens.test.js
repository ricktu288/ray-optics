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

import Scene from '../../../src/core/Scene.js';
import SphericalLens from '../../../src/core/sceneObjs/glass/SphericalLens.js';
import { MockUser } from '../helpers/test-utils';

describe('SphericalLens', () => {
  let scene;
  let user;
  let obj;

  beforeEach(() => {
    scene = new Scene();
    scene.gridSize = 20; // Set grid size
    obj = new SphericalLens(scene);
    user = new MockUser(obj);
  });

  it('creates object with points and builds lens with default parameters', async () => {
    // Create a lens by clicking two points
    user.click(100, 100);
    user.click(200, 300);

    // Wait for the lens to be built
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check the serialized output
    const serialized = obj.serialize();
    expect(serialized.type).toBe("SphericalLens");
    expect(serialized.path.length).toBe(6);

    // Check each point approximately
    const expectedPoints = [
      { x: 91.06, y: 104.47, arc: false },
      { x: 108.94, y: 95.53, arc: false },
      { x: 167.89, y: 191.06, arc: true },
      { x: 208.94, y: 295.53, arc: false },
      { x: 191.06, y: 304.47, arc: false },
      { x: 132.11, y: 208.94, arc: true }
    ];

    serialized.path.forEach((point, i) => {
      expect(point.x).toBeCloseTo(expectedPoints[i].x, 2);
      expect(point.y).toBeCloseTo(expectedPoints[i].y, 2);
      expect(point.arc).toBe(expectedPoints[i].arc);
    });

    // Check lens parameters from objBar
    expect(user.get('d')).toBeDefined();
    expect(user.get('R<sub>1</sub>')).toBeDefined();
    expect(user.get('R<sub>2</sub>')).toBeDefined();
  });

  it('creates object by dragging between two points', async () => {
    // Create a lens by dragging from start to end point
    user.drag(100, 100, 200, 300);

    // Wait for the lens to be built
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check the serialized output
    const serialized = obj.serialize();
    expect(serialized.type).toBe("SphericalLens");
    expect(serialized.path.length).toBe(6);

    // Check each point approximately
    const expectedPoints = [
      { x: 91.06, y: 104.47, arc: false },
      { x: 108.94, y: 95.53, arc: false },
      { x: 167.89, y: 191.06, arc: true },
      { x: 208.94, y: 295.53, arc: false },
      { x: 191.06, y: 304.47, arc: false },
      { x: 132.11, y: 208.94, arc: true }
    ];

    serialized.path.forEach((point, i) => {
      expect(point.x).toBeCloseTo(expectedPoints[i].x, 2);
      expect(point.y).toBeCloseTo(expectedPoints[i].y, 2);
      expect(point.arc).toBe(expectedPoints[i].arc);
    });

    // Check lens parameters from objBar
    expect(user.get('d')).toBeDefined();
    expect(user.get('R<sub>1</sub>')).toBeDefined();
    expect(user.get('R<sub>2</sub>')).toBeDefined();
  });

  it('has correct lens parameter values', async () => {
    // Create a lens by clicking two points
    user.click(100, 100);
    user.click(200, 300);

    // Wait for the lens to be built
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check lens parameters
    expect(user.get('d')).toBeCloseTo(40, 1);
    expect(user.get('R<sub>1</sub>')).toBeCloseTo(630, 1);
    expect(user.get('R<sub>2</sub>')).toBeCloseTo(-630, 1);
  });

  it('updates lens shape when parameters are set', async () => {
    // Create a lens by clicking two points
    user.click(100, 100);
    user.click(200, 300);

    // Wait for the lens to be built
    await new Promise(resolve => setTimeout(resolve, 0));

    // Set new parameters
    user.set('d', 60);
    user.set('R<sub>1</sub>', 300);
    user.set('R<sub>2</sub>', -300);

    // Wait for the lens to be updated
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check the serialized output
    const serialized = obj.serialize();
    expect(serialized.type).toBe("SphericalLens");
    expect(serialized.path.length).toBe(6);

    // Check each point approximately
    const expectedPoints = [
      { x: 92.50, y: 103.75, arc: false },
      { x: 107.50, y: 96.25, arc: false },
      { x: 176.83, y: 186.58, arc: true },
      { x: 207.50, y: 296.25, arc: false },
      { x: 192.50, y: 303.75, arc: false },
      { x: 123.17, y: 213.42, arc: true }
    ];

    serialized.path.forEach((point, i) => {
      expect(point.x).toBeCloseTo(expectedPoints[i].x, 2);
      expect(point.y).toBeCloseTo(expectedPoints[i].y, 2);
      expect(point.arc).toBe(expectedPoints[i].arc);
    });

    // Verify the parameters were set correctly
    expect(user.get('d')).toBeCloseTo(60, 1);
    expect(user.get('R<sub>1</sub>')).toBeCloseTo(300, 1);
    expect(user.get('R<sub>2</sub>')).toBeCloseTo(-300, 1);
  });

  it('shows correct parameters when defBy is DFfdBfd', async () => {
    // Create a lens by clicking two points
    user.click(100, 100);
    user.click(200, 300);

    // Wait for the lens to be built
    await new Promise(resolve => setTimeout(resolve, 0));

    // Change defBy to DFfdBfd
    user.set('', 'DFfdBfd');

    // Wait for the lens to be updated
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check lens parameters in DFfdBfd mode
    expect(user.get('FFD')).toBeCloseTo(623.26, 1);  // Front focal distance
    expect(user.get('BFD')).toBeCloseTo(623.26, 1);  // Back focal distance
    expect(user.get('d')).toBeCloseTo(40, 1);  // Lens thickness
  });

  it('updates lens shape when parameters are set in DFfdBfd mode', async () => {
    // Create a lens by clicking two points
    user.click(100, 100);
    user.click(200, 300);

    // Wait for the lens to be built
    await new Promise(resolve => setTimeout(resolve, 0));

    // Change defBy to DFfdBfd
    user.set('', 'DFfdBfd');

    // Wait for the lens to be updated
    await new Promise(resolve => setTimeout(resolve, 0));

    // Set new parameters
    user.set('d', 60);
    user.set('FFD', 300);
    user.set('BFD', 300);

    // Wait for the lens to be updated
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check the serialized output
    const serialized = obj.serialize();
    expect(serialized.type).toBe("SphericalLens");
    expect(serialized.path.length).toBe(6);

    // Check each point approximately
    const expectedPoints = [
      { x: 91.81, y: 104.10, arc: false },
      { x: 108.19, y: 95.90, arc: false },
      { x: 176.83, y: 186.58, arc: true },
      { x: 208.19, y: 295.90, arc: false },
      { x: 191.81, y: 304.10, arc: false },
      { x: 123.17, y: 213.42, arc: true }
    ];

    serialized.path.forEach((point, i) => {
      expect(point.x).toBeCloseTo(expectedPoints[i].x, 2);
      expect(point.y).toBeCloseTo(expectedPoints[i].y, 2);
      expect(point.arc).toBe(expectedPoints[i].arc);
    });

    // Verify the parameters were set correctly
    expect(user.get('d')).toBeCloseTo(60, 1);
    expect(user.get('FFD')).toBeCloseTo(300, 1);
    expect(user.get('BFD')).toBeCloseTo(300, 1);
  });

  it('creates parallel plate when both radii are infinity', async () => {
    // Create a lens by clicking two points
    user.click(100, 100);
    user.click(200, 300);

    // Wait for the lens to be built
    await new Promise(resolve => setTimeout(resolve, 0));

    // Set new parameters
    user.set('d', 40);
    user.set('R<sub>1</sub>', Infinity);
    user.set('R<sub>2</sub>', Infinity);

    // Wait for the lens to be updated
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check the serialized output
    const serialized = obj.serialize();
    expect(serialized.type).toBe("SphericalLens");
    expect(serialized.path.length).toBe(6);

    // Check each point approximately
    const expectedPoints = [
      { x: 82.11, y: 108.94, arc: false },
      { x: 117.89, y: 91.06, arc: false },
      { x: 167.89, y: 191.06, arc: true },
      { x: 217.89, y: 291.06, arc: false },
      { x: 182.11, y: 308.94, arc: false },
      { x: 132.11, y: 208.94, arc: true }
    ];

    serialized.path.forEach((point, i) => {
      expect(point.x).toBeCloseTo(expectedPoints[i].x, 2);
      expect(point.y).toBeCloseTo(expectedPoints[i].y, 2);
      expect(point.arc).toBe(expectedPoints[i].arc);
    });

    // Verify the parameters were set correctly
    expect(user.get('d')).toBeCloseTo(40, 1);
    expect(user.get('R<sub>1</sub>')).toBe(Infinity);
    expect(user.get('R<sub>2</sub>')).toBe(Infinity);
  });

  it('handles invalid radius and recovers when restored', async () => {
    // Create a lens by clicking two points
    user.click(100, 100);
    user.click(200, 300);

    // Wait for the lens to be built
    await new Promise(resolve => setTimeout(resolve, 0));

    // Get initial path and R1 value
    const initialPath = obj.serialize().path;
    const originalR1 = user.get('R<sub>1</sub>');

    // Set R1 to a very small value that makes the lens invalid
    user.set('R<sub>1</sub>', 1);

    // Wait for the lens to be updated
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check that path is empty for invalid lens
    const invalidLensState = obj.serialize();
    expect(invalidLensState.path).toBeUndefined();

    // Restore R1 to original value
    user.set('R<sub>1</sub>', originalR1);

    // Wait for the lens to be updated
    await new Promise(resolve => setTimeout(resolve, 0));

    // Check that path is restored to original
    const restoredPath = obj.serialize().path;
    expect(restoredPath).toBeDefined();
    expect(restoredPath.length).toBe(6);

    // Compare with initial path
    restoredPath.forEach((point, i) => {
      expect(point.x).toBeCloseTo(initialPath[i].x, 2);
      expect(point.y).toBeCloseTo(initialPath[i].y, 2);
      expect(point.arc).toBe(initialPath[i].arc);
    });
  });

  it('moves the entire object by a vector', async () => {
    user.click(100, 100);
    user.click(200, 300);

    // Wait for the lens to be built
    await new Promise(resolve => setTimeout(resolve, 0));

    const initialPath = obj.serialize().path;
    user.move(50, 100);
    
    const result = obj.serialize();
    expect(result.type).toBe('SphericalLens');
    expect(result.path).toHaveLength(6);
    // Test that all points moved by the expected amount
    result.path.forEach((point, i) => {
      expect(point.x).toBeCloseTo(initialPath[i].x + 50, 2);
      expect(point.y).toBeCloseTo(initialPath[i].y + 100, 2);
    });
  });

  it('rotates 90 degrees around default center', async () => {
    user.click(100, 100);
    user.click(200, 300);

    // Wait for the lens to be built
    await new Promise(resolve => setTimeout(resolve, 0));

    user.rotate(Math.PI / 2); // 90 degrees counter-clockwise around default center
    const result = obj.serialize();
    expect(result.type).toBe('SphericalLens');
    expect(result.path).toHaveLength(6);
    // Test that transformation occurred (exact values depend on default center)
    expect(result.path.every(point => typeof point.x === 'number' && typeof point.y === 'number')).toBe(true);
  });

  it('rotates 90 degrees around explicit center', async () => {
    user.click(100, 100);
    user.click(200, 300);

    // Wait for the lens to be built
    await new Promise(resolve => setTimeout(resolve, 0));

    const initialPath = obj.serialize().path;
    user.rotate(Math.PI / 2, { x: 0, y: 0 }); // 90 degrees around origin
    
    const result = obj.serialize();
    expect(result.type).toBe('SphericalLens');
    expect(result.path).toHaveLength(6);
    // Test that points rotated around origin
    result.path.forEach((point, i) => {
      expect(point.x).toBeCloseTo(-initialPath[i].y, 2);
      expect(point.y).toBeCloseTo(initialPath[i].x, 2);
    });
  });

  it('scales to 50% around explicit center', async () => {
    user.click(100, 100);
    user.click(200, 300);

    // Wait for the lens to be built
    await new Promise(resolve => setTimeout(resolve, 0));

    const initialPath = obj.serialize().path;
    user.scale(0.5, { x: 0, y: 0 }); // Scale to 50% around origin
    
    const result = obj.serialize();
    expect(result.type).toBe('SphericalLens');
    expect(result.path).toHaveLength(6);
    // Test that points scaled toward origin
    result.path.forEach((point, i) => {
      expect(point.x).toBeCloseTo(initialPath[i].x * 0.5, 2);
      expect(point.y).toBeCloseTo(initialPath[i].y * 0.5, 2);
    });
  });
});
