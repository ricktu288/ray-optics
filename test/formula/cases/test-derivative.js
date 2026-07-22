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

import assert from "node:assert/strict";
import { appendPartialDerivatives } from "../../../src/core/formula/derivative.js";
import { findNodeByLabel } from "../../../src/core/formula/dag-util.js";
import { parseFormula } from "../../../src/core/formula/formula-parser.js";

function derivative(dag, options) {
  return appendPartialDerivatives(dag, options);
}

{
  const original = parseFormula("x * y + sin(x)", ["x", "y"], { outputLabel: "f" });
  const result = derivative(original, {
    sourceLabel: "f",
    partials: [
      { parameter: "x", label: "dfdx" },
      { parameter: "y", label: "dfdy" },
    ],
  });

  assert.equal(result.dag.nodes.length > original.nodes.length, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.derivatives.length, 2);
  assert.equal(result.dag.root, original.root);
  assert.equal(result.dag.nodes[result.dag.root].label, "f");
  assert.equal(result.dag.nodes[result.derivatives[0].node].label, "dfdx");
  assert.equal(result.dag.nodes[result.derivatives[1].node].label, "dfdy");
  assert.equal(findNodeByLabel(result.dag, "dfdx"), result.derivatives[0].node);
  assert.equal(findNodeByLabel(result.dag, "dfdy"), result.derivatives[1].node);
  assert.equal(result.dag.nodes.slice(0, original.nodes.length).every((node, index) => node.id === original.nodes[index].id), true);
}

{
  const dag = parseFormula("sin(x) + cos(y)", ["x", "y"], { outputLabel: "f" });
  const source = dag.nodes.find((node) => node.kind === "call" && node.name === "sin").id;
  dag.nodes[source] = { ...dag.nodes[source], label: "sin_part" };
  const result = derivative(dag, {
    sourceLabel: "sin_part",
    partials: [{ parameter: "x", label: "d_sin_dx" }],
  });

  const output = result.dag.nodes[findNodeByLabel(result.dag, "d_sin_dx")];
  assert.equal(result.derivatives[0].source, source);
  assert.equal(output.kind, "call");
  assert.equal(output.name, "cos");
}

{
  const dag = parseFormula("x^3", ["x"], { outputLabel: "f" });
  const result = derivative(dag, {
    sourceLabel: "f",
    partials: [{ parameter: "x", label: "dfdx" }],
  });
  const output = result.dag.nodes[findNodeByLabel(result.dag, "dfdx")];

  assert.equal(output.kind, "binary");
  assert.equal(output.op, "*");
  assert.equal(result.dag.nodes[output.args[0]].raw, "3");
  assert.equal(result.dag.nodes[output.args[1]].op, "^");
}

{
  const dag = parseFormula("sin(x^2)", ["x"], { outputLabel: "f" });
  const result = derivative(dag, {
    sourceLabel: "f",
    partials: [{ parameter: "x", label: "dfdx" }],
  });
  const derivativeIds = new Set(result.derivatives.map((item) => item.node));
  const referenced = new Set();
  for (const node of result.dag.nodes) {
    for (const arg of node.args ?? []) referenced.add(arg);
  }

  for (let id = dag.nodes.length; id < result.dag.nodes.length; id += 1) {
    assert.equal(
      referenced.has(id) || derivativeIds.has(id),
      true,
      `appended node ${id} should be referenced or be a derivative output`,
    );
  }
  assert.equal(
    result.dag.nodes
      .slice(dag.nodes.length)
      .some((node) => node.kind === "number" && node.value === 0),
    false,
  );
}

{
  const dag = parseFormula("tanh(x)", ["x"], { outputLabel: "f" });
  const result = derivative(dag, {
    sourceLabel: "f",
    partials: [{ parameter: "x", label: "dfdx" }],
  });
  const names = result.dag.nodes
    .filter((node) => node.kind === "call")
    .map((node) => node.name);

  assert.equal(result.errors.length, 0);
  assert.equal(names.includes("exp"), true);
}

{
  const dag = parseFormula("abs(x) + y", ["x", "y"], { outputLabel: "f" });
  const result = derivative(dag, {
    sourceLabel: "f",
    partials: [
      { parameter: "x", label: "dfdx" },
      { parameter: "y", label: "dfdy" },
    ],
  });

  assert.equal(result.derivatives.length, 2);
  assert.equal(result.errors.length, 0);
  assert.equal(result.dag.nodes[findNodeByLabel(result.dag, "dfdx")].kind, "call");
  assert.equal(result.dag.nodes[findNodeByLabel(result.dag, "dfdx")].name, "guardNonzero");
  assert.ok(
    result.dag.nodes
      .slice(dag.nodes.length)
      .some((node) => node.kind === "call" && node.name === "guardNonzero"),
  );
}

{
  const dag = parseFormula("floor(x) + round(y)", ["x", "y"], { outputLabel: "f" });
  const result = derivative(dag, {
    sourceLabel: "f",
    partials: [
      { parameter: "x", label: "dfdx" },
      { parameter: "y", label: "dfdy" },
    ],
  });

  assert.equal(result.errors.length, 0);
  assert.equal(
    result.dag.nodes
      .slice(dag.nodes.length)
      .filter((node) => node.kind === "call" && node.name === "guardNotInteger")
      .length,
    4,
  );
}

{
  const dag = parseFormula("max(x, y, 2)", ["x", "y"], { outputLabel: "f" });
  const result = derivative(dag, {
    sourceLabel: "f",
    partials: [
      { parameter: "x", label: "dfdx" },
      { parameter: "y", label: "dfdy" },
    ],
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.dag.nodes[findNodeByLabel(result.dag, "dfdx")].kind, "call");
  assert.equal(result.dag.nodes[findNodeByLabel(result.dag, "dfdx")].name, "guardNonzero");
  assert.equal(result.dag.nodes[findNodeByLabel(result.dag, "dfdy")].kind, "call");
  assert.equal(result.dag.nodes[findNodeByLabel(result.dag, "dfdy")].name, "guardNonzero");
  assert.ok(result.dag.nodes.some((node) => node.kind === "call" && node.name === "sign"));
}

{
  const dag = parseFormula("guardNonzero(x, x^2)", ["x"], { outputLabel: "f" });
  const result = derivative(dag, {
    sourceLabel: "f",
    partials: [{ parameter: "x", label: "dfdx" }],
  });
  const output = result.dag.nodes[findNodeByLabel(result.dag, "dfdx")];

  assert.equal(result.errors.length, 0);
  assert.equal(output.kind, "call");
  assert.equal(output.name, "guardNonzero");
  assert.equal(output.args[0], dag.nodes[dag.root].args[0]);
  assert.equal(result.dag.nodes[output.args[1]].kind, "binary");
  assert.equal(result.dag.nodes[output.args[1]].op, "*");
}

{
  const dag = parseFormula("guardNotInteger(x, x) + guardValid(y, y^2) + guardNonNegative(x, x^3)", ["x", "y"], { outputLabel: "f" });
  const result = derivative(dag, {
    sourceLabel: "f",
    partials: [{ parameter: "x", label: "dfdx" }],
  });
  const names = result.dag.nodes
    .slice(dag.nodes.length)
    .filter((node) => node.kind === "call")
    .map((node) => node.name);

  assert.equal(result.errors.length, 0);
  assert.equal(names.includes("guardNotInteger"), true);
  assert.equal(names.includes("guardValid"), true);
  assert.equal(names.includes("guardNonNegative"), true);
}

{
  const result = derivative(parseFormula("fallback(x, 0)", ["x"], { outputLabel: "f" }), {
    sourceLabel: "f",
    partials: [{ parameter: "x", label: "dfdx" }],
  });

  assert.equal(result.derivatives.length, 0);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /Unsupported differentiable function "fallback"/);
}

assert.equal(parseFormula("x", ["x"], { outputLabel: "x" }).nodes.at(-1).label, "x");
assert.equal(parseFormula("x", ["x"], { outputLabel: "sin" }).nodes.at(-1).label, "sin");

{
  const result = derivative(parseFormula("x", ["x"], { outputLabel: "f" }), {
    sourceLabel: "f",
    partials: [{ parameter: "x", label: "x" }],
  });
  assert.equal(result.dag.nodes[result.derivatives[0].node].label, "x");
}

console.log("derivative tests passed");
