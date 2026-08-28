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
  collectNodeLabels,
  collectParameterNames
} from '../../formula/dag-util.js';
import { estimateDagRanges } from '../../formula/range-estimator.js';
import {
  createDagWgslSpecialization
} from '../../formula/dag-wgsl-generator.js';
import { getIntersectionTolerancePolicy } from '../../primitive/numeric.js';

export const WEBGPU_F32_MAX = 3.4028234663852886e38;
export const WEBGPU_F32_MIN_NORMAL = 2 ** -126;
export const WEBGPU_MAX_POLARIZED_POWER = WEBGPU_F32_MAX / 2;
export const DEFAULT_WEBGPU_PARAMETER_INTERVAL_LIMIT = 8;

// With every world coordinate in [-2^62, 2^62], subtracting two coordinates
// is finite and the sum of the squared x/y differences is at most 2^127.
// This leaves a factor-of-two margin below the largest f32 value for the
// distance and normal calculations shared with the primitive CPU engine.
// Scale-normalized curve algorithms can have additional constraints; those
// belong to WebGPU geometry packing rather than to the world-coordinate range.
export const WEBGPU_SPATIAL_MAX = 2 ** 62;

const DEFAULT_VIOLET_WAVELENGTH = 420;
const DEFAULT_RED_WAVELENGTH = 620;
const BASE_UV_WAVELENGTH = 380;
const BASE_INFRARED_WAVELENGTH = 700;

const SOURCE_RESERVED_PARAMETERS = ['i', 'N'];
const BULK_RESERVED_PARAMETERS = ['x', 'y', 'lambda'];
const DETECTOR_RESERVED_PARAMETERS = [
  'd_0x',
  'd_0y',
  'P_0s',
  'P_0p',
  'lambda',
  'x',
  'y',
  'u',
  'sigma'
];
const SURFACE_RESERVED_PARAMETERS = [
  ...DETECTOR_RESERVED_PARAMETERS,
  'n_0',
  'n_1'
];
const INTERNAL_BOUNDARY_PARAMETERS = [
  'd_0x',
  'd_0y',
  'P_0s',
  'P_0p',
  'n_0',
  'n_1'
];

const F32 = new Float32Array(1);
const U32 = new Uint32Array(F32.buffer);
const MULTIPLY_RANGE_DAG = {
  root: 2,
  nodes: [
    { id: 0, kind: 'parameter', name: 'left' },
    { id: 1, kind: 'parameter', name: 'right' },
    { id: 2, kind: 'binary', op: '*', args: [0, 1] }
  ]
};

/**
 * Estimate the f32 input interval contract for every formula type in a
 * processed scene. Each authored type receives a reusable WGSL specialization
 * containing its DAG range result and range-dependent guard signature. A
 * later WGSL generation step can consume that specialization without running
 * the range estimator again. No WGSL is emitted or compiled here.
 *
 * Runtime WebGPU tracing must discard wavelengths outside `wavelengthRange`.
 * The same range is used for every downstream `lambda` input.
 *
 * @param {Object} description - Engine-independent processed scene.
 * @param {Object} [options]
 * @param {number} [options.violetWavelength=420]
 * @param {number} [options.redWavelength=620]
 * @param {boolean} [options.keepNonVisibleLight=false]
 * @param {number} [options.intervalLimit=8]
 * @returns {Object} A unified `types` list, category views, and supporting region-index metadata.
 */
export function estimateWebGpuParameterRanges(description, {
  violetWavelength = DEFAULT_VIOLET_WAVELENGTH,
  redWavelength = DEFAULT_RED_WAVELENGTH,
  keepNonVisibleLight = false,
  intervalLimit = DEFAULT_WEBGPU_PARAMETER_INTERVAL_LIMIT
} = {}) {
  validateDescription(description);
  validateIntervalLimit(intervalLimit);
  validateWebGpuSpatialBounds(description);

  const wavelengthRange = deriveWebGpuWavelengthRange({
    violetWavelength,
    redWavelength,
    keepNonVisibleLight
  });
  const ownerRanges = collectOwnerCoordinateRanges(description, intervalLimit);
  const tolerancePolicy = getIntersectionTolerancePolicy(
    description.numericEpsilon
  );
  const regionRefractiveIndices = estimateRegionRefractiveIndices(
    description,
    ownerRanges.regionBounds,
    wavelengthRange,
    intervalLimit
  );
  const bulkRefractiveIndices = description.types.bulks.map((_, typeId) =>
    unionRangeInfos(
      regionRefractiveIndices.filter(info => info.bulkTypeId === typeId),
      intervalLimit
    )
  );

  const sourceTypes = description.types.sources.map((type, typeId) =>
    createTypeRangeEntry({
      type,
      typeId,
      instances: description.sources.filter(
        source => source.sourceTypeId === typeId
      ),
      reservedNames: SOURCE_RESERVED_PARAMETERS,
      reservedRanges: createSourceReservedRanges(
        description.sources.filter(source => source.sourceTypeId === typeId),
        intervalLimit
      ),
      intervalLimit,
      categoryName: 'source'
    })
  );
  const surfaceTypes = description.types.surfaces.map((type, typeId) => {
    const instances = description.surfaces.filter(
      surface => surface.surfaceTypeId === typeId
    );
    const curves = description.curves.filter(curve =>
      curve.ownerKind === 'surface' &&
      description.surfaces[curve.ownerId]?.surfaceTypeId === typeId
    );
    const refractiveIndexRange = interactionRefractiveIndexRange(
      curves,
      regionRefractiveIndices,
      ownerRanges.regionBounds,
      intervalLimit
    );
    return createTypeRangeEntry({
      type,
      typeId,
      instances,
      reservedNames: SURFACE_RESERVED_PARAMETERS,
      reservedRanges: createInteractionReservedRanges({
        coordinateRanges: ownerRanges.surfaces[typeId],
        curves,
        wavelengthRange,
        refractiveIndexRange,
        tolerancePolicy,
        intervalLimit
      }),
      intervalLimit,
      categoryName: 'surface'
    });
  });
  const bulkTypes = description.types.bulks.map((type, typeId) => {
    const instances = description.regions.filter(
      region => region.bulkTypeId === typeId
    );
    return {
      ...createTypeRangeEntry({
        type,
        typeId,
        instances,
        reservedNames: BULK_RESERVED_PARAMETERS,
        reservedRanges: {
          ...(ownerRanges.bulks[typeId] ?? zeroCoordinateRanges()),
          lambda: wavelengthRange
        },
        intervalLimit,
        categoryName: 'bulk'
      }),
      outputRanges: {
        n: cloneRangeInfo(bulkRefractiveIndices[typeId])
      }
    };
  });
  const detectorTypes = description.types.detectors.map((type, typeId) => {
    const instances = description.detectors.filter(
      detector => detector.detectorTypeId === typeId
    );
    const curves = description.curves.filter(curve =>
      curve.ownerKind === 'detector' &&
      description.detectors[curve.ownerId]?.detectorTypeId === typeId
    );
    return createTypeRangeEntry({
      type,
      typeId,
      instances,
      reservedNames: DETECTOR_RESERVED_PARAMETERS,
      reservedRanges: createInteractionReservedRanges({
        coordinateRanges: ownerRanges.detectors[typeId],
        curves,
        wavelengthRange,
        tolerancePolicy,
        intervalLimit
      }),
      intervalLimit,
      categoryName: 'detector'
    });
  });
  const internalSurfaceTypes = [false, true].flatMap(partialReflect => {
    const regions = description.regions.filter(
      region => region.partialReflect === partialReflect
    );
    if (regions.length === 0) return [];
    const curves = description.curves.filter(curve =>
      curve.ownerKind === 'region' &&
      description.regions[curve.ownerId]?.partialReflect === partialReflect
    );
    const refractiveIndexRange = interactionRefractiveIndexRange(
      curves,
      regionRefractiveIndices,
      ownerRanges.regionBounds,
      intervalLimit
    );
    return [createInternalBoundaryType(
      partialReflect,
      refractiveIndexRange
    )];
  });
  for (const type of sourceTypes) {
    attachDagSpecialization(
      type,
      description.types.sources[type.typeId].definition.dag
    );
    validateSourceCoordinateOutputs(
      type,
      description.types.sources[type.typeId].definition.dag
    );
  }
  for (const type of bulkTypes) {
    attachDagSpecialization(
      type,
      description.types.bulks[type.typeId].definition.dag
    );
  }
  for (const type of surfaceTypes) {
    attachDagSpecialization(
      type,
      description.types.surfaces[type.typeId].definition.dag
    );
  }
  for (const type of detectorTypes) {
    attachDagSpecialization(
      type,
      description.types.detectors[type.typeId].definition.dag
    );
  }
  const types = [
    ...sourceTypes,
    ...bulkTypes,
    ...internalSurfaceTypes,
    ...surfaceTypes,
    ...detectorTypes
  ];

  return {
    wavelengthRange,
    types,
    sources: sourceTypes,
    surfaces: surfaceTypes,
    bulks: bulkTypes,
    detectors: detectorTypes,
    internalSurfaces: internalSurfaceTypes,
    regionRefractiveIndices
  };
}

/**
 * Derive the accepted wavelength range. By default this applies the scene's
 * violet/red affine mapping to the standard 380/420/620/700 anchors. When
 * non-visible light is retained, the closed range-estimation interval covers
 * the positive finite f32 domain and runtime validation excludes zero.
 */
export function deriveWebGpuWavelengthRange({
  violetWavelength = DEFAULT_VIOLET_WAVELENGTH,
  redWavelength = DEFAULT_RED_WAVELENGTH,
  keepNonVisibleLight = false
} = {}) {
  if (
    !Number.isFinite(violetWavelength) ||
    !Number.isFinite(redWavelength) ||
    !(redWavelength > violetWavelength)
  ) {
    throw new RangeError(
      'WebGPU violetWavelength and redWavelength must be finite, with redWavelength greater than violetWavelength.'
    );
  }
  if (keepNonVisibleLight) {
    // Zero is included conservatively for formula range estimation. Runtime
    // source validation still requires the wavelength to be strictly positive.
    return [[0, WEBGPU_F32_MAX]];
  }
  const scale = (
    redWavelength - violetWavelength
  ) / (
    DEFAULT_RED_WAVELENGTH - DEFAULT_VIOLET_WAVELENGTH
  );
  const mapWavelength = wavelength =>
    violetWavelength +
    (wavelength - DEFAULT_VIOLET_WAVELENGTH) * scale;
  return [outwardF32Interval(
    mapWavelength(BASE_UV_WAVELENGTH),
    mapWavelength(BASE_INFRARED_WAVELENGTH),
    'WebGPU wavelength range'
  )];
}

/**
 * Convert an ordinary instance parameter to the value that may be packed in
 * an f32 buffer. Finite overflow and signed infinities saturate; NaN and
 * non-numeric values remain scene-contract errors.
 */
export function clampWebGpuParameterToF32(value, name = 'parameter') {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new TypeError(`${name} must be a number other than NaN.`);
  }
  const clamped = Math.max(
    -WEBGPU_F32_MAX,
    Math.min(WEBGPU_F32_MAX, value)
  );
  return Math.fround(clamped);
}

/**
 * Reject processed geometry which cannot use the WebGPU world-coordinate
 * domain. This is intentionally a GPU preparation check, not common CPU
 * preprocessing policy.
 */
export function validateWebGpuSpatialBounds(description) {
  for (const [curveId, curve] of description.curves.entries()) {
    validateSpatialBounds(curve.bounds, `curve ${curveId}`);
  }
  for (const [nodeId, node] of description.bvh.nodes.entries()) {
    validateSpatialBounds(node.bounds, `BVH node ${nodeId}`);
  }
}

/**
 * Compare only range-dependent guard signatures. Structural DAG changes are
 * intentionally outside this comparison and remain simulator-owned.
 *
 * @param {Object} estimated
 * @param {Map<string, string>|null} previousSignatures
 * @returns {Map<string, string>} Signatures to retain for the next update.
 */
export function recordWebGpuRecompilationNeeds(
  estimated,
  previousSignatures = null
) {
  const nextSignatures = new Map();
  for (const type of estimated.types) {
    const previous = previousSignatures?.get(type.key);
    type.recompilationNeeded = previousSignatures === null ||
      previous === undefined ||
      previous !== type.guardSignature;
    type.recompilationReason = previousSignatures === null
      ? 'initial specialization'
      : previous === undefined
        ? 'new type'
        : previous !== type.guardSignature
          ? 'range guards changed'
          : null;
    nextSignatures.set(type.key, type.guardSignature);
  }
  estimated.removedTypeKeys = previousSignatures
    ? [...previousSignatures.keys()].filter(key => !nextSignatures.has(key))
    : [];
  estimated.anyRecompilationNeeded =
    estimated.types.some(type => type.recompilationNeeded) ||
    estimated.removedTypeKeys.length > 0;
  return nextSignatures;
}

function createTypeRangeEntry({
  type,
  typeId,
  instances,
  reservedNames,
  reservedRanges,
  intervalLimit,
  categoryName
}) {
  const definition = type.definition;
  const referencedNames = collectParameterNames(definition.dag);
  const declaredNames = definition.paramNames ?? [];
  validateUniqueNames(declaredNames, `${categoryName} type ${typeId} paramNames`);
  const reservedSet = new Set(reservedNames);
  for (const name of declaredNames) {
    if (reservedSet.has(name)) {
      throw new TypeError(
        `${categoryName} type ${typeId} parameter ${JSON.stringify(name)} is reserved.`
      );
    }
  }

  const orderedNames = [
    ...declaredNames.filter(name => referencedNames.has(name)),
    ...reservedNames.filter(name => referencedNames.has(name))
  ];
  const knownNames = new Set([...declaredNames, ...reservedNames]);
  for (const name of referencedNames) {
    if (!knownNames.has(name)) {
      throw new TypeError(
        `${categoryName} type ${typeId} DAG references undeclared parameter ${JSON.stringify(name)}.`
      );
    }
  }

  const parameters = orderedNames.map(name => {
    if (declaredNames.includes(name)) {
      return {
        name,
        range: collectInstanceParameterRange(
          instances,
          name,
          intervalLimit,
          `${categoryName} type ${typeId}`
        )
      };
    }
    const reserved = reservedRanges[name];
    const rangeInfo = Array.isArray(reserved)
      ? { intervals: reserved, maybeInvalid: false }
      : reserved;
    if (!rangeInfo) {
      throw new TypeError(
        `Missing reserved WebGPU parameter range for ${JSON.stringify(name)}.`
      );
    }
    return {
      name,
      range: cloneRange(rangeInfo.intervals),
      ...(rangeInfo.maybeInvalid
        ? { maybeInvalid: true, requiresFiniteGuard: true }
        : {})
    };
  });
  return {
    kind: categoryName,
    typeId,
    key: `${categoryName}:${typeId}`,
    name: definition.name,
    parameters
  };
}

function createInternalBoundaryType(
  partialReflect,
  refractiveIndexRange
) {
  const ranges = {
    d_0x: [[-1, 1]],
    d_0y: [[-1, -WEBGPU_F32_MIN_NORMAL]],
    P_0s: [[0, WEBGPU_MAX_POLARIZED_POWER]],
    P_0p: [[0, WEBGPU_MAX_POLARIZED_POWER]],
    n_0: cloneRangeInfo(refractiveIndexRange),
    n_1: cloneRangeInfo(refractiveIndexRange)
  };
  const parameters = INTERNAL_BOUNDARY_PARAMETERS.map(name => {
    const rangeInfo = Array.isArray(ranges[name])
      ? { intervals: ranges[name], maybeInvalid: false }
      : ranges[name];
    return {
      name,
      range: cloneRange(rangeInfo.intervals),
      ...(rangeInfo.maybeInvalid
        ? { maybeInvalid: true, requiresFiniteGuard: true }
        : {})
    };
  });
  const guardProfile = {
    finiteRefractiveIndex:
      parameters.some(parameter =>
        (parameter.name === 'n_0' || parameter.name === 'n_1') &&
        parameter.maybeInvalid
      )
  };
  return {
    kind: 'surface',
    internal: true,
    key: partialReflect
      ? 'regionBoundaryPartialReflection'
      : 'regionBoundaryRefraction',
    name: partialReflect
      ? 'Region boundary with partial reflection'
      : 'Region boundary without partial reflection',
    partialReflect,
    outRayCount: partialReflect ? 2 : 1,
    parameters,
    specialization: {
      kind: 'internalSurface',
      guardProfile,
      guardSignature: JSON.stringify(guardProfile)
    },
    guardSignature: JSON.stringify(guardProfile)
  };
}

function attachDagSpecialization(type, dag) {
  type.specialization = createDagWgslSpecialization(dag, {
    parameters: type.parameters
  });
  type.guardSignature = type.specialization.guardSignature;
}

function validateSourceCoordinateOutputs(type, dag) {
  const labels = collectNodeLabels(dag);
  for (const label of ['x', 'y']) {
    const nodeId = labels.get(label);
    if (nodeId === undefined) {
      throw new TypeError(`source type ${type.typeId} has no ${label} output.`);
    }
    const range = type.specialization.rangeResult.nodeRanges[nodeId];
    for (const [minimum, maximum] of range.intervals) {
      if (minimum < -WEBGPU_SPATIAL_MAX || maximum > WEBGPU_SPATIAL_MAX) {
        throw new RangeError(
          `source type ${type.typeId} ${label} output may exceed the ` +
          `WebGPU spatial limit ${WEBGPU_SPATIAL_MAX}.`
        );
      }
    }
  }
}

function collectInstanceParameterRange(
  instances,
  name,
  intervalLimit,
  context
) {
  const values = instances.map((instance, instanceIndex) => {
    if (!Object.prototype.hasOwnProperty.call(instance.params, name)) {
      throw new TypeError(
        `${context} instance ${instanceIndex} is missing parameter ${JSON.stringify(name)}.`
      );
    }
    return clampWebGpuParameterToF32(
      instance.params[name],
      `${context} instance ${instanceIndex} parameter ${JSON.stringify(name)}`
    );
  });
  if (values.length === 0) {
    throw new TypeError(`${context} has no instances from which to estimate parameters.`);
  }
  return simplifySingletonValues(values, intervalLimit);
}

function createSourceReservedRanges(sources, intervalLimit) {
  const counts = sources.map((source, sourceIndex) => {
    if (
      !Number.isSafeInteger(source.rayCount) ||
      source.rayCount < 0
    ) {
      throw new RangeError(
        `source instance ${sourceIndex} rayCount must be a nonnegative safe integer.`
      );
    }
    return source.rayCount;
  });
  const nRange = simplifySingletonValues(
    counts.map(count => clampWebGpuParameterToF32(count, 'source rayCount')),
    intervalLimit
  );
  const maximumIndex = counts.reduce(
    (maximum, count) => Math.max(maximum, count - 1),
    0
  );
  return {
    i: [[0, Math.fround(maximumIndex)]],
    N: nRange
  };
}

function estimateRegionRefractiveIndices(
  description,
  regionBounds,
  wavelengthRange,
  intervalLimit
) {
  return description.regions.map((region, regionId) => {
    const definition = description.types.bulks[
      region.bulkTypeId
    ].definition;
    const bounds = regionBounds[regionId];
    const coordinateRanges = bounds
      ? {
        x: [outwardF32Interval(
          bounds.minX,
          bounds.maxX,
          `region ${regionId} x range`
        )],
        y: [outwardF32Interval(
          bounds.minY,
          bounds.maxY,
          `region ${regionId} y range`
        )]
      }
      : zeroCoordinateRanges();
    const parameterRanges = createRegionDagParameterRanges(
      definition,
      region,
      coordinateRanges,
      wavelengthRange,
      regionId
    );
    const nNodeId = collectNodeLabels(definition.dag).get('n');
    if (nNodeId === undefined) {
      throw new TypeError(`bulk type ${region.bulkTypeId} has no n output.`);
    }
    const estimated = estimateDagRanges(
      definition.dag,
      parameterRanges
    ).nodeRanges[nNodeId];
    return {
      regionId,
      bulkTypeId: region.bulkTypeId,
      intervals: simplifyIntervals(estimated.intervals, intervalLimit),
      maybeInvalid: estimated.maybeInvalid
    };
  });
}

function createRegionDagParameterRanges(
  definition,
  region,
  coordinateRanges,
  wavelengthRange,
  regionId
) {
  const declaredNames = definition.paramNames ?? [];
  const declaredSet = new Set(declaredNames);
  const reservedRanges = {
    ...coordinateRanges,
    lambda: wavelengthRange
  };
  const ranges = {};
  for (const name of collectParameterNames(definition.dag)) {
    if (declaredSet.has(name)) {
      if (!Object.prototype.hasOwnProperty.call(region.params, name)) {
        throw new TypeError(
          `region ${regionId} is missing parameter ${JSON.stringify(name)}.`
        );
      }
      const value = clampWebGpuParameterToF32(
        region.params[name],
        `region ${regionId} parameter ${JSON.stringify(name)}`
      );
      ranges[name] = [[value, value]];
    } else if (reservedRanges[name]) {
      ranges[name] = cloneRange(reservedRanges[name]);
    } else {
      throw new TypeError(
        `bulk type ${region.bulkTypeId} DAG references undeclared parameter ${JSON.stringify(name)}.`
      );
    }
  }
  return ranges;
}

function interactionRefractiveIndexRange(
  curves,
  regionRefractiveIndices,
  regionBounds,
  intervalLimit
) {
  const perCurveRanges = curves.map(curve => {
    const possibleRegions = regionRefractiveIndices.filter(info => {
      const bounds = regionBounds[info.regionId];
      return bounds && boundsOverlap(curve.bounds, bounds);
    });
    let effective = {
      intervals: [[1, 1]],
      maybeInvalid: false
    };
    for (const regionInfo of possibleRegions) {
      const optionalRegion = {
        intervals: simplifyIntervals(
          [[1, 1], ...regionInfo.intervals],
          intervalLimit
        ),
        maybeInvalid: regionInfo.maybeInvalid
      };
      effective = multiplyRangeInfos(
        effective,
        optionalRegion,
        intervalLimit
      );
    }
    return effective;
  });
  return unionRangeInfos(perCurveRanges, intervalLimit);
}

function multiplyRangeInfos(left, right, intervalLimit) {
  if (left.intervals.length === 0 || right.intervals.length === 0) {
    return {
      intervals: [],
      maybeInvalid: true
    };
  }
  const estimated = estimateDagRanges(MULTIPLY_RANGE_DAG, {
    left: left.intervals,
    right: right.intervals
  }).nodeRanges[MULTIPLY_RANGE_DAG.root];
  return {
    intervals: simplifyIntervals(estimated.intervals, intervalLimit),
    maybeInvalid:
      left.maybeInvalid || right.maybeInvalid || estimated.maybeInvalid
  };
}

function unionRangeInfos(infos, intervalLimit) {
  if (infos.length === 0) {
    return {
      intervals: [[1, 1]],
      maybeInvalid: false
    };
  }
  return {
    intervals: simplifyIntervals(
      infos.flatMap(info => info.intervals),
      intervalLimit
    ),
    maybeInvalid: infos.some(info => info.maybeInvalid)
  };
}

function createInteractionReservedRanges({
  coordinateRanges,
  curves,
  wavelengthRange,
  refractiveIndexRange,
  tolerancePolicy,
  intervalLimit
}) {
  return {
    d_0x: [[-1, 1]],
    d_0y: [[-1, -WEBGPU_F32_MIN_NORMAL]],
    P_0s: [[0, WEBGPU_MAX_POLARIZED_POWER]],
    P_0p: [[0, WEBGPU_MAX_POLARIZED_POWER]],
    lambda: wavelengthRange,
    ...(coordinateRanges ?? zeroCoordinateRanges()),
    u: collectCurveParameterRanges(curves, tolerancePolicy, intervalLimit),
    sigma: curves.some(curve => curve.twoSided)
      ? [[-1, -1], [1, 1]]
      : [[1, 1]],
    ...(refractiveIndexRange
      ? {
        n_0: cloneRangeInfo(refractiveIndexRange),
        n_1: cloneRangeInfo(refractiveIndexRange)
      }
      : {})
  };
}

function collectCurveParameterRanges(curves, tolerancePolicy, intervalLimit) {
  if (curves.length === 0) return [[0, 0]];
  const intervals = curves.map(curve => {
    const geometry = curve.geometry;
    if (geometry.kind === 'circle') return [0.5, 0.5];
    const distanceTolerance = Math.max(
      geometry.positionTolerance,
      geometry.endpointTolerance ?? 0
    );
    if (
      geometry.kind === 'lineSegment' ||
      geometry.kind === 'smoothLineSegment'
    ) {
      const tolerance = Math.max(
        tolerancePolicy.parameter,
        distanceTolerance * geometry.invLength
      );
      return outwardF32Interval(-tolerance, 1 + tolerance, 'curve u range');
    }
    if (geometry.kind === 'circularArc') {
      const tolerance = Math.max(
        tolerancePolicy.parameter,
        distanceTolerance * geometry.invChordLength
      );
      return outwardF32Interval(-tolerance, 1 + tolerance, 'curve u range');
    }
    if (geometry.kind === 'cubicBezier') {
      const normalizedTolerance = distanceTolerance * geometry.invScale;
      const startDerivative = Math.hypot(
        3 * (geometry.control1X - geometry.startX),
        3 * (geometry.control1Y - geometry.startY)
      );
      const endDerivative = Math.hypot(
        3 * (geometry.endX - geometry.control2X),
        3 * (geometry.endY - geometry.control2Y)
      );
      const startTolerance = startDerivative > 0
        ? Math.max(tolerancePolicy.parameter, normalizedTolerance / startDerivative)
        : tolerancePolicy.parameter;
      const endTolerance = endDerivative > 0
        ? Math.max(tolerancePolicy.parameter, normalizedTolerance / endDerivative)
        : tolerancePolicy.parameter;
      return outwardF32Interval(
        -startTolerance,
        1 + endTolerance,
        'curve u range'
      );
    }
    throw new TypeError(
      `Unsupported prepared curve kind: ${JSON.stringify(geometry.kind)}`
    );
  });
  return simplifyIntervals(intervals, intervalLimit);
}

function collectOwnerCoordinateRanges(description, intervalLimit) {
  const surfaceBounds = description.surfaces.map(() => null);
  const regionBounds = description.regions.map(() => null);
  const detectorBounds = description.detectors.map(() => null);
  for (const curve of description.curves) {
    const table = curve.ownerKind === 'surface'
      ? surfaceBounds
      : curve.ownerKind === 'region'
        ? regionBounds
        : detectorBounds;
    table[curve.ownerId] = combineBounds(table[curve.ownerId], curve.bounds);
  }
  return {
    surfaces: groupBoundsByType(
      surfaceBounds,
      description.surfaces,
      'surfaceTypeId',
      description.types.surfaces.length,
      intervalLimit
    ),
    bulks: groupBoundsByType(
      regionBounds,
      description.regions,
      'bulkTypeId',
      description.types.bulks.length,
      intervalLimit
    ),
    detectors: groupBoundsByType(
      detectorBounds,
      description.detectors,
      'detectorTypeId',
      description.types.detectors.length,
      intervalLimit
    ),
    surfaceBounds,
    regionBounds,
    detectorBounds
  };
}

function groupBoundsByType(
  ownerBounds,
  owners,
  typeIdKey,
  typeCount,
  intervalLimit
) {
  const grouped = Array.from({ length: typeCount }, () => []);
  ownerBounds.forEach((bounds, ownerId) => {
    if (bounds) grouped[owners[ownerId][typeIdKey]].push(bounds);
  });
  return grouped.map(boundsList => {
    if (boundsList.length === 0) return zeroCoordinateRanges();
    return {
      x: simplifyIntervals(boundsList.map(bounds =>
        outwardF32Interval(bounds.minX, bounds.maxX, 'coordinate x range')
      ), intervalLimit),
      y: simplifyIntervals(boundsList.map(bounds =>
        outwardF32Interval(bounds.minY, bounds.maxY, 'coordinate y range')
      ), intervalLimit)
    };
  });
}

function simplifySingletonValues(values, intervalLimit) {
  const unique = [...new Set(values.map(value =>
    Object.is(value, -0) ? 0 : value
  ))].sort((left, right) => left - right);
  if (unique.length === 0) return [[0, 0]];
  if (unique.length > intervalLimit) {
    return [[unique[0], unique[unique.length - 1]]];
  }
  return unique.map(value => [value, value]);
}

function simplifyIntervals(intervals, intervalLimit) {
  const sorted = intervals
    .map(([lo, hi]) => [lo, hi])
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const merged = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval[0] <= last[1]) {
      last[1] = Math.max(last[1], interval[1]);
    } else {
      merged.push(interval);
    }
  }
  if (merged.length > intervalLimit) {
    return [[merged[0][0], merged[merged.length - 1][1]]];
  }
  return merged;
}

function outwardF32Interval(lo, hi, name) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) {
    throw new RangeError(`${name} must have finite ordered endpoints.`);
  }
  if (lo < -WEBGPU_F32_MAX || hi > WEBGPU_F32_MAX) {
    throw new RangeError(`${name} is outside the finite f32 range.`);
  }
  let roundedLo = Math.fround(lo);
  let roundedHi = Math.fround(hi);
  if (roundedLo > lo) roundedLo = nextDownF32(roundedLo);
  if (roundedHi < hi) roundedHi = nextUpF32(roundedHi);
  return [roundedLo, roundedHi];
}

function nextUpF32(value) {
  value = Math.fround(value);
  if (value === Infinity) return value;
  if (Object.is(value, -0)) value = 0;
  F32[0] = value;
  if (value >= 0) U32[0] += 1;
  else U32[0] -= 1;
  return F32[0];
}

function nextDownF32(value) {
  return -nextUpF32(-value);
}

function validateSpatialBounds(bounds, name) {
  if (!bounds) {
    throw new TypeError(`Processed ${name} is missing bounds.`);
  }
  for (const key of ['minX', 'minY', 'maxX', 'maxY']) {
    const value = bounds[key];
    if (!Number.isFinite(value) || Math.abs(value) > WEBGPU_SPATIAL_MAX) {
      throw new RangeError(
        `Processed ${name} ${key}=${value} exceeds the WebGPU spatial limit ${WEBGPU_SPATIAL_MAX}.`
      );
    }
  }
  if (bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) {
    throw new RangeError(`Processed ${name} has invalid bounds.`);
  }
}

function combineBounds(first, second) {
  if (!first) return { ...second };
  return {
    minX: Math.min(first.minX, second.minX),
    minY: Math.min(first.minY, second.minY),
    maxX: Math.max(first.maxX, second.maxX),
    maxY: Math.max(first.maxY, second.maxY)
  };
}

function boundsOverlap(first, second) {
  return (
    first.minX <= second.maxX &&
    first.maxX >= second.minX &&
    first.minY <= second.maxY &&
    first.maxY >= second.minY
  );
}

function zeroCoordinateRanges() {
  return { x: [[0, 0]], y: [[0, 0]] };
}

function cloneRange(range) {
  if (!range) throw new TypeError('Missing reserved WebGPU parameter range.');
  return range.map(([lo, hi]) => [lo, hi]);
}

function cloneRangeInfo(info) {
  return {
    intervals: cloneRange(info.intervals),
    maybeInvalid: info.maybeInvalid
  };
}

function validateUniqueNames(names, context) {
  const unique = new Set();
  for (const name of names) {
    if (typeof name !== 'string' || name.length === 0 || unique.has(name)) {
      throw new TypeError(`${context} must contain unique nonempty strings.`);
    }
    unique.add(name);
  }
}

function validateDescription(description) {
  if (
    !description ||
    !description.types ||
    !Array.isArray(description.curves) ||
    !description.bvh
  ) {
    throw new TypeError('A processed scene description is required.');
  }
}

function validateIntervalLimit(intervalLimit) {
  if (!Number.isInteger(intervalLimit) || intervalLimit < 1) {
    throw new RangeError('intervalLimit must be a positive integer.');
  }
}
