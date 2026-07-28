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
import { extractNumbersAsParameters } from "../../../src/core/formula/parameter-extraction.js";
import { parseFormula } from "../../../src/core/formula/formula-parser.js";

function parses(expression, parameters = []) {
  return parseFormula(expression, parameters);
}

{
  const first = extractNumbersAsParameters(parses("max(2.0, x + 3., 2, 1e3, 2.0)", ["x"]));
  assert.deepEqual(first.extracted, [
    { name: "_n0", value: 2, raw: "2.0" },
    { name: "_n1", value: 3, raw: "3." },
    { name: "_n2", value: 2, raw: "2" },
    { name: "_n3", value: 1000, raw: "1e3" },
  ]);
  assert.equal(first.dag.nodes[first.dag.root].name, "max");
  assert.equal(first.dag.nodes.some((node) => node.kind === "number"), false);
  assert.deepEqual(
    first.dag.nodes.filter((node) => node.kind === "parameter").map((node) => node.name),
    ["_n0", "x", "_n1", "_n2", "_n3"],
  );

  const second = extractNumbersAsParameters(parses("max(9.0, x + 4., 2, 7e3, 9.0)", ["x"]));
  assert.deepEqual(second.extracted.map((item) => item.name), ["_n0", "_n1", "_n2", "_n3"]);
}

{
  const transformed = extractNumbersAsParameters(parses("_n0 + 2.5 + 3.5", ["_n0"]));
  assert.deepEqual(transformed.extracted.map((item) => item.name), ["_n1", "_n2"]);
}

{
  const transformed = extractNumbersAsParameters(parseFormula("x + 2.5", ["x"], { outputLabel: "f" }));
  assert.equal(transformed.dag.nodes[transformed.dag.root].label, "f");
}

{
  const transformed = extractNumbersAsParameters(parses("x + 2.5", ["x"]), { prefix: "sqrt" });
  assert.deepEqual(transformed.extracted.map((item) => item.name), ["sqrt0"]);
  assert.equal(transformed.dag.nodes.some((node) => node.kind === "parameter" && node.name === "sqrt0"), true);
}

assert.throws(() => extractNumbersAsParameters(parses("2.5"), { prefix: "" }), /Invalid generated parameter prefix/);

console.log("parameter extraction tests passed");
