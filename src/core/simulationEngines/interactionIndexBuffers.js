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

const GRIN_STEP_TYPE_INDEX = 0;
const REGION_BOUNDARY_TYPE_INDEX = 1;
const FRESNEL_REGION_BOUNDARY_TYPE_INDEX = 2;
const FIXED_TYPE_COUNT = 3;

/**
 * Build the interaction-type metadata once for a prepared scene. The layout
 * remains unchanged between ping-pong iterations.
 *
 * @param {Object} description
 * @returns {Object}
 */
export function createInteractionTypeLayout(description) {
  const types = [
    createType('grinStep', -1, false, 'GRIN step', 1),
    createType(
      'regionBoundary',
      -1,
      false,
      'Region boundary without Fresnel reflection',
      1
    ),
    createType(
      'regionBoundary',
      -1,
      true,
      'Region boundary with Fresnel reflection',
      2
    )
  ];
  for (let typeId = 0;
    typeId < description.types.surfaces.length;
    typeId++) {
    const definition =
      description.types.surfaces[typeId].definition;
    types.push(createType(
      'surface',
      typeId,
      false,
      definition.name,
      definition.outRayCount
    ));
  }
  const detectorTypeOffset = types.length;
  for (let typeId = 0;
    typeId < description.types.detectors.length;
    typeId++) {
    const definition =
      description.types.detectors[typeId].definition;
    // A detector records its result and lets the incident ray continue.
    types.push(createType(
      'detector',
      typeId,
      false,
      definition.name,
      1
    ));
  }
  return {
    types,
    surfaceTypeOffset: FIXED_TYPE_COUNT,
    detectorTypeOffset
  };
}

/**
 * Create the mutable per-iteration buffers for a fixed type layout.
 *
 * @param {Object} layout
 * @returns {Object[]}
 */
export function createInteractionIndexBuffers(layout) {
  return layout.types.map(type => ({
    ...type,
    interactionCount: 0,
    sourceRayIndices: new Uint32Array(0),
    destinationRayStarts: new Uint32Array(type.outRayCount)
  }));
}

/**
 * Reset mutable counts and arrays without rebuilding the fixed type metadata.
 *
 * @param {Object[]} buffers
 */
export function resetInteractionIndexBuffers(buffers) {
  for (const buffer of buffers) {
    buffer.interactionCount = 0;
    buffer.sourceRayIndices = new Uint32Array(0);
    buffer.destinationRayStarts =
      new Uint32Array(buffer.outRayCount);
  }
}

/**
 * Return the fixed interaction-type index for one source-ray hit, or -1 when
 * the ray is discarded or escapes to infinity.
 *
 * @param {Object} description
 * @param {Object} layout
 * @param {Object} hit
 * @returns {number}
 */
export function getInteractionTypeIndex(description, layout, hit) {
  if (hit.curveId === -1) {
    return Number.isFinite(hit.s) && hit.s > 0
      ? GRIN_STEP_TYPE_INDEX
      : -1;
  }
  if (hit.curveId < 0) return -1;

  const curve = description.curves[hit.curveId];
  switch (curve.ownerKind) {
    case 'surface':
      return layout.surfaceTypeOffset +
        description.surfaces[curve.ownerId].surfaceTypeId;
    case 'detector':
      return layout.detectorTypeOffset +
        description.detectors[curve.ownerId].detectorTypeId;
    case 'region':
      return hasFresnelReflection(description, hit)
        ? FRESNEL_REGION_BOUNDARY_TYPE_INDEX
        : REGION_BOUNDARY_TYPE_INDEX;
    default:
      throw new TypeError(
        `Unsupported curve owner kind: ${JSON.stringify(curve.ownerKind)}`
      );
  }
}

/**
 * Allocate exact-sized source-index buffers and their slot-major destination
 * ranges after the counting pass.
 *
 * @param {Object[]} buffers
 * @returns {number} Total number of slots required in the destination buffer.
 */
export function allocateInteractionIndexBuffers(buffers) {
  let destinationRayCount = 0;
  for (const buffer of buffers) {
    buffer.sourceRayIndices =
      new Uint32Array(buffer.interactionCount);
    buffer.destinationRayStarts =
      new Uint32Array(buffer.outRayCount);
    for (let outRayIndex = 0;
      outRayIndex < buffer.outRayCount;
      outRayIndex++) {
      buffer.destinationRayStarts[outRayIndex] =
        destinationRayCount;
      destinationRayCount += buffer.interactionCount;
    }
  }
  return destinationRayCount;
}

function createType(
  kind,
  typeId,
  fresnel,
  name,
  outRayCount
) {
  return {
    kind,
    typeId,
    fresnel,
    name,
    outRayCount
  };
}

function hasFresnelReflection(description, hit) {
  for (let regionId = 0;
    regionId < hit.regionCrossingMask.length;
    regionId++) {
    if (
      hit.regionCrossingMask[regionId] &&
      description.regions[regionId].partialReflect
    ) {
      return true;
    }
  }
  return false;
}
