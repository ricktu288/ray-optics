/*
 * Copyright 2026 The Ray Optics Simulation authors and contributors
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { collectNodeLabels } from '../formula/dag-util.js';
import {
  generateDagWgslFunction,
  WGSL_RUNTIME_CODE
} from '../formula/dag-wgsl-generator.js';

const SOURCE_LABELS = [
  'x', 'y', 'd_x', 'd_y', 'P_s', 'P_p', 'lambda'
];

/**
 * Materialize output-specific WGSL functions from the specializations made by
 * the range pass.  No range estimation occurs here.  These program objects
 * are cached with the execution plan and are intended to be embedded directly
 * in the corresponding compute pipeline modules.
 */
export function createWebGpuDagPrograms(description, parameterRanges) {
  const sources = description.types.sources.map((type, typeId) =>
    compile(type.definition.dag, parameterRanges.sources[typeId], {
      functionName: `source_${typeId}`,
      labels: SOURCE_LABELS,
      variant: 'source'
    })
  );
  const bulks = description.types.bulks.map((type, typeId) => {
    const labels = collectNodeLabels(type.definition.dag);
    const grinLabels = ['n', 'alpha'];
    if (labels.has('n_x')) grinLabels.push('n_x');
    if (labels.has('n_y')) grinLabels.push('n_y');
    return {
      nOnly: compile(type.definition.dag, parameterRanges.bulks[typeId], {
        functionName: `bulk_n_${typeId}`,
        labels: ['n'],
        variant: 'n-only'
      }),
      grin: compile(type.definition.dag, parameterRanges.bulks[typeId], {
        functionName: `bulk_grin_${typeId}`,
        labels: grinLabels,
        variant: 'grin'
      })
    };
  });
  const surfaces = description.types.surfaces.map((type, typeId) =>
    compile(type.definition.dag, parameterRanges.surfaces[typeId], {
      functionName: `surface_${typeId}`,
      labels: surfaceLabels(type.definition.outRayCount),
      variant: 'surface'
    })
  );
  const detectors = description.types.detectors.map((type, typeId) =>
    compile(type.definition.dag, parameterRanges.detectors[typeId], {
      functionName: `detector_${typeId}`,
      labels: detectorLabels(type.definition.writeCount),
      variant: 'detector'
    })
  );
  return {
    runtimeCode: WGSL_RUNTIME_CODE,
    sources,
    bulks,
    surfaces,
    detectors,
  };
}

function compile(dag, rangeEntry, { functionName, labels, variant }) {
  const generated = generateDagWgslFunction(dag, {
    functionName,
    labels,
    parameters: rangeEntry.parameters,
    specialization: rangeEntry.specialization,
  });
  return {
    variant,
    functionName,
    labels,
    parameters: generated.parameters,
    code: generated.code,
    guardSignature: generated.guardSignature,
    specialization: rangeEntry.specialization,
  };
}

function surfaceLabels(outRayCount) {
  const labels = [];
  for (let index = 1; index <= outRayCount; index++) {
    labels.push(
      `d_${index}x`, `d_${index}y`, `P_${index}s`, `P_${index}p`
    );
  }
  return labels;
}

function detectorLabels(writeCount) {
  const labels = [];
  for (let index = 1; index <= writeCount; index++) {
    labels.push(`k_${index}`, `v_${index}`);
  }
  return labels;
}

