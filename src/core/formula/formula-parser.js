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
import { validateDagNodeLabel } from "./dag-util.js";
import {
  BINARY_FUNCTIONS,
  CONSTANTS,
  RESERVED_NAMES,
  UNARY_FUNCTIONS,
  VARIADIC_FUNCTIONS,
  isFormulaIdentifierContinue,
  isFormulaIdentifierStart,
  isValidFormulaParameterName,
} from "./formula-syntax.js";

class FormulaParseError extends SyntaxError {
  constructor(message, input, index) {
    super(`${message} at index ${index}`);
    this.name = "FormulaParseError";
    this.index = index;
    this.input = input;
  }
}

class ProgramParser {
  constructor(input, parameters) {
    this.input = input;
    this.parameters = new Set(parameters);
    this.dag = new DagBuilder();
    this.assignments = new Map();
  }

  parse() {
    const statements = splitStatements(this.input);
    if (statements.length === 0) {
      throw new FormulaParseError("Expected expression", this.input, 0);
    }

    let root;
    for (const statement of statements) {
      root = this.parseStatement(statement);
    }
    return { root, nodes: this.dag.nodes };
  }

  parseStatement(statement) {
    const assignmentIndex = findTopLevelAssignment(statement.text);
    if (assignmentIndex === -1) {
      return this.parseExpression(statement.text, statement.start);
    }

    const name = statement.text.slice(0, assignmentIndex).trim();
    if (!isValidFormulaParameterName(name)) {
      throw new FormulaParseError(`Invalid assignment name: ${JSON.stringify(name)}`, this.input, statement.start);
    }
    if (this.parameters.has(name)) {
      throw new FormulaParseError(`assignment name must not clash with parameter name: ${JSON.stringify(name)}`, this.input, statement.start);
    }
    if (this.assignments.has(name)) {
      throw new FormulaParseError(`Duplicate assignment name: ${JSON.stringify(name)}`, this.input, statement.start);
    }

    const expressionStart = assignmentIndex + 1;
    const root = this.parseExpression(
      statement.text.slice(expressionStart),
      statement.start + expressionStart,
    );
    const labeledRoot = this.dag.label(root, name);
    this.assignments.set(name, labeledRoot);
    return labeledRoot;
  }

  parseExpression(input, baseIndex) {
    return new Parser(input, this.parameters, {
      assignments: this.assignments,
      baseIndex,
      dag: this.dag,
      sourceInput: this.input,
    }).parse();
  }
}

class Parser {
  constructor(input, parameters, options = {}) {
    this.input = input;
    this.index = 0;
    this.parameters = new Set(parameters);
    this.assignments = options.assignments ?? new Map();
    this.baseIndex = options.baseIndex ?? 0;
    this.sourceInput = options.sourceInput ?? input;
    this.dag = options.dag ?? new DagBuilder();
  }

  parse() {
    const root = this.parseAdditive();
    this.skipWhitespace();
    if (!this.isEnd()) {
      this.error(`Unexpected token ${JSON.stringify(this.peek())}`);
    }
    return root;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    while (true) {
      this.skipWhitespace();
      if (this.consume("+")) {
        const right = this.parseMultiplicative();
        left = this.dag.binary("+", left, right);
      } else if (this.consume("-")) {
        const right = this.parseMultiplicative();
        left = this.dag.binary("-", left, right);
      } else {
        return left;
      }
    }
  }

  parseMultiplicative() {
    let left = this.parseUnary();
    while (true) {
      this.skipWhitespace();
      if (this.consume("*")) {
        const right = this.parseUnary();
        left = this.dag.binary("*", left, right);
      } else if (this.consume("/")) {
        const right = this.parseUnary();
        left = this.dag.binary("/", left, right);
      } else {
        return left;
      }
    }
  }

  parseUnary() {
    this.skipWhitespace();
    if (this.consume("-")) {
      return this.dag.unary("-", this.parseUnary());
    }
    return this.parsePower();
  }

  parsePower() {
    const left = this.parsePrimary();
    this.skipWhitespace();
    if (!this.consume("^")) return left;

    const right = this.parseUnary();
    return this.dag.binary("^", left, right);
  }

  parsePrimary() {
    this.skipWhitespace();
    if (this.isEnd()) this.error("Expected expression");

    if (this.consume("(")) {
      const expr = this.parseAdditive();
      this.skipWhitespace();
      if (!this.consume(")")) this.error("Expected ')'");
      return expr;
    }

    const char = this.peek();
    if (isNumberStart(char, this.peek(1))) return this.parseNumber();
    if (isIdentifierStart(char)) return this.parseName();

    this.error(`Unexpected token ${JSON.stringify(char)}`);
  }

  parseNumber() {
    const start = this.index;
    const input = this.input;

    if (this.peek() === ".") {
      this.index += 1;
      this.consumeDigits();
    } else {
      this.consumeDigits();
      if (this.peek() === ".") {
        this.index += 1;
        this.consumeDigits();
      }
    }

    if (this.peek()?.toLowerCase() === "e") {
      const exponentStart = this.index;
      this.index += 1;
      if (this.peek() === "+" || this.peek() === "-") this.index += 1;
      const digitStart = this.index;
      this.consumeDigits();
      if (this.index === digitStart) {
        this.index = exponentStart;
        this.error("Expected exponent digits");
      }
    }

    const raw = input.slice(start, this.index);
    const value = Number(raw);
    if (!Number.isFinite(value)) this.error("Number must be finite");
    return this.dag.number(value, raw);
  }

  parseName() {
    const name = this.consumeIdentifier();
    this.skipWhitespace();

    if (this.consume("(")) {
      if (UNARY_FUNCTIONS.has(name)) {
        const arg = this.parseSingleFunctionArgument(name);
        return this.dag.call(name, [arg]);
      }

      if (BINARY_FUNCTIONS.has(name)) {
        const args = this.parseFixedFunctionArguments(name, 2);
        return this.dag.call(name, args);
      }

      if (VARIADIC_FUNCTIONS.has(name)) {
        const args = this.parseVariadicFunctionArguments(name);
        return this.dag.call(name, args);
      }

      if (RESERVED_NAMES.has(name)) {
        this.error(`Name ${JSON.stringify(name)} is not callable`);
      }
      this.error(`Unknown function ${JSON.stringify(name)}`);
    }

    if (CONSTANTS.has(name)) return this.dag.constant(name);
    if (RESERVED_NAMES.has(name)) {
      this.error(`Function ${JSON.stringify(name)} must be called with parentheses`);
    }
    if (this.assignments.has(name)) return this.assignments.get(name);
    if (!this.parameters.has(name)) {
      this.error(`Unknown parameter ${JSON.stringify(name)}`);
    }
    return this.dag.parameter(name);
  }

  parseSingleFunctionArgument(name) {
    this.skipWhitespace();
    if (this.consume(")")) this.error(`Function ${name} requires one argument`);

    const arg = this.parseAdditive();
    this.skipWhitespace();
    if (this.consume(",")) this.error(`Function ${name} accepts exactly one argument`);
    if (!this.consume(")")) this.error("Expected ')'");
    return arg;
  }

  parseFixedFunctionArguments(name, count) {
    const args = [];
    this.skipWhitespace();
    if (this.consume(")")) this.error(`Function ${name} requires ${count} arguments`);

    while (true) {
      args.push(this.parseAdditive());
      this.skipWhitespace();
      if (this.consume(")")) {
        if (args.length !== count) this.error(`Function ${name} accepts exactly ${count} arguments`);
        return args;
      }
      if (!this.consume(",")) this.error("Expected ',' or ')'");
      this.skipWhitespace();
      if (this.peek() === ")") this.error(`Function ${name} does not allow trailing comma`);
      if (args.length >= count) this.error(`Function ${name} accepts exactly ${count} arguments`);
    }
  }

  parseVariadicFunctionArguments(name) {
    const args = [];
    this.skipWhitespace();
    if (this.consume(")")) this.error(`Function ${name} requires at least one argument`);

    while (true) {
      args.push(this.parseAdditive());
      this.skipWhitespace();
      if (this.consume(")")) return args;
      if (!this.consume(",")) this.error("Expected ',' or ')'");
      this.skipWhitespace();
      if (this.peek() === ")") this.error(`Function ${name} does not allow trailing comma`);
    }
  }

  consumeDigits() {
    while (isAsciiDigit(this.peek())) this.index += 1;
  }

  consumeIdentifier() {
    const start = this.index;
    this.index += 1;
    while (!this.isEnd() && isIdentifierContinue(this.peek())) this.index += 1;
    return this.input.slice(start, this.index);
  }

  skipWhitespace() {
    while (!this.isEnd() && /\s/u.test(this.peek())) this.index += 1;
  }

  consume(expected) {
    if (this.input.startsWith(expected, this.index)) {
      this.index += expected.length;
      return true;
    }
    return false;
  }

  peek(offset = 0) {
    return this.input[this.index + offset];
  }

  isEnd() {
    return this.index >= this.input.length;
  }

  error(message) {
    throw new FormulaParseError(message, this.sourceInput, this.baseIndex + this.index);
  }
}

function splitStatements(input) {
  const statements = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0 && (char === ";" || char === "\n" || char === "\r")) {
      addStatement(statements, input, start, index);
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      start = index + 1;
    }
  }

  addStatement(statements, input, start, input.length);
  return statements;
}

function addStatement(statements, input, start, end) {
  let trimmedStart = start;
  let trimmedEnd = end;
  while (trimmedStart < trimmedEnd && /\s/u.test(input[trimmedStart])) trimmedStart += 1;
  while (trimmedEnd > trimmedStart && /\s/u.test(input[trimmedEnd - 1])) trimmedEnd -= 1;
  if (trimmedStart === trimmedEnd) return;
  statements.push({
    text: input.slice(trimmedStart, trimmedEnd),
    start: trimmedStart,
  });
}

function findTopLevelAssignment(input) {
  let depth = 0;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && char === "=") return index;
  }
  return -1;
}

function isAsciiDigit(char) {
  return char !== undefined && char >= "0" && char <= "9";
}

function isNumberStart(char, next) {
  return isAsciiDigit(char) || (char === "." && isAsciiDigit(next));
}

function isIdentifierStart(char) {
  return isFormulaIdentifierStart(char);
}

function isIdentifierContinue(char) {
  return isFormulaIdentifierContinue(char);
}

/**
 * Return whether a string can be used as a parser parameter name.
 *
 * Parameter names must be valid JavaScript-style identifiers and must not
 * collide with constants or supported function names.
 *
 * @param {unknown} name - Candidate parameter name.
 * @returns {boolean} True when `name` is valid for `parseFormula`.
 *
 * @example
 * isValidFormulaParameterName("x_1"); // true
 * isValidFormulaParameterName("sqrt"); // false
 * isValidFormulaParameterName("pi"); // false
 */
export { isValidFormulaParameterName };

/**
 * Parse a math expression into a canonical DAG without evaluating it.
 *
 * The expression may use constants (`pi`, `e`), binary operators
 * (`+`, `-`, `*`, `/`, `^`), unary minus, supported unary and binary functions,
 * `max`/`min`, guard/fallback functions, parentheses, finite decimal numbers,
 * and the parameter names supplied in `parameters`.
 *
 * @param {string} input - Expression to parse.
 * @param {string[]} [parameters=[]] - Allowed parameter names in the expression.
 * @param {Object} [options={}] - Parse options.
 * @param {string} [options.outputLabel] - Label to assign to the root node.
 * @returns {{root: number, nodes: Array<object>}} DAG with `root` pointing to a node id.
 * @throws {TypeError} If `input` or `parameters` are invalid.
 * @throws {FormulaParseError} If the expression is syntactically invalid or references
 * unknown names.
 *
 * @example
 * const dag = parseFormula("sin(x)^2 + cos(x)^2", ["x"]);
 * console.log(dag.root, dag.nodes);
 */
export function parseFormula(input, parameters = [], options = {}) {
  if (typeof input !== "string") {
    throw new TypeError("input must be a string");
  }
  if (!Array.isArray(parameters)) {
    throw new TypeError("parameters must be an array of names");
  }

  const seen = new Set();
  for (const name of parameters) {
    if (!isValidFormulaParameterName(name)) {
      throw new TypeError(`Invalid parameter name: ${JSON.stringify(name)}`);
    }
    if (seen.has(name)) {
      throw new TypeError(`Duplicate parameter name: ${JSON.stringify(name)}`);
    }
    seen.add(name);
  }

  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("options must be an object");
  }
  const outputLabel = options.outputLabel;
  if (outputLabel !== undefined) {
    validateFormulaNodeLabel(outputLabel, seen, "outputLabel");
  }

  const dag = new ProgramParser(input, parameters).parse();
  if (outputLabel !== undefined) {
    const root = dag.nodes[dag.root];
    if (root.label !== undefined && root.label !== outputLabel) {
      throw new TypeError(`outputLabel conflicts with assigned root label: ${JSON.stringify(root.label)}`);
    }
    dag.root = labelDagNode(dag, dag.root, outputLabel);
  }
  return dag;
}

function labelDagNode(dag, id, label) {
  const node = dag.nodes[id];
  if (node.label === label) return id;
  if (node.label === undefined) {
    dag.nodes[id] = { ...node, label };
    return id;
  }
  const newId = dag.nodes.length;
  dag.nodes.push({ ...node, id: newId, label });
  return newId;
}

/**
 * Validate an output DAG node label.
 *
 * Output labels are DAG lookup keys, not formula names. They may match
 * parameter names or formula function names.
 *
 * @param {unknown} label - Candidate node label.
 * @param {Iterable<string>} [_parameters=[]] - Ignored compatibility parameter.
 * @param {string} [fieldName="label"] - Field name used in error messages.
 * @returns {string} The validated label.
 * @throws {TypeError} If the label is invalid.
 */
export function validateFormulaNodeLabel(label, _parameters = [], fieldName = "label") {
  return validateDagNodeLabel(label, fieldName);
}

/**
 * Supported named constants.
 *
 * @type {Set<string>}
 */
export { CONSTANTS };

/**
 * Names reserved by constants and supported functions.
 *
 * @type {Set<string>}
 */
export { RESERVED_NAMES };

/**
 * Supported one-argument function names.
 *
 * @type {Set<string>}
 */
export { UNARY_FUNCTIONS };

/**
 * Supported two-argument function names.
 *
 * @type {Set<string>}
 */
export { BINARY_FUNCTIONS };

/**
 * Supported one-or-more argument function names.
 *
 * @type {Set<string>}
 */
export { VARIADIC_FUNCTIONS };

/**
 * Syntax error thrown when expression parsing fails.
 *
 * Instances include `index` and `input` properties identifying the parse
 * failure location.
 */
export { FormulaParseError };
