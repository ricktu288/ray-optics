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

import { buildBvh } from './bvh.js';
import {
  DegenerateCurveError,
  prepareCurve
} from './curveGeometry.js';
import { collectParameterNames } from '../formula/dag-util.js';
import { validateNumericEpsilon } from './numeric.js';

/**
 * A canonical, engine-independent type definition.
 *
 * The definition is a deeply frozen plain-data copy of the type supplied by a
 * scene object. `hash` is an efficient lookup key, not the definition's
 * identity: preprocessing also compares the complete canonical representation
 * when hashes match.
 *
 * @typedef {Object} ProcessedType
 * @property {string} hash - A deterministic structural hash.
 * @property {Object} definition - The canonical type definition.
 */

/**
 * A source instance. The engine decides whether to use the parameter object
 * directly or pack it according to the corresponding type's `paramNames`.
 *
 * @typedef {Object} ProcessedSource
 * @property {number} sourceTypeId - Index into `types.sources`.
 * @property {Object<string, number>} params - Source instance parameters.
 * @property {number} rayCount - Number of source-formula invocations.
 */

/**
 * A surface instance. Its geometry is stored separately in `curves`.
 *
 * @typedef {Object} ProcessedSurface
 * @property {number} surfaceTypeId - Index into `types.surfaces`.
 * @property {Object<string, number>} params - Surface instance parameters.
 */

/**
 * A bulk-region instance. All of its boundary curves point back to this
 * record through their `ownerId`.
 *
 * @typedef {Object} ProcessedRegion
 * @property {number} bulkTypeId - Index into `types.bulks`.
 * @property {Object<string, number>} params - Bulk instance parameters.
 * @property {number} stepSize - Interior propagation step size.
 * @property {boolean} partialReflect - Whether transmissible boundaries also reflect.
 */

/**
 * A detector instance. `resultId` identifies primitives contributing to the
 * same logical scene-object result without prescribing an engine memory
 * layout.
 *
 * @typedef {Object} ProcessedDetector
 * @property {number} detectorTypeId - Index into `types.detectors`.
 * @property {Object<string, number>} params - Detector instance parameters.
 * @property {number} resultId - Index into the simulator-side detector result bindings.
 * @property {number} resultSize - Number of result scalars.
 */

/**
 * An intersection curve and its owning processed instance. Surface and
 * detector intersection policy is kept here because it is needed while
 * traversing the BVH, before formula evaluation. Region curves do not have
 * sidedness or wavelength filters.
 *
 * @typedef {Object} ProcessedCurve
 * @property {PreparedCurveGeometry} geometry - Prepared engine-independent curve geometry.
 * @property {{minX: number, minY: number, maxX: number, maxY: number}} bounds - Conservative world-space bounds, including the engine-selected positional and endpoint tolerances.
 * @property {'surface'|'region'|'detector'} ownerKind - Owner table kind.
 * @property {number} ownerId - Index into the matching owner table.
 * @property {boolean} mergesWithBoundary - Whether this curve can participate in an interaction with coincident region boundaries.
 * @property {boolean} [twoSided] - Whether both oriented sides participate.
 * @property {WavelengthFilter} [filter] - Optional pre-intersection wavelength filter.
 */

/**
 * The BVH node array uses up to four child node indices for branches. A leaf
 * has `count > 0`; its `[start, start + count)` range indexes `curveIds`, whose
 * values index the stable `curves` table. Branches are stored before leaves so
 * GPU packing can omit standalone leaf records. The BVH may therefore reorder
 * curves without changing curve or owner IDs. Every node's `ownerKindMask` is
 * the bitwise union of the surface, region, and detector kinds in its subtree.
 *
 * @typedef {Object} ProcessedBvh
 * @property {number} root - Root node index, or -1 for an empty tree.
 * @property {Array<Object>} nodes - BVH4 branch and leaf nodes.
 * @property {Uint32Array} curveIds - Curve IDs in BVH leaf order.
 */

/**
 * A complete engine-independent scene snapshot.
 *
 * Type IDs are local to their category and deterministic for a given set of
 * structural definitions. Instance parameters remain plain objects in this
 * common representation. Each engine may use those objects directly or pack
 * the values in the corresponding type's significant `paramNames` order.
 *
 * The type signature changes when any canonical type definition changes,
 * independent of primitive encounter order. It can be compared with the
 * previous snapshot to decide whether compiled engine code remains reusable.
 * Runtime parameter values, curves, and detector result sizes do not affect
 * this signature.
 *
 * This object contains only transferable plain data. In particular, it does
 * not contain the mutable detector result holders owned by scene objects.
 *
 * @typedef {Object} ProcessedScene
 * @property {number} numericEpsilon - Relative arithmetic epsilon selected by the engine for geometry preparation and intersection.
 * @property {{curveEndpoint: number, interactionMerging: number, interactionNormal: number, forwardDistance: number}} numericalTolerances - Engine-ready tolerance minimums. Distance values are in world units and `interactionNormal` is in radians.
 * @property {string} typeSignature - Structural signature of all four type tables.
 * @property {{sources: ProcessedType[], surfaces: ProcessedType[], bulks: ProcessedType[], detectors: ProcessedType[]}} types
 * @property {ProcessedSource[]} sources
 * @property {ProcessedSurface[]} surfaces
 * @property {ProcessedRegion[]} regions
 * @property {ProcessedDetector[]} detectors
 * @property {ProcessedCurve[]} curves
 * @property {ProcessedBvh} bvh
 */

/**
 * Simulator-side association between a logical detector result range and the
 * mutable holder supplied by one or more detector primitives. These bindings
 * are deliberately returned beside, rather than inside, `processedScene`.
 *
 * @typedef {Object} DetectorResultBinding
 * @property {number} resultId - Logical detector result ID used by processed detector instances.
 * @property {DetectorResult} result - Scene-object-owned mutable holder.
 * @property {number} resultSize - Number of scalars in the logical result.
 */

/**
 * Convert scene-object primitives into an engine-independent processed scene.
 * Degenerate curves are discarded. A surface or detector owning one is
 * discarded with it, while a region is retained if any boundary remains.
 *
 * @param {Primitive[]} primitives - Primitives collected in scene order.
 * @param {Object} [options]
 * @param {Object} [options.bvhOptions] - Options forwarded to {@link buildBvh}.
 * @param {number} [options.lengthScale=1] - Natural scene length used by engine-selected curve tolerances.
 * @param {Object} [options.numericalTolerances] - Simulator-configured tolerance minimums, with distances relative to the scene length scale.
 * @param {number} options.numericEpsilon - Relative arithmetic epsilon selected by the engine.
 * @param {boolean} [options.logDebugInfo=false] - Whether to measure preprocessing stages for debug output.
 * @returns {{processedScene: ProcessedScene, detectorResultBindings: DetectorResultBinding[], timings: Object|null}}
 */
export function preprocessPrimitives(primitives, {
  bvhOptions = {},
  lengthScale = 1,
  numericalTolerances = {},
  numericEpsilon,
  logDebugInfo = false
} = {}) {
  if (!Array.isArray(primitives)) {
    throw new TypeError('primitives must be an array.');
  }
  validateNumericEpsilon(numericEpsilon);
  const resolvedNumericalTolerances = {
    curveEndpoint: resolveToleranceMinimum(
      numericalTolerances.curveEndpoint,
      lengthScale,
      'curveEndpoint'
    ),
    interactionMerging: resolveToleranceMinimum(
      numericalTolerances.interactionMerging,
      lengthScale,
      'interactionMerging'
    ),
    interactionNormal: resolveToleranceMinimum(
      numericalTolerances.interactionNormal,
      1,
      'interactionNormal'
    ),
    forwardDistance: resolveToleranceMinimum(
      numericalTolerances.forwardDistance,
      lengthScale,
      'forwardDistance'
    )
  };

  const timing = logDebugInfo ? createTimingRecorder() : null;
  const registries = {
    sources: new TypeRegistry(),
    surfaces: new TypeRegistry(),
    bulks: new TypeRegistry(),
    detectors: new TypeRegistry()
  };
  const sources = [];
  const surfaces = [];
  const regions = [];
  const detectors = [];
  const curves = [];
  const curveBounds = [];
  const detectorResults = new Map();
  const detectorResultBindings = [];
  const preparePrimitiveCurve = (curve, curvePath) => {
    const normalizedCurve = normalizePrimitiveCurve(
      curve,
      curvePath
    );
    try {
      return prepareCurve(normalizedCurve, {
        lengthScale,
        endpointTolerance: resolvedNumericalTolerances.curveEndpoint,
        numericEpsilon
      });
    } catch (error) {
      if (error instanceof DegenerateCurveError) return null;
      throw error;
    }
  };
  const appendProcessedCurve = (
    prepared,
    ownerKind,
    ownerId,
    mergesWithBoundary,
    twoSided,
    filter
  ) => {
    curves.push(createProcessedCurve(
      prepared.geometry,
      prepared.bounds,
      ownerKind,
      ownerId,
      mergesWithBoundary,
      twoSided,
      filter
    ));
    curveBounds.push(prepared.bounds);
  };

  for (let primitiveIndex = 0; primitiveIndex < primitives.length; primitiveIndex++) {
    const primitive = primitives[primitiveIndex];

    switch (primitive.kind) {
      case 'source': {
        const typeRecord = registries.sources.register(
          primitive.sourceType
        );
        sources.push({
          typeRecord,
          params: normalizeNumericStrings(
            primitive.params,
            `primitives[${primitiveIndex}].params`
          ),
          rayCount: normalizeNumericString(
            primitive.rayCount,
            `primitives[${primitiveIndex}].rayCount`
          )
        });
        break;
      }

      case 'surface': {
        const prepared = preparePrimitiveCurve(
          primitive.curve,
          `primitives[${primitiveIndex}].curve`
        );
        if (!prepared) break;
        const typeRecord = registries.surfaces.register(
          primitive.surfaceType
        );
        const ownerId = surfaces.length;
        surfaces.push({
          typeRecord,
          params: normalizeNumericStrings(
            primitive.params,
            `primitives[${primitiveIndex}].params`
          )
        });
        appendProcessedCurve(
          prepared,
          'surface',
          ownerId,
          primitive.surfaceType.mergesWithBoundary,
          primitive.twoSided,
          normalizeNumericStrings(
            primitive.filter,
            `primitives[${primitiveIndex}].filter`
          )
        );
        break;
      }

      case 'region': {
        const preparedCurves = [];
        for (let curveIndex = 0; curveIndex < primitive.curves.length; curveIndex++) {
          const prepared = preparePrimitiveCurve(
            primitive.curves[curveIndex],
            `primitives[${primitiveIndex}].curves[${curveIndex}]`
          );
          if (prepared) {
            preparedCurves.push(prepared);
          }
        }
        if (preparedCurves.length === 0) break;
        const typeRecord = registries.bulks.register(
          primitive.bulkType
        );
        const ownerId = regions.length;
        regions.push({
          typeRecord,
          params: normalizeNumericStrings(
            primitive.params,
            `primitives[${primitiveIndex}].params`
          ),
          stepSize: normalizeNumericString(
            primitive.stepSize,
            `primitives[${primitiveIndex}].stepSize`
          ),
          partialReflect: primitive.partialReflect
        });
        for (const prepared of preparedCurves) {
          appendProcessedCurve(
            prepared,
            'region',
            ownerId,
            true,
            undefined,
            undefined
          );
        }
        break;
      }

      case 'detector': {
        const prepared = preparePrimitiveCurve(
          primitive.curve,
          `primitives[${primitiveIndex}].curve`
        );
        if (!prepared) break;
        validateDetectorTypeContract(
          primitive.detectorType,
          primitiveIndex
        );
        const typeRecord = registries.detectors.register(
          primitive.detectorType
        );
        const resultSize = normalizeNumericString(
          primitive.resultSize,
          `primitives[${primitiveIndex}].resultSize`
        );
        let resultRange = detectorResults.get(primitive.result);
        if (resultRange) {
          if (resultRange.resultSize !== resultSize) {
            throw new RangeError(
              `primitives[${primitiveIndex}].resultSize does not match the other primitives using the same result holder.`
            );
          }
        } else {
          resultRange = {
            resultId: detectorResultBindings.length,
            resultSize
          };
          detectorResults.set(primitive.result, resultRange);
          detectorResultBindings.push({
            resultId: resultRange.resultId,
            result: primitive.result,
            resultSize: resultRange.resultSize
          });
        }

        const ownerId = detectors.length;
        detectors.push({
          typeRecord,
          params: normalizeNumericStrings(
            primitive.params,
            `primitives[${primitiveIndex}].params`
          ),
          ...resultRange
        });
        appendProcessedCurve(
          prepared,
          'detector',
          ownerId,
          false,
          primitive.twoSided,
          undefined
        );
        break;
      }

      default:
        throw new TypeError(
          `Unsupported primitive kind at primitives[${primitiveIndex}]: ${JSON.stringify(primitive.kind)}`
      );
    }
  }
  timing?.recordStage('normalizePrimitives');

  const finalizedTypes = {
    sources: registries.sources.finalize(),
    surfaces: registries.surfaces.finalize(),
    bulks: registries.bulks.finalize(),
    detectors: registries.detectors.finalize()
  };
  const processedSources = sources.map(({ typeRecord, ...source }) => ({
    sourceTypeId: typeRecord.id,
    ...source
  }));
  const processedSurfaces = surfaces.map(({ typeRecord, ...surface }) => ({
    surfaceTypeId: typeRecord.id,
    ...surface
  }));
  const processedRegions = regions.map(({ typeRecord, ...region }) => ({
    bulkTypeId: typeRecord.id,
    ...region
  }));
  const processedDetectors = detectors.map(({ typeRecord, ...detector }) => ({
    detectorTypeId: typeRecord.id,
    ...detector
  }));
  timing?.recordStage('finalizeTypeTables');

  const builtBvh = buildBvh(
    curves.map((curveRecord, curveId) => ({
      geometry: curveRecord.geometry,
      bounds: curveBounds[curveId],
      curveId,
      ownerKind: curveRecord.ownerKind
    })),
    bvhOptions
  );
  const bvh = {
    root: builtBvh.root,
    nodes: builtBvh.nodes,
    curveIds: Uint32Array.from(builtBvh.entries.map(entry => entry.curveId))
  };
  timing?.recordStage('buildBvh');

  const typeSignatureSource = stableSerialize([
    registries.sources.signaturePart,
    registries.surfaces.signaturePart,
    registries.bulks.signaturePart,
    registries.detectors.signaturePart
  ]);

  const result = {
    processedScene: {
      numericEpsilon,
      numericalTolerances: resolvedNumericalTolerances,
      typeSignature: hashCanonicalString(typeSignatureSource),
      types: finalizedTypes,
      sources: processedSources,
      surfaces: processedSurfaces,
      regions: processedRegions,
      detectors: processedDetectors,
      curves,
      bvh
    },
    detectorResultBindings
  };
  timing?.recordStage('assembleProcessedScene');
  result.timings = timing?.finish() ?? null;
  return result;
}

/**
 * Convert numeric strings left by older scene data without mutating primitive
 * objects. Primitive parameter contracts contain only numbers, including the
 * nested point objects used by curve geometry.
 */
function normalizeNumericStrings(value, path) {
  if (typeof value === 'string') {
    return normalizeNumericString(value, path);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  let normalized = value;
  const keys = Object.keys(value);
  for (const key of keys) {
    const child = normalizeNumericStrings(
      value[key],
      Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`
    );
    if (Object.is(child, value[key])) continue;
    if (normalized === value) {
      normalized = Array.isArray(value) ? [...value] : { ...value };
    }
    normalized[key] = child;
  }
  return normalized;
}

function normalizeNumericString(value, path) {
  if (typeof value !== 'string') return value;
  if (value.trim() === '') {
    throw new TypeError(`${path} must be numeric, but received an empty string.`);
  }
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    throw new TypeError(`${path} must be numeric, but received ${JSON.stringify(value)}.`);
  }
  return numericValue;
}

function normalizePrimitiveCurve(curve, path) {
  const params = normalizeNumericStrings(curve.params, `${path}.params`);
  return params === curve.params ? curve : { ...curve, params };
}

function validateDetectorTypeContract(detectorType, primitiveIndex) {
  const forbidden = new Set(['n_0', 'n_1']);
  const declaredNames = detectorType?.paramNames ?? [];
  const referencedNames = collectParameterNames(detectorType?.dag);
  for (const name of forbidden) {
    if (declaredNames.includes(name) || referencedNames.has(name)) {
      throw new TypeError(
        `primitives[${primitiveIndex}].detectorType must not declare or reference ${JSON.stringify(name)}.`
      );
    }
  }
}

function resolveToleranceMinimum(value, scale, name) {
  const resolvedValue = value ?? 0;
  if (!Number.isFinite(resolvedValue) || resolvedValue < 0) {
    throw new RangeError(
      `numericalTolerances.${name} must be a finite nonnegative number.`
    );
  }
  return resolvedValue * scale;
}

/**
 * Build the compact diagnostic summary logged after primitive preprocessing.
 *
 * @param {ProcessedScene} processedScene - The newly processed scene.
 * @param {ProcessedScene|null} [previousProcessedScene=null] - The preceding processed scene.
 * @returns {Object} BVH statistics and registered-type usage.
 */
export function createPreprocessingSummary(
  processedScene,
  previousProcessedScene = null
) {
  const nodes = processedScene.bvh.nodes;
  const leafCount = nodes.reduce(
    (count, node) => count + (node.count > 0 ? 1 : 0),
    0
  );
  const maxDepth = nodes.reduce(
    (depth, node) => Math.max(depth, node.depth),
    0
  );

  return {
    bvh: {
      curveCount: processedScene.curves.length,
      nodeCount: nodes.length,
      branchCount: nodes.length - leafCount,
      leafCount,
      maxDepth
    },
    types: {
      changed: previousProcessedScene
        ? processedScene.typeSignature !== previousProcessedScene.typeSignature
        : null,
      sources: summarizeTypeCategory(
        processedScene.types.sources,
        processedScene.sources,
        'sourceTypeId',
        previousProcessedScene?.types.sources
      ),
      surfaces: summarizeTypeCategory(
        processedScene.types.surfaces,
        processedScene.surfaces,
        'surfaceTypeId',
        previousProcessedScene?.types.surfaces
      ),
      bulks: summarizeTypeCategory(
        processedScene.types.bulks,
        processedScene.regions,
        'bulkTypeId',
        previousProcessedScene?.types.bulks
      ),
      detectors: summarizeTypeCategory(
        processedScene.types.detectors,
        processedScene.detectors,
        'detectorTypeId',
        previousProcessedScene?.types.detectors
      )
    }
  };
}

class TypeRegistry {
  constructor() {
    this.identityRecords = new WeakMap();
    this.hashBuckets = new Map();
    this.records = [];
    this.signaturePart = '';
  }

  register(definition) {
    const identityRecord = this.identityRecords.get(definition);
    if (identityRecord) return identityRecord;

    const canonicalDefinition = clonePlainData(definition);
    const canonicalKey = stableSerialize(canonicalDefinition);
    const hash = hashCanonicalString(canonicalKey);
    const bucket = this.hashBuckets.get(hash) || [];
    let record = bucket.find(candidate => candidate.canonicalKey === canonicalKey);
    if (!record) {
      record = {
        hash,
        canonicalKey,
        definition: deepFreeze(canonicalDefinition),
        id: -1
      };
      bucket.push(record);
      this.hashBuckets.set(hash, bucket);
      this.records.push(record);
    }
    this.identityRecords.set(definition, record);
    return record;
  }

  finalize() {
    this.records.sort((a, b) =>
      a.hash.localeCompare(b.hash) || a.canonicalKey.localeCompare(b.canonicalKey)
    );
    this.records.forEach((record, id) => {
      record.id = id;
    });
    this.signaturePart = stableSerialize(
      this.records.map(record => [record.hash, record.canonicalKey])
    );
    return this.records.map(record => ({
      hash: record.hash,
      definition: record.definition
    }));
  }
}

function summarizeTypeCategory(types, instances, typeIdKey, previousTypes) {
  const objectCounts = new Array(types.length).fill(0);
  for (const instance of instances) {
    objectCounts[instance[typeIdKey]]++;
  }

  return {
    changed: previousTypes
      ? stableSerialize(types) !== stableSerialize(previousTypes)
      : null,
    registered: types.map((type, id) => ({
      id,
      name: type.definition.name,
      objectCount: objectCounts[id]
    }))
  };
}

function createProcessedCurve(
  geometry,
  bounds,
  ownerKind,
  ownerId,
  mergesWithBoundary,
  twoSided,
  filter
) {
  const processedCurve = {
    geometry,
    bounds,
    ownerKind,
    ownerId,
    mergesWithBoundary
  };
  if (ownerKind !== 'region') {
    processedCurve.twoSided = twoSided;
  }
  if (filter !== undefined && filter !== null) {
    processedCurve.filter = filter;
  }
  return processedCurve;
}

function clonePlainData(value) {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    typeof value === 'undefined'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(clonePlainData);
  }

  const clone = {};
  for (const key of Object.keys(value)) {
    clone[key] = clonePlainData(value[key]);
  }
  return clone;
}

function stableSerialize(value) {
  if (value === undefined) return 'u';
  if (value === null) return 'n';
  if (typeof value === 'boolean') return value ? 'b1' : 'b0';
  if (typeof value === 'string') return `s${JSON.stringify(value)}`;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'dNaN';
    if (value === Infinity) return 'dInfinity';
    if (value === -Infinity) return 'd-Infinity';
    if (Object.is(value, -0)) return 'd-0';
    return `d${String(value)}`;
  }
  if (Array.isArray(value)) {
    return `a[${value.map(stableSerialize).join(',')}]`;
  }
  return `o{${Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
    .join(',')}}`;
}

function hashCanonicalString(value) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return (
    (first >>> 0).toString(16).padStart(8, '0') +
    (second >>> 0).toString(16).padStart(8, '0')
  );
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return value;
}

function createTimingRecorder() {
  const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? () => performance.now()
    : () => Date.now();
  let stageStartTime = now();
  const stages = {};

  return {
    recordStage(stageName) {
      const endTime = now();
      stages[stageName] = endTime - stageStartTime;
      stageStartTime = endTime;
    },

    finish() {
      return {
        ...stages,
        total: Object.values(stages).reduce(
          (sum, duration) => sum + duration,
          0
        )
      };
    }
  };
}
