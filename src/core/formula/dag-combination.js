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
  validateDagShape
} from './dag-util.js';

/**
 * Combine independently built formula DAGs while preserving all labeled
 * outputs. Node IDs are remapped, but nodes are not deduplicated across DAGs.
 * The first DAG's root remains the root of the combined DAG.
 *
 * @param {Object[]} dags - The formula DAGs to combine.
 * @returns {Object} The combined formula DAG.
 */
export function combineDags(dags) {
  if (!Array.isArray(dags) || dags.length === 0) {
    throw new TypeError('dags must be a non-empty array.');
  }

  const usedLabels = new Set();
  const nodes = [];
  let root;

  for (const dag of dags) {
    validateDagShape(dag);
    if (dag.root === undefined) {
      throw new TypeError('Each DAG must have a root node.');
    }
    for (const label of collectNodeLabels(dag).keys()) {
      if (usedLabels.has(label)) {
        throw new TypeError(`Duplicate node label: ${JSON.stringify(label)}`);
      }
      usedLabels.add(label);
    }

    const offset = nodes.length;
    for (const node of dag.nodes) {
      nodes.push({
        ...node,
        id: node.id + offset,
        args: node.args?.map(id => id + offset)
      });
    }
    if (root === undefined) {
      root = dag.root + offset;
    }
  }

  return { root, nodes };
}
