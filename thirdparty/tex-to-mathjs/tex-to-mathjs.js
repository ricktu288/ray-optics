"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateTex = exports.parseTex = void 0;
//const tokenizeTex_1 = __importDefault(require("./tokenizeTex"));
//const parseTokens_1 = __importDefault(require("./parseTokens"));
/**
 * Parse a TeX math string into a MathJS expression tree.
 * @returns Returns an object containing the root node of a MathJS expression tree
 *          and variables that need to be defined.
 */
function parseTex(texStr) {
    return parseTokens(tokenizeTex(texStr));
}
exports.parseTex = parseTex;
/**
 * Evaluate a TeX math string, returning the result as a MathJS MathType.
 */
function evaluateTex(texStr, scope) {
    const root = parseTex(texStr);
    const evaluated = root.evaluate(scope);
    return { evaluated, scope };
}
exports.evaluateTex = evaluateTex;
