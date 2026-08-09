import os from 'node:os';
import { performance } from 'node:perf_hooks';

const GRID_SIDE = readIntegerArgument('grid', 128, 16, 512, true);
const LEAF_SIZE = 4;
const RAY_COUNT = readIntegerArgument('rays', 131072, 1024, 1048576);
const SAMPLE_COUNT = readIntegerArgument('samples', 7, 3, 21);
const WARMUP_COUNT = readIntegerArgument('warmups', 2, 1, 10);
const INVALID_HIT = 0xffffffff;
const LEAF_REF_BIT = 0x80000000;
const LEAF_START_MASK = 0x00ffffff;

function readIntegerArgument(name, fallback, minimum, maximum, powerOfTwo = false) {
  const prefix = `--${name}=`;
  const text = process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length);
  const value = text === undefined ? fallback : Number(text);
  if (!Number.isInteger(value) || value < minimum || value > maximum ||
      (powerOfTwo && (value & (value - 1)) !== 0)) {
    throw new RangeError(
      `${name} must be an integer from ${minimum} to ${maximum}` +
      (powerOfTwo ? ' and a power of two.' : '.')
    );
  }
  return value;
}

function buildScene(side, leafSize) {
  const nodes = [];
  const primitives = [];
  let maximumDepth = 0;
  const boxScale = 0.55;

  function primitiveBounds(x, y) {
    const margin = (1 - boxScale) * 0.5;
    return {
      minX: (x + margin) / side,
      minY: (y + margin) / side,
      maxX: (x + 1 - margin) / side,
      maxY: (y + 1 - margin) / side
    };
  }

  function build(x0, x1, y0, y1, depth) {
    maximumDepth = Math.max(maximumDepth, depth);
    const count = (x1 - x0) * (y1 - y0);
    if (count <= leafSize) {
      const start = primitives.length;
      let bounds = null;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const primitive = primitiveBounds(x, y);
          primitives.push(primitive);
          bounds = bounds ? combineBounds(bounds, primitive) : primitive;
        }
      }
      const index = nodes.length;
      nodes.push({ bounds, leaf: true, first: start, second: count });
      return index;
    }

    let left;
    let right;
    if (x1 - x0 >= y1 - y0) {
      const middle = x0 + Math.floor((x1 - x0) / 2);
      left = build(x0, middle, y0, y1, depth + 1);
      right = build(middle, x1, y0, y1, depth + 1);
    } else {
      const middle = y0 + Math.floor((y1 - y0) / 2);
      left = build(x0, x1, y0, middle, depth + 1);
      right = build(x0, x1, middle, y1, depth + 1);
    }
    const index = nodes.length;
    nodes.push({
      bounds: combineBounds(nodes[left].bounds, nodes[right].bounds),
      leaf: false,
      first: left,
      second: right
    });
    return index;
  }

  const root = build(0, side, 0, side, 0);
  return { nodes, primitives, root, maximumDepth };
}

function buildWideBvh(binaryNodes, binaryRoot, maximumChildren) {
  const nodes = [];
  let maximumDepth = 0;

  function convert(binaryIndex, depth) {
    maximumDepth = Math.max(maximumDepth, depth);
    const root = binaryNodes[binaryIndex];
    const frontier = [root.first, root.second];
    while (frontier.length < maximumChildren) {
      let expandAt = -1;
      let largestArea = -1;
      for (let position = 0; position < frontier.length; position++) {
        const candidate = binaryNodes[frontier[position]];
        if (candidate.leaf) continue;
        const area = (candidate.bounds.maxX - candidate.bounds.minX) *
          (candidate.bounds.maxY - candidate.bounds.minY);
        if (area > largestArea) {
          largestArea = area;
          expandAt = position;
        }
      }
      if (expandAt < 0) break;
      const expanded = binaryNodes[frontier[expandAt]];
      frontier.splice(expandAt, 1, expanded.first, expanded.second);
    }

    const children = frontier.map(index => {
      const child = binaryNodes[index];
      if (!child.leaf) {
        return { bounds: child.bounds, ref: convert(index, depth + 1) };
      }
      if (child.first > LEAF_START_MASK || child.second > 0x7f) {
        throw new RangeError('Leaf reference exceeds the benchmark encoding.');
      }
      return {
        bounds: child.bounds,
        ref: (LEAF_REF_BIT | child.second << 24 | child.first) >>> 0
      };
    });
    const index = nodes.length;
    nodes.push({ children });
    return index;
  }

  return { nodes, root: convert(binaryRoot, 0), maximumDepth };
}

function combineBounds(a, b) {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  };
}

function createCoherentRays(count) {
  const rays = new Float64Array(count * 4);
  for (let index = 0; index < count; index++) {
    const group = Math.floor(index / 64);
    const lane = index % 64;
    const baseY = (hash32(group + 1) + 0.5) / 4294967296;
    const jitter = (lane - 31.5) * 0.0000025;
    rays[index * 4] = -0.25;
    rays[index * 4 + 1] = Math.max(0.0001, Math.min(0.9999, baseY + jitter));
    rays[index * 4 + 2] = 1;
    rays[index * 4 + 3] = (lane - 31.5) * 0.000004;
  }
  return rays;
}

function createIncoherentRays(count) {
  const rays = new Float64Array(count * 4);
  for (let index = 0; index < count; index++) {
    const angle = random01(index * 4 + 1) * Math.PI * 2;
    const originX = 0.5 + Math.cos(angle) * 1.1;
    const originY = 0.5 + Math.sin(angle) * 1.1;
    const targetX = random01(index * 4 + 2);
    const targetY = random01(index * 4 + 3);
    const directionX = targetX - originX;
    const directionY = targetY - originY;
    const inverseLength = 1 / Math.hypot(directionX, directionY);
    rays[index * 4] = originX;
    rays[index * 4 + 1] = originY;
    rays[index * 4 + 2] = directionX * inverseLength;
    rays[index * 4 + 3] = directionY * inverseLength;
  }
  return rays;
}

function random01(seed) {
  return (hash32(seed) + 0.5) / 4294967296;
}

function hash32(value) {
  value = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  return (value ^ value >>> 16) >>> 0;
}

function boundsNear(originX, originY, directionX, directionY, bounds) {
  let near = -Infinity;
  let far = Infinity;
  if (directionX === 0) {
    if (originX < bounds.minX || originX > bounds.maxX) return Infinity;
  } else {
    const inverseDirection = 1 / directionX;
    const first = (bounds.minX - originX) * inverseDirection;
    const second = (bounds.maxX - originX) * inverseDirection;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (near > far) return Infinity;
  }
  if (directionY === 0) {
    if (originY < bounds.minY || originY > bounds.maxY) return Infinity;
  } else {
    const inverseDirection = 1 / directionY;
    const first = (bounds.minY - originY) * inverseDirection;
    const second = (bounds.maxY - originY) * inverseDirection;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
  }
  return near <= far && far > 0 ? Math.max(near, 0) : Infinity;
}

function traceBvh2(scene, rays, hits, distances) {
  const { nodes, primitives, root } = scene;
  const stackRefs = [];
  const stackNear = [];
  let boxTests = 0;
  for (let rayIndex = 0; rayIndex < hits.length; rayIndex++) {
    const rayOffset = rayIndex * 4;
    const originX = rays[rayOffset];
    const originY = rays[rayOffset + 1];
    const directionX = rays[rayOffset + 2];
    const directionY = rays[rayOffset + 3];
    let bestHit = INVALID_HIT;
    let bestDistance = Infinity;
    let stackCount = 0;
    const rootNear = boundsNear(
      originX, originY, directionX, directionY, nodes[root].bounds
    );
    boxTests++;
    if (Number.isFinite(rootNear)) {
      stackRefs[0] = root;
      stackNear[0] = rootNear;
      stackCount = 1;
    }
    while (stackCount > 0) {
      stackCount--;
      const near = stackNear[stackCount];
      if (near > bestDistance) continue;
      const node = nodes[stackRefs[stackCount]];
      if (node.leaf) {
        for (let offset = 0; offset < node.second; offset++) {
          const primitiveIndex = node.first + offset;
          const primitiveNear = boundsNear(
            originX, originY, directionX, directionY,
            primitives[primitiveIndex]
          );
          boxTests++;
          if (primitiveNear < bestDistance) {
            bestDistance = primitiveNear;
            bestHit = primitiveIndex;
          }
        }
        continue;
      }
      const leftNear = boundsNear(
        originX, originY, directionX, directionY,
        nodes[node.first].bounds
      );
      const rightNear = boundsNear(
        originX, originY, directionX, directionY,
        nodes[node.second].bounds
      );
      boxTests += 2;
      const hitLeft = Number.isFinite(leftNear) && leftNear <= bestDistance;
      const hitRight = Number.isFinite(rightNear) && rightNear <= bestDistance;
      if (hitLeft && hitRight) {
        if (leftNear <= rightNear) {
          stackRefs[stackCount] = node.second;
          stackNear[stackCount++] = rightNear;
          stackRefs[stackCount] = node.first;
          stackNear[stackCount++] = leftNear;
        } else {
          stackRefs[stackCount] = node.first;
          stackNear[stackCount++] = leftNear;
          stackRefs[stackCount] = node.second;
          stackNear[stackCount++] = rightNear;
        }
      } else if (hitLeft) {
        stackRefs[stackCount] = node.first;
        stackNear[stackCount++] = leftNear;
      } else if (hitRight) {
        stackRefs[stackCount] = node.second;
        stackNear[stackCount++] = rightNear;
      }
    }
    hits[rayIndex] = bestHit;
    distances[rayIndex] = bestDistance;
  }
  return boxTests;
}

function createWideTracer(width) {
  return function traceWide(layout, primitives, rays, hits, distances) {
    const { nodes, root } = layout;
    const stackRefs = [];
    const stackNear = [];
    const orderedRefs = new Array(width);
    const orderedNear = new Array(width);
    let boxTests = 0;
    for (let rayIndex = 0; rayIndex < hits.length; rayIndex++) {
      const rayOffset = rayIndex * 4;
      const originX = rays[rayOffset];
      const originY = rays[rayOffset + 1];
      const directionX = rays[rayOffset + 2];
      const directionY = rays[rayOffset + 3];
      let bestHit = INVALID_HIT;
      let bestDistance = Infinity;
      let stackCount = 1;
      stackRefs[0] = root;
      stackNear[0] = 0;
      while (stackCount > 0) {
        stackCount--;
        if (stackNear[stackCount] > bestDistance) continue;
        const reference = stackRefs[stackCount];
        if ((reference & LEAF_REF_BIT) !== 0) {
          const start = reference & LEAF_START_MASK;
          const count = reference >>> 24 & 0x7f;
          for (let offset = 0; offset < count; offset++) {
            const primitiveIndex = start + offset;
            const primitiveNear = boundsNear(
              originX, originY, directionX, directionY,
              primitives[primitiveIndex]
            );
            boxTests++;
            if (primitiveNear < bestDistance) {
              bestDistance = primitiveNear;
              bestHit = primitiveIndex;
            }
          }
          continue;
        }

        const children = nodes[reference].children;
        let orderedCount = 0;
        for (let childIndex = 0; childIndex < children.length; childIndex++) {
          const child = children[childIndex];
          const childNear = boundsNear(
            originX, originY, directionX, directionY, child.bounds
          );
          boxTests++;
          if (!Number.isFinite(childNear) || childNear > bestDistance) continue;
          let position = orderedCount;
          while (position > 0 && orderedNear[position - 1] < childNear) {
            orderedNear[position] = orderedNear[position - 1];
            orderedRefs[position] = orderedRefs[position - 1];
            position--;
          }
          orderedNear[position] = childNear;
          orderedRefs[position] = child.ref;
          orderedCount++;
        }
        for (let childIndex = 0; childIndex < orderedCount; childIndex++) {
          stackRefs[stackCount] = orderedRefs[childIndex];
          stackNear[stackCount] = orderedNear[childIndex];
          stackCount++;
        }
      }
      hits[rayIndex] = bestHit;
      distances[rayIndex] = bestDistance;
    }
    return boxTests;
  };
}

function summarizeOutput(hits, distances, boxTests, baseline) {
  let checksum = 2166136261;
  let hitMismatchCount = 0;
  let distanceMismatchCount = 0;
  const distanceWords = new BigUint64Array(distances.buffer);
  for (let index = 0; index < hits.length; index++) {
    checksum = Math.imul(checksum ^ hits[index], 16777619) >>> 0;
    const distanceWord = distanceWords[index];
    checksum = Math.imul(checksum ^ Number(distanceWord & 0xffffffffn), 16777619) >>> 0;
    checksum = Math.imul(checksum ^ Number(distanceWord >> 32n), 16777619) >>> 0;
    if (baseline && hits[index] !== baseline.hits[index]) hitMismatchCount++;
    if (baseline && distances[index] !== baseline.distances[index]) {
      distanceMismatchCount++;
    }
  }
  return {
    checksum: checksum.toString(16).padStart(8, '0'),
    averageBoxTests: boxTests / hits.length,
    hitMismatchCount,
    distanceMismatchCount
  };
}

function summarizeTimes(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const medianMs = sorted[Math.floor(sorted.length / 2)];
  return {
    medianMs,
    minimumMs: sorted[0],
    maximumMs: sorted.at(-1),
    samplesMs: sorted,
    millionRaysPerSecond: RAY_COUNT / medianMs / 1000
  };
}

const scene = buildScene(GRID_SIDE, LEAF_SIZE);
const bvh4 = buildWideBvh(scene.nodes, scene.root, 4);
const bvh8 = buildWideBvh(scene.nodes, scene.root, 8);
const layouts = [
  {
    id: 'bvh2_scalar', label: 'BVH2 scalar JS', nodeCount: scene.nodes.length,
    trace: (rays, hits, distances) => traceBvh2(scene, rays, hits, distances)
  },
  {
    id: 'bvh4_scalar', label: 'BVH4 scalar JS', nodeCount: bvh4.nodes.length,
    trace: createWideTracer(4).bind(null, bvh4, scene.primitives)
  },
  {
    id: 'bvh8_scalar', label: 'BVH8 scalar JS', nodeCount: bvh8.nodes.length,
    trace: createWideTracer(8).bind(null, bvh8, scene.primitives)
  }
];
const rayCases = [
  { id: 'coherent', rays: createCoherentRays(RAY_COUNT) },
  { id: 'incoherent', rays: createIncoherentRays(RAY_COUNT) }
];
const validation = {};
const results = {};
let sink = 0;

console.error(
  `CPU BVH benchmark: ${scene.primitives.length} primitives, ` +
  `${RAY_COUNT} rays/case, ${SAMPLE_COUNT} samples`
);

for (const rayCase of rayCases) {
  validation[rayCase.id] = {};
  results[rayCase.id] = {};
  let baseline = null;
  for (const layout of layouts) {
    const hits = new Uint32Array(RAY_COUNT);
    const distances = new Float64Array(RAY_COUNT);
    const boxTests = layout.trace(rayCase.rays, hits, distances);
    const summary = summarizeOutput(hits, distances, boxTests, baseline);
    validation[rayCase.id][layout.id] = summary;
    if (!baseline) baseline = { hits: hits.slice(), distances: distances.slice() };
    if (summary.hitMismatchCount || summary.distanceMismatchCount) {
      throw new Error(`${rayCase.id}/${layout.id} failed validation.`);
    }
  }

  for (let warmup = 0; warmup < WARMUP_COUNT; warmup++) {
    for (const layout of layouts) {
      const hits = new Uint32Array(RAY_COUNT);
      const distances = new Float64Array(RAY_COUNT);
      sink ^= layout.trace(rayCase.rays, hits, distances);
      sink ^= hits[warmup % hits.length];
    }
  }

  const samples = Object.fromEntries(layouts.map(layout => [layout.id, []]));
  for (let sample = 0; sample < SAMPLE_COUNT; sample++) {
    globalThis.gc?.();
    const offset = sample % layouts.length;
    const ordered = [...layouts.slice(offset), ...layouts.slice(0, offset)];
    for (const layout of ordered) {
      const hits = new Uint32Array(RAY_COUNT);
      const distances = new Float64Array(RAY_COUNT);
      const start = performance.now();
      const boxTests = layout.trace(rayCase.rays, hits, distances);
      const elapsed = performance.now() - start;
      samples[layout.id].push(elapsed);
      sink ^= boxTests;
      sink ^= hits[sample % hits.length];
    }
    console.error(`${rayCase.id}: sample ${sample + 1}/${SAMPLE_COUNT}`);
  }
  const baselineMs = summarizeTimes(samples.bvh2_scalar).medianMs;
  for (const layout of layouts) {
    const timing = summarizeTimes(samples[layout.id]);
    results[rayCase.id][layout.id] = {
      ...timing,
      averageBoxTests: validation[rayCase.id][layout.id].averageBoxTests,
      speedupVsBvh2: baselineMs / timing.medianMs
    };
  }
}

const cpu = os.cpus()[0];
const report = {
  benchmark: 'node-cpu-bvh-width-v1',
  generatedAt: new Date().toISOString(),
  runtime: {
    node: process.version,
    v8: process.versions.v8,
    platform: process.platform,
    architecture: process.arch,
    cpu: cpu?.model ?? null
  },
  config: {
    gridSide: GRID_SIDE,
    primitiveCount: scene.primitives.length,
    leafSize: LEAF_SIZE,
    rayCount: RAY_COUNT,
    sampleCount: SAMPLE_COUNT,
    warmupCount: WARMUP_COUNT
  },
  layouts: Object.fromEntries(layouts.map(layout => [layout.id, {
    label: layout.label,
    nodeCount: layout.nodeCount
  }])),
  validation,
  results,
  scope: 'Synthetic scalar JavaScript AABB traversal with object nodes; excludes curve intersection and formula evaluation.'
};

if (sink === 0x12345678) console.error('benchmark sink', sink);
console.log(JSON.stringify(report, null, 2));
