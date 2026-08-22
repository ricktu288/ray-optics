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

export function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) * 0.5;
}

export function selectRayCooperationProfile(profileMeasurements) {
  let best = null;
  for (const measurement of profileMeasurements) {
    const times = measurement.results
      .map(result => result.medianMs)
      .filter(value => Number.isFinite(value) && value > 0);
    if (times.length !== measurement.results.length || !times.length) continue;
    const geometricMeanMs = Math.exp(
      times.reduce((sum, value) => sum + Math.log(value), 0) / times.length
    );
    if (!best || geometricMeanMs < best.geometricMeanMs) {
      best = { ...measurement, geometricMeanMs };
    }
  }
  if (!best) {
    throw new Error('No ray-cooperation profile completed successfully.');
  }
  return best;
}

export function estimateIntersectionCrossover({
  cpuResults,
  gpuResults,
  defaultThreshold,
}) {
  const gpuByProbe = new Map(gpuResults.map(result => [result.probeId, result]));
  const points = cpuResults.flatMap(cpu => {
    const gpu = gpuByProbe.get(cpu.probeId);
    const score = cpu.workload?.initialRayCount * Math.sqrt(
      Math.max(0, cpu.workload?.primitiveCurveCount ?? 0)
    );
    if (!(cpu.medianMs > 0) || !(gpu?.medianMs > 0) || !(score > 0)) {
      return [];
    }
    return [{ score, cpuMs: cpu.medianMs, gpuMs: gpu.medianMs }];
  });
  if (points.length < 2) return defaultThreshold;

  const scores = [...new Set(points.map(point => point.score))]
    .sort((a, b) => a - b);
  const candidates = [Math.max(1, scores[0] * 0.5)];
  for (let index = 1; index < scores.length; index++) {
    // Workload is multiplicative, so a geometric midpoint is the neutral
    // boundary between adjacent measured scores. It need not be a power of 2.
    candidates.push(Math.sqrt(scores[index - 1] * scores[index]));
  }
  candidates.push(scores[scores.length - 1] * 2);

  let best = null;
  for (const threshold of candidates) {
    let regret = 0;
    let disagreementCount = 0;
    for (const point of points) {
      const gpuSelected = point.score >= threshold;
      const selectedMs = gpuSelected ? point.gpuMs : point.cpuMs;
      const bestMs = Math.min(point.cpuMs, point.gpuMs);
      if (selectedMs > bestMs) {
        regret += Math.log(selectedMs / bestMs) ** 2;
        disagreementCount++;
      }
    }
    const distanceFromDefault = Math.abs(Math.log(
      threshold / Math.max(1, defaultThreshold)
    ));
    const candidate = {
      threshold,
      regret,
      disagreementCount,
      distanceFromDefault,
    };
    if (!best || compareCrossoverCandidates(candidate, best) < 0) {
      best = candidate;
    }
  }
  return Math.max(1, best.threshold);
}

function compareCrossoverCandidates(left, right) {
  const regretDifference = left.regret - right.regret;
  if (Math.abs(regretDifference) > 1e-12) return regretDifference;
  if (left.disagreementCount !== right.disagreementCount) {
    return left.disagreementCount - right.disagreementCount;
  }
  return left.distanceFromDefault - right.distanceFromDefault;
}
