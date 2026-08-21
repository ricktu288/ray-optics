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

const SIGNIFICANT_RUNTIME_MS = 150;

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
      Math.max(1, cpu.workload?.primitiveCurveCount ?? 0)
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
  return Math.max(1, Math.round(best.threshold));
}

function compareCrossoverCandidates(left, right) {
  const regretDifference = left.regret - right.regret;
  if (Math.abs(regretDifference) > 1e-12) return regretDifference;
  if (left.disagreementCount !== right.disagreementCount) {
    return left.disagreementCount - right.disagreementCount;
  }
  return left.distanceFromDefault - right.distanceFromDefault;
}

export function fitEngineSelectionCorrections({
  cpuResults,
  gpuResults,
  threshold,
  defaults,
}) {
  const gpuByProbe = new Map(gpuResults.map(result => [result.probeId, result]));
  const pairs = cpuResults.flatMap(cpu => {
    const gpu = gpuByProbe.get(cpu.probeId);
    if (!(cpu.medianMs > 0) || !(gpu?.medianMs > 0) || !cpu.workload) return [];
    return [{ cpu, gpu }];
  });
  if (!pairs.length) return { ...defaults };

  const candidates = {
    outgoingCoefficient: candidateValues(
      defaults.outgoingCoefficient,
      [0, 0.25, 0.5, 1, 2, 4, 8]
    ),
    defaultRenderCoefficient: candidateValues(
      defaults.defaultRenderCoefficient,
      [0, 0.125, 0.25, 0.5, 1, 2, 4, 8]
    ),
    nonDefaultRenderCoefficient: candidateValues(
      defaults.nonDefaultRenderCoefficient,
      [0, 0.125, 0.25, 0.5, 1, 2, 4, 8]
    ),
    grinStepCoefficient: candidateValues(
      defaults.grinStepCoefficient,
      [0, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2]
    ),
  };

  let best = { parameters: { ...defaults }, loss: Infinity };
  for (const outgoingCoefficient of candidates.outgoingCoefficient) {
    for (const defaultRenderCoefficient of candidates.defaultRenderCoefficient) {
      for (const nonDefaultRenderCoefficient of candidates.nonDefaultRenderCoefficient) {
        for (const grinStepCoefficient of candidates.grinStepCoefficient) {
          const parameters = {
            outgoingCoefficient,
            defaultRenderCoefficient,
            nonDefaultRenderCoefficient,
            grinStepCoefficient,
          };
          const loss = selectionLoss(pairs, threshold, parameters, defaults);
          if (loss < best.loss) best = { parameters, loss };
        }
      }
    }
  }
  return best.parameters;
}

function selectionLoss(pairs, threshold, parameters, defaults) {
  let loss = 0;
  for (const { cpu, gpu } of pairs) {
    const workload = cpu.workload;
    const renderCoefficient = cpu.colorMode === 'default'
      ? parameters.defaultRenderCoefficient
      : parameters.nonDefaultRenderCoefficient;
    const score = workload.initialRayCount * (
      Math.sqrt(Math.max(1, workload.primitiveCurveCount)) +
      parameters.outgoingCoefficient *
        (workload.additionalOutgoingRaySlotCount ?? 0) +
      renderCoefficient +
      parameters.grinStepCoefficient * (workload.grinStepFactor ?? 0)
    );
    const selectedMs = score >= threshold ? gpu.medianMs : cpu.medianMs;
    const bestMs = Math.min(cpu.medianMs, gpu.medianMs);
    if (selectedMs > bestMs) {
      const regret = Math.log(selectedMs / bestMs);
      const weight = selectedMs >= SIGNIFICANT_RUNTIME_MS ? 10 : 0.1;
      loss += weight * regret * regret;
    }
  }

  // A weak prior keeps an unobserved term at its shipped value instead of
  // allowing an arbitrary grid point to win a tie.
  for (const key of Object.keys(defaults)) {
    const scale = Math.max(0.05, Math.abs(defaults[key]));
    loss += 1e-7 * ((parameters[key] - defaults[key]) / scale) ** 2;
  }
  return loss;
}

function candidateValues(defaultValue, values) {
  return [...new Set([...values, defaultValue])].sort((a, b) => a - b);
}

export { SIGNIFICANT_RUNTIME_MS };
