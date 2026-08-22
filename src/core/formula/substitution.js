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

import { DagBuilder } from './dag-builder.js';
import {
  collectNodeLabels,
  validateDagShape
} from './dag-util.js';

/**
 * Replace selected parameter nodes with expression DAGs.
 *
 * Replacement expressions are copied as-is and are not recursively subjected
 * to the same substitution map. They must not contain labeled outputs. The
 * input DAG is not mutated, and all of its labeled outputs are preserved even
 * when they are not reachable from its root node.
 *
 * @param {Object} dag - The DAG whose parameters are to be replaced.
 * @param {Object<string, Object>} substitutions - Parameter names mapped to expression DAGs.
 * @returns {Object} A rewritten DAG.
 */
export function substituteDagParameters(dag, substitutions) {
  validateDagShape(dag);
  if (
    substitutions === null ||
    typeof substitutions !== 'object' ||
    Array.isArray(substitutions)
  ) {
    throw new TypeError('substitutions must be an object.');
  }

  const replacementEntries = new Map();
  for (const [name, replacement] of Object.entries(substitutions)) {
    validateDagShape(replacement);
    if (collectNodeLabels(replacement).size > 0) {
      throw new TypeError(
        `Substitution for ${JSON.stringify(name)} must not contain labeled nodes.`
      );
    }
    replacementEntries.set(name, replacement);
  }

  const builder = new DagBuilder();
  const rewrittenIds = new Map();
  const replacementIds = new Map();

  const copyNode = (sourceDag, oldId, copiedIds) => {
    if (copiedIds.has(oldId)) {
      return copiedIds.get(oldId);
    }

    const node = sourceDag.nodes[oldId];
    let newId;
    if (node.kind === 'number') {
      newId = builder.number(node.value, node.raw);
    } else if (node.kind === 'constant') {
      newId = builder.constant(node.name);
    } else if (node.kind === 'parameter') {
      newId = builder.parameter(node.name);
    } else if (node.kind === 'unary') {
      newId = builder.unary(
        node.op,
        copyNode(sourceDag, node.args[0], copiedIds)
      );
    } else if (node.kind === 'binary') {
      newId = builder.binary(
        node.op,
        copyNode(sourceDag, node.args[0], copiedIds),
        copyNode(sourceDag, node.args[1], copiedIds)
      );
    } else if (node.kind === 'call') {
      newId = builder.call(
        node.name,
        node.args.map(id => copyNode(sourceDag, id, copiedIds))
      );
    } else {
      throw new TypeError(`Unknown DAG node kind: ${JSON.stringify(node.kind)}`);
    }

    copiedIds.set(oldId, newId);
    return newId;
  };

  const rewriteNode = oldId => {
    if (rewrittenIds.has(oldId)) {
      return rewrittenIds.get(oldId);
    }

    const node = dag.nodes[oldId];
    let newId;
    if (node.kind === 'parameter' && replacementEntries.has(node.name)) {
      const replacement = replacementEntries.get(node.name);
      let copiedIds = replacementIds.get(node.name);
      if (!copiedIds) {
        copiedIds = new Map();
        replacementIds.set(node.name, copiedIds);
      }
      newId = copyNode(replacement, replacement.root, copiedIds);
    } else if (node.kind === 'number') {
      newId = builder.number(node.value, node.raw);
    } else if (node.kind === 'constant') {
      newId = builder.constant(node.name);
    } else if (node.kind === 'parameter') {
      newId = builder.parameter(node.name);
    } else if (node.kind === 'unary') {
      newId = builder.unary(node.op, rewriteNode(node.args[0]));
    } else if (node.kind === 'binary') {
      newId = builder.binary(
        node.op,
        rewriteNode(node.args[0]),
        rewriteNode(node.args[1])
      );
    } else if (node.kind === 'call') {
      newId = builder.call(node.name, node.args.map(rewriteNode));
    } else {
      throw new TypeError(`Unknown DAG node kind: ${JSON.stringify(node.kind)}`);
    }

    if (node.label !== undefined) {
      newId = builder.label(newId, node.label);
    }
    rewrittenIds.set(oldId, newId);
    return newId;
  };

  for (let oldId = 0; oldId < dag.nodes.length; oldId++) {
    rewriteNode(oldId);
  }

  return {
    ...dag,
    root: rewrittenIds.get(dag.root),
    nodes: builder.nodes
  };
}
