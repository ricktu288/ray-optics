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
 * @property {PrimitiveCurve} curve - The engine-independent curve geometry.
 * @property {'surface'|'region'|'detector'} ownerKind - Owner table kind.
 * @property {number} ownerId - Index into the matching owner table.
 * @property {boolean} [twoSided] - Whether both oriented sides participate.
 * @property {WavelengthFilter} [filter] - Optional pre-intersection wavelength filter.
 */

/**
 * The BVH node array uses child node indices for branches. A leaf has
 * `count > 0`; its `[start, start + count)` range indexes `curveIds`, whose
 * values index the stable `curves` table. The BVH may therefore reorder curves
 * without changing curve or owner IDs.
 *
 * @typedef {Object} ProcessedBvh
 * @property {number} root - Root node index, or -1 for an empty tree.
 * @property {Array<Object>} nodes - BVH branch and leaf nodes.
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
 *
 * @param {Primitive[]} primitives - Primitives collected in scene order.
 * @param {Object} [options]
 * @param {Object} [options.bvhOptions] - Options forwarded to {@link buildBvh}.
 * @param {boolean} [options.debug=false] - Whether to log stage timings.
 * @returns {{processedScene: ProcessedScene, detectorResultBindings: DetectorResultBinding[]}}
 */
export function preprocessPrimitives(primitives, {
  bvhOptions = {},
  debug = false
} = {}) {
  if (!Array.isArray(primitives)) {
    throw new TypeError('primitives must be an array.');
  }

  const timing = debug ? createTimingLogger() : null;
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
  const detectorResults = new Map();
  const detectorResultBindings = [];

  for (let primitiveIndex = 0; primitiveIndex < primitives.length; primitiveIndex++) {
    const primitive = primitives[primitiveIndex];

    switch (primitive.kind) {
      case 'source': {
        const typeRecord = registries.sources.register(
          primitive.sourceType
        );
        sources.push({
          typeRecord,
          params: primitive.params,
          rayCount: primitive.rayCount
        });
        break;
      }

      case 'surface': {
        const typeRecord = registries.surfaces.register(
          primitive.surfaceType
        );
        const ownerId = surfaces.length;
        surfaces.push({
          typeRecord,
          params: primitive.params
        });
        curves.push(createProcessedCurve(
          primitive.curve,
          'surface',
          ownerId,
          primitive.twoSided,
          primitive.filter
        ));
        break;
      }

      case 'region': {
        const typeRecord = registries.bulks.register(
          primitive.bulkType
        );
        const ownerId = regions.length;
        regions.push({
          typeRecord,
          params: primitive.params,
          stepSize: primitive.stepSize,
          partialReflect: primitive.partialReflect
        });
        for (let curveIndex = 0; curveIndex < primitive.curves.length; curveIndex++) {
          curves.push(createProcessedCurve(
            primitive.curves[curveIndex],
            'region',
            ownerId,
            undefined,
            undefined
          ));
        }
        break;
      }

      case 'detector': {
        const typeRecord = registries.detectors.register(
          primitive.detectorType
        );
        let resultRange = detectorResults.get(primitive.result);
        if (resultRange) {
          if (resultRange.resultSize !== primitive.resultSize) {
            throw new RangeError(
              `primitives[${primitiveIndex}].resultSize does not match the other primitives using the same result holder.`
            );
          }
        } else {
          resultRange = {
            resultId: detectorResultBindings.length,
            resultSize: primitive.resultSize
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
          params: primitive.params,
          ...resultRange
        });
        curves.push(createProcessedCurve(
          primitive.curve,
          'detector',
          ownerId,
          primitive.twoSided,
          undefined
        ));
        break;
      }

      default:
        throw new TypeError(
          `Unsupported primitive kind at primitives[${primitiveIndex}]: ${JSON.stringify(primitive.kind)}`
      );
    }
  }
  timing?.logStage('normalize primitives');

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
  timing?.logStage('finalize type tables');

  const builtBvh = buildBvh(
    curves.map((curveRecord, curveId) => ({
      curve: curveRecord.curve,
      curveId
    })),
    bvhOptions
  );
  const bvh = {
    root: builtBvh.root,
    nodes: builtBvh.nodes,
    curveIds: Uint32Array.from(builtBvh.entries.map(entry => entry.curveId))
  };
  timing?.logStage('build BVH');

  const typeSignatureSource = stableSerialize([
    registries.sources.signaturePart,
    registries.surfaces.signaturePart,
    registries.bulks.signaturePart,
    registries.detectors.signaturePart
  ]);

  const result = {
    processedScene: {
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
  timing?.logStage('assemble processed scene');
  timing?.logTotal();
  return result;
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

function createProcessedCurve(curve, ownerKind, ownerId, twoSided, filter) {
  const processedCurve = {
    curve,
    ownerKind,
    ownerId
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

function createTimingLogger() {
  const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? () => performance.now()
    : () => Date.now();
  const startTime = now();
  let stageStartTime = startTime;
  let measuredTime = 0;

  return {
    logStage(stageName) {
      const endTime = now();
      const stageTime = endTime - stageStartTime;
      measuredTime += stageTime;
      console.log(
        `[Primitive preprocessing] ${stageName}: ${stageTime.toFixed(3)} ms`
      );
      stageStartTime = now();
    },

    logTotal() {
      console.log(
        `[Primitive preprocessing] total: ${measuredTime.toFixed(3)} ms`
      );
    }
  };
}
