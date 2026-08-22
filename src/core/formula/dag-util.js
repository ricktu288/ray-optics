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

/**
 * Validate a DAG node label.
 *
 * Labels are lookup/output keys. They only need to be non-empty strings and
 * unique within the DAG.
 *
 * @param {unknown} label - Candidate node label.
 * @param {string} [fieldName="label"] - Field name used in error messages.
 * @returns {string} The validated label.
 * @throws {TypeError} If the label is invalid.
 */
export function validateDagNodeLabel(label, fieldName = "label") {
  if (typeof label !== "string" || label.length === 0) {
    throw new TypeError(`Invalid ${fieldName}: ${JSON.stringify(label)}`);
  }
  return label;
}

export function collectParameterNames(dag) {
  return new Set(
    dag.nodes
      .filter((node) => node.kind === "parameter")
      .map((node) => node.name),
  );
}

/**
 * Collect parameters which are dependencies of the selected output labels.
 *
 * @param {Object} dag
 * @param {string[]} labels
 * @returns {Set<string>}
 */
export function collectReferencedParameterNames(dag, labels) {
  const labelIds = collectNodeLabels(dag);
  const outputIds = labels.map(label => {
    const id = labelIds.get(label);
    if (id === undefined) {
      throw new TypeError(`Unknown label: ${JSON.stringify(label)}`);
    }
    return id;
  });
  const reachable = collectReachableNodeIds(dag, outputIds);
  return new Set(
    dag.nodes
      .filter(node =>
        reachable.has(node.id) && node.kind === "parameter"
      )
      .map(node => node.name),
  );
}

export function collectReachableNodeIds(dag, outputIds) {
  const reachable = new Set();
  const stack = [...outputIds];
  while (stack.length > 0) {
    const id = stack.pop();
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const childId of dag.nodes[id].args ?? []) {
      stack.push(childId);
    }
  }
  return reachable;
}

export function collectNodeLabels(dag) {
  const labels = new Map();
  for (const node of dag.nodes) {
    if (node.label === undefined) continue;
    if (labels.has(node.label)) {
      throw new TypeError(`Duplicate node label: ${JSON.stringify(node.label)}`);
    }
    labels.set(node.label, node.id);
  }
  return labels;
}

export function findNodeByLabel(dag, label) {
  const labels = collectNodeLabels(dag);
  const id = labels.get(label);
  if (id === undefined) throw new TypeError(`Unknown source label: ${JSON.stringify(label)}`);
  return id;
}

export function validateDagShape(dag) {
  if (!dag || !Array.isArray(dag.nodes)) throw new TypeError("dag must have a nodes array");
  if (dag.root !== undefined) assertNodeId(dag, dag.root, "root");

  const labels = new Set();
  for (const [index, node] of dag.nodes.entries()) {
    if (!node || node.id !== index) throw new TypeError(`dag.nodes[${index}] must have matching id`);
    if (node.label !== undefined) {
      validateDagNodeLabel(node.label, `node ${index} label`);
      if (labels.has(node.label)) throw new TypeError(`Duplicate node label: ${JSON.stringify(node.label)}`);
      labels.add(node.label);
    }
    for (const childId of node.args ?? []) assertNodeId(dag, childId, `node ${index} child`);
  }
}

export function assertNodeId(dag, id, name) {
  if (!Number.isInteger(id) || id < 0 || id >= dag.nodes.length) {
    throw new TypeError(`${name} must be an existing node id`);
  }
}

export function cloneNode(node) {
  return {
    ...node,
    args: node.args ? [...node.args] : node.args,
  };
}
