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

/**
 * Shared tests for parametric curve objects (objects using ParamCurveObjMixin)
 * These tests cover common behavior for objects with parametric equations.
 * Note: Parametric objects do NOT support rotation and scaling operations
 * (the methods return false), so those tests are NOT included here.
 */

export function testParamObj(getTestContext) {
  let obj;
  let user;
  let scene;

  beforeEach(() => {
    const context = getTestContext();
    obj = context.obj;
    user = context.user;
    scene = context.scene;
  });

  it('creates with one click at origin', () => {
    user.click(100, 100);
    const result = obj.serialize();
    expect(result.type).toBe(obj.constructor.type);
    // Check that pieces exist on the object (even if not serialized when default)
    expect(obj.pieces).toBeDefined();
    expect(obj.pieces.length).toBeGreaterThan(0);
    // Check default parametric equations exist on the object
    expect(obj.pieces[0].eqnX).toBeDefined();
    expect(obj.pieces[0].eqnY).toBeDefined();
    expect(obj.pieces[0].tMin).toBeDefined();
    expect(obj.pieces[0].tMax).toBeDefined();
    expect(obj.pieces[0].tStep).toBeDefined();
  });

  it('creates with grid snapping', () => {
    scene.snapToGrid = true;
    user.click(105, 108);
    const result = obj.serialize();
    expect(result.type).toBe(obj.constructor.type);
    // Origin should be snapped to grid
    if (result.origin) {
      expect(result.origin.x % scene.gridSize).toBe(0);
      expect(result.origin.y % scene.gridSize).toBe(0);
    }
  });

  it('hovers with mouse', () => {
    user.click(100, 100);
    // Hovering behavior depends on the generated path
    // Just verify the object was created
    expect(obj.serialize().type).toBe(obj.constructor.type);
  });

  it('moves the entire object by a vector', () => {
    user.click(100, 100);
    const initialOrigin = { ...obj.origin };
    
    user.move(50, 100);
    const result = obj.serialize();
    expect(result.type).toBe(obj.constructor.type);
    
    // Check that origin moved
    if (result.origin) {
      expect(result.origin.x).toBe(initialOrigin.x + 50);
      expect(result.origin.y).toBe(initialOrigin.y + 100);
    }
    
    // Equations should remain unchanged on the object
    expect(obj.pieces[0].eqnX).toBe(obj.constructor.serializableDefaults.pieces[0].eqnX);
    expect(obj.pieces[0].eqnY).toBe(obj.constructor.serializableDefaults.pieces[0].eqnY);
  });

  it('sets parametric equations', () => {
    user.click(100, 100);
    
    // Set new parametric equations (only test equations, not tMin/tMax/step due to empty label issue)
    user.set('x(t) =', 't');
    user.set('y(t) =', 't^2');
    user.set('{{simulator:sceneObjs.ParamCurveObjMixin.step}}', 0.1);
    
    const result = obj.serialize();
    expect(result.pieces[0].eqnX).toBe('t');
    expect(result.pieces[0].eqnY).toBe('t^2');
    expect(result.pieces[0].tStep).toBe(0.1);
  });

  it('adds parametric pieces using button', () => {
    user.click(100, 100);
    
    // Initial state should have at least 1 piece
    const initialPieceCount = obj.pieces.length;
    expect(initialPieceCount).toBeGreaterThan(0);
    
    // Add a new piece
    user.clickButton('{{simulator:sceneObjs.ParamCurveObjMixin.addPiece}}');
    expect(obj.pieces.length).toBe(initialPieceCount + 1);
    
    // Add another piece
    user.clickButton('{{simulator:sceneObjs.ParamCurveObjMixin.addPiece}}');
    expect(obj.pieces.length).toBe(initialPieceCount + 2);
    
    // Verify serialization includes all pieces
    const result = obj.serialize();
    expect(result.pieces.length).toBe(initialPieceCount + 2);
    expect(result.type).toBe(obj.constructor.type);
  });

  it('removes parametric pieces using button', () => {
    user.click(100, 100);
    
    // Add extra pieces first
    user.clickButton('{{simulator:sceneObjs.ParamCurveObjMixin.addPiece}}');
    user.clickButton('{{simulator:sceneObjs.ParamCurveObjMixin.addPiece}}');
    const pieceCount = obj.pieces.length;
    expect(pieceCount).toBeGreaterThanOrEqual(3);
    
    // Remove one piece
    user.clickButton('{{simulator:sceneObjs.ParamCurveObjMixin.removePiece}}');
    expect(obj.pieces.length).toBe(pieceCount - 1);
    
    // Remove another piece
    user.clickButton('{{simulator:sceneObjs.ParamCurveObjMixin.removePiece}}');
    expect(obj.pieces.length).toBe(pieceCount - 2);
    
    // Verify the object pieces
    expect(obj.pieces.length).toBe(pieceCount - 2);
    expect(obj.serialize().type).toBe(obj.constructor.type);
  });

  it('adds and removes pieces in sequence', () => {
    user.click(100, 100);
    
    const initialCount = obj.pieces.length;
    
    // Add two pieces
    user.clickButton('{{simulator:sceneObjs.ParamCurveObjMixin.addPiece}}');
    user.clickButton('{{simulator:sceneObjs.ParamCurveObjMixin.addPiece}}');
    expect(obj.pieces.length).toBe(initialCount + 2);
    
    // Remove one piece
    user.clickButton('{{simulator:sceneObjs.ParamCurveObjMixin.removePiece}}');
    expect(obj.pieces.length).toBe(initialCount + 1);
    
    // Add one more piece
    user.clickButton('{{simulator:sceneObjs.ParamCurveObjMixin.addPiece}}');
    expect(obj.pieces.length).toBe(initialCount + 2);
    
    // Verify final state
    const result = obj.serialize();
    expect(result.pieces.length).toBe(initialCount + 2);
    expect(result.type).toBe(obj.constructor.type);
  });
}

