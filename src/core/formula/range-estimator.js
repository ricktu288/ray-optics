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

import { collectParameterNames, validateDagShape } from "./dag-util.js";

export const F32_MAX = 3.4028234663852886e38;
const F32_INT_EXACT_MAX = 16777216;
const PI = Math.PI;
const TWO_PI = Math.PI * 2;
const F32 = new Float32Array(1);
const U32 = new Uint32Array(F32.buffer);

/**
 * Estimate finite f32 value ranges for every DAG node.
 *
 * Parameter ranges are closed interval unions:
 *
 * ```js
 * estimateDagRanges(dag, { x: [[-1, 1]], i: [[0, 10], [20, 30]] })
 * ```
 *
 * Returned intervals are disjoint, sorted, finite, and clamped to f32 range.
 * `maybeInvalid` means the node may evaluate to the runtime invalid state for
 * some allowed input.
 */
export function estimateDagRanges(dag, parameterRanges = {}) {
  validateDagShape(dag);
  const parameters = collectParameterNames(dag);
  const rangesByName = new Map();
  for (const name of parameters) {
    rangesByName.set(name, normalizeInputRange(parameterRanges[name], name));
  }

  const nodeRanges = [];
  for (const node of dag.nodes) {
    nodeRanges[node.id] = estimateNode(node, rangesByName, nodeRanges);
  }
  return {
    nodeRanges,
    rangesByName,
  };
}

export function formatRangeInfo(info) {
  const intervals = info.intervals.map(([lo, hi]) => {
    if (Object.is(lo, hi)) return formatNumber(lo);
    return `[${formatNumber(lo)}, ${formatNumber(hi)}]`;
  });
  const text = intervals.length === 0 ? "no finite values" : intervals.join(" U ");
  return info.maybeInvalid ? `${text}; may be invalid` : text;
}

function estimateNode(node, parameters, values) {
  if (node.kind === "number") return finiteLiteral(node.value);
  if (node.kind === "constant") return singleton(node.name === "pi" ? Math.PI : Math.E);
  if (node.kind === "parameter") return cloneInfo(parameters.get(node.name));
  if (node.kind === "unary") return estimateUnary(node.op, values[node.args[0]]);
  if (node.kind === "binary") return estimateBinary(node.op, values[node.args[0]], values[node.args[1]]);
  if (node.kind === "call") return estimateCall(node.name, node.args.map((id) => values[id]));
  throw new TypeError(`Unknown DAG node kind: ${JSON.stringify(node.kind)}`);
}

function estimateUnary(op, arg) {
  if (op === "-") return rounded(mapIntervals(arg, ([lo, hi]) => [-hi, -lo]), "neg");
  throw new TypeError(`Unknown unary operator: ${JSON.stringify(op)}`);
}

function estimateBinary(op, left, right) {
  if (op === "+") return combineBinary(left, right, ([a, b], [c, d]) => [a + c, b + d], "add");
  if (op === "-") return combineBinary(left, right, ([a, b], [c, d]) => [a - d, b - c], "sub");
  if (op === "*") {
    return combineBinary(left, right, ([a, b], [c, d]) => minMax([a * c, a * d, b * c, b * d]), "mul");
  }
  if (op === "/") return estimateDiv(left, right);
  if (op === "^") return estimatePow(left, right);
  throw new TypeError(`Unknown binary operator: ${JSON.stringify(op)}`);
}

function estimateCall(name, args) {
  if (name === "sqrt") return domainUnary(args[0], (x) => x >= 0, ([lo, hi]) => [Math.sqrt(Math.max(0, lo)), Math.sqrt(Math.max(0, hi))], "builtin");
  if (name === "log") return domainUnary(args[0], (x) => x > 0, ([lo, hi]) => [Math.log(Math.max(lo, Number.MIN_VALUE)), Math.log(hi)], "builtin");
  if (name === "exp") return domainUnary(args[0], () => true, ([lo, hi]) => [lo < -104 ? 0 : Math.exp(lo), Math.exp(hi)], "builtin");
  if (name === "sin") return trigRange(args[0], "sin");
  if (name === "cos") return trigRange(args[0], "cos");
  if (name === "tan") return estimateTan(args[0]);
  if (name === "sec") return estimateReciprocal(estimateCall("cos", args));
  if (name === "csc") return estimateReciprocal(estimateCall("sin", args));
  if (name === "cot") return estimateReciprocal(estimateTan(args[0]));
  if (name === "sinh") return monotoneUnary(args[0], Math.sinh, "builtin");
  if (name === "cosh") return estimateCosh(args[0]);
  if (name === "tanh") return monotoneUnary(args[0], Math.tanh, "builtin");
  if (name === "asin") return domainUnary(args[0], (x) => x >= -1 && x <= 1, ([lo, hi]) => [Math.asin(Math.max(-1, lo)), Math.asin(Math.min(1, hi))], "builtin");
  if (name === "acos") return domainUnary(args[0], (x) => x >= -1 && x <= 1, ([lo, hi]) => [Math.acos(Math.min(1, hi)), Math.acos(Math.max(-1, lo))], "builtin");
  if (name === "atan") return monotoneUnary(args[0], Math.atan, "builtin");
  if (name === "atan2") return estimateAtan2(args[0], args[1]);
  if (name === "asinh") return monotoneUnary(args[0], Math.asinh, "builtin");
  if (name === "acosh") return domainUnary(args[0], (x) => x >= 1, ([lo, hi]) => [Math.acosh(Math.max(1, lo)), Math.acosh(hi)], "builtin");
  if (name === "atanh") return domainUnary(args[0], (x) => x > -1 && x < 1, ([lo, hi]) => [Math.atanh(Math.max(nextUp(-1), lo)), Math.atanh(Math.min(nextDown(1), hi))], "builtin");
  if (name === "floor") return mapIntervals(args[0], ([lo, hi]) => [Math.floor(lo), Math.floor(hi)]);
  if (name === "round") return mapIntervals(args[0], ([lo, hi]) => [Math.floor(lo + 0.5), Math.floor(hi + 0.5)]);
  if (name === "ceil") return mapIntervals(args[0], ([lo, hi]) => [Math.ceil(lo), Math.ceil(hi)]);
  if (name === "fix") return mapIntervals(args[0], ([lo, hi]) => [Math.trunc(lo < 0 ? lo : 0), Math.trunc(hi > 0 ? hi : 0)]);
  if (name === "abs") return estimateAbs(args[0]);
  if (name === "sign") return estimateSign(args[0]);
  if (name === "max") return estimateMinMax(args, "max");
  if (name === "min") return estimateMinMax(args, "min");
  if (name === "guardNonzero") return estimateGuard(args[0], args[1], intervalCanBeNonzero, ([lo, hi]) => lo > 0 || hi < 0);
  if (name === "guardNonNegative") return estimateGuard(args[0], args[1], ([, hi]) => hi >= 0, ([lo]) => lo >= 0);
  if (name === "guardNotInteger") return estimateGuard(args[0], args[1], intervalCanBeNonInteger, intervalHasNoIntegers);
  if (name === "guardValid") return args[0].intervals.length === 0 && args[0].maybeInvalid ? invalidOnly() : cloneInfo(args[1], args[0].maybeInvalid || args[1].maybeInvalid);
  if (name === "fallback") return estimateFallback(args[0], args[1]);
  throw new TypeError(`Unknown function: ${JSON.stringify(name)}`);
}

function estimateDiv(left, right) {
  const intervals = [];
  let maybeInvalid = left.maybeInvalid || right.maybeInvalid;
  for (const l of left.intervals) {
    for (const r of right.intervals) {
      if (r[0] <= 0 && r[1] >= 0) maybeInvalid = true;
      for (const piece of splitNonzero(r)) {
        intervals.push(minMax([l[0] / piece[0], l[0] / piece[1], l[1] / piece[0], l[1] / piece[1]]));
      }
    }
  }
  return rounded(makeInfo(intervals, maybeInvalid), "div");
}

function estimatePow(left, right) {
  let maybeInvalid = left.maybeInvalid || right.maybeInvalid;
  const samples = [];
  for (const l of left.intervals) {
    for (const r of right.intervals) {
      if (l[0] < 0 && !intervalAllIntegers(r)) maybeInvalid = true;
      if (l[0] <= 0 && r[0] < 0) maybeInvalid = true;
      for (const x of [l[0], l[1], 0, 1, -1]) {
        if (x < l[0] || x > l[1]) continue;
        for (const y of [r[0], r[1], 0, 1, 2, -1]) {
          if (y < r[0] || y > r[1]) continue;
          const value = Math.pow(x, y);
          if (Number.isFinite(value)) samples.push(value);
        }
      }
    }
  }
  if (samples.length === 0) return invalidOnly();
  return rounded(makeInfo([minMax(samples)], maybeInvalid), "builtin");
}

function estimateGuard(test, value, canPredicate, mustPredicate) {
  const canPass = test.intervals.some(canPredicate);
  const mustPass = test.intervals.length > 0 && !test.maybeInvalid && test.intervals.every(mustPredicate);
  if (!canPass) return invalidOnly();
  return cloneInfo(value, value.maybeInvalid || !mustPass);
}

function estimateFallback(value, fallback) {
  if (!value.maybeInvalid) return cloneInfo(value);
  return makeInfo([...value.intervals, ...fallback.intervals], fallback.maybeInvalid);
}

function estimateMinMax(args, name) {
  let intervals = name === "max" ? [[-F32_MAX, -F32_MAX]] : [[F32_MAX, F32_MAX]];
  let maybeInvalid = false;
  for (const arg of args) {
    const next = [];
    for (const left of intervals) {
      for (const right of arg.intervals) {
        next.push(name === "max"
          ? [Math.max(left[0], right[0]), Math.max(left[1], right[1])]
          : [Math.min(left[0], right[0]), Math.min(left[1], right[1])]);
      }
    }
    intervals = next;
    maybeInvalid ||= arg.maybeInvalid;
  }
  if (intervals.length === 0) return invalidOnly();
  return makeInfo(intervals, maybeInvalid);
}

function monotoneUnary(arg, fn, rounding) {
  return rounded(mapIntervals(arg, ([lo, hi]) => [fn(lo), fn(hi)]), rounding);
}

function domainUnary(arg, accepts, fn, rounding) {
  const intervals = [];
  let maybeInvalid = arg.maybeInvalid;
  for (const interval of arg.intervals) {
    const pieces = clipByDomain(interval, accepts);
    if (pieces.length === 0 || pieces.length !== 1 || pieces[0][0] !== interval[0] || pieces[0][1] !== interval[1]) maybeInvalid = true;
    for (const piece of pieces) intervals.push(fn(piece));
  }
  return rounded(makeInfo(intervals, maybeInvalid), rounding);
}

function trigRange(arg, name) {
  const intervals = [];
  for (const [lo, hi] of arg.intervals) {
    if (hi - lo >= TWO_PI) {
      intervals.push([-1, 1]);
      continue;
    }
    const points = [lo, hi];
    const offset = name === "sin" ? PI / 2 : 0;
    for (let k = Math.ceil((lo - offset) / PI); k <= Math.floor((hi - offset) / PI); k += 1) {
      points.push(offset + k * PI);
    }
    intervals.push(minMax(points.map((x) => name === "sin" ? Math.sin(x) : Math.cos(x))));
  }
  return rounded(makeInfo(intervals, arg.maybeInvalid), "trig");
}

function estimateTan(arg) {
  const intervals = [];
  let maybeInvalid = arg.maybeInvalid;
  for (const [lo, hi] of arg.intervals) {
    const firstPole = Math.ceil((lo - PI / 2) / PI);
    const lastPole = Math.floor((hi - PI / 2) / PI);
    if (firstPole <= lastPole) {
      maybeInvalid = true;
      intervals.push([-F32_MAX, F32_MAX]);
    } else {
      intervals.push([Math.tan(lo), Math.tan(hi)]);
    }
  }
  return rounded(makeInfo(intervals, maybeInvalid), "builtin");
}

function estimateCosh(arg) {
  return rounded(mapIntervals(arg, ([lo, hi]) => {
    if (lo <= 0 && hi >= 0) return [1, Math.max(Math.cosh(lo), Math.cosh(hi))];
    return minMax([Math.cosh(lo), Math.cosh(hi)]);
  }), "builtin");
}

function estimateAbs(arg) {
  return mapIntervals(arg, ([lo, hi]) => {
    if (lo <= 0 && hi >= 0) return [0, Math.max(-lo, hi)];
    return [Math.min(Math.abs(lo), Math.abs(hi)), Math.max(Math.abs(lo), Math.abs(hi))];
  });
}

function estimateSign(arg) {
  const values = [];
  for (const [lo, hi] of arg.intervals) {
    if (lo < 0) values.push(-1);
    if (lo <= 0 && hi >= 0) values.push(0);
    if (hi > 0) values.push(1);
  }
  return makeInfo(values.map((value) => [value, value]), arg.maybeInvalid);
}

function estimateAtan2(y, x) {
  const intervals = [];
  let maybeInvalid = y.maybeInvalid || x.maybeInvalid;
  for (const yi of y.intervals) {
    for (const xi of x.intervals) {
      if (xi[0] <= 0 && xi[1] >= 0 && yi[0] <= 0 && yi[1] >= 0) maybeInvalid = true;
      intervals.push(...estimateAtan2Interval(yi, xi));
    }
  }
  if (intervals.length === 0) return invalidOnly();
  return rounded(makeInfo(intervals, maybeInvalid), "builtin");
}

function estimateAtan2Interval([ylo, yhi], [xlo, xhi]) {
  if (xlo < 0 && xhi > 0 && ylo < 0 && yhi > 0) return [[-PI, PI]];

  const angles = [];
  for (const x of [xlo, xhi]) {
    for (const y of [ylo, yhi]) {
      if (x !== 0 || y !== 0) angles.push(Math.atan2(y, x));
    }
  }
  if (angles.length === 0) return [[-PI, PI]];
  return smallestAngleCover(angles);
}

function smallestAngleCover(angles) {
  angles = [...new Set(angles.map((angle) => Object.is(angle, -PI) ? PI : angle))].sort((a, b) => a - b);
  if (angles.length === 1) return [[angles[0], angles[0]]];

  let gapStart = angles[angles.length - 1];
  let gapEnd = angles[0] + TWO_PI;
  let largestGap = gapEnd - gapStart;
  for (let i = 0; i < angles.length - 1; i += 1) {
    const gap = angles[i + 1] - angles[i];
    if (gap > largestGap) {
      largestGap = gap;
      gapStart = angles[i];
      gapEnd = angles[i + 1];
    }
  }

  const start = normalizeAngle(gapEnd);
  const end = normalizeAngle(gapStart);
  if (start <= end) return [[start, end]];
  return [[-PI, end], [start, PI]];
}

function normalizeAngle(angle) {
  while (angle > PI) angle -= TWO_PI;
  while (angle <= -PI) angle += TWO_PI;
  return Object.is(angle, -0) ? 0 : angle;
}

function estimateReciprocal(arg) {
  return estimateDiv(singleton(1), arg);
}

function combineBinary(left, right, combine, rounding) {
  const intervals = [];
  for (const l of left.intervals) {
    for (const r of right.intervals) intervals.push(combine(l, r));
  }
  return rounded(makeInfo(intervals, left.maybeInvalid || right.maybeInvalid), rounding);
}

function rounded(info, kind) {
  let maybeInvalid = info.maybeInvalid;
  const intervals = [];
  for (const [lo, hi] of info.intervals) {
    let next = [lo, hi];
    if (!(kind === "neg" || intervalIsExactIntegerSingleton(next))) {
      const ulps = kind === "div" ? 3 : kind === "trig" ? 8192 : kind === "builtin" ? 16 : 1;
      next = expandUlps(next, ulps);
    }
    const clamped = clampFiniteInterval(next);
    if (clamped.invalid) maybeInvalid = true;
    if (clamped.interval) intervals.push(clamped.interval);
  }
  return makeInfo(intervals, maybeInvalid);
}

function normalizeInputRange(value, name) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`Missing range for parameter ${JSON.stringify(name)}`);
  }
  return makeInfo(value.map((interval, index) => {
    if (!Array.isArray(interval) || interval.length !== 2) {
      throw new TypeError(`Range ${JSON.stringify(name)}[${index}] must be [min, max]`);
    }
    const [lo, hi] = interval.map(Number);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      throw new TypeError(`Range ${JSON.stringify(name)}[${index}] must use finite numbers`);
    }
    if (lo > hi) throw new TypeError(`Range ${JSON.stringify(name)}[${index}] has min greater than max`);
    return [lo, hi];
  }), false);
}

function finiteLiteral(value) {
  if (!Number.isFinite(value)) return invalidOnly();
  return singleton(Math.fround(value));
}

function singleton(value) {
  return makeInfo([[value, value]], false);
}

function invalidOnly() {
  return { intervals: [], maybeInvalid: true };
}

function cloneInfo(info, maybeInvalid = info.maybeInvalid) {
  return {
    intervals: info.intervals.map(([lo, hi]) => [lo, hi]),
    maybeInvalid,
  };
}

function makeInfo(intervals, maybeInvalid) {
  const clean = [];
  for (const interval of intervals) {
    const clamped = clampFiniteInterval(interval);
    if (clamped.interval) clean.push(clamped.interval);
    maybeInvalid ||= clamped.invalid;
  }
  clean.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const [lo, hi] of clean) {
    const last = merged[merged.length - 1];
    if (last && lo <= nextUp(last[1])) last[1] = Math.max(last[1], hi);
    else merged.push([lo, hi]);
  }
  return { intervals: merged, maybeInvalid };
}

function mapIntervals(info, fn) {
  return makeInfo(info.intervals.map(fn), info.maybeInvalid);
}

function clampFiniteInterval([lo, hi]) {
  if (Number.isNaN(lo) || Number.isNaN(hi)) return { interval: null, invalid: true };
  let invalid = false;
  if (!Number.isFinite(lo) || lo < -F32_MAX) {
    lo = lo === Infinity ? F32_MAX : -F32_MAX;
    invalid = true;
  }
  if (!Number.isFinite(hi) || hi > F32_MAX) {
    hi = F32_MAX;
    invalid = true;
  }
  if (lo > hi) return { interval: null, invalid: true };
  return { interval: [Math.fround(lo), Math.fround(hi)], invalid };
}

function expandUlps([lo, hi], count) {
  for (let i = 0; i < count; i += 1) {
    lo = nextDown(lo);
    hi = nextUp(hi);
  }
  return [lo, hi];
}

function nextUp(value) {
  value = Math.fround(value);
  if (Number.isNaN(value) || value === Infinity) return value;
  if (value === -Infinity) return -F32_MAX;
  if (Object.is(value, -0)) value = 0;
  F32[0] = value;
  if (value >= 0) U32[0] += 1;
  else U32[0] -= 1;
  return F32[0];
}

function nextDown(value) {
  value = Math.fround(value);
  if (Number.isNaN(value) || value === -Infinity) return value;
  if (value === Infinity) return F32_MAX;
  if (Object.is(value, 0)) value = -0;
  F32[0] = value;
  if (value > 0) U32[0] -= 1;
  else U32[0] += 1;
  return F32[0];
}

function minMax(values) {
  return [Math.min(...values), Math.max(...values)];
}

function splitNonzero([lo, hi]) {
  const pieces = [];
  if (lo < 0) pieces.push([lo, Math.min(hi, nextDown(0))]);
  if (hi > 0) pieces.push([Math.max(lo, nextUp(0)), hi]);
  return pieces;
}

function clipByDomain([lo, hi], accepts) {
  const pieces = [];
  if (accepts(lo) && accepts(hi)) return [[lo, hi]];
  const points = [lo, hi, -1, 0, 1, nextUp(-1), nextDown(1), nextUp(0), nextDown(0)].filter((x) => x >= lo && x <= hi);
  points.sort((a, b) => a - b);
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const mid = (a + b) / 2;
    if (accepts(mid) || accepts(a) || accepts(b)) pieces.push([accepts(a) ? a : mid, accepts(b) ? b : mid]);
  }
  if (points.length === 1 && accepts(points[0])) pieces.push([points[0], points[0]]);
  return pieces;
}

function intervalCanBeNonzero([lo, hi]) {
  return lo !== 0 || hi !== 0;
}

function intervalCanBeNonInteger([lo, hi]) {
  return lo !== hi || !Number.isInteger(lo);
}

function intervalHasNoIntegers([lo, hi]) {
  return Math.ceil(lo) > Math.floor(hi);
}

function intervalAllIntegers([lo, hi]) {
  return lo === hi && Number.isInteger(lo);
}

function intervalIsExactIntegerSingleton([lo, hi]) {
  return lo === hi && Number.isInteger(lo) && Math.abs(lo) <= F32_INT_EXACT_MAX;
}

function formatNumber(value) {
  if (Object.is(value, -0)) return "-0";
  if (Math.abs(value) >= 1e6 || (value !== 0 && Math.abs(value) < 1e-4)) return value.toExponential(6);
  return String(Number(value.toPrecision(8)));
}
