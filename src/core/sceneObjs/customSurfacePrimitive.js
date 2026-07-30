/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

import { parseFormula } from '../formula/formula-parser.js';
import { substituteDagParameters } from '../formula/substitution.js';
import { combineDags } from '../formula/dag-combination.js';
import {
  equationValueToDisplay
} from '../propertyUtils/equationConversion.js';

const surfaceTypeCache = new Map();
const MAX_SURFACE_TYPE_CACHE_SIZE = 256;

/**
 * Translate legacy angle/polarization custom-surface formulas to a primitive
 * surface type. The translation is performed independently for s and p
 * polarization. A legacy output occupies two primitive slots whenever those
 * translated angle DAGs differ; later formulas inherit that split through
 * their references to earlier theta/P values.
 */
export function createCustomSurfacePrimitive({
  curve,
  outRays,
  twoSided,
  positionExpression,
  params = {},
  name = 'Custom surface'
}) {
  const paramNames = Object.keys(params);
  const cacheKey = JSON.stringify([
    name,
    outRays,
    positionExpression,
    paramNames
  ]);
  const cachedSurfaceType = surfaceTypeCache.get(cacheKey);
  if (cachedSurfaceType) {
    return {
      kind: 'surface',
      curve,
      twoSided,
      surfaceType: cachedSurfaceType,
      params
    };
  }
  const positionDag = parseFormula(
    positionExpression,
    ['u', 'x', 'y', ...paramNames]
  );
  const incidentAngleDag = parseFormula(
    'atan2(-d_0x, -d_0y)',
    ['d_0x', 'd_0y']
  );
  const zeroDag = parseFormula('0', []);
  const polarizationPowerDags = [
    parseFormula('P_0s', ['P_0s']),
    parseFormula('P_0p', ['P_0p'])
  ];
  const polarizationDags = [parseFormula('0', []), parseFormula('1', [])];
  const angles = [[], []];
  const powers = [[], []];
  const outputDags = [];
  let slot = 0;

  const legacyNames = [
    'theta_0', 'P_0', 'lambda', 't', 'p', 'n_0', 'n_1',
    ...outRays.flatMap((_, index) => [
      `theta_${index + 1}`,
      `P_${index + 1}`
    ])
  ];

  for (let rayIndex = 0; rayIndex < outRays.length; rayIndex++) {
    const angleSource = convertEquation(outRays[rayIndex].eqnTheta);
    const powerSource = convertEquation(outRays[rayIndex].eqnP);
    for (let polarization = 0; polarization < 2; polarization++) {
      const substitutions = {
        theta_0: incidentAngleDag,
        P_0: polarizationPowerDags[polarization],
        t: positionDag,
        p: polarizationDags[polarization]
      };
      for (let previous = 0; previous < rayIndex; previous++) {
        substitutions[`theta_${previous + 1}`] =
          angles[polarization][previous];
        substitutions[`P_${previous + 1}`] =
          powers[polarization][previous];
      }
      angles[polarization][rayIndex] = substituteDagParameters(
        parseFormula(angleSource, legacyNames),
        substitutions
      );
      substitutions[`theta_${rayIndex + 1}`] =
        angles[polarization][rayIndex];
      powers[polarization][rayIndex] = substituteDagParameters(
        parseFormula(powerSource, legacyNames),
        substitutions
      );
    }

    const splitPolarizations = !dagsEqual(
      angles[0][rayIndex],
      angles[1][rayIndex]
    );
    if (splitPolarizations) {
      slot++;
      outputDags.push(...createOutputSlotDags(
        slot,
        angles[0][rayIndex],
        powers[0][rayIndex],
        zeroDag
      ));
      slot++;
      outputDags.push(...createOutputSlotDags(
        slot,
        angles[1][rayIndex],
        zeroDag,
        powers[1][rayIndex]
      ));
    } else {
      slot++;
      outputDags.push(...createOutputSlotDags(
        slot,
        angles[0][rayIndex],
        powers[0][rayIndex],
        powers[1][rayIndex]
      ));
    }
  }

  // Surface types require at least one fixed output slot. An empty custom
  // surface is represented by a single zero-power slot and therefore absorbs.
  if (slot === 0) {
    slot = 1;
    outputDags.push(...createOutputSlotDags(
      slot,
      incidentAngleDag,
      zeroDag,
      zeroDag
    ));
  }

  const surfaceType = {
    name,
    paramNames,
    dag: combineDags(outputDags),
    outRayCount: slot,
    mergesWithGlass: true
  };
  if (surfaceTypeCache.size >= MAX_SURFACE_TYPE_CACHE_SIZE) {
    surfaceTypeCache.clear();
  }
  surfaceTypeCache.set(cacheKey, surfaceType);
  return { kind: 'surface', curve, twoSided, surfaceType, params };
}

function createOutputSlotDags(index, angleDag, sPowerDag, pPowerDag) {
  const directionX = substituteDagParameters(
    parseFormula('-sin(angle)', ['angle'], { outputLabel: `d_${index}x` }),
    { angle: angleDag }
  );
  const directionY = substituteDagParameters(
    parseFormula('-cos(angle)', ['angle'], { outputLabel: `d_${index}y` }),
    { angle: angleDag }
  );
  return [
    directionX,
    directionY,
    withRootLabel(sPowerDag, `P_${index}s`),
    withRootLabel(pPowerDag, `P_${index}p`)
  ];
}

function withRootLabel(dag, label) {
  return {
    ...dag,
    nodes: dag.nodes.map(node =>
      node.id === dag.root ? { ...node, label } : { ...node }
    )
  };
}

function convertEquation(value) {
  const converted = equationValueToDisplay(value);
  if (!converted.supported || converted.display.trim() === '') {
    throw new Error('Unsupported custom-surface formula.');
  }
  return converted.display;
}

function dagsEqual(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}
