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

export class DagBuilder {
  constructor() {
    this.nodes = [];
    this.keys = new Map();
  }

  intern(node) {
    const key = JSON.stringify(node);
    const existing = this.keys.get(key);
    if (existing !== undefined) return existing;

    const id = this.nodes.length;
    this.keys.set(key, id);
    this.nodes.push({ id, ...node });
    return id;
  }

  number(value, raw) {
    return this.intern({ kind: "number", value, raw });
  }

  constant(name) {
    return this.intern({ kind: "constant", name });
  }

  parameter(name) {
    return this.intern({ kind: "parameter", name });
  }

  unary(op, arg) {
    return this.intern({ kind: "unary", op, args: [arg] });
  }

  binary(op, left, right) {
    return this.intern({ kind: "binary", op, args: [left, right] });
  }

  call(name, args) {
    return this.intern({ kind: "call", name, args });
  }

  label(id, label) {
    const node = this.nodes[id];
    if (node.label === label) return id;
    if (node.label === undefined) {
      this.nodes[id] = { ...node, label };
      return id;
    }

    const newId = this.nodes.length;
    this.nodes.push({ ...node, id: newId, label });
    return newId;
  }
}
