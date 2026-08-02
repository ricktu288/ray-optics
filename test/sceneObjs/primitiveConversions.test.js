/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import Scene from '../../src/core/Scene.js';
import { createDagClosureEvaluator } from '../../src/core/formula/dag-evaluator.js';
import { FLOAT32_EPSILON } from '../../src/core/primitive/numeric.js';
import { preprocessPrimitives } from '../../src/core/primitive/preprocess.js';
import Beam from '../../src/core/sceneObjs/lightSource/Beam.js';
import AngleSource from '../../src/core/sceneObjs/lightSource/AngleSource.js';
import PointSource from '../../src/core/sceneObjs/lightSource/PointSource.js';
import DiffractionGrating from '../../src/core/sceneObjs/blocker/DiffractionGrating.js';
import PlaneGlass from '../../src/core/sceneObjs/glass/PlaneGlass.js';
import CustomArcSurface from '../../src/core/sceneObjs/other/CustomArcSurface.js';
import CustomSurface from '../../src/core/sceneObjs/other/CustomSurface.js';
import CustomParamSurface from '../../src/core/sceneObjs/other/CustomParamSurface.js';

describe('additional scene-object primitive conversions', () => {
  test('custom surface translates legacy angles and powers', () => {
    const scene = new Scene();
    const surface = new CustomSurface(scene);
    surface.p1 = { x: 0, y: 0 };
    surface.p2 = { x: 10, y: 0 };

    const [primitive] = surface.getPrimitives();
    expect(primitive.surfaceType.outRayCount).toBe(2);
    const values = createDagClosureEvaluator(primitive.surfaceType.dag)({
      d_0x: 0,
      d_0y: -1,
      P_0s: 0.4,
      P_0p: 0.6,
      lambda: 500,
      x: 5,
      y: 0,
      u: 0.5,
      sigma: 1,
      n_0: 1,
      n_1: 1
    });
    expect(values.d_1x).toBeCloseTo(0);
    expect(values.d_1y).toBeCloseTo(-1);
    expect(values.P_1s).toBeCloseTo(0.28);
    expect(values.P_1p).toBeCloseTo(0.42);
    expect(values.d_2y).toBeCloseTo(1);
    expect(values.P_2s).toBeCloseTo(0.12);
    expect(values.P_2p).toBeCloseTo(0.18);
    expect(() => preprocessPrimitives([primitive], {
      numericEpsilon: FLOAT32_EPSILON
    })).not.toThrow();
  });

  test('custom surface preserves polarization splits through prior rays', () => {
    const scene = new Scene();
    const surface = new CustomSurface(scene);
    surface.p1 = { x: 0, y: 0 };
    surface.p2 = { x: 10, y: 0 };
    surface.outRays = [
      { eqnTheta: 'p', eqnP: 'P_0' },
      { eqnTheta: '\\theta_1', eqnP: 'P_0' }
    ];
    expect(surface.getPrimitives()[0].surfaceType.outRayCount).toBe(4);
  });

  test('custom power formula can reference its own output angle', () => {
    const scene = new Scene();
    const surface = new CustomSurface(scene);
    surface.p1 = { x: 0, y: 0 };
    surface.p2 = { x: 10, y: 0 };
    surface.outRays = [{
      eqnTheta: '\\theta_0',
      eqnP: 'P_0\\cdot\\cos\\left(\\theta_1\\right)'
    }];

    const [primitive] = surface.getPrimitives();
    const values = createDagClosureEvaluator(primitive.surfaceType.dag)({
      d_0x: -Math.sin(0.25),
      d_0y: -Math.cos(0.25),
      P_0s: 0.4,
      P_0p: 0.6,
      lambda: 500,
      x: 5,
      y: 0,
      u: 0.5,
      sigma: 1,
      n_0: 1,
      n_1: 1
    });
    expect(values.P_1s).toBeCloseTo(0.4 * Math.cos(0.25));
    expect(values.P_1p).toBeCloseTo(0.6 * Math.cos(0.25));
  });

  test('custom parametric surface reconstructs sampled t from u', () => {
    const scene = new Scene();
    const surface = new CustomParamSurface(scene);
    surface.origin = { x: 0, y: 0 };
    surface.pieces = [{
      eqnX: 't',
      eqnY: '0',
      tMin: 2,
      tMax: 4,
      tStep: 2
    }];
    surface.curveType = 'polygonal';
    surface.outRays = [{ eqnTheta: 't', eqnP: 'P_0' }];

    const [primitive] = surface.getPrimitives();
    const values = createDagClosureEvaluator(primitive.surfaceType.dag)({
      ...primitive.params,
      d_0x: 0,
      d_0y: -1,
      P_0s: 1,
      P_0p: 1,
      lambda: 500,
      x: 2.5,
      y: 0,
      u: 0.25,
      sigma: 1,
      n_0: 1,
      n_1: 1
    });
    expect(values.d_1x).toBeCloseTo(-Math.sin(2.5));
    expect(values.d_1y).toBeCloseTo(-Math.cos(2.5));
  });

  test('custom arc surface reconstructs angle-linear t', () => {
    const scene = new Scene();
    const surface = new CustomArcSurface(scene);
    surface.p1 = { x: 0, y: 0 };
    surface.p2 = { x: 10, y: 0 };
    surface.p3 = { x: 5, y: 5 };
    surface.outRays = [{ eqnTheta: 't', eqnP: 'P_0' }];

    const [primitive] = surface.getPrimitives();
    const values = createDagClosureEvaluator(primitive.surfaceType.dag)({
      ...primitive.params,
      d_0x: 0,
      d_0y: -1,
      P_0s: 1,
      P_0p: 1,
      lambda: 500,
      x: 5,
      y: 5,
      u: 0.5,
      sigma: 1,
      n_0: 1,
      n_1: 1
    });
    expect(values.d_1x).toBeCloseTo(0);
    expect(values.d_1y).toBeCloseTo(-1);
  });

  test('half-plane glass closes with an absorbed large semicircle', () => {
    const scene = new Scene();
    const glass = new PlaneGlass(scene);
    glass.p1 = { x: 0, y: 0 };
    glass.p2 = { x: 10, y: 0 };

    const [region, blocker] = glass.getPrimitives();
    expect(region.kind).toBe('region');
    expect(region.curves.map(curve => curve.kind)).toEqual([
      'lineSegment',
      'circularArc'
    ]);
    expect(blocker.kind).toBe('surface');
    expect(blocker.curve).toBe(region.curves[1]);
    expect(region.curves[1].params.bulge).toBe(1);
  });

  test('diffraction grating fixes the maximum output slot count', () => {
    const scene = new Scene();
    const grating = new DiffractionGrating(scene);
    grating.p1 = { x: 0, y: 0 };
    grating.p2 = { x: 10, y: 0 };
    grating.lineDensity = 1000;

    const [primitive] = grating.getPrimitives();
    expect(primitive.surfaceType.outRayCount).toBe(6);
    expect(primitive.surfaceType.paramNames).toEqual([
      'line_density',
      'slit_ratio'
    ]);
    const values = createDagClosureEvaluator(primitive.surfaceType.dag)({
      ...primitive.params,
      d_0x: 0,
      P_0s: 0.4,
      P_0p: 0.6,
      lambda: 380
    });
    expect(values.d_1x).toBeCloseTo(0);
    expect(values.d_1y).toBeCloseTo(-1);
    expect(values.P_1s).toBeCloseTo(0.1);
    expect(values.P_1p).toBeCloseTo(0.15);
    expect(() => preprocessPrimitives([primitive], {
      numericEpsilon: FLOAT32_EPSILON
    })).not.toThrow();
  });

  test('straight grating preserves signed custom-brightness orders', () => {
    const scene = new Scene();
    const grating = new DiffractionGrating(scene);
    grating.p1 = { x: 0, y: 0 };
    grating.p2 = { x: 10, y: 0 };
    grating.lineDensity = 1000;
    grating.customBrightness = true;
    grating.brightnesses = [1, 0.2, 0.8];

    const [primitive] = grating.getPrimitives();
    const values = createDagClosureEvaluator(primitive.surfaceType.dag)({
      ...primitive.params,
      d_0x: 0,
      P_0s: 0.4,
      P_0p: 0.6,
      lambda: 380
    });
    expect(values.d_2x).toBeCloseTo(0.38);
    expect(values.P_2s).toBeCloseTo(0.08);
    expect(values.d_3x).toBeCloseTo(-0.38);
    expect(values.P_3s).toBeCloseTo(0.32);
  });

  test('diffraction orders keep stable slots across incident-angle sign', () => {
    const scene = new Scene();
    const grating = new DiffractionGrating(scene);
    grating.p1 = { x: 0, y: 0 };
    grating.p2 = { x: 10, y: 0 };
    grating.lineDensity = 2000;

    const [primitive] = grating.getPrimitives();
    const evaluate = createDagClosureEvaluator(primitive.surfaceType.dag);
    const commonInputs = {
      ...primitive.params,
      P_0s: 0.4,
      P_0p: 0.6,
      lambda: 500
    };
    const before = evaluate({ ...commonInputs, d_0x: -0.001 });
    const after = evaluate({ ...commonInputs, d_0x: 0.001 });

    // m_min changes from 0 to -1 here. The zeroth order remains in slot 1
    // instead of every continuing order shifting by one output slot.
    expect(before.d_1x).toBeCloseTo(-0.001);
    expect(after.d_1x).toBeCloseTo(0.001);
    expect(before.P_1s).toBeGreaterThan(0);
    expect(after.P_1s).toBeGreaterThan(0);
    for (let slot = 1; slot <= primitive.surfaceType.outRayCount; slot++) {
      if (!Number.isFinite(before[`d_${slot}y`]) ||
          !Number.isFinite(after[`d_${slot}y`])) {
        continue;
      }
      const beforeOrder = Math.round(
        before[`d_${slot}x`] - (-0.001)
      );
      const afterOrder = Math.round(
        after[`d_${slot}x`] - 0.001
      );
      expect(afterOrder).toBe(beforeOrder);
    }
  });

  test('beam uses one source primitive per sampled point', () => {
    const scene = new Scene();
    scene.rayDensity = 1;
    const beam = new Beam(scene);
    beam.p1 = { x: 0, y: 0 };
    beam.p2 = { x: 10, y: 0 };
    beam.emisAngle = 10;

    const primitives = beam.getPrimitives();
    expect(primitives.length).toBeGreaterThan(1);
    expect(primitives.every(primitive => primitive.kind === 'source')).toBe(true);
    expect(primitives.every(
      primitive => primitive.rayCount === primitives[0].rayCount
    )).toBe(true);
  });

  test('source mappings expose their legacy brightness scales', () => {
    const scene = new Scene();
    scene.rayDensity = 1;
    scene.colorMode = 'default';

    const point = new PointSource(scene);
    point.x = 0;
    point.y = 0;
    point.brightness = 2;
    point.getPrimitives();

    const angle = new AngleSource(scene);
    angle.p1 = { x: 0, y: 0 };
    angle.p2 = { x: 10, y: 0 };
    angle.brightness = 2;
    angle.getPrimitives();

    const beam = new Beam(scene);
    beam.p1 = { x: 0, y: 0 };
    beam.p2 = { x: 10, y: 0 };
    beam.emisAngle = 0;
    beam.brightness = 2;
    beam.getPrimitives();

    expect(point.brightnessScale).toBe(0.5);
    expect(angle.brightnessScale).toBe(0.5);
    expect(beam.brightnessScale).toBe(0.5);

    scene.colorMode = 'linear';
    point.getPrimitives();
    angle.getPrimitives();
    beam.getPrimitives();
    expect(point.brightnessScale).toBeNull();
    expect(angle.brightnessScale).toBeNull();
    expect(beam.brightnessScale).toBeNull();
  });

  test('random beam uses one source primitive per individual ray', () => {
    const scene = new Scene();
    scene.rayDensity = 1;
    const beam = new Beam(scene);
    beam.p1 = { x: 0, y: 0 };
    beam.p2 = { x: 10, y: 0 };
    beam.emisAngle = 10;
    beam.random = true;

    const primitives = beam.getPrimitives();
    expect(primitives.length).toBeGreaterThan(1);
    expect(primitives.every(primitive => primitive.kind === 'source')).toBe(
      true
    );
    expect(primitives.every(primitive => primitive.rayCount === 1)).toBe(true);
  });
});
