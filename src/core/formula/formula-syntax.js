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

export const CONSTANTS = new Set(["pi", "e"]);
export const UNARY_FUNCTIONS = new Set([
  "sqrt",
  "sin",
  "cos",
  "tan",
  "sec",
  "csc",
  "cot",
  "sinh",
  "cosh",
  "tanh",
  "log",
  "exp",
  "asin",
  "acos",
  "atan",
  "asinh",
  "acosh",
  "atanh",
  "floor",
  "round",
  "ceil",
  "fix",
  "abs",
  "sign",
]);
export const BINARY_FUNCTIONS = new Set([
  "atan2",
  "guardNonzero",
  "guardNonNegative",
  "guardNotInteger",
  "guardValid",
  "fallback",
]);
export const VARIADIC_FUNCTIONS = new Set(["max", "min"]);
export const RESERVED_NAMES = new Set([
  ...CONSTANTS,
  ...UNARY_FUNCTIONS,
  ...BINARY_FUNCTIONS,
  ...VARIADIC_FUNCTIONS,
]);

export function isFormulaIdentifierStart(char) {
  return char !== undefined && /[$_\p{ID_Start}]/u.test(char);
}

export function isFormulaIdentifierContinue(char) {
  return char !== undefined && /[$_\u200c\u200d\p{ID_Continue}]/u.test(char);
}

/**
 * Return whether a string can be used as a formula parameter or assignment name.
 *
 * Formula names must be JavaScript-style identifiers and must not collide with
 * constants or supported function names.
 *
 * @param {unknown} name - Candidate formula name.
 * @returns {boolean} True when `name` is valid in formula syntax.
 */
export function isValidFormulaParameterName(name) {
  if (typeof name !== "string" || name.length === 0) return false;
  if (RESERVED_NAMES.has(name)) return false;
  if (!isFormulaIdentifierStart(name[0])) return false;

  for (let index = 1; index < name.length; index += 1) {
    if (!isFormulaIdentifierContinue(name[index])) return false;
  }
  return true;
}
