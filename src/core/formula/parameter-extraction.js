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

import { DagBuilder } from "./dag-builder.js";

/**
 * Replace number literals in a DAG with generated parameters.
 *
 * @param {{root: number, nodes: Array<object>}} dag - DAG to rewrite.
 * @param {Object} [options={}] - Extraction options.
 * @param {string} [options.prefix="_n"] - Prefix for generated parameter names.
 * @returns {{
 *   dag: {root: number, nodes: Array<object>},
 *   extracted: Array<{name: string, value: number, raw: string}>
 * }} Rewritten DAG and extracted literal metadata.
 * @throws {TypeError} If `dag` is malformed or `options.prefix` is not a
 * non-empty string.
 *
 * @example
 * const { dag, extracted } = extractNumbersAsParameters(parsedDag);
 * // extracted: [{ name: "_n0", value: 2.5, raw: "2.5" }]
 */
export function extractNumbersAsParameters(dag, options = {}) {
  if (!dag || !Number.isInteger(dag.root) || !Array.isArray(dag.nodes)) {
    throw new TypeError("dag must be an object with root and nodes");
  }

  const prefix = options.prefix ?? "_n";
  if (typeof prefix !== "string" || prefix.length === 0) {
    throw new TypeError(`Invalid generated parameter prefix: ${JSON.stringify(prefix)}`);
  }

  const usedNames = new Set(
    dag.nodes
      .filter((node) => node.kind === "parameter")
      .map((node) => node.name),
  );
  const selectedIds = dag.nodes
    .filter((node) => node.kind === "number")
    .map((node) => node.id);
  const namesByOldId = new Map();
  const extracted = [];
  let nextIndex = 0;

  for (const oldId of selectedIds) {
    let name;
    do {
      name = `${prefix}${nextIndex}`;
      nextIndex += 1;
    } while (usedNames.has(name));

    usedNames.add(name);
    namesByOldId.set(oldId, name);
    const node = dag.nodes[oldId];
    extracted.push({ name, value: node.value, raw: node.raw });
  }

  const builder = new DagBuilder();
  const rewrittenByOldId = new Map();

  function rewrite(oldId) {
    if (rewrittenByOldId.has(oldId)) return rewrittenByOldId.get(oldId);

    const node = dag.nodes[oldId];
    if (!node) throw new TypeError(`DAG references missing node ${oldId}`);

    let newId;
    if (namesByOldId.has(oldId)) {
      newId = builder.parameter(namesByOldId.get(oldId));
    } else if (node.kind === "number") {
      newId = builder.number(node.value, node.raw);
    } else if (node.kind === "constant") {
      newId = builder.constant(node.name);
    } else if (node.kind === "parameter") {
      newId = builder.parameter(node.name);
    } else if (node.kind === "unary") {
      newId = builder.unary(node.op, rewrite(node.args[0]));
    } else if (node.kind === "binary") {
      newId = builder.binary(node.op, rewrite(node.args[0]), rewrite(node.args[1]));
    } else if (node.kind === "call") {
      newId = builder.call(node.name, node.args.map(rewrite));
    } else {
      throw new TypeError(`Unknown DAG node kind: ${JSON.stringify(node.kind)}`);
    }

    if (node.label !== undefined) {
      newId = builder.label(newId, node.label);
    }
    rewrittenByOldId.set(oldId, newId);
    return newId;
  }

  for (let oldId = 0; oldId < dag.nodes.length; oldId += 1) {
    rewrite(oldId);
  }

  return {
    dag: {
      root: rewrittenByOldId.get(dag.root),
      nodes: builder.nodes,
    },
    extracted,
  };
}
